import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SentimentLabel =
  | 'very_bullish'
  | 'bullish'
  | 'lean_bullish'
  | 'neutral'
  | 'lean_bearish'
  | 'bearish'
  | 'very_bearish'

export interface RoleSentiment {
  role: string
  label: string
  for_count: number
  against_count: number
  total: number
  for_pct: number
  sentiment: SentimentLabel
}

export interface ArgumentMomentum {
  side: 'for' | 'against'
  count: number
  total_upvotes: number
  avg_upvotes: number
  top_argument: string | null
  top_upvotes: number
  share_of_engagement: number // 0-100
}

export interface CommentaryBreakdown {
  for_count: number
  against_count: number
  neutral_count: number
  total: number
  for_pct: number
  against_pct: number
  neutral_pct: number
  recent_direction: SentimentLabel
}

export interface SentimentTick {
  date: string
  price: number
  sentiment: SentimentLabel
}

export interface MarketSentimentData {
  id: string
  statement: string
  category: string | null
  status: string

  // Overall market sentiment (price-based)
  price: number
  sentiment_score: number // 0-100 (maps price to sentiment scale)
  sentiment_label: SentimentLabel
  sentiment_strength: 'strong' | 'moderate' | 'weak'

  // 24h delta
  delta_24h: number | null

  // Category context
  category_avg_price: number | null
  vs_category: 'above' | 'below' | 'aligned' | null

  // Vote breakdown by role
  role_sentiment: RoleSentiment[]
  total_voters: number
  for_voters: number
  against_voters: number

  // Argument momentum
  argument_momentum: ArgumentMomentum[]
  argument_edge: 'for' | 'against' | 'balanced' // which side has more engagement

  // Commentary sentiment
  commentary: CommentaryBreakdown | null

  // 30-day sentiment history (from price snapshots)
  history: SentimentTick[]

  // Derived insights
  consensus_strength: number // 0-100
  is_shifting: boolean       // true if price moved >5¢ in last 7d
  shift_direction: 'bullish' | 'bearish' | null
  contrarian_indicator: boolean // true if argument edge opposes price

  as_of: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priceToSentimentScore(price: number): number {
  return Math.round(price * 10) / 10
}

function sentimentLabel(score: number): SentimentLabel {
  if (score >= 75) return 'very_bullish'
  if (score >= 62) return 'bullish'
  if (score >= 54) return 'lean_bullish'
  if (score <= 25) return 'very_bearish'
  if (score <= 38) return 'bearish'
  if (score <= 46) return 'lean_bearish'
  return 'neutral'
}

function sentimentStrength(price: number): 'strong' | 'moderate' | 'weak' {
  const d = Math.abs(price - 50)
  if (d >= 25) return 'strong'
  if (d >= 12) return 'moderate'
  return 'weak'
}

const ROLE_LABELS: Record<string, string> = {
  elder: 'Elders',
  debator: 'Debators',
  troll_catcher: 'Troll Catchers',
  person: 'Citizens',
}

// ─── GET /api/exchange/[id]/sentiment ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const supabase = await createClient()

    // ── Core topic ────────────────────────────────────────────────────────────
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', id)
      .maybeSingle()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const price = (topic.blue_pct as number) ?? 50

    // ── 30-day price history ──────────────────────────────────────────────────
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: snapshots } = await supabase
      .from('topic_price_history')
      .select('price, recorded_at')
      .eq('topic_id', id)
      .gte('recorded_at', since30d)
      .order('recorded_at', { ascending: true })

    const history: SentimentTick[] = (snapshots ?? []).map((s) => ({
      date: (s.recorded_at as string).slice(0, 10),
      price: Math.round((s.price as number) * 10) / 10,
      sentiment: sentimentLabel(s.price as number),
    }))

    // 24h delta
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const oldest24h = (snapshots ?? []).find(
      (s) => (s.recorded_at as string) >= since24h,
    )
    const delta24h =
      oldest24h !== undefined
        ? Math.round((price - (oldest24h.price as number)) * 10) / 10
        : null

    // 7-day shift detection
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const oldest7d = (snapshots ?? []).find(
      (s) => (s.recorded_at as string) >= since7d,
    )
    const shift7d =
      oldest7d !== undefined ? price - (oldest7d.price as number) : null
    const isShifting = shift7d !== null && Math.abs(shift7d) >= 5
    const shiftDirection: 'bullish' | 'bearish' | null = isShifting
      ? shift7d! > 0
        ? 'bullish'
        : 'bearish'
      : null

    // ── Category context ──────────────────────────────────────────────────────
    let categoryAvgPrice: number | null = null
    let vsCategory: 'above' | 'below' | 'aligned' | null = null

    if (topic.category) {
      const { data: catPeers } = await supabase
        .from('topics')
        .select('blue_pct')
        .eq('category', topic.category)
        .in('status', ['active', 'voting'])
        .neq('id', id)
        .limit(200)

      if (catPeers && catPeers.length > 0) {
        const sum = catPeers.reduce(
          (acc, p) => acc + ((p.blue_pct as number) ?? 50),
          0,
        )
        categoryAvgPrice = Math.round((sum / catPeers.length) * 10) / 10
        const diff = price - categoryAvgPrice
        vsCategory =
          diff > 5 ? 'above' : diff < -5 ? 'below' : 'aligned'
      }
    }

    // ── Vote breakdown by role ────────────────────────────────────────────────
    const { data: voteRows } = await supabase
      .from('votes')
      .select('side, profiles!inner(role)')
      .eq('topic_id', id)

    const roleBuckets: Record<
      string,
      { for_count: number; against_count: number }
    > = {}

    for (const row of voteRows ?? []) {
      const side = row.side as string
      const profile = row.profiles as { role: string } | null
      const role = profile?.role ?? 'person'
      if (!roleBuckets[role]) roleBuckets[role] = { for_count: 0, against_count: 0 }
      if (side === 'blue') roleBuckets[role].for_count++
      else roleBuckets[role].against_count++
    }

    const roleSentiment: RoleSentiment[] = Object.entries(roleBuckets)
      .filter(([, b]) => b.for_count + b.against_count > 0)
      .map(([role, b]) => {
        const total = b.for_count + b.against_count
        const forPct = Math.round((b.for_count / total) * 1000) / 10
        return {
          role,
          label: ROLE_LABELS[role] ?? role,
          for_count: b.for_count,
          against_count: b.against_count,
          total,
          for_pct: forPct,
          sentiment: sentimentLabel(forPct),
        }
      })
      .sort((a, b) => b.total - a.total)

    const totalVoters = (voteRows ?? []).length
    const forVoters = (voteRows ?? []).filter((r) => r.side === 'blue').length
    const againstVoters = totalVoters - forVoters

    // ── Argument momentum ─────────────────────────────────────────────────────
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('side, content, upvotes')
      .eq('topic_id', id)
      .order('upvotes', { ascending: false })

    const argFor = (argRows ?? []).filter((a) => a.side === 'blue')
    const argAgainst = (argRows ?? []).filter((a) => a.side === 'red')

    const totalEngagement =
      [...argFor, ...argAgainst].reduce(
        (sum, a) => sum + ((a.upvotes as number) ?? 0),
        0,
      ) + (argFor.length + argAgainst.length)

    function buildMomentum(
      rows: typeof argFor,
      side: 'for' | 'against',
    ): ArgumentMomentum {
      const count = rows.length
      const totalUpvotes = rows.reduce(
        (sum, a) => sum + ((a.upvotes as number) ?? 0),
        0,
      )
      const engagement = totalUpvotes + count
      return {
        side,
        count,
        total_upvotes: totalUpvotes,
        avg_upvotes:
          count > 0 ? Math.round((totalUpvotes / count) * 10) / 10 : 0,
        top_argument:
          rows[0]
            ? (rows[0].content as string).slice(0, 120)
            : null,
        top_upvotes: rows[0] ? ((rows[0].upvotes as number) ?? 0) : 0,
        share_of_engagement:
          totalEngagement > 0
            ? Math.round((engagement / totalEngagement) * 1000) / 10
            : 50,
      }
    }

    const momentumFor = buildMomentum(argFor, 'for')
    const momentumAgainst = buildMomentum(argAgainst, 'against')

    const argumentEdge: 'for' | 'against' | 'balanced' =
      Math.abs(momentumFor.share_of_engagement - momentumAgainst.share_of_engagement) < 5
        ? 'balanced'
        : momentumFor.share_of_engagement > momentumAgainst.share_of_engagement
        ? 'for'
        : 'against'

    // Contrarian indicator: if argument edge ≠ price sentiment
    const priceSentimentSide = price >= 52 ? 'for' : price <= 48 ? 'against' : null
    const contrarianIndicator =
      argumentEdge !== 'balanced' &&
      priceSentimentSide !== null &&
      argumentEdge !== priceSentimentSide

    // ── Commentary breakdown ──────────────────────────────────────────────────
    const { data: commentaryRows } = await supabase
      .from('market_commentary')
      .select('direction, created_at')
      .eq('topic_id', id)
      .order('created_at', { ascending: false })
      .limit(200)

    let commentary: CommentaryBreakdown | null = null

    if (commentaryRows && commentaryRows.length > 0) {
      const forCount = commentaryRows.filter((c) => c.direction === 'for').length
      const againstCount = commentaryRows.filter(
        (c) => c.direction === 'against',
      ).length
      const neutralCount = commentaryRows.filter(
        (c) => c.direction === 'neutral' || !c.direction,
      ).length
      const total = commentaryRows.length

      // Recent 10 comments for "recent direction"
      const recent10 = commentaryRows.slice(0, 10)
      const recentFor = recent10.filter((c) => c.direction === 'for').length
      const recentAgainst = recent10.filter(
        (c) => c.direction === 'against',
      ).length
      const recentNeutral = recent10.length - recentFor - recentAgainst
      const recentScore =
        recent10.length > 0
          ? Math.round(
              ((recentFor + recentNeutral * 0.5) / recent10.length) * 100,
            )
          : 50

      commentary = {
        for_count: forCount,
        against_count: againstCount,
        neutral_count: neutralCount,
        total,
        for_pct: Math.round((forCount / total) * 1000) / 10,
        against_pct: Math.round((againstCount / total) * 1000) / 10,
        neutral_pct: Math.round((neutralCount / total) * 1000) / 10,
        recent_direction: sentimentLabel(recentScore),
      }
    }

    // ── Consensus strength ────────────────────────────────────────────────────
    // High when: price is far from 50, roles agree, arguments align with price
    const priceConsensus = Math.abs(price - 50) * 2 // 0-100
    const rolesAgree =
      roleSentiment.length > 1
        ? roleSentiment.every((r) => r.for_pct >= 50) ||
          roleSentiment.every((r) => r.for_pct < 50)
        : true
    const argsAlign = argumentEdge === priceSentimentSide || argumentEdge === 'balanced'

    const consensusStrength = Math.round(
      priceConsensus * (rolesAgree ? 1 : 0.75) * (argsAlign ? 1 : 0.85),
    )

    const response: MarketSentimentData = {
      id: topic.id as string,
      statement: topic.statement as string,
      category: topic.category as string | null,
      status: topic.status as string,

      price,
      sentiment_score: priceToSentimentScore(price),
      sentiment_label: sentimentLabel(price),
      sentiment_strength: sentimentStrength(price),

      delta_24h: delta24h,

      category_avg_price: categoryAvgPrice,
      vs_category: vsCategory,

      role_sentiment: roleSentiment,
      total_voters: totalVoters,
      for_voters: forVoters,
      against_voters: againstVoters,

      argument_momentum: [momentumFor, momentumAgainst],
      argument_edge: argumentEdge,

      commentary,

      history,

      consensus_strength: Math.min(100, Math.max(0, consensusStrength)),
      is_shifting: isShifting,
      shift_direction: shiftDirection,
      contrarian_indicator: contrarianIndicator,

      as_of: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[exchange/sentiment] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
