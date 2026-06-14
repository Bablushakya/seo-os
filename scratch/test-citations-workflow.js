const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be in environment.');
  process.exit(1);
}

// Client for Bablu
const clientSupabase = createClient(supabaseUrl, supabaseAnonKey);
// Client for Admin (to verify/insert other users' records bypassing RLS)
const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function testWorkflow() {
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
  
  const babluUserId = authData.user.id;
  console.log(`Successfully authenticated. User ID: ${babluUserId}\n`);

  // Fetch another user profile (Bharat)
  const { data: profiles, error: profilesErr } = await adminSupabase
    .from('users')
    .select('id, full_name, role');
    
  if (profilesErr) {
    console.error('Failed to get user profiles:', profilesErr.message);
    process.exit(1);
  }
  
  const bharat = profiles.find(p => p.role === 'admin');
  if (!bharat) {
    console.error('Error: Could not find admin (Bharat) profile.');
    process.exit(1);
  }
  console.log(`Found Admin User (Bharat) with ID: ${bharat.id}`);

  // Test Case 1: Bablu creates a citation
  console.log('\n--- TEST CASE 1: Bablu creates a citation ---');
  const testCitation = {
    directory_name: 'Test Directory Bablu',
    url: 'https://test-bablu-directory.com',
    domain_authority: 45,
    niche: 'Travel',
    status: 'pending',
    notes: 'Created by Bablu in test script',
    created_by: babluUserId
  };
  
  const { data: createdCitations, error: createErr } = await clientSupabase
    .from('citations')
    .insert(testCitation)
    .select()
    .single();
    
  if (createErr) {
    console.error('[FAIL] Bablu failed to create citation:', createErr.message);
    process.exit(1);
  }
  
  const citationId = createdCitations.id;
  console.log(`[PASS] Citation created successfully. ID: ${citationId}`);

  // Test Case 2: Bablu updates his own citation
  console.log('\n--- TEST CASE 2: Bablu updates his own citation ---');
  const { data: updatedCitation, error: updateErr } = await clientSupabase
    .from('citations')
    .update({ status: 'submitted', notes: 'Updated by Bablu' })
    .eq('id', citationId)
    .select()
    .single();
    
  if (updateErr) {
    console.error('[FAIL] Bablu failed to update citation:', updateErr.message);
  } else {
    console.log(`[PASS] Citation updated successfully. New status: ${updatedCitation.status}, notes: ${updatedCitation.notes}`);
  }

  // Test Case 3: Create a citation owned by Bharat (Admin) using admin client
  console.log('\n--- TEST CASE 3: Inserting citation owned by Bharat (Admin) ---');
  const adminCitation = {
    directory_name: 'Test Directory Bharat',
    url: 'https://test-bharat-directory.com',
    domain_authority: 80,
    niche: 'Heritage',
    status: 'live',
    notes: 'Created by Bharat',
    created_by: bharat.id
  };
  
  const { data: createdAdminCitation, error: adminInsertErr } = await adminSupabase
    .from('citations')
    .insert(adminCitation)
    .select()
    .single();
    
  if (adminInsertErr) {
    console.error('[FAIL] Failed to insert admin citation:', adminInsertErr.message);
    process.exit(1);
  }
  
  const adminCitationId = createdAdminCitation.id;
  console.log(`[PASS] Admin citation inserted successfully. ID: ${adminCitationId}`);

  // Test Case 4: Bablu attempts to update Bharat's citation (Expect SUCCESS - collaborative update permitted)
  console.log("\n--- TEST CASE 4: Bablu attempts to update Bharat's citation (Expect SUCCESS) ---");
  const { data: rlsUpdateData, error: rlsUpdateErr } = await clientSupabase
    .from('citations')
    .update({ notes: 'Collaborative update by Bablu' })
    .eq('id', adminCitationId)
    .select();
    
  if (rlsUpdateErr) {
    console.error(`[FAIL] Bablu failed to update Bharat's citation: ${rlsUpdateErr.message}`);
  } else if (rlsUpdateData && rlsUpdateData.length > 0) {
    console.log(`[PASS] Bablu updated Bharat's citation successfully. Notes: ${rlsUpdateData[0].notes}`);
  } else {
    console.error('[FAIL] Bablu could not update Bharat\'s citation (returned empty array)');
  }

  // Test Case 5: Bablu attempts to delete Bharat's citation (Expect RLS Block)
  console.log("\n--- TEST CASE 5: Bablu attempts to delete Bharat's citation (Expect RLS Block) ---");
  const { data: rlsDeleteData, error: rlsDeleteErr } = await clientSupabase
    .from('citations')
    .delete()
    .eq('id', adminCitationId)
    .select();
    
  if (rlsDeleteErr) {
    console.log(`[PASS] Blocked with error: ${rlsDeleteErr.message}`);
  } else if (!rlsDeleteData || rlsDeleteData.length === 0) {
    console.log('[PASS] Blocked successfully: No records deleted (returned empty array)');
  } else {
    console.error('[FAIL] RLS failed! Bablu was able to delete Bharat\'s citation:', rlsDeleteData);
  }

  // Test Case 6: Bablu attempts to delete his own citation (Expect RLS Block)
  console.log('\n--- TEST CASE 6: Bablu attempts to delete his own citation (Expect RLS Block) ---');
  const { data: deletedData, error: deleteErr } = await clientSupabase
    .from('citations')
    .delete()
    .eq('id', citationId)
    .select();
    
  if (deleteErr) {
    console.log(`[PASS] Blocked with error: ${deleteErr.message}`);
  } else if (!deletedData || deletedData.length === 0) {
    console.log('[PASS] Blocked successfully: No records deleted (returned empty array)');
  } else {
    console.error('[FAIL] RLS failed! Bablu was able to delete his own citation:', deletedData);
  }

  // Admin cleans up both citations
  console.log('\nAdmin cleaning up test citations...');
  await adminSupabase.from('citations').delete().eq('id', citationId);
  await adminSupabase.from('citations').delete().eq('id', adminCitationId);
  console.log('Cleanup finished.');
}

testWorkflow().catch(err => {
  console.error('Fatal error during workflow test:', err);
  process.exit(1);
});
