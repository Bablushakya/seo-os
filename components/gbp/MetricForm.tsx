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
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { GBPMetricCreateSchema } from '@/lib/utils/validation'
import type { GBPMetric } from '@/lib/types'

type FormValues = z.infer<typeof GBPMetricCreateSchema>

interface MetricFormProps {
  metric?: GBPMetric | null
  locationId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function MetricForm({
  metric,
  locationId,
  isOpen,
  onClose,
  onSuccess,
}: MetricFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  
  // Custom state for month/year selectors
  const [selectedMonth, setSelectedMonth] = React.useState('')

  const isEdit = !!metric

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(GBPMetricCreateSchema),
    defaultValues: {
      location_id: locationId,
      metric_month: '',
      views: 0,
      clicks: 0,
      calls: 0,
      direction_requests: 0,
      photo_views: 0,
    },
  })

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (metric) {
        // Coerce ISO date like 2026-06-01 to YYYY-MM for the month picker
        const monthVal = metric.metric_month ? metric.metric_month.substring(0, 7) : ''
        setSelectedMonth(monthVal)
        reset({
          location_id: metric.location_id,
          metric_month: metric.metric_month,
          views: metric.views,
          clicks: metric.clicks,
          calls: metric.calls,
          direction_requests: metric.direction_requests,
          photo_views: metric.photo_views,
        })
      } else {
        const now = new Date()
        const monthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setSelectedMonth(monthVal)
        reset({
          location_id: locationId,
          metric_month: `${monthVal}-01`,
          views: 0,
          clicks: 0,
          calls: 0,
          direction_requests: 0,
          photo_views: 0,
        })
      }
    }
  }, [metric, locationId, isOpen, reset])

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value // YYYY-MM
    setSelectedMonth(val)
    if (val) {
      setValue('metric_month', `${val}-01`, { shouldValidate: true })
    } else {
      setValue('metric_month', '', { shouldValidate: true })
    }
  }

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch('/api/gbp/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save metrics')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving metrics.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Monthly Metrics' : 'Log Monthly Metrics'}</SheetTitle>
          <SheetDescription>
            Record GBP performance metrics. Duplicate entries for the same month will update the existing record.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="metric_month">Reporting Month <span className="text-red-500">*</span></Label>
            <Input
              id="metric_month"
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              disabled={isEdit} // Do not allow changing month on edit
              className="bg-background border-input"
            />
            {errors.metric_month && (
              <p className="text-xs text-destructive">{errors.metric_month.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="views">Profile Views</Label>
              <Input
                id="views"
                type="number"
                min="0"
                {...register('views', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.views && (
                <p className="text-xs text-destructive">{errors.views.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clicks">Website Clicks</Label>
              <Input
                id="clicks"
                type="number"
                min="0"
                {...register('clicks', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.clicks && (
                <p className="text-xs text-destructive">{errors.clicks.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calls">Phone Calls</Label>
              <Input
                id="calls"
                type="number"
                min="0"
                {...register('calls', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.calls && (
                <p className="text-xs text-destructive">{errors.calls.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction_requests">Direction Requests</Label>
              <Input
                id="direction_requests"
                type="number"
                min="0"
                {...register('direction_requests', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.direction_requests && (
                <p className="text-xs text-destructive">{errors.direction_requests.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo_views">Photo Views</Label>
            <Input
              id="photo_views"
              type="number"
              min="0"
              {...register('photo_views', { valueAsNumber: true })}
              className="bg-background border-input"
            />
            {errors.photo_views && (
              <p className="text-xs text-destructive">{errors.photo_views.message}</p>
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
                  Saving...
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Log Month'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
