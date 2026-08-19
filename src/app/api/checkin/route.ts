import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckinTopicArg {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface CheckinTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  argument_count: number
  top_for: CheckinTopicArg | null
  top_against: CheckinTopicArg | null
}

export interface CheckinUser {
  id: string
  vote_streak: number
  todays_vote: 'blue' | 'red' | null
  // Recent 14 days of voting activity (YYYY-MM-DD → count)
  recent_activity: Record<string, number>
}

export interface CheckinResponse {
  topic: CheckinTopic
  user: CheckinUser | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // ── Featured topic: pick the most active topic from today
    // We prioritise topics with high feed_score that are active or voting
    const { data: topicRow } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, argument_count, feed_score')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!topicRow) {
      // Fallback: any non-failed topic
      const { data: fallback } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, argument_count')
        .not('status', 'in', '("failed","archived")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!fallback) {
        return NextResponse.json({ error: 'No topics available' }, { status: 404 })
      }
    }

    const topic = topicRow as {
      id: string; statement: string; category: string | null; status: string
      blue_pct: number; total_votes: number; argument_count: number
    }

    // ── Top FOR argument for this topic
    const { data: forArgRows } = await supabase
      .from('topic_arguments')
      .select(`
        id, content, side, upvotes,
        author:profiles!topic_arguments_author_id_fkey(username, display_name, avatar_url)
      `)
      .eq('topic_id', topic.id)
      .eq('side', 'blue')
      .order('upvotes', { ascending: false })
      .limit(1)

    const { data: againstArgRows } = await supabase
      .from('topic_arguments')
      .select(`
        id, content, side, upvotes,
        author:profiles!topic_arguments_author_id_fkey(username, display_name, avatar_url)
      `)
      .eq('topic_id', topic.id)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .limit(1)

    function parseArg(row: Record<string, unknown> | undefined): CheckinTopicArg | null {
      if (!row) return null
      const author = row.author as Record<string, unknown> | null
      return {
        id: row.id as string,
        content: row.content as string,
        side: row.side as 'blue' | 'red',
        upvotes: (row.upvotes as number) ?? 0,
        author_username: (author?.username as string) ?? null,
        author_display_name: (author?.display_name as string) ?? null,
        author_avatar_url: (author?.avatar_url as string) ?? null,
      }
    }

    const checkinTopic: CheckinTopic = {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      argument_count: topic.argument_count ?? 0,
      top_for: parseArg((forArgRows ?? [])[0] as Record<string, unknown> | undefined),
      top_against: parseArg((againstArgRows ?? [])[0] as Record<string, unknown> | undefined),
    }

    // ── Auth user data (optional — works for guests too)
    const { data: { user } } = await supabase.auth.getUser()

    let checkinUser: CheckinUser | null = null

    if (user) {
      // Streak and profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, vote_streak')
        .eq('id', user.id)
        .maybeSingle()

      // Did the user already vote on today's topic?
      const { data: existingVote } = await supabase
        .from('topic_votes')
        .select('side')
        .eq('topic_id', topic.id)
        .eq('user_id', user.id)
        .maybeSingle()

      // Recent 14-day vote activity
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13)

      const { data: activityRows } = await supabase
        .from('topic_votes')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', twoWeeksAgo.toISOString())

      const activity: Record<string, number> = {}
      for (const row of activityRows ?? []) {
        const day = (row.created_at as string).slice(0, 10)
        activity[day] = (activity[day] ?? 0) + 1
      }

      checkinUser = {
        id: user.id,
        vote_streak: (profile as { vote_streak: number } | null)?.vote_streak ?? 0,
        todays_vote: (existingVote as { side: 'blue' | 'red' } | null)?.side ?? null,
        recent_activity: activity,
      }
    }

    return NextResponse.json({ topic: checkinTopic, user: checkinUser } satisfies CheckinResponse)
  } catch (err) {
    console.error('[checkin] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
