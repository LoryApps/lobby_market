import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerdictRelay {
  relay_id: string
  side: 'for' | 'against'
  status: string
  max_legs: number
  leg_count: number
  vote_compelling: number
  vote_not_compelling: number
  compelling_pct: number | null
  verdict: 'compelling' | 'not_compelling' | 'contested'
  completed_at: string | null
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  /** The best leg (most upvoted) from this chain */
  top_leg: {
    leg_number: number
    content: string
    upvote_count: number
    author_username: string
    author_display_name: string | null
  } | null
  /** The opposing relay chain on the same topic (if exists) */
  opposing_relay_id: string | null
  opposing_compelling_pct: number | null
}

export interface VerdictsResponse {
  verdicts: VerdictRelay[]
  total: number
  has_more: boolean
}

// ─── GET /api/relays/verdicts ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const filter = searchParams.get('filter') ?? 'all'   // all | compelling | not_compelling | contested
    const category = searchParams.get('category') ?? ''
    const side = searchParams.get('side') ?? ''           // for | against
    const sort = searchParams.get('sort') ?? 'recent'     // recent | decisive | contested
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    // ── Fetch completed/voted relay chains ─────────────────────────────────
    let query = supabase
      .from('civic_relays')
      .select(`
        id, side, status, max_legs,
        vote_compelling, vote_not_compelling,
        completed_at, topic_id,
        starter:profiles!civic_relays_starter_id_fkey (
          username, display_name, avatar_url, role
        )
      `, { count: 'exact' })
      .in('status', ['complete', 'voted'])
      .not('completed_at', 'is', null)

    if (side === 'for' || side === 'against') {
      query = query.eq('side', side)
    }

    // ── Sorting ────────────────────────────────────────────────────────────
    if (sort === 'decisive') {
      // Most decisive = highest absolute margin
      query = query.order('vote_compelling', { ascending: false })
    } else if (sort === 'contested') {
      // Most contested = chains with most total votes and ~50/50 split
      query = query
        .gte('vote_compelling', 1)
        .gte('vote_not_compelling', 1)
        .order('completed_at', { ascending: false })
    } else {
      query = query.order('completed_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: relaysRaw, error, count } = await query

    if (error) throw error

    const relays = relaysRaw ?? []

    if (relays.length === 0) {
      return NextResponse.json({ verdicts: [], total: 0, has_more: false } satisfies VerdictsResponse)
    }

    // ── Fetch topic statements for all relays ──────────────────────────────
    const topicIds = [...new Set(relays.map((r) => r.topic_id).filter(Boolean))] as string[]
    const relayIds = relays.map((r) => r.id)

    const [topicsResult, legsResult] = await Promise.all([
      topicIds.length > 0
        ? supabase
            .from('topics')
            .select('id, statement, category, status')
            .in('id', topicIds)
        : { data: [] },
      // Fetch leg counts + best legs
      supabase
        .from('relay_legs')
        .select('id, relay_id, leg_number, content, upvote_count, author_id')
        .in('relay_id', relayIds)
        .order('upvote_count', { ascending: false }),
    ])

    const topicMap = new Map(
      (topicsResult.data ?? []).map((t) => [t.id, t])
    )

    // Build per-relay maps: leg count + top leg
    type LegRow = { id: string; relay_id: string; leg_number: number; content: string; upvote_count: number; author_id: string }
    const legsByRelay = new Map<string, LegRow[]>()
    for (const leg of (legsResult.data ?? []) as LegRow[]) {
      if (!legsByRelay.has(leg.relay_id)) legsByRelay.set(leg.relay_id, [])
      legsByRelay.get(leg.relay_id)!.push(leg)
    }

    // Fetch author usernames for top legs
    const topLegAuthorIds = [...new Set(
      relayIds.map((id) => {
        const legs = legsByRelay.get(id) ?? []
        return legs[0]?.author_id
      }).filter(Boolean)
    )] as string[]

    const { data: authorsRaw } = topLegAuthorIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', topLegAuthorIds)
      : { data: [] }

    const authorMap = new Map(
      (authorsRaw ?? []).map((a) => [a.id, a])
    )

    // Fetch opposing relay for each (same topic, opposite side)
    const opposingPairs: Array<{ topic_id: string; side: string }> = relays
      .filter((r) => r.topic_id)
      .map((r) => ({ topic_id: r.topic_id as string, side: r.side === 'for' ? 'against' : 'for' }))

    const opposingTopicIds = [...new Set(opposingPairs.map((p) => p.topic_id))]
    const { data: opposingRelaysRaw } = opposingTopicIds.length > 0
      ? await supabase
          .from('civic_relays')
          .select('id, topic_id, side, vote_compelling, vote_not_compelling')
          .in('topic_id', opposingTopicIds)
          .in('status', ['complete', 'voted'])
      : { data: [] }

    // Map: topicId + side -> opposing relay
    const opposingMap = new Map<string, { id: string; vote_compelling: number; vote_not_compelling: number }>(
      (opposingRelaysRaw ?? []).map((r) => [
        `${r.topic_id}:${r.side}`,
        { id: r.id, vote_compelling: r.vote_compelling, vote_not_compelling: r.vote_not_compelling },
      ])
    )

    // ── Build response ─────────────────────────────────────────────────────
    const verdicts: VerdictRelay[] = []

    for (const relay of relays) {
      const topic = relay.topic_id ? topicMap.get(relay.topic_id) : null

      // Apply category filter (post-join)
      if (category && topic?.category !== category) continue

      const legs = legsByRelay.get(relay.id) ?? []
      const topLegRaw = legs[0] ?? null
      const topLegAuthor = topLegRaw ? authorMap.get(topLegRaw.author_id) : null

      const totalVotes = relay.vote_compelling + relay.vote_not_compelling
      const compelling_pct = totalVotes > 0
        ? Math.round((relay.vote_compelling / totalVotes) * 100)
        : null

      const verdict: 'compelling' | 'not_compelling' | 'contested' =
        compelling_pct === null ? 'contested'
        : compelling_pct >= 60 ? 'compelling'
        : compelling_pct <= 40 ? 'not_compelling'
        : 'contested'

      // Apply filter
      if (filter !== 'all' && verdict !== filter) continue

      // Find opposing relay
      const opposingSide = relay.side === 'for' ? 'against' : 'for'
      const opposingKey = `${relay.topic_id}:${opposingSide}`
      const opposing = relay.topic_id ? opposingMap.get(opposingKey) : null
      const oppTotal = opposing
        ? opposing.vote_compelling + opposing.vote_not_compelling
        : 0
      const opposing_compelling_pct = opposing && oppTotal > 0
        ? Math.round((opposing.vote_compelling / oppTotal) * 100)
        : null

      const starter = relay.starter as { username: string; display_name: string | null; avatar_url: string | null; role: string } | null

      verdicts.push({
        relay_id: relay.id,
        side: relay.side as 'for' | 'against',
        status: relay.status,
        max_legs: relay.max_legs,
        leg_count: legs.length,
        vote_compelling: relay.vote_compelling,
        vote_not_compelling: relay.vote_not_compelling,
        compelling_pct,
        verdict,
        completed_at: relay.completed_at,
        topic_id: relay.topic_id,
        topic_statement: topic?.statement ?? null,
        topic_category: topic?.category ?? null,
        topic_status: topic?.status ?? null,
        starter_username: starter?.username ?? 'unknown',
        starter_display_name: starter?.display_name ?? null,
        starter_avatar_url: starter?.avatar_url ?? null,
        starter_role: starter?.role ?? 'person',
        top_leg: topLegRaw
          ? {
              leg_number: topLegRaw.leg_number,
              content: topLegRaw.content,
              upvote_count: topLegRaw.upvote_count,
              author_username: topLegAuthor?.username ?? 'unknown',
              author_display_name: topLegAuthor?.display_name ?? null,
            }
          : null,
        opposing_relay_id: opposing?.id ?? null,
        opposing_compelling_pct,
      })
    }

    return NextResponse.json({
      verdicts,
      total: count ?? verdicts.length,
      has_more: (count ?? 0) > offset + limit,
    } satisfies VerdictsResponse)
  } catch (err) {
    console.error('[GET /api/relays/verdicts]', err)
    return NextResponse.json({ verdicts: [], total: 0, has_more: false }, { status: 200 })
  }
}
