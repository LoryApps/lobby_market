import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoodDayBucket {
  date: string          // YYYY-MM-DD
  total: number
  positive_pct: number
  anxious_pct: number
  dominant_mood: MoodKind
  moods: Record<MoodKind, number>
}

export interface MoodHistoryResponse {
  buckets: MoodDayBucket[]
  window: '7d' | '30d' | '90d'
  total_responses: number
  trend: 'improving' | 'declining' | 'stable'
  /** % change in positive_pct over the window */
  trend_delta: number
  summary: {
    peak_positive_date: string
    peak_positive_pct: number
    most_common_mood: MoodKind
    most_anxious_date: string
    most_anxious_pct: number
  }
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

const POSITIVE_MOODS = new Set<MoodKind>(['hopeful', 'inspired', 'proud', 'determined', 'relieved'])
const ANXIOUS_MOODS = new Set<MoodKind>(['frustrated', 'worried', 'angry'])

type Window = '7d' | '30d' | '90d'

function windowToDays(w: Window): number {
  return w === '7d' ? 7 : w === '30d' ? 30 : 90
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawWindow = searchParams.get('window') ?? '30d'
    const window: Window = (['7d', '30d', '90d'] as const).includes(rawWindow as Window)
      ? (rawWindow as Window)
      : '30d'

    const days = windowToDays(window)
    const since = new Date()
    since.setDate(since.getDate() - days)

    const supabase = await createClient()

    const { data: rows, error } = await supabase
      .from('civic_topic_moods')
      .select('mood, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(50000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Bucket by UTC date
    const dayMap = new Map<string, Record<MoodKind, number>>()

    // Pre-fill all days in range so the chart has no gaps
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const key = d.toISOString().slice(0, 10)
      if (!dayMap.has(key)) {
        dayMap.set(key, Object.fromEntries(ALL_MOODS.map((m) => [m, 0])) as Record<MoodKind, number>)
      }
    }

    let totalResponses = 0

    for (const row of (rows ?? [])) {
      const date = (row.created_at as string).slice(0, 10)
      if (!dayMap.has(date)) continue
      const bucket = dayMap.get(date)!
      bucket[row.mood as MoodKind] = (bucket[row.mood as MoodKind] ?? 0) + 1
      totalResponses++
    }

    const buckets: MoodDayBucket[] = []
    let allMoodTotals: Record<MoodKind, number> = Object.fromEntries(ALL_MOODS.map((m) => [m, 0])) as Record<MoodKind, number>

    let peakPositivePct = 0
    let peakPositiveDate = ''
    let mostAnxiousPct = 0
    let mostAnxiousDate = ''

    for (const [date, moodCounts] of [...dayMap.entries()].sort()) {
      const total = ALL_MOODS.reduce((s, m) => s + moodCounts[m], 0)
      const posCount = ALL_MOODS.filter((m) => POSITIVE_MOODS.has(m)).reduce((s, m) => s + moodCounts[m], 0)
      const anxCount = ALL_MOODS.filter((m) => ANXIOUS_MOODS.has(m)).reduce((s, m) => s + moodCounts[m], 0)
      const positivePct = total > 0 ? Math.round((posCount / total) * 100) : 0
      const anxiousPct = total > 0 ? Math.round((anxCount / total) * 100) : 0

      let dominantMood: MoodKind = 'hopeful'
      let dominantCount = 0
      for (const m of ALL_MOODS) {
        if (moodCounts[m] > dominantCount) {
          dominantMood = m
          dominantCount = moodCounts[m]
        }
      }

      if (total > 0 && positivePct > peakPositivePct) {
        peakPositivePct = positivePct
        peakPositiveDate = date
      }
      if (total > 0 && anxiousPct > mostAnxiousPct) {
        mostAnxiousPct = anxiousPct
        mostAnxiousDate = date
      }

      for (const m of ALL_MOODS) {
        allMoodTotals[m] += moodCounts[m]
      }

      buckets.push({
        date,
        total,
        positive_pct: positivePct,
        anxious_pct: anxiousPct,
        dominant_mood: dominantMood,
        moods: { ...moodCounts },
      })
    }

    // Trend: compare first half vs second half of the window
    const mid = Math.floor(buckets.length / 2)
    const firstHalf = buckets.slice(0, mid)
    const secondHalf = buckets.slice(mid)
    const avgFirst = firstHalf.length
      ? firstHalf.reduce((s, b) => s + b.positive_pct, 0) / firstHalf.length
      : 50
    const avgSecond = secondHalf.length
      ? secondHalf.reduce((s, b) => s + b.positive_pct, 0) / secondHalf.length
      : 50
    const trendDelta = Math.round(avgSecond - avgFirst)
    const trend: MoodHistoryResponse['trend'] =
      trendDelta >= 3 ? 'improving' : trendDelta <= -3 ? 'declining' : 'stable'

    // Most common mood overall
    let mostCommonMood: MoodKind = 'hopeful'
    let mostCommonCount = 0
    for (const m of ALL_MOODS) {
      if (allMoodTotals[m] > mostCommonCount) {
        mostCommonMood = m
        mostCommonCount = allMoodTotals[m]
      }
    }

    return NextResponse.json({
      buckets,
      window,
      total_responses: totalResponses,
      trend,
      trend_delta: trendDelta,
      summary: {
        peak_positive_date: peakPositiveDate,
        peak_positive_pct: peakPositivePct,
        most_common_mood: mostCommonMood,
        most_anxious_date: mostAnxiousDate,
        most_anxious_pct: mostAnxiousPct,
      },
    } satisfies MoodHistoryResponse)
  } catch (err) {
    console.error('[GET /api/mood/history]', err)
    return NextResponse.json({ error: 'Failed to load mood history' }, { status: 500 })
  }
}
