import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  // Computed forecast fields
  pass_probability: number        // 0–100
  base_rate: number               // historical pass rate in this bucket (0–100)
  similar_count: number           // # resolved topics in same bucket
  bucket_label: string            // e.g. "55–60%"
  confidence: 'high' | 'medium' | 'low'
  hours_remaining: number | null
  momentum: 'strong_for' | 'likely_for' | 'toss_up' | 'likely_against' | 'strong_against'
}

export interface CalibrationBucket {
  bucket: string
  min_pct: number
  max_pct: number
  count: number
  pass_count: number
  pass_rate: number               // 0–100
}

export interface ForecastResponse {
  voting_topics: ForecastTopic[]
  calibration: CalibrationBucket[]
  total_resolved: number
  overall_pass_rate: number       // platform-wide pass rate (0–100)
}

// ─── Bucket helpers ───────────────────────────────────────────────────────────

const BUCKETS: Array<{ min: number; max: number; label: string }> = [
  { min: 0,  max: 35, label: '0–35%'   },
  { min: 35, max: 45, label: '35–45%'  },
  { min: 45, max: 50, label: '45–50%'  },
  { min: 50, max: 55, label: '50–55%'  },
  { min: 55, max: 65, label: '55–65%'  },
  { min: 65, max: 75, label: '65–75%'  },
  { min: 75, max: 100, label: '75–100%' },
]

function getBucket(pct: number) {
  return BUCKETS.find(b => pct >= b.min && pct < b.max) ?? BUCKETS[BUCKETS.length - 1]
}

function getMomentum(pct: number): ForecastTopic['momentum'] {
  if (pct >= 70) return 'strong_for'
  if (pct >= 55) return 'likely_for'
  if (pct >= 45) return 'toss_up'
  if (pct >= 30) return 'likely_against'
  return 'strong_against'
}

function getConfidence(count: number): ForecastTopic['confidence'] {
  if (count >= 20) return 'high'
  if (count >= 5)  return 'medium'
  return 'low'
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const [votingRes, resolvedRes] = await Promise.all([
    // Active voting topics
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, voting_ends_at')
      .eq('status', 'voting')
      .order('voting_ends_at', { ascending: true })
      .limit(60),

    // Resolved topics (law or failed) with vote data — calibration source
    supabase
      .from('topics')
      .select('status, blue_pct, total_votes')
      .in('status', ['law', 'failed'])
      .gt('total_votes', 0),
  ])

  const votingTopics = (votingRes.data ?? []) as Array<{
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    voting_ends_at: string | null
  }>

  const resolvedTopics = (resolvedRes.data ?? []) as Array<{
    status: string
    blue_pct: number
    total_votes: number
  }>

  // ── Build calibration buckets ────────────────────────────────────────────
  const bucketMap = new Map<string, { count: number; pass_count: number; b: typeof BUCKETS[0] }>()
  for (const b of BUCKETS) {
    bucketMap.set(b.label, { count: 0, pass_count: 0, b })
  }

  for (const t of resolvedTopics) {
    const b = getBucket(t.blue_pct)
    const entry = bucketMap.get(b.label)
    if (entry) {
      entry.count++
      if (t.status === 'law') entry.pass_count++
    }
  }

  const calibration: CalibrationBucket[] = BUCKETS.map(b => {
    const entry = bucketMap.get(b.label)!
    return {
      bucket: b.label,
      min_pct: b.min,
      max_pct: b.max,
      count: entry.count,
      pass_count: entry.pass_count,
      pass_rate: entry.count > 0 ? Math.round((entry.pass_count / entry.count) * 100) : 50,
    }
  })

  const totalResolved = resolvedTopics.length
  const totalPassed = resolvedTopics.filter(t => t.status === 'law').length
  const overallPassRate = totalResolved > 0 ? Math.round((totalPassed / totalResolved) * 100) : 50

  // ── Compute per-topic forecasts ──────────────────────────────────────────
  const now = Date.now()

  const forecastTopics: ForecastTopic[] = votingTopics.map(t => {
    const bucket = getBucket(t.blue_pct)
    const entry = bucketMap.get(bucket.label)!
    const baseRate = entry.count > 0
      ? (entry.pass_count / entry.count) * 100
      : 50

    // Time-pressure adjustment: if voting ends soon and split is decisive, bias toward base rate
    let hoursRemaining: number | null = null
    if (t.voting_ends_at) {
      hoursRemaining = Math.max(0, (new Date(t.voting_ends_at).getTime() - now) / 3_600_000)
    }

    // Blend base rate with 50% (uncertainty) based on sample size
    // More historical data → trust base rate more
    const sampleWeight = Math.min(entry.count / 30, 1)
    const passProbability = Math.round(baseRate * sampleWeight + 50 * (1 - sampleWeight))

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      voting_ends_at: t.voting_ends_at,
      pass_probability: Math.min(99, Math.max(1, passProbability)),
      base_rate: Math.round(baseRate),
      similar_count: entry.count,
      bucket_label: bucket.label,
      confidence: getConfidence(entry.count),
      hours_remaining: hoursRemaining !== null ? Math.round(hoursRemaining) : null,
      momentum: getMomentum(t.blue_pct),
    }
  })

  return NextResponse.json({
    voting_topics: forecastTopics,
    calibration,
    total_resolved: totalResolved,
    overall_pass_rate: overallPassRate,
  } satisfies ForecastResponse)
}
