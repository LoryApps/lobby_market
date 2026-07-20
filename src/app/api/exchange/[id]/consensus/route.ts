import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoterTier {
  label: string
  clout_range: string
  for_count: number
  against_count: number
  total: number
  for_pct: number
}

export interface RoleBreakdown {
  role: string
  label: string
  for_count: number
  against_count: number
  total: number
  for_pct: number
}

export interface TurningPoint {
  date: string
  price_before: number
  price_after: number
  price_change: number
  direction: 'surge' | 'drop' | 'flat'
}

export interface CategoryPeer {
  id: string
  statement: string
  price: number
  total_votes: number
  status: string
}

export interface ConsensusStrength {
  label: 'Overwhelming' | 'Strong' | 'Moderate' | 'Slim' | 'Contested' | 'Divided'
  description: string
  score: number // 0–100
  color: 'gold' | 'for' | 'neutral' | 'against'
}

export interface ConsensusComposition {
  expert_for_pct: number | null    // high-clout voters (clout ≥ 500)
  expert_against_pct: number | null
  elder_for_pct: number | null     // role = 'elder'
  elder_against_pct: number | null
  crowd_for_pct: number            // everyone
  crowd_against_pct: number
  expert_premium: number | null    // expert_for_pct - crowd_for_pct (positive = experts lean more FOR)
}

export interface ConsensusResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number          // = blue_pct
    blue_votes: number
    red_votes: number
    total_votes: number
    voting_ends_at: string | null
    created_at: string
  }

  strength: ConsensusStrength
  composition: ConsensusComposition
  voter_tiers: VoterTier[]
  role_breakdown: RoleBreakdown[]
  turning_points: TurningPoint[]

  // Category context
  category_avg_price: number | null
  category_market_count: number | null
  category_peers_by_consensus: CategoryPeer[]  // same category, sorted by price desc
  category_rank: number | null                 // rank of this topic by price within category

  // Momentum (last 7d and 30d price change)
  momentum_7d: number | null
  momentum_30d: number | null
  momentum_direction: 'growing' | 'contracting' | 'stable'

  // Argument quality comparison
  for_argument_count: number
  against_argument_count: number
  top_for_upvotes: number
  top_against_upvotes: number
  argument_edge: 'for' | 'against' | 'even'

  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function strengthFromPrice(price: number): ConsensusStrength {
  const dist = Math.abs(price - 50)
  if (price >= 85 || price <= 15) return {
    label: 'Overwhelming',
    description: 'Near-unanimous consensus with very few dissenters.',
    score: 95,
    color: price >= 85 ? 'gold' : 'against',
  }
  if (price >= 70 || price <= 30) return {
    label: 'Strong',
    description: 'A clear majority with significant momentum.',
    score: 75,
    color: price >= 70 ? 'for' : 'against',
  }
  if (price >= 58 || price <= 42) return {
    label: 'Moderate',
    description: 'A working majority but contested ground.',
    score: 55,
    color: 'neutral',
  }
  if (price >= 52 || price <= 48) return {
    label: 'Slim',
    description: 'A thin majority — one big debate could flip it.',
    score: 35,
    color: 'neutral',
  }
  if (dist <= 2) return {
    label: 'Contested',
    description: 'Essentially tied. The market is undecided.',
    score: 15,
    color: 'neutral',
  }
  return {
    label: 'Divided',
    description: 'Community is split with no clear direction.',
    score: 20,
    color: 'neutral',
  }
}

function findTurningPoints(history: { price: number; recorded_at: string }[]): TurningPoint[] {
  if (history.length < 3) return []

  const points: TurningPoint[] = []
  const SIGNIFICANT_CHANGE = 5  // ≥5% swing = notable turning point

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]
    const curr = history[i]
    const change = curr.price - prev.price

    if (Math.abs(change) >= SIGNIFICANT_CHANGE) {
      points.push({
        date: curr.recorded_at,
        price_before: prev.price,
        price_after: curr.price,
        price_change: change,
        direction: change > 0 ? 'surge' : 'drop',
      })
    }
  }

  // Return the 8 most significant turning points
  return points
    .sort((a, b) => Math.abs(b.price_change) - Math.abs(a.price_change))
    .slice(0, 8)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
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
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, voting_ends_at, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const price = Math.round(topic.blue_pct ?? 50)
  const totalVotes = topic.total_votes ?? 0

  // ── 2. Voter composition (votes + profiles) ──────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select(`
      side,
      profiles!inner (
        clout,
        role,
        reputation_score
      )
    `)
    .eq('topic_id', id)
    .limit(2000)

  interface VoteRow {
    side: string
    profiles: { clout: number; role: string; reputation_score: number } | null
  }

  const votes = (voteRows ?? []) as unknown as VoteRow[]

  // ── 3. Voter tiers ────────────────────────────────────────────────────────
  const TIERS = [
    { label: 'Elders',   clout_range: '5000+', min: 5000, max: Infinity },
    { label: 'Veterans', clout_range: '1000–4999', min: 1000, max: 4999 },
    { label: 'Regulars', clout_range: '200–999',  min: 200,  max: 999 },
    { label: 'Citizens', clout_range: '50–199',   min: 50,   max: 199 },
    { label: 'Newcomers',clout_range: '0–49',     min: 0,    max: 49 },
  ]

  const voterTiers: VoterTier[] = TIERS.map(tier => {
    const tierVotes = votes.filter(v => {
      const c = v.profiles?.clout ?? 0
      return c >= tier.min && c <= tier.max
    })
    const forCount = tierVotes.filter(v => v.side === 'blue').length
    const againstCount = tierVotes.filter(v => v.side === 'red').length
    const total = forCount + againstCount
    return {
      label: tier.label,
      clout_range: tier.clout_range,
      for_count: forCount,
      against_count: againstCount,
      total,
      for_pct: total > 0 ? Math.round((forCount / total) * 100) : 50,
    }
  }).filter(t => t.total > 0)

  // ── 4. Role breakdown ─────────────────────────────────────────────────────
  const ROLE_LABELS: Record<string, string> = {
    person: 'Citizens',
    debator: 'Debators',
    troll_catcher: 'Troll Catchers',
    elder: 'Elders',
  }

  const roleMap = new Map<string, { for_count: number; against_count: number }>()
  for (const v of votes) {
    const role = v.profiles?.role ?? 'person'
    const entry = roleMap.get(role) ?? { for_count: 0, against_count: 0 }
    if (v.side === 'blue') entry.for_count++
    else entry.against_count++
    roleMap.set(role, entry)
  }

  const roleBreakdown: RoleBreakdown[] = Array.from(roleMap.entries())
    .map(([role, counts]) => {
      const total = counts.for_count + counts.against_count
      return {
        role,
        label: ROLE_LABELS[role] ?? role,
        for_count: counts.for_count,
        against_count: counts.against_count,
        total,
        for_pct: total > 0 ? Math.round((counts.for_count / total) * 100) : 50,
      }
    })
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)

  // ── 5. Composition summary ─────────────────────────────────────────────────
  const expertVotes = votes.filter(v => (v.profiles?.clout ?? 0) >= 500)
  const expertFor = expertVotes.filter(v => v.side === 'blue').length
  const expertAgainst = expertVotes.filter(v => v.side === 'red').length
  const expertTotal = expertFor + expertAgainst

  const elderVotes = votes.filter(v => v.profiles?.role === 'elder')
  const elderFor = elderVotes.filter(v => v.side === 'blue').length
  const elderAgainst = elderVotes.filter(v => v.side === 'red').length
  const elderTotal = elderFor + elderAgainst

  const crowdForPct = totalVotes > 0 ? Math.round(((topic.blue_votes ?? 0) / totalVotes) * 100) : 50
  const expertForPct = expertTotal > 0 ? Math.round((expertFor / expertTotal) * 100) : null
  const elderForPct = elderTotal > 0 ? Math.round((elderFor / elderTotal) * 100) : null

  const composition: ConsensusComposition = {
    expert_for_pct: expertForPct,
    expert_against_pct: expertForPct !== null ? 100 - expertForPct : null,
    elder_for_pct: elderForPct,
    elder_against_pct: elderForPct !== null ? 100 - elderForPct : null,
    crowd_for_pct: crowdForPct,
    crowd_against_pct: 100 - crowdForPct,
    expert_premium: expertForPct !== null ? expertForPct - crowdForPct : null,
  }

  // ── 6. Price history + turning points + momentum ─────────────────────────
  const { data: rawHistory } = await supabase
    .from('topic_price_history')
    .select('price, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(180)

  const history = (rawHistory ?? []).map(h => ({
    price: Math.round(h.price),
    recorded_at: h.recorded_at,
  }))

  const turningPoints = findTurningPoints(history)

  const now = Date.now()
  const ms7d = 7 * 24 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000
  const price7dAgo = history.findLast(h => new Date(h.recorded_at).getTime() < now - ms7d)?.price ?? null
  const price30dAgo = history.findLast(h => new Date(h.recorded_at).getTime() < now - ms30d)?.price ?? null
  const momentum7d = price7dAgo !== null ? price - price7dAgo : null
  const momentum30d = price30dAgo !== null ? price - price30dAgo : null

  let momentumDirection: 'growing' | 'contracting' | 'stable' = 'stable'
  if (momentum7d !== null) {
    if (momentum7d >= 3) momentumDirection = 'growing'
    else if (momentum7d <= -3) momentumDirection = 'contracting'
  }

  // ── 7. Category context ──────────────────────────────────────────────────
  let categoryAvgPrice: number | null = null
  let categoryMarketCount: number | null = null
  let categoryPeers: CategoryPeer[] = []
  let categoryRank: number | null = null

  if (topic.category) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('id, statement, blue_pct, total_votes, status')
      .eq('category', topic.category)
      .not('status', 'in', '("proposed","archived")')
      .order('blue_pct', { ascending: false })
      .limit(50)

    if (catTopics && catTopics.length > 0) {
      categoryMarketCount = catTopics.length
      categoryAvgPrice = Math.round(
        catTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / catTopics.length
      )

      // Rank of this topic (1 = highest consensus)
      const rankIdx = catTopics.findIndex(t => t.id === id)
      categoryRank = rankIdx >= 0 ? rankIdx + 1 : null

      // Show a slice of peers around the current topic
      categoryPeers = catTopics
        .filter(t => t.id !== id)
        .slice(0, 6)
        .map(t => ({
          id: t.id,
          statement: t.statement ?? '',
          price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          status: t.status ?? 'active',
        }))
    }
  }

  // ── 8. Arguments ─────────────────────────────────────────────────────────
  const [{ count: forArgCount }, { count: againstArgCount }] = await Promise.all([
    supabase.from('arguments').select('*', { count: 'exact', head: true }).eq('topic_id', id).eq('side', 'for'),
    supabase.from('arguments').select('*', { count: 'exact', head: true }).eq('topic_id', id).eq('side', 'against'),
  ])

  const { data: topForArg } = await supabase
    .from('arguments')
    .select('upvote_count')
    .eq('topic_id', id)
    .eq('side', 'for')
    .order('upvote_count', { ascending: false })
    .limit(1)

  const { data: topAgainstArg } = await supabase
    .from('arguments')
    .select('upvote_count')
    .eq('topic_id', id)
    .eq('side', 'against')
    .order('upvote_count', { ascending: false })
    .limit(1)

  const topForUpvotes = topForArg?.[0]?.upvote_count ?? 0
  const topAgainstUpvotes = topAgainstArg?.[0]?.upvote_count ?? 0
  const forArgTotal = (forArgCount ?? 0) + topForUpvotes
  const againstArgTotal = (againstArgCount ?? 0) + topAgainstUpvotes
  const argumentEdge: 'for' | 'against' | 'even' =
    forArgTotal > againstArgTotal * 1.2 ? 'for'
    : againstArgTotal > forArgTotal * 1.2 ? 'against'
    : 'even'

  // ── 9. Assemble response ─────────────────────────────────────────────────
  const response: ConsensusResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement ?? '',
      category: topic.category,
      status: topic.status,
      price,
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
      total_votes: totalVotes,
      voting_ends_at: topic.voting_ends_at,
      created_at: topic.created_at,
    },
    strength: strengthFromPrice(price),
    composition,
    voter_tiers: voterTiers,
    role_breakdown: roleBreakdown,
    turning_points: turningPoints,
    category_avg_price: categoryAvgPrice,
    category_market_count: categoryMarketCount,
    category_peers_by_consensus: categoryPeers,
    category_rank: categoryRank,
    momentum_7d: momentum7d,
    momentum_30d: momentum30d,
    momentum_direction: momentumDirection,
    for_argument_count: forArgCount ?? 0,
    against_argument_count: againstArgCount ?? 0,
    top_for_upvotes: topForUpvotes,
    top_against_upvotes: topAgainstUpvotes,
    argument_edge: argumentEdge,
    as_of: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
