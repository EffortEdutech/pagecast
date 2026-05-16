import { createClient } from './client'

export type ConsentDocumentType = 'privacy' | 'terms' | 'creator-terms' | 'ai-disclosure'

export interface RequiredConsent {
  type: ConsentDocumentType
  version: string
  title: string
  href: string
}

const CREATOR_FALLBACK: RequiredConsent[] = [
  { type: 'privacy', version: '2026-05-16', title: 'Privacy Policy', href: 'http://localhost:3800/legal/privacy' },
  { type: 'creator-terms', version: '2026-05-16', title: 'Creator Terms', href: 'http://localhost:3800/legal/creator-terms' },
  { type: 'ai-disclosure', version: '2026-05-16', title: 'AI and Synthetic Audio Disclosure', href: 'http://localhost:3800/legal/ai-disclosure' },
]

function hrefFor(type: string) {
  if (type === 'privacy') return 'http://localhost:3800/legal/privacy'
  if (type === 'creator-terms') return 'http://localhost:3800/legal/creator-terms'
  if (type === 'ai-disclosure') return 'http://localhost:3800/legal/ai-disclosure'
  return 'http://localhost:3800/legal'
}

export async function fetchMissingCreatorConsents(): Promise<RequiredConsent[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: documents } = await supabase
    .from('legal_documents')
    .select('type, version, title')
    .in('type', ['privacy', 'creator-terms', 'ai-disclosure'])
    .not('published_at', 'is', null)
    .lte('effective_at', new Date().toISOString())

  const required = (documents?.length ? documents.map(doc => ({
    type: doc.type as ConsentDocumentType,
    version: doc.version,
    title: doc.title,
    href: hrefFor(doc.type),
  })) : CREATOR_FALLBACK)

  const { data: consents } = await supabase
    .from('user_consents')
    .select('document_type, document_version')
    .eq('user_id', user.id)
    .in('document_type', required.map(item => item.type))

  const accepted = new Set((consents ?? []).map(item => `${item.document_type}:${item.document_version}`))
  return required.filter(item => !accepted.has(`${item.type}:${item.version}`))
}

export async function acceptConsents(consents: RequiredConsent[], context: string): Promise<boolean> {
  if (!consents.length) return true
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase.from('user_consents').insert(
    consents.map(item => ({
      user_id: user.id,
      document_type: item.type,
      document_version: item.version,
      consent_context: context,
    }))
  )

  if (error) console.warn('acceptConsents error:', error.message)
  return !error
}
