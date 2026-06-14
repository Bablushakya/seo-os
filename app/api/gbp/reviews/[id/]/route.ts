export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GBPReviewCreateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * PATCH /api/gbp/reviews/[id]
 * 
 * Submits or updates a response to a customer review.
 * Automatically tracks is_responded = true, responded_by, and response_date.
 * 
 * DELETE /api/gbp/reviews/[id]
 * 
 * Deletes a review log. Restricted to Admin.
 */

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old record for audit logging
  const { data: oldReview, error: fetchError } = await supabase
    .from('gbp_reviews')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldReview) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Review not found', 404)
  }

  // 2. Validate update data
  const body = await req.json()
  const validated = GBPReviewCreateSchema.partial().parse(body)

  // 3. Prepare response data
  const responseData: Record<string, any> = {
    ...validated,
  }

  // If responding now, automatically set metadata
  if (body.response_text !== undefined) {
    if (body.response_text) {
      responseData.is_responded = true
      responseData.responded_by = user.id
      responseData.response_date = new Date().toISOString().split('T')[0]
    } else {
      // Clear response
      responseData.is_responded = false
      responseData.responded_by = null
      responseData.response_date = null
    }
  }

  // 4. Update review
  const { data: newReview, error: updateError } = await supabase
    .from('gbp_reviews')
    .update(responseData)
    .eq('id', id)
    .select('*, responder:users(id, full_name)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 5. Log audit log
  await logUpdate(user.id, 'gbp_reviews', id, oldReview, newReview)

  return formatResponse(newReview)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const authContext = await requireRole(['admin'])
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old record for audit logging
  const { data: oldReview, error: fetchError } = await supabase
    .from('gbp_reviews')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldReview) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Review not found', 404)
  }

  // 2. Delete review
  const { error: deleteError } = await supabase
    .from('gbp_reviews')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 3. Log audit event
  await logDelete(authContext.user.id, 'gbp_reviews', id, oldReview)

  return formatDeletedResponse()
})
