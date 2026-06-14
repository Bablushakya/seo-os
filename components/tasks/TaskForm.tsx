'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TaskCreateSchema } from '@/lib/utils/validation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertTriangle, Info, Search, X } from 'lucide-react'
import type { Task, TaskPriority, TaskStatus, ModuleType } from '@/lib/types'

type FormValues = z.infer<typeof TaskCreateSchema>

interface TaskFormProps {
  task?: Task | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  prefilledModuleType?: string
  prefilledModuleRecordId?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

export function TaskForm({
  task,
  isOpen,
  onClose,
  onSuccess,
  prefilledModuleType,
  prefilledModuleRecordId,
}: TaskFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  
  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedRecordLabel, setSelectedRecordLabel] = useState('')

  const isEdit = !!task

  // Fetch team members
  const { data: users = [] } = useSWR<any[]>('/api/users', fetcher)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(TaskCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      assignee: '',
      priority: 'medium',
      status: 'todo',
      due_date: '',
      module_type: null,
      module_record_id: null,
    },
  })

  const selectedPriority = watch('priority')
  const selectedStatus = watch('status')
  const selectedAssignee = watch('assignee')
  const selectedModuleType = watch('module_type')
  const selectedModuleRecordId = watch('module_record_id')
  const selectedDueDate = watch('due_date')

  // Check if due date is in the past
  const isDueDateInPast = React.useMemo(() => {
    if (!selectedDueDate) return false
    const todayStr = new Date().toISOString().split('T')[0]
    return selectedDueDate < todayStr!
  }, [selectedDueDate])

  // Reset/populate form
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      setSearchQuery('')
      setSearchResults([])
      setSelectedRecordLabel('')

      if (task) {
        reset({
          title: task.title,
          description: task.description || '',
          assignee: task.assignee || '',
          priority: task.priority,
          status: task.status,
          due_date: task.due_date || '',
          module_type: task.module_type || null,
          module_record_id: task.module_record_id || null,
        })
        
        // Fetch label for linked record if exists
        if (task.module_type && task.module_record_id) {
          fetchRecordLabel(task.module_type, task.module_record_id)
        }
      } else {
        const todayStr = new Date().toISOString().split('T')[0]
        reset({
          title: '',
          description: '',
          assignee: '', // empty defaults to unassigned
          priority: 'medium',
          status: 'todo',
          due_date: todayStr,
          module_type: (prefilledModuleType as any) || null,
          module_record_id: prefilledModuleRecordId || null,
        })

        if (prefilledModuleType && prefilledModuleRecordId) {
          fetchRecordLabel(prefilledModuleType, prefilledModuleRecordId)
        }
      }
    }
  }, [task, isOpen, reset, prefilledModuleType, prefilledModuleRecordId])

  // Fetch record label for editing/prefilled tasks
  const fetchRecordLabel = async (type: string, id: string) => {
    try {
      let url = ''
      if (type === 'citation') url = `/api/citations/${id}`
      else if (type === 'outreach') url = `/api/outreach/${id}`
      else if (type === 'guest_post') url = `/api/guest-posts/${id}`

      if (!url) return
      
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && json.data) {
        if (type === 'citation') {
          setSelectedRecordLabel(json.data.directory_name)
        } else if (type === 'outreach') {
          setSelectedRecordLabel(json.data.site_name)
        } else if (type === 'guest_post') {
          setSelectedRecordLabel(json.data.title || json.data.target_site)
        }
      }
    } catch (err) {
      console.warn('Failed to fetch record details for label:', err)
    }
  }

  // Type-ahead Autocomplete Search Logic
  useEffect(() => {
    if (!selectedModuleType || selectedModuleType === 'general') {
      setSearchResults([])
      return
    }

    const handler = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        let url = ''
        if (selectedModuleType === 'citation') {
          url = `/api/citations?search=${encodeURIComponent(searchQuery)}`
        } else if (selectedModuleType === 'outreach') {
          url = `/api/outreach?search=${encodeURIComponent(searchQuery)}`
        } else if (selectedModuleType === 'guest_post') {
          url = `/api/guest-posts?search=${encodeURIComponent(searchQuery)}`
        }

        if (url) {
          const res = await fetch(url)
          const json = await res.json()
          if (json.success) {
            // SWR paginated format contains data inside `json.data.data` or just `json.data`
            const rawData = Array.isArray(json.data) ? json.data : json.data?.data || []
            setSearchResults(rawData.slice(0, 5))
          }
        }
      } catch (err) {
        console.error('Record autocomplete failed:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(handler)
  }, [searchQuery, selectedModuleType])

  const selectRecord = (record: any) => {
    setValue('module_record_id', record.id)
    
    let label = ''
    if (selectedModuleType === 'citation') label = record.directory_name
    else if (selectedModuleType === 'outreach') label = record.site_name
    else if (selectedModuleType === 'guest_post') label = record.title || record.target_site

    setSelectedRecordLabel(label)
    setSearchResults([])
    setSearchQuery('')
  }

  const clearLinkedRecord = () => {
    setValue('module_record_id', null)
    setSelectedRecordLabel('')
  }

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/tasks/${task.id}` : '/api/tasks'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          assignee: values.assignee || null, // nullify empty string
          module_type: values.module_type || null,
          module_record_id: values.module_record_id || null,
          description: values.description || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save task')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the task.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Task' : 'Add New Task'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the task details and assignees below.'
              : 'Create a new operations checklist task.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              placeholder="e.g. Submit citation to Yelp"
              {...register('title')}
              className="bg-background border-input"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={3}
              placeholder="Provide detailed instructions about what needs to be done..."
              {...register('description')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label htmlFor="assignee">Assignee</Label>
            <Select
              value={selectedAssignee || 'unassigned'}
              onValueChange={(val) => setValue('assignee', val === 'unassigned' ? '' : val)}
            >
              <SelectTrigger id="assignee" className="bg-background border-input">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="focus:bg-accent focus:text-accent-foreground">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={u.avatar_url || ''} alt={u.full_name} />
                        <AvatarFallback className="text-[10px]">
                          {u.full_name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span>{u.full_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={selectedPriority}
                onValueChange={(val: TaskPriority) => setValue('priority', val)}
              >
                <SelectTrigger id="priority" className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={(val: TaskStatus) => setValue('status', val)}
              >
                <SelectTrigger id="status" className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date & Past Warning */}
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              {...register('due_date')}
              className="bg-background border-input"
            />
            {isDueDateInPast && selectedStatus !== 'done' && (
              <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium bg-amber-500/10 p-2 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Warning: The due date is in the past!</span>
              </div>
            )}
            {errors.due_date && (
              <p className="text-xs text-destructive">{errors.due_date.message}</p>
            )}
          </div>

          {/* Optional Module Linkage */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor="module_type">Link to SEO Module (Optional)</Label>
              <Select
                value={selectedModuleType || 'none'}
                onValueChange={(val) => {
                  setValue('module_type', val === 'none' ? null : (val as ModuleType))
                  clearLinkedRecord()
                }}
              >
                <SelectTrigger id="module_type" className="bg-background border-input">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="citation">Citation Directory</SelectItem>
                  <SelectItem value="outreach">Outreach Prospect</SelectItem>
                  <SelectItem value="guest_post">Guest Post</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedModuleType && selectedModuleType !== 'general' && (
              <div className="space-y-2">
                <Label>Link Record</Label>
                {selectedModuleRecordId ? (
                  <div className="flex items-center justify-between bg-muted border border-border p-2 rounded-md text-sm">
                    <span className="font-medium truncate max-w-[300px]">
                      {selectedRecordLabel || 'Linked Record'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearLinkedRecord}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={`Search ${selectedModuleType}s...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-background border-input"
                    />
                    
                    {isSearching && (
                      <div className="absolute right-2.5 top-2.5">
                        <LoadingSpinner size="sm" />
                      </div>
                    )}

                    {/* Autocomplete Dropdown Options */}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 border border-border bg-popover text-popover-foreground rounded-md shadow-lg overflow-hidden max-h-[180px] overflow-y-auto">
                        {searchResults.map((rec) => {
                          let label = ''
                          let sub = ''
                          if (selectedModuleType === 'citation') {
                            label = rec.directory_name
                            sub = rec.url
                          } else if (selectedModuleType === 'outreach') {
                            label = rec.site_name
                            sub = rec.url
                          } else if (selectedModuleType === 'guest_post') {
                            label = rec.title || 'Untitled Post'
                            sub = rec.target_site
                          }

                          return (
                            <div
                              key={rec.id}
                              onClick={() => selectRecord(rec)}
                              className="px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer flex flex-col gap-0.5 border-b border-border/40 last:border-b-0"
                            >
                              <span className="font-semibold truncate">{label}</span>
                              <span className="text-muted-foreground truncate">{sub}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <SheetFooter className="pt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-border hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2 border-t-primary-foreground" />
                  Saving...
                </>
              ) : isEdit ? (
                'Save Task'
              ) : (
                'Create Task'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
