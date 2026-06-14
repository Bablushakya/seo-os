export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import type { ActivityFeedItem } from '@/lib/types'

/**
 * Dashboard Activity API Endpoint
 * 
 * Fetches the 10 most recent actions from the audit log, joins with the users
 * table to get actor names, and formats them into human-readable activity feed items.
 * 
 * From DOC2 Section 7.2 and DOC5 DASH-001-03
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  // Fetch 10 most recent logs
  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      id,
      user_id,
      action,
      table_name,
      record_id,
      new_values,
      created_at,
      users (
        id,
        full_name,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    throw error
  }

  const logs = data ?? []

  // Format logs into human-readable ActivityFeedItem
  const activityItems: ActivityFeedItem[] = logs.map((log: any) => {
    const actorName = log.users?.full_name || 'System / Unknown'
    const tableName = log.table_name || 'general'
    const action = log.action // 'create' | 'update' | 'delete' | 'login' | 'export'
    const newValues = log.new_values || {}

    // Get a friendly record identifier
    let recordName = ''
    if (tableName === 'citations') {
      recordName = newValues.directory_name || 'Citation'
    } else if (tableName === 'outreach_prospects') {
      recordName = newValues.site_name || 'Prospect'
    } else if (tableName === 'guest_posts') {
      recordName = newValues.title || newValues.topic || 'Guest Post'
    } else if (tableName === 'tasks') {
      recordName = newValues.title || 'Task'
    } else if (tableName === 'pr_campaigns' || tableName === 'pr_placements') {
      recordName = newValues.title || newValues.placement_name || 'PR Link'
    } else if (tableName === 'gbp_locations' || tableName === 'gbp_posts') {
      recordName = newValues.name || newValues.title || 'GBP Update'
    } else {
      recordName = log.record_id || ''
    }

    // Format human-readable action description
    let actionDesc = ''
    if (action === 'login') {
      actionDesc = 'logged in'
    } else if (action === 'export') {
      actionDesc = `exported CSV data`
    } else {
      const pastTense = action === 'create' ? 'added' : action === 'update' ? 'updated' : 'deleted'
      const friendlyModule = getFriendlyModule(tableName)
      actionDesc = `${pastTense} a ${friendlyModule}`
    }

    return {
      id: log.id,
      user: {
        id: log.user_id || '',
        full_name: actorName,
        avatar_url: log.users?.avatar_url || null,
      },
      action: actionDesc,
      module: getFriendlyModuleLabel(tableName),
      record_name: recordName,
      created_at: log.created_at,
    }
  })

  return formatResponse(activityItems)
})

function getFriendlyModule(tableName: string): string {
  const map: Record<string, string> = {
    citations: 'citation',
    outreach_prospects: 'outreach prospect',
    outreach_notes: 'prospect note',
    guest_posts: 'guest post',
    competitors: 'competitor',
    competitor_backlinks: 'competitor backlink',
    pr_campaigns: 'PR campaign',
    pr_placements: 'PR placement',
    pr_contacts: 'PR contact',
    gbp_locations: 'GBP location',
    gbp_posts: 'GBP post',
    gbp_reviews: 'GBP review',
    tasks: 'task',
    reports: 'report',
    kpi_targets: 'KPI target',
  }
  return map[tableName] || tableName
}

function getFriendlyModuleLabel(tableName: string): string {
  const map: Record<string, string> = {
    citations: 'Citations',
    outreach_prospects: 'Outreach',
    outreach_notes: 'Outreach',
    guest_posts: 'Guest Posts',
    competitors: 'Competitors',
    competitor_backlinks: 'Competitors',
    pr_campaigns: 'Digital PR',
    pr_placements: 'Digital PR',
    pr_contacts: 'Digital PR',
    gbp_locations: 'GBP',
    gbp_posts: 'GBP',
    gbp_reviews: 'GBP',
    tasks: 'Tasks',
    reports: 'Reports',
    'auth.users': 'System',
    general: 'System',
  }
  return map[tableName] || 'System'
}
