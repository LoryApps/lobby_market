import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HotspotTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  feed_score: number
  created_at: string
  heat_score: number
}

export interface HotspotDebate {
  id: string
  topic_id: string
  topic_statement: string
  status: string
  scheduled_at: string | null
  debate_type: string
  duration_minutes: number
}

export interface HotspotLaw {
  id: string
  topic_id: string | null
  statement: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
}

export interface HotspotResponse {
  final_hours: HotspotTopic[]       // voting topics ending < 6 h
  brink_of_law: HotspotTopic[]      // proposed topics ≥ 85% of threshold
  frozen_votes: HotspotTopic[]      // active/voting topics within 2% of 50/50
  live_debates: HotspotDebate[]     // live debates right now
  flash_laws: HotspotLaw[]          // laws passed in last 3 h
  top_heat: HotspotTopic | null     // single hottest topic by heat_score
  stats: {
    total_active: number
    total_voting: number
    total_live_debates: number
    laws_last_3h: number
  }
  fetched_at: string
}

// ─── Heat score ───────────────────────────────────────────────────────────────
// Composite urgency metric: higher = more in need of attention right now.
// Weighting:
//   - voting status with < 6 h left     +60
//   - voting status with < 24 h left    +30
//   - close to 50/50 (deadlock)         +25  (capped, based on distance from 50)
//   - brink of law support              +20
//   - high total_votes                  +10 (log-scaled)

function computeHeatScore(topic: {
  status: string
  voting_ends_at: string | null
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  feed_score: number
}): number {
  let score = 0

  if (topic.status === 'voting' && topic.voting_ends_at) {
    const hoursLeft = (new Date(topic.voting_ends_at).getTime() - Date.now()) / 3_600_000
    if (hoursLeft < 6) score += 60
    else if (hoursLeft < 24) score += 30
  }

  if (topic.status === 'active' || topic.status === 'voting') {
    const distFrom50 = Math.abs(topic.blue_pct - 50)
    if (distFrom50 <= 2) score += 25
    else if (distFrom50 <= 5) score += 15
    else if (distFrom50 <= 10) score += 8
  }

  if (topic.status === 'proposed' && topic.activation_threshold > 0) {
    const progress = topic.support_count / topic.activation_threshold
    if (progress >= 0.9) score += 20
    else if (progress >= 0.75) score += 12
    else if (progress >= 0.5) score += 6
  }

  if (topic.total_votes > 0) {
    score += Math.min(10, Math.log10(topic.total_votes) * 5)
  }

  return Math.round(score)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  const [
    votingTopicsRes,
    activeTopicsRes,
    proposedTopicsRes,
    debatesRes,
    flashLawsRes,
    statsRes,
  ] = await Promise.all([
    // Topics currently in voting
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, feed_score, created_at')
      .eq('status', 'voting')
      .order('voting_ends_at', { ascending: true })
      .limit(30),

    // Active topics (voting but not yet in voting phase)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, feed_score, created_at')
      .eq('status', 'active')
      .order('total_votes', { ascending: false })
      .limit(20),

    // Proposed topics close to activation
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, feed_score, created_at')
      .eq('status', 'proposed')
      .gt('activation_threshold', 0)
      .order('support_count', { ascending: false })
      .limit(20),

    // Live debates
    supabase
      .from('debates')
      .select('id, topic_id, status, scheduled_at, debate_type, duration_minutes, topics(statement)')
      .eq('status', 'live')
      .limit(10),

    // Laws established in last 3 hours
    supabase
      .from('laws')
      .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
      .gte('established_at', threeHoursAgo.toISOString())
      .order('established_at', { ascending: false })
      .limit(10),

    // Platform stats
    Promise.all([
      supabase.from('topics').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('topics').select('id', { count: 'exact', head: true }).eq('status', 'voting'),
      supabase.from('debates').select('id', { count: 'exact', head: true }).eq('status', 'live'),
      supabase.from('laws').select('id', { count: 'exact', head: true }).gte('established_at', threeHoursAgo.toISOString()),
    ]),
  ])

  const votingTopics = (votingTopicsRes.data ?? []) as HotspotTopic[]
  const activeTopics = (activeTopicsRes.data ?? []) as HotspotTopic[]
  const proposedTopics = (proposedTopicsRes.data ?? []) as HotspotTopic[]
  const flashLaws = (flashLawsRes.data ?? []) as HotspotLaw[]

  // Compute heat scores
  const scoredVoting = votingTopics.map((t) => ({ ...t, heat_score: computeHeatScore(t) }))
  const scoredActive = activeTopics.map((t) => ({ ...t, heat_score: computeHeatScore(t) }))
  const scoredProposed = proposedTopics.map((t) => ({ ...t, heat_score: computeHeatScore(t) }))

  // Final hours: voting topics ending within 6 hours (sorted by soonest)
  const finalHours = scoredVoting
    .filter((t) => t.voting_ends_at && new Date(t.voting_ends_at) <= sixHoursFromNow)
    .slice(0, 8)

  // Brink of law: proposed topics ≥ 85% of their activation threshold
  const brinkOfLaw = scoredProposed
    .filter((t) => t.activation_threshold > 0 && t.support_count / t.activation_threshold >= 0.85)
    .slice(0, 6)

  // Frozen votes: active OR voting topics within ±2% of 50/50
  const frozenVotes = [...scoredVoting, ...scoredActive]
    .filter((t) => Math.abs(t.blue_pct - 50) <= 3 && t.total_votes >= 50)
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 6)

  // Live debates — normalize nested topic statement
  const liveDebates: HotspotDebate[] = (debatesRes.data ?? []).map((d) => ({
    id: d.id,
    topic_id: d.topic_id,
    topic_statement: (d.topics as unknown as { statement: string } | null)?.statement ?? 'Untitled',
    status: d.status,
    scheduled_at: d.scheduled_at,
    debate_type: d.debate_type,
    duration_minutes: d.duration_minutes,
  }))

  // Top heat: the single topic with highest heat score across all scored topics
  const allScored = [...scoredVoting, ...scoredActive, ...scoredProposed]
  const topHeat = allScored.length > 0
    ? allScored.reduce((best, t) => (t.heat_score > best.heat_score ? t : best))
    : null

  // Stats
  const [activeCountRes, votingCountRes, liveDebateCountRes, flashLawCountRes] = statsRes
  const stats = {
    total_active: activeCountRes.count ?? 0,
    total_voting: votingCountRes.count ?? 0,
    total_live_debates: liveDebateCountRes.count ?? 0,
    laws_last_3h: flashLawCountRes.count ?? 0,
  }

  return NextResponse.json({
    final_hours: finalHours,
    brink_of_law: brinkOfLaw,
    frozen_votes: frozenVotes,
    live_debates: liveDebates,
    flash_laws: flashLaws,
    top_heat: topHeat ?? null,
    stats,
    fetched_at: now.toISOString(),
  } satisfies HotspotResponse)
}
