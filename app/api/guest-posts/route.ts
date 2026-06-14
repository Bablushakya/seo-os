export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GuestPostCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/guest-posts
 * 
 * Fetches a list of guest posts with filters: search, status, author,
 * publish month, and Domain Authority range.
 * 
 * POST /api/guest-posts
 * 
 * Creates a new guest post.
 */

export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const statusParam = searchParams.get('status') || ''
  const author = searchParams.get('author') || ''
  const month = searchParams.get('month') || '' // YYYY-MM
  const daMinStr = searchParams.get('daMin')
  const daMaxStr = searchParams.get('daMax')

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
  const sortBy = searchParams.get('sortBy') || 'publish_date'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  // Build query
  // Join linked_prospect (outreach_prospects) and creator profile
  let query = supabase
    .from('guest_posts')
    .select('*, prospect:outreach_prospects!guest_posts_linked_prospect_fkey(id, site_name, url, niche), creator:users!guest_posts_created_by_fkey(id, full_name, avatar_url)', { count: 'exact' })

  // Search filter (title, topic or target_site)
  if (search) {
    query = query.or(`title.ilike.%${search}%,topic.ilike.%${search}%,target_site.ilike.%${search}%`)
  }

  // Status filter (comma-separated support)
  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
  }

  // Author filter
  if (author) {
    query = query.eq('author', author)
  }

  // Publish month filter (starts with YYYY-MM)
  if (month) {
    query = query.like('publish_date', `${month}-%`)
  }

  // DA range filters (target_da)
  if (daMinStr !== null && daMinStr !== undefined) {
    const daMin = parseInt(daMinStr, 10)
    if (!isNaN(daMin)) {
      query = query.gte('target_da', daMin)
    }
  }
  if (daMaxStr !== null && daMaxStr !== undefined) {
    const daMax = parseInt(daMaxStr, 10)
    if (!isNaN(daMax)) {
      query = query.lte('target_da', daMax)
    }
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  // Pagination range
  const offset = (page - 1) * limit
  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  // Fetch users to map author ID (string) to user details
  const { data: usersData } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')

  const userMap = new Map((usersData || []).map(u => [u.id, u]))

  const list = (data || []).map(item => ({
    ...item,
    author_user: item.author ? userMap.get(item.author) || null : null
  }))

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return formatPaginatedResponse(list, {
    total,
    page,
    limit,
    total_pages: totalPages,
  })
})

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const validated = GuestPostCreateSchema.parse(body)

  const postData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('guest_posts')
    .insert(postData)
    .select('*, prospect:outreach_prospects!guest_posts_linked_prospect_fkey(id, site_name, url, niche), creator:users!guest_posts_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'guest_posts', data.id, data)

  return formatCreatedResponse(data)
})
