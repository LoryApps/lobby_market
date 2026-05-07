import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 120

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagStat {
  tag: string
  topic_count: number
  law_count: number
  active_count: number
  proposed_count: number
  total_votes: number
  avg_blue_pct: number
  top_categories: { category: string; count: number }[]
  is_followed: boolean
}

export interface SharedTopic {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  category: string | null
}

export interface TagCompareResponse {
  tag_a: TagStat
  tag_b: TagStat
  shared_topics: SharedTopic[]
  overlap_count: number
  overlap_pct_a: number  // % of tag A's topics also in tag B
  overlap_pct_b: number  // % of tag B's topics also in tag A
  divergence_score: number  // 0-100: how ideologically different the two tags are (based on avg vote split)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const rawA = (searchParams.get('a') ?? '').trim().toLowerCase()
  const rawB = (searchParams.get('b') ?? '').trim().toLowerCase()

  if (!rawA || !rawB) {
    return NextResponse.json(
      { error: 'Both "a" and "b" tag parameters are required.' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Fetch all topics that have either tag ─────────────────────────────
  const { data: allTopics, error } = await supabase
    .from('topics')
    .select('id, statement, status, blue_pct, total_votes, category, tags')
    .not('tags', 'eq', '{}')
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .limit(2000)

  if (error) {
    console.error('[tags/compare]', error)
    return NextResponse.json(
      { error: 'Failed to fetch topic data.' },
      { status: 500 },
    )
  }

  const topics = allTopics ?? []

  // Partition into sets
  const aTopics = topics.filter((t) => (t.tags as string[]).includes(rawA))
  const bTopics = topics.filter((t) => (t.tags as string[]).includes(rawB))

  const aIds = new Set(aTopics.map((t) => t.id))
  const bIds = new Set(bTopics.map((t) => t.id))
  const sharedIds = [...aIds].filter((id) => bIds.has(id))
  const sharedTopics = topics.filter((t) => sharedIds.includes(t.id))

  // ── 2. Compute per-tag stats ─────────────────────────────────────────────
  function computeStats(tagTopics: typeof topics, tag: string): Omit<TagStat, 'is_followed'> {
    const total = tagTopics.length
    const laws = tagTopics.filter((t) => t.status === 'law').length
    const active = tagTopics.filter((t) => t.status === 'active' || t.status === 'voting').length
    const proposed = tagTopics.filter((t) => t.status === 'proposed').length
    const totalVotes = tagTopics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
    const avgBlue =
      total > 0
        ? tagTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / total
        : 50

    // Category breakdown
    const catMap = new Map<string, number>()
    for (const t of tagTopics) {
      if (t.category) catMap.set(t.category, (catMap.get(t.category) ?? 0) + 1)
    }
    const topCategories = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }))

    return {
      tag,
      topic_count: total,
      law_count: laws,
      active_count: active,
      proposed_count: proposed,
      total_votes: totalVotes,
      avg_blue_pct: Math.round(avgBlue),
      top_categories: topCategories,
    }
  }

  const aStats = computeStats(aTopics, rawA)
  const bStats = computeStats(bTopics, rawB)

  // ── 3. Follow status ─────────────────────────────────────────────────────
  let aFollowed = false
  let bFollowed = false

  if (user) {
    const { data: follows } = await supabase
      .from('user_tag_follows')
      .select('tag')
      .eq('user_id', user.id)
      .in('tag', [rawA, rawB])

    for (const f of follows ?? []) {
      if (f.tag === rawA) aFollowed = true
      if (f.tag === rawB) bFollowed = true
    }
  }

  // ── 4. Divergence score ──────────────────────────────────────────────────
  // Based on the difference in average blue_pct between the two tags.
  // A score of 100 means one tag is almost entirely FOR and the other AGAINST.
  const divergence = Math.min(100, Math.round(Math.abs(aStats.avg_blue_pct - bStats.avg_blue_pct) * 2))

  // ── 5. Format shared topics ──────────────────────────────────────────────
  const sharedSummary: SharedTopic[] = sharedTopics
    .sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      category: t.category ?? null,
    }))

  const overlapPctA =
    aStats.topic_count > 0
      ? Math.round((sharedIds.length / aStats.topic_count) * 100)
      : 0

  const overlapPctB =
    bStats.topic_count > 0
      ? Math.round((sharedIds.length / bStats.topic_count) * 100)
      : 0

  const response: TagCompareResponse = {
    tag_a: { ...aStats, is_followed: aFollowed },
    tag_b: { ...bStats, is_followed: bFollowed },
    shared_topics: sharedSummary,
    overlap_count: sharedIds.length,
    overlap_pct_a: overlapPctA,
    overlap_pct_b: overlapPctB,
    divergence_score: divergence,
  }

  return NextResponse.json(response)
}
