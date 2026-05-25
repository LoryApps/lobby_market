import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HubTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  continuation_window_ends_at: string | null
  continuation_vote_ends_at: string | null
}

export interface HubContinuation {
  id: string
  topic_id: string
  author_id: string
  text: string
  connector: 'but' | 'and'
  boost_count: number
  endorsement_count: number
  vote_count: number
  status: 'pending' | 'finalist' | 'winner' | 'rejected'
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface HubTopicGroup {
  topic: HubTopic
  continuations: HubContinuation[]
}

export interface ContinuationsHubResponse {
  authoring: HubTopicGroup[]   // topics in continued status (window open)
  voting: HubTopicGroup[]      // topics in continuation vote phase
  recentWinners: Array<HubContinuation & { topic: Pick<HubTopic, 'id' | 'statement' | 'category'> }>
  stats: {
    totalAuthoring: number
    totalVoting: number
    totalWinnersThisMonth: number
    totalContinuationsProposed: number
  }
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  ).toISOString()

  // ── 1. Topics in authoring phase (continuation_window_ends_at > now) ───────
  const { data: authoringTopicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, continuation_window_ends_at, continuation_vote_ends_at')
    .eq('status', 'continued')
    .gt('continuation_window_ends_at', now)
    .order('continuation_window_ends_at', { ascending: true })
    .limit(20)

  // ── 2. Topics in continuation voting phase ─────────────────────────────────
  const { data: votingTopicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, continuation_window_ends_at, continuation_vote_ends_at')
    .gt('continuation_vote_ends_at', now)
    .order('continuation_vote_ends_at', { ascending: true })
    .limit(20)

  const authoringTopics = (authoringTopicRows ?? []) as HubTopic[]
  const votingTopics = (votingTopicRows ?? []) as HubTopic[]

  // ── 3. Fetch continuations for all relevant topics ─────────────────────────
  const allTopicIds = [
    ...authoringTopics.map((t) => t.id),
    ...votingTopics.map((t) => t.id),
  ]

  let allContinuations: HubContinuation[] = []
  if (allTopicIds.length > 0) {
    const { data: contRows } = await supabase
      .from('continuations')
      .select('id, topic_id, author_id, text, connector, boost_count, endorsement_count, vote_count, status, created_at')
      .in('topic_id', allTopicIds)
      .order('boost_count', { ascending: false })

    const rawConts = contRows ?? []

    // Fetch author profiles
    const authorIds = [...new Set(rawConts.map((c) => c.author_id).filter(Boolean))]
    const authorMap: Record<string, HubContinuation['author']> = {}
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', authorIds)
      for (const p of profiles ?? []) {
        authorMap[p.id] = p
      }
    }

    allContinuations = rawConts.map((c) => ({
      ...c,
      connector: c.connector as 'but' | 'and',
      status: c.status as HubContinuation['status'],
      author: authorMap[c.author_id] ?? null,
    }))
  }

  // ── 4. Recent winner continuations ─────────────────────────────────────────
  const { data: winnerRows } = await supabase
    .from('continuations')
    .select('id, topic_id, author_id, text, connector, boost_count, endorsement_count, vote_count, status, created_at')
    .eq('status', 'winner')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(10)

  let recentWinners: ContinuationsHubResponse['recentWinners'] = []
  if ((winnerRows ?? []).length > 0) {
    const winnerTopicIds = [...new Set((winnerRows ?? []).map((c) => c.topic_id))]
    const winnerAuthorIds = [...new Set((winnerRows ?? []).map((c) => c.author_id).filter(Boolean))]

    const [{ data: winnerTopics }, { data: winnerAuthors }] = await Promise.all([
      supabase
        .from('topics')
        .select('id, statement, category')
        .in('id', winnerTopicIds),
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', winnerAuthorIds),
    ])

    const topicMap: Record<string, { id: string; statement: string; category: string | null }> = {}
    for (const t of winnerTopics ?? []) topicMap[t.id] = t

    const authorMap2: Record<string, HubContinuation['author']> = {}
    for (const p of winnerAuthors ?? []) authorMap2[p.id] = p

    recentWinners = (winnerRows ?? [])
      .filter((c) => topicMap[c.topic_id])
      .map((c) => ({
        ...c,
        connector: c.connector as 'but' | 'and',
        status: 'winner' as const,
        author: authorMap2[c.author_id] ?? null,
        topic: topicMap[c.topic_id],
      }))
  }

  // ── 5. Stats ───────────────────────────────────────────────────────────────
  const [winnersThisMonthRes, totalProposedRes] = await Promise.all([
    supabase
      .from('continuations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'winner')
      .gte('created_at', monthStart),
    supabase
      .from('continuations')
      .select('id', { count: 'exact', head: true }),
  ])

  // ── 6. Group continuations by topic ───────────────────────────────────────
  const contsByTopic = new Map<string, HubContinuation[]>()
  for (const c of allContinuations) {
    const existing = contsByTopic.get(c.topic_id) ?? []
    existing.push(c)
    contsByTopic.set(c.topic_id, existing)
  }

  const authoringGroups: HubTopicGroup[] = authoringTopics.map((topic) => ({
    topic,
    continuations: contsByTopic.get(topic.id) ?? [],
  }))

  const votingGroups: HubTopicGroup[] = votingTopics.map((topic) => ({
    topic,
    continuations: (contsByTopic.get(topic.id) ?? []).filter(
      (c) => c.status === 'finalist' || c.status === 'winner'
    ),
  }))

  const response: ContinuationsHubResponse = {
    authoring: authoringGroups,
    voting: votingGroups,
    recentWinners,
    stats: {
      totalAuthoring: authoringTopics.length,
      totalVoting: votingTopics.length,
      totalWinnersThisMonth: winnersThisMonthRes.count ?? 0,
      totalContinuationsProposed: totalProposedRes.count ?? 0,
    },
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
