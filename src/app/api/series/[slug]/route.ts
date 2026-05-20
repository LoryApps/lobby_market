import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSeriesBySlug } from '@/lib/config/series'

export const dynamic = 'force-dynamic'

export interface SeriesTopicEntry {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface SeriesResponse {
  topics: SeriesTopicEntry[]
  total: number
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const series = getSeriesBySlug(params.slug)
  if (!series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select(
      `id, statement, category, status, blue_pct, total_votes, created_at,
       author:profiles!topics_author_id_fkey(username, display_name, avatar_url)`
    )

  // Filter by statuses
  const statuses = series.statuses ?? ['proposed', 'active', 'voting', 'law', 'failed']
  query = query.in('status', statuses)

  // Filter by categories if specified
  if (series.categories.length > 0) {
    query = query.in('category', series.categories)
  }

  // Minimum votes
  if (series.minVotes) {
    query = query.gte('total_votes', series.minVotes)
  }

  // For "most contested" series — sort by closeness to 50%
  if (params.slug === 'most-contested') {
    // We'll sort client-side after fetching
    query = query
      .order('total_votes', { ascending: false })
      .limit(50)
  } else if (params.slug === 'laws-of-the-land') {
    query = query
      .order('total_votes', { ascending: false })
      .limit(series.limit)
  } else {
    query = query
      .order('total_votes', { ascending: false })
      .limit(series.limit * 3) // Fetch more to allow keyword filtering
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let topics = (data ?? []) as unknown as SeriesTopicEntry[]

  // Apply keyword filter if specified
  if (series.keywords && series.keywords.length > 0) {
    const kw = series.keywords.map((k) => k.toLowerCase())
    topics = topics.filter((t) => {
      const stmt = t.statement.toLowerCase()
      return kw.some((k) => stmt.includes(k))
    })
    // If keyword filter yields too few, fall back to category topics
    if (topics.length < 3 && series.categories.length > 0) {
      topics = (data ?? []) as unknown as SeriesTopicEntry[]
    }
  }

  // Sort "most contested" by proximity to 50%
  if (params.slug === 'most-contested') {
    topics = topics
      .slice()
      .sort((a, b) => {
        const aContest = Math.abs((a.blue_pct ?? 50) - 50)
        const bContest = Math.abs((b.blue_pct ?? 50) - 50)
        return aContest - bContest
      })
  }

  // Trim to limit
  topics = topics.slice(0, series.limit)

  return NextResponse.json({ topics, total: topics.length } satisfies SeriesResponse)
}
