'use client'

import React, { useState, useEffect, Suspense } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner, TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProspectForm } from '@/components/outreach/ProspectForm'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  Plus,
  Calendar,
  Globe,
  Tag,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CompetitorBacklink, OutreachProspect } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

interface GapBacklink extends CompetitorBacklink {
  competitor: {
    id: string
    domain: string
    display_name: string | null
  }
}

function GapAnalysisContent() {
  const { user } = useAuth()
  const { mutate: globalMutate } = useSWRConfig()
  const router = useRouter()

  // State
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [daMin, setDaMin] = useState('')
  const [daMax, setDaMax] = useState('')
  const [sortBy, setSortBy] = useState('source_da')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Outreach drawer state
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

  const queryParts = [
    `page=${page}`,
    `limit=${limit}`,
    sortBy ? `sortBy=${sortBy}` : '',
    sortOrder ? `sortOrder=${sortOrder}` : '',
    debouncedSearch ? `search=${encodeURIComponent(debouncedSearch)}` : '',
    daMin ? `daMin=${daMin}` : '',
    daMax ? `daMax=${daMax}` : '',
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR hooks
  const { data: gapsData, error, isLoading, mutate: mutateGaps } = useSWR(
    `/api/competitors/gap-analysis?${queryString}`,
    fetcher
  )

  const gaps = gapsData?.data || []
  const meta = gapsData?.meta || { total: 0, total_pages: 1 }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  // Toggle Tag for Outreach
  const handleToggleTag = async (backlink: GapBacklink) => {
    const newTaggedStatus = !backlink.tagged_for_outreach
    const previousGaps = gapsData

    // Optimistic UI update
    if (gapsData) {
      const updated = gaps.map((g: GapBacklink) =>
        g.id === backlink.id ? { ...g, tagged_for_outreach: newTaggedStatus } : g
      )
      mutateGaps({ ...gapsData, data: updated }, false)
    }

    try {
      const res = await fetch(`/api/competitors/${backlink.competitor_id}/backlinks/${backlink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagged_for_outreach: newTaggedStatus }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update tag')
      }

      toast.success(newTaggedStatus ? 'Backlink tagged for outreach' : 'Removed outreach tag')
      mutateGaps()
      globalMutate('/api/competitors')
      globalMutate(`/api/competitors/${backlink.competitor_id}`)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating tag')
      mutateGaps(previousGaps, false)
    }
  }

  // Add to Outreach
  const handleAddToOutreach = (backlink: GapBacklink) => {
    const mockProspect: any = {
      site_name: backlink.source_domain,
      url: backlink.source_url || `https://${backlink.source_domain}`,
      domain_authority: backlink.source_da,
      niche: '',
      last_contact_date: new Date().toISOString().split('T')[0],
      next_followup_date: '',
      pipeline_stage: 'identified',
      notes: `Target acquired from global competitor gap analysis.\nFound in backlinks of competitor ${backlink.competitor.domain}.\nAnchor text: "${backlink.anchor_text || '-'}"\nLink type: ${backlink.link_type}`,
    }

    setPrefilledProspect(mockProspect)
    setIsOutreachOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/competitors"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Competitors
        </Link>
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <TrendingDown className="h-6 w-6 text-red-400 shrink-0" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Global Gap Analysis</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Compare all competitor backlinks against our active citations & guest posts. Displays sites linking to competitors but not us.
        </p>
      </div>

      {/* Filter Toolbar */}
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

      {/* Gap Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-sm text-red-400 bg-card/50">
            Failed to load gap analysis data.
          </div>
        ) : isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Domain</TableHead>
                <TableHead className="text-center">DA</TableHead>
                <TableHead>Competitor Source</TableHead>
                <TableHead>Anchor Text</TableHead>
                <TableHead>Link Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBodySkeleton columns={6} rows={8} />
          </Table>
        ) : gaps.length === 0 ? (
          <EmptyState
            title="Zero backlinks gaps found"
            description="Fantastic job! We have backlinks from all competitor source domains."
            actionLabel="Back to Competitors"
            onAction={() => router.push('/competitors')}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/20">
                  <TableHead className="cursor-pointer" onClick={() => handleSort('source_domain')}>Source Domain</TableHead>
                  <TableHead className="cursor-pointer text-center" onClick={() => handleSort('source_da')}>Source DA</TableHead>
                  <TableHead>Competitor Source</TableHead>
                  <TableHead>Anchor Text</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('link_type')}>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaps.map((backlink: GapBacklink) => {
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
                      <TableCell>
                        <Link
                          href={`/competitors/${backlink.competitor.id}`}
                          className="text-xs text-primary hover:underline font-semibold"
                        >
                          {backlink.competitor.domain}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[220px]">
                        {backlink.anchor_text || '-'}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                          backlink.link_type === 'dofollow' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-gray-500/15 text-muted-foreground'
                        )}>
                          {backlink.link_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddToOutreach(backlink)}
                            className="h-8 border-border text-xs py-0 px-2 hover:bg-accent text-foreground inline-flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Outreach
                          </Button>
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
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} gaps
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

      {/* Add to Outreach Sheet Form */}
      <ProspectForm
        prospect={prefilledProspect}
        isOpen={isOutreachOpen}
        onClose={() => setIsOutreachOpen(false)}
        onSuccess={() => {
          mutateGaps()
          globalMutate('/api/outreach')
          globalMutate('/api/outreach/stats')
        }}
      />
    </div>
  )
}

export default function GapAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" className="border-t-primary" />
        <p className="text-sm text-muted-foreground mt-4">Running global gap analysis...</p>
      </div>
    }>
      <GapAnalysisContent />
    </Suspense>
  )
}
