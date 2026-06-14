export const dynamic = 'force-dynamic'

import { withErrorHandler, formatPaginatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/competitors/[id]/backlinks
 * 
 * Fetches backlinks for a specific competitor with pagination and filtering.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { searchParams } = new URL(req.url)
  const isGapStr = searchParams.get('is_gap')
  const taggedStr = searchParams.get('tagged_for_outreach')
  const daMinStr = searchParams.get('daMin')
  const daMaxStr = searchParams.get('daMax')
  const search = searchParams.get('search') || ''

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
  const sortBy = searchParams.get('sortBy') || 'source_da'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  let query = supabase
    .from('competitor_backlinks')
    .select('*', { count: 'exact' })
    .eq('competitor_id', id)

  // Filters
  if (isGapStr !== null && isGapStr !== undefined && isGapStr !== '' && isGapStr !== 'all') {
    query = query.eq('is_gap', isGapStr === 'true')
  }
  if (taggedStr !== null && taggedStr !== undefined && taggedStr !== '' && taggedStr !== 'all') {
    query = query.eq('tagged_for_outreach', taggedStr === 'true')
  }
  if (daMinStr) {
    const daMin = parseInt(daMinStr, 10)
    if (!isNaN(daMin)) {
      query = query.gte('source_da', daMin)
    }
  }
  if (daMaxStr) {
    const daMax = parseInt(daMaxStr, 10)
    if (!isNaN(daMax)) {
      query = query.lte('source_da', daMax)
    }
  }
  if (search) {
    query = query.or(`source_domain.ilike.%${search}%,anchor_text.ilike.%${search}%`)
  }

  // Sort
  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  // Paginate
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
