import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Supabase Auth Callback Route Handler
 * 
 * Implements the PKCE flow code exchange. Converts the temporary auth `code`
 * from the redirect URL into a secure JWT session stored in cookies.
 * 
 * From DOC2 Section 3.3 and DOC5 AUTH-001-02
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // If next is in parameter, redirect there, otherwise go to dashboard
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Redirect to login page with callback error message if exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
