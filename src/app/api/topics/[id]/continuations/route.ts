import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_TEXT_LENGTH = 100
const DEBATOR_ROLES = ['debator', 'troll_catcher', 'elder'] as const

type DebatorRole = (typeof DEBATOR_ROLES)[number]

function isDebatorRole(role: string | null | undefined): role is DebatorRole {
  return !!role && (DEBATOR_ROLES as readonly string[]).includes(role)
}

// GET /api/topics/[id]/continuations
// Returns all continuations for a topic, ordered by boost_count DESC.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: continuations, error } = await supabase
    .from('continuations')
    .select('*')
    .eq('topic_id', params.id)
    .order('boost_count', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load continuations' },
      { status: 500 }
    )
  }

  // Join authors client-side (anon key has read access to profiles)
  const authorIds = Array.from(
    new Set((continuations ?? []).map((c) => c.author_id))
  )

  let authors: Record<string, unknown> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    authors = (profiles ?? []).reduce(
      (acc, p) => ({ ...acc, [p.id]: p }),
      {} as Record<string, unknown>
    )
  }

  const enriched = (continuations ?? []).map((c) => ({
    ...c,
    author: authors[c.author_id] ?? null,
  }))

  return NextResponse.json({ continuations: enriched })
}

// POST /api/topics/[id]/continuations
// Create a new continuation. Debator+ only, window must be active.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { text?: string; connector?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const connector = body.connector

  if (!text) {
    return NextResponse.json(
      { error: 'Continuation text is required' },
      { status: 400 }
    )
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Continuation must be ${MAX_TEXT_LENGTH} characters or fewer` },
      { status: 400 }
    )
  }
  if (connector !== 'but' && connector !== 'and') {
    return NextResponse.json(
      { error: 'Connector must be "but" or "and"' },
      { status: 400 }
    )
  }

  // Check the author's role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!isDebatorRole(profile.role)) {
    return NextResponse.json(
      { error: 'Only Debators or higher can author continuations' },
      { status: 403 }
    )
  }

  // Check the topic state
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  if (topic.status !== 'continued') {
    return NextResponse.json(
      { error: 'Topic is not accepting continuations' },
      { status: 400 }
    )
  }

  if (!topic.continuation_window_ends_at) {
    return NextResponse.json(
      { error: 'Continuation window is not open' },
      { status: 400 }
    )
  }

  const windowEnd = new Date(topic.continuation_window_ends_at).getTime()
  if (windowEnd <= Date.now()) {
    return NextResponse.json(
      { error: 'Continuation authoring window has closed' },
      { status: 400 }
    )
  }

  // Check for an existing submission
  const { data: existing } = await supabase
    .from('continuations')
    .select('id')
    .eq('topic_id', params.id)
    .eq('author_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You have already submitted a continuation for this topic' },
      { status: 409 }
    )
  }

  // Insert
  const { data: inserted, error: insertError } = await supabase
    .from('continuations')
    .insert({
      topic_id: params.id,
      author_id: user.id,
      text,
      connector,
    })
    .select('*')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to create continuation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ continuation: inserted }, { status: 201 })
}
