'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { PrivacyRequest, PrivacySlaRule, fetchPrivacySlaDashboard } from '@/lib/supabase/adminCompliance'
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { clsx } from 'clsx'

type SlaBucket = 'overdue' | 'due_soon' | 'on_track' | 'no_deadline'

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function humanize(value: string) {
  return value.replace(/_/g, ' ')
}

function daysUntil(value: string | null) {
  if (!value) return null
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function bucketFor(request: PrivacyRequest): SlaBucket {
  const days = daysUntil(request.statutory_deadline_at)
  if (days === null) return 'no_deadline'
  if (days < 0) return 'overdue'
  if (days <= 7) return 'due_soon'
  return 'on_track'
}

function toneFor(bucket: SlaBucket) {
  if (bucket === 'overdue') return 'text-danger bg-danger/10'
  if (bucket === 'due_soon') return 'text-warning bg-warning/10'
  if (bucket === 'no_deadline') return 'text-text-muted bg-bg-elevated'
  return 'text-success bg-success/10'
}

function SlaPill({ request }: { request: PrivacyRequest }) {
  const bucket = bucketFor(request)
  const days = daysUntil(request.statutory_deadline_at)
  const label = bucket === 'overdue'
    ? `${Math.abs(days ?? 0)} days overdue`
    : bucket === 'due_soon'
      ? `${days} days left`
      : bucket === 'no_deadline'
        ? 'No deadline'
        : `${days} days left`

  return <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', toneFor(bucket))}>{label}</span>
}

function MetricCard({
  title,
  count,
  icon: Icon,
  tone,
}: {
  title: string
  count: number
  icon: React.ElementType
  tone: string
}) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon size={18} className={tone} />
        <span className="text-text-primary text-2xl font-bold">{count}</span>
      </div>
      <p className="text-text-secondary text-sm font-medium mt-3">{title}</p>
    </section>
  )
}

function RequestRow({ request }: { request: PrivacyRequest }) {
  return (
    <article className="card p-4">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <SlaPill request={request} />
            <span className="text-text-muted text-xs capitalize">{request.status}</span>
          </div>
          <h2 className="text-text-primary font-semibold">{humanize(request.request_type)} · {request.email}</h2>
          <p className="text-text-secondary text-sm leading-relaxed mt-2 whitespace-pre-wrap">{request.details || 'No details provided.'}</p>
          <p className="text-text-muted text-xs mt-3">
            Deadline: {formatDate(request.statutory_deadline_at)} · Country: {request.country_code || 'Unknown'} · Region: {request.region_code || 'Unknown'}
          </p>
        </div>
        <Link href={`/compliance-queue/privacy_requests/${request.id}`} className="btn-secondary h-9 px-3 text-xs justify-center">
          Open case
        </Link>
      </div>
    </article>
  )
}

function RuleRow({ rule }: { rule: PrivacySlaRule }) {
  return (
    <tr className="border-t border-bg-border">
      <td className="px-3 py-3 text-text-primary text-sm">{rule.country_code}</td>
      <td className="px-3 py-3 text-text-secondary text-sm">{rule.region_code || 'All'}</td>
      <td className="px-3 py-3 text-text-secondary text-sm">{rule.request_type ? humanize(rule.request_type) : 'All requests'}</td>
      <td className="px-3 py-3 text-text-secondary text-sm">{rule.response_days} days</td>
      <td className="px-3 py-3 text-text-muted text-xs">{rule.basis || 'No basis recorded'}</td>
    </tr>
  )
}

export default function ComplianceSlaPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<PrivacyRequest[]>([])
  const [rules, setRules] = useState<PrivacySlaRule[]>([])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await fetchPrivacySlaDashboard()
    setRequests(data.requests)
    setRules(data.rules)
    setError(loadError)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const metrics = useMemo(() => {
    const overdue = requests.filter(item => bucketFor(item) === 'overdue').length
    const dueSoon = requests.filter(item => bucketFor(item) === 'due_soon').length
    const onTrack = requests.filter(item => bucketFor(item) === 'on_track').length
    const noDeadline = requests.filter(item => bucketFor(item) === 'no_deadline').length
    return { overdue, dueSoon, onTrack, noDeadline }
  }, [requests])

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aBucket = bucketFor(a)
      const bBucket = bucketFor(b)
      const rank: Record<SlaBucket, number> = { overdue: 0, due_soon: 1, no_deadline: 2, on_track: 3 }
      if (rank[aBucket] !== rank[bBucket]) return rank[aBucket] - rank[bBucket]
      return new Date(a.statutory_deadline_at || '9999-01-01').getTime() - new Date(b.statutory_deadline_at || '9999-01-01').getTime()
    })
  }, [requests])

  return (
    <>
      <Header title="Legal SLA Dashboard">
        <button className="btn-secondary h-9 px-3 text-xs" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </Header>
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl space-y-6">
        <section className="card p-6">
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">Privacy operations</p>
          <h1 className="text-text-primary text-2xl font-bold tracking-tight">Privacy request deadlines</h1>
          <p className="text-text-secondary text-sm leading-relaxed mt-3 max-w-3xl">
            Track open privacy requests by statutory deadline. These defaults are operational baselines and should be reviewed by counsel for each launch market.
          </p>
        </section>

        {error && (
          <section className="rounded-xl border border-warning/20 bg-warning/10 p-4 flex items-start gap-3">
            <AlertCircle size={17} className="text-warning shrink-0 mt-0.5" />
            <p className="text-text-secondary text-sm">{error}</p>
          </section>
        )}

        <div className="grid sm:grid-cols-4 gap-4">
          <MetricCard title="Overdue" count={metrics.overdue} icon={ShieldAlert} tone="text-danger" />
          <MetricCard title="Due within 7 days" count={metrics.dueSoon} icon={Clock3} tone="text-warning" />
          <MetricCard title="On track" count={metrics.onTrack} icon={CheckCircle2} tone="text-success" />
          <MetricCard title="Missing deadline" count={metrics.noDeadline} icon={CalendarClock} tone="text-text-muted" />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-text-primary font-semibold">Open privacy requests</h2>
            <Link href="/compliance-queue" className="text-accent hover:text-accent/80 text-sm">View full queue</Link>
          </div>
          {loading ? (
            <div className="card p-8 flex items-center justify-center gap-2 text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Loading SLA dashboard
            </div>
          ) : sortedRequests.length ? (
            sortedRequests.map(request => <RequestRow key={request.id} request={request} />)
          ) : (
            <div className="card p-8 text-center">
              <CheckCircle2 size={26} className="text-success mx-auto mb-3" />
              <h2 className="text-text-primary font-semibold">No active privacy deadlines</h2>
              <p className="text-text-muted text-sm mt-2">Open privacy requests will appear here when they are submitted.</p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-text-primary font-semibold mb-4">Active SLA rules</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-text-muted text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 font-medium">Request</th>
                  <th className="px-3 py-2 font-medium">Response</th>
                  <th className="px-3 py-2 font-medium">Basis</th>
                </tr>
              </thead>
              <tbody>
                {rules.length ? rules.map(rule => <RuleRow key={rule.id} rule={rule} />) : (
                  <tr className="border-t border-bg-border">
                    <td className="px-3 py-4 text-text-muted text-sm" colSpan={5}>Apply migration 015 to load SLA rules.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  )
}
