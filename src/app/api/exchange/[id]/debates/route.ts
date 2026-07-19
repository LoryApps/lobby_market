import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateParticipant {
  user_id: string
  side: 'for' | 'against'
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface MarketDebate {
  id: string
  title: string
  description: string | null
  type: 'quick' | 'grand' | 'tribunal'
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  blue_sway: number
  red_sway: number
  participants: DebateParticipant[]
  rsvp_count: number
  message_count: number
  // Winner poll data (for ended debates)
  winner_votes: { blue: number; red: number; tie: number }
  community_winner: 'blue' | 'red' | 'tie' | null
  // Price context (what was price before/after)
  price_before: number | null
  price_after: number | null
  price_delta: number | null
  // User's own RSVP status
  user_rsvped: boolean
}

export interface MarketDebatesResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
  }
  debates: MarketDebate[]
  total: number
  scheduled_count: number
  live_count: number
  ended_count: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // Current user (optional)
  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Topic ─────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── 2. Debates for this topic ─────────────────────────────────────────────
  const { data: rawDebates } = await supabase
    .from('debates')
    .select(`
      id, title, description, type, status,
      scheduled_at, started_at, ended_at,
      blue_sway, red_sway
    `)
    .eq('topic_id', id)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  if (!rawDebates || rawDebates.length === 0) {
    return NextResponse.json({
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        price: Math.round(topic.blue_pct ?? 50),
      },
      debates: [],
      total: 0,
      scheduled_count: 0,
      live_count: 0,
      ended_count: 0,
    } satisfies MarketDebatesResponse)
  }

  const debateIds = rawDebates.map((d) => d.id)

  // ── 3. Participants ───────────────────────────────────────────────────────
  const { data: rawParticipants } = await supabase
    .from('debate_participants')
    .select('debate_id, user_id, side, profiles(username, display_name, avatar_url)')
    .in('debate_id', debateIds)

  type ParticipantRow = {
    debate_id: string
    user_id: string
    side: string
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
  }

  const participantsByDebate = new Map<string, DebateParticipant[]>()
  for (const row of (rawParticipants ?? []) as unknown as ParticipantRow[]) {
    const list = participantsByDebate.get(row.debate_id) ?? []
    list.push({
      user_id: row.user_id,
      side: row.side as 'for' | 'against',
      username: row.profiles?.username ?? 'unknown',
      display_name: row.profiles?.display_name ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
    })
    participantsByDebate.set(row.debate_id, list)
  }

  // ── 4. RSVP counts ───────────────────────────────────────────────────────
  const { data: rawRsvps } = await supabase
    .from('debate_rsvps')
    .select('debate_id')
    .in('debate_id', debateIds)

  const rsvpCounts = new Map<string, number>()
  for (const r of rawRsvps ?? []) {
    rsvpCounts.set(r.debate_id, (rsvpCounts.get(r.debate_id) ?? 0) + 1)
  }

  // ── 5. User RSVPs ─────────────────────────────────────────────────────────
  const userRsvpSet = new Set<string>()
  if (user) {
    const { data: userRsvps } = await supabase
      .from('debate_rsvps')
      .select('debate_id')
      .eq('user_id', user.id)
      .in('debate_id', debateIds)
    for (const r of userRsvps ?? []) userRsvpSet.add(r.debate_id)
  }

  // ── 6. Message counts ─────────────────────────────────────────────────────
  const { data: rawMessages } = await supabase
    .from('debate_messages')
    .select('debate_id')
    .in('debate_id', debateIds)

  const messageCounts = new Map<string, number>()
  for (const m of rawMessages ?? []) {
    messageCounts.set(m.debate_id, (messageCounts.get(m.debate_id) ?? 0) + 1)
  }

  // ── 7. Winner polls ───────────────────────────────────────────────────────
  const { data: rawPolls } = await supabase
    .from('debate_winner_polls')
    .select('debate_id, winner')
    .in('debate_id', debateIds)

  const pollsByDebate = new Map<string, { blue: number; red: number; tie: number }>()
  for (const p of rawPolls ?? []) {
    const counts = pollsByDebate.get(p.debate_id) ?? { blue: 0, red: 0, tie: 0 }
    if (p.winner === 'blue') counts.blue++
    else if (p.winner === 'red') counts.red++
    else counts.tie++
    pollsByDebate.set(p.debate_id, counts)
  }

  // ── 8. Price context ─────────────────────────────────────────────────────
  // Get price history snapshots around debate times
  const { data: priceHistory } = await supabase
    .from('topic_price_history')
    .select('price, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })

  const snapshots = (priceHistory ?? []).map((p) => ({
    price: p.price as number,
    at: new Date(p.recorded_at as string).getTime(),
  }))

  function priceNear(targetMs: number): number | null {
    if (!snapshots.length) return null
    let closest = snapshots[0]
    let minDiff = Math.abs(snapshots[0].at - targetMs)
    for (const s of snapshots) {
      const diff = Math.abs(s.at - targetMs)
      if (diff < minDiff) { minDiff = diff; closest = s }
    }
    return minDiff < 7 * 24 * 60 * 60 * 1000 ? Math.round(closest.price) : null
  }

  // ── 9. Assemble ───────────────────────────────────────────────────────────
  const debates: MarketDebate[] = rawDebates.map((d) => {
    const winnerVotes = pollsByDebate.get(d.id) ?? { blue: 0, red: 0, tie: 0 }
    const totalPollVotes = winnerVotes.blue + winnerVotes.red + winnerVotes.tie

    let communityWinner: 'blue' | 'red' | 'tie' | null = null
    if (d.status === 'ended' && totalPollVotes > 0) {
      const max = Math.max(winnerVotes.blue, winnerVotes.red, winnerVotes.tie)
      if (winnerVotes.blue === max) communityWinner = 'blue'
      else if (winnerVotes.red === max) communityWinner = 'red'
      else communityWinner = 'tie'
    }

    const scheduledMs = d.scheduled_at ? new Date(d.scheduled_at).getTime() : null
    const endedMs = d.ended_at ? new Date(d.ended_at).getTime() : null
    const priceBefore = scheduledMs ? priceNear(scheduledMs - 60 * 60 * 1000) : null
    const priceAfter = endedMs ? priceNear(endedMs + 60 * 60 * 1000) : null
    const priceDelta =
      priceBefore !== null && priceAfter !== null ? priceAfter - priceBefore : null

    return {
      id: d.id,
      title: d.title,
      description: d.description ?? null,
      type: d.type as 'quick' | 'grand' | 'tribunal',
      status: d.status as 'scheduled' | 'live' | 'ended' | 'cancelled',
      scheduled_at: d.scheduled_at,
      started_at: d.started_at ?? null,
      ended_at: d.ended_at ?? null,
      blue_sway: d.blue_sway ?? 50,
      red_sway: d.red_sway ?? 50,
      participants: participantsByDebate.get(d.id) ?? [],
      rsvp_count: rsvpCounts.get(d.id) ?? 0,
      message_count: messageCounts.get(d.id) ?? 0,
      winner_votes: winnerVotes,
      community_winner: communityWinner,
      price_before: priceBefore,
      price_after: priceAfter,
      price_delta: priceDelta,
      user_rsvped: userRsvpSet.has(d.id),
    }
  })

  const scheduled_count = debates.filter((d) => d.status === 'scheduled').length
  const live_count = debates.filter((d) => d.status === 'live').length
  const ended_count = debates.filter((d) => d.status === 'ended').length

  return NextResponse.json({
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price: Math.round(topic.blue_pct ?? 50),
    },
    debates,
    total: debates.length,
    scheduled_count,
    live_count,
    ended_count,
  } satisfies MarketDebatesResponse)
}

// ─── POST: RSVP to a debate ───────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  _ctx: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { debate_id, action } = body as { debate_id?: string; action?: 'rsvp' | 'unrsvp' }

  if (!debate_id || !action) {
    return NextResponse.json({ error: 'Missing debate_id or action' }, { status: 400 })
  }

  if (action === 'rsvp') {
    await supabase
      .from('debate_rsvps')
      .upsert({ debate_id, user_id: user.id }, { onConflict: 'debate_id,user_id', ignoreDuplicates: true })
  } else {
    await supabase
      .from('debate_rsvps')
      .delete()
      .eq('debate_id', debate_id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
