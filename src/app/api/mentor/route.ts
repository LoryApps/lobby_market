import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type MentorSort = 'reputation' | 'clout' | 'votes' | 'arguments'

export interface MentorEntry {
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
  category_preferences: string[]
  civic_archetype: string | null
  social_links: { twitter?: string; github?: string; website?: string } | null
  followers_count: number
  created_at: string
}

export interface MentorResponse {
  mentors: MentorEntry[]
  total: number
  sort: MentorSort
  category: string | null
}

const ALLOWED_SORTS: MentorSort[] = ['reputation', 'clout', 'votes', 'arguments']

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const category  = searchParams.get('category')
  const sortParam = searchParams.get('sort') as MentorSort | null
  const sort: MentorSort = ALLOWED_SORTS.includes(sortParam as MentorSort) ? (sortParam as MentorSort) : 'reputation'
  const q         = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '48', 10), 96)
  const offset    = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  const sortColumn: Record<MentorSort, string> = {
    reputation: 'reputation_score',
    clout: 'clout',
    votes: 'total_votes',
    arguments: 'total_arguments',
  }

  let query = supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, role, clout, reputation_score, ' +
      'total_votes, total_arguments, vote_streak, category_preferences, civic_archetype, ' +
      'social_links, followers_count, created_at',
      { count: 'exact' }
    )
    // Only surface engaged citizens: experienced role OR solid stats
    .or(
      'role.in.(debator,troll_catcher,elder),' +
      'and(reputation_score.gte.40,total_votes.gte.30,total_arguments.gte.3)'
    )
    .order(sortColumn[sort], { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) {
    query = query.contains('category_preferences', JSON.stringify([category]))
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let mentors = (data ?? []).map((p) => ({
    ...p,
    category_preferences: Array.isArray(p.category_preferences) ? p.category_preferences : [],
  })) as MentorEntry[]

  if (q) {
    mentors = mentors.filter(
      (m) =>
        m.username.toLowerCase().includes(q) ||
        (m.display_name?.toLowerCase() ?? '').includes(q) ||
        (m.bio?.toLowerCase() ?? '').includes(q)
    )
  }

  return NextResponse.json({
    mentors,
    total: count ?? mentors.length,
    sort,
    category,
  } satisfies MentorResponse)
}
