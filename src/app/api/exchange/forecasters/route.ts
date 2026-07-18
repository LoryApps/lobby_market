import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecasterStats {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  // Volume
  total_forecasts: number
  resolved_forecasts: number
  pending_forecasts: number
  // Direction accuracy (on resolved markets)
  correct_direction: number
  direction_hit_rate: number | null   // percentage 0-100
  // Price accuracy (on resolved markets)
  avg_accuracy: number | null         // mean of (100 - |target - resolution|)
  avg_composite: number | null        // mean of (accuracy × confidence/5)
  best_accuracy: number | null        // highest single call accuracy
  best_call_statement: string | null  // statement for the best call
  // Profile
  avg_confidence: number | null       // mean confidence submitted
  top_category: string | null
}

export interface ForecastersGlobalStats {
  total_forecasters: number
  total_resolved: number
  avg_direction_hit_rate: number | null
  avg_accuracy: number | null
}

export interface ForecastersResponse {
  forecasters: ForecasterStats[]
  global: ForecastersGlobalStats
  sort: string
  total: number
}

// ─── GET /api/exchange/forecasters ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const sort = searchParams.get('sort') || 'composite'   // composite | accuracy | hit_rate | volume
  const category = searchParams.get('category') || null
  const minResolved = parseInt(searchParams.get('min') || '1', 10)

  // ── 1. Fetch ALL forecasts with topic + profile data ─────────────────────────

  let query = supabase
    .from('exchange_forecasts')
    .select(`
      id,
      user_id,
      topic_id,
      target_price,
      direction,
      confidence,
      created_at,
      profiles!exchange_forecasts_user_id_fkey (
        username,
        display_name,
        avatar_url,
        role
      ),
      topics!exchange_forecasts_topic_id_fkey (
        statement,
        category,
        status
      )
    `)
    .limit(5000)

  if (category) {
    query = query.eq('topics.category', category)
  }

  const { data: rows } = await query

  // ── 2. Aggregate per user ─────────────────────────────────────────────────────

  interface UserAgg {
    profile: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
    total: number
    resolved: number
    pending: number
    correctDir: number
    accuracies: number[]
    composites: number[]
    confidences: number[]
    categories: Record<string, number>
    bestAccuracy: number
    bestStatement: string | null
  }

  const userMap = new Map<string, UserAgg>()

  const getAgg = (uid: string): UserAgg => {
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        profile: null,
        total: 0,
        resolved: 0,
        pending: 0,
        correctDir: 0,
        accuracies: [],
        composites: [],
        confidences: [],
        categories: {},
        bestAccuracy: 0,
        bestStatement: null,
      })
    }
    return userMap.get(uid)!
  }

  for (const row of rows ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics
    if (!profile || !topic) continue

    const uid = row.user_id as string
    const agg = getAgg(uid)

    if (!agg.profile) {
      agg.profile = {
        username: (profile.username ?? '') as string,
        display_name: (profile.display_name ?? null) as string | null,
        avatar_url: (profile.avatar_url ?? null) as string | null,
        role: (profile.role ?? 'person') as string,
      }
    }

    agg.total += 1
    agg.confidences.push(row.confidence as number)

    const cat = (topic.category ?? null) as string | null
    if (cat) agg.categories[cat] = (agg.categories[cat] ?? 0) + 1

    const status = (topic.status ?? '') as string

    if (status === 'law' || status === 'failed') {
      agg.resolved += 1

      const resolutionPrice = status === 'law' ? 100 : 0
      const priceError = Math.abs((row.target_price as number) - resolutionPrice)
      const accuracy = Math.max(0, 100 - priceError)
      const dir = row.direction as string

      const dirCorrect =
        (dir === 'bullish' && status === 'law') ||
        (dir === 'bearish' && status === 'failed') ||
        dir === 'neutral'

      if (dirCorrect) agg.correctDir += 1

      const composite = dirCorrect ? accuracy * ((row.confidence as number) / 5) : 0

      agg.accuracies.push(accuracy)
      agg.composites.push(composite)

      if (accuracy > agg.bestAccuracy) {
        agg.bestAccuracy = accuracy
        agg.bestStatement = (topic.statement ?? null) as string | null
      }
    } else {
      agg.pending += 1
    }
  }

  // ── 3. Build forecaster rows ──────────────────────────────────────────────────

  const forecasters: ForecasterStats[] = []

  for (const [uid, agg] of userMap.entries()) {
    if (!agg.profile) continue
    if (agg.resolved < minResolved) continue

    const dirHitRate = agg.resolved > 0
      ? Math.round((agg.correctDir / agg.resolved) * 100)
      : null

    const avgAccuracy = agg.accuracies.length > 0
      ? Math.round(agg.accuracies.reduce((s, v) => s + v, 0) / agg.accuracies.length)
      : null

    const avgComposite = agg.composites.length > 0
      ? Math.round(agg.composites.reduce((s, v) => s + v, 0) / agg.composites.length * 10) / 10
      : null

    const avgConf = agg.confidences.length > 0
      ? Math.round(agg.confidences.reduce((s, v) => s + v, 0) / agg.confidences.length * 10) / 10
      : null

    const topCategory = Object.entries(agg.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    forecasters.push({
      user_id: uid,
      username: agg.profile.username,
      display_name: agg.profile.display_name,
      avatar_url: agg.profile.avatar_url,
      role: agg.profile.role,
      total_forecasts: agg.total,
      resolved_forecasts: agg.resolved,
      pending_forecasts: agg.pending,
      correct_direction: agg.correctDir,
      direction_hit_rate: dirHitRate,
      avg_accuracy: avgAccuracy,
      avg_composite: avgComposite,
      best_accuracy: agg.bestAccuracy > 0 ? agg.bestAccuracy : null,
      best_call_statement: agg.bestStatement,
      avg_confidence: avgConf,
      top_category: topCategory,
    })
  }

  // ── 4. Sort ───────────────────────────────────────────────────────────────────

  forecasters.sort((a, b) => {
    if (sort === 'accuracy') {
      const diff = (b.avg_accuracy ?? -1) - (a.avg_accuracy ?? -1)
      if (diff !== 0) return diff
      return b.resolved_forecasts - a.resolved_forecasts
    }
    if (sort === 'hit_rate') {
      const diff = (b.direction_hit_rate ?? -1) - (a.direction_hit_rate ?? -1)
      if (diff !== 0) return diff
      return b.resolved_forecasts - a.resolved_forecasts
    }
    if (sort === 'volume') {
      return b.total_forecasts - a.total_forecasts
    }
    // default: composite score
    const diff = (b.avg_composite ?? -1) - (a.avg_composite ?? -1)
    if (diff !== 0) return diff
    return b.resolved_forecasts - a.resolved_forecasts
  })

  const top50 = forecasters.slice(0, 50)

  // ── 5. Global stats ───────────────────────────────────────────────────────────

  const eligibleForStats = forecasters.filter((f) => f.resolved_forecasts >= 1)
  const globalDirHit =
    eligibleForStats.length > 0
      ? Math.round(
          eligibleForStats.reduce((s, f) => s + (f.direction_hit_rate ?? 0), 0) /
            eligibleForStats.length,
        )
      : null
  const globalAccuracy =
    eligibleForStats.length > 0
      ? Math.round(
          eligibleForStats.reduce((s, f) => s + (f.avg_accuracy ?? 0), 0) /
            eligibleForStats.length,
        )
      : null

  const global: ForecastersGlobalStats = {
    total_forecasters: forecasters.length,
    total_resolved: forecasters.reduce((s, f) => s + f.resolved_forecasts, 0),
    avg_direction_hit_rate: globalDirHit,
    avg_accuracy: globalAccuracy,
  }

  return NextResponse.json({
    forecasters: top50,
    global,
    sort,
    total: forecasters.length,
  } satisfies ForecastersResponse)
}
