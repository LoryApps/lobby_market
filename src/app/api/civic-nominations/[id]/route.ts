import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CivicRole, NominationStatus } from '@/app/api/civic-nominations/route'

export const dynamic = 'force-dynamic'

export interface NominationEndorser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  endorsed_at: string
}

export interface NominationDetail {
  id: string
  role: CivicRole
  reason: string
  endorsement_count: number
  endorsement_target: number
  status: NominationStatus
  closes_at: string
  created_at: string
  pct_complete: number
  user_has_endorsed: boolean
  user_is_nominee: boolean
  nominee: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    total_votes: number
    argument_count: number
    vote_streak: number
    created_at: string
  } | null
  nominator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  endorsers: NominationEndorser[]
}

/**
 * GET /api/civic-nominations/[id]
 * Returns full nomination detail including endorser list.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the nomination with full nominee + nominator profile
  const { data: nom, error } = await supabase
    .from('civic_nominations')
    .select(`
      id, role, reason, endorsement_count, endorsement_target,
      status, closes_at, created_at,
      nominee:nominee_id (
        id, username, display_name, avatar_url, role,
        clout, reputation_score, total_votes, argument_count, vote_streak, created_at
      ),
      nominator:nominator_id (
        id, username, display_name, avatar_url, role
      )
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (error || !nom) {
    return NextResponse.json({ error: 'Nomination not found' }, { status: 404 })
  }

  // Fetch endorsers (up to 50, ordered by most recent)
  const { data: endorserRows } = await supabase
    .from('civic_nomination_endorsements')
    .select(`
      created_at,
      user:user_id ( id, username, display_name, avatar_url, role, clout )
    `)
    .eq('nomination_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const endorsers: NominationEndorser[] = (endorserRows ?? [])
    .filter((r: { user: unknown }) => r.user)
    .map((r: { created_at: string; user: Record<string, unknown> }) => ({
      id: r.user.id as string,
      username: r.user.username as string,
      display_name: (r.user.display_name as string | null),
      avatar_url: (r.user.avatar_url as string | null),
      role: r.user.role as string,
      clout: r.user.clout as number,
      endorsed_at: r.created_at,
    }))

  // Check if current user has endorsed
  let userHasEndorsed = false
  if (user) {
    const { data: myEndorsement } = await supabase
      .from('civic_nomination_endorsements')
      .select('user_id')
      .eq('nomination_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    userHasEndorsed = !!myEndorsement
  }

  const nominee = nom.nominee as NominationDetail['nominee']
  const nominator = nom.nominator as NominationDetail['nominator']

  const detail: NominationDetail = {
    id: nom.id,
    role: nom.role as CivicRole,
    reason: nom.reason,
    endorsement_count: nom.endorsement_count,
    endorsement_target: nom.endorsement_target,
    status: nom.status as NominationStatus,
    closes_at: nom.closes_at,
    created_at: nom.created_at,
    pct_complete: nom.endorsement_target > 0
      ? Math.min(100, Math.round((nom.endorsement_count / nom.endorsement_target) * 100))
      : 0,
    user_has_endorsed: userHasEndorsed,
    user_is_nominee: user ? user.id === (nominee?.id ?? '') : false,
    nominee,
    nominator,
    endorsers,
  }

  return NextResponse.json(detail)
}
