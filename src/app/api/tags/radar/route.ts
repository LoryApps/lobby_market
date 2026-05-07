import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagRadarDimensions {
  /** Normalised 0–100: raw topic count relative to most-popular followed tag */
  scale: number
  /** 0–100: law_count / topic_count percentage */
  governance: number
  /** 0–100: active/voting count relative to max across followed tags */
  activity: number
  /** 0–100: total_votes relative to max across followed tags */
  engagement: number
  /** 0–100: recent_topics (last 7 days) relative to max across followed tags */
  freshness: number
  /** 0–100: average consensus (how close to 50/50 across debates — higher = more polarised) */
  polarisation: number
}

export interface TagRadarEntry {
  tag: string
  raw: {
    topic_count: number
    law_count: number
    active_count: number
    total_votes: number
    recent_count: number
    avg_margin: number
  }
  dimensions: TagRadarDimensions
}

export interface TagRadarResponse {
  entries: TagRadarEntry[]
  is_authenticated: boolean
  total_followed: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      entries: [],
      is_authenticated: false,
      total_followed: 0,
    } satisfies TagRadarResponse)
  }

  // 1. Followed tags
  const { data: followRows } = await supabase
    .from('user_tag_follows')
    .select('tag, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const followedTags = (followRows ?? []).map((r) => r.tag as string)

  if (followedTags.length === 0) {
    return NextResponse.json({
      entries: [],
      is_authenticated: true,
      total_followed: 0,
    } satisfies TagRadarResponse)
  }

  // 2. Topics that contain any followed tag
  const { data: topicRows } = await supabase
    .from('topics')
    .select('tags, status, total_votes, blue_pct, created_at')
    .overlaps('tags', followedTags)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .limit(3000)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 3. Aggregate raw stats per tag
  type TagRaw = {
    topic_count: number
    law_count: number
    active_count: number
    total_votes: number
    recent_count: number
    margin_sum: number
    margin_n: number
  }

  const tagMap = new Map<string, TagRaw>()
  for (const tag of followedTags) {
    tagMap.set(tag, {
      topic_count: 0,
      law_count: 0,
      active_count: 0,
      total_votes: 0,
      recent_count: 0,
      margin_sum: 0,
      margin_n: 0,
    })
  }

  for (const row of topicRows ?? []) {
    const tags: string[] = row.tags ?? []
    for (const tag of tags) {
      if (!tagMap.has(tag)) continue
      const e = tagMap.get(tag)!
      e.topic_count++
      e.total_votes += row.total_votes ?? 0
      if (row.status === 'law') e.law_count++
      if (row.status === 'active' || row.status === 'voting') e.active_count++
      if (row.created_at >= sevenDaysAgo) e.recent_count++
      if (row.blue_pct != null) {
        e.margin_sum += Math.abs((row.blue_pct ?? 50) - 50) * 2
        e.margin_n++
      }
    }
  }

  // 4. Normalise each dimension across the set of followed tags
  const raws = followedTags.map((tag) => {
    const e = tagMap.get(tag)!
    return {
      tag,
      topic_count: e.topic_count,
      law_count: e.law_count,
      active_count: e.active_count,
      total_votes: e.total_votes,
      recent_count: e.recent_count,
      avg_margin: e.margin_n > 0 ? e.margin_sum / e.margin_n : 50,
    }
  })

  const maxTopics = Math.max(...raws.map((r) => r.topic_count), 1)
  const maxVotes = Math.max(...raws.map((r) => r.total_votes), 1)
  const maxActive = Math.max(...raws.map((r) => r.active_count), 1)
  const maxRecent = Math.max(...raws.map((r) => r.recent_count), 1)

  function norm(val: number, max: number): number {
    return Math.min(100, Math.round((val / max) * 100))
  }

  const entries: TagRadarEntry[] = raws.map((r) => {
    const governance =
      r.topic_count > 0 ? Math.round((r.law_count / r.topic_count) * 100) : 0

    return {
      tag: r.tag,
      raw: {
        topic_count: r.topic_count,
        law_count: r.law_count,
        active_count: r.active_count,
        total_votes: r.total_votes,
        recent_count: r.recent_count,
        avg_margin: Math.round(r.avg_margin),
      },
      dimensions: {
        scale: norm(r.topic_count, maxTopics),
        governance: Math.min(100, governance),
        activity: norm(r.active_count, maxActive),
        engagement: norm(r.total_votes, maxVotes),
        freshness: norm(r.recent_count, maxRecent),
        polarisation: Math.min(100, Math.round(r.avg_margin)),
      },
    }
  })

  // Limit to 8 tags for readability (most recently followed first)
  const trimmed = entries.slice(0, 8)

  return NextResponse.json({
    entries: trimmed,
    is_authenticated: true,
    total_followed: followedTags.length,
  } satisfies TagRadarResponse)
}
