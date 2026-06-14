export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { CompetitorCreateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/competitors/[id]
 * 
 * Fetches a single competitor domain detail.
 * 
 * PATCH /api/competitors/[id]
 * 
 * Updates a competitor domain detail.
 * 
 * DELETE /api/competitors/[id]
 * 
 * Deletes a competitor domain (restricted to Admin).
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('competitors')
    .select('*, creator:users!competitors_created_by_fkey(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Competitor not found', 404)
  }

  // Also query counts
  const { data: backlinks, error: countError } = await supabase
    .from('competitor_backlinks')
    .select('is_gap, tagged_for_outreach')
    .eq('competitor_id', id)

  let backlinkCount = 0
  let gapCount = 0
  let taggedCount = 0

  if (!countError && backlinks) {
    backlinkCount = backlinks.length
    backlinks.forEach((b) => {
      if (b.is_gap) gapCount++
      if (b.tagged_for_outreach) taggedCount++
    })
  }

  return formatResponse({
    ...data,
    backlink_count: backlinkCount,
    gap_count: gapCount,
    tagged_count: taggedCount,
  })
})

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const authContext = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old record
  const { data: oldCompetitor, error: fetchError } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldCompetitor) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Competitor not found', 404)
  }

  // 2. Validate inputs
  const body = await req.json()
  const validated = CompetitorCreateSchema.partial().parse(body)

  if (validated.domain) {
    validated.domain = validated.domain.toLowerCase().trim()
  }

  // 3. Update
  const { data: newCompetitor, error: updateError } = await supabase
    .from('competitors')
    .update(validated)
    .eq('id', id)
    .select('*, creator:users!competitors_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit event
  await logUpdate(authContext.user.id, 'competitors', id, oldCompetitor, newCompetitor)

  return formatResponse(newCompetitor)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireRole(['admin'])
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old record for audit logging
  const { data: oldCompetitor, error: fetchError } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldCompetitor) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Competitor not found', 404)
  }

  // 2. Delete
  const { error: deleteError } = await supabase
    .from('competitors')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 3. Log audit event
  await logDelete(user.id, 'competitors', id, oldCompetitor)

  return formatDeletedResponse()
})
