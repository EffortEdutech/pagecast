import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ExportConfig = {
  table: string
  select: string
  filename: string
  orderColumn: string
}

const EXPORTS: Record<string, ExportConfig> = {
  content_reports: {
    table: 'content_reports',
    select: 'id, book_id, block_id, reporter_email, reason, details, status, created_at, resolved_at',
    filename: 'content-reports',
    orderColumn: 'created_at',
  },
  takedown_requests: {
    table: 'takedown_requests',
    select: 'id, claimant_name, claimant_email, book_id, asset_id, claim_type, evidence, status, created_at, resolved_at',
    filename: 'takedown-requests',
    orderColumn: 'created_at',
  },
  privacy_requests: {
    table: 'privacy_requests',
    select: 'id, email, country_code, region_code, request_type, status, statutory_deadline_at, details, created_at, completed_at',
    filename: 'privacy-requests',
    orderColumn: 'created_at',
  },
  action_logs: {
    table: 'compliance_action_logs',
    select: 'id, queue_kind, queue_item_id, actor_id, action_type, previous_status, new_status, note, created_at',
    filename: 'compliance-action-logs',
    orderColumn: 'created_at',
  },
  notifications: {
    table: 'compliance_notifications',
    select: 'id, queue_kind, queue_item_id, recipient_email, subject, status, provider, provider_message_id, error_message, created_at, sent_at',
    filename: 'compliance-notifications',
    orderColumn: 'created_at',
  },
  evidence: {
    table: 'compliance_case_evidence',
    select: 'id, queue_kind, queue_item_id, evidence_type, title, url, notes, added_by, created_at',
    filename: 'compliance-case-evidence',
    orderColumn: 'created_at',
  },
  consents: {
    table: 'user_consents',
    select: 'id, user_id, document_type, document_version, consent_context, country_code, region_code, accepted_at',
    filename: 'user-consents',
    orderColumn: 'accepted_at',
  },
}

function isExportKind(value: string | null): value is string {
  return !!value && value in EXPORTS
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = String(value).replace(/\r?\n/g, ' ')
  if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
  ].join('\n')
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const kind = url.searchParams.get('kind')
  if (!isExportKind(kind)) {
    return NextResponse.json({ error: 'Invalid export kind' }, { status: 400 })
  }

  const config = EXPORTS[kind]
  const { data, error } = await supabase
    .from(config.table as 'content_reports')
    .select(config.select)
    .order(config.orderColumn, { ascending: false })
    .limit(5000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const csv = toCsv((data ?? []) as unknown as Record<string, unknown>[])
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${config.filename}-${stamp}.csv"`,
    },
  })
}
