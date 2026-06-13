import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnnualEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
  count: number
}

export interface AnnualMyRanks {
  voterRank: number | null
  arguerRank: number | null
  earnerRank: number | null
  lawmakerRank: number | null
  voterCount: number
  arguerCount: number
  earnerCount: number
  lawmakerCount: number
}

export interface AnnualLeaderboardResponse {
  yearStart: string
  yearEnd: string
  year: number
  voters: AnnualEntry[]
  arguers: AnnualEntry[]
  earners: AnnualEntry[]
  lawmakers: AnnualEntry[]
  myRanks: AnnualMyRanks | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYearBounds(year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
  return { start, end }
}

const LIMIT = 25
const FETCH_CAP = 200_000

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const sp = req.nextUrl.searchParams

  const now = new Date()
  const yearParam = sp.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : now.getUTCFullYear()

  if (isNaN(year) || year < 2020 || year > now.getUTCFullYear()) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { start, end } = getYearBounds(year)
  const yearStart = start.toISOString()
  const yearEnd = end.toISOString()

  // ── 1. Top voters ──────────────────────────────────────────────────────────

  const { data: rawVotes } = await supabase
    .from('votes')
    .select('user_id')
    .gte('created_at', yearStart)
    .lte('created_at', yearEnd)
    .limit(FETCH_CAP)

  const voterMap = new Map<string, number>()
  for (const v of rawVotes ?? []) {
    voterMap.set(v.user_id, (voterMap.get(v.user_id) ?? 0) + 1)
  }

  // ── 2. Top arguers ────────────────────────────────────────────────────────

  const { data: rawArgs } = await supabase
    .from('arguments')
    .select('user_id')
    .gte('created_at', yearStart)
    .lte('created_at', yearEnd)
    .limit(FETCH_CAP)

  const arguerMap = new Map<string, number>()
  for (const a of rawArgs ?? []) {
    arguerMap.set(a.user_id, (arguerMap.get(a.user_id) ?? 0) + 1)
  }

  // ── 3. Top clout earners (upvotes received on arguments this year) ─────────

  const { data: rawUpvotes } = await supabase
    .from('argument_upvotes')
    .select('argument_id, arguments!inner(user_id)')
    .gte('created_at', yearStart)
    .lte('created_at', yearEnd)
    .limit(FETCH_CAP)

  const earnerMap = new Map<string, number>()
  for (const u of rawUpvotes ?? []) {
    const uid = (u.arguments as { user_id: string } | null)?.user_id
    if (uid) earnerMap.set(uid, (earnerMap.get(uid) ?? 0) + 1)
  }

  // ── 4. Top lawmakers (voted FOR topics that became law this year) ──────────

  const { data: rawLaws } = await supabase
    .from('laws')
    .select('topic_id')
    .gte('established_at', yearStart)
    .lte('established_at', yearEnd)
    .limit(FETCH_CAP)

  const lawTopicIds = (rawLaws ?? []).map((l) => l.topic_id).filter(Boolean) as string[]
  const lawmakerMap = new Map<string, number>()

  if (lawTopicIds.length > 0) {
    const { data: rawLawVotes } = await supabase
      .from('votes')
      .select('user_id')
      .in('topic_id', lawTopicIds)
      .eq('vote', true)
      .limit(FETCH_CAP)

    for (const v of rawLawVotes ?? []) {
      lawmakerMap.set(v.user_id, (lawmakerMap.get(v.user_id) ?? 0) + 1)
    }
  }

  // ── 5. Sort & slice ───────────────────────────────────────────────────────

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, LIMIT)

  const topVoterIds = sortDesc(voterMap)
  const topArguerIds = sortDesc(arguerMap)
  const topEarnerIds = sortDesc(earnerMap)
  const topLawmakerIds = sortDesc(lawmakerMap)

  const allUserIds = [
    ...new Set([
      ...topVoterIds.map(([id]) => id),
      ...topArguerIds.map(([id]) => id),
      ...topEarnerIds.map(([id]) => id),
      ...topLawmakerIds.map(([id]) => id),
    ]),
  ]

  const profileMap = new Map<string, AnnualEntry>()
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, vote_streak')
      .in('id', allUserIds)

    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        user_id: p.id,
        username: p.username ?? p.id.slice(0, 8),
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role ?? 'citizen',
        clout: p.clout ?? 0,
        vote_streak: p.vote_streak ?? 0,
        count: 0,
      })
    }
  }

  const buildList = (entries: [string, number][]): AnnualEntry[] =>
    entries
      .map(([id, count]) => {
        const p = profileMap.get(id)
        if (!p) return null
        return { ...p, count }
      })
      .filter(Boolean) as AnnualEntry[]

  const voters = buildList(topVoterIds)
  const arguers = buildList(topArguerIds)
  const earners = buildList(topEarnerIds)
  const lawmakers = buildList(topLawmakerIds)

  // ── 6. Current user ranks ─────────────────────────────────────────────────

  let myRanks: AnnualMyRanks | null = null
  if (user) {
    const voterRankIdx = [...voterMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .findIndex(([id]) => id === user.id)
    const arguerRankIdx = [...arguerMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .findIndex(([id]) => id === user.id)
    const earnerRankIdx = [...earnerMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .findIndex(([id]) => id === user.id)
    const lawmakerRankIdx = [...lawmakerMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .findIndex(([id]) => id === user.id)

    myRanks = {
      voterRank: voterRankIdx >= 0 ? voterRankIdx + 1 : null,
      arguerRank: arguerRankIdx >= 0 ? arguerRankIdx + 1 : null,
      earnerRank: earnerRankIdx >= 0 ? earnerRankIdx + 1 : null,
      lawmakerRank: lawmakerRankIdx >= 0 ? lawmakerRankIdx + 1 : null,
      voterCount: voterMap.size,
      arguerCount: arguerMap.size,
      earnerCount: earnerMap.size,
      lawmakerCount: lawmakerMap.size,
    }
  }

  return NextResponse.json({
    yearStart,
    yearEnd,
    year,
    voters,
    arguers,
    earners,
    lawmakers,
    myRanks,
  } satisfies AnnualLeaderboardResponse)
}
