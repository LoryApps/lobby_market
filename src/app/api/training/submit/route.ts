import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TOTAL_CASES = 20
const PASS_THRESHOLD = 0.8 // 80% accuracy

// POST /api/training/submit
// Body: { correct: boolean }
// Increments the user's training progress. When the module is complete
// (cases_attempted === TOTAL_CASES) and accuracy meets the pass threshold,
// the user is marked as passed.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { correct?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const correct = body.correct === true

  // Find-or-create the training row.
  const { data: existing } = await supabase
    .from('troll_catcher_training')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  let row = existing
  if (!row) {
    const { data: inserted, error: insertError } = await supabase
      .from('troll_catcher_training')
      .insert({
        user_id: user.id,
        cases_attempted: 0,
        cases_correct: 0,
        accuracy_pct: 0,
        passed: false,
      })
      .select()
      .single()

    if (insertError || !inserted) {
      return NextResponse.json(
        {
          error:
            insertError?.message ?? 'Failed to initialize training record',
        },
        { status: 500 }
      )
    }
    row = inserted
  }

  if (row.passed || row.cases_attempted >= TOTAL_CASES) {
    return NextResponse.json({
      training: row,
      complete: true,
      message: row.passed ? 'Already certified' : 'Training already complete',
    })
  }

  const nextAttempted = row.cases_attempted + 1
  const nextCorrect = row.cases_correct + (correct ? 1 : 0)
  const nextAccuracy =
    nextAttempted > 0 ? (nextCorrect / nextAttempted) * 100 : 0
  const isComplete = nextAttempted >= TOTAL_CASES
  const passes = isComplete && nextCorrect / nextAttempted >= PASS_THRESHOLD

  const { data: updated, error: updateError } = await supabase
    .from('troll_catcher_training')
    .update({
      cases_attempted: nextAttempted,
      cases_correct: nextCorrect,
      accuracy_pct: nextAccuracy,
      passed: passes,
      completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Failed to update training record' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    training: updated,
    complete: isComplete,
    passed: passes,
    total_cases: TOTAL_CASES,
  })
}
