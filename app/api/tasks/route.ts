export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { TaskCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/tasks
 * 
 * Fetches a list of tasks with filters: assignee, status, priority,
 * module_type, due_date range, and overdue flag.
 * 
 * POST /api/tasks
 * 
 * Creates a new task.
 */

export const GET = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const assigneeParam = searchParams.get('assignee') || ''
  const statusParam = searchParams.get('status') || ''
  const priorityParam = searchParams.get('priority') || ''
  const moduleType = searchParams.get('module_type') || ''
  const dueDateFrom = searchParams.get('due_date_from') || ''
  const dueDateTo = searchParams.get('due_date_to') || ''
  const overdueParam = searchParams.get('overdue') === 'true'

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
  const sortBy = searchParams.get('sortBy') || 'due_date'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  // Build query
  // Joining assignee profile (users table) and creator profile
  let query = supabase
    .from('tasks')
    .select('*, assignee_user:users!tasks_assignee_fkey(id, full_name, avatar_url), creator:users!tasks_created_by_fkey(id, full_name, avatar_url)', { count: 'exact' })

  // Assignee filter: shorthand 'me' resolves to current user
  if (assigneeParam) {
    const targetAssigneeId = assigneeParam === 'me' ? user.id : assigneeParam
    query = query.eq('assignee', targetAssigneeId)
  }

  // Status filter (comma-separated support)
  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
  }

  // Priority filter (comma-separated support)
  if (priorityParam) {
    const priorities = priorityParam.split(',').map(s => s.trim()).filter(Boolean)
    if (priorities.length > 0) {
      query = query.in('priority', priorities)
    }
  }

  // Module type filter
  if (moduleType) {
    query = query.eq('module_type', moduleType)
  }

  // Due date range filters
  if (dueDateFrom) {
    query = query.gte('due_date', dueDateFrom)
  }
  if (dueDateTo) {
    query = query.lte('due_date', dueDateTo)
  }

  // Overdue filter: due_date < today AND status != 'done'
  if (overdueParam) {
    const todayStr = new Date().toISOString().split('T')[0] || ''
    query = query.lt('due_date', todayStr).neq('status', 'done')
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  // Pagination range
  const offset = (page - 1) * limit
  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return formatPaginatedResponse(data || [], {
    total,
    page,
    limit,
    total_pages: totalPages,
  })
})

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const validated = TaskCreateSchema.parse(body)

  const taskData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select('*, assignee_user:users!tasks_assignee_fkey(id, full_name, avatar_url), creator:users!tasks_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'tasks', data.id, data)

  // (Optional n8n webhook triggers will run in background/Phase 11)

  return formatCreatedResponse(data)
})
