import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1-hour CDN cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string | null
}

export interface AddressChampion {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
  reputation_score: number
}

export interface AddressCategoryHealth {
  category: string
  total_topics: number
  laws_passed: number
  active: number
  avg_consensus: number
  total_votes: number
}

export interface AddressData {
  // Platform totals
  total_citizens: number
  total_laws: number
  total_topics: number
  total_votes: number
  total_arguments: number
  total_debates: number
  total_coalitions: number

  // This week / recent period
  new_laws_this_week: number
  new_topics_this_week: number
  debates_this_week: number
  new_citizens_this_week: number

  // Recent laws for the address
  recent_laws: AddressLaw[]

  // Top civic champions
  champions: AddressChampion[]

  // Category health
  category_health: AddressCategoryHealth[]

  // Current legislative priorities (highest-voted active topics)
  legislative_priorities: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }[]

  // Most contested topics (closest to 50/50)
  contested: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
  }[]

  // Civic health snapshot
  law_passage_rate: number
  avg_consensus_on_laws: number
  active_debate_count: number

  generated_at: string
  period_label: string   // e.g. "July 2026"
  session_number: number // derived from months since platform epoch
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekAgoISO = weekAgo.toISOString()

    // Platform totals
    const [
      { count: totalCitizens },
      { count: totalTopics },
      { count: totalVotes },
      { count: totalArguments },
      { count: totalDebates },
      { count: totalCoalitions },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('topics').select('*', { count: 'exact', head: true }),
      supabase.from('votes').select('*', { count: 'exact', head: true }),
      supabase.from('arguments').select('*', { count: 'exact', head: true }),
      supabase.from('debates').select('*', { count: 'exact', head: true }),
      supabase.from('coalitions').select('*', { count: 'exact', head: true }),
    ])

    // Laws separately to get total count and recent
    const { data: allLaws, count: totalLaws } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at', { count: 'exact' })
      .eq('is_active', true)
      .order('established_at', { ascending: false })
      .limit(5)

    // This week's stats
    const [
      { count: newLaws },
      { count: newTopics },
      { count: newDebates },
      { count: newCitizens },
    ] = await Promise.all([
      supabase
        .from('laws')
        .select('*', { count: 'exact', head: true })
        .gte('established_at', weekAgoISO),
      supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgoISO),
      supabase
        .from('debates')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgoISO),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgoISO),
    ])

    // Top civic champions (by reputation_score)
    const { data: championsRaw } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, vote_streak, reputation_score')
      .not('role', 'eq', 'person')
      .order('reputation_score', { ascending: false })
      .limit(5)

    // Category health
    const { data: topicsForHealth } = await supabase
      .from('topics')
      .select('category, status, blue_pct, total_votes')
      .not('category', 'is', null)

    const categoryMap: Record<string, AddressCategoryHealth> = {}
    for (const t of topicsForHealth ?? []) {
      const cat = t.category as string
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          total_topics: 0,
          laws_passed: 0,
          active: 0,
          avg_consensus: 0,
          total_votes: 0,
        }
      }
      categoryMap[cat].total_topics++
      categoryMap[cat].total_votes += t.total_votes ?? 0
      if (t.status === 'law') {
        categoryMap[cat].laws_passed++
        categoryMap[cat].avg_consensus += t.blue_pct ?? 50
      }
      if (t.status === 'active') categoryMap[cat].active++
    }
    for (const cat of Object.values(categoryMap)) {
      if (cat.laws_passed > 0) {
        cat.avg_consensus = Math.round(cat.avg_consensus / cat.laws_passed)
      }
    }
    const categoryHealth = Object.values(categoryMap)
      .sort((a, b) => b.total_votes - a.total_votes)
      .slice(0, 8)

    // Legislative priorities: highest-voted active topics
    const { data: priorities } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(5)

    // Most contested (closest to 50/50)
    const { data: allActive } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .order('total_votes', { ascending: false })
      .limit(100)

    const contested = (allActive ?? [])
      .map((t) => ({ ...t, contestedness: Math.abs((t.blue_pct ?? 50) - 50) }))
      .sort((a, b) => a.contestedness - b.contestedness)
      .slice(0, 3)
      .map(({ contestedness: _c, ...t }) => t)

    // Active debates count
    const { count: activeDebates } = await supabase
      .from('debates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live')

    // Law passage rate
    const { count: resolved } = await supabase
      .from('topics')
      .select('*', { count: 'exact', head: true })
      .in('status', ['law', 'failed'])

    const lawPassageRate =
      resolved && (totalLaws ?? 0) > 0
        ? Math.round(((totalLaws ?? 0) / resolved) * 100)
        : 0

    // Avg consensus on laws
    const { data: lawConsensus } = await supabase
      .from('topics')
      .select('blue_pct')
      .eq('status', 'law')
      .not('blue_pct', 'is', null)

    const avgConsensus =
      (lawConsensus ?? []).length > 0
        ? Math.round(
            (lawConsensus ?? []).reduce((s, t) => s + (t.blue_pct ?? 50), 0) /
              (lawConsensus ?? []).length
          )
        : 50

    // Session number: months since Jan 2025 (platform epoch)
    const epoch = new Date('2025-01-01')
    const monthsDiff =
      (now.getFullYear() - epoch.getFullYear()) * 12 +
      (now.getMonth() - epoch.getMonth()) +
      1

    const periodLabel = now.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    const data: AddressData = {
      total_citizens: totalCitizens ?? 0,
      total_laws: totalLaws ?? 0,
      total_topics: totalTopics ?? 0,
      total_votes: totalVotes ?? 0,
      total_arguments: totalArguments ?? 0,
      total_debates: totalDebates ?? 0,
      total_coalitions: totalCoalitions ?? 0,

      new_laws_this_week: newLaws ?? 0,
      new_topics_this_week: newTopics ?? 0,
      debates_this_week: newDebates ?? 0,
      new_citizens_this_week: newCitizens ?? 0,

      recent_laws: (allLaws as AddressLaw[] | null) ?? [],
      champions: (championsRaw as AddressChampion[] | null) ?? [],
      category_health: categoryHealth,
      legislative_priorities: priorities ?? [],
      contested,

      law_passage_rate: lawPassageRate,
      avg_consensus_on_laws: avgConsensus,
      active_debate_count: activeDebates ?? 0,

      generated_at: now.toISOString(),
      period_label: periodLabel,
      session_number: Math.max(1, monthsDiff),
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch (err) {
    console.error('[/api/address]', err)
    return NextResponse.json({ error: 'Failed to generate address' }, { status: 500 })
  }
}
