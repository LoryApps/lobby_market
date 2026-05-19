import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CascadeWave {
  law_id: string
  law_statement: string
  category: string
  established_at: string
  topic_id: string
  law_blue_pct: number | null
  law_total_votes: number | null

  /** Votes on same-category topics in the 7 days BEFORE law was established */
  votes_before: number
  /** Votes on same-category topics in the 7 days AFTER law was established */
  votes_after: number
  /** New topics created in same category in 7 days BEFORE */
  topics_before: number
  /** New topics created in same category in 7 days AFTER */
  topics_after: number

  /**
   * Cascade intensity — how much the category lit up after this law.
   * = (votes_after + topics_after * 30) / max(votes_before + topics_before * 30, 1)
   * A value > 1.5 means the category got at least 50% more activity post-law.
   */
  cascade_score: number
  /** Human-readable intensity label */
  intensity: 'ignition' | 'surge' | 'ripple' | 'quiet'
}

export interface CascadeResponse {
  waves: CascadeWave[]
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 7
const MAX_LAWS = 25
const TOPICS_WEIGHT = 30

function intensityLabel(score: number): CascadeWave['intensity'] {
  if (score >= 3.0) return 'ignition'
  if (score >= 1.75) return 'surge'
  if (score >= 1.1) return 'ripple'
  return 'quiet'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') || null

  const supabase = await createClient()

  // ── 1. Fetch recent laws ───────────────────────────────────────────────────
  let lawQuery = supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('is_active', true)
    .not('category', 'is', null)
    .order('established_at', { ascending: false })
    .limit(MAX_LAWS * 2)

  if (category) {
    lawQuery = lawQuery.eq('category', category)
  }

  const { data: lawRows, error: lawsErr } = await lawQuery
  if (lawsErr || !lawRows?.length) {
    return NextResponse.json({ waves: [], generated_at: new Date().toISOString() })
  }

  // Limit to most recent laws after category filtering
  const laws = lawRows.slice(0, MAX_LAWS)

  // ── 2. Gather all topic IDs per category we need to measure ───────────────
  const categorySet = new Set(laws.map((l) => l.category!))
  const categories = Array.from(categorySet)

  // Fetch all topic IDs in those categories so we can join votes
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, category, created_at')
    .in('category', categories)
    .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())

  if (!topicRows?.length) {
    return NextResponse.json({ waves: [], generated_at: new Date().toISOString() })
  }

  // Build lookup: category -> topic IDs and topic created_at
  const catTopicIds: Record<string, string[]> = {}
  const topicCreatedAt: Record<string, string> = {}
  for (const t of topicRows) {
    const cat = t.category!
    if (!catTopicIds[cat]) catTopicIds[cat] = []
    catTopicIds[cat].push(t.id)
    topicCreatedAt[t.id] = t.created_at
  }

  // ── 3. Fetch votes for relevant topics in the time window ─────────────────
  // We get the full relevant period: earliest law - 7 days to latest law + 7 days
  const allTopicIds = topicRows.map((t) => t.id)
  const earliestLaw = laws[laws.length - 1].established_at
  const windowStart = new Date(
    new Date(earliestLaw).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const windowEnd = new Date(
    new Date(laws[0].established_at).getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  // Fetch votes in batches of 1000 (Supabase limit) using topic_id IN
  // For performance, just get counts per topic_id and date bucket
  const { data: voteRows, error: votesErr } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .in('topic_id', allTopicIds.slice(0, 500))
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .limit(100000)

  if (votesErr) {
    return NextResponse.json({ error: 'votes_fetch' }, { status: 500 })
  }

  const votes = voteRows ?? []

  // Build vote lookup: topic_id -> array of ISO timestamps
  const votesByTopic: Record<string, string[]> = {}
  for (const v of votes) {
    if (!votesByTopic[v.topic_id]) votesByTopic[v.topic_id] = []
    votesByTopic[v.topic_id].push(v.created_at)
  }

  // ── 4. Compute cascade metrics for each law ───────────────────────────────
  const waves: CascadeWave[] = []

  for (const law of laws) {
    const cat = law.category!
    const lawTime = new Date(law.established_at).getTime()
    const beforeStart = lawTime - WINDOW_DAYS * 24 * 60 * 60 * 1000
    const afterEnd = lawTime + WINDOW_DAYS * 24 * 60 * 60 * 1000

    const catTopics = catTopicIds[cat] ?? []

    // Count votes before / after for topics in this category
    let votesBefore = 0
    let votesAfter = 0

    for (const tid of catTopics) {
      const ts = votesByTopic[tid] ?? []
      for (const t of ts) {
        const time = new Date(t).getTime()
        if (time >= beforeStart && time < lawTime) votesBefore++
        else if (time >= lawTime && time <= afterEnd) votesAfter++
      }
    }

    // Count new topics created before / after
    let topicsBefore = 0
    let topicsAfter = 0
    for (const tid of catTopics) {
      const ct = topicCreatedAt[tid]
      if (!ct) continue
      const time = new Date(ct).getTime()
      if (time >= beforeStart && time < lawTime) topicsBefore++
      else if (time >= lawTime && time <= afterEnd) topicsAfter++
    }

    const scoreBefore = votesBefore + topicsBefore * TOPICS_WEIGHT
    const scoreAfter = votesAfter + topicsAfter * TOPICS_WEIGHT
    const cascadeScore = scoreAfter / Math.max(scoreBefore, 1)

    waves.push({
      law_id: law.id,
      law_statement: law.statement,
      category: cat,
      established_at: law.established_at,
      topic_id: law.topic_id,
      law_blue_pct: law.blue_pct,
      law_total_votes: law.total_votes,
      votes_before: votesBefore,
      votes_after: votesAfter,
      topics_before: topicsBefore,
      topics_after: topicsAfter,
      cascade_score: Math.round(cascadeScore * 100) / 100,
      intensity: intensityLabel(cascadeScore),
    })
  }

  // Sort by cascade_score descending
  waves.sort((a, b) => b.cascade_score - a.cascade_score)

  return NextResponse.json({
    waves,
    generated_at: new Date().toISOString(),
  } satisfies CascadeResponse)
}
