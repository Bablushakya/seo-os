'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
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
import { GuestPostCreateSchema } from '@/lib/utils/validation'
import { GUEST_POST_STATUS_LABELS } from '@/lib/constants'
import type { GuestPost, GuestPostStatus, OutreachProspect, User } from '@/lib/types'
import { toast } from 'sonner'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

type FormValues = z.infer<typeof GuestPostCreateSchema>

interface GuestPostFormProps {
  post?: GuestPost | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function GuestPostForm({
  post,
  isOpen,
  onClose,
  onSuccess,
}: GuestPostFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const searchParams = useSearchParams()

  const isEdit = !!post

  // Fetch users (authors) and prospects
  const { data: users } = useSWR<User[]>('/api/users', fetcher)
  const { data: prospectsData } = useSWR('/api/outreach?limit=100', fetcher)
  const prospects = prospectsData?.data || []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(GuestPostCreateSchema),
    defaultValues: {
      title: '',
      target_site: '',
      target_url: '',
      target_da: 0,
      author: '',
      status: 'pitching',
      topic: '',
      word_count: null as any,
      target_keyword: '',
      anchor_text: '',
      link_url: '',
      publish_date: '',
      doc_link: '',
      notes: '',
      linked_prospect: '',
    },
  })

  const statusValue = watch('status')
  const authorValue = watch('author') || undefined
  const prospectValue = watch('linked_prospect') || undefined

  // Auto-fill target details when a prospect is selected
  const handleProspectChange = (prospectId: string) => {
    setValue('linked_prospect', prospectId === 'none' ? null : prospectId, { shouldValidate: true })

    if (prospectId && prospectId !== 'none') {
      const selected = prospects.find((p: OutreachProspect) => p.id === prospectId)
      if (selected) {
        setValue('target_site', selected.site_name, { shouldValidate: true })
        setValue('target_da', selected.domain_authority, { shouldValidate: true })
        setValue('target_url', selected.url, { shouldValidate: true })
        toast.info(`Auto-filled site details from ${selected.site_name}`)
      }
    }
  }

  // Handle resets & pre-fills (e.g. from redirect url query)
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)

      if (isEdit && post) {
        reset({
          title: post.title,
          target_site: post.target_site,
          target_url: post.target_url || '',
          target_da: post.target_da,
          author: post.author || '',
          status: post.status,
          topic: post.topic || '',
          word_count: post.word_count || (null as any),
          target_keyword: post.target_keyword || '',
          anchor_text: post.anchor_text || '',
          link_url: post.link_url || '',
          publish_date: post.publish_date || '',
          doc_link: post.doc_link || '',
          notes: post.notes || '',
          linked_prospect: post.linked_prospect || '',
        })
      } else {
        // Read URL search params for creation
        const prospectId = searchParams.get('prospect_id') || ''
        const siteName = searchParams.get('site_name') || ''
        const daStr = searchParams.get('da') || '0'
        const url = searchParams.get('url') || ''

        reset({
          title: '',
          target_site: siteName,
          target_url: url,
          target_da: parseInt(daStr, 10) || 0,
          author: '',
          status: 'pitching',
          topic: '',
          word_count: null as any,
          target_keyword: '',
          anchor_text: '',
          link_url: '',
          publish_date: new Date().toISOString().split('T')[0],
          doc_link: '',
          notes: '',
          linked_prospect: prospectId,
        })
      }
    }
  }, [post, isOpen, reset, isEdit, searchParams])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/guest-posts/${post.id}` : '/api/guest-posts'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // Coerce empty strings to null for optional database fields
          target_url: values.target_url || null,
          author: values.author || null,
          topic: values.topic || null,
          word_count: values.word_count !== undefined && values.word_count !== null && (values.word_count as any) !== '' ? Number(values.word_count) : null,
          target_keyword: values.target_keyword || null,
          anchor_text: values.anchor_text || null,
          link_url: values.link_url || null,
          publish_date: values.publish_date || null,
          doc_link: values.doc_link || null,
          notes: values.notes || null,
          linked_prospect: values.linked_prospect || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save guest post')
      }

      toast.success(isEdit ? 'Guest post updated successfully' : 'Guest post created successfully')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the guest post.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Guest Post' : 'Create Guest Post'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the details of this guest post listing.'
              : 'Add a new guest post content piece to track publication status.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {submitError}
            </div>
          )}

          {/* Link to Prospect Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="linked_prospect">Link to Outreach Prospect</Label>
            <Select
              value={prospectValue || 'none'}
              onValueChange={handleProspectChange}
            >
              <SelectTrigger id="linked_prospect" className="bg-background border-input">
                <SelectValue placeholder="Select active prospect" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="none">Not Linked</SelectItem>
                {prospects.map((p: OutreachProspect) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.site_name} (DA {p.domain_authority})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Linking a prospect automatically pre-fills site name, URL, and Domain Authority.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Article Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              placeholder="e.g. 10 Best Historical Places in Rajasthan"
              {...register('title')}
              className="bg-background border-input"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_site">Target Site <span className="text-red-500">*</span></Label>
              <Input
                id="target_site"
                placeholder="e.g. TravelBlog.com"
                {...register('target_site')}
                className="bg-background border-input"
              />
              {errors.target_site && (
                <p className="text-xs text-destructive">{errors.target_site.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_da">Target DA</Label>
              <Input
                id="target_da"
                type="number"
                min="0"
                max="100"
                {...register('target_da', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.target_da && (
                <p className="text-xs text-destructive">{errors.target_da.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_url">Target Site URL</Label>
            <Input
              id="target_url"
              placeholder="e.g. https://travelblog.com"
              {...register('target_url')}
              className="bg-background border-input"
            />
            {errors.target_url && (
              <p className="text-xs text-destructive">{errors.target_url.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gp_status">Status</Label>
              <Select
                value={statusValue}
                onValueChange={(val: GuestPostStatus) => setValue('status', val, { shouldValidate: true })}
              >
                <SelectTrigger id="gp_status" className="bg-background border-input">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  {Object.entries(GUEST_POST_STATUS_LABELS).map(([key, label]) => (
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

            <div className="space-y-2">
              <Label htmlFor="gp_author">Author / Assignee</Label>
              <Select
                value={authorValue || 'none'}
                onValueChange={(val) => setValue('author', val === 'none' ? '' : val, { shouldValidate: true })}
              >
                <SelectTrigger id="gp_author" className="bg-background border-input">
                  <SelectValue placeholder="Select author" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="none">None</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="focus:bg-accent focus:text-accent-foreground">
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.author && (
                <p className="text-xs text-destructive">{errors.author.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic / Category</Label>
              <Input
                id="topic"
                placeholder="e.g. Travel Guides"
                {...register('topic')}
                className="bg-background border-input"
              />
              {errors.topic && (
                <p className="text-xs text-destructive">{errors.topic.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="word_count">Word Count</Label>
              <Input
                id="word_count"
                type="number"
                placeholder="e.g. 1200"
                {...register('word_count')}
                className="bg-background border-input"
              />
              {errors.word_count && (
                <p className="text-xs text-destructive">{errors.word_count.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_keyword">Target Keyword</Label>
              <Input
                id="target_keyword"
                placeholder="e.g. rajasthan travel guide"
                {...register('target_keyword')}
                className="bg-background border-input"
              />
              {errors.target_keyword && (
                <p className="text-xs text-destructive">{errors.target_keyword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="anchor_text">Anchor Text</Label>
              <Input
                id="anchor_text"
                placeholder="e.g. trip to Rajasthan"
                {...register('anchor_text')}
                className="bg-background border-input"
              />
              {errors.anchor_text && (
                <p className="text-xs text-destructive">{errors.anchor_text.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link_url">Target Link URL</Label>
            <Input
              id="link_url"
              placeholder="e.g. https://indiaheritagetravel.com/rajasthan"
              {...register('link_url')}
              className="bg-background border-input"
            />
            {errors.link_url && (
              <p className="text-xs text-destructive">{errors.link_url.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publish_date">Publish/Target Date</Label>
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
              <Label htmlFor="doc_link">Google Doc Link</Label>
              <Input
                id="doc_link"
                placeholder="e.g. https://docs.google.com/..."
                {...register('doc_link')}
                className="bg-background border-input"
              />
              {errors.doc_link && (
                <p className="text-xs text-destructive">{errors.doc_link.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gp_notes">Notes / Writing Instructions</Label>
            <textarea
              id="gp_notes"
              rows={4}
              placeholder="Add any writing details, outline links, target keywords, guidelines or placement feedback..."
              {...register('notes')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
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
                'Save Changes'
              ) : (
                'Create Guest Post'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
