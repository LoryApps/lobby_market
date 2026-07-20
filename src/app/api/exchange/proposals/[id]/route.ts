import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProposalDetailAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  vote_count: number
}

export interface SimilarMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
}

export interface ProposalDetail {
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
  updated_at: string
  author: ProposalDetailAuthor
  viewer_voted: boolean
  similar_markets: SimilarMarket[]
}

// ─── GET /api/exchange/proposals/[id] ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { id } = params

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('exchange_proposals')
      .select(`
        id, user_id, title, description, category,
        resolution_criteria, estimated_settlement_date,
        status, upvotes, topic_id, rejection_reason,
        created_at, updated_at,
        author:profiles!exchange_proposals_user_id_fkey(
          id, username, display_name, avatar_url, clout,
          vote_count
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Viewer vote check
    let viewer_voted = false
    if (user) {
      const { data: vote } = await supabase
        .from('exchange_proposal_votes')
        .select('proposal_id')
        .eq('proposal_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      viewer_voted = !!vote
    }

    // Similar markets — same category, live/voting, limited to 4
    let similar_markets: SimilarMarket[] = []
    if (data.category) {
      const { data: simRows } = await supabase
        .from('topics')
        .select('id, statement, category, status, price, volume')
        .eq('category', data.category)
        .in('status', ['live', 'voting'])
        .order('volume', { ascending: false })
        .limit(4)

      if (simRows) {
        similar_markets = simRows.map((r) => ({
          id: r.id,
          statement: r.statement,
          category: r.category,
          status: r.status,
          price: r.price ?? 50,
          volume: r.volume ?? 0,
        }))
      }
    }

    const authorRaw = Array.isArray(data.author) ? data.author[0] : data.author
    const author: ProposalDetailAuthor = {
      id: authorRaw?.id ?? '',
      username: authorRaw?.username ?? '',
      display_name: authorRaw?.display_name ?? null,
      avatar_url: authorRaw?.avatar_url ?? null,
      clout: authorRaw?.clout ?? 0,
      vote_count: (authorRaw as { vote_count?: number })?.vote_count ?? 0,
    }

    const proposal: ProposalDetail = {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      description: data.description,
      category: data.category,
      resolution_criteria: data.resolution_criteria,
      estimated_settlement_date: data.estimated_settlement_date,
      status: data.status as ProposalDetail['status'],
      upvotes: data.upvotes,
      topic_id: data.topic_id,
      rejection_reason: data.rejection_reason,
      created_at: data.created_at,
      updated_at: data.updated_at,
      author,
      viewer_voted,
      similar_markets,
    }

    return NextResponse.json(proposal)
  } catch (err) {
    console.error('[proposals/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
