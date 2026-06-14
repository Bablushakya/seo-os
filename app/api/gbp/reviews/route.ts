export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GBPReviewCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/gbp/reviews
 * 
 * Lists GBP reviews for a location. Supports filtering by is_responded.
 * 
 * POST /api/gbp/reviews
 * 
 * Logs a new GBP review.
 */

export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('location_id') || ''
  const isRespondedParam = searchParams.get('is_responded')

  if (!locationId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'location_id is required', 400)
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  const sortBy = searchParams.get('sortBy') || 'review_date'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  let query = supabase
    .from('gbp_reviews')
    .select('*, responder:users(id, full_name)', { count: 'exact' })
    .eq('location_id', locationId)

  // Filter by is_responded
  if (isRespondedParam !== null && isRespondedParam !== undefined && isRespondedParam !== '') {
    const isResponded = isRespondedParam === 'true'
    query = query.eq('is_responded', isResponded)
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
  const validated = GBPReviewCreateSchema.parse(body)

  const reviewData = {
    ...validated,
    // Note: reviewer reviews are logged manually or synced. 
    // They are not directly "created_by" a user (the user logs them).
    // The table does not have a created_by field for reviews.
    // It does have responded_by which we will set during response PATCH.
  }

  const { data, error } = await supabase
    .from('gbp_reviews')
    .insert(reviewData)
    .select('*, responder:users(id, full_name)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'gbp_reviews', data.id, data)

  return formatCreatedResponse(data)
})
