import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated', status: 401 as const }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    return { error: 'Admin access required', status: 403 as const }
  }

  return { admin }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.admin
    .from('books')
    .select('id,title,genre,language,guest_access,guest_access_rank,guest_access_label,updated_at')
    .eq('status', 'published')
    .eq('is_free', true)
    .order('guest_access_rank', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ casts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const castIds = Array.isArray(body?.castIds)
    ? [...new Set(body.castIds.filter((id: unknown) => typeof id === 'string'))].slice(0, 3)
    : []

  const { data: selected, error: selectedError } = castIds.length
    ? await auth.admin
        .from('books')
        .select('id')
        .in('id', castIds)
        .eq('status', 'published')
        .eq('is_free', true)
    : { data: [], error: null }

  if (selectedError) return NextResponse.json({ error: selectedError.message }, { status: 500 })
  const validIds = new Set((selected ?? []).map(row => row.id))
  if (validIds.size !== castIds.length) {
    return NextResponse.json({ error: 'Guest shelf can only include published Starter Casts.' }, { status: 400 })
  }

  const { error: clearError } = await auth.admin
    .from('books')
    .update({ guest_access: false, guest_access_rank: null, guest_access_label: 'Guest Cast' })
    .eq('guest_access', true)

  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 })

  for (const [index, id] of castIds.entries()) {
    const { error } = await auth.admin
      .from('books')
      .update({
        guest_access: true,
        guest_access_rank: index + 1,
        guest_access_label: 'Start Free',
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, castIds })
}
