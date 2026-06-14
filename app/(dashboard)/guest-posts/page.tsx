'use client'

import React, { useState, useEffect, Suspense } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner, TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { GuestPostForm } from '@/components/guest-posts/GuestPostForm'
import { AITopicGenerator } from '@/components/guest-posts/AITopicGenerator'
import {
  Plus,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Trash2,
  SlidersHorizontal,
  FileText,
  Grid,
  List,
  Calendar,
  User as UserIcon,
  AlignLeft,
  Key,
  Link2,
  Globe,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { GUEST_POST_STATUSES, GUEST_POST_STATUS_LABELS, GUEST_POST_STATUS_COLORS } from '@/lib/constants'
import type { GuestPost, GuestPostStatus, User } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

function GuestPostsContent() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const searchParams = useSearchParams()

  // View Preference State (Default: Kanban)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // Filters State
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [authorFilter, setAuthorFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [daMin, setDaMin] = useState<string>('')
  const [daMax, setDaMax] = useState<string>('')
  const [sortBy, setSortBy] = useState('publish_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals / Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isAITopicModalOpen, setIsAITopicModalOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<GuestPost | null>(null)

  // Load view mode preference
  useEffect(() => {
    const saved = localStorage.getItem('seo-os-guest-posts-view')
    if (saved === 'list' || saved === 'kanban') {
      setViewMode(saved)
    }
  }, [])

  // Auto-open form drawer when ?new=true query param is present (redirected from Placement stage transition)
  useEffect(() => {
    const isNew = searchParams.get('new') === 'true'
    if (isNew) {
      setSelectedPost(null)
      setIsFormOpen(true)
    }
  }, [searchParams])

  const handleViewModeChange = (mode: 'kanban' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('seo-os-guest-posts-view', mode)
    if (mode === 'kanban') {
      setLimit(100)
    } else {
      setLimit(20)
    }
    setPage(1)
  }

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Build query parameters
  const queryParts = [
    `page=${page}`,
    `limit=${limit}`,
    sortBy ? `sortBy=${sortBy}` : '',
    sortOrder ? `sortOrder=${sortOrder}` : '',
    debouncedSearch ? `search=${encodeURIComponent(debouncedSearch)}` : '',
    statusFilter && statusFilter !== 'all' ? `status=${statusFilter}` : '',
    authorFilter && authorFilter !== 'all' ? `author=${authorFilter}` : '',
    monthFilter && monthFilter !== 'all' ? `month=${monthFilter}` : '',
    daMin ? `daMin=${daMin}` : '',
    daMax ? `daMax=${daMax}` : '',
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR hooks
  const { data: listData, error: listError, mutate: mutateList } = useSWR(
    `/api/guest-posts?${queryString}`,
    fetcher
  )

  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR(
    '/api/guest-posts/stats',
    fetcher
  )

  const { data: users } = useSWR<User[]>('/api/users', fetcher)

  const posts = listData?.data || []
  const meta = listData?.meta || { total: 0, total_pages: 1 }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: GuestPostStatus) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return

    const post = posts.find((p: GuestPost) => p.id === id)
    if (!post || post.status === targetStatus) return

    // Optimistic UI update
    const previousList = listData
    if (listData) {
      const updated = posts.map((p: GuestPost) =>
        p.id === id ? { ...p, status: targetStatus } : p
      )
      mutateList({ ...listData, data: updated }, false)
    }

    try {
      const res = await fetch(`/api/guest-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update status')
      }

      toast.success(`Status updated to ${GUEST_POST_STATUS_LABELS[targetStatus]}`)
      mutateList()
      mutateStats()
      mutate('/api/dashboard/stats')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating status')
      mutateList(previousList, false)
    }
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this guest post listing? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/guest-posts/${id}`, { method: 'DELETE' })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to delete listing')
      }

      toast.success('Guest post deleted successfully')
      mutateList()
      mutateStats()
      mutate('/api/dashboard/stats')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting guest post')
    }
  }

  const handleEditClick = (post: GuestPost) => {
    setSelectedPost(post)
    setIsFormOpen(true)
  }

  const handleAddClick = () => {
    setSelectedPost(null)
    // Clear redirect parameters if any exist in the browser URL
    if (searchParams.get('new')) {
      router.replace('/guest-posts')
    }
    setIsFormOpen(true)
  }

  const isLoading = !listData && !listError

  // Generate last 6 months list for filter
  const getMonthOptions = () => {
    const options = []
    const date = new Date()
    for (let i = 0; i < 6; i++) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const label = date.toLocaleString('default', { month: 'long', year: 'numeric' })
      options.push({ value: `${y}-${m}`, label })
      date.setMonth(date.getMonth() - 1)
    }
    return options
  }
  const months = getMonthOptions()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Guest Post Publishing</h1>
          <p className="text-sm text-muted-foreground">
            Track writing pipeline, target keywords, doc links, and live placements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="flex border border-border rounded-md overflow-hidden bg-card/50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewModeChange('kanban')}
              className={cn(
                'rounded-none h-9 w-9 px-0',
                viewMode === 'kanban' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground'
              )}
              title="Kanban Board"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewModeChange('list')}
              className={cn(
                'rounded-none h-9 w-9 px-0',
                viewMode === 'list' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground'
              )}
              title="List Table"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => setIsAITopicModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            AI Topic Ideas
          </Button>
          <Button
            onClick={handleAddClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Guest Post
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Listings</p>
          <h3 className="text-2xl font-bold mt-1 text-foreground">{statsData?.total ?? 0}</h3>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live & Published</p>
          <h3 className="text-2xl font-bold mt-1 text-green-500">
            {statsData?.total_live ?? 0}
          </h3>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg. Live DA</p>
          <h3 className="text-2xl font-bold mt-1 text-blue-500">
            {statsData?.average_da_live ?? 0}
          </h3>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Output</p>
          <h3 className="text-2xl font-bold mt-1 text-indigo-400">
            {statsData?.monthly_output ?? 0}
          </h3>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card/40 border border-border rounded-lg p-4 backdrop-blur-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, target site, topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-input"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-3">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[150px] bg-background border-input">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(GUEST_POST_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={authorFilter} onValueChange={(val) => { setAuthorFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[150px] bg-background border-input">
                <SelectValue placeholder="Author" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="all">All Authors</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={(val) => { setMonthFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[150px] bg-background border-input">
                <SelectValue placeholder="Publish Month" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="all">All Months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 w-full lg:w-[180px]">
              <Input
                placeholder="Min DA"
                type="number"
                value={daMin}
                onChange={(e) => { setDaMin(e.target.value); setPage(1); }}
                className="w-1/2 bg-background border-input text-xs"
              />
              <span className="text-muted-foreground text-xs">-</span>
              <Input
                placeholder="Max DA"
                type="number"
                value={daMax}
                onChange={(e) => { setDaMax(e.target.value); setPage(1); }}
                className="w-1/2 bg-background border-input text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Board or List */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {GUEST_POST_STATUSES.map((status) => {
            const statusPosts = posts.filter((p: GuestPost) => p.status === status)

            return (
              <div
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, status)}
                className="flex flex-col bg-card/30 border border-border/80 rounded-lg p-3 min-w-[220px] max-h-[700px] overflow-y-auto"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-3">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground truncate">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: GUEST_POST_STATUS_COLORS[status] }}
                    />
                    {GUEST_POST_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {statusPosts.length}
                  </span>
                </div>

                {/* Card List */}
                <div className="space-y-3 flex-1">
                  {statusPosts.length === 0 ? (
                    <div className="h-20 flex items-center justify-center border border-dashed border-border/40 rounded-lg text-xs text-muted-foreground/60">
                      Drop articles here
                    </div>
                  ) : (
                    statusPosts.map((post: GuestPost) => {
                      const authorUser = users?.find((u) => u.id === post.author)
                      const initials = authorUser
                        ? authorUser.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : ''

                      return (
                        <div
                          key={post.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, post.id)}
                          onClick={() => handleEditClick(post)}
                          className="group relative flex flex-col bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition-all duration-150"
                        >
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="font-semibold text-xs text-foreground line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                              {post.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 mt-2">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[11px] text-muted-foreground font-medium truncate">
                              {post.target_site}
                            </span>
                            <span className="text-[10px] bg-accent text-accent-foreground px-1 py-0.2 rounded font-bold shrink-0">
                              DA {post.target_da}
                            </span>
                          </div>

                          {post.target_keyword && (
                            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground truncate">
                              <Key className="h-3 w-3 shrink-0" />
                              <span className="truncate italic">"{post.target_keyword}"</span>
                            </div>
                          )}

                          {post.doc_link && (
                            <a
                              href={post.doc_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-2"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Google Doc</span>
                            </a>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50 text-[10px]">
                            {/* Publish Date */}
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{post.publish_date || 'No date'}</span>
                            </div>

                            {/* Author Initials */}
                            {authorUser ? (
                              <div
                                className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[9px]"
                                title={`Author: ${authorUser.full_name}`}
                              >
                                {initials}
                              </div>
                            ) : (
                              <div
                                className="h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center"
                                title="Unassigned"
                              >
                                <UserIcon className="h-3 w-3" />
                              </div>
                            )}
                          </div>

                          {/* Quick delete for admin only */}
                          {user?.role === 'admin' && (
                            <button
                              onClick={(e) => handleDelete(e, post.id)}
                              className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-background border border-border text-muted-foreground hover:text-red-500 rounded"
                              title="Delete Listing"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article Title</TableHead>
                  <TableHead>Target Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Publish/Target Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBodySkeleton columns={7} rows={5} />
            </Table>
          ) : posts.length === 0 ? (
            <EmptyState
              title="No guest posts found"
              description="Try adjusting your filters or add a new guest post listing."
              actionLabel="Add Guest Post"
              onAction={handleAddClick}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border">
                    <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>Article Title</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('target_site')}>Target Site</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>Status</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('target_keyword')}>Keyword</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('publish_date')}>Publish Date</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post: GuestPost) => {
                    const authorUser = users?.find((u) => u.id === post.author)
                    return (
                      <TableRow
                        key={post.id}
                        className="cursor-pointer hover:bg-muted/50 border-b border-border/50"
                        onClick={() => handleEditClick(post)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-semibold text-foreground">{post.title}</div>
                            {post.doc_link && (
                              <a
                                href={post.doc_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                              >
                                <FileText className="h-3 w-3" />
                                <span>Doc Link</span>
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-foreground">{post.target_site}</div>
                            <span className="text-[10px] bg-accent text-accent-foreground px-1 py-0.2 rounded font-bold shrink-0 mt-0.5 inline-block">
                              DA {post.target_da}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-xs px-2.5 py-0.5 rounded-full font-medium border border-current"
                            style={{
                              color: GUEST_POST_STATUS_COLORS[post.status],
                              backgroundColor: `${GUEST_POST_STATUS_COLORS[post.status]}10`,
                            }}
                          >
                            {GUEST_POST_STATUS_LABELS[post.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          {post.target_keyword ? (
                            <span className="text-sm italic">"{post.target_keyword}"</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{post.publish_date || '-'}</TableCell>
                        <TableCell>{authorUser?.full_name || '-'}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(post)}>
                              Edit
                            </Button>
                            {user?.role === 'admin' && (
                              <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, post.id)} className="text-red-500 hover:text-red-600">
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {/* Pagination */}
              {meta.total_pages > 1 && (
                <div className="flex justify-between items-center p-4 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} articles
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-border hover:bg-accent hover:text-accent-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                      disabled={page === meta.total_pages}
                      className="border-border hover:bg-accent hover:text-accent-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Guest Post Form Drawer */}
      <GuestPostForm
        post={selectedPost}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          mutateList()
          mutateStats()
          mutate('/api/dashboard/stats')
        }}
      />

      {/* AI Topic Generator Modal */}
      <AITopicGenerator
        isOpen={isAITopicModalOpen}
        onClose={() => setIsAITopicModalOpen(false)}
        onSuccess={(createdPost) => {
          setIsAITopicModalOpen(false)
          setSelectedPost(createdPost)
          setIsFormOpen(true)
          mutateList()
          mutateStats()
        }}
      />
    </div>
  )
}

export default function GuestPostsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" className="border-t-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading guest posts...</p>
      </div>
    }>
      <GuestPostsContent />
    </Suspense>
  )
}
