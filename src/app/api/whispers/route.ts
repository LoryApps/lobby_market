import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export type WhisperTier =
  | 'sacred_cow'       // ≥200 silence score, >80% one-sided — taboo to question
  | 'universal_truth'  // ≥100 silence score, >70% one-sided — everyone knows
  | 'uncomfortable'    // ≥50 silence score, 55–70% one-sided — people feel it but won't say
  | 'elephant'         // ≥20 silence score, 50–60% — the thing in the room no one argues

export interface WhisperTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  arg_count: number
  /** total_votes / (arg_count + 1) */
  silence_score: number
  /** How decisive the vote is (0–100, 100 = unanimous) */
  decisiveness: number
  tier: WhisperTier
  created_at: string
}

export interface CategoryWhispers {
  category: string
  topic_count: number
  avg_silence: number
  sacred_cow_count: number
  total_votes: number
  quietest: WhisperTopic | null
}

export interface WhisperStats {
  total_whispers: number
  sacred_cow_count: number
  universal_truth_count: number
  uncomfortable_count: number
  elephant_count: number
  avg_silence_score: number
  /** Category with most whispered topics */
  most_whispered_category: string | null
  /** Topic with the most votes but fewest arguments */
  loudest_silence: WhisperTopic | null
}

export interface WhisperResponse {
  stats: WhisperStats
  topics: WhisperTopic[]
  categories: CategoryWhispers[]
  generated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classify(silence_score: number, blue_pct: number): WhisperTier {
  const decisiveness = Math.abs(blue_pct - 50) * 2 // 0–100
  if (silence_score >= 200 && decisiveness >= 60) return 'sacred_cow'
  if (silence_score >= 100 && decisiveness >= 40) return 'universal_truth'
  if (silence_score >= 50 && decisiveness >= 10) return 'uncomfortable'
  return 'elephant'
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch topics with enough votes to matter
  const { data: rawTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gte('total_votes', 30)
    .order('total_votes', { ascending: false })
    .limit(800)

  if (!rawTopics || rawTopics.length === 0) {
    const empty: WhisperResponse = {
      stats: {
        total_whispers: 0,
        sacred_cow_count: 0,
        universal_truth_count: 0,
        uncomfortable_count: 0,
        elephant_count: 0,
        avg_silence_score: 0,
        most_whispered_category: null,
        loudest_silence: null,
      },
      topics: [],
      categories: [],
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  const topicIds = rawTopics.map((t) => t.id)

  // Count arguments per topic
  const argCountMap: Record<string, number> = {}
  {
    const { data: argData } = await supabase
      .from('topic_arguments')
      .select('topic_id')
      .in('topic_id', topicIds)

    for (const row of argData ?? []) {
      argCountMap[row.topic_id] = (argCountMap[row.topic_id] ?? 0) + 1
    }
  }

  // Compute silence score for each topic
  const allTopics: WhisperTopic[] = rawTopics.map((t) => {
    const arg_count = argCountMap[t.id] ?? 0
    const silence_score = t.total_votes / (arg_count + 1)
    const decisiveness = Math.abs((t.blue_pct ?? 50) - 50) * 2
    const tier = classify(silence_score, t.blue_pct ?? 50)
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes,
      arg_count,
      silence_score,
      decisiveness,
      tier,
      created_at: t.created_at,
    }
  })

  // Filter: only topics that qualify as "whispered" (silence_score ≥ 20 AND arg_count ≤ 5)
  const whispered = allTopics
    .filter((t) => t.silence_score >= 20 && t.arg_count <= 5)
    .sort((a, b) => b.silence_score - a.silence_score)

  // Stats
  const sacred_cow_count = whispered.filter((t) => t.tier === 'sacred_cow').length
  const universal_truth_count = whispered.filter((t) => t.tier === 'universal_truth').length
  const uncomfortable_count = whispered.filter((t) => t.tier === 'uncomfortable').length
  const elephant_count = whispered.filter((t) => t.tier === 'elephant').length
  const avg_silence_score =
    whispered.length > 0
      ? whispered.reduce((s, t) => s + t.silence_score, 0) / whispered.length
      : 0

  // Most whispered category
  const catCounts: Record<string, number> = {}
  for (const t of whispered) {
    const cat = t.category ?? 'Other'
    catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }
  const most_whispered_category =
    Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // Loudest silence: most votes, zero arguments
  const loudest_silence = whispered
    .filter((t) => t.arg_count === 0)
    .sort((a, b) => b.total_votes - a.total_votes)[0] ?? whispered[0] ?? null

  // Category breakdown
  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const catMap: Record<string, WhisperTopic[]> = {}
  for (const cat of CATEGORIES) catMap[cat] = []
  for (const t of whispered) {
    const cat = t.category ?? 'Other'
    if (catMap[cat]) catMap[cat].push(t)
  }

  const categories: CategoryWhispers[] = CATEGORIES
    .filter((cat) => catMap[cat].length > 0)
    .map((cat) => {
      const topics = catMap[cat]
      const sorted = [...topics].sort((a, b) => b.silence_score - a.silence_score)
      return {
        category: cat,
        topic_count: topics.length,
        avg_silence: Math.round(topics.reduce((s, t) => s + t.silence_score, 0) / topics.length),
        sacred_cow_count: topics.filter((t) => t.tier === 'sacred_cow').length,
        total_votes: topics.reduce((s, t) => s + t.total_votes, 0),
        quietest: sorted[0] ?? null,
      }
    })
    .sort((a, b) => b.avg_silence - a.avg_silence)

  const stats: WhisperStats = {
    total_whispers: whispered.length,
    sacred_cow_count,
    universal_truth_count,
    uncomfortable_count,
    elephant_count,
    avg_silence_score: Math.round(avg_silence_score),
    most_whispered_category,
    loudest_silence,
  }

  return NextResponse.json({
    stats,
    topics: whispered.slice(0, 120),
    categories,
    generated_at: new Date().toISOString(),
  } satisfies WhisperResponse)
}
