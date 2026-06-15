export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { PRPlacementCreateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/digital-pr/placements/[id]
 * PATCH /api/digital-pr/placements/[id]
 * DELETE /api/digital-pr/placements/[id]
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  const { data, error } = await supabase
    .from('pr_placements')
    .select('*, campaign:pr_campaigns(id, campaign_name)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Placement not found', 404)
  }

  return formatResponse(data)
})

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  const { data: oldPlacement, error: fetchError } = await supabase
    .from('pr_placements')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldPlacement) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Placement not found', 404)
  }

  const body = await req.json()
  const validated = PRPlacementCreateSchema.partial().parse(body)

  const { data: newPlacement, error: updateError } = await supabase
    .from('pr_placements')
    .update(validated)
    .eq('id', id)
    .select('*, campaign:pr_campaigns(id, campaign_name)')
    .single()

  if (updateError) throw updateError

  await logUpdate(user.id, 'pr_placements', id, oldPlacement, newPlacement)

  return formatResponse(newPlacement)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const authContext = await requireRole(['admin'])
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  const { data: oldPlacement, error: fetchError } = await supabase
    .from('pr_placements')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldPlacement) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Placement not found', 404)
  }

  const { error: deleteError } = await supabase
    .from('pr_placements')
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError

  await logDelete(authContext.user.id, 'pr_placements', id, oldPlacement)

  return formatDeletedResponse()
})
