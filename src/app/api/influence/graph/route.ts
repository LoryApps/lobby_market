import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InfluenceNode {
  id: string
  type: 'user' | 'topic' | 'category'
  label: string
  category?: string | null
  status?: string
  totalVotes?: number
  forPct?: number
  userSide?: 'blue' | 'red'  // how the current user voted
  isCurrentUser?: boolean
  clout?: number
  avatarUrl?: string | null
}

export interface InfluenceEdge {
  source: string
  target: string
  type: 'voted_for' | 'voted_against' | 'category_link'
}

export interface InfluenceStats {
  totalVotes: number
  forVotes: number
  againstVotes: number
  lawsContributed: number
  activitiesLastMonth: number
  topCategory: string | null
  winRate: number  // pct of votes that went with the majority
  categoryBreakdown: Array<{ category: string; count: number; forPct: number }>
}

export interface InfluenceGraphData {
  nodes: InfluenceNode[]
  edges: InfluenceEdge[]
  stats: InfluenceStats
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // ── Fetch current user's profile ────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, total_votes, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Fetch recent votes with topic data (up to 60) ───────────────────────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60)

  const votes = (votesRaw ?? []) as Array<{
    topic_id: string
    side: 'blue' | 'red'
    created_at: string
  }>

  if (votes.length === 0) {
    // Return empty graph for new users
    const emptyNode: InfluenceNode = {
      id: user.id,
      type: 'user',
      label: profile.display_name || profile.username || 'You',
      isCurrentUser: true,
      clout: profile.clout ?? 0,
      avatarUrl: profile.avatar_url,
    }
    return NextResponse.json({
      nodes: [emptyNode],
      edges: [],
      stats: {
        totalVotes: 0,
        forVotes: 0,
        againstVotes: 0,
        lawsContributed: 0,
        activitiesLastMonth: 0,
        topCategory: null,
        winRate: 0,
        categoryBreakdown: [],
      },
    } satisfies InfluenceGraphData)
  }

  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  // ── Fetch topic data ─────────────────────────────────────────────────────────
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  const topics = (topicsRaw ?? []) as Array<{
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }>

  const topicMap = new Map(topics.map((t) => [t.id, t]))

  // ── Build vote side lookup ───────────────────────────────────────────────────
  const voteSideMap = new Map<string, 'blue' | 'red'>()
  for (const v of votes) {
    if (!voteSideMap.has(v.topic_id)) voteSideMap.set(v.topic_id, v.side)
  }

  // ── Compute stats ────────────────────────────────────────────────────────────
  let forVotes = 0
  let againstVotes = 0
  let lawsContributed = 0
  let winningVotes = 0

  const categoryMap = new Map<string, { count: number; blue: number; red: number }>()

  for (const v of votes) {
    const topic = topicMap.get(v.topic_id)
    if (!topic) continue

    if (v.side === 'blue') forVotes++
    else againstVotes++

    if (topic.status === 'law' || topic.status === 'failed') {
      const majorityWon = topic.blue_pct >= 50 ? 'blue' : 'red'
      if (v.side === majorityWon) winningVotes++
    }

    if (topic.status === 'law' && v.side === 'blue') lawsContributed++

    const cat = topic.category ?? 'Other'
    const existing = categoryMap.get(cat) ?? { count: 0, blue: 0, red: 0 }
    existing.count++
    if (v.side === 'blue') existing.blue++
    else existing.red++
    categoryMap.set(cat, existing)
  }

  const resolvedVotes = votes.filter((v) => {
    const t = topicMap.get(v.topic_id)
    return t && (t.status === 'law' || t.status === 'failed')
  }).length

  const winRate = resolvedVotes > 0 ? Math.round((winningVotes / resolvedVotes) * 100) : 0

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      forPct: data.count > 0 ? Math.round((data.blue / data.count) * 100) : 50,
    }))
    .sort((a, b) => b.count - a.count)

  const topCategory = categoryBreakdown[0]?.category ?? null

  // Count last-month activity
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const activitiesLastMonth = votes.filter((v) => v.created_at > oneMonthAgo).length

  // ── Build graph nodes ────────────────────────────────────────────────────────
  const nodes: InfluenceNode[] = []
  const edges: InfluenceEdge[] = []

  // Center: current user
  nodes.push({
    id: user.id,
    type: 'user',
    label: profile.display_name || profile.username || 'You',
    isCurrentUser: true,
    clout: profile.clout ?? 0,
    avatarUrl: profile.avatar_url,
  })

  // Category intermediate nodes
  const usedCategories = new Set<string>()
  for (const topic of topics) {
    const cat = topic.category ?? 'Other'
    usedCategories.add(cat)
  }

  for (const cat of usedCategories) {
    const catId = `cat:${cat}`
    nodes.push({
      id: catId,
      type: 'category',
      label: cat,
      category: cat,
    })
    edges.push({ source: user.id, target: catId, type: 'category_link' })
  }

  // Topic nodes (limit to 40 to keep graph legible)
  const topicsToShow = topics.slice(0, 40)
  for (const topic of topicsToShow) {
    const userSide = voteSideMap.get(topic.id)
    if (!userSide) continue

    nodes.push({
      id: topic.id,
      type: 'topic',
      label: topic.statement.length > 60
        ? topic.statement.slice(0, 57) + '…'
        : topic.statement,
      category: topic.category,
      status: topic.status,
      totalVotes: topic.total_votes,
      forPct: Math.round(topic.blue_pct ?? 50),
      userSide,
    })

    const cat = topic.category ?? 'Other'
    const catId = `cat:${cat}`
    edges.push({
      source: catId,
      target: topic.id,
      type: userSide === 'blue' ? 'voted_for' : 'voted_against',
    })
  }

  const stats: InfluenceStats = {
    totalVotes: votes.length,
    forVotes,
    againstVotes,
    lawsContributed,
    activitiesLastMonth,
    topCategory,
    winRate,
    categoryBreakdown,
  }

  return NextResponse.json({ nodes, edges, stats } satisfies InfluenceGraphData)
}
