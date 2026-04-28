import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapsuleTopic {
  id: string
  statement: string
  category: string | null
  status: string
}

export interface CapsuleRow {
  id: string
  user_id: string
  message: string
  topic_id: string | null
  prediction_side: 'pass' | 'fail' | null
  reveal_at: string
  is_revealed: boolean
  outcome: 'correct' | 'wrong' | 'pending' | null
  clout_awarded: number | null
  created_at: string
  topic: CapsuleTopic | null
}

export interface CapsulesResponse {
  sealed: CapsuleRow[]
  revealed: CapsuleRow[]
}

// ─── Clout awarded for a correct prediction ───────────────────────────────────
const CORRECT_PREDICTION_CLOUT = 15

// ─── GET /api/capsules ────────────────────────────────────────────────────────
// Returns the current user's capsules, split into sealed vs revealed.
// Also auto-reveals any capsules whose reveal_at has passed.

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all capsules for this user, joined with topic data
  const { data: rows, error } = await supabase
    .from('civic_capsules')
    .select(`
      id, user_id, message, topic_id, prediction_side,
      reveal_at, is_revealed, outcome, clout_awarded, created_at,
      topic:topics(id, statement, category, status)
    `)
    .eq('user_id', user.id)
    .order('reveal_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const capsules = (rows ?? []) as unknown as CapsuleRow[]
  const now = new Date()

  // Auto-reveal any capsules whose time has come
  const toReveal = capsules.filter(
    (c) => !c.is_revealed && new Date(c.reveal_at) <= now
  )

  for (const capsule of toReveal) {
    let outcome: 'correct' | 'wrong' | 'pending' | null = null
    let clout_awarded: number | null = null

    if (capsule.prediction_side && capsule.topic) {
      const topicStatus = capsule.topic.status
      if (topicStatus === 'law') {
        outcome = capsule.prediction_side === 'pass' ? 'correct' : 'wrong'
      } else if (topicStatus === 'failed') {
        outcome = capsule.prediction_side === 'fail' ? 'correct' : 'wrong'
      } else {
        outcome = 'pending'
      }

      if (outcome === 'correct') {
        clout_awarded = CORRECT_PREDICTION_CLOUT
        // Award clout via RPC (best-effort, don't block reveal on failure)
        await supabase.rpc('gift_clout', {
          sender_id: user.id,
          recipient_id: user.id,
          amount: CORRECT_PREDICTION_CLOUT,
          note: 'Time capsule prediction correct',
        }).then(() => {}).catch(() => {})
      }
    }

    await supabase
      .from('civic_capsules')
      .update({ is_revealed: true, outcome, clout_awarded })
      .eq('id', capsule.id)

    // Update local copy for the response
    capsule.is_revealed = true
    capsule.outcome = outcome
    capsule.clout_awarded = clout_awarded
  }

  const sealed = capsules.filter((c) => !c.is_revealed)
  const revealed = capsules
    .filter((c) => c.is_revealed)
    .sort(
      (a, b) =>
        new Date(b.reveal_at).getTime() - new Date(a.reveal_at).getTime()
    )

  return NextResponse.json({ sealed, revealed } satisfies CapsulesResponse)
}

// ─── POST /api/capsules ───────────────────────────────────────────────────────
// Create a new sealed capsule.

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    message: string
    reveal_at: string
    topic_id?: string | null
    prediction_side?: 'pass' | 'fail' | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, reveal_at, topic_id, prediction_side } = body

  if (!message || typeof message !== 'string' || message.trim().length < 1) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
  if (message.length > 500) {
    return NextResponse.json(
      { error: 'Message must be 500 characters or fewer' },
      { status: 400 }
    )
  }
  if (!reveal_at || new Date(reveal_at) <= new Date()) {
    return NextResponse.json(
      { error: 'reveal_at must be in the future' },
      { status: 400 }
    )
  }
  if (prediction_side && !topic_id) {
    return NextResponse.json(
      { error: 'topic_id required when prediction_side is set' },
      { status: 400 }
    )
  }

  // Cap at 3 months from now
  const maxReveal = new Date()
  maxReveal.setMonth(maxReveal.getMonth() + 3)
  if (new Date(reveal_at) > maxReveal) {
    return NextResponse.json(
      { error: 'reveal_at cannot be more than 3 months from now' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('civic_capsules')
    .insert({
      user_id: user.id,
      message: message.trim(),
      reveal_at,
      topic_id: topic_id ?? null,
      prediction_side: prediction_side ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ capsule: data }, { status: 201 })
}
