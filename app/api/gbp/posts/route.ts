export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GBPPostCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/gbp/posts
 * 
 * Lists GBP posts, filterable by location_id.
 * 
 * POST /api/gbp/posts
 * 
 * Logs a new GBP post.
 */

export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('location_id') || ''

  if (!locationId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'location_id is required', 400)
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  const sortBy = searchParams.get('sortBy') || 'publish_date'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  let query = supabase
    .from('gbp_posts')
    .select('*, creator:users(id, full_name, avatar_url)', { count: 'exact' })
    .eq('location_id', locationId)

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
  const validated = GBPPostCreateSchema.parse(body)

  const postData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('gbp_posts')
    .insert(postData)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'gbp_posts', data.id, data)

  return formatCreatedResponse(data)
})
