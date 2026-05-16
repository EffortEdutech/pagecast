'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import {
  ContentReport,
  ComplianceActionLog,
  ComplianceNotification,
  ContentReportStatus,
  PrivacyRequest,
  PrivacyStatus,
  QueueKind,
  TakedownRequest,
  TakedownStatus,
  fetchComplianceQueue,
  updateQueueStatus,
} from '@/lib/supabase/adminCompliance'
import { AlertCircle, ClipboardCheck, ExternalLink, Flag, Loader2, RefreshCw, ShieldAlert, UserCheck } from 'lucide-react'
import { clsx } from 'clsx'

type Tab = 'reports' | 'takedowns' | 'privacy'

const CONTENT_STATUSES: ContentReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed']
const TAKEDOWN_STATUSES: TakedownStatus[] = ['open', 'reviewing', 'actioned', 'rejected', 'counter_notice']
const PRIVACY_STATUSES: PrivacyStatus[] = ['open', 'verifying', 'processing', 'completed', 'rejected']

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

function QueueCard({
  title,
  icon: Icon,
  count,
  active,
  onClick,
}: {
  title: string
  icon: React.ElementType
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'card p-4 text-left transition-colors',
        active ? 'border-accent/60 bg-accent/10' : 'hover:border-accent/30'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon size={18} className={active ? 'text-accent' : 'text-text-muted'} />
        <span className="text-text-primary text-2xl font-bold">{count}</span>
      </div>
      <p className="text-text-secondary text-sm font-medium mt-3">{title}</p>
    </button>
  )
}

function StatusSelect({
  kind,
  id,
  value,
  options,
  onUpdated,
}: {
  kind: QueueKind
  id: string
  value: string
  options: string[]
  onUpdated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(value)
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    const result = await updateQueueStatus(kind, id, selected, note, notify)
    setSaving(false)
    if (result.ok) {
      setNote('')
      onUpdated()
      return
    }
    setError(result.message || 'Could not update status.')
  }

  return (
    <div className="w-full lg:w-80 space-y-2">
      <div className="flex items-center gap-2">
        <select className="input h-9 text-xs" value={selected} onChange={e => setSelected(e.target.value)}>
          {options.map(option => <option key={option} value={option}>{humanize(option)}</option>)}
        </select>
        <button className="btn-secondary h-9 px-3 text-xs" onClick={save} disabled={saving || selected === value}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Update'}
        </button>
      </div>
      <textarea
        className="input resize-none text-xs"
        rows={2}
        value={note}
        onChange={event => setNote(event.target.value)}
        placeholder="Internal note or message to requester"
      />
      <label className="flex items-center gap-2 text-text-muted text-xs">
        <input type="checkbox" checked={notify} onChange={event => setNotify(event.target.checked)} />
        Notify requester by email
      </label>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  )
}

function QueueHistory({
  itemId,
  logs,
  notifications,
}: {
  itemId: string
  logs: ComplianceActionLog[]
  notifications: ComplianceNotification[]
}) {
  const itemLogs = logs.filter(log => log.queue_item_id === itemId).slice(0, 3)
  const itemNotifications = notifications.filter(notification => notification.queue_item_id === itemId).slice(0, 2)

  if (!itemLogs.length && !itemNotifications.length) return null

  return (
    <div className="mt-4 rounded-lg border border-bg-border bg-bg-elevated/40 p-3 space-y-2">
      {itemLogs.map(log => (
        <div key={log.id} className="text-xs text-text-secondary">
          <span className="text-text-primary font-medium">{formatDate(log.created_at)}</span>
          {' '}changed {log.previous_status || 'unknown'} to {log.new_status || 'unknown'}
          {log.note && <span className="text-text-muted"> · {log.note}</span>}
        </div>
      ))}
      {itemNotifications.map(notification => (
        <div key={notification.id} className="text-xs text-text-muted">
          Email {notification.status} to {notification.recipient_email || 'unknown recipient'}
          {notification.error_message && <span className="text-warning"> · {notification.error_message}</span>}
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <ClipboardCheck size={26} className="text-success mx-auto mb-3" />
      <h2 className="text-text-primary font-semibold">No items in this queue</h2>
      <p className="text-text-muted text-sm mt-2">New legal, privacy, and safety submissions will appear here for admins.</p>
    </div>
  )
}

function ReportRows({
  rows,
  actionLogs,
  notifications,
  onUpdated,
}: {
  rows: ContentReport[]
  actionLogs: ComplianceActionLog[]
  notifications: ComplianceNotification[]
  onUpdated: () => void
}) {
  if (!rows.length) return <EmptyState />
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <article key={row.id} className="card p-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={row.status} />
                <span className="text-text-muted text-xs">{formatDate(row.created_at)}</span>
              </div>
              <h2 className="text-text-primary font-semibold">{row.reason}</h2>
              <p className="text-text-secondary text-sm leading-relaxed mt-2 whitespace-pre-wrap">{row.details || 'No details provided.'}</p>
              <p className="text-text-muted text-xs mt-3">Book: {row.book_id || 'Not supplied'} · Block: {row.block_id || 'Not supplied'} · Reporter: {row.reporter_email || 'Anonymous'}</p>
              <Link href={`/compliance-queue/content_reports/${row.id}`} className="inline-flex items-center gap-1.5 text-accent hover:text-accent/80 text-xs font-medium mt-3">
                Open case file
                <ExternalLink size={12} />
              </Link>
            </div>
            <StatusSelect kind="content_reports" id={row.id} value={row.status} options={CONTENT_STATUSES} onUpdated={onUpdated} />
          </div>
          <QueueHistory itemId={row.id} logs={actionLogs} notifications={notifications} />
        </article>
      ))}
    </div>
  )
}

function TakedownRows({
  rows,
  actionLogs,
  notifications,
  onUpdated,
}: {
  rows: TakedownRequest[]
  actionLogs: ComplianceActionLog[]
  notifications: ComplianceNotification[]
  onUpdated: () => void
}) {
  if (!rows.length) return <EmptyState />
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <article key={row.id} className="card p-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={row.status} />
                <span className="text-text-muted text-xs">{formatDate(row.created_at)}</span>
              </div>
              <h2 className="text-text-primary font-semibold">{row.claimant_name} · {humanize(row.claim_type)}</h2>
              <p className="text-text-secondary text-sm leading-relaxed mt-2 whitespace-pre-wrap">{row.evidence || 'No evidence provided.'}</p>
              <p className="text-text-muted text-xs mt-3">Book: {row.book_id || 'Not supplied'} · Asset: {row.asset_id || 'Not supplied'} · Email: {row.claimant_email}</p>
              <Link href={`/compliance-queue/takedown_requests/${row.id}`} className="inline-flex items-center gap-1.5 text-accent hover:text-accent/80 text-xs font-medium mt-3">
                Open case file
                <ExternalLink size={12} />
              </Link>
            </div>
            <StatusSelect kind="takedown_requests" id={row.id} value={row.status} options={TAKEDOWN_STATUSES} onUpdated={onUpdated} />
          </div>
          <QueueHistory itemId={row.id} logs={actionLogs} notifications={notifications} />
        </article>
      ))}
    </div>
  )
}

function PrivacyRows({
  rows,
  actionLogs,
  notifications,
  onUpdated,
}: {
  rows: PrivacyRequest[]
  actionLogs: ComplianceActionLog[]
  notifications: ComplianceNotification[]
  onUpdated: () => void
}) {
  if (!rows.length) return <EmptyState />
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <article key={row.id} className="card p-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={row.status} />
                <span className="text-text-muted text-xs">{formatDate(row.created_at)}</span>
              </div>
              <h2 className="text-text-primary font-semibold">{humanize(row.request_type)} · {row.email}</h2>
              <p className="text-text-secondary text-sm leading-relaxed mt-2 whitespace-pre-wrap">{row.details || 'No details provided.'}</p>
              <p className="text-text-muted text-xs mt-3">Country: {row.country_code || 'Unknown'} · Region: {row.region_code || 'Unknown'} · Deadline: {formatDate(row.statutory_deadline_at)}</p>
              <Link href={`/compliance-queue/privacy_requests/${row.id}`} className="inline-flex items-center gap-1.5 text-accent hover:text-accent/80 text-xs font-medium mt-3">
                Open case file
                <ExternalLink size={12} />
              </Link>
            </div>
            <StatusSelect kind="privacy_requests" id={row.id} value={row.status} options={PRIVACY_STATUSES} onUpdated={onUpdated} />
          </div>
          <QueueHistory itemId={row.id} logs={actionLogs} notifications={notifications} />
        </article>
      ))}
    </div>
  )
}

export default function ComplianceQueuePage() {
  const [activeTab, setActiveTab] = useState<Tab>('reports')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contentReports, setContentReports] = useState<ContentReport[]>([])
  const [takedownRequests, setTakedownRequests] = useState<TakedownRequest[]>([])
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([])
  const [actionLogs, setActionLogs] = useState<ComplianceActionLog[]>([])
  const [notifications, setNotifications] = useState<ComplianceNotification[]>([])

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await fetchComplianceQueue()
    setContentReports(data.contentReports)
    setTakedownRequests(data.takedownRequests)
    setPrivacyRequests(data.privacyRequests)
    setActionLogs(data.actionLogs)
    setNotifications(data.notifications)
    setError(loadError)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const totals = useMemo(() => ({
    reports: contentReports.filter(item => !['resolved', 'dismissed'].includes(item.status)).length,
    takedowns: takedownRequests.filter(item => !['actioned', 'rejected', 'counter_notice'].includes(item.status)).length,
    privacy: privacyRequests.filter(item => !['completed', 'rejected'].includes(item.status)).length,
  }), [contentReports, takedownRequests, privacyRequests])

  return (
    <>
      <Header title="Compliance Queue">
        <button className="btn-secondary h-9 px-3 text-xs" onClick={loadQueue} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </Header>
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl space-y-6">
        <section className="card p-6">
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">Admin review</p>
          <h1 className="text-text-primary text-2xl font-bold tracking-tight">Legal, safety, and privacy queue</h1>
          <p className="text-text-secondary text-sm leading-relaxed mt-3 max-w-3xl">
            Review reader reports, rights-holder takedowns, and global privacy requests. Access requires migration 012 and a profile role of admin.
          </p>
        </section>

        {error && (
          <section className="rounded-xl border border-warning/20 bg-warning/10 p-4 flex items-start gap-3">
            <AlertCircle size={17} className="text-warning shrink-0 mt-0.5" />
            <div>
              <h2 className="text-warning font-semibold text-sm">Queue access needs admin policy</h2>
              <p className="text-text-secondary text-sm mt-1">{error}</p>
            </div>
          </section>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <QueueCard title="Open content reports" icon={Flag} count={totals.reports} active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
          <QueueCard title="Open takedown claims" icon={ShieldAlert} count={totals.takedowns} active={activeTab === 'takedowns'} onClick={() => setActiveTab('takedowns')} />
          <QueueCard title="Open privacy requests" icon={UserCheck} count={totals.privacy} active={activeTab === 'privacy'} onClick={() => setActiveTab('privacy')} />
        </div>

        {loading ? (
          <div className="card p-8 flex items-center justify-center gap-2 text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            Loading compliance queue
          </div>
        ) : activeTab === 'reports' ? (
          <ReportRows rows={contentReports} actionLogs={actionLogs} notifications={notifications} onUpdated={loadQueue} />
        ) : activeTab === 'takedowns' ? (
          <TakedownRows rows={takedownRequests} actionLogs={actionLogs} notifications={notifications} onUpdated={loadQueue} />
        ) : (
          <PrivacyRows rows={privacyRequests} actionLogs={actionLogs} notifications={notifications} onUpdated={loadQueue} />
        )}
      </main>
    </>
  )
}
