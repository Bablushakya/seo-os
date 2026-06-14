const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Supabase environment variables not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  const email = 'bablu@indiaheritage.com';
  const password = '1234567890';
  
  console.log(`Attempting to sign in with: ${email}`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Login failed:', error.message);
    process.exit(1);
  }
  
  console.log('Login successful!');
  console.log('User ID:', data.user.id);
  console.log('User Email:', data.user.email);
  console.log('Session expires at:', new Date(data.session.expires_at * 1000).toLocaleString());
  
  // Test loading some tables using this session to verify RLS
  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  
  await authSupabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });
  
  console.log('\nTesting RLS: Querying outreach prospects...');
  const { data: prospects, error: prospectsErr } = await authSupabase
    .from('outreach_prospects')
    .select('id, site_name, url')
    .limit(3);
    
  if (prospectsErr) {
    console.error('Failed to query outreach_prospects:', prospectsErr.message);
  } else {
    console.log(`Success! Retrieved ${prospects.length} prospects.`);
    prospects.forEach((p, idx) => {
      console.log(`  ${idx+1}. ${p.site_name} (${p.url})`);
    });
  }

  console.log('\nTesting RLS: Querying user profiles...');
  const { data: users, error: usersErr } = await authSupabase
    .from('users')
    .select('id, full_name, role');
    
  if (usersErr) {
    console.error('Failed to query users profiles:', usersErr.message);
  } else {
    console.log(`Success! Retrieved ${users.length} user profiles.`);
    users.forEach((u, idx) => {
      console.log(`  - ${u.full_name} (${u.role})`);
    });
  }
}

testLogin().catch(err => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
