import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Oracle tier thresholds ───────────────────────────────────────────────────
// Tier is determined by a composite of accuracy and total predictions.

export type OracleTier = 'Novice' | 'Analyst' | 'Forecaster' | 'Oracle' | 'Prophet'

export function getOracleTier(accuracy: number, total: number): OracleTier {
  if (total < 5) return 'Novice'
  if (accuracy >= 80 && total >= 20) return 'Prophet'
  if (accuracy >= 72 && total >= 12) return 'Oracle'
  if (accuracy >= 65 && total >= 8) return 'Forecaster'
  if (accuracy >= 55 && total >= 5) return 'Analyst'
  return 'Novice'
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForecasterSortBy = 'accuracy' | 'total' | 'brier' | 'breadth'

export interface CategoryStat {
  category: string
  total: number
  correct: number
  accuracy: number
}

export interface ForecasterEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  accuracy: number          // 0–100
  total: number             // resolved predictions
  correct: number
  avgBrier: number          // 0.0–1.0, lower = better
  avgConfidence: number     // 0–100
  categoryBreadth: number   // number of distinct categories predicted
  tier: OracleTier
  cloutEarned: number
  categoryStats: CategoryStat[]
  joinedAt: string
}

export interface ForecastersResponse {
  forecasters: ForecasterEntry[]
  total: number
  sort: ForecasterSortBy
  generatedAt: string
  globalStats: {
    totalPredictions: number
    globalAccuracy: number
    avgBrier: number
    qualifiedForecasters: number
  }
}

const MIN_PREDICTIONS = 5   // must have this many resolved to qualify for ranking

export async function GET(req: NextRequest) {
  const sort = (req.nextUrl.searchParams.get('sort') ?? 'accuracy') as ForecasterSortBy
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 100)

  const supabase = await createClient()

  // ── Fetch all resolved predictions ────────────────────────────────────────
  const { data: rawPredictions, error } = await supabase
    .from('topic_predictions')
    .select(
      'user_id, correct, brier_score, confidence, clout_earned, topic_id'
    )
    .not('resolved_at', 'is', null)
    .not('correct', 'is', null)

  if (error) {
    return NextResponse.json({ error: 'Failed to load predictions' }, { status: 500 })
  }

  const predictions = rawPredictions ?? []

  if (predictions.length === 0) {
    return NextResponse.json({
      forecasters: [],
      total: 0,
      sort,
      generatedAt: new Date().toISOString(),
      globalStats: { totalPredictions: 0, globalAccuracy: 0, avgBrier: 0, qualifiedForecasters: 0 },
    } satisfies ForecastersResponse)
  }

  // ── Fetch topic categories for breadth calculation ─────────────────────────
  const topicIds = Array.from(new Set(predictions.map((p) => p.topic_id)))
  const topicCategoryMap = new Map<string, string | null>()

  if (topicIds.length > 0) {
    // Batch in chunks to avoid URL length limits
    const CHUNK = 200
    for (let i = 0; i < topicIds.length; i += CHUNK) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, category')
        .in('id', topicIds.slice(i, i + CHUNK))
      for (const t of topics ?? []) {
        topicCategoryMap.set(t.id, t.category)
      }
    }
  }

  // ── Aggregate per user ─────────────────────────────────────────────────────
  type UserAgg = {
    total: number
    correct: number
    brierSum: number
    brierCount: number
    confSum: number
    cloutTotal: number
    categories: Map<string, { total: number; correct: number }>
  }

  const userMap = new Map<string, UserAgg>()

  for (const p of predictions) {
    let agg = userMap.get(p.user_id)
    if (!agg) {
      agg = { total: 0, correct: 0, brierSum: 0, brierCount: 0, confSum: 0, cloutTotal: 0, categories: new Map() }
      userMap.set(p.user_id, agg)
    }
    agg.total++
    if (p.correct === true) agg.correct++
    if (p.brier_score != null) { agg.brierSum += p.brier_score; agg.brierCount++ }
    agg.confSum += p.confidence ?? 50
    agg.cloutTotal += p.clout_earned ?? 0

    const cat = topicCategoryMap.get(p.topic_id) ?? 'Other'
    const catAgg = agg.categories.get(cat) ?? { total: 0, correct: 0 }
    catAgg.total++
    if (p.correct === true) catAgg.correct++
    agg.categories.set(cat, catAgg)
  }

  // Filter qualified users
  const qualifiedIds = Array.from(userMap.entries())
    .filter(([, agg]) => agg.total >= MIN_PREDICTIONS)
    .map(([id]) => id)

  if (qualifiedIds.length === 0) {
    return NextResponse.json({
      forecasters: [],
      total: 0,
      sort,
      generatedAt: new Date().toISOString(),
      globalStats: {
        totalPredictions: predictions.length,
        globalAccuracy: 0,
        avgBrier: 0,
        qualifiedForecasters: 0,
      },
    } satisfies ForecastersResponse)
  }

  // ── Fetch profiles for qualified users ─────────────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, created_at')
    .in('id', qualifiedIds)

  const profileMap = new Map<string, {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    created_at: string
  }>()

  for (const p of profiles ?? []) {
    profileMap.set(p.id, p as {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      created_at: string
    })
  }

  // ── Build entry list ───────────────────────────────────────────────────────
  const entries: Omit<ForecasterEntry, 'rank'>[] = []

  for (const userId of qualifiedIds) {
    const agg = userMap.get(userId)!
    const profile = profileMap.get(userId)
    if (!profile) continue

    const accuracy = agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0
    const avgBrier = agg.brierCount > 0 ? Math.round((agg.brierSum / agg.brierCount) * 1000) / 1000 : 0.5
    const avgConfidence = agg.total > 0 ? Math.round(agg.confSum / agg.total) : 50
    const categoryBreadth = agg.categories.size

    const categoryStats: CategoryStat[] = Array.from(agg.categories.entries())
      .map(([category, cs]) => ({
        category,
        total: cs.total,
        correct: cs.correct,
        accuracy: cs.total > 0 ? Math.round((cs.correct / cs.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)

    entries.push({
      user_id: userId,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      accuracy,
      total: agg.total,
      correct: agg.correct,
      avgBrier,
      avgConfidence,
      categoryBreadth,
      tier: getOracleTier(accuracy, agg.total),
      cloutEarned: agg.cloutTotal,
      categoryStats,
      joinedAt: profile.created_at,
    })
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = entries.sort((a, b) => {
    switch (sort) {
      case 'accuracy':
        return b.accuracy !== a.accuracy
          ? b.accuracy - a.accuracy
          : b.total - a.total  // tiebreak: more predictions
      case 'total':
        return b.total !== a.total
          ? b.total - a.total
          : b.accuracy - a.accuracy
      case 'brier':
        return a.avgBrier !== b.avgBrier
          ? a.avgBrier - b.avgBrier   // lower is better
          : b.total - a.total
      case 'breadth':
        return b.categoryBreadth !== a.categoryBreadth
          ? b.categoryBreadth - a.categoryBreadth
          : b.accuracy - a.accuracy
      default:
        return b.accuracy - a.accuracy
    }
  })

  const paginated = sorted.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }))

  // ── Global stats ──────────────────────────────────────────────────────────
  const globalCorrect = predictions.filter((p) => p.correct === true).length
  const globalAccuracy = predictions.length > 0
    ? Math.round((globalCorrect / predictions.length) * 100)
    : 0
  const allBriers = predictions.map((p) => p.brier_score).filter((b): b is number => b != null)
  const globalAvgBrier = allBriers.length > 0
    ? Math.round((allBriers.reduce((s, v) => s + v, 0) / allBriers.length) * 1000) / 1000
    : 0.5

  return NextResponse.json({
    forecasters: paginated,
    total: sorted.length,
    sort,
    generatedAt: new Date().toISOString(),
    globalStats: {
      totalPredictions: predictions.length,
      globalAccuracy,
      avgBrier: globalAvgBrier,
      qualifiedForecasters: qualifiedIds.length,
    },
  } satisfies ForecastersResponse)
}
