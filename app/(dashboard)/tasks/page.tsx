'use client'

import React, { useState, useEffect } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableBodySkeleton, Skeleton } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Plus,
  Search,
  ChevronRight,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  UserCheck,
  Tag,
  Link as LinkIcon,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function TasksPage() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()

  // Active view: 'my_tasks' or 'all_tasks' (admins only)
  const [activeTab, setActiveTab] = useState<'my_tasks' | 'all_tasks'>('my_tasks')

  // Search & Filter state
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')
  const [moduleType, setModuleType] = useState<string>('all')

  // Sheet form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Reset tab if user changes and they are not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      setActiveTab('my_tasks')
    }
  }, [user])

  // Build query string
  const queryParts = [
    `page=${page}`,
    `limit=${limit}`,
    // If on "My Tasks", restrict assignee to current user
    activeTab === 'my_tasks' ? 'assignee=me' : '',
    // Don't show completed tasks in "My Tasks" checklist by default, but let filters override it
    activeTab === 'my_tasks' && status === 'all' ? 'status=todo,in_progress,blocked' : '',
    status && status !== 'all' ? `status=${status}` : '',
    priority && priority !== 'all' ? `priority=${priority}` : '',
    moduleType && moduleType !== 'all' ? `module_type=${moduleType}` : '',
  ].filter(Boolean)

  const queryString = queryParts.join('&')

  // SWR hook for tasks
  const { data: listData, error: listError, mutate: mutateTasks } = useSWR(
    `/api/tasks?${queryString}`,
    fetcher
  )

  const tasks = listData?.data || []
  const meta = listData?.meta || { total: 0, total_pages: 1 }

  // Handler: Mark task completed with optimistic UI
  const handleToggleComplete = async (taskItem: Task) => {
    const isDone = taskItem.status === 'done'
    const newStatus: TaskStatus = isDone ? 'todo' : 'done'

    // Capture states for rollback
    const previousTasks = listData

    // Optimistically update list
    if (listData) {
      const updatedList = tasks.map((t: Task) =>
        t.id === taskItem.id ? { ...t, status: newStatus } : t
      )
      // For "My Tasks" view, we filter out completed tasks immediately if status filter is 'all'
      const filteredList = activeTab === 'my_tasks' && status === 'all' && newStatus === 'done'
        ? updatedList.filter((t: Task) => t.id !== taskItem.id)
        : updatedList

      mutateTasks({ ...listData, data: filteredList }, false)
    }

    try {
      const res = await fetch(`/api/tasks/${taskItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update task')
      }

      toast.success(newStatus === 'done' ? 'Task marked complete!' : 'Task reopened.')
      mutateTasks()
      // Refresh other dashboards / widgets
      mutate('/api/dashboard/stats')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error updating task status')
      // Rollback
      mutateTasks(previousTasks, false)
    }
  }

  // Handler: Delete task
  const handleDeleteTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this task?')) return

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error?.message || 'Failed to delete task')
      }

      toast.success('Task deleted successfully')
      mutateTasks()
      mutate('/api/dashboard/stats')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error deleting task')
    }
  }

  const handleEditClick = (taskItem: Task) => {
    setSelectedTask(taskItem)
    setIsFormOpen(true)
  }

  const handleCreateClick = () => {
    setSelectedTask(null)
    setIsFormOpen(true)
  }

  const handleFormSuccess = () => {
    mutateTasks()
    mutate('/api/dashboard/stats')
  }

  // Grouping logic for "My Tasks"
  const getGroupedMyTasks = () => {
    const todayStr = new Date().toISOString().split('T')[0]!
    const today = new Date(todayStr)
    
    // end of this week
    const Sunday = new Date(today)
    Sunday.setDate(today.getDate() + (7 - today.getDay()))
    const sundayStr = Sunday.toISOString().split('T')[0]!

    const overdue: Task[] = []
    const dueToday: Task[] = []
    const dueThisWeek: Task[] = []
    const dueLater: Task[] = []
    const completed: Task[] = []

    tasks.forEach((t: Task) => {
      // Completed tasks go to their own group; skip from date groups unless filtering by done
      if (t.status === 'done') {
        completed.push(t)
        return
      }

      if (t.due_date) {
        if (t.due_date < todayStr) {
          overdue.push(t)
        } else if (t.due_date === todayStr) {
          dueToday.push(t)
        } else if (t.due_date <= sundayStr) {
          dueThisWeek.push(t)
        } else {
          dueLater.push(t)
        }
      } else {
        dueLater.push(t)
      }
    })

    return { overdue, dueToday, dueThisWeek, dueLater, completed }
  }

  const { overdue, dueToday, dueThisWeek, dueLater, completed } = getGroupedMyTasks()
  const isMyTasksEmpty = overdue.length === 0 && dueToday.length === 0 && dueThisWeek.length === 0 && dueLater.length === 0 && completed.length === 0

  const getPriorityBadgeColor = (p: TaskPriority) => {
    switch (p) {
      case 'high': return 'badge-high border-red-500/20'
      case 'medium': return 'badge-medium border-amber-500/20'
      case 'low': return 'badge-low border-slate-500/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getModuleIcon = (type: string | null) => {
    switch (type) {
      case 'citation': return <span className="text-[10px] uppercase font-bold text-blue-400">Citation</span>
      case 'outreach': return <span className="text-[10px] uppercase font-bold text-purple-400">Outreach</span>
      case 'guest_post': return <span className="text-[10px] uppercase font-bold text-emerald-400">Guest Post</span>
      default: return null
    }
  }

  const isLoading = !listData && !listError

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks Checklist</h1>
          <p className="text-sm text-muted-foreground">
            Manage daily off-page SEO operations and assignment check-lists.
          </p>
        </div>
        <Button
          onClick={handleCreateClick}
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Tabs list (Admins see My Tasks vs All Tasks, Specialists see only page label) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-1">
        {user?.role === 'admin' ? (
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as any)
              setPage(1)
            }}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-muted border border-border">
              <TabsTrigger value="my_tasks" className="data-[state=active]:bg-background">
                My Checklist
              </TabsTrigger>
              <TabsTrigger value="all_tasks" className="data-[state=active]:bg-background">
                All Operations Tasks
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <div className="text-sm font-semibold text-muted-foreground py-2">
            My Operations Checklist
          </div>
        )}

        {/* Flat Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status */}
          <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
            <span className="text-muted-foreground whitespace-nowrap">Status:</span>
            <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
              <SelectTrigger className="h-8 bg-background border-input w-full sm:w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-xs">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="done">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
            <span className="text-muted-foreground whitespace-nowrap">Priority:</span>
            <Select value={priority} onValueChange={(val) => { setPriority(val); setPage(1); }}>
              <SelectTrigger className="h-8 bg-background border-input w-full sm:w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-xs">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Module */}
          <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
            <span className="text-muted-foreground whitespace-nowrap">Module:</span>
            <Select value={moduleType} onValueChange={(val) => { setModuleType(val); setPage(1); }}>
              <SelectTrigger className="h-8 bg-background border-input w-full sm:w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-xs">
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="citation">Citations</SelectItem>
                <SelectItem value="outreach">Outreach</SelectItem>
                <SelectItem value="guest_post">Guest Posts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tab Contents: My Tasks checklist */}
      {activeTab === 'my_tasks' ? (
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="border border-border rounded-lg p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ) : isMyTasksEmpty ? (
            <div className="h-64 flex flex-col items-center justify-center border border-border rounded-lg bg-card/20 text-center p-6">
              <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
              <h3 className="text-base font-bold">🎉 No tasks due!</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Excellent work, your checklist is entirely clear. Use "+ New Task" to schedule something new.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group 1: Overdue */}
              {overdue.length > 0 && (
                <div className="border-red-900/40 bg-red-950/10">
                  <div className="flex items-center gap-2 p-3 bg-red-950/30 border-b border-red-900/40 text-red-400 rounded-t-lg font-semibold text-xs tracking-wider uppercase">
                    <AlertCircle className="h-4 w-4" />
                    Overdue ({overdue.length})
                  </div>
                  <div className="p-0 divide-y divide-border/40">
                    {overdue.map((t) => (
                      <TaskRowItem
                        key={t.id}
                        task={t}
                        onToggle={handleToggleComplete}
                        onClick={handleEditClick}
                        onDelete={handleDeleteTask}
                        priorityBadge={getPriorityBadgeColor(t.priority)}
                        moduleBadge={getModuleIcon(t.module_type)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Group 2: Today */}
              {dueToday.length > 0 && (
                <div className="border-amber-900/40 bg-card">
                  <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border text-amber-500 font-semibold text-xs tracking-wider uppercase">
                    <Calendar className="h-4 w-4" />
                    Due Today ({dueToday.length})
                  </div>
                  <div className="p-0 divide-y divide-border/40">
                    {dueToday.map((t) => (
                      <TaskRowItem
                        key={t.id}
                        task={t}
                        onToggle={handleToggleComplete}
                        onClick={handleEditClick}
                        onDelete={handleDeleteTask}
                        priorityBadge={getPriorityBadgeColor(t.priority)}
                        moduleBadge={getModuleIcon(t.module_type)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Group 3: This Week */}
              {dueThisWeek.length > 0 && (
                <div className="border-border bg-card">
                  <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border text-blue-400 font-semibold text-xs tracking-wider uppercase">
                    <Calendar className="h-4 w-4" />
                    This Week ({dueThisWeek.length})
                  </div>
                  <div className="p-0 divide-y divide-border/40">
                    {dueThisWeek.map((t) => (
                      <TaskRowItem
                        key={t.id}
                        task={t}
                        onToggle={handleToggleComplete}
                        onClick={handleEditClick}
                        onDelete={handleDeleteTask}
                        priorityBadge={getPriorityBadgeColor(t.priority)}
                        moduleBadge={getModuleIcon(t.module_type)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Group 4: Later / Unscheduled */}
              {dueLater.length > 0 && (
                <div className="border-border bg-card">
                  <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border text-muted-foreground font-semibold text-xs tracking-wider uppercase">
                    <Calendar className="h-4 w-4" />
                    Later / Unscheduled ({dueLater.length})
                  </div>
                  <div className="p-0 divide-y divide-border/40">
                    {dueLater.map((t) => (
                      <TaskRowItem
                        key={t.id}
                        task={t}
                        onToggle={handleToggleComplete}
                        onClick={handleEditClick}
                        onDelete={handleDeleteTask}
                        priorityBadge={getPriorityBadgeColor(t.priority)}
                        moduleBadge={getModuleIcon(t.module_type)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Group 5: Completed */}
              {completed.length > 0 && (
                <div className="border-border bg-card opacity-70">
                  <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border text-green-500 font-semibold text-xs tracking-wider uppercase">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed ({completed.length})
                  </div>
                  <div className="p-0 divide-y divide-border/40">
                    {completed.map((t) => (
                      <TaskRowItem
                        key={t.id}
                        task={t}
                        onToggle={handleToggleComplete}
                        onClick={handleEditClick}
                        onDelete={handleDeleteTask}
                        priorityBadge={getPriorityBadgeColor(t.priority)}
                        moduleBadge={getModuleIcon(t.module_type)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Flat list table view (Admin only) */
        <div className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="w-10 text-center font-semibold"></TableHead>
                  <TableHead className="font-semibold">Task Title</TableHead>
                  <TableHead className="font-semibold">Assignee</TableHead>
                  <TableHead className="font-semibold text-center w-[120px]">Priority</TableHead>
                  <TableHead className="font-semibold text-center w-[120px]">Status</TableHead>
                  <TableHead className="font-semibold">Due Date</TableHead>
                  <TableHead className="font-semibold">Linked Module</TableHead>
                  <TableHead className="w-12 text-center font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableBodySkeleton rows={10} columns={8} />
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <EmptyState
                        title="No tasks matching filters"
                        description="Try resetting your filters or create a new assignment task."
                        actionLabel="Create Task"
                        onAction={handleCreateClick}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((t: Task) => (
                    <TableRow
                      key={t.id}
                      onClick={() => handleEditClick(t)}
                      className="border-border hover:bg-muted/20 cursor-pointer"
                    >
                      {/* Checkbox */}
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                        <Checkbox
                          checked={t.status === 'done'}
                          onCheckedChange={() => handleToggleComplete(t)}
                          className="border-input data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                        />
                      </TableCell>

                      {/* Title */}
                      <TableCell className={cn(
                        'font-medium max-w-[250px] truncate',
                        t.status === 'done' && 'line-through text-muted-foreground'
                      )}>
                        {t.title}
                      </TableCell>

                      {/* Assignee */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {t.assignee_user ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={t.assignee_user.avatar_url || ''} alt={t.assignee_user.full_name} />
                              <AvatarFallback className="text-[10px]">
                                {t.assignee_user.full_name.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{t.assignee_user.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">Unassigned</span>
                        )}
                      </TableCell>

                      {/* Priority */}
                      <TableCell className="text-center">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold border', getPriorityBadgeColor(t.priority))}>
                          {t.priority}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                          t.status === 'done' && 'bg-green-500/10 text-green-500 border border-green-500/20',
                          t.status === 'todo' && 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
                          t.status === 'in_progress' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                          t.status === 'blocked' && 'bg-red-500/10 text-red-400 border border-red-500/20'
                        )}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </TableCell>

                      {/* Due Date */}
                      <TableCell className={cn(
                        'text-xs',
                        t.status !== 'done' && t.due_date && t.due_date < new Date().toISOString().split('T')[0]! && 'text-red-400 font-semibold'
                      )}>
                        {t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : '-'}
                      </TableCell>

                      {/* Module type */}
                      <TableCell>
                        {getModuleIcon(t.module_type)}
                      </TableCell>

                      {/* Delete Action */}
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteTask(e, t.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Sheet Form */}
      <TaskForm
        task={selectedTask}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}

// Row component for Checklist
interface TaskRowItemProps {
  task: Task
  onToggle: (task: Task) => void
  onClick: (task: Task) => void
  onDelete: (e: React.MouseEvent, id: string) => void
  priorityBadge: string
  moduleBadge: React.ReactNode
}

function TaskRowItem({
  task,
  onToggle,
  onClick,
  onDelete,
  priorityBadge,
  moduleBadge,
}: TaskRowItemProps) {
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0]! && task.status !== 'done'
  
  return (
    <div
      onClick={() => onClick(task)}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors group"
    >
      {/* Complete Checkbox */}
      <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
        <Checkbox
          checked={task.status === 'done'}
          onCheckedChange={() => onToggle(task)}
          className="border-input h-5 w-5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
        />
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            'text-sm font-semibold truncate',
            task.status === 'done' && 'line-through text-muted-foreground/60'
          )}>
            {task.title}
          </p>
          {/* Module tag */}
          {moduleBadge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-muted border border-border">
              {moduleBadge}
            </span>
          )}
        </div>
        
        {task.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[400px] mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      {/* Right widgets */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Priority */}
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold border capitalize', priorityBadge)}>
          {task.priority}
        </span>

        {/* Due Date */}
        {task.due_date && (
          <span className={cn(
            'text-xs font-mono',
            isOverdue ? 'text-red-400 font-bold' : 'text-muted-foreground'
          )}>
            {new Date(task.due_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}

        {/* Delete */}
        <div onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => onDelete(e, task.id)}
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
