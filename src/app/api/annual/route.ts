import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1-hour cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnnualTopLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface AnnualTopArgument {
  id: string
  content: string
  stance: string
  topic_statement: string
  topic_id: string
  upvotes: number
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface AnnualContributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  argument_count: number
}

export interface AnnualCategoryStats {
  category: string
  topics: number
  laws: number
  votes: number
  law_pct: number
}

export interface AnnualRecord {
  label: string
  value: string
  sublabel: string
  href: string | null
}

export interface AnnualMonthlyPoint {
  month: string        // e.g. "2025-01"
  label: string        // e.g. "Jan '25"
  topics: number
  laws: number
  votes: number
}

export interface AnnualData {
  generatedAt: string
  platform: {
    totalTopics: number
    totalLaws: number
    totalVotes: number
    totalArguments: number
    totalDebates: number
    totalUsers: number
    lawPassRate: number      // % of concluded topics that became law
    avgVotesPerTopic: number
    oldestTopicDate: string | null
  }
  topLaws: AnnualTopLaw[]
  topArgument: AnnualTopArgument | null
  topContributors: AnnualContributor[]
  categoryStats: AnnualCategoryStats[]
  records: AnnualRecord[]
  monthlyActivity: AnnualMonthlyPoint[]
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // ── Platform-wide counts ────────────────────────────────────────────────────
  const [
    { count: totalTopics },
    { count: totalLaws },
    { count: totalArguments },
    { count: totalDebates },
    { count: totalUsers },
  ] = await Promise.all([
    supabase.from('topics').select('*', { count: 'exact', head: true }),
    supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'law'),
    supabase.from('arguments').select('*', { count: 'exact', head: true }),
    supabase.from('debates').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  // Total votes (sum of total_votes on all topics)
  const { data: voteAgg } = await supabase
    .from('topics')
    .select('total_votes')
  const totalVotes = (voteAgg ?? []).reduce((s, t) => s + (t.total_votes ?? 0), 0)

  // Avg votes per topic
  const avgVotesPerTopic =
    totalTopics && totalTopics > 0
      ? Math.round(totalVotes / totalTopics)
      : 0

  // Law pass rate — concluded = law | failed
  const { count: concludedCount } = await supabase
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .in('status', ['law', 'failed'])
  const lawPassRate =
    concludedCount && concludedCount > 0
      ? Math.round(((totalLaws ?? 0) / concludedCount) * 100)
      : 0

  // Oldest topic
  const { data: oldestRow } = await supabase
    .from('topics')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  // ── Top laws ────────────────────────────────────────────────────────────────
  const { data: topLawsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, total_votes, blue_pct, updated_at')
    .eq('status', 'law')
    .order('total_votes', { ascending: false })
    .limit(8)

  const topLaws: AnnualTopLaw[] = (topLawsRaw ?? []).map((l) => ({
    id: l.id,
    statement: l.statement,
    category: l.category,
    total_votes: l.total_votes,
    blue_pct: l.blue_pct,
    established_at: l.updated_at,
  }))

  // ── Top argument (all time by upvotes) ──────────────────────────────────────
  const { data: topArgRaw } = await supabase
    .from('arguments')
    .select(`
      id, content, stance, upvotes,
      topics!inner(id, statement),
      profiles!inner(username, display_name, avatar_url)
    `)
    .order('upvotes', { ascending: false })
    .limit(1)
    .single()

  const topArgument: AnnualTopArgument | null = topArgRaw
    ? {
        id: topArgRaw.id,
        content: topArgRaw.content,
        stance: topArgRaw.stance,
        upvotes: topArgRaw.upvotes ?? 0,
        // @ts-expect-error joined relation
        topic_statement: (topArgRaw.topics as { statement: string }).statement,
        // @ts-expect-error joined relation
        topic_id: (topArgRaw.topics as { id: string }).id,
        // @ts-expect-error joined relation
        username: (topArgRaw.profiles as { username: string }).username,
        // @ts-expect-error joined relation
        display_name: (topArgRaw.profiles as { display_name: string | null }).display_name,
        // @ts-expect-error joined relation
        avatar_url: (topArgRaw.profiles as { avatar_url: string | null }).avatar_url,
      }
    : null

  // ── Top contributors (by argument count + clout) ─────────────────────────
  const { data: argCounts } = await supabase
    .from('arguments')
    .select('author_id')
  const countMap: Record<string, number> = {}
  for (const row of argCounts ?? []) {
    if (row.author_id) countMap[row.author_id] = (countMap[row.author_id] ?? 0) + 1
  }
  const topAuthorIds = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id)

  let topContributors: AnnualContributor[] = []
  if (topAuthorIds.length > 0) {
    const { data: contribProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', topAuthorIds)
    topContributors = (contribProfiles ?? []).map((p) => ({
      ...p,
      argument_count: countMap[p.id] ?? 0,
    })).sort((a, b) => b.argument_count - a.argument_count)
  }

  // ── Category stats ──────────────────────────────────────────────────────────
  const { data: allTopicsForCat } = await supabase
    .from('topics')
    .select('category, status, total_votes')
  const catMap: Record<string, { topics: number; laws: number; votes: number }> = {}
  for (const t of allTopicsForCat ?? []) {
    const cat = t.category ?? 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { topics: 0, laws: 0, votes: 0 }
    catMap[cat].topics += 1
    if (t.status === 'law') catMap[cat].laws += 1
    catMap[cat].votes += t.total_votes ?? 0
  }
  const categoryStats: AnnualCategoryStats[] = Object.entries(catMap)
    .filter(([cat]) => cat !== 'Uncategorized')
    .map(([category, s]) => ({
      category,
      ...s,
      law_pct: s.topics > 0 ? Math.round((s.laws / s.topics) * 100) : 0,
    }))
    .sort((a, b) => b.votes - a.votes)

  // ── Records ─────────────────────────────────────────────────────────────────
  const { data: mostVotedTopic } = await supabase
    .from('topics')
    .select('id, statement, total_votes')
    .order('total_votes', { ascending: false })
    .limit(1)
    .single()

  const { data: mostDebatedTopic } = await supabase
    .from('topics')
    .select('id, statement, argument_count')
    .order('argument_count', { ascending: false })
    .limit(1)
    .single()

  const { data: mostViewedTopic } = await supabase
    .from('topics')
    .select('id, statement, view_count')
    .order('view_count', { ascending: false })
    .limit(1)
    .single()

  const records: AnnualRecord[] = [
    mostVotedTopic
      ? {
          label: 'Most Voted Topic',
          value: mostVotedTopic.total_votes?.toLocaleString() + ' votes',
          sublabel: mostVotedTopic.statement.slice(0, 80) + (mostVotedTopic.statement.length > 80 ? '…' : ''),
          href: `/topic/${mostVotedTopic.id}`,
        }
      : null,
    mostDebatedTopic
      ? {
          label: 'Most Argued Topic',
          value: (mostDebatedTopic.argument_count ?? 0).toLocaleString() + ' arguments',
          sublabel: mostDebatedTopic.statement.slice(0, 80) + (mostDebatedTopic.statement.length > 80 ? '…' : ''),
          href: `/topic/${mostDebatedTopic.id}`,
        }
      : null,
    mostViewedTopic
      ? {
          label: 'Most Viewed Topic',
          value: (mostViewedTopic.view_count ?? 0).toLocaleString() + ' views',
          sublabel: mostViewedTopic.statement.slice(0, 80) + (mostViewedTopic.statement.length > 80 ? '…' : ''),
          href: `/topic/${mostViewedTopic.id}`,
        }
      : null,
    topArgument
      ? {
          label: 'Most Upvoted Argument',
          value: topArgument.upvotes.toLocaleString() + ' upvotes',
          sublabel: `by @${topArgument.username} · ${topArgument.stance.toUpperCase()}`,
          href: `/topic/${topArgument.topic_id}`,
        }
      : null,
  ].filter(Boolean) as AnnualRecord[]

  // ── Monthly activity (last 12 months) ───────────────────────────────────────
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
  twelveMonthsAgo.setDate(1)
  twelveMonthsAgo.setHours(0, 0, 0, 0)

  const { data: recentTopics } = await supabase
    .from('topics')
    .select('created_at, status, total_votes')
    .gte('created_at', twelveMonthsAgo.toISOString())

  const monthlyMap: Record<string, { topics: number; laws: number; votes: number }> = {}
  for (const t of recentTopics ?? []) {
    const d = new Date(t.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap[key]) monthlyMap[key] = { topics: 0, laws: 0, votes: 0 }
    monthlyMap[key].topics += 1
    if (t.status === 'law') monthlyMap[key].laws += 1
    monthlyMap[key].votes += t.total_votes ?? 0
  }

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyActivity: AnnualMonthlyPoint[] = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, s]) => {
      const [year, mon] = month.split('-')
      return {
        month,
        label: `${monthLabels[parseInt(mon, 10) - 1]} '${year.slice(2)}`,
        ...s,
      }
    })

  const data: AnnualData = {
    generatedAt: new Date().toISOString(),
    platform: {
      totalTopics: totalTopics ?? 0,
      totalLaws: totalLaws ?? 0,
      totalVotes,
      totalArguments: totalArguments ?? 0,
      totalDebates: totalDebates ?? 0,
      totalUsers: totalUsers ?? 0,
      lawPassRate,
      avgVotesPerTopic,
      oldestTopicDate: oldestRow?.created_at ?? null,
    },
    topLaws,
    topArgument,
    topContributors,
    categoryStats,
    records,
    monthlyActivity,
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' },
  })
}
