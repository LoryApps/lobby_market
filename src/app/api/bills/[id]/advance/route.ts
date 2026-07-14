import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STAGE_ORDER = [
  'first_reading',
  'second_reading',
  'committee_stage',
  'report_stage',
  'third_reading',
  'lords',
  'royal_assent',
]

const STAGE_DATE_FIELD: Record<string, string> = {
  second_reading:  'second_reading_at',
  committee_stage: 'committee_at',
  report_stage:    'report_at',
  third_reading:   'third_reading_at',
  lords:           'lords_at',
  royal_assent:    'royal_assent_at',
}

const VOTE_READING_STAGES = new Set(['second_reading', 'third_reading'])

// ─── PATCH /api/bills/[id]/advance ───────────────────────────────────────────
// Body: { action: 'advance' | 'defeat' | 'withdraw' | 'lords_pass' | 'lords_reject' }
// Only the bill sponsor (or an elder) may call this.

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch bill (includes sponsor_id + current tallies)
  const { data: bill, error: billErr } = await supabase
    .from('civic_bills')
    .select('id, stage, status, sponsor_id, votes_for, votes_against')
    .eq('id', params.id)
    .single()

  if (billErr || !bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  }

  // Permission: sponsor OR elder role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSponsor = bill.sponsor_id === user.id
  const isElder   = profile?.role === 'elder' || profile?.role === 'troll_catcher'

  if (!isSponsor && !isElder) {
    return NextResponse.json({ error: 'Only the bill sponsor can advance this bill' }, { status: 403 })
  }

  // Terminal stages cannot be advanced
  if (['royal_assent', 'defeated', 'withdrawn'].includes(bill.stage)) {
    return NextResponse.json({ error: 'This bill has already concluded' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string }
  const action = body.action ?? 'advance'

  const now = new Date().toISOString()
  let updates: Record<string, unknown>

  if (action === 'withdraw') {
    updates = { stage: 'withdrawn', status: 'withdrawn' }

  } else if (action === 'defeat' || action === 'lords_reject') {
    updates = { stage: 'defeated', status: 'defeated', defeated_at: now }

  } else if (action === 'lords_pass') {
    updates = {
      stage:           'royal_assent',
      status:          'enacted',
      royal_assent_at: now,
    }

  } else {
    // action === 'advance' (default)
    const currentIdx = STAGE_ORDER.indexOf(bill.stage)
    if (currentIdx < 0 || currentIdx >= STAGE_ORDER.length - 1) {
      return NextResponse.json({ error: 'Cannot advance from this stage' }, { status: 400 })
    }

    // At reading stages, derive outcome from votes
    if (VOTE_READING_STAGES.has(bill.stage)) {
      const total = bill.votes_for + bill.votes_against
      if (total > 0 && bill.votes_for <= bill.votes_against) {
        // Bill defeated by the vote
        const { data: updated, error: updateErr } = await supabase
          .from('civic_bills')
          .update({ stage: 'defeated', status: 'defeated', defeated_at: now })
          .eq('id', params.id)
          .select('stage, status, second_reading_at, committee_at, report_at, third_reading_at, lords_at, royal_assent_at, defeated_at')
          .single()

        if (updateErr) {
          return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
        }
        return NextResponse.json({ ...updated, outcome: 'defeated' })
      }
    }

    const nextStage = STAGE_ORDER[currentIdx + 1]
    const dateField = STAGE_DATE_FIELD[nextStage]
    updates = {
      stage:  nextStage,
      status: nextStage === 'royal_assent' ? 'enacted' : 'progressing',
      ...(dateField ? { [dateField]: now } : {}),
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from('civic_bills')
    .update(updates)
    .eq('id', params.id)
    .select('stage, status, second_reading_at, committee_at, report_at, third_reading_at, lords_at, royal_assent_at, defeated_at')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to advance bill' }, { status: 500 })
  }

  return NextResponse.json({ ...updated, outcome: updated?.stage === 'defeated' ? 'defeated' : 'advanced' })
}
