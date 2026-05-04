import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10-minute CDN cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string
  total_topics: number
  laws_passed: number
  failed: number
  active: number
  law_rate: number // 0–100
  avg_consensus: number // avg blue_pct on law topics
  total_votes: number
}

export interface RoleDistribution {
  role: string
  label: string
  count: number
  pct: number
}

export interface MonthlyActivity {
  month: string  // "YYYY-MM"
  label: string  // "Jan 2025"
  topics_created: number
  laws_passed: number
  votes_cast: number
}

export interface TransparencyReport {
  // Platform totals
  total_users: number
  total_topics: number
  total_votes: number
  total_arguments: number
  total_laws: number
  total_debates: number
  total_coalitions: number

  // Health ratios
  law_passage_rate: number  // % of resolved topics that became law
  avg_votes_per_topic: number
  avg_consensus_on_laws: number  // avg blue_pct when topic became law

  // Category breakdown
  categories: CategoryBreakdown[]

  // Community
  roles: RoleDistribution[]

  // Top 5 most-voted laws
  top_laws: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    created_at: string
  }[]

  // Milestones
  milestones: {
    label: string
    value: string
    achieved: boolean
    threshold: number
    current: number
  }[]

  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const [
    userCountRes,
    topicsRes,
    argumentCountRes,
    debateCountRes,
    coalitionCountRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, role', { count: 'exact' }),
    supabase
      .from('topics')
      .select('id, category, status, blue_pct, total_votes, created_at')
      .order('total_votes', { ascending: false })
      .limit(2000),
    supabase.from('arguments').select('id', { count: 'exact', head: true }),
    supabase.from('debates').select('id', { count: 'exact', head: true }),
    supabase.from('coalitions').select('id', { count: 'exact', head: true }),
  ])

  const topics = topicsRes.data ?? []
  const profiles = userCountRes.data ?? []

  const total_users = userCountRes.count ?? profiles.length
  const total_topics = topics.length
  const total_arguments = argumentCountRes.count ?? 0
  const total_debates = debateCountRes.count ?? 0
  const total_coalitions = coalitionCountRes.count ?? 0

  const total_votes = topics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)

  // Laws / failed
  const lawTopics = topics.filter((t) => t.status === 'law')
  const failedTopics = topics.filter((t) => t.status === 'failed')
  const resolvedCount = lawTopics.length + failedTopics.length
  const total_laws = lawTopics.length

  const law_passage_rate =
    resolvedCount > 0 ? Math.round((lawTopics.length / resolvedCount) * 100) : 0

  const avg_votes_per_topic =
    total_topics > 0 ? Math.round(total_votes / total_topics) : 0

  const avg_consensus_on_laws =
    lawTopics.length > 0
      ? Math.round(
          lawTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / lawTopics.length
        )
      : 0

  // ─── Category breakdown ──────────────────────────────────────────────────────

  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  const categories: CategoryBreakdown[] = CATEGORIES.map((cat) => {
    const catTopics = topics.filter((t) => t.category === cat)
    const catLaws = catTopics.filter((t) => t.status === 'law')
    const catFailed = catTopics.filter((t) => t.status === 'failed')
    const catActive = catTopics.filter((t) =>
      t.status === 'active' || t.status === 'voting' || t.status === 'proposed'
    )
    const resolved = catLaws.length + catFailed.length
    const catVotes = catTopics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
    const avgConsensus =
      catLaws.length > 0
        ? Math.round(
            catLaws.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / catLaws.length
          )
        : 0

    return {
      category: cat,
      total_topics: catTopics.length,
      laws_passed: catLaws.length,
      failed: catFailed.length,
      active: catActive.length,
      law_rate: resolved > 0 ? Math.round((catLaws.length / resolved) * 100) : 0,
      avg_consensus: avgConsensus,
      total_votes: catVotes,
    }
  }).filter((c) => c.total_topics > 0)
    .sort((a, b) => b.total_topics - a.total_topics)

  // ─── Role distribution ───────────────────────────────────────────────────────

  const ROLE_LABELS: Record<string, string> = {
    person: 'Citizens',
    debator: 'Debators',
    troll_catcher: 'Troll Catchers',
    elder: 'Elders',
    senator: 'Senators',
    lawmaker: 'Lawmakers',
  }

  const roleCounts: Record<string, number> = {}
  for (const p of profiles) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1
  }

  const roles: RoleDistribution[] = Object.entries(roleCounts)
    .map(([role, count]) => ({
      role,
      label: ROLE_LABELS[role] ?? role,
      count,
      pct: total_users > 0 ? Math.round((count / total_users) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ─── Top laws ────────────────────────────────────────────────────────────────

  const top_laws = lawTopics
    .sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      statement: t.statement ?? '',
      category: t.category ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      created_at: t.created_at,
    }))

  // ─── Milestones ──────────────────────────────────────────────────────────────

  const milestones = [
    { label: 'First law established',  threshold: 1,      current: total_laws,    value: '1st Law' },
    { label: '10 laws passed',         threshold: 10,     current: total_laws,    value: '10 Laws' },
    { label: '100 laws passed',        threshold: 100,    current: total_laws,    value: '100 Laws' },
    { label: '1,000 citizens',         threshold: 1000,   current: total_users,   value: '1K Users' },
    { label: '10,000 citizens',        threshold: 10000,  current: total_users,   value: '10K Users' },
    { label: '100,000 votes cast',     threshold: 100000, current: total_votes,   value: '100K Votes' },
    { label: '1,000,000 votes cast',   threshold: 1000000, current: total_votes,  value: '1M Votes' },
    { label: '10,000 arguments made',  threshold: 10000,  current: total_arguments, value: '10K Arguments' },
  ].map((m) => ({
    ...m,
    achieved: m.current >= m.threshold,
  }))

  const report: TransparencyReport = {
    total_users,
    total_topics,
    total_votes,
    total_arguments,
    total_laws,
    total_debates,
    total_coalitions,
    law_passage_rate,
    avg_votes_per_topic,
    avg_consensus_on_laws,
    categories,
    roles,
    top_laws,
    milestones,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(report, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
  })
}
