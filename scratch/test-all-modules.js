const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be in environment.');
  process.exit(1);
}

const clientSupabase = createClient(supabaseUrl, supabaseAnonKey);
const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function testAllModules() {
  const email = 'bablu@indiaheritage.com';
  const password = '1234567890';
  
  console.log('Logging in as Bablu (seo_specialist)...');
  const { data: authData, error: authError } = await clientSupabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (authError) {
    console.error('Authentication failed:', authError.message);
    process.exit(1);
  }
  
  const userId = authData.user.id;
  console.log(`Successfully authenticated. User ID: ${userId}\n`);

  // --- MODULE 1: OUTREACH PROSPECTS ---
  console.log('--- 1. Testing Outreach Prospects ---');
  const prospectData = {
    site_name: 'Test Outreach Blog',
    url: 'https://test-outreach.com',
    domain_authority: 50,
    niche: 'Travel',
    contact_name: 'Jane Doe',
    contact_email: 'jane@test-outreach.com',
    pipeline_stage: 'identified',
    created_by: userId
  };
  
  const { data: createdProspect, error: prospectErr } = await clientSupabase
    .from('outreach_prospects')
    .insert(prospectData)
    .select()
    .single();
    
  if (prospectErr) {
    console.error('[FAIL] Failed to create prospect:', prospectErr.message);
  } else {
    console.log(`[PASS] Outreach prospect created. ID: ${createdProspect.id}`);
  }

  // --- MODULE 2: GUEST POSTS ---
  console.log('\n--- 2. Testing Guest Posts ---');
  const guestPostData = {
    title: 'How to Visit Delhi in 3 Days',
    target_site: 'travelblog.com',
    status: 'pitching',
    topic: 'Travel Itinerary',
    word_count: 1200,
    target_keyword: 'delhi travel',
    created_by: userId
  };
  
  const { data: createdPost, error: postErr } = await clientSupabase
    .from('guest_posts')
    .insert(guestPostData)
    .select()
    .single();
    
  if (postErr) {
    console.error('[FAIL] Failed to create guest post:', postErr.message);
  } else {
    console.log(`[PASS] Guest post created. ID: ${createdPost.id}`);
  }

  // --- MODULE 3: COMPETITORS ---
  console.log('\n--- 3. Testing Competitors ---');
  const competitorData = {
    domain: 'competitortravel.com',
    notes: 'Primary organic competitor',
    created_by: userId
  };
  
  const { data: createdCompetitor, error: competitorErr } = await clientSupabase
    .from('competitors')
    .insert(competitorData)
    .select()
    .single();
    
  if (competitorErr) {
    console.error('[FAIL] Failed to create competitor:', competitorErr.message);
  } else {
    console.log(`[PASS] Competitor created. ID: ${createdCompetitor.id}`);
  }

  // --- MODULE 4: DIGITAL PR ---
  console.log('\n--- 4. Testing Digital PR campaigns ---');
  const prCampaignData = {
    campaign_name: 'India Heritage Summer Launch 2026',
    topic: 'historical sites articles',
    notes: 'Pitching heritage publications',
    status: 'planning',
    created_by: userId
  };
  
  const { data: createdPR, error: prErr } = await clientSupabase
    .from('pr_campaigns')
    .insert(prCampaignData)
    .select()
    .single();
    
  if (prErr) {
    console.error('[FAIL] Failed to create PR campaign:', prErr.message);
  } else {
    console.log(`[PASS] PR campaign created. ID: ${createdPR.id}`);
  }

  // --- MODULE 5: TASKS ---
  console.log('\n--- 5. Testing Tasks ---');
  const taskData = {
    title: 'Audit competitor backlinks',
    description: 'Run Ahrefs audit on competitortravel.com',
    status: 'todo',
    priority: 'high',
    assignee: userId,
    created_by: userId
  };
  
  const { data: createdTask, error: taskErr } = await clientSupabase
    .from('tasks')
    .insert(taskData)
    .select()
    .single();
    
  if (taskErr) {
    console.error('[FAIL] Failed to create task:', taskErr.message);
  } else {
    console.log(`[PASS] Task created. ID: ${createdTask.id}`);
  }

  // --- MODULE 6: GBP LOCATIONS (Expect Block for Bablu as seo_specialist) ---
  console.log('\n--- 6. Testing GBP Locations (Expect RLS Block for seo_specialist) ---');
  const gbpLocationData = {
    business_name: 'India Heritage Travel Ltd',
    location_name: 'Office New Delhi',
    google_maps_url: 'https://maps.google.com/test',
    is_active: true,
    created_by: userId
  };
  
  const { data: createdGBP, error: gbpErr } = await clientSupabase
    .from('gbp_locations')
    .insert(gbpLocationData)
    .select();
    
  if (gbpErr) {
    console.log(`[PASS] Blocked with error: ${gbpErr.message}`);
  } else if (!createdGBP || createdGBP.length === 0) {
    console.log('[PASS] Blocked successfully: No records inserted (returned empty array or blocked by RLS check)');
  } else {
    console.error('[FAIL] RLS failed! Bablu (seo_specialist) was able to insert GBP location:', createdGBP);
  }

  // --- CLEANUP ---
  console.log('\nCleaning up all created test records using Admin privileges...');
  if (createdProspect) await adminSupabase.from('outreach_prospects').delete().eq('id', createdProspect.id);
  if (createdPost) await adminSupabase.from('guest_posts').delete().eq('id', createdPost.id);
  if (createdCompetitor) await adminSupabase.from('competitors').delete().eq('id', createdCompetitor.id);
  if (createdPR) await adminSupabase.from('pr_campaigns').delete().eq('id', createdPR.id);
  if (createdTask) await adminSupabase.from('tasks').delete().eq('id', createdTask.id);
  if (createdGBP && createdGBP.length > 0) await adminSupabase.from('gbp_locations').delete().eq('id', createdGBP[0].id);
  console.log('Cleanup finished.');
}

testAllModules().catch(err => {
  console.error('Fatal error during modules verification:', err);
  process.exit(1);
});
