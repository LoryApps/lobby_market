import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

export interface CategoryMoodEntry {
  category: string
  dominant_mood: MoodKind
  positive_pct: number
  anxious_pct: number
  total: number
  moods: { mood: MoodKind; count: number; pct: number }[]
  top_topics: {
    id: string
    statement: string
    top_mood: MoodKind
    total_mood_responses: number
  }[]
}

export interface MoodAtlasResponse {
  categories: CategoryMoodEntry[]
  total_responses: number
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

const POSITIVE_MOODS = new Set<MoodKind>(['hopeful', 'inspired', 'proud', 'determined', 'relieved'])
const ANXIOUS_MOODS = new Set<MoodKind>(['frustrated', 'worried', 'angry'])

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: rows, error } = await supabase
      .from('civic_topic_moods')
      .select(`
        mood,
        topic_id,
        topics!inner (
          id,
          statement,
          category,
          status
        )
      `)
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    type Row = {
      mood: MoodKind
      topic_id: string
      topics: { id: string; statement: string; category: string | null; status: string }
    }

    const typedRows = (rows ?? []) as Row[]

    // Aggregate by category → mood
    const catMap = new Map<
      string,
      {
        moodCounts: Record<string, number>
        topicMoodCounts: Map<string, { statement: string; moodCounts: Record<string, number>; total: number }>
        total: number
      }
    >()

    let totalResponses = 0

    for (const row of typedRows) {
      const category = row.topics.category ?? 'Other'
      const mood = row.mood
      const topicId = row.topic_id

      if (!catMap.has(category)) {
        catMap.set(category, { moodCounts: {}, topicMoodCounts: new Map(), total: 0 })
      }
      const entry = catMap.get(category)!
      entry.moodCounts[mood] = (entry.moodCounts[mood] ?? 0) + 1
      entry.total++
      totalResponses++

      if (!entry.topicMoodCounts.has(topicId)) {
        entry.topicMoodCounts.set(topicId, {
          statement: row.topics.statement,
          moodCounts: {},
          total: 0,
        })
      }
      const topicEntry = entry.topicMoodCounts.get(topicId)!
      topicEntry.moodCounts[mood] = (topicEntry.moodCounts[mood] ?? 0) + 1
      topicEntry.total++
    }

    const categories: CategoryMoodEntry[] = []

    for (const [category, entry] of catMap.entries()) {
      const { moodCounts, topicMoodCounts, total } = entry

      // Build sorted mood list
      const moods = ALL_MOODS.map((mood) => ({
        mood,
        count: moodCounts[mood] ?? 0,
        pct: total > 0 ? Math.round(((moodCounts[mood] ?? 0) / total) * 100) : 0,
      })).sort((a, b) => b.count - a.count)

      const dominant_mood = moods[0]?.count > 0 ? moods[0].mood : 'hopeful'

      const positiveCount = ALL_MOODS.filter((m) => POSITIVE_MOODS.has(m))
        .reduce((s, m) => s + (moodCounts[m] ?? 0), 0)
      const anxiousCount = ALL_MOODS.filter((m) => ANXIOUS_MOODS.has(m))
        .reduce((s, m) => s + (moodCounts[m] ?? 0), 0)

      // Top 3 topics by mood response count
      const top_topics = Array.from(topicMoodCounts.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 3)
        .map(([id, t]) => {
          let bestMood: MoodKind = 'hopeful'
          let bestCount = 0
          for (const [m, c] of Object.entries(t.moodCounts)) {
            if (c > bestCount) {
              bestMood = m as MoodKind
              bestCount = c
            }
          }
          return {
            id,
            statement: t.statement,
            top_mood: bestMood,
            total_mood_responses: t.total,
          }
        })

      categories.push({
        category,
        dominant_mood,
        positive_pct: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
        anxious_pct: total > 0 ? Math.round((anxiousCount / total) * 100) : 0,
        total,
        moods,
        top_topics,
      })
    }

    // Sort by total responses descending
    categories.sort((a, b) => b.total - a.total)

    return NextResponse.json({
      categories,
      total_responses: totalResponses,
    } satisfies MoodAtlasResponse)
  } catch (err) {
    console.error('[GET /api/mood/atlas]', err)
    return NextResponse.json({ error: 'Failed to load mood atlas' }, { status: 500 })
  }
}
