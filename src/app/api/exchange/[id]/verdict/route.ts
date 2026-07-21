import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerdictLabel =
  | 'strong_for'
  | 'leaning_for'
  | 'deadlocked'
  | 'leaning_against'
  | 'strong_against'

export interface VerdictArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  source_url: string | null
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
}

export interface VerdictSignal {
  id: string
  label: string
  value: string
  direction: 'for' | 'against' | 'neutral'
  weight: 'high' | 'medium' | 'low'
}

export interface VerdictForecast {
  total: number
  for_count: number
  against_count: number
  avg_for_price: number | null
  avg_against_price: number | null
}

export interface VerdictResolvedComp {
  id: string
  statement: string
  category: string | null
  final_price: number
  resolution: 'law' | 'failed'
  total_votes: number
  similarity: number
}

export interface VerdictData {
  market: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    blue_votes: number
    red_votes: number
    total_votes: number
    is_hot: boolean
    is_near_law: boolean
    is_deadlocked: boolean
    voting_ends_at: string | null
    created_at: string
  }
  verdict: VerdictLabel
  confidence: number          // 0–100
  summary: string             // one-sentence plain-language verdict
  top_for: VerdictArgument[]
  top_against: VerdictArgument[]
  signals: VerdictSignal[]
  forecast: VerdictForecast | null
  resolved_comps: VerdictResolvedComp[]
  argument_stats: {
    total_for: number
    total_against: number
    avg_ai_score_for: number | null
    avg_ai_score_against: number | null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeVerdict(price: number): VerdictLabel {
  if (price >= 72) return 'strong_for'
  if (price >= 58) return 'leaning_for'
  if (price >= 43) return 'deadlocked'
  if (price >= 29) return 'leaning_against'
  return 'strong_against'
}

function computeConfidence(
  price: number,
  totalVotes: number,
  hasForecasts: boolean,
  argBalance: number, // for/(for+against), 0–1
): number {
  // Distance from deadlock (50) → 0–50
  const priceSignal = Math.abs(price - 50) * 2 // 0–100

  // Vote volume signal (saturates at 500 votes)
  const volumeSignal = Math.min(totalVotes / 500, 1) * 30

  // Argument balance bonus
  const argSignal = Math.abs(argBalance - 0.5) * 20 // 0–10

  // Forecaster bonus
  const forecastBonus = hasForecasts ? 10 : 0

  return Math.round(Math.min(priceSignal + volumeSignal + argSignal + forecastBonus, 100))
}

function buildSummary(verdict: VerdictLabel, price: number, statement: string): string {
  const stmt = statement.length > 60 ? statement.slice(0, 60) + '…' : statement
  switch (verdict) {
    case 'strong_for':
      return `The community strongly supports "${stmt}" with ${price}% FOR consensus.`
    case 'leaning_for':
      return `The community leans toward supporting "${stmt}" at ${price}% FOR.`
    case 'deadlocked':
      return `The community is split on "${stmt}" — consensus is unresolved at ${price}% FOR.`
    case 'leaning_against':
      return `The community leans against "${stmt}" with only ${price}% FOR support.`
    case 'strong_against':
      return `The community strongly opposes "${stmt}" — only ${price}% support it.`
  }
}

function buildSignals(
  price: number,
  totalVotes: number,
  isHot: boolean,
  isNearLaw: boolean,
  isDeadlocked: boolean,
  priceDelta: number | null,
  argCountFor: number,
  argCountAgainst: number,
  avgScoreFor: number | null,
  avgScoreAgainst: number | null,
  votingEndsAt: string | null,
): VerdictSignal[] {
  const signals: VerdictSignal[] = []

  // Consensus strength
  if (price >= 70) {
    signals.push({ id: 'strong_consensus', label: 'Strong consensus', value: `${price}¢ FOR`, direction: 'for', weight: 'high' })
  } else if (price <= 30) {
    signals.push({ id: 'strong_consensus', label: 'Strong rejection', value: `${price}¢ FOR`, direction: 'against', weight: 'high' })
  } else if (price >= 55) {
    signals.push({ id: 'mild_consensus', label: 'Mild consensus', value: `${price}¢ FOR`, direction: 'for', weight: 'medium' })
  } else if (price <= 45) {
    signals.push({ id: 'mild_consensus', label: 'Mild rejection', value: `${price}¢ FOR`, direction: 'against', weight: 'medium' })
  }

  // Hot
  if (isHot) {
    signals.push({ id: 'hot', label: 'High momentum', value: 'Trending', direction: 'neutral', weight: 'medium' })
  }

  // Near law
  if (isNearLaw) {
    signals.push({ id: 'near_law', label: 'Near resolution threshold', value: `${price}¢ FOR`, direction: 'for', weight: 'high' })
  }

  // Deadlocked
  if (isDeadlocked) {
    signals.push({ id: 'deadlocked', label: 'Community deadlocked', value: 'No clear verdict', direction: 'neutral', weight: 'high' })
  }

  // Volume
  if (totalVotes >= 1000) {
    signals.push({ id: 'high_volume', label: 'High participation', value: `${totalVotes.toLocaleString()} votes`, direction: 'neutral', weight: 'medium' })
  } else if (totalVotes < 50) {
    signals.push({ id: 'low_volume', label: 'Limited data', value: `${totalVotes} votes`, direction: 'neutral', weight: 'low' })
  }

  // Price momentum
  if (priceDelta !== null) {
    if (priceDelta >= 5) {
      signals.push({ id: 'rising', label: 'Price rising', value: `+${priceDelta.toFixed(1)}¢ trend`, direction: 'for', weight: 'medium' })
    } else if (priceDelta <= -5) {
      signals.push({ id: 'falling', label: 'Price falling', value: `${priceDelta.toFixed(1)}¢ trend`, direction: 'against', weight: 'medium' })
    }
  }

  // Argument quality edge
  const qualEdge =
    avgScoreFor !== null && avgScoreAgainst !== null
      ? avgScoreFor - avgScoreAgainst
      : null
  if (qualEdge !== null) {
    if (qualEdge >= 10) {
      signals.push({ id: 'arg_quality_for', label: 'FOR arguments stronger', value: `+${qualEdge.toFixed(0)} quality edge`, direction: 'for', weight: 'medium' })
    } else if (qualEdge <= -10) {
      signals.push({ id: 'arg_quality_against', label: 'AGAINST arguments stronger', value: `${qualEdge.toFixed(0)} quality edge`, direction: 'against', weight: 'medium' })
    }
  }

  // Argument volume balance
  const totalArgs = argCountFor + argCountAgainst
  if (totalArgs > 0) {
    const forShare = argCountFor / totalArgs
    if (forShare >= 0.65) {
      signals.push({ id: 'arg_volume_for', label: 'More FOR arguments', value: `${argCountFor} vs ${argCountAgainst}`, direction: 'for', weight: 'low' })
    } else if (forShare <= 0.35) {
      signals.push({ id: 'arg_volume_against', label: 'More AGAINST arguments', value: `${argCountAgainst} vs ${argCountFor}`, direction: 'against', weight: 'low' })
    }
  }

  // Closing soon
  if (votingEndsAt) {
    const hoursLeft = (new Date(votingEndsAt).getTime() - Date.now()) / 3_600_000
    if (hoursLeft > 0 && hoursLeft < 48) {
      signals.push({ id: 'closing', label: 'Closing soon', value: `${hoursLeft < 1 ? '< 1h' : `${Math.floor(hoursLeft)}h`} left`, direction: 'neutral', weight: 'high' })
    }
  }

  return signals
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Market data ────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select(`
      id, statement, category, status,
      blue_pct, blue_votes, red_votes, total_votes,
      feed_score, view_count, voting_ends_at, created_at
    `)
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Market not found' }, { status: 404 })

  const price = Math.round(topic.blue_pct ?? 50)
  const totalVotes = topic.total_votes ?? 0
  const blueVotes = topic.blue_votes ?? 0
  const redVotes = topic.red_votes ?? 0

  // ── 2. Price history for momentum ─────────────────────────────────────────
  const { data: history } = await supabase
    .from('topic_price_history')
    .select('price, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: false })
    .limit(10)

  let priceDelta: number | null = null
  if (history && history.length >= 2) {
    const newest = history[0].price
    const oldest = history[history.length - 1].price
    priceDelta = newest - oldest
  }

  // ── 3. Arguments (top 3 each side) ───────────────────────────────────────
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes, ai_score, ai_grade, source_url, created_at,
      profiles:user_id ( username, display_name, avatar_url, role )
    `)
    .eq('topic_id', id)
    .in('side', ['blue', 'red'])
    .order('upvotes', { ascending: false })
    .limit(20)

  const topFor: VerdictArgument[] = []
  const topAgainst: VerdictArgument[] = []

  let totalArgFor = 0
  let totalArgAgainst = 0
  let sumScoreFor = 0
  let countScoreFor = 0
  let sumScoreAgainst = 0
  let countScoreAgainst = 0

  for (const a of argsRaw ?? []) {
    const profRaw = (a as Record<string, unknown>).profiles
    const prof = Array.isArray(profRaw) ? profRaw[0] : profRaw as {
      username: string; display_name: string | null; avatar_url: string | null; role: string
    } | null
    const arg: VerdictArgument = {
      id: a.id as string,
      content: (a.content as string) ?? '',
      side: a.side as 'blue' | 'red',
      upvotes: (a.upvotes as number) ?? 0,
      ai_score: (a.ai_score as number | null) ?? null,
      ai_grade: (a.ai_grade as string | null) ?? null,
      source_url: (a.source_url as string | null) ?? null,
      created_at: a.created_at as string,
      author: {
        username: prof?.username ?? 'anonymous',
        display_name: prof?.display_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
        role: prof?.role ?? 'citizen',
      },
    }
    if (a.side === 'blue') {
      totalArgFor++
      if (a.ai_score !== null) { sumScoreFor += (a.ai_score as number); countScoreFor++ }
      if (topFor.length < 3) topFor.push(arg)
    } else {
      totalArgAgainst++
      if (a.ai_score !== null) { sumScoreAgainst += (a.ai_score as number); countScoreAgainst++ }
      if (topAgainst.length < 3) topAgainst.push(arg)
    }
  }

  // Need exact counts
  const { count: forCount } = await supabase
    .from('topic_arguments')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', id)
    .eq('side', 'blue')

  const { count: againstCount } = await supabase
    .from('topic_arguments')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', id)
    .eq('side', 'red')

  const exactForCount = forCount ?? totalArgFor
  const exactAgainstCount = againstCount ?? totalArgAgainst

  const avgScoreFor = countScoreFor > 0 ? sumScoreFor / countScoreFor : null
  const avgScoreAgainst = countScoreAgainst > 0 ? sumScoreAgainst / countScoreAgainst : null

  // ── 4. Forecaster consensus (from topic_predictions) ─────────────────────
  let forecast: VerdictForecast | null = null
  try {
    const { data: predictions } = await supabase
      .from('topic_predictions')
      .select('predicted_law, confidence, resolved_at')
      .eq('topic_id', id)
      .is('resolved_at', null)
      .limit(100)

    if (predictions && predictions.length > 0) {
      const forPreds = predictions.filter((p) => p.predicted_law === true)
      const againstPreds = predictions.filter((p) => p.predicted_law === false)
      const avgForPrice = forPreds.length > 0
        ? forPreds.reduce((s, p) => s + (p.confidence ?? 50), 0) / forPreds.length
        : null
      const avgAgainstPrice = againstPreds.length > 0
        ? againstPreds.reduce((s, p) => s + (p.confidence ?? 50), 0) / againstPreds.length
        : null
      forecast = {
        total: predictions.length,
        for_count: forPreds.length,
        against_count: againstPreds.length,
        avg_for_price: avgForPrice,
        avg_against_price: avgAgainstPrice,
      }
    }
  } catch {
    // predictions table may not exist yet
  }

  // ── 5. Resolved comparables ────────────────────────────────────────────────
  const { data: resolved } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .in('status', ['law', 'failed'])
    .eq('category', topic.category ?? '')
    .limit(50)

  const resolvedComps: VerdictResolvedComp[] = []
  for (const r of resolved ?? []) {
    if (r.id === id) continue
    // Simple keyword overlap similarity
    const words1 = new Set((topic.statement ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 3))
    const words2 = new Set((r.statement ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 3))
    let overlap = 0
    for (const w of words2) { if (words1.has(w)) overlap++ }
    const sim = overlap / Math.max(words1.size, 1)
    if (sim > 0.1) {
      resolvedComps.push({
        id: r.id,
        statement: r.statement ?? '',
        category: r.category,
        final_price: Math.round(r.blue_pct ?? 50),
        resolution: r.status as 'law' | 'failed',
        total_votes: r.total_votes ?? 0,
        similarity: Math.round(sim * 100),
      })
    }
  }
  resolvedComps.sort((a, b) => b.similarity - a.similarity)

  // ── 6. Compute derived fields ─────────────────────────────────────────────
  const isHot = (topic.feed_score ?? 0) > 50
  const isNearLaw = price >= 67 && topic.status === 'active'
  const isDeadlocked = price >= 44 && price <= 56 && totalVotes >= 100

  const verdict = computeVerdict(price)
  const argBalance = exactForCount / Math.max(exactForCount + exactAgainstCount, 1)
  const confidence = computeConfidence(price, totalVotes, !!forecast, argBalance)
  const summary = buildSummary(verdict, price, topic.statement ?? '')
  const signals = buildSignals(
    price, totalVotes, isHot, isNearLaw, isDeadlocked,
    priceDelta, exactForCount, exactAgainstCount,
    avgScoreFor, avgScoreAgainst,
    topic.voting_ends_at ?? null,
  )

  const data: VerdictData = {
    market: {
      id: topic.id,
      statement: topic.statement ?? '',
      category: topic.category,
      status: topic.status,
      price,
      blue_votes: blueVotes,
      red_votes: redVotes,
      total_votes: totalVotes,
      is_hot: isHot,
      is_near_law: isNearLaw,
      is_deadlocked: isDeadlocked,
      voting_ends_at: topic.voting_ends_at ?? null,
      created_at: topic.created_at,
    },
    verdict,
    confidence,
    summary,
    top_for: topFor,
    top_against: topAgainst,
    signals,
    forecast,
    resolved_comps: resolvedComps.slice(0, 4),
    argument_stats: {
      total_for: exactForCount,
      total_against: exactAgainstCount,
      avg_ai_score_for: avgScoreFor,
      avg_ai_score_against: avgScoreAgainst,
    },
  }

  return NextResponse.json(data)
}
