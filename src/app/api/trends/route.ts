import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendWindow = '24h' | '7d' | '30d'

export interface TrendingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  recent_votes: number
  recent_views: number
  trend_score: number
  rank: number
}

export interface TrendingCategory {
  category: string
  recent_votes: number
  recent_topics: number
  total_topics: number
  top_statement: string | null
  share_pct: number          // % of all recent votes in this window
}

export interface TrendingTag {
  tag: string
  recent_topics: number      // topics with this tag updated in window
  total_topics: number
  vote_weight: number        // sum of total_votes for tagged topics
  rank: number
}

export interface TrendingVoice {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  recent_arguments: number
  recent_votes_cast: number
  trend_score: number
}

export interface TrendsResponse {
  topics: TrendingTopic[]
  categories: TrendingCategory[]
  tags: TrendingTag[]
  voices: TrendingVoice[]
  window: TrendWindow
  total_recent_votes: number
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function windowStart(w: TrendWindow): string {
  const ms = w === '24h' ? 86_400_000 : w === '7d' ? 7 * 86_400_000 : 30 * 86_400_000
  return new Date(Date.now() - ms).toISOString()
}

function trendScore(recentVotes: number, totalVotes: number, windowDays: number): number {
  // Recency-weighted: recent velocity × log of total popularity
  const velocity = recentVotes / windowDays
  const popularity = Math.log1p(totalVotes)
  return Math.round(velocity * popularity * 10) / 10
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('window') ?? '24h'
  const window: TrendWindow = raw === '7d' ? '7d' : raw === '30d' ? '30d' : '24h'
  const windowDays = window === '24h' ? 1 : window === '7d' ? 7 : 30
  const since = windowStart(window)

  const supabase = await createClient()

  // ── 1. Recent votes ────────────────────────────────────────────────────────
  const [{ data: recentVotes }, { data: recentArgs }, { data: recentVoteCasters }] =
    await Promise.all([
      supabase
        .from('votes')
        .select('topic_id, user_id')
        .gte('created_at', since)
        .limit(100_000),
      supabase
        .from('arguments')
        .select('author_id, topic_id')
        .gte('created_at', since)
        .limit(50_000),
      supabase
        .from('votes')
        .select('user_id')
        .gte('created_at', since)
        .limit(100_000),
    ])

  // ── 2. Count votes per topic ───────────────────────────────────────────────
  const votesByTopic = new Map<string, number>()
  for (const v of recentVotes ?? []) {
    votesByTopic.set(v.topic_id, (votesByTopic.get(v.topic_id) ?? 0) + 1)
  }

  // ── 3. Count arguments per author ─────────────────────────────────────────
  const argsByAuthor = new Map<string, number>()
  for (const a of recentArgs ?? []) {
    argsByAuthor.set(a.author_id, (argsByAuthor.get(a.author_id) ?? 0) + 1)
  }

  // ── 4. Count votes cast per user ──────────────────────────────────────────
  const votesByUser = new Map<string, number>()
  for (const v of recentVoteCasters ?? []) {
    votesByUser.set(v.user_id, (votesByUser.get(v.user_id) ?? 0) + 1)
  }

  const totalRecentVotes = recentVotes?.length ?? 0

  // ── 5. Top topic IDs by recent votes ──────────────────────────────────────
  const topTopicIds = Array.from(votesByTopic.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([id]) => id)

  // ── 6. Fetch topic details ─────────────────────────────────────────────────
  const { data: topicsRaw } = topTopicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, view_count, tags, created_at, updated_at')
        .in('id', topTopicIds)
    : { data: [] }

  const trending: TrendingTopic[] = (topicsRaw ?? [])
    .map((t) => {
      const rv = votesByTopic.get(t.id) ?? 0
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        recent_votes: rv,
        recent_views: t.view_count ?? 0,
        trend_score: trendScore(rv, t.total_votes, windowDays),
        rank: 0,
      }
    })
    .sort((a, b) => b.trend_score - a.trend_score)
    .map((t, i) => ({ ...t, rank: i + 1 }))
    .slice(0, 20)

  // ── 7. Category breakdown ─────────────────────────────────────────────────
  // Use a broader topic set to count categories properly
  const { data: activeTopics } = await supabase
    .from('topics')
    .select('id, category, statement, total_votes, tags')
    .in('status', ['active', 'voting', 'proposed'])
    .order('total_votes', { ascending: false })
    .limit(500)

  const catMap = new Map<string, { recentVotes: number; topics: string[]; totalTopics: number; topStatement: string | null; totalVotes: number }>()
  for (const t of activeTopics ?? []) {
    if (!t.category) continue
    const rv = votesByTopic.get(t.id) ?? 0
    const existing = catMap.get(t.category)
    if (existing) {
      existing.recentVotes += rv
      existing.totalTopics++
      existing.totalVotes += t.total_votes
      if (rv > 0) existing.topics.push(t.id)
      if (!existing.topStatement && rv > 0) existing.topStatement = t.statement
    } else {
      catMap.set(t.category, {
        recentVotes: rv,
        topics: rv > 0 ? [t.id] : [],
        totalTopics: 1,
        topStatement: rv > 0 ? t.statement : null,
        totalVotes: t.total_votes,
      })
    }
  }

  const categories: TrendingCategory[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      recent_votes: data.recentVotes,
      recent_topics: data.topics.length,
      total_topics: data.totalTopics,
      top_statement: data.topStatement,
      share_pct: totalRecentVotes > 0 ? Math.round((data.recentVotes / totalRecentVotes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.recent_votes - a.recent_votes)
    .slice(0, 10)

  // ── 8. Tag trends ──────────────────────────────────────────────────────────
  const tagMap = new Map<string, { recent: number; total: number; voteWeight: number }>()
  // Topics touched recently (have recent votes or were created in window)
  const recentTopicSet = new Set(topTopicIds)
  for (const t of activeTopics ?? []) {
    const isRecent = recentTopicSet.has(t.id)
    for (const tag of (t.tags as string[] | null) ?? []) {
      const existing = tagMap.get(tag)
      if (existing) {
        if (isRecent) existing.recent++
        existing.total++
        existing.voteWeight += t.total_votes
      } else {
        tagMap.set(tag, { recent: isRecent ? 1 : 0, total: 1, voteWeight: t.total_votes })
      }
    }
  }

  const tags: TrendingTag[] = Array.from(tagMap.entries())
    .filter(([, d]) => d.recent > 0)
    .map(([tag, d], i) => ({
      tag,
      recent_topics: d.recent,
      total_topics: d.total,
      vote_weight: d.voteWeight,
      rank: i + 1,
    }))
    .sort((a, b) => b.recent_topics - a.recent_topics || b.vote_weight - a.vote_weight)
    .map((t, i) => ({ ...t, rank: i + 1 }))
    .slice(0, 30)

  // ── 9. Trending voices ────────────────────────────────────────────────────
  const topAuthorIds = Array.from(argsByAuthor.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id)

  const { data: profilesRaw } = topAuthorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', topAuthorIds)
    : { data: [] }

  const voices: TrendingVoice[] = (profilesRaw ?? [])
    .map((p) => {
      const ra = argsByAuthor.get(p.id) ?? 0
      const rv = votesByUser.get(p.id) ?? 0
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        clout: p.clout,
        recent_arguments: ra,
        recent_votes_cast: rv,
        trend_score: ra * 3 + rv,
      }
    })
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, 10)

  return NextResponse.json({
    topics: trending,
    categories,
    tags,
    voices,
    window,
    total_recent_votes: totalRecentVotes,
    generated_at: new Date().toISOString(),
  } satisfies TrendsResponse)
}
