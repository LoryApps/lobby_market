import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopPredictor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_predictions: number
  correct_predictions: number
  accuracy_pct: number
  avg_brier: number | null
  clout_earned: number
  rank: number
}

export interface RecentResolution {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_predictors: number
  correct_predictors: number
  accuracy_pct: number
  law_confidence: number
  resolved_at: string
}

export interface PredictionsLeaderboardResponse {
  topByAccuracy: TopPredictor[]
  topByVolume: TopPredictor[]
  topByClout: TopPredictor[]
  recentResolutions: RecentResolution[]
  platformStats: {
    total_predictions: number
    resolved_predictions: number
    correct_predictions: number
    platform_accuracy_pct: number
    total_predictors: number
    avg_brier: number | null
    topics_with_predictions: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // ── Per-user prediction aggregates ──────────────────────────────────────────
  const { data: rawAgg } = await supabase
    .from('topic_predictions')
    .select('user_id, correct, brier_score, clout_earned')
    .not('resolved_at', 'is', null)

  type PredAgg = {
    total: number
    correct: number
    brier_sum: number
    brier_count: number
    clout: number
  }

  const userAgg: Map<string, PredAgg> = new Map()

  for (const row of rawAgg ?? []) {
    const uid = row.user_id as string
    if (!userAgg.has(uid)) {
      userAgg.set(uid, { total: 0, correct: 0, brier_sum: 0, brier_count: 0, clout: 0 })
    }
    const agg = userAgg.get(uid)!
    agg.total += 1
    if (row.correct === true) agg.correct += 1
    if (row.brier_score !== null) {
      agg.brier_sum += row.brier_score as number
      agg.brier_count += 1
    }
    agg.clout += (row.clout_earned as number) ?? 0
  }

  // Fetch profiles for all predictors
  const predictorIds = Array.from(userAgg.keys())

  let profiles: Array<{
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }> = []

  if (predictorIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', predictorIds)
    profiles = (data ?? []) as typeof profiles
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  // Build ranked list — require ≥ 3 resolved predictions for accuracy ranking
  const predictorList: Omit<TopPredictor, 'rank'>[] = []

  for (const [uid, agg] of userAgg) {
    const profile = profileMap.get(uid)
    if (!profile) continue
    if (agg.total < 1) continue

    predictorList.push({
      user_id: uid,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      total_predictions: agg.total,
      correct_predictions: agg.correct,
      accuracy_pct: agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
      avg_brier:
        agg.brier_count > 0
          ? Math.round((agg.brier_sum / agg.brier_count) * 1000) / 1000
          : null,
      clout_earned: agg.clout,
    })
  }

  // Top by accuracy — min 3 resolved predictions
  const topByAccuracy: TopPredictor[] = predictorList
    .filter((p) => p.total_predictions >= 3)
    .sort((a, b) => {
      if (b.accuracy_pct !== a.accuracy_pct) return b.accuracy_pct - a.accuracy_pct
      return a.avg_brier !== null && b.avg_brier !== null
        ? a.avg_brier - b.avg_brier
        : b.total_predictions - a.total_predictions
    })
    .slice(0, 50)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  // Top by volume — most predictions made
  const topByVolume: TopPredictor[] = [...predictorList]
    .sort((a, b) => b.total_predictions - a.total_predictions || b.accuracy_pct - a.accuracy_pct)
    .slice(0, 50)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  // Top by clout earned — from prediction rewards
  const topByClout: TopPredictor[] = predictorList
    .filter((p) => p.clout_earned > 0)
    .sort((a, b) => b.clout_earned - a.clout_earned)
    .slice(0, 50)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  // ── Recent topic resolutions ─────────────────────────────────────────────────
  const { data: recentTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct')
    .in('status', ['law', 'failed'])
    .order('updated_at', { ascending: false })
    .limit(30)

  const recentTopicIds = (recentTopics ?? []).map((t) => t.id as string)

  // Get prediction stats for these topics
  const { data: predStats } = await supabase
    .from('topic_prediction_stats')
    .select('topic_id, total_predictions, law_confidence, updated_at')
    .in('topic_id', recentTopicIds)

  const statMap = new Map(
    (predStats ?? []).map((s) => [
      s.topic_id as string,
      { total: s.total_predictions as number, lawConf: s.law_confidence as number, updatedAt: s.updated_at as string },
    ])
  )

  // Get per-topic correct count from raw aggregation
  const { data: resolvedPreds } = await supabase
    .from('topic_predictions')
    .select('topic_id, correct')
    .in('topic_id', recentTopicIds)
    .not('resolved_at', 'is', null)

  const topicCorrectMap: Map<string, { total: number; correct: number }> = new Map()
  for (const p of resolvedPreds ?? []) {
    const tid = p.topic_id as string
    if (!topicCorrectMap.has(tid)) topicCorrectMap.set(tid, { total: 0, correct: 0 })
    const entry = topicCorrectMap.get(tid)!
    entry.total += 1
    if (p.correct === true) entry.correct += 1
  }

  const recentResolutions: RecentResolution[] = (recentTopics ?? [])
    .filter((t) => {
      const s = statMap.get(t.id as string)
      return s && s.total > 0
    })
    .slice(0, 10)
    .map((t) => {
      const s = statMap.get(t.id as string)!
      const c = topicCorrectMap.get(t.id as string) ?? { total: 0, correct: 0 }
      return {
        topic_id: t.id as string,
        statement: t.statement as string,
        category: t.category as string | null,
        status: t.status as string,
        blue_pct: t.blue_pct as number,
        total_predictors: s.total,
        correct_predictors: c.correct,
        accuracy_pct: c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0,
        law_confidence: s.lawConf,
        resolved_at: s.updatedAt,
      }
    })

  // ── Platform-wide stats ──────────────────────────────────────────────────────
  const allResolved = rawAgg ?? []
  const totalResolved = allResolved.length
  const totalCorrect = allResolved.filter((p) => p.correct === true).length
  const allBrier = allResolved
    .map((p) => p.brier_score as number | null)
    .filter((b): b is number => b !== null)
  const avgBrier =
    allBrier.length > 0
      ? Math.round((allBrier.reduce((s, b) => s + b, 0) / allBrier.length) * 1000) / 1000
      : null

  const { count: totalPreds } = await supabase
    .from('topic_predictions')
    .select('id', { count: 'exact', head: true })

  const { count: topicsWithPreds } = await supabase
    .from('topic_prediction_stats')
    .select('topic_id', { count: 'exact', head: true })
    .gt('total_predictions', 0)

  const platformStats = {
    total_predictions: totalPreds ?? 0,
    resolved_predictions: totalResolved,
    correct_predictions: totalCorrect,
    platform_accuracy_pct:
      totalResolved > 0 ? Math.round((totalCorrect / totalResolved) * 100) : 0,
    total_predictors: userAgg.size,
    avg_brier: avgBrier,
    topics_with_predictions: topicsWithPreds ?? 0,
  }

  const response: PredictionsLeaderboardResponse = {
    topByAccuracy,
    topByVolume,
    topByClout,
    recentResolutions,
    platformStats,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}
