import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type QueueKind = 'content_reports' | 'takedown_requests' | 'privacy_requests'

const ALLOWED_STATUS: Record<QueueKind, string[]> = {
  content_reports: ['open', 'reviewing', 'resolved', 'dismissed'],
  takedown_requests: ['open', 'reviewing', 'actioned', 'rejected', 'counter_notice'],
  privacy_requests: ['open', 'verifying', 'processing', 'completed', 'rejected'],
}

const TERMINAL_STATUS: Record<QueueKind, string[]> = {
  content_reports: ['resolved', 'dismissed'],
  takedown_requests: ['actioned', 'rejected', 'counter_notice'],
  privacy_requests: ['completed', 'rejected'],
}

interface StatusPayload {
  kind: QueueKind
  id: string
  status: string
  note?: string
  notify?: boolean
}

type QueueItem = {
  id: string
  status: string
  reporter_email?: string | null
  claimant_email?: string | null
  email?: string | null
}

function isQueueKind(value: unknown): value is QueueKind {
  return value === 'content_reports' || value === 'takedown_requests' || value === 'privacy_requests'
}

function recipientField(kind: QueueKind) {
  if (kind === 'content_reports') return 'reporter_email'
  if (kind === 'takedown_requests') return 'claimant_email'
  return 'email'
}

function completedField(kind: QueueKind) {
  return kind === 'privacy_requests' ? 'completed_at' : 'resolved_at'
}

function subjectFor(kind: QueueKind, status: string) {
  const label = kind === 'content_reports'
    ? 'content report'
    : kind === 'takedown_requests'
      ? 'takedown request'
      : 'privacy request'

  return `PageCast ${label} update: ${status.replace(/_/g, ' ')}`
}

function bodyFor(kind: QueueKind, status: string, note?: string) {
  const label = kind === 'content_reports'
    ? 'content report'
    : kind === 'takedown_requests'
      ? 'rights takedown request'
      : 'privacy request'

  return [
    `Hello,`,
    ``,
    `PageCast has updated your ${label} to: ${status.replace(/_/g, ' ')}.`,
    note ? `\nReviewer note:\n${note}` : '',
    ``,
    `This message is part of the PageCast compliance review process.`,
    ``,
    `PageCast Trust & Compliance`,
  ].filter(Boolean).join('\n')
}

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.COMPLIANCE_EMAIL_FROM || 'PageCast Compliance <compliance@pagecast.app>'

  if (!apiKey) {
    return { status: 'skipped' as const, provider: null, providerMessageId: null, errorMessage: 'RESEND_API_KEY is not configured.' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      status: 'failed' as const,
      provider: 'resend',
      providerMessageId: null,
      errorMessage: result?.message || `Resend returned ${response.status}`,
    }
  }

  return {
    status: 'sent' as const,
    provider: 'resend',
    providerMessageId: typeof result?.id === 'string' ? result.id : null,
    errorMessage: null,
  }
}

export async function POST(request: Request) {
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

  const payload = await request.json().catch(() => null) as StatusPayload | null
  if (!payload || !isQueueKind(payload.kind) || !payload.id || !ALLOWED_STATUS[payload.kind].includes(payload.status)) {
    return NextResponse.json({ error: 'Invalid compliance status payload' }, { status: 400 })
  }

  const selectFields = `id, status, ${recipientField(payload.kind)}`
  const { data: current, error: fetchError } = await supabase
    .from(payload.kind)
    .select(selectFields)
    .eq('id', payload.id)
    .single()

  const currentItem = current as QueueItem | null

  if (fetchError || !currentItem) {
    return NextResponse.json({ error: fetchError?.message || 'Queue item not found' }, { status: 404 })
  }

  const updates: Record<string, string | null> = { status: payload.status }
  if (TERMINAL_STATUS[payload.kind].includes(payload.status)) {
    updates[completedField(payload.kind)] = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from(payload.kind)
    .update(updates)
    .eq('id', payload.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data: actionLog, error: logError } = await supabase
    .from('compliance_action_logs')
    .insert({
      queue_kind: payload.kind,
      queue_item_id: payload.id,
      actor_id: user.id,
      action_type: 'status_update',
      previous_status: currentItem.status,
      new_status: payload.status,
      note: payload.note?.trim() || null,
    })
    .select('id')
    .single()

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  const email = String(currentItem[recipientField(payload.kind)] || '').trim()
  if (payload.notify !== false && email) {
    const subject = subjectFor(payload.kind, payload.status)
    const body = bodyFor(payload.kind, payload.status, payload.note)
    const delivery = await sendEmail(email, subject, body)

    const { error: notificationError } = await supabase
      .from('compliance_notifications')
      .insert({
        queue_kind: payload.kind,
        queue_item_id: payload.id,
        action_log_id: actionLog.id,
        recipient_email: email,
        subject,
        body,
        status: delivery.status,
        provider: delivery.provider,
        provider_message_id: delivery.providerMessageId,
        error_message: delivery.errorMessage,
        sent_at: delivery.status === 'sent' ? new Date().toISOString() : null,
      })

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, notificationStatus: delivery.status })
  }

  return NextResponse.json({ ok: true, notificationStatus: 'not_requested' })
}
