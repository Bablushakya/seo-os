export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logExport } from '@/lib/audit'
import Papa from 'papaparse'

/**
 * GET /api/citations/export
 * 
 * Fetches all citations matching the current filter criteria (ignoring pagination)
 * and returns them as a downloadable CSV file.
 */
export const GET = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const statusParam = searchParams.get('status') || ''
  const niche = searchParams.get('niche') || ''
  const daMinStr = searchParams.get('daMin')
  const daMaxStr = searchParams.get('daMax')
  const sortBy = searchParams.get('sortBy') || 'directory_name'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  // Build query for all matching records
  let query = supabase
    .from('citations')
    .select('*, creator:users(id, full_name)')

  if (search) {
    query = query.or(`directory_name.ilike.%${search}%,url.ilike.%${search}%`)
  }

  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
  }

  if (niche) {
    query = query.eq('niche', niche)
  }

  if (daMinStr !== null && daMinStr !== undefined) {
    const daMin = parseInt(daMinStr, 10)
    if (!isNaN(daMin)) {
      query = query.gte('domain_authority', daMin)
    }
  }
  if (daMaxStr !== null && daMaxStr !== undefined) {
    const daMax = parseInt(daMaxStr, 10)
    if (!isNaN(daMax)) {
      query = query.lte('domain_authority', daMax)
    }
  }

  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  // Max 1000 for export safety
  const { data: citations, error } = await query.limit(1000)

  if (error) {
    throw error
  }

  const list = citations || []

  // Map to CSV structure
  const csvData = list.map(c => ({
    'Directory Name': c.directory_name,
    'URL': c.url,
    'Domain Authority': c.domain_authority,
    'Niche': c.niche || '',
    'Status': c.status,
    'Date Submitted': c.date_submitted || '',
    'Date Live': c.date_live || '',
    'Notes': c.notes || '',
    'Created By': c.creator?.full_name || '',
    'Created At': new Date(c.created_at).toISOString().split('T')[0],
  }))

  // Convert to CSV
  const csvString = Papa.unparse(csvData)

  // Log export event
  await logExport(user.id, 'citations', list.length)

  const dateStr = new Date().toISOString().split('T')[0]

  return new Response(csvString, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="citations-${dateStr}.csv"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
})
