export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { CitationCreateSchema } from '@/lib/utils/validation'
import { logCreate } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * POST /api/citations/import
 * 
 * Imports an array of citation records. Validates each row individually.
 * Inserts valid rows and records failed rows with explanation.
 * Partially successful imports are committed.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()

  if (!Array.isArray(body)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Request body must be an array of citations.', 400)
  }

  if (body.length > 500) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Import limit exceeded. Maximum 500 rows per batch.', 400)
  }

  const successRows: any[] = []
  const failedRows: { row: number; data: any; errors: string[] }[] = []

  // Step 1: Validate rows with Zod
  for (let i = 0; i < body.length; i++) {
    const row = body[i]
    try {
      // Pre-process DA and dates
      const preparedRow = {
        ...row,
        domain_authority: row.domain_authority !== undefined && row.domain_authority !== '' 
          ? Number(row.domain_authority) 
          : 0,
        status: row.status || 'pending',
        date_submitted: row.date_submitted || null,
        date_live: row.date_live || null,
        niche: row.niche || null,
        notes: row.notes || null,
      }

      const validated = CitationCreateSchema.parse(preparedRow)
      successRows.push({
        ...validated,
        created_by: user.id,
      })
    } catch (zodErr: any) {
      const messages = zodErr.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || [zodErr.message]
      failedRows.push({
        row: i + 1,
        data: row,
        errors: messages,
      })
    }
  }

  // Step 2: Insert valid rows one-by-one or in a batch with fallback
  let successInsertedCount = 0

  if (successRows.length > 0) {
    // Attempt bulk insertion
    const { data: inserted, error: insertError } = await supabase
      .from('citations')
      .insert(successRows)
      .select('id, directory_name')

    if (insertError) {
      // Fallback to one-by-one insert to pinpoint database-level failures (e.g. check constraints, duplicate urls)
      console.warn('[CitationsImport] Bulk insert failed, retrying row-by-row:', insertError.message)
      
      for (let j = 0; j < successRows.length; j++) {
        const rowData = successRows[j]
        const { data: singleIns, error: singleError } = await supabase
          .from('citations')
          .insert(rowData)
          .select('id')
          .single()

        if (singleError) {
          failedRows.push({
            row: body.findIndex(b => b.directory_name === rowData.directory_name && b.url === rowData.url) + 1,
            data: rowData,
            errors: [singleError.message],
          })
        } else {
          successInsertedCount++
          await logCreate(user.id, 'citations', singleIns.id, rowData)
        }
      }
    } else {
      successInsertedCount = inserted.length
      // Log audit for each inserted row
      for (const ins of (inserted || [])) {
        await logCreate(user.id, 'citations', ins.id, { id: ins.id, directory_name: ins.directory_name })
      }
    }
  }

  // Return import summary
  const summary = {
    successCount: successInsertedCount,
    failedCount: failedRows.length,
    totalProcessed: body.length,
    errors: failedRows,
  }

  return formatResponse(summary)
})
