import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryPolarization {
  category: string
  consensusScore: number    // 0–100: higher = stronger consensus
  topicCount: number
  votedTopicCount: number
  avgContestedness: number  // avg |50 − blue_pct|, 0 = most split, 50 = unanimous
  lawRate: number           // % of resolved topics that became law
  dominant: 'for' | 'against' | 'split'
}

export interface PolarizationTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  status: string
  contestedness: number     // |50 − blue_pct|
}

export interface PolarizationTrend {
  thisWeek: number          // avg contestedness, topics with votes cast this week
  lastWeek: number          // avg contestedness, topics with votes cast last week
  twoWeeksAgo: number
  direction: 'toward_consensus' | 'toward_division' | 'stable'
  deltaPct: number          // percentage-point change week-over-week
}

export interface PolarizationResponse {
  platform: {
    consensusScore: number
    health: 'unified' | 'healthy' | 'contested' | 'divided'
    totalTopics: number
    totalVotedTopics: number
    totalVotes: number
    avgContestedness: number
    lawPassRate: number
  }
  categories: CategoryPolarization[]
  mostDivided: PolarizationTopic[]
  mostUnited: PolarizationTopic[]
  trend: PolarizationTrend
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

const MIN_VOTES_FOR_ANALYSIS = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contestedness(bluePct: number): number {
  return Math.abs(50 - bluePct)
}

function toConsensusScore(avgContestednessPct: number): number {
  // avgContestedness in [0, 50] → consensusScore in [0, 100]
  return Math.round((avgContestednessPct / 50) * 100)
}

function healthLabel(score: number): 'unified' | 'healthy' | 'contested' | 'divided' {
  if (score >= 75) return 'unified'
  if (score >= 50) return 'healthy'
  if (score >= 25) return 'contested'
  return 'divided'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000)
  const threeWeeksAgo = new Date(now.getTime() - 21 * 86_400_000)

  // All topics with meaningful votes (not archived)
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at')
    .not('status', 'eq', 'archived')
    .order('total_votes', { ascending: false })

  if (error || !topics) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  // Separate topics with enough votes for analysis
  const votedTopics = topics.filter((t) => t.total_votes >= MIN_VOTES_FOR_ANALYSIS)
  const totalVotes = topics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
  const lawTopics = topics.filter((t) => t.status === 'law')
  const resolvedTopics = topics.filter((t) => t.status === 'law' || t.status === 'failed')
  const lawPassRate = resolvedTopics.length > 0
    ? Math.round((lawTopics.length / resolvedTopics.length) * 100)
    : 0

  // ── Platform-wide polarization ─────────────────────────────────────────────

  const platformContestednesses = votedTopics.map((t) => contestedness(t.blue_pct ?? 50))
  const avgContestedness = platformContestednesses.length > 0
    ? platformContestednesses.reduce((a, b) => a + b, 0) / platformContestednesses.length
    : 25
  const consensusScore = toConsensusScore(avgContestedness)

  // ── Per-category breakdown ─────────────────────────────────────────────────

  const categories: CategoryPolarization[] = CATEGORIES.map((cat) => {
    const catTopics = votedTopics.filter((t) => t.category === cat)
    const allCatTopics = topics.filter((t) => t.category === cat)
    const catLaws = allCatTopics.filter((t) => t.status === 'law')
    const catResolved = allCatTopics.filter((t) => t.status === 'law' || t.status === 'failed')

    if (catTopics.length === 0) {
      return {
        category: cat,
        consensusScore: 50,
        topicCount: allCatTopics.length,
        votedTopicCount: 0,
        avgContestedness: 25,
        lawRate: catResolved.length > 0 ? Math.round((catLaws.length / catResolved.length) * 100) : 0,
        dominant: 'split' as const,
      }
    }

    const contests = catTopics.map((t) => contestedness(t.blue_pct ?? 50))
    const avg = contests.reduce((a, b) => a + b, 0) / contests.length
    const avgBlue = catTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / catTopics.length

    return {
      category: cat,
      consensusScore: toConsensusScore(avg),
      topicCount: allCatTopics.length,
      votedTopicCount: catTopics.length,
      avgContestedness: Math.round(avg * 10) / 10,
      lawRate: catResolved.length > 0 ? Math.round((catLaws.length / catResolved.length) * 100) : 0,
      dominant: avg < 10 ? 'split' : avgBlue > 55 ? 'for' : avgBlue < 45 ? 'against' : 'split',
    }
  }).filter((c) => c.topicCount > 0)
    .sort((a, b) => a.consensusScore - b.consensusScore) // most divided first

  // ── Most divided / most united ─────────────────────────────────────────────

  const withContestedness = votedTopics
    .filter((t) => t.total_votes >= 10)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      blue_pct: Math.round(t.blue_pct ?? 50),
      total_votes: t.total_votes,
      status: t.status,
      contestedness: Math.round(contestedness(t.blue_pct ?? 50) * 10) / 10,
    }))

  const sorted = [...withContestedness].sort((a, b) => a.contestedness - b.contestedness)
  const mostDivided = sorted.slice(0, 8)   // lowest contestedness = most 50/50
  const mostUnited = sorted.slice(-8).reverse() // highest contestedness = clearest consensus

  // ── Week-over-week trend ───────────────────────────────────────────────────
  // Use topics updated (voted on) within each window. updated_at bumps on each vote.

  function avgContestednessInWindow(from: Date, to: Date): number {
    const inWindow = votedTopics.filter((t) => {
      const ts = new Date(t.updated_at ?? t.created_at)
      return ts >= from && ts < to
    })
    if (inWindow.length === 0) return avgContestedness // fallback to overall
    const sum = inWindow.reduce((acc, t) => acc + contestedness(t.blue_pct ?? 50), 0)
    return Math.round((sum / inWindow.length) * 10) / 10
  }

  const thisWeek = avgContestednessInWindow(weekAgo, now)
  const lastWeek = avgContestednessInWindow(twoWeeksAgo, weekAgo)
  const twoWeeksAgoVal = avgContestednessInWindow(threeWeeksAgo, twoWeeksAgo)

  const delta = thisWeek - lastWeek
  const trend: PolarizationTrend = {
    thisWeek: Math.round(thisWeek * 10) / 10,
    lastWeek: Math.round(lastWeek * 10) / 10,
    twoWeeksAgo: Math.round(twoWeeksAgoVal * 10) / 10,
    direction: Math.abs(delta) < 2 ? 'stable' : delta > 0 ? 'toward_consensus' : 'toward_division',
    deltaPct: Math.round(delta * 10) / 10,
  }

  // ── Response ───────────────────────────────────────────────────────────────

  const response: PolarizationResponse = {
    platform: {
      consensusScore,
      health: healthLabel(consensusScore),
      totalTopics: topics.length,
      totalVotedTopics: votedTopics.length,
      totalVotes,
      avgContestedness: Math.round(avgContestedness * 10) / 10,
      lawPassRate,
    },
    categories,
    mostDivided,
    mostUnited,
    trend,
    generated_at: now.toISOString(),
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120',
    },
  })
}
