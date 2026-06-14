import {
  format,
  formatDistanceToNow,
  parseISO,
  isPast,
  isToday,
  isTomorrow,
  isThisWeek,
  startOfDay,
  differenceInDays,
  isValid,
} from 'date-fns'
import { DATE_FORMATS } from '@/lib/constants'

// ============================================================
// PARSING HELPERS
// ============================================================

/**
 * Safely parse a date string to a Date object.
 * Accepts ISO strings (YYYY-MM-DD or full ISO-8601).
 * Returns null if invalid.
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const parsed = parseISO(dateStr)
  return isValid(parsed) ? parsed : null
}

// ============================================================
// FORMAT FUNCTIONS
// ============================================================

/**
 * Format a date string for display in the UI.
 *
 * @example
 * formatDate('2026-01-15') → 'Jan 15, 2026'
 * formatDate(null)         → '—'
 */
export function formatDate(
  dateStr: string | null | undefined,
  pattern: string = DATE_FORMATS.DISPLAY,
): string {
  const date = parseDate(dateStr)
  if (!date) return '—'
  return format(date, pattern)
}

/**
 * Format a date string to show only month and year.
 *
 * @example
 * formatMonthYear('2026-01-15') → 'Jan 2026'
 */
export function formatMonthYear(dateStr: string | null | undefined): string {
  return formatDate(dateStr, DATE_FORMATS.MONTH_SHORT)
}

/**
 * Format a full ISO timestamp for display.
 *
 * @example
 * formatDateTime('2026-01-15T14:30:00Z') → 'Jan 15, 2026, 2:30 PM'
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  const date = parseDate(dateStr)
  if (!date) return '—'
  return format(date, "MMM d, yyyy, h:mm a")
}

/**
 * Format a date as a relative human-readable string.
 *
 * Returns smart labels for common cases (Today, Tomorrow, This week)
 * then falls back to date-fns `formatDistanceToNow`.
 *
 * @example
 * formatRelativeDate('2026-06-14') → 'Today'
 * formatRelativeDate('2026-06-15') → 'Tomorrow'
 * formatRelativeDate('2026-06-10') → '4 days ago'
 * formatRelativeDate('2025-01-01') → 'about 1 year ago'
 */
export function formatRelativeDate(dateStr: string | null | undefined): string {
  const date = parseDate(dateStr)
  if (!date) return '—'

  const dayStart = startOfDay(date)

  if (isToday(dayStart)) return 'Today'
  if (isTomorrow(dayStart)) return 'Tomorrow'
  if (isThisWeek(dayStart) && !isPast(dayStart)) {
    return format(dayStart, 'EEEE') // e.g. "Wednesday"
  }

  return formatDistanceToNow(date, { addSuffix: true })
}

/**
 * Format a due date with urgency context.
 *
 * Returns colour-coded label for overdue / due today / upcoming.
 */
export function formatDueDate(dateStr: string | null | undefined): {
  label: string
  isOverdue: boolean
  isDueToday: boolean
  daysOverdue: number
} {
  const date = parseDate(dateStr)

  if (!date) {
    return { label: 'No due date', isOverdue: false, isDueToday: false, daysOverdue: 0 }
  }

  const dayStart = startOfDay(date)
  const todayStart = startOfDay(new Date())
  const isOverdueFlag = isPast(dayStart) && !isToday(dayStart)
  const isDueTodayFlag = isToday(dayStart)
  const daysOver = isOverdueFlag
    ? differenceInDays(todayStart, dayStart)
    : 0

  let label: string
  if (isOverdueFlag) {
    label = `${daysOver}d overdue`
  } else if (isDueTodayFlag) {
    label = 'Due today'
  } else {
    label = formatDate(dateStr, DATE_FORMATS.DISPLAY_SHORT)
  }

  return {
    label,
    isOverdue: isOverdueFlag,
    isDueToday: isDueTodayFlag,
    daysOverdue: daysOver,
  }
}

// ============================================================
// DATE CHECKS
// ============================================================

/**
 * Returns true if the given date string is in the past (strictly before today).
 *
 * @example
 * isOverdue('2026-01-01') → true (if today is after Jan 1)
 * isOverdue('2099-01-01') → false
 * isOverdue(null)         → false
 */
export function isOverdue(dateStr: string | null | undefined): boolean {
  const date = parseDate(dateStr)
  if (!date) return false
  const dayStart = startOfDay(date)
  return isPast(dayStart) && !isToday(dayStart)
}

/**
 * Returns true if the given date is today.
 */
export function isDueToday(dateStr: string | null | undefined): boolean {
  const date = parseDate(dateStr)
  if (!date) return false
  return isToday(date)
}

/**
 * Returns true if the given date is in the future (after today).
 */
export function isFuture(dateStr: string | null | undefined): boolean {
  const date = parseDate(dateStr)
  if (!date) return false
  return !isPast(startOfDay(date))
}

// ============================================================
// RANGE HELPERS
// ============================================================

/**
 * Get the ISO date string for the first day of the current month.
 * Used for GBP metrics grouping.
 */
export function currentMonthStart(): string {
  const now = new Date()
  return format(new Date(now.getFullYear(), now.getMonth(), 1), DATE_FORMATS.ISO)
}

/**
 * Get the ISO date strings for the start and end of the current week
 * (Monday to Sunday).
 */
export function currentWeekRange(): { start: string; end: string } {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysFromMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    start: format(monday, DATE_FORMATS.ISO),
    end: format(sunday, DATE_FORMATS.ISO),
  }
}

/**
 * Format a date range as a human-readable string.
 *
 * @example
 * formatDateRange('2026-06-09', '2026-06-15') → 'Jun 9–15, 2026'
 */
export function formatDateRange(start: string, end: string): string {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return '—'

  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const sameMonth = startDate.getMonth() === endDate.getMonth()

  if (sameYear && sameMonth) {
    return `${format(startDate, 'MMM d')}–${format(endDate, 'd, yyyy')}`
  }
  if (sameYear) {
    return `${format(startDate, 'MMM d')}–${format(endDate, 'MMM d, yyyy')}`
  }
  return `${format(startDate, 'MMM d, yyyy')} – ${format(endDate, 'MMM d, yyyy')}`
}
