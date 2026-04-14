import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NotifPrefs {
  achievement_earned: boolean
  debate_starting: boolean
  law_established: boolean
  topic_activated: boolean
  vote_threshold: boolean
  reply_received: boolean
  role_promoted: boolean
  lobby_update: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  achievement_earned: true,
  debate_starting: true,
  law_established: true,
  topic_activated: true,
  vote_threshold: true,
  reply_received: true,
  role_promoted: true,
  lobby_update: false,
}

// ─── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select(
      'achievement_earned, debate_starting, law_established, topic_activated, vote_threshold, reply_received, role_promoted, lobby_update'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[notification-prefs GET]', error)
    return NextResponse.json(DEFAULT_PREFS)
  }

  // Row doesn't exist yet — return defaults so the client can seed localStorage
  return NextResponse.json(data ?? DEFAULT_PREFS)
}

// ─── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<NotifPrefs>
  try {
    body = (await request.json()) as Partial<NotifPrefs>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Merge with defaults so we never write partial rows
  const prefs: NotifPrefs = {
    ...DEFAULT_PREFS,
    ...body,
  }

  const { error } = await supabase
    .from('user_notification_prefs')
    .upsert(
      {
        user_id: user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[notification-prefs PUT]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
