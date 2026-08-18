import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface ResolvedThesisEntry {
  id: string
  statement: string
  rationale: string | null
  category: string
  status: 'vindicated' | 'refuted' | 'expired'
  resolution_date: string | null
  resolved_at: string | null
  agree_count: number
  disagree_count: number
  agree_pct: number
  total_engagement: number
  created_at: string
  author: ThesisAuthor | null
  related_topic_id: string | null
  related_topic_statement: string | null
  viewer_vote: boolean | null
}

export interface AccuracyEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total_resolved: number
  vindicated: number
  accuracy_pct: number
}

export interface ResolvedThesesResponse {
  vindicated: ResolvedThesisEntry[]
  refuted: ResolvedThesisEntry[]
  expired: ResolvedThesisEntry[]
  total_vindicated: number
  total_refuted: number
  total_expired: number
  top_predictors: AccuracyEntry[]
  platform_accuracy_pct: number
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

function toEntry(
  row: Record<string, unknown>,
  viewerVote: boolean | null,
): ResolvedThesisEntry {
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
    status: row.status as 'vindicated' | 'refuted' | 'expired',
    resolution_date: row.resolution_date as string | null,
    resolved_at: row.resolved_at as string | null,
    agree_count: agree,
    disagree_count: disagree,
    agree_pct: total > 0 ? Math.round((agree / total) * 100) : 50,
    total_engagement: total,
    created_at: row.created_at as string,
    author: profiles
      ? {
          id: profiles.id,
          username: profiles.username,
          display_name: profiles.display_name,
          avatar_url: profiles.avatar_url,
          role: profiles.role,
        }
      : null,
    related_topic_id: row.related_topic_id as string | null,
    related_topic_statement: topics?.statement ?? null,
    viewer_vote: viewerVote,
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const statusFilter = searchParams.get('status') as 'vindicated' | 'refuted' | 'expired' | null
  const category = searchParams.get('category') || null
  const sort = searchParams.get('sort') || 'recent'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 60)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Fetch resolved theses ────────────────────────────────────────────────────

  const statuses = statusFilter
    ? [statusFilter]
    : ['vindicated', 'refuted', 'expired']

  let query = supabase
    .from('civic_theses')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .in('status', statuses)
    .limit(limit * 2) // fetch extra for sorting

  if (category) query = query.eq('category', category)

  switch (sort) {
    case 'engagement':
      query = query.order('agree_count', { ascending: false })
      break
    case 'oldest':
      query = query.order('resolved_at', { ascending: true })
      break
    default: // 'recent'
      query = query.order('resolved_at', { ascending: false })
  }

  const { data: rows } = await query

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      vindicated: [],
      refuted: [],
      expired: [],
      total_vindicated: 0,
      total_refuted: 0,
      total_expired: 0,
      top_predictors: [],
      platform_accuracy_pct: 0,
    } satisfies ResolvedThesesResponse)
  }

  // ── Viewer votes ─────────────────────────────────────────────────────────────

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
    toEntry(r as Record<string, unknown>, user ? (viewerVotes[r.id] ?? null) : null)
  )

  const vindicated = entries.filter((e) => e.status === 'vindicated').slice(0, limit)
  const refuted = entries.filter((e) => e.status === 'refuted').slice(0, limit)
  const expired = entries.filter((e) => e.status === 'expired').slice(0, limit)

  // ── Platform accuracy ────────────────────────────────────────────────────────

  const concluded = entries.filter((e) => e.status === 'vindicated' || e.status === 'refuted')
  const vindicatedCount = concluded.filter((e) => e.status === 'vindicated').length
  const platformAccuracy = concluded.length > 0
    ? Math.round((vindicatedCount / concluded.length) * 100)
    : 0

  // ── Top predictors: users with most vindicated theses ───────────────────────
  // Aggregate from vindicated + refuted entries (no extra DB call)

  const authorStats: Record<string, {
    author: ThesisAuthor
    vindicated: number
    total: number
  }> = {}

  for (const e of concluded) {
    if (!e.author) continue
    if (!authorStats[e.author.id]) {
      authorStats[e.author.id] = { author: e.author, vindicated: 0, total: 0 }
    }
    authorStats[e.author.id].total++
    if (e.status === 'vindicated') authorStats[e.author.id].vindicated++
  }

  const topPredictors: AccuracyEntry[] = Object.values(authorStats)
    .filter((s) => s.total >= 1)
    .map((s) => ({
      user_id: s.author.id,
      username: s.author.username,
      display_name: s.author.display_name,
      avatar_url: s.author.avatar_url,
      role: s.author.role,
      total_resolved: s.total,
      vindicated: s.vindicated,
      accuracy_pct: Math.round((s.vindicated / s.total) * 100),
    }))
    .sort((a, b) => b.accuracy_pct - a.accuracy_pct || b.total_resolved - a.total_resolved)
    .slice(0, 8)

  return NextResponse.json({
    vindicated,
    refuted,
    expired,
    total_vindicated: vindicated.length,
    total_refuted: refuted.length,
    total_expired: expired.length,
    top_predictors: topPredictors,
    platform_accuracy_pct: platformAccuracy,
  } satisfies ResolvedThesesResponse)
}
