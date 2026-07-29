import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContrarianVote {
  topicId: string
  statement: string
  category: string | null
  status: string
  side: 'blue' | 'red'
  bluePct: number
  totalVotes: number
  votedAt: string
  // How far user is from majority (0–50, higher = more contrarian)
  gapFromMajority: number
  // Trend: is the minority shrinking or growing toward 50?
  trend: 'vindicating' | 'entrenching' | 'resolved_right' | 'resolved_wrong' | 'neutral'
  // For concluded topics: did the contrarian position prevail?
  outcome: 'vindicated' | 'overruled' | null
}

export interface CategorySplit {
  category: string
  count: number
  vindicated: number
  vindicationRate: number | null
}

export interface ContrarianData {
  maverickScore: number          // 0–100: how contrarian overall
  vindicationRate: number | null // % of concluded contrarian votes that were right
  totalContrarian: number
  activeContrarian: number
  concludedContrarian: number
  vindicated: number
  overruled: number
  // Topics where minority gap is narrowing (moving toward user's side)
  vindicating: ContrarianVote[]
  // Strongly contrarian, still very far from majority
  entrenched: ContrarianVote[]
  // Concluded — right
  wins: ContrarianVote[]
  // Concluded — wrong
  losses: ContrarianVote[]
  categorySplits: CategorySplit[]
  insight: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeGap(side: 'blue' | 'red', bluePct: number): number {
  // User side pct
  const userPct = side === 'blue' ? bluePct : 100 - bluePct
  // Gap from 50%: 0 = perfectly split, 50 = user has 0% support
  return Math.max(0, 50 - userPct)
}

function buildInsight(data: {
  maverickScore: number
  vindicationRate: number | null
  totalContrarian: number
  vindicated: number
  vindicating: number
}): string {
  const parts: string[] = []

  if (data.totalContrarian === 0) {
    return 'You consistently vote with the majority — no minority positions recorded yet.'
  }

  if (data.maverickScore >= 60) {
    parts.push(`With a Maverick Score of ${data.maverickScore}, you regularly vote against the crowd.`)
  } else if (data.maverickScore >= 35) {
    parts.push(`You take minority positions on about ${data.maverickScore}% of your votes.`)
  } else {
    parts.push(`You occasionally step outside the mainstream — ${data.totalContrarian} contrarian vote${data.totalContrarian !== 1 ? 's' : ''} recorded.`)
  }

  if (data.vindicationRate !== null && data.vindicationRate >= 60) {
    parts.push(`Impressively, your contrarian positions were vindicated ${data.vindicationRate}% of the time on concluded debates.`)
  } else if (data.vindicationRate !== null && data.vindicationRate >= 40) {
    parts.push(`On concluded debates, your contrarian calls were right ${data.vindicationRate}% of the time.`)
  } else if (data.vindicationRate !== null) {
    parts.push(`The community overruled your minority position on most concluded debates.`)
  }

  if (data.vindicating > 0) {
    parts.push(`${data.vindicating} of your current contrarian positions ${data.vindicating === 1 ? 'is' : 'are'} gaining ground.`)
  }

  return parts.join(' ')
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  // Fetch all user votes with topic data
  const { data: rawVotes, error } = await supabase
    .from('votes')
    .select(`
      side,
      created_at,
      topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawVote = {
    side: string
    created_at: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number | null
      total_votes: number | null
    } | null
  }

  const votes = (rawVotes ?? []) as RawVote[]

  // Filter to contrarian votes (user is in the minority)
  const allVotes: ContrarianVote[] = []

  for (const v of votes) {
    const topic = v.topics
    if (!topic) continue

    const side = v.side as 'blue' | 'red'
    const bluePct = topic.blue_pct ?? 50
    const userPct = side === 'blue' ? bluePct : 100 - bluePct

    // Only include votes where user is in the minority (< 50%)
    if (userPct >= 50) continue

    const gapFromMajority = computeGap(side, bluePct)

    // Determine trend / outcome
    let trend: ContrarianVote['trend'] = 'neutral'
    let outcome: ContrarianVote['outcome'] = null

    if (topic.status === 'law') {
      // LAW: the "for" side won
      if (side === 'blue') {
        outcome = 'vindicated'
        trend = 'resolved_right'
      } else {
        outcome = 'overruled'
        trend = 'resolved_wrong'
      }
    } else if (topic.status === 'failed') {
      // FAILED: the "against" side won
      if (side === 'red') {
        outcome = 'vindicated'
        trend = 'resolved_right'
      } else {
        outcome = 'overruled'
        trend = 'resolved_wrong'
      }
    } else {
      // Active/voting/proposed: is the gap narrowing?
      // "vindicating" if user is in the minority but the gap < 15% (moving toward 50/50)
      if (gapFromMajority <= 15) {
        trend = 'vindicating'
      } else if (gapFromMajority >= 30) {
        trend = 'entrenching'
      } else {
        trend = 'neutral'
      }
    }

    allVotes.push({
      topicId: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      side,
      bluePct,
      totalVotes: topic.total_votes ?? 0,
      votedAt: v.created_at,
      gapFromMajority,
      trend,
      outcome,
    })
  }

  // Compute stats
  const totalContrarian = allVotes.length
  const activeContrarian = allVotes.filter(v => !['law', 'failed'].includes(v.status)).length
  const concludedContrarian = allVotes.filter(v => ['law', 'failed'].includes(v.status)).length
  const vindicated = allVotes.filter(v => v.outcome === 'vindicated').length
  const overruled = allVotes.filter(v => v.outcome === 'overruled').length
  const vindicationRate = concludedContrarian > 0
    ? Math.round((vindicated / concludedContrarian) * 100)
    : null

  // Maverick score: % of all user votes that were contrarian (capped at 100)
  const { count: totalUserVotes } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const maverickScore = totalUserVotes && totalUserVotes > 0
    ? Math.round(Math.min(100, (totalContrarian / totalUserVotes) * 100))
    : 0

  // Category splits
  const catMap = new Map<string, { count: number; vindicated: number; concluded: number }>()
  for (const v of allVotes) {
    const cat = v.category ?? 'Uncategorized'
    const existing = catMap.get(cat) ?? { count: 0, vindicated: 0, concluded: 0 }
    existing.count++
    if (v.outcome === 'vindicated') existing.vindicated++
    if (v.outcome !== null) existing.concluded++
    catMap.set(cat, existing)
  }

  const categorySplits: CategorySplit[] = Array.from(catMap.entries())
    .map(([category, { count, vindicated: v, concluded }]) => ({
      category,
      count,
      vindicated: v,
      vindicationRate: concluded > 0 ? Math.round((v / concluded) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count)

  // Partition into display groups
  const vindicating = allVotes
    .filter(v => v.trend === 'vindicating')
    .sort((a, b) => a.gapFromMajority - b.gapFromMajority)
    .slice(0, limit / 4)

  const entrenched = allVotes
    .filter(v => v.trend === 'entrenching')
    .sort((a, b) => b.gapFromMajority - a.gapFromMajority)
    .slice(0, limit / 4)

  const wins = allVotes
    .filter(v => v.trend === 'resolved_right')
    .sort((a, b) => new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime())
    .slice(0, limit / 4)

  const losses = allVotes
    .filter(v => v.trend === 'resolved_wrong')
    .sort((a, b) => new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime())
    .slice(0, limit / 4)

  const insight = buildInsight({
    maverickScore,
    vindicationRate,
    totalContrarian,
    vindicated,
    vindicating: vindicating.length,
  })

  const result: ContrarianData = {
    maverickScore,
    vindicationRate,
    totalContrarian,
    activeContrarian,
    concludedContrarian,
    vindicated,
    overruled,
    vindicating,
    entrenched,
    wins,
    losses,
    categorySplits,
    insight,
  }

  return NextResponse.json(result)
}
