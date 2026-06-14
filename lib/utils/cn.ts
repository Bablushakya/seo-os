import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS class names intelligently.
 *
 * Uses clsx for conditional class joining and tailwind-merge
 * to resolve conflicts between Tailwind utility classes.
 *
 * @example
 * cn('px-4 py-2', condition && 'bg-blue-500', 'px-6')
 * // → 'py-2 bg-blue-500 px-6' (px-6 wins over px-4)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
