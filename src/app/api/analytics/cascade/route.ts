import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CascadeChain {
  root_id: string
  root_statement: string
  root_category: string | null
  root_status: string
  root_voted_side: 'blue' | 'red'
  root_voted_at: string
  root_outcome: 'law' | 'failed' | 'active' | 'voting' | 'proposed'
  child_count: number
  law_count: number     // descendants that became laws
  max_depth: number     // deepest chain depth reached
  total_votes: number   // cumulative votes across the chain
}

export interface CascadeStats {
  chains_started: number        // topics you voted FOR that spawned chains
  total_descendants: number     // all child/grandchild topics across your chains
  laws_from_chains: number      // laws that descended from your chain roots
  max_chain_depth: number       // deepest chain you contributed to
  cascade_score: number         // 0–1000 composite score
  cascade_tier: 'Architect' | 'Builder' | 'Catalyst' | 'Voter' | 'Observer'
  tier_description: string
  authored_chains: number       // topics you authored that became chain roots
  authored_laws: number         // topics you authored that became laws
}

export interface CascadeResponse {
  authenticated: true
  stats: CascadeStats
  top_chains: CascadeChain[]
  recent_descendants: Array<{
    id: string
    statement: string
    category: string | null
    status: string
    depth: number
    total_votes: number
    created_at: string
    root_id: string
    root_statement: string
  }>
}

export interface CascadeUnauthenticated {
  authenticated: false
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcScore(stats: Omit<CascadeStats, 'cascade_score' | 'cascade_tier' | 'tier_description'>): number {
  const chainPts = Math.min(stats.chains_started * 15, 300)
  const descPts  = Math.min(stats.total_descendants * 5, 250)
  const lawPts   = Math.min(stats.laws_from_chains * 40, 300)
  const depthPts = Math.min(stats.max_chain_depth * 20, 100)
  const authPts  = Math.min(stats.authored_chains * 10 + stats.authored_laws * 25, 150)
  return Math.round(chainPts + descPts + lawPts + depthPts + authPts)
}

function scoreTier(score: number): { tier: CascadeStats['cascade_tier']; description: string } {
  if (score >= 600) return { tier: 'Architect', description: 'Your votes have shaped the entire legislative landscape — topics cascade from your choices across the Lobby.' }
  if (score >= 300) return { tier: 'Builder',   description: 'A significant civic architect — your votes and topics have spawned waves of downstream debate.' }
  if (score >= 120) return { tier: 'Catalyst',  description: 'Your civic engagement sparks conversations that outlast the original debate.' }
  if (score >= 30)  return { tier: 'Voter',     description: "You're building your cascade — keep voting on active debates to extend your civic reach." }
  return { tier: 'Observer', description: 'Vote on active topics to start your civic cascade.' }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<CascadeResponse | CascadeUnauthenticated>> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ authenticated: false })

  // ── 1. Get all topics the user voted FOR (blue) ──────────────────────────
  const { data: forVotes } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .eq('user_id', user.id)
    .eq('side', 'blue')
    .order('created_at', { ascending: false })

  const votedTopicIds = (forVotes ?? []).map((v) => v.topic_id)
  const voteMap = new Map<string, { side: string; created_at: string }>()
  ;(forVotes ?? []).forEach((v) => voteMap.set(v.topic_id, { side: v.side, created_at: v.created_at }))

  // ── 2. Topics user authored ───────────────────────────────────────────────
  const { data: authoredTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, chain_depth, parent_id, created_at')
    .eq('author_id', user.id)

  const authoredIds = new Set((authoredTopics ?? []).map((t) => t.id))
  const authoredLawCount = (authoredTopics ?? []).filter((t) => t.status === 'law').length
  const authoredChainRoots = (authoredTopics ?? []).filter((t) => t.chain_depth === 0).length

  // ── 3. For voted topics: find child topics (direct chains) ────────────────
  if (votedTopicIds.length === 0 && authoredIds.size === 0) {
    const stats: CascadeStats = {
      chains_started: 0,
      total_descendants: 0,
      laws_from_chains: 0,
      max_chain_depth: 0,
      cascade_score: 0,
      cascade_tier: 'Observer',
      tier_description: 'Vote on active topics to start your civic cascade.',
      authored_chains: 0,
      authored_laws: 0,
    }
    return NextResponse.json({
      authenticated: true,
      stats,
      top_chains: [],
      recent_descendants: [],
    })
  }

  // Candidate root topics = voted blue + authored (chain_depth 0)
  const allCandidateIds = [...new Set([
    ...votedTopicIds,
    ...(authoredTopics ?? []).filter((t) => t.chain_depth === 0).map((t) => t.id),
  ])]

  // Fetch the candidate topics themselves
  const { data: candidateTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, chain_depth, parent_id, created_at')
    .in('id', allCandidateIds.slice(0, 200))

  // Find which candidates have children (i.e., are root/parent of chains)
  const candidateWithChildren: string[] = []
  if (candidateTopics && candidateTopics.length > 0) {
    const { data: childCheck } = await supabase
      .from('topics')
      .select('parent_id')
      .in('parent_id', allCandidateIds.slice(0, 200))
      .not('parent_id', 'is', null)

    const parentsWithChildren = new Set((childCheck ?? []).map((c) => c.parent_id as string))
    candidateWithChildren.push(...parentsWithChildren)
  }

  // ── 4. Fetch all descendants of chain-root topics ─────────────────────────
  const chainRootIds = candidateWithChildren.length > 0 ? candidateWithChildren : []

  // Fetch up to 500 topics that are descendants of these roots
  // We do this by getting all topics with parent_id in root set
  // (For deeper chains we'd need recursive queries, but we simplify to 2 levels)
  const { data: level1Children } = chainRootIds.length > 0
    ? await supabase
        .from('topics')
        .select('id, statement, category, status, total_votes, chain_depth, parent_id, created_at')
        .in('parent_id', chainRootIds.slice(0, 100))
        .order('created_at', { ascending: false })
        .limit(300)
    : { data: [] }

  const level1Ids = (level1Children ?? []).map((t) => t.id)

  const { data: level2Children } = level1Ids.length > 0
    ? await supabase
        .from('topics')
        .select('id, statement, category, status, total_votes, chain_depth, parent_id, created_at')
        .in('parent_id', level1Ids.slice(0, 100))
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] }

  const allDescendants = [...(level1Children ?? []), ...(level2Children ?? [])]

  // ── 5. Build per-root chain stats ─────────────────────────────────────────
  // Map descendant → root
  const parentToRoot = new Map<string, string>()
  ;(level1Children ?? []).forEach((c) => {
    if (c.parent_id) parentToRoot.set(c.id, c.parent_id)
  })
  ;(level2Children ?? []).forEach((c) => {
    if (c.parent_id) {
      const root = parentToRoot.get(c.parent_id) ?? c.parent_id
      parentToRoot.set(c.id, root)
    }
  })

  const chainStats = new Map<string, { child_count: number; law_count: number; max_depth: number; total_votes: number }>()
  chainRootIds.forEach((id) => chainStats.set(id, { child_count: 0, law_count: 0, max_depth: 0, total_votes: 0 }))

  allDescendants.forEach((d) => {
    const root = parentToRoot.get(d.id) ?? d.parent_id
    if (!root || !chainStats.has(root)) return
    const s = chainStats.get(root)!
    s.child_count += 1
    if (d.status === 'law') s.law_count += 1
    if (d.chain_depth > s.max_depth) s.max_depth = d.chain_depth
    s.total_votes += d.total_votes ?? 0
  })

  // ── 6. Build top chains list ──────────────────────────────────────────────
  const topicMap = new Map<string, typeof candidateTopics extends null ? never : (typeof candidateTopics)[number]>()
  ;(candidateTopics ?? []).forEach((t) => topicMap.set(t.id, t))

  const top_chains: CascadeChain[] = chainRootIds
    .map((rootId) => {
      const topic = topicMap.get(rootId)
      if (!topic) return null
      const stats = chainStats.get(rootId) ?? { child_count: 0, law_count: 0, max_depth: 0, total_votes: 0 }
      const vote = voteMap.get(rootId)
      return {
        root_id: rootId,
        root_statement: topic.statement,
        root_category: topic.category,
        root_status: topic.status,
        root_voted_side: (vote?.side ?? 'blue') as 'blue' | 'red',
        root_voted_at: vote?.created_at ?? topic.created_at,
        root_outcome: topic.status as CascadeChain['root_outcome'],
        child_count: stats.child_count,
        law_count: stats.law_count,
        max_depth: stats.max_depth,
        total_votes: stats.total_votes,
      } satisfies CascadeChain
    })
    .filter((c): c is CascadeChain => c !== null)
    .sort((a, b) => (b.child_count + b.law_count * 3) - (a.child_count + a.law_count * 3))
    .slice(0, 12)

  // ── 7. Recent descendants ─────────────────────────────────────────────────
  const recent_descendants = allDescendants
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((d) => {
      const rootId = parentToRoot.get(d.id) ?? d.parent_id ?? ''
      const rootTopic = topicMap.get(rootId)
      return {
        id: d.id,
        statement: d.statement,
        category: d.category,
        status: d.status,
        depth: d.chain_depth,
        total_votes: d.total_votes ?? 0,
        created_at: d.created_at,
        root_id: rootId,
        root_statement: rootTopic?.statement ?? 'Unknown',
      }
    })

  // ── 8. Aggregate stats ────────────────────────────────────────────────────
  const totalDescendants = allDescendants.length
  const lawsFromChains   = allDescendants.filter((d) => d.status === 'law').length
  const maxChainDepth    = allDescendants.reduce((m, d) => Math.max(m, d.chain_depth), 0)

  const partialStats = {
    chains_started:     chainRootIds.length,
    total_descendants:  totalDescendants,
    laws_from_chains:   lawsFromChains,
    max_chain_depth:    maxChainDepth,
    authored_chains:    authoredChainRoots,
    authored_laws:      authoredLawCount,
  }
  const cascade_score = calcScore(partialStats)
  const { tier, description } = scoreTier(cascade_score)

  const stats: CascadeStats = {
    ...partialStats,
    cascade_score,
    cascade_tier: tier,
    tier_description: description,
  }

  return NextResponse.json({
    authenticated: true,
    stats,
    top_chains,
    recent_descendants,
  })
}
