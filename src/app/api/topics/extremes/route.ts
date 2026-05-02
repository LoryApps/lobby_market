import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtremeTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  voting_ends_at: string | null
  created_at: string
  margin: number
}

export interface ExtremesResponse {
  faultLines: ExtremeTopic[]   // closest to 50/50, most contested
  mandates: ExtremeTopic[]     // furthest from 50/50, strongest consensus
  categoryBreakdown: { category: string; contested: number; decisive: number }[]
  updatedAt: string
}

const COLS =
  'id, statement, category, status, blue_pct, total_votes, scope, voting_ends_at, created_at'

const MIN_VOTES = 10

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch active/voting topics with enough votes to be meaningful
  const { data, error } = await supabase
    .from('topics')
    .select(COLS)
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_VOTES)
    .order('total_votes', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topics = (data ?? []) as (ExtremeTopic & { margin: number })[]

  // Compute margin for each topic (distance from 50)
  const withMargin = topics.map((t) => ({
    ...t,
    margin: Math.abs(t.blue_pct - 50),
  }))

  // Fault lines: closest to 50/50 (margin < 15), sorted by smallest margin first
  const faultLines = [...withMargin]
    .filter((t) => t.margin < 15)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 15)

  // Mandates: furthest from 50/50 (margin > 30), sorted by largest margin first
  const mandates = [...withMargin]
    .filter((t) => t.margin > 30)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 15)

  // Category breakdown
  const catMap = new Map<string, { contested: number; decisive: number }>()

  for (const t of withMargin) {
    const cat = t.category ?? 'Other'
    const entry = catMap.get(cat) ?? { contested: 0, decisive: 0 }
    if (t.margin < 15) entry.contested++
    if (t.margin > 30) entry.decisive++
    catMap.set(cat, entry)
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, counts]) => ({ category, ...counts }))
    .filter((c) => c.contested > 0 || c.decisive > 0)
    .sort((a, b) => (b.contested + b.decisive) - (a.contested + a.decisive))
    .slice(0, 8)

  const response: ExtremesResponse = {
    faultLines,
    mandates,
    categoryBreakdown,
    updatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
