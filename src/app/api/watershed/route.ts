import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface WatershedLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number
  total_votes: number
  topic_created_at: string | null
  days_to_law: number | null
}

export interface CategoryStat {
  category: string
  count: number
  avg_blue_pct: number
  total_votes: number
}

export interface WatershedData {
  total_laws: number
  total_votes: number
  avg_blue_pct: number
  platform_days: number
  mandates: WatershedLaw[]
  razor_edge: WatershedLaw[]
  epics: WatershedLaw[]
  vanguard: WatershedLaw[]
  category_stats: CategoryStat[]
  timeline: WatershedLaw[]
  generated_at: string
}

export async function GET() {
  const supabase = await createClient()

  const { data: lawRows, error } = await supabase
    .from('laws')
    .select(`
      id,
      topic_id,
      statement,
      category,
      established_at,
      blue_pct,
      total_votes,
      topics!inner ( created_at )
    `)
    .eq('is_active', true)
    .not('blue_pct', 'is', null)
    .not('total_votes', 'is', null)
    .gt('total_votes', 0)
    .order('established_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type RawRow = {
    id: string
    topic_id: string
    statement: string
    category: string | null
    established_at: string
    blue_pct: number | null
    total_votes: number | null
    topics: { created_at: string } | Array<{ created_at: string }>
  }

  const rows = (lawRows as RawRow[] | null) ?? []

  function daysToLaw(row: RawRow): number | null {
    const topicCreatedAt = Array.isArray(row.topics)
      ? row.topics[0]?.created_at
      : (row.topics as { created_at: string })?.created_at
    if (!topicCreatedAt) return null
    const diff = new Date(row.established_at).getTime() - new Date(topicCreatedAt).getTime()
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
  }

  function toWatershedLaw(row: RawRow): WatershedLaw {
    const topicCreatedAt = Array.isArray(row.topics)
      ? row.topics[0]?.created_at ?? null
      : (row.topics as { created_at: string })?.created_at ?? null
    return {
      id: row.id,
      topic_id: row.topic_id,
      statement: row.statement,
      category: row.category,
      established_at: row.established_at,
      blue_pct: row.blue_pct ?? 50,
      total_votes: row.total_votes ?? 0,
      topic_created_at: topicCreatedAt,
      days_to_law: daysToLaw(row),
    }
  }

  const laws = rows.map(toWatershedLaw)

  if (laws.length === 0) {
    return NextResponse.json({
      total_laws: 0,
      total_votes: 0,
      avg_blue_pct: 0,
      platform_days: 0,
      mandates: [],
      razor_edge: [],
      epics: [],
      vanguard: [],
      category_stats: [],
      timeline: [],
      generated_at: new Date().toISOString(),
    } satisfies WatershedData)
  }

  const totalVotes = laws.reduce((s, l) => s + l.total_votes, 0)
  const avgBluePct = laws.reduce((s, l) => s + l.blue_pct, 0) / laws.length

  // Platform age in days from the oldest established law
  const oldestDate = laws.reduce((oldest, l) =>
    l.established_at < oldest ? l.established_at : oldest, laws[0].established_at)
  const platformDays = Math.round(
    (Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Mandates: highest consensus (must be active laws)
  const mandates = [...laws].sort((a, b) => b.blue_pct - a.blue_pct).slice(0, 8)

  // Razor's edge: closest to 60% (the law threshold)
  const passed = laws.filter((l) => l.blue_pct >= 60)
  const razorEdge = [...passed].sort((a, b) => a.blue_pct - b.blue_pct).slice(0, 6)

  // Epics: highest vote count
  const epics = [...laws].sort((a, b) => b.total_votes - a.total_votes).slice(0, 6)

  // Vanguard: fastest to become law
  const withDays = laws.filter((l) => l.days_to_law !== null)
  const vanguard = [...withDays]
    .sort((a, b) => (a.days_to_law ?? Infinity) - (b.days_to_law ?? Infinity))
    .slice(0, 6)

  // Category stats
  const catMap = new Map<string, { count: number; bluePctSum: number; votes: number }>()
  for (const law of laws) {
    const cat = law.category ?? 'Uncategorized'
    const cur = catMap.get(cat) ?? { count: 0, bluePctSum: 0, votes: 0 }
    catMap.set(cat, {
      count: cur.count + 1,
      bluePctSum: cur.bluePctSum + law.blue_pct,
      votes: cur.votes + law.total_votes,
    })
  }
  const categoryStats: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, { count, bluePctSum, votes }]) => ({
      category,
      count,
      avg_blue_pct: Math.round(bluePctSum / count),
      total_votes: votes,
    }))
    .sort((a, b) => b.count - a.count)

  // Timeline: oldest 50 laws (reverse chronological for display)
  const timeline = [...laws].sort(
    (a, b) => new Date(a.established_at).getTime() - new Date(b.established_at).getTime()
  ).slice(0, 50)

  return NextResponse.json({
    total_laws: laws.length,
    total_votes: totalVotes,
    avg_blue_pct: Math.round(avgBluePct),
    platform_days: platformDays,
    mandates,
    razor_edge: razorEdge,
    epics,
    vanguard,
    category_stats: categoryStats,
    timeline,
    generated_at: new Date().toISOString(),
  } satisfies WatershedData)
}
