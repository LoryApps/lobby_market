import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicMoodProfile {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_mood_responses: number
  moods: { mood: MoodKind; count: number; pct: number }[]
  dominant_mood: MoodKind | null
  positive_pct: number
  anxious_pct: number
}

export interface MoodCompareResponse {
  topic_a: TopicMoodProfile | null
  topic_b: TopicMoodProfile | null
  divergence_score: number        // 0–100: how emotionally different the topics are
  shared_top_mood: MoodKind | null
  emotional_tension: string       // human-readable summary
  overlap_users: number           // users who responded to both topics
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]
const POSITIVE_MOODS = new Set<MoodKind>(['hopeful', 'inspired', 'proud', 'determined', 'relieved'])
const ANXIOUS_MOODS = new Set<MoodKind>(['frustrated', 'worried', 'angry'])

async function buildTopicProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  topicId: string,
): Promise<TopicMoodProfile | null> {
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) return null

  const { data: moodRows } = await supabase
    .from('civic_topic_moods')
    .select('mood')
    .eq('topic_id', topicId)

  const countMap: Record<string, number> = {}
  let total = 0
  for (const r of moodRows ?? []) {
    countMap[r.mood] = (countMap[r.mood] ?? 0) + 1
    total++
  }

  const moods = ALL_MOODS.map((mood) => ({
    mood,
    count: countMap[mood] ?? 0,
    pct: total > 0 ? Math.round(((countMap[mood] ?? 0) / total) * 100) : 0,
  }))

  const dominant = total > 0
    ? (ALL_MOODS.reduce((a, b) => (countMap[a] ?? 0) >= (countMap[b] ?? 0) ? a : b))
    : null

  const posCount = ALL_MOODS.filter(m => POSITIVE_MOODS.has(m)).reduce((s, m) => s + (countMap[m] ?? 0), 0)
  const anxCount = ALL_MOODS.filter(m => ANXIOUS_MOODS.has(m)).reduce((s, m) => s + (countMap[m] ?? 0), 0)

  return {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    blue_pct: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,
    total_mood_responses: total,
    moods,
    dominant_mood: dominant,
    positive_pct: total > 0 ? Math.round((posCount / total) * 100) : 0,
    anxious_pct: total > 0 ? Math.round((anxCount / total) * 100) : 0,
  }
}

function computeDivergence(a: TopicMoodProfile, b: TopicMoodProfile): number {
  // Jensen–Shannon-style divergence approximation via mean absolute difference
  const moodMap = Object.fromEntries(ALL_MOODS.map(m => [m, 0]))
  const aPcts = Object.fromEntries(a.moods.map(x => [x.mood, x.pct]))
  const bPcts = Object.fromEntries(b.moods.map(x => [x.mood, x.pct]))

  let totalDiff = 0
  for (const mood of ALL_MOODS) {
    totalDiff += Math.abs((aPcts[mood] ?? 0) - (bPcts[mood] ?? 0))
  }
  // Max possible sum of absolute differences = 200 (all weight on one mood in each)
  return Math.round((totalDiff / 200) * 100)
}

function summariseTension(a: TopicMoodProfile, b: TopicMoodProfile): string {
  const diff = a.positive_pct - b.positive_pct
  const aLabel = a.statement.length > 40 ? a.statement.slice(0, 40) + '…' : a.statement
  const bLabel = b.statement.length > 40 ? b.statement.slice(0, 40) + '…' : b.statement

  if (Math.abs(diff) < 8) {
    return `Both topics generate similar emotional responses from the community.`
  }
  const more = diff > 0 ? aLabel : bLabel
  const less = diff > 0 ? bLabel : aLabel
  const absDiff = Math.abs(diff)
  if (absDiff >= 30) {
    return `"${more}" is dramatically more hopeful than "${less}" — a ${absDiff}pp gap in positive sentiment.`
  }
  return `"${more}" tends to lift spirits, while "${less}" stirs more anxiety — a ${absDiff}pp difference.`
}

// ─── GET /api/mood/compare?a=<topicId>&b=<topicId> ───────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const aId = searchParams.get('a')
    const bId = searchParams.get('b')

    if (!aId || !bId) {
      return NextResponse.json({ error: 'Both ?a= and ?b= topic IDs are required.' }, { status: 400 })
    }

    const supabase = await createClient()

    const [topicA, topicB] = await Promise.all([
      buildTopicProfile(supabase, aId),
      buildTopicProfile(supabase, bId),
    ])

    // Count users who responded to both topics
    let overlapUsers = 0
    if (topicA && topicB) {
      const { data: aUsers } = await supabase
        .from('civic_topic_moods')
        .select('user_id')
        .eq('topic_id', aId)

      const { data: bUsers } = await supabase
        .from('civic_topic_moods')
        .select('user_id')
        .eq('topic_id', bId)

      const aSet = new Set((aUsers ?? []).map(r => r.user_id))
      overlapUsers = (bUsers ?? []).filter(r => aSet.has(r.user_id)).length
    }

    const divergenceScore = topicA && topicB ? computeDivergence(topicA, topicB) : 0
    const sharedTopMood =
      topicA?.dominant_mood && topicB?.dominant_mood && topicA.dominant_mood === topicB.dominant_mood
        ? topicA.dominant_mood
        : null
    const tension = topicA && topicB ? summariseTension(topicA, topicB) : ''

    const response: MoodCompareResponse = {
      topic_a: topicA,
      topic_b: topicB,
      divergence_score: divergenceScore,
      shared_top_mood: sharedTopMood,
      emotional_tension: tension,
      overlap_users: overlapUsers,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('GET /api/mood/compare', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
