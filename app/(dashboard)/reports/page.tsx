'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
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
import {
  BarChart,
  Plus,
  RefreshCw,
  Calendar,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Report } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const { data: reports = [], error, isLoading, mutate } = useSWR<Report[]>('/api/reports', fetcher)
  
  const [generatingWeekly, setGeneratingWeekly] = useState(false)
  const [generatingMonthly, setGeneratingMonthly] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  // Clear highlight after 5 seconds
  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => {
      setHighlightedId(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [highlightedId])

  const handleGenerate = async (type: 'weekly' | 'monthly') => {
    if (type === 'weekly') setGeneratingWeekly(true)
    if (type === 'monthly') setGeneratingMonthly(true)

    try {
      const res = await fetch(`/api/reports/generate/${type}`, {
        method: 'POST',
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || `Failed to generate ${type} report`)
      }

      toast.success(`${type === 'weekly' ? 'Weekly' : 'Monthly'} report generated successfully!`)
      setHighlightedId(result.data.id)
      mutate() // Refresh the report list
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || `Error generating ${type} report`)
    } finally {
      setGeneratingWeekly(false)
      setGeneratingMonthly(false)
    }
  }

  // Helper to format date range
  const formatPeriod = (report: Report) => {
    const start = new Date(report.period_start)
    const end = new Date(report.period_end)
    
    if (report.report_type === 'monthly') {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const formatGeneratedAt = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-96">
        <EmptyState
          title="Failed to load reports"
          description="There was an error loading the performance reports. Please try reloading the page."
          icon={<BarChart className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart className="h-6 w-6 text-indigo-500" />
            Performance Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and view weekly/monthly search engine optimization reports and AI executive summaries.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              disabled={generatingWeekly || generatingMonthly}
              onClick={() => handleGenerate('weekly')}
              className="flex items-center gap-2"
            >
              {generatingWeekly ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-indigo-400" />
              )}
              {generatingWeekly ? 'Generating Weekly...' : 'Generate Weekly'}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={generatingWeekly || generatingMonthly}
              onClick={() => handleGenerate('monthly')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white animate-fade-in"
            >
              {generatingMonthly ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              {generatingMonthly ? 'Generating Monthly...' : 'Generate Monthly'}
            </Button>
          </div>
        )}
      </div>

      {/* Reports List */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {isLoading && reports.length === 0 ? (
          <div className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Generated By</TableHead>
                  <TableHead>Generated At</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBodySkeleton columns={6} rows={5} />
            </Table>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              title="No reports generated yet"
              description={
                isAdmin
                  ? "Click 'Generate' in the top right to build your first performance report."
                  : 'Wait for Bharat (Founder) to generate weekly or monthly performance reports.'
              }
              icon={<BarChart className="h-12 w-12 text-muted-foreground" />}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-muted-foreground">Report Name</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Type</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Reporting Period</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Generated By</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Generated At</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const isWeekly = report.report_type === 'weekly'
                const isHighlighted = highlightedId === report.id
                
                return (
                  <TableRow
                    key={report.id}
                    className={cn(
                      'cursor-pointer transition-all duration-300 hover:bg-muted/50 border-b border-border/60',
                      isHighlighted && 'bg-indigo-600/10 border-l-4 border-l-indigo-600 dark:bg-indigo-500/10'
                    )}
                  >
                    <TableCell className="font-medium text-foreground py-4">
                      <Link href={`/reports/${report.id}`} className="block">
                        {isWeekly ? 'Weekly Performance Report' : 'Monthly Performance Report'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/reports/${report.id}`} className="block">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
                            isWeekly
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          )}
                        >
                          {report.report_type}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium">
                      <Link href={`/reports/${report.id}`} className="block">
                        {formatPeriod(report)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link href={`/reports/${report.id}`} className="block">
                        {report.creator?.full_name || 'System Auto'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <Link href={`/reports/${report.id}`} className="block">
                        {formatGeneratedAt(report.generated_at)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/reports/${report.id}`} className="flex items-center justify-center text-muted-foreground hover:text-indigo-400 transition-colors">
                        <ChevronRight className="h-4.5 w-4.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
