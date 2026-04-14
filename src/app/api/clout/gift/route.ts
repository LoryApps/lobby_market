import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/clout/gift
// Body: { recipient_id: string, amount: number, reason?: string }
//
// Calls the `gift_clout` SECURITY DEFINER RPC which atomically:
//   1. Debits the sender's Clout balance
//   2. Credits the recipient's Clout balance
//   3. Writes both ledger entries in clout_transactions
//
// Returns: { success, new_balance, recipient_username }

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    recipient_id?: string
    amount?: number
    reason?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const recipientId =
    typeof body.recipient_id === 'string' ? body.recipient_id.trim() : ''
  const amount =
    typeof body.amount === 'number' ? Math.floor(body.amount) : NaN
  const reason =
    typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''

  if (!recipientId) {
    return NextResponse.json({ error: 'recipient_id is required' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 500) {
    return NextResponse.json(
      { error: 'amount must be between 1 and 500' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.rpc('gift_clout', {
    p_recipient_id: recipientId,
    p_amount: amount,
    p_reason: reason,
  })

  if (error) {
    console.error('[gift_clout] RPC error:', error)
    return NextResponse.json(
      { error: 'Failed to process gift' },
      { status: 500 }
    )
  }

  const result = data as {
    status: string
    new_balance?: number
    balance?: number
    recipient_username?: string
  }

  switch (result.status) {
    case 'ok':
      return NextResponse.json({
        success: true,
        new_balance: result.new_balance ?? 0,
        recipient_username: result.recipient_username,
      })

    case 'unauthorized':
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    case 'self_gift':
      return NextResponse.json(
        { error: 'You cannot gift Clout to yourself' },
        { status: 400 }
      )

    case 'invalid_amount':
      return NextResponse.json(
        { error: 'Amount must be between 1 and 500' },
        { status: 400 }
      )

    case 'insufficient_clout':
      return NextResponse.json(
        {
          error: 'Insufficient Clout',
          balance: result.balance ?? 0,
          requested: amount,
        },
        { status: 402 }
      )

    case 'recipient_not_found':
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      )

    case 'sender_not_found':
      return NextResponse.json(
        { error: 'Your profile was not found' },
        { status: 404 }
      )

    default:
      return NextResponse.json(
        { error: 'Unexpected error' },
        { status: 500 }
      )
  }
}
