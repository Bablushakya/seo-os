export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/citations/stats
 * 
 * Returns overall statistics for citations, including live, pending,
 * submitted counts, live percentage, and a monthly trend.
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  // Fetch all citations with fields needed for stats
  const { data: citations, error } = await supabase
    .from('citations')
    .select('status, date_live, created_at')

  if (error) {
    throw error
  }

  const list = citations || []
  const total = list.length

  const live_count = list.filter(c => c.status === 'live').length
  const pending_count = list.filter(c => c.status === 'pending').length
  const submitted_count = list.filter(c => c.status === 'submitted').length
  const live_percentage = total > 0 ? Math.round((live_count / total) * 100) : 0

  // Calculate monthly trend: count of citations that became live in the last 30 days
  // compared to the 30 days before that.
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  let liveLast30 = 0
  let livePrev30 = 0

  list.forEach(c => {
    if (c.status === 'live') {
      // Use date_live if available, otherwise fallback to created_at
      const dateVal = c.date_live ? new Date(c.date_live) : new Date(c.created_at)
      if (dateVal >= thirtyDaysAgo && dateVal <= now) {
        liveLast30++
      } else if (dateVal >= sixtyDaysAgo && dateVal < thirtyDaysAgo) {
        livePrev30++
      }
    }
  })

  // Trend is percentage growth or diff. Let's return the difference in counts
  // or a percentage growth value. A simple count difference or percentage is clear.
  // We'll provide both the raw count in last 30 days and the difference.
  const monthly_trend = liveLast30 - livePrev30

  const stats = {
    total,
    live_count,
    pending_count,
    submitted_count,
    live_percentage,
    monthly_trend,
    live_last_30_days: liveLast30,
    live_prev_30_days: livePrev30,
  }

  return formatResponse(stats)
})
