import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DivergentMarket {
  id: string
  statement: string
  category: string | null
  status: string
  market_price: number
  arg_lean: number
  divergence: number
  direction: 'overpriced' | 'underpriced' | 'aligned'
  for_args: number
  against_args: number
  total_arg_weight: number
  arg_count: number
  top_for_arg: string | null
  top_against_arg: string | null
}

export interface DivergenceResponse {
  markets: DivergentMarket[]
  summary: {
    total_scanned: number
    divergent_count: number
    overpriced_count: number
    underpriced_count: number
    avg_divergence: number
  }
}

// Threshold: a market is "divergent" if market price and arg lean differ by 12+
const DIVERGENCE_THRESHOLD = 12

export async function GET() {
  const supabase = await createClient()

  // 1. Fetch active topics (active + voting) with price data
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 10)
    .order('total_votes', { ascending: false })
    .limit(80)

  if (topicsError || !topics) {
    return NextResponse.json({ markets: [], summary: { total_scanned: 0, divergent_count: 0, overpriced_count: 0, underpriced_count: 0, avg_divergence: 0 } } satisfies DivergenceResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // 2. Fetch all arguments for these topics
  const { data: args } = await supabase
    .from('topic_arguments')
    .select('topic_id, side, upvotes, ai_score')
    .in('topic_id', topicIds)
    .gte('upvotes', 0)

  // Group arguments by topic
  const argsByTopic: Record<string, Array<{ side: string; upvotes: number; ai_score: number | null; content?: string }>> = {}
  for (const arg of args ?? []) {
    const tid = arg.topic_id as string
    if (!argsByTopic[tid]) argsByTopic[tid] = []
    argsByTopic[tid].push({
      side: arg.side,
      upvotes: arg.upvotes ?? 0,
      ai_score: arg.ai_score ?? null,
    })
  }

  // 3. Fetch top argument content for display
  const { data: topArgs } = await supabase
    .from('topic_arguments')
    .select('topic_id, side, content, upvotes')
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })
    .limit(topicIds.length * 2)

  // Map: topic_id → { blue: topContent, red: topContent }
  const topArgContent: Record<string, { blue: string | null; red: string | null }> = {}
  for (const arg of topArgs ?? []) {
    const tid = arg.topic_id as string
    if (!topArgContent[tid]) topArgContent[tid] = { blue: null, red: null }
    if (arg.side === 'blue' && !topArgContent[tid].blue) {
      topArgContent[tid].blue = arg.content as string
    }
    if (arg.side === 'red' && !topArgContent[tid].red) {
      topArgContent[tid].red = arg.content as string
    }
  }

  // 4. Calculate divergence for each topic
  const markets: DivergentMarket[] = []

  for (const topic of topics) {
    const marketPrice = topic.blue_pct ?? 50
    const topicArgs = argsByTopic[topic.id] ?? []

    if (topicArgs.length < 2) continue

    // Weight each argument by: base upvote weight + AI score bonus
    let blueWeight = 0
    let totalWeight = 0
    let forArgCount = 0
    let againstArgCount = 0

    for (const arg of topicArgs) {
      const baseWeight = (arg.upvotes ?? 0) + 1
      const aiBonus = arg.ai_score ? arg.ai_score * 0.5 : 0
      const weight = baseWeight + aiBonus

      totalWeight += weight
      if (arg.side === 'blue') {
        blueWeight += weight
        forArgCount++
      } else {
        againstArgCount++
      }
    }

    if (totalWeight === 0) continue

    // Argument lean: what % of argument weight is FOR
    const argLean = (blueWeight / totalWeight) * 100

    // Divergence: positive = market more optimistic than args suggest
    const divergence = marketPrice - argLean

    const direction: DivergentMarket['direction'] =
      Math.abs(divergence) < DIVERGENCE_THRESHOLD
        ? 'aligned'
        : divergence > 0
          ? 'overpriced'
          : 'underpriced'

    markets.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      market_price: Math.round(marketPrice),
      arg_lean: Math.round(argLean),
      divergence: Math.round(divergence),
      direction,
      for_args: forArgCount,
      against_args: againstArgCount,
      total_arg_weight: Math.round(totalWeight),
      arg_count: topicArgs.length,
      top_for_arg: topArgContent[topic.id]?.blue ?? null,
      top_against_arg: topArgContent[topic.id]?.red ?? null,
    })
  }

  // Sort by absolute divergence, most divergent first
  markets.sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))

  const divergentMarkets = markets.filter((m) => m.direction !== 'aligned')
  const overpriced = markets.filter((m) => m.direction === 'overpriced')
  const underpriced = markets.filter((m) => m.direction === 'underpriced')
  const avgDivergence = markets.length > 0
    ? Math.round(markets.reduce((s, m) => s + Math.abs(m.divergence), 0) / markets.length)
    : 0

  return NextResponse.json({
    markets: markets.slice(0, 50),
    summary: {
      total_scanned: topics.length,
      divergent_count: divergentMarkets.length,
      overpriced_count: overpriced.length,
      underpriced_count: underpriced.length,
      avg_divergence: avgDivergence,
    },
  } satisfies DivergenceResponse)
}
