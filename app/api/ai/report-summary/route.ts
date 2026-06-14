export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireRole } from '@/lib/auth/rbac'
import { generateText } from '@/lib/ai/gemini'
import { Errors } from '@/lib/errors'

/**
 * POST /api/ai/report-summary
 * 
 * Generates an executive summary narrative based on structured KPI report data.
 * Restricted to Admin.
 */
export const POST = withErrorHandler(async (req: Request) => {
  await requireRole(['admin'])

  const bodyData = await req.json()
  const reportData = bodyData.report_data || bodyData.reportData
  const periodLabel = bodyData.period_label || bodyData.periodLabel || 'weekly'
  const startDate = bodyData.start_date || bodyData.startDate || 'N/A'
  const endDate = bodyData.end_date || bodyData.endDate || 'N/A'

  if (!reportData) {
    throw Errors.validation('report_data is a required field.')
  }

  const isWeekly = periodLabel === 'weekly'
  const wordLimit = isWeekly ? '150' : '200'

  const prompt = `
Generate a concise executive summary of approximately ${wordLimit} words for an off-page SEO ${periodLabel} performance report.
Below is the structured data of what was completed and active during the period of ${startDate} to ${endDate}:

Citations:
- Total: ${reportData.citations?.total ?? 0}
- Live: ${reportData.citations?.live ?? 0}
- Added: ${reportData.citations?.added_this_period ?? 0}

Outreach:
- Active: ${reportData.outreach?.total_active ?? 0}
- Placed: ${reportData.outreach?.placed_this_period ?? 0}
- Conversion Rate: ${reportData.outreach?.conversion_rate ?? 0}%

Guest Posts:
- Live: ${reportData.guest_posts?.live ?? 0}
- Added: ${reportData.guest_posts?.added_this_period ?? 0}
- Average DA: ${reportData.guest_posts?.avg_da ?? 0}

Digital PR:
- Placements in Period: ${reportData.digital_pr?.placements_this_period ?? 0}
- Reach Estimate: ${reportData.digital_pr?.total_reach ?? 0}

Tasks:
- Completed: ${reportData.tasks?.completed_this_period ?? 0}
- Overdue: ${reportData.tasks?.overdue ?? 0}

KPI Targets Progress:
- Citations: Actual ${reportData.kpi_progress?.citations?.actual ?? 0} vs Target ${reportData.kpi_progress?.citations?.target ?? 0} (${reportData.kpi_progress?.citations?.percentage ?? 0}%)
- Guest Posts: Actual ${reportData.kpi_progress?.guest_posts?.actual ?? 0} vs Target ${reportData.kpi_progress?.guest_posts?.target ?? 0} (${reportData.kpi_progress?.guest_posts?.percentage ?? 0}%)
- Digital PR: Actual ${reportData.kpi_progress?.pr_placements?.actual ?? 0} vs Target ${reportData.kpi_progress?.pr_placements?.target ?? 0} (${reportData.kpi_progress?.pr_placements?.percentage ?? 0}%)
- GBP Posts: Actual ${reportData.kpi_progress?.gbp_posts?.actual ?? 0} vs Target ${reportData.kpi_progress?.gbp_posts?.target ?? 0} (${reportData.kpi_progress?.gbp_posts?.percentage ?? 0}%)

${!isWeekly && reportData.gbp ? `
Google Business Profile (GBP) Metrics:
- Views: ${reportData.gbp.views ?? 0}
- Clicks: ${reportData.gbp.clicks ?? 0}
- Calls: ${reportData.gbp.calls ?? 0}
- Directions: ${reportData.gbp.direction_requests ?? 0}
- Photo Views: ${reportData.gbp.photo_views ?? 0}
` : ''}

Instructions:
- Write a single flowing paragraph narrative (do NOT use markdown headers, subheadings, or bullet points).
- Highlight key wins, areas needing attention, and exactly one actionable recommendation.
- Keep the summary to approximately ${wordLimit} words.
- If data is empty or zero, write a professional report summary identifying next steps to boost traction.
`

  const cacheKey = `standalone-summary-${periodLabel}-${startDate}-${endDate}-${JSON.stringify(reportData)}`
  const aiSummary = await generateText(prompt, cacheKey)

  return formatResponse({
    summary: aiSummary,
  })
})
