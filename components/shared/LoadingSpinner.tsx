'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

// ============================================================
// TYPES
// ============================================================

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize
  /** Accessible label for screen readers */
  label?: string
  /** Additional class names */
  className?: string
  /** Center the spinner in its container */
  centered?: boolean
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
  xl: 'h-12 w-12 border-4',
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * Animated loading spinner using CSS border animation.
 * Respects prefers-reduced-motion.
 *
 * @example
 * // Inline spinner in a button
 * <LoadingSpinner size="sm" label="Saving..." />
 *
 * // Full-page centered spinner
 * <LoadingSpinner size="lg" centered />
 *
 * // Section loading
 * <LoadingSpinner size="md" label="Loading citations..." centered />
 */
export function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  className,
  centered = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'inline-block rounded-full',
        'border-muted-foreground/30 border-t-foreground',
        'animate-spin',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  )

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[120px]">
        {spinner}
      </div>
    )
  }

  return spinner
}

// ============================================================
// PAGE LOADING OVERLAY
// ============================================================

/**
 * Full-page loading overlay — used during route transitions
 * or long-running operations.
 */
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-busy="true"
      aria-label={message}
    >
      <LoadingSpinner size="xl" />
      <p className="mt-4 text-sm text-muted-foreground animate-pulse">
        {message}
      </p>
    </div>
  )
}

// ============================================================
// SKELETON COMPONENTS (from DOC4 Section 13)
// ============================================================

/**
 * Generic skeleton shimmer block.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Skeleton for a table row (5 columns).
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

/**
 * Skeleton for a table body with multiple rows.
 */
export function TableBodySkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  )
}

/**
 * Skeleton for a KPI dashboard card.
 */
export function KPICardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}
