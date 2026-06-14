'use client'

import React, { useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState, MODULE_EMPTY_STATES } from '@/components/shared/EmptyState'
import { LocationForm } from '@/components/gbp/LocationForm'
import {
  Plus,
  MapPin,
  Star,
  FileText,
  MessageSquare,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function GBPLocationsOverviewPage() {
  const { user } = useAuth()
  const router = useRouter()

  // State
  const [isFormOpen, setIsFormOpen] = useState(false)

  // SWR Hook
  const { data: locations = [], error, isLoading, mutate } = useSWR(
    '/api/gbp/locations',
    fetcher
  )

  const canAddLocation = user?.role === 'admin' || user?.role === 'data_specialist'

  const handleAddClick = () => {
    setIsFormOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Business Profile (GBP)</h1>
          <p className="text-sm text-muted-foreground">
            Monitor review ratings, response status, monthly performance metrics, and post updates across locations.
          </p>
        </div>
        {canAddLocation && (
          <Button
            onClick={handleAddClick}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        )}
      </div>

      {/* Grid of Locations */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <LoadingSpinner size="lg" className="border-t-primary" />
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-card border border-border rounded-xl">
          <EmptyState
            title={MODULE_EMPTY_STATES.gbp.title}
            description={MODULE_EMPTY_STATES.gbp.description}
            actionLabel={canAddLocation ? MODULE_EMPTY_STATES.gbp.actionLabel : undefined}
            onAction={canAddLocation ? handleAddClick : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((loc: any) => {
            const hasUnresponded = (loc.unresponded_reviews ?? 0) > 0

            return (
              <div
                key={loc.id}
                onClick={() => router.push(`/gbp/${loc.id}`)}
                className="group relative bg-card/40 hover:bg-card border border-border/80 hover:border-border hover:shadow-md rounded-2xl p-6 cursor-pointer transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary group-hover:scale-110 transition-transform duration-300">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-lg leading-tight group-hover:text-primary transition-colors">
                          {loc.location_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{loc.business_name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-6 border-t border-border/60 pt-4">
                    {/* Posts count */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Monthly Posts</span>
                      </div>
                      <span className="font-semibold text-foreground">{loc.post_count_monthly ?? 0} posts/mo</span>
                    </div>

                    {/* Avg Rating */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Star className="h-4 w-4" />
                        <span>Average Rating</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-foreground">
                          {loc.avg_rating > 0 ? loc.avg_rating.toFixed(1) : '—'}
                        </span>
                        {loc.avg_rating > 0 && (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        )}
                      </div>
                    </div>

                    {/* Unresponded Reviews */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>Pending Reviews</span>
                      </div>
                      <span
                        className={`font-semibold rounded-full px-2 py-0.5 text-xs ${
                          hasUnresponded
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}
                      >
                        {hasUnresponded ? `${loc.unresponded_reviews} unresponded` : '0 pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end text-xs font-semibold text-primary mt-6 pt-4 border-t border-border/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>Manage Location</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Location Sheet Form */}
      <LocationForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={mutate}
      />
    </div>
  )
}
