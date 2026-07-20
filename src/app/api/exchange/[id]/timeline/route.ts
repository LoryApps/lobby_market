import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'created'
  | 'status_change'
  | 'price_threshold'
  | 'vote_milestone'
  | 'debate_scheduled'
  | 'debate_ended'
  | 'top_argument'
  | 'wiki_edit'
  | 'law_established'
  | 'price_swing'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  timestamp: string
  title: string
  description: string | null
  /** Consensus price (blue_pct) at time of event — null if unknown */
  price: number | null
  /** Total votes at time of event — null if unknown */
  volume: number | null
  /** Visual weight — drives icon size and colour */
  tier: 'low' | 'medium' | 'high' | 'peak'
  /** Lucide icon key */
  icon: string
  /** Optional link to a related page */
  href: string | null
  /** Optional sub-label e.g. debate type, argument side */
  tag: string | null
}

export interface MarketTimeline {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  total_votes: number
  created_at: string
  law_at: string | null

  events: TimelineEvent[]

  days_active: number
  peak_price: number | null
  trough_price: number | null
  price_range: number | null
  total_debates: number
  total_arguments: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix: string, i: number | string): string {
  return `${prefix}-${i}`
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// Price thresholds that are meaningful in civic context
const PRICE_THRESHOLDS = [
  { value: 25, label: '25¢', desc: 'One-quarter consensus', tier: 'low' as const },
  { value: 33, label: '33¢', desc: 'One-third support', tier: 'low' as const },
  { value: 50, label: '50¢', desc: 'Majority crossed — debate flipped', tier: 'medium' as const },
  { value: 60, label: '60¢', desc: 'Strong lean toward FOR', tier: 'medium' as const },
  { value: 67, label: '67¢', desc: 'Supermajority — eligible for Law', tier: 'high' as const },
  { value: 75, label: '75¢', desc: 'Three-quarter mandate', tier: 'high' as const },
  { value: 90, label: '90¢', desc: 'Near-unanimous consensus', tier: 'peak' as const },
]

const VOTE_MILESTONES = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000]

// ─── GET /api/exchange/[id]/timeline ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at')
    .eq('id', id)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const currentPrice = topic.blue_pct ?? 50

  // ── 2. Price history ─────────────────────────────────────────────────────
  const { data: priceHistory } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(500)

  const snapshots = priceHistory ?? []

  // ── 3. Debates ───────────────────────────────────────────────────────────
  const { data: debates } = await supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, started_at, ended_at, viewer_count, blue_sway, red_sway')
    .eq('topic_id', id)
    .order('scheduled_at', { ascending: true })
    .limit(30)

  // ── 4. Top arguments ─────────────────────────────────────────────────────
  const { data: topArgs } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, created_at')
    .eq('topic_id', id)
    .gte('upvotes', 3)
    .order('upvotes', { ascending: false })
    .limit(5)

  // ── 5. Wiki edits ────────────────────────────────────────────────────────
  const { data: wikiEdits } = await supabase
    .from('topic_wiki_history')
    .select('id, editor_id, created_at, editor:profiles!editor_id(username, display_name)')
    .eq('topic_id', id)
    .order('created_at', { ascending: true })
    .limit(20)

  // ── 6. Law record ─────────────────────────────────────────────────────────
  const { data: law } = await supabase
    .from('laws')
    .select('established_at')
    .eq('topic_id', id)
    .maybeSingle()

  // ──────────────────────────────────────────────────────────────────────────
  // Build events list
  // ──────────────────────────────────────────────────────────────────────────
  const events: TimelineEvent[] = []

  // A) Market created
  events.push({
    id: uid('created', 0),
    type: 'created',
    timestamp: topic.created_at,
    title: 'Market opened',
    description: `Civic debate listed on the Exchange at 50¢ starting price.`,
    price: 50,
    volume: 0,
    tier: 'peak',
    icon: 'Zap',
    href: `/topic/${id}`,
    tag: topic.category ?? null,
  })

  // B) Vote milestones derived from price history
  {
    const lastCrossed = new Set<number>()
    for (const snap of snapshots) {
      const vol = snap.volume as number
      for (const m of VOTE_MILESTONES) {
        if (vol >= m && !lastCrossed.has(m)) {
          lastCrossed.add(m)
          events.push({
            id: uid('votes', m),
            type: 'vote_milestone',
            timestamp: snap.recorded_at as string,
            title: `${m.toLocaleString()} votes cast`,
            description: null,
            price: snap.price as number,
            volume: vol,
            tier: m >= 10_000 ? 'high' : m >= 1_000 ? 'medium' : 'low',
            icon: 'Vote',
            href: null,
            tag: null,
          })
        }
      }
    }
  }

  // C) Price threshold crossings derived from snapshots
  {
    let prevPrice: number | null = null
    const crossed = new Set<number>()
    const fallen = new Set<number>()

    for (const snap of snapshots) {
      const p = snap.price as number
      const vol = snap.volume as number

      for (const t of PRICE_THRESHOLDS) {
        // Crossed upward
        if (prevPrice !== null && prevPrice < t.value && p >= t.value && !crossed.has(t.value)) {
          crossed.add(t.value)
          fallen.delete(t.value)
          events.push({
            id: uid('thresh-up', t.value),
            type: 'price_threshold',
            timestamp: snap.recorded_at as string,
            title: `Crossed ${t.label} — ${t.desc}`,
            description: null,
            price: p,
            volume: vol,
            tier: t.tier,
            icon: t.value >= 67 ? 'TrendingUp' : 'ChevronUp',
            href: null,
            tag: 'FOR momentum',
          })
        }
        // Fell back below
        if (prevPrice !== null && prevPrice >= t.value && p < t.value && !fallen.has(t.value) && crossed.has(t.value)) {
          fallen.add(t.value)
          crossed.delete(t.value)
          events.push({
            id: uid('thresh-dn', t.value),
            type: 'price_threshold',
            timestamp: snap.recorded_at as string,
            title: `Fell back below ${t.label}`,
            description: null,
            price: p,
            volume: vol,
            tier: 'low',
            icon: 'TrendingDown',
            href: null,
            tag: 'AGAINST momentum',
          })
        }
      }

      // Large swing detection (≥ 10 point move between consecutive snapshots)
      if (prevPrice !== null) {
        const delta = p - prevPrice
        if (Math.abs(delta) >= 10) {
          events.push({
            id: uid('swing', snap.recorded_at as string),
            type: 'price_swing',
            timestamp: snap.recorded_at as string,
            title: delta > 0 ? `+${delta.toFixed(0)}¢ surge` : `${delta.toFixed(0)}¢ drop`,
            description: `Consensus moved ${Math.abs(delta).toFixed(0)} points in a single wave.`,
            price: p,
            volume: vol,
            tier: Math.abs(delta) >= 20 ? 'high' : 'medium',
            icon: delta > 0 ? 'TrendingUp' : 'TrendingDown',
            href: null,
            tag: null,
          })
        }
      }

      prevPrice = p
    }
  }

  // D) Debates
  for (const d of debates ?? []) {
    const debateId = d.id as string
    const schedAt = d.scheduled_at as string
    const endedAt = d.ended_at as string | null

    events.push({
      id: uid('debate-sched', debateId),
      type: 'debate_scheduled',
      timestamp: schedAt,
      title: (d.title as string) || 'Debate scheduled',
      description: null,
      price: null,
      volume: null,
      tier: 'medium',
      icon: 'Mic',
      href: `/debate/${debateId}`,
      tag: String(d.type).replace(/_/g, ' '),
    })

    if (endedAt && d.status === 'ended') {
      const sway = d.blue_sway as number
      const outcome = sway > 50 ? 'FOR won sway' : sway < 50 ? 'AGAINST won sway' : 'Sway tied'
      events.push({
        id: uid('debate-ended', debateId),
        type: 'debate_ended',
        timestamp: endedAt,
        title: `Debate concluded — ${outcome}`,
        description: `${(d.viewer_count as number) || 0} viewers watched this debate.`,
        price: null,
        volume: null,
        tier: 'medium',
        icon: 'CheckCircle2',
        href: `/debate/${debateId}`,
        tag: `${sway}% FOR sway`,
      })
    }
  }

  // E) Top arguments (most upvoted, show up in timeline at their creation time)
  for (const arg of topArgs ?? []) {
    const argId = arg.id as string
    const text = arg.content as string
    const side = arg.side as string
    events.push({
      id: uid('arg', argId),
      type: 'top_argument',
      timestamp: arg.created_at as string,
      title: `Top argument: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`,
      description: `${(arg.upvotes as number)} upvotes`,
      price: null,
      volume: null,
      tier: (arg.upvotes as number) >= 20 ? 'high' : 'medium',
      icon: side === 'blue' ? 'ThumbsUp' : 'ThumbsDown',
      href: `/topic/${id}/arguments`,
      tag: side === 'blue' ? 'FOR' : 'AGAINST',
    })
  }

  // F) First wiki edit, then major edits
  {
    const edits = wikiEdits ?? []
    if (edits.length > 0) {
      const first = edits[0]
      const editor = first.editor as { username?: string; display_name?: string } | null
      const name = editor?.display_name || editor?.username || 'A contributor'
      events.push({
        id: uid('wiki', first.id as string),
        type: 'wiki_edit',
        timestamp: first.created_at as string,
        title: 'Wiki article created',
        description: `${name} wrote the first wiki article for this debate.`,
        price: null,
        volume: null,
        tier: 'medium',
        icon: 'BookOpen',
        href: `/topic/${id}/wiki-history`,
        tag: 'Wiki',
      })

      if (edits.length >= 5) {
        const mid = edits[Math.floor(edits.length / 2)]
        events.push({
          id: uid('wiki-mid', mid.id as string),
          type: 'wiki_edit',
          timestamp: mid.created_at as string,
          title: `Wiki reaches ${edits.length} edits`,
          description: 'The community has actively documented this debate.',
          price: null,
          volume: null,
          tier: 'low',
          icon: 'FileEdit',
          href: `/topic/${id}/wiki-history`,
          tag: 'Wiki',
        })
      }
    }
  }

  // G) Law established
  if (law?.established_at) {
    events.push({
      id: 'law-established',
      type: 'law_established',
      timestamp: law.established_at as string,
      title: 'Debate codified as Law',
      description: 'The community reached supermajority consensus. This topic entered the Codex.',
      price: currentPrice,
      volume: topic.total_votes,
      tier: 'peak',
      icon: 'Gavel',
      href: `/law/${id}`,
      tag: 'LAW',
    })
  }

  // H) Status change events (approximated from updated_at + status for non-law)
  if (topic.status === 'failed') {
    events.push({
      id: 'status-failed',
      type: 'status_change',
      timestamp: topic.updated_at as string,
      title: 'Debate closed — consensus not reached',
      description: 'The debate period ended without a supermajority decision.',
      price: currentPrice,
      volume: topic.total_votes,
      tier: 'medium',
      icon: 'XCircle',
      href: null,
      tag: 'CLOSED',
    })
  } else if (topic.status === 'voting') {
    events.push({
      id: 'status-voting',
      type: 'status_change',
      timestamp: topic.updated_at as string,
      title: 'Final voting phase opened',
      description: 'The debate entered its conclusive voting window.',
      price: currentPrice,
      volume: topic.total_votes,
      tier: 'high',
      icon: 'Scale',
      href: null,
      tag: 'VOTING',
    })
  }

  // Sort chronologically, deduplicate close price swings
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Deduplicate: remove price_swing events within 1h of a price_threshold crossing
  const thresholdTimes = new Set(
    events.filter((e) => e.type === 'price_threshold').map((e) => new Date(e.timestamp).getTime())
  )
  const deduped = events.filter((e) => {
    if (e.type !== 'price_swing') return true
    const t = new Date(e.timestamp).getTime()
    for (const tt of thresholdTimes) {
      if (Math.abs(t - tt) < 3_600_000) return false
    }
    return true
  })

  // ── Summary stats ─────────────────────────────────────────────────────────
  const prices = snapshots.map((s) => s.price as number)
  const peakPrice = prices.length ? Math.max(...prices) : null
  const troughPrice = prices.length ? Math.min(...prices) : null

  const result: MarketTimeline = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    current_price: currentPrice,
    total_votes: topic.total_votes,
    created_at: topic.created_at,
    law_at: law?.established_at ?? null,

    events: deduped,

    days_active: daysSince(topic.created_at),
    peak_price: peakPrice,
    trough_price: troughPrice,
    price_range: peakPrice !== null && troughPrice !== null ? peakPrice - troughPrice : null,
    total_debates: (debates ?? []).length,
    total_arguments: (topArgs ?? []).length,
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}
