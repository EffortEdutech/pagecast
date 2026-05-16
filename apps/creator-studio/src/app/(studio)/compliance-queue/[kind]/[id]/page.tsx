'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import {
  ComplianceActionLog,
  ComplianceCaseEvidence,
  ComplianceNotification,
  ContentReport,
  PrivacyRequest,
  QueueKind,
  TakedownRequest,
  addCaseEvidence,
  fetchComplianceCase,
  isQueueKind,
  updateQueueStatus,
} from '@/lib/supabase/adminCompliance'
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, FileText, Loader2, Plus, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

const STATUS_OPTIONS: Record<QueueKind, string[]> = {
  content_reports: ['open', 'reviewing', 'resolved', 'dismissed'],
  takedown_requests: ['open', 'reviewing', 'actioned', 'rejected', 'counter_notice'],
  privacy_requests: ['open', 'verifying', 'processing', 'completed', 'rejected'],
}

const EVIDENCE_TYPES = ['note', 'url', 'document', 'screenshot', 'rights_proof', 'identity_proof', 'other']

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function humanize(value: string) {
  return value.replace(/_/g, ' ')
}

function StatusPill({ status }: { status: string }) {
  const tone = ['resolved', 'actioned', 'completed'].includes(status)
    ? 'text-success bg-success/10'
    : ['dismissed', 'rejected'].includes(status)
      ? 'text-danger bg-danger/10'
      : status === 'open'
        ? 'text-warning bg-warning/10'
        : 'text-info bg-info/10'

  return <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', tone)}>{humanize(status)}</span>
}

function caseTitle(kind: QueueKind, item: ContentReport | TakedownRequest | PrivacyRequest) {
  if (kind === 'content_reports') return (item as ContentReport).reason
  if (kind === 'takedown_requests') {
    const takedown = item as TakedownRequest
    return `${takedown.claimant_name} · ${humanize(takedown.claim_type)}`
  }
  const privacy = item as PrivacyRequest
  return `${humanize(privacy.request_type)} · ${privacy.email}`
}

function itemStatus(item: ContentReport | TakedownRequest | PrivacyRequest) {
  return item.status
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-text-muted text-[11px] uppercase tracking-wide mb-1">{label}</p>
      <div className="text-text-secondary text-sm break-words">{value || 'Not supplied'}</div>
    </div>
  )
}

function SubmittedDetails({ kind, item }: { kind: QueueKind; item: ContentReport | TakedownRequest | PrivacyRequest }) {
  if (kind === 'content_reports') {
    const report = item as ContentReport
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        <DetailField label="Reporter" value={report.reporter_email || 'Anonymous'} />
        <DetailField label="Book ID" value={report.book_id} />
        <DetailField label="Block ID" value={report.block_id} />
        <DetailField label="Resolved at" value={formatDate(report.resolved_at)} />
        <div className="sm:col-span-2">
          <DetailField label="Details" value={<span className="whitespace-pre-wrap">{report.details || 'No details provided.'}</span>} />
        </div>
      </div>
    )
  }

  if (kind === 'takedown_requests') {
    const takedown = item as TakedownRequest
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        <DetailField label="Claimant email" value={takedown.claimant_email} />
        <DetailField label="Claim type" value={humanize(takedown.claim_type)} />
        <DetailField label="Book ID" value={takedown.book_id} />
        <DetailField label="Asset ID" value={takedown.asset_id} />
        <div className="sm:col-span-2">
          <DetailField label="Evidence statement" value={<span className="whitespace-pre-wrap">{takedown.evidence || 'No evidence provided.'}</span>} />
        </div>
      </div>
    )
  }

  const privacy = item as PrivacyRequest
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <DetailField label="Email" value={privacy.email} />
      <DetailField label="Request type" value={humanize(privacy.request_type)} />
      <DetailField label="Country" value={privacy.country_code} />
      <DetailField label="Region" value={privacy.region_code} />
      <DetailField label="Deadline" value={formatDate(privacy.statutory_deadline_at)} />
      <DetailField label="Completed at" value={formatDate(privacy.completed_at)} />
      <div className="sm:col-span-2">
        <DetailField label="Details" value={<span className="whitespace-pre-wrap">{privacy.details || 'No details provided.'}</span>} />
      </div>
    </div>
  )
}

function StatusPanel({
  kind,
  id,
  status,
  onUpdated,
}: {
  kind: QueueKind
  id: string
  status: string
  onUpdated: () => void
}) {
  const [selected, setSelected] = useState(status)
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelected(status)
  }, [status])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    const result = await updateQueueStatus(kind, id, selected, note, notify)
    setSaving(false)
    if (!result.ok) {
      setError(result.message || 'Could not update status.')
      return
    }
    setNote('')
    setMessage(`Status updated. Notification: ${result.message || 'recorded'}.`)
    onUpdated()
  }

  return (
    <section className="card p-5 space-y-3">
      <h2 className="text-text-primary font-semibold">Case decision</h2>
      {message && <p className="text-success text-xs">{message}</p>}
      {error && <p className="text-danger text-xs">{error}</p>}
      <div>
        <label className="label">Status</label>
        <select className="input" value={selected} onChange={event => setSelected(event.target.value)}>
          {STATUS_OPTIONS[kind].map(option => <option key={option} value={option}>{humanize(option)}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Reviewer note</label>
        <textarea className="input resize-none" rows={4} value={note} onChange={event => setNote(event.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-text-muted text-xs">
        <input type="checkbox" checked={notify} onChange={event => setNotify(event.target.checked)} />
        Notify requester by email
      </label>
      <button className="btn-primary w-full justify-center" onClick={save} disabled={saving || selected === status}>
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : 'Save decision'}
      </button>
    </section>
  )
}

function EvidencePanel({
  kind,
  id,
  rows,
  onAdded,
}: {
  kind: QueueKind
  id: string
  rows: ComplianceCaseEvidence[]
  onAdded: () => void
}) {
  const [evidenceType, setEvidenceType] = useState(EVIDENCE_TYPES[0])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addEvidence = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const result = await addCaseEvidence({ kind, id, evidenceType, title, url, notes })
    setSaving(false)
    if (!result.ok) {
      setError(result.message || 'Could not add evidence.')
      return
    }
    setTitle('')
    setUrl('')
    setNotes('')
    onAdded()
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-info" />
        <h2 className="text-text-primary font-semibold">Evidence and proof</h2>
      </div>
      <form onSubmit={addEvidence} className="grid sm:grid-cols-2 gap-3">
        {error && <p className="sm:col-span-2 text-danger text-xs">{error}</p>}
        <div>
          <label className="label">Type</label>
          <select className="input" value={evidenceType} onChange={event => setEvidenceType(event.target.value)}>
            {EVIDENCE_TYPES.map(type => <option key={type} value={type}>{humanize(type)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={event => setTitle(event.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">URL</label>
          <input className="input" value={url} onChange={event => setUrl(event.target.value)} placeholder="Optional link to file, screenshot, source, or proof" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={3} value={notes} onChange={event => setNotes(event.target.value)} />
        </div>
        <button className="btn-secondary justify-center sm:col-span-2" disabled={saving}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Adding</> : <><Plus size={14} /> Add evidence</>}
        </button>
      </form>

      <div className="space-y-2">
        {rows.length ? rows.map(row => (
          <div key={row.id} className="rounded-lg border border-bg-border bg-bg-elevated/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-text-primary text-sm font-medium">{row.title}</p>
                <p className="text-text-muted text-xs capitalize mt-0.5">{humanize(row.evidence_type)} · {formatDate(row.created_at)}</p>
              </div>
              {row.url && (
                <Link href={row.url} target="_blank" className="text-accent hover:text-accent/80">
                  <ExternalLink size={14} />
                </Link>
              )}
            </div>
            {row.notes && <p className="text-text-secondary text-xs leading-relaxed mt-2 whitespace-pre-wrap">{row.notes}</p>}
          </div>
        )) : (
          <p className="text-text-muted text-sm">No admin evidence has been added yet.</p>
        )}
      </div>
    </section>
  )
}

function HistoryPanel({ logs, notifications }: { logs: ComplianceActionLog[]; notifications: ComplianceNotification[] }) {
  return (
    <section className="card p-5 space-y-4">
      <h2 className="text-text-primary font-semibold">Audit history</h2>
      <div className="space-y-2">
        {logs.length ? logs.map(log => (
          <div key={log.id} className="rounded-lg border border-bg-border bg-bg-elevated/40 p-3">
            <p className="text-text-secondary text-sm">
              Changed {log.previous_status || 'unknown'} to {log.new_status || 'unknown'}
            </p>
            <p className="text-text-muted text-xs mt-1">{formatDate(log.created_at)}</p>
            {log.note && <p className="text-text-secondary text-xs leading-relaxed mt-2 whitespace-pre-wrap">{log.note}</p>}
          </div>
        )) : (
          <p className="text-text-muted text-sm">No actions recorded yet.</p>
        )}
      </div>

      <h2 className="text-text-primary font-semibold pt-2">Notification history</h2>
      <div className="space-y-2">
        {notifications.length ? notifications.map(notification => (
          <div key={notification.id} className="rounded-lg border border-bg-border bg-bg-elevated/40 p-3">
            <div className="flex items-center gap-2">
              <StatusPill status={notification.status} />
              <p className="text-text-secondary text-sm">{notification.recipient_email || 'No recipient'}</p>
            </div>
            <p className="text-text-muted text-xs mt-1">{notification.subject}</p>
            {notification.error_message && <p className="text-warning text-xs mt-2">{notification.error_message}</p>}
          </div>
        )) : (
          <p className="text-text-muted text-sm">No notifications recorded yet.</p>
        )}
      </div>
    </section>
  )
}

function RelatedRightsPanel({ bookRights, assetRights }: { bookRights: unknown[]; assetRights: unknown[] }) {
  return (
    <section className="card p-5 space-y-4">
      <h2 className="text-text-primary font-semibold">Related rights records</h2>
      <div>
        <p className="text-text-muted text-xs uppercase tracking-wide mb-2">Book rights</p>
        {bookRights.length ? (
          <pre className="text-text-secondary text-xs overflow-x-auto rounded-lg bg-bg-elevated p-3">{JSON.stringify(bookRights, null, 2)}</pre>
        ) : (
          <p className="text-text-muted text-sm">No related book rights record found.</p>
        )}
      </div>
      <div>
        <p className="text-text-muted text-xs uppercase tracking-wide mb-2">Asset rights</p>
        {assetRights.length ? (
          <pre className="text-text-secondary text-xs overflow-x-auto rounded-lg bg-bg-elevated p-3">{JSON.stringify(assetRights, null, 2)}</pre>
        ) : (
          <p className="text-text-muted text-sm">No related asset rights records found.</p>
        )}
      </div>
    </section>
  )
}

export default function ComplianceCasePage() {
  const params = useParams<{ kind: string; id: string }>()
  const kind = isQueueKind(params.kind) ? params.kind : null
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [item, setItem] = useState<ContentReport | TakedownRequest | PrivacyRequest | null>(null)
  const [logs, setLogs] = useState<ComplianceActionLog[]>([])
  const [notifications, setNotifications] = useState<ComplianceNotification[]>([])
  const [evidence, setEvidence] = useState<ComplianceCaseEvidence[]>([])
  const [bookRights, setBookRights] = useState<unknown[]>([])
  const [assetRights, setAssetRights] = useState<unknown[]>([])

  const loadCase = useCallback(async () => {
    if (!kind) return
    setLoading(true)
    const { data, error: loadError } = await fetchComplianceCase(kind, id)
    setItem(data.item)
    setLogs(data.actionLogs)
    setNotifications(data.notifications)
    setEvidence(data.evidence)
    setBookRights(data.relatedBookRights)
    setAssetRights(data.relatedAssetRights)
    setError(loadError)
    setLoading(false)
  }, [kind, id])

  useEffect(() => {
    loadCase()
  }, [loadCase])

  const title = useMemo(() => {
    if (!kind) return 'Invalid case'
    if (!item) return 'Compliance case'
    return caseTitle(kind, item)
  }, [kind, item])

  if (!kind) {
    return (
      <>
        <Header title="Compliance Case" />
        <main className="flex-1 overflow-y-auto p-6">
          <section className="card p-6 text-danger">Invalid compliance case type.</section>
        </main>
      </>
    )
  }

  return (
    <>
      <Header title="Compliance Case">
        <button className="btn-secondary h-9 px-3 text-xs" onClick={loadCase} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </Header>
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl space-y-6">
        <Link href="/compliance-queue" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm">
          <ArrowLeft size={14} />
          Back to queue
        </Link>

        {error && (
          <section className="rounded-xl border border-warning/20 bg-warning/10 p-4 flex items-start gap-3">
            <AlertCircle size={17} className="text-warning shrink-0 mt-0.5" />
            <p className="text-text-secondary text-sm">{error}</p>
          </section>
        )}

        {loading ? (
          <div className="card p-8 flex items-center justify-center gap-2 text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            Loading case file
          </div>
        ) : item ? (
          <>
            <section className="card p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">{humanize(kind)}</p>
                  <h1 className="text-text-primary text-2xl font-bold tracking-tight">{title}</h1>
                  <p className="text-text-muted text-xs mt-3">Case ID: {id} · Created {formatDate(item.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={itemStatus(item)} />
                  <CheckCircle2 size={16} className="text-success" />
                </div>
              </div>
            </section>

            <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
              <div className="space-y-6">
                <section className="card p-5">
                  <h2 className="text-text-primary font-semibold mb-4">Submitted request</h2>
                  <SubmittedDetails kind={kind} item={item} />
                </section>
                <EvidencePanel kind={kind} id={id} rows={evidence} onAdded={loadCase} />
                <RelatedRightsPanel bookRights={bookRights} assetRights={assetRights} />
              </div>

              <div className="space-y-6">
                <StatusPanel kind={kind} id={id} status={itemStatus(item)} onUpdated={loadCase} />
                <HistoryPanel logs={logs} notifications={notifications} />
              </div>
            </div>
          </>
        ) : (
          <section className="card p-8 text-center">
            <h1 className="text-text-primary font-semibold">Case not found</h1>
            <p className="text-text-muted text-sm mt-2">This queue item may have been deleted or is not visible to your admin account.</p>
          </section>
        )}
      </main>
    </>
  )
}
