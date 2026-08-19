/**
 * lib/ttsQueue.ts
 * Pre-flight validation + the client-side throttled runner for background
 * "Generate All Missing Audio" runs.
 *
 * Design (per product decision): the runner executes in the browser tab
 * that starts it — no server-side worker, no server-stored API keys. Job
 * and run state is persisted to Supabase (tts_runs / tts_jobs) as it goes,
 * so the /tts-status page can show live progress and history even from a
 * different tab; a run only *advances* while its origin tab stays open, but
 * cancellation from another tab is honoured within a few seconds.
 */
import type { Story, StoryBlock, Character } from '@/types'
import { generateBlockTts, getTtsApiKey, getTtsSettings, type TtsProvider } from './tts'
import { getPageCastVoice } from './voiceLibrary'
import { updateBlock as dbUpdateBlock } from './supabase/blocks'
import { createClient } from './supabase/client'
import {
  createTtsRun,
  updateTtsJob,
  updateTtsRun,
  type TtsJob,
  type TtsJobStatus,
  type NewTtsJobInput,
} from './supabase/ttsJobs'
import { createRateLimiters, RETRY_BACKOFF_MS, isRateLimitError, type ProviderRateLimiter } from './ttsRateLimit'

const MAX_WORKERS = 3
const CANCEL_POLL_MS = 4000

// ── Character / voice resolution (mirrors BlockItem.tsx) ────────────────────

function getBlockText(block: StoryBlock): string {
  return 'text' in block ? String((block as { text?: string }).text ?? '') : ''
}

export function resolveEffectiveCharacter(block: StoryBlock, characters: Character[]): Character | null {
  const id = 'characterId' in block ? (block as { characterId?: string }).characterId : undefined
  if (id) return characters.find(c => c.id === id) ?? null
  if (block.type === 'narration' || block.type === 'quote') {
    return characters.find(c => c.role === 'narrator') ?? characters[0] ?? null
  }
  if (block.type === 'dialogue' || block.type === 'thought') {
    return characters.find(c => c.role === 'character') ?? null
  }
  return null
}

function resolveProvider(voiceId: string): TtsProvider {
  if (voiceId.startsWith('elevenlabs:')) return 'elevenlabs'
  if (voiceId.startsWith('gemini:')) return 'gemini'
  return getTtsSettings().provider
}

function resolveSpeed(block: StoryBlock, voiceId: string): number {
  if (typeof block.voiceSpeed === 'number') return block.voiceSpeed
  if (voiceId.startsWith('elevenlabs:') && block.type === 'dialogue') return 0.88
  return getPageCastVoice(voiceId).rate
}

// ── Planning ──────────────────────────────────────────────────────────────

export interface PlannedJob {
  chapterId: string
  chapterTitle: string
  sceneId: string
  block: StoryBlock
  characterName: string
  voiceId: string
  voiceLabel?: string
  provider: TtsProvider
  charCount: number
}

/** All blocks in the book missing audio, with their resolved voice/provider. */
export function planMissingAudioJobs(story: Story): PlannedJob[] {
  const jobs: PlannedJob[] = []
  for (const chapter of story.chapters) {
    for (const scene of chapter.scenes) {
      for (const block of scene.blocks) {
        if (block.type === 'pause' || block.type === 'sfx') continue
        if (block.audioUrl) continue
        const text = getBlockText(block)
        if (!text.trim()) continue
        const character = resolveEffectiveCharacter(block, story.characters)
        const voiceId = character?.voiceId ?? 'ai_female_soft'
        jobs.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sceneId: scene.id,
          block,
          characterName: character?.displayName ?? 'Narrator',
          voiceId,
          voiceLabel: character?.voiceLabel,
          provider: resolveProvider(voiceId),
          charCount: text.length,
        })
      }
    }
  }
  return jobs
}

// ── Pre-flight ────────────────────────────────────────────────────────────

export interface PreflightResult {
  ok: boolean
  blockers: string[]
  warnings: string[]
  jobs: PlannedJob[]
  estimatedChars: number
  providersUsed: TtsProvider[]
}

/**
 * Checks, before a run is created:
 *  1. Every character actually used by a pending block has a real voiceId
 *     set on the Characters & Voices page (warning if missing — falls back
 *     to a default voice, so it's not a hard blocker).
 *  2. An API key is available for every provider that will be used.
 *     OpenAI/ElevenLabs need a client key (server has no per-user fallback
 *     for them in practice); Gemini can fall back to a server env key, so
 *     it's a warning, not a blocker, when absent client-side.
 *  3. The account's remaining TTS character credit covers the estimated
 *     run size.
 */
export async function runTtsPreflight(story: Story): Promise<PreflightResult> {
  const jobs = planMissingAudioJobs(story)
  const blockers: string[] = []
  const warnings: string[] = []

  if (jobs.length === 0) {
    return { ok: false, blockers: ['Every block already has audio — nothing to generate.'], warnings: [], jobs, estimatedChars: 0, providersUsed: [] }
  }

  // 1 — voice assignment
  const missingVoiceChars = new Set<string>()
  for (const job of jobs) {
    if (!job.voiceLabel && job.voiceId === 'ai_female_soft') {
      missingVoiceChars.add(job.characterName)
    }
  }
  if (missingVoiceChars.size > 0) {
    warnings.push(
      `${missingVoiceChars.size} character${missingVoiceChars.size === 1 ? '' : 's'} (${[...missingVoiceChars].join(', ')}) ` +
      `have no voice set on Characters & Voices — they'll use a generic default voice.`
    )
  }

  // 2 — API keys
  const providersUsed = [...new Set(jobs.map(j => j.provider))]
  for (const provider of providersUsed) {
    const key = getTtsApiKey(provider)
    const count = jobs.filter(j => j.provider === provider).length
    if (!key) {
      if (provider === 'gemini') {
        warnings.push(`No Gemini API key saved in Settings — ${count} block${count === 1 ? '' : 's'} will only work if a server-side Gemini key is configured.`)
      } else {
        blockers.push(`No ${provider === 'openai' ? 'OpenAI' : 'ElevenLabs'} API key saved in Settings → AI Voice (TTS) — required for ${count} block${count === 1 ? '' : 's'}.`)
      }
    }
  }

  // 3 — internal usage counter (informational only — never blocks).
  // tts_chars_used/limit on `profiles` is PageCast's own bookkeeping counter,
  // not a real ceiling: generation is billed by whichever provider's API key
  // you supplied, so this can't actually stop you from generating. It's
  // surfaced only so very large runs aren't a total surprise in Settings.
  const estimatedChars = jobs.reduce((sum, j) => sum + j.charCount, 0)
  try {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tts_chars_used, tts_chars_limit')
        .eq('id', userData.user.id)
        .single()
      if (profile) {
        const remaining = (profile.tts_chars_limit ?? 100000) - (profile.tts_chars_used ?? 0)
        if (estimatedChars > remaining) {
          warnings.push(
            `This run will push PageCast's internal usage counter past its configured limit (~${estimatedChars.toLocaleString()} needed, ${Math.max(0, remaining).toLocaleString()} left). ` +
            `This is just a bookkeeping number, not an actual cap — generation is billed by your own provider API key and will proceed normally.`
          )
        } else if (estimatedChars > remaining * 0.8) {
          warnings.push(`This run will use most of PageCast's tracked usage counter (~${estimatedChars.toLocaleString()} of ${remaining.toLocaleString()} left) — informational only.`)
        }
      }
    }
  } catch {
    // Non-critical — this check is informational, so a failure here shouldn't add noise.
  }

  return { ok: blockers.length === 0, blockers, warnings, jobs, estimatedChars, providersUsed }
}

// ── Runner ────────────────────────────────────────────────────────────────

export interface QueueJob extends PlannedJob {
  jobId: string
}

export interface RunProgress {
  total: number
  completed: number
  failed: number
  skipped: number
  running: number
}

export interface RunCallbacks {
  onJobStatus?: (jobId: string, blockId: string, status: TtsJobStatus, audioUrl?: string, error?: string) => void
  onProgress?: (progress: RunProgress) => void
}

/** Starts a Supabase-backed run + jobs for the given planned jobs, then begins processing. */
export async function startTtsRun(
  bookId: string,
  userId: string,
  jobs: PlannedJob[],
  callbacks: RunCallbacks = {}
): Promise<TtsQueueRunner | null> {
  const jobInputs: NewTtsJobInput[] = jobs.map(j => ({
    chapterId: j.chapterId,
    chapterTitle: j.chapterTitle,
    sceneId: j.sceneId,
    blockId: j.block.id,
    characterName: j.characterName,
    provider: j.provider,
    voiceId: j.voiceId,
    charCount: j.charCount,
  }))

  const created = await createTtsRun(bookId, userId, jobInputs)
  if (!created) return null

  const queueJobs: QueueJob[] = jobs.map((j, i) => ({ ...j, jobId: created.jobs[i].id }))
  const runner = new TtsQueueRunner(created.run.id, userId, bookId, queueJobs, callbacks)
  void runner.start()
  return runner
}

export class TtsQueueRunner {
  private cancelled = false
  private lastCancelCheck = 0
  private cursor = 0
  private limiters: Record<TtsProvider, ProviderRateLimiter>
  private counts: RunProgress

  constructor(
    private runId: string,
    private userId: string,
    private bookId: string,
    private jobs: QueueJob[],
    private callbacks: RunCallbacks
  ) {
    this.limiters = createRateLimiters()
    this.counts = { total: jobs.length, completed: 0, failed: 0, skipped: 0, running: 0 }
  }

  cancel() {
    this.cancelled = true
  }

  private async checkCancelled(): Promise<boolean> {
    if (this.cancelled) return true
    const now = Date.now()
    if (now - this.lastCancelCheck < CANCEL_POLL_MS) return false
    this.lastCancelCheck = now
    try {
      const supabase = createClient()
      const { data } = await supabase.from('tts_runs').select('status').eq('id', this.runId).single()
      if (data?.status === 'cancelled') this.cancelled = true
    } catch {
      // Network hiccup checking cancel state — don't stop the run for this alone.
    }
    return this.cancelled
  }

  private emitProgress() {
    this.callbacks.onProgress?.({ ...this.counts })
  }

  private nextJob(): QueueJob | null {
    if (this.cursor >= this.jobs.length) return null
    return this.jobs[this.cursor++]
  }

  async start(): Promise<void> {
    await updateTtsRun(this.runId, { status: 'running', startedAt: new Date().toISOString() })
    this.emitProgress()

    const workerCount = Math.min(MAX_WORKERS, this.jobs.length) || 1
    await Promise.all(Array.from({ length: workerCount }, () => this.worker()))

    const finalStatus = this.cancelled
      ? 'cancelled'
      : this.counts.failed > 0
        ? 'completed_with_errors'
        : 'completed'
    await updateTtsRun(this.runId, {
      status: finalStatus,
      completedJobs: this.counts.completed,
      failedJobs: this.counts.failed,
      skippedJobs: this.counts.skipped,
      finishedAt: new Date().toISOString(),
    })
    this.emitProgress()
  }

  private async worker(): Promise<void> {
    for (;;) {
      if (await this.checkCancelled()) {
        // Mark any remaining queued jobs as skipped so the log doesn't show them stuck "queued".
        let remaining: QueueJob | null
        while ((remaining = this.nextJob())) {
          await updateTtsJob(remaining.jobId, { status: 'skipped', error: 'Run cancelled' })
          this.counts.skipped++
          this.callbacks.onJobStatus?.(remaining.jobId, remaining.block.id, 'skipped', undefined, 'Run cancelled')
        }
        this.emitProgress()
        return
      }

      const job = this.nextJob()
      if (!job) return

      this.counts.running++
      this.emitProgress()
      await this.runOne(job)
      this.counts.running--
      this.emitProgress()
    }
  }

  private async runOne(job: QueueJob): Promise<void> {
    await updateTtsJob(job.jobId, { status: 'running', startedAt: new Date().toISOString(), attempts: 1 })
    this.callbacks.onJobStatus?.(job.jobId, job.block.id, 'running')

    const limiter = this.limiters[job.provider]
    const maxAttempts = RETRY_BACKOFF_MS.length + 1
    let lastError: string | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let release: (() => void) | null = null
      try {
        release = await limiter.acquire(() => this.cancelled)
      } catch {
        // Cancelled while waiting for a slot.
        await updateTtsJob(job.jobId, { status: 'skipped', error: 'Run cancelled' })
        this.counts.skipped++
        this.callbacks.onJobStatus?.(job.jobId, job.block.id, 'skipped', undefined, 'Run cancelled')
        return
      }

      try {
        const text = getBlockText(job.block)
        const result = await generateBlockTts({
          text,
          voiceId: job.voiceId,
          userId: this.userId,
          bookId: this.bookId,
          blockId: job.block.id,
          speed: resolveSpeed(job.block, job.voiceId),
          blockType: job.block.type,
          emotion: 'emotion' in job.block ? (job.block as { emotion?: string }).emotion : undefined,
          voiceLabel: job.voiceLabel,
          characterName: job.characterName,
        })

        if (result.url) {
          await dbUpdateBlock(job.block.id, { audioUrl: result.url } as Partial<StoryBlock>)
          await updateTtsJob(job.jobId, { status: 'succeeded', finishedAt: new Date().toISOString() })
          this.counts.completed++
          this.callbacks.onJobStatus?.(job.jobId, job.block.id, 'succeeded', result.url)
          return
        }

        lastError = result.error ?? 'Generation failed'
      } catch (e: any) {
        lastError = e?.message ?? 'Unknown error'
      } finally {
        release?.()
      }

      const shouldRetry = attempt < maxAttempts && isRateLimitError(lastError)
      if (!shouldRetry) break
      await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS.at(-1)))
      await updateTtsJob(job.jobId, { attempts: attempt + 1 })
    }

    await updateTtsJob(job.jobId, { status: 'failed', error: lastError, finishedAt: new Date().toISOString() })
    this.counts.failed++
    this.callbacks.onJobStatus?.(job.jobId, job.block.id, 'failed', undefined, lastError ?? undefined)
  }
}

// ── One-off retry (used by the /tts-status page — no full run needed) ──────

/**
 * Re-attempts a single failed/skipped job outside of any active run. Re-reads
 * the block's current text from the DB (in case it changed since the job was
 * created) but reuses the voice/provider that was snapshotted on the job —
 * matching "Re-gen" behaviour on the block itself.
 */
export async function retryTtsJob(job: TtsJob): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { ok: false, error: 'Not signed in.' }

  const { data: blockRow, error: blockError } = await supabase
    .from('blocks')
    .select('id, content')
    .eq('id', job.blockId)
    .single()
  if (blockError || !blockRow) return { ok: false, error: 'Block no longer exists.' }

  const text = String((blockRow.content as { text?: string } | null)?.text ?? '')
  if (!text.trim()) return { ok: false, error: 'Block has no text to synthesise.' }

  const voiceId = job.voiceId ?? 'ai_female_soft'
  await updateTtsJob(job.id, { status: 'running', startedAt: new Date().toISOString(), attempts: job.attempts + 1 })

  const result = await generateBlockTts({
    text,
    voiceId,
    userId: userData.user.id,
    bookId: job.bookId,
    blockId: job.blockId,
    speed: getPageCastVoice(voiceId).rate,
    characterName: job.characterName ?? undefined,
  })

  if (!result.url) {
    await updateTtsJob(job.id, { status: 'failed', error: result.error, finishedAt: new Date().toISOString() })
    return { ok: false, error: result.error ?? 'Generation failed.' }
  }

  await dbUpdateBlock(job.blockId, { audioUrl: result.url } as Partial<StoryBlock>)
  await updateTtsJob(job.id, { status: 'succeeded', error: null, finishedAt: new Date().toISOString() })
  return { ok: true }
}
