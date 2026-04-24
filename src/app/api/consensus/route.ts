import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface ConsensusNode {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface ConsensusResponse {
  nodes: ConsensusNode[]
  generated_at: string
  total: number
  total_votes: number
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category') ?? 'all'
  const rawStatus = searchParams.get('status') ?? 'live'
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '200'), 300)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 200

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .gt('total_votes', 0)
    .order('total_votes', { ascending: false })
    .limit(limit)

  // Status filter
  if (rawStatus === 'live') {
    query = query.in('status', ['active', 'voting'])
  } else if (rawStatus === 'all') {
    query = query.in('status', ['active', 'voting', 'proposed'])
  } else if (rawStatus === 'proposed') {
    query = query.eq('status', 'proposed')
  }

  // Category filter
  if (rawCategory !== 'all' && VALID_CATEGORIES.includes(rawCategory)) {
    query = query.eq('category', rawCategory)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const nodes: ConsensusNode[] = (data ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
  }))

  const totalVotes = nodes.reduce((s, n) => s + n.total_votes, 0)

  return NextResponse.json(
    {
      nodes,
      generated_at: new Date().toISOString(),
      total: nodes.length,
      total_votes: totalVotes,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
