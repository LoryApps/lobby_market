import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecasterForecast {
  id: string
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  target_price: number
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  reasoning: string | null
  horizon: string
  created_at: string
  // Resolution data (null if still open)
  resolved_price: number | null
  accuracy: number | null       // 100 - |target - resolved|
  direction_correct: boolean | null
}

export interface CategoryStat {
  category: string
  count: number
  resolved: number
  avg_accuracy: number | null
  direction_hit_rate: number | null
}

export interface ForecasterProfileData {
  profile: {
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    bio: string | null
  }
  stats: {
    total_forecasts: number
    resolved_forecasts: number
    pending_forecasts: number
    correct_direction: number
    direction_hit_rate: number | null
    avg_accuracy: number | null
    avg_composite: number | null
    avg_confidence: number | null
    best_accuracy: number | null
    best_call_statement: string | null
    worst_accuracy: number | null
    worst_call_statement: string | null
    top_category: string | null
    global_rank: number | null
  }
  forecasts: ForecasterForecast[]
  category_breakdown: CategoryStat[]
}

// ─── GET /api/exchange/forecasters/[username] ─────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } },
) {
  const supabase = await createClient()
  const { username } = params

  // 1. Load profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, bio')
    .eq('username', username)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Forecaster not found' }, { status: 404 })
  }

  // 2. Load all their forecasts with topic data
  const { data: rawForecasts } = await supabase
    .from('exchange_forecasts')
    .select(`
      id,
      topic_id,
      target_price,
      direction,
      confidence,
      reasoning,
      horizon,
      created_at,
      topics!exchange_forecasts_topic_id_fkey (
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = rawForecasts ?? []

  // 3. Build forecast objects with computed resolution data
  const forecasts: ForecasterForecast[] = []
  const accuracies: number[] = []
  const composites: number[] = []
  const confidences: number[] = []
  let correctDir = 0
  let resolvedCount = 0
  let pendingCount = 0

  const catMap: Record<string, { count: number; resolved: number; accuracies: number[]; correct: number }> = {}

  for (const row of rows) {
    const topic = row.topics as {
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null

    if (!topic) continue

    const currentPrice = Math.round(topic.blue_pct ?? 50)
    const isResolved = topic.status === 'law' || topic.status === 'failed'
    const resolvedPrice = isResolved ? (topic.status === 'law' ? 100 : 0) : null

    let accuracy: number | null = null
    let directionCorrect: boolean | null = null

    if (isResolved && resolvedPrice !== null) {
      resolvedCount++
      accuracy = Math.max(0, 100 - Math.abs(row.target_price - resolvedPrice))
      accuracies.push(accuracy)
      const composite = accuracy * (row.confidence / 5)
      composites.push(composite)

      // Direction: bullish = expecting higher price, bearish = lower
      const actualDir =
        resolvedPrice > 50 ? 'bullish' : resolvedPrice < 50 ? 'bearish' : 'neutral'
      directionCorrect =
        row.direction === 'neutral'
          ? true
          : row.direction === actualDir

      if (directionCorrect) correctDir++
    } else {
      pendingCount++
    }

    confidences.push(row.confidence)

    const cat = topic.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { count: 0, resolved: 0, accuracies: [], correct: 0 }
    catMap[cat].count++
    if (isResolved && accuracy !== null) {
      catMap[cat].resolved++
      catMap[cat].accuracies.push(accuracy)
      if (directionCorrect) catMap[cat].correct++
    }

    forecasts.push({
      id: row.id,
      topic_id: row.topic_id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_price: currentPrice,
      target_price: row.target_price,
      direction: row.direction as 'bullish' | 'bearish' | 'neutral',
      confidence: row.confidence,
      reasoning: row.reasoning,
      horizon: row.horizon,
      created_at: row.created_at,
      resolved_price: resolvedPrice,
      accuracy,
      direction_correct: directionCorrect,
    })
  }

  // 4. Compute summary stats
  const avgAccuracy =
    accuracies.length > 0
      ? Math.round(accuracies.reduce((s, v) => s + v, 0) / accuracies.length)
      : null
  const avgComposite =
    composites.length > 0
      ? Math.round((composites.reduce((s, v) => s + v, 0) / composites.length) * 10) / 10
      : null
  const avgConfidence =
    confidences.length > 0
      ? Math.round((confidences.reduce((s, v) => s + v, 0) / confidences.length) * 10) / 10
      : null
  const dirHitRate =
    resolvedCount > 0 ? Math.round((correctDir / resolvedCount) * 100) : null

  // Best & worst calls
  const resolvedForecasts = forecasts.filter((f) => f.accuracy !== null)
  resolvedForecasts.sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))
  const bestCall = resolvedForecasts[0] ?? null
  const worstCall = resolvedForecasts[resolvedForecasts.length - 1] ?? null

  // Top category by count
  const topCat =
    Object.entries(catMap).sort((a, b) => b[1].count - a[1].count)[0]?.[0] ?? null

  // 5. Category breakdown
  const categoryBreakdown: CategoryStat[] = Object.entries(catMap)
    .map(([cat, data]) => ({
      category: cat,
      count: data.count,
      resolved: data.resolved,
      avg_accuracy:
        data.accuracies.length > 0
          ? Math.round(data.accuracies.reduce((s, v) => s + v, 0) / data.accuracies.length)
          : null,
      direction_hit_rate:
        data.resolved > 0
          ? Math.round((data.correct / data.resolved) * 100)
          : null,
    }))
    .sort((a, b) => b.count - a.count)

  // 6. Global rank (compare avg_composite vs all forecasters with ≥1 resolved)
  // Lightweight: just count how many users have better composite
  let globalRank: number | null = null
  if (avgComposite !== null && resolvedCount >= 1) {
    const { data: allForecasts } = await supabase
      .from('exchange_forecasts')
      .select('user_id, target_price, confidence, topics!exchange_forecasts_topic_id_fkey(status, blue_pct)')
      .limit(10000)

    if (allForecasts) {
      const userComposites: Record<string, number[]> = {}
      for (const f of allForecasts) {
        const t = f.topics as { status: string; blue_pct: number } | null
        if (!t) continue
        const isResolved = t.status === 'law' || t.status === 'failed'
        if (!isResolved) continue
        const res = t.status === 'law' ? 100 : 0
        const acc = Math.max(0, 100 - Math.abs(f.target_price - res))
        const comp = acc * (f.confidence / 5)
        if (!userComposites[f.user_id]) userComposites[f.user_id] = []
        userComposites[f.user_id].push(comp)
      }
      let rank = 1
      for (const [uid, comps] of Object.entries(userComposites)) {
        if (uid === profile.id) continue
        const avg = comps.reduce((s, v) => s + v, 0) / comps.length
        if (avg > avgComposite) rank++
      }
      globalRank = rank
    }
  }

  return NextResponse.json({
    profile: {
      user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      reputation_score: profile.reputation_score,
      bio: profile.bio,
    },
    stats: {
      total_forecasts: rows.length,
      resolved_forecasts: resolvedCount,
      pending_forecasts: pendingCount,
      correct_direction: correctDir,
      direction_hit_rate: dirHitRate,
      avg_accuracy: avgAccuracy,
      avg_composite: avgComposite,
      avg_confidence: avgConfidence,
      best_accuracy: bestCall?.accuracy ?? null,
      best_call_statement: bestCall?.statement ?? null,
      worst_accuracy: worstCall?.accuracy ?? null,
      worst_call_statement: worstCall?.statement ?? null,
      top_category: topCat,
      global_rank: globalRank,
    },
    forecasts,
    category_breakdown: categoryBreakdown,
  } satisfies ForecasterProfileData)
}
