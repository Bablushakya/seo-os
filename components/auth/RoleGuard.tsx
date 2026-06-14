'use client'

import React from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import type { UserRole } from '@/lib/types'

// ============================================================
// PROPS
// ============================================================

interface RoleGuardProps {
  /** The roles that are permitted to see the children */
  allowedRoles: UserRole[]
  /** Content to render when the user has the required role */
  children: React.ReactNode
  /**
   * Content to render when the user does NOT have the required role.
   * Defaults to null (renders nothing).
   */
  fallback?: React.ReactNode
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * Client-side role guard component.
 *
 * Renders `children` only if the current user's role is in `allowedRoles`.
 * Otherwise renders `fallback` (default: null).
 *
 * ⚠️ SECURITY NOTE: This is a UX convenience only.
 * All security enforcement MUST also be at the API and database (RLS) layers.
 * Never rely on this component alone to protect sensitive operations.
 *
 * From DOC3 Section 5.2 — Frontend Authorization
 *
 * @example
 * // Show delete button only to admins
 * <RoleGuard allowedRoles={['admin']}>
 *   <DeleteButton />
 * </RoleGuard>
 *
 * @example
 * // Show a read-only message to non-admins
 * <RoleGuard
 *   allowedRoles={['admin']}
 *   fallback={<span className="text-muted-foreground text-sm">Admin only</span>}
 * >
 *   <AdminSettings />
 * </RoleGuard>
 */
export function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { user, isLoading } = useAuth()

  // While auth is loading, render nothing to avoid flash
  if (isLoading) return null

  // Not authenticated
  if (!user) return <>{fallback}</>

  // Role check
  if (!allowedRoles.includes(user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// ============================================================
// CONVENIENCE WRAPPERS
// ============================================================

/** Renders children only for Admin (Bharat) */
export function AdminOnly({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={['admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

/** Renders children for Admin or SEO Specialist (Bablu) */
export function SEOAndAdminOnly({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={['admin', 'seo_specialist']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

/** Renders children for Admin or Data Specialist (Rahul) */
export function DataAndAdminOnly({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={['admin', 'data_specialist']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}
