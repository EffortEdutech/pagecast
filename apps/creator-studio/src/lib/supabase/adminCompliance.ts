import { createClient } from './client'

export type QueueKind = 'content_reports' | 'takedown_requests' | 'privacy_requests'

export type ContentReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type TakedownStatus = 'open' | 'reviewing' | 'actioned' | 'rejected' | 'counter_notice'
export type PrivacyStatus = 'open' | 'verifying' | 'processing' | 'completed' | 'rejected'

export interface ContentReport {
  id: string
  book_id: string | null
  block_id: string | null
  reporter_email: string | null
  reason: string
  details: string | null
  status: ContentReportStatus
  created_at: string
  resolved_at: string | null
}

export interface TakedownRequest {
  id: string
  claimant_name: string
  claimant_email: string
  book_id: string | null
  asset_id: string | null
  claim_type: string
  evidence: string | null
  status: TakedownStatus
  created_at: string
  resolved_at: string | null
}

export interface PrivacyRequest {
  id: string
  email: string
  country_code: string | null
  region_code: string | null
  request_type: string
  details: string | null
  status: PrivacyStatus
  statutory_deadline_at: string | null
  created_at: string
  completed_at: string | null
}

export interface ComplianceQueue {
  contentReports: ContentReport[]
  takedownRequests: TakedownRequest[]
  privacyRequests: PrivacyRequest[]
  actionLogs: ComplianceActionLog[]
  notifications: ComplianceNotification[]
}

export interface ComplianceActionLog {
  id: string
  queue_kind: QueueKind
  queue_item_id: string
  actor_id: string | null
  action_type: string
  previous_status: string | null
  new_status: string | null
  note: string | null
  created_at: string
}

export interface ComplianceNotification {
  id: string
  queue_kind: QueueKind
  queue_item_id: string
  recipient_email: string | null
  subject: string
  status: 'queued' | 'sent' | 'skipped' | 'failed'
  error_message: string | null
  created_at: string
  sent_at: string | null
}

export interface ComplianceCaseEvidence {
  id: string
  queue_kind: QueueKind
  queue_item_id: string
  evidence_type: string
  title: string
  url: string | null
  notes: string | null
  added_by: string | null
  created_at: string
}

export interface ComplianceCase {
  kind: QueueKind
  item: ContentReport | TakedownRequest | PrivacyRequest | null
  actionLogs: ComplianceActionLog[]
  notifications: ComplianceNotification[]
  evidence: ComplianceCaseEvidence[]
  relatedBookRights: unknown[]
  relatedAssetRights: unknown[]
}

export interface PrivacySlaRule {
  id: string
  country_code: string
  region_code: string | null
  request_type: string | null
  response_days: number
  warning_days: number
  basis: string | null
  active: boolean
  updated_at: string
}

export interface PrivacySlaDashboard {
  requests: PrivacyRequest[]
  rules: PrivacySlaRule[]
}

export interface RetentionRule {
  id: string
  record_type: string
  retention_days: number
  review_warning_days: number
  action: string
  basis: string | null
  active: boolean
  updated_at: string
}

export interface RetentionRecordSummary {
  recordType: string
  total: number
  reviewDue: number
  reviewSoon: number
  oldestCreatedAt: string | null
}

export interface RetentionDashboard {
  rules: RetentionRule[]
  summaries: RetentionRecordSummary[]
}

export async function fetchComplianceQueue(): Promise<{ data: ComplianceQueue; error: string | null }> {
  const supabase = createClient()

  const [contentReports, takedownRequests, privacyRequests, actionLogs, notifications] = await Promise.all([
    supabase
      .from('content_reports')
      .select('id, book_id, block_id, reporter_email, reason, details, status, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('takedown_requests')
      .select('id, claimant_name, claimant_email, book_id, asset_id, claim_type, evidence, status, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('privacy_requests')
      .select('id, email, country_code, region_code, request_type, details, status, statutory_deadline_at, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('compliance_action_logs')
      .select('id, queue_kind, queue_item_id, actor_id, action_type, previous_status, new_status, note, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('compliance_notifications')
      .select('id, queue_kind, queue_item_id, recipient_email, subject, status, error_message, created_at, sent_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const error = contentReports.error?.message
    || takedownRequests.error?.message
    || privacyRequests.error?.message
    || actionLogs.error?.message
    || notifications.error?.message
    || null

  return {
    data: {
      contentReports: (contentReports.data ?? []) as ContentReport[],
      takedownRequests: (takedownRequests.data ?? []) as TakedownRequest[],
      privacyRequests: (privacyRequests.data ?? []) as PrivacyRequest[],
      actionLogs: (actionLogs.data ?? []) as ComplianceActionLog[],
      notifications: (notifications.data ?? []) as ComplianceNotification[],
    },
    error,
  }
}

export async function updateQueueStatus(kind: QueueKind, id: string, status: string, note?: string, notify = true): Promise<{ ok: boolean; message?: string }> {
  const response = await fetch('/api/compliance/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, id, status, note, notify }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, message: result?.error || 'Could not update queue status.' }
  }
  return { ok: true, message: result?.notificationStatus }
}

export function isQueueKind(value: string): value is QueueKind {
  return value === 'content_reports' || value === 'takedown_requests' || value === 'privacy_requests'
}

export async function fetchComplianceCase(kind: QueueKind, id: string): Promise<{ data: ComplianceCase; error: string | null }> {
  const supabase = createClient()
  const itemSelect = kind === 'content_reports'
    ? 'id, book_id, block_id, reporter_email, reason, details, status, created_at, resolved_at'
    : kind === 'takedown_requests'
      ? 'id, claimant_name, claimant_email, book_id, asset_id, claim_type, evidence, status, created_at, resolved_at'
      : 'id, email, country_code, region_code, request_type, details, status, statutory_deadline_at, created_at, completed_at'

  const [item, actionLogs, notifications, evidence] = await Promise.all([
    supabase.from(kind).select(itemSelect).eq('id', id).maybeSingle(),
    supabase
      .from('compliance_action_logs')
      .select('id, queue_kind, queue_item_id, actor_id, action_type, previous_status, new_status, note, created_at')
      .eq('queue_kind', kind)
      .eq('queue_item_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('compliance_notifications')
      .select('id, queue_kind, queue_item_id, recipient_email, subject, status, error_message, created_at, sent_at')
      .eq('queue_kind', kind)
      .eq('queue_item_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('compliance_case_evidence')
      .select('id, queue_kind, queue_item_id, evidence_type, title, url, notes, added_by, created_at')
      .eq('queue_kind', kind)
      .eq('queue_item_id', id)
      .order('created_at', { ascending: false }),
  ])

  const queueItem = item.data as ContentReport | TakedownRequest | PrivacyRequest | null
  const bookId = queueItem && 'book_id' in queueItem ? queueItem.book_id : null
  const assetId = queueItem && 'asset_id' in queueItem ? queueItem.asset_id : null

  const [bookRights, assetRights] = await Promise.all([
    bookId
      ? supabase.from('book_rights').select('*').eq('book_id', bookId)
      : Promise.resolve({ data: [], error: null }),
    assetId
      ? supabase.from('asset_rights').select('*').eq('asset_id', assetId)
      : bookId
        ? supabase.from('asset_rights').select('*').eq('book_id', bookId)
        : Promise.resolve({ data: [], error: null }),
  ])

  const error = item.error?.message
    || actionLogs.error?.message
    || notifications.error?.message
    || evidence.error?.message
    || bookRights.error?.message
    || assetRights.error?.message
    || null

  return {
    data: {
      kind,
      item: queueItem,
      actionLogs: (actionLogs.data ?? []) as ComplianceActionLog[],
      notifications: (notifications.data ?? []) as ComplianceNotification[],
      evidence: (evidence.data ?? []) as ComplianceCaseEvidence[],
      relatedBookRights: bookRights.data ?? [],
      relatedAssetRights: assetRights.data ?? [],
    },
    error,
  }
}

export async function addCaseEvidence(input: {
  kind: QueueKind
  id: string
  evidenceType: string
  title: string
  url?: string
  notes?: string
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('compliance_case_evidence').insert({
    queue_kind: input.kind,
    queue_item_id: input.id,
    evidence_type: input.evidenceType,
    title: input.title.trim(),
    url: input.url?.trim() || null,
    notes: input.notes?.trim() || null,
    added_by: user?.id ?? null,
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function fetchPrivacySlaDashboard(): Promise<{ data: PrivacySlaDashboard; error: string | null }> {
  const supabase = createClient()
  const [requests, rules] = await Promise.all([
    supabase
      .from('privacy_requests')
      .select('id, email, country_code, region_code, request_type, details, status, statutory_deadline_at, created_at, completed_at')
      .in('status', ['open', 'verifying', 'processing'])
      .order('statutory_deadline_at', { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from('privacy_sla_rules')
      .select('id, country_code, region_code, request_type, response_days, warning_days, basis, active, updated_at')
      .eq('active', true)
      .order('country_code', { ascending: true }),
  ])

  return {
    data: {
      requests: (requests.data ?? []) as PrivacyRequest[],
      rules: (rules.data ?? []) as PrivacySlaRule[],
    },
    error: requests.error?.message || rules.error?.message || null,
  }
}

type RetentionSource = {
  recordType: string
  table: string
  createdColumn: string
}

const RETENTION_SOURCES: RetentionSource[] = [
  { recordType: 'content_reports', table: 'content_reports', createdColumn: 'created_at' },
  { recordType: 'takedown_requests', table: 'takedown_requests', createdColumn: 'created_at' },
  { recordType: 'privacy_requests', table: 'privacy_requests', createdColumn: 'created_at' },
  { recordType: 'compliance_action_logs', table: 'compliance_action_logs', createdColumn: 'created_at' },
  { recordType: 'compliance_notifications', table: 'compliance_notifications', createdColumn: 'created_at' },
  { recordType: 'compliance_case_evidence', table: 'compliance_case_evidence', createdColumn: 'created_at' },
  { recordType: 'user_consents', table: 'user_consents', createdColumn: 'accepted_at' },
]

function cutoffDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export async function fetchRetentionDashboard(): Promise<{ data: RetentionDashboard; error: string | null }> {
  const supabase = createClient()
  const { data: rulesData, error: rulesError } = await supabase
    .from('records_retention_rules')
    .select('id, record_type, retention_days, review_warning_days, action, basis, active, updated_at')
    .eq('active', true)
    .order('record_type', { ascending: true })

  const rules = (rulesData ?? []) as RetentionRule[]
  const summaries: RetentionRecordSummary[] = []
  let error = rulesError?.message || null

  for (const source of RETENTION_SOURCES) {
    const rule = rules.find(item => item.record_type === source.recordType)
    if (!rule) {
      summaries.push({ recordType: source.recordType, total: 0, reviewDue: 0, reviewSoon: 0, oldestCreatedAt: null })
      continue
    }

    const dueCutoff = cutoffDate(rule.retention_days)
    const soonCutoff = cutoffDate(Math.max(rule.retention_days - rule.review_warning_days, 1))

    const [total, due, soon, oldest] = await Promise.all([
      supabase.from(source.table).select('id', { count: 'exact', head: true }),
      supabase.from(source.table).select('id', { count: 'exact', head: true }).lte(source.createdColumn, dueCutoff),
      supabase
        .from(source.table)
        .select('id', { count: 'exact', head: true })
        .lte(source.createdColumn, soonCutoff)
        .gt(source.createdColumn, dueCutoff),
      supabase.from(source.table).select(source.createdColumn).order(source.createdColumn, { ascending: true }).limit(1).maybeSingle(),
    ])

    error = error || total.error?.message || due.error?.message || soon.error?.message || oldest.error?.message || null
    const oldestRow = oldest.data as Record<string, string> | null

    summaries.push({
      recordType: source.recordType,
      total: total.count ?? 0,
      reviewDue: due.count ?? 0,
      reviewSoon: soon.count ?? 0,
      oldestCreatedAt: oldestRow?.[source.createdColumn] ?? null,
    })
  }

  return { data: { rules, summaries }, error }
}
