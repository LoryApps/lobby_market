import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CIVIC_ISSUES } from '@/lib/data/civic-issues'

export const dynamic = 'force-dynamic'
export const revalidate = 120

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IssueTopicRow {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  tags: string[] | null
}

export interface IssueLawRow {
  id: string
  statement: string
  body: string | null
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  view_count: number
}

export interface IssueContributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  argument_count: number
  upvotes_received: number
}

export interface IssueDetailResponse {
  slug: string
  title: string
  description: string
  tags: string[]
  categories: string[]
  color: string
  icon: string
  stats: {
    topic_count: number
    total_votes: number
    law_count: number
    active_count: number
    voting_count: number
    proposed_count: number
    failed_count: number
    avg_blue_pct: number
    consensus_strength: number  // 0–100
    trending_direction: 'up' | 'down' | 'flat'
  }
  topics: IssueTopicRow[]
  laws: IssueLawRow[]
  contributors: IssueContributor[]
  related_issues: { slug: string; title: string; color: string; icon: string; topic_count: number }[]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const issue = CIVIC_ISSUES.find((i) => i.slug === params.slug)
  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  const supabase = await createClient()

  // ── 1. Fetch all topics (we'll filter in JS to match the hub logic) ─────────
  const { data: allTopicRows, error: topicsError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, tags, created_at')
    .gte('total_votes', 1)
    .not('status', 'in', '("archived","continued")')
    .order('total_votes', { ascending: false })
    .limit(3000)

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 500 })
  }

  const allTopics = allTopicRows ?? []

  // Filter topics matching this issue (same logic as hub)
  const matched = allTopics.filter((t) => {
    const topicTags: string[] = (t.tags as string[]) ?? []
    const hasTagMatch = issue.tags.some((tag) =>
      topicTags.some((tt) => tt.toLowerCase().includes(tag) || tag.includes(tt.toLowerCase()))
    )
    const hasCategoryMatch = issue.categories.includes(t.category as string)
    return hasTagMatch || hasCategoryMatch
  })

  // ── 2. Stats ─────────────────────────────────────────────────────────────────

  const totalVotes = matched.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const lawTopics   = matched.filter((t) => t.status === 'law')
  const activeTopics = matched.filter((t) => t.status === 'active')
  const votingTopics = matched.filter((t) => t.status === 'voting')
  const proposedTopics = matched.filter((t) => t.status === 'proposed')
  const failedTopics  = matched.filter((t) => t.status === 'failed')

  const weightedBlueSum = matched.reduce(
    (s, t) => s + (t.blue_pct ?? 50) * (t.total_votes ?? 1),
    0
  )
  const avgBluePct = totalVotes > 0 ? weightedBlueSum / totalVotes : 50
  const consensusStrength = Math.abs(avgBluePct - 50) * 2

  let trendingDirection: 'up' | 'down' | 'flat' = 'flat'
  const currentlyActive = [...activeTopics, ...votingTopics]
  if (currentlyActive.length > 0) {
    const activeAvg =
      currentlyActive.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / currentlyActive.length
    if (activeAvg > 55) trendingDirection = 'up'
    else if (activeAvg < 45) trendingDirection = 'down'
  }

  const stats = {
    topic_count: matched.length,
    total_votes: totalVotes,
    law_count: lawTopics.length,
    active_count: activeTopics.length,
    voting_count: votingTopics.length,
    proposed_count: proposedTopics.length,
    failed_count: failedTopics.length,
    avg_blue_pct: Math.round(avgBluePct * 10) / 10,
    consensus_strength: Math.round(consensusStrength),
    trending_direction: trendingDirection,
  }

  // ── 3. Topics list — top 40 by vote count ────────────────────────────────────

  const topics: IssueTopicRow[] = matched.slice(0, 40).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    created_at: t.created_at,
    tags: (t.tags as string[] | null) ?? null,
  }))

  // ── 4. Laws — top 10 most recent ─────────────────────────────────────────────

  let laws: IssueLawRow[] = []
  if (lawTopics.length > 0) {
    const lawIds = lawTopics.map((t) => t.id)
    const { data: lawRows } = await supabase
      .from('laws')
      .select('id, statement, body, category, blue_pct, total_votes, established_at, view_count')
      .in('id', lawIds.slice(0, 50))
      .order('established_at', { ascending: false })
      .limit(10)

    laws = (lawRows ?? []).map((l) => ({
      id: l.id,
      statement: l.statement,
      body: l.body ?? null,
      category: l.category ?? null,
      blue_pct: l.blue_pct ?? 0,
      total_votes: l.total_votes ?? 0,
      established_at: l.established_at,
      view_count: l.view_count ?? 0,
    }))
  }

  // ── 5. Top contributors ───────────────────────────────────────────────────────

  let contributors: IssueContributor[] = []
  if (matched.length > 0) {
    const topicIds = matched.map((t) => t.id).slice(0, 200)

    // Get argument counts + upvotes per user across matched topics
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('user_id, upvotes')
      .in('topic_id', topicIds)
      .gte('upvotes', 0)

    if (argRows && argRows.length > 0) {
      // Aggregate by user
      const userMap = new Map<string, { count: number; upvotes: number }>()
      for (const row of argRows) {
        const existing = userMap.get(row.user_id) ?? { count: 0, upvotes: 0 }
        userMap.set(row.user_id, {
          count: existing.count + 1,
          upvotes: existing.upvotes + (row.upvotes ?? 0),
        })
      }

      // Sort by combined score: upvotes + (count × 2)
      const sorted = Array.from(userMap.entries())
        .map(([id, { count, upvotes }]) => ({ id, count, upvotes, score: upvotes + count * 2 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)

      if (sorted.length > 0) {
        const userIds = sorted.map((u) => u.id)
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role, clout')
          .in('id', userIds)

        const profileMap = new Map(
          (profileRows ?? []).map((p) => [p.id, p])
        )

        contributors = sorted
          .filter((u) => profileMap.has(u.id))
          .map((u) => {
            const p = profileMap.get(u.id)!
            return {
              id: p.id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              role: p.role,
              clout: p.clout ?? 0,
              argument_count: u.count,
              upvotes_received: u.upvotes,
            }
          })
      }
    }
  }

  // ── 6. Related issues (those that share categories) ───────────────────────────

  // Count how many matched topics each OTHER issue would also claim
  const related_issues = CIVIC_ISSUES
    .filter((other) => other.slug !== issue.slug)
    .map((other) => {
      const overlap = matched.filter((t) => {
        const topicTags: string[] = (t.tags as string[]) ?? []
        return (
          other.tags.some((tag) =>
            topicTags.some((tt) => tt.toLowerCase().includes(tag) || tag.includes(tt.toLowerCase()))
          ) || other.categories.includes(t.category as string)
        )
      }).length

      // Also count own topics from other issue
      const ownCount = allTopics.filter((t) => {
        const topicTags: string[] = (t.tags as string[]) ?? []
        return (
          other.tags.some((tag) =>
            topicTags.some((tt) => tt.toLowerCase().includes(tag) || tag.includes(tt.toLowerCase()))
          ) || other.categories.includes(t.category as string)
        )
      }).length

      return {
        slug: other.slug,
        title: other.title,
        color: other.color,
        icon: other.icon,
        topic_count: ownCount,
        _overlap: overlap,
      }
    })
    .sort((a, b) => b._overlap - a._overlap)
    .slice(0, 4)
    .map(({ _overlap: _, ...rest }) => rest)

  const response: IssueDetailResponse = {
    slug: issue.slug,
    title: issue.title,
    description: issue.description,
    tags: issue.tags,
    categories: issue.categories,
    color: issue.color,
    icon: issue.icon,
    stats,
    topics,
    laws,
    contributors,
    related_issues,
  }

  return NextResponse.json(response)
}
