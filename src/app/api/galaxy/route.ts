import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface GalaxyTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  tags: string[] | null
}

export interface GalaxyStats {
  total: number
  laws: number
  active: number
  proposed: number
  failed: number
  totalVotes: number
}

export interface GalaxyResponse {
  topics: GalaxyTopic[]
  stats: GalaxyStats
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct, tags')
    .order('total_votes', { ascending: false })
    .limit(300)

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const topics: GalaxyTopic[] = data.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    total_votes: t.total_votes ?? 0,
    blue_pct: t.blue_pct ?? 50,
    tags: Array.isArray(t.tags) ? t.tags : null,
  }))

  const stats: GalaxyStats = {
    total: topics.length,
    laws: topics.filter((t) => t.status === 'law').length,
    active: topics.filter((t) => t.status === 'active' || t.status === 'voting').length,
    proposed: topics.filter((t) => t.status === 'proposed').length,
    failed: topics.filter((t) => t.status === 'failed').length,
    totalVotes: topics.reduce((sum, t) => sum + t.total_votes, 0),
  }

  return NextResponse.json({ topics, stats } satisfies GalaxyResponse)
}
