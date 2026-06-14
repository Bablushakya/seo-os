'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import type { Session } from '@supabase/supabase-js'

// ============================================================
// AUTH CONTEXT TYPE
// ============================================================

interface AuthContextValue {
  /** The current user's profile from public.users (null if not authenticated) */
  user: User | null
  /** Supabase session (contains JWT tokens) */
  session: Session | null
  /** True while the initial auth check is running */
  isLoading: boolean
  /** True once the first auth check has completed */
  isInitialized: boolean
  /** Sign the user out and redirect to /login */
  signOut: () => Promise<void>
}

// ============================================================
// CONTEXT
// ============================================================

const AuthContext = createContext<AuthContextValue | null>(null)

// ============================================================
// PROVIDER
// ============================================================

interface UserProviderProps {
  children: React.ReactNode
  /** Optional initial session from server-side (eliminates flash) */
  initialSession?: Session | null
}

/**
 * Wraps the app and provides auth state to all Client Components.
 *
 * Listens to Supabase auth state changes and keeps user profile in sync.
 * Implements 8-hour inactivity timeout (FR-004).
 *
 * Place in app/layout.tsx to make auth available everywhere.
 */
export function UserProvider({ children, initialSession = null }: UserProviderProps) {
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<Session | null>(initialSession)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Fetch the full user profile from public.users
  const fetchProfile = useCallback(
    async (userId: string): Promise<User | null> => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        console.error('[Auth] Failed to fetch user profile:', error?.message)
        return null
      }

      return data as User
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    router.push('/login')
  }, [supabase, router])

  // ---- Inactivity timeout (8 hours — FR-004) ----
  useEffect(() => {
    if (!user) return

    let inactivityTimer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(inactivityTimer)
      inactivityTimer = setTimeout(
        async () => {
          console.info('[Auth] Session expired due to inactivity')
          await signOut()
        },
        8 * 60 * 60 * 1000, // 8 hours
      )
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(inactivityTimer)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, [user, signOut])

  // ---- Subscribe to Supabase auth changes ----
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)

      if (newSession?.user) {
        const profile = await fetchProfile(newSession.user.id)
        setUser(profile)

        if (!profile) {
          // User authenticated but not in public.users — sign out
          await supabase.auth.signOut()
          router.push('/login?error=unauthorized')
        }
      } else {
        setUser(null)
      }

      setIsLoading(false)
      setIsInitialized(true)
    })

    // Initial session load
    void supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      if (s?.user) {
        const profile = await fetchProfile(s.user.id)
        setUser(profile)
      }
      setIsLoading(false)
      setIsInitialized(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile, router])

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, isInitialized, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ============================================================
// HOOK
// ============================================================

/**
 * Access the current auth state from any Client Component.
 *
 * @example
 * const { user, isLoading, signOut } = useAuth()
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside <UserProvider>')
  }

  return context
}

/**
 * Returns the current user, throws if not authenticated.
 * Use this in components that are guaranteed to render only when logged in.
 */
export function useRequiredAuth(): AuthContextValue & { user: User } {
  const context = useAuth()

  if (!context.user && context.isInitialized) {
    throw new Error('useRequiredAuth: user is not authenticated')
  }

  return context as AuthContextValue & { user: User }
}
