import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoodLeaderboardTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_mood_responses: number
  rank: number
  mood_breakdown: { mood: MoodKind; count: number; pct: number }[]
  dominant_mood: MoodKind
  dominant_pct: number
  positive_pct: number   // hopeful + inspired + proud + determined
  anxious_pct: number    // frustrated + worried + angry
}

export interface MoodLeaderboardResponse {
  topics: MoodLeaderboardTopic[]
  total_topics_with_moods: number
  filtered_by: MoodKind | null
  sort_by: 'total' | 'dominant' | 'positive' | 'anxious'
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

const POSITIVE_MOODS = new Set<MoodKind>(['hopeful', 'inspired', 'proud', 'determined'])
const ANXIOUS_MOODS  = new Set<MoodKind>(['frustrated', 'worried', 'angry'])

// ─── GET /api/mood/leaderboard ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const moodFilter = searchParams.get('mood') as MoodKind | null
    const sortBy = (searchParams.get('sort') ?? 'total') as 'total' | 'dominant' | 'positive' | 'anxious'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10), 50)

    const supabase = await createClient()

    // Fetch all mood rows with topic data
    let query = supabase
      .from('civic_topic_moods')
      .select(`
        topic_id,
        mood,
        topics!inner (
          id,
          statement,
          category,
          status,
          blue_pct,
          total_votes
        )
      `)
      .limit(10000)

    if (moodFilter && ALL_MOODS.includes(moodFilter)) {
      query = query.eq('mood', moodFilter)
    }

    const { data: rows, error } = await query

    if (error) throw error

    // Aggregate per topic
    const topicMap = new Map<string, {
      topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
      moodCounts: Record<string, number>
      total: number
    }>()

    for (const row of rows ?? []) {
      const t = row.topics as { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
      if (!t) continue
      const tid = row.topic_id as string
      if (!topicMap.has(tid)) {
        topicMap.set(tid, { topic: t, moodCounts: {}, total: 0 })
      }
      const entry = topicMap.get(tid)!
      entry.moodCounts[row.mood] = (entry.moodCounts[row.mood] ?? 0) + 1
      entry.total++
    }

    const total_topics_with_moods = topicMap.size

    // Build leaderboard entries
    const entries = Array.from(topicMap.values())
      .filter((e) => e.total >= 1)
      .map((e) => {
        const mood_breakdown = ALL_MOODS.map((m) => ({
          mood: m,
          count: e.moodCounts[m] ?? 0,
          pct: e.total > 0 ? Math.round(((e.moodCounts[m] ?? 0) / e.total) * 100) : 0,
        })).sort((a, b) => b.count - a.count)

        const dominant_mood = mood_breakdown[0]?.mood ?? 'hopeful'
        const dominant_pct = mood_breakdown[0]?.pct ?? 0

        const positive_count = mood_breakdown
          .filter((m) => POSITIVE_MOODS.has(m.mood))
          .reduce((s, m) => s + m.count, 0)
        const anxious_count = mood_breakdown
          .filter((m) => ANXIOUS_MOODS.has(m.mood))
          .reduce((s, m) => s + m.count, 0)

        const positive_pct = e.total > 0 ? Math.round((positive_count / e.total) * 100) : 0
        const anxious_pct  = e.total > 0 ? Math.round((anxious_count  / e.total) * 100) : 0

        return {
          ...e.topic,
          total_mood_responses: e.total,
          mood_breakdown,
          dominant_mood,
          dominant_pct,
          positive_pct,
          anxious_pct,
        }
      })

    // Sort
    entries.sort((a, b) => {
      if (sortBy === 'dominant') return b.dominant_pct - a.dominant_pct
      if (sortBy === 'positive') return b.positive_pct - a.positive_pct
      if (sortBy === 'anxious')  return b.anxious_pct  - a.anxious_pct
      return b.total_mood_responses - a.total_mood_responses
    })

    const topics: MoodLeaderboardTopic[] = entries
      .slice(0, limit)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    return NextResponse.json({
      topics,
      total_topics_with_moods,
      filtered_by: moodFilter,
      sort_by: sortBy,
    } satisfies MoodLeaderboardResponse)
  } catch (err) {
    console.error('[GET /api/mood/leaderboard]', err)
    return NextResponse.json(
      { error: 'Failed to load mood leaderboard' },
      { status: 500 }
    )
  }
}
