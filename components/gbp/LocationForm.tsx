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
import { GBPLocationCreateSchema } from '@/lib/utils/validation'
import type { GBPLocation } from '@/lib/types'

type FormValues = z.infer<typeof GBPLocationCreateSchema>

interface LocationFormProps {
  location?: GBPLocation | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function LocationForm({
  location,
  isOpen,
  onClose,
  onSuccess,
}: LocationFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!location

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(GBPLocationCreateSchema),
    defaultValues: {
      business_name: 'India Heritage Travel',
      location_name: '',
      google_maps_url: '',
      category: 'Travel Agency',
      is_active: true,
    },
  })

  const isActiveValue = watch('is_active')

  // Reset form on change or open
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (location) {
        reset({
          business_name: location.business_name,
          location_name: location.location_name,
          google_maps_url: location.google_maps_url || '',
          category: location.category || '',
          is_active: location.is_active,
        })
      } else {
        reset({
          business_name: 'India Heritage Travel',
          location_name: '',
          google_maps_url: '',
          category: 'Travel Agency',
          is_active: true,
        })
      }
    }
  }, [location, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/gbp/locations/${location.id}` : '/api/gbp/locations'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          google_maps_url: values.google_maps_url || null,
          category: values.category || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save location')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the location.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Location' : 'Add New GBP Location'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the Google Business Profile location details.'
              : 'Add a new business location to start tracking GBP posts, reviews, and metrics.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name <span className="text-red-500">*</span></Label>
            <Input
              id="business_name"
              placeholder="e.g. India Heritage Travel"
              {...register('business_name')}
              className="bg-background border-input"
            />
            {errors.business_name && (
              <p className="text-xs text-destructive">{errors.business_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location_name">Location Name <span className="text-red-500">*</span></Label>
            <Input
              id="location_name"
              placeholder="e.g. Delhi Office, Mumbai Branch"
              {...register('location_name')}
              className="bg-background border-input"
            />
            {errors.location_name && (
              <p className="text-xs text-destructive">{errors.location_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="google_maps_url">Google Maps URL</Label>
            <Input
              id="google_maps_url"
              placeholder="e.g. https://maps.google.com/?cid=..."
              {...register('google_maps_url')}
              className="bg-background border-input"
            />
            {errors.google_maps_url && (
              <p className="text-xs text-destructive">{errors.google_maps_url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g. Travel Agency, Tour Operator"
              {...register('category')}
              className="bg-background border-input"
            />
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Active Location</Label>
              <p className="text-xs text-muted-foreground">Toggle whether listings are currently active.</p>
            </div>
            <input
              id="is_active"
              type="checkbox"
              checked={isActiveValue}
              onChange={(e) => setValue('is_active', e.target.checked, { shouldValidate: true })}
              className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring focus:ring-offset-2"
            />
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
                'Add Location'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
