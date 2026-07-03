import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HindsightTopicSummary {
  id: string
  statement: string
  status: string
  category: string | null
  blue_pct: number
  total_votes: number
  hindsight_total: number
  right_count: number
  wrong_count: number
  right_pct: number
  wrong_pct: number
}

export interface HindsightCategoryStat {
  category: string
  total: number
  right_count: number
  wrong_count: number
  wisdom_score: number
}

export interface HindsightRecentEntry {
  topic_id: string
  topic_statement: string
  topic_status: string
  verdict: 'right' | 'wrong'
  note: string | null
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  created_at: string
}

export interface HindsightDashboardResponse {
  platform: {
    total_hindsight_votes: number
    total_topics_with_hindsight: number
    wisdom_score: number
    right_count: number
    wrong_count: number
  }
  categories: HindsightCategoryStat[]
  most_regretted: HindsightTopicSummary[]
  most_vindicated: HindsightTopicSummary[]
  most_contested: HindsightTopicSummary[]
  recent: HindsightRecentEntry[]
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch all hindsight votes with topic + profile data
  const { data: rawVotes, error } = await supabase
    .from('topic_hindsight_votes')
    .select(`
      id,
      verdict,
      note,
      created_at,
      topic_id,
      user_id,
      topics:topic_id (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      ),
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const votes = rawVotes ?? []

  // ── Aggregate per-topic stats ─────────────────────────────────────────────

  const topicMap = new Map<string, {
    topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
    right: number
    wrong: number
  }>()

  for (const v of votes) {
    const t = Array.isArray(v.topics) ? v.topics[0] : (v.topics as Record<string, unknown> | null)
    if (!t) continue
    const topic = t as { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }

    const existing = topicMap.get(topic.id)
    if (existing) {
      if (v.verdict === 'right') existing.right++
      else existing.wrong++
    } else {
      topicMap.set(topic.id, {
        topic,
        right: v.verdict === 'right' ? 1 : 0,
        wrong: v.verdict === 'wrong' ? 1 : 0,
      })
    }
  }

  const topicSummaries: HindsightTopicSummary[] = Array.from(topicMap.values())
    .map(({ topic, right, wrong }) => {
      const total = right + wrong
      return {
        id: topic.id,
        statement: topic.statement,
        status: topic.status,
        category: topic.category,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes ?? 0,
        hindsight_total: total,
        right_count: right,
        wrong_count: wrong,
        right_pct: total > 0 ? Math.round((right / total) * 100) : 0,
        wrong_pct: total > 0 ? Math.round((wrong / total) * 100) : 0,
      }
    })
    .filter((s) => s.hindsight_total >= 2)

  // ── Platform-wide stats ────────────────────────────────────────────────────

  const totalVotes = votes.length
  const rightCount = votes.filter((v) => v.verdict === 'right').length
  const wrongCount = totalVotes - rightCount

  const platform = {
    total_hindsight_votes: totalVotes,
    total_topics_with_hindsight: topicMap.size,
    wisdom_score: totalVotes > 0 ? Math.round((rightCount / totalVotes) * 100) : 0,
    right_count: rightCount,
    wrong_count: wrongCount,
  }

  // ── Category breakdown ─────────────────────────────────────────────────────

  const catMap = new Map<string, { total: number; right: number; wrong: number }>()
  for (const s of topicSummaries) {
    const cat = s.category ?? 'Other'
    const existing = catMap.get(cat) ?? { total: 0, right: 0, wrong: 0 }
    existing.total += s.hindsight_total
    existing.right += s.right_count
    existing.wrong += s.wrong_count
    catMap.set(cat, existing)
  }

  const categories: HindsightCategoryStat[] = Array.from(catMap.entries())
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      right_count: stats.right,
      wrong_count: stats.wrong,
      wisdom_score: stats.total > 0 ? Math.round((stats.right / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // ── Most regretted (highest wrong%) ───────────────────────────────────────

  const most_regretted = [...topicSummaries]
    .sort((a, b) => b.wrong_pct - a.wrong_pct || b.hindsight_total - a.hindsight_total)
    .slice(0, 8)

  // ── Most vindicated (highest right%) ──────────────────────────────────────

  const most_vindicated = [...topicSummaries]
    .sort((a, b) => b.right_pct - a.right_pct || b.hindsight_total - a.hindsight_total)
    .slice(0, 8)

  // ── Most contested (closest to 50/50) ─────────────────────────────────────

  const most_contested = [...topicSummaries]
    .filter((s) => s.hindsight_total >= 4)
    .sort((a, b) => {
      const distA = Math.abs(a.right_pct - 50)
      const distB = Math.abs(b.right_pct - 50)
      return distA - distB
    })
    .slice(0, 6)

  // ── Recent activity ────────────────────────────────────────────────────────

  const recent: HindsightRecentEntry[] = votes.slice(0, 20).flatMap((v) => {
    const t = Array.isArray(v.topics) ? v.topics[0] : (v.topics as Record<string, unknown> | null)
    const p = Array.isArray(v.profiles) ? v.profiles[0] : (v.profiles as Record<string, unknown> | null)
    if (!t || !p) return []
    const topic = t as { id: string; statement: string; status: string }
    const profile = p as { username: string; display_name: string | null; avatar_url: string | null; role: string }
    return [{
      topic_id: topic.id,
      topic_statement: topic.statement,
      topic_status: topic.status,
      verdict: v.verdict as 'right' | 'wrong',
      note: v.note ?? null,
      username: profile.username,
      display_name: profile.display_name ?? null,
      avatar_url: profile.avatar_url ?? null,
      role: profile.role,
      created_at: v.created_at,
    }]
  })

  const response: HindsightDashboardResponse = {
    platform,
    categories,
    most_regretted,
    most_vindicated,
    most_contested,
    recent,
  }

  return NextResponse.json(response)
}
