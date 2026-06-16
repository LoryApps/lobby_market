import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalChallenge {
  id: string
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  challengerId: string
  challengerName: string
  challengerMemberCount: number
  challengedId: string
  challengedName: string
  challengedMemberCount: number
  issuedByUsername: string
  issuedByDisplayName: string | null
  issuedByAvatarUrl: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'resolved'
  challengerStance: 'for' | 'against' | 'neutral' | null
  challengedStance: 'for' | 'against' | 'neutral' | null
  message: string | null
  stakeClout: number
  winnerId: string | null
  winnerName: string | null
  expiresAt: string
  respondedAt: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface ClashesResponse {
  challenges: GlobalChallenge[]
  total: number
  hasMore: boolean
}

type StatusFilter = 'all' | 'active' | 'pending' | 'resolved' | 'expired'

// ─── GET /api/coalition-challenges — global view of all challenges ─────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const statusParam = (searchParams.get('status') ?? 'all') as StatusFilter
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
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
        name,
        member_count
      ),
      challenged:coalitions!coalition_challenges_challenged_id_fkey (
        id,
        name,
        member_count
      ),
      winner:coalitions!coalition_challenges_winner_id_fkey (
        id,
        name
      ),
      issuer:profiles!coalition_challenges_issued_by_fkey (
        username,
        display_name,
        avatar_url
      )
    `, { count: 'exact' })

  // Status filter
  if (statusParam === 'active') {
    query = query.eq('status', 'accepted')
  } else if (statusParam === 'pending') {
    query = query.eq('status', 'pending')
  } else if (statusParam === 'resolved') {
    query = query.eq('status', 'resolved')
  } else if (statusParam === 'expired') {
    query = query.in('status', ['expired', 'declined'])
  } else {
    // 'all' — show everything except declined/expired by default unless asking for 'all'
    query = query.in('status', ['pending', 'accepted', 'resolved'])
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data: rows, count, error } = await query

  if (error) {
    console.error('coalition-challenges GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }

  type RawRow = Record<string, unknown> & {
    id: string
    topic_id: string
    challenger_id: string
    challenged_id: string
    issued_by: string
    status: string
    challenger_stance: string | null
    challenged_stance: string | null
    message: string | null
    stake_clout: number
    winner_id: string | null
    expires_at: string
    responded_at: string | null
    resolved_at: string | null
    created_at: string
    topics?: { statement?: string; category?: string | null; status?: string } | null
    challenger?: { id?: string; name?: string; member_count?: number } | null
    challenged?: { id?: string; name?: string; member_count?: number } | null
    winner?: { id?: string; name?: string } | null
    issuer?: { username?: string; display_name?: string | null; avatar_url?: string | null } | null
  }

  const challenges: GlobalChallenge[] = (rows ?? []).map((r: RawRow) => ({
    id: r.id,
    topicId: r.topic_id,
    topicStatement: r.topics?.statement ?? '',
    topicCategory: r.topics?.category ?? null,
    topicStatus: r.topics?.status ?? '',
    challengerId: r.challenger_id,
    challengerName: r.challenger?.name ?? '',
    challengerMemberCount: r.challenger?.member_count ?? 0,
    challengedId: r.challenged_id,
    challengedName: r.challenged?.name ?? '',
    challengedMemberCount: r.challenged?.member_count ?? 0,
    issuedByUsername: r.issuer?.username ?? '',
    issuedByDisplayName: r.issuer?.display_name ?? null,
    issuedByAvatarUrl: r.issuer?.avatar_url ?? null,
    status: r.status as GlobalChallenge['status'],
    challengerStance: (r.challenger_stance as GlobalChallenge['challengerStance']) ?? null,
    challengedStance: (r.challenged_stance as GlobalChallenge['challengedStance']) ?? null,
    message: r.message ?? null,
    stakeClout: r.stake_clout ?? 0,
    winnerId: r.winner_id ?? null,
    winnerName: r.winner?.name ?? null,
    expiresAt: r.expires_at,
    respondedAt: r.responded_at ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
  }))

  const total = count ?? 0
  const hasMore = offset + challenges.length < total

  return NextResponse.json({ challenges, total, hasMore } satisfies ClashesResponse)
}
