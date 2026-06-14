'use client'

import React from 'react'
import useSWR from 'swr'
import { LayoutDashboard, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { KPICard } from '@/components/dashboard/KPICard'
import { OutreachPipelineChart } from '@/components/dashboard/OutreachPipelineChart'
import { KPIProgress } from '@/components/dashboard/KPIProgress'
import { MyTasks } from '@/components/dashboard/MyTasks'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Skeleton } from '@/components/ui/skeleton'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: stats, error, isLoading } = useSWR('/api/dashboard/stats', fetcher)

  // 1. Get current time-of-day greeting (FR-005)
  const getGreeting = () => {
    const hours = new Date().getHours()
    if (hours < 12) return 'Good morning'
    if (hours < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // 2. Get current week date range label
  const getWeekRange = () => {
    const now = new Date()
    const first = now.getDate() - now.getDay() // Start of week (Sunday)
    const last = first + 6 // End of week (Saturday)

    const firstDate = new Date(now.setDate(first))
    const lastDate = new Date(now.setDate(last))

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${firstDate.toLocaleDateString('en-US', options)} – ${lastDate.toLocaleDateString(
      'en-US',
      options
    )}, ${lastDate.getFullYear()}`
  }

  const actorName = user?.full_name ? user.full_name.split(' ')[0] : 'Team Member'

  return (
    <div className="space-y-8 page-enter">
      {/* 3. Dashboard Header (Greeting + Date Range) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-600/20">
            <LayoutDashboard className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {getGreeting()}, {actorName}!
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Here's your off-page SEO operations overview.
            </p>
          </div>
        </div>

        <div className="text-xs font-semibold text-muted-foreground bg-accent/30 px-3.5 py-2 rounded-md border border-border/20 self-start md:self-auto font-mono tracking-tight shadow-sm">
          📅 Week: {getWeekRange()}
        </div>
      </div>

      {/* 4. KPI Cards Grid (DASH-001-04) */}
      <section aria-label="Key performance indicators" className="space-y-4">
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 border border-border bg-card rounded-lg text-center shadow-sm">
            <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-semibold text-foreground">Failed to load KPI statistics</p>
            <p className="text-xs text-muted-foreground mt-1">Check your network connection and try again</p>
          </div>
        ) : isLoading || !stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col rounded-lg border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard
              title="Live Citations"
              value={stats.citations.live}
              sublabel={`of ${stats.citations.total} total`}
              trend={null}
              color="#22c55e"
              emoji="📍"
              href="/citations"
            />
            <KPICard
              title="Guest Posts"
              value={stats.guest_posts.live}
              sublabel="live / published"
              trend={null}
              color="#3b82f6"
              emoji="✍️"
              href="/guest-posts"
            />
            <KPICard
              title="Active Prospects"
              value={stats.outreach.active}
              sublabel="in outreach pipeline"
              trend={null}
              color="#a855f7"
              emoji="📬"
              href="/outreach"
            />
            <KPICard
              title="PR Placements"
              value={stats.pr_placements.this_month}
              sublabel={`of ${stats.pr_placements.total} total`}
              trend={null}
              color="#f97316"
              emoji="📰"
              href="/digital-pr"
            />
            <KPICard
              title="Tasks Due Today"
              value={stats.tasks.due_today}
              sublabel={`${stats.tasks.overdue} overdue tasks`}
              trend={null}
              color={stats.tasks.due_today > 0 ? '#eab308' : '#22c55e'}
              emoji="✅"
              href="/tasks"
            />
            <KPICard
              title="GBP Posts"
              value={stats.gbp_posts.this_month}
              sublabel="published this month"
              trend={null}
              color="#06b6d4"
              emoji="🏬"
              href="/gbp"
            />
          </div>
        )}
      </section>

      {/* 5. Middle Row (Pipeline Chart & Activity Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="Pipeline overview" className="h-[430px]">
          {isLoading || !stats ? (
            <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="flex-1 space-y-4 my-auto">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full rounded" />
                ))}
              </div>
            </div>
          ) : (
            <OutreachPipelineChart data={stats.outreach.stage_breakdown} />
          )}
        </section>

        <section aria-label="Recent activity" className="h-[430px]">
          <ActivityFeed />
        </section>
      </div>

      {/* 6. Bottom Row (KPI Goals & My Tasks) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="KPI goals progress">
          <KPIProgress />
        </section>

        <section aria-label="My checklist">
          <MyTasks />
        </section>
      </div>
    </div>
  )
}
