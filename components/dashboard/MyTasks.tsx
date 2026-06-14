'use client'

import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckSquare, Clock } from 'lucide-react'
import { toast } from 'sonner'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'blocked' | 'done'
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  module_type: string | null
  module_record_id: string | null
}

export function MyTasks() {
  const { data: tasks = [], error, isLoading } = useSWR<Task[]>('/api/dashboard/tasks', fetcher)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleMarkDone = async (taskId: string) => {
    setUpdatingId(taskId)
    
    // Optimistic UI update
    const updatedTasks = tasks.filter((t) => t.id !== taskId)
    mutate('/api/dashboard/tasks', updatedTasks, false)

    try {
      const res = await fetch('/api/dashboard/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: 'done' }),
      })

      if (!res.ok) {
        throw new Error('Failed to update task')
      }

      toast.success('Task completed!')
      // Refresh stats in the background
      mutate('/api/dashboard/stats')
    } catch (err) {
      toast.error('Failed to complete task')
      // Rollback
      mutate('/api/dashboard/tasks')
    } finally {
      setUpdatingId(null)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-border bg-card rounded-lg h-full text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm font-semibold text-foreground">Failed to load tasks</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Get current date string in local timezone (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0]!

  // Group tasks
  const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < todayStr)
  const todayTasks = tasks.filter((t) => t.due_date === todayStr)
  const futureTasks = tasks.filter((t) => t.due_date && t.due_date > todayStr)

  // Combined sorted list: Overdue first, then Today, then Future
  const sortedDisplayTasks = [...overdueTasks, ...todayTasks, ...futureTasks]
  const displayTasks = sortedDisplayTasks.slice(0, 5)
  const remainingCount = Math.max(0, tasks.length - 5)

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare className="h-4 w-4 text-indigo-500" />
            My Tasks
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your active checklist ({tasks.length} remaining)
          </p>
        </div>
        <Link
          href="/tasks"
          className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 transition-colors"
        >
          View all
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
          <span className="text-3xl mb-2" role="img" aria-label="party popper">
            🎉
          </span>
          <p className="text-sm font-medium text-foreground">All caught up!</p>
          <p className="text-xs text-muted-foreground mt-1">No pending tasks assigned to you.</p>
        </div>
      ) : (
        <div className="space-y-4 my-auto">
          <div className="space-y-2">
            {displayTasks.map((task) => {
              const isOverdue = task.due_date && task.due_date < todayStr
              const isToday = task.due_date === todayStr

              let dueDateColor = 'text-muted-foreground'
              if (isOverdue) dueDateColor = 'text-red-500 font-medium'
              else if (isToday) dueDateColor = 'text-amber-500 font-medium'

              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-2.5 rounded-md hover:bg-accent/30 transition-colors border border-transparent hover:border-border/30"
                >
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={task.status === 'done'}
                    onCheckedChange={() => handleMarkDone(task.id)}
                    disabled={updatingId === task.id}
                    className="mt-1 border-muted-foreground/50 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground line-clamp-1">
                        {task.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 capitalize flex-shrink-0 ${
                          task.priority === 'high'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : task.priority === 'medium'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {task.priority}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                      {task.module_type && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-border bg-background uppercase font-mono text-muted-foreground">
                          {task.module_type}
                        </Badge>
                      )}
                      
                      {task.due_date && (
                        <span className={`flex items-center gap-0.5 ${dueDateColor}`}>
                          <Clock className="h-3 w-3" />
                          {isOverdue ? 'Overdue: ' : isToday ? 'Today' : ''}
                          {task.due_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {remainingCount > 0 && (
            <p className="text-center text-xs text-muted-foreground font-medium bg-accent/20 py-1.5 rounded-md border border-border/10">
              + {remainingCount} more pending tasks
            </p>
          )}
        </div>
      )}
    </div>
  )
}
