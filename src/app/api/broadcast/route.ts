import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BroadcastArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface BroadcastTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
}

export interface BroadcastStats {
  live_debates: number
  active_topics: number
  votes_last_hour: number
  arguments_last_hour: number
}

export interface BroadcastResponse {
  topic: BroadcastTopic | null
  arguments: BroadcastArgument[]
  stats: BroadcastStats
  refreshed_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Fetch in parallel: hottest topic, recent args for it, platform stats
    const [topicRes, liveDebatesRes, activeTopicsRes, recentVotesRes, recentArgsRes] =
      await Promise.all([
        // Most active topic: active or voting, ordered by feed_score
        supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes, feed_score')
          .in('status', ['active', 'voting'])
          .order('feed_score', { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Live debate count
        supabase
          .from('debates')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'live'),

        // Active topic count
        supabase
          .from('topics')
          .select('id', { count: 'exact', head: true })
          .in('status', ['active', 'voting']),

        // Votes in last hour
        supabase
          .from('votes')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', oneHourAgo),

        // Arguments in last hour (count only — we'll fetch specific ones after)
        supabase
          .from('topic_arguments')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', oneHourAgo),
      ])

    const topic = topicRes.data as BroadcastTopic | null

    // Fetch arguments for the hottest topic
    let args: BroadcastArgument[] = []
    if (topic) {
      const argsRes = await supabase
        .from('topic_arguments')
        .select(
          'id, side, content, upvotes, ai_score, ai_grade, created_at, user_id'
        )
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (argsRes.data && argsRes.data.length > 0) {
        const userIds = Array.from(new Set(argsRes.data.map((a) => a.user_id)))
        const profilesRes = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', userIds)

        const profileMap = new Map(
          (profilesRes.data ?? []).map((p) => [p.id, p])
        )

        args = argsRes.data.map((a) => ({
          id: a.id,
          side: a.side as 'blue' | 'red',
          content: a.content,
          upvotes: a.upvotes,
          ai_score: a.ai_score,
          ai_grade: a.ai_grade,
          created_at: a.created_at,
          author: profileMap.get(a.user_id) ?? null,
        }))
      }
    }

    const stats: BroadcastStats = {
      live_debates: liveDebatesRes.count ?? 0,
      active_topics: activeTopicsRes.count ?? 0,
      votes_last_hour: recentVotesRes.count ?? 0,
      arguments_last_hour: recentArgsRes.count ?? 0,
    }

    return NextResponse.json(
      {
        topic,
        arguments: args,
        stats,
        refreshed_at: new Date().toISOString(),
      } satisfies BroadcastResponse,
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (err) {
    console.error('[broadcast]', err)
    return NextResponse.json(
      { topic: null, arguments: [], stats: { live_debates: 0, active_topics: 0, votes_last_hour: 0, arguments_last_hour: 0 }, refreshed_at: new Date().toISOString() },
      { status: 500 }
    )
  }
}
