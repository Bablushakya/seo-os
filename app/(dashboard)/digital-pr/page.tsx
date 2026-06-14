'use client'

import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { EmptyState, MODULE_EMPTY_STATES } from '@/components/shared/EmptyState'
import { CampaignForm } from '@/components/digital-pr/CampaignForm'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Newspaper,
  Users,
  Activity,
  Globe,
  TrendingUp,
  ArrowUpDown,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { PR_CAMPAIGN_STATUS_LABELS } from '@/lib/constants'
import type { PRCampaign, PRCampaignStatus } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function DigitalPRDashboard() {
  const { user } = useAuth()
  const router = useRouter()

  // State
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Form & Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<PRCampaign | null>(null)

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
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR Hooks
  const { data: listData, error: listError, mutate: mutateList } = useSWR(
    `/api/digital-pr/campaigns?${queryString}`,
    fetcher
  )

  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR(
    '/api/digital-pr/stats',
    fetcher
  )

  const campaigns = listData?.data || []
  const meta = listData?.meta || { total: 0, total_pages: 1 }
  const isLoading = !listData && !listError

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const handleAddClick = () => {
    setSelectedCampaign(null)
    setIsFormOpen(true)
  }

  const handleEditClick = (e: React.MouseEvent, campaign: PRCampaign) => {
    e.stopPropagation()
    setSelectedCampaign(campaign)
    setIsFormOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const isAdminUser = user?.role === 'admin'
    if (!isAdminUser) {
      toast.error('Only administrators can delete PR campaigns.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this PR campaign? All placements under this campaign will be deleted. This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/digital-pr/campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error?.message || 'Failed to delete campaign')
      }

      toast.success('PR Campaign deleted successfully')
      mutateList()
      mutateStats()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting PR campaign')
    }
  }

  const refreshAll = () => {
    mutateList()
    mutateStats()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Digital PR</h1>
          <p className="text-sm text-muted-foreground">
            Track PR campaigns (HARO, data studies) and log links earned from news publications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            onClick={handleAddClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Tabs / Subnavigation */}
      <div className="border-b border-border flex gap-4">
        <Link
          href="/digital-pr"
          className="border-b-2 border-primary pb-2 px-1 text-sm font-medium text-foreground transition-all"
        >
          Campaigns
        </Link>
        <Link
          href="/digital-pr/contacts"
          className="border-b-2 border-transparent pb-2 px-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all"
        >
          Media Contacts
        </Link>
      </div>

      {/* Stats KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card/40 border border-border/80 rounded-xl backdrop-blur-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Campaigns</p>
            <h3 className="text-3xl font-bold mt-1.5">{statsData?.total_campaigns ?? 0}</h3>
          </div>
          <div className="rounded-xl bg-blue-500/10 p-3">
            <Newspaper className="h-6 w-6 text-blue-500" />
          </div>
        </div>

        <div className="bg-card/40 border border-border/80 rounded-xl backdrop-blur-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Placements</p>
            <h3 className="text-3xl font-bold mt-1.5">{statsData?.total_placements ?? 0}</h3>
          </div>
          <div className="rounded-xl bg-green-500/10 p-3">
            <Globe className="h-6 w-6 text-green-500" />
          </div>
        </div>

        <div className="bg-card/40 border border-border/80 rounded-xl backdrop-blur-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Overall Reach</p>
            <h3 className="text-3xl font-bold mt-1.5">
              {statsData?.total_reach ? statsData.total_reach.toLocaleString() : 0}
            </h3>
          </div>
          <div className="rounded-xl bg-purple-500/10 p-3">
            <TrendingUp className="h-6 w-6 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end">
        {/* Search */}
        <div className="space-y-1.5 flex-1 w-full">
          <Label htmlFor="search" className="text-xs font-medium">Search Campaigns</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              type="text"
              placeholder="Search by campaign name or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-background border-input w-full"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-1.5 w-full md:w-[200px]">
          <Label htmlFor="status" className="text-xs font-medium">Status</Label>
          <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
            <SelectTrigger id="status" className="bg-background border-input">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all" className="focus:bg-accent focus:text-accent-foreground">All Statuses</SelectItem>
              {Object.entries(PR_CAMPAIGN_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key} className="focus:bg-accent focus:text-accent-foreground">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border">
                <TableHead>Campaign Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Launch Date</TableHead>
                <TableHead className="text-right">Placements</TableHead>
                <TableHead className="text-right">Est. Reach</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBodySkeleton columns={6} rows={5} />
          </Table>
        ) : campaigns.length === 0 ? (
          <EmptyState
            title={MODULE_EMPTY_STATES.digitalPR.title}
            description={MODULE_EMPTY_STATES.digitalPR.description}
            actionLabel={MODULE_EMPTY_STATES.digitalPR.actionLabel}
            onAction={handleAddClick}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('campaign_name')}>
                    <div className="flex items-center gap-1.5">
                      Campaign Name
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1.5">
                      Status
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('launch_date')}>
                    <div className="flex items-center gap-1.5">
                      Launch Date
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Placements</TableHead>
                  <TableHead className="text-right">Est. Reach</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c: any) => {
                  const statusColors: Record<PRCampaignStatus, string> = {
                    planning: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                    completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                    paused: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                  }

                  return (
                    <TableRow
                      key={c.id}
                      onClick={() => router.push(`/digital-pr/${c.id}`)}
                      className="cursor-pointer border-b border-border hover:bg-muted/20 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <div>
                          <span className="hover:underline text-foreground block">{c.campaign_name}</span>
                          {c.topic && <span className="text-xs text-muted-foreground font-normal">{c.topic}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColors[c.status as PRCampaignStatus] || ''}`}>
                          {PR_CAMPAIGN_STATUS_LABELS[c.status as PRCampaignStatus] || c.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.launch_date ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {c.launch_date}
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {c.placement_count ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground text-sm">
                        {c.total_reach ? c.total_reach.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleEditClick(e, c)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          >
                            Edit
                          </Button>
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDelete(e, c.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Section */}
        {!isLoading && meta.total_pages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} campaigns
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 border-border"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
                disabled={page === meta.total_pages}
                className="h-8 border-border"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Campaign side Sheet */}
      <CampaignForm
        campaign={selectedCampaign}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={refreshAll}
      />
    </div>
  )
}
