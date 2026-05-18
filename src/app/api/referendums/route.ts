import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReferendumCategory = 'governance' | 'features' | 'community' | 'policy' | 'other'
export type ReferendumStatus = 'open' | 'passed' | 'failed' | 'vetoed'

export interface ReferendumRow {
  id: string
  proposer_id: string
  question: string
  description: string | null
  category: ReferendumCategory
  status: ReferendumStatus
  quorum_required: number
  for_votes: number
  against_votes: number
  closes_at: string
  created_at: string
  proposer_username: string
  proposer_display_name: string | null
  proposer_avatar_url: string | null
  proposer_role: string
  total_votes: number
  for_pct: number
  quorum_met: boolean
  user_vote: 'for' | 'against' | null
}

export interface ReferendumsResponse {
  open: ReferendumRow[]
  closed: ReferendumRow[]
  userCount: number
}

const CATEGORY_LABELS: Record<ReferendumCategory, string> = {
  governance: 'Governance',
  features: 'Features',
  community: 'Community',
  policy: 'Policy',
  other: 'Other',
}

// ── GET /api/referendums ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const filter = (searchParams.get('filter') ?? 'open') as 'open' | 'closed' | 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 60)

  const { data: { user } } = await supabase.auth.getUser()

  try {
    let query = supabase
      .from('civic_referendums')
      .select(`
        id, proposer_id, question, description, category, status,
        quorum_required, for_votes, against_votes, closes_at, created_at,
        proposer:profiles!civic_referendums_proposer_id_fkey(
          username, display_name, avatar_url, role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filter === 'open') {
      query = query.eq('status', 'open')
    } else if (filter === 'closed') {
      query = query.in('status', ['passed', 'failed', 'vetoed'])
    }

    const { data: rows, error } = await query

    if (error) throw error

    // Fetch user's votes in bulk
    const userVotes: Record<string, 'for' | 'against'> = {}
    if (user && rows && rows.length > 0) {
      const ids = rows.map((r) => r.id)
      const { data: votes } = await supabase
        .from('referendum_votes')
        .select('referendum_id, vote')
        .eq('user_id', user.id)
        .in('referendum_id', ids)
      for (const v of votes ?? []) {
        userVotes[v.referendum_id] = v.vote as 'for' | 'against'
      }
    }

    const enriched: ReferendumRow[] = (rows ?? []).map((r) => {
      const total = r.for_votes + r.against_votes
      const forPct = total > 0 ? Math.round((r.for_votes / total) * 1000) / 10 : 0
      const proposer = Array.isArray(r.proposer) ? r.proposer[0] : r.proposer
      return {
        id: r.id,
        proposer_id: r.proposer_id,
        question: r.question,
        description: r.description,
        category: r.category as ReferendumCategory,
        status: r.status as ReferendumStatus,
        quorum_required: r.quorum_required,
        for_votes: r.for_votes,
        against_votes: r.against_votes,
        closes_at: r.closes_at,
        created_at: r.created_at,
        proposer_username: proposer?.username ?? 'unknown',
        proposer_display_name: proposer?.display_name ?? null,
        proposer_avatar_url: proposer?.avatar_url ?? null,
        proposer_role: proposer?.role ?? 'person',
        total_votes: total,
        for_pct: forPct,
        quorum_met: total >= r.quorum_required,
        user_vote: userVotes[r.id] ?? null,
      }
    })

    const open = enriched.filter((r) => r.status === 'open')
    const closed = enriched.filter((r) => r.status !== 'open')

    // Rough total user count for quorum context
    const { count: userCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({ open, closed, userCount: userCount ?? 0 } satisfies ReferendumsResponse)
  } catch (err) {
    console.error('[referendums GET]', err)
    return NextResponse.json({ error: 'Failed to load referendums' }, { status: 500 })
  }
}

// ── POST /api/referendums — propose a new referendum ─────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure user is at least "person" role (not just anon)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await req.json()
  const question = (body.question ?? '').trim()
  const description = (body.description ?? '').trim() || null
  const category = (body.category ?? 'community') as ReferendumCategory

  if (question.length < 10 || question.length > 200) {
    return NextResponse.json({ error: 'Question must be 10–200 characters' }, { status: 400 })
  }

  if (!['governance', 'features', 'community', 'policy', 'other'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  // Rate limit: max 2 open referendums per user
  const { count: existing } = await supabase
    .from('civic_referendums')
    .select('id', { count: 'exact', head: true })
    .eq('proposer_id', user.id)
    .eq('status', 'open')

  if ((existing ?? 0) >= 2) {
    return NextResponse.json(
      { error: 'You already have 2 open referendums. Wait for one to close before proposing another.' },
      { status: 429 }
    )
  }

  const { data, error } = await supabase
    .from('civic_referendums')
    .insert({
      proposer_id: user.id,
      question,
      description,
      category,
      quorum_required: 25,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[referendums POST]', error)
    return NextResponse.json({ error: 'Failed to create referendum' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}

export { CATEGORY_LABELS }
