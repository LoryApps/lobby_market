import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayLegRecord {
  leg_id: string
  relay_id: string
  leg_number: number
  content: string
  side: 'for' | 'against'
  upvote_count: number
  created_at: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  relay_status: string
  relay_compelling_pct: number | null
}

export type RelayArchetype =
  | 'newcomer'     // < 3 relay contributions
  | 'relay_builder'  // consistently starts relays
  | 'chain_link'   // prefers joining mid-chain
  | 'finisher'     // often contributes the final leg
  | 'anchor'       // high upvote rates — quality contributor
  | 'catalyst'     // multiple category spread

export interface RelayAnalyticsResponse {
  total_legs: number
  relays_started: number
  relays_participated: number
  total_upvotes_received: number
  avg_upvotes_per_leg: number
  compelling_rate: number | null
  best_leg_upvotes: number
  best_leg_content: string | null
  best_leg_topic: string | null
  recent_legs: RelayLegRecord[]
  category_breakdown: Array<{ category: string; count: number; avg_upvotes: number }>
  side_breakdown: { for: number; against: number }
  leg_position_breakdown: Array<{ position: number; count: number }>
  archetype: RelayArchetype
  archetype_label: string
  monthly_activity: Array<{ month: string; legs: number }>
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. All relay legs by this user
  const { data: rawLegs } = await supabase
    .from('relay_legs')
    .select(`
      id,
      relay_id,
      leg_number,
      content,
      created_at,
      civic_relays!inner (
        id,
        side,
        status,
        vote_compelling,
        vote_not_compelling,
        topic_id,
        topics ( id, statement, category )
      )
    `)
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  const legs = rawLegs ?? []

  // 2. Upvote counts for each leg
  const legIds = legs.map((l) => l.id)

  const upvoteCounts: Record<string, number> = {}
  if (legIds.length > 0) {
    const { data: upvotes } = await supabase
      .from('relay_leg_upvotes')
      .select('leg_id')
      .in('leg_id', legIds)

    for (const uv of upvotes ?? []) {
      upvoteCounts[uv.leg_id] = (upvoteCounts[uv.leg_id] ?? 0) + 1
    }
  }

  // 3. Relays the user started
  const { data: startedRelays } = await supabase
    .from('civic_relays')
    .select('id, status, vote_compelling, vote_not_compelling')
    .eq('starter_id', user.id)

  const started = startedRelays ?? []

  // ─── Compute aggregates ────────────────────────────────────────────────────

  const totalLegs = legs.length
  const relaysStarted = started.length

  const uniqueRelayIds = new Set(legs.map((l) => l.relay_id))
  const relaysParticipated = uniqueRelayIds.size

  const totalUpvotes = legIds.reduce((sum, id) => sum + (upvoteCounts[id] ?? 0), 0)
  const avgUpvotes = totalLegs > 0 ? totalUpvotes / totalLegs : 0

  // Compelling rate from started relays that have votes
  const completedStarted = started.filter(
    (r) => r.vote_compelling + r.vote_not_compelling > 0
  )
  const compellingRate =
    completedStarted.length > 0
      ? completedStarted.reduce(
          (sum, r) => sum + r.vote_compelling / (r.vote_compelling + r.vote_not_compelling),
          0
        ) / completedStarted.length
      : null

  // Best leg
  let bestLegUpvotes = 0
  let bestLegContent: string | null = null
  let bestLegTopic: string | null = null

  for (const leg of legs) {
    const uv = upvoteCounts[leg.id] ?? 0
    if (uv > bestLegUpvotes) {
      bestLegUpvotes = uv
      bestLegContent = leg.content
      const relay = leg.civic_relays as { topics?: { statement?: string } | null } | null
      bestLegTopic = (relay?.topics as { statement?: string } | null)?.statement ?? null
    }
  }

  // Recent legs (last 10)
  const recentLegs: RelayLegRecord[] = legs.slice(0, 10).map((leg) => {
    const relay = leg.civic_relays as {
      id: string
      side: 'for' | 'against'
      status: string
      vote_compelling: number
      vote_not_compelling: number
      topic_id: string | null
      topics: { id: string; statement: string; category: string | null } | null
    } | null

    const totalRelayVotes = (relay?.vote_compelling ?? 0) + (relay?.vote_not_compelling ?? 0)

    return {
      leg_id: leg.id,
      relay_id: leg.relay_id,
      leg_number: leg.leg_number,
      content: leg.content,
      side: relay?.side ?? 'for',
      upvote_count: upvoteCounts[leg.id] ?? 0,
      created_at: leg.created_at,
      topic_id: relay?.topic_id ?? null,
      topic_statement: relay?.topics?.statement ?? null,
      topic_category: relay?.topics?.category ?? null,
      relay_status: relay?.status ?? 'open',
      relay_compelling_pct:
        totalRelayVotes > 0
          ? Math.round(((relay?.vote_compelling ?? 0) / totalRelayVotes) * 100)
          : null,
    }
  })

  // Category breakdown
  const catMap: Record<string, { count: number; totalUpvotes: number }> = {}
  for (const leg of legs) {
    const relay = leg.civic_relays as { topics?: { category?: string | null } | null } | null
    const cat = (relay?.topics as { category?: string | null } | null)?.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { count: 0, totalUpvotes: 0 }
    catMap[cat].count += 1
    catMap[cat].totalUpvotes += upvoteCounts[leg.id] ?? 0
  }
  const categoryBreakdown = Object.entries(catMap)
    .map(([category, { count, totalUpvotes }]) => ({
      category,
      count,
      avg_upvotes: count > 0 ? Math.round((totalUpvotes / count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Side breakdown
  const sideBreakdown = { for: 0, against: 0 }
  for (const leg of legs) {
    const relay = leg.civic_relays as { side?: 'for' | 'against' } | null
    if (relay?.side === 'for') sideBreakdown.for += 1
    else sideBreakdown.against += 1
  }

  // Leg position breakdown (which position do they usually contribute?)
  const posMap: Record<number, number> = {}
  for (const leg of legs) {
    posMap[leg.leg_number] = (posMap[leg.leg_number] ?? 0) + 1
  }
  const legPositionBreakdown = [1, 2, 3, 4, 5].map((pos) => ({
    position: pos,
    count: posMap[pos] ?? 0,
  }))

  // Monthly activity (last 6 months)
  const monthMap: Record<string, number> = {}
  for (const leg of legs) {
    const month = leg.created_at.slice(0, 7) // "YYYY-MM"
    monthMap[month] = (monthMap[month] ?? 0) + 1
  }
  const monthlyActivity = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, legCount]) => ({ month, legs: legCount }))

  // Archetype
  let archetype: RelayArchetype = 'newcomer'
  let archetypeLabel = 'The Newcomer'
  if (totalLegs >= 3) {
    if (avgUpvotes >= 3) {
      archetype = 'anchor'
      archetypeLabel = 'The Anchor'
    } else if (relaysStarted >= totalLegs * 0.5) {
      archetype = 'relay_builder'
      archetypeLabel = 'The Relay Builder'
    } else if ((posMap[5] ?? 0) >= totalLegs * 0.3) {
      archetype = 'finisher'
      archetypeLabel = 'The Finisher'
    } else if (categoryBreakdown.length >= 4) {
      archetype = 'catalyst'
      archetypeLabel = 'The Catalyst'
    } else if ((posMap[2] ?? 0) + (posMap[3] ?? 0) >= totalLegs * 0.5) {
      archetype = 'chain_link'
      archetypeLabel = 'The Chain Link'
    } else {
      archetype = 'relay_builder'
      archetypeLabel = 'The Relay Builder'
    }
  }

  const response: RelayAnalyticsResponse = {
    total_legs: totalLegs,
    relays_started: relaysStarted,
    relays_participated: relaysParticipated,
    total_upvotes_received: totalUpvotes,
    avg_upvotes_per_leg: Math.round(avgUpvotes * 10) / 10,
    compelling_rate: compellingRate !== null ? Math.round(compellingRate * 100) : null,
    best_leg_upvotes: bestLegUpvotes,
    best_leg_content: bestLegContent,
    best_leg_topic: bestLegTopic,
    recent_legs: recentLegs,
    category_breakdown: categoryBreakdown,
    side_breakdown: sideBreakdown,
    leg_position_breakdown: legPositionBreakdown,
    archetype,
    archetype_label: archetypeLabel,
    monthly_activity: monthlyActivity,
  }

  return NextResponse.json(response)
}
