import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChangemakerEntry {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  current_vote: 'for' | 'against'
  condition: string
  upvotes: number
  created_at: string
  updated_at: string
  viewer_upvoted?: boolean
  is_own?: boolean
}

export interface ChangemakerStats {
  total: number
  for_count: number
  against_count: number
  top_for_theme: string | null
  top_against_theme: string | null
}

export interface ChangemakersResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  entries: ChangemakerEntry[]
  stats: ChangemakerStats
  viewer_entry: ChangemakerEntry | null
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: rows } = await supabase
    .from('topic_changemakers')
    .select(`
      id,
      user_id,
      current_vote,
      condition,
      upvotes,
      created_at,
      updated_at,
      profiles!inner(username, display_name, avatar_url, role)
    `)
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  // Fetch which entries the current viewer upvoted
  let viewerUpvotedIds = new Set<string>()
  if (user && rows && rows.length > 0) {
    const entryIds = rows.map((r) => r.id)
    const { data: uvRows } = await supabase
      .from('changemaker_upvotes')
      .select('changemaker_id')
      .eq('user_id', user.id)
      .in('changemaker_id', entryIds)
    if (uvRows) viewerUpvotedIds = new Set(uvRows.map((r) => r.changemaker_id))
  }

  const entries: ChangemakerEntry[] = (rows ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id: r.id,
      user_id: r.user_id,
      username: profile?.username ?? 'unknown',
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? 'person',
      current_vote: r.current_vote as 'for' | 'against',
      condition: r.condition,
      upvotes: r.upvotes ?? 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
      viewer_upvoted: viewerUpvotedIds.has(r.id),
      is_own: user ? r.user_id === user.id : false,
    }
  })

  const forEntries     = entries.filter((e) => e.current_vote === 'for')
  const againstEntries = entries.filter((e) => e.current_vote === 'against')

  const viewerEntry = user
    ? entries.find((e) => e.user_id === user.id) ?? null
    : null

  const stats: ChangemakerStats = {
    total: entries.length,
    for_count: forEntries.length,
    against_count: againstEntries.length,
    top_for_theme: null,
    top_against_theme: null,
  }

  return NextResponse.json({ topic, entries, stats, viewer_entry: viewerEntry })
}

// ─── POST — create or update the viewer's own changemaker ────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const condition: string = typeof body?.condition === 'string' ? body.condition.trim() : ''
  const current_vote: string = body?.current_vote ?? ''

  if (!['for', 'against'].includes(current_vote)) {
    return NextResponse.json({ error: 'Invalid current_vote' }, { status: 400 })
  }
  if (condition.length < 20 || condition.length > 500) {
    return NextResponse.json(
      { error: 'Condition must be between 20 and 500 characters' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('topic_changemakers')
    .upsert(
      {
        topic_id: params.id,
        user_id: user.id,
        current_vote,
        condition,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'topic_id,user_id' }
    )
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id })
}

// ─── DELETE — remove the viewer's own changemaker ────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase
    .from('topic_changemakers')
    .delete()
    .eq('topic_id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
