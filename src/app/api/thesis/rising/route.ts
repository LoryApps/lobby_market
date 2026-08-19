import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface RisingThesisEntry {
  id: string
  statement: string
  rationale: string | null
  category: string
  status: string
  resolution_date: string | null
  agree_count: number
  disagree_count: number
  resolved_at: string | null
  created_at: string
  author: ThesisAuthor | null
  viewer_vote: boolean | null
  related_topic_id: string | null
  related_topic_statement: string | null
  recent_agree_count: number
  total_engagement: number
  agree_pct: number
}

export interface RisingThesesResponse {
  fastest_rising: RisingThesisEntry[]
  new_consensus: RisingThesisEntry[]
  breakout_predictions: RisingThesisEntry[]
  total_rising: number
}

const SELECT_FIELDS = `
  id, user_id, statement, rationale, category,
  resolution_date, status, related_topic_id,
  agree_count, disagree_count, is_public, resolved_at,
  created_at, updated_at,
  profiles!civic_theses_user_id_fkey(
    id, username, display_name, avatar_url, role
  ),
  topics!civic_theses_related_topic_id_fkey(
    statement
  )
`

function toEntry(row: Record<string, unknown>, viewerVote: boolean | null, recentAgreeCount: number): RisingThesisEntry {
  const profiles = row.profiles as ThesisAuthor | null
  const topics = row.topics as { statement: string } | null
  const agree = (row.agree_count as number) ?? 0
  const disagree = (row.disagree_count as number) ?? 0
  const total = agree + disagree

  return {
    id: row.id as string,
    statement: row.statement as string,
    rationale: row.rationale as string | null,
    category: row.category as string,
    status: row.status as string,
    resolution_date: row.resolution_date as string | null,
    agree_count: agree,
    disagree_count: disagree,
    resolved_at: row.resolved_at as string | null,
    created_at: row.created_at as string,
    author: profiles
      ? { id: profiles.id, username: profiles.username, display_name: profiles.display_name, avatar_url: profiles.avatar_url, role: profiles.role }
      : null,
    viewer_vote: viewerVote,
    related_topic_id: row.related_topic_id as string | null,
    related_topic_statement: topics?.statement ?? null,
    recent_agree_count: recentAgreeCount,
    total_engagement: total,
    agree_pct: total > 0 ? Math.round((agree / total) * 100) : 50,
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') || null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Window: votes cast in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get thesis_ids that received the most AGREE votes in the last 7 days
  const { data: recentVoteRows } = await supabase
    .from('thesis_votes')
    .select('thesis_id')
    .eq('agree', true)
    .gte('created_at', sevenDaysAgo)

  // Tally recent agree counts per thesis
  const recentAgreeCounts = new Map<string, number>()
  for (const v of recentVoteRows ?? []) {
    recentAgreeCounts.set(v.thesis_id, (recentAgreeCounts.get(v.thesis_id) ?? 0) + 1)
  }

  if (recentAgreeCounts.size === 0) {
    return NextResponse.json({
      fastest_rising: [],
      new_consensus: [],
      breakout_predictions: [],
      total_rising: 0,
    } satisfies RisingThesesResponse)
  }

  // Sort by recent agree count descending, take top 60
  const topThesisIds = [...recentAgreeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([id]) => id)

  // Fetch full thesis data for these IDs
  let query = supabase
    .from('civic_theses')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .in('id', topThesisIds)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: rows } = await query

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      fastest_rising: [],
      new_consensus: [],
      breakout_predictions: [],
      total_rising: 0,
    } satisfies RisingThesesResponse)
  }

  // Viewer votes
  let viewerVotes: Record<string, boolean> = {}
  if (user) {
    const ids = rows.map((r) => r.id)
    const { data: voteRows } = await supabase
      .from('thesis_votes')
      .select('thesis_id, agree')
      .eq('user_id', user.id)
      .in('thesis_id', ids)
    for (const v of voteRows ?? []) {
      viewerVotes[v.thesis_id] = v.agree
    }
  }

  const entries = rows.map((r) =>
    toEntry(r as Record<string, unknown>, user ? (viewerVotes[r.id] ?? null) : null, recentAgreeCounts.get(r.id) ?? 0)
  )

  // Sort by recent_agree_count DESC for the main list
  const sortedByRising = [...entries].sort((a, b) => b.recent_agree_count - a.recent_agree_count)

  // "Fastest rising": top 15 by recent agree velocity
  const fastestRising = sortedByRising.slice(0, 15)

  // "New consensus": active theses where agree_pct >= 70, sorted by recent agrees
  const newConsensus = sortedByRising
    .filter((e) => e.status === 'active' && e.agree_pct >= 70 && e.total_engagement >= 5)
    .slice(0, 8)

  // "Breakout predictions": active theses posted in last 14 days that are already rising
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
  const breakoutPredictions = sortedByRising
    .filter((e) => e.status === 'active' && new Date(e.created_at).getTime() >= fourteenDaysAgo)
    .slice(0, 8)

  return NextResponse.json({
    fastest_rising: fastestRising,
    new_consensus: newConsensus,
    breakout_predictions: breakoutPredictions,
    total_rising: recentAgreeCounts.size,
  } satisfies RisingThesesResponse)
}
