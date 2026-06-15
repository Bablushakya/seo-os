export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { TeamNoteUpdateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * PATCH /api/team-notes/[id]
 *
 * Updates a sticky note (content, color, is_pinned).
 * Only the creator or admin can update.
 *
 * DELETE /api/team-notes/[id]
 *
 * Deletes a sticky note.
 * Only the creator or admin can delete.
 */

export const PATCH = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const { user, profile } = await requireAuth()
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  // Fetch existing note
  const { data: oldNote, error: fetchError } = await supabase
    .from('team_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldNote) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Note not found', 404)
  }

  // Auth check
  if (oldNote.created_by !== user.id && profile.role !== 'admin') {
    throw new AppError(ErrorCode.FORBIDDEN, 'You can only edit your own notes', 403)
  }

  const body = await req.json()
  const updates = TeamNoteUpdateSchema.parse(body)

  const { data: updatedNote, error: updateError } = await supabase
    .from('team_notes')
    .update(updates)
    .eq('id', id)
    .select('*, author:users!team_notes_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (updateError) throw updateError

  await logUpdate(user.id, 'team_notes', id, oldNote, updatedNote)

  return formatResponse(updatedNote)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const { user, profile } = await requireAuth()
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  // Fetch existing note
  const { data: note, error: fetchError } = await supabase
    .from('team_notes')
    .select('id, created_by, content')
    .eq('id', id)
    .single()

  if (fetchError || !note) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Note not found', 404)
  }

  // Auth check
  if (note.created_by !== user.id && profile.role !== 'admin') {
    throw new AppError(ErrorCode.FORBIDDEN, 'You can only delete your own notes', 403)
  }

  const { error: deleteError } = await supabase
    .from('team_notes')
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError

  await logDelete(user.id, 'team_notes', id, note)

  return formatDeletedResponse()
})
