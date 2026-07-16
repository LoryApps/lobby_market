import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FollowingPosition {
  vote_id: string
  voted_at: string
  side: 'blue' | 'red'
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  trader: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    win_rate: number | null
    accuracy_grade: string | null
  }
}

export interface FollowingTrader {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  win_rate: number | null
  accuracy_grade: string | null
  position_count: number
  for_count: number
  against_count: number
  latest_at: string | null
}

export interface FollowingAggregate {
  total_positions: number
  total_traders: number
  for_count: number
  against_count: number
  top_category: string | null
  consensus_topics: Array<{
    topic_id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    for_trader_count: number
    against_trader_count: number
  }>
}

export interface FollowingResponse {
  positions: FollowingPosition[]
  traders: FollowingTrader[]
  aggregate: FollowingAggregate
  is_following_anyone: boolean
}

interface ProfileRow {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

// ─── Accuracy grade helper ────────────────────────────────────────────────────

function calcGrade(settled_total: number, settled_correct: number): {
  win_rate: number | null
  grade: string | null
} {
  if (settled_total < 3) return { win_rate: null, grade: null }
  const wr = Math.round((settled_correct / settled_total) * 100)
  let grade: string
  if (wr >= 80) grade = 'S'
  else if (wr >= 70) grade = 'A'
  else if (wr >= 60) grade = 'B'
  else if (wr >= 50) grade = 'C'
  else grade = 'D'
  return { win_rate: wr, grade }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Who the current user follows
  const { data: followRows } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followingIds: string[] = (followRows ?? []).map((r) => (r as { following_id: string }).following_id)

  if (followingIds.length === 0) {
    return NextResponse.json({
      positions: [],
      traders: [],
      aggregate: {
        total_positions: 0,
        total_traders: 0,
        for_count: 0,
        against_count: 0,
        top_category: null,
        consensus_topics: [],
      },
      is_following_anyone: false,
    } satisfies FollowingResponse)
  }

  // Fetch profiles for all followed users
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', followingIds)

  const profileMap = new Map<string, ProfileRow>()
  for (const p of profileRows ?? []) {
    profileMap.set((p as ProfileRow).id, p as ProfileRow)
  }

  // Settled vote performance per trader (for accuracy grading)
  const { data: settledVotes } = await supabase
    .from('votes')
    .select('user_id, side, topics!inner(status)')
    .in('user_id', followingIds)

  const perfMap = new Map<string, { total: number; correct: number }>()
  for (const row of settledVotes ?? []) {
    const r = row as { user_id: string; side: string; topics: { status: string } }
    const topicStatus = r.topics.status
    if (topicStatus !== 'law' && topicStatus !== 'failed') continue
    const correct =
      (r.side === 'blue' && topicStatus === 'law') ||
      (r.side === 'red' && topicStatus === 'failed')
    if (!perfMap.has(r.user_id)) perfMap.set(r.user_id, { total: 0, correct: 0 })
    const p = perfMap.get(r.user_id)!
    p.total++
    if (correct) p.correct++
  }

  // Fetch recent active positions from followed users via RPC-style join
  const { data: voteRows } = await supabase
    .from('votes')
    .select('id, user_id, side, created_at, topics!inner(id, statement, category, status, blue_pct, total_votes)')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(150)

  // Assemble positions, filtering to active/voting/proposed/law topics only
  const positions: FollowingPosition[] = []
  for (const row of voteRows ?? []) {
    const r = row as {
      id: string
      user_id: string
      side: string
      created_at: string
      topics: {
        id: string
        statement: string
        category: string | null
        status: string
        blue_pct: number
        total_votes: number
      }
    }

    const { status } = r.topics
    if (!['proposed', 'active', 'voting', 'law'].includes(status)) continue

    const profile = profileMap.get(r.user_id)
    if (!profile) continue

    const perf = perfMap.get(r.user_id) ?? { total: 0, correct: 0 }
    const { win_rate, grade } = calcGrade(perf.total, perf.correct)

    positions.push({
      vote_id: r.id,
      voted_at: r.created_at,
      side: r.side as 'blue' | 'red',
      topic_id: r.topics.id,
      statement: r.topics.statement,
      category: r.topics.category,
      status: r.topics.status,
      blue_pct: r.topics.blue_pct ?? 50,
      total_votes: r.topics.total_votes ?? 0,
      trader: {
        id: r.user_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout,
        win_rate,
        accuracy_grade: grade,
      },
    })

    if (positions.length >= 120) break
  }

  // Per-trader summaries
  const traderSummaryMap = new Map<string, {
    id: string; username: string; display_name: string | null
    avatar_url: string | null; role: string; clout: number
    win_rate: number | null; accuracy_grade: string | null
    position_count: number; for_count: number; against_count: number
    latest_at: string | null
  }>()

  for (const pos of positions) {
    if (!traderSummaryMap.has(pos.trader.id)) {
      traderSummaryMap.set(pos.trader.id, {
        ...pos.trader,
        position_count: 0,
        for_count: 0,
        against_count: 0,
        latest_at: null,
      })
    }
    const t = traderSummaryMap.get(pos.trader.id)!
    t.position_count++
    if (pos.side === 'blue') t.for_count++
    else t.against_count++
    if (!t.latest_at || pos.voted_at > t.latest_at) t.latest_at = pos.voted_at
  }

  const traders: FollowingTrader[] = [...traderSummaryMap.values()].sort(
    (a, b) => (b.latest_at ?? '').localeCompare(a.latest_at ?? '')
  )

  // Which topics have the most followed traders aligned
  const topicAggMap = new Map<string, {
    topic_id: string; statement: string; category: string | null
    status: string; blue_pct: number; for_trader_count: number; against_trader_count: number
  }>()

  for (const pos of positions) {
    if (!topicAggMap.has(pos.topic_id)) {
      topicAggMap.set(pos.topic_id, {
        topic_id: pos.topic_id,
        statement: pos.statement,
        category: pos.category,
        status: pos.status,
        blue_pct: pos.blue_pct,
        for_trader_count: 0,
        against_trader_count: 0,
      })
    }
    const t = topicAggMap.get(pos.topic_id)!
    if (pos.side === 'blue') t.for_trader_count++
    else t.against_trader_count++
  }

  const consensus_topics = [...topicAggMap.values()]
    .filter((t) => t.for_trader_count + t.against_trader_count >= 2)
    .sort((a, b) => {
      const aMax = Math.max(a.for_trader_count, a.against_trader_count)
      const bMax = Math.max(b.for_trader_count, b.against_trader_count)
      return bMax - aMax
    })
    .slice(0, 6)

  // Category distribution
  const catCounts = new Map<string, number>()
  for (const pos of positions) {
    if (pos.category) catCounts.set(pos.category, (catCounts.get(pos.category) ?? 0) + 1)
  }
  const top_category = catCounts.size > 0
    ? [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null

  const for_count = positions.filter((p) => p.side === 'blue').length
  const against_count = positions.filter((p) => p.side === 'red').length

  return NextResponse.json({
    positions,
    traders,
    aggregate: {
      total_positions: positions.length,
      total_traders: traders.length,
      for_count,
      against_count,
      top_category,
      consensus_topics,
    },
    is_following_anyone: true,
  } satisfies FollowingResponse)
}
