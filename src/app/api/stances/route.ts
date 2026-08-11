import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 300 // 5 minutes

export interface CategoryStance {
  category: string
  topicCount: number
  totalVotes: number
  avgBluePct: number
  /** Weighted average (by votes) — more representative than simple avg */
  weightedBluePct: number
  /** Standard deviation of blue_pct across topics in the category */
  polarization: number
  statusBreakdown: {
    proposed: number
    active: number
    voting: number
    law: number
    failed: number
  }
}

export interface StancesTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface StancesResponse {
  platform: {
    totalTopics: number
    totalVotes: number
    weightedBluePct: number
    statusBreakdown: {
      proposed: number
      active: number
      voting: number
      law: number
      failed: number
    }
  }
  categories: CategoryStance[]
  polarized: StancesTopic[]
  unanimous: StancesTopic[]
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .not('status', 'eq', 'draft')
      .gt('total_votes', 0)
      .order('total_votes', { ascending: false })
      .limit(5000)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
    }

    const rows = topics ?? []

    // ── Platform-wide aggregates ──────────────────────────────────────────────
    const statusBreakdown = { proposed: 0, active: 0, voting: 0, law: 0, failed: 0 }
    let totalWeightedFor = 0
    let totalVotesAll = 0

    for (const t of rows) {
      const v = t.total_votes ?? 0
      const pct = t.blue_pct ?? 50
      totalWeightedFor += pct * v
      totalVotesAll += v

      const s = t.status as keyof typeof statusBreakdown
      if (s in statusBreakdown) statusBreakdown[s]++
    }

    const platformWeightedBluePct = totalVotesAll > 0
      ? Math.round((totalWeightedFor / totalVotesAll) * 10) / 10
      : 50

    // ── Per-category aggregates ───────────────────────────────────────────────
    const catMap = new Map<string, {
      topics: { pct: number; votes: number; status: string }[]
    }>()

    for (const t of rows) {
      const cat = t.category ?? 'Uncategorized'
      if (!catMap.has(cat)) catMap.set(cat, { topics: [] })
      catMap.get(cat)!.topics.push({
        pct: t.blue_pct ?? 50,
        votes: t.total_votes ?? 0,
        status: t.status,
      })
    }

    const categories: CategoryStance[] = Array.from(catMap.entries())
      .map(([category, { topics: ts }]) => {
        const totalVotes = ts.reduce((s, t) => s + t.votes, 0)
        const avgBluePct = ts.reduce((s, t) => s + t.pct, 0) / ts.length
        const weightedBluePct = totalVotes > 0
          ? ts.reduce((s, t) => s + t.pct * t.votes, 0) / totalVotes
          : avgBluePct

        // Std dev of blue_pct values
        const mean = avgBluePct
        const variance = ts.reduce((s, t) => s + Math.pow(t.pct - mean, 2), 0) / ts.length
        const polarization = Math.sqrt(variance)

        const sb = { proposed: 0, active: 0, voting: 0, law: 0, failed: 0 }
        for (const t of ts) {
          const s = t.status as keyof typeof sb
          if (s in sb) sb[s]++
        }

        return {
          category,
          topicCount: ts.length,
          totalVotes,
          avgBluePct: Math.round(avgBluePct * 10) / 10,
          weightedBluePct: Math.round(weightedBluePct * 10) / 10,
          polarization: Math.round(polarization * 10) / 10,
          statusBreakdown: sb,
        }
      })
      .sort((a, b) => b.totalVotes - a.totalVotes)

    // ── Most polarized — closest to 50/50 among topics with >= 50 votes ──────
    const polarized: StancesTopic[] = rows
      .filter(t => (t.total_votes ?? 0) >= 50)
      .map(t => ({ ...t, _dist: Math.abs((t.blue_pct ?? 50) - 50) }))
      .sort((a, b) => (a as any)._dist - (b as any)._dist)
      .slice(0, 10)
      .map(({ _dist: _d, ...t }) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
      }))

    // ── Most unanimous — farthest from 50/50 among topics with >= 50 votes ───
    const unanimous: StancesTopic[] = rows
      .filter(t => (t.total_votes ?? 0) >= 50)
      .map(t => ({ ...t, _dist: Math.abs((t.blue_pct ?? 50) - 50) }))
      .sort((a, b) => (b as any)._dist - (a as any)._dist)
      .slice(0, 10)
      .map(({ _dist: _d, ...t }) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
      }))

    return NextResponse.json({
      platform: {
        totalTopics: rows.length,
        totalVotes: totalVotesAll,
        weightedBluePct: platformWeightedBluePct,
        statusBreakdown,
      },
      categories,
      polarized,
      unanimous,
    } satisfies StancesResponse, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
