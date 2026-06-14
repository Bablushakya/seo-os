import React from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { UserProvider } from '@/lib/hooks/useAuth'
import './globals.css'

// ============================================================
// FONT
// ============================================================

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// ============================================================
// METADATA & VIEWPORT
// ============================================================

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: {
    default: 'SEO-OS — Internal SEO Operations Platform',
    template: '%s | SEO-OS',
  },
  description:
    'Internal off-page SEO operating system for the India Heritage Travel team. Manage citations, outreach, guest posts, competitors, digital PR, and GBP activities.',
  robots: {
    index: false,   // Internal tool — do not index
    follow: false,
  },
  icons: {
    icon: '/favicon.ico',
  },
}

// ============================================================
// ROOT LAYOUT
// ============================================================

interface RootLayoutProps {
  children: React.ReactNode
}

/**
 * Root layout — wraps the entire application.
 *
 * Providers:
 * - ThemeProvider (dark mode default, with light mode toggle)
 * - UserProvider (Supabase auth state + user profile)
 * - Toaster (Sonner toast notifications — bottom-right)
 *
 * From DOC4 Section 1.2 — Visual Style (dark mode default)
 * From DOC5 PROJ-001-01 — Root layout
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={inter.variable}
    >
      <head>
        {/* Skip to main content for keyboard/screen reader users */}
        <style>{`
          .skip-link {
            position: absolute;
            left: -9999px;
            z-index: 999;
          }
          .skip-link:focus {
            left: 16px;
            top: 16px;
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Skip navigation link (accessibility) */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <UserProvider>
            {children}
          </UserProvider>

          {/* Toast notifications — bottom-right, from DOC4 Section 12 */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  'border border-border bg-card text-card-foreground shadow-lg',
                description: 'text-muted-foreground',
                actionButton: 'bg-primary text-primary-foreground',
                cancelButton: 'bg-muted text-muted-foreground',
                error: 'border-destructive/50 bg-destructive/10 text-destructive',
                success: 'border-green-500/50 bg-green-500/10 text-green-400',
              },
            }}
            richColors
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
