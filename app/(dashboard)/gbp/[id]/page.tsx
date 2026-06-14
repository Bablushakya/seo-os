'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LocationForm } from '@/components/gbp/LocationForm'
import { PostForm } from '@/components/gbp/PostForm'
import { ReviewForm } from '@/components/gbp/ReviewForm'
import { MetricForm } from '@/components/gbp/MetricForm'
import {
  ArrowLeft,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  FileText,
  Star,
  MessageSquare,
  BarChart4,
  Plus,
  Calendar,
  CheckCircle,
  Eye,
  MousePointerClick,
  Phone,
  Navigation,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { GBP_POST_TYPE_LABELS, GBP_POST_STATUS_LABELS } from '@/lib/constants'
import type { GBPLocation, GBPPost, GBPReview, GBPMetric, GBPPostStatus } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function GBPLocationDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  // State
  const [activeTab, setActiveTab] = useState('posts')
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false)
  const [isPostFormOpen, setIsPostFormOpen] = useState(false)
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false)
  const [isMetricFormOpen, setIsMetricFormOpen] = useState(false)
  
  // Selected items for editing
  const [selectedMetric, setSelectedMetric] = useState<GBPMetric | null>(null)
  
  // Inline response state
  const [respondingToId, setRespondingToId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false)

  // SWR Queries
  const { data: location, error: locError, mutate: mutateLocation } = useSWR<GBPLocation>(
    id ? `/api/gbp/locations/${id}` : null,
    fetcher
  )

  const { data: postsData, mutate: mutatePosts } = useSWR(
    id && activeTab === 'posts' ? `/api/gbp/posts?location_id=${id}` : null,
    fetcher
  )

  const { data: reviewsData, mutate: mutateReviews } = useSWR(
    id && activeTab === 'reviews' ? `/api/gbp/reviews?location_id=${id}` : null,
    fetcher
  )

  const { data: metrics = [], mutate: mutateMetrics } = useSWR<GBPMetric[]>(
    id && activeTab === 'metrics' ? `/api/gbp/metrics?location_id=${id}` : null,
    fetcher
  )

  const posts = postsData?.data || []
  const reviews = reviewsData?.data || []
  
  const isLoading = !location && !locError

  // Date formatter helper
  const getMonthLabel = (dateStr: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    const year = parts[0] || '0'
    const month = parts[1] || '0'
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  // Handle Edit/Delete Location
  const handleEditLocation = () => {
    setIsLocationFormOpen(true)
  }

  const handleDeleteLocation = async () => {
    if (user?.role !== 'admin') {
      toast.error('Only administrators can delete GBP locations.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this GBP location? All posts, reviews, and metrics will be permanently deleted. This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/gbp/locations/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error?.message || 'Failed to delete location')
      }

      toast.success('Location deleted successfully')
      router.push('/gbp')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting location')
    }
  }

  // Handle Review Response Submission
  const handleStartResponse = (reviewId: string, text = '') => {
    setRespondingToId(reviewId)
    setResponseText(text)
  }

  const handleCancelResponse = () => {
    setRespondingToId(null)
    setResponseText('')
  }

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) {
      toast.error('Response text cannot be empty')
      return
    }

    setIsSubmittingResponse(true)
    try {
      const res = await fetch(`/api/gbp/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_text: responseText }),
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save response')
      }

      toast.success('Review response submitted successfully')
      setRespondingToId(null)
      setResponseText('')
      mutateReviews()
      mutateLocation()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error saving response')
    } finally {
      setIsSubmittingResponse(false)
    }
  }

  // Handle Metrics edit
  const handleEditMetric = (metric: GBPMetric) => {
    setSelectedMetric(metric)
    setIsMetricFormOpen(true)
  }

  // Recharts Data Prep (chronological order)
  const chartData = [...metrics]
    .reverse()
    .map(m => ({
      name: getMonthLabel(m.metric_month),
      views: m.views,
    }))

  if (locError) {
    return (
      <div className="space-y-4">
        <Link href="/gbp" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium">
          <ArrowLeft className="h-4 w-4" /> Back to GBP Locations
        </Link>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
          Failed to load location details.
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <LoadingSpinner size="lg" className="border-t-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link
          href="/gbp"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Locations
        </Link>

        {location && (
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditLocation}
              className="border-border hover:bg-accent text-sm font-medium"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Location
            </Button>
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteLocation}
                className="border-destructive/20 text-destructive hover:bg-destructive/10 text-sm font-medium"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Location
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Info Header */}
      {location && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{location.location_name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{location.business_name}</p>
              
              <div className="flex flex-wrap gap-2.5 mt-4">
                {location.category && (
                  <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium border border-border">
                    {location.category}
                  </span>
                )}
                <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium border ${
                  location.is_active
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                }`}>
                  {location.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {location.google_maps_url && (
              <a
                href={location.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline bg-blue-500/5 hover:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 font-medium"
              >
                View on Google Maps
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main Tabs Segment */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/30 border border-border rounded-lg p-0.5">
          <TabsTrigger value="posts" className="data-[state=active]:bg-background">
            <FileText className="h-4 w-4 mr-1.5" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="reviews" className="data-[state=active]:bg-background">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Reviews
            {location && (location.unresponded_reviews ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center">
                {location.unresponded_reviews}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="metrics" className="data-[state=active]:bg-background">
            <BarChart4 className="h-4 w-4 mr-1.5" />
            Metrics
          </TabsTrigger>
        </TabsList>

        {/* -------------------- POSTS TAB -------------------- */}
        <TabsContent value="posts" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold">Logged GBP Updates</h2>
              <p className="text-xs text-muted-foreground">Keep your local profile fresh by logging planned and published updates.</p>
            </div>
            <Button onClick={() => setIsPostFormOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Log Post
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {posts.length === 0 ? (
              <EmptyState
                title="No posts logged yet."
                description="Promote offers, events, and updates to improve local citation strength."
                actionLabel="+ Log First Post"
                onAction={() => setIsPostFormOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead>Type</TableHead>
                      <TableHead>Content Summary</TableHead>
                      <TableHead>Publish Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((p: GBPPost) => {
                      const typeColors: Record<string, string> = {
                        update: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                        offer: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                        event: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                        product: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                      }
                      const statusColors: Record<GBPPostStatus, string> = {
                        planned: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                        published: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                        expired: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                      }

                      return (
                        <TableRow key={p.id} className="border-b border-border hover:bg-muted/5">
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${typeColors[p.post_type] || ''}`}>
                              {GBP_POST_TYPE_LABELS[p.post_type] || p.post_type}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="text-sm text-foreground line-clamp-2">{p.content_summary || '—'}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.publish_date || '—'}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[p.status] || ''}`}>
                              {GBP_POST_STATUS_LABELS[p.status] || p.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {p.notes || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* -------------------- REVIEWS TAB -------------------- */}
        <TabsContent value="reviews" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold">Customer Reviews</h2>
              <p className="text-xs text-muted-foreground">Log reviews from Google Maps and manage response templates.</p>
            </div>
            <Button onClick={() => setIsReviewFormOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Log Review
            </Button>
          </div>

          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-card border border-border rounded-xl">
                <EmptyState
                  title="No reviews logged yet."
                  description="Log positive and critical reviews to maintain 100% response rate coverage."
                  actionLabel="+ Log First Review"
                  onAction={() => setIsReviewFormOpen(true)}
                />
              </div>
            ) : (
              reviews.map((r: any) => {
                const isResponding = respondingToId === r.id

                return (
                  <div key={r.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground">{r.reviewer_name || 'Anonymous User'}</h4>
                          <span className="text-xs text-muted-foreground">• {r.review_date}</span>
                        </div>
                        
                        {/* Star Rating Display */}
                        <div className="flex gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= (r.rating || 0)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-muted-foreground/20'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Respond Actions */}
                      {!r.is_responded && !isResponding && (
                        <Button
                          onClick={() => handleStartResponse(r.id)}
                          size="sm"
                          variant="outline"
                          className="h-8 border-primary/20 text-primary hover:bg-primary/5 text-xs font-semibold"
                        >
                          Respond
                        </Button>
                      )}

                      {r.is_responded && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
                          Responded ✓
                        </span>
                      )}
                    </div>

                    {r.review_text && (
                      <p className="text-sm text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/40 italic">
                        "{r.review_text}"
                      </p>
                    )}

                    {/* Active inline response textarea */}
                    {isResponding && (
                      <div className="space-y-3 pt-2 border-t border-border/60">
                        <Label htmlFor={`response-${r.id}`} className="text-xs font-semibold">Write Response</Label>
                        <textarea
                          id={`response-${r.id}`}
                          rows={3}
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Thank you for your feedback! We appreciate you choosing India Heritage Travel..."
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={handleCancelResponse}
                            size="sm"
                            variant="ghost"
                            disabled={isSubmittingResponse}
                            className="text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleSubmitResponse(r.id)}
                            size="sm"
                            disabled={isSubmittingResponse}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
                          >
                            {isSubmittingResponse ? 'Saving...' : 'Submit Response'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Display existing response */}
                    {r.is_responded && r.response_text && (
                      <div className="bg-primary/5 border-l-2 border-primary rounded-r-lg p-3 space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold text-primary">
                          <span>Our Response</span>
                          {r.response_date && (
                            <span className="text-muted-foreground font-normal">
                              Responded on {r.response_date}
                              {r.responder?.full_name && ` by ${r.responder.full_name}`}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{r.response_text}</p>
                        
                        {/* Quick edit response */}
                        {!isResponding && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleStartResponse(r.id, r.response_text)}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline font-medium"
                            >
                              Edit Response
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* -------------------- METRICS TAB -------------------- */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold">Monthly Insights</h2>
              <p className="text-xs text-muted-foreground">Review profile action trends and log monthly metrics.</p>
            </div>
            <Button onClick={() => { setSelectedMetric(null); setIsMetricFormOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Log Month
            </Button>
          </div>

          {/* Chart View */}
          {metrics.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Profile Views Trend</h3>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '12px',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                    <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Metrics List Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {metrics.length === 0 ? (
              <EmptyState
                title="No metrics logged yet."
                description="Upload monthly views, calls, directions, and clicks to analyze local presence trends."
                actionLabel="+ Log First Month"
                onAction={() => { setSelectedMetric(null); setIsMetricFormOpen(true); }}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          Views
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                          Clicks
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          Calls
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                          Directions
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          Photo Views
                        </div>
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((m: GBPMetric) => (
                      <TableRow key={m.id} className="border-b border-border hover:bg-muted/5">
                        <TableCell className="font-semibold text-foreground">
                          {getMonthLabel(m.metric_month)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{m.views.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{m.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{m.calls.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{m.direction_requests.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground">{m.photo_views.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditMetric(m)}
                            className="h-8 px-2 text-muted-foreground hover:text-foreground text-xs"
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Forms Integration */}
      {location && (
        <LocationForm
          location={location}
          isOpen={isLocationFormOpen}
          onClose={() => setIsLocationFormOpen(false)}
          onSuccess={mutateLocation}
        />
      )}

      <PostForm
        locationId={id}
        isOpen={isPostFormOpen}
        onClose={() => setIsPostFormOpen(false)}
        onSuccess={mutatePosts}
      />

      <ReviewForm
        locationId={id}
        isOpen={isReviewFormOpen}
        onClose={() => setIsReviewFormOpen(false)}
        onSuccess={() => { mutateReviews(); mutateLocation(); }}
      />

      <MetricForm
        metric={selectedMetric}
        locationId={id}
        isOpen={isMetricFormOpen}
        onClose={() => setIsMetricFormOpen(false)}
        onSuccess={mutateMetrics}
      />
    </div>
  )
}
