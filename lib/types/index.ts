/**
 * SEO-OS — Complete TypeScript Type Definitions
 *
 * All interfaces match the Supabase database schema exactly.
 * From DOC2 Section 6 — Supabase Schema Design
 * From DOC5 PROJ-001-10 — Create global TypeScript type definitions
 */

// ============================================================
// ENUMS — Status, Priority, Role constants as TypeScript types
// ============================================================

export type UserRole = 'admin' | 'seo_specialist' | 'data_specialist'

export type CitationStatus =
  | 'pending'
  | 'submitted'
  | 'live'
  | 'rejected'
  | 'needs_update'

export type OutreachPipelineStage =
  | 'identified'
  | 'contacted'
  | 'followed_up'
  | 'negotiating'
  | 'placed'
  | 'rejected'

export type OutreachNoteType = 'email' | 'call' | 'general' | 'ai_generated'

export type GuestPostStatus =
  | 'pitching'
  | 'accepted'
  | 'writing'
  | 'editing'
  | 'submitted'
  | 'published'
  | 'live'
  | 'rejected'

export type LinkType = 'dofollow' | 'nofollow' | 'unknown'

export type PRCampaignStatus = 'planning' | 'active' | 'completed' | 'paused'

export type GBPPostType = 'update' | 'offer' | 'event' | 'product'

export type GBPPostStatus = 'planned' | 'published' | 'expired'

export type TaskPriority = 'high' | 'medium' | 'low'

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'

export type ModuleType =
  | 'citation'
  | 'outreach'
  | 'guest_post'
  | 'competitor'
  | 'digital_pr'
  | 'gbp'
  | 'general'

export type KPIPeriod = 'weekly' | 'monthly'

export type ReportType = 'weekly' | 'monthly'

export type ReportStatus = 'generating' | 'generated' | 'failed'

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'export'

// ============================================================
// ENTITY INTERFACES — match Supabase table columns exactly
// ============================================================

/**
 * User profile — extends Supabase auth.users
 * Table: public.users
 */
export interface User {
  id: string                    // UUID — references auth.users(id)
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string            // TIMESTAMPTZ as ISO string
  updated_at: string
}

/**
 * Citation record
 * Table: public.citations
 */
export interface Citation {
  id: string
  directory_name: string
  url: string
  domain_authority: number      // 0–100
  niche: string | null
  status: CitationStatus
  date_submitted: string | null // DATE as ISO string (YYYY-MM-DD)
  date_live: string | null
  notes: string | null
  created_by: string | null     // FK → public.users(id)
  created_at: string
  updated_at: string
  // Joined fields (populated on demand)
  creator?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
}

/**
 * Outreach prospect
 * Table: public.outreach_prospects
 */
export interface OutreachProspect {
  id: string
  site_name: string
  url: string
  domain_authority: number
  niche: string | null
  contact_name: string | null
  contact_email: string | null
  pipeline_stage: OutreachPipelineStage
  last_contact_date: string | null
  next_followup_date: string | null
  notes: string | null
  assigned_to: string | null    // FK → public.users(id)
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  assignee?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
  creator?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
  notes_count?: number
}

/**
 * Outreach note / email thread entry
 * Table: public.outreach_notes
 */
export interface OutreachNote {
  id: string
  prospect_id: string           // FK → public.outreach_prospects(id)
  content: string
  note_type: OutreachNoteType
  created_by: string | null
  created_at: string
  // Joined fields
  creator?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
}

/**
 * Guest post record
 * Table: public.guest_posts
 */
export interface GuestPost {
  id: string
  title: string
  target_site: string
  target_url: string | null
  target_da: number
  author: string | null
  status: GuestPostStatus
  topic: string | null
  word_count: number | null
  target_keyword: string | null
  anchor_text: string | null
  link_url: string | null
  publish_date: string | null
  doc_link: string | null
  notes: string | null
  linked_prospect: string | null // FK → public.outreach_prospects(id)
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  prospect?: Pick<OutreachProspect, 'id' | 'site_name' | 'url'>
  creator?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
}

/**
 * Competitor domain
 * Table: public.competitors
 */
export interface Competitor {
  id: string
  domain: string
  display_name: string | null
  niche: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Aggregated fields
  backlink_count?: number
  gap_count?: number
  tagged_count?: number
}

/**
 * Individual backlink from a competitor's backlink profile
 * Table: public.competitor_backlinks
 */
export interface CompetitorBacklink {
  id: string
  competitor_id: string         // FK → public.competitors(id)
  source_domain: string
  source_url: string | null
  target_url: string | null
  source_da: number
  anchor_text: string | null
  link_type: LinkType
  date_found: string
  is_gap: boolean               // TRUE = we don't have this link
  tagged_for_outreach: boolean
  notes: string | null
  created_at: string
  // Joined fields
  competitor?: Pick<Competitor, 'id' | 'domain' | 'display_name'>
}

/**
 * Digital PR campaign
 * Table: public.pr_campaigns
 */
export interface PRCampaign {
  id: string
  campaign_name: string
  topic: string | null
  status: PRCampaignStatus
  launch_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Aggregated fields
  placement_count?: number
  total_reach?: number
  creator?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
}

/**
 * PR placement (a specific article/link result from a campaign)
 * Table: public.pr_placements
 */
export interface PRPlacement {
  id: string
  campaign_id: string           // FK → public.pr_campaigns(id)
  publication: string
  url: string | null
  domain_authority: number
  placement_date: string | null
  reach_estimate: number
  notes: string | null
  created_at: string
  // Joined fields
  campaign?: Pick<PRCampaign, 'id' | 'campaign_name'>
}

/**
 * PR contact (journalist / editor)
 * Table: public.pr_contacts
 */
export interface PRContact {
  id: string
  name: string
  email: string | null
  publication: string | null
  beat: string | null           // Their topic specialty
  notes: string | null
  last_contact_date: string | null
  response_rate: number         // Percentage 0–100
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Google Business Profile location
 * Table: public.gbp_locations
 */
export interface GBPLocation {
  id: string
  business_name: string
  location_name: string
  google_maps_url: string | null
  category: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  // Aggregated fields
  post_count_monthly?: number
  avg_rating?: number
  unresponded_reviews?: number
}

/**
 * GBP post (What's New, Offer, Event, Product)
 * Table: public.gbp_posts
 */
export interface GBPPost {
  id: string
  location_id: string           // FK → public.gbp_locations(id)
  post_type: GBPPostType
  content_summary: string | null
  publish_date: string | null
  status: GBPPostStatus
  notes: string | null
  created_by: string | null
  created_at: string
  // Joined fields
  location?: Pick<GBPLocation, 'id' | 'business_name' | 'location_name'>
}

/**
 * GBP review and response tracking
 * Table: public.gbp_reviews
 */
export interface GBPReview {
  id: string
  location_id: string           // FK → public.gbp_locations(id)
  reviewer_name: string | null
  review_date: string | null
  rating: number | null         // 1–5
  review_text: string | null
  response_text: string | null
  response_date: string | null
  is_responded: boolean
  responded_by: string | null   // FK → public.users(id)
  created_at: string
  updated_at: string
  // Joined fields
  location?: Pick<GBPLocation, 'id' | 'location_name'>
  responder?: Pick<User, 'id' | 'full_name'>
}

/**
 * Monthly GBP performance metrics
 * Table: public.gbp_metrics
 */
export interface GBPMetric {
  id: string
  location_id: string           // FK → public.gbp_locations(id)
  metric_month: string          // DATE — first day of the month (YYYY-MM-01)
  views: number
  clicks: number
  calls: number
  direction_requests: number
  photo_views: number
  created_by: string | null
  created_at: string
  // Joined fields
  location?: Pick<GBPLocation, 'id' | 'location_name'>
}

/**
 * Task — can be linked to any module record
 * Table: public.tasks
 */
export interface Task {
  id: string
  title: string
  description: string | null
  assignee: string | null       // FK → public.users(id)
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  module_type: ModuleType | null
  module_record_id: string | null // UUID of the linked record in the module table
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  assignee_user?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
  creator?: Pick<User, 'id' | 'full_name' | 'avatar_url'>
}

/**
 * KPI monthly/weekly targets (set by Admin)
 * Table: public.kpi_targets
 */
export interface KPITarget {
  id: string
  metric_name: string           // e.g. 'citations_live', 'guest_posts_placed'
  target_value: number
  period: KPIPeriod
  effective_from: string        // DATE
  created_by: string | null
  created_at: string
}

/**
 * Auto-generated weekly/monthly report
 * Table: public.reports
 */
export interface Report {
  id: string
  report_type: ReportType
  period_start: string          // DATE
  period_end: string
  data: ReportData              // JSONB — the structured report content
  ai_summary: string | null     // Gemini-generated executive summary
  status: ReportStatus
  generated_by: string | null
  generated_at: string
}

/**
 * JSONB data structure stored inside reports.data
 */
export interface ReportData {
  citations: {
    total: number
    live: number
    live_percentage: number
    added_this_period: number
  }
  outreach: {
    total_active: number
    placed_this_period: number
    conversion_rate: number
    stage_breakdown: Record<OutreachPipelineStage, number>
  }
  guest_posts: {
    total: number
    live: number
    added_this_period: number
    avg_da: number
  }
  digital_pr: {
    total_placements: number
    placements_this_period: number
    total_reach: number
  }
  tasks: {
    completed_this_period: number
    overdue: number
    by_assignee: Record<string, number>
  }
  kpi_progress: Record<string, { target: number; actual: number; percentage: number }>
}

/**
 * Audit log entry — records all mutations
 * Table: public.audit_log
 */
export interface AuditLog {
  id: string
  user_id: string | null
  action: AuditAction
  table_name: string | null
  record_id: string | null
  old_values: Record<string, unknown> | null  // JSONB
  new_values: Record<string, unknown> | null  // JSONB
  created_at: string
  // Joined fields
  user?: Pick<User, 'id' | 'full_name' | 'email'>
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

/** Standard success response envelope */
export interface APIResponse<T> {
  success: true
  data: T
  meta?: PaginationMeta
}

/** Standard error response envelope */
export interface APIErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/** Either success or error */
export type APIResult<T> = APIResponse<T> | APIErrorResponse

/** Paginated list response */
export interface PaginatedResponse<T> {
  success: true
  data: T[]
  meta: PaginationMeta
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  total_pages: number
}

// ============================================================
// FILTER / QUERY PARAM TYPES
// ============================================================

export interface CitationFilters {
  status?: CitationStatus
  niche?: string
  da_min?: number
  da_max?: number
  search?: string
  page?: number
  limit?: number
  sort_by?: keyof Citation
  sort_order?: 'asc' | 'desc'
}

export interface OutreachFilters {
  pipeline_stage?: OutreachPipelineStage
  assigned_to?: string
  niche?: string
  da_min?: number
  search?: string
  page?: number
  limit?: number
}

export interface GuestPostFilters {
  status?: GuestPostStatus
  author?: string
  da_min?: number
  search?: string
  page?: number
  limit?: number
}

export interface TaskFilters {
  status?: TaskStatus
  priority?: TaskPriority
  assignee?: string
  module_type?: ModuleType
  is_overdue?: boolean
  search?: string
  page?: number
  limit?: number
}

// ============================================================
// FORM INPUT TYPES (subset of entity — used in create/update forms)
// ============================================================

export type CitationInput = Pick<
  Citation,
  | 'directory_name'
  | 'url'
  | 'domain_authority'
  | 'niche'
  | 'status'
  | 'date_submitted'
  | 'date_live'
  | 'notes'
>

export type OutreachProspectInput = Pick<
  OutreachProspect,
  | 'site_name'
  | 'url'
  | 'domain_authority'
  | 'niche'
  | 'contact_name'
  | 'contact_email'
  | 'pipeline_stage'
  | 'assigned_to'
  | 'last_contact_date'
  | 'next_followup_date'
  | 'notes'
>

export type GuestPostInput = Pick<
  GuestPost,
  | 'title'
  | 'target_site'
  | 'target_url'
  | 'target_da'
  | 'author'
  | 'status'
  | 'topic'
  | 'word_count'
  | 'target_keyword'
  | 'anchor_text'
  | 'link_url'
  | 'publish_date'
  | 'doc_link'
  | 'notes'
  | 'linked_prospect'
>

export type TaskInput = Pick<
  Task,
  | 'title'
  | 'description'
  | 'assignee'
  | 'priority'
  | 'status'
  | 'due_date'
  | 'module_type'
  | 'module_record_id'
>

// ============================================================
// DASHBOARD TYPES
// ============================================================

export interface DashboardStats {
  citations: {
    total: number
    live: number
    live_percentage: number
    month_to_date: number
  }
  outreach: {
    active_prospects: number
    stage_breakdown: Record<OutreachPipelineStage, number>
  }
  guest_posts: {
    total: number
    live: number
  }
  pr_placements: {
    this_month: number
    total: number
  }
  tasks: {
    due_today: number
    overdue: number
  }
  gbp_posts: {
    this_month: number
  }
}

export interface ActivityFeedItem {
  id: string
  user: Pick<User, 'id' | 'full_name' | 'avatar_url'>
  action: string                // Human-readable, e.g. "added a citation"
  module: string                // e.g. "Citations"
  record_name: string           // e.g. "Google Business"
  record_url?: string           // Link to the record
  created_at: string
}

// ============================================================
// AI FEATURE TYPES
// ============================================================

export interface AIOutreachEmailRequest {
  site_name: string
  niche: string
  contact_name: string
  our_brand: string
  proposed_topic?: string
  tone?: 'professional' | 'friendly' | 'formal'
}

export interface AITopicIdeasRequest {
  niche: string
  target_site: string
  existing_topics?: string[]
  count?: number
}

export interface AITopicIdea {
  title: string
  angle: string
  target_keyword: string
}

export interface AIReportSummaryRequest {
  report_data: ReportData
  period_label: string
}

/**
 * Placeholder Database type that maps to Supabase's generated types.
 * Set to any to bypass compatibility issues with the manual stub in the local environment.
 * Replace with the actual generated type from `supabase gen types typescript` once the schema is live.
 */
export type Database = any
