import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/citizens
 *
 * Returns a paginated, filterable list of all platform citizens.
 *
 * Query params:
 *   q        — search by username or display_name (ILIKE)
 *   role     — filter by role (person | debator | troll_catcher | elder | senator | lawmaker)
 *   sort     — reputation | votes | clout | streak | newest (default: reputation)
 *   page     — 1-based page number (default: 1)
 *   limit    — items per page (default: 24, max: 48)
 */

export interface CitizenRow {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  followers_count: number
  following_count: number
  is_influencer: boolean
  created_at: string
}

export interface CitizensResponse {
  citizens: CitizenRow[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

const VALID_ROLES = [
  'person',
  'debator',
  'troll_catcher',
  'elder',
  'senator',
  'lawmaker',
] as const
type ValidRole = (typeof VALID_ROLES)[number]

const VALID_SORTS = ['reputation', 'votes', 'clout', 'streak', 'newest'] as const
type ValidSort = (typeof VALID_SORTS)[number]

const SORT_COLUMN: Record<ValidSort, string> = {
  reputation: 'reputation_score',
  votes: 'total_votes',
  clout: 'clout',
  streak: 'vote_streak',
  newest: 'created_at',
}

const COLUMNS =
  'id, username, display_name, avatar_url, bio, role, clout, reputation_score, total_votes, total_arguments, vote_streak, followers_count, following_count, is_influencer, created_at'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const q = searchParams.get('q')?.trim() ?? ''
  const rawRole = searchParams.get('role')?.trim() ?? ''
  const rawSort = searchParams.get('sort')?.trim() ?? 'reputation'
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '24', 10)

  const role: ValidRole | null = (VALID_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as ValidRole)
    : null
  const sort: ValidSort = (VALID_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as ValidSort)
    : 'reputation'
  const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 24), 48)
  const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1)
  const offset = (page - 1) * limit

  const sortCol = SORT_COLUMN[sort]

  // Build base query — count + data in one pass using Supabase range
  let dataQ = supabase
    .from('profiles')
    .select(COLUMNS, { count: 'exact' })
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1)

  // Role filter
  if (role) {
    dataQ = dataQ.eq('role', role)
  }

  // Search by username or display_name
  if (q.length >= 2) {
    const pattern = `%${q}%`
    dataQ = dataQ.or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
  }

  const { data, count, error } = await dataQ

  if (error) {
    console.error('[/api/citizens]', error.message)
    return NextResponse.json({ error: 'Failed to fetch citizens' }, { status: 500 })
  }

  const citizens = (data ?? []) as CitizenRow[]
  const total = count ?? 0

  return NextResponse.json({
    citizens,
    total,
    page,
    limit,
    has_more: offset + citizens.length < total,
  } satisfies CitizensResponse)
}
