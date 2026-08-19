import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface HotThesisEntry {
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
  total_engagement: number
  contest_pct: number
  days_to_resolve: number | null
}

export interface HotThesesResponse {
  most_debated: HotThesisEntry[]
  closest_call: HotThesisEntry[]
  oracle_watch: HotThesisEntry[]
  recently_resolved: HotThesisEntry[]
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function toEntry(row: Thesis & { total_engagement?: number }): HotThesisEntry {
  const total = (row.agree_count ?? 0) + (row.disagree_count ?? 0)
  const contestPct = total > 0
    ? Math.round(((row.disagree_count ?? 0) / total) * 100)
    : 50

  let daysToResolve: number | null = null
  if (row.resolution_date) {
    daysToResolve = Math.ceil(
      (new Date(row.resolution_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  }

  return {
    id: row.id,
    statement: row.statement,
    rationale: row.rationale,
    category: row.category,
    status: row.status,
    resolution_date: row.resolution_date,
    agree_count: row.agree_count,
    disagree_count: row.disagree_count,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    author: row.author,
    viewer_vote: row.viewer_vote ?? null,
    related_topic_id: row.related_topic_id,
    related_topic_statement: row.related_topic_statement,
    total_engagement: total,
    contest_pct: contestPct,
    days_to_resolve: daysToResolve,
  }
}

const SELECT_FIELDS = `
  id, user_id, statement, rationale, category,
  resolution_date, status, related_topic_id,
  agree_count, disagree_count, is_public, resolved_at,
  created_at, updated_at,
  profiles!civic_theses_user_id_fkey(id, username, display_name, avatar_url, role),
  topics!civic_theses_related_topic_id_fkey(statement)
`

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Most debated (by agree+disagree volume) ─────────────────────────────
  const mostDebatedPromise = supabase
    .from('civic_theses')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .eq('status', 'active')
    .gt('agree_count', 0)
    .order('agree_count', { ascending: false })
    .limit(6)

  // ── 2. Closest call (most contested — disagree_count closest to agree_count) ─
  const closestCallPromise = supabase
    .from('civic_theses')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .eq('status', 'active')
    .gt('disagree_count', 0)
    .order('disagree_count', { ascending: false })
    .limit(20)

  // ── 3. Oracle watch (theses with upcoming resolution dates) ────────────────
  const oracleWatchPromise = supabase
    .from('civic_theses')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .eq('status', 'active')
    .not('resolution_date', 'is', null)
    .gte('resolution_date', new Date().toISOString())
    .lte(
      'resolution_date',
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    )
    .order('resolution_date', { ascending: true })
    .limit(6)

  // ── 4. Recently resolved ──────────────────────────────────────────────────
  const recentlyResolvedPromise = supabase
    .from('civic_theses')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .in('status', ['vindicated', 'refuted'])
    .order('resolved_at', { ascending: false })
    .limit(6)

  const [mostDebatedRes, closestCallRes, oracleWatchRes, recentlyResolvedRes] =
    await Promise.all([
      mostDebatedPromise,
      closestCallPromise,
      oracleWatchPromise,
      recentlyResolvedPromise,
    ])

  // Fetch viewer votes if logged in
  let viewerVotes: Record<string, boolean> = {}
  if (user) {
    const allIds = [
      ...(mostDebatedRes.data ?? []),
      ...(closestCallRes.data ?? []),
      ...(oracleWatchRes.data ?? []),
      ...(recentlyResolvedRes.data ?? []),
    ].map((r) => r.id)

    if (allIds.length > 0) {
      const { data: votes } = await supabase
        .from('thesis_votes')
        .select('thesis_id, agree')
        .eq('user_id', user.id)
        .in('thesis_id', [...new Set(allIds)])

      for (const v of votes ?? []) {
        viewerVotes[v.thesis_id] = v.agree
      }
    }
  }

  function mapRows(rows: typeof mostDebatedRes.data): HotThesisEntry[] {
    if (!rows) return []
    return rows.map((r) => {
      const raw = r as typeof r & {
        profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
        topics: { statement: string } | null
      }
      const thesis: Thesis = {
        id: r.id,
        user_id: r.user_id,
        statement: r.statement,
        rationale: r.rationale,
        category: r.category,
        resolution_date: r.resolution_date,
        status: r.status as Thesis['status'],
        related_topic_id: r.related_topic_id,
        agree_count: r.agree_count,
        disagree_count: r.disagree_count,
        is_public: r.is_public,
        resolved_at: r.resolved_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        author: raw.profiles
          ? { id: raw.profiles.id, username: raw.profiles.username, display_name: raw.profiles.display_name, avatar_url: raw.profiles.avatar_url, role: raw.profiles.role }
          : null,
        viewer_vote: user ? (viewerVotes[r.id] ?? null) : null,
        related_topic_statement: raw.topics?.statement ?? null,
      }
      return toEntry(thesis)
    })
  }

  // Sort "closest call" by how close to 50/50 split
  const closestCallMapped = mapRows(closestCallRes.data)
    .filter((e) => e.total_engagement >= 2)
    .sort((a, b) => Math.abs(a.contest_pct - 50) - Math.abs(b.contest_pct - 50))
    .slice(0, 6)

  return NextResponse.json({
    most_debated: mapRows(mostDebatedRes.data),
    closest_call: closestCallMapped,
    oracle_watch: mapRows(oracleWatchRes.data),
    recently_resolved: mapRows(recentlyResolvedRes.data),
  } satisfies HotThesesResponse)
}
