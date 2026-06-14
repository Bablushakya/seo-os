export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * Helper to extract domain from a URL string.
 */
function extractDomain(url: string): string {
  try {
    const cleanUrl = url.trim()
    if (!cleanUrl) return ''
    
    // Add protocol if missing to let URL parser handle it
    const withProtocol = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `http://${cleanUrl}`
    const hostname = new URL(withProtocol).hostname
    return hostname.replace(/^www\./i, '').toLowerCase()
  } catch (e) {
    // Fallback split logic
    const clean = (url || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
    const firstPart = clean.split('/')[0] || ''
    return (firstPart.split(':')[0] || '').toLowerCase()
  }
}

/**
 * POST /api/competitors/[id]/backlinks/import
 * 
 * Imports a list of backlinks from CSV for a competitor.
 * Resolves gaps dynamically before inserting.
 */
export const POST = withErrorHandler(async (
  req: Request,
  context: { params: Record<string, string> }
) => {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { id } = context.params as { id: string }

  // 1. Verify competitor exists
  const { data: competitor, error: compError } = await supabase
    .from('competitors')
    .select('id, domain')
    .eq('id', id)
    .single()

  if (compError || !competitor) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Competitor not found', 404)
  }

  const payload = await req.json()
  if (!Array.isArray(payload)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Import payload must be a JSON array of backlinks', 400)
  }

  // 2. Fetch our own active domains to check for gaps
  const { data: citations } = await supabase.from('citations').select('url')
  const { data: guestPosts } = await supabase.from('guest_posts').select('target_url, target_site')

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

  // 3. Process each row
  const backlinksToInsert = []
  for (const row of payload) {
    const rawDomain = String(row.source_domain || '').trim()
    if (!rawDomain) continue

    const domain = extractDomain(rawDomain)
    if (!domain) continue

    const da = parseInt(row.source_da, 10)
    const validDA = isNaN(da) ? 0 : Math.min(100, Math.max(0, da))

    // Determine if it is a gap
    const isGap = !ourDomains.has(domain)

    // Normalize link type
    let linkType = String(row.link_type || 'dofollow').toLowerCase().trim()
    if (linkType !== 'dofollow' && linkType !== 'nofollow' && linkType !== 'unknown') {
      linkType = 'dofollow'
    }

    // Normalize date
    let dateFound = String(row.date_found || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFound)) {
      dateFound = new Date().toISOString().split('T')[0] || ''
    }

    backlinksToInsert.push({
      competitor_id: id,
      source_domain: domain,
      source_url: String(row.source_url || '').trim() || null,
      target_url: String(row.target_url || '').trim() || null,
      source_da: validDA,
      anchor_text: String(row.anchor_text || '').trim() || null,
      link_type: linkType,
      date_found: dateFound,
      is_gap: isGap,
      tagged_for_outreach: false,
      notes: String(row.notes || '').trim() || null,
    })
  }

  if (backlinksToInsert.length === 0) {
    return formatResponse({ imported: 0, message: 'No valid backlinks to import' })
  }

  // 4. Perform bulk insert
  const { data: insertedData, error: insertError } = await supabase
    .from('competitor_backlinks')
    .insert(backlinksToInsert)
    .select('id')

  if (insertError) {
    throw insertError
  }

  // 5. Log audit event
  await logAuditEvent({
    userId: user.id,
    action: 'create',
    tableName: 'competitor_backlinks',
    newValues: {
      competitor_id: id,
      competitor_domain: competitor.domain,
      imported_count: backlinksToInsert.length,
    },
  })

  return formatCreatedResponse({
    imported: backlinksToInsert.length,
    data: insertedData,
  })
})
