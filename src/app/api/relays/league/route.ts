import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeagueRelay {
  id: string
  side: 'for' | 'against'
  status: 'complete' | 'voted'
  max_legs: number
  leg_count: number
  vote_compelling: number
  vote_not_compelling: number
  total_leg_stars: number
  compelling_pct: number | null
  league_score: number
  created_at: string
  completed_at: string | null
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  legs: {
    id: string
    leg_number: number
    content: string
    upvote_count: number
    author_username: string
    author_display_name: string | null
    author_avatar_url: string | null
  }[]
}

export interface LeagueStats {
  weekly_relays_started: number
  weekly_legs_written: number
  weekly_compelling_votes: number
  weekly_total_votes: number
}

export interface LeagueResponse {
  week_label: string       // e.g. "Jul 7–13, 2026"
  week_start_iso: string
  current_week: LeagueRelay[]
  all_time: LeagueRelay[]
  stats: LeagueStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leagueScore(r: {
  vote_compelling: number
  vote_not_compelling: number
  total_leg_stars: number
}): number {
  const totalVotes = r.vote_compelling + r.vote_not_compelling
  const credibility = Math.min(totalVotes / 3, 1)  // ramps to 1 at 3+ votes
  const compellingRate = totalVotes > 0 ? r.vote_compelling / totalVotes : 0.5
  return Math.round(
    compellingRate * 100 * credibility +
    r.total_leg_stars * 2 +
    r.vote_compelling * 5
  )
}

function weekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(weekStart)}–${fmt(weekEnd)}, ${weekStart.getFullYear()}`
}

// ─── GET /api/relays/league ───────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Week window: Mon–Sun UTC
  const now = new Date()
  const dayOfWeek = now.getUTCDay()  // 0 = Sun
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday)
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekStartIso = weekStart.toISOString()

  // ─── Fetch complete/voted relays ────────────────────────────────────────────

  const { data: rawRelays } = await supabase
    .from('civic_relays')
    .select('id, topic_id, side, starter_id, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at')
    .in('status', ['complete', 'voted'])
    .order('completed_at', { ascending: false })
    .limit(200)

  if (!rawRelays || rawRelays.length === 0) {
    const label = weekLabel(weekStart)
    return NextResponse.json({
      week_label: label,
      week_start_iso: weekStartIso,
      current_week: [],
      all_time: [],
      stats: { weekly_relays_started: 0, weekly_legs_written: 0, weekly_compelling_votes: 0, weekly_total_votes: 0 },
    } satisfies LeagueResponse)
  }

  const relayIds = rawRelays.map((r) => r.id)

  // ─── Fetch legs with upvote counts and authors ────────────────────────────

  const { data: legsRaw } = await supabase
    .from('relay_legs')
    .select('id, relay_id, leg_number, content, upvote_count, author_id, profiles:author_id(username, display_name, avatar_url)')
    .in('relay_id', relayIds)
    .order('leg_number', { ascending: true })

  const legsByRelay = new Map<string, typeof legsRaw>()
  for (const leg of legsRaw ?? []) {
    const arr = legsByRelay.get(leg.relay_id) ?? []
    arr.push(leg)
    legsByRelay.set(leg.relay_id, arr)
  }

  // ─── Fetch starter profiles ───────────────────────────────────────────────

  const starterIds = [...new Set(rawRelays.map((r) => r.starter_id))]
  const { data: starterProfiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', starterIds)

  const starterMap = new Map((starterProfiles ?? []).map((p) => [p.id, p]))

  // ─── Fetch topics ─────────────────────────────────────────────────────────

  const topicIds = [...new Set(rawRelays.map((r) => r.topic_id).filter(Boolean))] as string[]
  const topicMap = new Map<string, { statement: string; category: string | null }>()
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds)
    for (const t of topics ?? []) topicMap.set(t.id, t)
  }

  // ─── Build LeagueRelay objects ────────────────────────────────────────────

  function buildLeagueRelay(r: typeof rawRelays[0]): LeagueRelay {
    const legs = legsByRelay.get(r.id) ?? []
    const total_leg_stars = legs.reduce((sum, l) => sum + (l.upvote_count ?? 0), 0)
    const totalVotes = r.vote_compelling + r.vote_not_compelling
    const starter = starterMap.get(r.starter_id)
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null

    return {
      id: r.id,
      side: r.side as 'for' | 'against',
      status: r.status as 'complete' | 'voted',
      max_legs: r.max_legs,
      leg_count: legs.length,
      vote_compelling: r.vote_compelling,
      vote_not_compelling: r.vote_not_compelling,
      total_leg_stars,
      compelling_pct: totalVotes > 0 ? Math.round((r.vote_compelling / totalVotes) * 100) : null,
      league_score: leagueScore({ vote_compelling: r.vote_compelling, vote_not_compelling: r.vote_not_compelling, total_leg_stars }),
      created_at: r.created_at,
      completed_at: r.completed_at,
      topic_id: r.topic_id,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      starter_username: starter?.username ?? 'unknown',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      starter_role: starter?.role ?? 'person',
      legs: legs.map((l) => {
        const author = (l as { profiles?: { username: string; display_name: string | null; avatar_url: string | null } }).profiles
        return {
          id: l.id,
          leg_number: l.leg_number,
          content: l.content,
          upvote_count: l.upvote_count ?? 0,
          author_username: author?.username ?? 'unknown',
          author_display_name: author?.display_name ?? null,
          author_avatar_url: author?.avatar_url ?? null,
        }
      }),
    }
  }

  const allBuilt = rawRelays.map(buildLeagueRelay)
  allBuilt.sort((a, b) => b.league_score - a.league_score)

  // Current week: relays completed this week
  const currentWeek = allBuilt
    .filter((r) => {
      const completed = r.completed_at ?? r.created_at
      return new Date(completed) >= weekStart
    })
    .slice(0, 10)

  // All-time hall of fame (top 10 ever)
  const allTime = allBuilt.slice(0, 10)

  // ─── Weekly stats ──────────────────────────────────────────────────────────

  const { data: weekRelays } = await supabase
    .from('civic_relays')
    .select('vote_compelling, vote_not_compelling')
    .gte('created_at', weekStartIso)

  const { data: weekLegs } = await supabase
    .from('relay_legs')
    .select('id')
    .gte('created_at', weekStartIso)

  const weeklyCompelling = (weekRelays ?? []).reduce((s, r) => s + r.vote_compelling, 0)
  const weeklyTotal = (weekRelays ?? []).reduce((s, r) => s + r.vote_compelling + r.vote_not_compelling, 0)

  return NextResponse.json({
    week_label: weekLabel(weekStart),
    week_start_iso: weekStartIso,
    current_week: currentWeek,
    all_time: allTime,
    stats: {
      weekly_relays_started: weekRelays?.length ?? 0,
      weekly_legs_written: weekLegs?.length ?? 0,
      weekly_compelling_votes: weeklyCompelling,
      weekly_total_votes: weeklyTotal,
    },
  } satisfies LeagueResponse)
}
