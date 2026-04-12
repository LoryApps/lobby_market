import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Coalition } from '@/lib/supabase/types'

const MAX_NAME_LENGTH = 60
const MAX_DESCRIPTION_LENGTH = 500

// GET /api/coalitions
// Optional ?limit=... caps results (default 30, max 100).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const rawLimit = Number(url.searchParams.get('limit') ?? '30')
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 30

  const { data: rows, error } = await supabase
    .from('coalitions')
    .select('*')
    .eq('is_public', true)
    .order('coalition_influence', { ascending: false })
    .order('member_count', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load coalitions' },
      { status: 500 }
    )
  }

  const coalitions = (rows as Coalition[] | null) ?? []

  const creatorIds = Array.from(new Set(coalitions.map((c) => c.creator_id)))
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

  const enriched = coalitions.map((c) => ({
    ...c,
    creator: creators[c.creator_id] ?? null,
  }))

  return NextResponse.json({ coalitions: enriched })
}

// POST /api/coalitions
// Create a new coalition. The creator automatically joins as the leader.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    name?: string
    description?: string | null
    is_public?: boolean
    max_members?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description =
    typeof body.description === 'string' ? body.description.trim() : ''
  const isPublic = body.is_public !== false
  const rawMax = typeof body.max_members === 'number' ? body.max_members : 100
  const maxMembers = Math.min(Math.max(Math.floor(rawMax), 2), 500)

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 }
    )
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      {
        error: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
      },
      { status: 400 }
    )
  }

  const { data: inserted, error: insertError } = await supabase
    .from('coalitions')
    .insert({
      name,
      creator_id: user.id,
      description: description || null,
      is_public: isPublic,
      max_members: maxMembers,
      member_count: 0,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    return NextResponse.json(
      {
        error:
          insertError?.code === '23505'
            ? 'A coalition with that name already exists'
            : insertError?.message ?? 'Failed to create coalition',
      },
      { status: 500 }
    )
  }

  // Auto-join the creator as leader.
  await supabase.from('coalition_members').insert({
    coalition_id: inserted.id,
    user_id: user.id,
    role: 'leader',
  })

  return NextResponse.json({ coalition: inserted }, { status: 201 })
}
