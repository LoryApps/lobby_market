import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionSummary {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  item_count: number
  created_at: string
  updated_at: string
  owner: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface CollectionsResponse {
  collections: CollectionSummary[]
  isAuthenticated: boolean
}

// ─── GET /api/collections ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') // 'mine' | 'public'
  const topicId = searchParams.get('topic_id') // filter: does this topic appear?

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase
    .from('topic_collections')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (mode === 'mine' && user) {
    query = query.eq('user_id', user.id)
  } else if (mode === 'public') {
    query = query.eq('is_public', true)
  } else if (user) {
    // Default: own + public
    query = query.or(`user_id.eq.${user.id},is_public.eq.true`)
  } else {
    query = query.eq('is_public', true)
  }

  const { data: collections, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }

  // If filtering by topic presence, fetch membership for each collection
  let membershipSet: Set<string> | null = null
  if (topicId && user) {
    const { data: items } = await supabase
      .from('collection_items')
      .select('collection_id')
      .eq('topic_id', topicId)
    membershipSet = new Set((items ?? []).map((i) => i.collection_id))
  }

  // Fetch owner profiles
  const ownerIds = Array.from(new Set((collections ?? []).map((c) => c.user_id)))
  const ownerMap: Map<string, CollectionSummary['owner']> = new Map()
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', ownerIds)
    if (profiles) {
      for (const p of profiles) {
        ownerMap.set(p.id, p as CollectionSummary['owner'])
      }
    }
  }

  const result: (CollectionSummary & { has_topic?: boolean })[] = (collections ?? []).map((c) => ({
    ...c,
    owner: ownerMap.get(c.user_id) ?? null,
    ...(membershipSet !== null ? { has_topic: membershipSet.has(c.id) } : {}),
  }))

  return NextResponse.json({
    collections: result,
    isAuthenticated: !!user,
  } satisfies CollectionsResponse)
}

// ─── POST /api/collections ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; description?: string; is_public?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name || name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: 'Name must be 1–80 characters' }, { status: 400 })
  }

  const description = body.description?.trim() ?? null
  if (description && description.length > 300) {
    return NextResponse.json({ error: 'Description must be ≤300 characters' }, { status: 400 })
  }

  // Limit collections per user
  const { count } = await supabase
    .from('topic_collections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= 50) {
    return NextResponse.json({ error: 'Maximum 50 collections per user' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('topic_collections')
    .insert({
      user_id: user.id,
      name,
      description,
      is_public: body.is_public ?? false,
    })
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }

  return NextResponse.json({ collection: data }, { status: 201 })
}
