export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/users
 * 
 * Lists all users in the system. Used to populate assignee dropdowns.
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, avatar_url')
    .order('full_name', { ascending: true })

  if (error) {
    throw error
  }

  return formatResponse(data)
})
