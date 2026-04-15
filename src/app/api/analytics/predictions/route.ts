import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PredictionRecord {
  id: string
  topic_id: string
  predicted_law: boolean
  confidence: number
  resolved_at: string | null
  correct: boolean | null
  brier_score: number | null
  clout_earned: number
  created_at: string
  updated_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all predictions for this user, most recent first
  const { data: predictionsRaw, error } = await supabase
    .from('topic_predictions')
    .select('id, topic_id, predicted_law, confidence, resolved_at, correct, brier_score, clout_earned, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Failed to load predictions' }, { status: 500 })
  }

  const predictions = predictionsRaw ?? []

  // Batch-fetch topic details
  const topicIds = Array.from(new Set(predictions.map((p) => p.topic_id)))

  const topicMap: Map<string, { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }> = new Map()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)

    for (const t of topics ?? []) {
      topicMap.set(t.id, t as { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number })
    }
  }

  const enriched: PredictionRecord[] = predictions.map((p) => ({
    id: p.id,
    topic_id: p.topic_id,
    predicted_law: p.predicted_law,
    confidence: p.confidence,
    resolved_at: p.resolved_at,
    correct: p.correct,
    brier_score: p.brier_score,
    clout_earned: p.clout_earned,
    created_at: p.created_at,
    updated_at: p.updated_at,
    topic: topicMap.get(p.topic_id) ?? null,
  }))

  return NextResponse.json({ predictions: enriched })
}
