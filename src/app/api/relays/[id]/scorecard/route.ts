import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScorecardLeg {
  id: string
  leg_number: number
  content: string
  created_at: string
  upvote_count: number
  score_pct: number // leg's share of total upvotes (0–100)
  is_mvp: boolean
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface OpposingRelay {
  id: string
  side: 'for' | 'against'
  status: string
  vote_compelling: number
  vote_not_compelling: number
  leg_count: number
  total_upvotes: number
  compelling_pct: number
}

export interface ScorecardData {
  relay_id: string
  side: 'for' | 'against'
  status: string
  max_legs: number
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  created_at: string
  completed_at: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  // Votes
  vote_compelling: number
  vote_not_compelling: number
  total_votes: number
  compelling_pct: number
  // Legs
  legs: ScorecardLeg[]
  total_upvotes: number
  mvp_leg_number: number | null
  avg_upvotes_per_leg: number
  // Opposing relay (same topic, opposite side)
  opposing_relay: OpposingRelay | null
  // Platform context
  relay_percentile: number | null // 0–100: how this relay ranks among all voted relays
}

// ─── GET /api/relays/[id]/scorecard ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const relayId = params.id

  // Fetch the relay
  const { data: relay, error } = await supabase
    .from('civic_relays')
    .select('*')
    .eq('id', relayId)
    .maybeSingle()

  if (error || !relay) {
    return NextResponse.json({ error: 'Relay not found' }, { status: 404 })
  }

  // Fetch starter profile
  const { data: starter } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role')
    .eq('id', relay.starter_id)
    .maybeSingle()

  // Fetch topic
  let topicStatement: string | null = null
  let topicCategory: string | null = null
  if (relay.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', relay.topic_id)
      .maybeSingle()
    topicStatement = topic?.statement ?? null
    topicCategory = topic?.category ?? null
  }

  // Fetch legs with authors
  const { data: legsRaw } = await supabase
    .from('relay_legs')
    .select('id, leg_number, content, created_at, upvote_count, author_id, profiles:author_id(username, display_name, avatar_url, role)')
    .eq('relay_id', relayId)
    .order('leg_number', { ascending: true })

  const legs: ScorecardLeg[] = []
  let totalUpvotes = 0

  for (const leg of legsRaw ?? []) {
    const profile = (leg as { profiles?: { username: string; display_name: string | null; avatar_url: string | null; role: string } }).profiles
    const upvoteCount = (leg as { upvote_count?: number }).upvote_count ?? 0
    totalUpvotes += upvoteCount
    legs.push({
      id: leg.id,
      leg_number: leg.leg_number,
      content: leg.content,
      created_at: leg.created_at,
      upvote_count: upvoteCount,
      score_pct: 0, // filled after loop
      is_mvp: false,
      author_id: leg.author_id,
      author_username: profile?.username ?? 'unknown',
      author_display_name: profile?.display_name ?? null,
      author_avatar_url: profile?.avatar_url ?? null,
      author_role: profile?.role ?? 'person',
    })
  }

  // Compute score_pct and MVP
  let mvpLegNumber: number | null = null
  let mvpUpvotes = -1
  for (const leg of legs) {
    leg.score_pct = totalUpvotes > 0 ? Math.round((leg.upvote_count / totalUpvotes) * 100) : 0
    if (leg.upvote_count > mvpUpvotes) {
      mvpUpvotes = leg.upvote_count
      mvpLegNumber = leg.leg_number
    }
  }
  // Only mark MVP if there are actually upvotes
  if (totalUpvotes > 0 && mvpLegNumber !== null) {
    for (const leg of legs) {
      leg.is_mvp = leg.leg_number === mvpLegNumber
    }
  }

  const totalVotes = (relay.vote_compelling ?? 0) + (relay.vote_not_compelling ?? 0)
  const compellingPct = totalVotes > 0
    ? Math.round(((relay.vote_compelling ?? 0) / totalVotes) * 100)
    : 0

  // Fetch opposing relay (same topic, opposite side, complete or voted)
  let opposingRelay: OpposingRelay | null = null
  if (relay.topic_id) {
    const oppSide = relay.side === 'for' ? 'against' : 'for'
    const { data: oppRelays } = await supabase
      .from('civic_relays')
      .select('id, side, status, vote_compelling, vote_not_compelling, max_legs')
      .eq('topic_id', relay.topic_id)
      .eq('side', oppSide)
      .in('status', ['complete', 'voted'])
      .order('vote_compelling', { ascending: false })
      .limit(1)

    if (oppRelays && oppRelays.length > 0) {
      const opp = oppRelays[0]

      // Get opposing relay's leg count and total upvotes
      const { data: oppLegs, count: oppLegCount } = await supabase
        .from('relay_legs')
        .select('upvote_count', { count: 'exact' })
        .eq('relay_id', opp.id)

      const oppTotalUpvotes = (oppLegs ?? []).reduce(
        (sum, l) => sum + ((l as { upvote_count?: number }).upvote_count ?? 0),
        0
      )
      const oppTotalVotes = (opp.vote_compelling ?? 0) + (opp.vote_not_compelling ?? 0)
      const oppCompellingPct = oppTotalVotes > 0
        ? Math.round(((opp.vote_compelling ?? 0) / oppTotalVotes) * 100)
        : 0

      opposingRelay = {
        id: opp.id,
        side: opp.side as 'for' | 'against',
        status: opp.status,
        vote_compelling: opp.vote_compelling ?? 0,
        vote_not_compelling: opp.vote_not_compelling ?? 0,
        leg_count: oppLegCount ?? 0,
        total_upvotes: oppTotalUpvotes,
        compelling_pct: oppCompellingPct,
      }
    }
  }

  // Compute relay percentile among all voted relays by compelling_pct
  let relayPercentile: number | null = null
  if (relay.status === 'voted' && totalVotes > 0) {
    const { data: allVoted } = await supabase
      .from('civic_relays')
      .select('vote_compelling, vote_not_compelling')
      .eq('status', 'voted')

    if (allVoted && allVoted.length > 1) {
      const allScores = allVoted.map((r) => {
        const tv = (r.vote_compelling ?? 0) + (r.vote_not_compelling ?? 0)
        return tv > 0 ? (r.vote_compelling ?? 0) / tv : 0
      })
      const myScore = compellingPct / 100
      const below = allScores.filter((s) => s < myScore).length
      relayPercentile = Math.round((below / allScores.length) * 100)
    }
  }

  const result: ScorecardData = {
    relay_id: relay.id,
    side: relay.side as 'for' | 'against',
    status: relay.status,
    max_legs: relay.max_legs,
    topic_id: relay.topic_id ?? null,
    topic_statement: topicStatement,
    topic_category: topicCategory,
    created_at: relay.created_at,
    completed_at: relay.completed_at ?? null,
    starter_username: starter?.username ?? 'unknown',
    starter_display_name: starter?.display_name ?? null,
    starter_avatar_url: starter?.avatar_url ?? null,
    starter_role: starter?.role ?? 'person',
    vote_compelling: relay.vote_compelling ?? 0,
    vote_not_compelling: relay.vote_not_compelling ?? 0,
    total_votes: totalVotes,
    compelling_pct: compellingPct,
    legs,
    total_upvotes: totalUpvotes,
    mvp_leg_number: totalUpvotes > 0 ? mvpLegNumber : null,
    avg_upvotes_per_leg: legs.length > 0 ? Math.round((totalUpvotes / legs.length) * 10) / 10 : 0,
    opposing_relay: opposingRelay,
    relay_percentile: relayPercentile,
  }

  return NextResponse.json(result)
}
