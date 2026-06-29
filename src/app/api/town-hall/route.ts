import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute edge cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TownHallTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number | null
  created_at: string
}

export interface TownHallLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
}

export interface TownHallMotion {
  id: string
  title: string
  description: string
  effect: string
  votes_for: number
  votes_against: number
  status: string
  closes_at: string
  proposer_username: string | null
  proposer_display_name: string | null
  proposer_avatar_url: string | null
}

export interface TownHallReferendum {
  id: string
  question: string
  category: string
  status: string
  for_votes: number
  against_votes: number
  quorum_required: number
  closes_at: string
  proposer_username: string | null
}

export interface TownHallElection {
  id: string
  title: string
  role: string
  status: string
  closes_at: string | null
  nominee_count: number
}

export interface WeeklyStats {
  votes_cast: number
  arguments_posted: number
  topics_created: number
  laws_established: number
  debates_held: number
}

export interface TownHallResponse {
  week_label: string
  week_start: string
  week_end: string
  // Governance
  active_motions: TownHallMotion[]
  active_referendums: TownHallReferendum[]
  active_elections: TownHallElection[]
  // Civic floor
  hot_topics: TownHallTopic[]
  voting_topics: TownHallTopic[]
  // Recent laws
  recent_laws: TownHallLaw[]
  // Stats
  weekly_stats: WeeklyStats
  total_citizens: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds() {
  const now = new Date()
  // Week starts Monday UTC
  const day = now.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - diff)
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

function weekLabel(weekStart: Date) {
  return weekStart.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const { weekStart, weekEnd } = getWeekBounds()
    const weekStartISO = weekStart.toISOString()
    const weekEndISO = weekEnd.toISOString()

    const [
      motionsRes,
      referendumsRes,
      electionsRes,
      hotTopicsRes,
      votingTopicsRes,
      recentLawsRes,
      weekVotesRes,
      weekArgsRes,
      weekTopicsRes,
      weekLawsRes,
      citizenCountRes,
    ] = await Promise.all([
      // Active grand-council motions
      supabase
        .from('council_motions')
        .select('id, title, description, effect, votes_for, votes_against, status, closes_at, proposer_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5),

      // Active referendums
      supabase
        .from('civic_referendums')
        .select('id, question, category, status, for_votes, against_votes, quorum_required, closes_at, proposer_id')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(5),

      // Active elections
      supabase
        .from('elections')
        .select('id, title, role, status, ends_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3),

      // Hot active topics (by feed_score)
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at')
        .in('status', ['active', 'proposed'])
        .order('feed_score', { ascending: false, nullsFirst: false })
        .limit(6),

      // Topics in voting phase
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at')
        .eq('status', 'voting')
        .order('total_votes', { ascending: false })
        .limit(4),

      // Laws established this week (or most recent 5)
      supabase
        .from('laws')
        .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
        .gte('established_at', weekStartISO)
        .order('established_at', { ascending: false })
        .limit(5),

      // Votes cast this week
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStartISO)
        .lte('created_at', weekEndISO),

      // Arguments posted this week
      supabase
        .from('topic_arguments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStartISO)
        .lte('created_at', weekEndISO),

      // Topics created this week
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekStartISO)
        .lte('created_at', weekEndISO),

      // Laws established this week
      supabase
        .from('laws')
        .select('id', { count: 'exact', head: true })
        .gte('established_at', weekStartISO)
        .lte('established_at', weekEndISO),

      // Total citizens
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),
    ])

    // Enrich motions with proposer data
    const motionProposerIds = (motionsRes.data ?? []).map((m) => m.proposer_id).filter(Boolean)
    const motionProposers: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {}
    if (motionProposerIds.length > 0) {
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', motionProposerIds)
      for (const p of pData ?? []) {
        motionProposers[p.id] = p
      }
    }

    // Enrich referendums with proposer usernames
    const refProposerIds = (referendumsRes.data ?? []).map((r) => r.proposer_id).filter(Boolean)
    const refProposers: Record<string, { username: string }> = {}
    if (refProposerIds.length > 0) {
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', refProposerIds)
      for (const p of pData ?? []) {
        refProposers[p.id] = p
      }
    }

    // Enrich elections with nominee count
    const electionIds = (electionsRes.data ?? []).map((e) => e.id)
    const electionNomineeCounts: Record<string, number> = {}
    if (electionIds.length > 0) {
      const { data: nData } = await supabase
        .from('election_nominees')
        .select('election_id')
        .in('election_id', electionIds)
      for (const n of nData ?? []) {
        electionNomineeCounts[n.election_id] = (electionNomineeCounts[n.election_id] ?? 0) + 1
      }
    }

    const activeMotions: TownHallMotion[] = (motionsRes.data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      effect: m.effect,
      votes_for: m.votes_for,
      votes_against: m.votes_against,
      status: m.status,
      closes_at: m.closes_at,
      proposer_username: motionProposers[m.proposer_id]?.username ?? null,
      proposer_display_name: motionProposers[m.proposer_id]?.display_name ?? null,
      proposer_avatar_url: motionProposers[m.proposer_id]?.avatar_url ?? null,
    }))

    const activeReferendums: TownHallReferendum[] = (referendumsRes.data ?? []).map((r) => ({
      id: r.id,
      question: r.question,
      category: r.category,
      status: r.status,
      for_votes: r.for_votes,
      against_votes: r.against_votes,
      quorum_required: r.quorum_required,
      closes_at: r.closes_at,
      proposer_username: refProposers[r.proposer_id]?.username ?? null,
    }))

    const activeElections: TownHallElection[] = (electionsRes.data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      role: e.role,
      status: e.status,
      closes_at: e.ends_at ?? null,
      nominee_count: electionNomineeCounts[e.id] ?? 0,
    }))

    const hotTopics: TownHallTopic[] = (hotTopicsRes.data ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      feed_score: t.feed_score,
      created_at: t.created_at,
    }))

    const votingTopics: TownHallTopic[] = (votingTopicsRes.data ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      feed_score: t.feed_score,
      created_at: t.created_at,
    }))

    const recentLaws: TownHallLaw[] = (recentLawsRes.data ?? []).map((l) => ({
      id: l.id,
      topic_id: l.topic_id,
      statement: l.statement,
      category: l.category,
      established_at: l.established_at,
      blue_pct: l.blue_pct,
      total_votes: l.total_votes,
    }))

    // If no laws this week, grab the 5 most recent all-time
    let finalLaws = recentLaws
    if (finalLaws.length === 0) {
      const { data: fallbackLaws } = await supabase
        .from('laws')
        .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
        .order('established_at', { ascending: false })
        .limit(5)
      finalLaws = (fallbackLaws ?? []).map((l) => ({
        id: l.id,
        topic_id: l.topic_id,
        statement: l.statement,
        category: l.category,
        established_at: l.established_at,
        blue_pct: l.blue_pct,
        total_votes: l.total_votes,
      }))
    }

    const weeklyStats: WeeklyStats = {
      votes_cast: weekVotesRes.count ?? 0,
      arguments_posted: weekArgsRes.count ?? 0,
      topics_created: weekTopicsRes.count ?? 0,
      laws_established: weekLawsRes.count ?? 0,
      debates_held: 0, // placeholder — debates table has no simple weekly count without joins
    }

    const response: TownHallResponse = {
      week_label: weekLabel(weekStart),
      week_start: weekStartISO,
      week_end: weekEndISO,
      active_motions: activeMotions,
      active_referendums: activeReferendums,
      active_elections: activeElections,
      hot_topics: hotTopics,
      voting_topics: votingTopics,
      recent_laws: finalLaws,
      weekly_stats: weeklyStats,
      total_citizens: citizenCountRes.count ?? 0,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/town-hall]', err)
    return NextResponse.json({ error: 'Failed to load town hall data' }, { status: 500 })
  }
}
