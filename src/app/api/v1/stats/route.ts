import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // Stats are aggregate — cache longer
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
}

export interface V1Stats {
  total_topics: number
  total_laws: number
  total_active_topics: number
  total_votes: number
  total_debates: number
  total_arguments: number
  top_category: string | null
  updated_at: string
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const supabase = await createClient()

    const [topicsResult, debatesResult, argumentsResult, categoryResult] = await Promise.all([
      // Topic counts by status + aggregate votes
      supabase
        .from('topics')
        .select('status, total_votes')
        .in('status', ['proposed', 'active', 'voting', 'law', 'failed']),
      // Debate count
      supabase
        .from('debates')
        .select('id', { count: 'exact', head: true }),
      // Argument count
      supabase
        .from('arguments')
        .select('id', { count: 'exact', head: true }),
      // Top category by vote volume
      supabase
        .from('topics')
        .select('category, total_votes')
        .not('category', 'is', null)
        .order('total_votes', { ascending: false })
        .limit(50),
    ])

    const topicRows = topicsResult.data ?? []

    const totalTopics = topicRows.filter((r) => r.status !== 'failed').length
    const totalLaws = topicRows.filter((r) => r.status === 'law').length
    const totalActive = topicRows.filter((r) => ['active', 'voting'].includes(r.status)).length
    const totalVotes = topicRows.reduce((sum, r) => sum + (r.total_votes ?? 0), 0)

    // Determine top category by aggregate vote volume
    const categoryVotes = new Map<string, number>()
    for (const row of categoryResult.data ?? []) {
      if (!row.category) continue
      categoryVotes.set(row.category, (categoryVotes.get(row.category) ?? 0) + (row.total_votes ?? 0))
    }
    let topCategory: string | null = null
    let topCategoryVotes = 0
    for (const [cat, votes] of categoryVotes) {
      if (votes > topCategoryVotes) {
        topCategoryVotes = votes
        topCategory = cat
      }
    }

    const stats: V1Stats = {
      total_topics: totalTopics,
      total_laws: totalLaws,
      total_active_topics: totalActive,
      total_votes: totalVotes,
      total_debates: debatesResult.count ?? 0,
      total_arguments: argumentsResult.count ?? 0,
      top_category: topCategory,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ data: stats }, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/stats]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
