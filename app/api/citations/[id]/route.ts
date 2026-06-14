export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { CitationUpdateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/citations/[id]
 * 
 * Fetches a single citation.
 * 
 * PATCH /api/citations/[id]
 * 
 * Updates a citation and logs the event.
 * 
 * DELETE /api/citations/[id]
 * 
 * Deletes a citation and logs the event. Restricted to creator or admin.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('citations')
    .select('*, creator:users(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Citation not found', 404)
  }

  return formatResponse(data)
})

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Get old record for audit logging
  const { data: oldCitation, error: fetchError } = await supabase
    .from('citations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldCitation) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Citation not found', 404)
  }

  // 2. Validate update body
  const body = await req.json()
  const validated = CitationUpdateSchema.parse(body)

  // 3. Perform update
  const { data: newCitation, error: updateError } = await supabase
    .from('citations')
    .update(validated)
    .eq('id', id)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit event
  await logUpdate(user.id, 'citations', id, oldCitation, newCitation)

  return formatResponse(newCitation)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireRole(['admin'])
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Get old record to verify ownership and log
  const { data: oldCitation, error: fetchError } = await supabase
    .from('citations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldCitation) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Citation not found', 404)
  }

  // 2. Verification check handled by requireRole(['admin']) above

  // 3. Delete
  const { error: deleteError } = await supabase
    .from('citations')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 4. Log audit event
  await logDelete(user.id, 'citations', id, oldCitation)

  return formatDeletedResponse()
})
