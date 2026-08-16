import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoodKind =
  | 'hopeful'
  | 'inspired'
  | 'proud'
  | 'determined'
  | 'frustrated'
  | 'worried'
  | 'angry'
  | 'relieved'

export interface MoodCount {
  mood: MoodKind
  count: number
  pct: number
}

export interface MoodTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  top_mood: MoodKind
  top_mood_count: number
  total_mood_responses: number
}

export interface MoodData {
  platform_totals: MoodCount[]
  total_mood_responses: number
  dominant_mood: MoodKind | null
  positive_pct: number        // hopeful + inspired + proud + determined
  anxious_pct: number         // frustrated + worried + angry
  most_hopeful_topics: MoodTopic[]
  most_worried_topics: MoodTopic[]
  most_active_mood_topics: MoodTopic[]
  user_mood_count: number     // how many moods the current user has submitted
}

const POSITIVE_MOODS: MoodKind[] = ['hopeful', 'inspired', 'proud', 'determined']
const ANXIOUS_MOODS: MoodKind[] = ['frustrated', 'worried', 'angry']

// ─── GET /api/mood ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 1. Platform-wide mood aggregation
    const { data: rawCounts } = await supabase
      .from('civic_topic_moods')
      .select('mood')

    const countMap: Record<string, number> = {}
    let total = 0
    for (const row of rawCounts ?? []) {
      countMap[row.mood] = (countMap[row.mood] ?? 0) + 1
      total++
    }

    const ALL_MOODS: MoodKind[] = [
      'hopeful', 'inspired', 'proud', 'determined',
      'frustrated', 'worried', 'angry', 'relieved',
    ]

    const platform_totals: MoodCount[] = ALL_MOODS.map((mood) => ({
      mood,
      count: countMap[mood] ?? 0,
      pct: total > 0 ? Math.round(((countMap[mood] ?? 0) / total) * 100) : 0,
    })).sort((a, b) => b.count - a.count)

    const dominant_mood =
      platform_totals[0]?.count > 0 ? platform_totals[0].mood : null

    const positive_count = POSITIVE_MOODS.reduce(
      (s, m) => s + (countMap[m] ?? 0),
      0
    )
    const anxious_count = ANXIOUS_MOODS.reduce(
      (s, m) => s + (countMap[m] ?? 0),
      0
    )
    const positive_pct = total > 0 ? Math.round((positive_count / total) * 100) : 0
    const anxious_pct = total > 0 ? Math.round((anxious_count / total) * 100) : 0

    // 2. Per-topic mood counts with topic data
    const { data: topicMoodRows } = await supabase
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
      .limit(5000)

    // Aggregate by topic
    const topicMap = new Map<
      string,
      {
        topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
        moodCounts: Record<string, number>
        total: number
      }
    >()

    for (const row of topicMoodRows ?? []) {
      const t = row.topics as { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
      if (!t) continue
      if (!topicMap.has(row.topic_id)) {
        topicMap.set(row.topic_id, { topic: t, moodCounts: {}, total: 0 })
      }
      const entry = topicMap.get(row.topic_id)!
      entry.moodCounts[row.mood] = (entry.moodCounts[row.mood] ?? 0) + 1
      entry.total++
    }

    function topMoodForEntry(entry: { moodCounts: Record<string, number>; total: number }): {
      top_mood: MoodKind
      top_mood_count: number
    } {
      let best: MoodKind = 'hopeful'
      let bestCount = 0
      for (const [m, c] of Object.entries(entry.moodCounts)) {
        if (c > bestCount) {
          best = m as MoodKind
          bestCount = c
        }
      }
      return { top_mood: best, top_mood_count: bestCount }
    }

    function toMoodTopic(entry: {
      topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
      moodCounts: Record<string, number>
      total: number
    }): MoodTopic {
      const { top_mood, top_mood_count } = topMoodForEntry(entry)
      return {
        ...entry.topic,
        top_mood,
        top_mood_count,
        total_mood_responses: entry.total,
      }
    }

    const allTopicEntries = Array.from(topicMap.values())

    // Most hopeful topics: highest share of hopeful+inspired moods
    const most_hopeful_topics = allTopicEntries
      .filter((e) => e.total >= 3)
      .map((e) => ({
        entry: e,
        hopeful_pct:
          ((e.moodCounts['hopeful'] ?? 0) + (e.moodCounts['inspired'] ?? 0)) /
          e.total,
      }))
      .sort((a, b) => b.hopeful_pct - a.hopeful_pct)
      .slice(0, 5)
      .map(({ entry }) => toMoodTopic(entry))

    // Most worried topics: highest share of worried+angry+frustrated
    const most_worried_topics = allTopicEntries
      .filter((e) => e.total >= 3)
      .map((e) => ({
        entry: e,
        worried_pct:
          ((e.moodCounts['worried'] ?? 0) +
            (e.moodCounts['angry'] ?? 0) +
            (e.moodCounts['frustrated'] ?? 0)) /
          e.total,
      }))
      .sort((a, b) => b.worried_pct - a.worried_pct)
      .slice(0, 5)
      .map(({ entry }) => toMoodTopic(entry))

    // Most mood-active topics (most responses total)
    const most_active_mood_topics = allTopicEntries
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(toMoodTopic)

    // User's own mood count
    let user_mood_count = 0
    if (user) {
      const { count } = await supabase
        .from('civic_topic_moods')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      user_mood_count = count ?? 0
    }

    const data: MoodData = {
      platform_totals,
      total_mood_responses: total,
      dominant_mood,
      positive_pct,
      anxious_pct,
      most_hopeful_topics,
      most_worried_topics,
      most_active_mood_topics,
      user_mood_count,
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/mood]', err)
    return NextResponse.json(
      { error: 'Failed to load mood data' },
      { status: 500 }
    )
  }
}
