import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1h cache

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuarterlyLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number | null
  established_at: string
  blue_pct?: number
}

export interface QuarterlyTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  quarter_votes: number
}

export interface QuarterlyArgument {
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

export interface QuarterlyContributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface QuarterlyHighlight {
  total_votes: number
  total_arguments: number
  new_laws: number
  new_users: number
  most_debated_category: string | null
  debate_of_quarter: {
    id: string
    statement: string
    category: string | null
    total_votes: number
    blue_pct: number
  } | null
}

export interface QuarterlyData {
  quarter: string       // e.g. "Q3 2025"
  quarter_start: string
  quarter_end: string
  highlight: QuarterlyHighlight
  new_laws: QuarterlyLaw[]
  hottest_topics: QuarterlyTopic[]
  top_arguments: QuarterlyArgument[]
  top_contributors: QuarterlyContributor[]
  category_breakdown: Array<{ category: string; votes: number; topics: number }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function quarterBounds(): { start: string; end: string; label: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed
  const q = Math.floor(month / 3) + 1
  const qStart = new Date(Date.UTC(year, (q - 1) * 3, 1))
  const qEnd = now
  return {
    start: qStart.toISOString(),
    end: qEnd.toISOString(),
    label: `Q${q} ${year}`,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { start, end, label } = quarterBounds()

  const [
    newLawsRes,
    quarterVotesRes,
    topArgumentsRes,
    hottestTopicsRes,
    topContributorsRes,
    quarterArgsRes,
    newUsersRes,
  ] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, established_at, blue_pct')
      .gte('established_at', start)
      .lte('established_at', end)
      .order('established_at', { ascending: false })
      .limit(10),

    supabase
      .from('votes')
      .select('id, topic_id')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(10000),

    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, user_id, created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('upvotes', { ascending: false })
      .limit(12),

    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law'])
      .gte('updated_at', start)
      .order('total_votes', { ascending: false })
      .limit(10),

    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .order('clout', { ascending: false })
      .limit(8),

    supabase
      .from('topic_arguments')
      .select('id')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(5000),

    supabase
      .from('profiles')
      .select('id')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(5000),
  ])

  const newLaws = (newLawsRes.data ?? []) as QuarterlyLaw[]
  const quarterVotes = quarterVotesRes.data ?? []
  const rawArguments = topArgumentsRes.data ?? []
  const hottestTopics = (hottestTopicsRes.data ?? []) as QuarterlyTopic[]
  const topContributors = (topContributorsRes.data ?? []) as QuarterlyContributor[]
  const quarterArgsCount = (quarterArgsRes.data ?? []).length
  const newUsersCount = (newUsersRes.data ?? []).length

  // Enrich arguments with topic and author data
  const argTopicIds = Array.from(new Set(rawArguments.map((a) => a.topic_id)))
  const argUserIds = Array.from(new Set(rawArguments.map((a) => a.user_id).filter(Boolean)))

  const [argTopicsRes, argAuthorsRes] = await Promise.all([
    argTopicIds.length > 0
      ? supabase.from('topics').select('id, statement, category').in('id', argTopicIds)
      : Promise.resolve({ data: [] }),
    argUserIds.length > 0
      ? supabase.from('profiles').select('id, username, display_name, avatar_url, role').in('id', argUserIds)
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = new Map((argTopicsRes.data ?? []).map((t) => [t.id, t]))
  const authorMap = new Map((argAuthorsRes.data ?? []).map((u) => [u.id, u]))

  const topArguments: QuarterlyArgument[] = rawArguments.slice(0, 6).map((a) => {
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

  // Category breakdown from this quarter's votes
  const topicVoteMap = new Map<string, number>()
  for (const v of quarterVotes) {
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
    .map(([category, d]) => ({ category, votes: d.votes, topics: d.topics.size }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 8)

  const mostDebatedCategory = categoryBreakdown[0]?.category ?? null

  // Annotate hottest topics with quarter vote count
  const annotatedHotTopics: QuarterlyTopic[] = hottestTopics.map((t) => ({
    ...t,
    quarter_votes: topicVoteMap.get(t.id) ?? 0,
  }))

  const debateOfQuarter = hottestTopics[0]
    ? {
        id: hottestTopics[0].id,
        statement: hottestTopics[0].statement,
        category: hottestTopics[0].category,
        total_votes: hottestTopics[0].total_votes,
        blue_pct: hottestTopics[0].blue_pct,
      }
    : null

  const highlight: QuarterlyHighlight = {
    total_votes: quarterVotes.length,
    total_arguments: quarterArgsCount,
    new_laws: newLaws.length,
    new_users: newUsersCount,
    most_debated_category: mostDebatedCategory,
    debate_of_quarter: debateOfQuarter,
  }

  const result: QuarterlyData = {
    quarter: label,
    quarter_start: start,
    quarter_end: end,
    highlight,
    new_laws: newLaws,
    hottest_topics: annotatedHotTopics.slice(0, 8),
    top_arguments: topArguments,
    top_contributors: topContributors.slice(0, 6),
    category_breakdown: categoryBreakdown,
  }

  return NextResponse.json(result)
}
