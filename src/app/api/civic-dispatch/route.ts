import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DispatchUrgency = 'BREAKING' | 'DEVELOPING' | 'WATCH' | 'LIVE'

export interface DispatchItem {
  id: string
  statement: string
  category: string
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  created_at: string
  urgency: DispatchUrgency
  urgency_detail: string
  signal_score: number
}

export interface DispatchSummary {
  total_active: number
  total_dispatches: number
  hottest_category: string | null
  generated_at: string
}

export interface DispatchResponse {
  dispatches: Record<string, DispatchItem>
  summary: DispatchSummary
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const COLS = 'id, statement, category, status, scope, blue_pct, total_votes, created_at'

function urgencyFor(topic: {
  blue_pct: number
  total_votes: number
  status: string
}): { urgency: DispatchUrgency; detail: string } {
  const { blue_pct, total_votes, status } = topic
  const against_pct = 100 - blue_pct

  if (status === 'voting') {
    if (blue_pct >= 72 || against_pct >= 72) return { urgency: 'BREAKING', detail: 'Vote imminent — consensus nearly reached' }
    if (blue_pct >= 62 || against_pct >= 62) return { urgency: 'BREAKING', detail: 'Strong majority forming — approaching law threshold' }
    if (Math.abs(blue_pct - 50) <= 5) return { urgency: 'WATCH', detail: 'Razor-thin split — outcome could go either way' }
    return { urgency: 'DEVELOPING', detail: 'Vote underway — result pending' }
  }

  if (status === 'active') {
    if (blue_pct >= 67 || against_pct >= 67) return { urgency: 'BREAKING', detail: 'Clear mandate forming — nearing voting phase' }
    if (total_votes >= 200) return { urgency: 'DEVELOPING', detail: 'High-turnout debate — community engaged' }
    if (Math.abs(blue_pct - 50) <= 3 && total_votes >= 50) return { urgency: 'WATCH', detail: 'Deeply contested — community split down the middle' }
    return { urgency: 'LIVE', detail: 'Active debate — voices still being heard' }
  }

  return { urgency: 'LIVE', detail: 'Under deliberation' }
}

function signalScore(topic: {
  blue_pct: number
  total_votes: number
  status: string
  created_at: string
}): number {
  const { blue_pct, total_votes, status, created_at } = topic
  const against_pct = 100 - blue_pct

  const ageHours = (Date.now() - new Date(created_at).getTime()) / 3_600_000
  const recencyBonus = Math.max(0, 1 - ageHours / 168) // decays over 7 days

  // Controversy: how far from 50/50 (higher = more decisive)
  const decisiveness = Math.abs(blue_pct - 50) / 50

  // Threshold proximity: how close to passing/failing threshold
  const forProximity = Math.max(0, blue_pct - 62) / 13
  const againstProximity = Math.max(0, against_pct - 62) / 13
  const thresholdProximity = Math.max(forProximity, againstProximity)

  // Volume weight
  const volumeWeight = Math.min(1, Math.log10(Math.max(1, total_votes)) / 3)

  // Status weight
  const statusWeight = status === 'voting' ? 1.5 : status === 'active' ? 1.0 : 0.5

  return (
    (decisiveness * 0.25 + thresholdProximity * 0.35 + volumeWeight * 0.25 + recencyBonus * 0.15) *
    statusWeight
  )
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: topics, error } = await supabase
    .from('topics')
    .select(COLS)
    .in('status', ['active', 'voting'])
    .in('category', CATEGORIES)
    .order('total_votes', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = topics ?? []

  // Pick the single highest-signal topic per category
  const dispatches: Record<string, DispatchItem> = {}

  for (const cat of CATEGORIES) {
    const catTopics = rows.filter((t) => t.category === cat)
    if (catTopics.length === 0) continue

    const scored = catTopics.map((t) => ({
      ...t,
      _score: signalScore(t as { blue_pct: number; total_votes: number; status: string; created_at: string }),
    }))
    scored.sort((a, b) => b._score - a._score)

    const top = scored[0]
    const { urgency, detail } = urgencyFor(top as { blue_pct: number; total_votes: number; status: string })

    dispatches[cat] = {
      id: top.id,
      statement: top.statement,
      category: top.category!,
      status: top.status,
      scope: top.scope,
      blue_pct: top.blue_pct,
      total_votes: top.total_votes,
      created_at: top.created_at,
      urgency,
      urgency_detail: detail,
      signal_score: Math.round(top._score * 100) / 100,
    }
  }

  const hottestCat =
    Object.entries(dispatches).sort(([, a], [, b]) => b.signal_score - a.signal_score)[0]?.[0] ??
    null

  const summary: DispatchSummary = {
    total_active: rows.length,
    total_dispatches: Object.keys(dispatches).length,
    hottest_category: hottestCat,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(
    { dispatches, summary, generated_at: summary.generated_at } satisfies DispatchResponse,
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' } }
  )
}
