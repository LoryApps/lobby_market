import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyPortfolioSummary {
  total_positions: number
  open_positions: number
  today_pnl: number          // sum of (current - entry) for open positions today
  winning_today: number      // positions moving in user's favour
  losing_today: number       // positions moving against user
  best_today: { id: string; statement: string; pnl: number } | null
  worst_today: { id: string; statement: string; pnl: number } | null
}

export interface DailyMover {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  open_price: number
  delta: number        // percentage points change today
  volume: number
  is_near_law: boolean
}

export interface DailyLawWatch {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  ends_at: string | null
  hours_left: number | null
  voted_side: 'blue' | 'red' | null
}

export interface DailyEvent {
  type: 'became_law' | 'failed' | 'entered_voting' | 'big_move_up' | 'big_move_down'
  id: string
  statement: string
  category: string | null
  price: number
  detail: string
}

export interface DailyForYou {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  is_hot: boolean
  reason: string
}

export interface DailyBriefResponse {
  date: string
  portfolio: DailyPortfolioSummary | null
  top_gainers: DailyMover[]
  top_losers: DailyMover[]
  law_watch: DailyLawWatch[]
  events: DailyEvent[]
  for_you: DailyForYou[]
  market_stats: {
    total_active: number
    in_voting: number
    laws_today: number
    total_volume_today: number
    avg_consensus: number
  }
  as_of: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()
  const as_of = new Date().toISOString()

  // ── 1. Market stats ────────────────────────────────────────────────────────

  const { data: allTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, ends_at, feed_score, created_at, updated_at')
    .neq('status', 'proposed')
    .order('total_votes', { ascending: false })
    .limit(500)

  const topics = allTopics ?? []

  const activeTopics = topics.filter((t) => t.status === 'active')
  const votingTopics = topics.filter((t) => t.status === 'voting')
  const todayLaws = topics.filter(
    (t) =>
      t.status === 'law' &&
      t.updated_at &&
      new Date(t.updated_at) >= todayStart
  )

  const market_stats = {
    total_active: activeTopics.length,
    in_voting: votingTopics.length,
    laws_today: todayLaws.length,
    total_volume_today: 0,
    avg_consensus: Math.round(
      topics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / Math.max(topics.length, 1)
    ),
  }

  // ── 2. Price history for movers ───────────────────────────────────────────

  const { data: priceRows } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .gte('recorded_at', todayIso)
    .order('recorded_at', { ascending: true })

  // Group price history by topic
  const priceByTopic = new Map<string, { open: number; close: number }>()
  for (const row of priceRows ?? []) {
    const existing = priceByTopic.get(row.topic_id)
    if (!existing) {
      priceByTopic.set(row.topic_id, { open: row.price, close: row.price })
    } else {
      existing.close = row.price
    }
  }

  // Build mover list
  const movers: DailyMover[] = []
  for (const topic of topics) {
    if (topic.status !== 'active' && topic.status !== 'voting') continue
    const history = priceByTopic.get(topic.id)
    const currentPrice = Math.round(topic.blue_pct ?? 50)
    const openPrice = history ? Math.round(history.open) : currentPrice
    const delta = currentPrice - openPrice
    if (Math.abs(delta) < 0.5) continue

    movers.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_price: currentPrice,
      open_price: openPrice,
      delta,
      volume: topic.total_votes ?? 0,
      is_near_law: currentPrice >= 60 && topic.status === 'active',
    })
  }

  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const top_gainers = movers.filter((m) => m.delta > 0).slice(0, 6)
  const top_losers = movers.filter((m) => m.delta < 0).slice(0, 6)

  // ── 3. Law watch ──────────────────────────────────────────────────────────

  // Get user's votes to overlay on law watch
  const votedTopicIds = new Set<string>()
  const votedSides = new Map<string, 'blue' | 'red'>()
  if (user) {
    const { data: votes } = await supabase
      .from('votes')
      .select('topic_id, vote_type')
      .eq('user_id', user.id)
    for (const v of votes ?? []) {
      votedTopicIds.add(v.topic_id)
      votedSides.set(v.topic_id, v.vote_type === 'blue' ? 'blue' : 'red')
    }
  }

  const law_watch: DailyLawWatch[] = votingTopics
    .map((t) => {
      let hours_left: number | null = null
      if (t.ends_at) {
        const diff = new Date(t.ends_at).getTime() - Date.now()
        hours_left = Math.max(0, Math.round(diff / 3_600_000))
      }
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: Math.round(t.blue_pct ?? 50),
        total_votes: t.total_votes ?? 0,
        ends_at: t.ends_at,
        hours_left,
        voted_side: votedSides.get(t.id) ?? null,
      }
    })
    .sort((a, b) => (a.hours_left ?? 9999) - (b.hours_left ?? 9999))
    .slice(0, 8)

  // ── 4. Today's events ─────────────────────────────────────────────────────

  const events: DailyEvent[] = []

  for (const t of todayLaws.slice(0, 3)) {
    events.push({
      type: 'became_law',
      id: t.id,
      statement: t.statement,
      category: t.category,
      price: Math.round(t.blue_pct ?? 100),
      detail: `Established law — ${Math.round(t.blue_pct ?? 100)}% consensus`,
    })
  }

  const todayFailed = topics.filter(
    (t) =>
      t.status === 'failed' &&
      t.updated_at &&
      new Date(t.updated_at) >= todayStart
  )
  for (const t of todayFailed.slice(0, 2)) {
    events.push({
      type: 'failed',
      id: t.id,
      statement: t.statement,
      category: t.category,
      price: Math.round(t.blue_pct ?? 0),
      detail: `Failed to pass — ${Math.round(t.blue_pct ?? 0)}% consensus`,
    })
  }

  const enteredVoting = topics.filter(
    (t) =>
      t.status === 'voting' &&
      t.updated_at &&
      new Date(t.updated_at) >= todayStart
  )
  for (const t of enteredVoting.slice(0, 3)) {
    events.push({
      type: 'entered_voting',
      id: t.id,
      statement: t.statement,
      category: t.category,
      price: Math.round(t.blue_pct ?? 50),
      detail: `Entered voting phase — ${Math.round(t.blue_pct ?? 50)}% FOR`,
    })
  }

  for (const m of top_gainers.slice(0, 2)) {
    events.push({
      type: 'big_move_up',
      id: m.id,
      statement: m.statement,
      category: m.category,
      price: m.current_price,
      detail: `+${m.delta}¢ today — now at ${m.current_price}%`,
    })
  }
  for (const m of top_losers.slice(0, 2)) {
    events.push({
      type: 'big_move_down',
      id: m.id,
      statement: m.statement,
      category: m.category,
      price: m.current_price,
      detail: `${m.delta}¢ today — now at ${m.current_price}%`,
    })
  }

  // ── 5. Portfolio summary ──────────────────────────────────────────────────

  let portfolio: DailyPortfolioSummary | null = null

  if (user) {
    const { data: votes } = await supabase
      .from('votes')
      .select('topic_id, vote_type, created_at')
      .eq('user_id', user.id)

    const openVotes = (votes ?? []).filter((v) => {
      const topic = topics.find((t) => t.id === v.topic_id)
      return topic && topic.status === 'active'
    })

    let winning_today = 0
    let losing_today = 0
    let today_pnl = 0
    let bestPnl = -Infinity
    let worstPnl = Infinity
    let bestPos: DailyPortfolioSummary['best_today'] = null
    let worstPos: DailyPortfolioSummary['worst_today'] = null

    for (const v of openVotes) {
      const topic = topics.find((t) => t.id === v.topic_id)
      if (!topic) continue
      const history = priceByTopic.get(v.topic_id)
      if (!history) continue
      const currentPrice = Math.round(topic.blue_pct ?? 50)
      const openPrice = Math.round(history.open)
      const rawDelta = currentPrice - openPrice
      const pnl = v.vote_type === 'blue' ? rawDelta : -rawDelta
      today_pnl += pnl
      if (pnl > 0) winning_today++
      else if (pnl < 0) losing_today++

      if (pnl > bestPnl) {
        bestPnl = pnl
        bestPos = { id: v.topic_id, statement: topic.statement, pnl }
      }
      if (pnl < worstPnl) {
        worstPnl = pnl
        worstPos = { id: v.topic_id, statement: topic.statement, pnl }
      }
    }

    portfolio = {
      total_positions: votes?.length ?? 0,
      open_positions: openVotes.length,
      today_pnl: Math.round(today_pnl * 10) / 10,
      winning_today,
      losing_today,
      best_today: bestPos,
      worst_today: worstPos,
    }
  }

  // ── 6. For You recommendations ────────────────────────────────────────────

  const for_you: DailyForYou[] = []

  // Near-law opportunities
  const nearLaw = activeTopics
    .filter((t) => (t.blue_pct ?? 0) >= 58 && (t.blue_pct ?? 0) < 67 && !votedTopicIds.has(t.id))
    .slice(0, 2)

  for (const t of nearLaw) {
    for_you.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: Math.round(t.blue_pct ?? 50),
      total_votes: t.total_votes ?? 0,
      is_hot: true,
      reason: 'Near-law territory — your vote counts most here',
    })
  }

  // High volume topics not voted on
  const hotUnvoted = activeTopics
    .filter((t) => !votedTopicIds.has(t.id) && (t.total_votes ?? 0) > 20)
    .slice(0, 3)

  for (const t of hotUnvoted) {
    for_you.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: Math.round(t.blue_pct ?? 50),
      total_votes: t.total_votes ?? 0,
      is_hot: !!(t.feed_score && t.feed_score > 50),
      reason: 'High-volume debate you haven\'t voted on',
    })
  }

  // Deadlocked topics (close to 50/50) — highest stakes
  const deadlocked = activeTopics
    .filter(
      (t) =>
        !votedTopicIds.has(t.id) &&
        Math.abs((t.blue_pct ?? 50) - 50) < 5 &&
        (t.total_votes ?? 0) > 10
    )
    .slice(0, 2)

  for (const t of deadlocked) {
    for_you.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: Math.round(t.blue_pct ?? 50),
      total_votes: t.total_votes ?? 0,
      is_hot: false,
      reason: 'Deadlocked debate — the deciding vote could be yours',
    })
  }

  return NextResponse.json({
    date: todayIso.slice(0, 10),
    portfolio,
    top_gainers,
    top_losers,
    law_watch,
    events,
    for_you: for_you.slice(0, 6),
    market_stats,
    as_of,
  } satisfies DailyBriefResponse)
}
