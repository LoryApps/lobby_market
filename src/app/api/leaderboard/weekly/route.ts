import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
  count: number
}

export interface WeeklyMyRanks {
  voterRank: number | null
  debatorRank: number | null
  earnerRank: number | null
  voterCount: number
  debatorCount: number
  earnerCount: number
}

export interface WeeklyLeaderboardResponse {
  weekStart: string
  weekEnd: string
  voters: WeeklyEntry[]
  debators: WeeklyEntry[]
  earners: WeeklyEntry[]
  myRanks: WeeklyMyRanks | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day // days since last Monday
  const start = new Date(now)
  start.setUTCDate(now.getUTCDate() + diff)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

const LIMIT = 25
const FETCH_CAP = 5_000

export async function GET() {
  const supabase = await createClient()
  const { start, end } = getWeekBounds()
  const weekStart = start.toISOString()
  const weekEnd = end.toISOString()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 1. Voters (votes cast this week) ──────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id')
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd)
    .limit(FETCH_CAP)

  const voterCounts: Record<string, number> = {}
  for (const row of voteRows ?? []) {
    if (row.user_id) voterCounts[row.user_id] = (voterCounts[row.user_id] ?? 0) + 1
  }
  const topVoterIds = Object.entries(voterCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 2. Debators (argument upvotes received this week) ─────────────────────
  const { data: argVoteRows } = await supabase
    .from('topic_argument_votes')
    .select('argument_id')
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd)
    .limit(FETCH_CAP)

  const debatorCounts: Record<string, number> = {}
  const uniqueArgIds = Array.from(new Set((argVoteRows ?? []).map((r) => r.argument_id)))

  if (uniqueArgIds.length > 0) {
    const batchSize = 500
    for (let i = 0; i < uniqueArgIds.length; i += batchSize) {
      const batch = uniqueArgIds.slice(i, i + batchSize)
      const { data: argAuthors } = await supabase
        .from('topic_arguments')
        .select('id, user_id')
        .in('id', batch)

      const authorMap: Record<string, string> = {}
      for (const a of argAuthors ?? []) {
        authorMap[a.id] = a.user_id
      }
      for (const row of argVoteRows ?? []) {
        const authorId = authorMap[row.argument_id]
        if (authorId) debatorCounts[authorId] = (debatorCounts[authorId] ?? 0) + 1
      }
    }
  }

  const topDebatorIds = Object.entries(debatorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 3. Clout earners (clout gained this week) ─────────────────────────────
  const { data: cloutRows } = await supabase
    .from('clout_transactions')
    .select('user_id, amount')
    .eq('type', 'earned')
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd)
    .limit(FETCH_CAP)

  const earnerCounts: Record<string, number> = {}
  for (const row of cloutRows ?? []) {
    if (row.user_id && row.amount > 0) {
      earnerCounts[row.user_id] = (earnerCounts[row.user_id] ?? 0) + row.amount
    }
  }
  const topEarnerIds = Object.entries(earnerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── Fetch profiles in one batch ────────────────────────────────────────────
  const allIds = Array.from(new Set([...topVoterIds, ...topDebatorIds, ...topEarnerIds]))
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

  function toEntries(ids: string[], counts: Record<string, number>): WeeklyEntry[] {
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
  let myRanks: WeeklyMyRanks | null = null
  if (user) {
    const voterIdx = topVoterIds.indexOf(user.id)
    const debatorIdx = topDebatorIds.indexOf(user.id)
    const earnerIdx = topEarnerIds.indexOf(user.id)
    myRanks = {
      voterRank: voterIdx >= 0 ? voterIdx + 1 : null,
      debatorRank: debatorIdx >= 0 ? debatorIdx + 1 : null,
      earnerRank: earnerIdx >= 0 ? earnerIdx + 1 : null,
      voterCount: voterCounts[user.id] ?? 0,
      debatorCount: debatorCounts[user.id] ?? 0,
      earnerCount: earnerCounts[user.id] ?? 0,
    }
  }

  return NextResponse.json({
    weekStart,
    weekEnd,
    voters: toEntries(topVoterIds, voterCounts),
    debators: toEntries(topDebatorIds, debatorCounts),
    earners: toEntries(topEarnerIds, earnerCounts),
    myRanks,
  } satisfies WeeklyLeaderboardResponse)
}
