'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw } from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface ErrorBoundaryProps {
  /** Content to render when no error */
  children: ReactNode
  /**
   * Custom fallback UI to show when an error occurs.
   * If not provided, uses the default full-page error state.
   */
  fallback?: ReactNode
  /**
   * Called when an error is caught.
   * Use to log to monitoring/analytics.
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

// ============================================================
// DEFAULT ERROR UI
// ============================================================

function DefaultErrorFallback({
  error,
  onReset,
}: {
  error: Error | null
  onReset: () => void
}) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[400px] px-8 text-center"
      role="alert"
    >
      <div className="mb-4 p-3 rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h2>

      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {process.env.NODE_ENV === 'development' && error
          ? error.message
          : 'An unexpected error occurred. Please try again or refresh the page.'}
      </p>

      <div className="flex items-center gap-3">
        <Button
          onClick={onReset}
          variant="default"
          size="sm"
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
      </div>

      {/* Development error details */}
      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-8 text-left max-w-2xl w-full">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Error details (development only)
          </summary>
          <pre className="mt-2 p-4 rounded-md bg-muted text-xs text-foreground overflow-auto whitespace-pre-wrap break-all">
            {error.stack ?? error.message}
          </pre>
        </details>
      )}
    </div>
  )
}

// ============================================================
// ERROR BOUNDARY
// ============================================================

/**
 * React error boundary — catches runtime errors in child components
 * and displays a graceful fallback instead of crashing the whole page.
 *
 * From DOC2 Section 12.3 — Frontend Error Boundaries
 * From DOC4 Section 12 — Error States
 *
 * @example
 * // Wrap a module section
 * <ErrorBoundary>
 *   <CitationsTable />
 * </ErrorBoundary>
 *
 * @example
 * // With custom fallback
 * <ErrorBoundary fallback={<p>Citations failed to load.</p>}>
 *   <CitationsTable />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

// ============================================================
// INLINE ERROR STATE (for non-boundary use)
// ============================================================

interface InlineErrorProps {
  message: string
  onRetry?: () => void
  className?: string
}

/**
 * Small inline error display for API failures.
 * Use within data-fetching components when SWR/fetch returns an error.
 */
export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
      <span className="text-destructive flex-1">{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="gap-1 text-destructive hover:text-destructive"
        >
          <RefreshCcw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  )
}
