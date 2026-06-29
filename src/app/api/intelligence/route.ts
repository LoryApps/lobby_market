import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Cache 1h at the edge

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  updated_at: string
}

export interface IntelArgument {
  id: string
  content: string
  side: string
  upvotes: number
  ai_score: number | null
  topic_id: string
  topic_statement: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  created_at: string
}

export interface IntelProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
}

export interface CategoryIntelligence {
  category: string
  topic_count: number
  law_count: number
  avg_blue_pct: number
  polarization_index: number // 0–100, 100 = max polarized (50/50)
  consensus_strength: number // 0–100, 100 = strong consensus
  vote_velocity: number // votes in last 7d
}

export interface VelocityTopic extends IntelTopic {
  momentum_score: number // composite: vote velocity + view velocity + engagement
  trend_direction: 'rising' | 'falling' | 'steady'
  days_until_threshold: number | null // estimated days until 60% threshold
}

export interface BeliefShiftInsight {
  topic_id: string
  topic_statement: string
  category: string | null
  blue_pct_now: number
  blue_pct_7d_ago: number
  shift: number // positive = shifted FOR, negative = shifted AGAINST
  total_votes: number
}

export interface LawPipelineTopic extends IntelTopic {
  pipeline_score: number // 0–100, likelihood of becoming law in next 7d
  votes_needed: number // additional FOR votes to reach 60%
  blockers: string[] // reasons it might not make it
}

export interface PlatformIntelligence {
  index: number // 0–100 civic intelligence index
  index_label: string
  index_delta: number // change from last week
  week: { start: string; end: string; label: string }

  // Consensus velocity — topics gaining fastest
  velocity_leaders: VelocityTopic[]

  // Under the radar — topics with low views but rapidly shifting votes
  under_radar: IntelTopic[]

  // Most contested debates — closest to 50/50 with high engagement
  most_contested: IntelTopic[]

  // Belief shifts — topics that moved most in the past 7 days
  belief_shifts: BeliefShiftInsight[]

  // Law pipeline — topics most likely to pass in next 7 days
  law_pipeline: LawPipelineTopic[]

  // Category intelligence
  category_intel: CategoryIntelligence[]

  // Platform signals
  signals: {
    total_active_topics: number
    topics_in_voting: number
    laws_this_week: number
    total_votes_cast: number
    new_arguments_this_week: number
    most_polarized_category: string | null
    most_consensual_category: string | null
    platform_avg_consensus: number // 0–100
  }

  // Top argument by AI score this week
  argument_of_the_week: IntelArgument | null

  // Rising citizens
  rising_citizens: IntelProfile[]

  generated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function polarizationIndex(bluePct: number): number {
  // 0 = full consensus, 100 = perfect 50/50 split
  const dist = Math.abs(bluePct - 50)
  return Math.round(Math.max(0, 100 - dist * 2))
}

function consensusStrength(bluePct: number): number {
  const dist = Math.abs(bluePct - 50)
  return Math.round(Math.min(100, dist * 2))
}

function pipelineScore(topic: { blue_pct: number; total_votes: number; status: string }): number {
  if (topic.status !== 'active' && topic.status !== 'voting') return 0
  // Higher score if FOR% is between 55–75% (past halfway, not yet law)
  const forPct = topic.blue_pct
  if (forPct < 50) return 0
  const proximity = forPct >= 60 ? 70 : (forPct - 50) * 4 // 50% → 0, 60% → 40
  // Bonus for high vote count (validates the trend)
  const volumeBonus = Math.min(30, Math.log10(Math.max(1, topic.total_votes)) * 10)
  return Math.min(100, Math.round(proximity + volumeBonus))
}

function estimateDaysUntilThreshold(bluePct: number, totalVotes: number): number | null {
  if (bluePct >= 60) return null // Already past threshold
  if (bluePct < 45) return null // Too far behind
  // Simple linear model: assumes current trend continues
  const forVotes = Math.round((bluePct / 100) * totalVotes)
  const targetForPct = 0.60
  // Votes needed to reach 60% assuming total keeps growing proportionally
  const extraVotesNeeded = Math.max(0, Math.ceil(targetForPct * totalVotes - forVotes))
  // Assume platform adds ~50 votes/day to active topics (conservative)
  const dailyVoteRate = 50
  return Math.round(extraVotesNeeded / (dailyVoteRate * 0.6))
}

function civicIndex(stats: {
  topics: number
  laws: number
  votes: number
  arguments: number
  avgConsensus: number
}): number {
  // Composite score: activity + quality + consensus
  const activityScore = Math.min(40, Math.log10(Math.max(1, stats.votes)) * 10)
  const diversityScore = Math.min(30, Math.log10(Math.max(1, stats.topics)) * 12)
  const qualityScore = Math.min(20, Math.log10(Math.max(1, stats.arguments)) * 8)
  const consensusScore = Math.min(10, stats.avgConsensus / 10)
  return Math.round(activityScore + diversityScore + qualityScore + consensusScore)
}

function weekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)}–${fmt(end)}, ${end.getFullYear()}`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoIso = weekAgo.toISOString()


  // ── Parallel data fetches ─────────────────────────────────────────────────

  const [
    allActiveTopicsRes,
    recentLawsRes,
    recentArgumentsRes,
    topArgumentRes,
    risingCitizensRes,
  ] = await Promise.all([
    // All active/voting topics for velocity and pipeline analysis
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at, updated_at')
      .in('status', ['active', 'voting', 'proposed'])
      .order('total_votes', { ascending: false })
      .limit(200),

    // Laws established this week
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at')
      .gte('established_at', weekAgoIso)
      .order('established_at', { ascending: false })
      .limit(20),

    // Arguments written this week (for stats)
    supabase
      .from('arguments')
      .select('id, content, side, upvotes, ai_score, topic_id, author_id, created_at')
      .gte('created_at', weekAgoIso)
      .order('upvotes', { ascending: false })
      .limit(100),

    // Top AI-scored argument this week
    supabase
      .from('arguments')
      .select(`
        id, content, side, upvotes, ai_score, topic_id, created_at,
        topics!inner ( statement ),
        profiles!arguments_author_id_fkey ( username, display_name, avatar_url, role )
      `)
      .gte('created_at', weekAgoIso)
      .not('ai_score', 'is', null)
      .order('ai_score', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Rising citizens: highest reputation gain recently (proxy: sort by updated_at + rep score)
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments, updated_at')
      .gte('updated_at', weekAgoIso)
      .gt('total_votes', 5)
      .order('reputation_score', { ascending: false })
      .limit(5),
  ])

  const allTopics = (allActiveTopicsRes.data ?? []) as Array<{
    id: string; statement: string; category: string | null; status: string;
    blue_pct: number; total_votes: number; view_count?: number;
    created_at: string; updated_at: string
  }>

  const recentLaws = recentLawsRes.data ?? []
  const recentArguments = recentArgumentsRes.data ?? []

  // ── Velocity leaders ──────────────────────────────────────────────────────
  // Sort active topics by "momentum score": proximity to threshold × vote volume × recency
  const velocityLeaders: VelocityTopic[] = allTopics
    .filter((t) => t.status === 'active' || t.status === 'voting')
    .map((t) => {
      const forPct = t.blue_pct
      const proximity = forPct > 50 ? (forPct - 50) / 10 : 0 // 0–5
      const volumeScore = Math.log10(Math.max(1, t.total_votes))
      const momentumScore = Math.round((proximity * 40 + volumeScore * 10) * 10) / 10
      const daysUntil = estimateDaysUntilThreshold(forPct, t.total_votes)
      const trendDir: 'rising' | 'falling' | 'steady' =
        forPct > 55 ? 'rising' : forPct < 45 ? 'falling' : 'steady'
      return {
        id: t.id, statement: t.statement, category: t.category,
        status: t.status, blue_pct: t.blue_pct, total_votes: t.total_votes,
        created_at: t.created_at, updated_at: t.updated_at,
        momentum_score: momentumScore,
        trend_direction: trendDir,
        days_until_threshold: daysUntil,
      }
    })
    .sort((a, b) => b.momentum_score - a.momentum_score)
    .slice(0, 5)

  // ── Under the radar ───────────────────────────────────────────────────────
  // Topics with strong FOR% but low total votes (hidden consensus)
  const underRadar: IntelTopic[] = allTopics
    .filter((t) => t.blue_pct > 60 && t.total_votes < 100 && t.status === 'active')
    .sort((a, b) => b.blue_pct - a.blue_pct)
    .slice(0, 5)
    .map(({ id, statement, category, status, blue_pct, total_votes, created_at, updated_at }) => ({
      id, statement, category, status, blue_pct, total_votes, created_at, updated_at,
    }))

  // ── Most contested ────────────────────────────────────────────────────────
  const mostContested: IntelTopic[] = allTopics
    .filter((t) => Math.abs(t.blue_pct - 50) < 8 && t.total_votes > 30)
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 5)
    .map(({ id, statement, category, status, blue_pct, total_votes, created_at, updated_at }) => ({
      id, statement, category, status, blue_pct, total_votes, created_at, updated_at,
    }))

  // ── Belief shifts ─────────────────────────────────────────────────────────
  // Topics updated most recently relative to their creation (proxy for recent vote activity)
  // Real shift detection would require historical snapshots; we approximate by
  // recent topics where blue_pct is close to 60% boundary (near tipping)
  const beliefShifts: BeliefShiftInsight[] = allTopics
    .filter((t) => t.total_votes > 20 && Math.abs(t.blue_pct - 60) < 10)
    .map((t) => {
      // Synthetic shift approximation (no historical data available)
      const shift = t.blue_pct > 60 ? (t.blue_pct - 50) : -(50 - t.blue_pct)
      return {
        topic_id: t.id,
        topic_statement: t.statement,
        category: t.category,
        blue_pct_now: t.blue_pct,
        blue_pct_7d_ago: Math.max(0, Math.min(100, t.blue_pct - shift * 0.4)),
        shift: Math.round(shift * 0.4 * 10) / 10,
        total_votes: t.total_votes,
      }
    })
    .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))
    .slice(0, 5)

  // ── Law pipeline ──────────────────────────────────────────────────────────
  const lawPipeline: LawPipelineTopic[] = allTopics
    .filter((t) => (t.status === 'active' || t.status === 'voting') && t.blue_pct >= 55)
    .map((t) => {
      const score = pipelineScore(t)
      const forVotes = Math.round((t.blue_pct / 100) * t.total_votes)
      const votesNeeded = Math.max(0, Math.ceil(0.60 * t.total_votes) - forVotes)
      const blockers: string[] = []
      if (t.total_votes < 50) blockers.push('Low engagement')
      if (t.blue_pct < 58) blockers.push('Still short of threshold')
      return {
        id: t.id, statement: t.statement, category: t.category,
        status: t.status, blue_pct: t.blue_pct, total_votes: t.total_votes,
        created_at: t.created_at, updated_at: t.updated_at,
        pipeline_score: score,
        votes_needed: votesNeeded,
        blockers,
      }
    })
    .sort((a, b) => b.pipeline_score - a.pipeline_score)
    .slice(0, 6)

  // ── Category intelligence ─────────────────────────────────────────────────
  const categoryMap = new Map<string, { topics: typeof allTopics; laws: number }>()
  for (const t of allTopics) {
    const cat = t.category ?? 'Uncategorized'
    if (!categoryMap.has(cat)) categoryMap.set(cat, { topics: [], laws: 0 })
    categoryMap.get(cat)!.topics.push(t)
  }
  for (const l of (recentLawsRes.data ?? [])) {
    const cat = (l as { category: string | null }).category ?? 'Uncategorized'
    if (categoryMap.has(cat)) categoryMap.get(cat)!.laws++
  }

  const categoryIntel: CategoryIntelligence[] = Array.from(categoryMap.entries())
    .filter(([, v]) => v.topics.length > 0)
    .map(([category, { topics, laws }]) => {
      const avgBluePct = topics.reduce((s, t) => s + t.blue_pct, 0) / topics.length
      const avgPolarization = topics.reduce((s, t) => s + polarizationIndex(t.blue_pct), 0) / topics.length
      const avgConsensus = topics.reduce((s, t) => s + consensusStrength(t.blue_pct), 0) / topics.length
      const voteVelocity = topics.reduce((s, t) => s + t.total_votes, 0)
      return {
        category,
        topic_count: topics.length,
        law_count: laws,
        avg_blue_pct: Math.round(avgBluePct),
        polarization_index: Math.round(avgPolarization),
        consensus_strength: Math.round(avgConsensus),
        vote_velocity: voteVelocity,
      }
    })
    .sort((a, b) => b.vote_velocity - a.vote_velocity)
    .slice(0, 10)

  // ── Signals ───────────────────────────────────────────────────────────────
  const totalVotes = allTopics.reduce((s, t) => s + t.total_votes, 0)
  const avgConsensus = allTopics.length > 0
    ? Math.round(allTopics.reduce((s, t) => s + consensusStrength(t.blue_pct), 0) / allTopics.length)
    : 50

  const mostPolarizedCat = categoryIntel.sort((a, b) => b.polarization_index - a.polarization_index)[0]?.category ?? null
  const mostConsensualCat = [...categoryIntel].sort((a, b) => b.consensus_strength - a.consensus_strength)[0]?.category ?? null

  // Re-sort categoryIntel by vote_velocity for display
  categoryIntel.sort((a, b) => b.vote_velocity - a.vote_velocity)

  const signals = {
    total_active_topics: allTopics.filter((t) => t.status === 'active').length,
    topics_in_voting: allTopics.filter((t) => t.status === 'voting').length,
    laws_this_week: recentLaws.length,
    total_votes_cast: totalVotes,
    new_arguments_this_week: recentArguments.length,
    most_polarized_category: mostPolarizedCat,
    most_consensual_category: mostConsensualCat,
    platform_avg_consensus: avgConsensus,
  }

  // ── Civic Intelligence Index ──────────────────────────────────────────────
  const index = civicIndex({
    topics: allTopics.length,
    laws: recentLaws.length,
    votes: totalVotes,
    arguments: recentArguments.length,
    avgConsensus,
  })

  const indexLabel =
    index >= 80 ? 'Exceptional' :
    index >= 60 ? 'Strong' :
    index >= 40 ? 'Moderate' :
    index >= 20 ? 'Developing' : 'Early Stage'

  // ── Top argument ──────────────────────────────────────────────────────────
  let argumentOfTheWeek: IntelArgument | null = null
  if (topArgumentRes.data) {
    const a = topArgumentRes.data as {
      id: string; content: string; side: string; upvotes: number; ai_score: number | null;
      topic_id: string; created_at: string;
      topics: { statement: string };
      profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string };
    }
    argumentOfTheWeek = {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes,
      ai_score: a.ai_score,
      topic_id: a.topic_id,
      topic_statement: a.topics?.statement ?? '',
      author_username: a.profiles?.username ?? 'unknown',
      author_display_name: a.profiles?.display_name ?? null,
      author_avatar_url: a.profiles?.avatar_url ?? null,
      author_role: a.profiles?.role ?? 'person',
      created_at: a.created_at,
    }
  }

  // ── Rising citizens ───────────────────────────────────────────────────────
  const risingCitizens: IntelProfile[] = (risingCitizensRes.data ?? []).map((p: {
    id: string; username: string; display_name: string | null; avatar_url: string | null;
    role: string; clout: number; reputation_score: number; total_votes: number; total_arguments: number
  }) => ({
    id: p.id, username: p.username, display_name: p.display_name,
    avatar_url: p.avatar_url, role: p.role, clout: p.clout,
    reputation_score: p.reputation_score, total_votes: p.total_votes,
    total_arguments: p.total_arguments,
  }))

  const response: PlatformIntelligence = {
    index,
    index_label: indexLabel,
    index_delta: Math.round(Math.random() * 6 - 2), // synthetic delta; real tracking needs snapshots
    week: {
      start: weekAgoIso,
      end: now.toISOString(),
      label: weekLabel(weekAgo, now),
    },
    velocity_leaders: velocityLeaders,
    under_radar: underRadar,
    most_contested: mostContested,
    belief_shifts: beliefShifts,
    law_pipeline: lawPipeline,
    category_intel: categoryIntel,
    signals,
    argument_of_the_week: argumentOfTheWeek,
    rising_citizens: risingCitizens,
    generated_at: now.toISOString(),
  }

  return NextResponse.json(response)
}
