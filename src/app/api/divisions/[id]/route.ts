import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Division, DivisionLobby } from '../route'

// ─── GET /api/divisions/[id] ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: row, error } = await supabase
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
      .eq('id', params.id)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // User's own vote
    let userLobby: DivisionLobby | null = null
    if (user) {
      const { data: vote } = await supabase
        .from('division_votes')
        .select('lobby')
        .eq('division_id', params.id)
        .eq('user_id', user.id)
        .single()
      if (vote) userLobby = vote.lobby as DivisionLobby
    }

    // Recent Aye voters
    const { data: ayeVoters } = await supabase
      .from('division_votes')
      .select('user_id, voted_at, profile:profiles(id, username, display_name, avatar_url)')
      .eq('division_id', params.id)
      .eq('lobby', 'aye')
      .order('voted_at', { ascending: false })
      .limit(30)

    // Recent No voters
    const { data: noeVoters } = await supabase
      .from('division_votes')
      .select('user_id, voted_at, profile:profiles(id, username, display_name, avatar_url)')
      .eq('division_id', params.id)
      .eq('lobby', 'no')
      .order('voted_at', { ascending: false })
      .limit(30)

    const division: Division & {
      aye_voters: typeof ayeVoters
      noe_voters: typeof noeVoters
    } = {
      ...row,
      caller: row.caller ?? null,
      coalition: row.coalition ?? null,
      topic: row.topic ?? null,
      user_lobby: userLobby,
      aye_voters: ayeVoters ?? [],
      noe_voters: noeVoters ?? [],
    }

    return NextResponse.json({ division })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST /api/divisions/[id] — cast a vote (walk through a lobby) ─────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { lobby } = await req.json()
    if (!['aye', 'no', 'abstain'].includes(lobby)) {
      return NextResponse.json({ error: 'lobby must be aye | no | abstain' }, { status: 400 })
    }

    // Check division is still open
    const { data: division } = await supabase
      .from('civic_divisions')
      .select('status, closes_at')
      .eq('id', params.id)
      .single()

    if (!division || division.status !== 'open') {
      return NextResponse.json({ error: 'Division is not open' }, { status: 409 })
    }

    if (new Date(division.closes_at) < new Date()) {
      return NextResponse.json({ error: 'Division has closed' }, { status: 409 })
    }

    // Upsert vote (changing your lobby is allowed while open)
    const { data: existing } = await supabase
      .from('division_votes')
      .select('lobby')
      .eq('division_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // Decrement old count
      const oldCol = existing.lobby === 'aye' ? 'ayes' : existing.lobby === 'no' ? 'noes' : 'abstentions'
      await supabase.rpc('decrement_division_count', {
        p_division_id: params.id,
        p_column: oldCol,
      }).maybeSingle()

      await supabase
        .from('division_votes')
        .update({ lobby, voted_at: new Date().toISOString() })
        .eq('division_id', params.id)
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('division_votes')
        .insert({ division_id: params.id, user_id: user.id, lobby })
    }

    // Increment new count via a simple update with manual counter management
    const newCol = lobby === 'aye' ? 'ayes' : lobby === 'no' ? 'noes' : 'abstentions'
    const { data: current } = await supabase
      .from('civic_divisions')
      .select('ayes, noes, abstentions')
      .eq('id', params.id)
      .single()

    if (current) {
      const patch: Record<string, number> = {}
      if (existing) {
        // Adjust old and new
        const oldCol2 = existing.lobby === 'aye' ? 'ayes' : existing.lobby === 'no' ? 'noes' : 'abstentions'
        patch[oldCol2] = Math.max(0, (current[oldCol2 as keyof typeof current] as number) - 1)
        patch[newCol] = (current[newCol as keyof typeof current] as number) + 1
      } else {
        patch[newCol] = (current[newCol as keyof typeof current] as number) + 1
      }
      await supabase.from('civic_divisions').update(patch).eq('id', params.id)
    }

    return NextResponse.json({ ok: true, lobby })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── PATCH /api/divisions/[id] — withdraw (by caller) ─────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { action, speaker_note } = await req.json()

    if (action === 'withdraw') {
      const { error } = await supabase
        .from('civic_divisions')
        .update({ status: 'withdrawn', result: 'withdrawn', result_declared_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('called_by', user.id)
        .eq('status', 'open')

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'close') {
      const { data: div } = await supabase
        .from('civic_divisions')
        .select('ayes, noes, abstentions, quorum')
        .eq('id', params.id)
        .single()

      if (!div) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const total = div.ayes + div.noes + div.abstentions
      let result = 'quorum_failed'
      if (total >= div.quorum) {
        if (div.ayes > div.noes) result = 'ayes_win'
        else if (div.noes > div.ayes) result = 'noes_win'
        else result = 'tied'
      }

      await supabase
        .from('civic_divisions')
        .update({
          status: 'closed',
          result,
          result_declared_at: new Date().toISOString(),
          speaker_note: speaker_note ?? null,
        })
        .eq('id', params.id)
        .eq('called_by', user.id)

      return NextResponse.json({ ok: true, result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
