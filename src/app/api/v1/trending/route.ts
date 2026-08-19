import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  for_pct: number
  against_pct: number
  total_votes: number
  url: string
}

interface TrendingArgument {
  id: string
  topic_id: string
  topic_statement: string
  side: 'for' | 'against'
  content: string
  upvotes: number
  ai_score: number | null
  url: string
}

interface TrendingLaw {
  id: string
  statement: string
  category: string | null
  for_pct: number
  total_votes: number
  established_at: string
  url: string
}

interface TrendingPulse {
  active_topics: number
  topics_in_voting: number
  new_laws_this_week: number
  live_debates: number
}

export interface V1TrendingResponse {
  topics: TrendingTopic[]
  arguments: TrendingArgument[]
  laws: TrendingLaw[]
  pulse: TrendingPulse
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
}

const BASE_URL = 'https://lobby.market'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Run all queries in parallel for speed
    const [topicsRes, argumentsRes, lawsRes, activeRes, votingRes, lawsWeekRes, debatesRes] =
      await Promise.all([
        // Top trending active topics by feed_score
        supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .in('status', ['active', 'voting'])
          .order('feed_score', { ascending: false })
          .limit(10),

        // Top arguments by upvotes in the last 48 hours
        supabase
          .from('topic_arguments')
          .select(
            'id, topic_id, side, content, upvotes, ai_score, topics!inner(statement)',
          )
          .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .order('upvotes', { ascending: false })
          .limit(10),

        // Most recently established laws (laws uses updated_at as the law date)
        supabase
          .from('laws')
          .select('id, statement, category, blue_pct, total_votes, updated_at, created_at')
          .order('updated_at', { ascending: false })
          .limit(5),

        // Count active topics
        supabase
          .from('topics')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),

        // Count topics in voting
        supabase
          .from('topics')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'voting'),

        // New laws this week
        supabase
          .from('laws')
          .select('id', { count: 'exact', head: true })
          .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Live debates count
        supabase
          .from('debates')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'live'),
      ])

    const topics: TrendingTopic[] = (topicsRes.data ?? []).map((t) => {
      const forPct = Math.max(0, Math.min(100, Math.round(t.blue_pct ?? 50)))
      return {
        id: t.id,
        statement: t.statement,
        category: t.category ?? null,
        status: t.status,
        for_pct: forPct,
        against_pct: 100 - forPct,
        total_votes: t.total_votes ?? 0,
        url: `${BASE_URL}/topic/${t.id}`,
      }
    })

    const arguments_: TrendingArgument[] = (argumentsRes.data ?? []).map((a) => {
      const topicRow = a.topics as unknown as { statement: string } | null
      return {
        id: a.id,
        topic_id: a.topic_id,
        topic_statement: topicRow?.statement ?? '',
        // topic_arguments stores side as 'blue' (for) / 'red' (against)
        side: a.side === 'blue' ? 'for' : 'against',
        content: a.content ?? '',
        upvotes: a.upvotes ?? 0,
        ai_score: a.ai_score ?? null,
        url: `${BASE_URL}/arguments/${a.id}`,
      }
    })

    const laws: TrendingLaw[] = (lawsRes.data ?? []).map((l) => {
      const forPct = Math.max(0, Math.min(100, Math.round(l.blue_pct ?? 50)))
      return {
        id: l.id,
        statement: l.statement,
        category: l.category ?? null,
        for_pct: forPct,
        total_votes: l.total_votes ?? 0,
        established_at: l.updated_at ?? l.created_at,
        url: `${BASE_URL}/law/${l.id}`,
      }
    })

    const pulse: TrendingPulse = {
      active_topics: activeRes.count ?? 0,
      topics_in_voting: votingRes.count ?? 0,
      new_laws_this_week: lawsWeekRes.count ?? 0,
      live_debates: debatesRes.count ?? 0,
    }

    const response: V1TrendingResponse = {
      topics,
      arguments: arguments_,
      laws,
      pulse,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/trending]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
