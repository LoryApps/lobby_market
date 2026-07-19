import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityEventType =
  | 'market_created'
  | 'price_milestone'
  | 'volume_milestone'
  | 'argument'
  | 'commentary'
  | 'phase_transition'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  timestamp: string
  // Price milestone
  price?: number
  prev_price?: number
  // Volume milestone
  volume?: number
  // Argument
  argument?: {
    id: string
    body: string
    side: 'for' | 'against'
    upvotes: number
    author_username: string
    author_display_name: string | null
    author_avatar_url: string | null
  }
  // Commentary
  commentary?: {
    id: string
    content: string
    direction: 'for' | 'against' | 'neutral' | null
    likes: number
    author_username: string
    author_display_name: string | null
    author_avatar_url: string | null
  }
  // Phase transition
  from_status?: string
  to_status?: string
  label?: string
}

export interface ActivityResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    volume: number
  }
  events: ActivityEvent[]
  total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRICE_MILESTONES = [25, 33, 50, 60, 67, 75, 90]
const VOLUME_MILESTONES = [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000]

function detectPriceMilestones(
  history: Array<{ price: number; volume: number; recorded_at: string }>,
): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const crossed = new Set<number>()

  let prev = history[0]?.price ?? 50

  for (const snap of history) {
    for (const milestone of PRICE_MILESTONES) {
      if (!crossed.has(milestone)) {
        const crossedUp = prev < milestone && snap.price >= milestone
        const crossedDown = prev > milestone && snap.price <= milestone
        if (crossedUp || crossedDown) {
          crossed.add(milestone)
          events.push({
            id: `price_${milestone}_${snap.recorded_at}`,
            type: 'price_milestone',
            timestamp: snap.recorded_at,
            price: snap.price,
            prev_price: prev,
            label: crossedUp
              ? `Price crossed ${milestone}¢ upward`
              : `Price dropped below ${milestone}¢`,
          })
        }
      }
    }
    prev = snap.price
  }

  return events
}

function detectVolumeMilestones(
  history: Array<{ price: number; volume: number; recorded_at: string }>,
): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const crossed = new Set<number>()
  let prevVol = 0

  for (const snap of history) {
    for (const milestone of VOLUME_MILESTONES) {
      if (!crossed.has(milestone) && prevVol < milestone && snap.volume >= milestone) {
        crossed.add(milestone)
        events.push({
          id: `volume_${milestone}_${snap.recorded_at}`,
          type: 'volume_milestone',
          timestamp: snap.recorded_at,
          volume: milestone,
          label: `${milestone.toLocaleString()} votes cast`,
        })
      }
    }
    prevVol = snap.volume
  }

  return events
}

// ─── GET /api/exchange/[id]/activity ─────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60', 10), 120)

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

  const allEvents: ActivityEvent[] = []

  // ── 2. Market Created event ───────────────────────────────────────────────
  allEvents.push({
    id: 'market_created',
    type: 'market_created',
    timestamp: topic.created_at,
    label: 'Market opened for trading',
  })

  // ── 3. Price history → milestones ─────────────────────────────────────────
  if (filter === 'all' || filter === 'price') {
    const { data: priceHistory } = await supabase
      .from('topic_price_history')
      .select('price, volume, recorded_at')
      .eq('topic_id', id)
      .order('recorded_at', { ascending: true })
      .limit(500)

    if (priceHistory && priceHistory.length > 0) {
      allEvents.push(...detectPriceMilestones(priceHistory))
      allEvents.push(...detectVolumeMilestones(priceHistory))
    }
  }

  // ── 4. Arguments ─────────────────────────────────────────────────────────
  if (filter === 'all' || filter === 'argument') {
    const { data: args } = await supabase
      .from('topic_arguments')
      .select(`
        id, side, content, upvotes, created_at,
        author:profiles!topic_arguments_user_id_fkey(
          username, display_name, avatar_url
        )
      `)
      .eq('topic_id', id)
      .order('created_at', { ascending: false })
      .limit(40)

    for (const arg of args ?? []) {
      const author = (arg.author as Record<string, unknown> | null) ?? {}
      allEvents.push({
        id: `arg_${arg.id}`,
        type: 'argument',
        timestamp: arg.created_at as string,
        argument: {
          id: arg.id as string,
          body: arg.content as string,
          side: (arg.side as string) === 'blue' ? 'for' : 'against',
          upvotes: (arg.upvotes as number) ?? 0,
          author_username: (author.username as string) ?? 'anonymous',
          author_display_name: (author.display_name as string | null) ?? null,
          author_avatar_url: (author.avatar_url as string | null) ?? null,
        },
      })
    }
  }

  // ── 5. Commentary ─────────────────────────────────────────────────────────
  if (filter === 'all' || filter === 'commentary') {
    const { data: commentary } = await supabase
      .from('market_commentary')
      .select(`
        id, content, direction, likes, created_at,
        author:profiles!user_id(
          username, display_name, avatar_url
        )
      `)
      .eq('topic_id', id)
      .order('created_at', { ascending: false })
      .limit(40)

    for (const note of commentary ?? []) {
      const author = (note.author as Record<string, unknown> | null) ?? {}
      allEvents.push({
        id: `commentary_${note.id}`,
        type: 'commentary',
        timestamp: note.created_at as string,
        commentary: {
          id: note.id as string,
          content: note.content as string,
          direction: (note.direction as 'for' | 'against' | 'neutral' | null) ?? null,
          likes: (note.likes as number) ?? 0,
          author_username: (author.username as string) ?? 'anonymous',
          author_display_name: (author.display_name as string | null) ?? null,
          author_avatar_url: (author.avatar_url as string | null) ?? null,
        },
      })
    }
  }

  // ── 6. Phase transition (infer from status) ───────────────────────────────
  if (topic.status === 'law') {
    allEvents.push({
      id: 'phase_law',
      type: 'phase_transition',
      timestamp: topic.updated_at ?? topic.created_at,
      from_status: 'voting',
      to_status: 'law',
      label: 'Market settled as LAW',
    })
  } else if (topic.status === 'failed') {
    allEvents.push({
      id: 'phase_failed',
      type: 'phase_transition',
      timestamp: topic.updated_at ?? topic.created_at,
      from_status: 'voting',
      to_status: 'failed',
      label: 'Market settled — proposal rejected',
    })
  } else if (topic.status === 'voting') {
    allEvents.push({
      id: 'phase_voting',
      type: 'phase_transition',
      timestamp: topic.updated_at ?? topic.created_at,
      from_status: 'active',
      to_status: 'voting',
      label: 'Market entered voting phase',
    })
  }

  // ── 7. Sort newest-first, cap ─────────────────────────────────────────────
  allEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const events = allEvents.slice(0, limit)

  const response: ActivityResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price: topic.blue_pct ?? 50,
      volume: topic.total_votes ?? 0,
    },
    events,
    total: allEvents.length,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  })
}
