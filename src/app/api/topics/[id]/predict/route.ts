import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PredictionRow {
  id: string
  topic_id: string
  user_id: string
  predicted_law: boolean
  confidence: number
  resolved_at: string | null
  correct: boolean | null
  brier_score: number | null
  clout_earned: number
  created_at: string
  updated_at: string
}

interface StatsRow {
  topic_id: string
  total_predictions: number
  law_confidence: number
  updated_at: string
}

// ─── GET /api/topics/[id]/predict ────────────────────────────────────────────
// Returns:
//   - myPrediction: current user's prediction (null if not logged in / not predicted)
//   - stats:        aggregate prediction stats for this topic

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [myPredRes, statsRes] = await Promise.all([
    user
      ? supabase
          .from('topic_predictions')
          .select('*')
          .eq('topic_id', params.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('topic_prediction_stats')
      .select('*')
      .eq('topic_id', params.id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    myPrediction: (myPredRes.data as PredictionRow | null) ?? null,
    stats: (statsRes.data as StatsRow | null) ?? {
      topic_id: params.id,
      total_predictions: 0,
      law_confidence: 50,
      updated_at: new Date().toISOString(),
    },
  })
}

// ─── POST /api/topics/[id]/predict ───────────────────────────────────────────
// Body: { predicted_law: boolean; confidence: number (1–100) }
// Creates or updates the authenticated user's prediction.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { predicted_law?: boolean; confidence?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { predicted_law, confidence } = body

  if (typeof predicted_law !== 'boolean') {
    return NextResponse.json({ error: 'predicted_law must be boolean' }, { status: 400 })
  }
  if (typeof confidence !== 'number' || confidence < 1 || confidence > 100) {
    return NextResponse.json({ error: 'confidence must be 1–100' }, { status: 400 })
  }

  // Verify topic exists and is not yet resolved
  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const terminalStatuses = ['law', 'failed', 'archived']
  if (terminalStatuses.includes(topic.status)) {
    return NextResponse.json(
      { error: 'Cannot predict on a resolved topic' },
      { status: 409 }
    )
  }

  // Upsert prediction
  const { data: prediction, error } = await supabase
    .from('topic_predictions')
    .upsert(
      {
        topic_id: params.id,
        user_id: user.id,
        predicted_law,
        confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'topic_id,user_id' }
    )
    .select('*')
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to save prediction' },
      { status: 500 }
    )
  }

  // Refresh aggregate stats via DB function
  await supabase.rpc('refresh_topic_prediction_stats', { p_topic_id: params.id })

  // Fetch updated stats
  const { data: stats } = await supabase
    .from('topic_prediction_stats')
    .select('*')
    .eq('topic_id', params.id)
    .maybeSingle()

  return NextResponse.json({
    prediction: prediction as PredictionRow,
    stats: stats as StatsRow | null,
  })
}

// ─── DELETE /api/topics/[id]/predict ─────────────────────────────────────────
// Cancels the authenticated user's prediction (only if unresolved).

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('topic_predictions')
    .delete()
    .eq('topic_id', params.id)
    .eq('user_id', user.id)
    .is('resolved_at', null)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to cancel prediction' },
      { status: 500 }
    )
  }

  // Refresh aggregate stats
  await supabase.rpc('refresh_topic_prediction_stats', { p_topic_id: params.id })

  return NextResponse.json({ ok: true })
}
