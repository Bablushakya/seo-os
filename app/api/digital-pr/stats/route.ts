export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/digital-pr/stats
 * 
 * Computes overall Digital PR metrics:
 * - total_campaigns: total count of campaigns
 * - total_placements: total count of placements
 * - total_reach: sum of estimated reach of all placements
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  const [campaignsRes, placementsRes] = await Promise.all([
    supabase.from('pr_campaigns').select('id'),
    supabase.from('pr_placements').select('reach_estimate'),
  ])

  const totalCampaigns = campaignsRes.data?.length || 0
  const totalPlacements = placementsRes.data?.length || 0
  const totalReach = placementsRes.data?.reduce((sum, p) => sum + (p.reach_estimate || 0), 0) || 0

  return formatResponse({
    total_campaigns: totalCampaigns,
    total_placements: totalPlacements,
    total_reach: totalReach,
  })
})
