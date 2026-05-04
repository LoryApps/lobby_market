import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900 // 15 min cache

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeeklyLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number | null
  established_at: string
  blue_pct?: number
}

export interface WeeklyTopicSwing {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  week_votes: number
}

export interface WeeklyArgument {
  id: string
  content: string
  side: string
  upvotes: number
  topic_id: string
  topic_statement: string
  category: string | null
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface WeeklyRisingUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  week_votes: number
  week_arguments: number
}

export interface WeeklyHighlight {
  total_votes_this_week: number
  total_arguments_this_week: number
  new_laws_this_week: number
  most_debated_category: string | null
  hottest_topic: { id: string; statement: string; category: string | null; total_votes: number } | null
}

export interface WeeklyDigestData {
  week_start: string
  week_end: string
  highlight: WeeklyHighlight
  new_laws: WeeklyLaw[]
  hottest_topics: WeeklyTopicSwing[]
  top_arguments: WeeklyArgument[]
  rising_users: WeeklyRisingUser[]
  category_breakdown: Array<{ category: string; votes: number; topics: number }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function weekBounds(): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString()
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return { start, end }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { start, end } = weekBounds()

  // Run independent queries in parallel
  const [
    newLawsRes,
    weekVotesRes,
    topArgumentsRes,
    hottestTopicsRes,
    risingUsersRes,
    weekArgsCountRes,
  ] = await Promise.all([
    // Laws established this week
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, established_at, blue_pct')
      .gte('established_at', start)
      .lte('established_at', end)
      .order('established_at', { ascending: false })
      .limit(6),

    // Votes cast this week (aggregated)
    supabase
      .from('votes')
      .select('id, topic_id')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(5000),

    // Top arguments by upvotes created this week
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, user_id, created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('upvotes', { ascending: false })
      .limit(10),

    // Hottest topics by activity (many votes this week)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law'])
      .gte('updated_at', start)
      .order('total_votes', { ascending: false })
      .limit(8),

    // Rising users: most active this week
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, total_votes, total_arguments')
      .order('clout', { ascending: false })
      .limit(20),

    // Argument count this week
    supabase
      .from('topic_arguments')
      .select('id')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(1000),
  ])

  const newLaws = (newLawsRes.data ?? []) as WeeklyLaw[]
  const weekVotes = weekVotesRes.data ?? []
  const rawArguments = topArgumentsRes.data ?? []
  const hottestTopics = (hottestTopicsRes.data ?? []) as WeeklyTopicSwing[]
  const risingUsers = risingUsersRes.data ?? []
  const weekArgsCount = (weekArgsCountRes.data ?? []).length

  // Enrich arguments with topic and author data
  const argTopicIds = Array.from(new Set(rawArguments.map((a) => a.topic_id)))
  const argUserIds = Array.from(new Set(rawArguments.map((a) => a.user_id).filter(Boolean)))

  const [argTopicsRes, argAuthorsRes] = await Promise.all([
    argTopicIds.length > 0
      ? supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', argTopicIds)
      : Promise.resolve({ data: [] }),
    argUserIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', argUserIds)
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = new Map((argTopicsRes.data ?? []).map((t) => [t.id, t]))
  const authorMap = new Map((argAuthorsRes.data ?? []).map((u) => [u.id, u]))

  const topArguments: WeeklyArgument[] = rawArguments.slice(0, 5).map((a) => {
    const topic = topicMap.get(a.topic_id)
    const author = authorMap.get(a.user_id ?? '')
    return {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes,
      topic_id: a.topic_id,
      topic_statement: topic?.statement ?? 'Unknown topic',
      category: topic?.category ?? null,
      author: author
        ? {
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
            role: author.role,
          }
        : null,
    }
  })

  // Category breakdown from week's votes
  const topicVoteMap = new Map<string, number>()
  for (const v of weekVotes) {
    topicVoteMap.set(v.topic_id, (topicVoteMap.get(v.topic_id) ?? 0) + 1)
  }
  const allTopicIds = Array.from(topicVoteMap.keys())
  const catMap = new Map<string, { votes: number; topics: Set<string> }>()
  if (allTopicIds.length > 0) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', allTopicIds.slice(0, 500))
    for (const t of catTopics ?? []) {
      const cat = t.category ?? 'Other'
      const existing = catMap.get(cat) ?? { votes: 0, topics: new Set() }
      existing.votes += topicVoteMap.get(t.id) ?? 0
      existing.topics.add(t.id)
      catMap.set(cat, existing)
    }
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, data]) => ({ category, votes: data.votes, topics: data.topics.size }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 6)

  const mostDebatedCategory = categoryBreakdown[0]?.category ?? null
  const hottestTopic = hottestTopics[0]
    ? {
        id: hottestTopics[0].id,
        statement: hottestTopics[0].statement,
        category: hottestTopics[0].category,
        total_votes: hottestTopics[0].total_votes,
      }
    : null

  // Annotate hottest topics with this week's vote count
  const annotatedHotTopics: WeeklyTopicSwing[] = hottestTopics.map((t) => ({
    ...t,
    week_votes: topicVoteMap.get(t.id) ?? 0,
  }))

  // Sort rising users by clout as a proxy for this week's activity
  const sortedRising: WeeklyRisingUser[] = risingUsers.slice(0, 5).map((u) => ({
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    role: u.role,
    clout: u.clout,
    week_votes: u.total_votes ?? 0,
    week_arguments: u.total_arguments ?? 0,
  }))

  const highlight: WeeklyHighlight = {
    total_votes_this_week: weekVotes.length,
    total_arguments_this_week: weekArgsCount,
    new_laws_this_week: newLaws.length,
    most_debated_category: mostDebatedCategory,
    hottest_topic: hottestTopic,
  }

  const result: WeeklyDigestData = {
    week_start: start,
    week_end: end,
    highlight,
    new_laws: newLaws,
    hottest_topics: annotatedHotTopics.slice(0, 5),
    top_arguments: topArguments,
    rising_users: sortedRising,
    category_breakdown: categoryBreakdown,
  }

  return NextResponse.json(result)
}
