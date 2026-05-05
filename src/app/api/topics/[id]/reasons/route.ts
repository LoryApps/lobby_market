import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ReasonEntry {
  id: string
  side: 'blue' | 'red'
  reason: string
  created_at: string
}

export interface ReasonsStats {
  total_with_reasons: number
  for_count: number
  against_count: number
  total_votes: number
  coverage_pct: number
}

export interface TopicReasonsResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  reasons: ReasonEntry[]
  stats: ReasonsStats
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch topic metadata
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch votes with reasons — no user PII, fully anonymous
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('id, side, reason, created_at')
    .eq('topic_id', params.id)
    .not('reason', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (votesError) {
    return NextResponse.json({ error: 'Failed to load reasons' }, { status: 500 })
  }

  const reasons: ReasonEntry[] = (votes ?? [])
    .filter((v) => v.reason && v.reason.trim().length > 0)
    .map((v) => ({
      id: v.id,
      side: v.side as 'blue' | 'red',
      reason: v.reason!.trim(),
      created_at: v.created_at,
    }))

  const forCount = reasons.filter((r) => r.side === 'blue').length
  const againstCount = reasons.filter((r) => r.side === 'red').length
  const total = reasons.length
  const coveragePct =
    topic.total_votes > 0 ? Math.round((total / topic.total_votes) * 100) : 0

  const stats: ReasonsStats = {
    total_with_reasons: total,
    for_count: forCount,
    against_count: againstCount,
    total_votes: topic.total_votes ?? 0,
    coverage_pct: coveragePct,
  }

  return NextResponse.json({
    topic,
    reasons,
    stats,
  } satisfies TopicReasonsResponse)
}
