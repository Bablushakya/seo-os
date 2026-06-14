import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types'

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Reads and writes session cookies server-side.
 *
 * From DOC2 Section 3.3 — lib/supabase/server.ts
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll is called from Server Components where cookies cannot be set.
            // This can be ignored if middleware is refreshing the session.
          }
        },
      },
    },
  )
}

/**
 * Creates a Supabase Admin client using the service role key.
 *
 * IMPORTANT: This client bypasses Row Level Security (RLS).
 * ONLY use this in:
 *   - Audit log writes (need to write regardless of user)
 *   - n8n automation API routes
 *   - Admin user management (create/update users)
 *   - Report generation
 *
 * NEVER expose the service role key to the frontend.
 * DOC3 Section 6.2 — Service Role Usage
 */
export function createAdminClient() {
  // Import is deferred to prevent accidental client-side bundling
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js')

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
