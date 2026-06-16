import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClashArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  aiScore: number | null
  aiGrade: string | null
  createdAt: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  coalitionId: string
  coalitionName: string
  sourceUrl: string | null
}

export interface CoalitionSide {
  id: string
  name: string
  memberCount: number
  influence: number
  wins: number
  losses: number
  stance: 'for' | 'against' | 'neutral' | null
  participantCount: number
  totalArguments: number
  topArguments: ClashArgument[]
}

export interface ClashDetail {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'resolved'
  message: string | null
  stakeClout: number
  winnerId: string | null
  winnerName: string | null
  expiresAt: string
  respondedAt: string | null
  resolvedAt: string | null
  createdAt: string
  issuedBy: {
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
  topic: {
    id: string
    statement: string
    fullStatement: string | null
    category: string | null
    status: string
    totalVotes: number
    bluePct: number
    resolvedSide: 'blue' | 'red' | null
  }
  challenger: CoalitionSide
  challenged: CoalitionSide
}

// ─── GET /api/coalitions/clashes/[id] ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const challengeId = params.id

  const { data: row, error } = await supabase
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
        full_statement,
        category,
        status,
        total_votes,
        blue_pct,
        resolved_side
      ),
      challenger:coalitions!coalition_challenges_challenger_id_fkey (
        id,
        name,
        member_count,
        coalition_influence,
        wins,
        losses
      ),
      challenged:coalitions!coalition_challenges_challenged_id_fkey (
        id,
        name,
        member_count,
        coalition_influence,
        wins,
        losses
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
    `)
    .eq('id', challengeId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: 'Clash not found' }, { status: 404 })
  }

  type RawRow = typeof row & {
    topics?: {
      id?: string; statement?: string; full_statement?: string | null;
      category?: string | null; status?: string; total_votes?: number;
      blue_pct?: number; resolved_side?: string | null
    } | null
    challenger?: {
      id?: string; name?: string; member_count?: number;
      coalition_influence?: number; wins?: number; losses?: number
    } | null
    challenged?: {
      id?: string; name?: string; member_count?: number;
      coalition_influence?: number; wins?: number; losses?: number
    } | null
    winner?: { id?: string; name?: string } | null
    issuer?: { username?: string; display_name?: string | null; avatar_url?: string | null } | null
  }

  const r = row as RawRow
  const topicId = r.topic_id
  const challengerId = r.challenger_id
  const challengedId = r.challenged_id

  // Fetch arguments from coalition members on this topic
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      ai_score,
      ai_grade,
      source_url,
      created_at,
      user_id,
      profiles!topic_arguments_user_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(100)

  // Fetch coalition member user IDs for both coalitions
  const { data: memberRows } = await supabase
    .from('coalition_members')
    .select('user_id, coalition_id')
    .in('coalition_id', [challengerId, challengedId])

  const challengerMemberIds = new Set(
    (memberRows ?? []).filter(m => m.coalition_id === challengerId).map(m => m.user_id)
  )
  const challengedMemberIds = new Set(
    (memberRows ?? []).filter(m => m.coalition_id === challengedId).map(m => m.user_id)
  )

  type ArgRow = {
    id: string; content: string; side: 'blue' | 'red'; upvotes: number;
    ai_score: number | null; ai_grade: string | null; source_url: string | null;
    created_at: string; user_id: string;
    profiles?: { username?: string; display_name?: string | null; avatar_url?: string | null } | null
  }

  const allArgs: ClashArgument[] = []

  for (const a of (argRows ?? []) as ArgRow[]) {
    let coalitionId: string | null = null
    let coalitionName: string | null = null

    if (challengerMemberIds.has(a.user_id)) {
      coalitionId = challengerId
      coalitionName = r.challenger?.name ?? ''
    } else if (challengedMemberIds.has(a.user_id)) {
      coalitionId = challengedId
      coalitionName = r.challenged?.name ?? ''
    }

    if (!coalitionId) continue

    allArgs.push({
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes,
      aiScore: a.ai_score ?? null,
      aiGrade: a.ai_grade ?? null,
      sourceUrl: a.source_url ?? null,
      createdAt: a.created_at,
      username: a.profiles?.username ?? '',
      displayName: a.profiles?.display_name ?? null,
      avatarUrl: a.profiles?.avatar_url ?? null,
      coalitionId,
      coalitionName,
    })
  }

  const challengerArgs = allArgs.filter(a => a.coalitionId === challengerId).slice(0, 5)
  const challengedArgs = allArgs.filter(a => a.coalitionId === challengedId).slice(0, 5)

  const uniqueChallengers = new Set(allArgs.filter(a => a.coalitionId === challengerId).map(a => a.username))
  const uniqueChallenged = new Set(allArgs.filter(a => a.coalitionId === challengedId).map(a => a.username))

  const detail: ClashDetail = {
    id: r.id,
    status: r.status as ClashDetail['status'],
    message: r.message ?? null,
    stakeClout: r.stake_clout ?? 0,
    winnerId: r.winner_id ?? null,
    winnerName: r.winner?.name ?? null,
    expiresAt: r.expires_at,
    respondedAt: r.responded_at ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
    issuedBy: {
      username: r.issuer?.username ?? '',
      displayName: r.issuer?.display_name ?? null,
      avatarUrl: r.issuer?.avatar_url ?? null,
    },
    topic: {
      id: r.topics?.id ?? topicId,
      statement: r.topics?.statement ?? '',
      fullStatement: r.topics?.full_statement ?? null,
      category: r.topics?.category ?? null,
      status: r.topics?.status ?? '',
      totalVotes: r.topics?.total_votes ?? 0,
      bluePct: r.topics?.blue_pct ?? 50,
      resolvedSide: (r.topics?.resolved_side as 'blue' | 'red' | null) ?? null,
    },
    challenger: {
      id: challengerId,
      name: r.challenger?.name ?? '',
      memberCount: r.challenger?.member_count ?? 0,
      influence: r.challenger?.coalition_influence ?? 0,
      wins: r.challenger?.wins ?? 0,
      losses: r.challenger?.losses ?? 0,
      stance: (r.challenger_stance as 'for' | 'against' | 'neutral' | null) ?? null,
      participantCount: uniqueChallengers.size,
      totalArguments: allArgs.filter(a => a.coalitionId === challengerId).length,
      topArguments: challengerArgs,
    },
    challenged: {
      id: challengedId,
      name: r.challenged?.name ?? '',
      memberCount: r.challenged?.member_count ?? 0,
      influence: r.challenged?.coalition_influence ?? 0,
      wins: r.challenged?.wins ?? 0,
      losses: r.challenged?.losses ?? 0,
      stance: (r.challenged_stance as 'for' | 'against' | 'neutral' | null) ?? null,
      participantCount: uniqueChallenged.size,
      totalArguments: allArgs.filter(a => a.coalitionId === challengedId).length,
      topArguments: challengedArgs,
    },
  }

  return NextResponse.json(detail)
}
