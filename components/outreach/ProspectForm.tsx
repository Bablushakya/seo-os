'use client'

import React, { useEffect } from 'react'
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
import { OutreachProspectCreateSchema } from '@/lib/utils/validation'
import { OUTREACH_STAGE_LABELS } from '@/lib/constants'
import type { OutreachProspect, OutreachPipelineStage, User } from '@/lib/types'
import { toast } from 'sonner'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

// Schema with cross-field validation for Dates
const formSchema = OutreachProspectCreateSchema.refine(
  (data) => {
    if (data.last_contact_date && data.next_followup_date) {
      return new Date(data.next_followup_date) >= new Date(data.last_contact_date)
    }
    return true
  },
  {
    message: 'Next follow-up date cannot be before last contact date',
    path: ['next_followup_date'],
  }
)

type FormValues = z.infer<typeof formSchema>

interface ProspectFormProps {
  prospect?: OutreachProspect | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ProspectForm({
  prospect,
  isOpen,
  onClose,
  onSuccess,
}: ProspectFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!prospect

  // Fetch users for assignee dropdown
  const { data: users } = useSWR<User[]>('/api/users', fetcher)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      site_name: '',
      url: '',
      domain_authority: 0,
      niche: '',
      contact_name: '',
      contact_email: '',
      pipeline_stage: 'identified',
      assigned_to: '',
      last_contact_date: '',
      next_followup_date: '',
      notes: '',
    },
  })

  const stageValue = watch('pipeline_stage')
  const assignedToValue = watch('assigned_to') || undefined

  // Reset form when prospect changes or sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (prospect) {
        reset({
          site_name: prospect.site_name,
          url: prospect.url,
          domain_authority: prospect.domain_authority,
          niche: prospect.niche || '',
          contact_name: prospect.contact_name || '',
          contact_email: prospect.contact_email || '',
          pipeline_stage: prospect.pipeline_stage,
          assigned_to: prospect.assigned_to || '',
          last_contact_date: prospect.last_contact_date || '',
          next_followup_date: prospect.next_followup_date || '',
          notes: prospect.notes || '',
        })
      } else {
        const todayStr = new Date().toISOString().split('T')[0]
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        const nextWeekStr = nextWeek.toISOString().split('T')[0]

        reset({
          site_name: '',
          url: '',
          domain_authority: 0,
          niche: '',
          contact_name: '',
          contact_email: '',
          pipeline_stage: 'identified',
          assigned_to: '',
          last_contact_date: todayStr,
          next_followup_date: nextWeekStr,
          notes: '',
        })
      }
    }
  }, [prospect, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/outreach/${prospect.id}` : '/api/outreach'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // Coerce empty strings to null for optional database fields
          contact_name: values.contact_name || null,
          contact_email: values.contact_email || null,
          niche: values.niche || null,
          assigned_to: values.assigned_to || null,
          last_contact_date: values.last_contact_date || null,
          next_followup_date: values.next_followup_date || null,
          notes: values.notes || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save prospect')
      }

      toast.success(isEdit ? 'Prospect updated successfully' : 'Prospect added successfully')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the prospect.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Prospect' : 'Add New Prospect'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the outreach prospect details and save changes.'
              : 'Add a new website prospect to start the outreach campaign.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="site_name">Website Name <span className="text-red-500">*</span></Label>
            <Input
              id="site_name"
              placeholder="e.g. TechCrunch"
              {...register('site_name')}
              className="bg-background border-input"
            />
            {errors.site_name && (
              <p className="text-xs text-destructive">{errors.site_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Website URL <span className="text-red-500">*</span></Label>
            <Input
              id="url"
              placeholder="e.g. https://techcrunch.com"
              {...register('url')}
              className="bg-background border-input"
            />
            {errors.url && (
              <p className="text-xs text-destructive">{errors.url.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="domain_authority">Domain Authority (DA)</Label>
              <Input
                id="domain_authority"
                type="number"
                min="0"
                max="100"
                {...register('domain_authority', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.domain_authority && (
                <p className="text-xs text-destructive">{errors.domain_authority.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="niche">Niche / Niche Category</Label>
              <Input
                id="niche"
                placeholder="e.g. Tech, Travel, Finance"
                {...register('niche')}
                className="bg-background border-input"
              />
              {errors.niche && (
                <p className="text-xs text-destructive">{errors.niche.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Person</Label>
              <Input
                id="contact_name"
                placeholder="e.g. John Doe"
                {...register('contact_name')}
                className="bg-background border-input"
              />
              {errors.contact_name && (
                <p className="text-xs text-destructive">{errors.contact_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                placeholder="e.g. contact@domain.com"
                {...register('contact_email')}
                className="bg-background border-input"
              />
              {errors.contact_email && (
                <p className="text-xs text-destructive">{errors.contact_email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline_stage">Pipeline Stage</Label>
              <Select
                value={stageValue}
                onValueChange={(val: OutreachPipelineStage) => setValue('pipeline_stage', val, { shouldValidate: true })}
              >
                <SelectTrigger id="pipeline_stage" className="bg-background border-input">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  {Object.entries(OUTREACH_STAGE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="focus:bg-accent focus:text-accent-foreground">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.pipeline_stage && (
                <p className="text-xs text-destructive">{errors.pipeline_stage.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select
                value={assignedToValue || 'unassigned'}
                onValueChange={(val) => setValue('assigned_to', val === 'unassigned' ? '' : val, { shouldValidate: true })}
              >
                <SelectTrigger id="assigned_to" className="bg-background border-input">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="focus:bg-accent focus:text-accent-foreground">
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assigned_to && (
                <p className="text-xs text-destructive">{errors.assigned_to.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="last_contact_date">Last Contact Date</Label>
              <Input
                id="last_contact_date"
                type="date"
                {...register('last_contact_date')}
                className="bg-background border-input"
              />
              {errors.last_contact_date && (
                <p className="text-xs text-destructive">{errors.last_contact_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="next_followup_date">Next Follow-Up Date</Label>
              <Input
                id="next_followup_date"
                type="date"
                {...register('next_followup_date')}
                className="bg-background border-input"
              />
              {errors.next_followup_date && (
                <p className="text-xs text-destructive">{errors.next_followup_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Pitch details</Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Add any information about the outreach campaign, preferred topics, guest post guidelines, prices, etc."
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
                'Add Prospect'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
