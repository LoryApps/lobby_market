import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface MarketTopic {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  law_confidence: number   // 0-100: crowd % predicting law
  total_predictions: number
  user_prediction: {
    predicted_law: boolean
    confidence: number
    resolved_at: string | null
    correct: boolean | null
    brier_score: number | null
    clout_earned: number
  } | null
}

export interface MarketStats {
  total_active_markets: number
  total_predictions_today: number
  avg_accuracy: number | null  // platform-wide
  top_predictor: { username: string; display_name: string | null; accuracy: number } | null
}

export interface MarketResponse {
  leading: MarketTopic[]    // law_confidence ≥ 65%
  contested: MarketTopic[]  // 40% < law_confidence < 65%
  longshots: MarketTopic[]  // law_confidence ≤ 40%
  stats: MarketStats
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. Fetch active prediction markets (topics with prediction stats, non-terminal)
  const { data: statsRows } = await supabase
    .from('topic_prediction_stats')
    .select('topic_id, law_confidence, total_predictions')
    .gt('total_predictions', 0)
    .order('total_predictions', { ascending: false })
    .limit(200)

  const stats = statsRows ?? []
  const topicIds = stats.map((s) => s.topic_id)

  if (topicIds.length === 0) {
    return NextResponse.json({
      leading: [],
      contested: [],
      longshots: [],
      stats: { total_active_markets: 0, total_predictions_today: 0, avg_accuracy: null, top_predictor: null },
    } satisfies MarketResponse)
  }

  // 2. Fetch topic details
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)
    .not('status', 'in', '("law","failed","archived")')  // only live markets

  const topicMap = new Map(
    (topicsRaw ?? []).map((t) => [t.id, t as {
      id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number
    }])
  )

  // 3. Fetch user's predictions on these topics (if logged in)
  const userPredMap = new Map<string, {
    predicted_law: boolean; confidence: number; resolved_at: string | null;
    correct: boolean | null; brier_score: number | null; clout_earned: number
  }>()

  if (user) {
    const { data: userPreds } = await supabase
      .from('topic_predictions')
      .select('topic_id, predicted_law, confidence, resolved_at, correct, brier_score, clout_earned')
      .eq('user_id', user.id)
      .in('topic_id', topicIds)

    for (const p of userPreds ?? []) {
      userPredMap.set(p.topic_id, {
        predicted_law: p.predicted_law,
        confidence: p.confidence,
        resolved_at: p.resolved_at,
        correct: p.correct,
        brier_score: p.brier_score,
        clout_earned: p.clout_earned,
      })
    }
  }

  // 4. Build market topics (only live topics)
  const markets: MarketTopic[] = stats
    .filter((s) => topicMap.has(s.topic_id))
    .map((s) => {
      const t = topicMap.get(s.topic_id)!
      return {
        topic_id: s.topic_id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: Math.round(t.blue_pct ?? 50),
        total_votes: t.total_votes,
        law_confidence: Math.round(Number(s.law_confidence)),
        total_predictions: s.total_predictions,
        user_prediction: userPredMap.get(s.topic_id) ?? null,
      }
    })

  // 5. Categorise into buckets
  const leading  = markets.filter((m) => m.law_confidence >= 65).slice(0, 20)
  const contested = markets.filter((m) => m.law_confidence > 40 && m.law_confidence < 65)
    .sort((a, b) => Math.abs(a.law_confidence - 50) - Math.abs(b.law_confidence - 50))
    .slice(0, 20)
  const longshots = markets.filter((m) => m.law_confidence <= 40)
    .sort((a, b) => b.total_predictions - a.total_predictions)
    .slice(0, 20)

  // 6. Platform-level stats
  // Today's prediction count
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [{ count: predsTodayCount }, platformAccuracyRes] = await Promise.all([
    supabase
      .from('topic_predictions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('topic_predictions')
      .select('correct')
      .not('correct', 'is', null)
      .limit(5000),
  ])

  const resolvedPreds = platformAccuracyRes.data ?? []
  const correct = resolvedPreds.filter((p) => p.correct).length
  const avgAccuracy = resolvedPreds.length > 0
    ? Math.round((correct / resolvedPreds.length) * 100)
    : null

  // Top predictor (min 5 resolved)
  const MIN_RESOLVED = 5
  interface PredAgg { correct: number; total: number }
  const predByUser: Record<string, PredAgg> = {}
  for (const p of resolvedPreds as { correct: boolean | null }[]) {
    // We don't have user_id here – skip top predictor computation
    void p
  }
  // Fetch per-user accuracy from profiles (reputation_score is a proxy)
  const { data: topPredictorRows } = await supabase
    .from('topic_predictions')
    .select('user_id, correct')
    .not('correct', 'is', null)
    .limit(10000)

  for (const p of topPredictorRows ?? []) {
    if (!predByUser[p.user_id]) predByUser[p.user_id] = { correct: 0, total: 0 }
    predByUser[p.user_id].total++
    if (p.correct) predByUser[p.user_id].correct++
  }

  const qualifiedPredictors = Object.entries(predByUser)
    .filter(([, a]) => a.total >= MIN_RESOLVED)
    .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))

  let topPredictor: MarketStats['top_predictor'] = null
  if (qualifiedPredictors.length > 0) {
    const [topUserId, topAgg] = qualifiedPredictors[0]
    const { data: topProfile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', topUserId)
      .maybeSingle()
    if (topProfile) {
      topPredictor = {
        username: topProfile.username,
        display_name: topProfile.display_name,
        accuracy: Math.round((topAgg.correct / topAgg.total) * 100),
      }
    }
  }

  return NextResponse.json({
    leading,
    contested,
    longshots,
    stats: {
      total_active_markets: markets.length,
      total_predictions_today: predsTodayCount ?? 0,
      avg_accuracy: avgAccuracy,
      top_predictor: topPredictor,
    },
  } satisfies MarketResponse)
}
