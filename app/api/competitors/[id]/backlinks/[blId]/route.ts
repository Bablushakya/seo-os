export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logUpdate } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * PATCH /api/competitors/[id]/backlinks/[blId]
 * 
 * Toggles the 'tagged_for_outreach' status for a specific competitor backlink.
 */
export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const authContext = await requireAuth()
  const supabase = await createClient()
  const { blId } = context.params as { blId: string }

  // 1. Fetch old backlink
  const { data: oldBacklink, error: fetchError } = await supabase
    .from('competitor_backlinks')
    .select('*')
    .eq('id', blId)
    .single()

  if (fetchError || !oldBacklink) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Backlink not found', 404)
  }

  // 2. Parse payload
  const body = await req.json()
  const payload: Record<string, any> = {}
  
  if (body.tagged_for_outreach !== undefined) {
    payload.tagged_for_outreach = Boolean(body.tagged_for_outreach)
  }
  if (body.notes !== undefined) {
    payload.notes = body.notes ? String(body.notes).trim() : null
  }

  if (Object.keys(payload).length === 0) {
    return formatResponse(oldBacklink)
  }

  // 3. Update backlink
  const { data: newBacklink, error: updateError } = await supabase
    .from('competitor_backlinks')
    .update(payload)
    .eq('id', blId)
    .select('*')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit event
  await logUpdate(authContext.user.id, 'competitor_backlinks', blId, oldBacklink, newBacklink)

  return formatResponse(newBacklink)
})
