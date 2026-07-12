import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET — list all confidence motions ────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const [motionsRes, userRes] = await Promise.allSettled([
    supabase
      .from('confidence_motions')
      .select(`
        id, reason, status, votes_for, votes_against, expires_at, created_at,
        profiles:tabled_by (id, username, display_name, avatar_url, role, clout)
      `)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase.auth.getUser(),
  ])

  const motions =
    motionsRes.status === 'fulfilled' ? (motionsRes.value.data ?? []) : []

  let userVotes: Record<string, string> = {}

  if (userRes.status === 'fulfilled' && userRes.value.data.user) {
    const uid = userRes.value.data.user.id
    const { data: voteRows } = await supabase
      .from('confidence_votes')
      .select('motion_id, side')
      .eq('user_id', uid)
    userVotes = Object.fromEntries(
      (voteRows ?? []).map((v) => [v.motion_id, v.side]),
    )
  }

  return NextResponse.json({ motions, userVotes })
}

// ─── POST — table a new confidence motion ─────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const reason: string = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (reason.length < 10 || reason.length > 500) {
    return NextResponse.json(
      { error: 'Reason must be between 10 and 500 characters' },
      { status: 400 },
    )
  }

  // One open motion at a time — prevent duplicate tables
  const { data: existing } = await supabase
    .from('confidence_motions')
    .select('id')
    .eq('status', 'open')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A confidence motion is already open. Vote on it or wait for it to expire.' },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('confidence_motions')
    .insert({ tabled_by: user.id, reason })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ motion: data }, { status: 201 })
}
