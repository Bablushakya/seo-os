export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/outreach/stats
 * 
 * Returns metrics and breakdown for the outreach pipeline: active count,
 * stage counts, follow-ups due today, and placement conversion rate.
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  // Fetch all prospects needed for stats
  const { data: prospects, error } = await supabase
    .from('outreach_prospects')
    .select('pipeline_stage, next_followup_date')

  if (error) {
    throw error
  }

  const list = prospects || []
  const total = list.length

  const stageBreakdown = {
    identified: 0,
    contacted: 0,
    followed_up: 0,
    negotiating: 0,
    placed: 0,
    rejected: 0,
  }

  list.forEach(p => {
    if (p && p.pipeline_stage && p.pipeline_stage in stageBreakdown) {
      stageBreakdown[p.pipeline_stage as keyof typeof stageBreakdown]++
    }
  })

  const activeCount = stageBreakdown.identified + stageBreakdown.contacted + stageBreakdown.followed_up + stageBreakdown.negotiating
  const placedCount = stageBreakdown.placed
  
  // Conversion rate (identified -> placed) as % of total
  const conversionRate = total > 0 ? Math.round((placedCount / total) * 100) : 0

  // Follow-ups due today: next_followup_date <= today AND stage is not placed or rejected
  const todayStr = new Date().toISOString().split('T')[0] || ''
  const followUpsDue = list.filter(p => 
    p.next_followup_date && 
    p.next_followup_date <= todayStr && 
    p.pipeline_stage !== 'placed' && 
    p.pipeline_stage !== 'rejected'
  ).length

  return formatResponse({
    total,
    active_count: activeCount,
    stage_breakdown: stageBreakdown,
    conversion_rate: conversionRate,
    follow_ups_due_today: followUpsDue,
  })
})
