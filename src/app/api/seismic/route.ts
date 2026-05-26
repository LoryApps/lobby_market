import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeismicEvent {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  updated_at: string
  // Anomaly metrics
  magnitude: number         // 0–10 Richter-style score
  recent_votes: number      // votes in last 2h window
  baseline_rate: number     // avg votes/hour over last 7 days
  current_rate: number      // votes/hour over last 2h
  multiplier: number        // current_rate / baseline_rate
  hours_since_spike: number // how long ago the anomaly started
  event_type: 'quake' | 'aftershock' | 'rumble'
}

export interface SeismicResponse {
  quakes: SeismicEvent[]        // magnitude ≥ 6 — full seismic events
  aftershocks: SeismicEvent[]   // magnitude 3–5.9 — settling from a quake
  rumbles: SeismicEvent[]       // magnitude 1–2.9 — low-level unusual activity
  platform_stats: {
    active_quakes: number
    highest_magnitude: number
    most_affected_category: string | null
    total_anomalies: number
    baseline_topics: number
  }
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMagnitude(multiplier: number, recent_votes: number): number {
  if (multiplier <= 1 || recent_votes < 2) return 0
  // Log-scale magnitude inspired by Richter: log10(multiplier) * 5, capped at 10
  const raw = Math.log10(Math.max(1, multiplier)) * 5 + Math.log10(Math.max(1, recent_votes)) * 0.8
  return Math.min(10, Math.round(raw * 10) / 10)
}

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch all active/voting topics created in last 90 days
  const { data: topics, error } = await supabase
    .from('topics')
    .select(
      'id, statement, category, status, scope, blue_pct, total_votes, view_count, created_at, updated_at'
    )
    .in('status', ['active', 'voting', 'proposed'])
    .gte('created_at', new Date(Date.now() - 90 * 24 * 3_600_000).toISOString())
    .order('total_votes', { ascending: false })
    .limit(300)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!topics || topics.length === 0) {
    const empty: SeismicResponse = {
      quakes: [],
      aftershocks: [],
      rumbles: [],
      platform_stats: {
        active_quakes: 0,
        highest_magnitude: 0,
        most_affected_category: null,
        total_anomalies: 0,
        baseline_topics: 0,
      },
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  // Fetch recent argument counts per topic for 2h and 48h windows
  const topicIds = topics.map((t) => t.id)
  const now = new Date()
  const twoHoursAgo = new Date(now.getTime() - 2 * 3_600_000).toISOString()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 3_600_000).toISOString()


  // Get vote counts split by recency windows using argument timestamps as proxy
  // Since we don't have granular vote timestamps in the API, we approximate using
  // updated_at (changes when votes come in) and the age of the topic.
  // For topics updated very recently (last 2h), we estimate the burst.
  const { data: recentArgs } = await supabase
    .from('topic_arguments')
    .select('topic_id, created_at')
    .in('topic_id', topicIds.slice(0, 100))
    .gte('created_at', fortyEightHoursAgo)

  // Group argument counts by topic (2h window for the burst signal)
  const argCounts2h: Record<string, number> = {}
  for (const arg of recentArgs ?? []) {
    if (arg.created_at >= twoHoursAgo) {
      const topicId = arg.topic_id as string
      argCounts2h[topicId] = (argCounts2h[topicId] ?? 0) + 1
    }
  }

  // Enrich topics with anomaly metrics
  const enriched: SeismicEvent[] = []

  for (const t of topics) {
    const ageHours = Math.max(0.25, hoursAgo(t.created_at))
    const hoursUpdated = hoursAgo(t.updated_at)

    // Baseline: average votes per hour over full lifetime
    const baseline_rate = t.total_votes / ageHours

    // Estimate recent vote rate using updated_at heuristic:
    // If updated very recently (< 2h), assume some burst activity.
    // Use argument density as a corroborating signal.
    const args_2h = argCounts2h[t.id] ?? 0

    // Recent rate estimate: if the topic was updated in last 2h, weight it higher
    // Use a heuristic: recent_votes ≈ baseline_rate * recency_boost
    const recency_factor = Math.max(0, 2 - hoursUpdated) / 2 // 1 if just updated, 0 if >2h ago
    const arg_signal = args_2h * 3 // each recent argument suggests ~3 votes
    const recent_votes = Math.max(
      0,
      Math.round(baseline_rate * 2 * recency_factor + arg_signal)
    )
    const current_rate = recent_votes / 2 // per hour over 2h window

    // Anomaly ratio
    const multiplier = baseline_rate > 0.05 ? current_rate / baseline_rate : current_rate > 0 ? 5 : 1

    const magnitude = computeMagnitude(multiplier, recent_votes)

    if (magnitude < 0.5) continue

    let event_type: SeismicEvent['event_type']
    if (magnitude >= 6) event_type = 'quake'
    else if (magnitude >= 3) event_type = 'aftershock'
    else event_type = 'rumble'

    enriched.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      scope: (t as { scope?: string | null }).scope ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      view_count: t.view_count ?? 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
      magnitude,
      recent_votes,
      baseline_rate: Math.round(baseline_rate * 100) / 100,
      current_rate: Math.round(current_rate * 100) / 100,
      multiplier: Math.round(multiplier * 10) / 10,
      hours_since_spike: Math.round(hoursUpdated * 10) / 10,
      event_type,
    })
  }

  // Sort by magnitude descending
  enriched.sort((a, b) => b.magnitude - a.magnitude)

  const quakes = enriched.filter((e) => e.event_type === 'quake').slice(0, 10)
  const aftershocks = enriched.filter((e) => e.event_type === 'aftershock').slice(0, 12)
  const rumbles = enriched.filter((e) => e.event_type === 'rumble').slice(0, 10)

  // Platform stats
  const catCounts: Record<string, number> = {}
  for (const e of enriched) {
    if (e.category) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1
  }
  const most_affected_category =
    Object.keys(catCounts).length > 0
      ? Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null

  const response: SeismicResponse = {
    quakes,
    aftershocks,
    rumbles,
    platform_stats: {
      active_quakes: quakes.length,
      highest_magnitude: enriched[0]?.magnitude ?? 0,
      most_affected_category,
      total_anomalies: enriched.length,
      baseline_topics: topics.length,
    },
    generated_at: now.toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
  })
}
