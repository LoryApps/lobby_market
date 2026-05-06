import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export interface TagTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  tags: string[]
  created_at: string
  voting_ends_at: string | null
}

export interface TagTopicsResponse {
  tag: string
  topics: TagTopic[]
  total: number
}

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } }
) {
  const tag = decodeURIComponent(params.tag).toLowerCase()
  const url = new URL(req.url)
  const sort = url.searchParams.get('sort') ?? 'top'
  const status = url.searchParams.get('status') ?? null

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, total_votes, view_count, tags, created_at, voting_ends_at'
    )
    .contains('tags', [tag])

  if (status) {
    query = query.eq('status', status)
  }

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'hot') {
    query = query.order('view_count', { ascending: false })
  } else {
    query = query.order('total_votes', { ascending: false })
  }

  const { data, error } = await query.limit(50)

  if (error) {
    console.error('[tags/[tag]]', error)
    return NextResponse.json({ tag, topics: [], total: 0 } satisfies TagTopicsResponse)
  }

  return NextResponse.json({
    tag,
    topics: (data ?? []) as TagTopic[],
    total: (data ?? []).length,
  } satisfies TagTopicsResponse)
}
