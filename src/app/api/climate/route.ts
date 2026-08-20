import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 120

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClimateTopicRow {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  created_at: string
}

export interface CategoryClimate {
  name: string
  topicCount: number
  avgBluePct: number
  votingCount: number
  condition: 'stormy' | 'mixed' | 'clear'
}

export interface ClimateStorm {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  contestedness: number
}

export interface ClimateSunny {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  side: 'for' | 'against'
}

export interface ClimateForecast {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  distance_to_law: number
  voting_ends_at: string | null
}

export type ClimateCondition = 'stormy' | 'unsettled' | 'mixed' | 'improving' | 'clear'

export interface ClimateResponse {
  // Platform snapshot
  totalActiveTopics: number
  totalVotingTopics: number
  platformBluePct: number
  condition: ClimateCondition
  conditionText: string

  // Storm systems — highly contested (43–57% split)
  storms: ClimateStorm[]

  // Sunny — strong consensus (>70% either direction)
  sunny: ClimateSunny[]

  // Forecast — topics near becoming law
  forecast: ClimateForecast[]

  // Category breakdown
  categories: CategoryClimate[]

  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contestedness(bluePct: number): number {
  return Math.round(100 - Math.abs(bluePct - 50) * 2)
}

function deriveCondition(
  stormCount: number,
  sunnyCount: number,
  totalActive: number
): ClimateCondition {
  if (totalActive === 0) return 'mixed'
  const stormRatio = stormCount / Math.max(1, totalActive)
  const sunnyRatio = sunnyCount / Math.max(1, totalActive)
  if (stormRatio > 0.5) return 'stormy'
  if (stormRatio > 0.35) return 'unsettled'
  if (sunnyRatio > 0.5) return 'clear'
  if (sunnyRatio > 0.3) return 'improving'
  return 'mixed'
}

const CONDITION_TEXT: Record<ClimateCondition, string> = {
  stormy:    'Civic discourse is highly turbulent — most debates are deeply contested.',
  unsettled: 'Significant disagreement across the platform — expect heavy debate.',
  mixed:     'A balanced mix of contested topics and emerging consensus.',
  improving: 'Consensus is forming on many fronts — the civic weather is brightening.',
  clear:     'Strong consensus across most topics — rare civic alignment.',
}

// ─── GET /api/climate ─────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // Fetch all active and voting topics
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const rows: ClimateTopicRow[] = (topics ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    voting_ends_at: t.voting_ends_at ?? null,
    created_at: t.created_at,
  }))

  // Partition into groups
  const activeRows = rows
  const storms: ClimateStorm[] = rows
    .filter((t) => t.total_votes >= 5 && contestedness(t.blue_pct) >= 70)
    .sort((a, b) => contestedness(b.blue_pct) - contestedness(a.blue_pct))
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      contestedness: contestedness(t.blue_pct),
    }))

  const sunny: ClimateSunny[] = rows
    .filter((t) => t.total_votes >= 5 && (t.blue_pct >= 70 || t.blue_pct <= 30))
    .sort((a, b) => Math.abs(b.blue_pct - 50) - Math.abs(a.blue_pct - 50))
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      side: t.blue_pct >= 50 ? 'for' : 'against',
    }))

  const forecast: ClimateForecast[] = rows
    .filter((t) => t.status === 'voting' || (t.blue_pct >= 65 && t.total_votes >= 20))
    .sort((a, b) => b.blue_pct - a.blue_pct)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      distance_to_law: Math.max(0, Math.round(75 - t.blue_pct)),
      voting_ends_at: t.voting_ends_at,
    }))

  // Category breakdown
  const categoryMap = new Map<string, { topics: ClimateTopicRow[]; voting: number }>()
  for (const t of rows) {
    const key = t.category ?? 'Other'
    const bucket = categoryMap.get(key) ?? { topics: [], voting: 0 }
    bucket.topics.push(t)
    if (t.status === 'voting') bucket.voting++
    categoryMap.set(key, bucket)
  }

  const categories: CategoryClimate[] = Array.from(categoryMap.entries())
    .map(([name, { topics: ts, voting }]) => {
      const avgBluePct =
        ts.reduce((acc, t) => acc + t.blue_pct, 0) / Math.max(1, ts.length)
      const avgContest =
        ts.reduce((acc, t) => acc + contestedness(t.blue_pct), 0) / Math.max(1, ts.length)
      let condition: CategoryClimate['condition'] = 'mixed'
      if (avgContest >= 60) condition = 'stormy'
      else if (Math.abs(avgBluePct - 50) >= 20) condition = 'clear'
      return {
        name,
        topicCount: ts.length,
        avgBluePct: Math.round(avgBluePct),
        votingCount: voting,
        condition,
      }
    })
    .sort((a, b) => b.topicCount - a.topicCount)
    .slice(0, 8)

  // Platform-wide stats
  const platformBluePct =
    rows.length > 0
      ? rows.reduce((acc, t) => acc + t.blue_pct, 0) / rows.length
      : 50
  const condition = deriveCondition(storms.length, sunny.length, activeRows.length)

  const response: ClimateResponse = {
    totalActiveTopics: rows.length,
    totalVotingTopics: rows.filter((t) => t.status === 'voting').length,
    platformBluePct: Math.round(platformBluePct),
    condition,
    conditionText: CONDITION_TEXT[condition],
    storms,
    sunny,
    forecast,
    categories,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
  })
}
