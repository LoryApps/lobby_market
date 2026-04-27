import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // refresh records every hour

// ─── Response types ────────────────────────────────────────────────────────────

export interface RecordTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
}

export interface RecordProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  vote_streak: number
  total_votes: number
  total_arguments: number
}

export interface RecordArgument {
  id: string
  content: string
  side: string
  upvotes: number
  created_at: string
  topic: { id: string; statement: string; category: string | null } | null
  author: { username: string; display_name: string | null; avatar_url: string | null } | null
}

export interface RecordDebate {
  id: string
  title: string
  type: string
  status: string
  viewer_count: number
  scheduled_at: string
  topic: { id: string; statement: string; category: string | null } | null
}

export interface RecordLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  total_votes: number
  established_at: string
  proposed_at: string | null
  hours_to_law: number | null
}

export interface RecordsResponse {
  mostVoted: RecordTopic | null
  mostContested: RecordTopic | null
  mostViewed: RecordTopic | null
  mostDebated: RecordTopic | null
  fastestLaw: RecordLaw | null
  mostUpvotedArgument: RecordArgument | null
  longestStreak: RecordProfile | null
  highestReputation: RecordProfile | null
  mostArguments: RecordProfile | null
  biggestDebate: RecordDebate | null
  platformTotals: {
    totalTopics: number
    totalLaws: number
    totalVotes: number
    totalArguments: number
    totalUsers: number
    totalDebates: number
  }
}

export async function GET() {
  const supabase = await createClient()

  // Run all queries in parallel for speed
  const [
    mostVotedRes,
    mostContestedRes,
    mostViewedRes,
    fastestLawRes,
    mostUpvotedArgRes,
    longestStreakRes,
    highestRepRes,
    mostArgsRes,
    biggestDebateRes,
    mostDebatedRes,
    totalsTopicsRes,
    totalsLawsRes,
    totalsVotesRes,
    totalsArgumentsRes,
    totalsUsersRes,
    totalsDebatesRes,
  ] = await Promise.all([
    // Most-voted topic ever
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .order('total_votes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most contested (closest to 50/50 with meaningful vote count)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .gte('total_votes', 50)
      .order('blue_pct', { ascending: false }) // we'll post-process to find closest to 50
      .limit(500),

    // Most-viewed topic
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .order('view_count', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Fastest law: join topics created_at with laws established_at
    supabase
      .from('laws')
      .select(`
        id,
        topic_id,
        statement,
        category,
        total_votes,
        established_at,
        topics!inner(created_at)
      `)
      .limit(200),

    // Most upvoted argument with author + topic info
    supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        created_at,
        topics!inner(id, statement, category),
        profiles!inner(username, display_name, avatar_url)
      `)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Longest current streak
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score, vote_streak, total_votes, total_arguments')
      .order('vote_streak', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Highest reputation
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score, vote_streak, total_votes, total_arguments')
      .order('reputation_score', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most arguments posted
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score, vote_streak, total_votes, total_arguments')
      .order('total_arguments', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Biggest debate by viewer count
    supabase
      .from('debates')
      .select(`
        id,
        title,
        type,
        status,
        viewer_count,
        scheduled_at,
        topics(id, statement, category)
      `)
      .order('viewer_count', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most debated topic (by argument count) — use aggregate via count
    supabase
      .from('topic_arguments')
      .select('topic_id')
      .limit(10000),

    // Platform totals
    supabase.from('topics').select('id', { count: 'exact', head: true }),
    supabase.from('laws').select('id', { count: 'exact', head: true }),
    supabase.from('votes').select('id', { count: 'exact', head: true }),
    supabase.from('topic_arguments').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('debates').select('id', { count: 'exact', head: true }),
  ])

  // ── Post-process most contested ──────────────────────────────────────────
  let mostContested: RecordTopic | null = null
  if (mostContestedRes.data && mostContestedRes.data.length > 0) {
    const sorted = [...mostContestedRes.data].sort(
      (a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50)
    )
    mostContested = sorted[0] as RecordTopic
  }

  // ── Post-process fastest law ─────────────────────────────────────────────
  let fastestLaw: RecordLaw | null = null
  if (fastestLawRes.data && fastestLawRes.data.length > 0) {
    type RawLaw = {
      id: string
      topic_id: string
      statement: string
      category: string | null
      total_votes: number
      established_at: string
      topics: { created_at: string } | null
    }
    const withDuration = (fastestLawRes.data as unknown as RawLaw[])
      .map((law) => {
        const proposedAt = law.topics?.created_at ?? null
        const hoursToLaw = proposedAt
          ? (new Date(law.established_at).getTime() - new Date(proposedAt).getTime()) /
            (1000 * 60 * 60)
          : null
        return {
          id: law.id,
          topic_id: law.topic_id,
          statement: law.statement,
          category: law.category,
          total_votes: law.total_votes,
          established_at: law.established_at,
          proposed_at: proposedAt,
          hours_to_law: hoursToLaw,
        }
      })
      .filter((l) => l.hours_to_law !== null && l.hours_to_law >= 0)
      .sort((a, b) => (a.hours_to_law ?? Infinity) - (b.hours_to_law ?? Infinity))

    fastestLaw = withDuration[0] ?? null
  }

  // ── Post-process most debated topic ─────────────────────────────────────
  let mostDebated: RecordTopic | null = null
  if (mostDebatedRes.data && mostDebatedRes.data.length > 0) {
    const counts: Record<string, number> = {}
    for (const row of mostDebatedRes.data as { topic_id: string }[]) {
      counts[row.topic_id] = (counts[row.topic_id] ?? 0) + 1
    }
    const topId = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0]
    if (topId) {
      const { data } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
        .eq('id', topId)
        .maybeSingle()
      if (data) mostDebated = data as RecordTopic
    }
  }

  // ── Shape argument record ────────────────────────────────────────────────
  let mostUpvotedArgument: RecordArgument | null = null
  if (mostUpvotedArgRes.data) {
    const raw = mostUpvotedArgRes.data as unknown as {
      id: string
      content: string
      side: string
      upvotes: number
      created_at: string
      topics: { id: string; statement: string; category: string | null } | null
      profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
    }
    mostUpvotedArgument = {
      id: raw.id,
      content: raw.content,
      side: raw.side,
      upvotes: raw.upvotes,
      created_at: raw.created_at,
      topic: raw.topics ?? null,
      author: raw.profiles ?? null,
    }
  }

  // ── Shape debate record ──────────────────────────────────────────────────
  let biggestDebate: RecordDebate | null = null
  if (biggestDebateRes.data) {
    const raw = biggestDebateRes.data as unknown as {
      id: string
      title: string
      type: string
      status: string
      viewer_count: number
      scheduled_at: string
      topics: { id: string; statement: string; category: string | null } | null
    }
    biggestDebate = {
      id: raw.id,
      title: raw.title,
      type: raw.type,
      status: raw.status,
      viewer_count: raw.viewer_count,
      scheduled_at: raw.scheduled_at,
      topic: raw.topics ?? null,
    }
  }

  return NextResponse.json({
    mostVoted: (mostVotedRes.data as RecordTopic | null) ?? null,
    mostContested,
    mostViewed: (mostViewedRes.data as RecordTopic | null) ?? null,
    mostDebated,
    fastestLaw,
    mostUpvotedArgument,
    longestStreak: (longestStreakRes.data as RecordProfile | null) ?? null,
    highestReputation: (highestRepRes.data as RecordProfile | null) ?? null,
    mostArguments: (mostArgsRes.data as RecordProfile | null) ?? null,
    biggestDebate,
    platformTotals: {
      totalTopics: totalsTopicsRes.count ?? 0,
      totalLaws: totalsLawsRes.count ?? 0,
      totalVotes: totalsVotesRes.count ?? 0,
      totalArguments: totalsArgumentsRes.count ?? 0,
      totalUsers: totalsUsersRes.count ?? 0,
      totalDebates: totalsDebatesRes.count ?? 0,
    },
  } satisfies RecordsResponse)
}
