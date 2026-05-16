'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import {
  submitPrivacyRequest,
  submitPublicContentReport,
  submitTakedownRequest,
} from '@/lib/supabase/reports'

type FormKind = 'report' | 'takedown' | 'privacy'

const REPORT_REASONS = [
  'Copyright or rights issue',
  'Harmful or unsafe content',
  'Incorrect age rating',
  'Spam or misleading content',
  'Other',
]

const CLAIM_TYPES = ['copyright', 'trademark', 'privacy', 'publicity', 'other']

const PRIVACY_TYPES = [
  ['access', 'Access my data'],
  ['correction', 'Correct my data'],
  ['deletion', 'Delete my data'],
  ['portability', 'Export my data'],
  ['withdraw_consent', 'Withdraw consent'],
  ['opt_out_sale_share', 'Opt out of sale/share'],
]

const COPY: Record<FormKind, { eyebrow: string; title: string; body: string }> = {
  report: {
    eyebrow: 'Reader safety',
    title: 'Report content',
    body: 'Use this form to flag a Cast, passage, audio segment, listing, or other PageCast content for review.',
  },
  takedown: {
    eyebrow: 'Rights holder process',
    title: 'Copyright or rights takedown request',
    body: 'Use this form if you believe PageCast content infringes copyright or another legal right you own or represent.',
  },
  privacy: {
    eyebrow: 'Global privacy rights',
    title: 'Privacy request',
    body: 'Use this form to request access, deletion, correction, portability, consent withdrawal, or similar privacy rights.',
  },
}

export function LegalRequestForm({ kind }: { kind: FormKind }) {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [bookId, setBookId] = useState('')
  const [assetId, setAssetId] = useState('')
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [claimType, setClaimType] = useState(CLAIM_TYPES[0])
  const [privacyType, setPrivacyType] = useState(PRIVACY_TYPES[0][0])
  const [countryCode, setCountryCode] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [details, setDetails] = useState('')

  const copy = COPY[kind]

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setSent(false)
    setError(null)

    let ok = false
    if (kind === 'report') {
      ok = await submitPublicContentReport({ bookId, reporterEmail: email, reason, details })
    } else if (kind === 'takedown') {
      ok = await submitTakedownRequest({ claimantName: name, claimantEmail: email, bookId, assetId, claimType, evidence: details })
    } else {
      ok = await submitPrivacyRequest({ email, countryCode, regionCode, requestType: privacyType, details })
    }

    setSubmitting(false)
    if (!ok) {
      setError('We could not submit this request. Please check the fields and try again.')
      return
    }
    setSent(true)
    setDetails('')
  }

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary">
      <section className="max-w-3xl mx-auto px-6 py-14">
        <Link href="/legal" className="text-text-secondary hover:text-text-primary text-sm">Legal and compliance</Link>
        <div className="mt-8 mb-6">
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-3">{copy.eyebrow}</p>
          <h1 className="text-4xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-text-secondary mt-3 leading-relaxed">{copy.body}</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-danger text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {sent && (
            <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-success text-sm">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              Request submitted. PageCast will review and route it to the right queue.
            </div>
          )}

          {kind === 'takedown' && (
            <div>
              <label className="label">Claimant or organization name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}

          <div>
            <label className="label">Email for follow-up</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required={kind !== 'report'} />
          </div>

          {kind === 'report' && (
            <div>
              <label className="label">Reason</label>
              <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
                {REPORT_REASONS.map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
          )}

          {kind === 'takedown' && (
            <div>
              <label className="label">Claim type</label>
              <select className="input" value={claimType} onChange={e => setClaimType(e.target.value)}>
                {CLAIM_TYPES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          )}

          {kind === 'privacy' && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="label">Request type</label>
                <select className="input" value={privacyType} onChange={e => setPrivacyType(e.target.value)}>
                  {PRIVACY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Country code</label>
                <input className="input" value={countryCode} onChange={e => setCountryCode(e.target.value)} placeholder="US" maxLength={2} />
              </div>
              <div>
                <label className="label">Region code</label>
                <input className="input" value={regionCode} onChange={e => setRegionCode(e.target.value)} placeholder="CA" />
              </div>
            </div>
          )}

          {kind !== 'privacy' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Book ID or Cast ID</label>
                <input className="input" value={bookId} onChange={e => setBookId(e.target.value)} placeholder="Optional UUID" />
              </div>
              {kind === 'takedown' && (
                <div>
                  <label className="label">Asset ID</label>
                  <input className="input" value={assetId} onChange={e => setAssetId(e.target.value)} placeholder="Optional UUID" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">{kind === 'takedown' ? 'Evidence and statement' : 'Details'}</label>
            <textarea
              className="input resize-none"
              rows={6}
              value={details}
              onChange={e => setDetails(e.target.value)}
              required={kind === 'takedown'}
              placeholder="Include URLs, title, location in the Cast, and any information that helps us verify the request."
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-text-muted text-xs leading-relaxed">
              Submitting false or misleading legal claims can affect users and creators. PageCast may ask for identity, authority, or rights proof before actioning a request.
            </p>
            <button className="btn-primary justify-center min-w-36" disabled={submitting}>
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting</> : 'Submit request'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
