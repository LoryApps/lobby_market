import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationBucket {
  label: string
  min_price: number
  max_price: number
  predicted_avg: number
  actual_win_rate: number | null
  count: number
}

export interface CategoryPerformance {
  category: string
  total: number
  wins: number
  losses: number
  pushes: number
  win_rate: number | null
  brier_score: number | null
  avg_entry_price: number
  net_pnl: number
}

export interface StanceGroup {
  total: number
  wins: number
  losses: number
  win_rate: number | null
}

export interface RecentResult {
  topic_id: string
  statement: string
  category: string | null
  settled_at: string
  outcome: 'win' | 'loss' | 'push'
  side: 'blue' | 'red'
  entry_price: number
  status: string
}

export interface PerformanceResponse {
  total_predictions: number
  settled_predictions: number
  open_predictions: number

  // Accuracy
  brier_score: number | null
  win_rate: number | null

  // Calibration
  calibration_buckets: CalibrationBucket[]

  // By category
  by_category: CategoryPerformance[]

  // By stance (contrarian / consensus / neutral)
  contrarian: StanceGroup   // voted opposite to crowd majority (>10 pts away from 50)
  consensus: StanceGroup    // voted with crowd majority
  neutral: StanceGroup      // voted in contested zone (45–55%)

  // Streaks (over settled predictions, chronological)
  current_streak: number       // +N = win streak, -N = loss streak
  best_win_streak: number
  worst_loss_streak: number

  // Naive benchmarks (based on settled predictions only)
  naive_always_for_win_rate: number | null
  naive_always_against_win_rate: number | null

  // Trajectory — last 20 settled
  recent_form: RecentResult[]

  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brierScore(predictions: Array<{ prob: number; outcome: number }>): number | null {
  if (predictions.length === 0) return null
  const sum = predictions.reduce((acc, { prob, outcome }) => acc + (prob - outcome) ** 2, 0)
  return Math.round((sum / predictions.length) * 10000) / 10000
}

function winRate(wins: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((wins / total) * 1000) / 10
}

// ─── GET /api/exchange/performance ───────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load all user votes joined with topic data
    const { data: votes, error } = await supabase
      .from('votes')
      .select(`
        topic_id,
        side,
        created_at,
        topics!inner (
          id,
          statement,
          category,
          status,
          blue_pct,
          total_votes,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(500)

    if (error || !votes) {
      return NextResponse.json({ error: 'Failed to load votes' }, { status: 500 })
    }

    // Load price history for all voted topics
    const topicIds = [...new Set(votes.map((v) => v.topic_id))]

    const { data: priceHistory } = topicIds.length > 0
      ? await supabase
          .from('topic_price_history')
          .select('topic_id, price, recorded_at')
          .in('topic_id', topicIds)
          .order('recorded_at', { ascending: true })
      : { data: [] }

    const historyByTopic = new Map<string, Array<{ price: number; recorded_at: string }>>()
    for (const row of priceHistory ?? []) {
      const key = row.topic_id as string
      if (!historyByTopic.has(key)) historyByTopic.set(key, [])
      historyByTopic.get(key)!.push({ price: row.price as number, recorded_at: row.recorded_at as string })
    }

    // ── Build enriched positions ───────────────────────────────────────────

    interface Position {
      topic_id: string
      statement: string
      category: string | null
      status: string
      side: 'blue' | 'red'
      voted_at: string
      updated_at: string
      entry_price: number
      current_price: number
      is_settled: boolean
      outcome: 'win' | 'loss' | 'push'
      prob: number       // probability of the user's prediction being correct, at entry
    }

    const positions: Position[] = []

    for (const vote of votes) {
      const topic = Array.isArray(vote.topics) ? vote.topics[0] : vote.topics
      if (!topic) continue

      const votedAt = new Date(vote.created_at).getTime()
      const history = historyByTopic.get(vote.topic_id) ?? []

      let entryPrice = 50
      if (history.length > 0) {
        const before = [...history]
          .filter((h) => new Date(h.recorded_at).getTime() <= votedAt)
          .pop()
        const after = history.find((h) => new Date(h.recorded_at).getTime() > votedAt)
        if (before) entryPrice = before.price
        else if (after) entryPrice = after.price
        else entryPrice = history[0].price
      }

      const side = vote.side as 'blue' | 'red'
      const status = (topic as { status: string }).status
      const currentPrice = (topic as { blue_pct: number | null }).blue_pct ?? 50
      const isSettled = status === 'law' || status === 'failed'

      // prob = user's stated confidence that their side wins
      // If voted blue: prob = entry_price / 100 (consensus that it'll pass)
      // If voted red: prob = 1 - entry_price / 100 (consensus it'll fail)
      const prob = side === 'blue' ? entryPrice / 100 : (100 - entryPrice) / 100

      let outcome: 'win' | 'loss' | 'push' = 'push'
      if (isSettled) {
        if ((status === 'law' && side === 'blue') || (status === 'failed' && side === 'red')) {
          outcome = 'win'
        } else if ((status === 'law' && side === 'red') || (status === 'failed' && side === 'blue')) {
          outcome = 'loss'
        }
      }

      positions.push({
        topic_id: vote.topic_id,
        statement: (topic as { statement: string }).statement,
        category: (topic as { category: string | null }).category,
        status,
        side,
        voted_at: vote.created_at,
        updated_at: (topic as { updated_at: string }).updated_at ?? vote.created_at,
        entry_price: Math.round(entryPrice * 10) / 10,
        current_price: Math.round(currentPrice * 10) / 10,
        is_settled: isSettled,
        outcome,
        prob,
      })
    }

    const settled = positions.filter((p) => p.is_settled)
    const open = positions.filter((p) => !p.is_settled)

    // ── Brier Score ───────────────────────────────────────────────────────
    const brierInputs = settled.map((p) => ({
      prob: p.prob,
      outcome: p.outcome === 'win' ? 1 : p.outcome === 'loss' ? 0 : 0.5,
    }))
    const bs = brierScore(brierInputs)

    // Win rate (pushes excluded)
    const decidedSettled = settled.filter((p) => p.outcome !== 'push')
    const wins = decidedSettled.filter((p) => p.outcome === 'win').length
    const wr = winRate(wins, decidedSettled.length)

    // ── Calibration buckets ───────────────────────────────────────────────
    const BUCKETS: Array<{ label: string; min: number; max: number }> = [
      { label: 'Very confident AGAINST (0–20%)', min: 0, max: 20 },
      { label: 'Leaning AGAINST (20–40%)', min: 20, max: 40 },
      { label: 'Contested (40–60%)', min: 40, max: 60 },
      { label: 'Leaning FOR (60–80%)', min: 60, max: 80 },
      { label: 'Very confident FOR (80–100%)', min: 80, max: 100 },
    ]

    const calibration_buckets: CalibrationBucket[] = BUCKETS.map(({ label, min, max }) => {
      // Bucket by user's implied confidence (prob * 100)
      const inBucket = settled.filter((p) => {
        const conf = p.prob * 100
        return conf >= min && conf < max
      })
      const w = inBucket.filter((p) => p.outcome === 'win').length
      const predictedAvg =
        inBucket.length > 0
          ? inBucket.reduce((sum, p) => sum + p.prob * 100, 0) / inBucket.length
          : (min + max) / 2
      return {
        label,
        min_price: min,
        max_price: max,
        predicted_avg: Math.round(predictedAvg * 10) / 10,
        actual_win_rate: inBucket.length > 0 ? Math.round((w / inBucket.length) * 1000) / 10 : null,
        count: inBucket.length,
      }
    })

    // ── By category ───────────────────────────────────────────────────────
    const catMap = new Map<string, Position[]>()
    for (const p of settled) {
      const cat = p.category ?? 'Other'
      if (!catMap.has(cat)) catMap.set(cat, [])
      catMap.get(cat)!.push(p)
    }

    const by_category: CategoryPerformance[] = [...catMap.entries()]
      .map(([category, ps]) => {
        const decided = ps.filter((p) => p.outcome !== 'push')
        const w = decided.filter((p) => p.outcome === 'win').length
        const l = decided.filter((p) => p.outcome === 'loss').length
        const bsInputs = ps.map((p) => ({
          prob: p.prob,
          outcome: p.outcome === 'win' ? 1 : p.outcome === 'loss' ? 0 : 0.5,
        }))
        const netPnl = ps.reduce((sum, p) => {
          const pnl = p.side === 'blue'
            ? p.current_price - p.entry_price
            : p.entry_price - p.current_price
          return sum + pnl
        }, 0)
        return {
          category,
          total: ps.length,
          wins: w,
          losses: l,
          pushes: ps.length - w - l,
          win_rate: winRate(w, decided.length),
          brier_score: brierScore(bsInputs),
          avg_entry_price: Math.round(ps.reduce((s, p) => s + p.entry_price, 0) / ps.length * 10) / 10,
          net_pnl: Math.round(netPnl * 10) / 10,
        }
      })
      .sort((a, b) => b.total - a.total)

    // ── By stance ─────────────────────────────────────────────────────────
    // Contrarian: voted against the crowd (prob < 0.45 — was in minority)
    // Consensus:  voted with the crowd (prob > 0.60 — was in majority)
    // Neutral:    in the contested zone
    function stanceGroup(filter: (p: Position) => boolean): StanceGroup {
      const ps = settled.filter(filter).filter((p) => p.outcome !== 'push')
      const w = ps.filter((p) => p.outcome === 'win').length
      return {
        total: ps.length,
        wins: w,
        losses: ps.length - w,
        win_rate: winRate(w, ps.length),
      }
    }

    const contrarian = stanceGroup((p) => p.prob < 0.45)
    const consensus  = stanceGroup((p) => p.prob > 0.60)
    const neutral    = stanceGroup((p) => p.prob >= 0.45 && p.prob <= 0.60)

    // ── Streaks (chronological) ───────────────────────────────────────────
    const chronoSettled = [...settled]
      .filter((p) => p.outcome !== 'push')
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())

    let currentStreak = 0
    let bestWin = 0
    let worstLoss = 0
    let tempStreak = 0
    for (const p of chronoSettled) {
      if (p.outcome === 'win') {
        tempStreak = tempStreak >= 0 ? tempStreak + 1 : 1
      } else {
        tempStreak = tempStreak <= 0 ? tempStreak - 1 : -1
      }
      if (tempStreak > bestWin) bestWin = tempStreak
      if (tempStreak < worstLoss) worstLoss = tempStreak
    }
    currentStreak = tempStreak

    // ── Naive benchmarks ─────────────────────────────────────────────────
    // "Always FOR" wins when topic becomes law
    const alwaysForWins = settled.filter((p) => p.status === 'law' && p.outcome !== 'push').length
    const alwaysForTotal = settled.filter((p) => p.outcome !== 'push').length
    const naiveAlwaysFor = winRate(alwaysForWins, alwaysForTotal)

    // "Always AGAINST" wins when topic fails
    const alwaysAgainstWins = settled.filter((p) => p.status === 'failed' && p.outcome !== 'push').length
    const naiveAlwaysAgainst = winRate(alwaysAgainstWins, alwaysForTotal)

    // ── Recent form (last 20 settled, newest first) ───────────────────────
    const recent_form: RecentResult[] = [...settled]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 20)
      .map((p) => ({
        topic_id: p.topic_id,
        statement: p.statement,
        category: p.category,
        settled_at: p.updated_at,
        outcome: p.outcome,
        side: p.side,
        entry_price: p.entry_price,
        status: p.status,
      }))

    const response: PerformanceResponse = {
      total_predictions: positions.length,
      settled_predictions: settled.length,
      open_predictions: open.length,
      brier_score: bs,
      win_rate: wr,
      calibration_buckets,
      by_category,
      contrarian,
      consensus,
      neutral,
      current_streak: currentStreak,
      best_win_streak: bestWin,
      worst_loss_streak: worstLoss,
      naive_always_for_win_rate: naiveAlwaysFor,
      naive_always_against_win_rate: naiveAlwaysAgainst,
      recent_form,
      as_of: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/exchange/performance]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
