/**
 * lib/supabase/imageJobs.ts
 * CRUD for `image_runs` / `image_jobs` (docs/migrations/021_image_generation.sql).
 * Deliberately independent from ttsJobs.ts — separate infra per product decision.
 */
import { createClient } from './client'

export type ImageRunType = 'character_portraits' | 'scene_and_cover_images'
export type ImageRunStatus = 'queued' | 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
export type ImageJobType = 'character_portrait' | 'scene_image' | 'cover_image'
export type ImageJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'

export interface ImageRun {
  id: string
  bookId: string
  ownerId: string
  runType: ImageRunType
  status: ImageRunStatus
  totalJobs: number
  completedJobs: number
  failedJobs: number
  skippedJobs: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
  bookTitle?: string
}

export interface ImageJob {
  id: string
  runId: string
  bookId: string
  jobType: ImageJobType
  characterId: string | null
  characterName: string | null
  chapterId: string | null
  chapterTitle: string | null
  sceneId: string | null
  sceneTitle: string | null
  referenceCharacterNames: string[]
  prompt: string | null
  status: ImageJobStatus
  error: string | null
  attempts: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
}

interface DbRun {
  id: string; book_id: string; owner_id: string; run_type: ImageRunType; status: ImageRunStatus
  total_jobs: number; completed_jobs: number; failed_jobs: number; skipped_jobs: number
  created_at: string; updated_at: string; started_at: string | null; finished_at: string | null
  books?: { title: string } | { title: string }[] | null
}

interface DbJob {
  id: string; run_id: string; book_id: string; job_type: ImageJobType
  character_id: string | null; character_name: string | null
  chapter_id: string | null; chapter_title: string | null
  scene_id: string | null; scene_title: string | null
  reference_character_names: string[] | null
  prompt: string | null; status: ImageJobStatus; error: string | null; attempts: number
  created_at: string; updated_at: string; started_at: string | null; finished_at: string | null
}

function dbToRun(row: DbRun): ImageRun {
  const bookRel = Array.isArray(row.books) ? row.books[0] : row.books
  return {
    id: row.id, bookId: row.book_id, ownerId: row.owner_id, runType: row.run_type, status: row.status,
    totalJobs: row.total_jobs, completedJobs: row.completed_jobs, failedJobs: row.failed_jobs, skippedJobs: row.skipped_jobs,
    createdAt: row.created_at, updatedAt: row.updated_at, startedAt: row.started_at, finishedAt: row.finished_at,
    bookTitle: bookRel?.title,
  }
}

function dbToJob(row: DbJob): ImageJob {
  return {
    id: row.id, runId: row.run_id, bookId: row.book_id, jobType: row.job_type,
    characterId: row.character_id, characterName: row.character_name,
    chapterId: row.chapter_id, chapterTitle: row.chapter_title,
    sceneId: row.scene_id, sceneTitle: row.scene_title,
    referenceCharacterNames: row.reference_character_names ?? [],
    prompt: row.prompt, status: row.status, error: row.error, attempts: row.attempts,
    createdAt: row.created_at, updatedAt: row.updated_at, startedAt: row.started_at, finishedAt: row.finished_at,
  }
}

export interface NewImageJobInput {
  jobType: ImageJobType
  characterId: string | null
  characterName: string | null
  chapterId: string | null
  chapterTitle: string | null
  sceneId: string | null
  sceneTitle: string | null
  referenceCharacterNames: string[]
  prompt: string
}

export async function createImageRun(
  bookId: string,
  ownerId: string,
  runType: ImageRunType,
  jobs: NewImageJobInput[]
): Promise<{ run: ImageRun; jobs: ImageJob[] } | null> {
  const supabase = createClient()

  const { data: runRow, error: runError } = await supabase
    .from('image_runs')
    .insert({ book_id: bookId, owner_id: ownerId, run_type: runType, status: 'queued', total_jobs: jobs.length })
    .select()
    .single()
  if (runError || !runRow) { console.error('[imageJobs] createImageRun run insert:', runError); return null }

  if (jobs.length === 0) return { run: dbToRun(runRow as DbRun), jobs: [] }

  const { data: jobRows, error: jobsError } = await supabase
    .from('image_jobs')
    .insert(jobs.map(j => ({
      run_id: runRow.id,
      book_id: bookId,
      job_type: j.jobType,
      character_id: j.characterId,
      character_name: j.characterName,
      chapter_id: j.chapterId,
      chapter_title: j.chapterTitle,
      scene_id: j.sceneId,
      scene_title: j.sceneTitle,
      reference_character_names: j.referenceCharacterNames,
      prompt: j.prompt,
      status: 'queued',
    })))
    .select()
  if (jobsError || !jobRows) {
    console.error('[imageJobs] createImageRun jobs insert:', jobsError)
    await supabase.from('image_runs').delete().eq('id', runRow.id)
    return null
  }

  return { run: dbToRun(runRow as DbRun), jobs: (jobRows as DbJob[]).map(dbToJob) }
}

export async function fetchImageRuns(limit = 50): Promise<ImageRun[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('image_runs')
    .select('*, books(title)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) { if (error) console.error('[imageJobs] fetchImageRuns:', error); return [] }
  return (data as DbRun[]).map(dbToRun)
}

export async function fetchImageJobs(runId: string): Promise<ImageJob[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('image_jobs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
  if (error || !data) { if (error) console.error('[imageJobs] fetchImageJobs:', error); return [] }
  return (data as DbJob[]).map(dbToJob)
}

export async function updateImageRun(runId: string, updates: Partial<{
  status: ImageRunStatus
  completedJobs: number
  failedJobs: number
  skippedJobs: number
  startedAt: string | null
  finishedAt: string | null
}>): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (updates.status        !== undefined) patch.status         = updates.status
  if (updates.completedJobs !== undefined) patch.completed_jobs = updates.completedJobs
  if (updates.failedJobs    !== undefined) patch.failed_jobs    = updates.failedJobs
  if (updates.skippedJobs   !== undefined) patch.skipped_jobs   = updates.skippedJobs
  if (updates.startedAt     !== undefined) patch.started_at     = updates.startedAt
  if (updates.finishedAt    !== undefined) patch.finished_at    = updates.finishedAt
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('image_runs').update(patch).eq('id', runId)
  if (error) console.error('[imageJobs] updateImageRun:', error)
}

export async function updateImageJob(jobId: string, updates: Partial<{
  status: ImageJobStatus
  error: string | null
  attempts: number
  startedAt: string | null
  finishedAt: string | null
}>): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (updates.status     !== undefined) patch.status      = updates.status
  if (updates.error      !== undefined) patch.error       = updates.error
  if (updates.attempts   !== undefined) patch.attempts    = updates.attempts
  if (updates.startedAt  !== undefined) patch.started_at  = updates.startedAt
  if (updates.finishedAt !== undefined) patch.finished_at = updates.finishedAt
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('image_jobs').update(patch).eq('id', jobId)
  if (error) console.error('[imageJobs] updateImageJob:', error)
}

export async function cancelImageRun(runId: string): Promise<void> {
  await updateImageRun(runId, { status: 'cancelled', finishedAt: new Date().toISOString() })
}
