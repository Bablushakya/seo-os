import { createClient } from '@/lib/supabase/server'
import { AppError, ErrorCode } from '@/lib/errors'
import type { User, UserRole } from '@/lib/types'

// ============================================================
// TYPES
// ============================================================

export interface AuthContext {
  user: {
    id: string
    email: string
  }
  profile: User
}

// ============================================================
// AUTH CHECK
// ============================================================

/**
 * Verify that the request has a valid Supabase session.
 *
 * Returns the authenticated Supabase user and their public.users profile.
 * Throws AppError(UNAUTHORIZED) if no session exists.
 * Throws AppError(FORBIDDEN) if user is not in public.users (not pre-approved).
 *
 * From DOC3 Section 5.1 — API-Level Authorization
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      'Authentication required. Please sign in.',
      401,
    )
  }

  // Verify the user exists in our pre-approved public.users table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Your account is not authorized to access this system.',
      403,
    )
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? '',
    },
    profile: profile as User,
  }
}

// ============================================================
// ROLE CHECK
// ============================================================

/**
 * Verify that the request has a valid session AND the user's role
 * is in the allowedRoles list.
 *
 * Throws AppError(UNAUTHORIZED) if not authenticated.
 * Throws AppError(FORBIDDEN) if role is insufficient.
 *
 * From DOC3 Section 5.1 — API-Level Authorization
 *
 * @example
 * // Admin-only route
 * export const DELETE = withErrorHandler(async (req) => {
 *   const { profile } = await requireRole(['admin'])
 *   // ...
 * })
 *
 * @example
 * // Admin or SEO Specialist
 * const { profile } = await requireRole(['admin', 'seo_specialist'])
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthContext> {
  const context = await requireAuth()

  if (!allowedRoles.includes(context.profile.role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      403,
    )
  }

  return context
}

// ============================================================
// OWNERSHIP CHECK
// ============================================================

/**
 * Verify that the current user owns a record, OR is an admin.
 *
 * Admins can access any record.
 * Non-admins can only access records they created (created_by === user.id).
 *
 * @param context — auth context from requireAuth()
 * @param recordCreatedBy — the created_by field of the record being accessed
 */
export function requireOwnerOrAdmin(
  context: AuthContext,
  recordCreatedBy: string | null,
): void {
  const isAdmin = context.profile.role === 'admin'
  const isOwner = recordCreatedBy === context.user.id

  if (!isAdmin && !isOwner) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'You can only modify records you created.',
      403,
    )
  }
}

// ============================================================
// HELPER CHECKS (boolean — do not throw)
// ============================================================

/** Returns true if the user is an admin */
export function isAdmin(profile: User): boolean {
  return profile.role === 'admin'
}

/** Returns true if the user has any of the given roles */
export function hasRole(profile: User, roles: UserRole[]): boolean {
  return roles.includes(profile.role)
}
