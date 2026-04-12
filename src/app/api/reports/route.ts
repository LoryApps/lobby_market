import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Report, ReportStatus } from '@/lib/supabase/types'

const CONTENT_TYPES = [
  'topic',
  'message',
  'argument',
  'lobby',
  'continuation',
] as const
type ReportContentType = (typeof CONTENT_TYPES)[number]
const MODERATOR_ROLES = ['troll_catcher', 'elder'] as const

function isContentType(value: unknown): value is ReportContentType {
  return (
    typeof value === 'string' &&
    (CONTENT_TYPES as readonly string[]).includes(value)
  )
}

function isReportStatus(value: unknown): value is ReportStatus {
  return (
    value === 'pending' ||
    value === 'reviewing' ||
    value === 'resolved' ||
    value === 'dismissed' ||
    value === 'escalated'
  )
}

// GET /api/reports?status=pending
// Troll Catchers / Elders see the queue. Regular users only see reports
// they filed themselves (RLS enforces the same rule defensively).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status') ?? 'pending'
  const rawLimit = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 200)
    : 50

  if (!isReportStatus(statusParam)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

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

  const isModerator = !!(
    profile && (MODERATOR_ROLES as readonly string[]).includes(profile.role)
  )

  let query = supabase
    .from('reports')
    .select('*')
    .eq('status', statusParam)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Non-moderators can only see reports they filed (RLS would already enforce
  // this, but filtering upfront gives a cleaner empty state).
  if (!isModerator) {
    query = query.eq('reporter_id', user.id)
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load reports' },
      { status: 500 }
    )
  }

  const reports = (rows as Report[] | null) ?? []
  const reporterIds = Array.from(
    new Set(reports.map((r) => r.reporter_id))
  )
  let reporters: Record<string, unknown> = {}
  if (reporterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', reporterIds)
    reporters = (profiles ?? []).reduce(
      (acc, p) => ({ ...acc, [p.id]: p }),
      {} as Record<string, unknown>
    )
  }

  const enriched = reports.map((r) => ({
    ...r,
    reporter: reporters[r.reporter_id] ?? null,
  }))

  return NextResponse.json({ reports: enriched, is_moderator: isModerator })
}

// POST /api/reports
// File a new report.
// Body: { content_type, content_id, reason, description?, reported_user_id? }
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    content_type?: string
    content_id?: string
    reason?: string
    description?: string | null
    reported_user_id?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contentType = body.content_type
  const contentId =
    typeof body.content_id === 'string' ? body.content_id.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  const description =
    typeof body.description === 'string' ? body.description.trim() : ''
  const reportedUserId =
    typeof body.reported_user_id === 'string' &&
    body.reported_user_id.trim().length > 0
      ? body.reported_user_id.trim()
      : null

  if (!isContentType(contentType)) {
    return NextResponse.json(
      {
        error: `content_type must be one of: ${CONTENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    )
  }
  if (!contentId) {
    return NextResponse.json(
      { error: 'content_id is required' },
      { status: 400 }
    )
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      reported_content_type: contentType,
      reported_content_id: contentId,
      reason,
      description: description || null,
      reported_user_id: reportedUserId,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to file report' },
      { status: 500 }
    )
  }

  return NextResponse.json({ report: inserted }, { status: 201 })
}
