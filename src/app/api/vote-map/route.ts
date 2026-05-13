import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type Scope = 'Global' | 'National' | 'Regional' | 'Local'
export type ConsensusTier = 'strong_for' | 'lean_for' | 'contested' | 'lean_against' | 'strong_against'

export interface VoteMapTopic {
  id: string
  statement: string
  category: string | null
  scope: Scope
  status: string
  blue_pct: number
  total_votes: number
  consensus: ConsensusTier
}

export interface ScopeStats {
  scope: Scope
  label: string
  topicCount: number
  lawCount: number
  avgBluePct: number
  strongFor: number
  leanFor: number
  contested: number
  leanAgainst: number
  strongAgainst: number
  totalVotes: number
}

export interface VoteMapResponse {
  scopes: ScopeStats[]
  topics: VoteMapTopic[]
  totalTopics: number
  totalLaws: number
  globalAvgBluePct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_ORDER: Scope[] = ['Global', 'National', 'Regional', 'Local']

function getConsensus(bluePct: number): ConsensusTier {
  if (bluePct >= 70) return 'strong_for'
  if (bluePct >= 55) return 'lean_for'
  if (bluePct >= 45) return 'contested'
  if (bluePct >= 30) return 'lean_against'
  return 'strong_against'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const scopeFilter = searchParams.get('scope') as Scope | null

    const supabase = await createClient()

    // Fetch all active/voting/law topics with scope data
    let query = supabase
      .from('topics')
      .select('id, statement, category, scope, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law'])
      .order('total_votes', { ascending: false })
      .limit(400)

    if (scopeFilter && SCOPE_ORDER.includes(scopeFilter)) {
      query = query.eq('scope', scopeFilter)
    }

    const { data: rawTopics, error } = await query

    if (error) {
      console.error('vote-map error:', error)
      return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
    }

    const topics = (rawTopics ?? []) as VoteMapTopic[]

    // Enrich with consensus tier
    const enriched: VoteMapTopic[] = topics.map((t) => ({
      ...t,
      scope: (t.scope as Scope) || 'Global',
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      consensus: getConsensus(t.blue_pct ?? 50),
    }))

    // Build per-scope stats
    const scopeMap = new Map<Scope, VoteMapTopic[]>()
    for (const scope of SCOPE_ORDER) {
      scopeMap.set(scope, [])
    }
    for (const t of enriched) {
      const s = (SCOPE_ORDER.includes(t.scope) ? t.scope : 'Global') as Scope
      scopeMap.get(s)!.push(t)
    }

    const scopes: ScopeStats[] = SCOPE_ORDER.map((scope) => {
      const ts = scopeMap.get(scope)!
      const totalVotes = ts.reduce((sum, t) => sum + t.total_votes, 0)
      const avgBluePct =
        ts.length > 0
          ? Math.round(ts.reduce((sum, t) => sum + t.blue_pct, 0) / ts.length)
          : 50

      return {
        scope,
        label: scope,
        topicCount: ts.length,
        lawCount: ts.filter((t) => t.status === 'law').length,
        avgBluePct,
        strongFor: ts.filter((t) => t.consensus === 'strong_for').length,
        leanFor: ts.filter((t) => t.consensus === 'lean_for').length,
        contested: ts.filter((t) => t.consensus === 'contested').length,
        leanAgainst: ts.filter((t) => t.consensus === 'lean_against').length,
        strongAgainst: ts.filter((t) => t.consensus === 'strong_against').length,
        totalVotes,
      }
    })

    const globalAvgBluePct =
      enriched.length > 0
        ? Math.round(enriched.reduce((sum, t) => sum + t.blue_pct, 0) / enriched.length)
        : 50

    const response: VoteMapResponse = {
      scopes,
      topics: enriched,
      totalTopics: enriched.length,
      totalLaws: enriched.filter((t) => t.status === 'law').length,
      globalAvgBluePct,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (err) {
    console.error('vote-map unhandled:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
