import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReferralStats {
  invite_link: string
  invite_code: string
  total_clicks: number
  total_signups: number
  clout_earned: number
  recent: Array<{
    id: string
    created_at: string
    completed: boolean
  }>
}

// ─── GET — current user's referral stats ──────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (!profile?.username) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: referrals } = await supabase
    .from('civic_referrals')
    .select('id, created_at, completed_at, clout_awarded')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const rows = referrals ?? []
  const totalClicks = rows.length
  const signups = rows.filter((r) => r.completed_at)
  const cloutEarned = rows.reduce((sum, r) => sum + (r.clout_awarded ?? 0), 0)

  const stats: ReferralStats = {
    invite_link: `https://lobby.market/invite/${profile.username}`,
    invite_code: profile.username,
    total_clicks: totalClicks,
    total_signups: signups.length,
    clout_earned: cloutEarned,
    recent: rows.slice(0, 10).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      completed: !!r.completed_at,
    })),
  }

  return NextResponse.json(stats)
}

// ─── POST — log an invite visit (called from /invite/[username] page) ──────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const body = await req.json().catch(() => ({}))
  const { invite_code } = body as { invite_code?: string }

  if (!invite_code) {
    return NextResponse.json({ error: 'invite_code required' }, { status: 400 })
  }

  // Look up the referrer by username
  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', invite_code)
    .maybeSingle()

  if (!referrer) {
    return NextResponse.json({ error: 'Referrer not found' }, { status: 404 })
  }

  // Check if the visitor is already authenticated (i.e. a returning user)
  const {
    data: { user: visitor },
  } = await supabase.auth.getUser()

  // Don't log self-referrals
  if (visitor?.id === referrer.id) {
    return NextResponse.json({ ok: true, self: true })
  }

  const { error } = await supabase.from('civic_referrals').insert({
    referrer_id: referrer.id,
    invite_code,
    referee_id: visitor?.id ?? null,
    completed_at: visitor ? new Date().toISOString() : null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
