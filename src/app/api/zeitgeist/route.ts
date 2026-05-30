import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ZeitgeistCategoryMood {
  category: string
  blue_pct: number          // weighted avg FOR% across active/law topics
  topic_count: number
  trend: 'rising' | 'falling' | 'stable'  // vs platform average
}

export interface ZeitgeistMomentumTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
}

export interface ZeitgeistWeeklyStats {
  votes_cast: number
  arguments_made: number
  laws_passed: number
  new_topics: number
  active_debates: number
}

export interface ZeitgeistResponse {
  generated_at: string
  // 0–100: 100 = every topic has unanimous consensus, 0 = all perfectly split
  consensus_index: number
  // 0–100: 100 = most FOR platform-wide, 0 = most AGAINST
  platform_for_pct: number
  // Qualitative mood derived from consensus_index + for_pct
  mood_label: string
  mood_description: string
  mood_color: 'blue' | 'red' | 'purple' | 'gold' | 'emerald'
  category_moods: ZeitgeistCategoryMood[]
  momentum_topics: ZeitgeistMomentumTopic[]
  weekly_stats: ZeitgeistWeeklyStats
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

function deriveMood(
  consensusIndex: number,
  forPct: number,
): Pick<ZeitgeistResponse, 'mood_label' | 'mood_description' | 'mood_color'> {
  if (consensusIndex >= 70 && forPct >= 60) {
    return {
      mood_label: 'Progressive Consensus',
      mood_description: 'The Lobby is converging strongly on forward-looking positions. Momentum is clear.',
      mood_color: 'blue',
    }
  }
  if (consensusIndex >= 70 && forPct < 40) {
    return {
      mood_label: 'Cautious Consensus',
      mood_description: 'The community is largely aligned but trending against current proposals. Pushback is strong.',
      mood_color: 'red',
    }
  }
  if (consensusIndex >= 50 && forPct >= 50) {
    return {
      mood_label: 'Measured Optimism',
      mood_description: 'Moderate agreement with a FOR lean. The civic centre is holding.',
      mood_color: 'emerald',
    }
  }
  if (consensusIndex >= 50 && forPct < 50) {
    return {
      mood_label: 'Cautious Scepticism',
      mood_description: 'The community is moderately sceptical of recent proposals. Debate is substantive.',
      mood_color: 'gold',
    }
  }
  if (consensusIndex < 30) {
    return {
      mood_label: 'Deep Division',
      mood_description: 'The Lobby is at its most polarised. These are the debates that define the platform.',
      mood_color: 'purple',
    }
  }
  return {
    mood_label: 'Active Deliberation',
    mood_description: 'Views are mixed across categories. The community is actively working through its differences.',
    mood_color: 'purple',
  }
}

// ─── GET /api/zeitgeist ────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      allTopicsRes,
      weekVotesRes,
      weekArgsRes,
      weekLawsRes,
      weekTopicsRes,
      liveDebatesRes,
      momentumRes,
    ] = await Promise.all([
      // All active/law topics for consensus + category mood calc
      supabase
        .from('topics')
        .select('id, category, status, blue_pct, total_votes')
        .in('status', ['active', 'voting', 'law'])
        .gt('total_votes', 2),

      // Votes cast in last 7 days
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo),

      // Arguments made in last 7 days
      supabase
        .from('topic_arguments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo),

      // Laws passed this week
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'law')
        .gte('updated_at', weekAgo),

      // New topics proposed this week
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo),

      // Live/scheduled debates
      supabase
        .from('debates')
        .select('id', { count: 'exact', head: true })
        .in('status', ['live', 'scheduled']),

      // Momentum: highest feed_score active topics
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, feed_score')
        .in('status', ['active', 'voting'])
        .order('feed_score', { ascending: false })
        .limit(5),
    ])

    const allTopics = allTopicsRes.data ?? []

    // ── Consensus index ─────────────────────────────────────────────────────
    // For each topic: consensus strength = |blue_pct - 50| * 2 → 0-100
    // Weighted by total_votes, averaged across all topics
    let totalWeight = 0
    let weightedConsensus = 0
    let weightedForPct = 0

    for (const t of allTopics) {
      const w = Math.max(t.total_votes, 1)
      totalWeight += w
      weightedConsensus += Math.abs((t.blue_pct ?? 50) - 50) * 2 * w
      weightedForPct += (t.blue_pct ?? 50) * w
    }

    const consensusIndex = totalWeight > 0
      ? Math.round(weightedConsensus / totalWeight)
      : 50
    const platformForPct = totalWeight > 0
      ? Math.round(weightedForPct / totalWeight)
      : 50

    // ── Category moods ──────────────────────────────────────────────────────
    const categoryMap = new Map<
      string,
      { totalWeight: number; weightedForPct: number; count: number }
    >()

    for (const t of allTopics) {
      const cat = t.category ?? 'Other'
      if (!CATEGORIES.includes(cat)) continue
      const entry = categoryMap.get(cat) ?? { totalWeight: 0, weightedForPct: 0, count: 0 }
      const w = Math.max(t.total_votes, 1)
      entry.totalWeight += w
      entry.weightedForPct += (t.blue_pct ?? 50) * w
      entry.count++
      categoryMap.set(cat, entry)
    }

    const platformAvg = platformForPct
    const category_moods: ZeitgeistCategoryMood[] = CATEGORIES.map((cat) => {
      const entry = categoryMap.get(cat)
      if (!entry || entry.count === 0) {
        return { category: cat, blue_pct: 50, topic_count: 0, trend: 'stable' as const }
      }
      const bp = Math.round(entry.weightedForPct / entry.totalWeight)
      const diff = bp - platformAvg
      return {
        category: cat,
        blue_pct: bp,
        topic_count: entry.count,
        trend: diff > 5 ? 'rising' : diff < -5 ? 'falling' : 'stable',
      } as ZeitgeistCategoryMood
    })

    // ── Mood ─────────────────────────────────────────────────────────────────
    const mood = deriveMood(consensusIndex, platformForPct)

    // ── Weekly stats ─────────────────────────────────────────────────────────
    const weekly_stats: ZeitgeistWeeklyStats = {
      votes_cast: weekVotesRes.count ?? 0,
      arguments_made: weekArgsRes.count ?? 0,
      laws_passed: weekLawsRes.count ?? 0,
      new_topics: weekTopicsRes.count ?? 0,
      active_debates: liveDebatesRes.count ?? 0,
    }

    // ── Momentum topics ───────────────────────────────────────────────────────
    const momentum_topics: ZeitgeistMomentumTopic[] = (momentumRes.data ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      feed_score: t.feed_score,
    }))

    const response: ZeitgeistResponse = {
      generated_at: new Date().toISOString(),
      consensus_index: consensusIndex,
      platform_for_pct: platformForPct,
      ...mood,
      category_moods,
      momentum_topics,
      weekly_stats,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[zeitgeist]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
