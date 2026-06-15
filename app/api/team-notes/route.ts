export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { TeamNoteCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/team-notes
 *
 * Lists all sticky notes, pinned first, then by creation date descending.
 * All authenticated users can read all notes.
 *
 * POST /api/team-notes
 *
 * Creates a new sticky note. Any authenticated user can post.
 */

export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  const { data: notes, error } = await supabase
    .from('team_notes')
    .select('*, author:users!team_notes_created_by_fkey(id, full_name, avatar_url)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return formatResponse(notes || [])
})

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const { content, color, is_pinned } = TeamNoteCreateSchema.parse(body)

  const { data: note, error } = await supabase
    .from('team_notes')
    .insert({
      content,
      color,
      is_pinned: is_pinned || false,
      created_by: user.id,
    })
    .select('*, author:users!team_notes_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (error) throw error

  await logCreate(user.id, 'team_notes', note.id, note)

  return formatCreatedResponse(note)
})
