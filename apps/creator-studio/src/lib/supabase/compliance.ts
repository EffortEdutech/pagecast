import { createClient } from './client'

export type RightsCategory = 'unspecified' | 'original' | 'licensed' | 'public_domain' | 'commissioned' | 'ai_generated' | 'mixed'

export interface BookRights {
  bookId: string
  rightsCategory: RightsCategory
  copyrightOwner: string
  sourceUrl: string
  licenseType: string
  licenseNotes: string
  attributionText: string
  publicDomainBasis: string
  jurisdiction: string
  territory: string
  languageRights: string
  audioRightsConfirmed: boolean
  containsAiGeneratedContent: boolean
  containsSyntheticAudio: boolean
  aiDisclosureText: string
  licenseExpiresAt: string
  declaredAt?: string
}

export const EMPTY_BOOK_RIGHTS: BookRights = {
  bookId: '',
  rightsCategory: 'unspecified',
  copyrightOwner: '',
  sourceUrl: '',
  licenseType: '',
  licenseNotes: '',
  attributionText: '',
  publicDomainBasis: '',
  jurisdiction: '',
  territory: 'Worldwide',
  languageRights: '',
  audioRightsConfirmed: false,
  containsAiGeneratedContent: false,
  containsSyntheticAudio: false,
  aiDisclosureText: '',
  licenseExpiresAt: '',
}

interface DbBookRights {
  book_id: string
  rights_category: RightsCategory
  copyright_owner: string | null
  source_url: string | null
  license_type: string | null
  license_notes: string | null
  attribution_text: string | null
  public_domain_basis: string | null
  jurisdiction: string | null
  territory: string | null
  language_rights: string | null
  audio_rights_confirmed: boolean | null
  contains_ai_generated_content: boolean | null
  contains_synthetic_audio: boolean | null
  ai_disclosure_text: string | null
  license_expires_at: string | null
  declared_at: string | null
}

function fromDb(row: DbBookRights): BookRights {
  return {
    bookId: row.book_id,
    rightsCategory: row.rights_category ?? 'unspecified',
    copyrightOwner: row.copyright_owner ?? '',
    sourceUrl: row.source_url ?? '',
    licenseType: row.license_type ?? '',
    licenseNotes: row.license_notes ?? '',
    attributionText: row.attribution_text ?? '',
    publicDomainBasis: row.public_domain_basis ?? '',
    jurisdiction: row.jurisdiction ?? '',
    territory: row.territory ?? 'Worldwide',
    languageRights: row.language_rights ?? '',
    audioRightsConfirmed: Boolean(row.audio_rights_confirmed),
    containsAiGeneratedContent: Boolean(row.contains_ai_generated_content),
    containsSyntheticAudio: Boolean(row.contains_synthetic_audio),
    aiDisclosureText: row.ai_disclosure_text ?? '',
    licenseExpiresAt: row.license_expires_at?.slice(0, 10) ?? '',
    declaredAt: row.declared_at ?? undefined,
  }
}

export async function fetchBookRights(bookId: string): Promise<BookRights | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('book_rights')
    .select('*')
    .eq('book_id', bookId)
    .maybeSingle()

  if (error) {
    console.warn('fetchBookRights error:', error.message)
    return null
  }

  return data ? fromDb(data as DbBookRights) : null
}

export async function saveBookRights(bookId: string, rights: BookRights): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase.from('book_rights').upsert({
    book_id: bookId,
    rights_category: rights.rightsCategory,
    copyright_owner: rights.copyrightOwner.trim() || null,
    source_url: rights.sourceUrl.trim() || null,
    license_type: rights.licenseType.trim() || null,
    license_notes: rights.licenseNotes.trim() || null,
    attribution_text: rights.attributionText.trim() || null,
    public_domain_basis: rights.publicDomainBasis.trim() || null,
    jurisdiction: rights.jurisdiction.trim() || null,
    territory: rights.territory.trim() || null,
    language_rights: rights.languageRights.trim() || null,
    audio_rights_confirmed: rights.audioRightsConfirmed,
    contains_ai_generated_content: rights.containsAiGeneratedContent,
    contains_synthetic_audio: rights.containsSyntheticAudio,
    ai_disclosure_text: rights.aiDisclosureText.trim() || null,
    license_expires_at: rights.licenseExpiresAt ? new Date(rights.licenseExpiresAt).toISOString() : null,
    declared_by: user.id,
    declared_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'book_id' })

  if (error) console.warn('saveBookRights error:', error.message)
  return !error
}

export interface ComplianceCheck {
  ok: boolean
  issues: string[]
  rights: BookRights | null
}

export async function validateBookCompliance(bookId: string): Promise<ComplianceCheck> {
  const rights = await fetchBookRights(bookId)
  const issues: string[] = []

  if (!rights) {
    return {
      ok: false,
      rights: null,
      issues: ['Rights metadata is missing. Open Book Settings and complete Rights & Compliance first.'],
    }
  }

  if (rights.rightsCategory === 'unspecified') issues.push('Select the rights category for this Cast.')
  if (!rights.copyrightOwner.trim()) issues.push('Add the copyright owner or rights holder.')
  if (!rights.audioRightsConfirmed) issues.push('Confirm that you control the audio/adaptation rights.')
  if (!rights.territory.trim()) issues.push('Add the territory or market where these rights apply.')
  if (!rights.languageRights.trim()) issues.push('Add the language rights covered by this Cast.')

  if (rights.rightsCategory === 'licensed' && !rights.licenseNotes.trim() && !rights.sourceUrl.trim()) {
    issues.push('Licensed works need license notes or a source/proof URL.')
  }
  if (rights.rightsCategory === 'public_domain' && !rights.publicDomainBasis.trim()) {
    issues.push('Public-domain works need a basis, jurisdiction, and source notes.')
  }
  if ((rights.containsAiGeneratedContent || rights.containsSyntheticAudio) && !rights.aiDisclosureText.trim()) {
    issues.push('AI-generated or synthetic audio/content needs a reader-facing disclosure note.')
  }

  return { ok: issues.length === 0, issues, rights }
}

export async function createPublishAttestation(bookId: string, checklist: Record<string, unknown>): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase.from('publish_attestations').insert({
    book_id: bookId,
    creator_id: user.id,
    checklist_snapshot: checklist,
    document_versions: {
      creator_terms: 'draft-2026-05-16',
      copyright_policy: 'draft-2026-05-16',
      ai_disclosure: 'draft-2026-05-16',
    },
  })

  if (error) console.warn('createPublishAttestation error:', error.message)
  return !error
}

export interface AssetRightsInput {
  bookId: string
  sourceUrl: string
  rightsCategory: Exclude<RightsCategory, 'unspecified'>
  copyrightOwner?: string
  licenseType?: string
  licenseNotes?: string
  attributionText?: string
}

export async function saveAssetRights(input: AssetRightsInput): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase.from('asset_rights').insert({
    book_id: input.bookId,
    rights_category: input.rightsCategory,
    copyright_owner: input.copyrightOwner?.trim() || null,
    source_url: input.sourceUrl,
    license_type: input.licenseType?.trim() || null,
    license_notes: input.licenseNotes?.trim() || null,
    attribution_text: input.attributionText?.trim() || null,
    declared_by: user.id,
    declared_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (error) console.warn('saveAssetRights error:', error.message)
  return !error
}
