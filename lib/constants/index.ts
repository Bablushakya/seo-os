/**
 * SEO-OS — Application Constants
 *
 * All status enums, role definitions, pipeline stages, module labels,
 * and configuration values used across the application.
 *
 * From DOC1 Section 7 — Functional Requirements
 * From DOC3 Section 3 — User Roles & Permissions
 */

import type {
  UserRole,
  CitationStatus,
  OutreachPipelineStage,
  GuestPostStatus,
  TaskPriority,
  TaskStatus,
  ModuleType,
  PRCampaignStatus,
  GBPPostType,
  GBPPostStatus,
  LinkType,
} from '@/lib/types'

// ============================================================
// USER ROLES
// ============================================================

export const USER_ROLES = {
  ADMIN: 'admin' as UserRole,
  SEO_SPECIALIST: 'seo_specialist' as UserRole,
  DATA_SPECIALIST: 'data_specialist' as UserRole,
} as const

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  seo_specialist: 'SEO Specialist',
  data_specialist: 'Data Specialist',
}

/** Display name for each user (from DOC1 Section 5.1) */
export const USER_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: 'Bharat (Founder)',
  seo_specialist: 'Bablu (AI & Growth)',
  data_specialist: 'Rahul (Data & Ops)',
}

// ============================================================
// CITATION STATUSES
// ============================================================

export const CITATION_STATUSES: CitationStatus[] = [
  'pending',
  'submitted',
  'live',
  'rejected',
  'needs_update',
]

export const CITATION_STATUS_LABELS: Record<CitationStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  live: 'Live',
  rejected: 'Rejected',
  needs_update: 'Needs Update',
}

/** Tailwind colour classes for citation status badges */
export const CITATION_STATUS_COLORS: Record<CitationStatus, string> = {
  pending: 'badge-pending',
  submitted: 'badge-submitted',
  live: 'badge-live',
  rejected: 'badge-rejected',
  needs_update: 'badge-needs-update',
}

// ============================================================
// OUTREACH PIPELINE STAGES
// ============================================================

export const OUTREACH_PIPELINE_STAGES: OutreachPipelineStage[] = [
  'identified',
  'contacted',
  'followed_up',
  'negotiating',
  'placed',
  'rejected',
]

export const OUTREACH_STAGE_LABELS: Record<OutreachPipelineStage, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  followed_up: 'Followed Up',
  negotiating: 'Negotiating',
  placed: 'Placed',
  rejected: 'Rejected',
}

export const OUTREACH_STAGE_COLORS: Record<OutreachPipelineStage, string> = {
  identified: '#6b7280',
  contacted: '#3b82f6',
  followed_up: '#a855f7',
  negotiating: '#f97316',
  placed: '#22c55e',
  rejected: '#ef4444',
}

/** Stages that count as "active" in the pipeline */
export const ACTIVE_OUTREACH_STAGES: OutreachPipelineStage[] = [
  'identified',
  'contacted',
  'followed_up',
  'negotiating',
]

// ============================================================
// GUEST POST STATUSES
// ============================================================

export const GUEST_POST_STATUSES: GuestPostStatus[] = [
  'pitching',
  'accepted',
  'writing',
  'editing',
  'submitted',
  'published',
  'live',
  'rejected',
]

export const GUEST_POST_STATUS_LABELS: Record<GuestPostStatus, string> = {
  pitching: 'Pitching',
  accepted: 'Accepted',
  writing: 'Writing',
  editing: 'Editing',
  submitted: 'Submitted',
  published: 'Published',
  live: 'Live',
  rejected: 'Rejected',
}

export const GUEST_POST_STATUS_COLORS: Record<GuestPostStatus, string> = {
  pitching: '#a855f7',
  accepted: '#06b6d4',
  writing: '#eab308',
  editing: '#f97316',
  submitted: '#3b82f6',
  published: '#22c55e',
  live: '#16a34a',
  rejected: '#ef4444',
}

/** Kanban column order for guest post board */
export const GUEST_POST_KANBAN_COLUMNS: GuestPostStatus[] = [
  'pitching',
  'accepted',
  'writing',
  'editing',
  'submitted',
  'live',
]

// ============================================================
// TASK PRIORITIES
// ============================================================

export const TASK_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#6b7280',
}

export const TASK_PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
}

// ============================================================
// TASK STATUSES
// ============================================================

export const TASK_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'done',
]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#6b7280',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  done: '#22c55e',
}

// ============================================================
// MODULE TYPES
// ============================================================

export const MODULE_TYPES: ModuleType[] = [
  'citation',
  'outreach',
  'guest_post',
  'competitor',
  'digital_pr',
  'gbp',
  'general',
]

export const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  citation: 'Citations',
  outreach: 'Outreach',
  guest_post: 'Guest Posts',
  competitor: 'Competitors',
  digital_pr: 'Digital PR',
  gbp: 'GBP Management',
  general: 'General',
}

export const MODULE_TYPE_ROUTES: Record<ModuleType, string> = {
  citation: '/citations',
  outreach: '/outreach',
  guest_post: '/guest-posts',
  competitor: '/competitors',
  digital_pr: '/digital-pr',
  gbp: '/gbp',
  general: '/tasks',
}

// ============================================================
// PR CAMPAIGN STATUSES
// ============================================================

export const PR_CAMPAIGN_STATUSES: PRCampaignStatus[] = [
  'planning',
  'active',
  'completed',
  'paused',
]

export const PR_CAMPAIGN_STATUS_LABELS: Record<PRCampaignStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
}

// ============================================================
// GBP POST TYPES
// ============================================================

export const GBP_POST_TYPES: GBPPostType[] = [
  'update',
  'offer',
  'event',
  'product',
]

export const GBP_POST_TYPE_LABELS: Record<GBPPostType, string> = {
  update: "What's New",
  offer: 'Offer',
  event: 'Event',
  product: 'Product',
}

export const GBP_POST_STATUSES: GBPPostStatus[] = [
  'planned',
  'published',
  'expired',
]

export const GBP_POST_STATUS_LABELS: Record<GBPPostStatus, string> = {
  planned: 'Planned',
  published: 'Published',
  expired: 'Expired',
}

// ============================================================
// BACKLINK LINK TYPES
// ============================================================

export const LINK_TYPES: LinkType[] = ['dofollow', 'nofollow', 'unknown']

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  dofollow: 'Dofollow',
  nofollow: 'Nofollow',
  unknown: 'Unknown',
}

// ============================================================
// KPI METRIC NAMES (used in kpi_targets table)
// ============================================================

export const KPI_METRIC_NAMES = {
  CITATIONS_LIVE: 'citations_live',
  CITATIONS_ADDED: 'citations_added',
  GUEST_POSTS_PLACED: 'guest_posts_placed',
  GUEST_POSTS_LIVE: 'guest_posts_live',
  OUTREACH_CONTACTS: 'outreach_contacts',
  OUTREACH_RESPONSES: 'outreach_responses',
  PR_PLACEMENTS: 'pr_placements',
  GBP_POSTS: 'gbp_posts',
  REVIEWS_RESPONDED: 'reviews_responded',
} as const

export const KPI_METRIC_LABELS: Record<string, string> = {
  citations_live: 'Live Citations',
  citations_added: 'Citations Added',
  guest_posts_placed: 'Guest Posts Placed',
  guest_posts_live: 'Guest Posts Live',
  outreach_contacts: 'Outreach Contacts',
  outreach_responses: 'Outreach Responses',
  pr_placements: 'PR Placements',
  gbp_posts: 'GBP Posts Published',
  reviews_responded: 'Reviews Responded',
}

// ============================================================
// PAGINATION
// ============================================================

export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// ============================================================
// FILE UPLOAD LIMITS (from DOC3 Section 8)
// ============================================================

export const FILE_LIMITS = {
  CSV_MAX_SIZE_BYTES: 5 * 1024 * 1024,     // 5MB
  CSV_MAX_ROWS: 500,
  AVATAR_MAX_SIZE_BYTES: 1 * 1024 * 1024,  // 1MB
  EXPORT_MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
} as const

export const ALLOWED_CSV_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
] as const

// ============================================================
// NAVIGATION (sidebar items)
// ============================================================

export const NAV_ITEMS = [
  {
    group: null,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    group: 'OFF-PAGE SEO',
    items: [
      { label: 'Citations', href: '/citations', icon: 'Building2' },
      { label: 'Outreach', href: '/outreach', icon: 'Mail' },
      { label: 'Guest Posts', href: '/guest-posts', icon: 'FileText' },
      { label: 'Competitors', href: '/competitors', icon: 'BarChart2' },
      { label: 'Digital PR', href: '/digital-pr', icon: 'Newspaper' },
      { label: 'GBP Management', href: '/gbp', icon: 'MapPin' },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { label: 'Tasks', href: '/tasks', icon: 'CheckSquare' },
      { label: 'Reports', href: '/reports', icon: 'BarChart' },
    ],
  },
  {
    group: null,
    items: [
      { label: 'Settings', href: '/settings', icon: 'Settings', adminOnly: true },
    ],
  },
] as const

// ============================================================
// SESSION / AUTH
// ============================================================

/** Session inactivity timeout in milliseconds (8 hours — FR-004) */
export const SESSION_INACTIVITY_TIMEOUT_MS = 8 * 60 * 60 * 1000

// ============================================================
// AI CONFIGURATION
// ============================================================

export const AI_CONFIG = {
  MODEL: 'gemini-1.5-flash',
  MAX_TOKENS: 1024,
  /** Debounce delay before triggering AI requests (ms) */
  DEBOUNCE_MS: 1000,
  /** Cache TTL for AI results in seconds (24 hours) */
  CACHE_TTL_SECONDS: 24 * 60 * 60,
} as const

// ============================================================
// DATE FORMATS
// ============================================================

export const DATE_FORMATS = {
  DISPLAY: 'MMM d, yyyy',         // Jan 15, 2026
  DISPLAY_SHORT: 'MMM d',         // Jan 15
  ISO: 'yyyy-MM-dd',              // 2026-01-15
  MONTH_YEAR: 'MMMM yyyy',        // January 2026
  MONTH_SHORT: 'MMM yyyy',        // Jan 2026
  FULL: 'MMMM d, yyyy',           // January 15, 2026
} as const
