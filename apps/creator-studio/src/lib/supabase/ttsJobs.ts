/**
 * lib/supabase/ttsJobs.ts
 * CRUD for the `tts_runs` / `tts_jobs` tables (docs/migrations/020_tts_generation_jobs.sql).
 * Backs the background TTS generation queue and the /tts-status log page.
 * Mirrors the pattern used by characters.ts / blocks.ts.
 */
import { createClient } from './client'

export type TtsRunStatus = 'queued' | 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
export type TtsJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'

export interface TtsRun {
  id: string
  bookId: string
  ownerId: string
  status: TtsRunStatus
  totalJobs: number
  completedJobs: number
  failedJobs: number
  skippedJobs: number
  provider: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
  bookTitle?: string
}

export interface TtsJob {
  id: string
  runId: string
  bookId: string
  chapterId: string | null
  chapterTitle: string | null
  sceneId: string | null
  blockId: string
  characterName: string | null
  provider: string | null
  voiceId: string | null
  charCount: number
  status: TtsJobStatus
  error: string | null
  attempts: number
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
}

interface DbRun {
  id: string
  book_id: string
  owner_id: string
  status: TtsRunStatus
  total_jobs: number
  completed_jobs: number
  failed_jobs: number
  skipped_jobs: number
  provider: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
  books?: { title: string } | { title: string }[] | null
}

interface DbJob {
  id: string
  run_id: string
  book_id: string
  chapter_id: string | null
  chapter_title: string | null
  scene_id: string | null
  block_id: string
  character_name: string | null
  provider: string | null
  voice_id: string | null
  char_count: number
  status: TtsJobStatus
  error: string | null
  attempts: number
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

function dbToRun(row: DbRun): TtsRun {
  const bookRel = Array.isArray(row.books) ? row.books[0] : row.books
  return {
    id: row.id,
    bookId: row.book_id,
    ownerId: row.owner_id,
    status: row.status,
    totalJobs: row.total_jobs,
    completedJobs: row.completed_jobs,
    failedJobs: row.failed_jobs,
    skippedJobs: row.skipped_jobs,
    provider: row.provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    bookTitle: bookRel?.title,
  }
}

function dbToJob(row: DbJob): TtsJob {
  return {
    id: row.id,
    runId: row.run_id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title,
    sceneId: row.scene_id,
    blockId: row.block_id,
    characterName: row.character_name,
    provider: row.provider,
    voiceId: row.voice_id,
    charCount: row.char_count,
    status: row.status,
    error: row.error,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

export interface NewTtsJobInput {
  chapterId: string | null
  chapterTitle: string | null
  sceneId: string | null
  blockId: string
  characterName: string | null
  provider: string | null
  voiceId: string | null
  charCount: number
}

/** Create a run + its jobs in one go. Returns the run and created jobs, or null on failure. */
export async function createTtsRun(
  bookId: string,
  ownerId: string,
  jobs: NewTtsJobInput[]
): Promise<{ run: TtsRun; jobs: TtsJob[] } | null> {
  const supabase = createClient()

  const { data: runRow, error: runError } = await supabase
    .from('tts_runs')
    .insert({ book_id: bookId, owner_id: ownerId, status: 'queued', total_jobs: jobs.length })
    .select()
    .single()
  if (runError || !runRow) { console.error('[ttsJobs] createTtsRun run insert:', runError); return null }

  if (jobs.length === 0) {
    return { run: dbToRun(runRow as DbRun), jobs: [] }
  }

  const { data: jobRows, error: jobsError } = await supabase
    .from('tts_jobs')
    .insert(jobs.map(j => ({
      run_id: runRow.id,
      book_id: bookId,
      chapter_id: j.chapterId,
      chapter_title: j.chapterTitle,
      scene_id: j.sceneId,
      block_id: j.blockId,
      character_name: j.characterName,
      provider: j.provider,
      voice_id: j.voiceId,
      char_count: j.charCount,
      status: 'queued',
    })))
    .select()
  if (jobsError || !jobRows) {
    console.error('[ttsJobs] createTtsRun jobs insert:', jobsError)
    // Clean up the orphaned run so it doesn't show as a stuck "queued" run with 0 jobs.
    await supabase.from('tts_runs').delete().eq('id', runRow.id)
    return null
  }

  return { run: dbToRun(runRow as DbRun), jobs: (jobRows as DbJob[]).map(dbToJob) }
}

export async function fetchTtsRuns(limit = 50): Promise<TtsRun[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tts_runs')
    .select('*, books(title)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) { if (error) console.error('[ttsJobs] fetchTtsRuns:', error); return [] }
  return (data as DbRun[]).map(dbToRun)
}

export async function fetchActiveTtsRunForBook(bookId: string): Promise<TtsRun | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tts_runs')
    .select('*, books(title)')
    .eq('book_id', bookId)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return dbToRun(data as DbRun)
}

export async function fetchTtsJobs(runId: string): Promise<TtsJob[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tts_jobs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
  if (error || !data) { if (error) console.error('[ttsJobs] fetchTtsJobs:', error); return [] }
  return (data as DbJob[]).map(dbToJob)
}

export async function updateTtsRun(runId: string, updates: Partial<{
  status: TtsRunStatus
  completedJobs: number
  failedJobs: number
  skippedJobs: number
  provider: string | null
  startedAt: string | null
  finishedAt: string | null
}>): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (updates.status        !== undefined) patch.status         = updates.status
  if (updates.completedJobs !== undefined) patch.completed_jobs = updates.completedJobs
  if (updates.failedJobs    !== undefined) patch.failed_jobs    = updates.failedJobs
  if (updates.skippedJobs   !== undefined) patch.skipped_jobs   = updates.skippedJobs
  if (updates.provider      !== undefined) patch.provider       = updates.provider
  if (updates.startedAt     !== undefined) patch.started_at     = updates.startedAt
  if (updates.finishedAt    !== undefined) patch.finished_at    = updates.finishedAt
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('tts_runs').update(patch).eq('id', runId)
  if (error) console.error('[ttsJobs] updateTtsRun:', error)
}

export async function updateTtsJob(jobId: string, updates: Partial<{
  status: TtsJobStatus
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
  const { error } = await supabase.from('tts_jobs').update(patch).eq('id', jobId)
  if (error) console.error('[ttsJobs] updateTtsJob:', error)
}

/** Re-queue a failed/skipped job for retry (resets status, keeps attempt history). */
export async function requeueTtsJob(jobId: string): Promise<void> {
  await updateTtsJob(jobId, { status: 'queued', error: null, startedAt: null, finishedAt: null })
}

/** Mark an in-progress run as cancelled; the client runner checks this to stop early. */
export async function cancelTtsRun(runId: string): Promise<void> {
  await updateTtsRun(runId, { status: 'cancelled', finishedAt: new Date().toISOString() })
}
