export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireRole } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/settings/users
 * 
 * Lists all users. Restricted to Admin.
 * Merges public.users with supabase auth user login metadata (last_sign_in_at).
 */
export const GET = withErrorHandler(async () => {
  await requireRole(['admin'])
  const adminClient = createAdminClient()

  // Fetch db users and auth users in parallel
  const [dbUsersRes, authUsersRes] = await Promise.all([
    adminClient.from('users').select('*').order('full_name', { ascending: true }),
    adminClient.auth.admin.listUsers(),
  ])

  if (dbUsersRes.error) {
    throw dbUsersRes.error
  }
  if (authUsersRes.error) {
    throw authUsersRes.error
  }

  const dbUsers = dbUsersRes.data || []
  const authUsers = authUsersRes.data?.users || []

  // Create a map of auth user ID to last_sign_in_at
  const lastLoginMap = new Map<string, string>()
  authUsers.forEach((u) => {
    if (u.last_sign_in_at) {
      lastLoginMap.set(u.id, u.last_sign_in_at)
    }
  })

  // Merge public profile data with last login timestamp
  const mergedUsers = dbUsers.map((u) => ({
    ...u,
    last_login: lastLoginMap.get(u.id) || null,
  }))

  return formatResponse(mergedUsers)
})
