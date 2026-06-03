import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900 // 15-min cache — historic records rarely change

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZenithTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
}

export interface CategoryZenith {
  category: string
  record_topic: ZenithTopic
  law_count: number
  total_votes: number
}

export interface PeakDay {
  date: string
  vote_count: number
}

export interface PeakLawDay {
  date: string
  law_count: number
  law_statements: string[]
}

export interface ZenithStats {
  total_votes_cast: number
  total_laws: number
  total_topics: number
  total_arguments: number
  platform_age_days: number
}

export interface ZenithResponse {
  most_voted_ever: ZenithTopic | null
  highest_consensus_law: ZenithTopic | null
  most_argued_topic: (ZenithTopic & { arg_count: number }) | null
  most_opposed_topic: ZenithTopic | null  // highest against% that still became law
  fastest_law: (ZenithTopic & { hours_to_law: number }) | null
  peak_voting_day: PeakDay | null
  peak_law_day: PeakLawDay | null
  category_zeniths: CategoryZenith[]
  top_10_by_votes: ZenithTopic[]
  stats: ZenithStats
  generated_at: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // ── Run queries in parallel ────────────────────────────────────────────────

  const [
    mostVotedRes,
    topicsRes,
    lawsRes,
    argsCountRes,
    mostArguedRes,
    peakVoteDayRes,
    peakLawDayRes,
    top10Res,
    platformAgeRes,
  ] = await Promise.all([
    // Most voted topic of all time
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .order('total_votes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Count totals for platform stats
    supabase
      .from('topics')
      .select('total_votes, status, category, blue_pct')
      .not('status', 'eq', 'archived'),

    // Laws — for consensus/opposition records and count
    supabase
      .from('laws')
      .select('topic_id, statement, category, blue_pct, total_votes, established_at')
      .eq('is_active', true)
      .order('total_votes', { ascending: false }),

    // Total argument count
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true }),

    // Most argued topic (join topic_arguments count to topics)
    supabase
      .from('topic_arguments')
      .select('topic_id')
      .not('topic_id', 'is', null)
      .limit(1000),  // will aggregate in JS

    // Peak voting day — daily vote aggregates
    supabase
      .from('votes')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(50000),  // sample last N votes for peak day calc

    // Peak law day — laws grouped by day
    supabase
      .from('laws')
      .select('established_at, statement')
      .not('established_at', 'is', null)
      .order('established_at', { ascending: true }),

    // Top 10 most voted topics
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .order('total_votes', { ascending: false })
      .limit(10),

    // Oldest topic for platform age
    supabase
      .from('topics')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // ── Compute platform stats ─────────────────────────────────────────────────

  const allTopics = topicsRes.data ?? []
  const allLaws = lawsRes.data ?? []
  const totalVotesCast = allTopics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
  const totalLaws = allLaws.length
  const totalTopics = allTopics.length
  const totalArguments = argsCountRes.count ?? 0

  const firstTopic = platformAgeRes.data
  const platformAgeDays = firstTopic
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - new Date(firstTopic.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const stats: ZenithStats = {
    total_votes_cast: totalVotesCast,
    total_laws: totalLaws,
    total_topics: totalTopics,
    total_arguments: totalArguments,
    platform_age_days: platformAgeDays,
  }

  // ── Highest consensus law ──────────────────────────────────────────────────

  let highestConsensusLaw: ZenithTopic | null = null
  let mostOpposedTopic: ZenithTopic | null = null

  if (allLaws.length > 0) {
    // Highest FOR% law (excluding extreme 100% which likely has 0 votes)
    const sorted = [...allLaws]
      .filter((l) => l.total_votes && l.total_votes > 0 && l.blue_pct)
      .sort((a, b) => (b.blue_pct ?? 0) - (a.blue_pct ?? 0))

    if (sorted.length > 0) {
      const l = sorted[0]
      highestConsensusLaw = {
        id: l.topic_id,
        statement: l.statement,
        category: l.category,
        status: 'law',
        total_votes: l.total_votes ?? 0,
        blue_pct: l.blue_pct ?? 0,
      }
    }

    // Most contested law that still passed (lowest FOR% >= 50%)
    const contested = [...allLaws]
      .filter((l) => l.total_votes && l.total_votes > 0 && l.blue_pct && l.blue_pct >= 50)
      .sort((a, b) => (a.blue_pct ?? 100) - (b.blue_pct ?? 100))

    if (contested.length > 0) {
      const l = contested[0]
      mostOpposedTopic = {
        id: l.topic_id,
        statement: l.statement,
        category: l.category,
        status: 'law',
        total_votes: l.total_votes ?? 0,
        blue_pct: l.blue_pct ?? 0,
      }
    }
  }

  // ── Most argued topic ──────────────────────────────────────────────────────

  let mostArguedTopic: (ZenithTopic & { arg_count: number }) | null = null

  if (mostArguedRes.data && mostArguedRes.data.length > 0) {
    const argsByTopic = new Map<string, number>()
    for (const a of mostArguedRes.data) {
      if (a.topic_id) {
        argsByTopic.set(a.topic_id, (argsByTopic.get(a.topic_id) ?? 0) + 1)
      }
    }
    const topArgTopic = [...argsByTopic.entries()].sort((a, b) => b[1] - a[1])[0]

    if (topArgTopic) {
      const { data: t } = await supabase
        .from('topics')
        .select('id, statement, category, status, total_votes, blue_pct')
        .eq('id', topArgTopic[0])
        .maybeSingle()

      if (t) {
        mostArguedTopic = { ...t, arg_count: topArgTopic[1] }
      }
    }
  }

  // ── Fastest law ────────────────────────────────────────────────────────────
  // Time from topic created_at to law established_at

  let fastestLaw: (ZenithTopic & { hours_to_law: number }) | null = null

  if (allLaws.length > 0) {
    const lawsWithTime = allLaws
      .filter((l) => l.established_at && l.total_votes && l.total_votes >= 3)

    if (lawsWithTime.length > 0) {
      // Get the corresponding topic created_at
      const lawTopicIds = lawsWithTime.slice(0, 20).map((l) => l.topic_id)
      const { data: topicsForLaws } = await supabase
        .from('topics')
        .select('id, created_at')
        .in('id', lawTopicIds)

      if (topicsForLaws && topicsForLaws.length > 0) {
        const topicMap = new Map(topicsForLaws.map((t) => [t.id, t.created_at]))
        let minHours = Infinity
        let fastestLawData: (typeof allLaws)[0] | null = null

        for (const l of lawsWithTime.slice(0, 20)) {
          const topicCreatedAt = topicMap.get(l.topic_id)
          if (!topicCreatedAt) continue
          const hours = Math.max(
            0.1,
            (new Date(l.established_at!).getTime() - new Date(topicCreatedAt).getTime()) /
              (1000 * 60 * 60)
          )
          if (hours < minHours) {
            minHours = hours
            fastestLawData = l
          }
        }

        if (fastestLawData && minHours !== Infinity) {
          fastestLaw = {
            id: fastestLawData.topic_id,
            statement: fastestLawData.statement,
            category: fastestLawData.category,
            status: 'law',
            total_votes: fastestLawData.total_votes ?? 0,
            blue_pct: fastestLawData.blue_pct ?? 0,
            hours_to_law: Math.round(minHours),
          }
        }
      }
    }
  }

  // ── Peak voting day ────────────────────────────────────────────────────────

  let peakVotingDay: PeakDay | null = null

  if (peakVoteDayRes.data && peakVoteDayRes.data.length > 0) {
    const dayMap = new Map<string, number>()
    for (const v of peakVoteDayRes.data) {
      const day = v.created_at.slice(0, 10)
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
    }
    const sorted = [...dayMap.entries()].sort((a, b) => b[1] - a[1])
    if (sorted.length > 0) {
      peakVotingDay = { date: sorted[0][0], vote_count: sorted[0][1] }
    }
  }

  // ── Peak law day ───────────────────────────────────────────────────────────

  let peakLawDay: PeakLawDay | null = null

  if (peakLawDayRes.data && peakLawDayRes.data.length > 0) {
    const dayMap = new Map<string, string[]>()
    for (const l of peakLawDayRes.data) {
      if (!l.established_at) continue
      const day = l.established_at.slice(0, 10)
      const existing = dayMap.get(day) ?? []
      existing.push(l.statement)
      dayMap.set(day, existing)
    }
    const sorted = [...dayMap.entries()].sort((a, b) => b[1].length - a[1].length)
    if (sorted.length > 0) {
      peakLawDay = {
        date: sorted[0][0],
        law_count: sorted[0][1].length,
        law_statements: sorted[0][1].slice(0, 3),
      }
    }
  }

  // ── Category zeniths ───────────────────────────────────────────────────────

  const categories = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  const categoryZeniths: CategoryZenith[] = []

  for (const cat of categories) {
    const catTopics = allTopics.filter((t) => t.category === cat)
    const catLaws = allLaws.filter((l) => l.category === cat)

    if (catTopics.length === 0) continue

    const topByVotes = catTopics
      .filter((t) => t.total_votes)
      .sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))[0]

    if (!topByVotes) continue

    // Fetch id if not in top10
    let recordTopicFull: ZenithTopic | null = null

    // Try top10 first
    const fromTop10 = (top10Res.data ?? []).find(
      (t) => t.category === cat && t.total_votes === topByVotes.total_votes
    )
    if (fromTop10) {
      recordTopicFull = fromTop10
    } else {
      // We need the id — fetch it
      const { data: fetched } = await supabase
        .from('topics')
        .select('id, statement, category, status, total_votes, blue_pct')
        .eq('category', cat)
        .order('total_votes', { ascending: false })
        .limit(1)
        .maybeSingle()
      recordTopicFull = fetched
    }

    if (!recordTopicFull) continue

    categoryZeniths.push({
      category: cat,
      record_topic: recordTopicFull,
      law_count: catLaws.length,
      total_votes: catTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0),
    })
  }

  // Sort by total votes descending
  categoryZeniths.sort((a, b) => b.total_votes - a.total_votes)

  // ── Response ───────────────────────────────────────────────────────────────

  const response: ZenithResponse = {
    most_voted_ever: mostVotedRes.data ?? null,
    highest_consensus_law: highestConsensusLaw,
    most_argued_topic: mostArguedTopic,
    most_opposed_topic: mostOpposedTopic,
    fastest_law: fastestLaw,
    peak_voting_day: peakVotingDay,
    peak_law_day: peakLawDay,
    category_zeniths: categoryZeniths,
    top_10_by_votes: top10Res.data ?? [],
    stats,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
  })
}
