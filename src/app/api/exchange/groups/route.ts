import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ExchangeGroup {
  id: string
  user_id: string
  name: string
  description: string | null
  emoji: string
  is_public: boolean
  item_count: number
  created_at: string
  updated_at: string
  owner_username?: string | null
  owner_display_name?: string | null
}

export interface GroupsResponse {
  mine: ExchangeGroup[]
  public: ExchangeGroup[]
}

// GET — list the current user's groups + popular public groups
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const mine: ExchangeGroup[] = []

  if (user) {
    const { data } = await supabase
      .from('exchange_groups')
      .select('id, user_id, name, description, emoji, is_public, item_count, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (data) mine.push(...(data as ExchangeGroup[]))
  }

  // Popular public groups (exclude own)
  const publicQuery = supabase
    .from('exchange_groups')
    .select(`
      id, user_id, name, description, emoji, is_public, item_count, created_at, updated_at,
      profiles:user_id ( username, display_name )
    `)
    .eq('is_public', true)
    .order('item_count', { ascending: false })
    .limit(20)

  if (user) publicQuery.neq('user_id', user.id)

  const { data: publicData } = await publicQuery

  const publicGroups: ExchangeGroup[] = (publicData ?? []).map((row) => {
    const profile = (row as Record<string, unknown>).profiles as { username?: string; display_name?: string } | null
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      name: row.name as string,
      description: row.description as string | null,
      emoji: (row.emoji as string) || '📊',
      is_public: row.is_public as boolean,
      item_count: (row.item_count as number) ?? 0,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      owner_username: profile?.username ?? null,
      owner_display_name: profile?.display_name ?? null,
    }
  })

  return NextResponse.json({ mine, public: publicGroups } satisfies GroupsResponse)
}

// POST — create a new group
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    name?: string
    description?: string
    emoji?: string
    is_public?: boolean
  }

  const name = body.name?.trim()
  if (!name || name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: 'name must be 1–80 characters' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('exchange_groups')
    .insert({
      user_id: user.id,
      name,
      description: body.description?.trim() || null,
      emoji: body.emoji || '📊',
      is_public: body.is_public ?? false,
    })
    .select('id, user_id, name, description, emoji, is_public, item_count, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
