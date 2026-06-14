export const dynamic = 'force-dynamic'

import { withErrorHandler, formatPaginatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

/**
 * Helper to extract domain from a URL string.
 */
function extractDomain(url: string): string {
  try {
    const cleanUrl = url.trim()
    if (!cleanUrl) return ''
    
    const withProtocol = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `http://${cleanUrl}`
    const hostname = new URL(withProtocol).hostname
    return hostname.replace(/^www\./i, '').toLowerCase()
  } catch (e) {
    const clean = (url || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
    const firstPart = clean.split('/')[0] || ''
    return (firstPart.split(':')[0] || '').toLowerCase()
  }
}

/**
 * GET /api/competitors/gap-analysis
 * 
 * Performs cross-database sync of 'is_gap' status for all competitor backlinks,
 * then returns a list of backlinks where is_gap = true across all competitors.
 */
export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  // 1. Fetch our active domains
  const { data: citations } = await supabase
    .from('citations')
    .select('url')
    .neq('status', 'rejected')

  const { data: guestPosts } = await supabase
    .from('guest_posts')
    .select('target_url, target_site')
    .neq('status', 'rejected')

  const ourDomains = new Set<string>()
  citations?.forEach((c) => {
    if (c.url) {
      const dom = extractDomain(c.url)
      if (dom) ourDomains.add(dom)
    }
  })
  guestPosts?.forEach((gp) => {
    if (gp.target_url) {
      const dom = extractDomain(gp.target_url)
      if (dom) ourDomains.add(dom)
    } else if (gp.target_site) {
      const dom = extractDomain(gp.target_site)
      if (dom) ourDomains.add(dom)
    }
  })

  // 2. Fetch all backlinks to check is_gap consistency
  const { data: backlinks, error: blError } = await supabase
    .from('competitor_backlinks')
    .select('id, source_domain, is_gap')

  if (blError) {
    throw blError
  }

  // 3. Find mismatches and prepare bulk updates
  const updates = []
  for (const b of backlinks || []) {
    const calculatedIsGap = !ourDomains.has(b.source_domain.toLowerCase())
    if (b.is_gap !== calculatedIsGap) {
      updates.push({
        id: b.id,
        is_gap: calculatedIsGap,
      })
    }
  }

  // 4. Batch update in DB using upsert
  if (updates.length > 0) {
    // Break into chunks of 100 to prevent payload overflow
    const chunkSize = 100
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      const { error: updateError } = await supabase
        .from('competitor_backlinks')
        .upsert(chunk)
      if (updateError) {
        console.error('[GapAnalysis] Error bulk updating is_gap:', updateError.message)
      }
    }
  }

  // 5. Fetch paginated filtered list of Gaps
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const daMinStr = searchParams.get('daMin')
  const daMaxStr = searchParams.get('daMax')

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
  const sortBy = searchParams.get('sortBy') || 'source_da'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  let query = supabase
    .from('competitor_backlinks')
    .select('*, competitor:competitors!competitor_backlinks_competitor_id_fkey(id, domain, display_name)', { count: 'exact' })
    .eq('is_gap', true)

  if (daMinStr) {
    const daMin = parseInt(daMinStr, 10)
    if (!isNaN(daMin)) query = query.gte('source_da', daMin)
  }
  if (daMaxStr) {
    const daMax = parseInt(daMaxStr, 10)
    if (!isNaN(daMax)) query = query.lte('source_da', daMax)
  }
  if (search) {
    query = query.or(`source_domain.ilike.%${search}%,anchor_text.ilike.%${search}%`)
  }

  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  const offset = (page - 1) * limit
  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return formatPaginatedResponse(data || [], {
    total,
    page,
    limit,
    total_pages: totalPages,
  })
})
