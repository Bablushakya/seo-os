import { redirect } from 'next/navigation'

/**
 * Root redirect — sends users from / to /dashboard.
 * Middleware handles the auth check; if not logged in, they'll
 * be redirected to /login before hitting this page.
 */
export default function RootPage() {
  redirect('/dashboard')
}
