export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'

/**
 * KPI Targets API Endpoint (Stub)
 * 
 * Returns monthly targets for each core KPI metric.
 * These will eventually be editable in Settings page.
 * 
 * From DOC5 DASH-001-06
 */
export const GET = withErrorHandler(async () => {
  await requireAuth()

  // Return initial mock targets (pre-configured team goals)
  const targets = {
    citations: 50,      // goal: 50 live citations
    guest_posts: 10,    // goal: 10 guest posts
    pr_placements: 5,   // goal: 5 digital PR placements
    gbp_posts: 20,      // goal: 20 GBP posts
  }

  return formatResponse(targets)
})
