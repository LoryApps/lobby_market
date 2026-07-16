import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Trade {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  side: 'blue' | 'red'
  topic_id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
  voted_at: string
}

export interface TradeStats {
  trades_24h: number
  active_markets_24h: number
  unique_traders_24h: number
  for_pct: number
  against_pct: number
  busiest_category: string | null
}

export interface TradesResponse {
  trades: Trade[]
  stats: TradeStats
  as_of: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const category = searchParams.get('category') || null
  const side = searchParams.get('side') || null
  const limit = Math.min(parseInt(searchParams.get('limit') || '80', 10), 200)
  const before = searchParams.get('before') || null

  // ── Recent trades ─────────────────────────────────────────────────────────
  let query = supabase
    .from('votes')
    .select(
      `
      id,
      user_id,
      side,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url
      ),
      topics:topic_id (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `,
    )
    .not('topics.status', 'in', '("proposed","failed")')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('topics.category', category)
  }
  if (side) {
    query = query.eq('side', side)
  }
  if (before) {
    query = query.lt('created_at', before)
  }

  const { data: rows, error: votesErr } = await query

  if (votesErr) {
    console.error('[trades] votes query failed:', votesErr)
    return NextResponse.json({ error: 'Failed to load trades' }, { status: 500 })
  }

  // ── 24-hour stats ─────────────────────────────────────────────────────────
  const since24h = new Date(Date.now() - 86_400_000).toISOString()

  const [statsRes, catRes] = await Promise.all([
    supabase.rpc('exchange_trade_stats', { since: since24h }).maybeSingle(),
    supabase
      .from('votes')
      .select('topics:topic_id(category)')
      .gte('created_at', since24h)
      .not('topics.status', 'in', '("proposed","failed")')
      .limit(1000),
  ])

  // Compute busiest category from catRes rows
  const catCounts: Record<string, number> = {}
  if (catRes.data) {
    for (const row of catRes.data as Array<{ topics: { category: string | null } | null }>) {
      const cat = row.topics?.category
      if (cat) catCounts[cat] = (catCounts[cat] ?? 0) + 1
    }
  }
  const busiestCategory =
    Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

  // Fall back to manual count if RPC not available
  let stats: TradeStats
  if (statsRes.error || !statsRes.data) {
    const statsQuery = await supabase
      .from('votes')
      .select('id, side, user_id, topic_id')
      .gte('created_at', since24h)
      .limit(5000)

    const allVotes = statsQuery.data ?? []
    const forCount = allVotes.filter((v) => v.side === 'blue').length
    const total = allVotes.length
    stats = {
      trades_24h: total,
      active_markets_24h: new Set(allVotes.map((v) => v.topic_id)).size,
      unique_traders_24h: new Set(allVotes.map((v) => v.user_id)).size,
      for_pct: total > 0 ? Math.round((forCount / total) * 100) : 50,
      against_pct: total > 0 ? Math.round(((total - forCount) / total) * 100) : 50,
      busiest_category: busiestCategory,
    }
  } else {
    const d = statsRes.data as {
      trades_24h: number
      active_markets: number
      unique_traders: number
      for_count: number
    }
    const total = d.trades_24h ?? 0
    const forCount = d.for_count ?? 0
    stats = {
      trades_24h: total,
      active_markets_24h: d.active_markets ?? 0,
      unique_traders_24h: d.unique_traders ?? 0,
      for_pct: total > 0 ? Math.round((forCount / total) * 100) : 50,
      against_pct: total > 0 ? Math.round(((total - forCount) / total) * 100) : 50,
      busiest_category: busiestCategory,
    }
  }

  // ── Shape response ────────────────────────────────────────────────────────
  const trades: Trade[] = (rows ?? [])
    .filter((row) => row.topics && row.profiles)
    .map((row) => {
      const profile = row.profiles as {
        username: string
        display_name: string | null
        avatar_url: string | null
      }
      const topic = row.topics as {
        id: string
        statement: string
        category: string | null
        status: string
        blue_pct: number | null
        total_votes: number | null
      }

      return {
        id: row.id as string,
        user_id: row.user_id as string,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        side: row.side as 'blue' | 'red',
        topic_id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        price: Math.round(topic.blue_pct ?? 50),
        volume: topic.total_votes ?? 0,
        voted_at: row.created_at as string,
      }
    })

  return NextResponse.json({
    trades,
    stats,
    as_of: new Date().toISOString(),
  } satisfies TradesResponse)
}
