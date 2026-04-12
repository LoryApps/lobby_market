import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Lobby, LobbyPosition } from '@/lib/supabase/types'

const MAX_NAME_LENGTH = 80
const MAX_STATEMENT_LENGTH = 500
const MAX_EVIDENCE_LINKS = 8

function isLobbyPosition(value: unknown): value is LobbyPosition {
  return value === 'for' || value === 'against'
}

// GET /api/lobbies
// Optional ?topic_id=... scopes the list to a single topic.
// Optional ?limit=... caps results (default 30, max 100).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const topicId = url.searchParams.get('topic_id')
  const rawLimit = Number(url.searchParams.get('limit') ?? '30')
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 30

  let query = supabase
    .from('lobbies')
    .select('*')
    .eq('is_active', true)
    .order('member_count', { ascending: false })
    .order('influence_score', { ascending: false })
    .limit(limit)

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  const { data: lobbyRows, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load lobbies' },
      { status: 500 }
    )
  }

  const lobbies = (lobbyRows as Lobby[] | null) ?? []

  // Join creator profiles client-side (anon key reads profiles).
  const creatorIds = Array.from(new Set(lobbies.map((l) => l.creator_id)))
  let creators: Record<string, unknown> = {}
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', creatorIds)
    creators = (profiles ?? []).reduce(
      (acc, p) => ({ ...acc, [p.id]: p }),
      {} as Record<string, unknown>
    )
  }

  const enriched = lobbies.map((lobby) => ({
    ...lobby,
    creator: creators[lobby.creator_id] ?? null,
  }))

  return NextResponse.json({ lobbies: enriched })
}

// POST /api/lobbies
// Create a new lobby. The creator automatically joins.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    topic_id?: string
    name?: string
    position?: string
    campaign_statement?: string
    evidence_links?: string[]
    coalition_id?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const topicId =
    typeof body.topic_id === 'string' ? body.topic_id.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const campaignStatement =
    typeof body.campaign_statement === 'string'
      ? body.campaign_statement.trim()
      : ''
  const position = body.position
  const coalitionId =
    typeof body.coalition_id === 'string' && body.coalition_id.trim().length > 0
      ? body.coalition_id.trim()
      : null
  const evidenceLinks = Array.isArray(body.evidence_links)
    ? body.evidence_links
        .filter((link): link is string => typeof link === 'string')
        .map((link) => link.trim())
        .filter((link) => link.length > 0)
        .slice(0, MAX_EVIDENCE_LINKS)
    : []

  if (!topicId) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 }
    )
  }
  if (!isLobbyPosition(position)) {
    return NextResponse.json(
      { error: 'position must be "for" or "against"' },
      { status: 400 }
    )
  }
  if (!campaignStatement) {
    return NextResponse.json(
      { error: 'campaign_statement is required' },
      { status: 400 }
    )
  }
  if (campaignStatement.length > MAX_STATEMENT_LENGTH) {
    return NextResponse.json(
      {
        error: `campaign_statement must be ${MAX_STATEMENT_LENGTH} characters or fewer`,
      },
      { status: 400 }
    )
  }

  // Verify topic exists
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id')
    .eq('id', topicId)
    .maybeSingle()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('lobbies')
    .insert({
      topic_id: topicId,
      creator_id: user.id,
      name,
      position,
      campaign_statement: campaignStatement,
      evidence_links: evidenceLinks,
      coalition_id: coalitionId,
      member_count: 0,
      influence_score: 0,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to create lobby' },
      { status: 500 }
    )
  }

  // Auto-join the creator
  await supabase.from('lobby_members').insert({
    lobby_id: inserted.id,
    user_id: user.id,
  })

  return NextResponse.json({ lobby: inserted }, { status: 201 })
}
