'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { RetentionDashboard, RetentionRecordSummary, RetentionRule, fetchRetentionDashboard } from '@/lib/supabase/adminCompliance'
import { AlertCircle, Archive, Download, FileSpreadsheet, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { clsx } from 'clsx'

const EXPORTS = [
  ['content_reports', 'Content reports'],
  ['takedown_requests', 'Takedown requests'],
  ['privacy_requests', 'Privacy requests'],
  ['action_logs', 'Action logs'],
  ['notifications', 'Notifications'],
  ['evidence', 'Case evidence'],
  ['consents', 'User consents'],
]

function formatDate(value: string | null) {
  if (!value) return 'No records'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function humanize(value: string) {
  return value.replace(/_/g, ' ')
}

function RetentionPill({ summary }: { summary: RetentionRecordSummary }) {
  const tone = summary.reviewDue > 0
    ? 'text-danger bg-danger/10'
    : summary.reviewSoon > 0
      ? 'text-warning bg-warning/10'
      : 'text-success bg-success/10'

  const label = summary.reviewDue > 0
    ? `${summary.reviewDue} due`
    : summary.reviewSoon > 0
      ? `${summary.reviewSoon} soon`
      : 'Current'

  return <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>{label}</span>
}

function ExportCard({ kind, label }: { kind: string; label: string }) {
  return (
    <a
      href={`/api/compliance/export?kind=${kind}`}
      className="card p-4 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <FileSpreadsheet size={18} className="text-info" />
        <Download size={15} className="text-text-muted" />
      </div>
      <p className="text-text-primary text-sm font-semibold mt-3">{label}</p>
      <p className="text-text-muted text-xs mt-1">CSV export</p>
    </a>
  )
}

function RuleText({ rule }: { rule?: RetentionRule }) {
  if (!rule) return <span className="text-warning">No active rule</span>
  return (
    <span>
      {rule.retention_days} days · {humanize(rule.action)}
      {rule.basis && <span className="block text-text-muted text-xs mt-1">{rule.basis}</span>}
    </span>
  )
}

export default function ComplianceRecordsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<RetentionDashboard>({ rules: [], summaries: [] })

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await fetchRetentionDashboard()
    setDashboard(data)
    setError(loadError)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const metrics = useMemo(() => {
    return dashboard.summaries.reduce(
      (acc, item) => {
        acc.total += item.total
        acc.reviewDue += item.reviewDue
        acc.reviewSoon += item.reviewSoon
        return acc
      },
      { total: 0, reviewDue: 0, reviewSoon: 0 }
    )
  }, [dashboard.summaries])

  return (
    <>
      <Header title="Compliance Records">
        <button className="btn-secondary h-9 px-3 text-xs" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </Header>
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl space-y-6">
        <section className="card p-6">
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">Records and exports</p>
          <h1 className="text-text-primary text-2xl font-bold tracking-tight">Compliance exports and retention</h1>
          <p className="text-text-secondary text-sm leading-relaxed mt-3 max-w-3xl">
            Export legal records for audits and review records approaching retention limits. This dashboard flags records only; deletion should require a separate legal approval process.
          </p>
        </section>

        {error && (
          <section className="rounded-xl border border-warning/20 bg-warning/10 p-4 flex items-start gap-3">
            <AlertCircle size={17} className="text-warning shrink-0 mt-0.5" />
            <p className="text-text-secondary text-sm">{error}</p>
          </section>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <section className="card p-4">
            <ShieldCheck size={18} className="text-success" />
            <p className="text-text-primary text-2xl font-bold mt-3">{metrics.total}</p>
            <p className="text-text-secondary text-sm">Tracked records</p>
          </section>
          <section className="card p-4">
            <Archive size={18} className="text-danger" />
            <p className="text-text-primary text-2xl font-bold mt-3">{metrics.reviewDue}</p>
            <p className="text-text-secondary text-sm">Due for review</p>
          </section>
          <section className="card p-4">
            <Archive size={18} className="text-warning" />
            <p className="text-text-primary text-2xl font-bold mt-3">{metrics.reviewSoon}</p>
            <p className="text-text-secondary text-sm">Review soon</p>
          </section>
        </div>

        <section>
          <h2 className="text-text-primary font-semibold mb-3">CSV exports</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXPORTS.map(([kind, label]) => <ExportCard key={kind} kind={kind} label={label} />)}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-text-primary font-semibold mb-4">Retention review</h2>
          {loading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Loading retention records
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-text-muted text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">Record type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Oldest</th>
                    <th className="px-3 py-2 font-medium">Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.summaries.map(summary => {
                    const rule = dashboard.rules.find(item => item.record_type === summary.recordType)
                    return (
                      <tr key={summary.recordType} className="border-t border-bg-border">
                        <td className="px-3 py-3 text-text-primary text-sm capitalize">{humanize(summary.recordType)}</td>
                        <td className="px-3 py-3"><RetentionPill summary={summary} /></td>
                        <td className="px-3 py-3 text-text-secondary text-sm">{summary.total}</td>
                        <td className="px-3 py-3 text-text-secondary text-sm">{formatDate(summary.oldestCreatedAt)}</td>
                        <td className="px-3 py-3 text-text-secondary text-sm"><RuleText rule={rule} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}
