import { SupabaseClient } from '@supabase/supabase-js'
import type { ReportData, OutreachPipelineStage, KPITarget } from '@/lib/types'

interface AggregationParams {
  supabase: SupabaseClient
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  periodType: 'weekly' | 'monthly'
}

export async function aggregateReportData({
  supabase,
  start,
  end,
  periodType,
}: AggregationParams): Promise<ReportData> {
  const startISO = `${start}T00:00:00.000Z`
  const endISO = `${end}T23:59:59.999Z`

  // Fetch all core records needed for aggregation in parallel
  const [
    citationsRes,
    outreachRes,
    guestPostsRes,
    prPlacementsRes,
    tasksRes,
    usersRes,
    gbpPostsRes,
    targetsRes
  ] = await Promise.all([
    supabase.from('citations').select('*'),
    supabase.from('outreach_prospects').select('*'),
    supabase.from('guest_posts').select('*'),
    supabase.from('pr_placements').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('users').select('id, full_name'),
    supabase.from('gbp_posts').select('*').gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('kpi_targets')
      .select('*')
      .eq('period', periodType)
      .lte('effective_from', start)
      .order('effective_from', { ascending: false })
  ])

  // Extract data with fallbacks
  const citations = citationsRes.data ?? []
  const outreach = outreachRes.data ?? []
  const guestPosts = guestPostsRes.data ?? []
  const prPlacements = prPlacementsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const users = usersRes.data ?? []
  const gbpPosts = gbpPostsRes.data ?? []
  const targets = targetsRes.data ?? []

  // Create a map of user ID to full name
  const userMap = new Map<string, string>()
  users.forEach((u) => userMap.set(u.id, u.full_name))

  // 1. CITATIONS AGGREGATION
  const citationsTotal = citations.length
  const citationsLive = citations.filter((c) => c.status === 'live').length
  const citationsLivePercentage = citationsTotal > 0 ? Math.round((citationsLive / citationsTotal) * 100) : 0
  const citationsAddedThisPeriod = citations.filter((c) => {
    const date = c.created_at || c.date_submitted
    return date && date >= startISO && date <= endISO
  }).length

  // 2. OUTREACH AGGREGATION
  const outreachActive = outreach.filter((o) =>
    ['identified', 'contacted', 'followed_up', 'negotiating'].includes(o.pipeline_stage)
  ).length
  const outreachPlacedThisPeriod = outreach.filter((o) => {
    const isPlaced = o.pipeline_stage === 'placed'
    const date = o.updated_at || o.last_contact_date
    return isPlaced && date && date >= startISO && date <= endISO
  }).length
  const outreachTotalPlaced = outreach.filter((o) => o.pipeline_stage === 'placed').length
  const outreachConversionRate = outreach.length > 0 ? Math.round((outreachTotalPlaced / outreach.length) * 100) : 0

  const stageBreakdown: Record<OutreachPipelineStage, number> = {
    identified: 0,
    contacted: 0,
    followed_up: 0,
    negotiating: 0,
    placed: 0,
    rejected: 0,
  }
  outreach.forEach((o) => {
    if (o.pipeline_stage && o.pipeline_stage in stageBreakdown) {
      stageBreakdown[o.pipeline_stage as OutreachPipelineStage]++
    }
  })

  // 3. GUEST POSTS AGGREGATION
  const gpTotal = guestPosts.length
  const gpLive = guestPosts.filter((g) => ['live', 'published'].includes(g.status)).length
  const gpAddedThisPeriod = guestPosts.filter((g) => {
    const date = g.created_at || g.publish_date
    return date && date >= startISO && date <= endISO
  }).length

  const gpAddedList = guestPosts.filter((g) => {
    const date = g.created_at || g.publish_date
    return date && date >= startISO && date <= endISO
  })
  const gpAvgDA = gpAddedList.length > 0
    ? Math.round(gpAddedList.reduce((acc, curr) => acc + (curr.target_da || 0), 0) / gpAddedList.length)
    : 0

  // 4. DIGITAL PR AGGREGATION
  const prTotalPlacements = prPlacements.length
  const prPlacementsThisPeriod = prPlacements.filter((p) => {
    const date = p.created_at || p.placement_date
    return date && date >= startISO && date <= endISO
  }).length
  const prReachThisPeriod = prPlacements
    .filter((p) => {
      const date = p.created_at || p.placement_date
      return date && date >= startISO && date <= endISO
    })
    .reduce((acc, curr) => acc + (curr.reach_estimate || 0), 0)

  // 5. TASKS AGGREGATION
  const tasksCompletedThisPeriod = tasks.filter((t) => {
    return t.status === 'done' && t.updated_at && t.updated_at >= startISO && t.updated_at <= endISO
  }).length
  
  const todayStr = new Date().toISOString().split('T')[0] || ''
  const tasksOverdue = tasks.filter((t) => {
    return t.status !== 'done' && t.due_date && t.due_date < todayStr
  }).length

  const tasksByAssignee: Record<string, number> = {}
  tasks.forEach((t) => {
    if (t.status === 'done' && t.updated_at && t.updated_at >= startISO && t.updated_at <= endISO) {
      const name = t.assignee ? (userMap.get(t.assignee) ?? 'Unknown') : 'Unassigned'
      tasksByAssignee[name] = (tasksByAssignee[name] ?? 0) + 1
    }
  })

  // 6. KPI TARGETS PROGRESS
  // We resolve the latest target configuration for each metric name
  const latestTargets: Record<string, number> = {}
  targets.forEach((t) => {
    if (!latestTargets[t.metric_name]) {
      latestTargets[t.metric_name] = t.target_value
    }
  })

  // Default Targets
  const defaultTargets = periodType === 'weekly' 
    ? { citations: 7, guest_posts: 1, pr_placements: 1, gbp_posts: 2 }
    : { citations: 30, guest_posts: 5, pr_placements: 5, gbp_posts: 8 }

  const targetCitations = latestTargets['citations'] ?? latestTargets['citations_live'] ?? defaultTargets.citations
  const targetGuestPosts = latestTargets['guest_posts'] ?? latestTargets['guest_posts_placed'] ?? defaultTargets.guest_posts
  const targetPR = latestTargets['pr_placements'] ?? defaultTargets.pr_placements
  const targetGBP = latestTargets['gbp_posts'] ?? defaultTargets.gbp_posts

  // Actual values achieved in this period
  const actualCitations = citations.filter((c) => {
    const date = c.created_at || c.date_submitted
    return c.status === 'live' && date && date >= startISO && date <= endISO
  }).length

  const actualGuestPosts = guestPosts.filter((g) => {
    const isLive = ['live', 'published'].includes(g.status)
    const date = g.created_at || g.publish_date
    return isLive && date && date >= startISO && date <= endISO
  }).length

  const actualPR = prPlacementsThisPeriod
  const actualGBP = gbpPosts.length

  const kpiProgress: Record<string, { target: number; actual: number; percentage: number }> = {
    citations: {
      target: targetCitations,
      actual: actualCitations,
      percentage: targetCitations > 0 ? Math.round((actualCitations / targetCitations) * 100) : 0
    },
    guest_posts: {
      target: targetGuestPosts,
      actual: actualGuestPosts,
      percentage: targetGuestPosts > 0 ? Math.round((actualGuestPosts / targetGuestPosts) * 100) : 0
    },
    pr_placements: {
      target: targetPR,
      actual: actualPR,
      percentage: targetPR > 0 ? Math.round((actualPR / targetPR) * 100) : 0
    },
    gbp_posts: {
      target: targetGBP,
      actual: actualGBP,
      percentage: targetGBP > 0 ? Math.round((actualGBP / targetGBP) * 100) : 0
    }
  }

  const reportData: ReportData = {
    citations: {
      total: citationsTotal,
      live: citationsLive,
      live_percentage: citationsLivePercentage,
      added_this_period: citationsAddedThisPeriod,
    },
    outreach: {
      total_active: outreachActive,
      placed_this_period: outreachPlacedThisPeriod,
      conversion_rate: outreachConversionRate,
      stage_breakdown: stageBreakdown,
    },
    guest_posts: {
      total: gpTotal,
      live: gpLive,
      added_this_period: gpAddedThisPeriod,
      avg_da: gpAvgDA,
    },
    digital_pr: {
      total_placements: prTotalPlacements,
      placements_this_period: prPlacementsThisPeriod,
      total_reach: prReachThisPeriod,
    },
    tasks: {
      completed_this_period: tasksCompletedThisPeriod,
      overdue: tasksOverdue,
      by_assignee: tasksByAssignee,
    },
    kpi_progress: kpiProgress,
  }

  // Fetch GBP metrics if it is a monthly report
  if (periodType === 'monthly') {
    const { data: gbpData } = await supabase
      .from('gbp_metrics')
      .select('*')
      .eq('metric_month', start)

    const gbpStats = { views: 0, clicks: 0, calls: 0, direction_requests: 0, photo_views: 0 }
    gbpData?.forEach((m) => {
      gbpStats.views += m.views || 0
      gbpStats.clicks += m.clicks || 0
      gbpStats.calls += m.calls || 0
      gbpStats.direction_requests += m.direction_requests || 0
      gbpStats.photo_views += m.photo_views || 0
    })

    reportData.gbp = gbpStats
  }

  return reportData
}
