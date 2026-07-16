import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpportunityType =
  | 'impact_zone'     // Closely contested + in user's top categories
  | 'tipping_point'   // Low-vote market near 50/50 — a few votes could move it
  | 'closing_soon'    // In voting phase, closes within 48 h
  | 'debate_needed'   // High vote volume but very few arguments
  | 'momentum_play'   // Significant consensus shift in last 24 h

export type Urgency = 'high' | 'medium' | 'low'

export interface OpportunityMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
  argument_count: number
  opportunity_type: OpportunityType
  reason: string
  urgency: Urgency
  closes_in_hours?: number
  votes_to_tip?: number
  price_delta_24h?: number | null
}

export interface OpportunitySection {
  type: OpportunityType
  label: string
  tagline: string
  color: string
  markets: OpportunityMarket[]
}

export interface OpportunityResponse {
  sections: OpportunitySection[]
  user_top_categories: string[]
  total_opportunities: number
  as_of: string
}

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_META: Record<
  OpportunityType,
  { label: string; tagline: string; color: string }
> = {
  impact_zone: {
    label: 'Your Impact Zones',
    tagline: 'Contested debates in your strongest categories — your vote matters most here.',
    color: 'for',
  },
  tipping_point: {
    label: 'Tipping Points',
    tagline: 'Low-participation markets near 50/50 — a handful of votes could move the price.',
    color: 'gold',
  },
  closing_soon: {
    label: 'Closing Soon',
    tagline: 'Markets entering their final voting phase — act before consensus locks in.',
    color: 'against',
  },
  debate_needed: {
    label: 'Needs Your Argument',
    tagline: 'High-vote topics with almost no arguments — the debate is wide open.',
    color: 'purple',
  },
  momentum_play: {
    label: 'Momentum Plays',
    tagline: 'Consensus is shifting fast — catch the move before it settles.',
    color: 'emerald',
  },
}

// ─── GET /api/exchange/opportunity ───────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Get current user (optional — we personalize if logged in)
  const { data: { user } } = await supabase.auth.getUser()

  // ── User top categories ────────────────────────────────────────────────────
  let userTopCategories: string[] = []
  if (user) {
    const { data: voteData } = await supabase
      .from('votes')
      .select('topics(category)')
      .eq('user_id', user.id)
      .not('topics', 'is', null)
      .limit(200)

    if (voteData) {
      const catCounts: Record<string, number> = {}
      for (const row of voteData) {
        const cat = (row.topics as { category: string | null } | null)?.category
        if (cat) catCounts[cat] = (catCounts[cat] ?? 0) + 1
      }
      userTopCategories = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([cat]) => cat)
    }
  }

  // ── Fetch all active/voting topics with argument counts ────────────────────
  const { data: topics } = await supabase
    .from('topics')
    .select(`
      id, statement, category, status, scope,
      blue_pct, total_votes, feed_score,
      voting_ends_at, created_at, updated_at,
      arguments(count)
    `)
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(300)

  if (!topics || topics.length === 0) {
    return NextResponse.json<OpportunityResponse>({
      sections: [],
      user_top_categories: userTopCategories,
      total_opportunities: 0,
      as_of: new Date().toISOString(),
    })
  }

  // ── Fetch 24h price history for momentum calculation ───────────────────────
  const topicIds = topics.map((t) => t.id)
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: history } = await supabase
    .from('topic_price_history')
    .select('topic_id, blue_pct, recorded_at')
    .in('topic_id', topicIds)
    .gte('recorded_at', cutoff24h)
    .order('recorded_at', { ascending: true })

  // Build 24h delta map: earliest snapshot vs current
  const deltaMap: Record<string, number | null> = {}
  if (history) {
    const oldest: Record<string, number> = {}
    for (const row of history) {
      if (oldest[row.topic_id] === undefined) {
        oldest[row.topic_id] = row.blue_pct
      }
    }
    for (const t of topics) {
      const old = oldest[t.id]
      deltaMap[t.id] = old !== undefined ? Math.round(t.blue_pct - old) : null
    }
  }

  // ── Build opportunity sets ────────────────────────────────────────────────
  const now = Date.now()

  const impactZone: OpportunityMarket[] = []
  const tippingPoint: OpportunityMarket[] = []
  const closingSoon: OpportunityMarket[] = []
  const debateNeeded: OpportunityMarket[] = []
  const momentumPlay: OpportunityMarket[] = []

  // Track seen IDs to avoid showing a market in multiple sections
  const seen = new Set<string>()

  for (const t of topics) {
    const price = Math.round(t.blue_pct ?? 50)
    const volume = t.total_votes ?? 0
    const args = (t.arguments as unknown as { count: number }[] | null)?.[0]?.count ?? 0
    const delta = deltaMap[t.id] ?? null
    const cat = t.category

    // Closing soon: voting phase, ends within 48 h
    if (t.status === 'voting' && t.voting_ends_at) {
      const diff = new Date(t.voting_ends_at).getTime() - now
      const hours = diff / (1000 * 60 * 60)
      if (hours > 0 && hours <= 48) {
        const urgency: Urgency = hours <= 6 ? 'high' : hours <= 24 ? 'medium' : 'low'
        closingSoon.push({
          id: t.id,
          statement: t.statement,
          category: cat,
          status: t.status,
          price,
          volume,
          argument_count: args,
          opportunity_type: 'closing_soon',
          reason: `Closes in ${hours < 1 ? '<1h' : `${Math.round(hours)}h`} — ${price}¢ current consensus`,
          urgency,
          closes_in_hours: Math.round(hours),
          price_delta_24h: delta,
        })
        seen.add(t.id)
        continue
      }
    }

    // Impact zone: contested (45–55) + in user's top categories
    if (
      !seen.has(t.id) &&
      price >= 40 &&
      price <= 60 &&
      volume >= 20 &&
      userTopCategories.length > 0 &&
      cat &&
      userTopCategories.includes(cat)
    ) {
      impactZone.push({
        id: t.id,
        statement: t.statement,
        category: cat,
        status: t.status,
        price,
        volume,
        argument_count: args,
        opportunity_type: 'impact_zone',
        reason: `Contested at ${price}¢ — your ${cat} expertise can tip it`,
        urgency: price >= 48 && price <= 52 ? 'high' : 'medium',
        price_delta_24h: delta,
      })
      seen.add(t.id)
      continue
    }

    // Tipping point: low votes (<= 60), near 50/50 (44–56)
    if (!seen.has(t.id) && volume <= 60 && price >= 44 && price <= 56) {
      const distFrom50 = Math.abs(price - 50)
      const votesToTip = Math.max(1, Math.ceil((5 - distFrom50) * (volume / 100 + 1)))
      tippingPoint.push({
        id: t.id,
        statement: t.statement,
        category: cat,
        status: t.status,
        price,
        volume,
        argument_count: args,
        opportunity_type: 'tipping_point',
        reason: `Only ${volume} votes — ${votesToTip} more could move it 5¢`,
        urgency: volume <= 20 ? 'high' : 'medium',
        votes_to_tip: votesToTip,
        price_delta_24h: delta,
      })
      seen.add(t.id)
      continue
    }

    // Debate needed: high votes (>= 150) but very few arguments (<= 2)
    if (!seen.has(t.id) && volume >= 150 && args <= 2) {
      debateNeeded.push({
        id: t.id,
        statement: t.statement,
        category: cat,
        status: t.status,
        price,
        volume,
        argument_count: args,
        opportunity_type: 'debate_needed',
        reason: `${volume.toLocaleString()} votes, ${args === 0 ? 'no arguments yet' : `only ${args} argument${args === 1 ? '' : 's'}`}`,
        urgency: args === 0 ? 'high' : 'medium',
        price_delta_24h: delta,
      })
      seen.add(t.id)
      continue
    }

    // Momentum play: price moved >= 8 points in 24 h
    if (!seen.has(t.id) && delta !== null && Math.abs(delta) >= 8) {
      momentumPlay.push({
        id: t.id,
        statement: t.statement,
        category: cat,
        status: t.status,
        price,
        volume,
        argument_count: args,
        opportunity_type: 'momentum_play',
        reason: `${delta > 0 ? '+' : ''}${delta}¢ in 24h — ${delta > 0 ? 'surging FOR' : 'falling AGAINST'}`,
        urgency: Math.abs(delta) >= 15 ? 'high' : 'medium',
        price_delta_24h: delta,
      })
      seen.add(t.id)
    }
  }

  // For non-personalized users, fill impact_zone with contested markets
  if (impactZone.length === 0) {
    for (const t of topics) {
      if (seen.has(t.id)) continue
      const price = Math.round(t.blue_pct ?? 50)
      const volume = t.total_votes ?? 0
      const args = (t.arguments as unknown as { count: number }[] | null)?.[0]?.count ?? 0
      if (price >= 43 && price <= 57 && volume >= 20) {
        impactZone.push({
          id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          price,
          volume,
          argument_count: args,
          opportunity_type: 'impact_zone',
          reason: `Most contested — ${price}¢ with ${volume.toLocaleString()} votes`,
          urgency: price >= 48 && price <= 52 ? 'high' : 'medium',
          price_delta_24h: deltaMap[t.id] ?? null,
        })
        seen.add(t.id)
        if (impactZone.length >= 6) break
      }
    }
  }

  // Sort each section by urgency then volume
  const urgencyOrder: Record<Urgency, number> = { high: 0, medium: 1, low: 2 }
  const sortFn = (a: OpportunityMarket, b: OpportunityMarket) => {
    const u = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (u !== 0) return u
    return b.volume - a.volume
  }

  impactZone.sort(sortFn)
  closingSoon.sort(sortFn)
  tippingPoint.sort(sortFn)
  debateNeeded.sort(sortFn)
  momentumPlay.sort(sortFn)

  const sections: OpportunitySection[] = []

  const push = (type: OpportunityType, markets: OpportunityMarket[]) => {
    if (markets.length === 0) return
    sections.push({
      type,
      label: SECTION_META[type].label,
      tagline: SECTION_META[type].tagline,
      color: SECTION_META[type].color,
      markets: markets.slice(0, 6),
    })
  }

  push('closing_soon', closingSoon)
  push('impact_zone', impactZone)
  push('tipping_point', tippingPoint)
  push('debate_needed', debateNeeded)
  push('momentum_play', momentumPlay)

  const total = sections.reduce((s, sec) => s + sec.markets.length, 0)

  return NextResponse.json<OpportunityResponse>({
    sections,
    user_top_categories: userTopCategories,
    total_opportunities: total,
    as_of: new Date().toISOString(),
  })
}
