export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { aggregateReportData } from '@/lib/reports/aggregation'
import { generateText } from '@/lib/ai/gemini'
import { logCreate } from '@/lib/audit'

/**
 * POST /api/reports/generate/monthly
 * 
 * Generates a monthly report for the previous calendar month.
 * Restricted to Admin. Idempotent: returns existing if already generated.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireRole(['admin'])
  const supabase = await createClient()

  // Calculate previous calendar month start and end dates
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed (current month)
  
  // First day of previous month
  const start = new Date(year, month - 1, 1)
  // Last day of previous month
  const end = new Date(year, month, 0)

  // First day of two months ago
  const priorStart = new Date(year, month - 2, 1)
  // Last day of two months ago
  const priorEnd = new Date(year, month - 1, 0)

  const formatDateStr = (d: Date) => d.toISOString().split('T')[0] || ''
  const startStr = formatDateStr(start)
  const endStr = formatDateStr(end)
  const priorStartStr = formatDateStr(priorStart)
  const priorEndStr = formatDateStr(priorEnd)

  // Check if a report already exists for this type and period
  const { data: existingReport } = await supabase
    .from('reports')
    .select('*, creator:users(id, full_name)')
    .eq('report_type', 'monthly')
    .eq('period_start', startStr)
    .eq('period_end', endStr)
    .maybeSingle()

  if (existingReport) {
    return formatResponse(existingReport)
  }

  // Aggregate stats for the reporting month and prior month (for MoM comparison)
  const [reportData, priorData] = await Promise.all([
    aggregateReportData({
      supabase,
      start: startStr,
      end: endStr,
      periodType: 'monthly',
    }),
    aggregateReportData({
      supabase,
      start: priorStartStr,
      end: priorEndStr,
      periodType: 'monthly',
    })
  ])

  // Calculate month-over-month comparisons
  const compareMetrics = (curr: number, prev: number) => {
    const change = curr - prev
    const pct = prev > 0 ? Math.round((change / prev) * 100) : (curr > 0 ? 100 : 0)
    return { current: curr, previous: prev, change_percent: pct }
  }

  reportData.comparison = {
    citations_added: compareMetrics(reportData.citations.added_this_period, priorData.citations.added_this_period),
    outreach_placed: compareMetrics(reportData.outreach.placed_this_period, priorData.outreach.placed_this_period),
    guest_posts_added: compareMetrics(reportData.guest_posts.added_this_period, priorData.guest_posts.added_this_period),
    pr_placements: compareMetrics(reportData.digital_pr.placements_this_period, priorData.digital_pr.placements_this_period),
    tasks_completed: compareMetrics(reportData.tasks.completed_this_period, priorData.tasks.completed_this_period)
  }

  // Generate Gemini prompt
  const prompt = `
Generate a comprehensive executive summary of approximately 200 words for an off-page SEO monthly performance report.
Below is the structured data of what was completed and active during the reporting month of ${startStr} to ${endStr}:

Citations:
- Total: ${reportData.citations.total}
- Live Citations: ${reportData.citations.live}
- Citations Added: ${reportData.citations.added_this_period} (MoM Change: ${reportData.comparison?.citations_added?.change_percent ?? 0}%)

Outreach:
- Active Prospects: ${reportData.outreach.total_active}
- Placed: ${reportData.outreach.placed_this_period} (MoM Change: ${reportData.comparison?.outreach_placed?.change_percent ?? 0}%)
- Conversion Rate: ${reportData.outreach.conversion_rate}%

Guest Posts:
- Live/Published: ${reportData.guest_posts.live}
- Added: ${reportData.guest_posts.added_this_period} (MoM Change: ${reportData.comparison?.guest_posts_added?.change_percent ?? 0}%)
- Average DA: ${reportData.guest_posts.avg_da}

Digital PR:
- Placements: ${reportData.digital_pr.placements_this_period} (Total: ${reportData.digital_pr.total_placements}, MoM Change: ${reportData.comparison?.pr_placements?.change_percent ?? 0}%)
- Reach: ${reportData.digital_pr.total_reach}

Tasks:
- Completed: ${reportData.tasks.completed_this_period} (MoM Change: ${reportData.comparison?.tasks_completed?.change_percent ?? 0}%)
- Overdue: ${reportData.tasks.overdue}

Google Business Profile (GBP) Metrics:
- Views: ${reportData.gbp?.views ?? 0}
- Clicks: ${reportData.gbp?.clicks ?? 0}
- Calls: ${reportData.gbp?.calls ?? 0}
- Directions: ${reportData.gbp?.direction_requests ?? 0}
- Photo Views: ${reportData.gbp?.photo_views ?? 0}

KPI Targets Progress:
- Citations: Actual ${reportData.kpi_progress.citations?.actual ?? 0} vs Target ${reportData.kpi_progress.citations?.target ?? 0} (${reportData.kpi_progress.citations?.percentage ?? 0}%)
- Guest Posts: Actual ${reportData.kpi_progress.guest_posts?.actual ?? 0} vs Target ${reportData.kpi_progress.guest_posts?.target ?? 0} (${reportData.kpi_progress.guest_posts?.percentage ?? 0}%)
- Digital PR: Actual ${reportData.kpi_progress.pr_placements?.actual ?? 0} vs Target ${reportData.kpi_progress.pr_placements?.target ?? 0} (${reportData.kpi_progress.pr_placements?.percentage ?? 0}%)
- GBP Posts: Actual ${reportData.kpi_progress.gbp_posts?.actual ?? 0} vs Target ${reportData.kpi_progress.gbp_posts?.target ?? 0} (${reportData.kpi_progress.gbp_posts?.percentage ?? 0}%)

Instructions:
- Write a single flowing paragraph narrative (do NOT use markdown headers, subheadings, or bullet points).
- Synthesize key insights, highlight the biggest wins, summarize GBP performance highlights, and provide exactly one strategic recommendation.
- Keep the summary to approximately 200 words.
- Maintain a highly professional tone.
`

  // Call AI Service
  const cacheKey = `monthly-${startStr}-${endStr}`
  const aiSummary = await generateText(prompt, cacheKey)

  // Insert Report record
  const { data: newReport, error: insertError } = await supabase
    .from('reports')
    .insert({
      report_type: 'monthly',
      period_start: startStr,
      period_end: endStr,
      data: reportData as any,
      ai_summary: aiSummary,
      status: 'generated',
      generated_by: user.id,
    })
    .select('*, creator:users(id, full_name)')
    .single()

  if (insertError) {
    throw insertError
  }

  // Audit Log
  await logCreate(user.id, 'reports', newReport.id, newReport)

  return formatCreatedResponse(newReport)
})
