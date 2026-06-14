export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { CompetitorCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/competitors
 * 
 * Fetches all tracked competitor domains with aggregated counts of total,
 * gap, and tagged backlinks.
 * 
 * POST /api/competitors
 * 
 * Tracks a new competitor domain.
 */

export const GET = withErrorHandler(async () => {
  await requireAuth()
  const supabase = await createClient()

  // 1. Fetch competitors
  const { data: competitors, error: compError } = await supabase
    .from('competitors')
    .select('*, creator:users!competitors_created_by_fkey(id, full_name, avatar_url)')
    .order('domain', { ascending: true })

  if (compError) {
    throw compError
  }

  // 2. Fetch all backlinks brief info to group in memory
  const { data: backlinks, error: blError } = await supabase
    .from('competitor_backlinks')
    .select('competitor_id, is_gap, tagged_for_outreach')

  if (blError) {
    throw blError
  }

  // 3. Map counts in memory
  const countsMap = new Map<string, { total: number; gaps: number; tagged: number }>()
  backlinks?.forEach((b) => {
    const curr = countsMap.get(b.competitor_id) || { total: 0, gaps: 0, tagged: 0 }
    curr.total++
    if (b.is_gap) curr.gaps++
    if (b.tagged_for_outreach) curr.tagged++
    countsMap.set(b.competitor_id, curr)
  })

  // 4. Attach stats to competitors list
  const list = (competitors || []).map((c) => {
    const stats = countsMap.get(c.id) || { total: 0, gaps: 0, tagged: 0 }
    return {
      ...c,
      backlink_count: stats.total,
      gap_count: stats.gaps,
      tagged_count: stats.tagged,
    }
  })

  return formatResponse(list)
})

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const validated = CompetitorCreateSchema.parse(body)

  const competitorData = {
    ...validated,
    created_by: user.id,
    domain: validated.domain.toLowerCase().trim(),
  }

  const { data, error } = await supabase
    .from('competitors')
    .insert(competitorData)
    .select('*, creator:users!competitors_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'competitors', data.id, data)

  return formatCreatedResponse({
    ...data,
    backlink_count: 0,
    gap_count: 0,
    tagged_count: 0,
  })
})
