import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrentVector {
  id: string
  statement: string
  category: string | null
  status: string
  // Current position (same axes as /cartography)
  blue_pct: number        // X: 0–100 (% FOR)
  total_votes: number     // Y: log-scaled engagement
  // Velocity components
  dx: number              // opinion drift: recent FOR% minus all-time FOR% (–50 to +50)
  dy: number              // vote momentum: recent daily rate (votes/day, positive only)
  speed: number           // 0–1 normalized magnitude of movement
  direction: 'for' | 'against' | 'neutral'
  trend: 'rising' | 'falling' | 'stable'
  // Recent window stats
  recent_votes: number    // votes cast in last 7 days
  recent_for_pct: number  // FOR% over last 7 days (0–100, or -1 if no data)
}

export interface CurrentResponse {
  vectors: CurrentVector[]
  categories: string[]
  window_days: number
  platform: {
    fastest_for_id: string | null
    fastest_against_id: string | null
    most_active_id: string | null
    avg_speed: number
    total_moving: number   // topics with speed > 0.05
  }
  generated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function direction(dx: number): CurrentVector['direction'] {
  if (dx > 2) return 'for'
  if (dx < -2) return 'against'
  return 'neutral'
}

function trend(dy: number): CurrentVector['trend'] {
  if (dy > 2) return 'rising'
  if (dy < 0.5) return 'falling'
  return 'stable'
}

// ─── GET /api/current ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') ?? 'all'
  const WINDOW_DAYS = 7
  const MIN_TOTAL_VOTES = 10
  const MAX_TOPICS = 300

  // ── 1. Fetch topics ───────────────────────────────────────────────────────
  let topicQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_TOTAL_VOTES)
    .order('total_votes', { ascending: false })
    .limit(MAX_TOPICS)

  if (category !== 'all') {
    topicQuery = topicQuery.eq('category', category)
  }

  const { data: topicRows, error: topicErr } = await topicQuery
  if (topicErr || !topicRows?.length) {
    return NextResponse.json<CurrentResponse>({
      vectors: [],
      categories: [],
      window_days: WINDOW_DAYS,
      platform: { fastest_for_id: null, fastest_against_id: null, most_active_id: null, avg_speed: 0, total_moving: 0 },
      generated_at: new Date().toISOString(),
    })
  }

  const topicIds = topicRows.map((t) => t.id)

  // ── 2. Fetch recent votes ─────────────────────────────────────────────────
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentVotes, error: votesErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .in('topic_id', topicIds)
    .gte('created_at', windowStart)

  if (votesErr) {
    return NextResponse.json({ error: votesErr.message }, { status: 500 })
  }

  // ── 3. Aggregate recent votes per topic ───────────────────────────────────
  const voteMap = new Map<string, { blue: number; total: number }>()
  for (const row of recentVotes ?? []) {
    const existing = voteMap.get(row.topic_id) ?? { blue: 0, total: 0 }
    existing.total += 1
    if (row.side === 'blue') existing.blue += 1
    voteMap.set(row.topic_id, existing)
  }

  // ── 4. Compute velocity vectors ───────────────────────────────────────────
  const vectors: CurrentVector[] = []

  for (const topic of topicRows) {
    const current_blue_pct = topic.blue_pct ?? 50
    const total_votes = topic.total_votes ?? 0

    const recent = voteMap.get(topic.id) ?? { blue: 0, total: 0 }
    const recent_for_pct =
      recent.total > 0
        ? Math.round((recent.blue / recent.total) * 100 * 10) / 10
        : -1

    // Opinion drift: how much recent voting differs from all-time consensus
    const dx = recent.total >= 3 ? recent_for_pct - current_blue_pct : 0

    // Engagement momentum: votes per day in the window
    const dy = recent.total / WINDOW_DAYS

    vectors.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: current_blue_pct,
      total_votes,
      dx: Math.round(dx * 10) / 10,
      dy: Math.round(dy * 10) / 10,
      speed: 0, // filled after normalization
      direction: direction(dx),
      trend: trend(dy),
      recent_votes: recent.total,
      recent_for_pct,
    })
  }

  // ── 5. Normalize speed ────────────────────────────────────────────────────
  const maxDx = Math.max(...vectors.map((v) => Math.abs(v.dx)), 1)
  const maxDy = Math.max(...vectors.map((v) => v.dy), 1)

  for (const v of vectors) {
    const nx = Math.abs(v.dx) / maxDx  // 0–1
    const ny = v.dy / maxDy             // 0–1
    v.speed = Math.round(Math.sqrt((nx * nx + ny * ny) / 2) * 100) / 100
  }

  // Sort by speed desc for rendering (slower arrows rendered first)
  vectors.sort((a, b) => b.speed - a.speed)

  // ── 6. Platform summary ───────────────────────────────────────────────────
  const withRecentData = vectors.filter((v) => v.recent_votes >= 3)
  const movingThreshold = 0.1
  const moving = vectors.filter((v) => v.speed > movingThreshold)

  const fastestFor = withRecentData
    .filter((v) => v.dx > 0)
    .sort((a, b) => b.dx - a.dx)[0]

  const fastestAgainst = withRecentData
    .filter((v) => v.dx < 0)
    .sort((a, b) => a.dx - b.dx)[0]

  const mostActive = [...vectors].sort((a, b) => b.recent_votes - a.recent_votes)[0]

  const avgSpeed =
    vectors.length > 0
      ? Math.round((vectors.reduce((s, v) => s + v.speed, 0) / vectors.length) * 100) / 100
      : 0

  const categories = Array.from(
    new Set(vectors.map((v) => v.category).filter(Boolean) as string[])
  ).sort()

  return NextResponse.json<CurrentResponse>({
    vectors,
    categories,
    window_days: WINDOW_DAYS,
    platform: {
      fastest_for_id: fastestFor?.id ?? null,
      fastest_against_id: fastestAgainst?.id ?? null,
      most_active_id: mostActive?.id ?? null,
      avg_speed: avgSpeed,
      total_moving: moving.length,
    },
    generated_at: new Date().toISOString(),
  })
}
