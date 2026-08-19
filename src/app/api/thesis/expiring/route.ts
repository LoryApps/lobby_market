import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface ExpiringThesisEntry {
  id: string
  statement: string
  rationale: string | null
  category: string
  status: string
  resolution_date: string
  agree_count: number
  disagree_count: number
  created_at: string
  author: ThesisAuthor | null
  viewer_vote: boolean | null
  related_topic_id: string | null
  related_topic_statement: string | null
  total_engagement: number
  contest_pct: number
  hours_to_resolve: number
  days_to_resolve: number
}

export interface ExpiringThesesResponse {
  entries: ExpiringThesisEntry[]
  cutoff: string
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

  const now = new Date()
  const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: rows, error } = await supabase
    .from('civic_theses')
    .select(SELECT_FIELDS)
    .eq('is_public', true)
    .eq('status', 'active')
    .not('resolution_date', 'is', null)
    .gte('resolution_date', now.toISOString())
    .lte('resolution_date', cutoff.toISOString())
    .order('resolution_date', { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch viewer votes if logged in
  let viewerVotes: Record<string, boolean> = {}
  if (user && rows && rows.length > 0) {
    const ids = rows.map((r) => r.id)
    const { data: votes } = await supabase
      .from('thesis_votes')
      .select('thesis_id, agree')
      .eq('user_id', user.id)
      .in('thesis_id', ids)

    for (const v of votes ?? []) {
      viewerVotes[v.thesis_id] = v.agree
    }
  }

  const entries: ExpiringThesisEntry[] = (rows ?? []).map((r) => {
    const raw = r as typeof r & {
      profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
      topics: { statement: string } | null
    }

    const total = (r.agree_count ?? 0) + (r.disagree_count ?? 0)
    const contestPct = total > 0
      ? Math.round(((r.disagree_count ?? 0) / total) * 100)
      : 50

    const msLeft = new Date(r.resolution_date!).getTime() - now.getTime()
    const hoursToResolve = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60)))
    const daysToResolve = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))

    return {
      id: r.id,
      statement: r.statement,
      rationale: r.rationale,
      category: r.category,
      status: r.status,
      resolution_date: r.resolution_date!,
      agree_count: r.agree_count,
      disagree_count: r.disagree_count,
      created_at: r.created_at,
      author: raw.profiles
        ? {
            id: raw.profiles.id,
            username: raw.profiles.username,
            display_name: raw.profiles.display_name,
            avatar_url: raw.profiles.avatar_url,
            role: raw.profiles.role,
          }
        : null,
      viewer_vote: user ? (viewerVotes[r.id] ?? null) : null,
      related_topic_id: r.related_topic_id,
      related_topic_statement: raw.topics?.statement ?? null,
      total_engagement: total,
      contest_pct: contestPct,
      hours_to_resolve: hoursToResolve,
      days_to_resolve: daysToResolve,
    }
  })

  return NextResponse.json({ entries, cutoff: cutoff.toISOString() } satisfies ExpiringThesesResponse)
}
