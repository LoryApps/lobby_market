import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface ThesisOfTheDayResponse {
  thesis: ThesisOfTheDay | null
  date: string
}

export interface ThesisOfTheDay {
  id: string
  statement: string
  rationale: string | null
  category: string
  status: string
  resolution_date: string | null
  agree_count: number
  disagree_count: number
  created_at: string
  resolved_at: string | null
  author: ThesisAuthor | null
  viewer_vote: boolean | null
  related_topic_id: string | null
  related_topic_statement: string | null
  total_votes: number
  agree_pct: number
  contest_score: number
  days_until_resolution: number | null
  quality_score: number
}

const SELECT = `
  id, user_id, statement, rationale, category,
  resolution_date, status, related_topic_id,
  agree_count, disagree_count, is_public, resolved_at,
  created_at, updated_at,
  profiles!civic_theses_user_id_fkey(id, username, display_name, avatar_url, role),
  topics!civic_theses_related_topic_id_fkey(statement)
`

function todayKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// Simple deterministic hash to select one thesis per day from the candidate list
function dayHash(dateKey: string, n: number): number {
  let h = 0
  for (let i = 0; i < dateKey.length; i++) {
    h = (h * 31 + dateKey.charCodeAt(i)) >>> 0
  }
  return h % n
}

function scoreThesis(t: {
  agree_count: number
  disagree_count: number
  rationale: string | null
  related_topic_id: string | null
  resolution_date: string | null
  created_at: string
}): number {
  const total = t.agree_count + t.disagree_count
  if (total < 2) return 0

  // Contestedness: reward 45-55% split more than landslides
  const agreePct = t.agree_count / total
  const contestScore = 1 - Math.abs(agreePct - 0.5) * 2

  // Engagement volume (log scale)
  const engagementScore = Math.log1p(total) / Math.log1p(100)

  // Quality bonus: has rationale, has related topic
  const qualityBonus = (t.rationale ? 0.2 : 0) + (t.related_topic_id ? 0.1 : 0)

  // Recency: prefer theses created in the last 30 days
  const ageMs = Date.now() - new Date(t.created_at).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const recencyScore = Math.max(0, 1 - ageDays / 60)

  return contestScore * 0.4 + engagementScore * 0.3 + qualityBonus * 0.1 + recencyScore * 0.2
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const dateKey = todayKey()

  // Fetch candidates: active theses from the last 60 days with at least 1 vote
  const thirtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await supabase
    .from('civic_theses')
    .select(SELECT)
    .eq('status', 'active')
    .eq('is_public', true)
    .gte('created_at', thirtyDaysAgo)
    .gte('agree_count', 1)
    .order('agree_count', { ascending: false })
    .limit(50)

  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ thesis: null, date: dateKey } satisfies ThesisOfTheDayResponse)
  }

  // Score all candidates
  const scored = rows
    .map((r) => ({
      row: r as typeof r & {
        profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
        topics: { statement: string } | null
      },
      score: scoreThesis({
        agree_count: r.agree_count,
        disagree_count: r.disagree_count,
        rationale: r.rationale,
        related_topic_id: r.related_topic_id,
        resolution_date: r.resolution_date,
        created_at: r.created_at,
      }),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return NextResponse.json({ thesis: null, date: dateKey } satisfies ThesisOfTheDayResponse)
  }

  // Take top 10 candidates and pick one deterministically based on today's date
  const topN = Math.min(10, scored.length)
  const selected = scored[dayHash(dateKey, topN)]

  // Fetch viewer vote if logged in
  let viewerVote: boolean | null = null
  if (user) {
    const { data: vote } = await supabase
      .from('thesis_votes')
      .select('agree')
      .eq('thesis_id', selected.row.id)
      .eq('user_id', user.id)
      .maybeSingle()

    viewerVote = vote?.agree ?? null
  }

  const r = selected.row
  const total = r.agree_count + r.disagree_count
  const agreePct = total > 0 ? Math.round((r.agree_count / total) * 100) : 50

  let daysUntilResolution: number | null = null
  if (r.resolution_date) {
    const diff = new Date(r.resolution_date).getTime() - Date.now()
    daysUntilResolution = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const thesis: ThesisOfTheDay = {
    id: r.id,
    statement: r.statement,
    rationale: r.rationale,
    category: r.category,
    status: r.status,
    resolution_date: r.resolution_date,
    agree_count: r.agree_count,
    disagree_count: r.disagree_count,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
    author: r.profiles
      ? {
          id: r.profiles.id,
          username: r.profiles.username,
          display_name: r.profiles.display_name,
          avatar_url: r.profiles.avatar_url,
          role: r.profiles.role,
        }
      : null,
    viewer_vote: viewerVote,
    related_topic_id: r.related_topic_id,
    related_topic_statement: r.topics?.statement ?? null,
    total_votes: total,
    agree_pct: agreePct,
    contest_score: Math.round(selected.score * 100),
    days_until_resolution: daysUntilResolution,
    quality_score: Math.round(selected.score * 100),
  }

  return NextResponse.json({ thesis, date: dateKey } satisfies ThesisOfTheDayResponse)
}
