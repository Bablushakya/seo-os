export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { PRContactCreateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/digital-pr/contacts/[id]
 * 
 * Fetches details of a single media contact.
 * 
 * PATCH /api/digital-pr/contacts/[id]
 * 
 * Updates a media contact's details.
 * 
 * DELETE /api/digital-pr/contacts/[id]
 * 
 * Deletes a media contact. Restricted to Admin.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('pr_contacts')
    .select('*, creator:users(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Contact not found', 404)
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

  // 1. Fetch old record for audit logging
  const { data: oldContact, error: fetchError } = await supabase
    .from('pr_contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldContact) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Contact not found', 404)
  }

  // 2. Validate update fields
  const body = await req.json()
  const validated = PRContactCreateSchema.partial().parse(body)

  // 3. Update contact
  const { data: newContact, error: updateError } = await supabase
    .from('pr_contacts')
    .update(validated)
    .eq('id', id)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit log
  await logUpdate(user.id, 'pr_contacts', id, oldContact, newContact)

  return formatResponse(newContact)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const authContext = await requireRole(['admin'])
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old record for audit logging
  const { data: oldContact, error: fetchError } = await supabase
    .from('pr_contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldContact) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Contact not found', 404)
  }

  // 2. Delete contact
  const { error: deleteError } = await supabase
    .from('pr_contacts')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 3. Log audit event
  await logDelete(authContext.user.id, 'pr_contacts', id, oldContact)

  return formatDeletedResponse()
})
