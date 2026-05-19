import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecoilTopic {
  topic_id: string
  statement: string
  category: string
  failed_at: string
  blue_pct: number
  total_votes: number

  /** New topics created in same category in the 7 days BEFORE failure */
  topics_before: number
  /** New topics created in same category in the 7 days AFTER failure */
  topics_after: number
  /** Votes on same-category topics in the 7 days BEFORE failure */
  votes_before: number
  /** Votes on same-category topics in the 7 days AFTER failure */
  votes_after: number

  /**
   * Recoil score: how much the category lit up AFTER this topic failed.
   * = (votes_after + topics_after * 30) / max(votes_before + topics_before * 30, 1)
   * > 3.0  = ignited (debate exploded after)
   * > 1.75 = stirred (noticeable uptick)
   * > 1.1  = echoed (slight ripple)
   * <= 1.1 = silenced (category went quiet)
   */
  recoil_score: number
  recoil_class: 'ignited' | 'stirred' | 'echoed' | 'silenced'
}

export interface RecoilResponse {
  topics: RecoilTopic[]
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 7
const MAX_FAILED = 30
const TOPICS_WEIGHT = 30

function recoilClass(score: number): RecoilTopic['recoil_class'] {
  if (score >= 3.0) return 'ignited'
  if (score >= 1.75) return 'stirred'
  if (score >= 1.1) return 'echoed'
  return 'silenced'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') || null

  const supabase = await createClient()

  // ── 1. Fetch recently failed topics ───────────────────────────────────────
  let failedQuery = supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, updated_at')
    .eq('status', 'failed')
    .not('category', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(MAX_FAILED * 2)

  if (category) {
    failedQuery = failedQuery.eq('category', category)
  }

  const { data: failedRows, error: failedErr } = await failedQuery
  if (failedErr || !failedRows?.length) {
    return NextResponse.json({ topics: [], generated_at: new Date().toISOString() })
  }

  const failed = failedRows.slice(0, MAX_FAILED)

  // ── 2. Gather all categories we need to measure ───────────────────────────
  const categorySet = new Set(failed.map((t) => t.category!))
  const categories = Array.from(categorySet)

  // Determine the overall time window we need topic/vote data for
  const mostRecent = failed[0].updated_at
  const oldest = failed[failed.length - 1].updated_at
  const windowStart = new Date(
    new Date(oldest).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const windowEnd = new Date(
    new Date(mostRecent).getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  // ── 3. Fetch topics in those categories (for counting new proposals) ───────
  const { data: catTopicRows } = await supabase
    .from('topics')
    .select('id, category, created_at')
    .in('category', categories)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)

  const catTopicIds: Record<string, string[]> = {}
  const topicCreatedAt: Record<string, string> = {}
  for (const t of catTopicRows ?? []) {
    const cat = t.category!
    if (!catTopicIds[cat]) catTopicIds[cat] = []
    catTopicIds[cat].push(t.id)
    topicCreatedAt[t.id] = t.created_at
  }

  // ── 4. Fetch votes for those topics in the window ─────────────────────────
  const allTopicIds = (catTopicRows ?? []).map((t) => t.id)
  const { data: voteRows } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .in('topic_id', allTopicIds.slice(0, 500))
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .limit(100000)

  const votesByTopic: Record<string, string[]> = {}
  for (const v of voteRows ?? []) {
    if (!votesByTopic[v.topic_id]) votesByTopic[v.topic_id] = []
    votesByTopic[v.topic_id].push(v.created_at)
  }

  // ── 5. Compute recoil metrics for each failed topic ───────────────────────
  const results: RecoilTopic[] = []

  for (const t of failed) {
    const cat = t.category!
    const failTime = new Date(t.updated_at).getTime()
    const beforeStart = failTime - WINDOW_DAYS * 24 * 60 * 60 * 1000
    const afterEnd = failTime + WINDOW_DAYS * 24 * 60 * 60 * 1000

    const catTopics = catTopicIds[cat] ?? []

    let votesBefore = 0
    let votesAfter = 0
    let topicsBefore = 0
    let topicsAfter = 0

    for (const tid of catTopics) {
      // Skip the failed topic itself
      if (tid === t.id) continue

      const voteTs = votesByTopic[tid] ?? []
      for (const ts of voteTs) {
        const time = new Date(ts).getTime()
        if (time >= beforeStart && time < failTime) votesBefore++
        else if (time >= failTime && time <= afterEnd) votesAfter++
      }

      const ct = topicCreatedAt[tid]
      if (ct) {
        const ctime = new Date(ct).getTime()
        if (ctime >= beforeStart && ctime < failTime) topicsBefore++
        else if (ctime >= failTime && ctime <= afterEnd) topicsAfter++
      }
    }

    const scoreBefore = votesBefore + topicsBefore * TOPICS_WEIGHT
    const scoreAfter = votesAfter + topicsAfter * TOPICS_WEIGHT
    const recoilScore = scoreAfter / Math.max(scoreBefore, 1)

    results.push({
      topic_id: t.id,
      statement: t.statement,
      category: cat,
      failed_at: t.updated_at,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      votes_before: votesBefore,
      votes_after: votesAfter,
      topics_before: topicsBefore,
      topics_after: topicsAfter,
      recoil_score: Math.round(recoilScore * 100) / 100,
      recoil_class: recoilClass(recoilScore),
    })
  }

  results.sort((a, b) => b.recoil_score - a.recoil_score)

  return NextResponse.json({
    topics: results,
    generated_at: new Date().toISOString(),
  } satisfies RecoilResponse)
}
