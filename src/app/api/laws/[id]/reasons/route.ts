import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawReasonEntry {
  id: string
  side: 'blue' | 'red'
  reason: string
  created_at: string
}

export interface LawReasonsStats {
  total_with_reasons: number
  for_count: number
  against_count: number
  total_votes: number
  coverage_pct: number
}

export interface LawReasonsResponse {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    blue_pct: number
    total_votes: number
    topic_id: string | null
  }
  reasons: LawReasonEntry[]
  stats: LawReasonsStats
}

// ─── GET /api/laws/[id]/reasons ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 1. Fetch the law (includes topic_id for vote lookup)
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, total_votes, blue_pct, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  if (!law.topic_id) {
    // Law has no source topic — no vote reasons possible
    const empty: LawReasonsResponse = {
      law: {
        id: law.id,
        statement: law.statement,
        category: law.category,
        established_at: law.established_at,
        blue_pct: law.blue_pct ?? 50,
        total_votes: law.total_votes ?? 0,
        topic_id: null,
      },
      reasons: [],
      stats: {
        total_with_reasons: 0,
        for_count: 0,
        against_count: 0,
        total_votes: law.total_votes ?? 0,
        coverage_pct: 0,
      },
    }
    return NextResponse.json(empty)
  }

  // 2. Fetch votes with reasons from the source topic — fully anonymous (no user PII)
  const { data: votes, error: votesErr } = await supabase
    .from('votes')
    .select('id, side, reason, created_at')
    .eq('topic_id', law.topic_id)
    .not('reason', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300)

  if (votesErr) {
    return NextResponse.json({ error: 'Failed to load reasons' }, { status: 500 })
  }

  const reasons: LawReasonEntry[] = (votes ?? [])
    .filter((v) => v.reason && v.reason.trim().length > 0)
    .map((v) => ({
      id: v.id,
      side: v.side as 'blue' | 'red',
      reason: v.reason!.trim(),
      created_at: v.created_at,
    }))

  const forCount = reasons.filter((r) => r.side === 'blue').length
  const againstCount = reasons.filter((r) => r.side === 'red').length
  const totalVotes = law.total_votes ?? 0
  const coveragePct =
    totalVotes > 0 ? Math.round((reasons.length / totalVotes) * 100) : 0

  const response: LawReasonsResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      established_at: law.established_at,
      blue_pct: law.blue_pct ?? 50,
      total_votes: totalVotes,
      topic_id: law.topic_id,
    },
    reasons,
    stats: {
      total_with_reasons: reasons.length,
      for_count: forCount,
      against_count: againstCount,
      total_votes: totalVotes,
      coverage_pct: coveragePct,
    },
  }

  return NextResponse.json(response)
}
