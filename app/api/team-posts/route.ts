export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse, formatCreatedResponse, formatPaginatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { TeamPostCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'

/**
 * GET /api/team-posts
 *
 * Lists all team posts visible to the current user,
 * including their attachments and author info.
 * Posts are either targeted to everyone (target_user_ids IS NULL)
 * or include the current user's ID in target_user_ids.
 *
 * POST /api/team-posts
 *
 * Creates a new team post. Any authenticated user can post.
 */

export const GET = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
  const offset = (page - 1) * limit

  // Fetch posts visible to this user (RLS handles filtering)
  const { data: posts, count, error } = await supabase
    .from('team_posts')
    .select('*, author:users!team_posts_created_by_fkey(id, full_name, avatar_url)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const postIds = (posts || []).map((p: any) => p.id)

  // Fetch attachments for all returned posts
  let attachmentsMap: Record<string, any[]> = {}
  if (postIds.length > 0) {
    const { data: attachments } = await supabase
      .from('team_post_attachments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })

    ;(attachments || []).forEach((a: any) => {
      if (!attachmentsMap[a.post_id]) attachmentsMap[a.post_id] = []
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      attachmentsMap[a.post_id]!.push(a)
    })
  }

  // Fetch all users for target_user_ids resolution
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')

  const usersMap: Record<string, any> = {}
  ;(allUsers || []).forEach((u: any) => { usersMap[u.id] = u })

  const enriched = (posts || []).map((post: any) => ({
    ...post,
    attachments: attachmentsMap[post.id] || [],
    target_users: post.target_user_ids
      ? post.target_user_ids.map((uid: string) => usersMap[uid] || null).filter(Boolean)
      : null,
  }))

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return formatPaginatedResponse(enriched, {
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
  const { content, target_user_ids } = TeamPostCreateSchema.parse(body)

  const { data: post, error } = await supabase
    .from('team_posts')
    .insert({
      content,
      target_user_ids: target_user_ids || null,
      created_by: user.id,
    })
    .select('*, author:users!team_posts_created_by_fkey(id, full_name, avatar_url)')
    .single()

  if (error) throw error

  await logCreate(user.id, 'team_posts', post.id, post)

  return formatCreatedResponse({ ...post, attachments: [] })
})
