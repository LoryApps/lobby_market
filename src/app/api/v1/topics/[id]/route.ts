import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
}

const BASE_URL = 'https://lobby.market'

export interface V1TopicDetail {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: 'proposed' | 'active' | 'voting' | 'law' | 'failed'
  for_pct: number
  against_pct: number
  total_votes: number
  view_count: number
  support_count: number
  activation_threshold: number | null
  created_at: string
  voting_ends_at: string | null
  url: string
  embed_url: string
  og_image_url: string
  top_arguments: {
    id: string
    body: string
    side: 'for' | 'against'
    upvotes: number
    author_username: string | null
  }[]
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { error: 'Invalid topic ID. Must be a UUID.' },
      { status: 400, headers: CORS },
    )
  }

  try {
    const supabase = await createClient()

    const [topicResult, argsResult] = await Promise.all([
      supabase
        .from('topics')
        .select(
          'id, statement, description, category, scope, status, blue_pct, total_votes, view_count, support_count, activation_threshold, created_at, voting_ends_at',
        )
        .eq('id', id)
        .single(),
      supabase
        .from('arguments')
        .select('id, body, side, upvotes, profiles:author_id(username)')
        .eq('topic_id', id)
        .order('upvotes', { ascending: false })
        .limit(4),
    ])

    if (topicResult.error || !topicResult.data) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404, headers: CORS },
      )
    }

    const t = topicResult.data
    const forPct = Math.max(0, Math.min(100, Math.round(t.blue_pct ?? 50)))

    const topArgs = (argsResult.data ?? []).map((a) => ({
      id: a.id,
      body: a.body.slice(0, 240),
      side: a.side as 'for' | 'against',
      upvotes: a.upvotes ?? 0,
      author_username:
        (a.profiles as { username?: string } | null)?.username ?? null,
    }))

    const detail: V1TopicDetail = {
      id: t.id,
      statement: t.statement,
      description: t.description ?? null,
      category: t.category ?? null,
      scope: t.scope ?? 'Global',
      status: t.status as V1TopicDetail['status'],
      for_pct: forPct,
      against_pct: 100 - forPct,
      total_votes: t.total_votes ?? 0,
      view_count: t.view_count ?? 0,
      support_count: t.support_count ?? 0,
      activation_threshold: t.activation_threshold ?? null,
      created_at: t.created_at,
      voting_ends_at: t.voting_ends_at ?? null,
      url: `${BASE_URL}/topic/${t.id}`,
      embed_url: `${BASE_URL}/api/embed/topic/${t.id}`,
      og_image_url: `${BASE_URL}/api/og/topic/${t.id}`,
      top_arguments: topArgs,
    }

    return NextResponse.json({ data: detail }, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/topics/[id]]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
