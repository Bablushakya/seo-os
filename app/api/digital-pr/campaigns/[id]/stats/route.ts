export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/digital-pr/campaigns/[id]/stats
 * 
 * Computes metrics for a specific campaign:
 * - placement_count: total placements under this campaign
 * - total_reach: sum of estimated reach of placements
 * - average_da: average Domain Authority (DA) of placements
 * - response_rate: average response rate of all media contacts
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // Verify campaign exists
  const { data: campaign, error: campError } = await supabase
    .from('pr_campaigns')
    .select('id')
    .eq('id', id)
    .single()

  if (campError || !campaign) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Campaign not found', 404)
  }

  // Fetch placements
  const { data: placements, error: placError } = await supabase
    .from('pr_placements')
    .select('domain_authority, reach_estimate')
    .eq('campaign_id', id)

  if (placError) {
    throw placError
  }

  // Fetch media contacts to compute average response rate
  const { data: contacts, error: contactsError } = await supabase
    .from('pr_contacts')
    .select('response_rate')

  if (contactsError) {
    throw contactsError
  }

  const placementCount = placements?.length || 0
  const totalReach = placements?.reduce((sum, p) => sum + (p.reach_estimate || 0), 0) || 0
  
  const sumDA = placements?.reduce((sum, p) => sum + (p.domain_authority || 0), 0) || 0
  const averageDA = placementCount > 0 ? Math.round(sumDA / placementCount) : 0

  const contactsCount = contacts?.length || 0
  const sumResponseRate = contacts?.reduce((sum, c) => sum + (c.response_rate || 0), 0) || 0
  const averageResponseRate = contactsCount > 0 ? Math.round(sumResponseRate / contactsCount) : 0

  return formatResponse({
    placement_count: placementCount,
    total_reach: totalReach,
    average_da: averageDA,
    response_rate: averageResponseRate,
  })
})
