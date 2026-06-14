export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/guest-posts/stats
 * 
 * Returns overall statistics for guest posts: counts per status,
 * average Domain Authority of live posts, and monthly output.
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  // Fetch guest posts for calculations
  const { data: posts, error } = await supabase
    .from('guest_posts')
    .select('status, target_da, publish_date')

  if (error) {
    throw error
  }

  const list = posts || []
  const total = list.length

  const statusBreakdown = {
    pitching: 0,
    accepted: 0,
    writing: 0,
    editing: 0,
    submitted: 0,
    published: 0,
    live: 0,
    rejected: 0,
  }

  list.forEach(p => {
    if (p && p.status && p.status in statusBreakdown) {
      statusBreakdown[p.status as keyof typeof statusBreakdown]++
    }
  })

  // Live and Published counts
  const liveCount = statusBreakdown.live
  const publishedCount = statusBreakdown.published
  const totalLiveAndPublished = liveCount + publishedCount

  // Average DA of live/published posts
  let totalDa = 0
  list.forEach(p => {
    if (p.status === 'live' || p.status === 'published') {
      totalDa += p.target_da || 0
    }
  })
  const averageDa = totalLiveAndPublished > 0 ? Math.round(totalDa / totalLiveAndPublished) : 0

  // Monthly output: live or published posts published in the current month (YYYY-MM)
  const currentMonthStr = new Date().toISOString().split('T')[0]?.substring(0, 7) || ''
  const monthlyOutput = list.filter(p =>
    (p.status === 'live' || p.status === 'published') &&
    p.publish_date &&
    p.publish_date.startsWith(currentMonthStr)
  ).length

  return formatResponse({
    total,
    status_breakdown: statusBreakdown,
    total_live: totalLiveAndPublished,
    average_da_live: averageDa,
    monthly_output: monthlyOutput,
  })
})
