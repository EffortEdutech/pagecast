'use client'
import { useState } from 'react'
import { AlertCircle, Flag, Loader2, X } from 'lucide-react'
import { submitContentReport } from '@/lib/supabase/reports'
import { clsx } from 'clsx'

interface ReportContentButtonProps {
  bookId: string
  blockId?: string
  variant?: 'button' | 'icon'
}

const REASONS = [
  'Copyright or rights issue',
  'Harmful or unsafe content',
  'Incorrect age rating',
  'Spam or misleading content',
  'Other',
]

export function ReportContentButton({ bookId, blockId, variant = 'button' }: ReportContentButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    const ok = await submitContentReport({ bookId, blockId, reason, details, reporterEmail: email })
    setSubmitting(false)
    if (!ok) {
      setError('Could not submit the report. Please try again.')
      return
    }
    setSent(true)
    setTimeout(() => {
      setOpen(false)
      setSent(false)
      setDetails('')
      setEmail('')
    }, 1200)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          variant === 'icon'
            ? 'btn-ghost px-2 py-1.5 text-text-muted'
            : 'btn-secondary w-full justify-center text-xs'
        )}
        title="Report content"
      >
        <Flag size={variant === 'icon' ? 15 : 13} />
        {variant !== 'icon' && 'Report content'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="card-elevated w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-text-primary font-semibold">Report content</h2>
                <p className="text-text-muted text-xs mt-1">Send this to the PageCast review queue.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-danger text-xs">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div>
              <label className="label">Reason</label>
              <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
                {REASONS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Details</label>
              <textarea
                className="input resize-none"
                rows={4}
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Describe the issue, rights claim, or location in the Cast."
              />
            </div>

            <div>
              <label className="label">Email for follow-up</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="optional@example.com"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={submitting}>Cancel</button>
              <button className="btn-primary min-w-28 justify-center" onClick={handleSubmit} disabled={submitting || sent}>
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Sending</> : sent ? 'Sent' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
