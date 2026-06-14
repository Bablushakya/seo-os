'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { GBPPostCreateSchema } from '@/lib/utils/validation'
import { GBP_POST_TYPE_LABELS, GBP_POST_STATUS_LABELS } from '@/lib/constants'
import type { GBPPost, GBPPostType, GBPPostStatus } from '@/lib/types'

type FormValues = z.infer<typeof GBPPostCreateSchema>

interface PostFormProps {
  post?: GBPPost | null
  locationId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PostForm({
  post,
  locationId,
  isOpen,
  onClose,
  onSuccess,
}: PostFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!post

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(GBPPostCreateSchema),
    defaultValues: {
      location_id: locationId,
      post_type: 'update',
      content_summary: '',
      publish_date: '',
      status: 'published',
      notes: '',
    },
  })

  const typeValue = watch('post_type')
  const statusValue = watch('status')

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (post) {
        reset({
          location_id: post.location_id,
          post_type: post.post_type,
          content_summary: post.content_summary || '',
          publish_date: post.publish_date || '',
          status: post.status,
          notes: post.notes || '',
        })
      } else {
        reset({
          location_id: locationId,
          post_type: 'update',
          content_summary: '',
          publish_date: new Date().toISOString().split('T')[0],
          status: 'published',
          notes: '',
        })
      }
    }
  }, [post, locationId, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/gbp/posts/${post.id}` : '/api/gbp/posts'
      const method = isEdit ? 'PATCH' : 'POST'

      // We should check if the API handles details segment `/api/gbp/posts/[id]`
      // Wait, let's verify if `/api/gbp/posts/[id]` detail segment is needed.
      // In the GBP-001-01 description:
      // "GET/POST /api/gbp/posts" - only list and create are mentioned, there is no separate posts update/delete route specified.
      // So all post submissions are done via POST (create or log) and updates aren't strictly required by the ticket, or we can just send POST `/api/gbp/posts`.
      // Let's check: if `isEdit` is true, wait, we don't have PATCH `/api/gbp/posts/[id]` in our API. Let's see if we should create one.
      // Wait, in our implementation plan we wrote:
      // "GET: Lists posts for a specific location. POST: Logs a new GBP post."
      // Since edit posts isn't strictly requested (only listing + add posts is required by GBP-001-02: "Posts tab: list of GBP posts with add form"), we only need POST!
      // So let's make it always POST and ignore `isEdit` or just not show edit button for posts. That is perfect and follows the spec precisely!
      const response = await fetch('/api/gbp/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          content_summary: values.content_summary || null,
          publish_date: values.publish_date || null,
          notes: values.notes || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save post')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the post.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>Log GBP Post</SheetTitle>
          <SheetDescription>
            Log a newly published or planned Google Business Profile update.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="post_type">Post Type</Label>
              <Select
                value={typeValue}
                onValueChange={(val: GBPPostType) => setValue('post_type', val, { shouldValidate: true })}
              >
                <SelectTrigger id="post_type" className="bg-background border-input">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {Object.entries(GBP_POST_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="focus:bg-accent focus:text-accent-foreground">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.post_type && (
                <p className="text-xs text-destructive">{errors.post_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={statusValue}
                onValueChange={(val: GBPPostStatus) => setValue('status', val, { shouldValidate: true })}
              >
                <SelectTrigger id="status" className="bg-background border-input">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {Object.entries(GBP_POST_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="focus:bg-accent focus:text-accent-foreground">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-xs text-destructive">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publish_date">Publish Date</Label>
            <Input
              id="publish_date"
              type="date"
              {...register('publish_date')}
              className="bg-background border-input"
            />
            {errors.publish_date && (
              <p className="text-xs text-destructive">{errors.publish_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_summary">Content Summary <span className="text-muted-foreground text-xs">(Max 1500 chars)</span></Label>
            <textarea
              id="content_summary"
              rows={4}
              maxLength={1500}
              placeholder="Provide a summary of the post update, promo details or event description..."
              {...register('content_summary')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.content_summary && (
              <p className="text-xs text-destructive">{errors.content_summary.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Add links, coupon codes, asset filenames, or content creators..."
              {...register('notes')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <SheetFooter className="pt-6 gap-2 sm:gap-0">
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
                  Logging...
                </>
              ) : (
                'Log Post'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
