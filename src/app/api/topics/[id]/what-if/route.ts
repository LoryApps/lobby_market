import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatIfCorrelatedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  correlation: number
  alignment_rate: number
  shared_voters: number
  direction: 'aligned' | 'opposed'
  // Projected shifts
  projected_shift_if_pass: number   // how much blue_pct would shift if topic passes (FOR wins)
  projected_shift_if_fail: number   // how much blue_pct would shift if topic fails (AGAINST wins)
}

export interface WhatIfChainTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  connector: 'but' | 'and' | null
  chain_depth: number
  // Which scenario unlocks this chain?
  activated_by: 'pass' | 'fail' | 'either'
}

export interface WhatIfScenarioEffect {
  type: 'consensus_shift' | 'chain_unlock' | 'coalition_impact' | 'category_ripple' | 'precedent'
  label: string
  description: string
  magnitude: 'low' | 'medium' | 'high'
  direction: 'positive' | 'negative' | 'neutral'
}

export interface WhatIfResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
    voting_ends_at: string | null
    scope: string
    chain_depth: number
  }
  correlated: WhatIfCorrelatedTopic[]
  chains: WhatIfChainTopic[]
  category_topics: {
    id: string
    statement: string
    blue_pct: number
    total_votes: number
    status: string
  }[]
  scenarios: {
    pass: {
      probability: number
      label: string
      tagline: string
      effects: WhatIfScenarioEffect[]
      consensus_shift: number    // net platform consensus shift (positive = more FOR across platform)
    }
    fail: {
      probability: number
      label: string
      tagline: string
      effects: WhatIfScenarioEffect[]
      consensus_shift: number
    }
  }
  has_correlation_data: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// Estimate how much a correlated topic's blue_pct would shift given a signal topic's outcome
function projectShift(correlation: number, signalMagnitude: number): number {
  // correlation: -1 to 1
  // signalMagnitude: 0–50 (how much the signal topic's vote would shift from neutral)
  return clamp(correlation * signalMagnitude * 0.6, -25, 25)
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // 1. Fetch the topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, voting_ends_at, scope, chain_depth')
    .eq('id', id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // 2. Fetch correlated topics via the existing RPC
  let correlated: WhatIfCorrelatedTopic[] = []
  let hasCorrelationData = false

  const { data: corrData, error: corrError } = await supabase.rpc('get_topic_correlations', {
    p_limit: 200,
    p_min_shared: 3,
    p_category: null,
  })

  if (!corrError && corrData) {
    hasCorrelationData = true
    type RawPair = {
      topic_a_id: string
      topic_b_id: string
      shared_voters: string | number
      alignment_rate: number
      correlation: number
      topic_a_statement: string
      topic_a_category: string | null
      topic_a_status: string
      topic_a_blue_pct: number
      topic_a_total_votes: string | number
      topic_b_statement: string
      topic_b_category: string | null
      topic_b_status: string
      topic_b_blue_pct: number
      topic_b_total_votes: string | number
    }

    // How far the signal topic is from neutral (50/50)
    const signalMagnitude = Math.abs((topic.blue_pct ?? 50) - 50)

    correlated = (corrData as RawPair[])
      .filter(row => row.topic_a_id === id || row.topic_b_id === id)
      .filter(row => Math.abs(row.correlation) >= 0.15)
      .map(row => {
        const isA = row.topic_a_id === id
        const otherId = isA ? row.topic_b_id : row.topic_a_id
        const statement = isA ? row.topic_b_statement : row.topic_a_statement
        const category = isA ? row.topic_b_category : row.topic_a_category
        const status = isA ? row.topic_b_status : row.topic_a_status
        const bluePct = isA ? (row.topic_b_blue_pct ?? 50) : (row.topic_a_blue_pct ?? 50)
        const totalVotes = Number(isA ? row.topic_b_total_votes : row.topic_a_total_votes)
        const correlation = isA ? row.correlation : row.correlation
        const direction = correlation > 0 ? 'aligned' : 'opposed'

        // If FOR wins (pass): aligned topics get a positive push, opposed get negative
        const shiftIfPass = projectShift(correlation, signalMagnitude + 15)
        // If AGAINST wins (fail): reverse direction
        const shiftIfFail = projectShift(-correlation, signalMagnitude + 15)

        return {
          id: otherId,
          statement,
          category,
          status,
          blue_pct: bluePct,
          total_votes: totalVotes,
          correlation,
          alignment_rate: row.alignment_rate,
          shared_voters: Number(row.shared_voters),
          direction,
          projected_shift_if_pass: shiftIfPass,
          projected_shift_if_fail: shiftIfFail,
        } satisfies WhatIfCorrelatedTopic
      })
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 12)
  }

  // 3. Fetch chain topics (children of this topic)
  const { data: chainTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, connector, chain_depth')
    .eq('parent_id', id)
    .order('chain_depth', { ascending: true })
    .limit(8)

  const chains: WhatIfChainTopic[] = (chainTopics ?? []).map(ct => {
    // "AND" chains typically expand on the parent — activated more by passing
    // "BUT" chains typically oppose or complicate — activated more by failing
    const activatedBy: 'pass' | 'fail' | 'either' =
      ct.connector === 'and' ? 'pass' : ct.connector === 'but' ? 'fail' : 'either'
    return {
      ...ct,
      connector: (ct.connector as 'but' | 'and' | null) ?? null,
      activated_by: activatedBy,
    }
  })

  // 4. Fetch sibling/category topics for context
  const { data: catTopics } = await supabase
    .from('topics')
    .select('id, statement, blue_pct, total_votes, status')
    .eq('category', topic.category ?? '')
    .neq('id', id)
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(5)

  // 5. Build scenario effects
  const currentFor = topic.blue_pct ?? 50
  const currentAgainst = 100 - currentFor

  const passEffects: WhatIfScenarioEffect[] = []
  const failEffects: WhatIfScenarioEffect[] = []

  // Consensus shift effect
  const alignedCount = correlated.filter(c => c.direction === 'aligned').length
  const opposedCount = correlated.filter(c => c.direction === 'opposed').length

  if (alignedCount > 0) {
    passEffects.push({
      type: 'consensus_shift',
      label: `${alignedCount} aligned debate${alignedCount !== 1 ? 's' : ''} shift FOR`,
      description: `Topics that track this one ideologically would see increased FOR support if this passes — creating a civic momentum cascade.`,
      magnitude: alignedCount >= 4 ? 'high' : alignedCount >= 2 ? 'medium' : 'low',
      direction: 'positive',
    })
  }

  if (opposedCount > 0) {
    passEffects.push({
      type: 'consensus_shift',
      label: `${opposedCount} opposed debate${opposedCount !== 1 ? 's' : ''} shift AGAINST`,
      description: `Topics that run counter to this one would face increased resistance — the opposite camp loses ground across multiple fronts.`,
      magnitude: opposedCount >= 4 ? 'high' : opposedCount >= 2 ? 'medium' : 'low',
      direction: 'negative',
    })
  }

  // Chain unlock effect
  const passChains = chains.filter(c => c.activated_by === 'pass' || c.activated_by === 'either')
  const failChains = chains.filter(c => c.activated_by === 'fail' || c.activated_by === 'either')

  if (passChains.length > 0) {
    passEffects.push({
      type: 'chain_unlock',
      label: `${passChains.length} chain topic${passChains.length !== 1 ? 's' : ''} activated`,
      description: `Passing this topic would energize connected "AND" debates in the chain — expanding the legislative agenda in this direction.`,
      magnitude: passChains.length >= 3 ? 'high' : passChains.length >= 2 ? 'medium' : 'low',
      direction: 'positive',
    })
  }

  if (failChains.length > 0) {
    failEffects.push({
      type: 'chain_unlock',
      label: `${failChains.length} "BUT" debate${failChains.length !== 1 ? 's' : ''} gains urgency`,
      description: `Defeating this topic would strengthen the counter-arguments in "BUT" chain debates — the opposition's alternative agenda gains legitimacy.`,
      magnitude: failChains.length >= 3 ? 'high' : failChains.length >= 2 ? 'medium' : 'low',
      direction: 'positive',
    })
  }

  // Category ripple effect
  if (topic.category && (catTopics?.length ?? 0) > 0) {
    passEffects.push({
      type: 'category_ripple',
      label: `${topic.category} category gains momentum`,
      description: `A FOR victory here would signal ideological momentum in the ${topic.category} space — expect more proposals and higher engagement in this category.`,
      magnitude: currentFor >= 60 ? 'high' : currentFor >= 55 ? 'medium' : 'low',
      direction: 'positive',
    })
    failEffects.push({
      type: 'category_ripple',
      label: `${topic.category} category faces headwinds`,
      description: `A defeat here would cast doubt on the consensus trajectory in ${topic.category} — reformers may reframe or retreat before re-proposing.`,
      magnitude: currentAgainst >= 60 ? 'high' : currentAgainst >= 55 ? 'medium' : 'low',
      direction: 'negative',
    })
  }

  // Precedent effect
  if (topic.status === 'law') {
    passEffects.push({
      type: 'precedent',
      label: 'Established as Law — sets binding precedent',
      description: 'This topic has already passed into law. Its existence sets a precedent that makes similar proposals more likely to succeed.',
      magnitude: 'high',
      direction: 'positive',
    })
  } else if (topic.total_votes >= 1000) {
    passEffects.push({
      type: 'precedent',
      label: 'High-engagement topic sets strong precedent',
      description: `With ${topic.total_votes.toLocaleString()} votes, a FOR outcome here would be cited as a clear mandate — hard for the Lobby to ignore or reverse.`,
      magnitude: 'high',
      direction: 'positive',
    })
    failEffects.push({
      type: 'precedent',
      label: 'High engagement means failure is definitive',
      description: `With ${topic.total_votes.toLocaleString()} votes, a defeat here would be seen as a decisive rejection — similar proposals would face steep uphill battles.`,
      magnitude: 'high',
      direction: 'negative',
    })
  }

  // Build fail-side effects from aligned/opposed perspectives
  if (opposedCount > 0) {
    failEffects.push({
      type: 'consensus_shift',
      label: `${opposedCount} opposed debate${opposedCount !== 1 ? 's' : ''} shift FOR`,
      description: `Topics that run counter to this one would gain momentum from a defeat here — the opposition wins ground across ideologically linked debates.`,
      magnitude: opposedCount >= 4 ? 'high' : opposedCount >= 2 ? 'medium' : 'low',
      direction: 'positive',
    })
  }

  if (alignedCount > 0) {
    failEffects.push({
      type: 'consensus_shift',
      label: `${alignedCount} aligned debate${alignedCount !== 1 ? 's' : ''} shift AGAINST`,
      description: `Topics that move with this one would face increased AGAINST pressure — the ideological bloc loses solidarity across the platform.`,
      magnitude: alignedCount >= 4 ? 'high' : alignedCount >= 2 ? 'medium' : 'low',
      direction: 'negative',
    })
  }

  // 6. Compute net consensus shift
  const passNetShift = correlated.reduce((sum, c) => sum + c.projected_shift_if_pass, 0)
  const failNetShift = correlated.reduce((sum, c) => sum + c.projected_shift_if_fail, 0)

  // 7. Build probability estimates (rough heuristic)
  const passProbability = clamp(
    (currentFor - 50) * 1.5 + 50 + (topic.total_votes >= 500 ? 5 : 0),
    5,
    95
  )
  const failProbability = 100 - passProbability

  const response: WhatIfResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      created_at: topic.created_at,
      voting_ends_at: topic.voting_ends_at ?? null,
      scope: topic.scope ?? 'Global',
      chain_depth: topic.chain_depth ?? 0,
    },
    correlated,
    chains,
    category_topics: (catTopics ?? []).map(t => ({
      id: t.id,
      statement: t.statement,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      status: t.status,
    })),
    scenarios: {
      pass: {
        probability: Math.round(passProbability),
        label: 'If FOR Wins',
        tagline: currentFor >= 55
          ? 'The likely path — what cascades from here?'
          : 'An upset — what shifts if the majority prevails?',
        effects: passEffects,
        consensus_shift: Math.round(passNetShift * 10) / 10,
      },
      fail: {
        probability: Math.round(failProbability),
        label: 'If AGAINST Wins',
        tagline: currentAgainst >= 55
          ? 'The likely path — what cascades from here?'
          : 'An upset — what shifts if opposition prevails?',
        effects: failEffects,
        consensus_shift: Math.round(failNetShift * 10) / 10,
      },
    },
    has_correlation_data: hasCorrelationData,
  }

  return NextResponse.json(response)
}
