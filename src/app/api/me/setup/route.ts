import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface SetupProgress {
  onboarding_complete: boolean
  has_display_name: boolean
  has_avatar: boolean
  has_bio: boolean
  has_voted: boolean
  has_argued: boolean
  completed_count: number
  total_count: number
  is_complete: boolean
}

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
    .select('display_name, avatar_url, bio, total_votes, total_arguments, onboarding_complete')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const steps = {
    onboarding_complete: profile.onboarding_complete,
    has_display_name: !!profile.display_name?.trim(),
    has_avatar: !!profile.avatar_url,
    has_bio: !!profile.bio?.trim(),
    has_voted: (profile.total_votes ?? 0) > 0,
    has_argued: (profile.total_arguments ?? 0) > 0,
  }

  const completed_count = Object.values(steps).filter(Boolean).length
  const total_count = Object.keys(steps).length

  return NextResponse.json({
    ...steps,
    completed_count,
    total_count,
    is_complete: completed_count === total_count,
  } satisfies SetupProgress)
}
