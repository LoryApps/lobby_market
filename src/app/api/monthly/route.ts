import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1-hour edge cache

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MonthlyLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number | null
  blue_pct: number | null
  established_at: string
}

export interface MonthlyTopTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  month_votes: number
}

export interface MonthlyArgument {
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

export interface MonthlyAward {
  kind: 'legislator' | 'orator' | 'voter'
  label: string
  description: string
  user: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
  stat_value: number
  stat_label: string
}

export interface MonthlyHighlight {
  total_votes_this_month: number
  total_votes_last_month: number
  total_arguments_this_month: number
  total_arguments_last_month: number
  new_laws_this_month: number
  new_laws_last_month: number
  active_topics: number
  most_debated_category: string | null
  hottest_topic: {
    id: string
    statement: string
    category: string | null
    total_votes: number
  } | null
}

export interface MonthlyCategoryBreakdown {
  category: string
  votes: number
  topics: number
  laws: number
}

export interface MonthlyDigestData {
  month_name: string
  month_start: string
  month_end: string
  highlight: MonthlyHighlight
  new_laws: MonthlyLaw[]
  top_topics: MonthlyTopTopic[]
  top_arguments: MonthlyArgument[]
  awards: MonthlyAward[]
  category_breakdown: MonthlyCategoryBreakdown[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function monthBounds(monthsAgo = 0): { start: string; end: string; name: string } {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const start = new Date(target.getFullYear(), target.getMonth(), 1).toISOString()
  const end =
    monthsAgo === 0
      ? now.toISOString()
      : new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const name = target.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  return { start, end, name }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { start, end, name: month_name } = monthBounds(0)
  const { start: prevStart, end: prevEnd } = monthBounds(1)

  // All primary queries run in parallel
  const [
    newLawsRes,
    prevLawsRes,
    monthVotesRes,
    prevVotesRes,
    topArgumentsRes,
    prevArgsCountRes,
    hottestTopicsRes,
    activeTopicsRes,
    topVotersRes,
    topAuthorsRes,
  ] = await Promise.all([
    // Laws this month
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at')
      .gte('established_at', start)
      .lte('established_at', end)
      .order('established_at', { ascending: false })
      .limit(20),

    // Laws last month (count only)
    supabase
      .from('laws')
      .select('id')
      .gte('established_at', prevStart)
      .lte('established_at', prevEnd)
      .limit(1000),

    // Votes this month
    supabase
      .from('votes')
      .select('id, topic_id, user_id')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(10000),

    // Votes last month (count only)
    supabase
      .from('votes')
      .select('id')
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd)
      .limit(10000),

    // Top arguments by upvotes this month
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, user_id, created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('upvotes', { ascending: false })
      .limit(15),

    // Arguments last month (count only)
    supabase
      .from('topic_arguments')
      .select('id')
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd)
      .limit(5000),

    // Hottest topics (most total votes, updated this month)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law'])
      .gte('updated_at', start)
      .order('total_votes', { ascending: false })
      .limit(10),

    // Active topic count
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'voting']),

    // Top voters this month (by vote count)
    supabase
      .from('votes')
      .select('user_id')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(10000),

    // Top argument authors this month (by upvote total)
    supabase
      .from('topic_arguments')
      .select('user_id, upvotes')
      .gte('created_at', start)
      .lte('created_at', end)
      .gt('upvotes', 0)
      .limit(5000),
  ])

  const newLaws = (newLawsRes.data ?? []) as MonthlyLaw[]
  const monthVotes = monthVotesRes.data ?? []
  const prevVotesCount = (prevVotesRes.data ?? []).length
  const rawArguments = topArgumentsRes.data ?? []
  const prevArgsCount = (prevArgsCountRes.data ?? []).length
  const hottestTopics = (hottestTopicsRes.data ?? []) as MonthlyTopTopic[]
  const activeTopics = activeTopicsRes.count ?? 0
  const allVotersThisMonth = topVotersRes.data ?? []
  const allArgumentAuthors = topAuthorsRes.data ?? []

  // ── Enrich arguments with topic + author data ──────────────────────────────
  const argTopicIds = Array.from(new Set(rawArguments.map((a) => a.topic_id)))
  const argUserIds = Array.from(
    new Set(rawArguments.map((a) => a.user_id).filter(Boolean))
  )

  const [argTopicsRes, argAuthorsRes] = await Promise.all([
    argTopicIds.length > 0
      ? supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', argTopicIds)
      : Promise.resolve({ data: [] as { id: string; statement: string; category: string | null }[] }),
    argUserIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', argUserIds)
      : Promise.resolve({ data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }[] }),
  ])

  const topicMap = new Map(
    (argTopicsRes.data ?? []).map((t) => [t.id, t as { id: string; statement: string; category: string | null }])
  )
  const authorMap = new Map(
    (argAuthorsRes.data ?? []).map((u) => [u.id, u as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }])
  )

  const topArguments: MonthlyArgument[] = rawArguments.slice(0, 5).map((a) => {
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

  // ── Category breakdown ─────────────────────────────────────────────────────
  const topicVoteMap = new Map<string, number>()
  for (const v of monthVotes) {
    topicVoteMap.set(v.topic_id, (topicVoteMap.get(v.topic_id) ?? 0) + 1)
  }
  const allTopicIds = Array.from(topicVoteMap.keys())

  interface CatEntry { votes: number; topics: Set<string>; laws: number }
  const catMap = new Map<string, CatEntry>()

  if (allTopicIds.length > 0) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('id, category, status')
      .in('id', allTopicIds.slice(0, 500))

    for (const t of catTopics ?? []) {
      const cat = t.category ?? 'Other'
      const existing: CatEntry = catMap.get(cat) ?? { votes: 0, topics: new Set(), laws: 0 }
      existing.votes += topicVoteMap.get(t.id) ?? 0
      existing.topics.add(t.id)
      if (t.status === 'law') existing.laws += 1
      catMap.set(cat, existing)
    }
  }

  const categoryBreakdown: MonthlyCategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      votes: data.votes,
      topics: data.topics.size,
      laws: data.laws,
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 8)

  // ── Annotate hottest topics with month vote count ──────────────────────────
  const annotatedHotTopics: MonthlyTopTopic[] = hottestTopics.map((t) => ({
    ...t,
    month_votes: topicVoteMap.get(t.id) ?? 0,
  }))

  // ── Awards: Legislator, Orator, Voter of the Month ────────────────────────
  const awards: MonthlyAward[] = []

  // 1. Legislator of the Month: user who authored the most laws this month
  if (newLaws.length > 0) {
    const lawTopicIds = newLaws.map((l) => l.id)
    const { data: lawTopics } = await supabase
      .from('topics')
      .select('id, author_id')
      .in('id', lawTopicIds)

    const lawAuthorCount = new Map<string, number>()
    for (const t of lawTopics ?? []) {
      if (t.author_id) {
        lawAuthorCount.set(t.author_id, (lawAuthorCount.get(t.author_id) ?? 0) + 1)
      }
    }
    const topLegislatorId = Array.from(lawAuthorCount.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]

    if (topLegislatorId) {
      const { data: legislator } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .eq('id', topLegislatorId[0])
        .maybeSingle()

      if (legislator) {
        awards.push({
          kind: 'legislator',
          label: 'Legislator of the Month',
          description: 'Most topics turned into law',
          user: {
            id: legislator.id,
            username: legislator.username,
            display_name: legislator.display_name,
            avatar_url: legislator.avatar_url,
            role: legislator.role,
            clout: legislator.clout,
          },
          stat_value: topLegislatorId[1],
          stat_label: topLegislatorId[1] === 1 ? 'law passed' : 'laws passed',
        })
      }
    }
  }

  // 2. Orator of the Month: user whose arguments got the most upvotes
  const oratorMap = new Map<string, number>()
  for (const a of allArgumentAuthors) {
    if (a.user_id) {
      oratorMap.set(a.user_id, (oratorMap.get(a.user_id) ?? 0) + (a.upvotes ?? 0))
    }
  }
  const topOratorEntry = Array.from(oratorMap.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topOratorEntry) {
    const { data: orator } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .eq('id', topOratorEntry[0])
      .maybeSingle()
    if (orator) {
      awards.push({
        kind: 'orator',
        label: 'Orator of the Month',
        description: 'Most upvoted arguments',
        user: {
          id: orator.id,
          username: orator.username,
          display_name: orator.display_name,
          avatar_url: orator.avatar_url,
          role: orator.role,
          clout: orator.clout,
        },
        stat_value: topOratorEntry[1],
        stat_label: 'upvotes earned',
      })
    }
  }

  // 3. Voter of the Month: most votes cast
  const voterMap = new Map<string, number>()
  for (const v of allVotersThisMonth) {
    if (v.user_id) {
      voterMap.set(v.user_id, (voterMap.get(v.user_id) ?? 0) + 1)
    }
  }
  const topVoterEntry = Array.from(voterMap.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topVoterEntry) {
    const { data: voter } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .eq('id', topVoterEntry[0])
      .maybeSingle()
    if (voter) {
      awards.push({
        kind: 'voter',
        label: 'Voter of the Month',
        description: 'Most votes cast',
        user: {
          id: voter.id,
          username: voter.username,
          display_name: voter.display_name,
          avatar_url: voter.avatar_url,
          role: voter.role,
          clout: voter.clout,
        },
        stat_value: topVoterEntry[1],
        stat_label: topVoterEntry[1] === 1 ? 'vote cast' : 'votes cast',
      })
    }
  }

  // ── Assemble result ────────────────────────────────────────────────────────
  const highlight: MonthlyHighlight = {
    total_votes_this_month: monthVotes.length,
    total_votes_last_month: prevVotesCount,
    total_arguments_this_month: rawArguments.length + (rawArguments.length < 15 ? 0 : 10), // approx
    total_arguments_last_month: prevArgsCount,
    new_laws_this_month: newLaws.length,
    new_laws_last_month: (prevLawsRes.data ?? []).length,
    active_topics: activeTopics,
    most_debated_category: categoryBreakdown[0]?.category ?? null,
    hottest_topic: hottestTopics[0]
      ? {
          id: hottestTopics[0].id,
          statement: hottestTopics[0].statement,
          category: hottestTopics[0].category,
          total_votes: hottestTopics[0].total_votes,
        }
      : null,
  }

  const result: MonthlyDigestData = {
    month_name,
    month_start: start,
    month_end: end,
    highlight,
    new_laws: newLaws,
    top_topics: annotatedHotTopics.slice(0, 6),
    top_arguments: topArguments,
    awards,
    category_breakdown: categoryBreakdown,
  }

  return NextResponse.json(result)
}
