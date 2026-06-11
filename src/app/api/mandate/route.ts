import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Mandate threshold configuration ──────────────────────────────────────────

export const THRESHOLD_OVERWHELMING = 85 // ≥85% → Overwhelming mandate
export const THRESHOLD_STRONG       = 75 // ≥75% → Strong mandate
export const THRESHOLD_CLEAR        = 70 // ≥70% → Clear mandate
export const MIN_VOTES              = 10 // minimum votes for statistical relevance

export type MandateStrength = 'overwhelming' | 'strong' | 'clear'
export type MandateSide     = 'for' | 'against'

export interface MandateTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  // Derived
  side: MandateSide
  mandate_pct: number       // How strong is the winning side (e.g. 83.2)
  strength: MandateStrength
}

export interface MandateStats {
  total_mandates: number
  for_mandates: number
  against_mandates: number
  overwhelming_count: number
  strong_count: number
  clear_count: number
  total_votes_in_mandates: number
}

export interface MandateResponse {
  topics: MandateTopic[]
  stats: MandateStats
  generated_at: string
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const VALID_SCOPES = ['Global', 'National', 'Regional', 'Local']

function getStrength(pct: number): MandateStrength {
  if (pct >= THRESHOLD_OVERWHELMING) return 'overwhelming'
  if (pct >= THRESHOLD_STRONG)       return 'strong'
  return 'clear'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category') ?? 'all'
  const rawScope    = searchParams.get('scope') ?? 'all'
  const rawStatus   = searchParams.get('status') ?? 'all'
  const rawSide     = searchParams.get('side') ?? 'all'   // 'for' | 'against' | 'all'
  const rawSort     = searchParams.get('sort') ?? 'strength' // 'strength' | 'votes' | 'recent'

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select('id, statement, category, scope, status, blue_pct, total_votes, created_at')
    .gte('total_votes', MIN_VOTES)
    .order('total_votes', { ascending: false })
    .limit(500)

  // Status filter
  if (rawStatus === 'active') {
    query = query.in('status', ['active', 'voting'])
  } else if (rawStatus === 'law') {
    query = query.eq('status', 'law')
  } else if (rawStatus === 'all') {
    query = query.not('status', 'eq', 'proposed')
  }

  // Category filter
  if (rawCategory !== 'all' && VALID_CATEGORIES.includes(rawCategory)) {
    query = query.eq('category', rawCategory)
  }

  // Scope filter
  if (rawScope !== 'all' && VALID_SCOPES.includes(rawScope)) {
    query = query.eq('scope', rawScope)
  }

  const { data, error } = await query

  if (error) {
    console.error('[mandate]', error)
    return NextResponse.json({ error: 'Failed to load mandate data' }, { status: 500 })
  }

  const rows = data ?? []

  // Filter to only topics with a clear mandate (≥ THRESHOLD_CLEAR on either side)
  const mandateTopics: MandateTopic[] = rows
    .filter((row) => {
      const forPct     = row.blue_pct ?? 50
      const againstPct = 100 - forPct
      return forPct >= THRESHOLD_CLEAR || againstPct >= THRESHOLD_CLEAR
    })
    .map((row) => {
      const forPct     = row.blue_pct ?? 50
      const againstPct = 100 - forPct
      const side: MandateSide     = forPct >= againstPct ? 'for' : 'against'
      const mandate_pct: number   = side === 'for' ? forPct : againstPct
      const strength: MandateStrength = getStrength(mandate_pct)
      return {
        id: row.id,
        statement: row.statement,
        category: row.category,
        scope: row.scope,
        status: row.status,
        blue_pct: forPct,
        total_votes: row.total_votes,
        created_at: row.created_at,
        side,
        mandate_pct,
        strength,
      }
    })

  // Side filter (after computing side)
  const filteredBySize = rawSide === 'all'
    ? mandateTopics
    : mandateTopics.filter((t) => t.side === rawSide)

  // Sort
  let sorted: MandateTopic[]
  if (rawSort === 'votes') {
    sorted = [...filteredBySize].sort((a, b) => b.total_votes - a.total_votes)
  } else if (rawSort === 'recent') {
    sorted = [...filteredBySize].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  } else {
    // Default: strength (highest mandate_pct first)
    sorted = [...filteredBySize].sort((a, b) => b.mandate_pct - a.mandate_pct)
  }

  // Stats (computed from all mandate topics before side filter)
  const stats: MandateStats = {
    total_mandates:         mandateTopics.length,
    for_mandates:           mandateTopics.filter((t) => t.side === 'for').length,
    against_mandates:       mandateTopics.filter((t) => t.side === 'against').length,
    overwhelming_count:     mandateTopics.filter((t) => t.strength === 'overwhelming').length,
    strong_count:           mandateTopics.filter((t) => t.strength === 'strong').length,
    clear_count:            mandateTopics.filter((t) => t.strength === 'clear').length,
    total_votes_in_mandates: mandateTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0),
  }

  return NextResponse.json({
    topics: sorted,
    stats,
    generated_at: new Date().toISOString(),
  } satisfies MandateResponse)
}
