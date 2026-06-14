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
import { PRCampaignCreateSchema } from '@/lib/utils/validation'
import { PR_CAMPAIGN_STATUS_LABELS } from '@/lib/constants'
import type { PRCampaign, PRCampaignStatus } from '@/lib/types'

type FormValues = z.infer<typeof PRCampaignCreateSchema>

interface CampaignFormProps {
  campaign?: PRCampaign | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CampaignForm({
  campaign,
  isOpen,
  onClose,
  onSuccess,
}: CampaignFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!campaign

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(PRCampaignCreateSchema),
    defaultValues: {
      campaign_name: '',
      topic: '',
      status: 'planning',
      launch_date: '',
      notes: '',
    },
  })

  const statusValue = watch('status')

  // Reset form when campaign changes or sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (campaign) {
        reset({
          campaign_name: campaign.campaign_name,
          topic: campaign.topic || '',
          status: campaign.status,
          launch_date: campaign.launch_date || '',
          notes: campaign.notes || '',
        })
      } else {
        reset({
          campaign_name: '',
          topic: '',
          status: 'planning',
          launch_date: new Date().toISOString().split('T')[0],
          notes: '',
        })
      }
    }
  }, [campaign, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/digital-pr/campaigns/${campaign.id}` : '/api/digital-pr/campaigns'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          topic: values.topic || null,
          launch_date: values.launch_date || null,
          notes: values.notes || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save campaign')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the campaign.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit PR Campaign' : 'Add New PR Campaign'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the Digital PR campaign details and save changes.'
              : 'Add a new Digital PR campaign (e.g. data studies, HARO outreach).'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="campaign_name">Campaign Name <span className="text-red-500">*</span></Label>
            <Input
              id="campaign_name"
              placeholder="e.g. 2026 India Heritage Travel Survey"
              {...register('campaign_name')}
              className="bg-background border-input"
            />
            {errors.campaign_name && (
              <p className="text-xs text-destructive">{errors.campaign_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Topic / Angle</Label>
            <Input
              id="topic"
              placeholder="e.g. Sustainable Tourism in Rajasthan"
              {...register('topic')}
              className="bg-background border-input"
            />
            {errors.topic && (
              <p className="text-xs text-destructive">{errors.topic.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={statusValue}
                onValueChange={(val: PRCampaignStatus) => setValue('status', val, { shouldValidate: true })}
              >
                <SelectTrigger id="status" className="bg-background border-input">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {Object.entries(PR_CAMPAIGN_STATUS_LABELS).map(([key, label]) => (
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
              <Label htmlFor="launch_date">Launch Date</Label>
              <Input
                id="launch_date"
                type="date"
                {...register('launch_date')}
                className="bg-background border-input"
              />
              {errors.launch_date && (
                <p className="text-xs text-destructive">{errors.launch_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={5}
              placeholder="Outline the pitch angles, email templates, target audiences, or links to assets..."
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
                'Add Campaign'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
