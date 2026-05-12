import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ────────────────────────────────────────────────────────────

export interface CoalitionStat {
  id: string
  name: string
  description: string | null
  memberCount: number
  maxMembers: number
  wins: number
  losses: number
  influence: number
  userRole: 'leader' | 'officer' | 'member'
  joinedAt: string
  // Stance performance
  totalStances: number
  resolvedStances: number
  wonStances: number  // stance matched outcome (FOR+law or AGAINST+failed)
  stanceWinRate: number | null
  // User alignment: % of voted stance-topics where user voted same as coalition
  userAlignedVotes: number
  userTotalStanceVotes: number
  userAlignmentPct: number | null
  // Category breakdown
  topCategory: string | null
  categoryBreakdown: Array<{ category: string; count: number }>
}

export interface CoalitionsAnalyticsSummary {
  totalCoalitions: number
  totalStances: number
  avgStanceWinRate: number | null
  avgUserAlignment: number | null
  bestCoalitionId: string | null
  bestCoalitionName: string | null
  mostAlignedCoalitionId: string | null
  mostAlignedCoalitionName: string | null
}

export interface CoalitionsAnalyticsResponse {
  coalitions: CoalitionStat[]
  summary: CoalitionsAnalyticsSummary
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Get all coalitions the user belongs to
  const { data: memberRows, error: memberErr } = await supabase
    .from('coalition_members')
    .select('coalition_id, role, joined_at')
    .eq('user_id', user.id)

  if (memberErr || !memberRows || memberRows.length === 0) {
    return NextResponse.json({
      coalitions: [],
      summary: {
        totalCoalitions: 0,
        totalStances: 0,
        avgStanceWinRate: null,
        avgUserAlignment: null,
        bestCoalitionId: null,
        bestCoalitionName: null,
        mostAlignedCoalitionId: null,
        mostAlignedCoalitionName: null,
      },
    } satisfies CoalitionsAnalyticsResponse)
  }

  const coalitionIds = memberRows.map((r) => r.coalition_id)
  const roleMap = new Map(memberRows.map((r) => [r.coalition_id, { role: r.role, joinedAt: r.joined_at }]))

  // 2. Fetch coalition details
  const { data: coalitionRows } = await supabase
    .from('coalitions')
    .select('id, name, description, member_count, max_members, wins, losses, coalition_influence')
    .in('id', coalitionIds)

  if (!coalitionRows || coalitionRows.length === 0) {
    return NextResponse.json({
      coalitions: [],
      summary: {
        totalCoalitions: 0,
        totalStances: 0,
        avgStanceWinRate: null,
        avgUserAlignment: null,
        bestCoalitionId: null,
        bestCoalitionName: null,
        mostAlignedCoalitionId: null,
        mostAlignedCoalitionName: null,
      },
    } satisfies CoalitionsAnalyticsResponse)
  }

  // 3. Fetch all stances for these coalitions
  const { data: stanceRows } = await supabase
    .from('coalition_stances')
    .select('id, coalition_id, topic_id, stance')
    .in('coalition_id', coalitionIds)

  const stancesByCoalition = new Map<string, Array<{ topicId: string; stance: string }>>()
  const allTopicIds = new Set<string>()
  for (const row of stanceRows ?? []) {
    if (!stancesByCoalition.has(row.coalition_id)) stancesByCoalition.set(row.coalition_id, [])
    stancesByCoalition.get(row.coalition_id)!.push({ topicId: row.topic_id, stance: row.stance })
    allTopicIds.add(row.topic_id)
  }

  // 4. Fetch topic outcomes and categories for all stance-topics
  type TopicRow = { id: string; status: string; category: string | null }
  const topicMap = new Map<string, TopicRow>()
  if (allTopicIds.size > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, status, category')
      .in('id', Array.from(allTopicIds))
    for (const t of (topicRows ?? []) as TopicRow[]) {
      topicMap.set(t.id, t)
    }
  }

  // 5. Fetch user's votes on all stance-topics
  const userVoteMap = new Map<string, string>()  // topicId -> side
  if (allTopicIds.size > 0) {
    const { data: voteRows } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', Array.from(allTopicIds))
    for (const v of (voteRows ?? []) as { topic_id: string; side: string }[]) {
      userVoteMap.set(v.topic_id, v.side)
    }
  }

  // 6. Compute per-coalition stats
  const stats: CoalitionStat[] = coalitionRows.map((coalition) => {
    const memberInfo = roleMap.get(coalition.id)
    const stances = stancesByCoalition.get(coalition.id) ?? []

    let resolvedStances = 0
    let wonStances = 0
    const categoryCounts = new Map<string, number>()
    let userAligned = 0
    let userTotal = 0

    for (const { topicId, stance } of stances) {
      const topic = topicMap.get(topicId)
      if (!topic) continue

      if (topic.category) {
        categoryCounts.set(topic.category, (categoryCounts.get(topic.category) ?? 0) + 1)
      }

      const isResolved = topic.status === 'law' || topic.status === 'failed'
      if (isResolved && stance !== 'neutral') {
        resolvedStances++
        const won =
          (stance === 'for' && topic.status === 'law') ||
          (stance === 'against' && topic.status === 'failed')
        if (won) wonStances++
      }

      const userVote = userVoteMap.get(topicId)
      if (userVote && stance !== 'neutral') {
        userTotal++
        if (userVote === stance) userAligned++
      }
    }

    const stanceWinRate =
      resolvedStances > 0 ? Math.round((wonStances / resolvedStances) * 100) : null
    const userAlignmentPct =
      userTotal > 0 ? Math.round((userAligned / userTotal) * 100) : null

    const categoryBreakdown = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    const topCategory = categoryBreakdown[0]?.category ?? null

    return {
      id: coalition.id,
      name: coalition.name,
      description: coalition.description,
      memberCount: coalition.member_count,
      maxMembers: coalition.max_members,
      wins: coalition.wins,
      losses: coalition.losses,
      influence: coalition.coalition_influence,
      userRole: (memberInfo?.role ?? 'member') as 'leader' | 'officer' | 'member',
      joinedAt: memberInfo?.joinedAt ?? '',
      totalStances: stances.length,
      resolvedStances,
      wonStances,
      stanceWinRate,
      userAlignedVotes: userAligned,
      userTotalStanceVotes: userTotal,
      userAlignmentPct,
      topCategory,
      categoryBreakdown: categoryBreakdown.slice(0, 4),
    }
  })

  const roleOrder: Record<string, number> = { leader: 0, officer: 1, member: 2 }
  stats.sort((a, b) => {
    const rDiff = (roleOrder[a.userRole] ?? 2) - (roleOrder[b.userRole] ?? 2)
    if (rDiff !== 0) return rDiff
    return b.influence - a.influence
  })

  // 7. Summary stats
  const coalitionsWithStances = stats.filter((s) => s.resolvedStances > 0)
  const avgStanceWinRate =
    coalitionsWithStances.length > 0
      ? Math.round(
          coalitionsWithStances.reduce((sum, s) => sum + (s.stanceWinRate ?? 0), 0) /
            coalitionsWithStances.length,
        )
      : null

  const coalitionsWithAlignment = stats.filter((s) => s.userAlignmentPct !== null)
  const avgUserAlignment =
    coalitionsWithAlignment.length > 0
      ? Math.round(
          coalitionsWithAlignment.reduce((sum, s) => sum + (s.userAlignmentPct ?? 0), 0) /
            coalitionsWithAlignment.length,
        )
      : null

  const bestCoalition =
    coalitionsWithStances.length > 0
      ? coalitionsWithStances.reduce((best, s) =>
          (s.stanceWinRate ?? 0) > (best.stanceWinRate ?? 0) ? s : best,
        )
      : null

  const mostAligned =
    coalitionsWithAlignment.length > 0
      ? coalitionsWithAlignment.reduce((best, s) =>
          (s.userAlignmentPct ?? 0) > (best.userAlignmentPct ?? 0) ? s : best,
        )
      : null

  const totalStances = stats.reduce((sum, s) => sum + s.totalStances, 0)

  return NextResponse.json({
    coalitions: stats,
    summary: {
      totalCoalitions: stats.length,
      totalStances,
      avgStanceWinRate,
      avgUserAlignment,
      bestCoalitionId: bestCoalition?.id ?? null,
      bestCoalitionName: bestCoalition?.name ?? null,
      mostAlignedCoalitionId: mostAligned?.id ?? null,
      mostAlignedCoalitionName: mostAligned?.name ?? null,
    },
  } satisfies CoalitionsAnalyticsResponse)
}
