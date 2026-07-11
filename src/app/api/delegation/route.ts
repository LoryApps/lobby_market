import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DelegationEntry {
  id: string
  delegate_id: string
  delegate_username: string
  delegate_display_name: string | null
  delegate_avatar_url: string | null
  delegate_clout: number
  delegate_role: string
  topic_id: string | null
  topic_statement: string | null
  category: string | null
  created_at: string
}

export interface ReceivedDelegation {
  id: string
  delegator_id: string
  delegator_username: string
  delegator_display_name: string | null
  delegator_avatar_url: string | null
  topic_id: string | null
  topic_statement: string | null
  category: string | null
  created_at: string
}

export interface DelegationResponse {
  given: DelegationEntry[]
  received: ReceivedDelegation[]
  trustedByCount: number
}

// ─── GET — fetch current user's delegations ───────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [givenRes, receivedRes] = await Promise.all([
    supabase
      .from('vote_delegations')
      .select(`
        id,
        delegate_id,
        topic_id,
        category,
        created_at,
        delegate:profiles!vote_delegations_delegate_id_fkey (
          username, display_name, avatar_url, clout, role
        ),
        topic:topics!vote_delegations_topic_id_fkey (statement)
      `)
      .eq('delegator_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),

    supabase
      .from('vote_delegations')
      .select(`
        id,
        delegator_id,
        topic_id,
        category,
        created_at,
        delegator:profiles!vote_delegations_delegator_id_fkey (
          username, display_name, avatar_url
        ),
        topic:topics!vote_delegations_topic_id_fkey (statement)
      `)
      .eq('delegate_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const given: DelegationEntry[] = (givenRes.data ?? []).map((row: Record<string, unknown>) => {
    const delegate = row.delegate as Record<string, unknown> | null
    const topic = row.topic as Record<string, unknown> | null
    return {
      id: row.id as string,
      delegate_id: row.delegate_id as string,
      delegate_username: (delegate?.username as string) ?? '',
      delegate_display_name: (delegate?.display_name as string | null) ?? null,
      delegate_avatar_url: (delegate?.avatar_url as string | null) ?? null,
      delegate_clout: (delegate?.clout as number) ?? 0,
      delegate_role: (delegate?.role as string) ?? 'person',
      topic_id: (row.topic_id as string | null) ?? null,
      topic_statement: (topic?.statement as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      created_at: row.created_at as string,
    }
  })

  const received: ReceivedDelegation[] = (receivedRes.data ?? []).map((row: Record<string, unknown>) => {
    const delegator = row.delegator as Record<string, unknown> | null
    const topic = row.topic as Record<string, unknown> | null
    return {
      id: row.id as string,
      delegator_id: row.delegator_id as string,
      delegator_username: (delegator?.username as string) ?? '',
      delegator_display_name: (delegator?.display_name as string | null) ?? null,
      delegator_avatar_url: (delegator?.avatar_url as string | null) ?? null,
      topic_id: (row.topic_id as string | null) ?? null,
      topic_statement: (topic?.statement as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      created_at: row.created_at as string,
    }
  })

  return NextResponse.json({
    given,
    received,
    trustedByCount: received.length,
  } satisfies DelegationResponse)
}

// ─── POST — create a new delegation ──────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    delegate_id?: string
    topic_id?: string | null
    category?: string | null
  }

  const { delegate_id, topic_id = null, category = null } = body

  if (!delegate_id) {
    return NextResponse.json({ error: 'delegate_id is required' }, { status: 400 })
  }
  if (delegate_id === user.id) {
    return NextResponse.json({ error: 'Cannot delegate to yourself' }, { status: 400 })
  }
  if (topic_id && category) {
    return NextResponse.json({ error: 'Specify topic_id OR category, not both' }, { status: 400 })
  }

  // Check the target user exists and the current user follows them (or allow anyone)
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', delegate_id)
    .maybeSingle()
  if (!targetProfile) {
    return NextResponse.json({ error: 'Delegate not found' }, { status: 404 })
  }

  // Revoke any existing active delegation with same scope before inserting
  await supabase
    .from('vote_delegations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('delegator_id', user.id)
    .eq('delegate_id', delegate_id)
    .is('topic_id', topic_id)
    .is('category', category)
    .is('revoked_at', null)

  const { data, error } = await supabase
    .from('vote_delegations')
    .insert({
      delegator_id: user.id,
      delegate_id,
      topic_id: topic_id ?? null,
      category: category ?? null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, success: true })
}

// ─── DELETE — revoke a delegation ────────────────────────────────────────────

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('vote_delegations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('delegator_id', user.id)
    .is('revoked_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
