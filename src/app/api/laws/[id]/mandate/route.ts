import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MandateClass =
  | 'decisive'  // ≥ 85% FOR — overwhelming consensus
  | 'strong'    // 75–84% FOR — threshold met

export interface ComparableLaw {
  id: string
  statement: string
  blue_pct: number
  total_votes: number
  established_at: string
  category: string | null
}

export interface DailyBucket {
  date: string           // YYYY-MM-DD
  for_votes: number
  against_votes: number
  running_for_pct: number
}

export interface MandateResponse {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    blue_pct: number
    total_votes: number
    topic_id: string
    days_to_pass: number
  }
  mandate: {
    class: MandateClass
    label: string
    description: string
    for_votes: number
    against_votes: number
    margin: number         // blue_pct - 75 (excess above law threshold)
    percentile: number     // 0–100, how this law ranks among all laws by FOR%
    stronger_than_count: number
    total_laws: number
  }
  comparable_laws: ComparableLaw[]
  daily_trend: DailyBucket[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMandateClass(forPct: number): MandateClass {
  return forPct >= 85 ? 'decisive' : 'strong'
}

function getMandateLabel(cls: MandateClass): string {
  return cls === 'decisive' ? 'Decisive Mandate' : 'Strong Mandate'
}

function getMandateDescription(cls: MandateClass, forPct: number): string {
  if (cls === 'decisive') {
    return `With ${Math.round(forPct)}% in favour, this law passed with overwhelming civic consensus — among the most decisive mandates on record.`
  }
  return `With ${Math.round(forPct)}% in favour, this law cleared the 75% threshold with a strong mandate from the civic community.`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const lawId = params.id

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const topicId = law.topic_id

  // Run parallel queries
  const [topicMetaResult, allLawsResult, voteTimestampsResult] = await Promise.all([
    supabase
      .from('topics')
      .select('created_at, blue_votes, red_votes')
      .eq('id', topicId)
      .maybeSingle(),

    // All laws' blue_pct for percentile calculation + comparables
    supabase
      .from('laws')
      .select('id, statement, blue_pct, total_votes, established_at, category')
      .order('blue_pct', { ascending: false })
      .limit(500),

    // Vote timestamps for daily trend (capped at 2000 rows)
    supabase
      .from('votes')
      .select('side, created_at')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .limit(2000),
  ])

  const topicMeta = topicMetaResult.data
  const allLaws = allLawsResult.data ?? []
  const voteTimestamps = voteTimestampsResult.data ?? []

  // ── Mandate stats ──────────────────────────────────────────────────────────

  const bluePct = law.blue_pct ?? 75
  const totalVotes = law.total_votes ?? 0
  const forVotes = topicMeta?.blue_votes ?? Math.round(totalVotes * (bluePct / 100))
  const againstVotes = topicMeta?.red_votes ?? totalVotes - forVotes

  const mandateClass = getMandateClass(bluePct)

  // Percentile among all laws (how many laws have LOWER blue_pct)
  const strongerThan = allLaws.filter((l) => (l.blue_pct ?? 0) < bluePct).length
  const totalLaws = allLaws.length
  const percentile = totalLaws > 0 ? Math.round((strongerThan / totalLaws) * 100) : 50

  // ── Comparable laws ────────────────────────────────────────────────────────
  // Laws within ±3% of this law's mandate, excluding this law
  const comparables: ComparableLaw[] = allLaws
    .filter(
      (l) =>
        l.id !== lawId &&
        Math.abs((l.blue_pct ?? 0) - bluePct) <= 3,
    )
    .slice(0, 8)
    .map((l) => ({
      id: l.id,
      statement: l.statement,
      blue_pct: l.blue_pct ?? 75,
      total_votes: l.total_votes ?? 0,
      established_at: l.established_at,
      category: l.category ?? null,
    }))

  // ── Daily trend ────────────────────────────────────────────────────────────
  // Bucket votes by calendar date
  const dayMap = new Map<string, { for: number; against: number }>()
  for (const v of voteTimestamps) {
    const day = v.created_at.slice(0, 10) // "YYYY-MM-DD"
    const entry = dayMap.get(day) ?? { for: 0, against: 0 }
    if (v.side === 'blue') entry.for++
    else entry.against++
    dayMap.set(day, entry)
  }

  const sortedDays = Array.from(dayMap.keys()).sort()
  let cumFor = 0
  let cumAgainst = 0
  const dailyTrend: DailyBucket[] = sortedDays.map((date) => {
    const bucket = dayMap.get(date)!
    cumFor += bucket.for
    cumAgainst += bucket.against
    const total = cumFor + cumAgainst
    return {
      date,
      for_votes: bucket.for,
      against_votes: bucket.against,
      running_for_pct: total > 0 ? Math.round((cumFor / total) * 100) : 50,
    }
  })

  // ── Days to pass ───────────────────────────────────────────────────────────
  const topicCreatedAt = topicMeta?.created_at ?? law.established_at
  const daysToPass = Math.max(
    1,
    Math.round(
      (new Date(law.established_at).getTime() - new Date(topicCreatedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  )

  const response: MandateResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      established_at: law.established_at,
      blue_pct: bluePct,
      total_votes: totalVotes,
      topic_id: topicId,
      days_to_pass: daysToPass,
    },
    mandate: {
      class: mandateClass,
      label: getMandateLabel(mandateClass),
      description: getMandateDescription(mandateClass, bluePct),
      for_votes: forVotes,
      against_votes: againstVotes,
      margin: Math.round((bluePct - 75) * 10) / 10,
      percentile,
      stronger_than_count: strongerThan,
      total_laws: totalLaws,
    },
    comparable_laws: comparables,
    daily_trend: dailyTrend,
  }

  return NextResponse.json(response)
}
