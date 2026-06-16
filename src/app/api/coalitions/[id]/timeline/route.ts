import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Event types ───────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'founded'
  | 'member_joined'
  | 'stance_declared'
  | 'post_published'
  | 'challenge_won'
  | 'challenge_lost'
  | 'challenge_issued'
  | 'influence_milestone'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string
  // Actor (member who triggered the event, if applicable)
  actorId?: string
  actorUsername?: string
  actorDisplayName?: string | null
  actorAvatarUrl?: string | null
  actorRole?: 'leader' | 'officer' | 'member'
  // Topic (for stances, challenges)
  topicId?: string
  topicStatement?: string
  topicCategory?: string | null
  // Challenge details
  opponentId?: string
  opponentName?: string
  stakeClout?: number
  // Stance details
  stance?: 'for' | 'against' | 'neutral'
  stanceStatement?: string | null
  // Post details
  postContent?: string | null
  isPinned?: boolean
  // Influence milestone details
  influenceValue?: number
}

export interface CoalitionTimelineResponse {
  coalition: {
    id: string
    name: string
    description: string | null
    createdAt: string
    wins: number
    losses: number
    influence: number
    memberCount: number
  }
  events: TimelineEvent[]
  isMember: boolean
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const coalitionId = params.id

  // ── Coalition info ──────────────────────────────────────────────────────────
  const { data: coalition, error: coalErr } = await supabase
    .from('coalitions')
    .select('id, name, description, created_at, wins, losses, coalition_influence, member_count, is_public, creator_id')
    .eq('id', coalitionId)
    .single()

  if (coalErr || !coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // ── Auth check ──────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  let isMember = false
  if (userId) {
    const { data: membership } = await supabase
      .from('coalition_members')
      .select('id')
      .eq('coalition_id', coalitionId)
      .eq('user_id', userId)
      .maybeSingle()
    isMember = !!membership
  }

  if (!coalition.is_public && !isMember) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // ── Fetch timeline data in parallel ────────────────────────────────────────
  const [membersRes, stancesRes, postsRes] = await Promise.all([
    // Members with profiles — limit to officers/leaders + recent joiners
    supabase
      .from('coalition_members')
      .select('user_id, role, joined_at, profiles:user_id (id, username, display_name, avatar_url)')
      .eq('coalition_id', coalitionId)
      .order('joined_at', { ascending: true })
      .limit(100),

    // Stances
    supabase
      .from('coalition_stances')
      .select('id, topic_id, stance, statement, created_at, declared_by, profiles:declared_by (id, username, display_name, avatar_url)')
      .eq('coalition_id', coalitionId)
      .order('created_at', { ascending: false })
      .limit(50),

    // Posts
    supabase
      .from('coalition_posts')
      .select('id, content, is_pinned, created_at, author_id, profiles:author_id (id, username, display_name, avatar_url)')
      .eq('coalition_id', coalitionId)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const members = membersRes.data ?? []
  const stances = stancesRes.data ?? []
  const posts = postsRes.data ?? []

  // ── Fetch topics for stances ────────────────────────────────────────────────
  const stanceTopicIds = [...new Set(stances.map((s) => s.topic_id))]
  const topicMap = new Map<string, { statement: string; category: string | null }>()
  if (stanceTopicIds.length > 0) {
    const { data: topicsData } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', stanceTopicIds)
    for (const t of topicsData ?? []) {
      topicMap.set(t.id, { statement: t.statement, category: t.category })
    }
  }

  // ── Fetch challenges (new table — graceful fallback) ────────────────────────
  type ChallengeRow = {
    id: string
    topic_id: string
    challenger_id: string
    challenged_id: string
    status: string
    winner_id: string | null
    stake_clout: number
    resolved_at: string | null
    created_at: string
    challenger: { name: string } | null
    challenged: { name: string } | null
  }
  let challenges: ChallengeRow[] = []
  try {
    // coalition_challenges was added in migration 00094; use `as any` to bypass
    // type-gen gap while keeping the rest of the file strictly typed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any
    const { data: challengeData } = await client
      .from('coalition_challenges')
      .select(
        'id, topic_id, challenger_id, challenged_id, status, winner_id, stake_clout, resolved_at, created_at, challenger:challenger_id(name), challenged:challenged_id(name)',
      )
      .or(`challenger_id.eq.${coalitionId},challenged_id.eq.${coalitionId}`)
      .in('status', ['resolved', 'accepted', 'pending'])
      .order('created_at', { ascending: false })
      .limit(30)
    challenges = challengeData ?? []
  } catch {
    // Table may not exist in older deployments — degrade gracefully
  }

  // ── Build events array ──────────────────────────────────────────────────────
  const events: TimelineEvent[] = []

  // 1. Founded event
  events.push({
    id: `founded-${coalition.id}`,
    type: 'founded',
    timestamp: coalition.created_at,
  })

  // 2. Member join events
  for (const m of members) {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    // Always include founders and officers; trim plain members on large coalitions
    const isFounder = profile?.id === coalition.creator_id
    if (!isFounder && m.role === 'member' && members.length > 20) continue

    events.push({
      id: `member-${m.user_id}`,
      type: 'member_joined',
      timestamp: m.joined_at,
      actorId: profile?.id,
      actorUsername: profile?.username,
      actorDisplayName: profile?.display_name ?? null,
      actorAvatarUrl: profile?.avatar_url ?? null,
      actorRole: m.role as 'leader' | 'officer' | 'member',
    })
  }

  // 3. Stance declarations
  for (const s of stances) {
    const topic = topicMap.get(s.topic_id)
    const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
    events.push({
      id: `stance-${s.id}`,
      type: 'stance_declared',
      timestamp: s.created_at,
      actorId: profile?.id,
      actorUsername: profile?.username,
      actorDisplayName: profile?.display_name ?? null,
      actorAvatarUrl: profile?.avatar_url ?? null,
      topicId: s.topic_id,
      topicStatement: topic?.statement,
      topicCategory: topic?.category ?? null,
      stance: s.stance as 'for' | 'against' | 'neutral',
      stanceStatement: s.statement ?? null,
    })
  }

  // 4. Posts
  for (const p of posts) {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
    events.push({
      id: `post-${p.id}`,
      type: 'post_published',
      timestamp: p.created_at,
      actorId: profile?.id,
      actorUsername: profile?.username,
      actorDisplayName: profile?.display_name ?? null,
      actorAvatarUrl: profile?.avatar_url ?? null,
      postContent: p.content,
      isPinned: p.is_pinned,
    })
  }

  // 5. Challenge events
  for (const c of challenges) {
    const isChallenger = c.challenger_id === coalitionId
    const opponent = isChallenger ? c.challenged : c.challenger
    const opponentId = isChallenger ? c.challenged_id : c.challenger_id

    if (c.status === 'resolved' && c.resolved_at) {
      const won = c.winner_id === coalitionId
      events.push({
        id: `challenge-resolve-${c.id}`,
        type: won ? 'challenge_won' : 'challenge_lost',
        timestamp: c.resolved_at,
        topicId: c.topic_id,
        opponentId,
        opponentName: opponent?.name ?? 'Unknown Coalition',
        stakeClout: c.stake_clout,
      })
    } else if (c.status === 'pending') {
      events.push({
        id: `challenge-issue-${c.id}`,
        type: 'challenge_issued',
        timestamp: c.created_at,
        topicId: c.topic_id,
        opponentId,
        opponentName: opponent?.name ?? 'Unknown Coalition',
        stakeClout: c.stake_clout,
      })
    }
  }

  // 6. Influence milestones (derived from current influence)
  const influence = Math.round(coalition.coalition_influence)
  const milestones = [1000, 500, 250, 100, 50]
  for (const milestone of milestones) {
    if (influence >= milestone) {
      // Approximate time based on coalition age (evenly distributed)
      const ageMs = Date.now() - new Date(coalition.created_at).getTime()
      const fraction = milestone / influence
      const milestoneDate = new Date(
        new Date(coalition.created_at).getTime() + ageMs * fraction,
      )
      events.push({
        id: `milestone-${milestone}`,
        type: 'influence_milestone',
        timestamp: milestoneDate.toISOString(),
        influenceValue: milestone,
      })
      break // only show the highest crossed milestone
    }
  }

  // ── Sort newest first ───────────────────────────────────────────────────────
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({
    coalition: {
      id: coalition.id,
      name: coalition.name,
      description: coalition.description,
      createdAt: coalition.created_at,
      wins: coalition.wins,
      losses: coalition.losses,
      influence: Math.round(coalition.coalition_influence),
      memberCount: coalition.member_count,
    },
    events,
    isMember,
  } satisfies CoalitionTimelineResponse)
}
