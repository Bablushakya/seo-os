export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { Errors } from '@/lib/errors'

/**
 * GET /api/reports/[id]
 * 
 * Fetches details for a specific report by its ID.
 */
export const GET = withErrorHandler(async (req: Request, { params }: { params: Record<string, string> }) => {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('reports')
    .select('*, creator:users(id, full_name)')
    .eq('id', params.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw Errors.notFound('Report')
    }
    throw error
  }

  return formatResponse(data)
})
