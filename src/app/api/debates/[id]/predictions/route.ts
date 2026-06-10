import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

export interface DebatePrediction {
  id: string
  debate_id: string
  user_id: string
  predicted_winner: 'for' | 'against' | 'tie'
  predicted_sway: number
  confidence: number
  resolved_at: string | null
  correct_winner: boolean | null
  sway_error: number | null
  clout_earned: number
  created_at: string
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface PredictionStats {
  total: number
  for_pct: number
  against_pct: number
  tie_pct: number
  avg_sway: number
  avg_confidence: number
}

export interface DebatePredictionsResponse {
  debate: {
    id: string
    title: string
    status: string
    scheduled_at: string
    topic_id: string
    topic_statement: string
    topic_blue_pct: number
  }
  predictions: DebatePrediction[]
  stats: PredictionStats
  my_prediction: DebatePrediction | null
  total: number
}

// ── GET /api/debates/[id]/predictions ────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  const supabase = await createClient()
  const debateId = params.id

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch debate info
  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, status, scheduled_at, topic_id')
    .eq('id', debateId)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  // Fetch the topic
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, blue_pct')
    .eq('id', debate.topic_id)
    .maybeSingle()

  // Fetch predictions with profile data
  const { data: rawPreds } = await supabase
    .from('debate_predictions')
    .select(`
      id, debate_id, user_id, predicted_winner, predicted_sway, confidence,
      resolved_at, correct_winner, sway_error, clout_earned, created_at,
      profiles:user_id ( username, display_name, avatar_url, role )
    `)
    .eq('debate_id', debateId)
    .order('created_at', { ascending: false })
    .limit(100)

  const predictions: DebatePrediction[] = (rawPreds ?? []).map((p) => ({
    id: p.id as string,
    debate_id: p.debate_id as string,
    user_id: p.user_id as string,
    predicted_winner: p.predicted_winner as 'for' | 'against' | 'tie',
    predicted_sway: p.predicted_sway as number,
    confidence: p.confidence as number,
    resolved_at: p.resolved_at as string | null,
    correct_winner: p.correct_winner as boolean | null,
    sway_error: p.sway_error as number | null,
    clout_earned: p.clout_earned as number,
    created_at: p.created_at as string,
    profile: p.profiles as DebatePrediction['profile'],
  }))

  // Compute aggregate stats
  const total = predictions.length
  const forCount = predictions.filter((p) => p.predicted_winner === 'for').length
  const againstCount = predictions.filter((p) => p.predicted_winner === 'against').length
  const tieCount = predictions.filter((p) => p.predicted_winner === 'tie').length
  const avgSway = total > 0
    ? Math.round(predictions.reduce((s, p) => s + p.predicted_sway, 0) / total)
    : 0
  const avgConfidence = total > 0
    ? Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / total)
    : 0

  const stats: PredictionStats = {
    total,
    for_pct: total > 0 ? Math.round((forCount / total) * 100) : 0,
    against_pct: total > 0 ? Math.round((againstCount / total) * 100) : 0,
    tie_pct: total > 0 ? Math.round((tieCount / total) * 100) : 0,
    avg_sway: avgSway,
    avg_confidence: avgConfidence,
  }

  const myPrediction = user
    ? predictions.find((p) => p.user_id === user.id) ?? null
    : null

  return NextResponse.json({
    debate: {
      id: debate.id,
      title: debate.title,
      status: debate.status,
      scheduled_at: debate.scheduled_at,
      topic_id: debate.topic_id,
      topic_statement: topic?.statement ?? '',
      topic_blue_pct: topic?.blue_pct ?? 50,
    },
    predictions,
    stats,
    my_prediction: myPrediction,
    total,
  } satisfies DebatePredictionsResponse)
}

// ── POST /api/debates/[id]/predictions ───────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  const supabase = await createClient()
  const debateId = params.id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate debate exists and is still accepting predictions (scheduled only)
  const { data: debate } = await supabase
    .from('debates')
    .select('id, status')
    .eq('id', debateId)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  if (debate.status !== 'scheduled') {
    return NextResponse.json(
      { error: 'Predictions can only be placed on scheduled debates' },
      { status: 400 }
    )
  }

  const body = await req.json() as {
    predicted_winner: string
    predicted_sway: number
    confidence: number
  }

  const { predicted_winner, predicted_sway, confidence } = body

  if (!['for', 'against', 'tie'].includes(predicted_winner)) {
    return NextResponse.json({ error: 'Invalid predicted_winner' }, { status: 400 })
  }
  if (typeof predicted_sway !== 'number' || predicted_sway < -50 || predicted_sway > 50) {
    return NextResponse.json({ error: 'predicted_sway must be between -50 and 50' }, { status: 400 })
  }
  if (typeof confidence !== 'number' || confidence < 1 || confidence > 100) {
    return NextResponse.json({ error: 'confidence must be between 1 and 100' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('debate_predictions')
    .upsert(
      {
        debate_id: debateId,
        user_id: user.id,
        predicted_winner,
        predicted_sway,
        confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'debate_id,user_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prediction: data })
}
