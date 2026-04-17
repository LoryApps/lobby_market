import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Coalition, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export interface RecommendedCoalition extends Coalition {
  creator: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'> | null
  alignment_pct: number
  aligned_count: number
  stance_count: number
}

export interface RecommendedCoalitionsResponse {
  coalitions: RecommendedCoalition[]
  votes_analyzed: number
}

/**
 * GET /api/coalitions/recommended
 *
 * Returns up to 5 public coalitions the authenticated user is NOT a member
 * of, ranked by "voting alignment" — how often the user's vote direction
 * matches the coalition's declared stance on the same topics.
 *
 * Algorithm:
 *   1. Load the user's last 150 votes (topic_id + side).
 *   2. Find coalition stances on those same topics.
 *   3. For each coalition, score aligned (same direction) vs conflicted.
 *   4. alignment_pct = aligned / (aligned + conflicted) * 100
 *   5. Return top 5, sorted by alignment_pct desc, influence desc.
 *
 * For unauthenticated users or users with <3 votes analyzed: returns top
 * coalitions by influence so the section is never empty.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ─── Fallback: unauthenticated user ───────────────────────────────────────
  if (!user) {
    return NextResponse.json({ coalitions: [], votes_analyzed: 0 })
  }

  // ─── 1. Get user's recent votes ────────────────────────────────────────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(150)

  const votes = (votesRaw ?? []) as { topic_id: string; side: 'blue' | 'red' }[]

  // Build a map of topic_id → user's vote side
  const userVoteMap = new Map<string, 'blue' | 'red'>()
  for (const v of votes) {
    if (!userVoteMap.has(v.topic_id)) {
      userVoteMap.set(v.topic_id, v.side)
    }
  }

  const votedTopicIds = Array.from(userVoteMap.keys())

  // ─── 2. Get coalition memberships (to exclude) ─────────────────────────────
  const { data: membershipRows } = await supabase
    .from('coalition_members')
    .select('coalition_id')
    .eq('user_id', user.id)

  const memberCoalitionIds = new Set(
    (membershipRows ?? []).map((m) => m.coalition_id)
  )

  // ─── 3. Get all public coalitions ──────────────────────────────────────────
  const { data: coalitionsRaw } = await supabase
    .from('coalitions')
    .select('*')
    .eq('is_public', true)
    .order('coalition_influence', { ascending: false })
    .limit(100)

  const allCoalitions = (coalitionsRaw as Coalition[] | null) ?? []
  const eligibleCoalitions = allCoalitions.filter(
    (c) => !memberCoalitionIds.has(c.id)
  )

  // ─── 4. Get stances if we have voted topics ─────────────────────────────────
  let stances: {
    coalition_id: string
    topic_id: string
    stance: 'for' | 'against' | 'neutral'
  }[] = []

  if (votedTopicIds.length > 0) {
    const { data: stancesRaw } = await supabase
      .from('coalition_stances')
      .select('coalition_id, topic_id, stance')
      .in('topic_id', votedTopicIds)
      .in(
        'coalition_id',
        eligibleCoalitions.map((c) => c.id)
      )

    stances = (stancesRaw ?? []) as typeof stances
  }

  // ─── 5. Score each coalition ────────────────────────────────────────────────
  const coalitionScores = new Map<
    string,
    { aligned: number; conflicted: number }
  >()

  for (const stance of stances) {
    if (stance.stance === 'neutral') continue

    const userSide = userVoteMap.get(stance.topic_id)
    if (!userSide) continue

    const isAligned =
      (userSide === 'blue' && stance.stance === 'for') ||
      (userSide === 'red' && stance.stance === 'against')

    if (!coalitionScores.has(stance.coalition_id)) {
      coalitionScores.set(stance.coalition_id, { aligned: 0, conflicted: 0 })
    }
    const score = coalitionScores.get(stance.coalition_id)!
    if (isAligned) {
      score.aligned++
    } else {
      score.conflicted++
    }
  }

  // ─── 6. Build ranked list ──────────────────────────────────────────────────
  const ranked = eligibleCoalitions
    .map((coalition) => {
      const score = coalitionScores.get(coalition.id)
      const total = score ? score.aligned + score.conflicted : 0
      const alignmentPct = total > 0 ? Math.round((score!.aligned / total) * 100) : 0
      return {
        ...coalition,
        creator: null as RecommendedCoalition['creator'],
        alignment_pct: alignmentPct,
        aligned_count: score?.aligned ?? 0,
        stance_count: total,
      }
    })
    .sort((a, b) => {
      // Primary: alignment pct (only matters if there are stances)
      if (a.stance_count > 0 || b.stance_count > 0) {
        if (b.alignment_pct !== a.alignment_pct) {
          return b.alignment_pct - a.alignment_pct
        }
        if (b.stance_count !== a.stance_count) {
          return b.stance_count - a.stance_count
        }
      }
      // Fallback: influence
      return b.coalition_influence - a.coalition_influence
    })
    .slice(0, 5)

  // ─── 7. Enrich with creator profiles ─────────────────────────────────────
  const creatorIds = Array.from(new Set(ranked.map((c) => c.creator_id)))
  if (creatorIds.length > 0) {
    const { data: creatorsRaw } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', creatorIds)

    const creatorMap = new Map<string, RecommendedCoalition['creator']>()
    for (const p of creatorsRaw ?? []) {
      creatorMap.set(
        p.id,
        p as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>
      )
    }

    for (const c of ranked) {
      c.creator = creatorMap.get(c.creator_id) ?? null
    }
  }

  return NextResponse.json({
    coalitions: ranked,
    votes_analyzed: userVoteMap.size,
  } satisfies RecommendedCoalitionsResponse)
}
