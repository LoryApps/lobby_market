import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodayStats {
  votes_cast: number
  arguments_made: number
  new_topics: number
  laws_passed: number
  active_debaters: number
}

export interface TodayTopTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
  argument_count: number
}

export interface TodayTopArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  }
}

export interface TodayLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  updated_at: string
}

export interface TodayVotingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
}

export interface TodayResponse {
  date: string
  stats: TodayStats
  topTopic: TodayTopTopic | null
  topArgument: TodayTopArgument | null
  recentLaw: TodayLaw | null
  votingNow: TodayVotingTopic[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStart(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET() {
  try {
    const supabase = await createClient()
    const todayStart = getTodayStart()

    // Run all fetches in parallel
    const [
      votesRes,
      argumentsRes,
      topicsRes,
      lawsRes,
      topTopicRes,
      topArgumentRes,
      recentLawRes,
      votingNowRes,
    ] = await Promise.all([
      // Votes cast today
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      // Arguments made today
      supabase
        .from('topic_arguments')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      // New topics proposed today
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      // Laws passed today (status changed to law today via updated_at heuristic)
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'law')
        .gte('updated_at', todayStart),

      // Top topic right now (highest feed_score among active/voting)
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, feed_score')
        .in('status', ['active', 'voting'])
        .order('feed_score', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Top argument made today (highest upvotes on arguments created today)
      supabase
        .from('topic_arguments')
        .select(`
          id,
          topic_id,
          side,
          content,
          upvotes,
          created_at,
          profiles!topic_arguments_user_id_fkey (
            id, username, display_name, avatar_url, role
          ),
          topics!topic_arguments_topic_id_fkey (
            id, statement, category, status
          )
        `)
        .gte('created_at', todayStart)
        .order('upvotes', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Most recent law
      supabase
        .from('topics')
        .select('id, statement, category, total_votes, blue_pct, updated_at')
        .eq('status', 'law')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Topics currently in voting phase
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at')
        .eq('status', 'voting')
        .order('total_votes', { ascending: false })
        .limit(3),
    ])

    // Active debaters: distinct users who argued today
    const { data: argUsers } = await supabase
      .from('topic_arguments')
      .select('user_id')
      .gte('created_at', todayStart)
      .limit(5000)

    const activeDebaters = new Set(argUsers?.map((r) => r.user_id) ?? []).size

    // Argument count for top topic
    let topicArgumentCount = 0
    if (topTopicRes.data?.id) {
      const { count } = await supabase
        .from('topic_arguments')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', topTopicRes.data.id)
      topicArgumentCount = count ?? 0
    }

    // Shape top argument
    let topArgument: TodayTopArgument | null = null
    if (topArgumentRes.data) {
      const raw = topArgumentRes.data as Record<string, unknown>
      const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles
      const topic = Array.isArray(raw.topics) ? raw.topics[0] : raw.topics
      topArgument = {
        id: raw.id as string,
        topic_id: raw.topic_id as string,
        side: raw.side as 'blue' | 'red',
        content: raw.content as string,
        upvotes: raw.upvotes as number,
        created_at: raw.created_at as string,
        author: profile
          ? {
              id: (profile as Record<string, string>).id,
              username: (profile as Record<string, string>).username,
              display_name: (profile as Record<string, string | null>).display_name,
              avatar_url: (profile as Record<string, string | null>).avatar_url,
              role: (profile as Record<string, string>).role,
            }
          : null,
        topic: topic
          ? {
              id: (topic as Record<string, string>).id,
              statement: (topic as Record<string, string>).statement,
              category: (topic as Record<string, string | null>).category,
              status: (topic as Record<string, string>).status,
            }
          : { id: raw.topic_id as string, statement: 'Unknown', category: null, status: 'active' },
      }
    }

    const payload: TodayResponse = {
      date: new Date().toISOString(),
      stats: {
        votes_cast: votesRes.count ?? 0,
        arguments_made: argumentsRes.count ?? 0,
        new_topics: topicsRes.count ?? 0,
        laws_passed: lawsRes.count ?? 0,
        active_debaters: activeDebaters,
      },
      topTopic: topTopicRes.data
        ? { ...topTopicRes.data, argument_count: topicArgumentCount }
        : null,
      topArgument,
      recentLaw: recentLawRes.data ?? null,
      votingNow: votingNowRes.data ?? [],
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[/api/today]', err)
    return NextResponse.json({ error: 'Failed to load today data' }, { status: 500 })
  }
}
