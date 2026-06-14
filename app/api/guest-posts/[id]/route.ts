export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GuestPostUpdateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/guest-posts/[id]
 * 
 * Fetches a single guest post.
 * 
 * PATCH /api/guest-posts/[id]
 * 
 * Updates a guest post.
 * 
 * DELETE /api/guest-posts/[id]
 * 
 * Deletes a guest post. Restricted to Admin.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('guest_posts')
    .select('*, prospect:outreach_prospects!guest_posts_linked_prospect_fkey(id, site_name, url, niche), creator:users!guest_posts_created_by_fkey(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Guest post not found', 404)
  }

  // Fetch users to map author details
  const { data: authorUser } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('id', data.author || '')
    .single()

  return formatResponse({
    ...data,
    author_user: authorUser || null
  })
})

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old record for audit logging
  const { data: oldPost, error: fetchError } = await supabase
    .from('guest_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldPost) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Guest post not found', 404)
  }

  // 2. Validate body
  const body = await req.json()
  const validated = GuestPostUpdateSchema.parse(body)

  // 3. Perform update
  const { data: newPost, error: updateError } = await supabase
    .from('guest_posts')
    .update(validated)
    .eq('id', id)
    .select('*, prospect:outreach_prospects!guest_posts_linked_prospect_fkey(id, site_name, url, niche), creator:users!guest_posts_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit event
  await logUpdate(user.id, 'guest_posts', id, oldPost, newPost)

  return formatResponse(newPost)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  // Restricted to Admin role
  const { user } = await requireRole(['admin'])
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old record for logging
  const { data: oldPost, error: fetchError } = await supabase
    .from('guest_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldPost) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Guest post not found', 404)
  }

  // 2. Delete
  const { error: deleteError } = await supabase
    .from('guest_posts')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 3. Log audit event
  await logDelete(user.id, 'guest_posts', id, oldPost)

  return formatDeletedResponse()
})
