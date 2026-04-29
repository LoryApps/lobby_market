import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// PATCH /api/capsules/[id]/reveal
// Marks a single capsule as revealed if its reveal_at has passed.
// Returns the updated capsule.

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: capsule, error: fetchError } = await supabase
    .from('civic_capsules')
    .select('*, topic:topics(id, statement, status)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !capsule) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (capsule.is_revealed) {
    return NextResponse.json({ capsule })
  }

  if (new Date(capsule.reveal_at) > new Date()) {
    return NextResponse.json(
      { error: 'Capsule is not yet ready to be revealed' },
      { status: 400 }
    )
  }

  // Score the prediction if applicable
  let outcome: 'correct' | 'wrong' | 'pending' | null = null
  let clout_awarded: number | null = null

  if (capsule.prediction_side && capsule.topic) {
    const status = capsule.topic.status
    if (status === 'law') {
      outcome = capsule.prediction_side === 'pass' ? 'correct' : 'wrong'
    } else if (status === 'failed') {
      outcome = capsule.prediction_side === 'fail' ? 'correct' : 'wrong'
    } else {
      outcome = 'pending'
    }

    if (outcome === 'correct') {
      clout_awarded = 15
      await supabase
        .rpc('gift_clout', {
          sender_id: user.id,
          recipient_id: user.id,
          amount: 15,
          note: 'Time capsule prediction correct',
        })
        .then(() => {})
        .catch(() => {})
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('civic_capsules')
    .update({ is_revealed: true, outcome, clout_awarded })
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ capsule: updated })
}
