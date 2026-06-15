-- ============================================================
-- SEO-OS — Migration 002: Add Vishal as Admin + Team Features
--
-- Run this AFTER 001_initial_schema.sql in Supabase SQL Editor.
-- DO NOT mix with the original migration file.
--
-- Changes:
--   1. Update handle_new_user trigger to include Vishal (admin)
--   2. Create team_posts table (Information sharing feed)
--   3. Create team_post_attachments table (PDF/DOC/Image uploads)
--   4. Create team_notes table (Sticky notes board)
--   5. RLS policies for all new tables
--   6. Storage bucket setup for team files
-- ============================================================


-- ============================================================
-- STEP 1: Add Vishal to the allowed users trigger
-- ============================================================

-- Drop and recreate the handle_new_user function with Vishal added
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only insert if the email is in the pre-approved list.
  if new.email in (
    'bharat@indiaheritage.com',   -- Admin
    'bablu@indiaheritage.com',    -- SEO Specialist
    'rahul@indiaheritage.com',    -- Data Specialist
    'vishal@indiaheritage.com'    -- Admin (added in migration 002)
  ) then
    insert into public.users (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      case new.email
        when 'bharat@indiaheritage.com'  then 'admin'::user_role
        when 'vishal@indiaheritage.com'  then 'admin'::user_role
        when 'rahul@indiaheritage.com'   then 'data_specialist'::user_role
        else 'seo_specialist'::user_role
      end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- ============================================================
-- STEP 2: Manual seed for Vishal
-- Run AFTER inviting vishal@indiaheritage.com via Supabase Auth → Users → Invite
-- The trigger above will handle it automatically once he signs up.
-- If the trigger doesn't fire, run the block below manually.
-- ============================================================

-- NOTE: Replace 'VISHAL-UUID-HERE' with the actual UUID from Supabase Auth
-- after sending the invite. If the trigger fires on signup, skip this.
/*
insert into public.users (id, email, full_name, role)
values (
  'VISHAL-UUID-HERE',
  'vishal@indiaheritage.com',
  'Vishal',
  'admin'
)
on conflict (id) do update set
  role = 'admin',
  full_name = coalesce(excluded.full_name, public.users.full_name);
*/


-- ============================================================
-- STEP 3: Create team_posts table
-- ============================================================

create table if not exists public.team_posts (
  id               uuid        primary key default uuid_generate_v4(),
  content          text        not null,
  created_by       uuid        null references public.users(id) on delete set null,
  target_user_ids  uuid[]      null,     -- null = visible to everyone; array = targeted users only
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.team_posts is 'Team information sharing posts (visible to all or targeted users).';
comment on column public.team_posts.target_user_ids is 'NULL = visible to all team members. UUID array = only those specific users.';

-- ============================================================
-- STEP 4: Create team_post_attachments table
-- ============================================================

create table if not exists public.team_post_attachments (
  id           uuid        primary key default uuid_generate_v4(),
  post_id      uuid        not null references public.team_posts(id) on delete cascade,
  file_name    text        not null,
  file_url     text        not null,    -- Supabase Storage public URL
  file_type    text        not null,    -- MIME type (e.g. 'image/jpeg', 'application/pdf')
  file_size    bigint      not null default 0,  -- in bytes
  caption      text        null,
  created_by   uuid        null references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.team_post_attachments is 'File and image attachments for team posts (stored in Supabase Storage).';

-- ============================================================
-- STEP 5: Create team_notes table (Sticky Notes Board)
-- ============================================================

create table if not exists public.team_notes (
  id           uuid        primary key default uuid_generate_v4(),
  content      text        not null,
  color        text        not null default 'yellow'
               check (color in ('yellow', 'blue', 'green', 'pink', 'purple', 'orange')),
  is_pinned    boolean     not null default false,
  created_by   uuid        null references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.team_notes is 'Sticky notes board — short notes visible to all team members.';


-- ============================================================
-- STEP 6: Indexes
-- ============================================================

create index if not exists idx_team_posts_created_at on public.team_posts(created_at desc);
create index if not exists idx_team_posts_created_by on public.team_posts(created_by);
create index if not exists idx_team_post_attachments_post_id on public.team_post_attachments(post_id);
create index if not exists idx_team_notes_is_pinned on public.team_notes(is_pinned) where is_pinned = true;
create index if not exists idx_team_notes_created_at on public.team_notes(created_at desc);


-- ============================================================
-- STEP 7: updated_at triggers for new tables
-- ============================================================

create trigger set_updated_at_team_posts
  before update on public.team_posts
  for each row execute function update_updated_at_column();

create trigger set_updated_at_team_notes
  before update on public.team_notes
  for each row execute function update_updated_at_column();


-- ============================================================
-- STEP 8: Row Level Security for new tables
-- ============================================================

-- Enable RLS
alter table public.team_posts enable row level security;
alter table public.team_post_attachments enable row level security;
alter table public.team_notes enable row level security;

-- ── team_posts RLS ──────────────────────────────────────────
-- Read: if target_user_ids is null (everyone) OR current user's ID is in the array
create policy "Users can read team posts targeted to them or everyone"
  on public.team_posts for select
  to authenticated
  using (
    target_user_ids is null
    or auth.uid() = any(target_user_ids)
    or created_by = auth.uid()
    or is_admin()
  );

-- Insert: any authenticated user can create a post
create policy "Authenticated users can create team posts"
  on public.team_posts for insert
  to authenticated
  with check (auth.uid() is not null);

-- Update: only the creator or admin can update
create policy "Creator or admin can update team posts"
  on public.team_posts for update
  to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- Delete: only the creator or admin can delete
create policy "Creator or admin can delete team posts"
  on public.team_posts for delete
  to authenticated
  using (created_by = auth.uid() or is_admin());

-- ── team_post_attachments RLS ───────────────────────────────
-- Read: follows the parent post visibility
create policy "Users can read attachments of visible posts"
  on public.team_post_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.team_posts p
      where p.id = post_id
        and (
          p.target_user_ids is null
          or auth.uid() = any(p.target_user_ids)
          or p.created_by = auth.uid()
          or is_admin()
        )
    )
  );

-- Insert: any authenticated user can add attachments
create policy "Authenticated users can add attachments"
  on public.team_post_attachments for insert
  to authenticated
  with check (auth.uid() is not null);

-- Delete: post creator or admin can delete attachments
create policy "Creator or admin can delete attachments"
  on public.team_post_attachments for delete
  to authenticated
  using (created_by = auth.uid() or is_admin());

-- ── team_notes RLS ──────────────────────────────────────────
-- Read: all authenticated users can read all notes
create policy "All authenticated can read team notes"
  on public.team_notes for select
  to authenticated
  using (true);

-- Insert: any authenticated user can create a note
create policy "Authenticated users can create team notes"
  on public.team_notes for insert
  to authenticated
  with check (auth.uid() is not null);

-- Update: only creator or admin can edit their note
create policy "Creator or admin can update team notes"
  on public.team_notes for update
  to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- Delete: only creator or admin can delete a note
create policy "Creator or admin can delete team notes"
  on public.team_notes for delete
  to authenticated
  using (created_by = auth.uid() or is_admin());


-- ============================================================
-- STEP 9: Grant permissions to authenticated role
-- ============================================================

grant all on public.team_posts to authenticated;
grant all on public.team_post_attachments to authenticated;
grant all on public.team_notes to authenticated;


-- ============================================================
-- STEP 10: Supabase Storage — team-files bucket
-- Run this in the SQL Editor (storage schema is accessible)
-- ============================================================

-- Create the 'team-files' storage bucket (if not already created via Dashboard)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-files',
  'team-files',
  true,    -- Public bucket so URLs work without signed tokens
  52428800, -- 50 MB max file size
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Storage RLS: allow authenticated users to upload
create policy "Authenticated users can upload team files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'team-files');

-- Storage RLS: allow public read (since bucket is public)
create policy "Public can read team files"
  on storage.objects for select
  to public
  using (bucket_id = 'team-files');

-- Storage RLS: allow creator or admin to delete
create policy "Uploader or admin can delete team files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'team-files' and (auth.uid()::text = (storage.foldername(name))[1] or is_admin()));


-- ============================================================
-- MIGRATION 002 COMPLETE
--
-- Summary of changes:
--   - Vishal (vishal@indiaheritage.com) added as admin in trigger
--   - team_posts table: Information sharing feed
--   - team_post_attachments table: File/image attachments
--   - team_notes table: Sticky notes board
--   - RLS policies for all new tables
--   - Supabase Storage 'team-files' bucket
--
-- Next Steps:
--   1. Run this file in Supabase SQL Editor
--   2. Invite vishal@indiaheritage.com via Auth → Users → Invite
--   3. Deploy updated Next.js app
-- ============================================================
