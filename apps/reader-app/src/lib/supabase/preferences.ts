import { createClient } from './client'

export interface MarketingConsentInput {
  optedIn: boolean
  countryCode?: string
  regionCode?: string
  source?: string
}

export async function saveMarketingConsent(input: MarketingConsentInput): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return true

  const { error } = await supabase.from('marketing_consents').insert({
    user_id: user.id,
    status: input.optedIn ? 'opted_in' : 'opted_out',
    source: input.source || 'signup',
    country_code: input.countryCode?.trim().toUpperCase() || null,
    region_code: input.regionCode?.trim().toUpperCase() || null,
  })

  if (error) console.warn('saveMarketingConsent error:', error.message)
  return !error
}
