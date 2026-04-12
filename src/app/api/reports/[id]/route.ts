import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReportAction, ReportStatus } from '@/lib/supabase/types'

const MODERATOR_ROLES = ['troll_catcher', 'elder'] as const

function isReportAction(value: unknown): value is ReportAction {
  return (
    value === 'dismiss' ||
    value === 'warn' ||
    value === 'hide' ||
    value === 'escalate' ||
    value === 'ban'
  )
}

// Map moderator action → terminal status.
function actionToStatus(action: ReportAction): ReportStatus {
  switch (action) {
    case 'dismiss':
      return 'dismissed'
    case 'escalate':
      return 'escalated'
    case 'warn':
    case 'hide':
    case 'ban':
      return 'resolved'
  }
}

// PATCH /api/reports/[id]
// Body: { action, resolution_note? }
// Troll Catchers / Elders only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !profile ||
    !(MODERATOR_ROLES as readonly string[]).includes(profile.role)
  ) {
    return NextResponse.json(
      { error: 'Troll Catcher or Elder role required' },
      { status: 403 }
    )
  }

  let body: { action?: string; resolution_note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action
  const resolutionNote =
    typeof body.resolution_note === 'string'
      ? body.resolution_note.trim()
      : ''

  if (!isReportAction(action)) {
    return NextResponse.json(
      {
        error:
          'action must be one of: dismiss, warn, hide, escalate, ban',
      },
      { status: 400 }
    )
  }

  // Confirm the report exists and isn't already resolved.
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  if (
    report.status === 'resolved' ||
    report.status === 'dismissed' ||
    report.status === 'escalated'
  ) {
    return NextResponse.json(
      { error: 'Report has already been resolved' },
      { status: 400 }
    )
  }

  const nextStatus = actionToStatus(action)

  const { data: updated, error: updateError } = await supabase
    .from('reports')
    .update({
      status: nextStatus,
      action_taken: action,
      reviewer_id: user.id,
      resolution_note: resolutionNote || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Failed to update report' },
      { status: 500 }
    )
  }

  return NextResponse.json({ report: updated })
}
