import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10-min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type StalemateStrength =
  | 'perfect'   // balance >= 0.95, score >= 70
  | 'locked'    // balance >= 0.85, score >= 50
  | 'contested' // balance >= 0.70, score >= 30
  | 'leaning'   // balance < 0.70

export interface StaletateTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  for_args: number
  against_args: number
  // Computed
  stalemate_score: number        // 0–100 composite
  strength: StalemateStrength
  balance: number                // 0–1: how close to 50/50
  arg_symmetry: number           // 0–1: how balanced the arguments are
  volume_weight: number          // 0–1: engagement weight
  margin: number                 // absolute distance from 50% (lower = more deadlocked)
  breaking_force: number         // net FOR votes needed to shift by 2%
  breaking_force_against: number // net AGAINST votes needed to shift by 2%
}

export interface CategoryStalemate {
  category: string
  topic_count: number
  avg_stalemate_score: number
  avg_margin: number
  perfect_count: number   // topics with strength = 'perfect'
  most_deadlocked: string | null
}

export interface StalemateStats {
  total_topics_scored: number
  perfect_deadlock_count: number  // balance >= 0.95
  avg_stalemate_score: number
  avg_margin: number
  most_deadlocked_category: string | null
  least_deadlocked_category: string | null
  /** Topic with the most equal argument split */
  most_symmetric_topic: string | null
  /** Topic requiring the most votes to break deadlock */
  hardest_to_break: string | null
  hardest_to_break_force: number
}

export interface StalemateResponse {
  topics: StaletateTopic[]
  categories: CategoryStalemate[]
  stats: StalemateStats
  generated_at: string
}

// ─── Score helpers ─────────────────────────────────────────────────────────────

function computeStalemate(t: {
  blue_pct: number
  total_votes: number
  for_args: number
  against_args: number
}): {
  stalemate_score: number
  strength: StalemateStrength
  balance: number
  arg_symmetry: number
  volume_weight: number
  margin: number
  breaking_force: number
  breaking_force_against: number
} {
  const margin = Math.abs(t.blue_pct - 50)

  // Balance: 1.0 at exactly 50/50, 0 at unanimity
  const balance = Math.max(0, 1 - margin / 50)

  // Argument symmetry: 1.0 when FOR args === AGAINST args, 0 when all one side
  const maxArgs = Math.max(t.for_args, t.against_args, 1)
  const minArgs = Math.min(t.for_args, t.against_args)
  const arg_symmetry = minArgs / maxArgs

  // Volume weight: log10 scale — caps at 1000 votes
  const volume_weight = Math.min(1, Math.log10(Math.max(1, t.total_votes)) / 3) // log10(1000) = 3

  // Composite stalemate score (0–100)
  // Balance dominates (60%) — being near 50/50 is the core signal
  // Argument symmetry (25%) — both sides are equally armed with arguments
  // Volume (15%) — a stalemate with more participants matters more
  const raw = balance * 60 + arg_symmetry * 25 + volume_weight * 15
  const stalemate_score = Math.round(Math.min(100, raw))

  // Strength classification
  const strength: StalemateStrength =
    balance >= 0.95 && stalemate_score >= 70 ? 'perfect'
    : balance >= 0.85 && stalemate_score >= 50 ? 'locked'
    : balance >= 0.70 && stalemate_score >= 30 ? 'contested'
    : 'leaning'

  // Breaking force: net FOR votes needed to push FOR% up by 2 points
  // formula: n = V × Δ / (100 - target) where target = blue_pct + 2, Δ = target - blue_pct
  const targetFor = Math.min(98, t.blue_pct + 2)
  const targetAgainst = Math.max(2, t.blue_pct - 2)
  const v = Math.max(1, t.total_votes)
  const breaking_force = Math.round(v * (targetFor - t.blue_pct) / (100 - targetFor))
  const breaking_force_against = Math.round(v * (t.blue_pct - targetAgainst) / targetAgainst)

  return {
    stalemate_score,
    strength,
    balance: Math.round(balance * 1000) / 1000,
    arg_symmetry: Math.round(arg_symmetry * 1000) / 1000,
    volume_weight: Math.round(volume_weight * 1000) / 1000,
    margin: Math.round(margin * 10) / 10,
    breaking_force: Math.max(1, breaking_force),
    breaking_force_against: Math.max(1, breaking_force_against),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // 1. Fetch topics with enough votes
    const { data: topicRows, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .not('total_votes', 'is', null)
      .gte('total_votes', 15)
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(300)

    if (topicErr) throw topicErr
    const topics = topicRows ?? []

    if (topics.length === 0) {
      return NextResponse.json(emptyResponse())
    }

    // 2. Fetch argument counts per topic
    const topicIds = topics.map((t) => t.id)

    const { data: argRows, error: argErr } = await supabase
      .from('arguments')
      .select('topic_id, side')
      .in('topic_id', topicIds)

    if (argErr) throw argErr
    const args = argRows ?? []

    // Build argument count map
    const argMap = new Map<string, { for_args: number; against_args: number }>()
    for (const a of args) {
      if (!argMap.has(a.topic_id)) argMap.set(a.topic_id, { for_args: 0, against_args: 0 })
      const m = argMap.get(a.topic_id)!
      if (a.side === 'blue') m.for_args++
      else m.against_args++
    }

    // 3. Compute stalemate scores
    const scored: StaletateTopic[] = topics.map((t) => {
      const { for_args, against_args } = argMap.get(t.id) ?? { for_args: 0, against_args: 0 }
      const computed = computeStalemate({
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        for_args,
        against_args,
      })
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_votes: t.total_votes ?? 0,
        blue_pct: t.blue_pct ?? 50,
        for_args,
        against_args,
        ...computed,
      }
    })

    // Sort by stalemate score descending
    scored.sort((a, b) => b.stalemate_score - a.stalemate_score)

    const top50 = scored.slice(0, 50)

    // 4. Category breakdown
    const catAgg = new Map<
      string,
      {
        count: number
        scoreSum: number
        marginSum: number
        perfectCount: number
        mostDeadlocked: StaletateTopic | null
      }
    >()

    for (const t of scored) {
      const cat = t.category ?? 'Other'
      if (!catAgg.has(cat)) {
        catAgg.set(cat, { count: 0, scoreSum: 0, marginSum: 0, perfectCount: 0, mostDeadlocked: null })
      }
      const m = catAgg.get(cat)!
      m.count++
      m.scoreSum += t.stalemate_score
      m.marginSum += t.margin
      if (t.strength === 'perfect') m.perfectCount++
      if (!m.mostDeadlocked || t.stalemate_score > m.mostDeadlocked.stalemate_score) {
        m.mostDeadlocked = t
      }
    }

    const categories: CategoryStalemate[] = Array.from(catAgg.entries())
      .map(([category, m]) => ({
        category,
        topic_count: m.count,
        avg_stalemate_score: Math.round(m.scoreSum / m.count),
        avg_margin: Math.round((m.marginSum / m.count) * 10) / 10,
        perfect_count: m.perfectCount,
        most_deadlocked: m.mostDeadlocked?.statement ?? null,
      }))
      .sort((a, b) => b.avg_stalemate_score - a.avg_stalemate_score)

    // 5. Platform stats
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const allScores = scored.map((t) => t.stalemate_score)
    const allMargins = scored.map((t) => t.margin)

    const perfectDeadlocks = scored.filter((t) => t.strength === 'perfect')
    const mostSymmetric = scored
      .slice()
      .sort((a, b) => b.arg_symmetry - a.arg_symmetry)[0]

    const hardestBreakTopics = scored.slice().sort(
      (a, b) => b.breaking_force - a.breaking_force,
    )
    const hardestTopic = hardestBreakTopics[0]

    const stats: StalemateStats = {
      total_topics_scored: scored.length,
      perfect_deadlock_count: perfectDeadlocks.length,
      avg_stalemate_score: Math.round(avg(allScores)),
      avg_margin: Math.round(avg(allMargins) * 10) / 10,
      most_deadlocked_category: categories[0]?.category ?? null,
      least_deadlocked_category: categories[categories.length - 1]?.category ?? null,
      most_symmetric_topic: mostSymmetric?.statement ?? null,
      hardest_to_break: hardestTopic?.statement ?? null,
      hardest_to_break_force: hardestTopic?.breaking_force ?? 0,
    }

    return NextResponse.json({
      topics: top50,
      categories,
      stats,
      generated_at: new Date().toISOString(),
    } satisfies StalemateResponse)
  } catch (err) {
    console.error('[/api/stalemate]', err)
    return NextResponse.json(emptyResponse(), { status: 500 })
  }
}

function emptyResponse(): StalemateResponse {
  return {
    topics: [],
    categories: [],
    stats: {
      total_topics_scored: 0,
      perfect_deadlock_count: 0,
      avg_stalemate_score: 0,
      avg_margin: 50,
      most_deadlocked_category: null,
      least_deadlocked_category: null,
      most_symmetric_topic: null,
      hardest_to_break: null,
      hardest_to_break_force: 0,
    },
    generated_at: new Date().toISOString(),
  }
}
