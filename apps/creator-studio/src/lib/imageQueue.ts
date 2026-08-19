/**
 * lib/imageQueue.ts
 * Pre-flight validation + client-side throttled runner for syncing generated
 * images into Studio. Two independent phases, run as separate "runs":
 *
 *  Phase A — Character Portraits: one reference model sheet per named
 *    character.
 *
 *  Phase B — Scenes & Cover: walks every scene missing an image.
 *
 * RETIRED: Studio no longer generates images itself. All image rendering
 * (character model sheets, scenes, cover, and — going forward — props/
 * locations) happens in the pageCast Media Platform
 * (`python skills/pageCast_gui.py`, Images/Characters tabs), which drives a
 * local ComfyUI instance via skills/generate_images.py. This file is now
 * SYNC-ONLY:
 *
 *   - If a matching file already exists in CHARACTER_REFS/, images/, or
 *     cover.* — it's treated as APPROVED. It gets synced into Supabase
 *     Storage and the corresponding record is updated.
 *   - If no matching file exists, the job is reported so you know what's
 *     still missing — go generate it in the pageCast Media Platform, then
 *     re-run this to sync it in. Studio itself makes no ComfyUI/render call.
 *
 * This means the .casts/<slug>/ folder IS the review queue — there's no
 * separate in-app "Approve" step. Deliberately independent from
 * lib/ttsQueue.ts / lib/ttsRateLimit.ts per product decision to keep audio
 * and image generation infra separate.
 */
import type { Story, Character, Chapter, Scene } from '@/types'
import { slugify } from './slug'
import { createClient } from './supabase/client'
import { uploadCharacterPortrait, uploadSceneImage } from './supabase/storage'
import { updateCharacter as dbUpdateCharacter } from './supabase/characters'
import { updateSceneAtmosphere } from './supabase/scenes'
import { updateBook, uploadCoverImage } from './supabase/books'
import {
  createImageRun,
  updateImageJob,
  updateImageRun,
  type ImageJob,
  type ImageJobStatus,
  type NewImageJobInput,
} from './supabase/imageJobs'
import {
  getImageRateLimit,
  ImageRateLimiter,
  IMAGE_RETRY_BACKOFF_MS,
  isImageRateLimitError,
} from './imageRateLimit'
import {
  draftCharacterPortraitPrompt,
  buildScenePrompt,
  buildCoverPrompt,
  charactersInScene,
} from './imagePrompts'
import type { LocalImagesScanResult, LocalCharacterFile, LocalSceneFile } from '@/app/api/local-images/scan/route'

const CANCEL_POLL_MS = 4000

// ── Local folder manifest ────────────────────────────────────────────────

export type LocalImageManifest = LocalImagesScanResult

const EMPTY_MANIFEST: LocalImageManifest = { exists: false, characterFiles: [], sceneFiles: [], coverPath: null }

export async function fetchLocalManifest(bookTitle: string): Promise<LocalImageManifest> {
  const slug = slugify(bookTitle)
  try {
    const res = await fetch(`/api/local-images/scan?slug=${encodeURIComponent(slug)}`)
    if (!res.ok) return EMPTY_MANIFEST
    return await res.json()
  } catch {
    return EMPTY_MANIFEST
  }
}

async function readLocalImageAsBlob(slug: string, relPath: string): Promise<{ blob: Blob; mimeType: string } | null> {
  try {
    const res = await fetch(`/api/local-images/read?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(relPath)}`)
    if (!res.ok) return null
    const blob = await res.blob()
    return { blob, mimeType: res.headers.get('Content-Type') ?? 'image/jpeg' }
  } catch {
    return null
  }
}

function localReadUrl(origin: string, slug: string, relPath: string): string {
  return `${origin}/api/local-images/read?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(relPath)}`
}

async function writeLocalImage(slug: string, relPath: string, dataBase64: string): Promise<boolean> {
  try {
    const res = await fetch('/api/local-images/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, path: relPath, dataBase64 }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function extFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  return 'jpg'
}

function findCharacterFile(manifest: LocalImageManifest, displayName: string): LocalCharacterFile | undefined {
  const needle = displayName.trim().toLowerCase()
  return manifest.characterFiles.find(f => f.name.trim().toLowerCase() === needle)
}

function findSceneFile(manifest: LocalImageManifest, chapterNum: number, sceneNum: number): LocalSceneFile | undefined {
  return manifest.sceneFiles.find(f => f.chapterNum === chapterNum && f.sceneNum === sceneNum)
}

// ── Low-level API call ───────────────────────────────────────────────────

type ComfyKind = 'character_portrait' | 'scene_single' | 'scene_dual' | 'scene_no_ref' | 'cover_single' | 'cover_no_ref'

/** Picks the right ComfyUI workflow kind for however many reference images a scene/cover job resolved. */
function comfyKindForRefs(refCount: number, target: 'scene' | 'cover'): ComfyKind {
  if (target === 'cover') return refCount >= 1 ? 'cover_single' : 'cover_no_ref'
  if (refCount >= 2) return 'scene_dual'
  if (refCount === 1) return 'scene_single'
  return 'scene_no_ref'
}

const COMFYUI_RETIRED_MESSAGE =
  'Studio no longer generates images itself. Open the pageCast Media Platform ' +
  '(python skills/pageCast_gui.py) and use the Images/Characters tab to render this — ' +
  'once the file lands in your local .casts folder, re-run this to sync it in.'

/** @deprecated In-app ComfyUI generation is retired — see COMFYUI_RETIRED_MESSAGE. Kept as a no-op so call sites still get a clear, actionable error instead of failing silently. */
async function callComfyUIImage(_opts: {
  kind: ComfyKind
  prompt: string
  referenceImageUrls?: string[]
}): Promise<{ blob: Blob | null; mimeType: string; error: string | null }> {
  return { blob: null, mimeType: '', error: COMFYUI_RETIRED_MESSAGE }
}

// ── Phase A: Character Portraits ─────────────────────────────────────────

export interface PlannedPortraitJob {
  character: Character
  mode: 'sync' | 'generate'
  prompt: string
  /** sync: the existing file to read. generate: the destination to write the candidate to. */
  localPath: string
}

export function planCharacterPortraitJobs(
  story: Story,
  manifest: LocalImageManifest,
  opts: { forceCharacterIds?: Set<string> } = {}
): PlannedPortraitJob[] {
  const jobs: PlannedPortraitJob[] = []
  for (const c of story.characters) {
    if (c.role === 'narrator') continue
    const force = opts.forceCharacterIds?.has(c.id) ?? false
    if (!force && (c.portraitStatus === 'approved' || c.portraitStatus === 'generating')) continue
    const match = findCharacterFile(manifest, c.displayName)
    const prompt = c.portraitPrompt?.trim() || draftCharacterPortraitPrompt(c, story)
    if (match && !force) {
      jobs.push({ character: c, mode: 'sync', prompt, localPath: match.path })
    } else {
      jobs.push({ character: c, mode: 'generate', prompt, localPath: match?.path ?? `CHARACTER_REFS/${c.displayName}.jpg` })
    }
  }
  return jobs
}

export interface PortraitPreflightResult {
  ok: boolean
  blockers: string[]
  warnings: string[]
  jobs: PlannedPortraitJob[]
  manifest: LocalImageManifest
}

export async function runPortraitPreflight(story: Story): Promise<PortraitPreflightResult> {
  const manifest = await fetchLocalManifest(story.title)
  const jobs = planCharacterPortraitJobs(story, manifest)
  const blockers: string[] = []
  const warnings: string[] = []

  const syncCount = jobs.filter(j => j.mode === 'sync').length
  const generateCount = jobs.filter(j => j.mode === 'generate').length

  if (jobs.length === 0) {
    blockers.push('Every character already has an approved model sheet.')
  }
  if (generateCount > 0) {
    warnings.push(`${generateCount} character${generateCount === 1 ? '' : 's'} still ${generateCount === 1 ? 'needs' : 'need'} a model sheet. Generate ${generateCount === 1 ? 'it' : 'them'} in the pageCast Media Platform (python skills/pageCast_gui.py → Characters tab), then re-run this to sync it in — Studio no longer renders images itself.`)
  }
  if (syncCount > 0) {
    warnings.push(`${syncCount} character${syncCount === 1 ? '' : 's'} already ${syncCount === 1 ? 'has' : 'have'} a file in CHARACTER_REFS/ — will be synced in as approved, no generation needed.`)
  }

  return { ok: blockers.length === 0, blockers, warnings, jobs, manifest }
}

// ── Phase B: Scenes & Cover ───────────────────────────────────────────────

export interface PlannedSceneJob {
  chapter: Chapter
  scene: Scene
  mode: 'sync' | 'generate'
  involvedCharacters: Character[]
  prompt: string
  referenceUrls: string[]
  /** sync: the existing file to read. generate: the destination to write the candidate to. */
  localPath: string
}

export interface PlannedCoverJob {
  mode: 'sync' | 'generate'
  prompt: string
  referenceUrls: string[]
  localPath: string
}

export interface BlockedScene {
  scene: Scene
  chapter: Chapter
  missingCharacterNames: string[]
  /** 'too_many_characters' when ComfyUI's scene workflows (max 2 references) can't cover this scene. */
  reason?: 'missing_portrait' | 'too_many_characters'
}

/** Resolves a usable reference image for a character: prefer the already-approved Supabase URL, else fall back to the local candidate file (read via the local-images API), else null if neither exists. */
function characterReferenceUrl(manifest: LocalImageManifest, slug: string, origin: string, c: Character): string | null {
  if (c.portraitStatus === 'approved' && c.portraitUrl) return c.portraitUrl
  const match = findCharacterFile(manifest, c.displayName)
  if (match) return localReadUrl(origin, slug, match.path)
  return null
}

export function planSceneAndCoverJobs(story: Story, manifest: LocalImageManifest, origin: string): {
  sceneJobs: PlannedSceneJob[]
  coverJob: PlannedCoverJob | null
  blockedScenes: BlockedScene[]
  coverBlockedReason: string | null
} {
  const slug = slugify(story.title)
  const sceneJobs: PlannedSceneJob[] = []
  const blockedScenes: BlockedScene[] = []

  story.chapters.forEach((chapter, chapterIdx) => {
    chapter.scenes.forEach((scene, sceneIdx) => {
      if (scene.sceneImage) return
      const chapterNum = chapterIdx + 1
      const sceneNum = sceneIdx + 1
      const involved = charactersInScene(scene, story.characters)

      const localMatch = findSceneFile(manifest, chapterNum, sceneNum)
      if (localMatch) {
        sceneJobs.push({ chapter, scene, mode: 'sync', involvedCharacters: involved, prompt: '', referenceUrls: [], localPath: localMatch.path })
        return
      }

      // ComfyUI's scene workflows only wire up to 2 character reference
      // images (scene_single_character.json / scene_dual_character.json) —
      // a scene with more named characters than that can't be generated
      // with consistency and is reported as blocked rather than dropping
      // characters silently.
      if (involved.length > 2) {
        blockedScenes.push({ scene, chapter, missingCharacterNames: involved.map(c => c.displayName), reason: 'too_many_characters' })
        return
      }

      const missing = involved.filter(c => !characterReferenceUrl(manifest, slug, origin, c))
      if (missing.length > 0) {
        blockedScenes.push({ scene, chapter, missingCharacterNames: missing.map(c => c.displayName), reason: 'missing_portrait' })
        return
      }

      const refUrls = involved.map(c => characterReferenceUrl(manifest, slug, origin, c)).filter((u): u is string => !!u)
      sceneJobs.push({
        chapter,
        scene,
        mode: 'generate',
        involvedCharacters: involved,
        prompt: buildScenePrompt(scene, chapter, involved, story),
        referenceUrls: refUrls,
        localPath: `images/ch${chapterNum}_sc${sceneNum}_${slugify(scene.title || 'scene')}.jpg`,
      })
    })
  })

  let coverJob: PlannedCoverJob | null = null
  let coverBlockedReason: string | null = null
  const needsCover = !story.coverImage || !story.coverImage.startsWith('http')
  if (needsCover) {
    if (manifest.coverPath) {
      coverJob = { mode: 'sync', prompt: '', referenceUrls: [], localPath: manifest.coverPath }
    } else {
      const nonNarratorCharacters = story.characters.filter(c => c.role !== 'narrator')
      const protagonist = nonNarratorCharacters.find(c => characterReferenceUrl(manifest, slug, origin, c))
      if (nonNarratorCharacters.length > 0 && !protagonist) {
        coverBlockedReason = 'Cover skipped — no character has an approved model sheet in CHARACTER_REFS/ yet, so the cover can\'t reference a consistent design instead of inventing one from scratch.'
      } else {
        const refUrl = protagonist ? characterReferenceUrl(manifest, slug, origin, protagonist) : null
        coverJob = {
          mode: 'generate',
          prompt: buildCoverPrompt(story, protagonist),
          referenceUrls: refUrl ? [refUrl] : [],
          localPath: 'cover.jpg',
        }
      }
    }
  }

  return { sceneJobs, coverJob, blockedScenes, coverBlockedReason }
}

export interface SceneCoverPreflightResult {
  ok: boolean
  blockers: string[]
  warnings: string[]
  sceneJobs: PlannedSceneJob[]
  coverJob: PlannedCoverJob | null
  blockedScenes: BlockedScene[]
}

export async function runSceneCoverPreflight(story: Story): Promise<SceneCoverPreflightResult> {
  const manifest = await fetchLocalManifest(story.title)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const { sceneJobs, coverJob, blockedScenes, coverBlockedReason } = planSceneAndCoverJobs(story, manifest, origin)
  const blockers: string[] = []
  const warnings: string[] = []

  const syncCount = sceneJobs.filter(j => j.mode === 'sync').length + (coverJob?.mode === 'sync' ? 1 : 0)
  const generateCount = sceneJobs.filter(j => j.mode === 'generate').length + (coverJob?.mode === 'generate' ? 1 : 0)
  const totalJobs = sceneJobs.length + (coverJob ? 1 : 0)

  if (totalJobs === 0) {
    blockers.push(
      coverBlockedReason && sceneJobs.length === 0 && blockedScenes.length === 0
        ? coverBlockedReason
        : 'Nothing to do — every scene already has an image (or is blocked on a portrait) and the cover is either already set or blocked on a portrait too.'
    )
  }
  if (generateCount > 0) {
    warnings.push(`${generateCount} scene${generateCount === 1 ? '' : 's'}/cover still ${generateCount === 1 ? 'needs' : 'need'} an image. Generate ${generateCount === 1 ? 'it' : 'them'} in the pageCast Media Platform (python skills/pageCast_gui.py → Images tab), then re-run this to sync ${generateCount === 1 ? 'it' : 'them'} in — Studio no longer renders images itself.`)
  }
  if (syncCount > 0) {
    warnings.push(`${syncCount} image${syncCount === 1 ? '' : 's'} already found in your local .casts folder — will be synced in directly, no generation needed.`)
  }
  const missingPortraitScenes = blockedScenes.filter(b => b.reason !== 'too_many_characters')
  const tooManyCharacterScenes = blockedScenes.filter(b => b.reason === 'too_many_characters')
  if (missingPortraitScenes.length > 0) {
    const names = [...new Set(missingPortraitScenes.flatMap(b => b.missingCharacterNames))]
    warnings.push(
      `${missingPortraitScenes.length} scene${missingPortraitScenes.length === 1 ? '' : 's'} skipped — waiting on a model sheet in CHARACTER_REFS/ for: ${names.join(', ')}. ` +
      `Generate and approve those first, then re-run.`
    )
  }
  if (tooManyCharacterScenes.length > 0) {
    warnings.push(
      `${tooManyCharacterScenes.length} scene${tooManyCharacterScenes.length === 1 ? '' : 's'} skipped — more than 2 named characters, and the ComfyUI scene workflows only support up to 2 reference images per scene.`
    )
  }
  if (coverBlockedReason && totalJobs > 0) {
    warnings.push(coverBlockedReason)
  }

  return { ok: blockers.length === 0, blockers, warnings, sceneJobs, coverJob, blockedScenes }
}

// ── Generic throttled engine ──────────────────────────────────────────────

interface EngineTask {
  jobId: string
  targetId: string
  run: () => Promise<{ ok: boolean; resultUrl?: string; error?: string }>
}

export interface ImageRunProgress {
  total: number
  completed: number
  failed: number
  skipped: number
  running: number
}

export interface ImageRunCallbacks {
  onJobStatus?: (jobId: string, targetId: string, status: ImageJobStatus, resultUrl?: string, error?: string) => void
  onProgress?: (progress: ImageRunProgress) => void
}

class ImageQueueEngine {
  private cancelled = false
  private lastCancelCheck = 0
  private cursor = 0
  private limiter: ImageRateLimiter
  private counts: ImageRunProgress

  constructor(
    private runId: string,
    private tasks: EngineTask[],
    private callbacks: ImageRunCallbacks
  ) {
    this.limiter = new ImageRateLimiter(getImageRateLimit())
    this.counts = { total: tasks.length, completed: 0, failed: 0, skipped: 0, running: 0 }
  }

  cancel() { this.cancelled = true }

  private async checkCancelled(): Promise<boolean> {
    if (this.cancelled) return true
    const now = Date.now()
    if (now - this.lastCancelCheck < CANCEL_POLL_MS) return false
    this.lastCancelCheck = now
    try {
      const supabase = createClient()
      const { data } = await supabase.from('image_runs').select('status').eq('id', this.runId).single()
      if (data?.status === 'cancelled') this.cancelled = true
    } catch { /* transient — don't stop the run for this alone */ }
    return this.cancelled
  }

  private emit() { this.callbacks.onProgress?.({ ...this.counts }) }

  async start(): Promise<void> {
    await updateImageRun(this.runId, { status: 'running', startedAt: new Date().toISOString() })
    this.emit()

    for (;;) {
      if (await this.checkCancelled()) {
        while (this.cursor < this.tasks.length) {
          const task = this.tasks[this.cursor++]
          await updateImageJob(task.jobId, { status: 'skipped', error: 'Run cancelled' })
          this.counts.skipped++
          this.callbacks.onJobStatus?.(task.jobId, task.targetId, 'skipped', undefined, 'Run cancelled')
        }
        this.emit()
        break
      }

      if (this.cursor >= this.tasks.length) break
      const task = this.tasks[this.cursor++]
      this.counts.running++
      this.emit()
      await this.runOne(task)
      this.counts.running--
      this.emit()
    }

    const finalStatus = this.cancelled
      ? 'cancelled'
      : this.counts.failed > 0
        ? 'completed_with_errors'
        : 'completed'
    await updateImageRun(this.runId, {
      status: finalStatus,
      completedJobs: this.counts.completed,
      failedJobs: this.counts.failed,
      skippedJobs: this.counts.skipped,
      finishedAt: new Date().toISOString(),
    })
    this.emit()
  }

  private async runOne(task: EngineTask): Promise<void> {
    await updateImageJob(task.jobId, { status: 'running', startedAt: new Date().toISOString(), attempts: 1 })
    this.callbacks.onJobStatus?.(task.jobId, task.targetId, 'running')

    const maxAttempts = IMAGE_RETRY_BACKOFF_MS.length + 1
    let lastError: string | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let release: (() => void) | null = null
      try {
        release = await this.limiter.acquire(() => this.cancelled)
      } catch {
        await updateImageJob(task.jobId, { status: 'skipped', error: 'Run cancelled' })
        this.counts.skipped++
        this.callbacks.onJobStatus?.(task.jobId, task.targetId, 'skipped', undefined, 'Run cancelled')
        return
      }

      try {
        const result = await task.run()
        if (result.ok) {
          await updateImageJob(task.jobId, { status: 'succeeded', finishedAt: new Date().toISOString() })
          this.counts.completed++
          this.callbacks.onJobStatus?.(task.jobId, task.targetId, 'succeeded', result.resultUrl)
          return
        }
        lastError = result.error ?? 'Generation failed'
      } catch (e: any) {
        lastError = e?.message ?? 'Unknown error'
      } finally {
        release?.()
      }

      const shouldRetry = attempt < maxAttempts && isImageRateLimitError(lastError)
      if (!shouldRetry) break
      await new Promise(resolve => setTimeout(resolve, IMAGE_RETRY_BACKOFF_MS[attempt - 1] ?? IMAGE_RETRY_BACKOFF_MS.at(-1)))
      await updateImageJob(task.jobId, { attempts: attempt + 1 })
    }

    await updateImageJob(task.jobId, { status: 'failed', error: lastError, finishedAt: new Date().toISOString() })
    this.counts.failed++
    this.callbacks.onJobStatus?.(task.jobId, task.targetId, 'failed', undefined, lastError ?? undefined)
  }
}

// ── Starters ──────────────────────────────────────────────────────────────

export async function startCharacterPortraitRun(
  bookId: string,
  userId: string,
  story: Story,
  jobs: PlannedPortraitJob[],
  callbacks: ImageRunCallbacks = {}
): Promise<ImageQueueEngine | null> {
  const slug = slugify(story.title)
  const jobInputs: NewImageJobInput[] = jobs.map(j => ({
    jobType: 'character_portrait',
    characterId: j.character.id,
    characterName: j.character.displayName,
    chapterId: null, chapterTitle: null, sceneId: null, sceneTitle: null,
    referenceCharacterNames: [],
    prompt: j.prompt,
  }))
  const created = await createImageRun(bookId, userId, 'character_portraits', jobInputs)
  if (!created) return null

  const tasks: EngineTask[] = jobs.map((j, i) => ({
    jobId: created.jobs[i].id,
    targetId: j.character.id,
    run: async () => {
      if (j.mode === 'sync') {
        const local = await readLocalImageAsBlob(slug, j.localPath)
        if (!local) return { ok: false, error: `Could not read ${j.localPath} — check the file wasn't moved mid-run.` }
        const ext = extFromMime(local.mimeType)
        const file = new File([local.blob], `${j.character.id}.${ext}`, { type: local.mimeType })
        const url = await uploadCharacterPortrait(userId, bookId, j.character.id, file)
        if (!url) return { ok: false, error: 'Found the local file, but upload to storage failed.' }
        await dbUpdateCharacter(j.character.id, { portraitUrl: url, portraitStatus: 'approved', portraitPrompt: j.prompt })
        return { ok: true, resultUrl: url }
      }

      await dbUpdateCharacter(j.character.id, { portraitStatus: 'generating' })
      const { blob, mimeType, error } = await callComfyUIImage({ kind: 'character_portrait', prompt: j.prompt })
      if (!blob) {
        await dbUpdateCharacter(j.character.id, { portraitStatus: 'failed' })
        return { ok: false, error: error ?? 'Generation failed' }
      }
      const ext = extFromMime(mimeType)
      const localPath = `CHARACTER_REFS/${j.character.displayName}.${ext}`
      const dataBase64 = await blobToBase64(blob)
      const saved = await writeLocalImage(slug, localPath, dataBase64)
      if (!saved) {
        await dbUpdateCharacter(j.character.id, { portraitStatus: 'failed' })
        return { ok: false, error: 'Generated, but saving the candidate to CHARACTER_REFS/ failed.' }
      }
      await dbUpdateCharacter(j.character.id, { portraitStatus: 'pending_review', portraitPrompt: j.prompt })
      // No resultUrl — this is a candidate awaiting file-system review, not an approved portrait.
      return { ok: true }
    },
  }))

  const engine = new ImageQueueEngine(created.run.id, tasks, callbacks)
  void engine.start()
  return engine
}

export async function startSceneAndCoverRun(
  bookId: string,
  userId: string,
  story: Story,
  sceneJobs: PlannedSceneJob[],
  coverJob: PlannedCoverJob | null,
  callbacks: ImageRunCallbacks = {}
): Promise<ImageQueueEngine | null> {
  const slug = slugify(story.title)
  const jobInputs: NewImageJobInput[] = [
    ...sceneJobs.map(j => ({
      jobType: 'scene_image' as const,
      characterId: null, characterName: null,
      chapterId: j.chapter.id, chapterTitle: j.chapter.title,
      sceneId: j.scene.id, sceneTitle: j.scene.title,
      referenceCharacterNames: j.involvedCharacters.map(c => c.displayName),
      prompt: j.prompt || `(synced from ${j.localPath})`,
    })),
    ...(coverJob ? [{
      jobType: 'cover_image' as const,
      characterId: null, characterName: null,
      chapterId: null, chapterTitle: null, sceneId: null, sceneTitle: null,
      referenceCharacterNames: [],
      prompt: coverJob.prompt || `(synced from ${coverJob.localPath})`,
    }] : []),
  ]
  if (jobInputs.length === 0) return null

  const created = await createImageRun(bookId, userId, 'scene_and_cover_images', jobInputs)
  if (!created) return null

  const tasks: EngineTask[] = []
  sceneJobs.forEach((j, i) => {
    tasks.push({
      jobId: created.jobs[i].id,
      targetId: j.scene.id,
      run: async () => {
        if (j.mode === 'sync') {
          const local = await readLocalImageAsBlob(slug, j.localPath)
          if (!local) return { ok: false, error: `Could not read ${j.localPath} — check the file wasn't moved mid-run.` }
          const ext = extFromMime(local.mimeType)
          const file = new File([local.blob], `${j.scene.id}.${ext}`, { type: local.mimeType })
          const url = await uploadSceneImage(userId, bookId, j.scene.id, file)
          if (!url) return { ok: false, error: 'Found the local file, but upload to storage failed.' }
          const saved = await updateSceneAtmosphere(j.scene.id, { sceneImage: url })
          if (!saved) return { ok: false, error: 'Uploaded, but saving the scene record failed.' }
          return { ok: true, resultUrl: url }
        }

        const { blob, mimeType, error } = await callComfyUIImage({
          kind: comfyKindForRefs(j.referenceUrls.length, 'scene'),
          prompt: j.prompt,
          referenceImageUrls: j.referenceUrls,
        })
        if (!blob) return { ok: false, error: error ?? 'Generation failed' }
        const ext = extFromMime(mimeType)
        const localPath = j.localPath.replace(/\.\w+$/, `.${ext}`)
        const dataBase64 = await blobToBase64(blob)
        const saved = await writeLocalImage(slug, localPath, dataBase64)
        if (!saved) return { ok: false, error: 'Generated, but saving the candidate to images/ failed.' }
        return { ok: true }
      },
    })
  })
  if (coverJob) {
    const coverJobId = created.jobs[sceneJobs.length].id
    tasks.push({
      jobId: coverJobId,
      targetId: 'cover',
      run: async () => {
        if (coverJob.mode === 'sync') {
          const local = await readLocalImageAsBlob(slug, coverJob.localPath)
          if (!local) return { ok: false, error: `Could not read ${coverJob.localPath} — check the file wasn't moved mid-run.` }
          const ext = extFromMime(local.mimeType)
          const file = new File([local.blob], `cover.${ext}`, { type: local.mimeType })
          let url: string
          try {
            url = await uploadCoverImage(bookId, file)
          } catch (e: any) {
            return { ok: false, error: e?.message ?? 'Found the local file, but upload to storage failed.' }
          }
          const saved = await updateBook(bookId, { coverImage: url })
          if (!saved) return { ok: false, error: 'Uploaded, but saving the book record failed.' }
          return { ok: true, resultUrl: url }
        }

        const { blob, mimeType, error } = await callComfyUIImage({
          kind: comfyKindForRefs(coverJob.referenceUrls.length, 'cover'),
          prompt: coverJob.prompt,
          referenceImageUrls: coverJob.referenceUrls,
        })
        if (!blob) return { ok: false, error: error ?? 'Generation failed' }
        const ext = extFromMime(mimeType)
        const dataBase64 = await blobToBase64(blob)
        const saved = await writeLocalImage(slug, `cover.${ext}`, dataBase64)
        if (!saved) return { ok: false, error: 'Generated, but saving the candidate cover.jpg failed.' }
        return { ok: true }
      },
    })
  }

  const engine = new ImageQueueEngine(created.run.id, tasks, callbacks)
  void engine.start()
  return engine
}

export type { ImageQueueEngine }

// ── One-off retry (used by the /image-status page) ─────────────────────────

/**
 * Re-attempts a single failed/skipped job outside of any active run. If
 * bookTitle is supplied, it first checks the book's local .casts/<slug>/
 * folder — a matching file there is synced in as approved, same as a normal
 * run; otherwise it falls back to a fresh ComfyUI render using the prompt
 * snapshotted on the job row plus reference images resolved from the book's
 * current approved (or locally-present) character portraits.
 */
export async function retryImageJob(job: ImageJob, bookTitle?: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { ok: false, error: 'Not signed in.' }
  const userId = userData.user.id

  const slug = bookTitle ? slugify(bookTitle) : null
  const manifest = slug ? await fetchLocalManifest(bookTitle!) : EMPTY_MANIFEST
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  await updateImageJob(job.id, { status: 'running', startedAt: new Date().toISOString(), attempts: job.attempts + 1 })

  // ── Sync path: a matching local file exists, use it directly. ──
  if (slug) {
    let localMatch: string | null = null
    if (job.jobType === 'character_portrait' && job.characterName) {
      localMatch = findCharacterFile(manifest, job.characterName)?.path ?? null
    } else if (job.jobType === 'cover_image') {
      localMatch = manifest.coverPath
    } else if (job.jobType === 'scene_image' && job.chapterTitle != null) {
      // Chapter/scene numbers aren't on the job row, so scene sync-on-retry
      // isn't attempted here — falls through to a fresh ComfyUI generation.
      localMatch = null
    }
    if (localMatch) {
      const local = await readLocalImageAsBlob(slug, localMatch)
      if (local) {
        const ext = extFromMime(local.mimeType)
        try {
          if (job.jobType === 'character_portrait' && job.characterId) {
            const file = new File([local.blob], `${job.characterId}.${ext}`, { type: local.mimeType })
            const url = await uploadCharacterPortrait(userId, job.bookId, job.characterId, file)
            if (!url) throw new Error('Upload failed')
            await dbUpdateCharacter(job.characterId, { portraitUrl: url, portraitStatus: 'approved', portraitPrompt: job.prompt ?? undefined })
          } else if (job.jobType === 'cover_image') {
            const file = new File([local.blob], `cover.${ext}`, { type: local.mimeType })
            const url = await uploadCoverImage(job.bookId, file)
            await updateBook(job.bookId, { coverImage: url })
          }
          await updateImageJob(job.id, { status: 'succeeded', error: null, finishedAt: new Date().toISOString() })
          return { ok: true }
        } catch (e: any) {
          await updateImageJob(job.id, { status: 'failed', error: e?.message ?? 'Upload/save failed', finishedAt: new Date().toISOString() })
          return { ok: false, error: e?.message ?? 'Upload/save failed' }
        }
      }
    }
  }

  // ── Generate path: no local file, fall back to a fresh ComfyUI render. ──
  if (!job.prompt) return { ok: false, error: 'No stored prompt to retry with.' }

  let referenceUrls: string[] = []
  if (job.referenceCharacterNames.length > 0) {
    const { data: chars } = await supabase
      .from('characters')
      .select('name, portrait_url, portrait_status')
      .eq('book_id', job.bookId)
      .in('name', job.referenceCharacterNames)
    referenceUrls = (chars ?? [])
      .filter((c: any) => c.portrait_status === 'approved' && c.portrait_url)
      .map((c: any) => c.portrait_url as string)
    if (slug) {
      // Fill in any names not covered by an approved DB portrait with a local CHARACTER_REFS match.
      for (const name of job.referenceCharacterNames) {
        const alreadyHasUrl = (chars ?? []).some((c: any) => c.name === name && c.portrait_status === 'approved' && c.portrait_url)
        if (alreadyHasUrl) continue
        const localFile = findCharacterFile(manifest, name)
        if (localFile) referenceUrls.push(localReadUrl(origin, slug, localFile.path))
      }
    }
  }

  const kind: ComfyKind = job.jobType === 'character_portrait'
    ? 'character_portrait'
    : comfyKindForRefs(referenceUrls.length, job.jobType === 'cover_image' ? 'cover' : 'scene')
  const { blob, mimeType, error } = await callComfyUIImage({ kind, prompt: job.prompt, referenceImageUrls: referenceUrls })
  if (!blob) {
    await updateImageJob(job.id, { status: 'failed', error: error ?? 'Generation failed', finishedAt: new Date().toISOString() })
    return { ok: false, error: error ?? 'Generation failed' }
  }

  const ext = extFromMime(mimeType)
  try {
    if (job.jobType === 'character_portrait' && job.characterId) {
      if (slug) {
        const localPath = `CHARACTER_REFS/${job.characterName ?? job.characterId}.${ext}`
        const dataBase64 = await blobToBase64(blob)
        await writeLocalImage(slug, localPath, dataBase64)
        await dbUpdateCharacter(job.characterId, { portraitStatus: 'pending_review', portraitPrompt: job.prompt })
      } else {
        const file = new File([blob], `${job.characterId}.${ext}`, { type: mimeType })
        const url = await uploadCharacterPortrait(userId, job.bookId, job.characterId, file)
        if (!url) throw new Error('Upload failed')
        await dbUpdateCharacter(job.characterId, { portraitUrl: url, portraitStatus: 'pending_review', portraitPrompt: job.prompt })
      }
    } else if (job.jobType === 'scene_image' && job.sceneId) {
      const file = new File([blob], `${job.sceneId}.${ext}`, { type: mimeType })
      const url = await uploadSceneImage(userId, job.bookId, job.sceneId, file)
      if (!url) throw new Error('Upload failed')
      await updateSceneAtmosphere(job.sceneId, { sceneImage: url })
    } else if (job.jobType === 'cover_image') {
      if (slug) {
        const dataBase64 = await blobToBase64(blob)
        await writeLocalImage(slug, `cover.${ext}`, dataBase64)
      } else {
        const file = new File([blob], `cover.${ext}`, { type: mimeType })
        const url = await uploadCoverImage(job.bookId, file)
        await updateBook(job.bookId, { coverImage: url })
      }
    }
  } catch (e: any) {
    await updateImageJob(job.id, { status: 'failed', error: e?.message ?? 'Upload/save failed', finishedAt: new Date().toISOString() })
    return { ok: false, error: e?.message ?? 'Upload/save failed' }
  }

  await updateImageJob(job.id, { status: 'succeeded', error: null, finishedAt: new Date().toISOString() })
  return { ok: true }
}
