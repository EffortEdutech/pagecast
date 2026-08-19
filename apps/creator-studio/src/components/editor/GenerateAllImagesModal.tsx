'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, CheckCircle2, ImagePlus, Loader2, X, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  runSceneCoverPreflight,
  startSceneAndCoverRun,
  type SceneCoverPreflightResult,
  type ImageRunProgress,
  type ImageQueueEngine,
} from '@/lib/imageQueue'
import type { Story } from '@/types'

interface GenerateAllImagesModalProps {
  story: Story
  bookId: string
  onClose: () => void
  /** Called whenever a scene or cover image finishes, so the open editor reflects it immediately. */
  onImageReady?: (target: 'cover' | string, url: string) => void
}

export function GenerateAllImagesModal({ story, bookId, onClose, onImageReady }: GenerateAllImagesModalProps) {
  const [loading, setLoading] = useState(true)
  const [preflight, setPreflight] = useState<SceneCoverPreflightResult | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [runner, setRunner] = useState<ImageQueueEngine | null>(null)
  const [progress, setProgress] = useState<ImageRunProgress | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    runSceneCoverPreflight(story).then(result => {
      if (!cancelled) { setPreflight(result); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [story])

  const handleStart = async () => {
    if (!preflight || !preflight.ok) return
    setStarting(true)
    setStartError(null)
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) { setStartError('Not signed in.'); setStarting(false); return }

    const started = await startSceneAndCoverRun(bookId, data.user.id, story, preflight.sceneJobs, preflight.coverJob, {
      onProgress: p => setProgress(p),
      onJobStatus: (_jobId, targetId, status, resultUrl) => {
        if (status === 'succeeded' && resultUrl) onImageReady?.(targetId, resultUrl)
      },
    })
    setStarting(false)
    if (!started) { setStartError('Could not start the run — check your connection and try again.'); return }
    setRunner(started)
  }

  const isRunning = !!runner && !!progress && progress.completed + progress.failed + progress.skipped < progress.total
  const totalPlanned = (preflight?.sceneJobs.length ?? 0) + (preflight?.coverJob ? 1 : 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={() => { if (!starting) onClose() }}>
      <div className="card-elevated max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ImagePlus size={16} className="text-gold" />
            <h3 className="text-text-primary font-semibold">Generate Scene & Cover Images</h3>
          </div>
          <button className="text-text-muted hover:text-text-primary" onClick={onClose}><X size={16} /></button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-text-secondary text-sm py-4">
            <Loader2 size={14} className="animate-spin" /> Checking scenes and reference portraits…
          </div>
        )}

        {!loading && preflight && !runner && (
          <>
            <div className="rounded-lg border border-bg-border bg-bg-elevated/50 p-3 text-sm text-text-secondary space-y-1">
              <p>
                <span className="text-text-primary font-medium">{preflight.sceneJobs.length}</span> scene{preflight.sceneJobs.length === 1 ? '' : 's'}
                {preflight.coverJob ? <> + <span className="text-text-primary font-medium">1</span> cover</> : ''} ready to generate
              </p>
            </div>

            {preflight.blockers.map((b, i) => (
              <div key={`blocker-${i}`} className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-danger text-xs">
                <XCircle size={13} className="shrink-0 mt-0.5" /> {b}
              </div>
            ))}
            {preflight.warnings.map((w, i) => (
              <div key={`warning-${i}`} className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-warning text-xs">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {w}
              </div>
            ))}

            {startError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-danger text-xs">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {startError}
              </div>
            )}

            <p className="text-[11px] text-text-muted">
              Keeps running in this browser tab even if you navigate away. Track progress on the{' '}
              <Link href="/image-status" className="text-accent underline underline-offset-2">Image Status</Link> page.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary text-sm" onClick={onClose} disabled={starting}>Cancel</button>
              <button
                className="btn-primary text-sm min-w-40 justify-center"
                onClick={handleStart}
                disabled={starting || !preflight.ok}
              >
                {starting ? <><Loader2 size={13} className="animate-spin" /> Starting…</> : <><ImagePlus size={13} /> Start Generation</>}
              </button>
            </div>
          </>
        )}

        {runner && progress && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary font-medium">{isRunning ? 'Generating…' : 'Done'}</span>
                <span className="text-text-muted font-mono text-[11px]">
                  {progress.completed + progress.failed + progress.skipped} / {progress.total || totalPlanned}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress.total ? ((progress.completed + progress.failed + progress.skipped) / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-text-muted">
                <span className="flex items-center gap-1 text-success"><CheckCircle2 size={11} /> {progress.completed}</span>
                {progress.failed > 0 && <span className="flex items-center gap-1 text-danger"><XCircle size={11} /> {progress.failed}</span>}
                {progress.skipped > 0 && <span className="flex items-center gap-1 text-warning"><AlertTriangle size={11} /> {progress.skipped}</span>}
              </div>
            </div>

            <p className="text-[11px] text-text-muted">
              You can close this and keep working — generation continues in this tab. Full log on the{' '}
              <Link href="/image-status" className="text-accent underline underline-offset-2">Image Status</Link> page.
            </p>

            <div className="flex justify-end">
              <button className="btn-secondary text-sm" onClick={onClose}>
                {isRunning ? 'Run in background' : 'Close'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
