import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictorRow {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total: number
  correct: number
  accuracy: number
  avg_brier: number | null
  clout_earned: number
  streak: number
  best_category: string | null
  law_bias: number
}

export interface CategoryStat {
  category: string
  total: number
  correct: number
  accuracy: number
}

export interface LeaderboardResponse {
  rows: PredictorRow[]
  total_resolved: number
  platform_accuracy: number
  top_category_stats: CategoryStat[]
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const sort = searchParams.get('sort') ?? 'accuracy'

  // Fetch all resolved predictions with user info
  const { data: predRows, error } = await supabase
    .from('topic_predictions')
    .select(`
      user_id,
      correct,
      brier_score,
      clout_earned,
      predicted_law,
      topic_id
    `)
    .not('resolved_at', 'is', null)
    .not('correct', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = predRows ?? []

  // Aggregate per user
  type UserStats = {
    total: number
    correct: number
    brierSum: number
    clout: number
    lawPredictions: number
    topicIds: Set<string>
  }
  const userMap = new Map<string, UserStats>()
  for (const r of rows) {
    const uid = r.user_id
    const existing = userMap.get(uid) ?? {
      total: 0,
      correct: 0,
      brierSum: 0,
      clout: 0,
      lawPredictions: 0,
      topicIds: new Set(),
    }
    existing.total += 1
    if (r.correct) existing.correct += 1
    if (typeof r.brier_score === 'number') existing.brierSum += r.brier_score
    existing.clout += r.clout_earned ?? 0
    if (r.predicted_law) existing.lawPredictions += 1
    existing.topicIds.add(r.topic_id)
    userMap.set(uid, existing)
  }

  // Filter to users with at least 3 resolved predictions (meaningful sample)
  const qualifiedUserIds = Array.from(userMap.entries())
    .filter(([, s]) => s.total >= 3)
    .map(([uid]) => uid)

  if (qualifiedUserIds.length === 0) {
    return NextResponse.json({
      rows: [],
      total_resolved: rows.length,
      platform_accuracy: 0,
      top_category_stats: [],
    } satisfies LeaderboardResponse)
  }

  // Fetch profiles for qualified users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', qualifiedUserIds)

  const profileMap = new Map<string, {
    username: string; display_name: string | null; avatar_url: string | null; role: string
  }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  // Build ranked rows
  const rankedRows: PredictorRow[] = []
  for (const [uid, stats] of Array.from(userMap.entries())) {
    if (stats.total < 3) continue
    const profile = profileMap.get(uid)
    if (!profile) continue

    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
    const avgBrier = stats.total > 0 ? stats.brierSum / stats.total : null
    const lawBias = stats.total > 0 ? (stats.lawPredictions / stats.total) * 100 : 50

    rankedRows.push({
      rank: 0,
      user_id: uid,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      total: stats.total,
      correct: stats.correct,
      accuracy: Math.round(accuracy * 10) / 10,
      avg_brier: avgBrier !== null ? Math.round(avgBrier * 1000) / 1000 : null,
      clout_earned: stats.clout,
      streak: 0,
      best_category: null,
      law_bias: Math.round(lawBias),
    })
  }

  // Sort
  rankedRows.sort((a, b) => {
    if (sort === 'brier') {
      if (a.avg_brier === null && b.avg_brier === null) return 0
      if (a.avg_brier === null) return 1
      if (b.avg_brier === null) return -1
      return a.avg_brier - b.avg_brier
    }
    if (sort === 'total') return b.total - a.total
    if (sort === 'clout') return b.clout_earned - a.clout_earned
    // Default: accuracy (descending), then total (descending)
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
    return b.total - a.total
  })

  // Assign ranks
  rankedRows.forEach((r, i) => { r.rank = i + 1 })

  // Platform-level stats
  const totalResolved = rows.length
  const platformCorrect = rows.filter((r) => r.correct).length
  const platformAccuracy = totalResolved > 0
    ? Math.round((platformCorrect / totalResolved) * 100 * 10) / 10
    : 0

  // Category stats — pull topic categories for resolved predictions
  const allTopicIds = Array.from(new Set(rows.map((r) => r.topic_id)))
  let topCategoryStats: CategoryStat[] = []
  if (allTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', allTopicIds)

    const catMap = new Map<string, string | null>()
    for (const t of topicRows ?? []) catMap.set(t.id, t.category)

    const catStats = new Map<string, { total: number; correct: number }>()
    for (const r of rows) {
      const cat = catMap.get(r.topic_id) ?? 'Other'
      const existing = catStats.get(cat) ?? { total: 0, correct: 0 }
      existing.total += 1
      if (r.correct) existing.correct += 1
      catStats.set(cat, existing)
    }

    topCategoryStats = Array.from(catStats.entries())
      .filter(([, s]) => s.total >= 5)
      .map(([category, s]) => ({
        category,
        total: s.total,
        correct: s.correct,
        accuracy: Math.round((s.correct / s.total) * 100 * 10) / 10,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }

  return NextResponse.json({
    rows: rankedRows.slice(0, limit),
    total_resolved: totalResolved,
    platform_accuracy: platformAccuracy,
    top_category_stats: topCategoryStats,
  } satisfies LeaderboardResponse)
}
