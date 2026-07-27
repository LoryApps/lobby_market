import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SmartSignal =
  | 'strong_bull'    // smart money ≥70% FOR, diverging from crowd
  | 'bull'           // smart money 55-70% FOR
  | 'neutral'        // 45-55% FOR
  | 'bear'           // smart money 30-45% FOR
  | 'strong_bear'    // smart money ≤30% FOR, diverging from crowd
  | 'aligned'        // smart money ≈ crowd (< 10% divergence)

export interface SmartTrader {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  side: 'for' | 'against'
  voted_at: string
}

export interface SmartMoneyData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number          // overall crowd consensus (blue_pct)
    total_votes: number
    blue_votes: number
    red_votes: number
  }
  smart_money: {
    for_count: number
    against_count: number
    total_count: number
    for_pct: number        // smart money FOR percentage
    signal: SmartSignal
    divergence: number     // smart_money_for_pct - crowd_price (signed)
    avg_clout: number
    avg_reputation: number
    elder_count: number
    debator_count: number
  }
  for_traders: SmartTrader[]
  against_traders: SmartTrader[]
  all_traders: SmartTrader[]
  threshold: {
    clout_min: number      // minimum clout to qualify as smart money
    rep_min: number        // minimum reputation_score to qualify
    total_eligible: number
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── 2. All votes joined with profiles ────────────────────────────────────
  const { data: rawVotes } = await supabase
    .from('votes')
    .select(`
      user_id,
      side,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role,
        clout,
        reputation_score
      )
    `)
    .eq('topic_id', id)
    .order('created_at', { ascending: false })
    .limit(500)

  interface RawVote {
    user_id: string
    side: string
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
      reputation_score: number
    } | null
  }

  const votes = (rawVotes ?? []) as RawVote[]

  // ── 3. Determine smart money threshold ───────────────────────────────────
  // Smart money = top-20% by clout among voters, or role ∈ {elder, debator}
  const validVoters = votes
    .filter(v => v.profiles !== null)
    .map(v => ({ ...v, p: v.profiles! }))

  const clouts = validVoters.map(v => v.p.clout).sort((a, b) => b - a)
  const p80Index = Math.floor(clouts.length * 0.2)
  const cloutMin = clouts.length >= 5 ? (clouts[p80Index] ?? 100) : 100

  const reps = validVoters.map(v => v.p.reputation_score).sort((a, b) => b - a)
  const p80Rep = Math.floor(reps.length * 0.2)
  const repMin = reps.length >= 5 ? (reps[p80Rep] ?? 50) : 50

  // A voter is "smart money" if they have high clout OR high reputation OR elite role
  function isSmartMoney(p: RawVote['profiles']): boolean {
    if (!p) return false
    if (p.role === 'elder' || p.role === 'troll_catcher') return true
    if (p.clout >= cloutMin && cloutMin >= 200) return true
    if (p.reputation_score >= repMin && repMin >= 60) return true
    return false
  }

  const smartVotes = validVoters.filter(v => isSmartMoney(v.p))
  const totalEligible = smartVotes.length

  // ── 4. Build trader lists ────────────────────────────────────────────────
  function toTrader(v: typeof validVoters[0]): SmartTrader {
    return {
      user_id: v.user_id,
      username: v.p.username,
      display_name: v.p.display_name,
      avatar_url: v.p.avatar_url,
      role: v.p.role,
      clout: v.p.clout,
      reputation_score: v.p.reputation_score,
      side: v.side === 'for' ? 'for' : 'against',
      voted_at: v.created_at,
    }
  }

  const smartForList = smartVotes
    .filter(v => v.side === 'for')
    .sort((a, b) => b.p.clout - a.p.clout)
    .slice(0, 20)
    .map(toTrader)

  const smartAgainstList = smartVotes
    .filter(v => v.side !== 'for')
    .sort((a, b) => b.p.clout - a.p.clout)
    .slice(0, 20)
    .map(toTrader)

  const allSmartList = smartVotes
    .sort((a, b) => b.p.clout - a.p.clout)
    .slice(0, 30)
    .map(toTrader)

  // ── 5. Compute metrics ───────────────────────────────────────────────────
  const smForCount = smartVotes.filter(v => v.side === 'for').length
  const smAgainstCount = smartVotes.filter(v => v.side !== 'for').length
  const smTotal = smForCount + smAgainstCount
  const smForPct = smTotal > 0 ? Math.round((smForCount / smTotal) * 100) : 50

  const crowdPrice = Math.round(topic.blue_pct ?? 50)
  const divergence = smForPct - crowdPrice

  function computeSignal(): SmartSignal {
    if (smTotal < 3) return 'neutral'
    const absDivergence = Math.abs(divergence)
    if (absDivergence < 8) return 'aligned'
    if (smForPct >= 70) return 'strong_bull'
    if (smForPct >= 55) return 'bull'
    if (smForPct <= 30) return 'strong_bear'
    if (smForPct <= 45) return 'bear'
    return 'neutral'
  }

  const avgClout = smTotal > 0
    ? Math.round(smartVotes.reduce((s, v) => s + v.p.clout, 0) / smTotal)
    : 0
  const avgRep = smTotal > 0
    ? Math.round(smartVotes.reduce((s, v) => s + v.p.reputation_score, 0) / smTotal)
    : 0

  const data: SmartMoneyData = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price: crowdPrice,
      total_votes: topic.total_votes ?? 0,
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
    },
    smart_money: {
      for_count: smForCount,
      against_count: smAgainstCount,
      total_count: smTotal,
      for_pct: smForPct,
      signal: computeSignal(),
      divergence,
      avg_clout: avgClout,
      avg_reputation: avgRep,
      elder_count: smartVotes.filter(v => v.p.role === 'elder').length,
      debator_count: smartVotes.filter(v => v.p.role === 'debator').length,
    },
    for_traders: smartForList,
    against_traders: smartAgainstList,
    all_traders: allSmartList,
    threshold: {
      clout_min: cloutMin,
      rep_min: repMin,
      total_eligible: totalEligible,
    },
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
  })
}
