import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
  count: number
}

export interface MonthlyMyRanks {
  voterRank: number | null
  arguerRank: number | null
  earnerRank: number | null
  lawmakerRank: number | null
  voterCount: number
  arguerCount: number
  earnerCount: number
  lawmakerCount: number
}

export interface MonthlyLeaderboardResponse {
  monthStart: string
  monthEnd: string
  year: number
  month: number
  monthLabel: string
  voters: MonthlyEntry[]
  arguers: MonthlyEntry[]
  earners: MonthlyEntry[]
  lawmakers: MonthlyEntry[]
  myRanks: MonthlyMyRanks | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { start, end }
}

const LIMIT = 25
const FETCH_CAP = 50_000

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const sp = req.nextUrl.searchParams

  const now = new Date()
  const yearParam = sp.get('year')
  const monthParam = sp.get('month')

  const year = yearParam ? parseInt(yearParam, 10) : now.getUTCFullYear()
  const month = monthParam ? parseInt(monthParam, 10) : now.getUTCMonth() + 1

  if (
    isNaN(year) || year < 2020 || year > now.getUTCFullYear() + 1 ||
    isNaN(month) || month < 1 || month > 12
  ) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
  }

  const { start, end } = getMonthBounds(year, month)
  const monthStart = start.toISOString()
  const monthEnd = end.toISOString()
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 1. Voters — votes cast this month ─────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)
    .limit(FETCH_CAP)

  const voterCounts: Record<string, number> = {}
  for (const row of voteRows ?? []) {
    if (row.user_id) voterCounts[row.user_id] = (voterCounts[row.user_id] ?? 0) + 1
  }
  const topVoterIds = Object.entries(voterCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 2. Arguers & earners — arguments + upvotes received ───────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('user_id, upvotes')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)
    .limit(FETCH_CAP)

  const arguerCounts: Record<string, number> = {}
  const earnerCounts: Record<string, number> = {}
  for (const row of argRows ?? []) {
    if (!row.user_id) continue
    arguerCounts[row.user_id] = (arguerCounts[row.user_id] ?? 0) + 1
    if (row.upvotes > 0) {
      earnerCounts[row.user_id] = (earnerCounts[row.user_id] ?? 0) + row.upvotes
    }
  }
  const topArguerIds = Object.entries(arguerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)
  const topEarnerIds = Object.entries(earnerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── 3. Lawmakers — voted FOR laws established this month ──────────────────
  const { data: monthLaws } = await supabase
    .from('laws')
    .select('topic_id')
    .gte('established_at', monthStart)
    .lte('established_at', monthEnd)
    .limit(500)

  const lawTopicIds = (monthLaws ?? []).map((l) => l.topic_id).filter(Boolean)
  const lawmakerCounts: Record<string, number> = {}

  if (lawTopicIds.length > 0) {
    const { data: forVotes } = await supabase
      .from('votes')
      .select('user_id')
      .in('topic_id', lawTopicIds)
      .eq('side', 'blue')
      .limit(FETCH_CAP)

    for (const row of forVotes ?? []) {
      if (row.user_id) lawmakerCounts[row.user_id] = (lawmakerCounts[row.user_id] ?? 0) + 1
    }
  }
  const topLawmakerIds = Object.entries(lawmakerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)

  // ── Fetch profiles in one batch ────────────────────────────────────────────
  const allIds = Array.from(
    new Set([...topVoterIds, ...topArguerIds, ...topEarnerIds, ...topLawmakerIds])
  )
  const profileMap: Record<string, Profile> = {}
  if (allIds.length > 0) {
    const { data: profiles } = (await supabase
      .from('profiles')
      .select('*')
      .in('id', allIds)) as { data: Profile[] | null }
    for (const p of profiles ?? []) profileMap[p.id] = p
  }

  function toEntries(ids: string[], counts: Record<string, number>): MonthlyEntry[] {
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
  let myRanks: MonthlyMyRanks | null = null
  if (user) {
    const voterIdx = topVoterIds.indexOf(user.id)
    const arguerIdx = topArguerIds.indexOf(user.id)
    const earnerIdx = topEarnerIds.indexOf(user.id)
    const lawmakerIdx = topLawmakerIds.indexOf(user.id)
    myRanks = {
      voterRank: voterIdx >= 0 ? voterIdx + 1 : null,
      arguerRank: arguerIdx >= 0 ? arguerIdx + 1 : null,
      earnerRank: earnerIdx >= 0 ? earnerIdx + 1 : null,
      lawmakerRank: lawmakerIdx >= 0 ? lawmakerIdx + 1 : null,
      voterCount: voterCounts[user.id] ?? 0,
      arguerCount: arguerCounts[user.id] ?? 0,
      earnerCount: earnerCounts[user.id] ?? 0,
      lawmakerCount: lawmakerCounts[user.id] ?? 0,
    }
  }

  return NextResponse.json({
    monthStart,
    monthEnd,
    year,
    month,
    monthLabel,
    voters: toEntries(topVoterIds, voterCounts),
    arguers: toEntries(topArguerIds, arguerCounts),
    earners: toEntries(topEarnerIds, earnerCounts),
    lawmakers: toEntries(topLawmakerIds, lawmakerCounts),
    myRanks,
  } satisfies MonthlyLeaderboardResponse)
}
