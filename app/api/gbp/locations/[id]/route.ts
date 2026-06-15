export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GBPLocationCreateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/gbp/locations/[id]
 *
 * Fetches details of a single GBP location with computed stats.
 *
 * PATCH /api/gbp/locations/[id]
 *
 * Updates GBP location metadata.
 *
 * DELETE /api/gbp/locations/[id]
 *
 * Deletes a GBP location. Restricted to Admin.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  const { data: location, error: locError } = await supabase
    .from('gbp_locations')
    .select('*, creator:users(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (locError || !location) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Location not found', 404)
  }

  // Fetch stats for this specific location
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const [postsRes, reviewsRes] = await Promise.all([
    supabase.from('gbp_posts').select('id').eq('location_id', id).gte('publish_date', thirtyDaysAgoStr),
    supabase.from('gbp_reviews').select('rating, is_responded').eq('location_id', id),
  ])

  const postsCount = postsRes.data?.length || 0
  const reviews = reviewsRes.data || []

  const countWithRating = reviews.filter(r => r.rating !== null && r.rating !== undefined).length
  const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0)
  const avgRating = countWithRating > 0 ? Math.round((totalRating / countWithRating) * 10) / 10 : 0

  const unrespondedCount = reviews.filter(r => !r.is_responded).length

  return formatResponse({
    ...location,
    post_count_monthly: postsCount,
    avg_rating: avgRating,
    unresponded_reviews: unrespondedCount,
  })
})

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  // 1. Fetch old record for audit logging
  const { data: oldLocation, error: fetchError } = await supabase
    .from('gbp_locations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldLocation) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Location not found', 404)
  }

  // 2. Validate update data
  const body = await req.json()
  const validated = GBPLocationCreateSchema.partial().parse(body)

  // 3. Update location
  const { data: newLocation, error: updateError } = await supabase
    .from('gbp_locations')
    .update(validated)
    .eq('id', id)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit
  await logUpdate(user.id, 'gbp_locations', id, oldLocation, newLocation)

  return formatResponse(newLocation)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const authContext = await requireRole(['admin'])
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  // 1. Fetch old record for audit logging
  const { data: oldLocation, error: fetchError } = await supabase
    .from('gbp_locations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldLocation) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Location not found', 404)
  }

  // 2. Delete location (cascades to posts, reviews, metrics)
  const { error: deleteError } = await supabase
    .from('gbp_locations')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 3. Log audit
  await logDelete(authContext.user.id, 'gbp_locations', id, oldLocation)

  return formatDeletedResponse()
})
