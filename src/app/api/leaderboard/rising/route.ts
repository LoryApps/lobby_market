import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RisingEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  // 7-day activity
  votes_7d: number
  arguments_7d: number
  upvotes_7d: number
  achievements_7d: number
  // Computed momentum score
  momentum: number
}

export interface RisingMyStats {
  votes_7d: number
  arguments_7d: number
  upvotes_7d: number
  achievements_7d: number
  momentum: number
  overallRank: number | null
  voterRank: number | null
  arguerRank: number | null
}

export interface RisingLeaderboardResponse {
  weekStart: string
  overall: RisingEntry[]
  voters: RisingEntry[]
  arguers: RisingEntry[]
  myStats: RisingMyStats | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 30
const FETCH_CAP = 20_000

// Momentum score weights
const W_VOTE = 1
const W_ARG = 5
const W_UPVOTE = 2
const W_ACHIEVEMENT = 15

function momentum(v: number, a: number, u: number, ach: number): number {
  return v * W_VOTE + a * W_ARG + u * W_UPVOTE + ach * W_ACHIEVEMENT
}

function getWeekStart(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function GET() {
  const supabase = await createClient()
  const weekStart = getWeekStart().toISOString()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 1. Votes cast in last 7 days ─────────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id')
    .gte('created_at', weekStart)
    .limit(FETCH_CAP)

  const voteCounts: Record<string, number> = {}
  for (const row of voteRows ?? []) {
    if (row.user_id) voteCounts[row.user_id] = (voteCounts[row.user_id] ?? 0) + 1
  }

  // ── 2. Arguments posted in last 7 days (+ upvotes earned on them) ────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('user_id, upvotes')
    .gte('created_at', weekStart)
    .limit(FETCH_CAP)

  const argCounts: Record<string, number> = {}
  const upvoteCounts: Record<string, number> = {}
  for (const row of argRows ?? []) {
    if (row.user_id) {
      argCounts[row.user_id] = (argCounts[row.user_id] ?? 0) + 1
      upvoteCounts[row.user_id] = (upvoteCounts[row.user_id] ?? 0) + (row.upvotes ?? 0)
    }
  }

  // ── 3. Achievements earned in last 7 days ─────────────────────────────────
  const { data: achRows } = await supabase
    .from('user_achievements')
    .select('user_id')
    .gte('earned_at', weekStart)
    .limit(FETCH_CAP)

  const achCounts: Record<string, number> = {}
  for (const row of achRows ?? []) {
    if (row.user_id) achCounts[row.user_id] = (achCounts[row.user_id] ?? 0) + 1
  }

  // ── 4. Compute momentum scores ────────────────────────────────────────────
  const allIds = Array.from(
    new Set([
      ...Object.keys(voteCounts),
      ...Object.keys(argCounts),
      ...Object.keys(achCounts),
    ])
  )

  const scores: Record<string, number> = {}
  for (const id of allIds) {
    scores[id] = momentum(
      voteCounts[id] ?? 0,
      argCounts[id] ?? 0,
      upvoteCounts[id] ?? 0,
      achCounts[id] ?? 0
    )
  }

  // Top overall (by momentum)
  const topOverallIds = allIds
    .filter((id) => scores[id] > 0)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, LIMIT)

  // Top voters (by raw vote count)
  const topVoterIds = Object.entries(voteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // Top arguers (by upvotes received on 7-day arguments)
  const topArguerIds = Object.entries(argCounts)
    .sort((a, b) => (upvoteCounts[b[0]] ?? 0) - (upvoteCounts[a[0]] ?? 0))
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 5. Fetch profiles ─────────────────────────────────────────────────────
  const fetchIds = Array.from(
    new Set([...topOverallIds, ...topVoterIds, ...topArguerIds, ...(user ? [user.id] : [])])
  )

  const profileMap: Record<string, Profile> = {}
  if (fetchIds.length > 0) {
    const { data: profiles } = (await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', fetchIds)) as { data: Profile[] | null }
    for (const p of profiles ?? []) {
      profileMap[p.id] = p
    }
  }

  function toEntry(id: string): RisingEntry | null {
    const p = profileMap[id]
    if (!p) return null
    return {
      user_id: id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      clout: p.clout,
      reputation_score: p.reputation_score,
      votes_7d: voteCounts[id] ?? 0,
      arguments_7d: argCounts[id] ?? 0,
      upvotes_7d: upvoteCounts[id] ?? 0,
      achievements_7d: achCounts[id] ?? 0,
      momentum: scores[id] ?? 0,
    }
  }

  const overall = topOverallIds.map(toEntry).filter((e): e is RisingEntry => e !== null)
  const voters = topVoterIds.map(toEntry).filter((e): e is RisingEntry => e !== null)
  const arguers = topArguerIds.map(toEntry).filter((e): e is RisingEntry => e !== null)

  // ── 6. My stats ───────────────────────────────────────────────────────────
  let myStats: RisingMyStats | null = null
  if (user) {
    const myMomentum = scores[user.id] ?? 0
    const overallRank = myMomentum > 0 ? topOverallIds.indexOf(user.id) + 1 : null
    const voterRank =
      (voteCounts[user.id] ?? 0) > 0 ? topVoterIds.indexOf(user.id) + 1 : null
    const arguerRank =
      (argCounts[user.id] ?? 0) > 0 ? topArguerIds.indexOf(user.id) + 1 : null

    myStats = {
      votes_7d: voteCounts[user.id] ?? 0,
      arguments_7d: argCounts[user.id] ?? 0,
      upvotes_7d: upvoteCounts[user.id] ?? 0,
      achievements_7d: achCounts[user.id] ?? 0,
      momentum: myMomentum,
      overallRank: overallRank && overallRank <= LIMIT ? overallRank : null,
      voterRank: voterRank && voterRank <= LIMIT ? voterRank : null,
      arguerRank: arguerRank && arguerRank <= LIMIT ? arguerRank : null,
    }
  }

  return NextResponse.json({
    weekStart,
    overall,
    voters,
    arguers,
    myStats,
  } satisfies RisingLeaderboardResponse)
}
