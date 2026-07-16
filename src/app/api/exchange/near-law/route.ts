import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearLawMarket {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  ends_at: string | null
  created_at: string
  // Derived fields
  gap_to_law: number          // percentage points left to reach 67%
  tier: 'imminent' | 'close' | 'approaching'
}

export interface NearLawResponse {
  markets: NearLawMarket[]
  imminent_count: number      // blue_pct >= 65 (within 2pts of law)
  close_count: number         // blue_pct 60–65
  approaching_count: number   // blue_pct 55–60
  total: number
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const minPct   = parseInt(searchParams.get('min') ?? '55', 10)
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, ends_at, created_at')
    .eq('status', 'active')
    .gte('blue_pct', minPct)
    .lt('blue_pct', 67)                     // below the law threshold
    .order('blue_pct', { ascending: false })
    .limit(limit)

  if (category && category !== 'All') {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const markets: NearLawMarket[] = (data ?? []).map((t) => {
    const pct = t.blue_pct ?? 50
    const gap = Math.max(0, 67 - pct)
    const tier: NearLawMarket['tier'] =
      pct >= 65 ? 'imminent' : pct >= 60 ? 'close' : 'approaching'

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: pct,
      total_votes: t.total_votes ?? 0,
      scope: t.scope,
      ends_at: t.ends_at,
      created_at: t.created_at,
      gap_to_law: Math.round(gap * 10) / 10,
      tier,
    }
  })

  return NextResponse.json({
    markets,
    imminent_count:   markets.filter((m) => m.tier === 'imminent').length,
    close_count:      markets.filter((m) => m.tier === 'close').length,
    approaching_count: markets.filter((m) => m.tier === 'approaching').length,
    total: markets.length,
  } satisfies NearLawResponse)
}
