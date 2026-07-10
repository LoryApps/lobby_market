import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodayRelayStats {
  legs_today: number
  contributors_today: number
  completions_today: number
  new_relays_today: number
  compelling_votes_today: number
}

export interface SpotlightRelay {
  relay_id: string
  side: 'for' | 'against'
  status: string
  max_legs: number
  leg_count: number
  vote_compelling: number
  vote_not_compelling: number
  completed_at: string | null
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  legs_today: number
}

export interface TopLegToday {
  leg_id: string
  relay_id: string
  leg_number: number
  content: string
  side: 'for' | 'against'
  upvote_count: number
  created_at: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  topic_statement: string | null
  topic_category: string | null
}

export interface TopContributorToday {
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  legs_contributed: number
  total_upvotes: number
}

export interface CategoryBreakdown {
  category: string
  legs_count: number
  relay_count: number
}

export interface TodayRelayResponse {
  stats: TodayRelayStats
  spotlight: SpotlightRelay | null
  top_legs: TopLegToday[]
  top_contributors: TopContributorToday[]
  category_breakdown: CategoryBreakdown[]
  as_of: string
}

// ─── GET /api/relays/today ────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayStartISO = todayStart.toISOString()
  const now = new Date().toISOString()

  // ── 1. Today's legs ────────────────────────────────────────────────────────

  const { data: todayLegs } = await supabase
    .from('relay_legs')
    .select('id, relay_id, author_id, leg_number, content, upvote_count, created_at')
    .gte('created_at', todayStartISO)
    .order('upvote_count', { ascending: false })

  const legRows = todayLegs ?? []

  // ── 2. Stats ───────────────────────────────────────────────────────────────

  const uniqueContributors = new Set(legRows.map((l) => l.author_id)).size
  const uniqueRelayIds = [...new Set(legRows.map((l) => l.relay_id))]

  const { count: completionsToday } = await supabase
    .from('civic_relays')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'complete')
    .gte('completed_at', todayStartISO)

  const { count: newRelaysToday } = await supabase
    .from('civic_relays')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStartISO)

  const { data: votesToday } = await supabase
    .from('relay_votes')
    .select('vote')
    .gte('created_at', todayStartISO)
    .eq('vote', 'compelling')

  const stats: TodayRelayStats = {
    legs_today: legRows.length,
    contributors_today: uniqueContributors,
    completions_today: completionsToday ?? 0,
    new_relays_today: newRelaysToday ?? 0,
    compelling_votes_today: votesToday?.length ?? 0,
  }

  // ── 3. Spotlight relay — most active today (most legs added today) ─────────

  let spotlight: SpotlightRelay | null = null

  if (uniqueRelayIds.length > 0) {
    // Count legs per relay today
    const legsByRelay = new Map<string, number>()
    for (const leg of legRows) {
      legsByRelay.set(leg.relay_id, (legsByRelay.get(leg.relay_id) ?? 0) + 1)
    }

    // Sort by activity today, pick most active
    const sortedRelayIds = [...legsByRelay.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)

    if (sortedRelayIds.length > 0) {
      const { data: relayRow } = await supabase
        .from('civic_relays')
        .select(`
          id, side, status, max_legs, vote_compelling, vote_not_compelling,
          completed_at, topic_id, created_at,
          starter:profiles!civic_relays_starter_id_fkey (
            id, username, display_name, avatar_url, role
          ),
          topic:topics ( id, statement, category, status )
        `)
        .in('id', sortedRelayIds.slice(0, 5))
        .order('vote_compelling', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (relayRow) {
        const starter = Array.isArray(relayRow.starter)
          ? relayRow.starter[0]
          : relayRow.starter
        const topic = Array.isArray(relayRow.topic)
          ? relayRow.topic[0]
          : relayRow.topic

        // Count legs in the relay (total)
        const { count: legCount } = await supabase
          .from('relay_legs')
          .select('*', { count: 'exact', head: true })
          .eq('relay_id', relayRow.id)

        spotlight = {
          relay_id: relayRow.id,
          side: relayRow.side as 'for' | 'against',
          status: relayRow.status,
          max_legs: relayRow.max_legs,
          leg_count: legCount ?? 0,
          vote_compelling: relayRow.vote_compelling,
          vote_not_compelling: relayRow.vote_not_compelling,
          completed_at: relayRow.completed_at ?? null,
          topic_id: topic?.id ?? null,
          topic_statement: topic?.statement ?? null,
          topic_category: (topic as { category?: string } | null)?.category ?? null,
          topic_status: (topic as { status?: string } | null)?.status ?? null,
          starter_username: starter?.username ?? 'unknown',
          starter_display_name: starter?.display_name ?? null,
          starter_avatar_url: starter?.avatar_url ?? null,
          starter_role: starter?.role ?? 'person',
          legs_today: legsByRelay.get(relayRow.id) ?? 0,
        }
      }
    }
  }

  // ── 4. Top legs of the day (by upvotes) ───────────────────────────────────

  const top_legs: TopLegToday[] = []

  if (legRows.length > 0) {
    const topLegIds = legRows.slice(0, 10).map((l) => l.id)

    const { data: legDetails } = await supabase
      .from('relay_legs')
      .select(`
        id, relay_id, leg_number, content, upvote_count, created_at,
        author:profiles!relay_legs_author_id_fkey (
          id, username, display_name, avatar_url, role
        ),
        relay:civic_relays (
          side, topic:topics ( statement, category )
        )
      `)
      .in('id', topLegIds)
      .order('upvote_count', { ascending: false })
      .limit(5)

    for (const leg of legDetails ?? []) {
      const author = Array.isArray(leg.author) ? leg.author[0] : leg.author
      const relay = Array.isArray(leg.relay) ? leg.relay[0] : leg.relay
      const topic = relay
        ? Array.isArray((relay as { topic?: unknown }).topic)
          ? ((relay as { topic: unknown[] }).topic as { statement?: string; category?: string }[])[0]
          : (relay as { topic?: { statement?: string; category?: string } | null }).topic
        : null

      top_legs.push({
        leg_id: leg.id,
        relay_id: leg.relay_id,
        leg_number: leg.leg_number,
        content: leg.content,
        side: ((relay as { side?: string } | null)?.side ?? 'for') as 'for' | 'against',
        upvote_count: leg.upvote_count,
        created_at: leg.created_at,
        author_username: author?.username ?? 'unknown',
        author_display_name: author?.display_name ?? null,
        author_avatar_url: author?.avatar_url ?? null,
        author_role: author?.role ?? 'person',
        topic_statement: topic?.statement ?? null,
        topic_category: topic?.category ?? null,
      })
    }
  }

  // ── 5. Top contributors today ──────────────────────────────────────────────

  const contributorMap = new Map<
    string,
    { legs: number; upvotes: number; meta: (typeof legRows)[0] }
  >()
  for (const leg of legRows) {
    const existing = contributorMap.get(leg.author_id)
    contributorMap.set(leg.author_id, {
      legs: (existing?.legs ?? 0) + 1,
      upvotes: (existing?.upvotes ?? 0) + leg.upvote_count,
      meta: leg,
    })
  }

  const top_contributor_ids = [...contributorMap.entries()]
    .sort((a, b) => b[1].legs - a[1].legs || b[1].upvotes - a[1].upvotes)
    .slice(0, 5)
    .map(([id]) => id)

  const top_contributors: TopContributorToday[] = []

  if (top_contributor_ids.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', top_contributor_ids)

    for (const id of top_contributor_ids) {
      const profile = profileRows?.find((p) => p.id === id)
      const entry = contributorMap.get(id)
      if (!profile || !entry) continue
      top_contributors.push({
        author_id: id,
        author_username: profile.username,
        author_display_name: profile.display_name,
        author_avatar_url: profile.avatar_url,
        author_role: profile.role,
        legs_contributed: entry.legs,
        total_upvotes: entry.upvotes,
      })
    }
  }

  // ── 6. Category breakdown ──────────────────────────────────────────────────

  const category_breakdown: CategoryBreakdown[] = []

  if (uniqueRelayIds.length > 0) {
    const { data: relayTopics } = await supabase
      .from('civic_relays')
      .select('id, topic:topics ( category )')
      .in('id', uniqueRelayIds)

    const catMap = new Map<string, { legs: number; relays: Set<string> }>()

    for (const r of relayTopics ?? []) {
      const topic = Array.isArray(r.topic) ? r.topic[0] : r.topic
      const cat = (topic as { category?: string | null } | null)?.category ?? 'Other'
      const entry = catMap.get(cat) ?? { legs: 0, relays: new Set<string>() }
      const legsForRelay = legRows.filter((l) => l.relay_id === r.id).length
      entry.legs += legsForRelay
      entry.relays.add(r.id)
      catMap.set(cat, entry)
    }

    for (const [cat, data] of catMap.entries()) {
      if (data.legs > 0) {
        category_breakdown.push({
          category: cat,
          legs_count: data.legs,
          relay_count: data.relays.size,
        })
      }
    }
    category_breakdown.sort((a, b) => b.legs_count - a.legs_count)
  }

  return NextResponse.json({
    stats,
    spotlight,
    top_legs,
    top_contributors,
    category_breakdown,
    as_of: now,
  } satisfies TodayRelayResponse)
}
