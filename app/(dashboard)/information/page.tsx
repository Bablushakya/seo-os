'use client'

import React, { useState, useRef, useCallback } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Info,
  Plus,
  X,
  Send,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Trash2,
  Users,
  Globe,
  File,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import type { TeamPost, TeamPostAttachment, User } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json().then(j => j.data))

// Color helpers
const FILE_TYPE_ICON: Record<string, React.FC<any>> = {}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon
  return FileText
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ============================================================
// Attachment Preview Component
// ============================================================
function AttachmentItem({ attachment }: { attachment: TeamPostAttachment }) {
  const isImage = attachment.file_type.startsWith('image/')
  const Icon = getFileIcon(attachment.file_type)

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      {isImage ? (
        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={attachment.file_url}
            alt={attachment.caption || attachment.file_name}
            className="h-24 w-24 object-cover rounded-md border border-border/40 hover:opacity-90 transition-opacity cursor-pointer"
          />
        </a>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{attachment.file_name}</p>
        {attachment.caption && (
          <p className="text-xs text-muted-foreground mt-0.5">{attachment.caption}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{formatFileSize(attachment.file_size)}</p>
        <a
          href={attachment.file_url}
          target="_blank"
          rel="noopener noreferrer"
          download={attachment.file_name}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
    </div>
  )
}

// ============================================================
// Post Card Component
// ============================================================
function PostCard({ post, currentUserId, currentUserRole, onDelete }: {
  post: TeamPost & { target_users?: User[] | null }
  currentUserId: string
  currentUserRole: string
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const canDelete = post.created_by === currentUserId || currentUserRole === 'admin'
  const hasAttachments = (post.attachments || []).length > 0

  return (
    <div className="bg-card border border-border/80 rounded-xl overflow-hidden hover:border-border transition-colors">
      {/* Post Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              getInitials(post.author?.full_name || 'U')
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{post.author?.full_name || 'Unknown'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
              {/* Visibility badge */}
              {post.target_users && post.target_users.length > 0 ? (
                <div className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-2 py-0.5">
                  <Users className="h-2.5 w-2.5" />
                  <span>For: {(post.target_users as User[]).map(u => u.full_name.split(' ')[0]).join(', ')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <Globe className="h-2.5 w-2.5" />
                  <span>Everyone</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canDelete && (
            <button
              onClick={() => onDelete(post.id)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete post"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Post Content */}
      {expanded && (
        <div className="px-4 pb-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>

          {/* Attachments */}
          {hasAttachments && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {post.attachments!.map(att => (
                <AttachmentItem key={att.id} attachment={att} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// New Post Composer
// ============================================================
function PostComposer({ users, onPostCreated }: { users: User[]; onPostCreated: () => void }) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')
  const [targetUserId, setTargetUserId] = useState<string>('everyone')
  const [files, setFiles] = useState<File[]>()
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles(prev => [...(prev || []), ...selected])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => (prev || []).filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please write something before posting')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Create the post
      const postRes = await fetch('/api/team-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          target_user_ids: targetUserId === 'everyone' ? null : [targetUserId],
        }),
      })
      const postResult = await postRes.json()
      if (!postRes.ok || !postResult.success) throw new Error(postResult.error?.message || 'Failed to create post')

      const postId = postResult.data.id

      // 2. Upload files if any
      if (files && files.length > 0) {
        for (const file of files) {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('post_id', postId)
          const cap = captions[file.name] || ''
          if (cap) fd.append('caption', cap)

          const uploadRes = await fetch('/api/team-posts/upload', { method: 'POST', body: fd })
          if (!uploadRes.ok) {
            const err = await uploadRes.json()
            console.warn('File upload failed:', err.error?.message)
            toast.warning(`File "${file.name}" failed to upload — post was still created.`)
          }
        }
      }

      toast.success('Post shared successfully!')
      setContent('')
      setTargetUserId('everyone')
      setFiles([])
      setCaptions({})
      setIsOpen(false)
      onPostCreated()
    } catch (err: any) {
      toast.error(err.message || 'Failed to post')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 bg-card border border-border/80 rounded-xl px-4 py-3 text-sm text-muted-foreground hover:border-indigo-500/50 hover:text-foreground transition-all"
      >
        <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
          {user?.full_name ? getInitials(user.full_name) : 'U'}
        </div>
        <span>Share something with the team...</span>
        <Plus className="ml-auto h-4 w-4 shrink-0" />
      </button>
    )
  }

  return (
    <div className="bg-card border border-indigo-500/40 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Share Information</h3>
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content textarea */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your message, announcement, or information here..."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          autoFocus
        />

        {/* Target audience */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Share with:</label>
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger className="flex-1 h-8 text-xs bg-background border-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="everyone">
                <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Everyone</span>
              </SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{u.full_name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File attachments */}
        {files && files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2">
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate">{file.name}</span>
                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={captions[file.name] || ''}
                  onChange={e => setCaptions(prev => ({ ...prev, [file.name]: e.target.value }))}
                  className="text-xs bg-background border border-input rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={handleFileAdd}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 rounded-md px-3 py-1.5 transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach file
            </button>
            <button
              type="button"
              onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click() }}}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 rounded-md px-3 py-1.5 transition-colors"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Add image
            </button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-4"
          >
            {isSubmitting ? (
              <><LoadingSpinner size="sm" className="mr-1.5 border-t-white" />Sharing...</>
            ) : (
              <><Send className="h-3.5 w-3.5 mr-1.5" />Share</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================
export default function InformationPage() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()

  const [page, setPage] = useState(1)
  const limit = 20

  const { data: postsData, mutate: mutatePosts, isLoading } = useSWR(
    `/api/team-posts?page=${page}&limit=${limit}`,
    (url: string) => fetch(url).then(r => r.json())
  )

  const { data: users = [] } = useSWR<User[]>('/api/users', fetcher)

  const posts: TeamPost[] = postsData?.data || []
  const meta = postsData?.meta || { total: 0, total_pages: 1 }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/team-posts/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error?.message || 'Failed to delete')
      toast.success('Post deleted')
      mutatePosts()
    } catch (err: any) {
      toast.error(err.message || 'Error deleting post')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-600/10 p-2 text-indigo-500">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Team Information</h1>
            <p className="text-sm text-muted-foreground">
              Share updates, files, and images with specific team members or the whole team.
            </p>
          </div>
        </div>
      </div>

      {/* Composer */}
      <PostComposer
        users={users.filter(u => u.id !== user?.id)}
        onPostCreated={() => { mutatePosts(); setPage(1) }}
      />

      {/* Posts feed */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <LoadingSpinner size="lg" className="border-t-indigo-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-xl">
          <Info className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-base font-semibold text-muted-foreground">No posts yet</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Be the first to share something with the team!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post as any}
              currentUserId={user?.id || ''}
              currentUserRole={user?.role || ''}
              onDelete={handleDelete}
            />
          ))}

          {/* Pagination */}
          {meta.total_pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {(page - 1) * limit + 1}–{Math.min(page * limit, meta.total)} of {meta.total} posts
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-border"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
                  disabled={page === meta.total_pages}
                  className="border-border"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
