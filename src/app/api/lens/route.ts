import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LensTopicSnippet {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
}

export interface LensLawSnippet {
  id: string
  statement: string
  established_at: string
  total_votes: number
}

export interface LensCategoryData {
  name: string
  activeCount: number   // active + voting topics
  proposedCount: number
  lawCount: number
  failedCount: number
  passRate: number      // laws / (laws + failed) * 100, or 0 if none resolved
  avgBluePct: number    // mean blue_pct across active/voting topics
  weeklyVotes: number   // votes cast in last 7 days across this category
  recentVoteDelta: number // avgBluePct this week vs last week (positive = trending FOR)
  topTopic: LensTopicSnippet | null
  recentLaw: LensLawSnippet | null
}

export interface LensResponse {
  categories: LensCategoryData[]
  generatedAt: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Fetch all topics for status counts + avg blue_pct
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score')
    .in('category', CATEGORIES)
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .order('feed_score', { ascending: false })

  const topics = (topicRows ?? []) as {
    id: string
    statement: string
    category: string
    status: string
    blue_pct: number
    total_votes: number
    feed_score: number
  }[]

  // 2. Fetch recent laws
  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, statement, established_at, total_votes, category')
    .in('category', CATEGORIES)
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(50)

  const laws = (lawRows ?? []) as {
    id: string
    statement: string
    established_at: string
    total_votes: number
    category: string
  }[]

  // 3. Fetch vote counts this week per category
  const { data: weekVoteRows } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', weekAgo)

  // Get all topic->category mapping for vote aggregation
  const topicCategoryMap = new Map<string, string>()
  for (const t of topics) {
    topicCategoryMap.set(t.id, t.category)
  }

  const weekVotesByCat = new Map<string, number>()
  for (const v of weekVoteRows ?? []) {
    const cat = topicCategoryMap.get(v.topic_id)
    if (cat) {
      weekVotesByCat.set(cat, (weekVotesByCat.get(cat) ?? 0) + 1)
    }
  }

  // 4. Fetch vote data from 2 weeks ago to compute delta
  const { data: prevWeekVoteRows } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .gte('created_at', twoWeeksAgo)
    .lt('created_at', weekAgo)
    .in('side', ['blue', 'red'])

  // Compute per-category FOR% for this week vs last week using recent topic votes
  const prevWeekBlueByCat = new Map<string, { blue: number; total: number }>()

  // We'll use topic-level blue_pct as proxy for current week (from topics table)
  // and compute prev week from actual vote rows
  for (const v of prevWeekVoteRows ?? []) {
    const cat = topicCategoryMap.get(v.topic_id)
    if (!cat) continue
    const rec = prevWeekBlueByCat.get(cat) ?? { blue: 0, total: 0 }
    rec.total++
    if ((v as { side: string }).side === 'blue') rec.blue++
    prevWeekBlueByCat.set(cat, rec)
  }

  // 5. Build category data
  const categories: LensCategoryData[] = CATEGORIES.map((name) => {
    const catTopics = topics.filter((t) => t.category === name)
    const activeTopics = catTopics.filter((t) => t.status === 'active' || t.status === 'voting')
    const proposed = catTopics.filter((t) => t.status === 'proposed')
    const failed = catTopics.filter((t) => t.status === 'failed')
    const catLaws = laws.filter((l) => l.category === name)

    const lawCount = catLaws.length
    const failedCount = failed.length
    const resolved = lawCount + failedCount
    const passRate = resolved > 0 ? Math.round((lawCount / resolved) * 100) : 0

    // Top active/voting topic by feed_score
    const topTopic = activeTopics.length > 0
      ? activeTopics.reduce((best, t) => t.feed_score > best.feed_score ? t : best)
      : null

    // Average blue_pct of active/voting topics
    const avgBluePct = activeTopics.length > 0
      ? Math.round(activeTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / activeTopics.length)
      : 50

    // Recent law
    const recentLaw = catLaws[0] ?? null

    // Vote delta: this week avg FOR% vs last week
    const prevWeekRec = prevWeekBlueByCat.get(name)
    const prevWeekPct = prevWeekRec && prevWeekRec.total > 0
      ? Math.round((prevWeekRec.blue / prevWeekRec.total) * 100)
      : avgBluePct
    const recentVoteDelta = avgBluePct - prevWeekPct

    return {
      name,
      activeCount: activeTopics.length,
      proposedCount: proposed.length,
      lawCount,
      failedCount,
      passRate,
      avgBluePct,
      weeklyVotes: weekVotesByCat.get(name) ?? 0,
      recentVoteDelta,
      topTopic: topTopic
        ? {
            id: topTopic.id,
            statement: topTopic.statement,
            status: topTopic.status,
            blue_pct: topTopic.blue_pct,
            total_votes: topTopic.total_votes,
            feed_score: topTopic.feed_score,
          }
        : null,
      recentLaw: recentLaw
        ? {
            id: recentLaw.id,
            statement: recentLaw.statement,
            established_at: recentLaw.established_at,
            total_votes: recentLaw.total_votes,
          }
        : null,
    }
  })

  // Sort by activity (active topics first, then by weekly votes)
  categories.sort((a, b) => {
    const aScore = a.activeCount * 10 + a.weeklyVotes
    const bScore = b.activeCount * 10 + b.weeklyVotes
    return bScore - aScore
  })

  return NextResponse.json({
    categories,
    generatedAt: new Date().toISOString(),
  } satisfies LensResponse)
}
