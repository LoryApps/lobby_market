import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 120 // 2-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SynthesisEntry {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  common_ground: string
  tensions: string
  synthesis: string
  generated_at: string
  argument_count: number
}

export interface SynthesisListResponse {
  entries: SynthesisEntry[]
  total: number
  generated_at: string
}

// ─── GET /api/synthesis ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const sort = searchParams.get('sort') ?? 'recent'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabase = await createClient()

  // Join topic_synthesis with topics to get full context
  let query = supabase
    .from('topic_synthesis')
    .select(
      `
      topic_id,
      common_ground,
      tensions,
      synthesis,
      generated_at,
      topics!inner (
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `,
      { count: 'exact' }
    )

  if (category) {
    query = query.eq('topics.category', category)
  }

  // Apply sort
  switch (sort) {
    case 'recent':
      query = query.order('generated_at', { ascending: false })
      break
    case 'votes':
      query = query.order('topics.total_votes', { ascending: false })
      break
    case 'deadlock':
      // Closest to 50/50 (most divided) — use ascending blue_pct deviation
      // We'll handle this in memory since Supabase can't sort by computed field
      query = query.order('generated_at', { ascending: false })
      break
    default:
      query = query.order('generated_at', { ascending: false })
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also fetch argument counts for each topic
  const topicIds = (data ?? []).map((r) => r.topic_id)
  const argCounts: Record<string, number> = {}
  if (topicIds.length > 0) {
    const { data: argData } = await supabase
      .from('topic_arguments')
      .select('topic_id')
      .in('topic_id', topicIds)

    if (argData) {
      for (const row of argData) {
        argCounts[row.topic_id] = (argCounts[row.topic_id] ?? 0) + 1
      }
    }
  }

  const entries: SynthesisEntry[] = (data ?? []).map((row) => {
    const topic = row.topics as {
      statement: string
      category: string | null
      status: string
      blue_pct: number | null
      total_votes: number | null
    }
    return {
      topic_id: row.topic_id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      common_ground: row.common_ground,
      tensions: row.tensions,
      synthesis: row.synthesis,
      generated_at: row.generated_at,
      argument_count: argCounts[row.topic_id] ?? 0,
    }
  })

  // Post-process deadlock sort (closest to 50/50 first)
  if (sort === 'deadlock') {
    entries.sort((a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50))
  }

  return NextResponse.json({
    entries,
    total: count ?? 0,
    generated_at: new Date().toISOString(),
  } satisfies SynthesisListResponse)
}
