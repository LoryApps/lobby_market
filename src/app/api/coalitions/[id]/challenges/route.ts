import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChallengeWithDetails {
  id: string
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  challengerId: string
  challengerName: string
  challengedId: string
  challengedName: string
  issuedByUsername: string
  issuedByDisplayName: string | null
  issuedByAvatarUrl: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'resolved'
  challengerStance: 'for' | 'against' | 'neutral' | null
  challengedStance: 'for' | 'against' | 'neutral' | null
  message: string | null
  stakeClout: number
  winnerId: string | null
  expiresAt: string
  respondedAt: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface ChallengesResponse {
  coalition: {
    id: string
    name: string
  }
  currentUserRole: 'leader' | 'officer' | 'member' | null
  sent: ChallengeWithDetails[]
  received: ChallengeWithDetails[]
  history: ChallengeWithDetails[]
}

// ─── GET /api/coalitions/[id]/challenges ─────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const { data: { user } } = await supabase.auth.getUser()

  // Load coalition basics
  const { data: coalition } = await supabase
    .from('coalitions')
    .select('id, name')
    .eq('id', coalitionId)
    .maybeSingle()

  if (!coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // Current user's role
  let currentUserRole: 'leader' | 'officer' | 'member' | null = null
  if (user) {
    const { data: membership } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', coalitionId)
      .eq('user_id', user.id)
      .maybeSingle()
    currentUserRole = (membership?.role as typeof currentUserRole) ?? null
  }

  // Fetch all challenges for this coalition
  const { data: rows } = await supabase
    .from('coalition_challenges')
    .select(`
      id,
      topic_id,
      challenger_id,
      challenged_id,
      issued_by,
      status,
      challenger_stance,
      challenged_stance,
      message,
      stake_clout,
      winner_id,
      expires_at,
      responded_at,
      resolved_at,
      created_at,
      topics!coalition_challenges_topic_id_fkey (
        id,
        statement,
        category,
        status
      ),
      challenger:coalitions!coalition_challenges_challenger_id_fkey (
        id,
        name
      ),
      challenged:coalitions!coalition_challenges_challenged_id_fkey (
        id,
        name
      ),
      issuer:profiles!coalition_challenges_issued_by_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .or(`challenger_id.eq.${coalitionId},challenged_id.eq.${coalitionId}`)
    .order('created_at', { ascending: false })
    .limit(100)

  type RawRow = Record<string, unknown> & {
    id: string; topic_id: string; challenger_id: string; challenged_id: string;
    issued_by: string; status: string; challenger_stance: string | null;
    challenged_stance: string | null; message: string | null; stake_clout: number;
    winner_id: string | null; expires_at: string; responded_at: string | null;
    resolved_at: string | null; created_at: string;
    topics?: { statement?: string; category?: string | null; status?: string } | null;
    challenger?: { name?: string } | null;
    challenged?: { name?: string } | null;
    issuer?: { username?: string; display_name?: string | null; avatar_url?: string | null } | null;
  }
  const mapped: ChallengeWithDetails[] = (rows ?? []).map((r: RawRow) => ({
    id: r.id,
    topicId: r.topic_id,
    topicStatement: r.topics?.statement ?? '',
    topicCategory: r.topics?.category ?? null,
    topicStatus: r.topics?.status ?? '',
    challengerId: r.challenger_id,
    challengerName: r.challenger?.name ?? '',
    challengedId: r.challenged_id,
    challengedName: r.challenged?.name ?? '',
    issuedByUsername: r.issuer?.username ?? '',
    issuedByDisplayName: r.issuer?.display_name ?? null,
    issuedByAvatarUrl: r.issuer?.avatar_url ?? null,
    status: r.status,
    challengerStance: r.challenger_stance ?? null,
    challengedStance: r.challenged_stance ?? null,
    message: r.message ?? null,
    stakeClout: r.stake_clout ?? 0,
    winnerId: r.winner_id ?? null,
    expiresAt: r.expires_at,
    respondedAt: r.responded_at ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
  }))

  const sent = mapped.filter(
    (c) => c.challengerId === coalitionId && ['pending', 'accepted'].includes(c.status)
  )
  const received = mapped.filter(
    (c) => c.challengedId === coalitionId && c.status === 'pending'
  )
  const history = mapped.filter(
    (c) => ['declined', 'expired', 'resolved', 'accepted'].includes(c.status)
      && !(c.challengerId === coalitionId && c.status === 'accepted')
      && !(c.challengedId === coalitionId && c.status === 'pending')
  )

  return NextResponse.json({
    coalition: { id: coalition.id, name: coalition.name },
    currentUserRole,
    sent,
    received,
    history,
  } satisfies ChallengesResponse)
}

// ─── POST /api/coalitions/[id]/challenges — issue a challenge ────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const challengerId = params.id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is leader/officer of the challenger coalition
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', challengerId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json({ error: 'Must be a leader or officer to issue challenges' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { topicId, challengedId, stance, message, stakeClout = 0 } = body

  if (!topicId || !challengedId || !stance) {
    return NextResponse.json({ error: 'topicId, challengedId, and stance are required' }, { status: 400 })
  }

  if (!['for', 'against', 'neutral'].includes(stance)) {
    return NextResponse.json({ error: 'stance must be for, against, or neutral' }, { status: 400 })
  }

  if (challengedId === challengerId) {
    return NextResponse.json({ error: 'Cannot challenge your own coalition' }, { status: 400 })
  }

  // Verify topic exists and is active
  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  if (!['proposed', 'active'].includes(topic.status)) {
    return NextResponse.json({ error: 'Can only challenge on active or proposed topics' }, { status: 400 })
  }

  // Insert challenge
  const { data: challenge, error } = await supabase
    .from('coalition_challenges')
    .insert({
      topic_id: topicId,
      challenger_id: challengerId,
      challenged_id: challengedId,
      issued_by: user.id,
      challenger_stance: stance,
      message: message?.slice(0, 500) || null,
      stake_clout: Math.max(0, Math.floor(stakeClout)),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === 'P0001' || error.message?.includes('unique')) {
      return NextResponse.json({ error: 'A challenge already exists between these coalitions on this topic' }, { status: 409 })
    }
    console.error('Coalition challenge insert error:', error)
    return NextResponse.json({ error: 'Failed to issue challenge' }, { status: 500 })
  }

  return NextResponse.json({ challengeId: challenge.id }, { status: 201 })
}
