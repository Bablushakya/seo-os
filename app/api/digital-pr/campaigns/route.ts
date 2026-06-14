export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { PRCampaignCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/digital-pr/campaigns
 * 
 * Lists all PR campaigns with search, status filtering, pagination, and sorting.
 * Group-aggregates placement count and estimated reach in memory.
 * 
 * POST /api/digital-pr/campaigns
 * 
 * Creates a new PR campaign.
 */

export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  const sortBy = searchParams.get('sortBy') || 'created_at'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  // Build campaigns query
  let query = supabase
    .from('pr_campaigns')
    .select('*, creator:users(id, full_name, avatar_url)', { count: 'exact' })

  // Search filter (campaign_name or topic)
  if (search) {
    query = query.or(`campaign_name.ilike.%${search}%,topic.ilike.%${search}%`)
  }

  // Status filter
  if (status) {
    query = query.eq('status', status)
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  // Pagination
  const offset = (page - 1) * limit
  const { data: campaigns, count, error: fetchError } = await query.range(offset, offset + limit - 1)

  if (fetchError) {
    throw fetchError
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  if (!campaigns || campaigns.length === 0) {
    return formatPaginatedResponse([], {
      total,
      page,
      limit,
      total_pages: totalPages,
    })
  }

  // Fetch placement stats for these campaigns
  const campaignIds = campaigns.map(c => c.id)
  const { data: placements, error: placError } = await supabase
    .from('pr_placements')
    .select('campaign_id, reach_estimate')
    .in('campaign_id', campaignIds)

  if (placError) {
    throw placError
  }

  // Aggregate stats in memory
  const statsMap = new Map<string, { count: number; totalReach: number }>()
  placements?.forEach(p => {
    const curr = statsMap.get(p.campaign_id) || { count: 0, totalReach: 0 }
    curr.count++
    curr.totalReach += p.reach_estimate || 0
    statsMap.set(p.campaign_id, curr)
  })

  // Format response list
  const data = campaigns.map(c => {
    const stats = statsMap.get(c.id) || { count: 0, totalReach: 0 }
    return {
      ...c,
      placement_count: stats.count,
      total_reach: stats.totalReach,
    }
  })

  return formatPaginatedResponse(data, {
    total,
    page,
    limit,
    total_pages: totalPages,
  })
})

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const validated = PRCampaignCreateSchema.parse(body)

  const campaignData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('pr_campaigns')
    .insert(campaignData)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'pr_campaigns', data.id, data)

  return formatCreatedResponse({
    ...data,
    placement_count: 0,
    total_reach: 0,
  })
})
