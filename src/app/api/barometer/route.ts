import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryBar {
  category: string
  topics: number
  avg_blue_pct: number          // 0–100 weighted by total_votes
  total_votes: number
  law_rate: number               // % of resolved topics that became law
  active_topics: number
  drift_24h: number             // avg FOR% change in last 24h (null if unknown)
  mood: 'for' | 'balanced' | 'against'
}

export interface BarometerReading {
  // Overall platform sentiment
  overall_blue_pct: number       // weighted avg FOR% across all active+voting topics
  total_active_votes: number
  active_topics: number
  mood: 'strongly_for' | 'leaning_for' | 'balanced' | 'leaning_against' | 'strongly_against'
  mood_label: string

  // 24h trend: positive = drifting FOR, negative = drifting AGAINST
  drift_24h: number | null

  // Category breakdown
  categories: CategoryBar[]

  // Extremes
  most_for_topic: { id: string; statement: string; blue_pct: number; category: string | null } | null
  most_against_topic: { id: string; statement: string; blue_pct: number; category: string | null } | null
  most_balanced_topic: { id: string; statement: string; blue_pct: number; category: string | null } | null

  // Platform stats snapshot
  total_laws: number
  total_failed: number
  law_rate: number   // % of resolved topics that became law

  generated_at: string
}

// ─── Mood helpers ─────────────────────────────────────────────────────────────

function getMood(pct: number): BarometerReading['mood'] {
  if (pct >= 70) return 'strongly_for'
  if (pct >= 56) return 'leaning_for'
  if (pct >= 44) return 'balanced'
  if (pct >= 30) return 'leaning_against'
  return 'strongly_against'
}

function getMoodLabel(mood: BarometerReading['mood']): string {
  switch (mood) {
    case 'strongly_for':     return 'Strong FOR Majority'
    case 'leaning_for':      return 'Leaning FOR'
    case 'balanced':         return 'Divided & Balanced'
    case 'leaning_against':  return 'Leaning AGAINST'
    case 'strongly_against': return 'Strong AGAINST Majority'
  }
}

function getCategoryMood(pct: number): CategoryBar['mood'] {
  if (pct >= 55) return 'for'
  if (pct <= 45) return 'against'
  return 'balanced'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // ── 1. Active + voting topics ──────────────────────────────────────────────
    const { data: activeTopics, error: activeErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .gt('total_votes', 0)
      .order('total_votes', { ascending: false })
      .limit(500)

    if (activeErr) throw activeErr

    const topics = activeTopics ?? []

    // Weighted average FOR%
    const totalVotes = topics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
    const weightedBlue = topics.reduce((s, t) => s + (t.blue_pct ?? 50) * (t.total_votes ?? 0), 0)
    const overallBlue = totalVotes > 0 ? weightedBlue / totalVotes : 50

    // ── 2. Category breakdown ──────────────────────────────────────────────────
    const catMap = new Map<string, { topics: typeof topics; totalVotes: number; weightedBlue: number }>()

    for (const t of topics) {
      const cat = t.category ?? 'Other'
      if (!catMap.has(cat)) catMap.set(cat, { topics: [], totalVotes: 0, weightedBlue: 0 })
      const entry = catMap.get(cat)!
      entry.topics.push(t)
      entry.totalVotes += t.total_votes ?? 0
      entry.weightedBlue += (t.blue_pct ?? 50) * (t.total_votes ?? 0)
    }

    // ── 3. Resolved topics for law_rate ───────────────────────────────────────
    const { data: resolvedRows } = await supabase
      .from('topics')
      .select('id, status, category')
      .in('status', ['law', 'failed'])
      .limit(2000)

    const resolved = resolvedRows ?? []
    const totalResolved = resolved.length
    const totalLaws = resolved.filter((t) => t.status === 'law').length
    const totalFailed = resolved.filter((t) => t.status === 'failed').length
    const platformLawRate = totalResolved > 0 ? Math.round((totalLaws / totalResolved) * 100) : 0

    // Law rate per category
    const catResolved = new Map<string, { law: number; failed: number }>()
    for (const t of resolved) {
      const cat = t.category ?? 'Other'
      if (!catResolved.has(cat)) catResolved.set(cat, { law: 0, failed: 0 })
      const e = catResolved.get(cat)!
      if (t.status === 'law') e.law++
      else e.failed++
    }

    // ── 4. 24h drift: compare recent voters to overall ─────────────────────────
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentVotes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .gte('created_at', since24h)
      .limit(10000)

    let drift24h: number | null = null

    if (recentVotes && recentVotes.length >= 10) {
      const recentFor = recentVotes.filter((v) => v.side === 'blue').length
      const recentPct = (recentFor / recentVotes.length) * 100
      drift24h = parseFloat((recentPct - overallBlue).toFixed(1))
    }

    // ── 5. Build category bars ─────────────────────────────────────────────────
    const ORDERED_CATS = [
      'Politics', 'Economics', 'Technology', 'Science',
      'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education', 'Other',
    ]

    const categories: CategoryBar[] = ORDERED_CATS.flatMap((cat) => {
      const entry = catMap.get(cat)
      if (!entry || entry.totalVotes === 0) return []
      const avgBlue = entry.totalVotes > 0 ? entry.weightedBlue / entry.totalVotes : 50
      const res = catResolved.get(cat) ?? { law: 0, failed: 0 }
      const resTotal = res.law + res.failed
      return [{
        category: cat,
        topics: entry.topics.length,
        avg_blue_pct: parseFloat(avgBlue.toFixed(1)),
        total_votes: entry.totalVotes,
        law_rate: resTotal > 0 ? Math.round((res.law / resTotal) * 100) : 0,
        active_topics: entry.topics.filter((t) => t.status === 'active' || t.status === 'voting').length,
        drift_24h: 0,  // per-category drift requires join — skip for perf
        mood: getCategoryMood(avgBlue),
      }]
    })

    // ── 6. Extremes ────────────────────────────────────────────────────────────
    const sorted = [...topics].sort((a, b) => (b.blue_pct ?? 50) - (a.blue_pct ?? 50))
    const mostFor = sorted[0] ?? null
    const mostAgainst = sorted[sorted.length - 1] ?? null

    const balancedCandidates = [...topics]
      .filter((t) => t.total_votes >= 5)
      .sort((a, b) => Math.abs((a.blue_pct ?? 50) - 50) - Math.abs((b.blue_pct ?? 50) - 50))
    const mostBalanced = balancedCandidates[0] ?? null

    const mood = getMood(overallBlue)

    const reading: BarometerReading = {
      overall_blue_pct: parseFloat(overallBlue.toFixed(1)),
      total_active_votes: totalVotes,
      active_topics: topics.length,
      mood,
      mood_label: getMoodLabel(mood),
      drift_24h: drift24h,
      categories,
      most_for_topic: mostFor
        ? { id: mostFor.id, statement: mostFor.statement, blue_pct: mostFor.blue_pct ?? 50, category: mostFor.category }
        : null,
      most_against_topic: mostAgainst
        ? { id: mostAgainst.id, statement: mostAgainst.statement, blue_pct: mostAgainst.blue_pct ?? 50, category: mostAgainst.category }
        : null,
      most_balanced_topic: mostBalanced
        ? { id: mostBalanced.id, statement: mostBalanced.statement, blue_pct: mostBalanced.blue_pct ?? 50, category: mostBalanced.category }
        : null,
      total_laws: totalLaws,
      total_failed: totalFailed,
      law_rate: platformLawRate,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(reading)
  } catch (err) {
    console.error('[barometer]', err)
    return NextResponse.json({ error: 'Failed to compute barometer reading' }, { status: 500 })
  }
}
