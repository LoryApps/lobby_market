import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type AmplitudeTier =
  | 'peak'      // score ≥ 80: overwhelming mandate, near-unanimous community verdict
  | 'ridge'     // score 60–79: strong consensus, decisive community position
  | 'hill'      // score 40–59: moderate amplitude, majority position visible
  | 'plateau'   // score 20–39: low amplitude, opinion still forming
  | 'valley'    // score < 20: near-deadlock, community genuinely divided

export type AmplitudeDirection = 'for' | 'against' | 'contested'

export interface AmplitudeTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  /** pp distance from 50 (0 = deadlock, 50 = unanimous) */
  consensus_gap: number
  /**
   * Amplitude score (0–100):
   *   swing_strength = (|blue_pct − 50| / 50)         — linear distance from deadlock
   *   vote_weight    = log10(total_votes + 1) / log10(MAX_VOTES)
   *   amplitude      = sqrt(swing_strength × vote_weight) × 100
   *
   * Interpretation: High amplitude = the community has moved decisively
   * in one direction AND that verdict is backed by significant vote volume.
   */
  amplitude_score: number
  tier: AmplitudeTier
  direction: AmplitudeDirection
  /** FOR or AGAINST percentage (whichever is higher) */
  dominant_pct: number
}

export interface CategoryAmplitude {
  category: string
  topic_count: number
  avg_score: number
  peak_count: number
  valley_count: number
  loudest: string | null    // statement of highest amplitude topic
  quietest: string | null   // statement of lowest amplitude topic
  avg_blue_pct: number
  direction: AmplitudeDirection
}

export interface AmplitudeStats {
  platform_score: number    // mean amplitude across all topics
  total_topics: number
  peak_count: number
  ridge_count: number
  hill_count: number
  plateau_count: number
  valley_count: number
  for_leaning: number       // count tilting FOR (blue_pct > 52)
  against_leaning: number   // count tilting AGAINST (blue_pct < 48)
  contested: number         // count within 48–52%
  loudest_category: string | null
  quietest_category: string | null
}

export interface AmplitudeResponse {
  topics: AmplitudeTopic[]
  categories: CategoryAmplitude[]
  stats: AmplitudeStats
  generatedAt: string
}

// ─── Tier classification ──────────────────────────────────────────────────────

function scoreTier(score: number): AmplitudeTier {
  if (score >= 80) return 'peak'
  if (score >= 60) return 'ridge'
  if (score >= 40) return 'hill'
  if (score >= 20) return 'plateau'
  return 'valley'
}

function direction(blue_pct: number): AmplitudeDirection {
  if (blue_pct > 52) return 'for'
  if (blue_pct < 48) return 'against'
  return 'contested'
}

// ─── Amplitude score calculation ──────────────────────────────────────────────

const MAX_LOG_VOTES = Math.log10(50_000 + 1) // normalise against a realistic max

function computeAmplitude(total_votes: number, blue_pct: number): number {
  const consensus_gap = Math.abs(blue_pct - 50)
  const swing_strength = consensus_gap / 50          // 0–1
  const vote_weight = Math.log10(total_votes + 1) / MAX_LOG_VOTES  // 0–1

  // Geometric mean of swing and engagement so both matter
  const raw = Math.sqrt(swing_strength * vote_weight)
  return Math.min(100, Math.round(raw * 100))
}

// ─── GET /api/amplitude ───────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct')
    .not('status', 'eq', 'failed')
    .gt('total_votes', 4)       // ignore topics with almost no votes
    .order('total_votes', { ascending: false })
    .limit(300)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topics: AmplitudeTopic[] = (rows ?? []).map((t) => {
    const bp = typeof t.blue_pct === 'number' ? t.blue_pct : 50
    const amp = computeAmplitude(t.total_votes, bp)
    const gap = Math.abs(bp - 50)
    const dir = direction(bp)
    const dominant = dir === 'for' ? bp : dir === 'against' ? 100 - bp : 50

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes,
      blue_pct: bp,
      consensus_gap: Math.round(gap * 10) / 10,
      amplitude_score: amp,
      tier: scoreTier(amp),
      direction: dir,
      dominant_pct: Math.round(dominant * 10) / 10,
    }
  })

  // Sort by amplitude desc
  topics.sort((a, b) => b.amplitude_score - a.amplitude_score)

  // ─── Per-category rollup ──────────────────────────────────────────────────

  const catMap = new Map<string, AmplitudeTopic[]>()
  for (const t of topics) {
    const cat = t.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, [])
    catMap.get(cat)!.push(t)
  }

  const categories: CategoryAmplitude[] = []
  for (const [cat, list] of catMap.entries()) {
    const avgScore = list.reduce((s, t) => s + t.amplitude_score, 0) / list.length
    const avgBp = list.reduce((s, t) => s + t.blue_pct, 0) / list.length
    const sorted = [...list].sort((a, b) => b.amplitude_score - a.amplitude_score)

    const dir: AmplitudeDirection =
      avgBp > 52 ? 'for' : avgBp < 48 ? 'against' : 'contested'

    categories.push({
      category: cat,
      topic_count: list.length,
      avg_score: Math.round(avgScore),
      peak_count: list.filter((t) => t.tier === 'peak').length,
      valley_count: list.filter((t) => t.tier === 'valley').length,
      loudest: sorted[0]?.statement ?? null,
      quietest: sorted[sorted.length - 1]?.statement ?? null,
      avg_blue_pct: Math.round(avgBp * 10) / 10,
      direction: dir,
    })
  }
  categories.sort((a, b) => b.avg_score - a.avg_score)

  // ─── Platform-level stats ─────────────────────────────────────────────────

  const totalTopics = topics.length
  const platformScore =
    totalTopics > 0
      ? Math.round(topics.reduce((s, t) => s + t.amplitude_score, 0) / totalTopics)
      : 0

  const catByScore = [...categories].sort((a, b) => b.avg_score - a.avg_score)

  const stats: AmplitudeStats = {
    platform_score: platformScore,
    total_topics: totalTopics,
    peak_count: topics.filter((t) => t.tier === 'peak').length,
    ridge_count: topics.filter((t) => t.tier === 'ridge').length,
    hill_count: topics.filter((t) => t.tier === 'hill').length,
    plateau_count: topics.filter((t) => t.tier === 'plateau').length,
    valley_count: topics.filter((t) => t.tier === 'valley').length,
    for_leaning: topics.filter((t) => t.direction === 'for').length,
    against_leaning: topics.filter((t) => t.direction === 'against').length,
    contested: topics.filter((t) => t.direction === 'contested').length,
    loudest_category: catByScore[0]?.category ?? null,
    quietest_category: catByScore[catByScore.length - 1]?.category ?? null,
  }

  const response: AmplitudeResponse = {
    topics: topics.slice(0, 100),
    categories,
    stats,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
