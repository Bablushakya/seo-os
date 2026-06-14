'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Printer,
  Download,
  Building2,
  Mail,
  FileText,
  Newspaper,
  CheckSquare,
  TrendingUp,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Report } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: report, error, isLoading } = useSWR<Report>(`/api/reports/${params.id}`, fetcher)

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <EmptyState
          title="Report not found"
          description="The report you are looking for does not exist or has been deleted."
          icon={<AlertTriangle className="h-12 w-12 text-muted-foreground" />}
        />
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/reports')}>
          Back to Reports List
        </Button>
      </div>
    )
  }

  const { data } = report
  const isWeekly = report.report_type === 'weekly'

  // Helper to format date range
  const formatPeriod = () => {
    const start = new Date(report.period_start)
    const end = new Date(report.period_end)
    
    if (report.report_type === 'monthly') {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const formatGeneratedAt = () => {
    const date = new Date(report.generated_at)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    try {
      const csvRows = [
        ['SEO-OS Performance Report Data'],
        ['Report Type', report.report_type],
        ['Period Start', report.period_start],
        ['Period End', report.period_end],
        ['Generated At', report.generated_at],
        [],
        ['Section', 'Metric', 'Value'],
        ['Citations', 'Total Citations', data.citations.total],
        ['Citations', 'Live Citations', data.citations.live],
        ['Citations', 'Live Citations %', data.citations.live_percentage],
        ['Citations', 'Citations Added', data.citations.added_this_period],
        
        ['Outreach', 'Active Prospects', data.outreach.total_active],
        ['Outreach', 'Placed', data.outreach.placed_this_period],
        ['Outreach', 'Conversion Rate %', data.outreach.conversion_rate],
        
        ['Guest Posts', 'Total Guest Posts', data.guest_posts.total],
        ['Guest Posts', 'Live Guest Posts', data.guest_posts.live],
        ['Guest Posts', 'Added', data.guest_posts.added_this_period],
        ['Guest Posts', 'Average DA of Added', data.guest_posts.avg_da],
        
        ['Digital PR', 'Total Placements', data.digital_pr.total_placements],
        ['Digital PR', 'Placements in Period', data.digital_pr.placements_this_period],
        ['Digital PR', 'Reach Estimate', data.digital_pr.total_reach],
        
        ['Tasks', 'Completed', data.tasks.completed_this_period],
        ['Tasks', 'Overdue', data.tasks.overdue],
      ]

      // Add task completion by assignee
      Object.entries(data.tasks.by_assignee || {}).forEach(([name, count]) => {
        csvRows.push(['Tasks Completed By Assignee', name, count])
      })

      // Add KPI Targets
      csvRows.push([])
      csvRows.push(['KPI Metric', 'Target', 'Actual', 'Achievement %'])
      Object.entries(data.kpi_progress).forEach(([metric, kpi]: [string, any]) => {
        csvRows.push([metric, kpi.target, kpi.actual, kpi.percentage])
      })

      // Add GBP Metrics
      if (data.gbp) {
        csvRows.push([])
        csvRows.push(['GBP Metrics', 'Metric Value'])
        csvRows.push(['Views', data.gbp.views])
        csvRows.push(['Clicks', data.gbp.clicks])
        csvRows.push(['Calls', data.gbp.calls])
        csvRows.push(['Directions', data.gbp.direction_requests])
        csvRows.push(['Photo Views', data.gbp.photo_views])
      }

      // Add MoM Comparisons
      if (data.comparison) {
        csvRows.push([])
        csvRows.push(['MoM Comparison Metric', 'Current Value', 'Previous Value', 'Change %'])
        Object.entries(data.comparison).forEach(([metric, comp]: [string, any]) => {
          csvRows.push([metric, comp.current, comp.previous, comp.change_percent])
        })
      }

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
        + csvRows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n')
      
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `${report.report_type}_report_${report.period_start}_to_${report.period_end}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('CSV downloaded successfully')
    } catch (err) {
      console.error(err)
      toast.error('Error generating CSV export')
    }
  }

  return (
    <div className="space-y-6 print:space-y-4 print:p-0 print:text-black">
      {/* Back to List & Export Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href="/reports"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports List
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
            <Printer className="h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Sheet Card */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-6 print:border-none print:shadow-none print:bg-white print:p-0">
        
        {/* Report Header */}
        <div className="border-b border-border/60 pb-6 print:pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 print:border print:text-black print:bg-white',
                isWeekly
                  ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              )}
            >
              {report.report_type} Report
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground print:text-black">
              {isWeekly ? 'Weekly SEO Performance Report' : 'Monthly SEO Performance Report'}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-1 print:text-gray-600 flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Reporting Period: {formatPeriod()}
            </p>
          </div>
          
          <div className="text-left md:text-right text-xs text-muted-foreground print:text-gray-600 space-y-1">
            <p>Generated by: <strong className="font-semibold text-foreground print:text-black">{report.creator?.full_name || 'System Auto'}</strong></p>
            <p>Date Generated: {formatGeneratedAt()}</p>
          </div>
        </div>

        {/* AI Summary Box */}
        <div className="mt-6 print:mt-4 bg-indigo-600/5 dark:bg-indigo-500/5 border border-indigo-600/15 dark:border-indigo-500/15 rounded-lg p-5">
          <h2 className="text-sm font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Gemini AI Executive Summary
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90 font-medium print:text-black italic">
            {report.ai_summary || 'Summary unavailable'}
          </p>
        </div>

        {/* KPI Target Progress Bar Section */}
        <div className="mt-8 print:mt-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-widest border-b border-border/40 pb-2 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            KPI Targets Achievement
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {Object.entries(data.kpi_progress).map(([key, kpi]: [string, any]) => {
              const labelMap: Record<string, string> = {
                citations: 'Live Citations',
                guest_posts: 'Guest Posts Placed',
                pr_placements: 'PR Placements',
                gbp_posts: 'GBP Posts Published',
              }
              const percentage = kpi.percentage
              
              let statusTextClass = 'text-red-500'
              let statusColorClass = 'bg-red-500'
              let Icon = XCircle
              
              if (percentage >= 100) {
                statusTextClass = 'text-green-500'
                statusColorClass = 'bg-green-500'
                Icon = CheckCircle2
              } else if (percentage >= 75) {
                statusTextClass = 'text-yellow-500'
                statusColorClass = 'bg-yellow-500'
                Icon = AlertTriangle
              }
              
              return (
                <div key={key} className="rounded-lg border border-border/80 bg-background/50 p-4 print:border">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-muted-foreground">{labelMap[key] || key}</span>
                    <span className={cn('flex items-center gap-1 font-bold', statusTextClass)}>
                      <Icon className="h-3.5 w-3.5" />
                      {percentage}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-foreground">{kpi.actual}</span>
                    <span className="text-xs text-muted-foreground">/ {kpi.target} target</span>
                  </div>
                  <div className="h-1.5 w-full bg-border rounded-full overflow-hidden mt-3">
                    <div 
                      className={cn('h-full transition-all', statusColorClass)}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Monthly GBP Performance Metrics Section */}
        {!isWeekly && data.gbp && (
          <div className="mt-8 print:mt-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest border-b border-border/40 pb-2 mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-500" />
              Google Business Profile (GBP) Performance
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Profile Views', val: data.gbp.views },
                { label: 'Website Clicks', val: data.gbp.clicks },
                { label: 'Phone Calls', val: data.gbp.calls },
                { label: 'Maps Directions', val: data.gbp.direction_requests },
                { label: 'Photo Views', val: data.gbp.photo_views },
              ].map((m, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-background/30 p-4 text-center print:border">
                  <p className="text-xs font-semibold text-muted-foreground truncate">{m.label}</p>
                  <p className="text-2xl font-extrabold text-foreground mt-2">{m.val.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MoM Performance Comparisons (Monthly Only) */}
        {!isWeekly && data.comparison && (
          <div className="mt-8 print:mt-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest border-b border-border/40 pb-2 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Month-over-Month Comparisons
            </h2>
            
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="p-3 font-bold">SEO Metric</th>
                    <th className="p-3 font-bold text-center">Previous Month</th>
                    <th className="p-3 font-bold text-center">Reporting Month</th>
                    <th className="p-3 font-bold text-center">Change %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm">
                  {[
                    { label: 'Citations Added', key: 'citations_added' },
                    { label: 'Outreach Placed', key: 'outreach_placed' },
                    { label: 'Guest Posts Added', key: 'guest_posts_added' },
                    { label: 'PR Placements', key: 'pr_placements' },
                    { label: 'Tasks Completed', key: 'tasks_completed' },
                  ].map((m) => {
                    const comp = data.comparison?.[m.key]
                    if (!comp) return null
                    
                    const isPositive = comp.change_percent >= 0
                    
                    return (
                      <tr key={m.key} className="hover:bg-muted/10">
                        <td className="p-3 font-medium text-foreground">{m.label}</td>
                        <td className="p-3 text-center text-muted-foreground">{comp.previous}</td>
                        <td className="p-3 text-center text-foreground font-bold">{comp.current}</td>
                        <td className={cn(
                          'p-3 text-center font-bold',
                          isPositive ? 'text-green-500' : 'text-red-500'
                        )}>
                          {isPositive ? '+' : ''}{comp.change_percent}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Module Statistics Section */}
        <div className="mt-8 print:mt-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-widest border-b border-border/40 pb-2 mb-4">
            Module Activity Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Citations Card */}
            <div className="rounded-lg border border-border p-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-indigo-500" />
                Citations Performance
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Live Citations</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.citations.live}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Added in Period</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.citations.added_this_period}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Total Profiled</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.citations.total}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/45 pt-3">
                <span>Total Live Percentage:</span>
                <span className="font-bold text-foreground">{data.citations.live_percentage}%</span>
              </div>
            </div>

            {/* Outreach Pipeline Card */}
            <div className="rounded-lg border border-border p-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5 text-indigo-500" />
                Outreach Pipeline
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Active Prospects</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.outreach.total_active}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Placed in Period</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.outreach.placed_this_period}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Conversion Rate</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.outreach.conversion_rate}%</p>
                </div>
              </div>
              
              <div className="mt-4 border-t border-border/45 pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Outreach Pipeline Stage Breakdown</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(data.outreach.stage_breakdown).map(([stage, count]) => (
                    <div key={stage} className="flex items-center justify-between py-0.5 border-b border-border/30 capitalize">
                      <span className="text-muted-foreground truncate">{stage.replace('_', ' ')}:</span>
                      <span className="font-bold text-foreground">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Guest Posts Card */}
            <div className="rounded-lg border border-border p-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-indigo-500" />
                Guest Posting Activity
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Live/Published</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.guest_posts.live}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Added in Period</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.guest_posts.added_this_period}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Average Domain Authority</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.guest_posts.avg_da}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/45 pt-3">
                <span>Total Guest Posts Drafted/Pitched:</span>
                <span className="font-bold text-foreground">{data.guest_posts.total}</span>
              </div>
            </div>

            {/* Digital PR Card */}
            <div className="rounded-lg border border-border p-5">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
                <Newspaper className="h-5 w-5 text-indigo-500" />
                Digital PR Placements
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Total Placements</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.digital_pr.total_placements}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Placements in Period</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.digital_pr.placements_this_period}</p>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <p className="text-xs text-muted-foreground font-semibold">Reach Estimate</p>
                  <p className="text-xl font-bold text-foreground mt-1">{data.digital_pr.total_reach.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/45 pt-3">
                <span>Digital PR campaign placements are live in system.</span>
              </div>
            </div>

            {/* Tasks Card */}
            <div className="rounded-lg border border-border p-5 md:col-span-2">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
                <CheckSquare className="h-5 w-5 text-indigo-500" />
                Task Completion Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col justify-center p-4 bg-muted/20 rounded-md text-center">
                  <p className="text-xs text-muted-foreground font-semibold">Completed in Period</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{data.tasks.completed_this_period}</p>
                </div>
                <div className="flex flex-col justify-center p-4 bg-muted/20 rounded-md text-center">
                  <p className="text-xs text-muted-foreground font-semibold">Currently Overdue</p>
                  <p className="text-2xl font-bold text-red-500 mt-1">{data.tasks.overdue}</p>
                </div>
                <div className="p-4 bg-muted/10 rounded-md">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 text-left">Completed By Team Member</p>
                  <div className="space-y-1.5 text-xs text-left max-h-24 overflow-y-auto">
                    {Object.entries(data.tasks.by_assignee || {}).length === 0 ? (
                      <p className="text-muted-foreground italic text-center py-2">No tasks completed</p>
                    ) : (
                      Object.entries(data.tasks.by_assignee || {}).map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between py-0.5 border-b border-border/20">
                          <span className="text-muted-foreground font-medium">{name}:</span>
                          <span className="font-bold text-foreground">{count as number}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
