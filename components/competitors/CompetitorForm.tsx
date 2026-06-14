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
import { CompetitorCreateSchema } from '@/lib/utils/validation'
import type { Competitor } from '@/lib/types'
import { toast } from 'sonner'

type FormValues = z.infer<typeof CompetitorCreateSchema>

interface CompetitorFormProps {
  competitor?: Competitor | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CompetitorForm({
  competitor,
  isOpen,
  onClose,
  onSuccess,
}: CompetitorFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!competitor

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CompetitorCreateSchema),
    defaultValues: {
      domain: '',
      display_name: '',
      niche: '',
      notes: '',
    },
  })

  // Reset form when competitor changes or sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (competitor) {
        reset({
          domain: competitor.domain,
          display_name: competitor.display_name || '',
          niche: competitor.niche || '',
          notes: competitor.notes || '',
        })
      } else {
        reset({
          domain: '',
          display_name: '',
          niche: '',
          notes: '',
        })
      }
    }
  }, [competitor, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/competitors/${competitor.id}` : '/api/competitors'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          domain: values.domain.toLowerCase().trim(),
          display_name: values.display_name || null,
          niche: values.niche || null,
          notes: values.notes || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save competitor')
      }

      toast.success(isEdit ? 'Competitor updated successfully' : 'Competitor added successfully')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the competitor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Competitor' : 'Add New Competitor'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the competitor domain tracking details.'
              : 'Add a new competitor domain to track backlink profiles and analyze search gaps.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="domain">Competitor Domain <span className="text-red-500">*</span></Label>
            <Input
              id="domain"
              placeholder="e.g. competitor.com"
              {...register('domain')}
              disabled={isEdit}
              className="bg-background border-input"
            />
            {errors.domain && (
              <p className="text-xs text-destructive">{errors.domain.message}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Note: Root domain only (no subfolders or protocols).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name / Brand</Label>
            <Input
              id="display_name"
              placeholder="e.g. Competitor Travel Portal"
              {...register('display_name')}
              className="bg-background border-input"
            />
            {errors.display_name && (
              <p className="text-xs text-destructive">{errors.display_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="niche">Niche Category</Label>
            <Input
              id="niche"
              placeholder="e.g. Travel Guides, Heritage"
              {...register('niche')}
              className="bg-background border-input"
            />
            {errors.niche && (
              <p className="text-xs text-destructive">{errors.niche.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Add any tracking instructions, notes about their ranking strategy, or search terms they focus on..."
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
                'Add Competitor'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
