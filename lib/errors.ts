/**
 * SEO-OS — Error Handling Classes and Codes
 *
 * From DOC2 Section 12.1 — Error Types
 */

// ============================================================
// ERROR CODES
// ============================================================

export enum ErrorCode {
  /** 401 — No valid session */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** 403 — Session valid but role insufficient */
  FORBIDDEN = 'FORBIDDEN',
  /** 404 — Record does not exist */
  NOT_FOUND = 'NOT_FOUND',
  /** 400 — Input failed Zod validation */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** 500 — Supabase query or write failed */
  DATABASE_ERROR = 'DATABASE_ERROR',
  /** 503 — Gemini API unavailable or rate limited */
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  /** 429 — Too many requests to AI or API */
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  /** 422 — CSV file could not be parsed or validated */
  IMPORT_ERROR = 'IMPORT_ERROR',
  /** 409 — Unique constraint or business rule conflict */
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  /** 500 — Catch-all for unexpected server errors */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ============================================================
// HTTP STATUS CODES MAPPED TO ERROR CODES
// ============================================================

export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.AI_SERVICE_ERROR]: 503,
  [ErrorCode.RATE_LIMIT_ERROR]: 429,
  [ErrorCode.IMPORT_ERROR]: 422,
  [ErrorCode.CONFLICT_ERROR]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
}

// ============================================================
// APP ERROR CLASS
// ============================================================

/**
 * Structured application error with code, message, HTTP status, and optional details.
 *
 * Thrown inside API route handlers and caught by withErrorHandler().
 * Never exposes stack traces or internal Supabase error messages to the client.
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details: unknown | undefined

  constructor(
    code: ErrorCode,
    message: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode ?? ERROR_STATUS_CODES[code] ?? 500
    this.details = details

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype)
  }

  /** Serialize to the standard API error response shape */
  toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
      },
    }
  }
}

// ============================================================
// COMMON ERROR FACTORY HELPERS
// ============================================================

export const Errors = {
  unauthorized: (message = 'Authentication required') =>
    new AppError(ErrorCode.UNAUTHORIZED, message),

  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(ErrorCode.FORBIDDEN, message),

  notFound: (entity = 'Record') =>
    new AppError(ErrorCode.NOT_FOUND, `${entity} not found`),

  validation: (message: string, details?: unknown) =>
    new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details),

  database: (message = 'A database error occurred') =>
    new AppError(ErrorCode.DATABASE_ERROR, message),

  aiService: (message = 'AI service is temporarily unavailable. Please try again.') =>
    new AppError(ErrorCode.AI_SERVICE_ERROR, message),

  rateLimit: (message = 'Too many requests. Please wait a moment.') =>
    new AppError(ErrorCode.RATE_LIMIT_ERROR, message),

  import: (message: string, details?: unknown) =>
    new AppError(ErrorCode.IMPORT_ERROR, message, 422, details),

  conflict: (message: string) =>
    new AppError(ErrorCode.CONFLICT_ERROR, message),

  internal: (message = 'An unexpected error occurred') =>
    new AppError(ErrorCode.INTERNAL_ERROR, message),
} as const
