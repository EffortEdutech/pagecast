import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from './server'

export type ApiAuthResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

/**
 * Require a signed-in Supabase user for an API route handler.
 *
 * Middleware already returns 401 for unauthenticated /api/* requests; this is
 * the in-route check so a matcher change can never silently expose a route
 * that spends server-side provider keys or credits.
 */
export async function requireApiUser(): Promise<ApiAuthResult> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return { ok: true, user, supabase }
  } catch {
    // Treat auth backend failures as unauthenticated — fail closed.
  }
  return {
    ok: false,
    response: NextResponse.json({ error: 'Sign in to use AI voice generation.' }, { status: 401 }),
  }
}
