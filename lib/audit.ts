import { createAdminClient } from '@/lib/supabase/server'
import type { AuditAction } from '@/lib/types'

// ============================================================
// AUDIT EVENT TYPE
// ============================================================

export interface AuditEvent {
  userId: string
  action: AuditAction
  tableName?: string
  recordId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
}

// ============================================================
// AUDIT LOG FUNCTION
// ============================================================

/**
 * Log a business event to the audit_log table.
 *
 * Uses the service role client to bypass RLS — the audit log MUST be
 * writable regardless of the current user's RLS policies.
 *
 * This function is intentionally NON-BLOCKING — a failure to write the
 * audit log does NOT throw to the caller. This ensures audit logging
 * never breaks the main application flow.
 *
 * From DOC2 Section 13.2 and DOC5 PROJ-001-12
 *
 * @example
 * await logAuditEvent({
 *   userId: user.id,
 *   action: 'create',
 *   tableName: 'citations',
 *   recordId: newCitation.id,
 *   newValues: newCitation,
 * })
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase.from('audit_log').insert({
      user_id: event.userId,
      action: event.action,
      table_name: event.tableName ?? null,
      record_id: event.recordId ?? null,
      old_values: event.oldValues ?? null,
      new_values: event.newValues ?? null,
    })

    if (error) {
      // Log to server console (Vercel logs) but do NOT throw
      console.error('[AuditLog] Failed to write audit event:', {
        error: error.message,
        event: {
          userId: event.userId,
          action: event.action,
          tableName: event.tableName,
          recordId: event.recordId,
        },
      })
    }
  } catch (err) {
    // Non-blocking — catch all errors silently
    console.error('[AuditLog] Unexpected error in logAuditEvent:', err)
  }
}

// ============================================================
// CONVENIENCE WRAPPERS
// ============================================================

/** Log a record creation event */
export async function logCreate(
  userId: string,
  tableName: string,
  recordId: string,
  newValues: Record<string, unknown>,
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'create',
    tableName,
    recordId,
    newValues,
  })
}

/** Log a record update event */
export async function logUpdate(
  userId: string,
  tableName: string,
  recordId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'update',
    tableName,
    recordId,
    oldValues,
    newValues,
  })
}

/** Log a record deletion event */
export async function logDelete(
  userId: string,
  tableName: string,
  recordId: string,
  oldValues: Record<string, unknown>,
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'delete',
    tableName,
    recordId,
    oldValues,
  })
}

/** Log a user login event */
export async function logLogin(userId: string): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'login',
    tableName: 'auth.users',
    recordId: userId,
  })
}

/** Log a CSV export event */
export async function logExport(
  userId: string,
  tableName: string,
  recordCount?: number,
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'export',
    tableName,
    newValues: recordCount !== undefined ? { record_count: recordCount } : undefined,
  })
}
