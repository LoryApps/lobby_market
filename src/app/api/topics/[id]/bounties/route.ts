import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TopicBountyEntry {
  id: string
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

// GET /api/topics/[id]/bounties
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topic_bounties')
    .select(
      `id, creator_id, side, amount, description, deadline,
       winner_id, status, created_at,
       creator:profiles!creator_id ( username, display_name, avatar_url ),
       winner:profiles!winner_id ( username )`
    )
    .eq('topic_id', params.id)
    .order('status', { ascending: true })   // open first
    .order('amount', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bounties: TopicBountyEntry[] = (data ?? []).map((row) => {
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator
    const winner = Array.isArray(row.winner) ? row.winner[0] : row.winner
    return {
      id: row.id,
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
  })

  const total_clout = bounties
    .filter((b) => b.status === 'open')
    .reduce((s, b) => s + b.amount, 0)

  return NextResponse.json({ bounties, total_clout })
}

// POST /api/topics/[id]/bounties
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { side, amount, description, deadline } = body as {
    side?: 'for' | 'against' | null
    amount: number
    description: string
    deadline?: string | null
  }

  if (typeof description !== 'string' || description.trim().length < 5) {
    return NextResponse.json({ error: 'Description too short (min 5 chars)' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount < 1 || amount > 500) {
    return NextResponse.json({ error: 'Amount must be 1–500 Clout' }, { status: 400 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', params.id)
    .single()

  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  if (topic.status === 'law' || topic.status === 'failed') {
    return NextResponse.json({ error: 'Topic not eligible for bounties' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('clout')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.clout ?? 0) < amount) {
    return NextResponse.json({ error: 'Insufficient Clout balance' }, { status: 400 })
  }

  const { data: bounty, error } = await supabase
    .from('topic_bounties')
    .insert({
      topic_id: params.id,
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
