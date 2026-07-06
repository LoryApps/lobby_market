import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RecruitCoalition {
  id: string
  name: string
  description: string | null
  is_public: boolean
  member_count: number
  max_members: number
  coalition_influence: number
  wins: number
  losses: number
  created_at: string
  open_spots: number
  stance_count: number
  creator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface RecruitResponse {
  coalitions: RecruitCoalition[]
}

/**
 * GET /api/coalitions/recruit
 *
 * Returns all non-full coalitions ordered by coalition_influence descending.
 * Enriches each result with creator profile and stance count.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // All coalitions — filter open ones in JS to avoid raw SQL
    const { data: rows, error: fetchErr } = await supabase
      .from('coalitions')
      .select(
        'id, name, description, is_public, member_count, max_members, ' +
        'coalition_influence, wins, losses, created_at, creator_id',
      )
      .order('coalition_influence', { ascending: false })
      .limit(100)

    if (fetchErr) {
      return NextResponse.json({ coalitions: [] }, { status: 500 })
    }

    type RawRow = {
      id: string; name: string; description: string | null; is_public: boolean
      member_count: number; max_members: number; coalition_influence: number
      wins: number; losses: number; created_at: string; creator_id: string
    }

    const open = ((rows ?? []) as RawRow[]).filter(
      (c) => c.member_count < c.max_members,
    )

    if (open.length === 0) {
      return NextResponse.json({ coalitions: [] })
    }

    // Creator profiles
    const creatorIds = Array.from(new Set(open.map((c) => c.creator_id)))
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', creatorIds)

    const creatorMap = new Map<string, RecruitCoalition['creator']>()
    for (const p of creators ?? []) {
      creatorMap.set(p.id, {
        id: p.id,
        username: (p.username as string) ?? '',
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
        role: (p.role as string) ?? 'person',
      })
    }

    // Stance counts
    const coalitionIds = open.map((c) => c.id)
    const { data: stanceRows } = await supabase
      .from('coalition_stances')
      .select('coalition_id')
      .in('coalition_id', coalitionIds)

    const stanceCountMap: Record<string, number> = {}
    for (const s of stanceRows ?? []) {
      const key = (s as { coalition_id: string }).coalition_id
      stanceCountMap[key] = (stanceCountMap[key] ?? 0) + 1
    }

    const result: RecruitCoalition[] = open.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      is_public: c.is_public,
      member_count: c.member_count,
      max_members: c.max_members,
      coalition_influence: c.coalition_influence,
      wins: c.wins,
      losses: c.losses,
      created_at: c.created_at,
      open_spots: c.max_members - c.member_count,
      stance_count: stanceCountMap[c.id] ?? 0,
      creator: creatorMap.get(c.creator_id) ?? null,
    }))

    return NextResponse.json({ coalitions: result })
  } catch (err) {
    console.error('[GET /api/coalitions/recruit]', err)
    return NextResponse.json({ coalitions: [] }, { status: 500 })
  }
}
