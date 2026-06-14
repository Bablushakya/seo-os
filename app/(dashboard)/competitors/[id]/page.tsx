'use client'

import React, { useState, useEffect, Suspense } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner, TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { BacklinkImportModal } from '@/components/competitors/BacklinkImportModal'
import { ProspectForm } from '@/components/outreach/ProspectForm'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  Trash2,
  Calendar,
  Globe,
  Database,
  Tag,
  AlertTriangle,
  Upload,
  Plus,
  Mail,
  User as UserIcon,
  CheckCircle,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Competitor, CompetitorBacklink, OutreachProspect } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

interface CompetitorDetail extends Competitor {
  backlink_count: number
  gap_count: number
  tagged_count: number
}

function CompetitorDetailsContent({ id }: { id: string }) {
  const { user } = useAuth()
  const { mutate: globalMutate } = useSWRConfig()
  const router = useRouter()

  // Tab State: 'all' | 'gap' | 'tagged'
  const [activeTab, setActiveTab] = useState<'all' | 'gap' | 'tagged'>('all')

  // Table filters & paging state
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [daMin, setDaMin] = useState('')
  const [daMax, setDaMax] = useState('')
  const [sortBy, setSortBy] = useState('source_da')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isOutreachOpen, setIsOutreachOpen] = useState(false)
  const [prefilledProspect, setPrefilledProspect] = useState<OutreachProspect | null>(null)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Reset page when switching tabs
  const handleTabChange = (tab: 'all' | 'gap' | 'tagged') => {
    setActiveTab(tab)
    setPage(1)
  }

  // Build backlinks query params
  const isGapParam = activeTab === 'gap' ? 'true' : activeTab === 'tagged' ? '' : ''
  const taggedParam = activeTab === 'tagged' ? 'true' : ''

  const queryParts = [
    `page=${page}`,
    `limit=${limit}`,
    sortBy ? `sortBy=${sortBy}` : '',
    sortOrder ? `sortOrder=${sortOrder}` : '',
    debouncedSearch ? `search=${encodeURIComponent(debouncedSearch)}` : '',
    isGapParam ? `is_gap=${isGapParam}` : '',
    taggedParam ? `tagged_for_outreach=${taggedParam}` : '',
    daMin ? `daMin=${daMin}` : '',
    daMax ? `daMax=${daMax}` : '',
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR hooks
  const { data: competitor, error: compError, isLoading: isCompLoading, mutate: mutateCompetitor } = useSWR<CompetitorDetail>(
    `/api/competitors/${id}`,
    fetcher
  )

  const { data: backlinksData, error: blError, isLoading: isBlLoading, mutate: mutateBacklinks } = useSWR(
    `/api/competitors/${id}/backlinks?${queryString}`,
    fetcher
  )

  const backlinks = backlinksData?.data || []
  const meta = backlinksData?.meta || { total: 0, total_pages: 1 }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc') // Default to desc for DA / metrics sorting
    }
    setPage(1)
  }

  // Toggle Tag for Outreach
  const handleToggleTag = async (backlink: CompetitorBacklink) => {
    const newTaggedStatus = !backlink.tagged_for_outreach
    const previousBacklinks = backlinksData

    // Optimistically update backlinks list
    if (backlinksData) {
      const updated = backlinks.map((b: CompetitorBacklink) =>
        b.id === backlink.id ? { ...b, tagged_for_outreach: newTaggedStatus } : b
      )
      mutateBacklinks({ ...backlinksData, data: updated }, false)
    }

    try {
      const res = await fetch(`/api/competitors/${id}/backlinks/${backlink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagged_for_outreach: newTaggedStatus }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update tagging')
      }

      toast.success(newTaggedStatus ? 'Backlink tagged for outreach' : 'Removed outreach tag')
      mutateBacklinks()
      mutateCompetitor()
      globalMutate('/api/competitors')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error toggling outreach tag')
      mutateBacklinks(previousBacklinks, false)
    }
  }

  // Trigger Add to Outreach drawer
  const handleAddToOutreach = (backlink: CompetitorBacklink) => {
    // Construct pre-filled prospect fields
    const mockProspect: any = {
      site_name: backlink.source_domain,
      url: backlink.source_url || `https://${backlink.source_domain}`,
      domain_authority: backlink.source_da,
      niche: competitor?.niche || '',
      last_contact_date: new Date().toISOString().split('T')[0],
      next_followup_date: '',
      pipeline_stage: 'identified',
      notes: `Target acquired from competitor gap analysis of ${competitor?.domain}.\nAnchor text: "${backlink.anchor_text || '-'}"\nLink type: ${backlink.link_type}`,
    }

    setPrefilledProspect(mockProspect)
    setIsOutreachOpen(true)
  }

  // Refresh page on success
  const refreshAllData = () => {
    mutateBacklinks()
    mutateCompetitor()
    globalMutate('/api/competitors')
    globalMutate('/api/competitors/gap-analysis')
  }

  if (compError) {
    return (
      <EmptyState
        title="Competitor not found"
        description="The competitor domain you are trying to view is not currently being tracked."
        actionLabel="Back to Competitors"
        onAction={() => router.push('/competitors')}
      />
    )
  }

  if (isCompLoading || !competitor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" className="border-t-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading competitor details...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/competitors"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Competitors
        </Link>
      </div>

      {/* Detail Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Globe className="h-6 w-6 text-indigo-400 shrink-0" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{competitor.domain}</h1>
            {competitor.niche && (
              <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                {competitor.niche}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {competitor.display_name ? `Brand: ${competitor.display_name}` : 'No brand name set'}
            {competitor.notes && ` • ${competitor.notes}`}
          </p>
        </div>

        <div>
          <Button
            onClick={() => setIsImportOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Backlinks
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Backlinks</p>
          <h3 className="text-2xl font-bold mt-1 text-foreground">{competitor.backlink_count}</h3>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Domain Gaps</p>
          <h3 className="text-2xl font-bold mt-1 text-red-500">{competitor.gap_count}</h3>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tagged for Outreach</p>
          <h3 className="text-2xl font-bold mt-1 text-green-500">{competitor.tagged_count}</h3>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => handleTabChange('all')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[2px]',
            activeTab === 'all'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          All Backlinks ({competitor.backlink_count})
        </button>
        <button
          onClick={() => handleTabChange('gap')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[2px]',
            activeTab === 'gap'
              ? 'border-red-500 text-red-400'
              : 'border-transparent text-muted-foreground hover:text-red-400'
          )}
        >
          Domain Gaps ({competitor.gap_count})
        </button>
        <button
          onClick={() => handleTabChange('tagged')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[2px]',
            activeTab === 'tagged'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-muted-foreground hover:text-green-400'
          )}
        >
          Tagged for Outreach ({competitor.tagged_count})
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-card/40 border border-border rounded-lg p-4 backdrop-blur-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by source domain or anchor text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-input"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 w-[200px]">
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

      {/* Backlink list table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {blError ? (
          <div className="p-8 text-center text-sm text-red-400 bg-card/50">
            Failed to load backlinks list.
          </div>
        ) : isBlLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Domain</TableHead>
                <TableHead className="text-center">DA</TableHead>
                <TableHead>Anchor Text</TableHead>
                <TableHead>Target Page</TableHead>
                <TableHead>Link Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Outreach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBodySkeleton columns={7} rows={6} />
          </Table>
        ) : backlinks.length === 0 ? (
          <EmptyState
            title="No backlinks found"
            description={
              activeTab === 'gap'
                ? "Excellent news! There are no domain gaps in this list (we already have links on all these domains)."
                : activeTab === 'tagged'
                ? "Tag backlink rows with the star icon to keep track of them for email campaigns."
                : "No backlinks imported for this competitor yet. Drag and drop a CSV file to upload."
            }
            actionLabel={activeTab === 'all' ? 'Import Backlinks' : undefined}
            onAction={activeTab === 'all' ? () => setIsImportOpen(true) : undefined}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/20">
                  <TableHead className="cursor-pointer" onClick={() => handleSort('source_domain')}>Source Domain</TableHead>
                  <TableHead className="cursor-pointer text-center" onClick={() => handleSort('source_da')}>Source DA</TableHead>
                  <TableHead>Anchor Text</TableHead>
                  <TableHead>Target Page</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('link_type')}>Type</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('is_gap')}>Gap</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlinks.map((backlink: CompetitorBacklink) => {
                  return (
                    <TableRow key={backlink.id} className="hover:bg-muted/30 border-b border-border/50 text-sm">
                      <TableCell className="font-medium">
                        <div>
                          <div className="text-foreground font-semibold">{backlink.source_domain}</div>
                          {backlink.source_url && (
                            <a
                              href={backlink.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[220px]">Page Link</span>
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold">{backlink.source_da}</TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[200px]" title={backlink.anchor_text || ''}>
                        {backlink.anchor_text || '-'}
                      </TableCell>
                      <TableCell>
                        {backlink.target_url ? (
                          <a
                            href={backlink.target_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 truncate max-w-[200px]"
                            title={backlink.target_url}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{backlink.target_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                          backlink.link_type === 'dofollow' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-gray-500/15 text-muted-foreground'
                        )}>
                          {backlink.link_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {backlink.is_gap ? (
                          <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium border border-red-500/20">
                            Gap
                          </span>
                        ) : (
                          <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-medium border border-green-500/20">
                            We Have
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          {/* Tag Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleTag(backlink)}
                            className={cn(
                              'h-8 w-8',
                              backlink.tagged_for_outreach ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-foreground'
                            )}
                            title={backlink.tagged_for_outreach ? 'Remove outreach tag' : 'Tag for outreach'}
                          >
                            <Tag className={cn('h-4 w-4', backlink.tagged_for_outreach && 'fill-current')} />
                          </Button>

                          {/* Add to Outreach (if gap) */}
                          {backlink.is_gap && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddToOutreach(backlink)}
                              className="h-8 border-border text-xs py-0 px-2 hover:bg-accent text-foreground inline-flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Outreach
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
              <div className="flex justify-between items-center p-4 border-t border-border bg-card">
                <div className="text-xs text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} backlinks
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

      {/* CSV Import Modal */}
      <BacklinkImportModal
        competitorId={id}
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={refreshAllData}
      />

      {/* Add to Outreach Sheet Form */}
      <ProspectForm
        prospect={prefilledProspect}
        isOpen={isOutreachOpen}
        onClose={() => setIsOutreachOpen(false)}
        onSuccess={() => {
          refreshAllData()
          globalMutate('/api/outreach')
          globalMutate('/api/outreach/stats')
        }}
      />
    </div>
  )
}

export default function CompetitorDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" className="border-t-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading competitor backlinks...</p>
      </div>
    }>
      <CompetitorDetailsContent id={id} />
    </Suspense>
  )
}
