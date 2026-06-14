export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { OutreachProspectCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/outreach
 * 
 * Fetches a list of outreach prospects with filters: search, pipeline stage,
 * assignee, niche, and domain authority range.
 * 
 * POST /api/outreach
 * 
 * Creates a new outreach prospect.
 */

export const GET = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const stage = searchParams.get('stage') || ''
  const assignedTo = searchParams.get('assigned_to') || ''
  const niche = searchParams.get('niche') || ''
  const daMinStr = searchParams.get('daMin')
  const daMaxStr = searchParams.get('daMax')

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
  const sortBy = searchParams.get('sortBy') || 'next_followup_date'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  // Build query
  let query = supabase
    .from('outreach_prospects')
    .select('*, assignee:users!outreach_prospects_assigned_to_fkey(id, full_name, avatar_url), creator:users!outreach_prospects_created_by_fkey(id, full_name, avatar_url)', { count: 'exact' })

  // Search filter (site_name or url)
  if (search) {
    query = query.or(`site_name.ilike.%${search}%,url.ilike.%${search}%`)
  }

  // Stage filter
  if (stage) {
    query = query.eq('pipeline_stage', stage)
  }

  // Assigned to filter
  if (assignedTo) {
    const targetId = assignedTo === 'me' ? user.id : assignedTo
    query = query.eq('assigned_to', targetId)
  }

  // Niche filter
  if (niche) {
    query = query.eq('niche', niche)
  }

  // Domain Authority filters
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

  // Order
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
  const validated = OutreachProspectCreateSchema.parse(body)

  const prospectData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('outreach_prospects')
    .insert(prospectData)
    .select('*, assignee:users!outreach_prospects_assigned_to_fkey(id, full_name, avatar_url), creator:users!outreach_prospects_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'outreach_prospects', data.id, data)

  return formatCreatedResponse(data)
})
