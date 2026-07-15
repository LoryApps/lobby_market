import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraderStats {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  // Settled market metrics
  total_settled: number
  wins: number
  losses: number
  win_rate: number | null
  // Open market metrics
  open_positions: number
  // Total volume (all positions)
  total_positions: number
  // Portfolio return (sum of pnl across settled positions)
  total_return: number
  // Best single settled trade (statement)
  best_pick: string | null
  // Most active category
  top_category: string | null
}

export interface ExchangeLeaderboardResponse {
  traders: TraderStats[]
  sort: string
  period: string
  total_traders: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const sort = searchParams.get('sort') || 'win_rate'
  const period = searchParams.get('period') || 'all'

  // Date cutoff for "this month" filter
  const since = period === 'month'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  // ── 1. Fetch settled votes (votes on topics that are now law or failed) ────────

  let settledQuery = supabase
    .from('votes')
    .select(`
      user_id,
      side,
      topic_id,
      created_at,
      topics!inner (
        id,
        statement,
        category,
        status,
        blue_pct
      )
    `)
    .in('topics.status', ['law', 'failed'])
    .limit(5000)

  if (since) settledQuery = settledQuery.gte('created_at', since)

  const { data: settledVotes } = await settledQuery

  // ── 2. Fetch open votes (active/voting topics) for position count ─────────────

  let openQuery = supabase
    .from('votes')
    .select('user_id')
    .in('topics.status', ['proposed', 'active', 'voting'])
    .limit(5000)

  if (since) openQuery = openQuery.gte('created_at', since)

  const { data: openVotes } = await openQuery

  // ── 3. Aggregate per user ─────────────────────────────────────────────────────

  interface UserAgg {
    settled: number
    wins: number
    losses: number
    total_return: number
    open: number
    best_pnl: number
    best_statement: string | null
    categories: Record<string, number>
  }

  const userMap = new Map<string, UserAgg>()

  const get = (uid: string): UserAgg => {
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        settled: 0,
        wins: 0,
        losses: 0,
        total_return: 0,
        open: 0,
        best_pnl: -Infinity,
        best_statement: null,
        categories: {},
      })
    }
    return userMap.get(uid)!
  }

  for (const vote of settledVotes ?? []) {
    const topic = Array.isArray(vote.topics) ? vote.topics[0] : vote.topics
    if (!topic) continue

    const uid = vote.user_id as string
    const agg = get(uid)
    const side = vote.side as string
    const status = (topic as { status: string }).status
    const isWin =
      (status === 'law' && side === 'blue') ||
      (status === 'failed' && side === 'red')

    // Simple PnL: win = +50 units, loss = -50 units (normalised scale)
    const entryPrice = 50 // approximate mid-point (no per-vote price available here)
    const finalPrice = status === 'law' ? 100 : 0
    const pnl = side === 'blue'
      ? finalPrice - entryPrice
      : entryPrice - finalPrice

    agg.settled += 1
    if (isWin) agg.wins += 1
    else agg.losses += 1
    agg.total_return += pnl

    if (pnl > agg.best_pnl) {
      agg.best_pnl = pnl
      agg.best_statement = (topic as { statement: string }).statement
    }

    const cat = (topic as { category: string | null }).category
    if (cat) agg.categories[cat] = (agg.categories[cat] ?? 0) + 1
  }

  for (const vote of openVotes ?? []) {
    const uid = vote.user_id as string
    get(uid).open += 1
  }

  // Filter to users with at least 1 settled position
  const eligibleIds = [...userMap.keys()].filter(
    (uid) => (userMap.get(uid)?.settled ?? 0) >= 1,
  )

  if (eligibleIds.length === 0) {
    return NextResponse.json({
      traders: [],
      sort,
      period,
      total_traders: 0,
    } satisfies ExchangeLeaderboardResponse)
  }

  // ── 4. Fetch profiles ─────────────────────────────────────────────────────────

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', eligibleIds)

  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; role: string }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, {
      username: p.username as string,
      display_name: p.display_name as string | null,
      avatar_url: p.avatar_url as string | null,
      role: p.role as string,
    })
  }

  // ── 5. Build result rows ──────────────────────────────────────────────────────

  const traders: TraderStats[] = []

  for (const uid of eligibleIds) {
    const profile = profileMap.get(uid)
    if (!profile) continue

    const agg = userMap.get(uid)!
    const winRate = agg.settled > 0 ? Math.round((agg.wins / agg.settled) * 100) : null
    const topCategory = Object.entries(agg.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    traders.push({
      user_id: uid,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      total_settled: agg.settled,
      wins: agg.wins,
      losses: agg.losses,
      win_rate: winRate,
      open_positions: agg.open,
      total_positions: agg.settled + agg.open,
      total_return: Math.round(agg.total_return * 10) / 10,
      best_pick: agg.best_statement,
      top_category: topCategory,
    })
  }

  // ── 6. Sort ───────────────────────────────────────────────────────────────────

  traders.sort((a, b) => {
    if (sort === 'win_rate') {
      const wr_a = a.win_rate ?? -1
      const wr_b = b.win_rate ?? -1
      if (wr_b !== wr_a) return wr_b - wr_a
      return b.total_settled - a.total_settled
    }
    if (sort === 'return') return b.total_return - a.total_return
    // volume
    return b.total_positions - a.total_positions
  })

  const top50 = traders.slice(0, 50)

  return NextResponse.json({
    traders: top50,
    sort,
    period,
    total_traders: traders.length,
  } satisfies ExchangeLeaderboardResponse)
}
