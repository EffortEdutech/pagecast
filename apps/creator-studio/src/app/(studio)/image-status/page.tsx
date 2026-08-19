'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from '@/components/layout/Header'
import {
  fetchImageRuns,
  fetchImageJobs,
  cancelImageRun,
  type ImageRun,
  type ImageJob,
} from '@/lib/supabase/imageJobs'
import { retryImageJob } from '@/lib/imageQueue'
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  ImagePlus, Loader2, RefreshCw, RotateCcw, XCircle, XSquare,
} from 'lucide-react'
import { clsx } from 'clsx'

const POLL_MS = 4000

function formatTime(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const RUN_TYPE_LABEL: Record<ImageRun['runType'], string> = {
  character_portraits: 'Character Portraits',
  scene_and_cover_images: 'Scenes & Cover',
}

const JOB_TYPE_LABEL: Record<ImageJob['jobType'], string> = {
  character_portrait: 'Portrait',
  scene_image: 'Scene',
  cover_image: 'Cover',
}

function RunStatusPill({ status }: { status: ImageRun['status'] }) {
  const map: Record<ImageRun['status'], { label: string; cls: string; icon: React.ReactNode }> = {
    queued:                { label: 'Queued',            cls: 'text-text-muted bg-bg-elevated', icon: <Loader2 size={11} /> },
    running:               { label: 'Running',            cls: 'text-accent bg-accent/10',        icon: <Loader2 size={11} className="animate-spin" /> },
    completed:             { label: 'Completed',          cls: 'text-success bg-success/10',      icon: <CheckCircle2 size={11} /> },
    completed_with_errors: { label: 'Completed (errors)', cls: 'text-warning bg-warning/10',      icon: <AlertTriangle size={11} /> },
    failed:                { label: 'Failed',             cls: 'text-danger bg-danger/10',        icon: <XCircle size={11} /> },
    cancelled:             { label: 'Cancelled',          cls: 'text-text-muted bg-bg-elevated',  icon: <XSquare size={11} /> },
  }
  const m = map[status]
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', m.cls)}>
      {m.icon} {m.label}
    </span>
  )
}

function JobStatusPill({ status }: { status: ImageJob['status'] }) {
  const map: Record<ImageJob['status'], { label: string; cls: string }> = {
    queued:    { label: 'Queued',    cls: 'text-text-muted bg-bg-elevated' },
    running:   { label: 'Running',   cls: 'text-accent bg-accent/10' },
    succeeded: { label: 'Succeeded', cls: 'text-success bg-success/10' },
    failed:    { label: 'Failed',    cls: 'text-danger bg-danger/10' },
    skipped:   { label: 'Skipped',   cls: 'text-warning bg-warning/10' },
  }
  const m = map[status]
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', m.cls)}>{m.label}</span>
}

function jobLabel(job: ImageJob): string {
  if (job.jobType === 'character_portrait') return job.characterName ?? 'Character'
  if (job.jobType === 'cover_image') return 'Book cover'
  return `${job.chapterTitle ?? 'Untitled chapter'} · ${job.sceneTitle ?? 'Untitled scene'}`
}

function JobRow({ job, bookTitle, onRetried }: { job: ImageJob; bookTitle: string | null; onRetried: () => void }) {
  const [retrying, setRetrying] = useState(false)
  const canRetry = job.status === 'failed' || job.status === 'skipped'

  const handleRetry = async () => {
    setRetrying(true)
    await retryImageJob(job, bookTitle ?? undefined)
    setRetrying(false)
    onRetried()
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 border-t border-bg-border/60 text-xs">
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-bg-elevated text-text-muted shrink-0">
        {JOB_TYPE_LABEL[job.jobType]}
      </span>
      <JobStatusPill status={job.status} />
      <div className="min-w-0 flex-1">
        <p className="text-text-secondary truncate">{jobLabel(job)}</p>
        {job.referenceCharacterNames.length > 0 && (
          <p className="text-text-muted text-[10px] truncate">Refs: {job.referenceCharacterNames.join(', ')}</p>
        )}
        {job.error && <p className="text-danger text-[11px] mt-0.5 truncate" title={job.error}>{job.error}</p>}
      </div>
      {canRetry && (
        <button
          className="btn-ghost text-[10px] px-1.5 py-0.5 border border-bg-border hover:border-accent/40 shrink-0"
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />} Retry
        </button>
      )}
    </div>
  )
}

function RunCard({ run, onChanged }: { run: ImageRun; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [jobs, setJobs] = useState<ImageJob[] | null>(null)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    setJobs(await fetchImageJobs(run.id))
    setLoadingJobs(false)
  }, [run.id])

  useEffect(() => { if (expanded) loadJobs() }, [expanded, loadJobs])

  useEffect(() => {
    if (!expanded || (run.status !== 'running' && run.status !== 'queued')) return
    const id = setInterval(loadJobs, POLL_MS)
    return () => clearInterval(id)
  }, [expanded, run.status, loadJobs])

  const active = run.status === 'running' || run.status === 'queued'
  const progressPct = run.totalJobs ? ((run.completedJobs + run.failedJobs + run.skippedJobs) / run.totalJobs) * 100 : 0

  const handleCancel = async () => {
    setCancelling(true)
    await cancelImageRun(run.id)
    setCancelling(false)
    onChanged()
  }

  const handleRetryAllFailed = async () => {
    const failed = (jobs ?? []).filter(j => j.status === 'failed' || j.status === 'skipped')
    for (const j of failed) {
      // eslint-disable-next-line no-await-in-loop
      await retryImageJob(j, run.bookTitle ?? undefined)
    }
    await loadJobs()
    onChanged()
  }

  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-text-primary text-sm font-medium truncate">{run.bookTitle ?? 'Untitled cast'}</p>
            <span className="text-[10px] text-text-muted bg-bg-elevated rounded-full px-2 py-0.5">{RUN_TYPE_LABEL[run.runType]}</span>
            <RunStatusPill status={run.status} />
          </div>
          <p className="text-text-muted text-[11px] mt-0.5">
            {run.completedJobs}/{run.totalJobs} done{run.failedJobs > 0 ? ` · ${run.failedJobs} failed` : ''}{run.skippedJobs > 0 ? ` · ${run.skippedJobs} skipped` : ''} · started {formatTime(run.startedAt ?? run.createdAt)}
          </p>
          {active && (
            <div className="h-1 w-full max-w-xs rounded-full bg-bg-border overflow-hidden mt-1.5">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>
        {active && (
          <span
            role="button"
            className="btn-ghost text-[11px] px-2 py-1 border border-bg-border hover:border-danger/40 hover:text-danger shrink-0"
            onClick={e => { e.stopPropagation(); handleCancel() }}
          >
            {cancelling ? <Loader2 size={11} className="animate-spin" /> : <XSquare size={11} />} Cancel
          </span>
        )}
        {!active && run.failedJobs + run.skippedJobs > 0 && (
          <span
            role="button"
            className="btn-ghost text-[11px] px-2 py-1 border border-bg-border hover:border-accent/40 shrink-0"
            onClick={e => { e.stopPropagation(); handleRetryAllFailed() }}
          >
            <RotateCcw size={11} /> Retry failed
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-bg-border">
          {loadingJobs && !jobs && (
            <div className="flex items-center gap-2 px-3 py-3 text-text-muted text-xs">
              <Loader2 size={12} className="animate-spin" /> Loading jobs…
            </div>
          )}
          {jobs?.map(job => <JobRow key={job.id} job={job} bookTitle={run.bookTitle} onRetried={() => { loadJobs(); onChanged() }} />)}
          {jobs?.length === 0 && <p className="px-3 py-3 text-text-muted text-xs">No jobs found for this run.</p>}
        </div>
      )}
    </div>
  )
}

export default function ImageStatusPage() {
  const [runs, setRuns] = useState<ImageRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      setRuns(await fetchImageRuns())
      setError(null)
    } catch {
      setError('Could not load image generation runs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasActive = runs.some(r => r.status === 'running' || r.status === 'queued')
    if (pollRef.current) clearInterval(pollRef.current)
    if (hasActive) pollRef.current = setInterval(load, POLL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [runs, load])

  const activeCount = runs.filter(r => r.status === 'running' || r.status === 'queued').length

  return (
    <>
      <Header title="Image Status">
        <button className="btn-ghost text-xs px-2 py-1.5" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </Header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-6">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <ImagePlus size={15} className="text-gold" />
          Background image generation runs, most recent first.
          {activeCount > 0 && <span className="text-accent">· {activeCount} active</span>}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {loading && runs.length === 0 && (
          <div className="flex items-center gap-2 text-text-muted text-sm py-8 justify-center">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        )}

        {!loading && runs.length === 0 && !error && (
          <div className="text-center py-16 text-text-muted text-sm">
            No generation runs yet. Use <span className="text-text-secondary">Generate Missing Portraits</span> on Characters & Voices,
            or <span className="text-text-secondary">Generate Images</span> in a cast's editor, to start one.
          </div>
        )}

        <div className="space-y-2 max-w-3xl">
          {runs.map(run => <RunCard key={run.id} run={run} onChanged={load} />)}
        </div>
      </div>
    </>
  )
}
