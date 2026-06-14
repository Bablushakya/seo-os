export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GBPLocationCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/gbp/locations
 * 
 * Lists all Google Business Profile (GBP) locations.
 * Computes average review rating, monthly post count, and unresponded reviews in-memory.
 * 
 * POST /api/gbp/locations
 * 
 * Tracks a new GBP location. Restricted to Admin and Data Specialist.
 */

export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  // 1. Fetch locations
  const { data: locations, error: locError } = await supabase
    .from('gbp_locations')
    .select('*, creator:users(id, full_name, avatar_url)')
    .order('business_name', { ascending: true })

  if (locError) {
    throw locError
  }

  if (!locations || locations.length === 0) {
    return formatResponse([])
  }

  // 2. Fetch posts brief info to count posts in the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: posts, error: postsError } = await supabase
    .from('gbp_posts')
    .select('location_id, publish_date')
    .gte('publish_date', thirtyDaysAgoStr)

  if (postsError) {
    throw postsError
  }

  // 3. Fetch reviews brief info to calculate average rating and unresponded counts
  const { data: reviews, error: reviewsError } = await supabase
    .from('gbp_reviews')
    .select('location_id, rating, is_responded')

  if (reviewsError) {
    throw reviewsError
  }

  // 4. Map stats in-memory
  const postsMap = new Map<string, number>()
  posts?.forEach(p => {
    const curr = postsMap.get(p.location_id) || 0
    postsMap.set(p.location_id, curr + 1)
  })

  const reviewsMap = new Map<string, { totalRating: number; countWithRating: number; unrespondedCount: number }>()
  reviews?.forEach(r => {
    const curr = reviewsMap.get(r.location_id) || { totalRating: 0, countWithRating: 0, unrespondedCount: 0 }
    
    if (r.rating !== null && r.rating !== undefined) {
      curr.totalRating += r.rating
      curr.countWithRating++
    }
    
    if (!r.is_responded) {
      curr.unrespondedCount++
    }
    
    reviewsMap.set(r.location_id, curr)
  })

  // 5. Build response list
  const list = locations.map(loc => {
    const postCount = postsMap.get(loc.id) || 0
    const reviewStats = reviewsMap.get(loc.id) || { totalRating: 0, countWithRating: 0, unrespondedCount: 0 }
    
    const avgRating = reviewStats.countWithRating > 0
      ? Math.round((reviewStats.totalRating / reviewStats.countWithRating) * 10) / 10
      : 0

    return {
      ...loc,
      post_count_monthly: postCount,
      avg_rating: avgRating,
      unresponded_reviews: reviewStats.unrespondedCount,
    }
  })

  return formatResponse(list)
})

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireRole(['admin', 'data_specialist'])
  const supabase = await createClient()

  const body = await req.json()
  const validated = GBPLocationCreateSchema.parse(body)

  const locationData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('gbp_locations')
    .insert(locationData)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'gbp_locations', data.id, data)

  return formatCreatedResponse({
    ...data,
    post_count_monthly: 0,
    avg_rating: 0,
    unresponded_reviews: 0,
  })
})
