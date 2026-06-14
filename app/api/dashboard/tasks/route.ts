export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logUpdate } from '@/lib/audit'

/**
 * Dashboard Tasks API Endpoint
 * 
 * GET: Fetches tasks assigned to the authenticated user that are not completed,
 * sorted by due date ascending.
 * 
 * PATCH: Marks a task as done. Logs an audit event.
 * 
 * From DOC5 DASH-001-07
 */
export const GET = withErrorHandler(async () => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assignee', user.id)
    .neq('status', 'done')
    .order('due_date', { ascending: true })

  if (error) {
    throw error
  }

  return formatResponse(data ?? [])
})

export const PATCH = withErrorHandler(async (req) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const { taskId, status } = body

  if (!taskId || !status) {
    return new Response(JSON.stringify({ success: false, error: 'Missing taskId or status' }), { status: 400 })
  }

  // Fetch the old task first for the audit log
  const { data: oldTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single()

  if (fetchError || !oldTask) {
    return new Response(JSON.stringify({ success: false, error: 'Task not found' }), { status: 404 })
  }

  // Perform update
  const { data: newTask, error: updateError } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .select()
    .single()

  if (updateError) {
    throw updateError
  }

  // Log audit event
  await logUpdate(user.id, 'tasks', taskId, oldTask, newTask)

  return formatResponse(newTask)
})
