import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CIVIC_ISSUES } from '@/lib/data/civic-issues'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export type { CivicIssue } from '@/lib/data/civic-issues'

// ─── Response types ───────────────────────────────────────────────────────────

export interface IssueStat {
  slug: string
  title: string
  description: string
  color: string
  icon: string
  topic_count: number
  total_votes: number
  active_count: number
  law_count: number
  failed_count: number
  avg_blue_pct: number      // weighted average FOR% across all topics
  consensus_strength: number // 0–100: how far from 50/50 the avg is
  trending_direction: 'up' | 'down' | 'flat'  // momentum signal
  top_topic: {
    id: string
    statement: string
    status: string
    blue_pct: number
    total_votes: number
  } | null
  recent_law: {
    id: string
    statement: string
    blue_pct: number
  } | null
}

export interface IssuesResponse {
  issues: IssueStat[]
  total_topics: number
  total_votes: number
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch ALL topics with relevant columns once — we'll filter in memory
  const { data: allTopics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, tags, created_at, feed_score')
    .gte('total_votes', 3)
    .order('total_votes', { ascending: false })
    .limit(5000)

  if (error) {
    console.error('[issues]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topics = allTopics ?? []

  let grandTotalTopics = 0
  let grandTotalVotes = 0

  const issues: IssueStat[] = CIVIC_ISSUES.map((issue) => {
    // Match topics whose tags contain ANY of the issue's tags,
    // OR whose category matches any of the issue's categories
    const matched = topics.filter((t) => {
      const topicTags: string[] = (t.tags as string[]) ?? []
      const hasTagMatch = issue.tags.some((tag) =>
        topicTags.some((tt) => tt.toLowerCase().includes(tag) || tag.includes(tt.toLowerCase()))
      )
      const hasCategoryMatch = issue.categories.includes(t.category as string)
      return hasTagMatch || hasCategoryMatch
    })

    if (matched.length === 0) {
      return {
        ...issue,
        topic_count: 0,
        total_votes: 0,
        active_count: 0,
        law_count: 0,
        failed_count: 0,
        avg_blue_pct: 50,
        consensus_strength: 0,
        trending_direction: 'flat' as const,
        top_topic: null,
        recent_law: null,
      }
    }

    grandTotalTopics += matched.length
    const totalVotes = matched.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
    grandTotalVotes += totalVotes

    const activeCount = matched.filter((t) =>
      ['active', 'voting'].includes(t.status as string)
    ).length
    const lawCount = matched.filter((t) => t.status === 'law').length
    const failedCount = matched.filter((t) => t.status === 'failed').length

    // Weighted average blue_pct (weight by vote count)
    const weightedBlueSum = matched.reduce(
      (sum, t) => sum + (t.blue_pct ?? 50) * (t.total_votes ?? 1),
      0
    )
    const avgBluePct =
      totalVotes > 0 ? weightedBlueSum / totalVotes : 50

    // Consensus strength: distance from 50
    const consensusStrength = Math.abs(avgBluePct - 50) * 2 // 0–100

    // Trending direction: compare top-voted active vs voting topics
    // Simple heuristic: if avg blue_pct of active topics > 55 → up, < 45 → down
    const activeTopics = matched.filter((t) =>
      ['active', 'voting'].includes(t.status as string)
    )
    let trendingDirection: 'up' | 'down' | 'flat' = 'flat'
    if (activeTopics.length > 0) {
      const activeAvg =
        activeTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) /
        activeTopics.length
      if (activeAvg > 55) trendingDirection = 'up'
      else if (activeAvg < 45) trendingDirection = 'down'
    }

    // Top topic: highest feed_score or most votes
    const topTopic = [...matched]
      .filter((t) => ['active', 'voting', 'proposed'].includes(t.status as string))
      .sort((a, b) =>
        ((b.feed_score as number) ?? b.total_votes ?? 0) -
        ((a.feed_score as number) ?? a.total_votes ?? 0)
      )[0] ?? matched.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))[0]

    // Most recent law
    const recentLaw = matched
      .filter((t) => t.status === 'law')
      .sort(
        (a, b) =>
          new Date(b.created_at as string).getTime() -
          new Date(a.created_at as string).getTime()
      )[0] ?? null

    return {
      ...issue,
      topic_count: matched.length,
      total_votes: totalVotes,
      active_count: activeCount,
      law_count: lawCount,
      failed_count: failedCount,
      avg_blue_pct: Math.round(avgBluePct * 10) / 10,
      consensus_strength: Math.round(consensusStrength),
      trending_direction: trendingDirection,
      top_topic: topTopic
        ? {
            id: topTopic.id as string,
            statement: topTopic.statement as string,
            status: topTopic.status as string,
            blue_pct: topTopic.blue_pct ?? 50,
            total_votes: topTopic.total_votes ?? 0,
          }
        : null,
      recent_law: recentLaw
        ? {
            id: recentLaw.id as string,
            statement: recentLaw.statement as string,
            blue_pct: recentLaw.blue_pct ?? 50,
          }
        : null,
    }
  })

  // Sort by total_votes descending for display order
  issues.sort((a, b) => b.total_votes - a.total_votes)

  return NextResponse.json({
    issues,
    total_topics: grandTotalTopics,
    total_votes: grandTotalVotes,
    generated_at: new Date().toISOString(),
  } satisfies IssuesResponse)
}
