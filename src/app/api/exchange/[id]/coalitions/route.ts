import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoalitionOfficialStance {
  coalition_id: string
  stance: 'for' | 'against' | 'neutral'
  statement: string | null
  declared_at: string
  declared_by_username: string | null
  declared_by_display_name: string | null
  declared_by_avatar: string | null
}

export interface CoalitionVoteBreakdown {
  id: string
  name: string
  color: string | null
  badge_emoji: string | null
  member_count: number
  coalition_influence: number
  // Official position
  official_stance: CoalitionOfficialStance | null
  // Actual member voting behaviour on this market
  member_votes_for: number
  member_votes_against: number
  member_votes_total: number
  participation_rate: number | null   // member_votes_total / member_count
  alignment_pct: number | null         // % of voting members aligned with official stance
  // Vote distribution visual
  for_pct: number
  against_pct: number
}

export interface MarketCoalitionsResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    blue_votes: number
    red_votes: number
    total_votes: number
  }
  coalitions: CoalitionVoteBreakdown[]
  summary: {
    coalitions_with_stance: number
    coalitions_with_votes: number
    for_coalitions: number
    against_coalitions: number
    neutral_coalitions: number
    heaviest_for: string | null
    heaviest_against: string | null
  }
  as_of: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── 2. Official coalition stances on this topic ───────────────────────────
  const { data: stances } = await supabase
    .from('coalition_stances')
    .select(`
      coalition_id,
      stance,
      statement,
      created_at,
      declarer:profiles!coalition_stances_declared_by_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('topic_id', id)

  const stanceMap = new Map<string, CoalitionOfficialStance>()
  for (const s of stances ?? []) {
    const declarer = Array.isArray(s.declarer) ? s.declarer[0] : (s.declarer as { username: string; display_name: string | null; avatar_url: string | null } | null)
    stanceMap.set(s.coalition_id, {
      coalition_id: s.coalition_id,
      stance: s.stance as 'for' | 'against' | 'neutral',
      statement: s.statement ?? null,
      declared_at: s.created_at,
      declared_by_username: declarer?.username ?? null,
      declared_by_display_name: declarer?.display_name ?? null,
      declared_by_avatar: declarer?.avatar_url ?? null,
    })
  }

  // ── 3. All votes on this topic ────────────────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, side')
    .eq('topic_id', id)
    .limit(5000)

  const voterIds = Array.from(new Set((votes ?? []).map((v) => v.user_id)))

  // ── 4. Coalition memberships for all voters ───────────────────────────────
  const voteCountByUser = new Map<string, 'for' | 'against'>()
  for (const v of votes ?? []) {
    voteCountByUser.set(v.user_id, v.side as 'for' | 'against')
  }

  // Build per-coalition vote tallies
  const coalitionVoteTally = new Map<string, { for: number; against: number }>()

  if (voterIds.length > 0) {
    // Fetch in batches of 200 to avoid URL limits
    const BATCH = 200
    for (let i = 0; i < voterIds.length; i += BATCH) {
      const batch = voterIds.slice(i, i + BATCH)
      const { data: memberships } = await supabase
        .from('coalition_members')
        .select('user_id, coalition_id')
        .in('user_id', batch)

      for (const m of memberships ?? []) {
        const side = voteCountByUser.get(m.user_id)
        if (!side) continue
        const existing = coalitionVoteTally.get(m.coalition_id) ?? { for: 0, against: 0 }
        if (side === 'for') existing.for++
        else existing.against++
        coalitionVoteTally.set(m.coalition_id, existing)
      }
    }
  }

  // ── 5. Fetch coalition metadata ───────────────────────────────────────────
  const allCoalitionIds = new Set([
    ...Array.from(stanceMap.keys()),
    ...Array.from(coalitionVoteTally.keys()),
  ])

  const coalitionIdList = Array.from(allCoalitionIds)
  let coalitionMeta: Array<{
    id: string
    name: string
    color: string | null
    badge_emoji: string | null
    member_count: number
    coalition_influence: number
  }> = []

  if (coalitionIdList.length > 0) {
    const { data: meta } = await supabase
      .from('coalitions')
      .select('id, name, color, badge_emoji, member_count, coalition_influence')
      .in('id', coalitionIdList)
      .eq('is_public', true)
      .order('coalition_influence', { ascending: false })

    coalitionMeta = meta ?? []
  }

  // ── 6. Assemble final breakdown ───────────────────────────────────────────
  const coalitions: CoalitionVoteBreakdown[] = coalitionMeta.map((c) => {
    const tally = coalitionVoteTally.get(c.id) ?? { for: 0, against: 0 }
    const totalVotes = tally.for + tally.against
    const memberCount = c.member_count ?? 0

    const officialStance = stanceMap.get(c.id) ?? null

    // Alignment: how many voting members agree with official stance
    let alignment: number | null = null
    if (officialStance && totalVotes > 0) {
      const aligned =
        officialStance.stance === 'for' ? tally.for
        : officialStance.stance === 'against' ? tally.against
        : 0 // neutral: no alignment measure
      if (officialStance.stance !== 'neutral') {
        alignment = Math.round((aligned / totalVotes) * 100)
      }
    }

    const forPct = totalVotes > 0 ? Math.round((tally.for / totalVotes) * 100) : 50

    return {
      id: c.id,
      name: c.name,
      color: c.color,
      badge_emoji: c.badge_emoji,
      member_count: memberCount,
      coalition_influence: c.coalition_influence,
      official_stance: officialStance,
      member_votes_for: tally.for,
      member_votes_against: tally.against,
      member_votes_total: totalVotes,
      participation_rate:
        memberCount > 0 ? Math.round((totalVotes / memberCount) * 100) / 100 : null,
      alignment_pct: alignment,
      for_pct: forPct,
      against_pct: 100 - forPct,
    }
  })

  // Sort: coalitions with most member votes first, then by influence
  coalitions.sort((a, b) =>
    b.member_votes_total !== a.member_votes_total
      ? b.member_votes_total - a.member_votes_total
      : b.coalition_influence - a.coalition_influence
  )

  // ── 7. Summary ────────────────────────────────────────────────────────────
  const forCoalitions = coalitions.filter(
    (c) => c.official_stance?.stance === 'for'
  )
  const againstCoalitions = coalitions.filter(
    (c) => c.official_stance?.stance === 'against'
  )
  const neutralCoalitions = coalitions.filter(
    (c) => c.official_stance?.stance === 'neutral'
  )

  const heaviestFor = forCoalitions.sort(
    (a, b) => b.coalition_influence - a.coalition_influence
  )[0]?.name ?? null

  const heaviestAgainst = againstCoalitions.sort(
    (a, b) => b.coalition_influence - a.coalition_influence
  )[0]?.name ?? null

  return NextResponse.json({
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price: Math.round(topic.blue_pct ?? 50),
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
      total_votes: topic.total_votes ?? 0,
    },
    coalitions,
    summary: {
      coalitions_with_stance: stanceMap.size,
      coalitions_with_votes: coalitionVoteTally.size,
      for_coalitions: forCoalitions.length,
      against_coalitions: againstCoalitions.length,
      neutral_coalitions: neutralCoalitions.length,
      heaviest_for: heaviestFor,
      heaviest_against: heaviestAgainst,
    },
    as_of: new Date().toISOString(),
  } satisfies MarketCoalitionsResponse)
}
