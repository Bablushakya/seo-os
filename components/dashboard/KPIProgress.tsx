'use client'

import React from 'react'
import useSWR from 'swr'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, AlertTriangle, XCircle, Settings } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export function KPIProgress() {
  const { data: stats, error: statsError } = useSWR('/api/dashboard/stats', fetcher)
  const { data: targets, error: targetsError } = useSWR('/api/settings/kpi-targets', fetcher)

  const isLoading = !stats || !targets
  const error = statsError || targetsError

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-border bg-card rounded-lg h-full text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm font-semibold text-foreground">Failed to load KPI goals</p>
        <p className="text-xs text-muted-foreground mt-1">Please reload the page</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const items = [
    {
      id: 'citations',
      label: 'Citations (Live)',
      actual: stats.citations.live,
      target: targets.citations,
    },
    {
      id: 'guest_posts',
      label: 'Guest Posts (Live)',
      actual: stats.guest_posts.live,
      target: targets.guest_posts,
    },
    {
      id: 'pr_placements',
      label: 'Digital PR Placements (Month)',
      actual: stats.pr_placements.this_month,
      target: targets.pr_placements,
    },
    {
      id: 'gbp_posts',
      label: 'GBP Posts (Month)',
      actual: stats.gbp_posts.this_month,
      target: targets.gbp_posts,
    },
  ]

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full">
      <div className="mb-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Monthly KPI Goals
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Actual performance vs targets for this month
        </p>
      </div>

      <div className="space-y-5 my-auto">
        {items.map((item) => {
          const percentage = item.target > 0 ? Math.round((item.actual / item.target) * 100) : 0
          
          // Color logic: green if >= 100%, yellow if 75-99%, red if < 75%
          let statusColorClass = 'bg-red-500'
          let statusTextClass = 'text-red-500'
          let Icon = XCircle

          if (percentage >= 100) {
            statusColorClass = 'bg-green-500'
            statusTextClass = 'text-green-500'
            Icon = CheckCircle2
          } else if (percentage >= 75) {
            statusColorClass = 'bg-yellow-500'
            statusTextClass = 'text-yellow-500'
            Icon = AlertTriangle
          }

          return (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">{item.label}</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-foreground">{item.actual}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">{item.target}</span>
                  <span className={`flex items-center gap-1 ml-2 ${statusTextClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {percentage}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                <div 
                  className={`h-full ${statusColorClass} transition-all duration-500`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
