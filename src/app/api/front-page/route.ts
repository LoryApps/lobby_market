import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FrontPageTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  argument_count: number
  view_count: number | null
}

export interface FrontPageArgument {
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

export interface FrontPageLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string | null
}

export interface FrontPageDebate {
  id: string
  title: string
  topic_id: string | null
  status: string
  starts_at: string
  participant_count: number
}

export interface FrontPageStats {
  votes_today: number
  arguments_today: number
  laws_all_time: number
  active_topics: number
}

export interface FrontPageResponse {
  date: string
  edition: number
  heroTopic: FrontPageTopic | null
  headlineArgument: FrontPageArgument | null
  latestLaw: FrontPageLaw | null
  upcomingDebate: FrontPageDebate | null
  stats: FrontPageStats
  secondaryTopics: FrontPageTopic[]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()

    // Hero topic — highest-scoring active/voting topic
    const { data: heroTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(1)

    const heroTopicRaw = heroTopics?.[0] ?? null

    // Get argument count for hero topic
    let heroTopic: FrontPageTopic | null = null
    if (heroTopicRaw) {
      const { count } = await supabase
        .from('arguments')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', heroTopicRaw.id)

      heroTopic = {
        ...heroTopicRaw,
        argument_count: count ?? 0,
      }
    }

    // Secondary topics — next 4 highest-scoring
    const { data: secondaryRaw } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count')
      .in('status', ['active', 'voting', 'proposed'])
      .neq('id', heroTopicRaw?.id ?? '')
      .order('feed_score', { ascending: false })
      .limit(4)

    const secondaryTopics: FrontPageTopic[] = (secondaryRaw ?? []).map((t) => ({
      ...t,
      argument_count: 0,
    }))

    // Headline argument — most upvoted argument from the last 24h
    const { data: argRaw } = await supabase
      .from('arguments')
      .select(`
        id, topic_id, side, content, upvotes, created_at,
        author:profiles!arguments_author_id_fkey(id, username, display_name, avatar_url, role),
        topic:topics!arguments_topic_id_fkey(id, statement, category, status)
      `)
      .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .order('upvotes', { ascending: false })
      .limit(1)

    const headlineArgument: FrontPageArgument | null = argRaw?.[0]
      ? {
          id: argRaw[0].id,
          topic_id: argRaw[0].topic_id,
          side: argRaw[0].side as 'blue' | 'red',
          content: argRaw[0].content,
          upvotes: argRaw[0].upvotes,
          created_at: argRaw[0].created_at,
          author: Array.isArray(argRaw[0].author) ? argRaw[0].author[0] ?? null : (argRaw[0].author as FrontPageArgument['author']),
          topic: Array.isArray(argRaw[0].topic) ? argRaw[0].topic[0] ?? null : (argRaw[0].topic as FrontPageArgument['topic']),
        }
      : null

    // Latest law established
    const { data: lawRaw } = await supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, updated_at')
      .eq('status', 'law')
      .order('updated_at', { ascending: false })
      .limit(1)

    const latestLaw: FrontPageLaw | null = lawRaw?.[0]
      ? {
          id: lawRaw[0].id,
          statement: lawRaw[0].statement,
          category: lawRaw[0].category,
          total_votes: lawRaw[0].total_votes,
          blue_pct: lawRaw[0].blue_pct,
          established_at: lawRaw[0].updated_at,
        }
      : null

    // Upcoming debate
    const { data: debateRaw } = await supabase
      .from('debates')
      .select('id, title, topic_id, status, starts_at')
      .in('status', ['scheduled', 'live'])
      .gte('starts_at', now.toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)

    let upcomingDebate: FrontPageDebate | null = null
    if (debateRaw?.[0]) {
      const { count } = await supabase
        .from('debate_participants')
        .select('id', { count: 'exact', head: true })
        .eq('debate_id', debateRaw[0].id)

      upcomingDebate = {
        id: debateRaw[0].id,
        title: debateRaw[0].title,
        topic_id: debateRaw[0].topic_id,
        status: debateRaw[0].status,
        starts_at: debateRaw[0].starts_at,
        participant_count: count ?? 0,
      }
    }

    // Stats
    const [votesTodayResult, argsTodayResult, lawsResult, activeResult] = await Promise.all([
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayISO),
      supabase
        .from('arguments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayISO),
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'law'),
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'voting']),
    ])

    const stats: FrontPageStats = {
      votes_today: votesTodayResult.count ?? 0,
      arguments_today: argsTodayResult.count ?? 0,
      laws_all_time: lawsResult.count ?? 0,
      active_topics: activeResult.count ?? 0,
    }

    // Edition number: days since platform launch (2024-01-01)
    const launch = new Date('2024-01-01T00:00:00Z')
    const edition = Math.floor((now.getTime() - launch.getTime()) / (24 * 60 * 60 * 1000)) + 1

    const response: FrontPageResponse = {
      date: now.toISOString(),
      edition,
      heroTopic,
      headlineArgument,
      latestLaw,
      upcomingDebate,
      stats,
      secondaryTopics,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[front-page]', err)
    return NextResponse.json({ error: 'Failed to load front page' }, { status: 500 })
  }
}
