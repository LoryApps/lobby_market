import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CivicFact {
  id: string
  author_id: string
  claim: string
  category: string
  source_url: string | null
  source_title: string | null
  context: string | null
  upvotes: number
  downvotes: number
  status: 'pending' | 'verified' | 'disputed' | 'retracted'
  created_at: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  user_vote: -1 | 0 | 1  // 0 = no vote
}

export interface FactBankResponse {
  facts: CivicFact[]
  total: number
  has_more: boolean
}

// ─── GET /api/fact-bank ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const query    = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const status   = searchParams.get('status') ?? ''
  const sort     = searchParams.get('sort') ?? 'top'    // top | new | disputed
  const limit    = Math.min(Number(searchParams.get('limit') ?? 24), 50)
  const offset   = Number(searchParams.get('offset') ?? 0)

  // Get current user for vote state
  const { data: { user } } = await supabase.auth.getUser()

  // ── Build the query ────────────────────────────────────────────────────────

  let dbQuery = supabase
    .from('civic_facts')
    .select(
      `id, author_id, claim, category, source_url, source_title, context,
       upvotes, downvotes, status, created_at,
       profiles!civic_facts_author_id_fkey(username, display_name, avatar_url)`,
      { count: 'exact' }
    )
    .neq('status', 'retracted')

  if (query.trim()) {
    dbQuery = dbQuery.textSearch('fts', query.trim().replace(/\s+/g, ' & '), {
      type: 'websearch',
      config: 'english',
    })
  }

  if (category) dbQuery = dbQuery.eq('category', category)
  if (status)   dbQuery = dbQuery.eq('status', status)

  // Sort
  if (sort === 'new') {
    dbQuery = dbQuery.order('created_at', { ascending: false })
  } else if (sort === 'disputed') {
    dbQuery = dbQuery.eq('status', 'disputed').order('downvotes', { ascending: false })
  } else {
    // top: net score = upvotes - downvotes, fall back to created_at
    dbQuery = dbQuery.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  }

  const { data: rawFacts, count, error } = await dbQuery.range(offset, offset + limit - 1)

  if (error) {
    console.error('[fact-bank] list error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Fetch current user's votes ─────────────────────────────────────────────

  const factIds = (rawFacts ?? []).map((f: { id: string }) => f.id)
  const voteMap: Record<string, -1 | 1> = {}

  if (user && factIds.length > 0) {
    const { data: votes } = await supabase
      .from('civic_fact_votes')
      .select('fact_id, vote')
      .eq('user_id', user.id)
      .in('fact_id', factIds)

    if (votes) {
      for (const v of votes) {
        voteMap[v.fact_id] = v.vote as -1 | 1
      }
    }
  }

  // ── Shape response ─────────────────────────────────────────────────────────

  const facts: CivicFact[] = (rawFacts ?? []).map((f: {
    id: string
    author_id: string
    claim: string
    category: string
    source_url: string | null
    source_title: string | null
    context: string | null
    upvotes: number
    downvotes: number
    status: string
    created_at: string
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
  }) => ({
    id: f.id,
    author_id: f.author_id,
    claim: f.claim,
    category: f.category,
    source_url: f.source_url,
    source_title: f.source_title,
    context: f.context,
    upvotes: f.upvotes,
    downvotes: f.downvotes,
    status: f.status as CivicFact['status'],
    created_at: f.created_at,
    author_username: f.profiles?.username ?? 'citizen',
    author_display_name: f.profiles?.display_name ?? null,
    author_avatar_url: f.profiles?.avatar_url ?? null,
    user_vote: (voteMap[f.id] ?? 0) as -1 | 0 | 1,
  }))

  const total = count ?? 0
  return NextResponse.json({
    facts,
    total,
    has_more: offset + limit < total,
  } satisfies FactBankResponse)
}
