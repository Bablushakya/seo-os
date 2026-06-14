'use client'

import React, { useState, useEffect, Suspense } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner, TableBodySkeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { CompetitorForm } from '@/components/competitors/CompetitorForm'
import {
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Edit,
  SlidersHorizontal,
  ChevronRight,
  TrendingDown,
  Globe,
  Database,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Competitor } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

interface TrackedCompetitor extends Competitor {
  backlink_count: number
  gap_count: number
  tagged_count: number
}

function CompetitorsContent() {
  const { user } = useAuth()
  const router = useRouter()

  // State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // SWR hooks
  const { data: competitors, error, isLoading, mutate } = useSWR<TrackedCompetitor[]>(
    '/api/competitors',
    fetcher
  )

  // Filter list
  const filtered = (competitors || []).filter((c) => {
    const s = debouncedSearch.toLowerCase()
    return (
      c.domain.toLowerCase().includes(s) ||
      (c.display_name && c.display_name.toLowerCase().includes(s))
    )
  })

  // Calculate overall metrics
  const totalCompetitors = competitors?.length || 0
  const totalBacklinks = competitors?.reduce((sum, c) => sum + (c.backlink_count || 0), 0) || 0
  const totalGaps = competitors?.reduce((sum, c) => sum + (c.gap_count || 0), 0) || 0
  const totalTagged = competitors?.reduce((sum, c) => sum + (c.tagged_count || 0), 0) || 0

  const handleAddClick = () => {
    setSelectedCompetitor(null)
    setIsFormOpen(true)
  }

  const handleEditClick = (e: React.MouseEvent, competitor: Competitor) => {
    e.stopPropagation()
    setSelectedCompetitor(competitor)
    setIsFormOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, competitor: Competitor) => {
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete tracking for ${competitor.domain}? All imported backlinks will be deleted.`)) {
      return
    }

    try {
      const res = await fetch(`/api/competitors/${competitor.id}`, { method: 'DELETE' })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to delete competitor')
      }

      toast.success('Competitor deleted successfully')
      mutate()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting competitor')
    }
  }

  const handleRowClick = (id: string) => {
    router.push(`/competitors/${id}`)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Competitor Link Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Track competitor backlink profiles, identify domain gaps, and tag placement targets.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => router.push('/competitors/gap-analysis')}
            variant="outline"
            className="border-border hover:bg-accent text-sm font-medium"
          >
            <TrendingDown className="h-4 w-4 mr-2 text-indigo-400" />
            Global Gap Analysis
          </Button>
          <Button
            onClick={handleAddClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Competitor
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Competitors</p>
            <h3 className="text-2xl font-bold mt-1 text-foreground">{totalCompetitors}</h3>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Backlinks</p>
            <h3 className="text-2xl font-bold mt-1 text-foreground">{totalBacklinks}</h3>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-400 rounded-lg">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unmatched Gaps</p>
            <h3 className="text-2xl font-bold mt-1 text-red-500">{totalGaps}</h3>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-green-500/10 text-green-400 rounded-lg">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tagged for Outreach</p>
            <h3 className="text-2xl font-bold mt-1 text-green-500">{totalTagged}</h3>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card/40 border border-border rounded-lg p-4 backdrop-blur-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search competitor domain or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-input"
          />
        </div>
      </div>

      {/* List Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 border border-border bg-card rounded-lg text-center shadow-sm">
            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-semibold text-foreground">Failed to load competitors</p>
            <p className="text-xs text-muted-foreground mt-1">Please reload the page and try again</p>
          </div>
        ) : isLoading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competitor Domain</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead className="text-center">Backlinks</TableHead>
                <TableHead className="text-center">Gaps</TableHead>
                <TableHead className="text-center">Tagged</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBodySkeleton columns={7} rows={4} />
          </Table>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No competitors tracked yet"
            description="Add competitor domains to start importing backlinks and analyzing gaps."
            actionLabel="Add Competitor"
            onAction={handleAddClick}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead>Competitor Domain</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead className="text-center">Total Backlinks</TableHead>
                <TableHead className="text-center text-red-400">Gaps</TableHead>
                <TableHead className="text-center text-green-400">Tagged</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((competitor) => (
                <TableRow
                  key={competitor.id}
                  className="cursor-pointer hover:bg-muted/50 border-b border-border/50"
                  onClick={() => handleRowClick(competitor.id)}
                >
                  <TableCell className="font-semibold text-foreground">
                    <span className="flex items-center gap-2 group">
                      {competitor.domain}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </TableCell>
                  <TableCell>{competitor.display_name || '-'}</TableCell>
                  <TableCell>
                    {competitor.niche ? (
                      <span className="text-xs bg-secondary text-secondary-foreground font-medium px-2 py-0.5 rounded-full">
                        {competitor.niche}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-center font-bold">{competitor.backlink_count || 0}</TableCell>
                  <TableCell className="text-center text-red-400 font-bold">{competitor.gap_count || 0}</TableCell>
                  <TableCell className="text-center text-green-400 font-bold">{competitor.tagged_count || 0}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={(e) => handleEditClick(e, competitor)}>
                        Edit
                      </Button>
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(e, competitor)}
                          className="text-red-500 hover:text-red-600"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Competitor Form Drawer */}
      <CompetitorForm
        competitor={selectedCompetitor}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => mutate()}
      />
    </div>
  )
}

export default function CompetitorsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" className="border-t-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading competitor profiles...</p>
      </div>
    }>
      <CompetitorsContent />
    </Suspense>
  )
}
