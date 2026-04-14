import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Cache digest for 30 minutes at the CDN edge
export const revalidate = 1800

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DigestLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface DigestTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  view_count: number
}

export interface DigestDebater {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
}

export interface DigestCategory {
  category: string
  laws: number
  votes: number
}

export interface DigestData {
  week: {
    start: string
    end: string
    label: string
  }
  newLaws: DigestLaw[]
  mostViral: DigestTopic | null
  mostContested: DigestTopic | null
  topVoters: DigestDebater[]
  categoryBreakdown: DigestCategory[]
  platformCounts: {
    newTopics: number
    newVotes: number
    newUsers: number
    newDebates: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoIso = weekAgo.toISOString()

  // Format week label: "Apr 7–14, 2026"
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weekLabel = `${fmt(weekAgo)}–${fmt(now)}, ${now.getFullYear()}`

  // ── Parallel fetches ────────────────────────────────────────────────────────
  const [
    newLawsRes,
    viralRes,
    contestedRes,
    newTopicsRes,
    newUsersRes,
    newDebatesRes,
    topVotersRes,
  ] = await Promise.all([
    // Laws established this week
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at')
      .gte('established_at', weekAgoIso)
      .eq('is_active', true)
      .order('total_votes', { ascending: false })
      .limit(6),

    // Most viral topic this week: highest total_votes among active/voting
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct, view_count')
      .gte('created_at', weekAgoIso)
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(1),

    // Most contested: closest to 50/50 split, min 10 votes, this week
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct, view_count')
      .gte('created_at', weekAgoIso)
      .gte('total_votes', 10)
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('blue_pct', { ascending: true })
      .limit(100),

    // New topics this week
    supabase
      .from('topics')
      .select('id')
      .gte('created_at', weekAgoIso),

    // New users this week
    supabase
      .from('profiles')
      .select('id')
      .gte('created_at', weekAgoIso),

    // New debates this week
    supabase
      .from('debates')
      .select('id')
      .gte('created_at', weekAgoIso),

    // Top voters overall (ordered by reputation_score as a proxy for this week)
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
      .gt('total_votes', 0)
      .order('reputation_score', { ascending: false })
      .limit(5),
  ])

  // ── Most contested: pick the topic closest to 50% ─────────────────────────
  let mostContested: DigestTopic | null = null
  if (contestedRes.data && contestedRes.data.length > 0) {
    const closest = contestedRes.data.reduce((best, t) => {
      const distBest = Math.abs((best.blue_pct ?? 50) - 50)
      const distCurr = Math.abs((t.blue_pct ?? 50) - 50)
      return distCurr < distBest ? t : best
    })
    mostContested = closest as DigestTopic
  }

  // ── Most viral ─────────────────────────────────────────────────────────────
  const mostViral = (viralRes.data?.[0] as DigestTopic | undefined) ?? null

  // ── New votes estimate (sum of total_votes on new topics this week) ────────
  // We don't have a votes table with created_at easily accessible from here,
  // so we use the sum from the viral/contested candidates as an approximation.
  const newTopicVotes = (contestedRes.data ?? []).reduce(
    (s, t) => s + (t.total_votes ?? 0),
    0
  )
  const viralVotes = mostViral?.total_votes ?? 0
  const newVotesEstimate = Math.max(newTopicVotes, viralVotes)

  // ── Category breakdown from new laws ──────────────────────────────────────
  const catMap: Record<string, { laws: number; votes: number }> = {}
  for (const l of newLawsRes.data ?? []) {
    const cat = l.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { laws: 0, votes: 0 }
    catMap[cat].laws += 1
    catMap[cat].votes += l.total_votes ?? 0
  }
  // Also include contested topics by category for richer breakdown
  for (const t of contestedRes.data ?? []) {
    const cat = t.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { laws: 0, votes: 0 }
    catMap[cat].votes += t.total_votes ?? 0
  }

  const categoryBreakdown: DigestCategory[] = Object.entries(catMap)
    .map(([category, d]) => ({ category, ...d }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 6)

  // ── Compose response ────────────────────────────────────────────────────────
  const digest: DigestData = {
    week: {
      start: weekAgoIso,
      end: now.toISOString(),
      label: weekLabel,
    },
    newLaws: (newLawsRes.data ?? []) as DigestLaw[],
    mostViral,
    mostContested,
    topVoters: (topVotersRes.data ?? []) as DigestDebater[],
    categoryBreakdown,
    platformCounts: {
      newTopics: newTopicsRes.data?.length ?? 0,
      newVotes: newVotesEstimate,
      newUsers: newUsersRes.data?.length ?? 0,
      newDebates: newDebatesRes.data?.length ?? 0,
    },
  }

  return NextResponse.json(digest, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
  })
}
