import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeatLevel = 'inferno' | 'blazing' | 'heating' | 'warm' | 'cool'

export interface HeatTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  /** composite heat score 0–100 */
  heat: number
  heat_level: HeatLevel
  /** votes cast in the last 24 h */
  votes_24h: number
  /** new arguments in the last 24 h */
  args_24h: number
  /** new argument replies in the last 24 h */
  replies_24h: number
  /** controversy factor: 100 = perfect deadlock, 0 = unanimous */
  controversy: number
}

export interface HeatResponse {
  topics: HeatTopic[]
  /** platform-wide average heat */
  avg_heat: number
  /** category with highest aggregate heat */
  hottest_category: string | null
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTER = ['active', 'voting', 'proposed']

// ─── Heat score formula ───────────────────────────────────────────────────────
//
// Four components, each normalised to [0, 100]:
//   • Vote Velocity  (40%) – log-scaled votes in last 24 h
//   • Argument Burst (25%) – new arguments added in last 24 h
//   • Reply Surge    (15%) – new replies in last 24 h
//   • Controversy    (20%) – how close to 50/50 the vote is
//
// This yields a number in [0, 100] where ≥ 90 = "Inferno".
// ─────────────────────────────────────────────────────────────────────────────

function voteVelocityScore(votes24h: number): number {
  // log2(x+1) reaches ≈ 7 at x=127; cap at 100
  return Math.min(100, (Math.log2(votes24h + 1) / 7) * 100)
}

function argBurstScore(args24h: number): number {
  // 0→0, 5→50, 10→100
  return Math.min(100, args24h * 10)
}

function replySurgeScore(replies24h: number): number {
  // 0→0, 10→50, 20→100
  return Math.min(100, replies24h * 5)
}

function controversyScore(blue_pct: number): number {
  // 50/50 → 100; 90/10 → 20
  const deviation = Math.abs(50 - (blue_pct ?? 50))
  return Math.max(0, Math.round((1 - deviation / 50) * 100))
}

function heatScore(
  votes24h: number,
  args24h: number,
  replies24h: number,
  blue_pct: number,
): number {
  const v = voteVelocityScore(votes24h)
  const a = argBurstScore(args24h)
  const r = replySurgeScore(replies24h)
  const c = controversyScore(blue_pct)
  return Math.round(0.4 * v + 0.25 * a + 0.15 * r + 0.2 * c)
}

function heatLevel(score: number): HeatLevel {
  if (score >= 90) return 'inferno'
  if (score >= 70) return 'blazing'
  if (score >= 45) return 'heating'
  if (score >= 20) return 'warm'
  return 'cool'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category')
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '30', 10))

  const supabase = await createClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Candidate topics ────────────────────────────────────────────────────

  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
    .in('status', STATUS_FILTER)
    .order('total_votes', { ascending: false })
    .limit(200)  // consider top-200 by total votes as candidates

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicRows } = await topicsQuery
  const topics = (topicRows ?? []) as Array<{
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    view_count: number
    created_at: string
  }>

  if (topics.length === 0) {
    return NextResponse.json({
      topics: [],
      avg_heat: 0,
      hottest_category: null,
      generated_at: new Date().toISOString(),
    } satisfies HeatResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // ── 2. Recent votes (last 24 h) ────────────────────────────────────────────

  const { data: voteRows } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', cutoff)

  const votes24hMap = new Map<string, number>()
  for (const row of voteRows ?? []) {
    votes24hMap.set(row.topic_id, (votes24hMap.get(row.topic_id) ?? 0) + 1)
  }

  // ── 3. Recent arguments (last 24 h) ───────────────────────────────────────

  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', cutoff)

  const args24hMap = new Map<string, number>()
  for (const row of argRows ?? []) {
    args24hMap.set(row.topic_id, (args24hMap.get(row.topic_id) ?? 0) + 1)
  }

  // ── 4. Recent replies (last 24 h) ─────────────────────────────────────────

  const { data: replyRows } = await supabase
    .from('argument_replies')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', cutoff)

  const replies24hMap = new Map<string, number>()
  for (const row of replyRows ?? []) {
    replies24hMap.set(row.topic_id, (replies24hMap.get(row.topic_id) ?? 0) + 1)
  }

  // ── 5. Score each topic ────────────────────────────────────────────────────

  const scored: HeatTopic[] = topics.map((t) => {
    const v24 = votes24hMap.get(t.id) ?? 0
    const a24 = args24hMap.get(t.id) ?? 0
    const r24 = replies24hMap.get(t.id) ?? 0
    const controversy = controversyScore(t.blue_pct ?? 50)
    const score = heatScore(v24, a24, r24, t.blue_pct ?? 50)

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      view_count: t.view_count ?? 0,
      heat: score,
      heat_level: heatLevel(score),
      votes_24h: v24,
      args_24h: a24,
      replies_24h: r24,
      controversy,
    }
  })

  // Sort by heat descending
  scored.sort((a, b) => b.heat - a.heat)

  const topScored = scored.slice(0, limit)

  // ── 6. Aggregates ──────────────────────────────────────────────────────────

  const avg_heat =
    topScored.length === 0
      ? 0
      : Math.round(topScored.reduce((s, t) => s + t.heat, 0) / topScored.length)

  // Hottest category by sum of top-10 heat scores
  const catHeat = new Map<string, number>()
  for (const t of topScored.slice(0, 10)) {
    const cat = t.category ?? 'Other'
    catHeat.set(cat, (catHeat.get(cat) ?? 0) + t.heat)
  }
  let hottest_category: string | null = null
  let maxCatHeat = -1
  for (const [cat, h] of catHeat) {
    if (h > maxCatHeat) {
      maxCatHeat = h
      hottest_category = cat
    }
  }

  return NextResponse.json({
    topics: topScored,
    avg_heat,
    hottest_category,
    generated_at: new Date().toISOString(),
  } satisfies HeatResponse)
}
