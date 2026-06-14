'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LoginSchema, type LoginInput } from '@/lib/utils/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'

// ============================================================
// LOGIN PAGE
// ============================================================

/**
 * Login page — the only public-facing page in SEO-OS.
 *
 * Authentication: Supabase email + password (signInWithPassword)
 * On success → redirect to /dashboard
 * On failure → inline error (do NOT distinguish email vs password — DOC3 Section 4.5)
 *
 * From DOC4 Section 6.1 — LOGIN SCREEN
 * From DOC5 AUTH-001-03 — Build login page UI
 */
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Check for error param from middleware (e.g. unauthorized account)
  const urlError = searchParams.get('error')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginInput) => {
    setIsSubmitting(true)
    setAuthError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        // Deliberately vague — do not reveal whether email or password is wrong
        // DOC3 Section 4.5 — Login Security
        if (error.message.includes('rate') || error.status === 429) {
          setAuthError('Too many attempts. Please wait 5 minutes before trying again.')
        } else {
          setAuthError(
            'Email or password is incorrect. Contact Bharat if you\'re locked out.',
          )
        }
        return
      }

      // Success — redirect to dashboard
      toast.success('Welcome back!')
      router.push('/dashboard')
      router.refresh()
    } catch {
      setAuthError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="rounded-xl border border-border bg-card shadow-2xl shadow-black/20 p-8">
          {/* Logo + App Name */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              SEO-OS
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Internal Operations Platform
            </p>
          </div>

          {/* Unauthorized error from middleware */}
          {urlError === 'unauthorized' && (
            <div
              className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              Your account is not authorized to access SEO-OS. Contact Bharat.
            </div>
          )}

          {/* Login Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@indiaheritage.com"
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
                disabled={isSubmitting}
                className={cn(
                  'h-10',
                  errors.email && 'border-destructive focus-visible:ring-destructive',
                )}
                {...register('email')}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  aria-invalid={!!errors.password}
                  disabled={isSubmitting}
                  className={cn(
                    'h-10 pr-10',
                    errors.password && 'border-destructive focus-visible:ring-destructive',
                  )}
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p
                  id="password-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Auth Error (from Supabase) */}
            {authError && (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
                aria-live="polite"
              >
                {authError}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-10 font-medium gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Forgot password note — no self-service reset (internal tool) */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Forgot your password?{' '}
            <span className="text-foreground font-medium">
              Contact Bharat
            </span>
          </p>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          Internal tool — authorised personnel only
        </p>
      </div>
    </div>
  )
}


export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
