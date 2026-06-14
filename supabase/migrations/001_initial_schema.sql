-- ============================================================
-- SEO-OS — Complete Supabase Database Migration
-- 
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- Run it ONCE on a fresh project.
-- 
-- Based on:
--   DOC2 Section 6   — Supabase Schema Design (16 tables)
--   DOC3 Section 5   — Row Level Security Policies
--   DOC3 Section 8   — Audit Logging
-- ============================================================

-- ============================================================
-- PART 1: EXTENSIONS
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Enable pg_trgm for full-text search on text columns
create extension if not exists "pg_trgm";


-- ============================================================
-- PART 2: CUSTOM ENUM TYPES
-- ============================================================

-- User Roles (from DOC3 Section 3)
create type user_role as enum ('admin', 'seo_specialist', 'data_specialist');

-- Citation status
create type citation_status as enum (
  'pending', 'submitted', 'live', 'rejected', 'needs_update'
);

-- Outreach pipeline stages
create type outreach_pipeline_stage as enum (
  'identified', 'contacted', 'followed_up', 'negotiating', 'placed', 'rejected'
);

-- Outreach note types
create type outreach_note_type as enum (
  'email', 'call', 'general', 'ai_generated'
);

-- Guest post workflow statuses
create type guest_post_status as enum (
  'pitching', 'accepted', 'writing', 'editing', 'submitted', 'published', 'live', 'rejected'
);

-- Backlink type
create type link_type as enum ('dofollow', 'nofollow', 'unknown');

-- PR campaign status
create type pr_campaign_status as enum ('planning', 'active', 'completed', 'paused');

-- GBP post type
create type gbp_post_type as enum ('update', 'offer', 'event', 'product');

-- GBP post status
create type gbp_post_status as enum ('planned', 'published', 'expired');

-- Task priority
create type task_priority as enum ('high', 'medium', 'low');

-- Task status
create type task_status as enum ('todo', 'in_progress', 'blocked', 'done');

-- Module type (for task linkage)
create type module_type as enum (
  'citation', 'outreach', 'guest_post', 'competitor', 'digital_pr', 'gbp', 'general'
);

-- KPI period
create type kpi_period as enum ('weekly', 'monthly');

-- Report type
create type report_type as enum ('weekly', 'monthly');

-- Report status
create type report_status as enum ('generating', 'generated', 'failed');

-- Audit action
create type audit_action as enum ('create', 'update', 'delete', 'login', 'export');


-- ============================================================
-- PART 3: TABLE DEFINITIONS
-- ============================================================

-- ----------------------------------------------------------
-- Table 1: users (extends auth.users)
-- ----------------------------------------------------------
create table public.users (
  id           uuid          primary key references auth.users(id) on delete cascade,
  email        text          not null unique,
  full_name    text          not null,
  role         user_role     not null default 'seo_specialist',
  avatar_url   text          null,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

comment on table public.users is 'Application user profiles. Only pre-approved users exist here. References auth.users.';

-- ----------------------------------------------------------
-- Table 2: citations
-- ----------------------------------------------------------
create table public.citations (
  id               uuid          primary key default uuid_generate_v4(),
  directory_name   text          not null,
  url              text          not null,
  domain_authority smallint      not null default 0 check (domain_authority >= 0 and domain_authority <= 100),
  niche            text          null,
  status           citation_status not null default 'pending',
  date_submitted   date          null,
  date_live        date          null,
  notes            text          null,
  created_by       uuid          null references public.users(id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

comment on table public.citations is 'Directory citation records for off-page SEO.';

-- ----------------------------------------------------------
-- Table 3: outreach_prospects
-- ----------------------------------------------------------
create table public.outreach_prospects (
  id                 uuid                    primary key default uuid_generate_v4(),
  site_name          text                    not null,
  url                text                    not null,
  domain_authority   smallint                not null default 0 check (domain_authority >= 0 and domain_authority <= 100),
  niche              text                    null,
  contact_name       text                    null,
  contact_email      text                    null,
  pipeline_stage     outreach_pipeline_stage not null default 'identified',
  last_contact_date  date                    null,
  next_followup_date date                    null,
  notes              text                    null,
  assigned_to        uuid                    null references public.users(id) on delete set null,
  created_by         uuid                    null references public.users(id) on delete set null,
  created_at         timestamptz             not null default now(),
  updated_at         timestamptz             not null default now()
);

comment on table public.outreach_prospects is 'Link building outreach prospects (Kanban pipeline).';

-- ----------------------------------------------------------
-- Table 4: outreach_notes
-- ----------------------------------------------------------
create table public.outreach_notes (
  id           uuid              primary key default uuid_generate_v4(),
  prospect_id  uuid              not null references public.outreach_prospects(id) on delete cascade,
  content      text              not null,
  note_type    outreach_note_type not null default 'general',
  created_by   uuid              null references public.users(id) on delete set null,
  created_at   timestamptz       not null default now()
);

comment on table public.outreach_notes is 'Email threads, call notes, and AI-generated notes for outreach prospects.';

-- ----------------------------------------------------------
-- Table 5: guest_posts
-- ----------------------------------------------------------
create table public.guest_posts (
  id               uuid              primary key default uuid_generate_v4(),
  title            text              not null,
  target_site      text              not null,
  target_url       text              null,
  target_da        smallint          not null default 0 check (target_da >= 0 and target_da <= 100),
  author           text              null,
  status           guest_post_status not null default 'pitching',
  topic            text              null,
  word_count       integer           null check (word_count > 0),
  target_keyword   text              null,
  anchor_text      text              null,
  link_url         text              null,
  publish_date     date              null,
  doc_link         text              null,
  notes            text              null,
  linked_prospect  uuid              null references public.outreach_prospects(id) on delete set null,
  created_by       uuid              null references public.users(id) on delete set null,
  created_at       timestamptz       not null default now(),
  updated_at       timestamptz       not null default now()
);

comment on table public.guest_posts is 'Guest post pipeline from pitch to live link.';

-- ----------------------------------------------------------
-- Table 6: competitors
-- ----------------------------------------------------------
create table public.competitors (
  id           uuid        primary key default uuid_generate_v4(),
  domain       text        not null unique,
  display_name text        null,
  niche        text        null,
  notes        text        null,
  created_by   uuid        null references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.competitors is 'Competitor domains being tracked for backlink gap analysis.';

-- ----------------------------------------------------------
-- Table 7: competitor_backlinks
-- ----------------------------------------------------------
create table public.competitor_backlinks (
  id                   uuid        primary key default uuid_generate_v4(),
  competitor_id        uuid        not null references public.competitors(id) on delete cascade,
  source_domain        text        not null,
  source_url           text        null,
  target_url           text        null,
  source_da            smallint    not null default 0 check (source_da >= 0 and source_da <= 100),
  anchor_text          text        null,
  link_type            link_type   not null default 'dofollow',
  date_found           date        not null default current_date,
  is_gap               boolean     not null default false,
  tagged_for_outreach  boolean     not null default false,
  notes                text        null,
  created_at           timestamptz not null default now()
);

comment on table public.competitor_backlinks is 'Backlinks from competitor backlink profiles (imported via CSV).';

-- ----------------------------------------------------------
-- Table 8: pr_campaigns
-- ----------------------------------------------------------
create table public.pr_campaigns (
  id            uuid               primary key default uuid_generate_v4(),
  campaign_name text               not null,
  topic         text               null,
  status        pr_campaign_status not null default 'planning',
  launch_date   date               null,
  notes         text               null,
  created_by    uuid               null references public.users(id) on delete set null,
  created_at    timestamptz        not null default now(),
  updated_at    timestamptz        not null default now()
);

comment on table public.pr_campaigns is 'Digital PR campaigns (HARO, data studies, expert quotes).';

-- ----------------------------------------------------------
-- Table 9: pr_placements
-- ----------------------------------------------------------
create table public.pr_placements (
  id               uuid        primary key default uuid_generate_v4(),
  campaign_id      uuid        not null references public.pr_campaigns(id) on delete cascade,
  publication      text        not null,
  url              text        null,
  domain_authority smallint    not null default 0 check (domain_authority >= 0 and domain_authority <= 100),
  placement_date   date        null,
  reach_estimate   integer     not null default 0 check (reach_estimate >= 0),
  notes            text        null,
  created_at       timestamptz not null default now()
);

comment on table public.pr_placements is 'Individual PR placements (links) resulting from campaigns.';

-- ----------------------------------------------------------
-- Table 10: pr_contacts
-- ----------------------------------------------------------
create table public.pr_contacts (
  id                uuid        primary key default uuid_generate_v4(),
  name              text        not null,
  email             text        null,
  publication       text        null,
  beat              text        null,
  notes             text        null,
  last_contact_date date        null,
  response_rate     smallint    not null default 0 check (response_rate >= 0 and response_rate <= 100),
  created_by        uuid        null references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.pr_contacts is 'Journalist and editor contacts for Digital PR outreach.';

-- ----------------------------------------------------------
-- Table 11: gbp_locations
-- ----------------------------------------------------------
create table public.gbp_locations (
  id               uuid        primary key default uuid_generate_v4(),
  business_name    text        not null,
  location_name    text        not null,
  google_maps_url  text        null,
  category         text        null,
  is_active        boolean     not null default true,
  created_by       uuid        null references public.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.gbp_locations is 'Google Business Profile locations being managed.';

-- ----------------------------------------------------------
-- Table 12: gbp_posts
-- ----------------------------------------------------------
create table public.gbp_posts (
  id               uuid            primary key default uuid_generate_v4(),
  location_id      uuid            not null references public.gbp_locations(id) on delete cascade,
  post_type        gbp_post_type   not null default 'update',
  content_summary  text            null,
  publish_date     date            null,
  status           gbp_post_status not null default 'planned',
  notes            text            null,
  created_by       uuid            null references public.users(id) on delete set null,
  created_at       timestamptz     not null default now()
);

comment on table public.gbp_posts is 'GBP posts planned and published (What''s New, Offers, Events).';

-- ----------------------------------------------------------
-- Table 13: gbp_reviews
-- ----------------------------------------------------------
create table public.gbp_reviews (
  id               uuid        primary key default uuid_generate_v4(),
  location_id      uuid        not null references public.gbp_locations(id) on delete cascade,
  reviewer_name    text        null,
  review_date      date        null,
  rating           smallint    null check (rating >= 1 and rating <= 5),
  review_text      text        null,
  response_text    text        null,
  response_date    date        null,
  is_responded     boolean     not null default false,
  responded_by     uuid        null references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.gbp_reviews is 'GBP reviews and response tracking.';

-- ----------------------------------------------------------
-- Table 14: gbp_metrics
-- ----------------------------------------------------------
create table public.gbp_metrics (
  id                 uuid        primary key default uuid_generate_v4(),
  location_id        uuid        not null references public.gbp_locations(id) on delete cascade,
  metric_month       date        not null,  -- first day of month, e.g. 2026-01-01
  views              integer     not null default 0 check (views >= 0),
  clicks             integer     not null default 0 check (clicks >= 0),
  calls              integer     not null default 0 check (calls >= 0),
  direction_requests integer     not null default 0 check (direction_requests >= 0),
  photo_views        integer     not null default 0 check (photo_views >= 0),
  created_by         uuid        null references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  -- One metric row per location per month
  unique (location_id, metric_month)
);

comment on table public.gbp_metrics is 'Monthly GBP performance metrics (views, clicks, calls).';

-- ----------------------------------------------------------
-- Table 15: tasks
-- ----------------------------------------------------------
create table public.tasks (
  id               uuid          primary key default uuid_generate_v4(),
  title            text          not null,
  description      text          null,
  assignee         uuid          null references public.users(id) on delete set null,
  priority         task_priority not null default 'medium',
  status           task_status   not null default 'todo',
  due_date         date          null,
  module_type      module_type   null,
  module_record_id uuid          null,  -- FK to any module record (polymorphic)
  created_by       uuid          null references public.users(id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

comment on table public.tasks is 'Cross-module task management with optional linkage to module records.';

-- ----------------------------------------------------------
-- Table 16: kpi_targets
-- ----------------------------------------------------------
create table public.kpi_targets (
  id             uuid        primary key default uuid_generate_v4(),
  metric_name    text        not null,
  target_value   integer     not null check (target_value >= 0),
  period         kpi_period  not null default 'monthly',
  effective_from date        not null,
  created_by     uuid        null references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table public.kpi_targets is 'Admin-defined KPI targets for each metric per period.';

-- ----------------------------------------------------------
-- Table 17: reports (auto-generated)
-- ----------------------------------------------------------
create table public.reports (
  id            uuid          primary key default uuid_generate_v4(),
  report_type   report_type   not null,
  period_start  date          not null,
  period_end    date          not null,
  data          jsonb         not null default '{}',
  ai_summary    text          null,
  status        report_status not null default 'generating',
  generated_by  uuid          null references public.users(id) on delete set null,
  generated_at  timestamptz   not null default now()
);

comment on table public.reports is 'Auto-generated weekly/monthly reports with JSONB data and AI summaries.';

-- ----------------------------------------------------------
-- Table 18: audit_log
-- ----------------------------------------------------------
create table public.audit_log (
  id          uuid         primary key default uuid_generate_v4(),
  user_id     uuid         null references public.users(id) on delete set null,
  action      audit_action not null,
  table_name  text         null,
  record_id   uuid         null,
  old_values  jsonb        null,
  new_values  jsonb        null,
  created_at  timestamptz  not null default now()
);

comment on table public.audit_log is 'Immutable audit trail for all data mutations. INSERT-only (no UPDATE, no DELETE via RLS).';


-- ============================================================
-- PART 4: INDEXES
-- ============================================================

-- Citations
create index idx_citations_status on public.citations(status);
create index idx_citations_created_by on public.citations(created_by);
create index idx_citations_created_at on public.citations(created_at desc);
create index idx_citations_url_trgm on public.citations using gin (url gin_trgm_ops);
create index idx_citations_dir_trgm on public.citations using gin (directory_name gin_trgm_ops);

-- Outreach Prospects
create index idx_prospects_pipeline_stage on public.outreach_prospects(pipeline_stage);
create index idx_prospects_assigned_to on public.outreach_prospects(assigned_to);
create index idx_prospects_next_followup on public.outreach_prospects(next_followup_date) where next_followup_date is not null;
create index idx_prospects_name_trgm on public.outreach_prospects using gin (site_name gin_trgm_ops);

-- Outreach Notes
create index idx_notes_prospect_id on public.outreach_notes(prospect_id);

-- Guest Posts
create index idx_guestposts_status on public.guest_posts(status);
create index idx_guestposts_created_by on public.guest_posts(created_by);
create index idx_guestposts_title_trgm on public.guest_posts using gin (title gin_trgm_ops);

-- Competitor Backlinks
create index idx_backlinks_competitor_id on public.competitor_backlinks(competitor_id);
create index idx_backlinks_is_gap on public.competitor_backlinks(is_gap) where is_gap = true;
create index idx_backlinks_tagged on public.competitor_backlinks(tagged_for_outreach) where tagged_for_outreach = true;

-- PR Placements
create index idx_placements_campaign_id on public.pr_placements(campaign_id);

-- GBP Posts
create index idx_gbp_posts_location_id on public.gbp_posts(location_id);
create index idx_gbp_posts_status on public.gbp_posts(status);

-- GBP Reviews
create index idx_gbp_reviews_location_id on public.gbp_reviews(location_id);
create index idx_gbp_reviews_not_responded on public.gbp_reviews(is_responded) where is_responded = false;

-- GBP Metrics
create index idx_gbp_metrics_location_id on public.gbp_metrics(location_id);
create index idx_gbp_metrics_month on public.gbp_metrics(metric_month desc);

-- Tasks
create index idx_tasks_assignee on public.tasks(assignee);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_due_date on public.tasks(due_date) where due_date is not null;
create index idx_tasks_module_type on public.tasks(module_type) where module_type is not null;
create index idx_tasks_overdue on public.tasks(due_date)
  where status in ('todo', 'in_progress', 'blocked') and due_date is not null;

-- Audit Log
create index idx_audit_log_user_id on public.audit_log(user_id);
create index idx_audit_log_created_at on public.audit_log(created_at desc);
create index idx_audit_log_table_name on public.audit_log(table_name);


-- ============================================================
-- PART 5: UPDATED_AT TRIGGER FUNCTION
-- ============================================================

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at
create trigger set_updated_at_users
  before update on public.users
  for each row execute function update_updated_at_column();

create trigger set_updated_at_citations
  before update on public.citations
  for each row execute function update_updated_at_column();

create trigger set_updated_at_outreach_prospects
  before update on public.outreach_prospects
  for each row execute function update_updated_at_column();

create trigger set_updated_at_guest_posts
  before update on public.guest_posts
  for each row execute function update_updated_at_column();

create trigger set_updated_at_competitors
  before update on public.competitors
  for each row execute function update_updated_at_column();

create trigger set_updated_at_pr_campaigns
  before update on public.pr_campaigns
  for each row execute function update_updated_at_column();

create trigger set_updated_at_pr_contacts
  before update on public.pr_contacts
  for each row execute function update_updated_at_column();

create trigger set_updated_at_gbp_reviews
  before update on public.gbp_reviews
  for each row execute function update_updated_at_column();

create trigger set_updated_at_tasks
  before update on public.tasks
  for each row execute function update_updated_at_column();


-- ============================================================
-- PART 6: ROW LEVEL SECURITY
-- From DOC3 Section 5 — RLS Policy Matrix
-- ============================================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.citations enable row level security;
alter table public.outreach_prospects enable row level security;
alter table public.outreach_notes enable row level security;
alter table public.guest_posts enable row level security;
alter table public.competitors enable row level security;
alter table public.competitor_backlinks enable row level security;
alter table public.pr_campaigns enable row level security;
alter table public.pr_placements enable row level security;
alter table public.pr_contacts enable row level security;
alter table public.gbp_locations enable row level security;
alter table public.gbp_posts enable row level security;
alter table public.gbp_reviews enable row level security;
alter table public.gbp_metrics enable row level security;
alter table public.tasks enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;

-- ----------------------------------------------------------
-- Helper function: get the current user's role
-- ----------------------------------------------------------
create or replace function get_my_role()
returns user_role
language sql
stable
security definer
as $$
  select role from public.users where id = auth.uid() limit 1;
$$;

-- Helper function: check if current user is admin
create or replace function is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------
-- RLS: users table
-- ----------------------------------------------------------

-- All authenticated users can read user profiles (needed for assignee dropdowns)
create policy "Authenticated users can read all profiles"
  on public.users for select
  to authenticated
  using (true);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));
  -- Note: role cannot be changed via this policy (would require admin action)

-- Admin can update any user (including role changes)
create policy "Admin can update any user"
  on public.users for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Admin can insert new users (for pre-provisioning accounts)
create policy "Admin can insert users"
  on public.users for insert
  to authenticated
  with check (is_admin());

-- No one can delete users via RLS (must be done via Supabase admin panel or service role)
-- (No delete policy = delete denied for all)

-- ----------------------------------------------------------
-- RLS: citations table
-- All authenticated users can read and write (DOC3 Table 2)
-- ----------------------------------------------------------

create policy "All authenticated can read citations"
  on public.citations for select
  to authenticated
  using (true);

create policy "All authenticated can insert citations"
  on public.citations for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update citations"
  on public.citations for update
  to authenticated
  using (true)
  with check (true);

-- Only admin can delete citations
create policy "Admin only can delete citations"
  on public.citations for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: outreach_prospects table
-- All read/write, admin delete only
-- ----------------------------------------------------------

create policy "All authenticated can read outreach_prospects"
  on public.outreach_prospects for select
  to authenticated
  using (true);

create policy "All authenticated can insert outreach_prospects"
  on public.outreach_prospects for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update outreach_prospects"
  on public.outreach_prospects for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin only can delete outreach_prospects"
  on public.outreach_prospects for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: outreach_notes table
-- ----------------------------------------------------------

create policy "All authenticated can read outreach_notes"
  on public.outreach_notes for select
  to authenticated
  using (true);

create policy "All authenticated can insert outreach_notes"
  on public.outreach_notes for insert
  to authenticated
  with check (auth.uid() is not null);

-- Note creator or admin can update
create policy "Creator or admin can update outreach_notes"
  on public.outreach_notes for update
  to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- Note creator or admin can delete
create policy "Creator or admin can delete outreach_notes"
  on public.outreach_notes for delete
  to authenticated
  using (created_by = auth.uid() or is_admin());

-- ----------------------------------------------------------
-- RLS: guest_posts table
-- ----------------------------------------------------------

create policy "All authenticated can read guest_posts"
  on public.guest_posts for select
  to authenticated
  using (true);

create policy "All authenticated can insert guest_posts"
  on public.guest_posts for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update guest_posts"
  on public.guest_posts for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin only can delete guest_posts"
  on public.guest_posts for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: competitors table
-- ----------------------------------------------------------

create policy "All authenticated can read competitors"
  on public.competitors for select
  to authenticated
  using (true);

create policy "All authenticated can insert competitors"
  on public.competitors for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update competitors"
  on public.competitors for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin only can delete competitors"
  on public.competitors for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: competitor_backlinks table
-- ----------------------------------------------------------

create policy "All authenticated can read competitor_backlinks"
  on public.competitor_backlinks for select
  to authenticated
  using (true);

create policy "All authenticated can insert competitor_backlinks"
  on public.competitor_backlinks for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update competitor_backlinks"
  on public.competitor_backlinks for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin only can delete competitor_backlinks"
  on public.competitor_backlinks for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: pr_campaigns table
-- ----------------------------------------------------------

create policy "All authenticated can read pr_campaigns"
  on public.pr_campaigns for select
  to authenticated
  using (true);

create policy "All authenticated can insert pr_campaigns"
  on public.pr_campaigns for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update pr_campaigns"
  on public.pr_campaigns for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin only can delete pr_campaigns"
  on public.pr_campaigns for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: pr_placements table
-- ----------------------------------------------------------

create policy "All authenticated can read pr_placements"
  on public.pr_placements for select
  to authenticated
  using (true);

create policy "All authenticated can insert pr_placements"
  on public.pr_placements for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update pr_placements"
  on public.pr_placements for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin only can delete pr_placements"
  on public.pr_placements for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: pr_contacts table
-- ----------------------------------------------------------

create policy "All authenticated can read pr_contacts"
  on public.pr_contacts for select
  to authenticated
  using (true);

create policy "All authenticated can insert pr_contacts"
  on public.pr_contacts for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update pr_contacts"
  on public.pr_contacts for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin only can delete pr_contacts"
  on public.pr_contacts for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: gbp_locations table
-- ----------------------------------------------------------

create policy "All authenticated can read gbp_locations"
  on public.gbp_locations for select
  to authenticated
  using (true);

-- Only admin and data_specialist can manage GBP locations
create policy "Admin and data_specialist can insert gbp_locations"
  on public.gbp_locations for insert
  to authenticated
  with check (get_my_role() in ('admin', 'data_specialist'));

create policy "Admin and data_specialist can update gbp_locations"
  on public.gbp_locations for update
  to authenticated
  using (get_my_role() in ('admin', 'data_specialist'))
  with check (get_my_role() in ('admin', 'data_specialist'));

create policy "Admin only can delete gbp_locations"
  on public.gbp_locations for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: gbp_posts, gbp_reviews, gbp_metrics
-- ----------------------------------------------------------

-- gbp_posts
create policy "All authenticated can read gbp_posts"
  on public.gbp_posts for select to authenticated using (true);

create policy "Admin and data_specialist can insert gbp_posts"
  on public.gbp_posts for insert to authenticated
  with check (get_my_role() in ('admin', 'data_specialist'));

create policy "Admin and data_specialist can update gbp_posts"
  on public.gbp_posts for update to authenticated
  using (get_my_role() in ('admin', 'data_specialist'))
  with check (get_my_role() in ('admin', 'data_specialist'));

create policy "Admin only can delete gbp_posts"
  on public.gbp_posts for delete to authenticated using (is_admin());

-- gbp_reviews
create policy "All authenticated can read gbp_reviews"
  on public.gbp_reviews for select to authenticated using (true);

create policy "All authenticated can insert gbp_reviews"
  on public.gbp_reviews for insert to authenticated with check (auth.uid() is not null);

create policy "All authenticated can update gbp_reviews"
  on public.gbp_reviews for update to authenticated using (true) with check (true);

create policy "Admin only can delete gbp_reviews"
  on public.gbp_reviews for delete to authenticated using (is_admin());

-- gbp_metrics
create policy "All authenticated can read gbp_metrics"
  on public.gbp_metrics for select to authenticated using (true);

create policy "Admin and data_specialist can insert gbp_metrics"
  on public.gbp_metrics for insert to authenticated
  with check (get_my_role() in ('admin', 'data_specialist'));

create policy "Admin and data_specialist can update gbp_metrics"
  on public.gbp_metrics for update to authenticated
  using (get_my_role() in ('admin', 'data_specialist'))
  with check (get_my_role() in ('admin', 'data_specialist'));

create policy "Admin only can delete gbp_metrics"
  on public.gbp_metrics for delete to authenticated using (is_admin());

-- ----------------------------------------------------------
-- RLS: tasks table
-- ----------------------------------------------------------

create policy "All authenticated can read tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "All authenticated can insert tasks"
  on public.tasks for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "All authenticated can update tasks"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);

-- Only admin or the task creator can delete
create policy "Creator or admin can delete tasks"
  on public.tasks for delete
  to authenticated
  using (created_by = auth.uid() or is_admin());

-- ----------------------------------------------------------
-- RLS: kpi_targets table
-- Admin only for write operations
-- ----------------------------------------------------------

create policy "All authenticated can read kpi_targets"
  on public.kpi_targets for select
  to authenticated
  using (true);

create policy "Admin only can insert kpi_targets"
  on public.kpi_targets for insert
  to authenticated
  with check (is_admin());

create policy "Admin only can update kpi_targets"
  on public.kpi_targets for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "Admin only can delete kpi_targets"
  on public.kpi_targets for delete
  to authenticated
  using (is_admin());

-- ----------------------------------------------------------
-- RLS: reports table
-- ----------------------------------------------------------

create policy "All authenticated can read reports"
  on public.reports for select
  to authenticated
  using (true);

-- Reports are generated by the system (service role) or admin
-- Regular users cannot create/update reports directly
create policy "Admin can insert reports"
  on public.reports for insert
  to authenticated
  with check (is_admin());

create policy "Admin can update reports"
  on public.reports for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ----------------------------------------------------------
-- RLS: audit_log table
-- INSERT-only for authenticated users, admin can read all
-- ----------------------------------------------------------

-- All authenticated can insert (service role inserts via logAuditEvent)
create policy "Service role inserts audit logs"
  on public.audit_log for insert
  to authenticated
  with check (true);

-- Only admin can read audit logs
create policy "Admin can read audit_log"
  on public.audit_log for select
  to authenticated
  using (is_admin());

-- NOBODY can update or delete audit logs (no update/delete policies = denied)


-- ============================================================
-- PART 7: SYNC USER ON AUTH SIGN-UP
-- Automatically creates a public.users row when a user signs up
-- via Supabase Auth. Only works for pre-invited accounts.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only insert if the email is in the pre-approved list.
  -- This prevents random signups from getting a profile.
  -- Adjust these emails to match your team.
  if new.email in (
    'bharat@indiaheritage.com',   -- Admin
    'bablu@indiaheritage.com',    -- SEO Specialist
    'rahul@indiaheritage.com'     -- Data Specialist
  ) then
    insert into public.users (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      case new.email
        when 'bharat@indiaheritage.com' then 'admin'::user_role
        when 'rahul@indiaheritage.com' then 'data_specialist'::user_role
        else 'seo_specialist'::user_role
      end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- Trigger: fire after every auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- PART 8: SEED DATA (Optional — initial admin setup)
-- Run this AFTER creating your Supabase Auth users via the
-- Supabase Dashboard → Authentication → Users → Invite User
-- ============================================================

-- NOTE: Replace the UUIDs below with the actual UUIDs from your
-- Supabase Auth users after inviting them.
-- The trigger above will handle this automatically once they sign up.

-- Example manual seed (only needed if trigger doesn't fire):
/*
insert into public.users (id, email, full_name, role) values
  ('YOUR-BHARAT-UUID-HERE', 'bharat@indiaheritage.com', 'Bharat', 'admin'),
  ('YOUR-BABLU-UUID-HERE',  'bablu@indiaheritage.com',  'Bablu',  'seo_specialist'),
  ('YOUR-RAHUL-UUID-HERE',  'rahul@indiaheritage.com',  'Rahul',  'data_specialist')
on conflict (id) do nothing;
*/

-- ============================================================
-- PART 9: GRANT PERMISSIONS TO ANON AND AUTHENTICATED ROLES
-- ============================================================

-- The authenticated role (logged-in users) gets access to public schema tables.
-- RLS policies (Part 6) further restrict what rows each user can see/edit.

grant usage on schema public to anon, authenticated;

grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant all on all routines in schema public to authenticated;

-- Anon gets read on nothing (all data requires auth)
revoke all on all tables in schema public from anon;


-- ============================================================
-- MIGRATION COMPLETE
-- 
-- What was created:
--   18 tables (includes audit_log and reports)
--   All ENUM types
--   Indexes for all common query patterns (status, assignee, dates)
--   RLS on all tables
--   updated_at triggers
--   Auth user sync trigger
--   Helper functions: get_my_role(), is_admin()
--
-- NEXT STEPS:
--   1. Invite users via Supabase Dashboard → Auth → Users → Invite
--   2. Copy .env.example → .env.local and fill in values
--   3. Run: pnpm install && pnpm dev
-- ============================================================
