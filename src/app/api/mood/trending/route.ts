import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoodVelocity {
  mood: MoodKind
  emoji: string
  label: string
  current: number
  previous: number
  delta: number
  pct_change: number | null  // null when previous = 0
  trend: 'rising' | 'falling' | 'stable'
}

export interface TrendingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  mood_responses: number
  top_mood: MoodKind
  top_mood_emoji: string
  positive_pct: number
  anxious_pct: number
}

export interface MoodShift {
  positive_pct_current: number
  positive_pct_previous: number
  anxious_pct_current: number
  anxious_pct_previous: number
  total_current: number
  total_previous: number
  sentiment_delta: number  // positive_pct_current - positive_pct_previous
}

export interface TrendingMoodData {
  window: '24h' | '7d' | '30d'
  mood_velocity: MoodVelocity[]
  trending_topics: TrendingTopic[]
  mood_shift: MoodShift
  generated_at: string
}

const MOOD_META: Record<MoodKind, { emoji: string; label: string }> = {
  hopeful:    { emoji: '🌱', label: 'Hopeful'    },
  inspired:   { emoji: '✨', label: 'Inspired'   },
  proud:      { emoji: '🏆', label: 'Proud'      },
  determined: { emoji: '💪', label: 'Determined' },
  frustrated: { emoji: '😤', label: 'Frustrated' },
  worried:    { emoji: '😟', label: 'Worried'    },
  angry:      { emoji: '😡', label: 'Angry'      },
  relieved:   { emoji: '😌', label: 'Relieved'   },
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

const POSITIVE_MOODS = new Set<MoodKind>(['hopeful', 'inspired', 'proud', 'determined'])
const ANXIOUS_MOODS  = new Set<MoodKind>(['frustrated', 'worried', 'angry'])

function windowMs(w: '24h' | '7d' | '30d'): number {
  if (w === '24h') return 24 * 60 * 60 * 1000
  if (w === '7d')  return 7  * 24 * 60 * 60 * 1000
  return 30 * 24 * 60 * 60 * 1000
}

function countByMood(rows: { mood: string }[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of rows) map[r.mood] = (map[r.mood] ?? 0) + 1
  return map
}

// ─── GET /api/mood/trending ───────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawWindow = searchParams.get('window') ?? '24h'
    const window_: '24h' | '7d' | '30d' =
      rawWindow === '7d' ? '7d' : rawWindow === '30d' ? '30d' : '24h'

    const supabase = await createClient()
    const now = Date.now()
    const ms = windowMs(window_)

    const currentStart = new Date(now - ms).toISOString()
    const previousStart = new Date(now - 2 * ms).toISOString()

    // Moods in current window
    const { data: currentRows } = await supabase
      .from('civic_topic_moods')
      .select('mood, topic_id, topics!inner(id, statement, category, status, blue_pct, total_votes)')
      .gte('created_at', currentStart)

    // Moods in previous window
    const { data: previousRows } = await supabase
      .from('civic_topic_moods')
      .select('mood')
      .gte('created_at', previousStart)
      .lt('created_at', currentStart)

    const currentCounts  = countByMood(currentRows ?? [])
    const previousCounts = countByMood(previousRows ?? [])
    const currentTotal   = Object.values(currentCounts).reduce((s, n) => s + n, 0)
    const previousTotal  = Object.values(previousCounts).reduce((s, n) => s + n, 0)

    // ── Mood velocity ──────────────────────────────────────────────────────
    const mood_velocity: MoodVelocity[] = ALL_MOODS.map((mood) => {
      const cur  = currentCounts[mood]  ?? 0
      const prev = previousCounts[mood] ?? 0
      const delta = cur - prev
      const pct_change = prev > 0 ? Math.round((delta / prev) * 100) : null
      const trend: MoodVelocity['trend'] =
        delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'stable'
      return {
        mood,
        emoji: MOOD_META[mood].emoji,
        label: MOOD_META[mood].label,
        current: cur,
        previous: prev,
        delta,
        pct_change,
        trend,
      }
    }).sort((a, b) => b.current - a.current)

    // ── Trending topics ────────────────────────────────────────────────────
    const topicMoodMap = new Map<
      string,
      {
        topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
        counts: Record<string, number>
        total: number
      }
    >()

    for (const row of currentRows ?? []) {
      const t = row.topics as { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number } | null
      if (!t) continue
      if (!topicMoodMap.has(row.topic_id)) {
        topicMoodMap.set(row.topic_id, { topic: t, counts: {}, total: 0 })
      }
      const entry = topicMoodMap.get(row.topic_id)!
      entry.counts[row.mood] = (entry.counts[row.mood] ?? 0) + 1
      entry.total++
    }

    const trending_topics: TrendingTopic[] = Array.from(topicMoodMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((e) => {
        let bestMood: MoodKind = 'hopeful'
        let bestCount = 0
        for (const [m, c] of Object.entries(e.counts)) {
          if (c > bestCount) { bestMood = m as MoodKind; bestCount = c }
        }

        const posCount = ALL_MOODS
          .filter(m => POSITIVE_MOODS.has(m))
          .reduce((s, m) => s + (e.counts[m] ?? 0), 0)
        const anxCount = ALL_MOODS
          .filter(m => ANXIOUS_MOODS.has(m))
          .reduce((s, m) => s + (e.counts[m] ?? 0), 0)

        return {
          ...e.topic,
          mood_responses: e.total,
          top_mood: bestMood,
          top_mood_emoji: MOOD_META[bestMood].emoji,
          positive_pct: e.total > 0 ? Math.round((posCount / e.total) * 100) : 0,
          anxious_pct:  e.total > 0 ? Math.round((anxCount / e.total) * 100) : 0,
        }
      })

    // ── Platform mood shift ────────────────────────────────────────────────
    const curPositive = ALL_MOODS
      .filter(m => POSITIVE_MOODS.has(m))
      .reduce((s, m) => s + (currentCounts[m] ?? 0), 0)
    const curAnxious = ALL_MOODS
      .filter(m => ANXIOUS_MOODS.has(m))
      .reduce((s, m) => s + (currentCounts[m] ?? 0), 0)
    const prevPositive = ALL_MOODS
      .filter(m => POSITIVE_MOODS.has(m))
      .reduce((s, m) => s + (previousCounts[m] ?? 0), 0)
    const prevAnxious = ALL_MOODS
      .filter(m => ANXIOUS_MOODS.has(m))
      .reduce((s, m) => s + (previousCounts[m] ?? 0), 0)

    const pos_pct_cur  = currentTotal  > 0 ? Math.round((curPositive  / currentTotal)  * 100) : 0
    const pos_pct_prev = previousTotal > 0 ? Math.round((prevPositive / previousTotal) * 100) : 0
    const anx_pct_cur  = currentTotal  > 0 ? Math.round((curAnxious   / currentTotal)  * 100) : 0
    const anx_pct_prev = previousTotal > 0 ? Math.round((prevAnxious  / previousTotal) * 100) : 0

    const mood_shift: MoodShift = {
      positive_pct_current:  pos_pct_cur,
      positive_pct_previous: pos_pct_prev,
      anxious_pct_current:   anx_pct_cur,
      anxious_pct_previous:  anx_pct_prev,
      total_current:  currentTotal,
      total_previous: previousTotal,
      sentiment_delta: pos_pct_cur - pos_pct_prev,
    }

    const response: TrendingMoodData = {
      window: window_,
      mood_velocity,
      trending_topics,
      mood_shift,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[GET /api/mood/trending]', err)
    return NextResponse.json({ error: 'Failed to load trending mood data' }, { status: 500 })
  }
}
