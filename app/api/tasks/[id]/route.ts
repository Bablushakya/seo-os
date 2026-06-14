export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth, requireOwnerOrAdmin } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { TaskUpdateSchema } from '@/lib/utils/validation'
import { logUpdate, logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/tasks/[id]
 * 
 * Fetches a single task.
 * 
 * PATCH /api/tasks/[id]
 * 
 * Updates a task and logs audit trail.
 * 
 * DELETE /api/tasks/[id]
 * 
 * Deletes a task. Restricted to task creator or admin.
 */

export const GET = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  const { data, error } = await supabase
    .from('tasks')
    .select('*, assignee_user:users!tasks_assignee_fkey(id, full_name, avatar_url), creator:users!tasks_created_by_fkey(id, full_name, avatar_url)')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Task not found', 404)
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

  // 1. Get old values for logging
  const { data: oldTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldTask) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Task not found', 404)
  }

  // 2. Validate request body
  const body = await req.json()
  const validated = TaskUpdateSchema.parse(body)

  // 3. Update task
  const { data: newTask, error: updateError } = await supabase
    .from('tasks')
    .update(validated)
    .eq('id', id)
    .select('*, assignee_user:users!tasks_assignee_fkey(id, full_name, avatar_url), creator:users!tasks_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (updateError) {
    throw updateError
  }

  // 4. Log audit event
  await logUpdate(user.id, 'tasks', id, oldTask, newTask)

  return formatResponse(newTask)
})

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const authContext = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Fetch old task to check ownership and log deletion
  const { data: oldTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldTask) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Task not found', 404)
  }

  // 2. Check admin or creator ownership
  requireOwnerOrAdmin(authContext, oldTask.created_by)

  // 3. Delete
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (deleteError) {
    throw deleteError
  }

  // 4. Log deletion audit event
  await logDelete(authContext.user.id, 'tasks', id, oldTask)

  return formatDeletedResponse()
})
