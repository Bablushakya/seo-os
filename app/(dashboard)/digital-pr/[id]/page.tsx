'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { CampaignForm } from '@/components/digital-pr/CampaignForm'
import { PlacementForm } from '@/components/digital-pr/PlacementForm'
import {
  Plus,
  Search,
  ChevronLeft,
  Trash2,
  Newspaper,
  Globe,
  TrendingUp,
  Activity,
  ArrowLeft,
  ExternalLink,
  Edit2,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { PR_CAMPAIGN_STATUS_LABELS } from '@/lib/constants'
import type { PRCampaign, PRCampaignStatus, PRPlacement } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function CampaignDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  // State
  const [search, setSearch] = useState('')
  const [isCampaignFormOpen, setIsCampaignFormOpen] = useState(false)
  const [isPlacementFormOpen, setIsPlacementFormOpen] = useState(false)
  const [selectedPlacement, setSelectedPlacement] = useState<PRPlacement | null>(null)

  // SWR Queries
  const { data: campaign, error: campaignError, mutate: mutateCampaign } = useSWR<PRCampaign>(
    id ? `/api/digital-pr/campaigns/${id}` : null,
    fetcher
  )

  const { data: stats, error: statsError, mutate: mutateStats } = useSWR(
    id ? `/api/digital-pr/campaigns/${id}/stats` : null,
    fetcher
  )

  const { data: placementsData, error: placementsError, mutate: mutatePlacements } = useSWR(
    id ? `/api/digital-pr/placements?campaign_id=${id}&search=${encodeURIComponent(search)}` : null,
    fetcher
  )

  const placements = placementsData?.data || []
  const isLoading = (!campaign && !campaignError) || (!placementsData && !placementsError)

  const handleEditCampaign = () => {
    setIsCampaignFormOpen(true)
  }

  const handleDeleteCampaign = async () => {
    const isAdminUser = user?.role === 'admin'
    if (!isAdminUser) {
      toast.error('Only administrators can delete campaigns.')
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

      toast.success('Campaign deleted successfully')
      router.push('/digital-pr')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting campaign')
    }
  }

  const handleAddPlacement = () => {
    setSelectedPlacement(null)
    setIsPlacementFormOpen(true)
  }

  const handleEditPlacement = (placement: PRPlacement) => {
    setSelectedPlacement(placement)
    setIsPlacementFormOpen(true)
  }

  const handleDeletePlacement = async (placementId: string) => {
    const isAdminUser = user?.role === 'admin'
    if (!isAdminUser) {
      toast.error('Only administrators can delete placements.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this placement record?')) {
      return
    }

    try {
      const res = await fetch(`/api/digital-pr/placements/${placementId}`, { method: 'DELETE' })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error?.message || 'Failed to delete placement')
      }

      toast.success('Placement deleted successfully')
      mutatePlacements()
      mutateStats()
      mutateCampaign()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting placement')
    }
  }

  const handleCampaignSuccess = () => {
    mutateCampaign()
    mutateStats()
  }

  const handlePlacementSuccess = () => {
    mutatePlacements()
    mutateStats()
    mutateCampaign()
  }

  if (campaignError) {
    return (
      <div className="space-y-4">
        <Link href="/digital-pr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Digital PR
        </Link>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
          Failed to load campaign. It may have been deleted.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link
          href="/digital-pr"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>

        {campaign && (
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditCampaign}
              className="border-border hover:bg-accent text-sm font-medium"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Campaign
            </Button>
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteCampaign}
                className="border-destructive/20 text-destructive hover:bg-destructive/10 text-sm font-medium"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Campaign
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Campaign Details Header */}
      {campaign && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold mb-2.5
                ${
                  campaign.status === 'planning' ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' :
                  campaign.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  campaign.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                  'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}
              >
                {PR_CAMPAIGN_STATUS_LABELS[campaign.status as PRCampaignStatus] || campaign.status}
              </span>
              <h1 className="text-2xl font-bold tracking-tight">{campaign.campaign_name}</h1>
              {campaign.topic && (
                <p className="text-muted-foreground text-sm mt-1">{campaign.topic}</p>
              )}
            </div>
            {campaign.launch_date && (
              <div className="text-sm text-muted-foreground flex items-center gap-1.5 bg-muted/20 px-3 py-1.5 rounded-lg border border-border">
                <Calendar className="h-4 w-4" />
                Launch: {campaign.launch_date}
              </div>
            )}
          </div>

          {campaign.notes && (
            <div className="mt-6 border-t border-border pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Campaign Notes</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Campaign Statistics Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card/40 border border-border rounded-xl backdrop-blur-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Placements</p>
            <h3 className="text-2xl font-bold mt-1">{stats?.placement_count ?? 0}</h3>
          </div>
          <div className="rounded-full bg-blue-500/10 p-2.5">
            <Globe className="h-5 w-5 text-blue-500" />
          </div>
        </div>

        <div className="bg-card/40 border border-border rounded-xl backdrop-blur-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Reach</p>
            <h3 className="text-2xl font-bold mt-1">
              {stats?.total_reach ? stats.total_reach.toLocaleString() : 0}
            </h3>
          </div>
          <div className="rounded-full bg-purple-500/10 p-2.5">
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
        </div>

        <div className="bg-card/40 border border-border rounded-xl backdrop-blur-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average DA</p>
            <h3 className="text-2xl font-bold mt-1">{stats?.average_da ?? 0}</h3>
          </div>
          <div className="rounded-full bg-emerald-500/10 p-2.5">
            <Activity className="h-5 w-5 text-emerald-500" />
          </div>
        </div>

        <div className="bg-card/40 border border-border rounded-xl backdrop-blur-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response Rate</p>
            <h3 className="text-2xl font-bold mt-1">{stats?.response_rate ?? 0}%</h3>
          </div>
          <div className="rounded-full bg-amber-500/10 p-2.5">
            <Sparkles className="h-5 w-5 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Placements Sub-Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold">Earned Placements</h2>
            <p className="text-xs text-muted-foreground">List of publications and links secured during this campaign.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search publication..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background border-input h-9"
              />
            </div>
            <Button
              onClick={handleAddPlacement}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Placement
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border">
                  <TableHead>Publication</TableHead>
                  <TableHead>Domain Authority</TableHead>
                  <TableHead>Placement Date</TableHead>
                  <TableHead className="text-right">Est. Reach</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBodySkeleton columns={5} rows={3} />
            </Table>
          ) : placements.length === 0 ? (
            <EmptyState
              title="No placements earned yet."
              description="Secure and log link placements from news and media outlets to build brand authority."
              actionLabel="+ Log First Placement"
              onAction={handleAddPlacement}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead>Publication</TableHead>
                    <TableHead>Domain Authority (DA)</TableHead>
                    <TableHead>Placement Date</TableHead>
                    <TableHead className="text-right">Est. Reach</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {placements.map((p: PRPlacement) => (
                    <TableRow key={p.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                      <TableCell className="font-medium">
                        <div>
                          <span>{p.publication}</span>
                          {p.url && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5 font-normal"
                            >
                              View Placement <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                          DA {p.domain_authority}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.placement_date || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {p.reach_estimate ? p.reach_estimate.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPlacement(p)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground text-xs"
                          >
                            Edit
                          </Button>
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePlacement(p.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Modals & Sheets */}
      {campaign && (
        <CampaignForm
          campaign={campaign}
          isOpen={isCampaignFormOpen}
          onClose={() => setIsCampaignFormOpen(false)}
          onSuccess={handleCampaignSuccess}
        />
      )}

      <PlacementForm
        placement={selectedPlacement}
        campaignId={id}
        isOpen={isPlacementFormOpen}
        onClose={() => setIsPlacementFormOpen(false)}
        onSuccess={handlePlacementSuccess}
      />
    </div>
  )
}
