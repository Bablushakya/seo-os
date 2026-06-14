'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { CitationForm } from '@/components/citations/CitationForm'
import { CitationImportModal } from '@/components/citations/CitationImportModal'
import { TaskForm } from '@/components/tasks/TaskForm'
import {
  Plus,
  Upload,
  Download,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Trash2,
  SlidersHorizontal,
  Building2,
  CheckCircle,
  Clock,
  Send,
  CheckSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { CITATION_STATUS_LABELS, CITATION_STATUS_COLORS } from '@/lib/constants'
import type { Citation, CitationStatus } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function CitationsPage() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()

  // State
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [niche, setNiche] = useState<string>('all')
  const [daMin, setDaMin] = useState<string>('')
  const [daMax, setDaMax] = useState<string>('')
  const [sortBy, setSortBy] = useState('directory_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Form & Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)
  const [prefilledCitationId, setPrefilledCitationId] = useState<string | null>(null)

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Build query string
  const queryParts = [
    `page=${page}`,
    `limit=${limit}`,
    sortBy ? `sortBy=${sortBy}` : '',
    sortOrder ? `sortOrder=${sortOrder}` : '',
    debouncedSearch ? `search=${encodeURIComponent(debouncedSearch)}` : '',
    status && status !== 'all' ? `status=${status}` : '',
    niche && niche !== 'all' ? `niche=${encodeURIComponent(niche)}` : '',
    daMin ? `daMin=${daMin}` : '',
    daMax ? `daMax=${daMax}` : '',
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR Hooks
  const { data: listData, error: listError, mutate: mutateList } = useSWR(
    `/api/citations?${queryString}`,
    fetcher
  )

  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR(
    '/api/citations/stats',
    fetcher
  )

  const citations = listData?.data || []
  const meta = listData?.meta || { total: 0, total_pages: 1 }

  // Unique niches from all data or hardcoded sensible list for search filter
  const niches = ['All Niches', 'General', 'Local', 'Travel', 'India', 'UK', 'USA', 'Real Estate', 'Tech', 'Finance']

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  // Delete Handler
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // Prevent row click
    if (!window.confirm('Are you sure you want to delete this citation? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/citations/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error?.message || 'Failed to delete citation')
      }

      toast.success('Citation deleted successfully')
      mutateList()
      mutateStats()
      mutate('/api/dashboard/stats')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting citation')
    }
  }

  // Inline Status Change Handler with Optimistic UI
  const handleStatusChange = async (citationId: string, newStatus: CitationStatus) => {
    const previousList = listData
    const previousStats = statsData

    // Optimistically update list
    if (listData) {
      const updatedCitations = citations.map((c: Citation) =>
        c.id === citationId ? { ...c, status: newStatus } : c
      )
      mutateList({ ...listData, data: updatedCitations }, false)
    }

    try {
      const res = await fetch(`/api/citations/${citationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update status')
      }

      toast.success('Status updated successfully')
      mutateList()
      mutateStats()
      mutate('/api/dashboard/stats')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating status')
      // Rollback
      mutateList(previousList, false)
      mutateStats(previousStats, false)
    }
  }

  // Export CSV Handler
  const handleExportCSV = () => {
    // Generate export URL with identical filters
    const exportUrl = `/api/citations/export?${queryParts.filter(p => !p.startsWith('page') && !p.startsWith('limit')).join('&')}`
    window.open(exportUrl, '_blank')
  }

  const handleEditClick = (citation: Citation) => {
    setSelectedCitation(citation)
    setIsFormOpen(true)
  }

  const handleAddTaskClick = (e: React.MouseEvent, citation: Citation) => {
    e.stopPropagation()
    setPrefilledCitationId(citation.id)
    setIsTaskFormOpen(true)
  }

  const handleAddClick = () => {
    setSelectedCitation(null)
    setIsFormOpen(true)
  }

  const refreshAll = () => {
    mutateList()
    mutateStats()
    mutate('/api/dashboard/stats')
  }

  const isLoading = !listData && !listError

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Citations</h1>
          <p className="text-sm text-muted-foreground">
            Track business listings and directory citation building activities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="border-border hover:bg-accent hover:text-accent-foreground text-sm font-medium"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            onClick={handleAddClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Citation
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card/40 border-border backdrop-blur-sm">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Citations</p>
              <h3 className="text-2xl font-bold mt-1">{statsData?.total ?? 0}</h3>
            </div>
            <div className="rounded-full bg-blue-500/10 p-2.5">
              <Building2 className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-card/40 border-border backdrop-blur-sm">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Listings</p>
              <h3 className="text-2xl font-bold mt-1">
                {statsData?.live_count ?? 0}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  ({statsData?.live_percentage ?? 0}%)
                </span>
              </h3>
            </div>
            <div className="rounded-full bg-green-500/10 p-2.5">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-card/40 border-border backdrop-blur-sm">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending</p>
              <h3 className="text-2xl font-bold mt-1">{statsData?.pending_count ?? 0}</h3>
            </div>
            <div className="rounded-full bg-amber-500/10 p-2.5">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </div>

        <div className="bg-card/40 border-border backdrop-blur-sm">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted</p>
              <h3 className="text-2xl font-bold mt-1">{statsData?.submitted_count ?? 0}</h3>
            </div>
            <div className="rounded-full bg-cyan-500/10 p-2.5">
              <Send className="h-5 w-5 text-cyan-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border-border">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-end">
          {/* Search */}
          <div className="space-y-1.5 flex-1 w-full">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                type="text"
                placeholder="Search directory name or URL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background border-input w-full"
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="space-y-1.5 w-full md:w-[180px]">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
              <SelectTrigger id="status" className="bg-background border-input">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(CITATION_STATUS_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Niche Dropdown */}
          <div className="space-y-1.5 w-full md:w-[180px]">
            <Label htmlFor="niche">Niche</Label>
            <Select value={niche} onValueChange={(val) => { setNiche(val); setPage(1); }}>
              <SelectTrigger id="niche" className="bg-background border-input">
                <SelectValue placeholder="All Niches" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {niches.map(n => (
                  <SelectItem key={n} value={n === 'All Niches' ? 'all' : n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DA Range min/max */}
          <div className="space-y-1.5 w-full md:w-[220px]">
            <Label className="flex items-center">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
              DA Range (0-100)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                min="0"
                max="100"
                value={daMin}
                onChange={(e) => { setDaMin(e.target.value); setPage(1); }}
                className="bg-background border-input w-full text-center"
              />
              <span className="text-muted-foreground text-xs font-semibold">to</span>
              <Input
                type="number"
                placeholder="Max"
                min="0"
                max="100"
                value={daMax}
                onChange={(e) => { setDaMax(e.target.value); setPage(1); }}
                className="bg-background border-input w-full text-center"
              />
            </div>
          </div>

          {/* Export CSV button */}
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="border-border hover:bg-accent hover:text-accent-foreground w-full md:w-auto text-sm font-medium"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Citations Table */}
      <div className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border">
                <TableHead
                  onClick={() => handleSort('directory_name')}
                  className="cursor-pointer select-none hover:bg-muted/70 font-semibold"
                >
                  Directory Name {sortBy === 'directory_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="font-semibold">URL</TableHead>
                <TableHead
                  onClick={() => handleSort('domain_authority')}
                  className="cursor-pointer select-none hover:bg-muted/70 text-center font-semibold"
                >
                  DA {sortBy === 'domain_authority' && (sortOrder === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="font-semibold">Niche</TableHead>
                <TableHead className="font-semibold text-center w-[150px]">Status</TableHead>
                <TableHead
                  onClick={() => handleSort('date_submitted')}
                  className="cursor-pointer select-none hover:bg-muted/70 font-semibold"
                >
                  Date Submitted {sortBy === 'date_submitted' && (sortOrder === 'asc' ? '▲' : '▼')}
                </TableHead>
                <TableHead className="w-24 text-center font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableBodySkeleton rows={10} columns={7} />
              ) : citations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <EmptyState
                      title="No citations found"
                      description="Try adjusting your search query or filters to find what you are looking for."
                      actionLabel="Add New Citation"
                      onAction={handleAddClick}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                citations.map((c: Citation) => (
                  <TableRow
                    key={c.id}
                    onClick={() => handleEditClick(c)}
                    className="border-border hover:bg-muted/20 cursor-pointer"
                  >
                    {/* Directory Name */}
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {c.directory_name}
                    </TableCell>

                    {/* URL */}
                    <TableCell onClick={(e) => e.stopPropagation()} className="max-w-[250px] truncate">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-mono text-xs"
                      >
                        {c.url.replace(/^https?:\/\/(www\.)?/, '')}
                        <ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                      </a>
                    </TableCell>

                    {/* DA */}
                    <TableCell className="text-center font-semibold">{c.domain_authority}</TableCell>

                    {/* Niche */}
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border">
                        {c.niche || 'General'}
                      </span>
                    </TableCell>

                    {/* Status inline select */}
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                      <Select
                        value={c.status}
                        onValueChange={(val: CitationStatus) => handleStatusChange(c.id, val)}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-7 w-[130px] mx-auto text-xs px-2.5 font-medium rounded-full border-none',
                            CITATION_STATUS_COLORS[c.status]
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {Object.entries(CITATION_STATUS_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Date Submitted */}
                    <TableCell className="text-muted-foreground text-xs">
                      {c.date_submitted ? new Date(c.date_submitted).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : '-'}
                    </TableCell>

                    {/* Actions */}
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleAddTaskClick(e, c)}
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Create task for this citation"
                        >
                          <CheckSquare className="h-4 w-4" />
                        </Button>
                        {user?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(e, c.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete citation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination bar */}
        {meta.total > limit && (
          <div className="flex justify-between items-center p-4 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} citations
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 border-border"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground px-3">
                Page {page} of {meta.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
                disabled={page === meta.total_pages}
                className="h-8 border-border"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form Drawer (Create / Edit) */}
      <CitationForm
        citation={selectedCitation}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={refreshAll}
      />

      {/* Import Modal */}
      <CitationImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={refreshAll}
      />

      {/* Task Form Drawer */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={() => {
          setIsTaskFormOpen(false)
          setPrefilledCitationId(null)
        }}
        onSuccess={() => {
          toast.success('Task created successfully')
          mutate('/api/dashboard/stats')
        }}
        prefilledModuleType="citation"
        prefilledModuleRecordId={prefilledCitationId || undefined}
      />
    </div>
  )
}
