import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EndorsedLaw {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number | null
  law_total_votes: number | null
  law_established_at: string | null
  endorsement_count: number
  latest_endorsement_at: string | null
  user_has_endorsed: boolean
}

export interface LawEndorsementsResponse {
  laws: EndorsedLaw[]
  total_endorsed_laws: number
  total_endorsements: number
  top_endorser_count: number
}

// ─── GET /api/laws/endorsements ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const url = req.nextUrl
  const category = url.searchParams.get('category')
  const sort = url.searchParams.get('sort') ?? 'count'   // count | recent
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '40', 10), 100)

  const { data: { user } } = await supabase.auth.getUser()

  // ── Fetch all endorsements with law info ──────────────────────────────────
  const { data: rawRows, error } = await supabase
    .from('law_endorsements')
    .select(`
      law_id,
      user_id,
      created_at,
      laws!inner (
        id, statement, category, blue_pct, total_votes, established_at
      )
    `)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawRow = {
    law_id: string
    user_id: string
    created_at: string
    laws: {
      id: string
      statement: string
      category: string | null
      blue_pct: number | null
      total_votes: number | null
      established_at: string | null
    }
  }

  const rows = (rawRows ?? []) as RawRow[]

  // ── Aggregate per law ────────────────────────────────────────────────────
  const byLaw = new Map<string, { law: RawRow['laws']; count: number; latest: string; userEndorsed: boolean }>()

  for (const row of rows) {
    const existing = byLaw.get(row.law_id)
    const isUser = user && row.user_id === user.id

    if (!existing) {
      byLaw.set(row.law_id, {
        law: row.laws,
        count: 1,
        latest: row.created_at,
        userEndorsed: !!isUser,
      })
    } else {
      existing.count++
      if (row.created_at > existing.latest) existing.latest = row.created_at
      if (isUser) existing.userEndorsed = true
    }
  }

  let laws = Array.from(byLaw.values())

  // ── Category filter ───────────────────────────────────────────────────────
  if (category && category !== 'all') {
    laws = laws.filter(e => e.law.category === category)
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (sort === 'recent') {
    laws.sort((a, b) => b.latest.localeCompare(a.latest))
  } else {
    laws.sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))
  }

  // ── Slice ─────────────────────────────────────────────────────────────────
  const sliced = laws.slice(0, limit)

  const result: EndorsedLaw[] = sliced.map(e => ({
    law_id: e.law.id,
    law_statement: e.law.statement,
    law_category: e.law.category,
    law_blue_pct: e.law.blue_pct,
    law_total_votes: e.law.total_votes,
    law_established_at: e.law.established_at,
    endorsement_count: e.count,
    latest_endorsement_at: e.latest,
    user_has_endorsed: e.userEndorsed,
  }))

  // ── Platform stats ────────────────────────────────────────────────────────
  const total_endorsed_laws = byLaw.size
  const total_endorsements = rows.length

  // Top endorser = most prolific endorser
  const byUser = new Map<string, number>()
  for (const row of rows) {
    byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + 1)
  }
  const top_endorser_count = byUser.size > 0 ? Math.max(...byUser.values()) : 0

  return NextResponse.json({
    laws: result,
    total_endorsed_laws,
    total_endorsements,
    top_endorser_count,
  } satisfies LawEndorsementsResponse)
}
