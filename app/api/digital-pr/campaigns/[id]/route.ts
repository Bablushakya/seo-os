export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { PRCampaignCreateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/digital-pr/campaigns/[id]
 * 
 * Fetches a single campaign's details.
 * 
 * PATCH /api/digital-pr/campaigns/[id]
 * 
 * Updates campaign details.
 * 
 * DELETE /api/digital-pr/campaigns/[id]
 * 
 * Deletes a campaign. Restricted to Admin.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('pr_campaigns')
    .select('*, creator:users(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Campaign not found', 404)
  }

  // Fetch placement stats for this specific campaign
  const { data: placements, error: placError } = await supabase
    .from('pr_placements')
    .select('id, reach_estimate')
    .eq('campaign_id', id)

  if (placError) {
    throw placError
  }

  const placementCount = placements?.length || 0
  const totalReach = placements?.reduce((sum, p) => sum + (p.reach_estimate || 0), 0) || 0

  return formatResponse({
    ...data,
    placement_count: placementCount,
    total_reach: totalReach,
  })
})

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Get old record for audit log
  const { data: oldCampaign, error: fetchError } = await supabase
    .from('pr_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldCampaign) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Campaign not found', 404)
  }

  // 2. Validate update body
  const body = await req.json()
  const validated = PRCampaignCreateSchema.partial().parse(body)

  // 3. Perform update
  const { data: newCampaign, error: updateError } = await supabase
    .from('pr_campaigns')
    .update(validated)
    .eq('id', id)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit event
  await logUpdate(user.id, 'pr_campaigns', id, oldCampaign, newCampaign)

  return formatResponse(newCampaign)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const authContext = await requireRole(['admin'])
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Get old record for audit log
  const { data: oldCampaign, error: fetchError } = await supabase
    .from('pr_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldCampaign) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Campaign not found', 404)
  }

  // 2. Delete Campaign (will cascade to placements automatically via DB FK)
  const { error: deleteError } = await supabase
    .from('pr_campaigns')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 3. Log audit event
  await logDelete(authContext.user.id, 'pr_campaigns', id, oldCampaign)

  return formatDeletedResponse()
})
