import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FutureDebate {
  id: string
  title: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  type: string
  status: string
  scheduled_at: string
  creator_username: string | null
  creator_display_name: string | null
  days_until: number
}

export interface FutureVotingTopic {
  id: string
  statement: string
  category: string | null
  status: 'voting'
  scope: string | null
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  days_until: number | null
  law_confidence: number | null  // from topic_prediction_stats
  total_predictions: number | null
}

export interface FutureActiveTopic {
  id: string
  statement: string
  category: string | null
  status: 'active'
  scope: string | null
  blue_pct: number
  total_votes: number
  updated_at: string
}

export interface RecentLaw {
  id: string
  statement: string
  category: string | null
  scope: string | null
  blue_pct: number
  total_votes: number
  updated_at: string
}

export interface FuturesStats {
  upcoming_debates: number
  topics_in_voting: number
  active_topics: number
  recent_laws: number
  closest_deadline_hours: number | null
}

export interface FuturesResponse {
  debates: FutureDebate[]
  voting_topics: FutureVotingTopic[]
  active_topics: FutureActiveTopic[]
  recent_laws: RecentLaw[]
  stats: FuturesStats
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // 1. Upcoming scheduled debates (next 30 days)
  const [debatesRes, votingTopicsRes, activeTopicsRes, lawsRes] = await Promise.all([
    supabase
      .from('debates')
      .select('id, title, topic_id, type, status, scheduled_at, creator_id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in30Days.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20),

    // Topics currently in voting phase (deadline approaching)
    supabase
      .from('topics')
      .select('id, statement, category, status, scope, blue_pct, total_votes, voting_ends_at, updated_at')
      .eq('status', 'voting')
      .order('voting_ends_at', { ascending: true, nullsFirst: false })
      .limit(20),

    // High-momentum active topics (approaching voting threshold)
    supabase
      .from('topics')
      .select('id, statement, category, status, scope, blue_pct, total_votes, updated_at')
      .eq('status', 'active')
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(12),

    // Recent laws (last 14 days) for context
    supabase
      .from('topics')
      .select('id, statement, category, scope, blue_pct, total_votes, updated_at')
      .eq('status', 'law')
      .gte('updated_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: false })
      .limit(8),
  ])

  const rawDebates = debatesRes.data ?? []
  const rawVotingTopics = votingTopicsRes.data ?? []
  const rawActiveTopics = activeTopicsRes.data ?? []
  const rawLaws = lawsRes.data ?? []

  // Enrich debates with topic and creator info
  const topicIds = Array.from(new Set(rawDebates.map((d) => d.topic_id)))
  const creatorIds = Array.from(new Set(rawDebates.map((d) => d.creator_id)))

  const [topicsForDebates, creatorsRes, predStatsRes] = await Promise.all([
    topicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', topicIds)
      : Promise.resolve({ data: [] as { id: string; statement: string; category: string | null }[] }),

    creatorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', creatorIds)
      : Promise.resolve({ data: [] as { id: string; username: string; display_name: string | null }[] }),

    // Prediction stats for voting topics
    rawVotingTopics.length
      ? supabase
          .from('topic_prediction_stats')
          .select('topic_id, law_confidence, total_predictions')
          .in('topic_id', rawVotingTopics.map((t) => t.id))
      : Promise.resolve({ data: [] as { topic_id: string; law_confidence: number; total_predictions: number }[] }),
  ])

  const topicMap = new Map((topicsForDebates.data ?? []).map((t) => [t.id, t]))
  const creatorMap = new Map((creatorsRes.data ?? []).map((c) => [c.id, c]))
  const predStatsMap = new Map((predStatsRes.data ?? []).map((s) => [s.topic_id, s]))

  // Build debates
  const debates: FutureDebate[] = rawDebates.map((d) => {
    const topic = topicMap.get(d.topic_id)
    const creator = creatorMap.get(d.creator_id)
    const scheduledMs = new Date(d.scheduled_at).getTime()
    const daysUntil = Math.round((scheduledMs - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      id: d.id,
      title: d.title,
      topic_id: d.topic_id,
      topic_statement: topic?.statement ?? 'Unknown topic',
      topic_category: topic?.category ?? null,
      type: d.type,
      status: d.status,
      scheduled_at: d.scheduled_at,
      creator_username: creator?.username ?? null,
      creator_display_name: creator?.display_name ?? null,
      days_until: daysUntil,
    }
  })

  // Build voting topics with prediction stats
  const votingTopics: FutureVotingTopic[] = rawVotingTopics.map((t) => {
    const stats = predStatsMap.get(t.id)
    let daysUntil: number | null = null
    if (t.voting_ends_at) {
      const ms = new Date(t.voting_ends_at).getTime() - now.getTime()
      daysUntil = Math.round(ms / (1000 * 60 * 60 * 24))
    }
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: 'voting' as const,
      scope: t.scope ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      voting_ends_at: t.voting_ends_at ?? null,
      days_until: daysUntil,
      law_confidence: stats?.law_confidence ?? null,
      total_predictions: stats?.total_predictions ?? null,
    }
  })

  // Build active topics
  const activeTopics: FutureActiveTopic[] = rawActiveTopics.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    status: 'active' as const,
    scope: t.scope ?? null,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    updated_at: t.updated_at,
  }))

  // Build recent laws
  const recentLaws: RecentLaw[] = rawLaws.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    scope: t.scope ?? null,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    updated_at: t.updated_at,
  }))

  // Calculate closest deadline
  let closestDeadlineHours: number | null = null
  for (const t of votingTopics) {
    if (t.voting_ends_at) {
      const hours = (new Date(t.voting_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hours > 0 && (closestDeadlineHours === null || hours < closestDeadlineHours)) {
        closestDeadlineHours = Math.round(hours)
      }
    }
  }

  const stats: FuturesStats = {
    upcoming_debates: debates.length,
    topics_in_voting: votingTopics.length,
    active_topics: activeTopics.length,
    recent_laws: recentLaws.length,
    closest_deadline_hours: closestDeadlineHours,
  }

  return NextResponse.json({
    debates,
    voting_topics: votingTopics,
    active_topics: activeTopics,
    recent_laws: recentLaws,
    stats,
    generated_at: now.toISOString(),
  } satisfies FuturesResponse)
}
