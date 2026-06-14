export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { OutreachNoteCreateSchema } from '@/lib/utils/validation'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/outreach/[id]/notes
 * 
 * Fetches all interaction notes for a prospect, sorted by created_at DESC.
 * 
 * POST /api/outreach/[id]/notes
 * 
 * Creates a new note for a prospect.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('outreach_notes')
    .select('*, creator:users!outreach_notes_created_by_fkey(id, full_name, avatar_url)')
    .eq('prospect_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return formatResponse(data || [])
})

export const POST = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const body = await req.json()
  
  // Attach prospect_id to validation payload
  const validated = OutreachNoteCreateSchema.parse({
    ...body,
    prospect_id: id,
  })

  const noteData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('outreach_notes')
    .insert(noteData)
    .select('*, creator:users!outreach_notes_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  return formatCreatedResponse(data)
})
