'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProspectForm } from '@/components/outreach/ProspectForm'
import {
  Plus,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Trash2,
  SlidersHorizontal,
  Mail,
  Grid,
  List,
  Calendar,
  User as UserIcon,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { OUTREACH_STAGE_LABELS, OUTREACH_STAGE_COLORS } from '@/lib/constants'
import type { OutreachProspect, OutreachPipelineStage, User } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

const KANBAN_STAGES: OutreachPipelineStage[] = [
  'identified',
  'contacted',
  'followed_up',
  'negotiating',
  'placed',
  'rejected',
]

const STAGE_BORDER_COLORS: Record<OutreachPipelineStage, string> = {
  identified: 'border-t-gray-500',
  contacted: 'border-t-blue-500',
  followed_up: 'border-t-purple-500',
  negotiating: 'border-t-orange-500',
  placed: 'border-t-green-500',
  rejected: 'border-t-red-500',
}

const STAGE_BG_COLORS: Record<OutreachPipelineStage, string> = {
  identified: 'bg-gray-500/10 text-gray-400',
  contacted: 'bg-blue-500/10 text-blue-400',
  followed_up: 'bg-purple-500/10 text-purple-400',
  negotiating: 'bg-orange-500/10 text-orange-400',
  placed: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
}

export default function OutreachPage() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()

  // View Preference State (Default: Kanban)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // Filters State
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [assignedFilter, setAssignedFilter] = useState<string>('all')
  const [nicheFilter, setNicheFilter] = useState<string>('all')
  const [daMin, setDaMin] = useState<string>('')
  const [daMax, setDaMax] = useState<string>('')
  const [sortBy, setSortBy] = useState('next_followup_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modals / Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<OutreachProspect | null>(null)
  
  // Placed Prospect modal state
  const [isPlacedModalOpen, setIsPlacedModalOpen] = useState(false)
  const [placedProspectId, setPlacedProspectId] = useState<string | null>(null)
  const [placedProspectName, setPlacedProspectName] = useState<string>('')
  const [placedProspectDA, setPlacedProspectDA] = useState<number>(0)
  const [placedProspectUrl, setPlacedProspectUrl] = useState<string>('')

  // Load view mode from local storage
  useEffect(() => {
    const saved = localStorage.getItem('seo-os-outreach-view')
    if (saved === 'list' || saved === 'kanban') {
      setViewMode(saved)
    }
  }, [])

  // Save view mode
  const handleViewModeChange = (mode: 'kanban' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('seo-os-outreach-view', mode)
    // Adjust limits based on view mode
    if (mode === 'kanban') {
      setLimit(100) // Fetch more in kanban
    } else {
      setLimit(20) // Normal pagination size for list
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
    stageFilter && stageFilter !== 'all' ? `stage=${stageFilter}` : '',
    assignedFilter && assignedFilter !== 'all' ? `assigned_to=${assignedFilter}` : '',
    nicheFilter && nicheFilter !== 'all' ? `niche=${encodeURIComponent(nicheFilter)}` : '',
    daMin ? `daMin=${daMin}` : '',
    daMax ? `daMax=${daMax}` : '',
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR hooks
  const { data: listData, error: listError, mutate: mutateList } = useSWR(
    `/api/outreach?${queryString}`,
    fetcher
  )

  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR(
    '/api/outreach/stats',
    fetcher
  )

  const { data: users } = useSWR<User[]>('/api/users', fetcher)

  const prospects = listData?.data || []
  const meta = listData?.meta || { total: 0, total_pages: 1 }

  // Overdue follow-up check helper
  const isOverdue = (prospect: OutreachProspect) => {
    if (!prospect.next_followup_date) return false
    const todayStr = new Date().toISOString().split('T')[0] || ''
    return (
      prospect.next_followup_date < todayStr &&
      prospect.pipeline_stage !== 'placed' &&
      prospect.pipeline_stage !== 'rejected'
    )
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDrop = async (e: React.DragEvent, targetStage: OutreachPipelineStage) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return

    const prospect = prospects.find((p: OutreachProspect) => p.id === id)
    if (!prospect || prospect.pipeline_stage === targetStage) return

    // Optimistic UI update
    const previousList = listData
    if (listData) {
      const updated = prospects.map((p: OutreachProspect) =>
        p.id === id ? { ...p, pipeline_stage: targetStage } : p
      )
      mutateList({ ...listData, data: updated }, false)
    }

    try {
      const res = await fetch(`/api/outreach/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: targetStage }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update stage')
      }

      toast.success(`Stage updated to ${OUTREACH_STAGE_LABELS[targetStage]}`)
      mutateList()
      mutateStats()
      mutate('/api/dashboard/stats')

      // Trigger placements popup modal
      if (targetStage === 'placed') {
        const updatedProspect = result.data || prospect
        setPlacedProspectId(updatedProspect.id)
        setPlacedProspectName(updatedProspect.site_name)
        setPlacedProspectDA(updatedProspect.domain_authority)
        setPlacedProspectUrl(updatedProspect.url)
        setIsPlacedModalOpen(true)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating stage')
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
    if (!window.confirm('Are you sure you want to delete this prospect? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/outreach/${id}`, { method: 'DELETE' })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to delete prospect')
      }

      toast.success('Prospect deleted successfully')
      mutateList()
      mutateStats()
      mutate('/api/dashboard/stats')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting prospect')
    }
  }

  const handleCreateGuestPostRedirect = () => {
    setIsPlacedModalOpen(false)
    if (placedProspectId) {
      router.push(`/guest-posts?new=true&prospect_id=${placedProspectId}&site_name=${encodeURIComponent(placedProspectName)}&da=${placedProspectDA}&url=${encodeURIComponent(placedProspectUrl)}`)
    }
  }

  const handleAddClick = () => {
    setSelectedProspect(null)
    setIsFormOpen(true)
  }

  const handleEditClick = (e: React.MouseEvent, prospect: OutreachProspect) => {
    e.stopPropagation()
    setSelectedProspect(prospect)
    setIsFormOpen(true)
  }

  const handleCardClick = (id: string) => {
    router.push(`/outreach/${id}`)
  }

  const isLoading = !listData && !listError
  const niches = ['All Niches', 'Travel', 'India', 'General', 'Tech', 'Food', 'Culture', 'Finance']

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Outreach Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Manage relationships, follow-up dates, and email placements with target blogs.
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
            onClick={handleAddClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Prospect
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Prospects</p>
          <h3 className="text-2xl font-bold mt-1 text-foreground">{statsData?.active_count ?? 0}</h3>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Follow-Ups Due</p>
          <div className="flex items-center gap-2 mt-1">
            <h3 className={cn(
              "text-2xl font-bold",
              (statsData?.follow_ups_due_today ?? 0) > 0 ? "text-red-500" : "text-foreground"
            )}>
              {statsData?.follow_ups_due_today ?? 0}
            </h3>
            {(statsData?.follow_ups_due_today ?? 0) > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Placements</p>
          <h3 className="text-2xl font-bold mt-1 text-green-500">
            {statsData?.stage_breakdown?.placed ?? 0}
          </h3>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversion Rate</p>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-2xl font-bold text-foreground">{statsData?.conversion_rate ?? 0}%</h3>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card/40 border border-border rounded-lg p-4 backdrop-blur-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by site name or URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-input"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-3">
            <Select value={stageFilter} onValueChange={(val) => { setStageFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[150px] bg-background border-input">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="all">All Stages</SelectItem>
                {Object.entries(OUTREACH_STAGE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assignedFilter} onValueChange={(val) => { setAssignedFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[150px] bg-background border-input">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={nicheFilter} onValueChange={(val) => { setNicheFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[150px] bg-background border-input">
                <SelectValue placeholder="Niche" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {niches.map((n) => (
                  <SelectItem key={n} value={n === 'All Niches' ? 'all' : n}>{n}</SelectItem>
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
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {KANBAN_STAGES.map((stage) => {
            const stageProspects = prospects.filter((p: OutreachProspect) => p.pipeline_stage === stage)

            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, stage)}
                className="flex flex-col bg-card/30 border border-border/80 rounded-lg p-3 min-w-[220px] max-h-[700px] overflow-y-auto"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-3">
                  <span className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: OUTREACH_STAGE_COLORS[stage] }}
                    />
                    {OUTREACH_STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {stageProspects.length}
                  </span>
                </div>

                {/* Card List */}
                <div className="space-y-3 flex-1">
                  {stageProspects.length === 0 ? (
                    <div className="h-20 flex items-center justify-center border border-dashed border-border/40 rounded-lg text-xs text-muted-foreground/60">
                      Drop prospects here
                    </div>
                  ) : (
                    stageProspects.map((prospect: OutreachProspect) => {
                      const isCardOverdue = isOverdue(prospect)
                      const assigneeInitials = prospect.assignee?.full_name
                        ? prospect.assignee.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : ''

                      return (
                        <div
                          key={prospect.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, prospect.id)}
                          onClick={() => handleCardClick(prospect.id)}
                          className={cn(
                            'group relative flex flex-col bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition-all duration-150',
                            isCardOverdue && 'border-red-500/50 bg-red-950/5'
                          )}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="font-semibold text-sm text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                              {prospect.site_name}
                            </h4>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                                DA {prospect.domain_authority}
                              </span>
                            </div>
                          </div>

                          <a
                            href={prospect.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1 truncate"
                          >
                            <ExternalLink className="h-3 w-3 inline-shrink-0" />
                            <span className="truncate">{prospect.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          </a>

                          {prospect.niche && (
                            <div className="mt-2">
                              <span className="text-[10px] bg-secondary text-secondary-foreground font-medium px-2 py-0.5 rounded-full">
                                {prospect.niche}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50 text-[11px]">
                            {/* Follow-up indicator */}
                            {prospect.next_followup_date ? (
                              <div className={cn(
                                "flex items-center gap-1",
                                isCardOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
                              )}>
                                <Calendar className="h-3 w-3" />
                                <span>
                                  {isCardOverdue ? 'Overdue' : prospect.next_followup_date}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60">No follow-up</span>
                            )}

                            {/* Assignee Avatar */}
                            {prospect.assignee ? (
                              <div
                                className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[9px] cursor-help"
                                title={`Assigned to ${prospect.assignee.full_name}`}
                              >
                                {assigneeInitials}
                              </div>
                            ) : (
                              <div
                                className="h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center cursor-help"
                                title="Unassigned"
                              >
                                <UserIcon className="h-3 w-3" />
                              </div>
                            )}
                          </div>

                          {/* Quick delete for admin only */}
                          {user?.role === 'admin' && (
                            <button
                              onClick={(e) => handleDelete(e, prospect.id)}
                              className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-background border border-border text-muted-foreground hover:text-red-500 rounded"
                              title="Delete Prospect"
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
                  <TableHead>Website</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>DA</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>Next Follow-Up</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBodySkeleton columns={7} rows={5} />
            </Table>
          ) : prospects.length === 0 ? (
            <EmptyState
              title="No prospects found"
              description="Try adjusting your filters or add a new outreach prospect."
              actionLabel="Add Prospect"
              onAction={handleAddClick}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border">
                    <TableHead className="cursor-pointer" onClick={() => handleSort('site_name')}>Website</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('pipeline_stage')}>Stage</TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort('domain_authority')}>DA</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('niche')}>Niche</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('next_followup_date')}>Next Follow-Up</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((prospect: OutreachProspect) => {
                    const isCardOverdue = isOverdue(prospect)
                    return (
                      <TableRow
                        key={prospect.id}
                        className="cursor-pointer hover:bg-muted/50 border-b border-border/50"
                        onClick={() => handleCardClick(prospect.id)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-semibold text-foreground">{prospect.site_name}</div>
                            <a
                              href={prospect.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>{prospect.url}</span>
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium border border-current",
                              STAGE_BG_COLORS[prospect.pipeline_stage]
                            )}
                          >
                            {OUTREACH_STAGE_LABELS[prospect.pipeline_stage]}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-bold">{prospect.domain_authority}</TableCell>
                        <TableCell>{prospect.niche || '-'}</TableCell>
                        <TableCell className={cn(isCardOverdue && "text-red-500 font-semibold")}>
                          {prospect.next_followup_date || '-'}
                          {isCardOverdue && ' (Overdue)'}
                        </TableCell>
                        <TableCell>{prospect.assignee?.full_name || 'Unassigned'}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={(e) => handleEditClick(e, prospect)}>
                              Edit
                            </Button>
                            {user?.role === 'admin' && (
                              <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, prospect.id)} className="text-red-500 hover:text-red-600">
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
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} prospects
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

      {/* Form Drawer */}
      <ProspectForm
        prospect={selectedProspect}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          mutateList()
          mutateStats()
          mutate('/api/dashboard/stats')
        }}
      />

      {/* Placed Guest Post Prompt Modal */}
      <Dialog open={isPlacedModalOpen} onOpenChange={setIsPlacedModalOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500 mb-2">
              <TrendingUp className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Prospect Placement Placed!</DialogTitle>
            <DialogDescription className="text-center text-sm mt-1">
              Would you like to create a **Guest Post** record for this placement at **{placedProspectName}**?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPlacedModalOpen(false)}
              className="border-border hover:bg-accent hover:text-accent-foreground w-24"
            >
              No
            </Button>
            <Button
              type="button"
              onClick={handleCreateGuestPostRedirect}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-24"
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
