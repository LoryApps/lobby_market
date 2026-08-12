import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
  count: number
  /** true if this user was active in the last 10 minutes */
  hot: boolean
}

export interface LiveMyRanks {
  voterRank: number | null
  arguerRank: number | null
  voterCount: number
  arguerCount: number
}

export interface LiveLeaderboardResponse {
  windowStart: string
  windowMinutes: number
  voters: LiveEntry[]
  arguers: LiveEntry[]
  myRanks: LiveMyRanks | null
  totalVotes: number
  totalArguments: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

const WINDOW_MINUTES = 60
const LIMIT = 25
const FETCH_CAP = 5_000
const HOT_MINUTES = 10

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000)
  const hotStart = new Date(now.getTime() - HOT_MINUTES * 60 * 1000)

  const windowStartISO = windowStart.toISOString()
  const hotStartISO = hotStart.toISOString()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 1. Votes in the last hour ──────────────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id, created_at')
    .gte('created_at', windowStartISO)
    .limit(FETCH_CAP)

  const voterCounts: Record<string, number> = {}
  const hotVoters = new Set<string>()
  for (const row of voteRows ?? []) {
    if (!row.user_id) continue
    voterCounts[row.user_id] = (voterCounts[row.user_id] ?? 0) + 1
    if (row.created_at >= hotStartISO) hotVoters.add(row.user_id)
  }
  const topVoterIds = Object.entries(voterCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 2. Arguments posted in the last hour ──────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('user_id, created_at')
    .gte('created_at', windowStartISO)
    .limit(FETCH_CAP)

  const arguerCounts: Record<string, number> = {}
  const hotArguers = new Set<string>()
  for (const row of argRows ?? []) {
    if (!row.user_id) continue
    arguerCounts[row.user_id] = (arguerCounts[row.user_id] ?? 0) + 1
    if (row.created_at >= hotStartISO) hotArguers.add(row.user_id)
  }
  const topArguerIds = Object.entries(arguerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── Batch-fetch profiles ──────────────────────────────────────────────────
  const allIds = Array.from(new Set([...topVoterIds, ...topArguerIds]))
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

  function toEntries(
    ids: string[],
    counts: Record<string, number>,
    hotSet: Set<string>,
  ): LiveEntry[] {
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
          hot: hotSet.has(id),
        }
      })
  }

  // ── My ranks ──────────────────────────────────────────────────────────────
  let myRanks: LiveMyRanks | null = null
  if (user) {
    const voterIdx = topVoterIds.indexOf(user.id)
    const arguerIdx = topArguerIds.indexOf(user.id)
    myRanks = {
      voterRank: voterIdx >= 0 ? voterIdx + 1 : null,
      arguerRank: arguerIdx >= 0 ? arguerIdx + 1 : null,
      voterCount: voterCounts[user.id] ?? 0,
      arguerCount: arguerCounts[user.id] ?? 0,
    }
  }

  return NextResponse.json({
    windowStart: windowStartISO,
    windowMinutes: WINDOW_MINUTES,
    voters: toEntries(topVoterIds, voterCounts, hotVoters),
    arguers: toEntries(topArguerIds, arguerCounts, hotArguers),
    myRanks,
    totalVotes: (voteRows ?? []).length,
    totalArguments: (argRows ?? []).length,
  } satisfies LiveLeaderboardResponse)
}
