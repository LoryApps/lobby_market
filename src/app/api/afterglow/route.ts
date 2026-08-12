import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AfterglewLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  // Afterglow metrics
  argument_count: number
  view_count: number
  days_since_law: number
  afterglow_score: number   // 0–100: intensity of ongoing engagement
  heat_tier: 'blazing' | 'warm' | 'cooling' | 'cold'
}

export interface AfterglowResponse {
  laws: AfterglewLaw[]
  total: number
  category: string | null
  window_days: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function heatTier(score: number): AfterglewLaw['heat_tier'] {
  if (score >= 70) return 'blazing'
  if (score >= 40) return 'warm'
  if (score >= 15) return 'cooling'
  return 'cold'
}

// ─── GET /api/afterglow ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category')?.trim() ?? ''
  const rawWindow  = parseInt(searchParams.get('window') ?? '60', 10)
  const rawSort    = searchParams.get('sort') ?? 'afterglow'
  const rawLimit   = parseInt(searchParams.get('limit') ?? '30', 10)

  const VALID_CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
    'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const category   = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null
  const windowDays = Math.min(Math.max(Number.isFinite(rawWindow) ? rawWindow : 60, 7), 365)
  const sort       = ['afterglow', 'recent', 'votes', 'arguments'].includes(rawSort) ? rawSort : 'afterglow'
  const limit      = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 30, 5), 60)

  const supabase = await createClient()

  // ── Fetch recently established laws ──────────────────────────────────────
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  let lawsQuery = supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .gte('established_at', cutoff)
    .order('established_at', { ascending: false })
    .limit(200)

  if (category) {
    lawsQuery = lawsQuery.eq('category', category)
  }

  const { data: lawRows, error } = await lawsQuery
  if (error || !lawRows?.length) {
    return NextResponse.json<AfterglowResponse>({
      laws: [],
      total: 0,
      category,
      window_days: windowDays,
    })
  }

  const lawIds = lawRows.map((l) => l.id)

  // ── Fetch argument counts for these laws (post-establishment activity) ──
  const { data: argCounts } = await supabase
    .from('arguments')
    .select('topic_id')
    .in('topic_id', lawIds)

  const argCountMap = new Map<string, number>()
  for (const row of argCounts ?? []) {
    argCountMap.set(row.topic_id, (argCountMap.get(row.topic_id) ?? 0) + 1)
  }

  // ── Fetch view counts for these topics ───────────────────────────────────
  const { data: viewRows } = await supabase
    .from('topics')
    .select('id, view_count')
    .in('id', lawIds)

  const viewMap = new Map<string, number>()
  for (const row of viewRows ?? []) {
    viewMap.set(row.id, row.view_count ?? 0)
  }

  // ── Compute afterglow score ───────────────────────────────────────────────
  const now = Date.now()

  const laws: AfterglewLaw[] = lawRows.map((law) => {
    const establishedMs = new Date(law.established_at).getTime()
    const daysSince = Math.max((now - establishedMs) / 86_400_000, 0.01)
    const argCount  = argCountMap.get(law.id) ?? 0
    const viewCount = viewMap.get(law.id) ?? 0

    // Recency component: laws within 3 days score highest (0–40 pts)
    const recencyScore = Math.max(0, 40 - (daysSince / windowDays) * 40)

    // Argument activity per day (0–30 pts, capped at 30 args/day)
    const argsPerDay = argCount / daysSince
    const argScore = Math.min(argsPerDay / 30, 1) * 30

    // View density per day (0–30 pts, capped at 500 views/day)
    const viewsPerDay = viewCount / daysSince
    const viewScore = Math.min(viewsPerDay / 500, 1) * 30

    const afterglow_score = Math.round(recencyScore + argScore + viewScore)

    return {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      argument_count: argCount,
      view_count: viewCount,
      days_since_law: Math.round(daysSince * 10) / 10,
      afterglow_score,
      heat_tier: heatTier(afterglow_score),
    }
  })

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (sort === 'afterglow') {
    laws.sort((a, b) => b.afterglow_score - a.afterglow_score)
  } else if (sort === 'recent') {
    laws.sort((a, b) => new Date(b.established_at).getTime() - new Date(a.established_at).getTime())
  } else if (sort === 'votes') {
    laws.sort((a, b) => b.total_votes - a.total_votes)
  } else {
    laws.sort((a, b) => b.argument_count - a.argument_count)
  }

  return NextResponse.json<AfterglowResponse>({
    laws: laws.slice(0, limit),
    total: laws.length,
    category,
    window_days: windowDays,
  })
}
