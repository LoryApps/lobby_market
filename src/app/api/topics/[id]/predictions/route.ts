import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicPredictor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  predicted_law: boolean
  confidence: number
  reasoning: string | null
  resolved_at: string | null
  correct: boolean | null
  created_at: string
}

export interface ConfidenceBucket {
  label: string      // e.g. "90–100%"
  min: number
  max: number
  law_count: number
  fail_count: number
}

export interface TopicPredictionsResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  market: {
    law_confidence: number     // aggregate % predicting law (0-100)
    total_predictions: number
    law_predictors: number     // count predicting law
    fail_predictors: number    // count predicting fail
    avg_law_confidence: number // avg confidence among law predictors
    avg_fail_confidence: number
  } | null
  predictors: TopicPredictor[]
  distribution: ConfidenceBucket[]
  user_prediction: {
    predicted_law: boolean
    confidence: number
    reasoning: string | null
    resolved_at: string | null
    correct: boolean | null
    clout_earned: number
    created_at: string
  } | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  const { data: { user } } = await supabase.auth.getUser()

  // 1. Fetch topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // 2. Fetch prediction stats for this topic
  const { data: stats } = await supabase
    .from('topic_prediction_stats')
    .select('law_confidence, total_predictions')
    .eq('topic_id', id)
    .maybeSingle()

  // 3. Fetch individual predictions with author profiles (limit 50)
  const { data: predRows } = await supabase
    .from('topic_predictions')
    .select(`
      user_id,
      predicted_law,
      confidence,
      reasoning,
      resolved_at,
      correct,
      clout_earned,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role,
        reputation_score
      )
    `)
    .eq('topic_id', id)
    .order('confidence', { ascending: false })
    .limit(50)

  const allPredictions = (predRows ?? []) as Array<{
    user_id: string
    predicted_law: boolean
    confidence: number
    reasoning: string | null
    resolved_at: string | null
    correct: boolean | null
    clout_earned: number
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      reputation_score: number
    } | null
  }>

  const predictors: TopicPredictor[] = allPredictions
    .filter((p) => p.profiles !== null)
    .map((p) => ({
      user_id: p.user_id,
      username: p.profiles!.username,
      display_name: p.profiles!.display_name,
      avatar_url: p.profiles!.avatar_url,
      role: p.profiles!.role,
      reputation_score: p.profiles!.reputation_score,
      predicted_law: p.predicted_law,
      confidence: p.confidence,
      reasoning: p.reasoning,
      resolved_at: p.resolved_at,
      correct: p.correct,
      created_at: p.created_at,
    }))

  // 4. Compute market aggregates directly from predictions
  const lawPredictors = allPredictions.filter((p) => p.predicted_law)
  const failPredictors = allPredictions.filter((p) => !p.predicted_law)
  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  const market = allPredictions.length > 0 ? {
    law_confidence: stats ? Math.round(Number(stats.law_confidence)) : 50,
    total_predictions: stats?.total_predictions ?? allPredictions.length,
    law_predictors: lawPredictors.length,
    fail_predictors: failPredictors.length,
    avg_law_confidence: avg(lawPredictors.map((p) => p.confidence)),
    avg_fail_confidence: avg(failPredictors.map((p) => p.confidence)),
  } : null

  // 5. Build confidence distribution (10 buckets)
  const BUCKETS: ConfidenceBucket[] = [
    { label: '91–100', min: 91, max: 100, law_count: 0, fail_count: 0 },
    { label: '81–90',  min: 81, max: 90,  law_count: 0, fail_count: 0 },
    { label: '71–80',  min: 71, max: 80,  law_count: 0, fail_count: 0 },
    { label: '61–70',  min: 61, max: 70,  law_count: 0, fail_count: 0 },
    { label: '51–60',  min: 51, max: 60,  law_count: 0, fail_count: 0 },
  ]

  for (const p of allPredictions) {
    const bucket = BUCKETS.find((b) => p.confidence >= b.min && p.confidence <= b.max)
    if (bucket) {
      if (p.predicted_law) bucket.law_count++
      else bucket.fail_count++
    }
  }

  // 6. User's own prediction
  let userPrediction: TopicPredictionsResponse['user_prediction'] = null
  if (user) {
    const { data: myPred } = await supabase
      .from('topic_predictions')
      .select('predicted_law, confidence, reasoning, resolved_at, correct, clout_earned, created_at')
      .eq('topic_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (myPred) {
      userPrediction = myPred as TopicPredictionsResponse['user_prediction']
    }
  }

  return NextResponse.json({
    topic: {
      ...topic,
      blue_pct: Math.round(topic.blue_pct ?? 50),
    },
    market,
    predictors,
    distribution: BUCKETS,
    user_prediction: userPrediction,
  } satisfies TopicPredictionsResponse)
}

// ─── POST: Submit or update a prediction ────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    predicted_law: boolean
    confidence: number
    reasoning?: string
  }

  const { predicted_law, confidence, reasoning } = body
  if (typeof predicted_law !== 'boolean' || confidence < 1 || confidence > 100) {
    return NextResponse.json({ error: 'Invalid prediction data' }, { status: 400 })
  }

  const cleanReasoning = reasoning?.trim().slice(0, 280) || null

  // Check topic exists and is not resolved
  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', params.id)
    .single()

  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  if (topic.status === 'law' || topic.status === 'failed') {
    return NextResponse.json({ error: 'Topic is already resolved' }, { status: 409 })
  }

  const { error } = await supabase
    .from('topic_predictions')
    .upsert({
      topic_id: params.id,
      user_id: user.id,
      predicted_law,
      confidence,
      reasoning: cleanReasoning,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'topic_id,user_id' })

  if (error) {
    console.error('Prediction upsert error:', error)
    return NextResponse.json({ error: 'Failed to save prediction' }, { status: 500 })
  }

  // Refresh stats
  await supabase.rpc('refresh_topic_prediction_stats', { p_topic_id: params.id })

  return NextResponse.json({ ok: true })
}
