import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type CivicRole =
  | 'grand_council'
  | 'tribunal_judge'
  | 'fact_checker'
  | 'debate_moderator'
  | 'assembly_rapporteur'

export type NominationStatus = 'open' | 'elected' | 'declined' | 'expired'

export interface NominationEntry {
  id: string
  role: CivicRole
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
    total_votes: number
  } | null
  nominator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  user_has_endorsed: boolean
  pct_complete: number
}

export interface CivicNominationsResponse {
  nominations: NominationEntry[]
  total: number
}

/**
 * GET /api/civic-nominations
 * Query params:
 *   role    — filter by role (or 'all')
 *   status  — 'open' | 'elected' | 'expired' | 'all'  (default: 'open')
 *   limit   — number (default 30, max 100)
 *   offset  — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'open'
  const rawRole = searchParams.get('role') ?? 'all'
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '30')), 100)
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const VALID_STATUSES: NominationStatus[] = ['open', 'elected', 'declined', 'expired']
  const VALID_ROLES: CivicRole[] = [
    'grand_council', 'tribunal_judge', 'fact_checker',
    'debate_moderator', 'assembly_rapporteur',
  ]

  let query = supabase
    .from('civic_nominations')
    .select(
      `id, role, reason, endorsement_count, endorsement_target,
       status, closes_at, created_at,
       nominee:nominee_id ( id, username, display_name, avatar_url, role, clout, total_votes ),
       nominator:nominator_id ( id, username, display_name, avatar_url )`,
      { count: 'exact' }
    )
    .order('endorsement_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (rawStatus !== 'all' && VALID_STATUSES.includes(rawStatus as NominationStatus)) {
    query = query.eq('status', rawStatus)
  }
  if (rawRole !== 'all' && VALID_ROLES.includes(rawRole as CivicRole)) {
    query = query.eq('role', rawRole)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch which nominations the current user has endorsed
  let endorsedSet = new Set<string>()
  if (user && data && data.length > 0) {
    const ids = data.map((n: { id: string }) => n.id)
    const { data: endorsements } = await supabase
      .from('civic_nomination_endorsements')
      .select('nomination_id')
      .eq('user_id', user.id)
      .in('nomination_id', ids)
    endorsedSet = new Set((endorsements ?? []).map((e: { nomination_id: string }) => e.nomination_id))
  }

  const nominations: NominationEntry[] = (data ?? []).map((n: {
    id: string
    role: CivicRole
    reason: string
    endorsement_count: number
    endorsement_target: number
    status: NominationStatus
    closes_at: string
    created_at: string
    nominee: NominationEntry['nominee']
    nominator: NominationEntry['nominator']
  }) => ({
    ...n,
    user_has_endorsed: endorsedSet.has(n.id),
    pct_complete: Math.min(100, Math.round((n.endorsement_count / n.endorsement_target) * 100)),
  }))

  return NextResponse.json({ nominations, total: count ?? 0 } as CivicNominationsResponse)
}

/**
 * POST /api/civic-nominations
 * Body: { role, nominee_id, reason }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: { role?: string; nominee_id?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { role, nominee_id, reason } = body

  const VALID_ROLES: CivicRole[] = [
    'grand_council', 'tribunal_judge', 'fact_checker',
    'debate_moderator', 'assembly_rapporteur',
  ]

  if (!role || !VALID_ROLES.includes(role as CivicRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (!nominee_id) {
    return NextResponse.json({ error: 'nominee_id is required' }, { status: 400 })
  }
  if (!reason || reason.length < 20 || reason.length > 1000) {
    return NextResponse.json({ error: 'Reason must be between 20 and 1000 characters' }, { status: 400 })
  }
  if (nominee_id === user.id) {
    return NextResponse.json({ error: 'You cannot nominate yourself' }, { status: 400 })
  }

  // Check for existing open nomination
  const { data: existing } = await supabase
    .from('civic_nominations')
    .select('id')
    .eq('nominee_id', nominee_id)
    .eq('role', role)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This citizen already has an open nomination for this role' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('civic_nominations')
    .insert({
      role,
      nominee_id,
      nominator_id: user.id,
      reason,
      endorsement_target: 10,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
