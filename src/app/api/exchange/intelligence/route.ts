import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
  feed_score: number
}

export interface LawWatchEntry extends IntelMarket {
  gap: number        // percentage points to 66% law threshold
  eta_label: string  // human-readable ETA guess
}

export interface ArbitrageEntry extends IntelMarket {
  argument_quality: number  // avg AI argument score 0-100
  price_deviation: number   // price - (quality-derived fair value), negative = undervalued
  signal: 'undervalued' | 'overvalued'
}

export interface BreakoutEntry extends IntelMarket {
  delta: number      // price change this session (blue_pct drift)
  direction: 'surge' | 'collapse'
  strength: 'strong' | 'extreme'
}

export interface CategoryRotation {
  category: string
  avg_price: number
  market_count: number
  active_count: number
  law_count: number
  avg_volume: number
  momentum: 'rising' | 'stable' | 'declining'
  color: string
}

export interface ContrarySignal {
  id: string
  statement: string
  category: string | null
  price: number
  volume: number
  note: string
}

export interface IntelligenceTheme {
  title: string
  body: string
  markets: { id: string; statement: string; price: number }[]
  accent: string
}

export interface IntelligenceResponse {
  headline: string
  narrative: string
  themes: IntelligenceTheme[]
  law_watch: LawWatchEntry[]
  arbitrage: ArbitrageEntry[]
  breakouts: BreakoutEntry[]
  rotation: CategoryRotation[]
  contrary: ContrarySignal[]
  market_health: {
    total: number
    advancing: number
    declining: number
    contested: number
    near_law: number
    breadth: number
    sentiment: 'bullish' | 'bearish' | 'mixed' | 'neutral'
  }
  as_of: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAW_THRESHOLD = 66
const CONTESTED_BAND = 10   // ±10 from 50

const CAT_COLOR: Record<string, string> = {
  Economics:   'gold',
  Politics:    'for',
  Technology:  'purple',
  Science:     'emerald',
  Ethics:      'against',
  Philosophy:  'surface',
  Culture:     'gold',
  Health:      'emerald',
  Environment: 'emerald',
  Education:   'for',
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function etaLabel(gap: number, volume: number): string {
  if (gap <= 2) return 'Imminent'
  if (gap <= 5) return 'Very close'
  if (gap <= 10) return volume > 500 ? 'Days away' : 'Weeks away'
  return 'Moderate path'
}

function buildHeadline(
  total: number,
  nearLaw: number,
  breakouts: BreakoutEntry[],
  rotation: CategoryRotation[],
): string {
  if (nearLaw >= 5) {
    return `${nearLaw} markets approaching law threshold as consensus hardens`
  }
  const surges = breakouts.filter((b) => b.direction === 'surge')
  if (surges.length >= 3) {
    return `Broad momentum surge — ${surges.length} markets gaining ground simultaneously`
  }
  const rising = rotation.filter((c) => c.momentum === 'rising')
  if (rising.length >= 3) {
    return `Category rotation: ${rising.map((c) => c.category).slice(0, 2).join(' & ')} leading consensus shift`
  }
  return `${total} active markets in play — consensus forming across ${CATEGORIES.length} categories`
}

function buildNarrative(
  health: IntelligenceResponse['market_health'],
  nearLaw: LawWatchEntry[],
  arb: ArbitrageEntry[],
  rotation: CategoryRotation[],
): string {
  const parts: string[] = []

  const breadth = health.breadth
  if (breadth > 0.55) {
    parts.push(`Civic consensus is broadly positive with ${Math.round(breadth * 100)}% of active markets skewing FOR — a constructive backdrop for law formation.`)
  } else if (breadth < 0.45) {
    parts.push(`AGAINST sentiment dominates with only ${Math.round(breadth * 100)}% of active markets leaning FOR — indicating strong civic resistance across the board.`)
  } else {
    parts.push(`Markets are evenly split with ${Math.round(breadth * 100)}% leaning FOR — a contested landscape where small shifts can tip the balance.`)
  }

  if (nearLaw.length > 0) {
    const top = nearLaw[0]
    parts.push(`The law watch is active: "${top.statement.slice(0, 60)}${top.statement.length > 60 ? '…' : ''}" sits at ${top.price}¢ — just ${top.gap.toFixed(1)} points from the ${LAW_THRESHOLD}¢ threshold.`)
  }

  const rising = rotation.filter((c) => c.momentum === 'rising').slice(0, 2)
  const declining = rotation.filter((c) => c.momentum === 'declining').slice(0, 1)
  if (rising.length > 0) {
    parts.push(`Category rotation favors ${rising.map((c) => c.category).join(' and ')} — both seeing above-average argument activity and consensus drift.`)
  }
  if (declining.length > 0) {
    parts.push(`${declining[0].category} debates are losing momentum — watch for reversal or capitulation.`)
  }

  const undervalued = arb.filter((a) => a.signal === 'undervalued').slice(0, 1)
  if (undervalued.length > 0) {
    parts.push(`Arbitrage alert: argument quality in ${undervalued[0].category ?? 'at least one market'} outpaces the current consensus price — a potential mispricing worth watching.`)
  }

  return parts.join(' ')
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch active + voting topics with basic stats
    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at')
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(200)

    if (error || !topics) {
      return NextResponse.json({ error: 'Failed to load market data' }, { status: 500 })
    }

    const markets: IntelMarket[] = topics.map((t) => ({
      id: t.id,
      statement: t.statement ?? '',
      category: t.category,
      status: t.status,
      price: Math.round(t.blue_pct ?? 50),
      volume: t.total_votes ?? 0,
      feed_score: t.feed_score ?? 0,
    }))

    // ── Law Watch ─────────────────────────────────────────────────────────────
    const lawWatch: LawWatchEntry[] = markets
      .filter((m) => m.price >= 55 && m.price < LAW_THRESHOLD)
      .sort((a, b) => b.price - a.price)
      .slice(0, 6)
      .map((m) => ({
        ...m,
        gap: LAW_THRESHOLD - m.price,
        eta_label: etaLabel(LAW_THRESHOLD - m.price, m.volume),
      }))

    // ── Breakouts ─────────────────────────────────────────────────────────────
    // Use feed_score as a proxy for momentum (higher = rising faster)
    // Surge = high feed_score with high FOR consensus; Collapse = high feed_score with high AGAINST
    const breakouts: BreakoutEntry[] = markets
      .filter((m) => m.feed_score > 1.0 && (m.price > 65 || m.price < 35))
      .sort((a, b) => b.feed_score - a.feed_score)
      .slice(0, 8)
      .map((m) => {
        const direction: BreakoutEntry['direction'] = m.price > 50 ? 'surge' : 'collapse'
        const delta = direction === 'surge' ? m.price - 50 : 50 - m.price
        const strength: BreakoutEntry['strength'] = delta > 20 ? 'extreme' : 'strong'
        return { ...m, delta, direction, strength }
      })

    // ── Arbitrage (quality divergence) ─────────────────────────────────────
    // Fetch argument AI scores for active topics
    const { data: argScores } = await supabase
      .from('argument_ai_scores')
      .select('topic_id, overall_score')
      .not('overall_score', 'is', null)
      .limit(500)

    const topicScoreMap: Record<string, number[]> = {}
    for (const row of argScores ?? []) {
      if (!topicScoreMap[row.topic_id]) topicScoreMap[row.topic_id] = []
      topicScoreMap[row.topic_id].push(row.overall_score as number)
    }

    const arbitrage: ArbitrageEntry[] = markets
      .filter((m) => topicScoreMap[m.id] && topicScoreMap[m.id].length >= 3)
      .map((m) => {
        const scores = topicScoreMap[m.id]
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
        const qualityFairValue = Math.round(avgScore)      // treat quality 0-100 as fair price
        const deviation = m.price - qualityFairValue
        return {
          ...m,
          argument_quality: Math.round(avgScore),
          price_deviation: deviation,
          signal: deviation < -8 ? 'undervalued' : 'overvalued' as ArbitrageEntry['signal'],
        }
      })
      .filter((m) => Math.abs(m.price_deviation) >= 8)
      .sort((a, b) => Math.abs(b.price_deviation) - Math.abs(a.price_deviation))
      .slice(0, 5)

    // ── Category Rotation ─────────────────────────────────────────────────────
    const catMap: Record<string, IntelMarket[]> = {}
    for (const m of markets) {
      const cat = m.category ?? 'Other'
      if (!catMap[cat]) catMap[cat] = []
      catMap[cat].push(m)
    }

    const rotation: CategoryRotation[] = CATEGORIES
      .filter((cat) => catMap[cat] && catMap[cat].length > 0)
      .map((cat) => {
        const ms = catMap[cat]
        const avgPrice = ms.reduce((s, m) => s + m.price, 0) / ms.length
        const avgVol = ms.reduce((s, m) => s + m.volume, 0) / ms.length
        const avgFeed = ms.reduce((s, m) => s + m.feed_score, 0) / ms.length
        const momentum: CategoryRotation['momentum'] =
          avgFeed > 0.8 ? 'rising' : avgFeed < 0.3 ? 'declining' : 'stable'
        const lawCount = ms.filter((m) => m.price >= LAW_THRESHOLD).length
        return {
          category: cat,
          avg_price: Math.round(avgPrice),
          market_count: ms.length,
          active_count: ms.filter((m) => m.status === 'active').length,
          law_count: lawCount,
          avg_volume: Math.round(avgVol),
          momentum,
          color: CAT_COLOR[cat] ?? 'surface',
        }
      })
      .sort((a, b) => b.market_count - a.market_count)

    // ── Contrarian signals ────────────────────────────────────────────────────
    const contrary: ContrarySignal[] = markets
      .filter((m) => m.price < 40 && m.volume > 200 && m.feed_score > 0.6)
      .slice(0, 4)
      .map((m) => ({
        id: m.id,
        statement: m.statement,
        category: m.category,
        price: m.price,
        volume: m.volume,
        note: `${m.price}¢ consensus despite high engagement — crowd resistance at scale`,
      }))

    // ── Themes ─────────────────────────────────────────────────────────────────
    const themes: IntelligenceTheme[] = []

    if (lawWatch.length >= 2) {
      themes.push({
        title: 'Law Formation Pressure',
        body: `${lawWatch.length} markets are within striking distance of the ${LAW_THRESHOLD}¢ law threshold. Activity in these debates is intensifying as consensus hardens.`,
        markets: lawWatch.slice(0, 3).map((m) => ({ id: m.id, statement: m.statement, price: m.price })),
        accent: 'gold',
      })
    }

    const catRising = rotation.filter((c) => c.momentum === 'rising')
    if (catRising.length >= 2) {
      const names = catRising.slice(0, 3).map((c) => c.category)
      themes.push({
        title: `${names.slice(0, 2).join(' & ')} Rotation`,
        body: `${names.join(', ')} categories are showing above-trend feed scores — civic attention is concentrating here. Watch for rapid consensus formation.`,
        markets: catRising
          .flatMap((c) => (catMap[c.category] ?? []).sort((a, b) => b.feed_score - a.feed_score).slice(0, 1))
          .slice(0, 3)
          .map((m) => ({ id: m.id, statement: m.statement, price: m.price })),
        accent: 'for',
      })
    }

    const surgeMarkets = breakouts.filter((b) => b.direction === 'surge')
    if (surgeMarkets.length >= 2) {
      themes.push({
        title: 'Consensus Surge',
        body: `${surgeMarkets.length} markets are showing strong FOR momentum with above-average engagement. These debates have reached critical mass — consensus is self-reinforcing.`,
        markets: surgeMarkets.slice(0, 3).map((m) => ({ id: m.id, statement: m.statement, price: m.price })),
        accent: 'emerald',
      })
    }

    if (arbitrage.length >= 2) {
      themes.push({
        title: 'Quality Divergence',
        body: 'Argument quality scores diverge significantly from current consensus prices in several markets — a mispricing signal for informed participants.',
        markets: arbitrage.slice(0, 3).map((m) => ({ id: m.id, statement: m.statement, price: m.price })),
        accent: 'purple',
      })
    }

    // ── Market Health ─────────────────────────────────────────────────────────
    const advancing = markets.filter((m) => m.price > 55).length
    const declining = markets.filter((m) => m.price < 45).length
    const contested = markets.filter((m) => Math.abs(m.price - 50) <= CONTESTED_BAND).length
    const nearLawCount = lawWatch.length
    const breadth = markets.length > 0 ? (markets.filter((m) => m.price > 50).length / markets.length) : 0.5

    let sentiment: IntelligenceResponse['market_health']['sentiment'] = 'neutral'
    if (breadth > 0.6) sentiment = 'bullish' as const
    else if (breadth < 0.4) sentiment = 'bearish' as const
    else if (contested / markets.length > 0.4) sentiment = 'mixed' as const

    const health = {
      total: markets.length,
      advancing,
      declining,
      contested,
      near_law: nearLawCount,
      breadth,
      sentiment,
    }

    // ── Headline + Narrative ──────────────────────────────────────────────────
    const headline = buildHeadline(markets.length, nearLawCount, breakouts, rotation)
    const narrative = buildNarrative(health, lawWatch, arbitrage, rotation)

    const response: IntelligenceResponse = {
      headline,
      narrative,
      themes,
      law_watch: lawWatch,
      arbitrage,
      breakouts,
      rotation,
      contrary,
      market_health: health,
      as_of: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[exchange/intelligence]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
