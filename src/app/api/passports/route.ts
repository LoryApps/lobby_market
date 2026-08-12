import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type PassportSortKey = 'clout' | 'reputation' | 'total_votes' | 'total_arguments' | 'vote_streak'

export interface PassportListItem {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  civic_archetype: string | null
  created_at: string
  passport_number: string
}

export interface PassportsResponse {
  passports: PassportListItem[]
  total: number
  has_more: boolean
}

function toPassportNumber(userId: string): string {
  const hex = userId.replace(/-/g, '')
  const n = parseInt(hex.slice(0, 8), 16) % 100_000_000
  return n.toString().padStart(8, '0')
}

const SORT_COLS: Record<PassportSortKey, string> = {
  clout:           'clout',
  reputation:      'reputation_score',
  total_votes:     'total_votes',
  total_arguments: 'total_arguments',
  vote_streak:     'vote_streak',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const rawSort   = searchParams.get('sort') ?? 'clout'
  const archetype = searchParams.get('archetype') ?? ''
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 60)
  const offset    = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  const sortKey: PassportSortKey = (rawSort in SORT_COLS)
    ? (rawSort as PassportSortKey)
    : 'clout'

  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, clout, reputation_score, ' +
      'total_votes, total_arguments, vote_streak, civic_archetype, created_at',
      { count: 'exact' }
    )
    .order(SORT_COLS[sortKey], { ascending: false })
    .range(offset, offset + limit - 1)

  if (archetype) {
    query = query.eq('civic_archetype', archetype)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const passports: PassportListItem[] = (data ?? []).map((p) => ({
    ...p,
    passport_number: toPassportNumber(p.id),
  }))

  return NextResponse.json({
    passports,
    total: count ?? 0,
    has_more: offset + limit < (count ?? 0),
  } satisfies PassportsResponse)
}
