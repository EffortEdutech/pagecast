'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Wand2, X, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { runTtsPreflight, startTtsRun, type PreflightResult, type RunProgress, type TtsQueueRunner } from '@/lib/ttsQueue'
import type { Story } from '@/types'

interface GenerateAllModalProps {
  story: Story
  bookId: string
  onClose: () => void
  /** Called whenever a job succeeds, so the open editor can reflect the new audioUrl immediately. */
  onBlockAudioReady?: (blockId: string, audioUrl: string) => void
}

const PROVIDER_LABEL: Record<string, string> = { openai: 'OpenAI', elevenlabs: 'ElevenLabs', gemini: 'Gemini' }

export function GenerateAllModal({ story, bookId, onClose, onBlockAudioReady }: GenerateAllModalProps) {
  const [loading, setLoading] = useState(true)
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [runner, setRunner] = useState<TtsQueueRunner | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    runTtsPreflight(story).then(result => { if (!cancelled) { setPreflight(result); setLoading(false) } })
    return () => { cancelled = true }
  }, [story])

  const handleStart = async () => {
    if (!preflight || !preflight.ok) return
    setStarting(true)
    setStartError(null)
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) { setStartError('Not signed in.'); setStarting(false); return }

    const started = await startTtsRun(bookId, data.user.id, preflight.jobs, {
      onProgress: p => setProgress(p),
      onJobStatus: (_jobId, blockId, status, audioUrl) => {
        if (status === 'succeeded' && audioUrl) onBlockAudioReady?.(blockId, audioUrl)
      },
    })
    setStarting(false)
    if (!started) { setStartError('Could not start the run — check your connection and try again.'); return }
    setRunner(started)
  }

  const isRunning = !!runner && !!progress && progress.completed + progress.failed + progress.skipped < progress.total

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={() => { if (!starting) onClose() }}>
      <div className="card-elevated max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wand2 size={16} className="text-gold" />
            <h3 className="text-text-primary font-semibold">Generate All Missing Audio</h3>
          </div>
          <button className="text-text-muted hover:text-text-primary" onClick={onClose}><X size={16} /></button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-text-secondary text-sm py-4">
            <Loader2 size={14} className="animate-spin" /> Checking cast, voices, and API keys…
          </div>
        )}

        {!loading && preflight && !runner && (
          <>
            <div className="rounded-lg border border-bg-border bg-bg-elevated/50 p-3 text-sm text-text-secondary space-y-1">
              <p><span className="text-text-primary font-medium">{preflight.jobs.length}</span> block{preflight.jobs.length === 1 ? '' : 's'} missing audio · ~<span className="text-text-primary font-medium">{preflight.estimatedChars.toLocaleString()}</span> characters</p>
              {preflight.providersUsed.length > 0 && (
                <p className="text-xs text-text-muted">Providers: {preflight.providersUsed.map(p => PROVIDER_LABEL[p] ?? p).join(', ')}</p>
              )}
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
              Requests are throttled per provider to stay under rate limits, and keep running in this browser tab even if you navigate away. Track progress any time on the{' '}
              <Link href="/tts-status" className="text-accent underline underline-offset-2">TTS Status</Link> page.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary text-sm" onClick={onClose} disabled={starting}>Cancel</button>
              <button
                className="btn-primary text-sm min-w-40 justify-center"
                onClick={handleStart}
                disabled={starting || !preflight.ok}
              >
                {starting ? <><Loader2 size={13} className="animate-spin" /> Starting…</> : <><Wand2 size={13} /> Start Generation</>}
              </button>
            </div>
          </>
        )}

        {runner && progress && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary font-medium">
                  {isRunning ? 'Generating…' : 'Done'}
                </span>
                <span className="text-text-muted font-mono text-[11px]">
                  {progress.completed + progress.failed + progress.skipped} / {progress.total}
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
              <Link href="/tts-status" className="text-accent underline underline-offset-2">TTS Status</Link> page.
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
