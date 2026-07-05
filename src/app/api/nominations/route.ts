import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type NominationRole =
  | 'grand_council'
  | 'tribunal_judge'
  | 'fact_checker'
  | 'debate_moderator'
  | 'assembly_rapporteur'

export type NominationStatus = 'open' | 'elected' | 'declined' | 'expired'

export interface NominationEntry {
  id: string
  role: NominationRole
  nominee_id: string
  nominator_id: string | null
  reason: string
  endorsement_count: number
  endorsement_target: number
  status: NominationStatus
  closes_at: string
  created_at: string
  nominee: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
  } | null
  nominator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  user_has_endorsed: boolean
}

export interface NominationsResponse {
  nominations: NominationEntry[]
  total: number
}

/**
 * GET /api/nominations
 * Query params:
 *   role   — filter by role
 *   status — 'open' | 'elected' | 'all'  (default: 'open')
 *   limit  — number (default 40, max 100)
 *   offset — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'open'
  const rawRole = searchParams.get('role') ?? null
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '40'), 100)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 40
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_nominations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const VALID_STATUSES: NominationStatus[] = ['open', 'elected', 'declined', 'expired']
  if (rawStatus !== 'all' && VALID_STATUSES.includes(rawStatus as NominationStatus)) {
    query = query.eq('status', rawStatus)
  }

  const VALID_ROLES: NominationRole[] = [
    'grand_council', 'tribunal_judge', 'fact_checker', 'debate_moderator', 'assembly_rapporteur',
  ]
  if (rawRole && VALID_ROLES.includes(rawRole as NominationRole)) {
    query = query.eq('role', rawRole)
  }

  const { data: rows, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ nominations: [], total: count ?? 0 })
  }

  const nomineeIds = Array.from(new Set(rows.map((r) => r.nominee_id)))
  const nominatorIds = Array.from(
    new Set(rows.map((r) => r.nominator_id).filter(Boolean))
  ) as string[]

  const [nomineeRes, nominatorRes, endorseRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', nomineeIds),
    nominatorIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', nominatorIds)
      : Promise.resolve({ data: [], error: null }),
    user
      ? supabase
          .from('civic_nomination_endorsements')
          .select('nomination_id')
          .in('nomination_id', rows.map((r) => r.id))
          .eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
  ])

  const nomineeMap = new Map((nomineeRes.data ?? []).map((p) => [p.id, p]))
  const nominatorMap = new Map((nominatorRes.data ?? []).map((p) => [p.id, p]))
  const endorsedIds = new Set((endorseRes.data ?? []).map((e) => e.nomination_id))

  const nominations: NominationEntry[] = rows.map((row) => ({
    id: row.id,
    role: row.role as NominationRole,
    nominee_id: row.nominee_id,
    nominator_id: row.nominator_id,
    reason: row.reason,
    endorsement_count: row.endorsement_count,
    endorsement_target: row.endorsement_target,
    status: row.status as NominationStatus,
    closes_at: row.closes_at,
    created_at: row.created_at,
    nominee: nomineeMap.get(row.nominee_id) ?? null,
    nominator: row.nominator_id ? (nominatorMap.get(row.nominator_id) ?? null) : null,
    user_has_endorsed: endorsedIds.has(row.id),
  }))

  return NextResponse.json({ nominations, total: count ?? 0 })
}

/**
 * POST /api/nominations
 * Body: { nominee_id, role, reason }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { nominee_id, role, reason } = body as Record<string, string>

  if (!nominee_id || !role || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const VALID_ROLES: NominationRole[] = [
    'grand_council', 'tribunal_judge', 'fact_checker', 'debate_moderator', 'assembly_rapporteur',
  ]
  if (!VALID_ROLES.includes(role as NominationRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: nomination, error } = await supabase
    .from('civic_nominations')
    .insert({
      role,
      nominee_id,
      nominator_id: user.id,
      reason: reason.trim(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ nomination }, { status: 201 })
}
