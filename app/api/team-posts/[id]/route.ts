export const dynamic = 'force-dynamic'

import { withErrorHandler, formatDeletedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { logDelete } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * DELETE /api/team-posts/[id]
 *
 * Deletes a team post (and its attachments via cascade).
 * Only the author or admin can delete.
 */

export const DELETE = withErrorHandler(async (
  req: Request,
  context: { params: Promise<Record<string, string>> }
) => {
  const { user, profile } = await requireAuth()
  const supabase = await createClient()
  const params = await context.params
  const { id } = params as { id: string }

  // Fetch post for auth check
  const { data: post, error: fetchError } = await supabase
    .from('team_posts')
    .select('id, created_by, content')
    .eq('id', id)
    .single()

  if (fetchError || !post) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Post not found', 404)
  }

  // Only creator or admin can delete
  if (post.created_by !== user.id && profile.role !== 'admin') {
    throw new AppError(ErrorCode.FORBIDDEN, 'You can only delete your own posts', 403)
  }

  // Delete attachments from storage first
  const { data: attachments } = await supabase
    .from('team_post_attachments')
    .select('file_url, file_name')
    .eq('post_id', id)

  if (attachments && attachments.length > 0) {
    const paths = attachments.map((a: any) => {
      // Extract path from URL (after /team-files/)
      const url = a.file_url as string
      const marker = '/team-files/'
      const idx = url.indexOf(marker)
      return idx !== -1 ? url.slice(idx + marker.length) : a.file_name
    })
    await supabase.storage.from('team-files').remove(paths)
  }

  // Delete the post (attachments cascade)
  const { error: deleteError } = await supabase
    .from('team_posts')
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError

  await logDelete(user.id, 'team_posts', id, post)

  return formatDeletedResponse()
})
