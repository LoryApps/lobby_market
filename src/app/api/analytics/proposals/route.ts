import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProposalStat {
  topicId: string
  statement: string
  category: string | null
  status: string
  scope: string
  totalVotes: number
  bluePct: number
  totalArguments: number
  totalReplies: number
  viewCount: number
  createdAt: string
  feedScore: number
}

export interface CategoryBreakdown {
  category: string
  count: number
  lawCount: number
  lawRate: number
  avgVotes: number
  avgBluePct: number
}

export interface MonthlyProposals {
  month: string
  monthKey: string
  count: number
  lawCount: number
}

export interface ProposalsAnalyticsResponse {
  totalProposed: number
  totalLaws: number
  totalFailed: number
  totalActive: number
  totalVoting: number
  totalProposed_proposed: number
  lawRate: number
  avgVotesPerTopic: number
  avgBluePct: number
  totalVotesReceived: number
  totalArgumentsReceived: number
  proposals: ProposalStat[]
  categoryBreakdown: CategoryBreakdown[]
  monthlyActivity: MonthlyProposals[]
  topByVotes: ProposalStat | null
  topByArguments: ProposalStat | null
  mostContested: ProposalStat | null
  lawsAuthored: ProposalStat[]
}

const EMPTY: ProposalsAnalyticsResponse = {
  totalProposed: 0, totalLaws: 0, totalFailed: 0, totalActive: 0,
  totalVoting: 0, totalProposed_proposed: 0, lawRate: 0,
  avgVotesPerTopic: 0, avgBluePct: 50, totalVotesReceived: 0,
  totalArgumentsReceived: 0, proposals: [], categoryBreakdown: [],
  monthlyActivity: [], topByVotes: null, topByArguments: null,
  mostContested: null, lawsAuthored: [],
}

// ─── GET /api/analytics/proposals ────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Step 1: all topics this user authored
  const { data: topicRows, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, total_votes, blue_pct, view_count, feed_score, created_at')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const topics = topicRows ?? []
  if (topics.length === 0) return NextResponse.json(EMPTY)

  const topicIds = topics.map((t) => t.id)

  // Step 2: argument IDs for these topics (to count args + replies in parallel)
  const { data: argIdRows } = await supabase
    .from('topic_arguments')
    .select('id, topic_id')
    .in('topic_id', topicIds)

  const argIdToTopicId = new Map<string, string>()
  const argCountMap = new Map<string, number>()
  for (const row of argIdRows ?? []) {
    argIdToTopicId.set(row.id, row.topic_id)
    argCountMap.set(row.topic_id, (argCountMap.get(row.topic_id) ?? 0) + 1)
  }

  const argIds = Array.from(argIdToTopicId.keys())

  // Step 3: reply counts (only if there are arguments)
  const replyCountMap = new Map<string, number>()
  if (argIds.length > 0) {
    const { data: replyRows } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)
    for (const row of replyRows ?? []) {
      const topicId = argIdToTopicId.get(row.argument_id)
      if (topicId) replyCountMap.set(topicId, (replyCountMap.get(topicId) ?? 0) + 1)
    }
  }

  // Step 4: build proposal stats
  const proposals: ProposalStat[] = topics.map((t) => ({
    topicId: t.id,
    statement: t.statement,
    category: t.category ?? null,
    status: t.status,
    scope: t.scope,
    totalVotes: t.total_votes ?? 0,
    bluePct: t.blue_pct ?? 50,
    totalArguments: argCountMap.get(t.id) ?? 0,
    totalReplies: replyCountMap.get(t.id) ?? 0,
    viewCount: t.view_count ?? 0,
    createdAt: t.created_at,
    feedScore: t.feed_score ?? 0,
  }))

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalLaws     = proposals.filter((p) => p.status === 'law').length
  const totalFailed   = proposals.filter((p) => p.status === 'failed').length
  const totalActive   = proposals.filter((p) => p.status === 'active').length
  const totalVoting   = proposals.filter((p) => p.status === 'voting').length
  const totalPending  = proposals.filter((p) => p.status === 'proposed').length

  const totalVotesReceived    = proposals.reduce((s, p) => s + p.totalVotes, 0)
  const totalArgumentsReceived = proposals.reduce((s, p) => s + p.totalArguments, 0)
  const avgVotesPerTopic = proposals.length > 0 ? Math.round(totalVotesReceived / proposals.length) : 0
  const avgBluePct = proposals.length > 0
    ? Math.round(proposals.reduce((s, p) => s + p.bluePct, 0) / proposals.length)
    : 50
  const lawRate = proposals.length > 0 ? Math.round((totalLaws / proposals.length) * 100) : 0

  // ── Highlights ─────────────────────────────────────────────────────────────
  const topByVotes = proposals.length > 0
    ? proposals.reduce((best, p) => p.totalVotes > best.totalVotes ? p : best)
    : null

  const topByArguments = proposals.length > 0
    ? proposals.reduce((best, p) => p.totalArguments > best.totalArguments ? p : best)
    : null

  const resolved = proposals.filter((p) => ['active', 'voting', 'law', 'failed'].includes(p.status))
  const mostContested = resolved.length > 0
    ? resolved.reduce((c, p) => Math.abs(p.bluePct - 50) < Math.abs(c.bluePct - 50) ? p : c)
    : null

  // ── Category breakdown ─────────────────────────────────────────────────────
  const catMap = new Map<string, { count: number; lawCount: number; totalVotes: number; totalBluePct: number }>()
  for (const p of proposals) {
    const cat = p.category ?? 'Uncategorized'
    const e = catMap.get(cat) ?? { count: 0, lawCount: 0, totalVotes: 0, totalBluePct: 0 }
    catMap.set(cat, {
      count:       e.count + 1,
      lawCount:    e.lawCount + (p.status === 'law' ? 1 : 0),
      totalVotes:  e.totalVotes + p.totalVotes,
      totalBluePct: e.totalBluePct + p.bluePct,
    })
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      count:    s.count,
      lawCount: s.lawCount,
      lawRate:  Math.round((s.lawCount / s.count) * 100),
      avgVotes: Math.round(s.totalVotes / s.count),
      avgBluePct: Math.round(s.totalBluePct / s.count),
    }))
    .sort((a, b) => b.count - a.count)

  // ── Monthly activity ───────────────────────────────────────────────────────
  const monthMap = new Map<string, { count: number; lawCount: number; label: string }>()
  for (const p of proposals) {
    const d = new Date(p.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const e = monthMap.get(key) ?? { count: 0, lawCount: 0, label }
    monthMap.set(key, { count: e.count + 1, lawCount: e.lawCount + (p.status === 'law' ? 1 : 0), label })
  }

  const monthlyActivity: MonthlyProposals[] = Array.from(monthMap.entries())
    .map(([monthKey, s]) => ({ month: s.label, monthKey, count: s.count, lawCount: s.lawCount }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  return NextResponse.json({
    totalProposed: proposals.length,
    totalLaws, totalFailed, totalActive, totalVoting,
    totalProposed_proposed: totalPending,
    lawRate, avgVotesPerTopic, avgBluePct,
    totalVotesReceived, totalArgumentsReceived,
    proposals, categoryBreakdown, monthlyActivity,
    topByVotes, topByArguments, mostContested,
    lawsAuthored: proposals.filter((p) => p.status === 'law'),
  } satisfies ProposalsAnalyticsResponse)
}
