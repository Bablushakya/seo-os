'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/hooks/useAuth'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Building2,
  Mail,
  FileText,
  BarChart2,
  Newspaper,
  MapPin,
  CheckSquare,
  BarChart,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { USER_ROLE_LABELS } from '@/lib/constants'

// ============================================================
// NAVIGATION CONFIG (from DOC4 Section 3.1)
// ============================================================

const ICON_MAP = {
  LayoutDashboard,
  Building2,
  Mail,
  FileText,
  BarChart2,
  Newspaper,
  MapPin,
  CheckSquare,
  BarChart,
  Settings,
} as const

type IconName = keyof typeof ICON_MAP

interface NavItem {
  label: string
  href: string
  icon: IconName
  adminOnly?: boolean
}

interface NavGroup {
  group: string | null
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: null,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    group: 'OFF-PAGE SEO',
    items: [
      { label: 'Citations', href: '/citations', icon: 'Building2' },
      { label: 'Outreach', href: '/outreach', icon: 'Mail' },
      { label: 'Guest Posts', href: '/guest-posts', icon: 'FileText' },
      { label: 'Competitors', href: '/competitors', icon: 'BarChart2' },
      { label: 'Digital PR', href: '/digital-pr', icon: 'Newspaper' },
      { label: 'GBP Management', href: '/gbp', icon: 'MapPin' },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { label: 'Tasks', href: '/tasks', icon: 'CheckSquare' },
      { label: 'Reports', href: '/reports', icon: 'BarChart' },
    ],
  },
  {
    group: null,
    items: [
      { label: 'Settings', href: '/settings', icon: 'Settings', adminOnly: true },
    ],
  },
]

// ============================================================
// SIDEBAR NAV ITEM
// ============================================================

interface NavItemProps {
  item: NavItem
  isCollapsed: boolean
  overdueTaskCount?: number
}

function SidebarNavItem({ item, isCollapsed, overdueTaskCount }: NavItemProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  // Hide admin-only items from non-admins
  if (item.adminOnly && user?.role !== 'admin') return null

  const Icon = ICON_MAP[item.icon]
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const showTaskBadge = item.href === '/tasks' && (overdueTaskCount ?? 0) > 0

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        isCollapsed && 'justify-center px-2',
      )}
      title={isCollapsed ? item.label : undefined}
    >
      <Icon
        className={cn(
          'flex-shrink-0',
          isActive ? 'text-white' : 'text-muted-foreground',
          isCollapsed ? 'h-5 w-5' : 'h-4 w-4',
        )}
        aria-hidden="true"
      />
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {showTaskBadge && (
            <Badge
              variant="destructive"
              className="h-5 min-w-5 flex items-center justify-center text-xs px-1"
            >
              {overdueTaskCount}
            </Badge>
          )}
        </>
      )}
    </Link>
  )
}

// ============================================================
// SIDEBAR
// ============================================================

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  overdueTaskCount?: number
}

function Sidebar({ isCollapsed, onToggle, overdueTaskCount }: SidebarProps) {
  const { user, signOut } = useAuth()

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-card border-r border-border sidebar-transition',
        isCollapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
      )}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center h-[var(--header-height)] px-4 border-b border-border flex-shrink-0',
          isCollapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!isCollapsed && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-foreground"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-600">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            <span className="text-base">SEO-OS</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-1">
            {/* Group label */}
            {group.group && !isCollapsed && (
              <div className="px-3 py-2">
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                  {group.group}
                </span>
              </div>
            )}
            {group.group && isCollapsed && groupIndex > 0 && (
              <Separator className="my-2" />
            )}

            {/* Items */}
            {group.items.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isCollapsed={isCollapsed}
                overdueTaskCount={overdueTaskCount}
              />
            ))}

            {/* Separator after non-null groups */}
            {groupIndex < NAV_GROUPS.length - 2 && !isCollapsed && (
              <Separator className="my-2" />
            )}
          </div>
        ))}
      </nav>

      {/* User profile + sign out */}
      <div className={cn('p-3 border-t border-border flex-shrink-0')}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              {user?.avatar_url && (
                <AvatarImage src={user.avatar_url} alt={user.full_name} />
              )}
              <AvatarFallback className="text-xs bg-indigo-600/20 text-indigo-400">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.full_name ?? 'Loading...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {user?.role ? USER_ROLE_LABELS[user.role] : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-8 w-8">
              {user?.avatar_url && (
                <AvatarImage src={user.avatar_url} alt={user?.full_name ?? 'User'} />
              )}
              <AvatarFallback className="text-xs bg-indigo-600/20 text-indigo-400">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="h-7 w-7 text-muted-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}

// ============================================================
// BREADCRUMBS
// ============================================================

function Breadcrumbs() {
  const pathname = usePathname()

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment, index, arr) => {
      const href = '/' + arr.slice(0, index + 1).join('/')
      // Format segment: guest-posts → Guest Posts
      const label = segment
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      // Check if it's a UUID (dynamic route segment like /citations/[id])
      const isUUID = /^[0-9a-f-]{36}$/i.test(segment)

      return { href, label: isUUID ? '...' : label }
    })

  if (segments.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      {segments.map((segment, index) => (
        <React.Fragment key={segment.href}>
          {index > 0 && (
            <ChevronRight
              className="h-3.5 w-3.5 text-muted-foreground/50"
              aria-hidden="true"
            />
          )}
          {index === segments.length - 1 ? (
            <span className="text-foreground font-medium" aria-current="page">
              {segment.label}
            </span>
          ) : (
            <Link
              href={segment.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {segment.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

// ============================================================
// MOBILE HEADER
// ============================================================

function MobileHeader({
  onMenuOpen,
}: {
  onMenuOpen: () => void
}) {
  return (
    <div className="flex items-center justify-between h-[var(--header-height)] px-4 border-b border-border bg-card md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 font-bold">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-600">
          <LayoutDashboard className="h-4 w-4 text-white" />
        </div>
        <span>SEO-OS</span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
        className="h-9 w-9"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </div>
  )
}

// ============================================================
// DASHBOARD LAYOUT
// ============================================================

/**
 * Dashboard layout — wraps all authenticated module pages.
 *
 * Features:
 * - Collapsible sidebar (240px ↔ 60px)
 * - Mobile navigation drawer
 * - Breadcrumb trail
 * - User profile in sidebar
 * - Role-based nav item visibility
 *
 * From DOC4 Section 3.1 — Sidebar Navigation
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ width: '240px' }}
      >
        <div className="relative h-full">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-10 top-3 z-10 h-8 w-8 text-white"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </Button>
          <Sidebar
            isCollapsed={false}
            onToggle={() => setIsMobileOpen(false)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <MobileHeader onMenuOpen={() => setIsMobileOpen(true)} />

        {/* Desktop Top Bar with breadcrumbs */}
        <header className="hidden md:flex items-center h-[var(--header-height)] px-6 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
          <Breadcrumbs />
        </header>

        {/* Main scrollable content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          tabIndex={-1}
        >
          <div className="p-[var(--page-padding)]">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
