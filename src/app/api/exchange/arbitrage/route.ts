import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArbDirection = 'expert_higher' | 'expert_lower'

export interface ArbMarket {
  id: string
  statement: string
  category: string | null
  status: string
  crowd_price: number       // overall blue_pct
  expert_price: number      // expert-weighted blue_pct
  spread: number            // |expert_price - crowd_price|
  direction: ArbDirection   // which way experts diverge
  expert_votes: number      // # of expert votes on this topic
  total_votes: number
  expert_for: number
  expert_against: number
}

export interface ArbitrageResponse {
  markets: ArbMarket[]
  meta: {
    expert_count: number     // total expert users found
    topics_scanned: number
    min_spread_shown: number
  }
  as_of: string
}

// ─── GET /api/exchange/arbitrage ─────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // ── 1. Identify expert users ───────────────────────────────────────────
    // Experts = reputation_score >= 80, or moderator/admin role, or clout >= 200
    const { data: experts } = await supabase
      .from('profiles')
      .select('id')
      .or('reputation_score.gte.80,role.eq.moderator,role.eq.admin,clout.gte.200')
      .limit(1000)

    const expertIds = (experts ?? []).map((e) => e.id)

    // ── 2. Fetch active/voting topics with meaningful participation ────────
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 15)
      .order('feed_score', { ascending: false })
      .limit(120)

    if (!topics?.length || !expertIds.length) {
      return NextResponse.json<ArbitrageResponse>({
        markets: [],
        meta: { expert_count: expertIds.length, topics_scanned: 0, min_spread_shown: 0 },
        as_of: new Date().toISOString(),
      })
    }

    const topicIds = topics.map((t) => t.id)

    // ── 3. Fetch expert votes for those topics ────────────────────────────
    const { data: expertVoteRows } = await supabase
      .from('votes')
      .select('topic_id, side')
      .in('user_id', expertIds)
      .in('topic_id', topicIds)
      .limit(10000)

    // ── 4. Aggregate expert votes per topic ────────────────────────────────
    const agg: Record<string, { for: number; against: number }> = {}
    for (const v of expertVoteRows ?? []) {
      if (!agg[v.topic_id]) agg[v.topic_id] = { for: 0, against: 0 }
      if (v.side === 'blue') agg[v.topic_id].for++
      else agg[v.topic_id].against++
    }

    // ── 5. Build arbitrage list ────────────────────────────────────────────
    const MIN_EXPERT_VOTES = 3
    const MIN_SPREAD = 8 // percentage points

    const markets: ArbMarket[] = []

    for (const topic of topics) {
      const exp = agg[topic.id]
      if (!exp) continue

      const expertTotal = exp.for + exp.against
      if (expertTotal < MIN_EXPERT_VOTES) continue

      const expertPrice = (exp.for / expertTotal) * 100
      const crowdPrice = topic.blue_pct ?? 50
      const spread = Math.abs(expertPrice - crowdPrice)

      if (spread < MIN_SPREAD) continue

      markets.push({
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        crowd_price: Math.round(crowdPrice * 10) / 10,
        expert_price: Math.round(expertPrice * 10) / 10,
        spread: Math.round(spread * 10) / 10,
        direction: expertPrice > crowdPrice ? 'expert_higher' : 'expert_lower',
        expert_votes: expertTotal,
        total_votes: topic.total_votes ?? 0,
        expert_for: exp.for,
        expert_against: exp.against,
      })
    }

    // Sort by spread descending
    markets.sort((a, b) => b.spread - a.spread)

    return NextResponse.json<ArbitrageResponse>({
      markets: markets.slice(0, 30),
      meta: {
        expert_count: expertIds.length,
        topics_scanned: topics.length,
        min_spread_shown: markets.at(-1)?.spread ?? 0,
      },
      as_of: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[/api/exchange/arbitrage]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
