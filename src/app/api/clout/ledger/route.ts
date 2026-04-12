import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CloutTransaction } from '@/lib/supabase/types'

// GET /api/clout/ledger
// Public transaction history. Optional ?user_id=... filters to one user.
// Optional ?limit=... and ?offset=... for pagination (default 50, max 200).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  const rawLimit = Number(url.searchParams.get('limit') ?? '50')
  const rawOffset = Number(url.searchParams.get('offset') ?? '0')
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 200)
    : 50
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0

  let query = supabase
    .from('clout_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load clout ledger' },
      { status: 500 }
    )
  }

  const txs = (rows as CloutTransaction[] | null) ?? []
  const userIds = Array.from(new Set(txs.map((t) => t.user_id)))
  let users: Record<string, unknown> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)
    users = (profiles ?? []).reduce(
      (acc, p) => ({ ...acc, [p.id]: p }),
      {} as Record<string, unknown>
    )
  }

  const enriched = txs.map((tx) => ({
    ...tx,
    user: users[tx.user_id] ?? null,
  }))

  return NextResponse.json({ transactions: enriched })
}
