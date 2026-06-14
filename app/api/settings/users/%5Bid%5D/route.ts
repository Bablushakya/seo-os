export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logUpdate } from '@/lib/audit'
import { Errors, AppError, ErrorCode } from '@/lib/errors'

/**
 * PATCH /api/settings/users/[id]
 * 
 * Updates user full name and role. Restricted to Admin.
 * Prevents admins from updating their own roles.
 */
export const PATCH = withErrorHandler(async (req: Request, { params }: { params: Record<string, string> }) => {
  const { user: currentUser } = await requireRole(['admin'])
  const supabase = await createClient()

  const id = params.id
  if (!id) {
    throw Errors.validation('User ID is required')
  }

  const body = await req.json()
  const { full_name, role } = body

  // Validate inputs
  if (role && !['admin', 'seo_specialist', 'data_specialist'].includes(role)) {
    throw Errors.validation('Invalid role. Must be admin, seo_specialist, or data_specialist.')
  }

  if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim().length < 2)) {
    throw Errors.validation('Full name must be at least 2 characters long.')
  }

  // Prevent admin from changing their own role
  if (currentUser.id === id && role && role !== 'admin') {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Admins cannot modify their own role to prevent lock-out.',
      403
    )
  }

  // Fetch current user details for audit log before update
  const { data: oldUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (!oldUser) {
    throw Errors.notFound('User')
  }

  // Prepare updates
  const updateData: Record<string, any> = {}
  if (full_name !== undefined) updateData.full_name = full_name.trim()
  if (role !== undefined) updateData.role = role

  const { data: updatedUser, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logUpdate(currentUser.id, 'users', id, oldUser, updatedUser)

  return formatResponse(updatedUser)
})
