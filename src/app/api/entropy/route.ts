import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10-min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntropyTier =
  | 'schism'   // entropy ≥ 80: maximum democratic uncertainty
  | 'discord'  // entropy 60–79: highly contested, no clear direction
  | 'contest'  // entropy 40–59: genuine disagreement
  | 'lean'     // entropy 20–39: direction forming but not settled
  | 'resolve'  // entropy < 20: clear majority opinion

export interface EntropyTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  /** Shannon entropy (0–1): 1 = perfect 50/50, 0 = unanimous */
  entropy: number
  /** entropy × log-volume weight → 0–100 composite score */
  entropy_score: number
  tier: EntropyTier
  /** Distance from 50/50 split in percentage points (0 = deadlock) */
  consensus_gap: number
  total_arguments: number
}

export interface CategoryEntropy {
  category: string
  topic_count: number
  avg_entropy: number
  avg_score: number
  schism_count: number
  resolve_count: number
  most_contested: string | null
  clearest: string | null
}

export interface EntropyStats {
  platform_entropy: number
  total_topics: number
  schism_count: number
  discord_count: number
  contest_count: number
  lean_count: number
  resolve_count: number
  avg_consensus_gap: number
  most_contested_category: string | null
  clearest_category: string | null
}

export interface EntropyResponse {
  topics: EntropyTopic[]
  categories: CategoryEntropy[]
  stats: EntropyStats
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

// ─── Math ─────────────────────────────────────────────────────────────────────

/**
 * Shannon entropy for a binary split.
 * H = -p*log2(p) - (1-p)*log2(1-p), normalised to [0, 1].
 * Maximum (1.0) at p = 0.5; zero at p = 0 or p = 1.
 */
function shannonEntropy(bluePct: number): number {
  const p = Math.max(0.001, Math.min(0.999, bluePct / 100))
  const q = 1 - p
  // Max possible entropy for a binary system = 1 bit = log2(2) = 1
  return -(p * Math.log2(p) + q * Math.log2(q))
}

/** Volume weight: log10(votes) / log10(MAX_VOTES), clamped [0, 1] */
function volumeWeight(votes: number, maxVotes: number): number {
  if (votes < MIN_VOTES) return 0
  const MAX_LOG = Math.log10(Math.max(maxVotes, 1000))
  return Math.min(1, Math.log10(votes) / MAX_LOG)
}

function toTier(score: number): EntropyTier {
  if (score >= 80) return 'schism'
  if (score >= 60) return 'discord'
  if (score >= 40) return 'contest'
  if (score >= 20) return 'lean'
  return 'resolve'
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sort    = searchParams.get('sort')    ?? 'score'   // score | entropy | votes | gap
  const category = searchParams.get('category') ?? null
  const tier     = searchParams.get('tier')     ?? null
  const limit    = Math.min(MAX_RESULTS, Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_LIMIT)))

  const supabase = await createClient()

  // ── 1. Fetch topics ───────────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .gte('total_votes', MIN_VOTES)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .order('total_votes', { ascending: false })
    .limit(MAX_RESULTS)

  if (category) query = query.eq('category', category)

  const { data: topics, error } = await query

  if (error || !topics) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  // ── 2. Fetch argument counts ──────────────────────────────────────────────
  const topicIds = topics.map((t) => t.id)
  const { data: argRows } = topicIds.length > 0
    ? await supabase
        .from('topic_arguments')
        .select('topic_id')
        .in('topic_id', topicIds)
    : { data: [] }

  const argCount: Record<string, number> = {}
  for (const row of (argRows ?? [])) {
    argCount[row.topic_id] = (argCount[row.topic_id] ?? 0) + 1
  }

  // ── 3. Score topics ───────────────────────────────────────────────────────
  const maxVotes = topics.reduce((m, t) => Math.max(m, t.total_votes ?? 0), 0)

  let scored: EntropyTopic[] = topics.map((t) => {
    const bluePct = t.blue_pct ?? 50
    const votes = t.total_votes ?? 0
    const entropy = shannonEntropy(bluePct)
    const vol = volumeWeight(votes, maxVotes)
    const entropyScore = Math.round(entropy * vol * 100)
    const consensusGap = Math.abs(bluePct - 50)

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: votes,
      blue_pct: bluePct,
      entropy: Math.round(entropy * 1000) / 1000,
      entropy_score: entropyScore,
      tier: toTier(entropyScore),
      consensus_gap: Math.round(consensusGap * 10) / 10,
      total_arguments: argCount[t.id] ?? 0,
    }
  })

  // ── 4. Filter by tier ─────────────────────────────────────────────────────
  if (tier && ['schism', 'discord', 'contest', 'lean', 'resolve'].includes(tier)) {
    scored = scored.filter((t) => t.tier === tier)
  }

  // ── 5. Sort ───────────────────────────────────────────────────────────────
  if (sort === 'entropy') {
    scored.sort((a, b) => b.entropy - a.entropy)
  } else if (sort === 'votes') {
    scored.sort((a, b) => b.total_votes - a.total_votes)
  } else if (sort === 'gap') {
    scored.sort((a, b) => a.consensus_gap - b.consensus_gap) // ascending: closest to 50/50 first
  } else {
    // default: composite entropy_score descending
    scored.sort((a, b) => b.entropy_score - a.entropy_score)
  }

  const paginated = scored.slice(0, limit)

  // ── 6. Category rollup ────────────────────────────────────────────────────
  const categoryStats: CategoryEntropy[] = []
  for (const cat of CATEGORIES) {
    const catTopics = scored.filter((t) => t.category === cat)
    if (catTopics.length === 0) continue
    const avgEntropy =
      catTopics.reduce((s, t) => s + t.entropy, 0) / catTopics.length
    const avgScore =
      catTopics.reduce((s, t) => s + t.entropy_score, 0) / catTopics.length
    const byEntropy = [...catTopics].sort((a, b) => b.entropy - a.entropy)
    const byGap = [...catTopics].sort((a, b) => b.consensus_gap - a.consensus_gap)
    categoryStats.push({
      category: cat,
      topic_count: catTopics.length,
      avg_entropy: Math.round(avgEntropy * 1000) / 1000,
      avg_score: Math.round(avgScore),
      schism_count: catTopics.filter((t) => t.tier === 'schism').length,
      resolve_count: catTopics.filter((t) => t.tier === 'resolve').length,
      most_contested: byEntropy[0]?.statement.slice(0, 72) ?? null,
      clearest: byGap[0]?.statement.slice(0, 72) ?? null,
    })
  }
  categoryStats.sort((a, b) => b.avg_score - a.avg_score)

  // ── 7. Platform stats ─────────────────────────────────────────────────────
  const total = scored.length
  const platformEntropy =
    total > 0
      ? Math.round((scored.reduce((s, t) => s + t.entropy, 0) / total) * 1000) / 1000
      : 0
  const avgGap =
    total > 0
      ? Math.round((scored.reduce((s, t) => s + t.consensus_gap, 0) / total) * 10) / 10
      : 0

  const catByEntropy = [...categoryStats].sort((a, b) => b.avg_entropy - a.avg_entropy)
  const catByClarity = [...categoryStats].sort((a, b) => a.avg_entropy - b.avg_entropy)

  const stats: EntropyStats = {
    platform_entropy: platformEntropy,
    total_topics: total,
    schism_count:  scored.filter((t) => t.tier === 'schism').length,
    discord_count: scored.filter((t) => t.tier === 'discord').length,
    contest_count: scored.filter((t) => t.tier === 'contest').length,
    lean_count:    scored.filter((t) => t.tier === 'lean').length,
    resolve_count: scored.filter((t) => t.tier === 'resolve').length,
    avg_consensus_gap: avgGap,
    most_contested_category: catByEntropy[0]?.category ?? null,
    clearest_category: catByClarity[0]?.category ?? null,
  }

  return NextResponse.json({
    topics: paginated,
    categories: categoryStats,
    stats,
    generatedAt: new Date().toISOString(),
  } satisfies EntropyResponse)
}
