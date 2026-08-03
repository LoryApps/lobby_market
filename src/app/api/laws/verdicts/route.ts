import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerdictOutcome = 'succeeded' | 'mostly_succeeded' | 'mixed' | 'mostly_failed' | 'failed'

export interface VerdictLawItem {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number | null
  law_total_votes: number | null
  law_established_at: string | null
  total_verdicts: number
  succeeded_count: number
  mostly_succeeded_count: number
  mixed_count: number
  mostly_failed_count: number
  failed_count: number
  success_pct: number
  failure_pct: number
  dominant_verdict: VerdictOutcome | null
  user_verdict: VerdictOutcome | null
}

export interface GlobalVerdictsResponse {
  laws: VerdictLawItem[]
  total_laws_with_verdicts: number
  total_verdict_votes: number
  by_outcome: Record<VerdictOutcome, number>
  avg_success_pct: number
}

// ─── GET /api/laws/verdicts ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const url = req.nextUrl
  const outcomeFilter = url.searchParams.get('outcome') as VerdictOutcome | 'all' | null
  const category = url.searchParams.get('category')
  const sort = url.searchParams.get('sort') ?? 'votes'   // votes | contested | recent | success | failure
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '40', 10), 100)

  const { data: { user } } = await supabase.auth.getUser()

  // ── Fetch all verdict rows with law info ──────────────────────────────────
  const { data: rawRows, error } = await db
    .from('law_verdict_votes')
    .select(`
      law_id,
      verdict,
      user_id,
      laws!inner (
        id, statement, category, blue_pct, total_votes, established_at
      )
    `)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawRow = {
    law_id: string
    verdict: string
    user_id: string
    laws: {
      id: string
      statement: string
      category: string | null
      blue_pct: number | null
      total_votes: number | null
      established_at: string | null
    }
  }

  const rows: RawRow[] = rawRows ?? []

  // ── Aggregate per law ─────────────────────────────────────────────────────
  type LawAgg = {
    law_id: string
    law_statement: string
    law_category: string | null
    law_blue_pct: number | null
    law_total_votes: number | null
    law_established_at: string | null
    succeeded: number
    mostly_succeeded: number
    mixed: number
    mostly_failed: number
    failed: number
    total: number
    user_verdict: VerdictOutcome | null
  }

  const aggMap = new Map<string, LawAgg>()

  for (const row of rows) {
    const lawInfo = row.laws
    if (!lawInfo) continue

    if (!aggMap.has(row.law_id)) {
      aggMap.set(row.law_id, {
        law_id: row.law_id,
        law_statement: lawInfo.statement,
        law_category: lawInfo.category,
        law_blue_pct: lawInfo.blue_pct,
        law_total_votes: lawInfo.total_votes,
        law_established_at: lawInfo.established_at,
        succeeded: 0,
        mostly_succeeded: 0,
        mixed: 0,
        mostly_failed: 0,
        failed: 0,
        total: 0,
        user_verdict: null,
      })
    }

    const agg = aggMap.get(row.law_id)!
    agg.total++
    if (row.verdict === 'succeeded') agg.succeeded++
    else if (row.verdict === 'mostly_succeeded') agg.mostly_succeeded++
    else if (row.verdict === 'mixed') agg.mixed++
    else if (row.verdict === 'mostly_failed') agg.mostly_failed++
    else if (row.verdict === 'failed') agg.failed++

    if (user && row.user_id === user.id) {
      agg.user_verdict = row.verdict as VerdictOutcome
    }
  }

  // ── Global aggregate counts ────────────────────────────────────────────────
  const by_outcome: Record<VerdictOutcome, number> = {
    succeeded: 0, mostly_succeeded: 0, mixed: 0, mostly_failed: 0, failed: 0,
  }
  for (const row of rows) {
    const v = row.verdict as VerdictOutcome
    if (v in by_outcome) by_outcome[v]++
  }

  // ── Build output array ────────────────────────────────────────────────────
  let items: VerdictLawItem[] = Array.from(aggMap.values()).map((agg) => {
    const successCount = agg.succeeded + agg.mostly_succeeded
    const failureCount = agg.failed + agg.mostly_failed
    const successPct = agg.total > 0 ? Math.round((successCount / agg.total) * 100) : 0
    const failurePct = agg.total > 0 ? Math.round((failureCount / agg.total) * 100) : 0

    // Dominant verdict: whichever single option has the most votes
    const counts: [VerdictOutcome, number][] = [
      ['succeeded', agg.succeeded],
      ['mostly_succeeded', agg.mostly_succeeded],
      ['mixed', agg.mixed],
      ['mostly_failed', agg.mostly_failed],
      ['failed', agg.failed],
    ]
    const dominant = counts.reduce((a, b) => (b[1] > a[1] ? b : a))
    const dominantVerdict: VerdictOutcome | null = dominant[1] > 0 ? dominant[0] : null

    return {
      law_id: agg.law_id,
      law_statement: agg.law_statement,
      law_category: agg.law_category,
      law_blue_pct: agg.law_blue_pct,
      law_total_votes: agg.law_total_votes,
      law_established_at: agg.law_established_at,
      total_verdicts: agg.total,
      succeeded_count: agg.succeeded,
      mostly_succeeded_count: agg.mostly_succeeded,
      mixed_count: agg.mixed,
      mostly_failed_count: agg.mostly_failed,
      failed_count: agg.failed,
      success_pct: successPct,
      failure_pct: failurePct,
      dominant_verdict: dominantVerdict,
      user_verdict: agg.user_verdict,
    }
  })

  // ── Apply category filter ─────────────────────────────────────────────────
  if (category && category !== 'all') {
    items = items.filter((i) => i.law_category === category)
  }

  // ── Apply outcome filter ──────────────────────────────────────────────────
  if (outcomeFilter && outcomeFilter !== 'all') {
    items = items.filter((i) => {
      if (outcomeFilter === 'succeeded') return i.success_pct >= 50
      if (outcomeFilter === 'failed') return i.failure_pct >= 50
      if (outcomeFilter === 'mixed') return i.success_pct < 50 && i.failure_pct < 50
      return true
    })
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (sort === 'votes') {
    items.sort((a, b) => b.total_verdicts - a.total_verdicts)
  } else if (sort === 'contested') {
    items.sort((a, b) => {
      const aContested = 100 - Math.abs(a.success_pct - a.failure_pct)
      const bContested = 100 - Math.abs(b.success_pct - b.failure_pct)
      return bContested - aContested
    })
  } else if (sort === 'recent') {
    items.sort((a, b) => {
      const aT = a.law_established_at ? new Date(a.law_established_at).getTime() : 0
      const bT = b.law_established_at ? new Date(b.law_established_at).getTime() : 0
      return bT - aT
    })
  } else if (sort === 'success') {
    items.sort((a, b) => b.success_pct - a.success_pct)
  } else if (sort === 'failure') {
    items.sort((a, b) => b.failure_pct - a.failure_pct)
  }

  // ── Apply limit ───────────────────────────────────────────────────────────
  const totalLawsWithVerdicts = items.length
  const totalVerdictVotes = rows.length
  const avgSuccessPct = items.length > 0
    ? Math.round(items.reduce((acc, i) => acc + i.success_pct, 0) / items.length)
    : 0

  items = items.slice(0, limit)

  const response: GlobalVerdictsResponse = {
    laws: items,
    total_laws_with_verdicts: totalLawsWithVerdicts,
    total_verdict_votes: totalVerdictVotes,
    by_outcome,
    avg_success_pct: avgSuccessPct,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
