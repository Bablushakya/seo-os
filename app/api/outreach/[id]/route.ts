export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { OutreachProspectUpdateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/outreach/[id]
 * 
 * Fetches a single outreach prospect.
 * 
 * PATCH /api/outreach/[id]
 * 
 * Updates a prospect. Auto-inserts an audit note in outreach_notes on stage changes.
 * 
 * DELETE /api/outreach/[id]
 * 
 * Deletes a prospect. Restricted to Admin.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('outreach_prospects')
    .select('*, assignee:users!outreach_prospects_assigned_to_fkey(id, full_name, avatar_url), creator:users!outreach_prospects_created_by_fkey(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Prospect not found', 404)
  }

  return formatResponse(data)
})

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const authContext = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old prospect for comparison & audit logging
  const { data: oldProspect, error: fetchError } = await supabase
    .from('outreach_prospects')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldProspect) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Prospect not found', 404)
  }

  // 2. Validate update fields
  const body = await req.json()
  const validated = OutreachProspectUpdateSchema.parse(body)

  // 3. Update prospect
  const { data: newProspect, error: updateError } = await supabase
    .from('outreach_prospects')
    .update(validated)
    .eq('id', id)
    .select('*, assignee:users!outreach_prospects_assigned_to_fkey(id, full_name, avatar_url), creator:users!outreach_prospects_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Trigger auto-note on stage transitions (OUT-001-05)
  if (validated.pipeline_stage && validated.pipeline_stage !== oldProspect.pipeline_stage) {
    const stageLabels: Record<string, string> = {
      identified: 'Identified',
      contacted: 'Contacted',
      followed_up: 'Followed Up',
      negotiating: 'Negotiating',
      placed: 'Placed',
      rejected: 'Rejected'
    }
    const newStageName = stageLabels[validated.pipeline_stage] || validated.pipeline_stage
    const userName = authContext.profile.full_name

    // Insert note
    await supabase.from('outreach_notes').insert({
      prospect_id: id,
      content: `Stage updated to ${newStageName} by ${userName}`,
      note_type: 'general',
      created_by: authContext.user.id,
    })
  }

  // 5. Log audit event
  await logUpdate(authContext.user.id, 'outreach_prospects', id, oldProspect, newProspect)

  return formatResponse(newProspect)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  // Restricted to Admin role
  const { user } = await requireRole(['admin'])
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // Fetch old record for audit logging
  const { data: oldProspect, error: fetchError } = await supabase
    .from('outreach_prospects')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldProspect) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Prospect not found', 404)
  }

  const { error: deleteError } = await supabase
    .from('outreach_prospects')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // Log deletion
  await logDelete(user.id, 'outreach_prospects', id, oldProspect)

  return formatDeletedResponse()
})
