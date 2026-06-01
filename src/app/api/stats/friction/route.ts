import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900 // 15 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FrictionTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  /** Days since the topic was created */
  days_active: number
  /** 0–100: how close to 50/50 (100 = exact deadlock) */
  stuck_factor: number
  /** Composite friction score (higher = more resistant to resolution) */
  friction_score: number
}

export interface CategoryFriction {
  category: string
  topic_count: number
  avg_friction: number
  avg_stuck_factor: number
  avg_days_active: number
  /** The single highest-friction topic in this category */
  top_topic: FrictionTopic | null
}

export interface FrictionStats {
  /** 0–100: platform-wide friction index (weighted avg friction of active topics) */
  platform_friction_index: number
  /** Number of topics with friction_score > threshold */
  high_friction_count: number
  /** Avg days active across all live topics */
  avg_days_active: number
  /** % of live topics that are within ±10pt of 50/50 */
  pct_deadlocked: number
  total_active: number
}

export interface FrictionResponse {
  stats: FrictionStats
  top_friction: FrictionTopic[]
  category_breakdown: CategoryFriction[]
  extreme_deadlocks: FrictionTopic[]   // closest to exactly 50/50 with most votes
  long_runners: FrictionTopic[]        // oldest topics still unresolved
  generated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeFriction(topic: {
  blue_pct: number
  total_votes: number
  created_at: string
}): { days_active: number; stuck_factor: number; friction_score: number } {
  const now = Date.now()
  const created = new Date(topic.created_at).getTime()
  const days_active = Math.max(1, (now - created) / (1000 * 60 * 60 * 24))

  // stuck_factor: 1.0 at exactly 50%, 0 at 100% consensus
  const stuck_factor = Math.max(0, 1 - Math.abs(topic.blue_pct - 50) / 50) * 100

  // friction_score: votes × stuckness × age (sqrt to avoid runaway)
  const friction_score = (topic.total_votes * (stuck_factor / 100) * Math.sqrt(days_active)) / 100

  return {
    days_active: Math.round(days_active),
    stuck_factor: Math.round(stuck_factor),
    friction_score: Math.round(friction_score * 10) / 10,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: rawTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(1000)

  if (!rawTopics || rawTopics.length === 0) {
    const empty: FrictionResponse = {
      stats: {
        platform_friction_index: 0,
        high_friction_count: 0,
        avg_days_active: 0,
        pct_deadlocked: 0,
        total_active: 0,
      },
      top_friction: [],
      category_breakdown: [],
      extreme_deadlocks: [],
      long_runners: [],
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  // Compute friction for every topic
  const topics: FrictionTopic[] = rawTopics.map((t) => {
    const { days_active, stuck_factor, friction_score } = computeFriction(t)
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      created_at: t.created_at,
      days_active,
      stuck_factor,
      friction_score,
    }
  })

  // ── Platform stats ──────────────────────────────────────────────────────────
  const highFrictionThreshold = 10 // friction_score > 10 = "high friction"
  const high_friction_count = topics.filter((t) => t.friction_score > highFrictionThreshold).length
  const pct_deadlocked = Math.round(
    (topics.filter((t) => t.stuck_factor >= 80).length / topics.length) * 100
  )
  const avg_days_active = Math.round(
    topics.reduce((s, t) => s + t.days_active, 0) / topics.length
  )

  // Platform friction index: weighted average friction score normalised to 0–100
  const maxPossibleFriction = Math.max(...topics.map((t) => t.friction_score), 1)
  const rawIndex =
    topics.reduce((s, t) => s + t.friction_score, 0) / topics.length
  const platform_friction_index = Math.min(100, Math.round((rawIndex / maxPossibleFriction) * 100))

  const stats: FrictionStats = {
    platform_friction_index,
    high_friction_count,
    avg_days_active,
    pct_deadlocked,
    total_active: topics.length,
  }

  // ── Top friction topics ─────────────────────────────────────────────────────
  const top_friction = [...topics]
    .sort((a, b) => b.friction_score - a.friction_score)
    .slice(0, 12)

  // ── Extreme deadlocks (closest to 50/50 with ≥30 votes) ────────────────────
  const extreme_deadlocks = [...topics]
    .filter((t) => t.total_votes >= 30)
    .sort((a, b) => {
      const distA = Math.abs(a.blue_pct - 50)
      const distB = Math.abs(b.blue_pct - 50)
      return distA - distB // ascending: closest to 50 first
    })
    .slice(0, 8)

  // ── Long runners (oldest unresolved, ≥10 votes) ────────────────────────────
  const long_runners = [...topics]
    .filter((t) => t.total_votes >= 10)
    .sort((a, b) => b.days_active - a.days_active)
    .slice(0, 8)

  // ── Category breakdown ──────────────────────────────────────────────────────
  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  const catMap: Record<string, FrictionTopic[]> = {}
  for (const cat of CATEGORIES) catMap[cat] = []

  for (const t of topics) {
    const cat = t.category ?? 'Other'
    if (catMap[cat]) catMap[cat].push(t)
  }

  const category_breakdown: CategoryFriction[] = CATEGORIES
    .filter((cat) => catMap[cat].length > 0)
    .map((cat) => {
      const catTopics = catMap[cat]
      const sortedByFriction = [...catTopics].sort((a, b) => b.friction_score - a.friction_score)
      const avg_friction = catTopics.reduce((s, t) => s + t.friction_score, 0) / catTopics.length
      const avg_stuck = catTopics.reduce((s, t) => s + t.stuck_factor, 0) / catTopics.length
      const avg_days = catTopics.reduce((s, t) => s + t.days_active, 0) / catTopics.length
      return {
        category: cat,
        topic_count: catTopics.length,
        avg_friction: Math.round(avg_friction * 10) / 10,
        avg_stuck_factor: Math.round(avg_stuck),
        avg_days_active: Math.round(avg_days),
        top_topic: sortedByFriction[0] ?? null,
      }
    })
    .sort((a, b) => b.avg_friction - a.avg_friction)

  return NextResponse.json({
    stats,
    top_friction,
    category_breakdown,
    extreme_deadlocks,
    long_runners,
    generated_at: new Date().toISOString(),
  } satisfies FrictionResponse)
}
