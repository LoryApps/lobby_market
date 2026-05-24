import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmbassadorRecruit {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
  status: 'signed_up' | 'converted'
  joined_at: string
  converted_at: string | null
}

export interface AmbassadorStats {
  code: string
  referral_url: string
  times_clicked: number
  times_signed_up: number
  times_converted: number
  clout_earned: number
  conversion_rate: number  // signed_up → converted %
  recruits: AmbassadorRecruit[]
  // current user's own stats
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
  // tier info
  tier: string
  tier_color: string
  next_tier: string | null
  next_tier_at: number | null
}

// ─── Tier system ──────────────────────────────────────────────────────────────

function getTier(converts: number): { tier: string; color: string; next: string | null; nextAt: number | null } {
  if (converts >= 50) return { tier: 'Civic Champion',  color: 'text-gold',     next: null,             nextAt: null }
  if (converts >= 20) return { tier: 'Movement Maker',  color: 'text-purple',   next: 'Civic Champion', nextAt: 50 }
  if (converts >= 10) return { tier: 'Community Builder',color: 'text-emerald', next: 'Movement Maker', nextAt: 20 }
  if (converts >= 5)  return { tier: 'Active Recruiter', color: 'text-for-400', next: 'Community Builder', nextAt: 10 }
  if (converts >= 1)  return { tier: 'Ambassador',        color: 'text-surface-300', next: 'Active Recruiter', nextAt: 5 }
  return            { tier: 'Recruit',              color: 'text-surface-500', next: 'Ambassador', nextAt: 1 }
}

// ─── GET /api/ambassador ──────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch current user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Fetch or create referral code
  const { data: refCode } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!refCode) {
    // Table might not exist yet (migration not run) — return graceful stub
    const stub: AmbassadorStats = {
      code: profile.username,
      referral_url: `https://lobby.market/welcome?ref=${profile.username}`,
      times_clicked: 0,
      times_signed_up: 0,
      times_converted: 0,
      clout_earned: 0,
      conversion_rate: 0,
      recruits: [],
      user: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout,
      },
      ...getTier(0),
      tier_color: getTier(0).color,
      next_tier: getTier(0).next,
      next_tier_at: getTier(0).nextAt,
    }
    return NextResponse.json(stub)
  }

  // Fetch referral conversions with referee profile data
  const { data: conversions } = await supabase
    .from('referral_conversions')
    .select('referee_id, status, clout_awarded, created_at, converted_at')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const refereeIds = (conversions ?? []).map((c) => c.referee_id)

  let recruits: AmbassadorRecruit[] = []
  if (refereeIds.length > 0) {
    const { data: refereeProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, total_votes')
      .in('id', refereeIds)

    const profileMap = new Map((refereeProfiles ?? []).map((p) => [p.id, p]))

    recruits = (conversions ?? []).map((c) => {
      const p = profileMap.get(c.referee_id)
      return {
        id: c.referee_id,
        username: p?.username ?? 'unknown',
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        role: p?.role ?? 'person',
        clout: p?.clout ?? 0,
        total_votes: p?.total_votes ?? 0,
        status: c.status as 'signed_up' | 'converted',
        joined_at: c.created_at,
        converted_at: c.converted_at ?? null,
      }
    })
  }

  const tierInfo = getTier(refCode.times_converted)

  const stats: AmbassadorStats = {
    code: refCode.code,
    referral_url: `https://lobby.market/welcome?ref=${refCode.code}`,
    times_clicked: refCode.times_clicked,
    times_signed_up: refCode.times_signed_up,
    times_converted: refCode.times_converted,
    clout_earned: refCode.clout_earned,
    conversion_rate:
      refCode.times_signed_up > 0
        ? Math.round((refCode.times_converted / refCode.times_signed_up) * 100)
        : 0,
    recruits,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
    },
    tier: tierInfo.tier,
    tier_color: tierInfo.color,
    next_tier: tierInfo.next,
    next_tier_at: tierInfo.nextAt,
  }

  return NextResponse.json(stats)
}
