import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_REASON_LENGTH = 200

// POST /api/clout/spend
// Body: { amount, reason, reference_id?, reference_type? }
// Server-side validates balance, writes a negative-amount transaction.
// The `on_clout_transaction` trigger clamps profiles.clout at zero, but we
// pre-check here so the user gets a clean error instead of a silent no-op.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    amount?: number
    reason?: string
    reference_id?: string | null
    reference_type?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const amount =
    typeof body.amount === 'number' ? Math.floor(body.amount) : NaN
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  const referenceId =
    typeof body.reference_id === 'string' && body.reference_id.trim().length > 0
      ? body.reference_id.trim()
      : null
  const referenceType =
    typeof body.reference_type === 'string' &&
    body.reference_type.trim().length > 0
      ? body.reference_type.trim()
      : null

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'amount must be a positive integer' },
      { status: 400 }
    )
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return NextResponse.json(
      { error: `reason must be ${MAX_REASON_LENGTH} characters or fewer` },
      { status: 400 }
    )
  }

  // Read current balance.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, clout')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if ((profile.clout ?? 0) < amount) {
    return NextResponse.json(
      {
        error: 'Insufficient Clout',
        balance: profile.clout ?? 0,
        requested: amount,
      },
      { status: 402 }
    )
  }

  // Record the spend as a negative-amount ledger entry.
  const { data: tx, error: txError } = await supabase
    .from('clout_transactions')
    .insert({
      user_id: user.id,
      type: 'spent',
      amount: -Math.abs(amount),
      reason,
      reference_id: referenceId,
      reference_type: referenceType,
    })
    .select()
    .single()

  if (txError || !tx) {
    return NextResponse.json(
      { error: txError?.message ?? 'Failed to record transaction' },
      { status: 500 }
    )
  }

  // Fetch updated balance.
  const { data: updatedProfile } = await supabase
    .from('profiles')
    .select('id, clout')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    success: true,
    transaction: tx,
    balance: updatedProfile?.clout ?? 0,
  })
}
