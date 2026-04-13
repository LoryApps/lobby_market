import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface PlatformStats {
  totals: {
    topics: number
    votes: number
    laws: number
    debates: number
    users: number
    arguments: number
    coalitions: number
  }
  topicsByStatus: Record<string, number>
  topicsByCategory: Array<{ category: string; count: number; vote_share: number }>
  lawsByCategory: Array<{ category: string; count: number }>
  topTopics: Array<{
    id: string
    statement: string
    category: string | null
    status: string
    total_votes: number
    blue_pct: number
  }>
  recentLaws: Array<{
    id: string
    statement: string
    category: string | null
    total_votes: number | null
    established_at: string
  }>
  dailyVotes: Array<{ date: string; votes: number }>
  topDebaters: Array<{
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    reputation_score: number
    total_votes: number
    clout: number
  }>
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // ── Run all independent queries in parallel ──────────────────────────────
  const [
    topicsRes,
    profilesRes,
    lawsRes,
    debatesRes,
    topTopicsRes,
    recentLawsRes,
    topDebatersRes,
  ] = await Promise.all([
    // All topics with status + category + vote counts
    supabase
      .from('topics')
      .select('id, status, category, total_votes')
      .not('status', 'eq', 'archived'),

    // User stats (count + totals)
    supabase
      .from('profiles')
      .select('id, total_votes, total_arguments')
      .limit(10000),

    // Laws
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, established_at, is_active')
      .eq('is_active', true)
      .order('established_at', { ascending: false }),

    // Debates count
    supabase
      .from('debates')
      .select('id')
      .limit(10000),

    // Top topics by engagement
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .in('status', ['proposed', 'active', 'voting', 'law'])
      .order('total_votes', { ascending: false })
      .limit(5),

    // Recent laws (for timeline)
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, established_at')
      .eq('is_active', true)
      .order('established_at', { ascending: false })
      .limit(5),

    // Top debaters by reputation
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, total_votes, clout')
      .order('reputation_score', { ascending: false })
      .limit(5),
  ])

  const topics = topicsRes.data ?? []
  const profiles = profilesRes.data ?? []
  const laws = lawsRes.data ?? []
  const debates = debatesRes.data ?? []

  // ── Aggregate totals ────────────────────────────────────────────────────

  const totalVotes = profiles.reduce((sum, p) => sum + (p.total_votes ?? 0), 0)
  const totalArguments = profiles.reduce((sum, p) => sum + (p.total_arguments ?? 0), 0)

  const totals = {
    topics: topics.length,
    votes: totalVotes,
    laws: laws.length,
    debates: debates.length,
    users: profiles.length,
    arguments: totalArguments,
    coalitions: 0, // filled below
  }

  // Coalitions count
  const { count: coalitionCount } = await supabase
    .from('coalitions')
    .select('id', { count: 'exact', head: true })
  totals.coalitions = coalitionCount ?? 0

  // ── Topics by status ────────────────────────────────────────────────────

  const topicsByStatus: Record<string, number> = {}
  for (const t of topics) {
    topicsByStatus[t.status] = (topicsByStatus[t.status] ?? 0) + 1
  }

  // ── Topics by category ──────────────────────────────────────────────────

  const catTopicMap: Record<string, { count: number; votes: number }> = {}
  for (const t of topics) {
    const cat = t.category ?? 'Other'
    if (!catTopicMap[cat]) catTopicMap[cat] = { count: 0, votes: 0 }
    catTopicMap[cat].count += 1
    catTopicMap[cat].votes += t.total_votes ?? 0
  }

  const totalVotesOnTopics = Object.values(catTopicMap).reduce((s, v) => s + v.votes, 0)

  const topicsByCategory = Object.entries(catTopicMap)
    .map(([category, { count, votes }]) => ({
      category,
      count,
      vote_share: totalVotesOnTopics > 0 ? Math.round((votes / totalVotesOnTopics) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // ── Laws by category ────────────────────────────────────────────────────

  const catLawMap: Record<string, number> = {}
  for (const l of laws) {
    const cat = l.category ?? 'Other'
    catLawMap[cat] = (catLawMap[cat] ?? 0) + 1
  }

  const lawsByCategory = Object.entries(catLawMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // ── Daily vote activity (last 30 days from votes table) ─────────────────
  // We use a simple approximation: we don't have a votes table with timestamps
  // easily accessible, so we generate synthetic data based on total_votes spread
  // over 30 days. In production you'd query a votes table with created_at.
  // For now, generate last-30-day placeholders with some realistic shape.

  const today = new Date()
  const dailyVotes: Array<{ date: string; votes: number }> = []

  // Attempt to get real vote counts from votes table grouped by day
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .limit(50000)

  if (recentVotes && recentVotes.length > 0) {
    // Group by date
    const dateMap: Record<string, number> = {}
    for (const v of recentVotes) {
      const d = v.created_at.slice(0, 10)
      dateMap[d] = (dateMap[d] ?? 0) + 1
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dailyVotes.push({ date: key, votes: dateMap[key] ?? 0 })
    }
  } else {
    // Fallback: empty 30-day array
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      dailyVotes.push({ date: d.toISOString().slice(0, 10), votes: 0 })
    }
  }

  // ── Compose response ─────────────────────────────────────────────────────

  const stats: PlatformStats = {
    totals,
    topicsByStatus,
    topicsByCategory,
    lawsByCategory,
    topTopics: topTopicsRes.data ?? [],
    recentLaws: recentLawsRes.data ?? [],
    dailyVotes,
    topDebaters: topDebatersRes.data ?? [],
  }

  return NextResponse.json(stats)
}
