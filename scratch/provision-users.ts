import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ENVIRONMENT LOADER
// ============================================================

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local file not found in the project root.')
    console.error('Please copy .env.example to .env.local and fill in the required keys.')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const delimiterIndex = trimmed.indexOf('=')
    if (delimiterIndex === -1) return
    const key = trimmed.substring(0, delimiterIndex).trim()
    let value = trimmed.substring(delimiterIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1)
    }
    process.env[key] = value
  })
}

// Load env variables
loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.')
  process.exit(1)
}

// Initialize Supabase Admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ============================================================
// PROVISIONING CONFIG
// ============================================================

const USERS_TO_PROVISION = [
  {
    email: 'bharat@indiaheritage.com',
    name: 'Bharat',
    role: 'admin',
  },
  {
    email: 'bablu@indiaheritage.com',
    name: 'Bablu',
    role: 'seo_specialist',
  },
  {
    email: 'rahul@indiaheritage.com',
    name: 'Rahul',
    role: 'data_specialist',
  },
]

// Generate secure passwords (at least 16 characters, uppercase, lowercase, numbers, symbols)
function generateTempPassword(prefix: string) {
  const randomChars = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
  return `${prefix}_${randomChars.toUpperCase()}_2026!`
}

async function main() {
  console.log('------------------------------------------------------------')
  console.log('Starting SEO-OS User Provisioning...')
  console.log('------------------------------------------------------------')

  try {
    // 1. Fetch existing users to check for duplicates
    const { data: { users: existingUsers }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      throw new Error(`Failed to list existing auth users: ${listError.message}`)
    }

    const existingEmails = new Set(existingUsers.map(u => u.email?.toLowerCase()))

    // 2. Create users one by one
    for (const target of USERS_TO_PROVISION) {
      const emailLower = target.email.toLowerCase()

      if (existingEmails.has(emailLower)) {
        console.log(`[-] User ${target.name} (${target.email}) already exists in Supabase Auth. Skipping.`)
        continue
      }

      const tempPassword = generateTempPassword(target.name)

      // Create auth user
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: target.email,
        password: tempPassword,
        email_confirm: true, // Confirm email automatically so they can log in instantly
        user_metadata: {
          full_name: target.name,
        },
      })

      if (createError) {
        console.error(`[X] Failed to create user ${target.name}:`, createError.message)
        continue
      }

      if (user) {
        console.log(`[+] Successfully provisioned ${target.name} (${target.email})`)
        console.log(`    Role:             ${target.role}`)
        console.log(`    User ID:          ${user.id}`)
        console.log(`    Temp Password:    ${tempPassword}`)
        console.log('    --------------------------------------------------------')
      }
    }

    console.log('------------------------------------------------------------')
    console.log('User provisioning completed!')
    console.log('------------------------------------------------------------')
    console.log('IMPORTANT: Distribute temporary passwords to team members securely.')
    console.log('Once they log in, the public.users database records will be created.')
    console.log('------------------------------------------------------------')

  } catch (error: any) {
    console.error('CRITICAL ERROR:', error.message || error)
    process.exit(1)
  }
}

main()
