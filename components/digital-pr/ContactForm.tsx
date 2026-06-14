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
import { PRContactCreateSchema } from '@/lib/utils/validation'
import type { PRContact } from '@/lib/types'

type FormValues = z.infer<typeof PRContactCreateSchema>

interface ContactFormProps {
  contact?: PRContact | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ContactForm({
  contact,
  isOpen,
  onClose,
  onSuccess,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isEdit = !!contact

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(PRContactCreateSchema),
    defaultValues: {
      name: '',
      email: '',
      publication: '',
      beat: '',
      notes: '',
      last_contact_date: '',
      response_rate: 0,
    },
  })

  // Reset form when contact changes or sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setSubmitError(null)
      if (contact) {
        reset({
          name: contact.name,
          email: contact.email || '',
          publication: contact.publication || '',
          beat: contact.beat || '',
          notes: contact.notes || '',
          last_contact_date: contact.last_contact_date || '',
          response_rate: contact.response_rate ?? 0,
        })
      } else {
        reset({
          name: '',
          email: '',
          publication: '',
          beat: '',
          notes: '',
          last_contact_date: new Date().toISOString().split('T')[0],
          response_rate: 0,
        })
      }
    }
  }, [contact, isOpen, reset])

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const url = isEdit ? `/api/digital-pr/contacts/${contact.id}` : '/api/digital-pr/contacts'
      const method = isEdit ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          email: values.email || null,
          publication: values.publication || null,
          beat: values.beat || null,
          notes: values.notes || null,
          last_contact_date: values.last_contact_date || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to save contact')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setSubmitError(err.message || 'An error occurred while saving the contact.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto bg-card text-card-foreground border-border">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Media Contact' : 'Add New Media Contact'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the journalist details and save changes.'
              : 'Add a new media contact to build your ongoing journalist relationships.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-6">
          {submitError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Journalist Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              placeholder="e.g. Jane Doe"
              {...register('name')}
              className="bg-background border-input"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. jane.doe@publication.com"
              {...register('email')}
              className="bg-background border-input"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publication">Publication</Label>
              <Input
                id="publication"
                placeholder="e.g. TechCrunch"
                {...register('publication')}
                className="bg-background border-input"
              />
              {errors.publication && (
                <p className="text-xs text-destructive">{errors.publication.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="beat">Beat / Niche</Label>
              <Input
                id="beat"
                placeholder="e.g. Travel, Tech, Startups"
                {...register('beat')}
                className="bg-background border-input"
              />
              {errors.beat && (
                <p className="text-xs text-destructive">{errors.beat.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="last_contact_date">Last Contacted</Label>
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
              <Label htmlFor="response_rate">Response Rate (%)</Label>
              <Input
                id="response_rate"
                type="number"
                min="0"
                max="100"
                {...register('response_rate', { valueAsNumber: true })}
                className="bg-background border-input"
              />
              {errors.response_rate && (
                <p className="text-xs text-destructive">{errors.response_rate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Bio</Label>
            <textarea
              id="notes"
              rows={4}
              placeholder="Add personal details, pitch preferences, past conversations, twitter handle..."
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
                'Add Contact'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
