import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types'

/**
 * Creates a Supabase client for use in Client Components (browser).
 *
 * Uses the public anon key — safe to expose in the frontend bundle.
 * Row Level Security on the database enforces all data access rules.
 *
 * From DOC2 Section 3.3 — lib/supabase/client.ts
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
