import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PositionLeg {
  id: string
  leg_number: number
  content: string
  upvote_count: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface PositionPaper {
  relay_id: string
  side: 'for' | 'against'
  status: string
  max_legs: number
  leg_count: number
  vote_compelling: number
  vote_not_compelling: number
  compelling_pct: number
  completed_at: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
  topic_blue_pct: number | null
  topic_total_votes: number | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  legs: PositionLeg[]
  opposing_relay_id: string | null
  opposing_compelling_pct: number | null
}

export interface PositionPapersResponse {
  papers: PositionPaper[]
  total: number
  has_more: boolean
}

// ─── GET /api/position-papers ─────────────────────────────────────────────────
// Returns relay chains that have been voted "compelling" — ordered by
// compelling vote percentage and absolute compelling vote count.

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const category = searchParams.get('category') ?? ''
    const side = searchParams.get('side') ?? ''
    const sort = searchParams.get('sort') ?? 'compelling'  // compelling | recent | decisive
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '12'), 30)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    // ── Fetch voted relay chains with compelling majority ──────────────────
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
      .eq('status', 'voted')
      .not('completed_at', 'is', null)
      // Only chains with compelling majority
      .filter('vote_compelling', 'gt', 0)

    if (side === 'for' || side === 'against') {
      query = query.eq('side', side)
    }

    // Sort
    if (sort === 'recent') {
      query = query.order('completed_at', { ascending: false })
    } else if (sort === 'decisive') {
      query = query.order('vote_compelling', { ascending: false })
    } else {
      // Default: sort by compelling percentage, then by total votes
      query = query.order('vote_compelling', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: relays, count, error } = await query

    if (error) {
      console.error('[position-papers] relay fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch position papers' }, { status: 500 })
    }

    if (!relays || relays.length === 0) {
      return NextResponse.json({ papers: [], total: 0, has_more: false } satisfies PositionPapersResponse)
    }

    const relayIds = relays.map((r) => r.id)
    const topicIds = relays.flatMap((r) => r.topic_id ? [r.topic_id] : [])

    // ── Fetch topics ───────────────────────────────────────────────────────
    const topicMap = new Map<string, {
      statement: string; category: string | null; status: string;
      blue_pct: number | null; total_votes: number | null
    }>()
    if (topicIds.length > 0) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('id', topicIds)
      for (const t of topics ?? []) {
        topicMap.set(t.id, {
          statement: t.statement,
          category: (t as { category?: string | null }).category ?? null,
          status: t.status,
          blue_pct: (t as { blue_pct?: number | null }).blue_pct ?? null,
          total_votes: (t as { total_votes?: number | null }).total_votes ?? null,
        })
      }
    }

    // ── Category filter (post-join) ────────────────────────────────────────
    const filteredRelays = category
      ? relays.filter((r) => {
          const topic = r.topic_id ? topicMap.get(r.topic_id) : null
          return topic?.category === category
        })
      : relays

    // ── Fetch legs for all relays ──────────────────────────────────────────
    const { data: allLegs } = await supabase
      .from('relay_legs')
      .select(`
        id, relay_id, leg_number, content, upvote_count, created_at,
        author:profiles!relay_legs_author_id_fkey (
          username, display_name, avatar_url, role
        )
      `)
      .in('relay_id', relayIds)
      .order('leg_number', { ascending: true })

    const legsByRelay = new Map<string, PositionLeg[]>()
    for (const leg of allLegs ?? []) {
      const arr = legsByRelay.get(leg.relay_id) ?? []
      const author = (leg as { author?: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null }).author
      arr.push({
        id: leg.id,
        leg_number: leg.leg_number,
        content: leg.content,
        upvote_count: (leg as { upvote_count?: number }).upvote_count ?? 0,
        author_username: author?.username ?? 'anonymous',
        author_display_name: author?.display_name ?? null,
        author_avatar_url: author?.avatar_url ?? null,
        author_role: author?.role ?? 'person',
      })
      legsByRelay.set(leg.relay_id, arr)
    }

    // ── Find opposing relay chains ─────────────────────────────────────────
    const pairedTopicIds = filteredRelays.flatMap((r) => r.topic_id ? [r.topic_id] : [])
    const opposingMap = new Map<string, { id: string; compelling_pct: number | null }>()
    if (pairedTopicIds.length > 0) {
      const { data: opposingRelays } = await supabase
        .from('civic_relays')
        .select('id, side, topic_id, vote_compelling, vote_not_compelling')
        .in('topic_id', pairedTopicIds)
        .eq('status', 'voted')
      for (const opp of opposingRelays ?? []) {
        const matchingRelay = filteredRelays.find(
          (r) => r.topic_id === opp.topic_id && r.side !== opp.side
        )
        if (matchingRelay) {
          const total = (opp.vote_compelling ?? 0) + (opp.vote_not_compelling ?? 0)
          const pct = total > 0 ? Math.round(((opp.vote_compelling ?? 0) / total) * 100) : null
          opposingMap.set(matchingRelay.id, { id: opp.id, compelling_pct: pct })
        }
      }
    }

    // ── Build position papers ──────────────────────────────────────────────
    const papers: PositionPaper[] = filteredRelays
      .map((relay) => {
        const total = (relay.vote_compelling ?? 0) + (relay.vote_not_compelling ?? 0)
        if (total === 0 || (relay.vote_compelling ?? 0) <= (relay.vote_not_compelling ?? 0)) {
          return null
        }
        const compellingPct = Math.round(((relay.vote_compelling ?? 0) / total) * 100)
        const topic = relay.topic_id ? topicMap.get(relay.topic_id) : null
        const opposing = opposingMap.get(relay.id)
        const starter = (relay as { starter?: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null }).starter

        return {
          relay_id: relay.id,
          side: relay.side as 'for' | 'against',
          status: relay.status,
          max_legs: relay.max_legs,
          leg_count: (legsByRelay.get(relay.id) ?? []).length,
          vote_compelling: relay.vote_compelling ?? 0,
          vote_not_compelling: relay.vote_not_compelling ?? 0,
          compelling_pct: compellingPct,
          completed_at: relay.completed_at!,
          topic_id: relay.topic_id ?? null,
          topic_statement: topic?.statement ?? null,
          topic_category: topic?.category ?? null,
          topic_status: topic?.status ?? null,
          topic_blue_pct: topic?.blue_pct ?? null,
          topic_total_votes: topic?.total_votes ?? null,
          starter_username: starter?.username ?? 'anonymous',
          starter_display_name: starter?.display_name ?? null,
          starter_avatar_url: starter?.avatar_url ?? null,
          starter_role: starter?.role ?? 'person',
          legs: legsByRelay.get(relay.id) ?? [],
          opposing_relay_id: opposing?.id ?? null,
          opposing_compelling_pct: opposing?.compelling_pct ?? null,
        } satisfies PositionPaper
      })
      .filter((p): p is PositionPaper => p !== null)

    const total = count ?? 0
    const has_more = offset + limit < total

    return NextResponse.json({ papers, total, has_more } satisfies PositionPapersResponse)
  } catch (err) {
    console.error('[position-papers] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
