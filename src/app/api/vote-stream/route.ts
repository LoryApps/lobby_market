import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoteStreamEntry {
  id: string
  side: 'blue' | 'red'
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
}

export interface VoteStreamStats {
  votesLast60s: number
  forPctLast60s: number
  votesLast5m: number
  forPctLast5m: number
  hotTopicId: string | null
  hotTopicStatement: string | null
  hotTopicCategory: string | null
  hotTopicVotes60s: number
}

export interface VoteStreamResponse {
  votes: VoteStreamEntry[]
  stats: VoteStreamStats
  lastUpdated: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const now = new Date()
    const ago60s = new Date(now.getTime() - 60_000).toISOString()
    const ago5m  = new Date(now.getTime() - 300_000).toISOString()
    const ago30m = new Date(now.getTime() - 1_800_000).toISOString()

    // ── Recent vote ticker (last 30 minutes, up to 60 entries) ─────────────
    const { data: rawVotes } = await supabase
      .from('votes')
      .select(`
        id,
        side,
        created_at,
        topics (
          id,
          statement,
          category,
          status,
          blue_pct,
          total_votes
        )
      `)
      .gte('created_at', ago30m)
      .order('created_at', { ascending: false })
      .limit(60)

    const votes: VoteStreamEntry[] = (rawVotes ?? [])
      .filter((v) => v.topics)
      .map((v) => ({
        id: v.id,
        side: v.side as 'blue' | 'red',
        created_at: v.created_at,
        topic: v.topics as VoteStreamEntry['topic'],
      }))

    // ── 60-second stats ─────────────────────────────────────────────────────
    const { data: recent60 } = await supabase
      .from('votes')
      .select('side, topic_id')
      .gte('created_at', ago60s)

    const votes60 = recent60 ?? []
    const forCount60 = votes60.filter((v) => v.side === 'blue').length
    const forPct60 = votes60.length > 0 ? Math.round((forCount60 / votes60.length) * 100) : 50

    // ── 5-minute stats ───────────────────────────────────────────────────────
    const { data: recent5m } = await supabase
      .from('votes')
      .select('side, topic_id')
      .gte('created_at', ago5m)

    const votes5m = recent5m ?? []
    const forCount5m = votes5m.filter((v) => v.side === 'blue').length
    const forPct5m = votes5m.length > 0 ? Math.round((forCount5m / votes5m.length) * 100) : 50

    // ── Hot topic (most votes in last 60s) ───────────────────────────────────
    const topicCounts: Record<string, number> = {}
    for (const v of votes60) {
      topicCounts[v.topic_id] = (topicCounts[v.topic_id] ?? 0) + 1
    }
    const hotTopicId = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const hotTopicVotes60s = hotTopicId ? topicCounts[hotTopicId] : 0

    let hotTopicStatement: string | null = null
    let hotTopicCategory: string | null = null
    if (hotTopicId) {
      const { data: ht } = await supabase
        .from('topics')
        .select('statement, category')
        .eq('id', hotTopicId)
        .maybeSingle()
      hotTopicStatement = ht?.statement ?? null
      hotTopicCategory = ht?.category ?? null
    }

    const stats: VoteStreamStats = {
      votesLast60s: votes60.length,
      forPctLast60s: forPct60,
      votesLast5m: votes5m.length,
      forPctLast5m: forPct5m,
      hotTopicId,
      hotTopicStatement,
      hotTopicCategory,
      hotTopicVotes60s,
    }

    return NextResponse.json({
      votes,
      stats,
      lastUpdated: now.toISOString(),
    } satisfies VoteStreamResponse)
  } catch (err) {
    console.error('[vote-stream] error:', err)
    return NextResponse.json({ votes: [], stats: null, lastUpdated: new Date().toISOString() }, { status: 500 })
  }
}
