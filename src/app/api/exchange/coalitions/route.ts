import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoalitionStanceMarket {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  stance: 'for' | 'against' | 'neutral'
  stance_statement: string | null
  declared_at: string
  // Derived
  market_price: number   // same as blue_pct
  is_correct: boolean | null  // null if unresolved
  is_resolved: boolean
}

export interface CoalitionMarketStat {
  id: string
  name: string
  description: string | null
  member_count: number
  coalition_influence: number
  wins: number
  losses: number
  is_public: boolean
  // Market-specific stats
  total_stances: number
  active_stances: number
  resolved_stances: number
  correct_stances: number
  win_rate: number | null     // null if no resolved stances
  bullish_count: number       // stances 'for'
  bearish_count: number       // stances 'against'
  neutral_count: number
  avg_market_price: number | null  // avg blue_pct across active stances
  // Top current stances (most contested)
  top_stances: CoalitionStanceMarket[]
}

export interface CoalitionsMarketResponse {
  coalitions: CoalitionMarketStat[]
  total_active_stances: number
  most_bullish: string | null
  most_bearish: string | null
  highest_accuracy: string | null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Fetch top public coalitions
  const { data: coalitions, error: cErr } = await supabase
    .from('coalitions')
    .select('id, name, description, member_count, coalition_influence, wins, losses, is_public')
    .eq('is_public', true)
    .order('coalition_influence', { ascending: false })
    .limit(30)

  if (cErr || !coalitions) {
    return NextResponse.json({ error: 'Failed to load coalitions' }, { status: 500 })
  }

  if (coalitions.length === 0) {
    return NextResponse.json({
      coalitions: [],
      total_active_stances: 0,
      most_bullish: null,
      most_bearish: null,
      highest_accuracy: null,
    } satisfies CoalitionsMarketResponse)
  }

  const coalitionIds = coalitions.map((c) => c.id)

  // 2. Fetch all stances for these coalitions with topic market data
  const { data: stances, error: sErr } = await supabase
    .from('coalition_stances')
    .select(`
      coalition_id,
      topic_id,
      stance,
      statement,
      created_at,
      topics!inner (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .in('coalition_id', coalitionIds)

  if (sErr) {
    return NextResponse.json({ error: 'Failed to load stances' }, { status: 500 })
  }

  const stanceRows = (stances ?? []) as Array<{
    coalition_id: string
    topic_id: string
    stance: 'for' | 'against' | 'neutral'
    statement: string | null
    created_at: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    }
  }>

  // 3. Group stances by coalition and compute stats
  const stancesByCoalition = new Map<string, typeof stanceRows>()
  for (const s of stanceRows) {
    const list = stancesByCoalition.get(s.coalition_id) ?? []
    list.push(s)
    stancesByCoalition.set(s.coalition_id, list)
  }

  const TERMINAL = new Set(['law', 'failed'])

  const result: CoalitionMarketStat[] = coalitions.map((c) => {
    const myStances = stancesByCoalition.get(c.id) ?? []

    const markets: CoalitionStanceMarket[] = myStances.map((s) => {
      const t = s.topics
      const resolved = TERMINAL.has(t.status)
      let isCorrect: boolean | null = null
      if (resolved) {
        if (s.stance === 'neutral') {
          isCorrect = null // neutral stances don't count as wins/losses
        } else if (s.stance === 'for') {
          isCorrect = t.status === 'law'
        } else {
          isCorrect = t.status === 'failed'
        }
      }
      return {
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        stance: s.stance,
        stance_statement: s.statement,
        declared_at: s.created_at,
        market_price: t.blue_pct ?? 50,
        is_correct: isCorrect,
        is_resolved: resolved,
      }
    })

    const active = markets.filter((m) => !m.is_resolved)
    const resolved = markets.filter((m) => m.is_resolved && m.stance !== 'neutral')
    const correct = resolved.filter((m) => m.is_correct === true)

    const bullish = markets.filter((m) => m.stance === 'for').length
    const bearish = markets.filter((m) => m.stance === 'against').length
    const neutral = markets.filter((m) => m.stance === 'neutral').length

    const activePrices = active.map((m) => m.market_price)
    const avgPrice = activePrices.length > 0
      ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length
      : null

    // Top stances: prioritise active ones with the most votes (most contested)
    const topStances = [...markets]
      .filter((m) => !m.is_resolved)
      .sort((a, b) => b.total_votes - a.total_votes)
      .slice(0, 5)

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      member_count: c.member_count,
      coalition_influence: c.coalition_influence,
      wins: c.wins,
      losses: c.losses,
      is_public: c.is_public,
      total_stances: markets.length,
      active_stances: active.length,
      resolved_stances: resolved.length,
      correct_stances: correct.length,
      win_rate: resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : null,
      bullish_count: bullish,
      bearish_count: bearish,
      neutral_count: neutral,
      avg_market_price: avgPrice !== null ? Math.round(avgPrice) : null,
      top_stances: topStances,
    }
  })

  // Only return coalitions that have at least one stance
  const active = result.filter((c) => c.total_stances > 0)

  // Global stats
  const totalActiveStances = active.reduce((sum, c) => sum + c.active_stances, 0)

  const mostBullish = active
    .filter((c) => c.active_stances > 0)
    .sort((a, b) => (b.bullish_count / Math.max(b.active_stances, 1)) - (a.bullish_count / Math.max(a.active_stances, 1)))
    [0]?.name ?? null

  const mostBearish = active
    .filter((c) => c.active_stances > 0)
    .sort((a, b) => (b.bearish_count / Math.max(b.active_stances, 1)) - (a.bearish_count / Math.max(a.active_stances, 1)))
    [0]?.name ?? null

  const highestAccuracy = active
    .filter((c) => c.resolved_stances >= 2)
    .sort((a, b) => (b.win_rate ?? 0) - (a.win_rate ?? 0))
    [0]?.name ?? null

  return NextResponse.json({
    coalitions: active,
    total_active_stances: totalActiveStances,
    most_bullish: mostBullish,
    most_bearish: mostBearish,
    highest_accuracy: highestAccuracy,
  } satisfies CoalitionsMarketResponse)
}
