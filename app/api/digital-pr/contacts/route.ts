export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatPaginatedResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { PRContactCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/digital-pr/contacts
 * 
 * Lists media contacts. Supports search filter and pagination.
 * 
 * POST /api/digital-pr/contacts
 * 
 * Adds a new media contact.
 */

export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  const sortBy = searchParams.get('sortBy') || 'name'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  let query = supabase
    .from('pr_contacts')
    .select('*, creator:users(id, full_name, avatar_url)', { count: 'exact' })

  // Search filter (name, email, publication, or beat)
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,publication.ilike.%${search}%,beat.ilike.%${search}%`)
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })

  // Pagination
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

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const validated = PRContactCreateSchema.parse(body)

  const contactData = {
    ...validated,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('pr_contacts')
    .insert(contactData)
    .select('*, creator:users(id, full_name, avatar_url)')
    .single()

  if (error) {
    throw error
  }

  // Log audit event
  await logCreate(user.id, 'pr_contacts', data.id, data)

  return formatCreatedResponse(data)
})
