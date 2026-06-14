'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

// ============================================================
// PROPS
// ============================================================

interface EmptyStateProps {
  /** SVG icon element to display above the title */
  icon?: React.ReactNode
  /** Bold headline — direct and clear */
  title: string
  /** Shorter description explaining what this module does */
  description?: string
  /** Primary CTA button label */
  actionLabel?: string
  /** Called when the CTA button is clicked */
  onAction?: () => void
  /** Optional link href for the CTA (renders as <a> instead of <button>) */
  actionHref?: string
  /** Additional class names for the container */
  className?: string
}

// ============================================================
// DEFAULT ICONS
// ============================================================

function DefaultEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('text-muted-foreground', className)}
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="8"
        y="8"
        width="32"
        height="32"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" />
      <line
        x1="28.24"
        y1="28.24"
        x2="36"
        y2="36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * Empty state component — shown when a module has no data.
 *
 * Each module has a specific message and CTA defined in DOC4 Section 11.
 * Use the MODULE_EMPTY_STATES constant for consistent messages.
 *
 * @example
 * <EmptyState
 *   title="No citations yet."
 *   description="Start building your citation profile."
 *   actionLabel="+ Add First Citation"
 *   onAction={() => router.push('/citations/new')}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8 text-center',
        className,
      )}
      role="status"
      aria-label={title}
    >
      {/* Icon */}
      <div className="mb-6 opacity-40">
        {icon ?? <DefaultEmptyIcon className="w-12 h-12" />}
      </div>

      {/* Headline */}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}

      {/* CTA */}
      {actionLabel && (onAction ?? actionHref) && (
        actionHref ? (
          <Button asChild>
            <a href={actionHref}>{actionLabel}</a>
          </Button>
        ) : (
          <Button onClick={onAction}>{actionLabel}</Button>
        )
      )}
    </div>
  )
}

// ============================================================
// MODULE-SPECIFIC EMPTY STATES (from DOC4 Section 11)
// ============================================================

export const MODULE_EMPTY_STATES = {
  citations: {
    title: 'No citations yet.',
    description: 'Start building your citation profile.',
    actionLabel: '+ Add First Citation',
  },
  outreach: {
    title: 'No prospects yet.',
    description: 'Add your first outreach target to start building your pipeline.',
    actionLabel: '+ Add Prospect',
  },
  guestPosts: {
    title: 'No guest posts in the pipeline yet.',
    description: 'Create your first guest post to start tracking your content.',
    actionLabel: '+ Create First Post',
  },
  competitors: {
    title: 'No competitors tracked yet.',
    description: 'Add a competitor to start backlink gap analysis.',
    actionLabel: '+ Add Competitor',
  },
  digitalPR: {
    title: 'No PR campaigns yet.',
    description: 'Launch your first campaign to start tracking placements.',
    actionLabel: '+ New Campaign',
  },
  gbp: {
    title: 'No locations added.',
    description: 'Add your first GBP location to start tracking posts and reviews.',
    actionLabel: '+ Add Location',
  },
  tasks: {
    title: "You're all caught up!",
    description: 'No tasks assigned to you right now.',
    actionLabel: '+ Create Task',
  },
  reports: {
    title: 'No reports generated yet.',
    description:
      'Your first report will appear Monday morning. Or generate one now.',
    actionLabel: 'Generate Now',
  },
} as const satisfies Record<
  string,
  { title: string; description: string; actionLabel: string }
>
