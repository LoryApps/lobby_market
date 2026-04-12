import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: { id: string }
}

// ── GET /api/debates/[id]/rsvp ─────────────────────────────────────────────
// Returns { count: number, hasRsvp: boolean } for the current visitor.
// hasRsvp is always false for unauthenticated requests.
export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  const supabase = await createClient()
  const debateId = params.id

  const [countRes, userRes] = await Promise.all([
    supabase
      .from('debate_rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('debate_id', debateId),
    supabase.auth.getUser(),
  ])

  const count = countRes.count ?? 0
  const userId = userRes.data.user?.id ?? null

  let hasRsvp = false
  if (userId) {
    const { data } = await supabase
      .from('debate_rsvps')
      .select('id')
      .eq('debate_id', debateId)
      .eq('user_id', userId)
      .maybeSingle()
    hasRsvp = !!data
  }

  return NextResponse.json({ count, hasRsvp })
}

// ── POST /api/debates/[id]/rsvp ────────────────────────────────────────────
// Toggles the current user's RSVP.
// Returns { count: number, hasRsvp: boolean } after the toggle.
export async function POST(
  _req: NextRequest,
  { params }: RouteParams
) {
  const supabase = await createClient()
  const debateId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check whether an RSVP already exists
  const { data: existing } = await supabase
    .from('debate_rsvps')
    .select('id')
    .eq('debate_id', debateId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Cancel (delete) RSVP
    await supabase
      .from('debate_rsvps')
      .delete()
      .eq('id', existing.id)
  } else {
    // Create RSVP
    const { error } = await supabase
      .from('debate_rsvps')
      .insert({ debate_id: debateId, user_id: user.id })

    if (error) {
      // Gracefully handle unique-constraint race condition
      if (error.code !== '23505') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
  }

  // Re-fetch fresh count
  const { count } = await supabase
    .from('debate_rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('debate_id', debateId)

  return NextResponse.json({ count: count ?? 0, hasRsvp: !existing })
}
