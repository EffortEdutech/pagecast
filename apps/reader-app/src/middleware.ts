import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: do not remove this call
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/reader/') && !user) {
    const bookId = pathname.split('/')[2]
    const guestReadable = await isGuestReadableCast(supabase, bookId)
    if (guestReadable) return supabaseResponse
  }

  // Protected routes — redirect to login if not authenticated
  const protectedPaths = ['/library', '/reader']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  // Already logged in — redirect away from login/signup
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}

async function isGuestReadableCast(supabase: ReturnType<typeof createServerClient>, bookId?: string) {
  if (!bookId) return false

  // Demo/local casts are still gated by the client reader; they do not expose
  // private Supabase content, so middleware should not force login first.
  if (!UUID_RE.test(bookId)) return true

  const { data: book } = await supabase
    .from('books')
    .select('id, guest_access')
    .eq('id', bookId)
    .eq('status', 'published')
    .maybeSingle()

  if (book?.guest_access) return true
  return false
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
