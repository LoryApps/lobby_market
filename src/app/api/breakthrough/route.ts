import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type BreakthroughTier =
  | 'unanimous'  // consensus ≥ 85%: the community has spoken decisively
  | 'landmark'   // consensus 70–84%: landmark agreement, rare and significant
  | 'clear'      // consensus 60–69%: clear majority, consensus formed
  | 'forming'    // consensus 55–59%: emerging agreement, consensus crystallising

export type BreakthroughDirection = 'for' | 'against'

export interface BreakthroughTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  /** consensus_score = abs(blue_pct - 50) * 2, maps 5% lead → 10, unanimous → 100 */
  consensus_score: number
  tier: BreakthroughTier
  direction: BreakthroughDirection
  total_arguments: number
  updated_at: string
}

export interface CategoryBreakthrough {
  category: string
  topic_count: number
  avg_consensus_score: number
  unanimous_count: number
  landmark_count: number
  strongest_topic: string | null
  strongest_score: number
}

export interface BreakthroughStats {
  total_breakthrough_topics: number
  unanimous_count: number
  landmark_count: number
  clear_count: number
  forming_count: number
  avg_consensus_score: number
  for_breakthrough_count: number
  against_breakthrough_count: number
  strongest_category: string | null
  total_topics_analysed: number
}

export interface BreakthroughResponse {
  topics: BreakthroughTopic[]
  categories: CategoryBreakthrough[]
  stats: BreakthroughStats
  generatedAt: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_VOTES = 10
const MAX_RESULTS = 200
const DEFAULT_LIMIT = 30

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Tier classifier ──────────────────────────────────────────────────────────

function classifyTier(consensusScore: number): BreakthroughTier {
  if (consensusScore >= 70) return 'unanimous'  // ≥85% blue_pct or ≤15%
  if (consensusScore >= 40) return 'landmark'   // 70–84%
  if (consensusScore >= 20) return 'clear'      // 60–69%
  return 'forming'                               // 55–59%
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || 'all'
  const tier = searchParams.get('tier') || 'all'
  const direction = searchParams.get('direction') || 'all'
  const sort = searchParams.get('sort') || 'score'
  const limit = Math.min(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10), MAX_RESULTS)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const supabase = await createClient()

  // ── Fetch all topics with enough votes ──────────────────────────────────────
  const query = supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct, updated_at')
    .gte('total_votes', MIN_VOTES)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .limit(MAX_RESULTS)

  const { data: rawTopics, error } = await query

  if (error || !rawTopics) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  // ── Fetch argument counts ────────────────────────────────────────────────────
  const topicIds = rawTopics.map((t) => t.id)
  const { data: argCounts } = await supabase
    .from('arguments')
    .select('topic_id')
    .in('topic_id', topicIds)

  const argCountMap: Record<string, number> = {}
  for (const row of argCounts ?? []) {
    argCountMap[row.topic_id] = (argCountMap[row.topic_id] ?? 0) + 1
  }

  // ── Compute scores and classify ──────────────────────────────────────────────
  const MIN_CONSENSUS = 10 // require at least 5% lead (consensus_score >= 10)

  const scored: BreakthroughTopic[] = rawTopics
    .map((t) => {
      const pct = t.blue_pct ?? 50
      const consensusScore = Math.round(Math.abs(pct - 50) * 2)
      const direction: BreakthroughDirection = pct >= 50 ? 'for' : 'against'
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_votes: t.total_votes,
        blue_pct: pct,
        consensus_score: consensusScore,
        tier: classifyTier(consensusScore),
        direction,
        total_arguments: argCountMap[t.id] ?? 0,
        updated_at: t.updated_at,
      }
    })
    .filter((t) => t.consensus_score >= MIN_CONSENSUS)

  // ── Apply filters ────────────────────────────────────────────────────────────
  let filtered = scored

  if (category !== 'all') {
    filtered = filtered.filter((t) => t.category === category)
  }
  if (tier !== 'all') {
    filtered = filtered.filter((t) => t.tier === tier)
  }
  if (direction !== 'all') {
    filtered = filtered.filter((t) => t.direction === direction)
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  filtered.sort((a, b) => {
    if (sort === 'score') return b.consensus_score - a.consensus_score
    if (sort === 'votes') return b.total_votes - a.total_votes
    if (sort === 'recent') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    if (sort === 'arguments') return b.total_arguments - a.total_arguments
    return b.consensus_score - a.consensus_score
  })

  const topics = filtered.slice(offset, offset + limit)

  // ── Category breakdown (based on all scored topics, before direction/tier filter) ─
  const categoryScoredSubset = category === 'all'
    ? scored
    : scored.filter((t) => t.category === category)

  const catMap: Record<string, CategoryBreakthrough> = {}
  for (const cat of CATEGORIES) {
    catMap[cat] = {
      category: cat,
      topic_count: 0,
      avg_consensus_score: 0,
      unanimous_count: 0,
      landmark_count: 0,
      strongest_topic: null,
      strongest_score: 0,
    }
  }

  for (const t of categoryScoredSubset) {
    const cat = t.category ?? 'Other'
    if (!catMap[cat]) {
      catMap[cat] = {
        category: cat,
        topic_count: 0,
        avg_consensus_score: 0,
        unanimous_count: 0,
        landmark_count: 0,
        strongest_topic: null,
        strongest_score: 0,
      }
    }
    const c = catMap[cat]
    c.topic_count++
    c.avg_consensus_score += t.consensus_score
    if (t.tier === 'unanimous') c.unanimous_count++
    if (t.tier === 'landmark') c.landmark_count++
    if (t.consensus_score > c.strongest_score) {
      c.strongest_score = t.consensus_score
      c.strongest_topic = t.statement.slice(0, 80)
    }
  }

  const categories: CategoryBreakthrough[] = Object.values(catMap)
    .filter((c) => c.topic_count > 0)
    .map((c) => ({
      ...c,
      avg_consensus_score: c.topic_count > 0 ? Math.round(c.avg_consensus_score / c.topic_count) : 0,
    }))
    .sort((a, b) => b.avg_consensus_score - a.avg_consensus_score)

  // ── Platform-wide stats ───────────────────────────────────────────────────────
  const totalScored = scored.length
  const unanimousCount = scored.filter((t) => t.tier === 'unanimous').length
  const landmarkCount = scored.filter((t) => t.tier === 'landmark').length
  const clearCount = scored.filter((t) => t.tier === 'clear').length
  const formingCount = scored.filter((t) => t.tier === 'forming').length
  const forCount = scored.filter((t) => t.direction === 'for').length
  const againstCount = scored.filter((t) => t.direction === 'against').length
  const avgScore = totalScored > 0
    ? Math.round(scored.reduce((s, t) => s + t.consensus_score, 0) / totalScored)
    : 0
  const strongestCat = categories.length > 0 ? categories[0].category : null

  const stats: BreakthroughStats = {
    total_breakthrough_topics: totalScored,
    unanimous_count: unanimousCount,
    landmark_count: landmarkCount,
    clear_count: clearCount,
    forming_count: formingCount,
    avg_consensus_score: avgScore,
    for_breakthrough_count: forCount,
    against_breakthrough_count: againstCount,
    strongest_category: strongestCat,
    total_topics_analysed: rawTopics.length,
  }

  const response: BreakthroughResponse = {
    topics,
    categories,
    stats,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
