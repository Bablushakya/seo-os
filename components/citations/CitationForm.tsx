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
import { CitationCreateSchema } from '@/lib/utils/validation'
import { CITATION_STATUS_LABELS } from '@/lib/constants'
 // Wait, let's verify toast implementation
import type { Citation, CitationStatus } from '@/lib/types'

// Schema with cross-field validation for Dates
const formSchema = CitationCreateSchema.refine(
  (data) => {
    if (data.date_submitted && data.date_live) {
      return new Date(data.date_live) >= new Date(data.date_submitted)
    }
    return true
  },
  {
    message: 'Date Live cannot be before Date Submitted',
    path: ['date_live'],
  }
)

type FormValues = z.infer<typeof formSchema>

interface CitationFormProps {
  citation?: Citation | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CitationForm({
  citation,
  isOpen,
  onClose,
  onSuccess,
}: CitationFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!citation

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
      directory_name: '',
      url: '',
      domain_authority: 0,
      niche: '',
      status: 'pending',
      date_submitted: '',
      date_live: '',
      notes: '',
    },
  })

  const statusValue = watch('status')

  // Reset form when citation changes or drawer opens/closes
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (citation) {
        reset({
          directory_name: citation.directory_name,
          url: citation.url,
          domain_authority: citation.domain_authority,
          niche: citation.niche || '',
          status: citation.status,
          date_submitted: citation.date_submitted || '',
          date_live: citation.date_live || '',
          notes: citation.notes || '',
        })
      } else {
        reset({
          directory_name: '',
          url: '',
          domain_authority: 0,
          niche: '',
          status: 'pending',
          date_submitted: new Date().toISOString().split('T')[0],
          date_live: '',
          notes: '',
        })
      }
    }
  }, [citation, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/citations/${citation.id}` : '/api/citations'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // Coerce empty strings to null for optional database fields
          date_submitted: values.date_submitted || null,
          date_live: values.date_live || null,
          niche: values.niche || null,
          notes: values.notes || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save citation')
      }

      // Trigger success callback (e.g. SWR revalidate)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the citation.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Citation' : 'Add New Citation'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the directory citation details and save changes.'
              : 'Add a new directory citation to track off-page SEO efforts.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="directory_name">Directory Name <span className="text-red-500">*</span></Label>
            <Input
              id="directory_name"
              placeholder="e.g. Google Business Profile"
              {...register('directory_name')}
              className="bg-background border-input"
            />
            {errors.directory_name && (
              <p className="text-xs text-destructive">{errors.directory_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Directory URL <span className="text-red-500">*</span></Label>
            <Input
              id="url"
              placeholder="e.g. https://google.com/business"
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
              <Label htmlFor="niche">Niche / Category</Label>
              <Input
                id="niche"
                placeholder="e.g. General, Local, India"
                {...register('niche')}
                className="bg-background border-input"
              />
              {errors.niche && (
                <p className="text-xs text-destructive">{errors.niche.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Submission Status</Label>
            <Select
              value={statusValue}
              onValueChange={(val: CitationStatus) => setValue('status', val, { shouldValidate: true })}
            >
              <SelectTrigger id="status" className="bg-background border-input">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {Object.entries(CITATION_STATUS_LABELS).map(([key, label]) => (
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_submitted">Date Submitted</Label>
              <Input
                id="date_submitted"
                type="date"
                {...register('date_submitted')}
                className="bg-background border-input"
              />
              {errors.date_submitted && (
                <p className="text-xs text-destructive">{errors.date_submitted.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_live">Date Live</Label>
              <Input
                id="date_live"
                type="date"
                {...register('date_live')}
                className="bg-background border-input"
              />
              {errors.date_live && (
                <p className="text-xs text-destructive">{errors.date_live.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Add any logins, listing details or verification notes..."
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
                'Add Citation'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
