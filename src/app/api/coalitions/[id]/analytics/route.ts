import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ────────────────────────────────────────────────────────────

export interface StanceAlignment {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  stance: 'for' | 'against' | 'neutral'
  stanceStatement: string | null
  alignedVotes: number
  opposedVotes: number
  abstainedMembers: number
  totalMembers: number
  alignmentPct: number
}

export interface CategoryBreakdown {
  category: string
  voteCount: number
  forCount: number
  againstCount: number
  forPct: number
}

export interface TopMember {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  reputationScore: number
  clout: number
  coalitionRole: 'leader' | 'officer' | 'member'
}

export interface CoalitionAnalyticsResponse {
  coalition: {
    id: string
    name: string
    description: string | null
    memberCount: number
    maxMembers: number
    wins: number
    losses: number
    influence: number
  }
  stanceAlignments: StanceAlignment[]
  categoryBreakdown: CategoryBreakdown[]
  topMembers: TopMember[]
  overallAlignmentPct: number | null
  totalMemberVotes: number
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
  const { data: coalitionRaw, error: coalErr } = await supabase
    .from('coalitions')
    .select(
      'id, name, description, member_count, max_members, wins, losses, coalition_influence, is_public',
    )
    .eq('id', coalitionId)
    .single()

  if (coalErr || !coalitionRaw) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // Only public coalitions or members can view analytics
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  if (!coalitionRaw.is_public && !isMember) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // ── Fetch member IDs ────────────────────────────────────────────────────────
  const { data: memberRows } = await supabase
    .from('coalition_members')
    .select('user_id, role')
    .eq('coalition_id', coalitionId)

  const memberIds = (memberRows ?? []).map((m) => m.user_id)
  const memberRoleMap = new Map<string, 'leader' | 'officer' | 'member'>(
    (memberRows ?? []).map((m) => [m.user_id, m.role as 'leader' | 'officer' | 'member']),
  )

  if (memberIds.length === 0) {
    const coalition = coalitionRaw
    return NextResponse.json({
      coalition: {
        id: coalition.id,
        name: coalition.name,
        description: coalition.description,
        memberCount: coalition.member_count,
        maxMembers: coalition.max_members,
        wins: coalition.wins,
        losses: coalition.losses,
        influence: Math.round(coalition.coalition_influence),
      },
      stanceAlignments: [],
      categoryBreakdown: [],
      topMembers: [],
      overallAlignmentPct: null,
      totalMemberVotes: 0,
      isMember,
    } satisfies CoalitionAnalyticsResponse)
  }

  // ── Fetch all three data sources in parallel ────────────────────────────────
  const [stancesRes, memberVotesRes, memberProfilesRes] = await Promise.all([
    // Coalition stances (fetch topics separately to avoid TS join issues)
    supabase
      .from('coalition_stances')
      .select('id, topic_id, stance, statement')
      .eq('coalition_id', coalitionId)
      .order('created_at', { ascending: false })
      .limit(20),

    // All votes cast by coalition members in the last 6 months
    memberIds.length > 0
      ? supabase
          .from('votes')
          .select('user_id, topic_id, side, created_at')
          .in('user_id', memberIds)
          .gte(
            'created_at',
            new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .limit(10000)
      : Promise.resolve({ data: null }),

    // Top members by reputation
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, clout')
      .in('id', memberIds)
      .order('reputation_score', { ascending: false })
      .limit(5),
  ])

  const stances = stancesRes.data ?? []
  const memberVotes = memberVotesRes.data ?? []
  const memberProfiles = memberProfilesRes.data ?? []

  // ── Fetch topics for stances ────────────────────────────────────────────────
  const stanceTopicIds = stances.map((s) => s.topic_id)
  let topicInfoMap = new Map<string, { statement: string; category: string | null; status: string }>()

  if (stanceTopicIds.length > 0) {
    const { data: topicsForStances } = await supabase
      .from('topics')
      .select('id, statement, category, status')
      .in('id', stanceTopicIds)

    if (topicsForStances) {
      topicInfoMap = new Map(
        topicsForStances.map((t) => [t.id, { statement: t.statement, category: t.category, status: t.status }]),
      )
    }
  }

  // ── Stance alignment calculation ────────────────────────────────────────────
  // Build a vote lookup: topic_id → { userId → side ('blue'=for, 'red'=against) }
  const voteByTopic = new Map<string, Map<string, 'blue' | 'red'>>()
  for (const v of memberVotes) {
    if (!voteByTopic.has(v.topic_id)) voteByTopic.set(v.topic_id, new Map())
    voteByTopic.get(v.topic_id)!.set(v.user_id, v.side as 'blue' | 'red')
  }

  const stanceAlignments: StanceAlignment[] = []
  let totalAligned = 0
  let totalOpposed = 0

  for (const s of stances) {
    const topic = topicInfoMap.get(s.topic_id) ?? null
    if (!topic || s.stance === 'neutral') continue

    const topicVotes = voteByTopic.get(s.topic_id) ?? new Map()
    let aligned = 0
    let opposed = 0
    let abstained = 0

    for (const memberId of memberIds) {
      const vote = topicVotes.get(memberId)
      if (!vote) {
        abstained++
      } else if ((s.stance === 'for' && vote === 'blue') || (s.stance === 'against' && vote === 'red')) {
        aligned++
      } else {
        opposed++
      }
    }

    const voted = aligned + opposed
    const alignmentPct = voted > 0 ? Math.round((aligned / voted) * 100) : 0

    totalAligned += aligned
    totalOpposed += opposed

    stanceAlignments.push({
      topicId: s.topic_id,
      topicStatement: topic.statement,
      topicCategory: topic.category,
      topicStatus: topic.status,
      stance: s.stance as 'for' | 'against',
      stanceStatement: s.statement ?? null,
      alignedVotes: aligned,
      opposedVotes: opposed,
      abstainedMembers: abstained,
      totalMembers: memberIds.length,
      alignmentPct,
    })
  }

  // ── Category breakdown ──────────────────────────────────────────────────────
  // Get topic categories for voted topics
  const votedTopicIds = Array.from(new Set(memberVotes.map((v) => v.topic_id)))
  const categoryMap = new Map<string, { forCount: number; againstCount: number }>()

  if (votedTopicIds.length > 0) {
    const { data: topicsRaw } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', votedTopicIds)

    const topicCategoryMap = new Map<string, string>(
      (topicsRaw ?? []).map((t) => [t.id, t.category ?? 'Other']),
    )

    for (const v of memberVotes) {
      const cat = topicCategoryMap.get(v.topic_id) ?? 'Other'
      if (!categoryMap.has(cat)) categoryMap.set(cat, { forCount: 0, againstCount: 0 })
      const entry = categoryMap.get(cat)!
      if (v.side === 'blue') entry.forCount++
      else entry.againstCount++
    }
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, counts]) => {
      const total = counts.forCount + counts.againstCount
      return {
        category,
        voteCount: total,
        forCount: counts.forCount,
        againstCount: counts.againstCount,
        forPct: total > 0 ? Math.round((counts.forCount / total) * 100) : 50,
      }
    })
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 8)

  // ── Top members ─────────────────────────────────────────────────────────────
  const topMembers: TopMember[] = memberProfiles.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    role: p.role,
    reputationScore: p.reputation_score ?? 0,
    clout: p.clout ?? 0,
    coalitionRole: memberRoleMap.get(p.id) ?? 'member',
  }))

  // ── Overall alignment ───────────────────────────────────────────────────────
  const totalVoted = totalAligned + totalOpposed
  const overallAlignmentPct = totalVoted > 0 ? Math.round((totalAligned / totalVoted) * 100) : null

  return NextResponse.json({
    coalition: {
      id: coalitionRaw.id,
      name: coalitionRaw.name,
      description: coalitionRaw.description,
      memberCount: coalitionRaw.member_count,
      maxMembers: coalitionRaw.max_members,
      wins: coalitionRaw.wins,
      losses: coalitionRaw.losses,
      influence: Math.round(coalitionRaw.coalition_influence),
    },
    stanceAlignments,
    categoryBreakdown,
    topMembers,
    overallAlignmentPct,
    totalMemberVotes: memberVotes.length,
    isMember,
  } satisfies CoalitionAnalyticsResponse)
}
