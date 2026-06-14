export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth, requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { KPITargetCreateSchema } from '@/lib/utils/validation'
import { logAuditEvent } from '@/lib/audit'
import { Errors } from '@/lib/errors'

/**
 * GET /api/settings/kpi-targets
 * 
 * Fetches the latest active KPI targets.
 * If ?period=all is passed, returns nested weekly and monthly targets.
 * Otherwise, returns flat monthly targets for dashboard widgets.
 */
export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const periodParam = searchParams.get('period') || ''

  // Fetch all targets ordered by effective_from DESC
  const { data, error } = await supabase
    .from('kpi_targets')
    .select('*')
    .order('effective_from', { ascending: false })

  if (error) {
    throw error
  }

  // De-duplicate in memory to get the latest effective target for each metric + period combo
  const seen = new Set<string>()
  const resolvedWeekly = { citations: 7, guest_posts: 1, pr_placements: 1, gbp_posts: 2 }
  const resolvedMonthly = { citations: 30, guest_posts: 5, pr_placements: 5, gbp_posts: 8 }

  if (data) {
    data.forEach((t) => {
      const key = `${t.period}-${t.metric_name}`
      if (!seen.has(key)) {
        seen.add(key)
        
        let norm = t.metric_name
        if (norm === 'citations_live' || norm === 'citations_added') norm = 'citations'
        if (norm === 'guest_posts_placed' || norm === 'guest_posts_live') norm = 'guest_posts'

        if (t.period === 'weekly') {
          (resolvedWeekly as any)[norm] = t.target_value
        } else {
          (resolvedMonthly as any)[norm] = t.target_value
        }
      }
    })
  }

  if (periodParam === 'all') {
    return formatResponse({
      weekly: resolvedWeekly,
      monthly: resolvedMonthly,
    })
  }

  // Default dashboard view is monthly targets
  return formatResponse(resolvedMonthly)
})

/**
 * POST /api/settings/kpi-targets
 * 
 * Updates/Inserts KPI targets. Restricted to Admin.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireRole(['admin'])
  const supabase = await createClient()

  const body = await req.json()
  const { targets } = body

  if (!Array.isArray(targets)) {
    throw Errors.validation('Targets must be a JSON array')
  }

  const now = new Date()
  const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const insertData = []
  for (const t of targets) {
    const validated = KPITargetCreateSchema.parse({
      metric_name: t.metric_name,
      target_value: t.target_value,
      period: t.period,
      effective_from: firstDayStr
    })
    
    insertData.push({
      metric_name: validated.metric_name,
      target_value: validated.target_value,
      period: validated.period,
      effective_from: validated.effective_from,
      created_by: user.id
    })
  }

  const { data, error } = await supabase
    .from('kpi_targets')
    .insert(insertData)
    .select('*')

  if (error) {
    throw error
  }

  await logAuditEvent({
    userId: user.id,
    action: 'create',
    tableName: 'kpi_targets',
    newValues: { count: data.length, targets: data }
  })

  return formatCreatedResponse(data)
})
