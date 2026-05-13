import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type Window = '7d' | '30d' | '90d'

export interface ConsensusShiftTopic {
  id: string
  statement: string
  category: string | null
  status: string
  // Current snapshot
  current_blue_pct: number
  total_votes: number
  // Windowed counts
  recent_blue: number
  recent_red: number
  recent_total: number
  prior_blue: number
  prior_red: number
  prior_total: number
  // Derived
  recent_blue_pct: number | null  // null = no recent votes
  prior_blue_pct: number | null   // null = no prior votes
  shift: number                   // recent - prior (positive = gaining FOR support)
  direction: 'surging' | 'declining' | 'stable'
}

export interface CategoryShift {
  category: string
  topic_count: number
  surging_count: number
  declining_count: number
  avg_shift: number
  volatility: number  // std dev of shifts
}

export interface ConsensusShiftResponse {
  window: Window
  surging: ConsensusShiftTopic[]
  declining: ConsensusShiftTopic[]
  category_shifts: CategoryShift[]
  total_topics_analysed: number
  generated_at: string
}

// ─── GET /api/analytics/consensus-shift ──────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const raw = searchParams.get('window') ?? '30d'
  const window: Window = raw === '7d' ? '7d' : raw === '90d' ? '90d' : '30d'

  const days = window === '7d' ? 7 : window === '30d' ? 30 : 90

  const supabase = await createClient()

  const now = new Date()
  const recentCutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
  // Prior window is same length, ending at recentCutoff
  const priorCutoff = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch active/voting/proposed topics with meaningful vote counts
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'proposed'])
    .gt('total_votes', 19)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (!topics || topics.length === 0) {
    return NextResponse.json({
      window,
      surging: [],
      declining: [],
      category_shifts: [],
      total_topics_analysed: 0,
      generated_at: now.toISOString(),
    } satisfies ConsensusShiftResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // Fetch votes in recent window (last N days)
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('topic_id, side')
    .in('topic_id', topicIds)
    .gte('created_at', recentCutoff)

  // Fetch votes in prior window (N-2N days ago)
  const { data: priorVotes } = await supabase
    .from('votes')
    .select('topic_id, side')
    .in('topic_id', topicIds)
    .gte('created_at', priorCutoff)
    .lt('created_at', recentCutoff)

  // Aggregate per topic
  const recentMap = new Map<string, { blue: number; red: number }>()
  const priorMap = new Map<string, { blue: number; red: number }>()

  for (const v of recentVotes ?? []) {
    const cur = recentMap.get(v.topic_id) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') { cur.blue++ } else { cur.red++ }
    recentMap.set(v.topic_id, cur)
  }
  for (const v of priorVotes ?? []) {
    const cur = priorMap.get(v.topic_id) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') { cur.blue++ } else { cur.red++ }
    priorMap.set(v.topic_id, cur)
  }

  // Build shift entries — only include topics with votes in BOTH windows
  const entries: ConsensusShiftTopic[] = []

  for (const topic of topics) {
    const rec = recentMap.get(topic.id)
    const pri = priorMap.get(topic.id)
    if (!rec || !pri) continue

    const recentTotal = rec.blue + rec.red
    const priorTotal = pri.blue + pri.red
    if (recentTotal < 3 || priorTotal < 3) continue

    const recentBluePct = (rec.blue / recentTotal) * 100
    const priorBluePct = (pri.blue / priorTotal) * 100
    const shift = recentBluePct - priorBluePct

    entries.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      recent_blue: rec.blue,
      recent_red: rec.red,
      recent_total: recentTotal,
      prior_blue: pri.blue,
      prior_red: pri.red,
      prior_total: priorTotal,
      recent_blue_pct: recentBluePct,
      prior_blue_pct: priorBluePct,
      shift,
      direction: shift > 5 ? 'surging' : shift < -5 ? 'declining' : 'stable',
    })
  }

  // Sort by absolute shift descending
  entries.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))

  const surging = entries.filter((e) => e.shift > 5).slice(0, 15)
  const declining = entries.filter((e) => e.shift < -5).slice(0, 15)

  // Category aggregation
  const catMap = new Map<string, { shifts: number[]; surging: number; declining: number }>()
  for (const e of entries) {
    const cat = e.category ?? 'Uncategorised'
    const cur = catMap.get(cat) ?? { shifts: [], surging: 0, declining: 0 }
    cur.shifts.push(e.shift)
    if (e.direction === 'surging') cur.surging++
    if (e.direction === 'declining') cur.declining++
    catMap.set(cat, cur)
  }

  const category_shifts: CategoryShift[] = Array.from(catMap.entries())
    .map(([category, data]) => {
      const n = data.shifts.length
      const avg = data.shifts.reduce((s, v) => s + v, 0) / n
      const variance = data.shifts.reduce((s, v) => s + (v - avg) ** 2, 0) / n
      return {
        category,
        topic_count: n,
        surging_count: data.surging,
        declining_count: data.declining,
        avg_shift: avg,
        volatility: Math.sqrt(variance),
      }
    })
    .sort((a, b) => b.volatility - a.volatility)

  return NextResponse.json({
    window,
    surging,
    declining,
    category_shifts,
    total_topics_analysed: entries.length,
    generated_at: now.toISOString(),
  } satisfies ConsensusShiftResponse)
}
