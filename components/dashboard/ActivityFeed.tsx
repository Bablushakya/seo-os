'use client'

import React from 'react'
import useSWR from 'swr'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { 
  Building2, Mail, FileText, Newspaper, MapPin, CheckSquare, 
  Settings, UserPlus, FileUp, AlertTriangle, ShieldCheck 
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

interface ActivityItem {
  id: string
  user: {
    id: string
    full_name: string
    avatar_url: string | null
  }
  action: string
  module: string
  record_name: string
  created_at: string
}

export function ActivityFeed() {
  const { data: activities = [], error, isLoading } = useSWR<ActivityItem[]>('/api/dashboard/activity', fetcher, {
    revalidateOnFocus: true, // Refresh on window focus per DASH-001-08
  })

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'Citations':
        return <Building2 className="h-4 w-4 text-emerald-400" />
      case 'Outreach':
        return <Mail className="h-4 w-4 text-purple-400" />
      case 'Guest Posts':
        return <FileText className="h-4 w-4 text-sky-400" />
      case 'Digital PR':
        return <Newspaper className="h-4 w-4 text-orange-400" />
      case 'GBP':
        return <MapPin className="h-4 w-4 text-cyan-400" />
      case 'Tasks':
        return <CheckSquare className="h-4 w-4 text-rose-400" />
      case 'Reports':
        return <FileUp className="h-4 w-4 text-yellow-400" />
      case 'System':
        return <ShieldCheck className="h-4 w-4 text-zinc-400" />
      default:
        return <Settings className="h-4 w-4 text-zinc-400" />
    }
  }

  const formatRelativeTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(parseISO(timestamp), { addSuffix: true })
    } catch {
      return 'some time ago'
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-border bg-card rounded-lg h-full text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm font-semibold text-foreground">Failed to load activity feed</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full space-y-4">
        <Skeleton className="h-4 w-36" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full">
      <div className="mb-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Recent Activity
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time updates of team actions
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
          <span className="text-2xl mb-2" role="img" aria-label="Inbox">
            📥
          </span>
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">Actions will appear here as they happen.</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[350px] pr-1 my-auto">
          {activities.map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-xs border-b border-border/20 pb-3 last:border-0 last:pb-0">
              {/* User Avatar */}
              <Avatar className="h-8 w-8 border border-border bg-background">
                {item.user.avatar_url && <AvatarImage src={item.user.avatar_url} alt={item.user.full_name} />}
                <AvatarFallback className="text-[10px] font-bold text-muted-foreground bg-accent/25">
                  {item.user.full_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Action Description */}
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium leading-relaxed">
                  <span className="font-bold text-indigo-400 mr-1">{item.user.full_name}</span>
                  {item.action}
                  {item.record_name && (
                    <span className="font-semibold text-foreground bg-accent/35 px-1.5 py-0.5 rounded ml-1 font-mono text-[10px] tracking-tight">
                      {item.record_name}
                    </span>
                  )}
                </p>

                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {getModuleIcon(item.module)}
                    {item.module}
                  </span>
                  <span>•</span>
                  <span>{formatRelativeTime(item.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
