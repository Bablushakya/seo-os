import { z } from 'zod'

// ============================================================
// BASE FIELD SCHEMAS (reusable across entities)
// ============================================================

const UUIDSchema = z.string().uuid('Must be a valid UUID')
const URLSchema = z
  .string()
  .url('Must be a valid URL (include https://)')
  .or(z.literal(''))
  .optional()
const OptionalURLSchema = z
  .string()
  .url('Must be a valid URL (include https://)')
  .nullable()
  .optional()
const DomainAuthoritySchema = z
  .number({ coerce: true })
  .int()
  .min(0, 'DA must be between 0 and 100')
  .max(100, 'DA must be between 0 and 100')
  .default(0)
const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .nullable()
  .optional()
const OptionalText = z.string().nullable().optional()
const NotesSchema = z
  .string()
  .max(2000, 'Notes cannot exceed 2000 characters')
  .nullable()
  .optional()

// ============================================================
// CITATION SCHEMAS
// ============================================================

export const CitationStatusSchema = z.enum([
  'pending',
  'submitted',
  'live',
  'rejected',
  'needs_update',
])

export const CitationCreateSchema = z.object({
  directory_name: z
    .string()
    .min(2, 'Directory name must be at least 2 characters')
    .max(255, 'Directory name too long'),
  url: z
    .string()
    .min(1, 'URL is required')
    .url('Must be a valid URL including https://'),
  domain_authority: DomainAuthoritySchema,
  niche: OptionalText,
  status: CitationStatusSchema.default('pending'),
  date_submitted: DateSchema,
  date_live: DateSchema,
  notes: NotesSchema,
})

export const CitationUpdateSchema = CitationCreateSchema.partial()

export type CitationCreateInput = z.infer<typeof CitationCreateSchema>
export type CitationUpdateInput = z.infer<typeof CitationUpdateSchema>

// ============================================================
// OUTREACH SCHEMAS
// ============================================================

export const OutreachStageSchema = z.enum([
  'identified',
  'contacted',
  'followed_up',
  'negotiating',
  'placed',
  'rejected',
])

export const OutreachNoteTypeSchema = z.enum([
  'email',
  'call',
  'general',
  'ai_generated',
])

export const OutreachProspectCreateSchema = z.object({
  site_name: z
    .string()
    .min(2, 'Site name must be at least 2 characters')
    .max(255),
  url: z.string().min(1, 'URL is required').url('Must be a valid URL'),
  domain_authority: DomainAuthoritySchema,
  niche: OptionalText,
  contact_name: OptionalText,
  contact_email: z.string().email('Must be a valid email').nullable().optional(),
  pipeline_stage: OutreachStageSchema.default('identified'),
  assigned_to: UUIDSchema.nullable().optional(),
  last_contact_date: DateSchema,
  next_followup_date: DateSchema,
  notes: NotesSchema,
})

export const OutreachProspectUpdateSchema = OutreachProspectCreateSchema.partial()

export const OutreachNoteCreateSchema = z.object({
  prospect_id: UUIDSchema,
  content: z.string().min(1, 'Note content is required').max(5000),
  note_type: OutreachNoteTypeSchema.default('general'),
})

export type OutreachProspectCreateInput = z.infer<typeof OutreachProspectCreateSchema>
export type OutreachNoteCreateInput = z.infer<typeof OutreachNoteCreateSchema>

// ============================================================
// GUEST POST SCHEMAS
// ============================================================

export const GuestPostStatusSchema = z.enum([
  'pitching',
  'accepted',
  'writing',
  'editing',
  'submitted',
  'published',
  'live',
  'rejected',
])

export const GuestPostCreateSchema = z.object({
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters')
    .max(500),
  target_site: z.string().min(2, 'Target site is required').max(255),
  target_url: OptionalURLSchema,
  target_da: DomainAuthoritySchema,
  author: OptionalText,
  status: GuestPostStatusSchema.default('pitching'),
  topic: OptionalText,
  word_count: z
    .number({ coerce: true })
    .int()
    .min(0)
    .max(100000)
    .nullable()
    .optional(),
  target_keyword: OptionalText,
  anchor_text: OptionalText,
  link_url: OptionalURLSchema,
  publish_date: DateSchema,
  doc_link: OptionalURLSchema,
  notes: NotesSchema,
  linked_prospect: z
    .string()
    .uuid('Must be a valid UUID')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform(val => (!val || val === '' ? null : val)),
})
  .transform(data => ({
    ...data,
    // Coerce empty strings to null for optional URL/text fields
    target_url: data.target_url || null,
    link_url: data.link_url || null,
    doc_link: data.doc_link || null,
    author: data.author || null,
    topic: data.topic || null,
    target_keyword: data.target_keyword || null,
    anchor_text: data.anchor_text || null,
    notes: data.notes || null,
    publish_date: data.publish_date || null,
  }))

// Separate update schema (avoids .partial() on ZodEffects which can cause issues)
export const GuestPostUpdateSchema = z.object({
  title: z.string().min(2).max(500).optional(),
  target_site: z.string().min(2).max(255).optional(),
  target_url: OptionalURLSchema,
  target_da: DomainAuthoritySchema.optional(),
  author: OptionalText,
  status: GuestPostStatusSchema.optional(),
  topic: OptionalText,
  word_count: z.number({ coerce: true }).int().min(0).max(100000).nullable().optional(),
  target_keyword: OptionalText,
  anchor_text: OptionalText,
  link_url: OptionalURLSchema,
  publish_date: DateSchema,
  doc_link: OptionalURLSchema,
  notes: NotesSchema,
  linked_prospect: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform(val => (!val || val === '' ? null : val)),
})
  .transform(data => ({
    ...data,
    target_url: data.target_url || null,
    link_url: data.link_url || null,
    doc_link: data.doc_link || null,
    author: data.author || null,
    topic: data.topic || null,
    target_keyword: data.target_keyword || null,
    anchor_text: data.anchor_text || null,
    notes: data.notes || null,
    publish_date: data.publish_date || null,
  }))

export type GuestPostCreateInput = z.infer<typeof GuestPostCreateSchema>

// ============================================================
// COMPETITOR SCHEMAS
// ============================================================

export const CompetitorCreateSchema = z.object({
  domain: z
    .string()
    .min(3, 'Domain must be at least 3 characters')
    .max(255)
    .regex(
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/,
      'Must be a valid domain name (e.g. competitor.com)',
    ),
  display_name: OptionalText,
  niche: OptionalText,
  notes: NotesSchema,
})

export const CompetitorBacklinkCreateSchema = z.object({
  competitor_id: UUIDSchema,
  source_domain: z.string().min(3, 'Source domain is required').max(255),
  source_url: OptionalURLSchema,
  target_url: OptionalURLSchema,
  source_da: DomainAuthoritySchema,
  anchor_text: OptionalText,
  link_type: z.enum(['dofollow', 'nofollow', 'unknown']).default('dofollow'),
  date_found: DateSchema,
  is_gap: z.boolean().default(false),
  tagged_for_outreach: z.boolean().default(false),
  notes: NotesSchema,
})

export type CompetitorCreateInput = z.infer<typeof CompetitorCreateSchema>

// ============================================================
// DIGITAL PR SCHEMAS
// ============================================================

export const PRCampaignStatusSchema = z.enum([
  'planning',
  'active',
  'completed',
  'paused',
])

export const PRCampaignCreateSchema = z.object({
  campaign_name: z.string().min(2, 'Campaign name is required').max(255),
  topic: OptionalText,
  status: PRCampaignStatusSchema.default('planning'),
  launch_date: DateSchema,
  notes: NotesSchema,
})

export const PRPlacementCreateSchema = z.object({
  campaign_id: UUIDSchema,
  publication: z.string().min(2, 'Publication name is required').max(255),
  url: OptionalURLSchema,
  domain_authority: DomainAuthoritySchema,
  placement_date: DateSchema,
  reach_estimate: z.number({ coerce: true }).int().min(0).default(0),
  notes: NotesSchema,
})

export const PRContactCreateSchema = z.object({
  name: z.string().min(2, 'Contact name is required').max(255),
  email: z.string().email('Must be a valid email').nullable().optional(),
  publication: OptionalText,
  beat: OptionalText,
  notes: NotesSchema,
  last_contact_date: DateSchema,
  response_rate: z.number({ coerce: true }).int().min(0).max(100).default(0),
})

export type PRCampaignCreateInput = z.infer<typeof PRCampaignCreateSchema>
export type PRPlacementCreateInput = z.infer<typeof PRPlacementCreateSchema>

// ============================================================
// GBP SCHEMAS
// ============================================================

export const GBPLocationCreateSchema = z.object({
  business_name: z.string().min(2, 'Business name is required').max(255),
  location_name: z.string().min(2, 'Location name is required').max(255),
  google_maps_url: OptionalURLSchema,
  category: OptionalText,
  is_active: z.boolean().default(true),
})

export const GBPPostCreateSchema = z.object({
  location_id: UUIDSchema,
  post_type: z.enum(['update', 'offer', 'event', 'product']).default('update'),
  content_summary: z.string().max(1500).nullable().optional(),
  publish_date: DateSchema,
  status: z.enum(['planned', 'published', 'expired']).default('planned'),
  notes: NotesSchema,
})

export const GBPReviewCreateSchema = z.object({
  location_id: UUIDSchema,
  reviewer_name: OptionalText,
  review_date: DateSchema,
  rating: z
    .number({ coerce: true })
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5')
    .nullable()
    .optional(),
  review_text: z.string().max(5000).nullable().optional(),
  response_text: z.string().max(2000).nullable().optional(),
  response_date: DateSchema,
  is_responded: z.boolean().default(false),
})

export const GBPMetricCreateSchema = z.object({
  location_id: UUIDSchema,
  metric_month: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date (YYYY-MM-01)'),
  views: z.number({ coerce: true }).int().min(0).default(0),
  clicks: z.number({ coerce: true }).int().min(0).default(0),
  calls: z.number({ coerce: true }).int().min(0).default(0),
  direction_requests: z.number({ coerce: true }).int().min(0).default(0),
  photo_views: z.number({ coerce: true }).int().min(0).default(0),
})

// ============================================================
// TASK SCHEMAS
// ============================================================

export const TaskPrioritySchema = z.enum(['high', 'medium', 'low'])
export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done'])

export const TaskCreateSchema = z.object({
  title: z.string().min(2, 'Task title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  assignee: UUIDSchema.nullable().optional(),
  priority: TaskPrioritySchema.default('medium'),
  status: TaskStatusSchema.default('todo'),
  due_date: DateSchema,
  module_type: z
    .enum(['citation', 'outreach', 'guest_post', 'competitor', 'digital_pr', 'gbp', 'general'])
    .nullable()
    .optional(),
  module_record_id: UUIDSchema.nullable().optional(),
})

export const TaskUpdateSchema = TaskCreateSchema.partial()

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>

// ============================================================
// KPI TARGET SCHEMA
// ============================================================

export const KPITargetCreateSchema = z.object({
  metric_name: z.string().min(2, 'Metric name is required').max(100),
  target_value: z
    .number({ coerce: true })
    .int()
    .min(0, 'Target value must be positive'),
  period: z.enum(['weekly', 'monthly']).default('monthly'),
  effective_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date'),
})

// ============================================================
// AUTH SCHEMAS
// ============================================================

export const LoginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Must be a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof LoginSchema>

// ============================================================
// AI FEATURE SCHEMAS
// ============================================================

export const AIOutreachEmailSchema = z.object({
  site_name: z.string().min(1, 'Site name is required'),
  niche: z.string().min(1, 'Niche is required'),
  contact_name: z.string().min(1, 'Contact name is required'),
  our_brand: z.string().min(1, 'Brand name is required'),
  proposed_topic: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'formal']).default('professional'),
})

export const AITopicIdeasSchema = z.object({
  niche: z.string().min(1, 'Niche is required'),
  target_site: z.string().min(1, 'Target site is required'),
  existing_topics: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(10).default(5),
})

// ============================================================
// CSV IMPORT SCHEMAS
// ============================================================

/**
 * Schema for a single row in a citation CSV import.
 * More lenient than the create schema — validates after mapping.
 */
export const CitationCSVRowSchema = z.object({
  directory_name: z.string().min(1, 'Directory name is required'),
  url: z.string().url('Invalid URL format'),
  domain_authority: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .default(0),
  niche: z.string().optional(),
  status: CitationStatusSchema.optional().default('pending'),
  date_submitted: DateSchema,
  notes: z.string().optional(),
})

export type CitationCSVRow = z.infer<typeof CitationCSVRowSchema>

// ============================================================
// TEAM POST SCHEMAS (Information Sharing Section)
// ============================================================

export const TeamPostCreateSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(5000, 'Content cannot exceed 5000 characters'),
  target_user_ids: z
    .array(z.string().uuid())
    .nullable()
    .optional(), // null = visible to everyone
  has_attachment: z.boolean().optional().default(false),
})

export type TeamPostCreateInput = z.infer<typeof TeamPostCreateSchema>

// ============================================================
// TEAM NOTE SCHEMAS (Sticky Notes Board)
// ============================================================

export const TeamNoteCreateSchema = z.object({
  content: z
    .string()
    .min(1, 'Note content is required')
    .max(2000, 'Note cannot exceed 2000 characters'),
  color: z
    .enum(['yellow', 'blue', 'green', 'pink', 'purple', 'orange'])
    .default('yellow'),
  is_pinned: z.boolean().optional().default(false),
})

export const TeamNoteUpdateSchema = TeamNoteCreateSchema.partial()

export type TeamNoteCreateInput = z.infer<typeof TeamNoteCreateSchema>
export type TeamNoteUpdateInput = z.infer<typeof TeamNoteUpdateSchema>
