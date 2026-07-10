import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyLeg {
  id: string
  leg_number: number
  content: string
  upvote_count: number
  created_at: string
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface WeeklyRelay {
  id: string
  side: 'for' | 'against'
  status: 'complete' | 'voted'
  max_legs: number
  vote_compelling: number
  vote_not_compelling: number
  compelling_pct: number | null
  league_score: number
  created_at: string
  completed_at: string | null
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  legs: WeeklyLeg[]
  user_vote: 'compelling' | 'not_compelling' | null
  rank: number
}

export interface WeeklyResponse {
  relay: WeeklyRelay | null
  week_label: string
  week_start_iso: string
  week_end_iso: string
  total_completed_this_week: number
  offset: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leagueScore(r: {
  vote_compelling: number
  vote_not_compelling: number
  total_leg_stars: number
}): number {
  const totalVotes = r.vote_compelling + r.vote_not_compelling
  const credibility = Math.min(totalVotes / 3, 1)
  const compellingRate = totalVotes > 0 ? r.vote_compelling / totalVotes : 0.5
  return Math.round(
    compellingRate * 100 * credibility +
    r.total_leg_stars * 2 +
    r.vote_compelling * 5
  )
}

function weekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)}–${fmt(end)}, ${start.getFullYear()}`
}

// ─── GET /api/relays/weekly ───────────────────────────────────────────────────
// ?offset=0  → current week (default)
// ?offset=1  → last week
// ?offset=2  → two weeks ago
// etc.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const url = new URL(req.url)
  const offset = Math.max(0, Math.min(52, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0))

  // ─── Compute week window ─────────────────────────────────────────────────────
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - daysSinceMonday - offset * 7)
  weekStart.setUTCHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

  const weekStartIso = weekStart.toISOString()
  const weekEndIso = weekEnd.toISOString()
  const label = weekLabel(weekStart, new Date(weekEnd.getTime() - 1))

  // ─── Fetch completed relays for the week ─────────────────────────────────────
  const { data: rawRelays, error } = await supabase
    .from('civic_relays')
    .select(
      'id, topic_id, side, starter_id, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at'
    )
    .in('status', ['complete', 'voted'])
    .gte('completed_at', weekStartIso)
    .lt('completed_at', weekEndIso)
    .order('vote_compelling', { ascending: false })
    .limit(50)

  if (error || !rawRelays || rawRelays.length === 0) {
    return NextResponse.json({
      relay: null,
      week_label: label,
      week_start_iso: weekStartIso,
      week_end_iso: weekEndIso,
      total_completed_this_week: 0,
      offset,
    } satisfies WeeklyResponse)
  }

  // ─── Fetch leg stars (total per relay) ───────────────────────────────────────
  const relayIds = rawRelays.map((r) => r.id as string)

  const { data: starRows } = await supabase
    .from('relay_leg_upvotes')
    .select('relay_legs(relay_id)')
    .in('relay_legs.relay_id', relayIds)

  const starsByRelay = new Map<string, number>()
  for (const s of starRows ?? []) {
    const leg = s.relay_legs as { relay_id: string } | null
    if (leg?.relay_id) {
      starsByRelay.set(leg.relay_id, (starsByRelay.get(leg.relay_id) ?? 0) + 1)
    }
  }

  // ─── Rank all relays by league score ────────────────────────────────────────
  type RawRelay = (typeof rawRelays)[number]
  const ranked = (rawRelays as RawRelay[])
    .map((r) => ({
      ...r,
      total_leg_stars: starsByRelay.get(r.id as string) ?? 0,
      score: leagueScore({
        vote_compelling: (r.vote_compelling as number) ?? 0,
        vote_not_compelling: (r.vote_not_compelling as number) ?? 0,
        total_leg_stars: starsByRelay.get(r.id as string) ?? 0,
      }),
    }))
    .sort((a, b) => b.score - a.score)

  const champion = ranked[0]
  if (!champion) {
    return NextResponse.json({
      relay: null,
      week_label: label,
      week_start_iso: weekStartIso,
      week_end_iso: weekEndIso,
      total_completed_this_week: rawRelays.length,
      offset,
    } satisfies WeeklyResponse)
  }

  // ─── Fetch all legs of the champion relay ────────────────────────────────────
  const { data: legs } = await supabase
    .from('relay_legs')
    .select(
      'id, relay_id, leg_number, content, upvote_count, author_id, created_at'
    )
    .eq('relay_id', champion.id as string)
    .order('leg_number', { ascending: true })

  // ─── Fetch all leg authors ────────────────────────────────────────────────────
  const authorIds = Array.from(
    new Set((legs ?? []).map((l) => l.author_id as string).filter(Boolean))
  )
  const authorMap = new Map<
    string,
    { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }
  >()
  if (authorIds.length > 0) {
    const { data: authorRows } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)
    for (const a of authorRows ?? []) {
      authorMap.set(a.id as string, a as {
        id: string
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
      })
    }
  }

  // ─── Fetch topic ──────────────────────────────────────────────────────────────
  let topicInfo: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null = null
  if (champion.topic_id) {
    const { data: t } = await supabase
      .from('topics')
      .select('id, statement, category, status')
      .eq('id', champion.topic_id as string)
      .maybeSingle()
    if (t) topicInfo = t as typeof topicInfo
  }

  // ─── Fetch starter profile ────────────────────────────────────────────────────
  const { data: starter } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', champion.starter_id as string)
    .maybeSingle()

  // ─── Fetch user's vote ────────────────────────────────────────────────────────
  let userVote: 'compelling' | 'not_compelling' | null = null
  if (userId) {
    const { data: voteRow } = await supabase
      .from('relay_votes')
      .select('vote')
      .eq('relay_id', champion.id as string)
      .eq('voter_id', userId)
      .maybeSingle()
    if (voteRow) userVote = voteRow.vote as 'compelling' | 'not_compelling'
  }

  // ─── Assemble response ────────────────────────────────────────────────────────
  const totalVotes = ((champion.vote_compelling as number) ?? 0) + ((champion.vote_not_compelling as number) ?? 0)
  const compellingPct =
    totalVotes > 0
      ? Math.round(((champion.vote_compelling as number) / totalVotes) * 100)
      : null

  const assembledLegs: WeeklyLeg[] = (legs ?? []).map((leg) => {
    const author = authorMap.get(leg.author_id as string)
    return {
      id: leg.id as string,
      leg_number: leg.leg_number as number,
      content: leg.content as string,
      upvote_count: (leg.upvote_count as number) ?? 0,
      created_at: leg.created_at as string,
      author_id: leg.author_id as string,
      author_username: author?.username ?? 'unknown',
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
      author_role: author?.role ?? 'person',
    }
  })

  const relay: WeeklyRelay = {
    id: champion.id as string,
    side: champion.side as 'for' | 'against',
    status: champion.status as 'complete' | 'voted',
    max_legs: (champion.max_legs as number) ?? 5,
    vote_compelling: (champion.vote_compelling as number) ?? 0,
    vote_not_compelling: (champion.vote_not_compelling as number) ?? 0,
    compelling_pct: compellingPct,
    league_score: champion.score,
    created_at: champion.created_at as string,
    completed_at: champion.completed_at as string | null,
    topic_id: topicInfo?.id ?? null,
    topic_statement: topicInfo?.statement ?? null,
    topic_category: topicInfo?.category ?? null,
    topic_status: topicInfo?.status ?? null,
    starter_username: (starter?.username as string) ?? 'unknown',
    starter_display_name: (starter?.display_name as string | null) ?? null,
    starter_avatar_url: (starter?.avatar_url as string | null) ?? null,
    starter_role: (starter?.role as string) ?? 'person',
    legs: assembledLegs,
    user_vote: userVote,
    rank: 1,
  }

  return NextResponse.json({
    relay,
    week_label: label,
    week_start_iso: weekStartIso,
    week_end_iso: weekEndIso,
    total_completed_this_week: rawRelays.length,
    offset,
  } satisfies WeeklyResponse)
}
