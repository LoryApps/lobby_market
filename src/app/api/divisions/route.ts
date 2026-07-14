import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DivisionTrigger = 'floor' | 'supply_day' | 'lords' | 'motion'
export type DivisionStatus = 'open' | 'closed' | 'withdrawn'
export type DivisionResult = 'ayes_win' | 'noes_win' | 'tied' | 'quorum_failed' | 'withdrawn' | null
export type DivisionLobby = 'aye' | 'no' | 'abstain'

export interface Division {
  id: string
  title: string
  motion_text: string
  trigger_type: DivisionTrigger
  topic_id: string | null
  supply_motion_id: string | null
  coalition_id: string | null
  called_by: string
  opens_at: string
  closes_at: string
  ayes: number
  noes: number
  abstentions: number
  status: DivisionStatus
  result: DivisionResult
  result_declared_at: string | null
  speaker_note: string | null
  quorum: number
  created_at: string
  caller: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  coalition: {
    id: string
    name: string
    slug: string
    badge_color: string | null
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
  user_lobby: DivisionLobby | null
}

export interface DivisionsStats {
  total: number
  open: number
  closed: number
  ayes_won: number
  noes_won: number
}

export interface DivisionsResponse {
  divisions: Division[]
  stats: DivisionsStats
}

// ─── GET /api/divisions ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') ?? 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Build query
    let query = supabase
      .from('civic_divisions')
      .select(`
        *,
        caller:profiles!civic_divisions_called_by_fkey (
          id, username, display_name, avatar_url, role
        ),
        coalition:coalitions (
          id, name, slug, badge_color
        ),
        topic:topics (
          id, statement, category, status
        )
      `)
      .order('opens_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filter === 'open') query = query.eq('status', 'open')
    else if (filter === 'closed') query = query.eq('status', 'closed')

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch user's votes if logged in
    const userVoteMap: Record<string, DivisionLobby> = {}
    if (user && rows && rows.length > 0) {
      const ids = rows.map((r) => r.id)
      const { data: myVotes } = await supabase
        .from('division_votes')
        .select('division_id, lobby')
        .in('division_id', ids)
        .eq('user_id', user.id)
      if (myVotes) {
        for (const v of myVotes) {
          userVoteMap[v.division_id] = v.lobby as DivisionLobby
        }
      }
    }

    const divisions: Division[] = (rows ?? []).map((row) => ({
      ...row,
      caller: row.caller ?? null,
      coalition: row.coalition ?? null,
      topic: row.topic ?? null,
      user_lobby: userVoteMap[row.id] ?? null,
    }))

    // Stats
    const { data: statsData } = await supabase
      .from('civic_divisions')
      .select('status, result')

    const stats: DivisionsStats = {
      total: statsData?.length ?? 0,
      open: statsData?.filter((r) => r.status === 'open').length ?? 0,
      closed: statsData?.filter((r) => r.status === 'closed').length ?? 0,
      ayes_won: statsData?.filter((r) => r.result === 'ayes_win').length ?? 0,
      noes_won: statsData?.filter((r) => r.result === 'noes_win').length ?? 0,
    }

    return NextResponse.json({ divisions, stats } satisfies DivisionsResponse)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST /api/divisions — call a new division ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { title, motion_text, trigger_type, topic_id, coalition_id, supply_motion_id, duration_hours } = body

    if (!title?.trim() || !motion_text?.trim()) {
      return NextResponse.json({ error: 'title and motion_text are required' }, { status: 400 })
    }

    const hours = Math.min(Math.max(parseInt(duration_hours ?? '24'), 1), 168)
    const closes_at = new Date(Date.now() + hours * 3600 * 1000).toISOString()

    const { data, error } = await supabase
      .from('civic_divisions')
      .insert({
        title: title.trim(),
        motion_text: motion_text.trim(),
        trigger_type: trigger_type ?? 'floor',
        topic_id: topic_id ?? null,
        coalition_id: coalition_id ?? null,
        supply_motion_id: supply_motion_id ?? null,
        called_by: user.id,
        closes_at,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ division: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
