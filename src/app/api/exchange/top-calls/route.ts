import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopCall {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  topic_id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  target_price: number
  direction: 'bullish' | 'bearish' | 'neutral'
  horizon: string
  confidence: number
  reasoning: string | null
  resolution_price: number      // 100 if law, 0 if failed
  price_error: number           // abs(target_price - resolution_price)
  accuracy: number              // 0-100: 100 = perfect call
  direction_correct: boolean
  composite_score: number       // accuracy × (confidence/5)
  created_at: string
  resolved_at: string | null
  days_held: number | null      // days from forecast to resolution
}

export interface PendingCall {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  target_price: number
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  reasoning: string | null
  delta: number                 // target_price - current_price
  created_at: string
}

export interface TopCallsStats {
  total_resolved: number
  correct_direction: number
  correct_direction_pct: number | null
  avg_accuracy: number | null
  top_category: string | null
}

export interface TopCallsResponse {
  calls: TopCall[]
  pending: PendingCall[]
  stats: TopCallsStats
  sort: string
  category: string | null
  total: number
}

// ─── GET /api/exchange/top-calls ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const sort = searchParams.get('sort') || 'score'         // 'score' | 'accuracy' | 'confidence' | 'new'
  const category = searchParams.get('category') || null
  const dirFilter = searchParams.get('direction') || null   // 'bullish' | 'bearish'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  // ── 1. Fetch resolved forecasts (topics that are law or failed) ──────────────

  let query = supabase
    .from('exchange_forecasts')
    .select(`
      id,
      user_id,
      topic_id,
      target_price,
      direction,
      horizon,
      confidence,
      reasoning,
      created_at,
      profiles!exchange_forecasts_user_id_fkey (
        username,
        display_name,
        avatar_url,
        role
      ),
      topics!exchange_forecasts_topic_id_fkey (
        statement,
        category,
        status,
        updated_at
      )
    `)
    .in('topics.status', ['law', 'failed'])
    .limit(500)

  if (category) {
    query = query.eq('topics.category', category)
  }
  if (dirFilter) {
    query = query.eq('direction', dirFilter)
  }

  const { data: rawResolved } = await query

  // ── 2. Fetch near-resolution pending forecasts (topics in voting) ────────────

  let pendingQuery = supabase
    .from('exchange_forecasts')
    .select(`
      id,
      user_id,
      topic_id,
      target_price,
      direction,
      confidence,
      reasoning,
      created_at,
      profiles!exchange_forecasts_user_id_fkey (
        username,
        display_name,
        avatar_url,
        role
      ),
      topics!exchange_forecasts_topic_id_fkey (
        statement,
        category,
        status,
        blue_pct
      )
    `)
    .eq('topics.status', 'voting')
    .gte('confidence', 3)
    .order('confidence', { ascending: false })
    .limit(20)

  if (category) {
    pendingQuery = pendingQuery.eq('topics.category', category)
  }

  const { data: rawPending } = await pendingQuery

  // ── 3. Score resolved forecasts ───────────────────────────────────────────────

  const calls: TopCall[] = (rawResolved ?? [])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics
      if (!profile || !topic) return null

      const status = (topic.status ?? '') as 'law' | 'failed' | string
      if (status !== 'law' && status !== 'failed') return null

      const resolutionPrice = status === 'law' ? 100 : 0
      const priceError = Math.abs(row.target_price - resolutionPrice)
      const accuracy = Math.max(0, 100 - priceError)
      const directionCorrect =
        (row.direction === 'bullish' && status === 'law') ||
        (row.direction === 'bearish' && status === 'failed') ||
        (row.direction === 'neutral') // neutral is always "partially correct"
      const compositeScore = directionCorrect
        ? accuracy * (row.confidence / 5)
        : 0

      let daysHeld: number | null = null
      if (topic.updated_at) {
        const ms = new Date(topic.updated_at).getTime() - new Date(row.created_at).getTime()
        daysHeld = Math.max(0, Math.round(ms / 86_400_000))
      }

      return {
        id: row.id,
        user_id: row.user_id,
        username: profile.username ?? '',
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        role: profile.role ?? 'person',
        topic_id: row.topic_id,
        statement: topic.statement ?? '',
        category: topic.category ?? null,
        status: status as 'law' | 'failed',
        target_price: row.target_price,
        direction: row.direction as 'bullish' | 'bearish' | 'neutral',
        horizon: row.horizon,
        confidence: row.confidence,
        reasoning: row.reasoning ?? null,
        resolution_price: resolutionPrice,
        price_error: priceError,
        accuracy,
        direction_correct: directionCorrect,
        composite_score: compositeScore,
        created_at: row.created_at,
        resolved_at: topic.updated_at ?? null,
        days_held: daysHeld,
      } satisfies TopCall
    })
    .filter((c): c is TopCall => c !== null)

  // Sort resolved calls
  const sorted = [...calls].sort((a, b) => {
    if (sort === 'accuracy') return b.accuracy - a.accuracy
    if (sort === 'confidence') return b.confidence - a.confidence
    if (sort === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return b.composite_score - a.composite_score // default: composite score
  })

  // ── 4. Shape pending calls ────────────────────────────────────────────────────

  const pending: PendingCall[] = (rawPending ?? [])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics
      if (!profile || !topic) return null
      const currentPrice = topic.blue_pct ?? 50
      return {
        id: row.id,
        user_id: row.user_id,
        username: profile.username ?? '',
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        role: profile.role ?? 'person',
        topic_id: row.topic_id,
        statement: topic.statement ?? '',
        category: topic.category ?? null,
        status: topic.status ?? 'voting',
        current_price: currentPrice,
        target_price: row.target_price,
        direction: row.direction as 'bullish' | 'bearish' | 'neutral',
        confidence: row.confidence,
        reasoning: row.reasoning ?? null,
        delta: row.target_price - currentPrice,
        created_at: row.created_at,
      } satisfies PendingCall
    })
    .filter((c): c is PendingCall => c !== null)

  // ── 5. Aggregate stats ────────────────────────────────────────────────────────

  const totalResolved = calls.length
  const correctDir = calls.filter((c) => c.direction_correct).length
  const avgAccuracy = totalResolved > 0
    ? Math.round(calls.reduce((s, c) => s + c.accuracy, 0) / totalResolved)
    : null

  // Find most represented category in correct calls
  const catCounts: Record<string, number> = {}
  for (const c of calls.filter((c) => c.direction_correct)) {
    if (c.category) catCounts[c.category] = (catCounts[c.category] ?? 0) + 1
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const stats: TopCallsStats = {
    total_resolved: totalResolved,
    correct_direction: correctDir,
    correct_direction_pct: totalResolved > 0
      ? Math.round((correctDir / totalResolved) * 100)
      : null,
    avg_accuracy: avgAccuracy,
    top_category: topCategory,
  }

  return NextResponse.json({
    calls: sorted.slice(0, limit),
    pending,
    stats,
    sort,
    category,
    total: sorted.length,
  } satisfies TopCallsResponse)
}
