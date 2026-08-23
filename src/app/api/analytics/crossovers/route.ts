import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrossoverPair {
  topic_a_id: string
  topic_a_statement: string
  topic_a_category: string | null
  topic_a_status: string
  topic_b_id: string
  topic_b_statement: string
  topic_b_category: string | null
  topic_b_status: string
  correlation: number
  alignment_rate: number
  shared_voters: number
  user_vote_a: 'blue' | 'red'
  user_vote_b: 'blue' | 'red'
  crossover_type: 'bridge' | 'split'
}

export interface CrossoverData {
  bridge: CrossoverPair[]    // voted SAME on negatively-correlated topics (most independent)
  split: CrossoverPair[]     // voted DIFFERENT on positively-correlated topics
  independence_score: number // 0–100: how often the user crosses typical lines
  total_voted: number        // how many topics the user has voted on
  crossover_count: number    // total pairs that qualify
  dominant_trait: 'bridge_builder' | 'independent_thinker' | 'conventional' | 'mixed'
}

// ─── Correlation row shape ─────────────────────────────────────────────────────
interface CorrelationRow {
  topic_a_id: string
  topic_b_id: string
  shared_voters: number
  alignment_rate: number
  correlation: number
  topic_a_statement: string
  topic_a_category: string | null
  topic_a_status: string
  topic_b_statement: string
  topic_b_category: string | null
  topic_b_status: string
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  // 1. Fetch user's votes
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('topic_id, direction')
    .eq('user_id', uid)

  const votes = votesRaw ?? []
  const total_voted = votes.length

  if (total_voted < 5) {
    // Not enough data to compute crossovers
    const empty: CrossoverData = {
      bridge: [],
      split: [],
      independence_score: 0,
      total_voted,
      crossover_count: 0,
      dominant_trait: 'conventional',
    }
    return NextResponse.json(empty)
  }

  // Build a lookup: topic_id → direction
  const voteMap = new Map<string, 'blue' | 'red'>()
  for (const v of votes) {
    voteMap.set(v.topic_id, v.direction as 'blue' | 'red')
  }

  // 2. Call the topic correlations function (top 150 pairs, min 5 shared)
  const { data: corrRaw } = await supabase.rpc('get_topic_correlations', {
    p_limit: 150,
    p_min_shared: 5,
    p_category: null,
  })

  const correlations: CorrelationRow[] = corrRaw ?? []

  // 3. Find crossovers: pairs where user voted on BOTH topics
  const bridge: CrossoverPair[] = []
  const split: CrossoverPair[] = []

  for (const row of correlations) {
    const voteA = voteMap.get(row.topic_a_id)
    const voteB = voteMap.get(row.topic_b_id)
    if (!voteA || !voteB) continue

    const corr = row.correlation
    const sameDirection = voteA === voteB

    // Bridge: user voted SAME direction on topics that are NEGATIVELY correlated
    // (most users vote opposite on these — the user transcends the typical split)
    if (corr < -0.35 && sameDirection) {
      bridge.push({
        topic_a_id: row.topic_a_id,
        topic_a_statement: row.topic_a_statement,
        topic_a_category: row.topic_a_category,
        topic_a_status: row.topic_a_status,
        topic_b_id: row.topic_b_id,
        topic_b_statement: row.topic_b_statement,
        topic_b_category: row.topic_b_category,
        topic_b_status: row.topic_b_status,
        correlation: row.correlation,
        alignment_rate: row.alignment_rate,
        shared_voters: Number(row.shared_voters),
        user_vote_a: voteA,
        user_vote_b: voteB,
        crossover_type: 'bridge',
      })
    }

    // Split: user voted DIFFERENT directions on topics that are POSITIVELY correlated
    // (most users vote the same on these — the user makes a nuanced distinction)
    if (corr > 0.4 && !sameDirection) {
      split.push({
        topic_a_id: row.topic_a_id,
        topic_a_statement: row.topic_a_statement,
        topic_a_category: row.topic_a_category,
        topic_a_status: row.topic_a_status,
        topic_b_id: row.topic_b_id,
        topic_b_statement: row.topic_b_statement,
        topic_b_category: row.topic_b_category,
        topic_b_status: row.topic_b_status,
        correlation: row.correlation,
        alignment_rate: row.alignment_rate,
        shared_voters: Number(row.shared_voters),
        user_vote_a: voteA,
        user_vote_b: voteB,
        crossover_type: 'split',
      })
    }
  }

  // Sort by magnitude of correlation (most extreme first)
  bridge.sort((a, b) => a.correlation - b.correlation)  // most negative first
  split.sort((a, b) => b.correlation - a.correlation)   // most positive first

  const top_bridge = bridge.slice(0, 8)
  const top_split = split.slice(0, 8)
  const crossover_count = bridge.length + split.length

  // 4. Independence score: ratio of crossovers to total pairs the user participates in
  // Count pairs the user voted on both topics
  let paired = 0
  for (const row of correlations) {
    if (voteMap.has(row.topic_a_id) && voteMap.has(row.topic_b_id)) {
      paired++
    }
  }
  const independence_score = paired > 0
    ? Math.round(Math.min((crossover_count / paired) * 100, 100))
    : 0

  // 5. Determine dominant trait
  let dominant_trait: CrossoverData['dominant_trait']
  if (bridge.length >= 4 && bridge.length >= split.length * 1.5) {
    dominant_trait = 'bridge_builder'
  } else if (split.length >= 4 && split.length >= bridge.length * 1.5) {
    dominant_trait = 'independent_thinker'
  } else if (crossover_count === 0) {
    dominant_trait = 'conventional'
  } else {
    dominant_trait = 'mixed'
  }

  const result: CrossoverData = {
    bridge: top_bridge,
    split: top_split,
    independence_score,
    total_voted,
    crossover_count,
    dominant_trait,
  }

  return NextResponse.json(result)
}
