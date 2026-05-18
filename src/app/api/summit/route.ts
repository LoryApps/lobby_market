import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // refresh every 30 minutes

// ─── Quarter helpers ──────────────────────────────────────────────────────────

function currentQuarter(now: Date): { q: number; year: number; start: string; end: string } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() // 0-indexed
  const q = Math.floor(m / 3) + 1
  const qStart = new Date(Date.UTC(y, (q - 1) * 3, 1))
  const qEnd = new Date(Date.UTC(y, q * 3, 0, 23, 59, 59))
  return {
    q,
    year: y,
    start: qStart.toISOString(),
    end: qEnd.toISOString(),
  }
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface SummitAwardee {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  value: number
  label: string
}

export interface SummitLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface SummitTopic {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  status: string
}

export interface SummitArgument {
  id: string
  content: string
  side: string
  upvotes: number
  topic: { id: string; statement: string; category: string | null } | null
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
}

export interface SummitData {
  quarter: { q: number; year: number; label: string; start: string; end: string }
  totals: {
    votes: number
    arguments: number
    laws: number
    topics: number
    debates: number
    newUsers: number
  }
  awards: {
    mostVotes: SummitAwardee | null
    grandOrator: SummitAwardee | null
    risingClout: SummitAwardee | null
  }
  landmarkLaws: SummitLaw[]
  hotContest: SummitTopic | null
  topArgument: SummitArgument | null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = new Date()
  const { q, year, start, end } = currentQuarter(now)

  const qLabel = `Q${q} ${year}`

  // Run all heavy queries in parallel
  const [
    voteCountsRes,
    argCountsRes,
    lawsRes,
    topicsCountRes,
    debatesCountRes,
    newUsersRes,
    hotContestRes,
    topArgRes,
  ] = await Promise.all([
    // Vote counts per user this quarter
    supabase
      .from('votes')
      .select('user_id')
      .gte('created_at', start)
      .lte('created_at', end),

    // Argument upvotes per author this quarter
    supabase
      .from('arguments')
      .select('user_id, upvotes')
      .gte('created_at', start)
      .lte('created_at', end),

    // Laws established this quarter
    supabase
      .from('laws')
      .select('id, topic_id, statement, category, total_votes, blue_pct, established_at')
      .gte('established_at', start)
      .lte('established_at', end)
      .order('total_votes', { ascending: false })
      .limit(5),

    // Topics created this quarter (count)
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end),

    // Debates this quarter (count)
    supabase
      .from('debates')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end),

    // New users this quarter
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end),

    // Most contested topic (closest to 50/50) currently active
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, status')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(50),

    // Top argument of the quarter by upvotes
    supabase
      .from('arguments')
      .select('id, content, side, upvotes, topic_id, user_id, created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // ── Tally vote counts per user ──────────────────────────────────────────────
  const voteTally: Record<string, number> = {}
  if (voteCountsRes.data) {
    for (const row of voteCountsRes.data as { user_id: string }[]) {
      voteTally[row.user_id] = (voteTally[row.user_id] ?? 0) + 1
    }
  }
  const topVoterEntry = Object.entries(voteTally).sort(([, a], [, b]) => b - a)[0]

  // ── Tally argument upvotes per author ───────────────────────────────────────
  const argTally: Record<string, number> = {}
  if (argCountsRes.data) {
    for (const row of argCountsRes.data as { user_id: string; upvotes: number }[]) {
      argTally[row.user_id] = (argTally[row.user_id] ?? 0) + (row.upvotes ?? 0)
    }
  }
  const topOratoryEntry = Object.entries(argTally).sort(([, a], [, b]) => b - a)[0]

  // ── Fetch profiles for award winners in a single query ─────────────────────
  const awardeeIds = [topVoterEntry?.[0], topOratoryEntry?.[0]].filter(Boolean) as string[]

  const awardeesMap: Record<string, SummitAwardee> = {}
  if (awardeeIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', awardeeIds)

    if (profiles) {
      for (const p of profiles as {
        id: string; username: string; display_name: string | null
        avatar_url: string | null; role: string; clout: number; reputation_score: number
      }[]) {
        awardeesMap[p.id] = { ...p, value: 0, label: '' }
      }
    }
  }

  // ── Fetch top clout profile (platform-wide, not quarter-scoped) ────────────
  const { data: topCloutProfile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score')
    .order('clout', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Find most contested topic (closest blue_pct to 50) ─────────────────────
  let hotContest: SummitTopic | null = null
  if (hotContestRes.data && hotContestRes.data.length > 0) {
    const typed = hotContestRes.data as SummitTopic[]
    hotContest = typed.reduce((closest, t) => {
      const diff = Math.abs((t.blue_pct ?? 50) - 50)
      const bestDiff = Math.abs((closest.blue_pct ?? 50) - 50)
      return diff < bestDiff ? t : closest
    })
  }

  // ── Enrich top argument with topic + author ─────────────────────────────────
  let topArgument: SummitArgument | null = null
  if (topArgRes.data) {
    const raw = topArgRes.data as {
      id: string; content: string; side: string; upvotes: number
      topic_id: string; user_id: string; created_at: string
    }

    const [{ data: argTopic }, { data: argAuthor }] = await Promise.all([
      supabase
        .from('topics')
        .select('id, statement, category')
        .eq('id', raw.topic_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', raw.user_id)
        .maybeSingle(),
    ])

    topArgument = {
      id: raw.id,
      content: raw.content,
      side: raw.side,
      upvotes: raw.upvotes,
      topic: (argTopic as { id: string; statement: string; category: string | null } | null) ?? null,
      author: (argAuthor as { id: string; username: string; display_name: string | null; avatar_url: string | null } | null) ?? null,
    }
  }

  // ── Build awards ────────────────────────────────────────────────────────────
  const mostVotes: SummitAwardee | null =
    topVoterEntry && awardeesMap[topVoterEntry[0]]
      ? { ...awardeesMap[topVoterEntry[0]], value: topVoterEntry[1], label: 'votes cast' }
      : null

  const grandOrator: SummitAwardee | null =
    topOratoryEntry && awardeesMap[topOratoryEntry[0]]
      ? { ...awardeesMap[topOratoryEntry[0]], value: topOratoryEntry[1], label: 'upvotes earned' }
      : null

  const risingClout: SummitAwardee | null =
    topCloutProfile
      ? {
          ...(topCloutProfile as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number; reputation_score: number }),
          value: (topCloutProfile as { clout: number }).clout,
          label: 'clout',
        }
      : null

  // ── Vote totals this quarter ────────────────────────────────────────────────
  const votesThisQuarter = voteCountsRes.data?.length ?? 0
  const argsThisQuarter = argCountsRes.data?.length ?? 0

  return NextResponse.json({
    quarter: { q, year, label: qLabel, start, end },
    totals: {
      votes: votesThisQuarter,
      arguments: argsThisQuarter,
      laws: lawsRes.data?.length ?? 0,
      topics: topicsCountRes.count ?? 0,
      debates: debatesCountRes.count ?? 0,
      newUsers: newUsersRes.count ?? 0,
    },
    awards: { mostVotes, grandOrator, risingClout },
    landmarkLaws: (lawsRes.data as SummitLaw[] | null) ?? [],
    hotContest,
    topArgument,
  } satisfies SummitData)
}
