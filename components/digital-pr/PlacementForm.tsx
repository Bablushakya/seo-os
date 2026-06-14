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
import { PRPlacementCreateSchema } from '@/lib/utils/validation'
import type { PRPlacement, PRCampaign } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json().then((json) => json.data))

type FormValues = z.infer<typeof PRPlacementCreateSchema>

interface PlacementFormProps {
  placement?: PRPlacement | null
  campaignId?: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PlacementForm({
  placement,
  campaignId,
  isOpen,
  onClose,
  onSuccess,
}: PlacementFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!placement

  // Fetch campaigns for dropdown if campaignId is not locked
  const { data: campaignsData } = useSWR<PRCampaign[]>(
    isOpen && !campaignId ? '/api/digital-pr/campaigns?limit=100' : null,
    fetcher
  )
  const campaigns = campaignsData || []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(PRPlacementCreateSchema),
    defaultValues: {
      campaign_id: '',
      publication: '',
      url: '',
      domain_authority: 0,
      placement_date: '',
      reach_estimate: 0,
      notes: '',
    },
  })

  const selectedCampaignId = watch('campaign_id')

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (placement) {
        reset({
          campaign_id: placement.campaign_id,
          publication: placement.publication,
          url: placement.url || '',
          domain_authority: placement.domain_authority,
          placement_date: placement.placement_date || '',
          reach_estimate: placement.reach_estimate,
          notes: placement.notes || '',
        })
      } else {
        reset({
          campaign_id: campaignId || '',
          publication: '',
          url: '',
          domain_authority: 0,
          placement_date: new Date().toISOString().split('T')[0],
          reach_estimate: 0,
          notes: '',
        })
      }
    }
  }, [placement, campaignId, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/digital-pr/placements/${placement.id}` : '/api/digital-pr/placements'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          url: values.url || null,
          placement_date: values.placement_date || null,
          notes: values.notes || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save placement')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the placement.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit PR Placement' : 'Add New PR Placement'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the details of this PR placement.'
              : 'Log a new link placement obtained from a news/media publication.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          {!campaignId ? (
            <div className="space-y-2">
              <Label htmlFor="campaign_id">PR Campaign <span className="text-red-500">*</span></Label>
              <Select
                value={selectedCampaignId}
                onValueChange={(val) => setValue('campaign_id', val, { shouldValidate: true })}
              >
                <SelectTrigger id="campaign_id" className="bg-background border-input">
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="focus:bg-accent focus:text-accent-foreground">
                      {c.campaign_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.campaign_id && (
                <p className="text-xs text-destructive">{errors.campaign_id.message}</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="publication">Publication Name <span className="text-red-500">*</span></Label>
            <Input
              id="publication"
              placeholder="e.g. Forbes, Lonely Planet, Travel + Leisure"
              {...register('publication')}
              className="bg-background border-input"
            />
            {errors.publication && (
              <p className="text-xs text-destructive">{errors.publication.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Placement URL</Label>
            <Input
              id="url"
              placeholder="e.g. https://www.forbes.com/sites/travel/article"
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
              <Label htmlFor="reach_estimate">Est. Reach / Traffic</Label>
              <Input
                id="reach_estimate"
                type="number"
                min="0"
                placeholder="e.g. 50000"
                {...register('reach_estimate', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.reach_estimate && (
                <p className="text-xs text-destructive">{errors.reach_estimate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="placement_date">Placement Date</Label>
            <Input
              id="placement_date"
              type="date"
              {...register('placement_date')}
              className="bg-background border-input"
            />
            {errors.placement_date && (
              <p className="text-xs text-destructive">{errors.placement_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Any details on anchor text, link type (dofollow/nofollow), reporter name, etc..."
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
                'Add Placement'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
