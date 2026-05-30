import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EpochLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
}

export interface EpochMonth {
  year: number
  month: number          // 1-12
  month_label: string    // "January 2025"
  laws_passed: EpochLaw[]
  law_count: number
  vote_count: number
  topic_count: number
  argument_count: number
  avg_blue_pct: number   // 0-100
  dominant_category: string | null
  /** How the epoch "feels" based on its metrics */
  character: EpochCharacter
  character_label: string
  character_desc: string
}

export type EpochCharacter =
  | 'legislative'   // many laws passed
  | 'contested'     // near-50/50 split overall
  | 'consensus'     // strong FOR leaning
  | 'resistance'    // strong AGAINST leaning
  | 'surge'         // very high vote activity
  | 'quiet'         // low activity, few events
  | 'debate'        // many arguments, few resolutions

export interface EpochResponse {
  epochs: EpochMonth[]
  total_laws: number
  total_votes: number
  total_topics: number
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function characterise(
  lawCount: number,
  voteCount: number,
  argumentCount: number,
  avgBluePct: number,
  totalVotesMedian: number,
): { character: EpochCharacter; label: string; desc: string } {
  if (lawCount >= 5) {
    return {
      character: 'legislative',
      label: 'Legislative Era',
      desc: 'A wave of civic proposals achieved consensus and became law.',
    }
  }
  if (Math.abs(avgBluePct - 50) < 5) {
    return {
      character: 'contested',
      label: 'Great Debate',
      desc: 'The community was deeply divided — neither side could claim majority.',
    }
  }
  if (avgBluePct >= 65) {
    return {
      character: 'consensus',
      label: 'Progressive Wave',
      desc: 'Strong FOR momentum — the community leaned heavily toward change.',
    }
  }
  if (avgBluePct <= 35) {
    return {
      character: 'resistance',
      label: 'Conservative Surge',
      desc: 'Widespread scepticism — the community pushed back on proposed changes.',
    }
  }
  if (voteCount >= totalVotesMedian * 2.5) {
    return {
      character: 'surge',
      label: 'Civic Surge',
      desc: 'Extraordinary participation — the Lobby was buzzing with democratic energy.',
    }
  }
  if (argumentCount >= 40 && lawCount === 0) {
    return {
      character: 'debate',
      label: 'Age of Argument',
      desc: 'Debate was fierce, but consensus remained elusive — opinions clashed without resolution.',
    }
  }
  if (voteCount < Math.max(totalVotesMedian * 0.3, 5) && lawCount === 0) {
    return {
      character: 'quiet',
      label: 'Quiet Quarter',
      desc: 'A period of reflection — low activity but steady civic presence.',
    }
  }
  return {
    character: 'surge',
    label: 'Active Democracy',
    desc: 'Regular civic participation — votes, arguments, and proposals flowed steadily.',
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── 1. Established laws by month ──────────────────────────────────────────
  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(500)

  // ── 2. Topics created by month ─────────────────────────────────────────────
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, created_at, category, blue_pct')
    .order('created_at', { ascending: false })
    .limit(2000)

  // ── 3. Arguments by month ──────────────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('arguments')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(5000)

  // ── 4. Votes by month (sampled via topics total_votes delta isn't possible;
  //       use arguments as a proxy for activity level) ─────────────────────

  const laws = lawRows ?? []
  const topics = topicRows ?? []
  const args = argRows ?? []

  // Build month buckets from earliest data to now
  const allDates = [
    ...laws.map((l) => l.established_at),
    ...topics.map((t) => t.created_at),
    ...args.map((a) => a.created_at),
  ]
    .filter(Boolean)
    .map((d) => new Date(d!))

  if (allDates.length === 0) {
    return NextResponse.json({
      epochs: [],
      total_laws: 0,
      total_votes: 0,
      total_topics: 0,
      generated_at: new Date().toISOString(),
    } satisfies EpochResponse)
  }

  const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())))
  const now = new Date()

  // Generate month keys from earliest to now
  const monthKeys: { year: number; month: number }[] = []
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  while (cursor <= end) {
    monthKeys.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  // Helper: get month key from date string
  function getMonthKey(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  // Index by month
  const lawsByMonth: Record<string, EpochLaw[]> = {}
  for (const law of laws) {
    if (!law.established_at) continue
    const key = getMonthKey(law.established_at)
    ;(lawsByMonth[key] ??= []).push(law as EpochLaw)
  }

  const topicCountByMonth: Record<string, number> = {}
  const topicBluePctByMonth: Record<string, number[]> = {}
  const domCatByMonth: Record<string, Record<string, number>> = {}
  for (const t of topics) {
    if (!t.created_at) continue
    const key = getMonthKey(t.created_at)
    topicCountByMonth[key] = (topicCountByMonth[key] ?? 0) + 1
    if (t.blue_pct != null) {
      ;(topicBluePctByMonth[key] ??= []).push(t.blue_pct)
    }
    if (t.category) {
      domCatByMonth[key] ??= {}
      domCatByMonth[key][t.category] = (domCatByMonth[key][t.category] ?? 0) + 1
    }
  }

  const argCountByMonth: Record<string, number> = {}
  for (const a of args) {
    if (!a.created_at) continue
    const key = getMonthKey(a.created_at)
    argCountByMonth[key] = (argCountByMonth[key] ?? 0) + 1
  }

  // Compute vote counts as sum of topic total_votes per month (using topics created that month)
  // (We don't have a per-vote date, so we use argument count as activity proxy)
  const activityByMonth: Record<string, number> = {}
  for (const key of Object.keys(argCountByMonth)) {
    activityByMonth[key] = argCountByMonth[key]
  }
  const activityValues = Object.values(activityByMonth)
  const medianActivity =
    activityValues.length > 0
      ? activityValues.sort((a, b) => a - b)[Math.floor(activityValues.length / 2)]
      : 1

  // Assemble epochs
  const epochs: EpochMonth[] = []
  for (const { year, month } of monthKeys) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const monthLaws = lawsByMonth[key] ?? []
    const topicCount = topicCountByMonth[key] ?? 0
    const argCount = argCountByMonth[key] ?? 0
    const activity = activityByMonth[key] ?? 0

    // Average blue_pct across laws + topics in this month
    const blueSamples: number[] = [
      ...monthLaws.filter((l) => l.blue_pct != null).map((l) => l.blue_pct!),
      ...(topicBluePctByMonth[key] ?? []),
    ]
    const avgBluePct =
      blueSamples.length > 0
        ? Math.round(blueSamples.reduce((a, b) => a + b, 0) / blueSamples.length)
        : 50

    // Dominant category from topics
    const catCounts = domCatByMonth[key] ?? {}
    const dominantCategory =
      Object.keys(catCounts).length > 0
        ? Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null

    const { character, label: character_label, desc: character_desc } = characterise(
      monthLaws.length,
      activity,
      argCount,
      avgBluePct,
      medianActivity,
    )

    // Skip months with zero activity (no laws, no topics, no args)
    if (monthLaws.length === 0 && topicCount === 0 && argCount === 0) continue

    epochs.push({
      year,
      month,
      month_label: `${MONTH_NAMES[month]} ${year}`,
      laws_passed: monthLaws.slice(0, 6), // cap to 6 per epoch
      law_count: monthLaws.length,
      vote_count: activity,
      topic_count: topicCount,
      argument_count: argCount,
      avg_blue_pct: avgBluePct,
      dominant_category: dominantCategory,
      character,
      character_label,
      character_desc,
    })
  }

  // Sort chronological descending (most recent first)
  epochs.reverse()

  return NextResponse.json({
    epochs,
    total_laws: laws.length,
    total_votes: Object.values(activityByMonth).reduce((a, b) => a + b, 0),
    total_topics: topics.length,
    generated_at: new Date().toISOString(),
  } satisfies EpochResponse)
}
