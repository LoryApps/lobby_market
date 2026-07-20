import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProposalAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
}

export interface MarketProposal {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string | null
  resolution_criteria: string | null
  estimated_settlement_date: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'duplicate'
  upvotes: number
  topic_id: string | null
  rejection_reason: string | null
  created_at: string
  author: ProposalAuthor
  viewer_voted: boolean
}

export interface ProposalsResponse {
  proposals: MarketProposal[]
  total: number
  has_more: boolean
}

// ─── GET /api/exchange/proposals ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const sort     = (searchParams.get('sort') ?? 'top') as 'top' | 'new'
    const category = searchParams.get('category') ?? null
    const status   = (searchParams.get('status') ?? 'pending') as 'pending' | 'accepted' | 'rejected' | 'all'
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset   = parseInt(searchParams.get('offset') ?? '0', 10)

    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase
      .from('exchange_proposals')
      .select(`
        id, user_id, title, description, category,
        resolution_criteria, estimated_settlement_date,
        status, upvotes, topic_id, rejection_reason, created_at,
        author:profiles!exchange_proposals_user_id_fkey(
          id, username, display_name, avatar_url, clout
        )
      `, { count: 'exact' })

    if (status !== 'all') {
      query = query.eq('status', status)
    }
    if (category) {
      query = query.eq('category', category)
    }

    if (sort === 'top') {
      query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Fetch viewer votes in batch
    const voterSet = new Set<string>()
    if (user && data && data.length > 0) {
      const ids = data.map((p) => p.id)
      const { data: votes } = await supabase
        .from('exchange_proposal_votes')
        .select('proposal_id')
        .eq('user_id', user.id)
        .in('proposal_id', ids)
      if (votes) votes.forEach((v) => voterSet.add(v.proposal_id))
    }

    const proposals: MarketProposal[] = (data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      category: row.category,
      resolution_criteria: row.resolution_criteria,
      estimated_settlement_date: row.estimated_settlement_date,
      status: row.status as MarketProposal['status'],
      upvotes: row.upvotes,
      topic_id: row.topic_id,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at,
      author: Array.isArray(row.author) ? row.author[0] : (row.author as ProposalAuthor),
      viewer_voted: voterSet.has(row.id),
    }))

    return NextResponse.json({
      proposals,
      total: count ?? 0,
      has_more: (count ?? 0) > offset + limit,
    } satisfies ProposalsResponse)
  } catch (err) {
    console.error('[proposals GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/exchange/proposals ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title, description, category, resolution_criteria, estimated_settlement_date } = body

    if (!title || title.length < 10 || title.length > 200) {
      return NextResponse.json({ error: 'Title must be 10–200 characters' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('exchange_proposals')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() ?? null,
        category: category ?? null,
        resolution_criteria: resolution_criteria?.trim() ?? null,
        estimated_settlement_date: estimated_settlement_date ?? null,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    console.error('[proposals POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
