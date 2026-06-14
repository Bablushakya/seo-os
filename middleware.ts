import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js middleware — applied to every request.
 *
 * Responsibilities:
 * 1. Refresh the Supabase session cookie so it stays alive
 * 2. Redirect unauthenticated users to /login
 * 3. Block users not in public.users (pre-approved list) even if they
 *    have a valid auth token
 *
 * From DOC2 Section 7.1 and DOC3 Section 4.5
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do NOT add logic between createServerClient and getUser()
  // A critical part of the session refresh mechanism depends on the sequence.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'
  const isAuthCallback = request.nextUrl.pathname.startsWith('/api/auth')

  // Allow public access to auth callback routes
  if (isAuthCallback) {
    return supabaseResponse
  }

  // No session → redirect to /login (except if already there)
  if (!user && !isLoginPage) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Session exists but we need to verify the user is in public.users
  // (i.e. they are a pre-approved team member, not a rogue auth account)
  if (user && !isLoginPage) {
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      // User authenticated with Supabase Auth but NOT in the approved users table
      // Sign them out and redirect with error code
      await supabase.auth.signOut()
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }
  }

  // Authenticated user visiting /login → redirect to dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico   (favicon)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
