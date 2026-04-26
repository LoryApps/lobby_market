import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BountyEntry {
  id: string
  topic_id: string
  topic_statement: string
  topic_status: string
  topic_category: string | null
  creator_id: string
  creator_username: string
  creator_display_name: string | null
  creator_avatar_url: string | null
  side: 'for' | 'against' | null
  amount: number
  description: string
  deadline: string | null
  winner_id: string | null
  winner_username: string | null
  status: 'open' | 'awarded' | 'expired'
  created_at: string
}

export interface BountiesResponse {
  bounties: BountyEntry[]
  total_open: number
  total_clout_pledged: number
  viewer_bounties: BountyEntry[]
}

// ─── GET — list bounties ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const filter = (searchParams.get('filter') ?? 'open') as 'open' | 'all' | 'mine'
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const query = supabase
    .from('topic_bounties')
    .select(
      `id, topic_id, creator_id, side, amount, description, deadline,
       winner_id, status, created_at,
       topics!topic_id ( statement, status, category ),
       creator:profiles!creator_id ( username, display_name, avatar_url ),
       winner:profiles!winner_id ( username )`
    )
    .order('amount', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60)

  if (filter === 'open') query.eq('status', 'open')
  else if (filter === 'mine' && user) query.eq('creator_id', user.id)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Stats
  let total_open = 0
  let total_clout_pledged = 0
  const viewerSet: BountyEntry[] = []

  const bounties: BountyEntry[] = (data ?? []).map((row) => {
    const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator
    const winner = Array.isArray(row.winner) ? row.winner[0] : row.winner

    const entry: BountyEntry = {
      id: row.id,
      topic_id: row.topic_id,
      topic_statement: (topic as { statement: string })?.statement ?? '',
      topic_status: (topic as { status: string })?.status ?? 'active',
      topic_category: (topic as { category: string | null })?.category ?? null,
      creator_id: row.creator_id,
      creator_username: (creator as { username: string })?.username ?? 'unknown',
      creator_display_name:
        (creator as { display_name: string | null })?.display_name ?? null,
      creator_avatar_url:
        (creator as { avatar_url: string | null })?.avatar_url ?? null,
      side: row.side as 'for' | 'against' | null,
      amount: row.amount,
      description: row.description,
      deadline: row.deadline,
      winner_id: row.winner_id,
      winner_username: (winner as { username: string } | null)?.username ?? null,
      status: row.status as 'open' | 'awarded' | 'expired',
      created_at: row.created_at,
    }

    if (entry.status === 'open') {
      total_open++
      total_clout_pledged += entry.amount
    }
    if (user && entry.creator_id === user.id) viewerSet.push(entry)

    return entry
  })

  return NextResponse.json({
    bounties,
    total_open,
    total_clout_pledged,
    viewer_bounties: viewerSet,
  } satisfies BountiesResponse)
}

// ─── POST — create a bounty ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { topic_id, side, amount, description, deadline } = body as {
    topic_id: string
    side?: 'for' | 'against' | null
    amount: number
    description: string
    deadline?: string | null
  }

  if (!topic_id || typeof description !== 'string' || description.trim().length < 5) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount < 1 || amount > 500) {
    return NextResponse.json({ error: 'Amount must be 1–500' }, { status: 400 })
  }

  // Verify topic exists
  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', topic_id)
    .single()
  if (!topic || topic.status === 'law' || topic.status === 'failed') {
    return NextResponse.json({ error: 'Topic not eligible for bounties' }, { status: 400 })
  }

  // Check creator has enough clout
  const { data: profile } = await supabase
    .from('profiles')
    .select('clout')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.clout ?? 0) < amount) {
    return NextResponse.json({ error: 'Insufficient clout' }, { status: 400 })
  }

  const { data: bounty, error } = await supabase
    .from('topic_bounties')
    .insert({
      topic_id,
      creator_id: user.id,
      side: side ?? null,
      amount,
      description: description.trim(),
      deadline: deadline ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bounty }, { status: 201 })
}
