import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagStatsCategoryBreakdown {
  category: string
  topic_count: number
  total_votes: number
  avg_for_pct: number
}

export interface TagStatsTopContributor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  argument_count: number
  total_upvotes: number
}

export interface TagStatsTopArgument {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  topic_id: string
  topic_statement: string
  author_username: string
  author_avatar: string | null
}

export interface TagStatsWeeklyActivity {
  week_start: string
  new_topics: number
  total_votes: number
}

export interface TagStatsRelatedTag {
  tag: string
  co_occurrence: number
}

export interface TagStatsResponse {
  tag: string
  total_topics: number
  total_votes: number
  law_count: number
  active_count: number
  voting_count: number
  proposed_count: number
  failed_count: number
  avg_for_pct: number
  followers_count: number
  categories: TagStatsCategoryBreakdown[]
  top_contributors: TagStatsTopContributor[]
  top_arguments: TagStatsTopArgument[]
  weekly_activity: TagStatsWeeklyActivity[]
  related_tags: TagStatsRelatedTag[]
  error?: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  const tag = decodeURIComponent(params.tag).toLowerCase()
  const supabase = await createClient()

  // ── 1. All topics with this tag ─────────────────────────────────────────────
  const { data: topicRows, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, tags, created_at')
    .contains('tags', [tag])
    .limit(500)

  if (topicErr) {
    return NextResponse.json({ error: topicErr.message } as TagStatsResponse, { status: 500 })
  }

  const topics = topicRows ?? []
  const topicIds = topics.map((t) => t.id)

  if (topics.length === 0) {
    return NextResponse.json({
      tag,
      total_topics: 0,
      total_votes: 0,
      law_count: 0,
      active_count: 0,
      voting_count: 0,
      proposed_count: 0,
      failed_count: 0,
      avg_for_pct: 50,
      followers_count: 0,
      categories: [],
      top_contributors: [],
      top_arguments: [],
      weekly_activity: [],
      related_tags: [],
    } satisfies TagStatsResponse)
  }

  // ── 2. Aggregate base stats ─────────────────────────────────────────────────
  let totalVotes = 0
  let lawCount = 0
  let activeCount = 0
  let votingCount = 0
  let proposedCount = 0
  let failedCount = 0
  let forPctSum = 0
  let forPctCount = 0

  const catMap = new Map<string, { topic_count: number; total_votes: number; for_pct_sum: number; for_pct_count: number }>()

  for (const t of topics) {
    totalVotes += t.total_votes ?? 0
    if (t.status === 'law')      lawCount++
    if (t.status === 'active')   activeCount++
    if (t.status === 'voting')   votingCount++
    if (t.status === 'proposed') proposedCount++
    if (t.status === 'failed')   failedCount++

    if (typeof t.blue_pct === 'number') {
      forPctSum += t.blue_pct
      forPctCount++
    }

    const cat = t.category ?? 'Other'
    const entry = catMap.get(cat) ?? { topic_count: 0, total_votes: 0, for_pct_sum: 0, for_pct_count: 0 }
    entry.topic_count++
    entry.total_votes += t.total_votes ?? 0
    if (typeof t.blue_pct === 'number') {
      entry.for_pct_sum += t.blue_pct
      entry.for_pct_count++
    }
    catMap.set(cat, entry)
  }

  const avgForPct = forPctCount > 0 ? Math.round(forPctSum / forPctCount) : 50

  const categories: TagStatsCategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      topic_count: data.topic_count,
      total_votes: data.total_votes,
      avg_for_pct: data.for_pct_count > 0 ? Math.round(data.for_pct_sum / data.for_pct_count) : 50,
    }))
    .sort((a, b) => b.topic_count - a.topic_count)
    .slice(0, 8)

  // ── 3. Weekly activity (last 8 weeks) ───────────────────────────────────────
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const recentTopics = topics
    .filter((t) => new Date(t.created_at) >= eightWeeksAgo)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const weeklyMap = new Map<string, { new_topics: number; total_votes: number }>()
  for (let i = 7; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    weeklyMap.set(key, { new_topics: 0, total_votes: 0 })
  }

  for (const t of recentTopics) {
    const created = new Date(t.created_at)
    // Find the week bucket
    for (const key of weeklyMap.keys()) {
      const weekStart = new Date(key)
      const weekEnd = new Date(key)
      weekEnd.setDate(weekEnd.getDate() + 7)
      if (created >= weekStart && created < weekEnd) {
        const entry = weeklyMap.get(key)!
        entry.new_topics++
        entry.total_votes += t.total_votes ?? 0
        break
      }
    }
  }

  const weekly_activity: TagStatsWeeklyActivity[] = Array.from(weeklyMap.entries())
    .map(([week_start, data]) => ({ week_start, ...data }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start))

  // ── 4. Related tags (co-occurring) ─────────────────────────────────────────
  const coTagMap = new Map<string, number>()
  for (const t of topics) {
    for (const otherTag of (t.tags ?? []) as string[]) {
      if (otherTag === tag || !otherTag) continue
      coTagMap.set(otherTag, (coTagMap.get(otherTag) ?? 0) + 1)
    }
  }
  const related_tags: TagStatsRelatedTag[] = Array.from(coTagMap.entries())
    .map(([t, co_occurrence]) => ({ tag: t, co_occurrence }))
    .sort((a, b) => b.co_occurrence - a.co_occurrence)
    .slice(0, 12)

  // ── 5. Top arguments for this tag ──────────────────────────────────────────
  const topArgResults = topicIds.length > 0
    ? await supabase
        .from('topic_arguments')
        .select(`
          id, content, side, upvotes, topic_id,
          profiles:user_id ( username, avatar_url )
        `)
        .in('topic_id', topicIds.slice(0, 100))
        .order('upvotes', { ascending: false })
        .limit(5)
    : { data: null }

  const topicStatementMap = new Map(topics.map((t) => [t.id, t.statement]))

  const top_arguments: TagStatsTopArgument[] = (topArgResults.data ?? []).map((a) => {
    const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    return {
      id: a.id,
      content: (a.content as string).slice(0, 200),
      side: a.side as 'for' | 'against',
      upvotes: a.upvotes ?? 0,
      topic_id: a.topic_id,
      topic_statement: (topicStatementMap.get(a.topic_id) ?? '').slice(0, 80),
      author_username: (profile as { username?: string } | null)?.username ?? 'citizen',
      author_avatar: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    }
  })

  // ── 6. Top contributors ─────────────────────────────────────────────────────
  const contribResults = topicIds.length > 0
    ? await supabase
        .from('topic_arguments')
        .select(`
          user_id, upvotes,
          profiles:user_id ( username, display_name, avatar_url )
        `)
        .in('topic_id', topicIds.slice(0, 100))
        .limit(500)
    : { data: null }

  const contribMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; argument_count: number; total_upvotes: number }>()
  for (const row of contribResults.data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const uid = row.user_id as string
    const existing = contribMap.get(uid) ?? {
      username: (profile as { username?: string } | null)?.username ?? 'citizen',
      display_name: (profile as { display_name?: string | null } | null)?.display_name ?? null,
      avatar_url: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      argument_count: 0,
      total_upvotes: 0,
    }
    existing.argument_count++
    existing.total_upvotes += row.upvotes ?? 0
    contribMap.set(uid, existing)
  }

  const top_contributors: TagStatsTopContributor[] = Array.from(contribMap.entries())
    .map(([user_id, data]) => ({ user_id, ...data }))
    .sort((a, b) => b.total_upvotes - a.total_upvotes || b.argument_count - a.argument_count)
    .slice(0, 6)

  // ── 7. Follower count ───────────────────────────────────────────────────────
  const { count: followersCount } = await supabase
    .from('user_tag_follows')
    .select('*', { count: 'exact', head: true })
    .eq('tag', tag)

  return NextResponse.json({
    tag,
    total_topics: topics.length,
    total_votes: totalVotes,
    law_count: lawCount,
    active_count: activeCount,
    voting_count: votingCount,
    proposed_count: proposedCount,
    failed_count: failedCount,
    avg_for_pct: avgForPct,
    followers_count: followersCount ?? 0,
    categories,
    top_contributors,
    top_arguments,
    weekly_activity,
    related_tags,
  } satisfies TagStatsResponse)
}
