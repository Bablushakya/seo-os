export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireRole } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { aggregateReportData } from '@/lib/reports/aggregation'
import { generateText } from '@/lib/ai/gemini'
import { logCreate } from '@/lib/audit'

/**
 * POST /api/reports/generate/weekly
 * 
 * Generates a weekly report for the previous 7-day period.
 * Restricted to Admin. Idempotent: returns existing if already generated.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireRole(['admin'])
  const supabase = await createClient()

  // Calculate previous 7-day period (yesterday and the 6 days before it)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  
  const start = new Date(yesterday)
  start.setDate(yesterday.getDate() - 6)

  const formatDateStr = (d: Date) => d.toISOString().split('T')[0] || ''
  const startStr = formatDateStr(start)
  const endStr = formatDateStr(yesterday)

  // Check if a report already exists for this type and period
  const { data: existingReport, error: checkError } = await supabase
    .from('reports')
    .select('*, creator:users(id, full_name)')
    .eq('report_type', 'weekly')
    .eq('period_start', startStr)
    .eq('period_end', endStr)
    .maybeSingle()

  if (existingReport) {
    return formatResponse(existingReport)
  }

  // Aggregate stats across all modules
  const reportData = await aggregateReportData({
    supabase,
    start: startStr,
    end: endStr,
    periodType: 'weekly',
  })

  // Generate Gemini prompt
  const prompt = `
Generate a concise executive summary of approximately 150 words for an off-page SEO weekly performance report.
Below is the structured data of what was completed and active during the period of ${startStr} to ${endStr}:

Citations:
- Total: ${reportData.citations.total}
- Live Citations: ${reportData.citations.live}
- Citations Added: ${reportData.citations.added_this_period}

Outreach:
- Active Prospects: ${reportData.outreach.total_active}
- Placed: ${reportData.outreach.placed_this_period}
- Conversion Rate: ${reportData.outreach.conversion_rate}%

Guest Posts:
- Live/Published: ${reportData.guest_posts.live}
- Added: ${reportData.guest_posts.added_this_period}
- Average DA: ${reportData.guest_posts.avg_da}

Digital PR:
- Placements: ${reportData.digital_pr.placements_this_period} (Total Placements: ${reportData.digital_pr.total_placements})
- Reach: ${reportData.digital_pr.total_reach}

Tasks:
- Completed: ${reportData.tasks.completed_this_period}
- Overdue: ${reportData.tasks.overdue}

KPI Targets Progress:
- Citations: Actual ${reportData.kpi_progress.citations?.actual ?? 0} vs Target ${reportData.kpi_progress.citations?.target ?? 0} (${reportData.kpi_progress.citations?.percentage ?? 0}%)
- Guest Posts: Actual ${reportData.kpi_progress.guest_posts?.actual ?? 0} vs Target ${reportData.kpi_progress.guest_posts?.target ?? 0} (${reportData.kpi_progress.guest_posts?.percentage ?? 0}%)
- Digital PR: Actual ${reportData.kpi_progress.pr_placements?.actual ?? 0} vs Target ${reportData.kpi_progress.pr_placements?.target ?? 0} (${reportData.kpi_progress.pr_placements?.percentage ?? 0}%)
- GBP Posts: Actual ${reportData.kpi_progress.gbp_posts?.actual ?? 0} vs Target ${reportData.kpi_progress.gbp_posts?.target ?? 0} (${reportData.kpi_progress.gbp_posts?.percentage ?? 0}%)

Instructions:
- Write a single flowing paragraph narrative (do NOT use markdown headers, subheadings, or bullet points).
- Highlight key wins, areas needing attention, and exactly one actionable recommendation.
- Keep the summary to approximately 150 words.
- If data shows zero activity, acknowledge it professionally and suggest next steps to kickstart efforts.
`

  // Call AI Service
  const cacheKey = `weekly-${startStr}-${endStr}`
  const aiSummary = await generateText(prompt, cacheKey)

  // Insert Report record
  const { data: newReport, error: insertError } = await supabase
    .from('reports')
    .insert({
      report_type: 'weekly',
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
