import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InflectionTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  updated_at: string
  threshold: 50 | 60 | 67 | 75
  gap: number       // pct points to threshold (positive = approaching from below, negative = just crossed)
  direction: 'for' | 'against' // which side is winning
  zone: 'approaching' | 'at' | 'above'
}

export interface ThresholdGroup {
  threshold: 50 | 60 | 67 | 75
  label: string
  civic_meaning: string
  approaching_for: InflectionTopic[]    // within 5pt below, for-side gaining
  approaching_against: InflectionTopic[] // within 5pt above, against-side eroding
  at_threshold: InflectionTopic[]        // within ±2pt (right on the line)
  established: InflectionTopic[]         // 3-10pt above (just crossed)
  count_above: number                    // total topics at or above this threshold
}

export interface BandSlice {
  label: string
  from_pct: number
  to_pct: number
  count: number
  side: 'against_strong' | 'against_moderate' | 'contested' | 'for_moderate' | 'for_strong' | 'for_super' | 'for_landslide'
}

export interface InflectionStats {
  total_active: number
  contested: number
  strong_consensus: number
  supermajority: number
  nearing_any_threshold: number
  platform_lean: number   // 0–100 weighted average blue_pct
}

export interface InflectionResponse {
  thresholds: ThresholdGroup[]
  distribution: BandSlice[]
  most_contested: InflectionTopic[]
  stats: InflectionStats
  generated_at: string
}

// ─── Thresholds config ────────────────────────────────────────────────────────

const THRESHOLDS: Array<{
  value: 50 | 60 | 67 | 75
  label: string
  civic_meaning: string
}> = [
  {
    value: 50,
    label: 'Simple Majority',
    civic_meaning: 'The turning point — one side commands more than half. A topic that crosses 50% has a clear winner.',
  },
  {
    value: 60,
    label: 'Strong Majority',
    civic_meaning: 'A 3-in-5 consensus. This is the threshold where opposition becomes a clear minority view.',
  },
  {
    value: 67,
    label: 'Supermajority',
    civic_meaning: 'Two-thirds agreement. Constitutional changes and fundamental laws require this level of mandate.',
  },
  {
    value: 75,
    label: 'Landslide Consensus',
    civic_meaning: 'Three in four citizens agree. Near-universal civic mandate — dissent is marginal.',
  },
]

// ─── Band distribution config ─────────────────────────────────────────────────

const BANDS: Array<{
  label: string
  from_pct: number
  to_pct: number
  side: BandSlice['side']
}> = [
  { label: '0–25% For', from_pct: 0,  to_pct: 25,  side: 'against_strong' },
  { label: '25–40% For', from_pct: 25, to_pct: 40,  side: 'against_moderate' },
  { label: '40–60% For', from_pct: 40, to_pct: 60,  side: 'contested' },
  { label: '60–67% For', from_pct: 60, to_pct: 67,  side: 'for_moderate' },
  { label: '67–75% For', from_pct: 67, to_pct: 75,  side: 'for_strong' },
  { label: '75–90% For', from_pct: 75, to_pct: 90,  side: 'for_super' },
  { label: '90–100% For', from_pct: 90, to_pct: 100, side: 'for_landslide' },
]

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all active and voting topics
    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('status', ['active', 'voting', 'proposed'])
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(800)

    if (error) throw error

    const rows = (topics ?? []) as Array<{
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
      updated_at: string
    }>

    // ── Compute threshold groups ──────────────────────────────────────────────

    const thresholdGroups: ThresholdGroup[] = THRESHOLDS.map(({ value, label, civic_meaning }) => {
      const approaching_for: InflectionTopic[] = []
      const approaching_against: InflectionTopic[] = []
      const at_threshold: InflectionTopic[] = []
      const established: InflectionTopic[] = []

      for (const t of rows) {
        const pct = t.blue_pct
        const forGap  = value - pct       // positive = below threshold (approaching)

        // Check FOR side approaching/crossing
        if (Math.abs(forGap) <= 2) {
          at_threshold.push(mkTopic(t, value, forGap, 'for', 'at'))
        } else if (forGap > 2 && forGap <= 7 && pct > 50) {
          approaching_for.push(mkTopic(t, value, forGap, 'for', 'approaching'))
        } else if (forGap < -2 && forGap >= -10) {
          established.push(mkTopic(t, value, forGap, 'for', 'above'))
        }

        // Check AGAINST side approaching/crossing (mirror thresholds)
        const againstPct = 100 - pct
        const againstForGap = value - againstPct
        if (againstForGap > 2 && againstForGap <= 7 && pct < 50) {
          approaching_against.push(mkTopic(t, value, againstForGap, 'against', 'approaching'))
        }
      }

      // Sort by proximity
      approaching_for.sort((a, b) => a.gap - b.gap)
      approaching_against.sort((a, b) => a.gap - b.gap)
      at_threshold.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
      established.sort((a, b) => a.gap - b.gap)

      const count_above = rows.filter((t) => {
        const forPct = t.blue_pct
        const againstPct = 100 - forPct
        return forPct >= value || againstPct >= value
      }).length

      return {
        threshold: value,
        label,
        civic_meaning,
        approaching_for: approaching_for.slice(0, 8),
        approaching_against: approaching_against.slice(0, 8),
        at_threshold: at_threshold.slice(0, 6),
        established: established.slice(0, 8),
        count_above,
      }
    })

    // ── Distribution ──────────────────────────────────────────────────────────

    const distribution: BandSlice[] = BANDS.map((b) => ({
      ...b,
      count: rows.filter((t) => t.blue_pct >= b.from_pct && t.blue_pct < b.to_pct).length,
    }))
    // Fix last band to be inclusive of 100
    distribution[distribution.length - 1].count = rows.filter(
      (t) => t.blue_pct >= 90
    ).length

    // ── Most contested ────────────────────────────────────────────────────────

    const most_contested: InflectionTopic[] = rows
      .filter((t) => t.blue_pct >= 44 && t.blue_pct <= 56)
      .sort((a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50))
      .slice(0, 10)
      .map((t) => mkTopic(t, 50, 50 - t.blue_pct, t.blue_pct >= 50 ? 'for' : 'against', 'at'))

    // ── Stats ─────────────────────────────────────────────────────────────────

    const total_active = rows.length
    const contested = rows.filter((t) => t.blue_pct >= 45 && t.blue_pct <= 55).length
    const strong_consensus = rows.filter((t) => t.blue_pct >= 60 || t.blue_pct <= 40).length
    const supermajority = rows.filter((t) => t.blue_pct >= 67 || t.blue_pct <= 33).length
    const nearing_any_threshold = new Set([
      ...thresholdGroups.flatMap((g) => [
        ...g.approaching_for.map((t) => t.id),
        ...g.approaching_against.map((t) => t.id),
        ...g.at_threshold.map((t) => t.id),
      ]),
    ]).size

    const platform_lean =
      total_active > 0
        ? Math.round(rows.reduce((sum, t) => sum + t.blue_pct, 0) / total_active)
        : 50

    const stats: InflectionStats = {
      total_active,
      contested,
      strong_consensus,
      supermajority,
      nearing_any_threshold,
      platform_lean,
    }

    return NextResponse.json({
      thresholds: thresholdGroups,
      distribution,
      most_contested,
      stats,
      generated_at: new Date().toISOString(),
    } satisfies InflectionResponse)
  } catch (err) {
    console.error('[inflection]', err)
    return NextResponse.json({ error: 'Failed to compute inflection data' }, { status: 500 })
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function mkTopic(
  t: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number; updated_at: string },
  threshold: 50 | 60 | 67 | 75,
  gap: number,
  direction: 'for' | 'against',
  zone: 'approaching' | 'at' | 'above',
): InflectionTopic {
  return {
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct,
    total_votes: t.total_votes,
    updated_at: t.updated_at,
    threshold,
    gap: Math.round(Math.abs(gap) * 10) / 10,
    direction,
    zone,
  }
}
