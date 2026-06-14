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
import { GBPReviewCreateSchema } from '@/lib/utils/validation'
import { Star } from 'lucide-react'

type FormValues = z.infer<typeof GBPReviewCreateSchema>

interface ReviewFormProps {
  locationId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ReviewForm({
  locationId,
  isOpen,
  onClose,
  onSuccess,
}: ReviewFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [hoveredRating, setHoveredRating] = React.useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(GBPReviewCreateSchema),
    defaultValues: {
      location_id: locationId,
      reviewer_name: '',
      rating: 5,
      review_text: '',
      review_date: '',
      is_responded: false,
    },
  })

  const ratingValue = watch('rating')

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      reset({
        location_id: locationId,
        reviewer_name: '',
        rating: 5,
        review_text: '',
        review_date: new Date().toISOString().split('T')[0],
        is_responded: false,
      })
    }
  }, [locationId, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch('/api/gbp/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          reviewer_name: values.reviewer_name || null,
          review_text: values.review_text || null,
          review_date: values.review_date || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save review')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while logging the review.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>Log Customer Review</SheetTitle>
          <SheetDescription>
            Record reviews from Google Maps to respond to them in SEO-OS.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reviewer_name">Reviewer Name</Label>
            <Input
              id="reviewer_name"
              placeholder="e.g. Rahul Sharma"
              {...register('reviewer_name')}
              className="bg-background border-input"
            />
            {errors.reviewer_name && (
              <p className="text-xs text-destructive">{errors.reviewer_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Rating <span className="text-red-500">*</span></Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setValue('rating', star, { shouldValidate: true })}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(null)}
                  className="p-1 focus:outline-none"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= (hoveredRating ?? ratingValue ?? 0)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30 hover:text-amber-400'
                    }`}
                  />
                </button>
              ))}
            </div>
            {errors.rating && (
              <p className="text-xs text-destructive">{errors.rating.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review_date">Review Date</Label>
            <Input
              id="review_date"
              type="date"
              {...register('review_date')}
              className="bg-background border-input"
            />
            {errors.review_date && (
              <p className="text-xs text-destructive">{errors.review_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review_text">Review Content</Label>
            <textarea
              id="review_text"
              rows={4}
              placeholder="Paste customer review text verbatim..."
              {...register('review_text')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.review_text && (
              <p className="text-xs text-destructive">{errors.review_text.message}</p>
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
                'Log Review'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
