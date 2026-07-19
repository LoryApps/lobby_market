import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  is_influencer: boolean
  side: 'for' | 'against'
  voted_at: string
  entry_price: number
  current_price: number
  edge: number
  is_winning: boolean
}

export interface LeaderboardData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    current_price: number
    total_votes: number
    blue_votes: number
    red_votes: number
  }
  leaders: LeaderEntry[]
  total_voters: number
  winners_count: number
  for_winners: number
  against_winners: number
  top_edge: number
  avg_edge: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const url = new URL(req.url)
  const filter = url.searchParams.get('filter') ?? 'all' // all | for | against | winning

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const currentPrice = Math.round(topic.blue_pct ?? 50)

  // ── 2. Votes with profiles ────────────────────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select(`
      user_id,
      side,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role,
        clout,
        is_influencer
      )
    `)
    .eq('topic_id', id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (!votes || votes.length === 0) {
    return NextResponse.json({
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        current_price: currentPrice,
        total_votes: topic.total_votes ?? 0,
        blue_votes: topic.blue_votes ?? 0,
        red_votes: topic.red_votes ?? 0,
      },
      leaders: [],
      total_voters: 0,
      winners_count: 0,
      for_winners: 0,
      against_winners: 0,
      top_edge: 0,
      avg_edge: 0,
    } satisfies LeaderboardData)
  }

  // ── 3. Price history for entry price lookup ───────────────────────────────
  const { data: priceHistory } = await supabase
    .from('topic_price_history')
    .select('price, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })

  // Binary-search helper: find last price snapshot at or before a given time
  const snapshots = priceHistory ?? []
  function entryPrice(votedAt: string): number {
    const t = new Date(votedAt).getTime()
    let lo = 0
    let hi = snapshots.length - 1
    let best = 50 // default to 50¢ if no history exists
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const snapTime = new Date(snapshots[mid].recorded_at).getTime()
      if (snapTime <= t) {
        best = snapshots[mid].price
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return Math.round(best)
  }

  // ── 4. Build leader entries ───────────────────────────────────────────────
  const entries: Omit<LeaderEntry, 'rank'>[] = votes
    .map((v) => {
      const profile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles
      if (!profile) return null

      const ep = entryPrice(v.created_at)
      const side = v.side as 'for' | 'against'
      // FOR voters win when price rises; AGAINST voters win when price falls
      const edge = side === 'for' ? currentPrice - ep : ep - currentPrice

      return {
        user_id: v.user_id,
        username: (profile as { username: string }).username,
        display_name: (profile as { display_name: string | null }).display_name,
        avatar_url: (profile as { avatar_url: string | null }).avatar_url,
        role: (profile as { role: string }).role,
        clout: (profile as { clout: number }).clout ?? 0,
        is_influencer: (profile as { is_influencer: boolean }).is_influencer ?? false,
        side,
        voted_at: v.created_at,
        entry_price: ep,
        current_price: currentPrice,
        edge,
        is_winning: edge > 0,
      }
    })
    .filter(Boolean) as Omit<LeaderEntry, 'rank'>[]

  // Apply filter
  let filtered = entries
  if (filter === 'for') filtered = entries.filter((e) => e.side === 'for')
  else if (filter === 'against') filtered = entries.filter((e) => e.side === 'against')
  else if (filter === 'winning') filtered = entries.filter((e) => e.is_winning)

  // Sort by edge desc, then by clout as tiebreaker
  filtered.sort((a, b) => b.edge - a.edge || b.clout - a.clout)

  // Add rank and take top 50
  const leaders: LeaderEntry[] = filtered.slice(0, 50).map((e, i) => ({
    ...e,
    rank: i + 1,
  }))

  // ── 5. Aggregate stats ────────────────────────────────────────────────────
  const winnersCount = entries.filter((e) => e.is_winning).length
  const forWinners = entries.filter((e) => e.side === 'for' && e.is_winning).length
  const againstWinners = entries.filter((e) => e.side === 'against' && e.is_winning).length
  const topEdge = entries.length > 0 ? Math.max(...entries.map((e) => e.edge)) : 0
  const avgEdge = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.edge, 0) / entries.length)
    : 0

  return NextResponse.json({
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_price: currentPrice,
      total_votes: topic.total_votes ?? 0,
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
    },
    leaders,
    total_voters: entries.length,
    winners_count: winnersCount,
    for_winners: forWinners,
    against_winners: againstWinners,
    top_edge: topEdge,
    avg_edge: avgEdge,
  } satisfies LeaderboardData)
}
