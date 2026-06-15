import { NextResponse } from 'next/server'
import { AppError, ErrorCode } from '@/lib/errors'
import type { APIResponse, PaginatedResponse, PaginationMeta } from '@/lib/types'

// ============================================================
// TYPES
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: any }

type RouteHandler = (
  req: Request,
  context: RouteContext,
) => Promise<Response>

// ============================================================
// ERROR HANDLER WRAPPER
// ============================================================

/**
 * Wraps a Next.js API route handler with standardised error handling.
 *
 * Catches AppError instances and converts them to structured JSON responses.
 * All other errors become generic 500 responses — stack traces are NEVER
 * exposed to the client (DOC2 Section 12.2).
 *
 * Usage:
 * ```ts
 * export const GET = withErrorHandler(async (req, context) => {
 *   // your handler code
 * })
 * ```
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: Request, context: RouteContext) => {
    try {
      return await handler(req, context)
    } catch (error) {
      // Known application error — safe to return code and message to client
      if (error instanceof AppError) {
        console.error(`[AppError] ${error.code}: ${error.message}`, {
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
        })
        return NextResponse.json(error.toJSON(), { status: error.statusCode })
      }

      // Unknown / unhandled error — log internally, return generic message
      console.error('[UnhandledError]', error instanceof Error ? error.stack : error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'An unexpected error occurred. Please try again.',
          },
        },
        { status: 500 },
      )
    }
  }
}

// ============================================================
// RESPONSE FORMATTERS
// ============================================================

/**
 * Format a successful single-item API response.
 *
 * Returns: `{ success: true, data: T }`
 */
export function formatResponse<T>(
  data: T,
  status = 200,
): NextResponse<APIResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Format a paginated list API response.
 *
 * Returns: `{ success: true, data: T[], meta: { total, page, limit, total_pages } }`
 */
export function formatPaginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  status = 200,
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({ success: true, data, meta }, { status })
}

/**
 * Format a 201 Created response for new records.
 */
export function formatCreatedResponse<T>(data: T): NextResponse<APIResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: 201 })
}

/**
 * Format a 204 No Content response for deletes.
 */
export function formatDeletedResponse(): Response {
  return new Response(null, { status: 204 })
}

// ============================================================
// QUERY HELPERS
// ============================================================

/**
 * Parse common list query parameters from a URL.
 *
 * Handles: page, limit, sort_by, sort_order, search
 */
export function parseListParams(url: URL): {
  page: number
  limit: number
  offset: number
  search: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
} {
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)),
  )
  const offset = (page - 1) * limit
  const search = url.searchParams.get('search') ?? ''
  const sortBy = url.searchParams.get('sort_by') ?? 'created_at'
  const sortOrderRaw = url.searchParams.get('sort_order')
  const sortOrder: 'asc' | 'desc' =
    sortOrderRaw === 'asc' ? 'asc' : 'desc'

  return { page, limit, offset, search, sortBy, sortOrder }
}

/**
 * Build a PaginationMeta object from known total count, page, and limit.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  }
}
