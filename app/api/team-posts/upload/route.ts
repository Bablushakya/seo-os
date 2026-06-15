export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * POST /api/team-posts/upload
 *
 * Uploads a file to Supabase Storage 'team-files' bucket.
 * Accepts multipart/form-data with:
 *   - file: the file to upload
 *   - post_id: the team post UUID to attach to
 *   - caption: optional caption text
 *
 * Returns the created attachment record.
 */

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const post_id = formData.get('post_id') as string | null
  const caption = (formData.get('caption') as string) || null

  if (!file) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'No file provided', 400)
  }

  if (!post_id) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'post_id is required', 400)
  }

  // Validate file size (50MB max)
  const MAX_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'File size cannot exceed 50MB', 400)
  }

  // Validate file type
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'File type not allowed. Supported: Images (JPEG, PNG, GIF, WebP), PDF, Word documents, Excel files, TXT',
      400
    )
  }

  // Build a unique storage path: {userId}/{postId}/{timestamp}-{filename}
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${post_id}/${timestamp}-${sanitizedName}`

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('team-files')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[upload] Storage error:', uploadError)
    throw new AppError(ErrorCode.INTERNAL_ERROR, `Upload failed: ${uploadError.message}`, 500)
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('team-files')
    .getPublicUrl(storagePath)

  const fileUrl = publicUrlData.publicUrl

  // Create attachment record
  const { data: attachment, error: dbError } = await supabase
    .from('team_post_attachments')
    .insert({
      post_id,
      file_name: file.name,
      file_url: fileUrl,
      file_type: file.type,
      file_size: file.size,
      caption,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (dbError) {
    // Try to clean up the uploaded file
    await supabase.storage.from('team-files').remove([storagePath])
    throw dbError
  }

  return NextResponse.json({ success: true, data: attachment }, { status: 201 })
})
