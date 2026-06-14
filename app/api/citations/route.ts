export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { CitationCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/citations
 * 
 * Fetches a list of citations with search, status, niche, and domain authority filtering,
 * paginated and sorted.
 * 
 * POST /api/citations
 * 
 * Creates a new citation record and logs the event.
 */

export const GET = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const statusParam = searchParams.get('status') || ''
  const niche = searchParams.get('niche') || ''
  const daMinStr = searchParams.get('daMin')
  const daMaxStr = searchParams.get('daMax')
  
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  const sortBy = searchParams.get('sortBy') || 'directory_name'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  // Build supabase query
  let query = supabase
    .from('citations')
    .select('*, creator:users(id, full_name, avatar_url)', { count: 'exact' })

  // Search filter (directory_name or url matches search term)
  if (search) {
    query = query.or(`directory_name.ilike.%${search}%,url.ilike.%${search}%`)
  }

  // Status filter (supports comma-separated list)
  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
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

  // Range for pagination
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
  const validated = CitationCreateSchema.parse(body)

  const citationData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('citations')
    .insert(citationData)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'citations', data.id, data)

  return formatCreatedResponse(data)
})
