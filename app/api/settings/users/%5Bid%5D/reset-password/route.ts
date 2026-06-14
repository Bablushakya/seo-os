export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import { Errors } from '@/lib/errors'

/**
 * POST /api/settings/users/[id]/reset-password
 * 
 * Sends a password reset email via Supabase Auth. Restricted to Admin.
 */
export const POST = withErrorHandler(async (req: Request, { params }: { params: Record<string, string> }) => {
  const { user: currentUser } = await requireRole(['admin'])
  const supabase = await createClient()

  // Retrieve user email
  const { data: targetUser, error: findError } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', params.id)
    .single()

  if (findError || !targetUser) {
    throw Errors.notFound('User')
  }

  // Send password reset email
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetUser.email, {
    redirectTo: `${siteUrl}/reset-password`,
  })

  if (resetError) {
    throw resetError
  }

  // Audit log event
  await logAuditEvent({
    userId: currentUser.id,
    action: 'update',
    tableName: 'users',
    recordId: params.id,
    newValues: { action: 'password_reset_sent', email: targetUser.email, name: targetUser.full_name },
  })

  return formatResponse({ success: true, message: `Password reset email sent to ${targetUser.email}.` })
})
