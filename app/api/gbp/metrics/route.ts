export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { withErrorHandler, formatResponse, formatCreatedResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { GBPMetricCreateSchema } from '@/lib/utils/validation'
import { logCreate, logUpdate } from '@/lib/audit'
import { AppError, ErrorCode } from '@/lib/errors'

/**
 * GET /api/gbp/metrics
 * 
 * Lists GBP monthly metrics for a location (ordered by month DESC).
 * 
 * POST /api/gbp/metrics
 * 
 * Upserts a monthly metric log (one record per location per month).
 */

export const GET = withErrorHandler(async (req: Request) => {
  await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('location_id') || ''

  if (!locationId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'location_id is required', 400)
  }

  const { data, error } = await supabase
    .from('gbp_metrics')
    .select('*, creator:users(id, full_name)')
    .eq('location_id', locationId)
    .order('metric_month', { ascending: false })

  if (error) {
    throw error
  }

  return formatResponse(data || [])
})

export const POST = withErrorHandler(async (req: Request) => {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const body = await req.json()
  const validated = GBPMetricCreateSchema.parse(body)

  // 1. Check if a record already exists for this location + month (for audit logging)
  const { data: existingRecord } = await supabase
    .from('gbp_metrics')
    .select('*')
    .eq('location_id', validated.location_id)
    .eq('metric_month', validated.metric_month)
    .single()

  const metricData = {
    ...validated,
    created_by: user.id,
  }

  // 2. Perform upsert
  const { data, error } = await supabase
    .from('gbp_metrics')
    .upsert(metricData, { onConflict: 'location_id,metric_month' })
    .select('*, creator:users(id, full_name)')
    .single()

  if (error) {
    throw error
  }

  // 3. Log appropriate audit event
  if (existingRecord) {
    await logUpdate(user.id, 'gbp_metrics', data.id, existingRecord, data)
  } else {
    await logCreate(user.id, 'gbp_metrics', data.id, data)
  }

  return formatResponse(data)
})
