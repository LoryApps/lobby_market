import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodayEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
  count: number
}

export interface TodayMyRanks {
  voterRank: number | null
  arguerRank: number | null
  upvoteRank: number | null
  voterCount: number
  arguerCount: number
  upvoteCount: number
}

export interface TodayLeaderboardResponse {
  todayStart: string
  voters: TodayEntry[]
  arguers: TodayEntry[]
  upvoted: TodayEntry[]
  myRanks: TodayMyRanks | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStart(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

const LIMIT = 25
const FETCH_CAP = 10_000

export async function GET() {
  const supabase = await createClient()
  const todayStart = getTodayStart().toISOString()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 1. Voters (votes cast today) ──────────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id')
    .gte('created_at', todayStart)
    .limit(FETCH_CAP)

  const voterCounts: Record<string, number> = {}
  for (const row of voteRows ?? []) {
    if (row.user_id) voterCounts[row.user_id] = (voterCounts[row.user_id] ?? 0) + 1
  }
  const topVoterIds = Object.entries(voterCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 2. Arguers (arguments posted today) ───────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('user_id')
    .gte('created_at', todayStart)
    .limit(FETCH_CAP)

  const arguerCounts: Record<string, number> = {}
  for (const row of argRows ?? []) {
    if (row.user_id) arguerCounts[row.user_id] = (arguerCounts[row.user_id] ?? 0) + 1
  }
  const topArguerIds = Object.entries(arguerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 3. Most upvoted (upvotes received on arguments today) ─────────────────
  // Fetch arguments posted today to get their IDs and owners
  const { data: todayArgs } = await supabase
    .from('topic_arguments')
    .select('id, user_id, upvotes')
    .gte('created_at', todayStart)
    .limit(FETCH_CAP)

  const upvoteCounts: Record<string, number> = {}
  for (const row of todayArgs ?? []) {
    if (row.user_id && row.upvotes > 0) {
      upvoteCounts[row.user_id] = (upvoteCounts[row.user_id] ?? 0) + row.upvotes
    }
  }
  const topUpvoteIds = Object.entries(upvoteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── Fetch profiles in one batch ────────────────────────────────────────────
  const allIds = Array.from(new Set([...topVoterIds, ...topArguerIds, ...topUpvoteIds]))
  const profileMap: Record<string, Profile> = {}

  if (allIds.length > 0) {
    const { data: profiles } = (await supabase
      .from('profiles')
      .select('*')
      .in('id', allIds)) as { data: Profile[] | null }
    for (const p of profiles ?? []) {
      profileMap[p.id] = p
    }
  }

  function toEntries(ids: string[], counts: Record<string, number>): TodayEntry[] {
    return ids
      .filter((id) => profileMap[id])
      .map((id) => {
        const p = profileMap[id]
        return {
          user_id: id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role,
          clout: p.clout,
          vote_streak: p.vote_streak,
          count: counts[id] ?? 0,
        }
      })
  }

  // ── My ranks ──────────────────────────────────────────────────────────────
  let myRanks: TodayMyRanks | null = null
  if (user) {
    const voterIdx = topVoterIds.indexOf(user.id)
    const arguerIdx = topArguerIds.indexOf(user.id)
    const upvoteIdx = topUpvoteIds.indexOf(user.id)
    myRanks = {
      voterRank: voterIdx >= 0 ? voterIdx + 1 : null,
      arguerRank: arguerIdx >= 0 ? arguerIdx + 1 : null,
      upvoteRank: upvoteIdx >= 0 ? upvoteIdx + 1 : null,
      voterCount: voterCounts[user.id] ?? 0,
      arguerCount: arguerCounts[user.id] ?? 0,
      upvoteCount: upvoteCounts[user.id] ?? 0,
    }
  }

  return NextResponse.json({
    todayStart,
    voters: toEntries(topVoterIds, voterCounts),
    arguers: toEntries(topArguerIds, arguerCounts),
    upvoted: toEntries(topUpvoteIds, upvoteCounts),
    myRanks,
  } satisfies TodayLeaderboardResponse)
}
