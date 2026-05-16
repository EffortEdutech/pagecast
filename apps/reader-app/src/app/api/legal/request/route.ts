import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type LegalRequestKind = 'report' | 'takedown' | 'privacy'

const RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 5,
}

const buckets = new Map<string, { count: number; resetAt: number }>()

function clientKey(request: Request, kind: string) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')
  return `${kind}:${forwardedFor || realIp || 'unknown'}`
}

function rateLimited(request: Request, kind: string) {
  const key = clientKey(request, kind)
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs })
    return false
  }

  bucket.count += 1
  return bucket.count > RATE_LIMIT.max
}

function isKind(value: unknown): value is LegalRequestKind {
  return value === 'report' || value === 'takedown' || value === 'privacy'
}

function clean(value: unknown, max = 4000) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function optionalUuid(value: unknown) {
  const text = clean(value, 80)
  if (!text) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null
}

function privacyResponseDays(countryCode?: string, regionCode?: string, requestType?: string): number {
  const country = countryCode?.trim().toUpperCase()
  const region = regionCode?.trim().toUpperCase()

  if (country === 'US' && region === 'CA' && requestType === 'opt_out_sale_share') return 15
  if (country === 'US' && region === 'CA') return 45
  if (country === 'MY') return 21
  return 30
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  const kind = payload?.kind

  if (!payload || !isKind(kind)) {
    return NextResponse.json({ error: 'Invalid legal request payload' }, { status: 400 })
  }

  if (rateLimited(request, kind)) {
    return NextResponse.json({ error: 'Too many requests. Please wait and try again.' }, { status: 429 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (kind === 'report') {
    const reason = clean(payload.reason, 120)
    if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 })

    const { error } = await supabase.from('content_reports').insert({
      book_id: optionalUuid(payload.bookId),
      reporter_user_id: user?.id ?? null,
      reporter_email: clean(payload.reporterEmail, 254) || user?.email || null,
      reason,
      details: clean(payload.details) || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (kind === 'takedown') {
    const claimantName = clean(payload.claimantName, 200)
    const claimantEmail = clean(payload.claimantEmail, 254)
    const claimType = clean(payload.claimType, 60) || 'copyright'
    const evidence = clean(payload.evidence)

    if (!claimantName || !claimantEmail || !evidence) {
      return NextResponse.json({ error: 'Name, email, and evidence are required' }, { status: 400 })
    }

    const { error } = await supabase.from('takedown_requests').insert({
      claimant_name: claimantName,
      claimant_email: claimantEmail,
      book_id: optionalUuid(payload.bookId),
      asset_id: optionalUuid(payload.assetId),
      claim_type: claimType,
      evidence,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const email = clean(payload.email, 254) || user?.email || ''
  const requestType = clean(payload.requestType, 60)
  const countryCode = clean(payload.countryCode, 2).toUpperCase()
  const regionCode = clean(payload.regionCode, 12).toUpperCase()
  const responseDays = privacyResponseDays(countryCode, regionCode, requestType)
  const statutoryDeadline = new Date(Date.now() + responseDays * 24 * 60 * 60 * 1000).toISOString()

  if (!email || !requestType) {
    return NextResponse.json({ error: 'Email and request type are required' }, { status: 400 })
  }

  const { error } = await supabase.from('privacy_requests').insert({
    user_id: user?.id ?? null,
    email,
    country_code: countryCode || null,
    region_code: regionCode || null,
    request_type: requestType,
    statutory_deadline_at: statutoryDeadline,
    details: clean(payload.details) || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
