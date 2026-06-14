export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { PRPlacementCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/digital-pr/placements
 * 
 * Fetches a list of PR placements, optional filtering by campaign_id, search, and DA range.
 * 
 * POST /api/digital-pr/placements
 * 
 * Creates a new PR placement record under a campaign.
 */

export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaign_id') || ''
  const search = searchParams.get('search') || ''
  const daMinStr = searchParams.get('daMin')
  const daMaxStr = searchParams.get('daMax')

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  const sortBy = searchParams.get('sortBy') || 'placement_date'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  let query = supabase
    .from('pr_placements')
    .select('*, campaign:pr_campaigns(id, campaign_name)', { count: 'exact' })

  // Campaign filter
  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  // Search filter (publication name or url)
  if (search) {
    query = query.or(`publication.ilike.%${search}%,url.ilike.%${search}%`)
  }

  // DA range filter
  if (daMinStr !== null && daMinStr !== undefined) {
    const daMin = parseInt(daMinStr, 10)
    if (!isNaN(daMin)) {
      query = query.gte('domain_authority', daMin)
    }
  }
  if (daMaxStr !== null && daMaxStr !== undefined) {
    const daMax = parseInt(daMaxStr, 10)
    if (!isNaN(daMax)) {
      query = query.lte('domain_authority', daMax)
    }
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  // Pagination
  const offset = (page - 1) * limit
  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return formatPaginatedResponse(data || [], {
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
  const validated = PRPlacementCreateSchema.parse(body)

  // In the DB, pr_placements doesn't have a created_by field (based on the schema migration),
  // but we should check if there is one. We saw the columns were:
  // id, campaign_id, publication, url, domain_authority, placement_date, reach_estimate, notes, created_at
  // No created_by column was defined on pr_placements in the schema.
  // Let's verify by inserting without created_by.
  const placementData = {
    ...validated,
  }

  const { data, error } = await supabase
    .from('pr_placements')
    .insert(placementData)
    .select('*, campaign:pr_campaigns(id, campaign_name)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'pr_placements', data.id, data)

  return formatCreatedResponse(data)
})
