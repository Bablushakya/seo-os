export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/reports
 * 
 * Lists all generated reports in the system. Accessible by all authenticated users.
 * Ordered by generated_at DESC.
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reports')
    .select('*, creator:users(id, full_name)')
    .order('generated_at', { ascending: false })

  if (error) {
    throw error
  }

  return formatResponse(data || [])
})
