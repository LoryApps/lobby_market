import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraderPosition {
  topic_id: string
  statement: string
  category: string | null
  status: string
  side: 'blue' | 'red'
  current_price: number
  voted_at: string
}

export interface SmartTrader {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  settled_total: number
  settled_correct: number
  win_rate: number | null
  accuracy_grade: 'S' | 'A' | 'B' | 'C' | 'D' | null
  best_category: string | null
  positions: TraderPosition[]
}

export interface ConsensusSignal {
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  for_count: number
  against_count: number
  conviction: 'strong_for' | 'strong_against' | 'split'
  signal_strength: number
  traders: Array<{
    username: string
    avatar_url: string | null
    side: 'blue' | 'red'
  }>
}

export interface SmartMoneyResponse {
  top_traders: SmartTrader[]
  consensus_signals: ConsensusSignal[]
  aggregate: {
    total_active_positions: number
    for_positions: number
    against_positions: number
    avg_win_rate: number | null
    top_category: string | null
  }
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function accuracyGrade(winRate: number | null): SmartTrader['accuracy_grade'] {
  if (winRate === null) return null
  if (winRate >= 0.75) return 'S'
  if (winRate >= 0.65) return 'A'
  if (winRate >= 0.55) return 'B'
  if (winRate >= 0.45) return 'C'
  return 'D'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Fetch the top 25 profiles by reputation + clout
    const { data: topProfiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .or('reputation_score.gt.0,clout.gt.0')
      .order('reputation_score', { ascending: false })
      .order('clout', { ascending: false })
      .limit(25)

    if (profileErr || !topProfiles || topProfiles.length === 0) {
      return NextResponse.json({ error: 'No traders found' }, { status: 404 })
    }

    const traderIds = topProfiles.map((p) => p.id)

    // 2. Fetch settled votes for these traders (used to compute win rate)
    const { data: settledVotes } = await supabase
      .from('votes')
      .select('user_id, side, topics!inner(status, category)')
      .in('user_id', traderIds)
      .in('topics.status', ['law', 'failed'])

    // 3. Fetch active/voting positions for these traders
    const { data: activeVotes } = await supabase
      .from('votes')
      .select('user_id, side, created_at, topics!inner(id, statement, category, status, blue_pct, total_votes)')
      .in('user_id', traderIds)
      .in('topics.status', ['active', 'voting'])
      .order('created_at', { ascending: false })

    // ── Compute per-trader stats ───────────────────────────────────────────

    const settledByUser: Record<string, { total: number; correct: number; categories: Record<string, { correct: number; total: number }> }> = {}
    for (const v of (settledVotes ?? [])) {
      const topic = v.topics as unknown as { status: string; category: string | null }
      if (!topic) continue
      const uid = v.user_id as string
      if (!settledByUser[uid]) settledByUser[uid] = { total: 0, correct: 0, categories: {} }
      settledByUser[uid].total++
      const isCorrect =
        (v.side === 'blue' && topic.status === 'law') ||
        (v.side === 'red' && topic.status === 'failed')
      if (isCorrect) settledByUser[uid].correct++
      // Track category accuracy
      const cat = topic.category ?? 'Other'
      if (!settledByUser[uid].categories[cat]) settledByUser[uid].categories[cat] = { correct: 0, total: 0 }
      settledByUser[uid].categories[cat].total++
      if (isCorrect) settledByUser[uid].categories[cat].correct++
    }

    // Group active positions by user
    const activeByUser: Record<string, TraderPosition[]> = {}
    for (const v of (activeVotes ?? [])) {
      const topic = v.topics as unknown as {
        id: string; statement: string; category: string | null
        status: string; blue_pct: number; total_votes: number
      }
      if (!topic) continue
      const uid = v.user_id as string
      if (!activeByUser[uid]) activeByUser[uid] = []
      // Only keep most recent position per topic per user
      if (activeByUser[uid].some((p) => p.topic_id === topic.id)) continue
      activeByUser[uid].push({
        topic_id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        side: v.side as 'blue' | 'red',
        current_price: topic.blue_pct ?? 50,
        voted_at: v.created_at as string,
      })
    }

    // Build trader objects (only include traders who have active positions)
    const top_traders: SmartTrader[] = topProfiles
      .map((p) => {
        const stats = settledByUser[p.id] ?? { total: 0, correct: 0, categories: {} }
        const winRate = stats.total >= 3 ? stats.correct / stats.total : null

        // Find best category (highest win rate with min 2 settled)
        let best_category: string | null = null
        let bestCatWr = -1
        for (const [cat, catStats] of Object.entries(stats.categories)) {
          if (catStats.total >= 2) {
            const wr = catStats.correct / catStats.total
            if (wr > bestCatWr) { bestCatWr = wr; best_category = cat }
          }
        }

        return {
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role,
          clout: p.clout ?? 0,
          reputation_score: p.reputation_score ?? 0,
          settled_total: stats.total,
          settled_correct: stats.correct,
          win_rate: winRate,
          accuracy_grade: accuracyGrade(winRate),
          best_category,
          positions: (activeByUser[p.id] ?? []).slice(0, 8),
        }
      })
      .filter((t) => t.positions.length > 0 || t.settled_total >= 3)
      .slice(0, 15)

    // ── Consensus Signals ──────────────────────────────────────────────────
    // Markets where 3+ top traders have voted the same direction

    const topicVotes: Record<string, {
      topic_id: string; statement: string; category: string | null
      status: string; current_price: number
      for_traders: Array<{ username: string; avatar_url: string | null }>
      against_traders: Array<{ username: string; avatar_url: string | null }>
    }> = {}

    // Only consider positions from traders with accuracy_grade S/A/B or high clout
    const qualifiedTraderIds = new Set(
      top_traders
        .filter((t) => t.accuracy_grade === 'S' || t.accuracy_grade === 'A' || t.accuracy_grade === 'B' || t.clout > 50)
        .map((t) => t.id)
    )

    for (const t of top_traders) {
      if (!qualifiedTraderIds.has(t.id)) continue
      for (const pos of t.positions) {
        if (!topicVotes[pos.topic_id]) {
          topicVotes[pos.topic_id] = {
            topic_id: pos.topic_id,
            statement: pos.statement,
            category: pos.category,
            status: pos.status,
            current_price: pos.current_price,
            for_traders: [],
            against_traders: [],
          }
        }
        const entry = topicVotes[pos.topic_id]
        if (pos.side === 'blue') {
          entry.for_traders.push({ username: t.username, avatar_url: t.avatar_url })
        } else {
          entry.against_traders.push({ username: t.username, avatar_url: t.avatar_url })
        }
      }
    }

    const consensus_signals: ConsensusSignal[] = Object.values(topicVotes)
      .filter((t) => (t.for_traders.length + t.against_traders.length) >= 2)
      .map((t) => {
        const forCount = t.for_traders.length
        const againstCount = t.against_traders.length
        const total = forCount + againstCount
        const conviction: ConsensusSignal['conviction'] =
          forCount >= againstCount * 2
            ? 'strong_for'
            : againstCount >= forCount * 2
            ? 'strong_against'
            : 'split'
        const signal_strength = Math.round((Math.max(forCount, againstCount) / total) * 100)
        const traders = [
          ...t.for_traders.map((tr) => ({ ...tr, side: 'blue' as const })),
          ...t.against_traders.map((tr) => ({ ...tr, side: 'red' as const })),
        ]
        return {
          topic_id: t.topic_id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: t.current_price,
          for_count: forCount,
          against_count: againstCount,
          conviction,
          signal_strength,
          traders,
        }
      })
      .sort((a, b) => b.signal_strength - a.signal_strength || (b.for_count + b.against_count) - (a.for_count + a.against_count))
      .slice(0, 10)

    // ── Aggregate stats ────────────────────────────────────────────────────

    const allPositions = top_traders.flatMap((t) => t.positions)
    const forPositions = allPositions.filter((p) => p.side === 'blue').length
    const againstPositions = allPositions.filter((p) => p.side === 'red').length

    const tradersWithWr = top_traders.filter((t) => t.win_rate !== null)
    const avgWinRate =
      tradersWithWr.length > 0
        ? tradersWithWr.reduce((sum, t) => sum + t.win_rate!, 0) / tradersWithWr.length
        : null

    // Most common category across active positions
    const catCounts: Record<string, number> = {}
    for (const pos of allPositions) {
      if (pos.category) catCounts[pos.category] = (catCounts[pos.category] ?? 0) + 1
    }
    const top_category =
      Object.keys(catCounts).length > 0
        ? Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null

    const response: SmartMoneyResponse = {
      top_traders,
      consensus_signals,
      aggregate: {
        total_active_positions: allPositions.length,
        for_positions: forPositions,
        against_positions: againstPositions,
        avg_win_rate: avgWinRate,
        top_category,
      },
      as_of: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[smart-money]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
