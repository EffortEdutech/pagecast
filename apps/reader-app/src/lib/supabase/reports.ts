import { createClient } from './client'

export interface ContentReportInput {
  bookId: string
  blockId?: string
  reporterEmail?: string
  reason: string
  details?: string
}

export interface PublicContentReportInput {
  bookId?: string
  reporterEmail?: string
  reason: string
  details?: string
}

export interface TakedownRequestInput {
  claimantName: string
  claimantEmail: string
  bookId?: string
  assetId?: string
  claimType: string
  evidence?: string
}

export interface PrivacyRequestInput {
  email: string
  countryCode?: string
  regionCode?: string
  requestType: string
  details?: string
}

async function submitLegalRequest(payload: Record<string, unknown>): Promise<boolean> {
  const response = await fetch('/api/legal/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    console.warn('submitLegalRequest error:', result?.error || response.statusText)
    return false
  }
  return true
}

export async function submitContentReport(input: ContentReportInput): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('content_reports').insert({
    book_id: input.bookId,
    block_id: input.blockId || null,
    reporter_user_id: user?.id ?? null,
    reporter_email: input.reporterEmail?.trim() || user?.email || null,
    reason: input.reason,
    details: input.details?.trim() || null,
  })

  if (error) console.warn('submitContentReport error:', error.message)
  return !error
}

export async function submitPublicContentReport(input: PublicContentReportInput): Promise<boolean> {
  return submitLegalRequest({
    kind: 'report',
    bookId: input.bookId,
    reporterEmail: input.reporterEmail,
    reason: input.reason,
    details: input.details,
  })
}

export async function submitTakedownRequest(input: TakedownRequestInput): Promise<boolean> {
  return submitLegalRequest({
    kind: 'takedown',
    claimantName: input.claimantName,
    claimantEmail: input.claimantEmail,
    bookId: input.bookId,
    assetId: input.assetId,
    claimType: input.claimType,
    evidence: input.evidence,
  })
}

export async function submitPrivacyRequest(input: PrivacyRequestInput): Promise<boolean> {
  return submitLegalRequest({
    kind: 'privacy',
    email: input.email,
    countryCode: input.countryCode,
    regionCode: input.regionCode,
    requestType: input.requestType,
    details: input.details,
  })
}
