import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollabDebate {
  id: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  debate_type: string
  status: string
  scheduled_at: string | null
  participant_count: number
  max_participants: number | null
  open_spots: number | null
}

export interface CollabTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  argument_count: number
  votes_per_arg: number
}

export interface CollabCoalition {
  id: string
  name: string
  description: string | null
  member_count: number
  max_members: number
  open_spots: number
  coalition_influence: number
  creator_username: string
  creator_avatar: string | null
}

export interface CollabRelay {
  id: string
  topic_id: string | null
  topic_statement: string | null
  side: 'for' | 'against'
  status: 'open' | 'in_progress'
  leg_count: number
  max_legs: number
  slots_remaining: number
  starter_username: string
  starter_avatar: string | null
  created_at: string
}

export interface CollabWikiTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  has_description: boolean
  word_count: number
}

export interface CollaborateResponse {
  debates: CollabDebate[]
  topics_needing_args: CollabTopic[]
  coalitions: CollabCoalition[]
  relays: CollabRelay[]
  wiki_topics: CollabWikiTopic[]
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const [debatesRes, topicsRes, coalitionsRes, relaysRes, wikiRes] =
    await Promise.all([
      // Open/scheduled debates
      supabase
        .from('debates')
        .select('id, topic_id, debate_type, status, scheduled_at, max_participants')
        .in('status', ['scheduled', 'live'])
        .order('scheduled_at', { ascending: true })
        .limit(8),

      // Active topics with many votes but few arguments
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, argument_count')
        .eq('status', 'active')
        .gt('total_votes', 10)
        .order('total_votes', { ascending: false })
        .limit(50),

      // Recruiting coalitions
      supabase
        .from('coalitions')
        .select('id, name, description, member_count, max_members, coalition_influence, creator_id')
        .eq('is_public', true)
        .order('coalition_influence', { ascending: false })
        .limit(20),

      // Open relays needing legs
      supabase
        .from('civic_relays')
        .select('id, topic_id, side, status, max_legs, created_at, starter_id')
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(20),

      // Active topics with thin/no wiki
      supabase
        .from('topics')
        .select('id, statement, category, status, total_votes, description')
        .in('status', ['active', 'voting'])
        .gt('total_votes', 50)
        .order('total_votes', { ascending: false })
        .limit(30),
    ])

  // ── Enrich debates with topic data ──────────────────────────────────────────

  const debateTopicIds = (debatesRes.data ?? [])
    .map((d) => d.topic_id)
    .filter(Boolean) as string[]

  const debateParticipantCounts: Record<string, number> = {}
  if ((debatesRes.data ?? []).length > 0) {
    const debateIds = (debatesRes.data ?? []).map((d) => d.id)
    const { data: partRows } = await supabase
      .from('debate_participants')
      .select('debate_id')
      .in('debate_id', debateIds)
    for (const p of partRows ?? []) {
      const key = (p as { debate_id: string }).debate_id
      debateParticipantCounts[key] = (debateParticipantCounts[key] ?? 0) + 1
    }
  }

  let debateTopicMap: Record<string, { statement: string; category: string | null }> = {}
  if (debateTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', debateTopicIds)
    for (const t of topicRows ?? []) {
      debateTopicMap[t.id] = { statement: t.statement, category: t.category ?? null }
    }
  }

  const debates: CollabDebate[] = (debatesRes.data ?? []).map((d) => {
    const topicInfo = d.topic_id ? debateTopicMap[d.topic_id] : null
    const participants = debateParticipantCounts[d.id] ?? 0
    const maxP = d.max_participants ?? null
    return {
      id: d.id,
      topic_id: d.topic_id ?? null,
      topic_statement: topicInfo?.statement ?? null,
      topic_category: topicInfo?.category ?? null,
      debate_type: d.debate_type,
      status: d.status,
      scheduled_at: d.scheduled_at ?? null,
      participant_count: participants,
      max_participants: maxP,
      open_spots: maxP != null ? Math.max(0, maxP - participants) : null,
    }
  })

  // ── Topics needing arguments — lowest arg density among high-vote topics ────

  const allTopics = topicsRes.data ?? []
  const topicsNeedingArgs: CollabTopic[] = allTopics
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      argument_count: (t as { argument_count?: number }).argument_count ?? 0,
      votes_per_arg:
        ((t as { argument_count?: number }).argument_count ?? 0) === 0
          ? (t.total_votes ?? 0)
          : Math.round((t.total_votes ?? 0) / Math.max(1, (t as { argument_count?: number }).argument_count ?? 0)),
    }))
    .sort((a, b) => b.votes_per_arg - a.votes_per_arg) // highest vote:arg ratio first
    .slice(0, 8)

  // ── Coalitions with open spots ─────────────────────────────────────────────

  const allCoalitions = coalitionsRes.data ?? []
  const creatorIds = Array.from(new Set(allCoalitions.map((c) => c.creator_id)))
  let creatorMap: Record<string, { username: string; avatar_url: string | null }> = {}
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', creatorIds)
    for (const p of creators ?? []) {
      creatorMap[p.id] = {
        username: p.username,
        avatar_url: p.avatar_url ?? null,
      }
    }
  }

  const coalitions: CollabCoalition[] = allCoalitions
    .filter((c) => c.member_count < (c.max_members ?? Infinity))
    .slice(0, 6)
    .map((c) => {
      const creator = creatorMap[c.creator_id]
      return {
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        member_count: c.member_count,
        max_members: c.max_members ?? 50,
        open_spots: (c.max_members ?? 50) - c.member_count,
        coalition_influence: c.coalition_influence ?? 0,
        creator_username: creator?.username ?? 'unknown',
        creator_avatar: creator?.avatar_url ?? null,
      }
    })

  // ── Relays needing participants ────────────────────────────────────────────

  const allRelays = relaysRes.data ?? []
  const relayTopicIds = allRelays
    .map((r) => r.topic_id)
    .filter(Boolean) as string[]
  const relayStarterIds = allRelays.map((r) => r.starter_id)

  let relayTopicMap: Record<string, string> = {}
  let relayStarterMap: Record<string, { username: string; avatar_url: string | null }> = {}

  const [relayTopicRes, relayStarterRes] = await Promise.all([
    relayTopicIds.length > 0
      ? supabase
          .from('topics')
          .select('id, statement')
          .in('id', relayTopicIds)
      : Promise.resolve({ data: [] }),

    relayStarterIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', relayStarterIds)
      : Promise.resolve({ data: [] }),
  ])

  for (const t of relayTopicRes.data ?? []) {
    relayTopicMap[t.id] = t.statement
  }
  for (const p of relayStarterRes.data ?? []) {
    relayStarterMap[p.id] = {
      username: p.username,
      avatar_url: p.avatar_url ?? null,
    }
  }

  // Count existing legs per relay
  const relayIds = allRelays.map((r) => r.id)
  let legCountMap: Record<string, number> = {}
  if (relayIds.length > 0) {
    const { data: legRows } = await supabase
      .from('relay_legs')
      .select('relay_id')
      .in('relay_id', relayIds)
    for (const l of legRows ?? []) {
      const key = (l as { relay_id: string }).relay_id
      legCountMap[key] = (legCountMap[key] ?? 0) + 1
    }
  }

  const relays: CollabRelay[] = allRelays
    .filter((r) => {
      const legs = legCountMap[r.id] ?? 0
      return legs < (r.max_legs ?? 5)
    })
    .slice(0, 6)
    .map((r) => {
      const legs = legCountMap[r.id] ?? 0
      const starter = relayStarterMap[r.starter_id]
      return {
        id: r.id,
        topic_id: r.topic_id ?? null,
        topic_statement: r.topic_id ? (relayTopicMap[r.topic_id] ?? null) : null,
        side: r.side as 'for' | 'against',
        status: r.status as 'open' | 'in_progress',
        leg_count: legs,
        max_legs: r.max_legs ?? 5,
        slots_remaining: (r.max_legs ?? 5) - legs,
        starter_username: starter?.username ?? 'unknown',
        starter_avatar: starter?.avatar_url ?? null,
        created_at: r.created_at,
      }
    })

  // ── Wiki topics — thin or no description ──────────────────────────────────

  const wikiTopics: CollabWikiTopic[] = (wikiRes.data ?? [])
    .map((t) => {
      const desc: string = (t.description as string | null) ?? ''
      const wordCount = desc.trim() === '' ? 0 : desc.trim().split(/\s+/).length
      return {
        id: t.id,
        statement: t.statement,
        category: t.category ?? null,
        status: t.status,
        total_votes: t.total_votes ?? 0,
        has_description: wordCount > 0,
        word_count: wordCount,
      }
    })
    .filter((t) => t.word_count < 100) // thin wiki (under 100 words)
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 8)

  const payload: CollaborateResponse = {
    debates,
    topics_needing_args: topicsNeedingArgs,
    coalitions,
    relays,
    wiki_topics: wikiTopics,
  }

  return NextResponse.json(payload)
}
