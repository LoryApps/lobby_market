import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketNewsEventType =
  | 'market_created'
  | 'status_change'
  | 'price_milestone'
  | 'price_swing'
  | 'debate_scheduled'
  | 'debate_completed'
  | 'argument_surge'
  | 'coalition_stance'
  | 'vote_milestone'
  | 'law_established'
  | 'market_failed'
  | 'deadlock_detected'
  | 'closing_soon'

export type NewsEventTier = 'peak' | 'high' | 'medium' | 'low'

export interface MarketNewsEvent {
  id: string
  type: MarketNewsEventType
  headline: string
  body: string
  occurred_at: string
  is_breaking: boolean
  price: number | null
  volume: number | null
  href: string | null
  icon: string
  tier: NewsEventTier
  color: string
  tag: string | null
}

export interface MarketNewsResponse {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  total_votes: number
  events: MarketNewsEvent[]
  total: number
  as_of: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICE_MILESTONES = [25, 33, 50, 55, 60, 67, 75, 90] as const

const VOTE_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const

const BREAKING_CUTOFF_MS = 2 * 3_600_000 // 2 hours

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function isBreaking(isoAt: string): boolean {
  return Date.now() - new Date(isoAt).getTime() < BREAKING_CUTOFF_MS
}

function milestoneColor(threshold: number): string {
  if (threshold >= 90) return 'gold'
  if (threshold >= 67) return 'gold'
  if (threshold >= 55) return 'for'
  if (threshold <= 33) return 'against'
  return 'surface'
}

// ─── GET /api/exchange/[id]/news ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const supabase = await createClient()

    // ── 1. Topic ─────────────────────────────────────────────────────────────
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at, voting_ends_at')
      .eq('id', id)
      .single()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const events: MarketNewsEvent[] = []
    const currentPrice = Math.round(topic.blue_pct ?? 50)
    const stmt = truncate(topic.statement ?? 'This market', 70)

    // ── 2. Market created ────────────────────────────────────────────────────
    events.push({
      id: 'created',
      type: 'market_created',
      headline: 'Market opened',
      body: `"${stmt}" entered the Civic Exchange as a live prediction market.`,
      occurred_at: topic.created_at,
      is_breaking: isBreaking(topic.created_at),
      price: Math.round(topic.blue_pct ?? 50),
      volume: topic.total_votes ?? 0,
      href: null,
      icon: 'Zap',
      tier: 'medium',
      color: 'for',
      tag: topic.category ?? null,
    })

    // ── 3. Status transitions ─────────────────────────────────────────────────
    if (topic.status === 'law') {
      events.push({
        id: 'law',
        type: 'law_established',
        headline: 'Law established',
        body: `"${stmt}" achieved supermajority consensus and entered the Law Codex.`,
        occurred_at: topic.updated_at ?? topic.created_at,
        is_breaking: isBreaking(topic.updated_at ?? topic.created_at),
        price: currentPrice,
        volume: topic.total_votes ?? 0,
        href: `/topic/${id}`,
        icon: 'Gavel',
        tier: 'peak',
        color: 'gold',
        tag: 'LAW',
      })
    } else if (topic.status === 'failed') {
      events.push({
        id: 'failed',
        type: 'market_failed',
        headline: 'Market settled against',
        body: `"${stmt}" did not achieve consensus. Settled at ${currentPrice}¢.`,
        occurred_at: topic.updated_at ?? topic.created_at,
        is_breaking: isBreaking(topic.updated_at ?? topic.created_at),
        price: currentPrice,
        volume: topic.total_votes ?? 0,
        href: `/exchange/${id}/resolution`,
        icon: 'XCircle',
        tier: 'high',
        color: 'against',
        tag: 'CLOSED',
      })
    } else if (topic.status === 'voting') {
      events.push({
        id: 'voting',
        type: 'status_change',
        headline: 'Entered voting phase',
        body: `"${stmt}" has reached the voting phase. Final votes are being counted at ${currentPrice}¢.`,
        occurred_at: topic.updated_at ?? topic.created_at,
        is_breaking: isBreaking(topic.updated_at ?? topic.created_at),
        price: currentPrice,
        volume: topic.total_votes ?? 0,
        href: `/topic/${id}`,
        icon: 'Vote',
        tier: 'high',
        color: 'purple',
        tag: 'VOTING',
      })
    }

    // ── 4. Closing soon alert ─────────────────────────────────────────────────
    if (topic.voting_ends_at && topic.status === 'voting') {
      const msLeft = new Date(topic.voting_ends_at).getTime() - Date.now()
      if (msLeft > 0 && msLeft < 24 * 3_600_000) {
        const hLeft = Math.floor(msLeft / 3_600_000)
        const mLeft = Math.floor((msLeft % 3_600_000) / 60_000)
        const timeStr = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`
        events.push({
          id: 'closing-soon',
          type: 'closing_soon',
          headline: `Closes in ${timeStr}`,
          body: `Voting window closes soon. Current consensus: ${currentPrice}¢ FOR.`,
          occurred_at: new Date().toISOString(),
          is_breaking: hLeft < 2,
          price: currentPrice,
          volume: topic.total_votes ?? 0,
          href: `/topic/${id}`,
          icon: 'Clock',
          tier: 'high',
          color: 'gold',
          tag: 'ALERT',
        })
      }
    }

    // ── 5. Price history — milestones + swings ───────────────────────────────
    const { data: history } = await supabase
      .from('topic_price_history')
      .select('price, volume, recorded_at')
      .eq('topic_id', id)
      .order('recorded_at', { ascending: true })
      .limit(2000)

    const snaps = history ?? []

    if (snaps.length > 0) {
      const crossedMilestones = new Set<number>()
      const crossedVoteMilestones = new Set<number>()
      let prevPrice = snaps[0].price
      let prevVol = snaps[0].volume ?? 0

      for (let i = 1; i < snaps.length; i++) {
        const snap = snaps[i]
        const price = snap.price
        const vol = snap.volume ?? 0

        // ── Price milestones ─────────────────────────────────────────────────
        for (const ms of PRICE_MILESTONES) {
          if (!crossedMilestones.has(ms)) {
            // Upward crossing
            if (prevPrice < ms && price >= ms) {
              crossedMilestones.add(ms)
              const color = milestoneColor(ms)
              const isLaw = ms === 67
              events.push({
                id: `milestone-up-${ms}`,
                type: 'price_milestone',
                headline: isLaw
                  ? `Crossed law threshold — ${ms}¢`
                  : `Price crossed ${ms}¢`,
                body: isLaw
                  ? `"${stmt}" crossed the supermajority threshold at ${Math.round(price)}¢ — now eligible to become Law.`
                  : `Consensus shifted upward past ${ms}¢, moving from ${Math.round(prevPrice)}¢ to ${Math.round(price)}¢.`,
                occurred_at: snap.recorded_at,
                is_breaking: isBreaking(snap.recorded_at),
                price: Math.round(price),
                volume: vol,
                href: `/exchange/${id}/milestones`,
                icon: isLaw ? 'Gavel' : 'TrendingUp',
                tier: isLaw ? 'peak' : ms >= 60 ? 'high' : 'medium',
                color,
                tag: `${ms}¢`,
              })
            }
            // Downward crossing (falling below milestone)
            if (prevPrice >= ms && price < ms) {
              crossedMilestones.add(ms)
              events.push({
                id: `milestone-dn-${ms}`,
                type: 'price_milestone',
                headline: `Fell below ${ms}¢`,
                body: `Consensus reversed — dropped from ${Math.round(prevPrice)}¢ to ${Math.round(price)}¢, falling below the ${ms}¢ threshold.`,
                occurred_at: snap.recorded_at,
                is_breaking: isBreaking(snap.recorded_at),
                price: Math.round(price),
                volume: vol,
                href: `/exchange/${id}/depth`,
                icon: 'TrendingDown',
                tier: ms >= 67 ? 'high' : 'medium',
                color: 'against',
                tag: `${ms}¢`,
              })
            }
          }
        }

        // ── Vote milestones ──────────────────────────────────────────────────
        for (const ms of VOTE_MILESTONES) {
          if (!crossedVoteMilestones.has(ms)) {
            if (prevVol < ms && vol >= ms) {
              crossedVoteMilestones.add(ms)
              const label = ms >= 1000 ? `${ms / 1000}K` : String(ms)
              events.push({
                id: `votes-${ms}`,
                type: 'vote_milestone',
                headline: `${label} votes cast`,
                body: `"${stmt}" reached ${label} total votes at ${Math.round(price)}¢.`,
                occurred_at: snap.recorded_at,
                is_breaking: isBreaking(snap.recorded_at),
                price: Math.round(price),
                volume: vol,
                href: `/exchange/${id}/traders`,
                icon: 'Users',
                tier: ms >= 1000 ? 'high' : ms >= 100 ? 'medium' : 'low',
                color: 'emerald',
                tag: `${label} VOTES`,
              })
            }
          }
        }

        // ── Price swings (large single-period moves) ─────────────────────────
        const swing = price - prevPrice
        if (Math.abs(swing) >= 10) {
          events.push({
            id: `swing-${snap.recorded_at}`,
            type: 'price_swing',
            headline: swing > 0
              ? `Surged ${swing.toFixed(0)}¢ in a single session`
              : `Dropped ${Math.abs(swing).toFixed(0)}¢ in a single session`,
            body: `Sharp ${swing > 0 ? 'upward' : 'downward'} move from ${Math.round(prevPrice)}¢ to ${Math.round(price)}¢.`,
            occurred_at: snap.recorded_at,
            is_breaking: isBreaking(snap.recorded_at),
            price: Math.round(price),
            volume: vol,
            href: `/exchange/${id}/depth`,
            icon: swing > 0 ? 'TrendingUp' : 'TrendingDown',
            tier: Math.abs(swing) >= 20 ? 'high' : 'medium',
            color: swing > 0 ? 'for' : 'against',
            tag: `${swing > 0 ? '+' : ''}${swing.toFixed(0)}¢`,
          })
        }

        prevPrice = price
        prevVol = vol
      }

      // Deadlock detection: currently near 50 with high volume
      if (
        topic.status !== 'law' &&
        topic.status !== 'failed' &&
        currentPrice >= 45 &&
        currentPrice <= 55 &&
        (topic.total_votes ?? 0) >= 50
      ) {
        events.push({
          id: 'deadlock',
          type: 'deadlock_detected',
          headline: 'Market deadlocked near 50¢',
          body: `"${stmt}" is evenly split at ${currentPrice}¢ — neither side has gained the upper hand.`,
          occurred_at: snaps[snaps.length - 1]?.recorded_at ?? topic.updated_at ?? topic.created_at,
          is_breaking: false,
          price: currentPrice,
          volume: topic.total_votes ?? 0,
          href: `/exchange/${id}/depth`,
          icon: 'Scale',
          tier: 'medium',
          color: 'surface',
          tag: 'DEADLOCK',
        })
      }
    }

    // ── 6. Debates ───────────────────────────────────────────────────────────
    const { data: debates } = await supabase
      .from('debates')
      .select('id, title, status, type, scheduled_at, started_at, ended_at, viewer_count')
      .eq('topic_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(20)

    for (const d of debates ?? []) {
      if (d.status === 'ended' && d.ended_at) {
        const viewersLabel =
          d.viewer_count > 0 ? ` — ${d.viewer_count.toLocaleString()} viewers` : ''
        events.push({
          id: `debate-ended-${d.id}`,
          type: 'debate_completed',
          headline: `Debate ended: ${truncate(d.title, 50)}`,
          body: `A ${d.type} debate on this market concluded${viewersLabel}.`,
          occurred_at: d.ended_at,
          is_breaking: isBreaking(d.ended_at),
          price: null,
          volume: null,
          href: `/debate/${d.id}`,
          icon: 'Mic',
          tier: d.viewer_count >= 50 ? 'high' : 'medium',
          color: 'purple',
          tag: d.type.toUpperCase(),
        })
      } else if (d.status === 'scheduled' || d.status === 'live') {
        events.push({
          id: `debate-sched-${d.id}`,
          type: 'debate_scheduled',
          headline: d.status === 'live'
            ? `Live debate now: ${truncate(d.title, 50)}`
            : `Debate scheduled: ${truncate(d.title, 50)}`,
          body: d.status === 'live'
            ? `A ${d.type} debate is currently live on this market.`
            : `A ${d.type} debate is scheduled for this market.`,
          occurred_at: d.scheduled_at,
          is_breaking: d.status === 'live',
          price: null,
          volume: null,
          href: `/debate/${d.id}`,
          icon: 'Mic',
          tier: d.status === 'live' ? 'high' : 'medium',
          color: d.status === 'live' ? 'against' : 'purple',
          tag: d.status === 'live' ? 'LIVE' : d.type.toUpperCase(),
        })
      }
    }

    // ── 7. Coalition stances ─────────────────────────────────────────────────
    const { data: stances } = await supabase
      .from('coalition_stances')
      .select('id, coalition_id, stance, statement, created_at, updated_at')
      .eq('topic_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (stances && stances.length > 0) {
      const coalitionIds = stances.map((s) => s.coalition_id)
      const { data: coalitions } = await supabase
        .from('coalitions')
        .select('id, name, member_count')
        .in('id', coalitionIds)

      const coalitionMap = new Map(
        (coalitions ?? []).map((c) => [c.id, c]),
      )

      for (const s of stances) {
        const coalition = coalitionMap.get(s.coalition_id)
        if (!coalition) continue
        const stanceLabel = s.stance === 'for' ? 'FOR' : s.stance === 'against' ? 'AGAINST' : 'NEUTRAL'
        const stanceColor = s.stance === 'for' ? 'for' : s.stance === 'against' ? 'against' : 'surface'
        const memberLabel =
          coalition.member_count && coalition.member_count > 1
            ? ` (${coalition.member_count} members)`
            : ''

        events.push({
          id: `stance-${s.id}`,
          type: 'coalition_stance',
          headline: `${coalition.name} declared ${stanceLabel}`,
          body: s.statement
            ? `"${truncate(s.statement, 100)}"`
            : `${coalition.name}${memberLabel} officially declared ${s.stance} on this market.`,
          occurred_at: s.updated_at ?? s.created_at,
          is_breaking: isBreaking(s.updated_at ?? s.created_at),
          price: null,
          volume: null,
          href: null,
          icon: 'Shield',
          tier: coalition.member_count >= 100 ? 'high' : 'medium',
          color: stanceColor,
          tag: stanceLabel,
        })
      }
    }

    // ── 8. Top argument surge (the single most-upvoted argument) ─────────────
    const { data: topArgs } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, created_at')
      .eq('topic_id', id)
      .order('upvotes', { ascending: false })
      .limit(3)

    for (const a of topArgs ?? []) {
      if ((a.upvotes ?? 0) < 5) continue
      const sideLabel = a.side === 'blue' ? 'FOR' : 'AGAINST'
      const sideColor = a.side === 'blue' ? 'for' : 'against'
      events.push({
        id: `arg-${a.id}`,
        type: 'argument_surge',
        headline: `Top ${sideLabel} argument: ${(a.upvotes ?? 0).toLocaleString()} upvotes`,
        body: `"${truncate(a.content ?? '', 120)}"`,
        occurred_at: a.created_at,
        is_breaking: false,
        price: null,
        volume: null,
        href: `/topic/${id}/arguments`,
        icon: a.side === 'blue' ? 'ThumbsUp' : 'ThumbsDown',
        tier: (a.upvotes ?? 0) >= 100 ? 'high' : 'medium',
        color: sideColor,
        tag: `${sideLabel} · ${(a.upvotes ?? 0)} votes`,
      })
    }

    // ── Deduplicate and sort by recency ──────────────────────────────────────
    const seenIds = new Set<string>()
    const uniqueEvents = events
      .filter((e) => {
        if (seenIds.has(e.id)) return false
        seenIds.add(e.id)
        return true
      })
      .sort((a, b) => {
        // Breaking events first, then recency
        if (a.is_breaking && !b.is_breaking) return -1
        if (!a.is_breaking && b.is_breaking) return 1
        return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      })
      .slice(0, 60)

    const response: MarketNewsResponse = {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_price: currentPrice,
      total_votes: topic.total_votes ?? 0,
      events: uniqueEvents,
      total: uniqueEvents.length,
      as_of: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    })
  } catch (err) {
    console.error('[/api/exchange/[id]/news]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
