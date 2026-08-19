import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

const VALID_MOODS = new Set<MoodKind>([
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
])

export interface MoodTopicDetail {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  mood_count: number       // responses for this specific mood on this topic
  total_responses: number  // all mood responses on this topic
  mood_pct: number         // percentage of responses that are this mood
}

export interface MoodPageData {
  mood: MoodKind
  topic_count: number
  total_responses: number   // total platform-wide responses for this mood
  topics: MoodTopicDetail[]
}

export async function GET(
  _req: Request,
  { params }: { params: { mood: string } }
) {
  const { mood } = params

  if (!VALID_MOODS.has(mood as MoodKind)) {
    return NextResponse.json({ error: 'Invalid mood' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // Fetch all mood rows for this specific mood, joined with topic data
    const { data: rows, error } = await supabase
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

    if (error) throw error

    // Aggregate per topic
    const topicMap = new Map<
      string,
      {
        topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
        moodCount: number
        total: number
      }
    >()

    let totalMoodResponses = 0

    for (const row of rows ?? []) {
      const t = row.topics as {
        id: string; statement: string; category: string | null
        status: string; blue_pct: number; total_votes: number
      } | null
      if (!t) continue

      if (!topicMap.has(row.topic_id)) {
        topicMap.set(row.topic_id, { topic: t, moodCount: 0, total: 0 })
      }
      const entry = topicMap.get(row.topic_id)!
      entry.total++
      if (row.mood === mood) {
        entry.moodCount++
        totalMoodResponses++
      }
    }

    // Build result set — topics that have at least 1 response for this mood
    const topics: MoodTopicDetail[] = Array.from(topicMap.values())
      .filter((e) => e.moodCount > 0)
      .map((e) => ({
        ...e.topic,
        mood_count: e.moodCount,
        total_responses: e.total,
        mood_pct: Math.round((e.moodCount / e.total) * 100),
      }))
      // Sort by mood_pct desc, then by mood_count desc as tiebreaker
      .sort((a, b) =>
        b.mood_pct !== a.mood_pct
          ? b.mood_pct - a.mood_pct
          : b.mood_count - a.mood_count
      )
      .slice(0, 50)

    const data: MoodPageData = {
      mood: mood as MoodKind,
      topic_count: topics.length,
      total_responses: totalMoodResponses,
      topics,
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error(`[GET /api/mood/${mood}]`, err)
    return NextResponse.json(
      { error: 'Failed to load mood topics' },
      { status: 500 }
    )
  }
}
