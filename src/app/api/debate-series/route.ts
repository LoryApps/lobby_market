import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DebateSeries } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export interface SeriesListItem extends DebateSeries {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
  creator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  debate_count: number
}

export interface SeriesListResponse {
  series: SeriesListItem[]
}

// GET /api/debate-series — list series ordered by recency
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'ongoing'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  const { data: rows, error } = await supabase
    .from('debate_series')
    .select(`
      id, title, description, topic_id, creator_id, status, format,
      blue_wins, red_wins, winner_side, created_at, updated_at
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const seriesList = (rows ?? []) as DebateSeries[]

  const topicIds = [...new Set(seriesList.map((s) => s.topic_id).filter(Boolean))] as string[]
  const creatorIds = [...new Set(seriesList.map((s) => s.creator_id).filter(Boolean))] as string[]
  const seriesIds = seriesList.map((s) => s.id)

  const [topicsRes, creatorsRes, debateCountsRes] = await Promise.all([
    topicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category, status')
          .in('id', topicIds)
      : Promise.resolve({ data: [] }),
    creatorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', creatorIds)
      : Promise.resolve({ data: [] }),
    seriesIds.length
      ? supabase
          .from('debates')
          .select('series_id')
          .in('series_id', seriesIds)
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = new Map((topicsRes.data ?? []).map((t: { id: string; statement: string; category: string | null; status: string }) => [t.id, t]))
  const creatorMap = new Map((creatorsRes.data ?? []).map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => [p.id, p]))

  const debateCountMap = new Map<string, number>()
  for (const d of debateCountsRes.data ?? []) {
    const row = d as { series_id: string }
    debateCountMap.set(row.series_id, (debateCountMap.get(row.series_id) ?? 0) + 1)
  }

  const enriched: SeriesListItem[] = seriesList.map((s) => ({
    ...s,
    topic: s.topic_id ? (topicMap.get(s.topic_id) ?? null) : null,
    creator: s.creator_id ? (creatorMap.get(s.creator_id) ?? null) : null,
    debate_count: debateCountMap.get(s.id) ?? 0,
  }))

  return NextResponse.json({ series: enriched })
}

// POST /api/debate-series — create a new series
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, topic_id, format } = body as {
    title?: string
    description?: string
    topic_id?: string
    format?: string
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const validFormats = ['best_of_3', 'best_of_5', 'best_of_7', 'fixed']
  const seriesFormat = validFormats.includes(format ?? '') ? format : 'best_of_3'

  const { data, error } = await supabase
    .from('debate_series')
    .insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      topic_id: topic_id ?? null,
      creator_id: user.id,
      format: seriesFormat,
      status: 'ongoing',
      blue_wins: 0,
      red_wins: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ series: data }, { status: 201 })
}
