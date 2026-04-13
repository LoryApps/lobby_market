import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TopicArgument, Profile } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PulseArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'> | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
}

export interface ActiveDebateTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  argument_count: number
  top_for_snippet: string | null
  top_against_snippet: string | null
}

export interface PulseResponse {
  topFor: PulseArgument[]
  topAgainst: PulseArgument[]
  mostDebated: ActiveDebateTopic[]
  totalArguments: number
  lastUpdated: string
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // ── Step 1: fetch top-upvoted arguments from active/voting topics ─────────

    // Get active topic IDs first (topics with ongoing votes)
    const { data: activeTopics, error: topicsErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(100)

    if (topicsErr) throw topicsErr

    const topicIds = (activeTopics ?? []).map((t) => t.id)

    if (topicIds.length === 0) {
      return NextResponse.json({
        topFor: [],
        topAgainst: [],
        mostDebated: [],
        totalArguments: 0,
        lastUpdated: new Date().toISOString(),
      } satisfies PulseResponse)
    }

    const topicMap = new Map(
      (activeTopics ?? []).map((t) => [t.id, t])
    )

    // ── Step 2: fetch top FOR arguments ──────────────────────────────────────

    const [forRes, againstRes, countRes] = await Promise.all([
      supabase
        .from('topic_arguments')
        .select('*')
        .eq('side', 'blue')
        .in('topic_id', topicIds)
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('topic_arguments')
        .select('*')
        .eq('side', 'red')
        .in('topic_id', topicIds)
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('topic_arguments')
        .select('topic_id, id', { count: 'exact', head: false })
        .in('topic_id', topicIds)
        .limit(1000),
    ])

    const rawFor = (forRes.data ?? []) as TopicArgument[]
    const rawAgainst = (againstRes.data ?? []) as TopicArgument[]
    const allArgs = (countRes.data ?? []) as Pick<TopicArgument, 'topic_id' | 'id'>[]

    // ── Step 3: batch-load authors ────────────────────────────────────────────

    const allRaw = [...rawFor, ...rawAgainst]
    const userIds = Array.from(new Set(allRaw.map((a) => a.user_id)))

    const { data: profiles } = userIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', userIds)
      : { data: [] as Profile[] }

    const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()
    for (const p of profiles ?? []) profileMap.set(p.id, p)

    const enrich = (args: TopicArgument[]): PulseArgument[] =>
      args
        .filter((a) => topicMap.has(a.topic_id))
        .map((a) => ({
          id: a.id,
          topic_id: a.topic_id,
          side: a.side,
          content: a.content,
          upvotes: a.upvotes,
          created_at: a.created_at,
          author: profileMap.get(a.user_id) ?? null,
          topic: topicMap.get(a.topic_id)!,
        }))

    // ── Step 4: compute most-debated topics ───────────────────────────────────

    // Count arguments per topic
    const argCountByTopic = new Map<string, number>()
    for (const row of allArgs) {
      argCountByTopic.set(row.topic_id, (argCountByTopic.get(row.topic_id) ?? 0) + 1)
    }

    // Also get per-topic top FOR + AGAINST snippets from what we fetched
    const topForByTopic = new Map<string, string>()
    const topAgainstByTopic = new Map<string, string>()
    for (const a of rawFor) {
      if (!topForByTopic.has(a.topic_id)) topForByTopic.set(a.topic_id, a.content)
    }
    for (const a of rawAgainst) {
      if (!topAgainstByTopic.has(a.topic_id)) topAgainstByTopic.set(a.topic_id, a.content)
    }

    const mostDebated: ActiveDebateTopic[] = Array.from(argCountByTopic.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([topicId, count]) => {
        const t = topicMap.get(topicId)!
        return {
          id: topicId,
          statement: t.statement,
          category: t.category,
          status: t.status,
          blue_pct: t.blue_pct,
          total_votes: t.total_votes,
          argument_count: count,
          top_for_snippet: topForByTopic.get(topicId) ?? null,
          top_against_snippet: topAgainstByTopic.get(topicId) ?? null,
        }
      })

    return NextResponse.json({
      topFor: enrich(rawFor),
      topAgainst: enrich(rawAgainst),
      mostDebated,
      totalArguments: countRes.count ?? allArgs.length,
      lastUpdated: new Date().toISOString(),
    } satisfies PulseResponse)
  } catch (err) {
    console.error('[pulse] error:', err)
    return NextResponse.json({ error: 'Failed to load pulse' }, { status: 500 })
  }
}
