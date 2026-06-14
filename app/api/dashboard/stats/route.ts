export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * Dashboard Stats API Endpoint
 * 
 * Aggregates live citations, active outreach pipeline, live guest posts,
 * monthly digital PR placements, tasks due today, and monthly GBP posts.
 * Caches responses for 5 minutes.
 * 
 * From DOC2 Section 7.2 and DOC5 DASH-001-02
 */
export const GET = withErrorHandler(async () => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  // Start of current month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  
  // Parallelize stats queries
  const [
    citationsRes,
    outreachRes,
    guestPostsRes,
    prPlacementsRes,
    tasksRes,
    gbpPostsRes
  ] = await Promise.all([
    supabase.from('citations').select('status, created_at'),
    supabase.from('outreach_prospects').select('pipeline_stage, created_at'),
    supabase.from('guest_posts').select('status, created_at'),
    supabase.from('pr_placements').select('id, created_at'),
    supabase.from('tasks').select('id, status, due_date').eq('assignee', user.id).neq('status', 'done'),
    supabase.from('gbp_posts').select('id, created_at').gte('created_at', startOfMonth),
  ])

  // Aggregate results safely
  const citations = citationsRes.data ?? []
  const outreach = outreachRes.data ?? []
  const guestPosts = guestPostsRes.data ?? []
  const prPlacements = prPlacementsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const gbpPosts = gbpPostsRes.data ?? []

  const liveCitations = citations.filter(c => c.status === 'live').length
  const activeOutreach = outreach.filter(o => 
    ['identified', 'contacted', 'followed_up', 'negotiating'].includes(o.pipeline_stage)
  ).length
  const liveGuestPosts = guestPosts.filter(g => 
    ['live', 'published'].includes(g.status)
  ).length

  // Calculate outreach stage breakdown
  const stageBreakdown: Record<string, number> = {
    identified: 0,
    contacted: 0,
    followed_up: 0,
    negotiating: 0,
    placed: 0,
    rejected: 0,
  }
  outreach.forEach(o => {
    if (o.pipeline_stage && o.pipeline_stage in stageBreakdown) {
      const val = stageBreakdown[o.pipeline_stage]
      if (val !== undefined) {
        stageBreakdown[o.pipeline_stage] = val + 1
      }
    }
  })

  // Digital PR Placements
  const prThisMonth = prPlacements.filter(pr => pr.created_at >= startOfMonth).length
  const prTotal = prPlacements.length

  // User Tasks
  const todayStr = now.toISOString().split('T')[0] || ''
  const tasksDueToday = tasks.filter(t => t.due_date === todayStr).length
  const tasksOverdue = tasks.filter(t => t.due_date && t.due_date < todayStr).length

  // GBP Posts
  const gbpThisMonth = gbpPosts.length

  const stats = {
    citations: {
      total: citations.length,
      live: liveCitations,
      live_percentage: citations.length > 0 ? Math.round((liveCitations / citations.length) * 100) : 0,
    },
    outreach: {
      total: outreach.length,
      active: activeOutreach,
      stage_breakdown: stageBreakdown,
    },
    guest_posts: {
      total: guestPosts.length,
      live: liveGuestPosts,
    },
    pr_placements: {
      total: prTotal,
      this_month: prThisMonth,
    },
    tasks: {
      due_today: tasksDueToday,
      overdue: tasksOverdue,
    },
    gbp_posts: {
      this_month: gbpThisMonth,
    }
  }

  const response = formatResponse(stats)
  // Set edge caching to 5 minutes
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300')
  return response
})
