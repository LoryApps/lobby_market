import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommitteeChair {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
}

export interface SelectCommittee {
  id: string
  slug: string
  name: string
  policy_area: string
  description: string
  remit: string
  icon: string
  colour: string
  chair_id: string | null
  member_count: number
  inquiry_count: number
  open_inquiry_count: number
  created_at: string
  chair: CommitteeChair | null
  user_is_member: boolean
}

export interface CommitteesResponse {
  committees: SelectCommittee[]
}

// ── GET /api/committees ───────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch all committees with chair profile
  const { data: committees, error } = await supabase
    .from('civic_committees')
    .select(`
      *,
      chair:profiles!civic_committees_chair_id_fkey(
        id, username, display_name, avatar_url, role, reputation_score
      )
    `)
    .order('policy_area', { ascending: true })

  if (error || !committees) {
    return NextResponse.json({ committees: [] })
  }

  // Count open inquiries per committee
  const { data: openCounts } = await supabase
    .from('committee_inquiries')
    .select('committee_id')
    .eq('status', 'open')

  const openByCommittee: Record<string, number> = {}
  for (const row of openCounts ?? []) {
    openByCommittee[row.committee_id] = (openByCommittee[row.committee_id] ?? 0) + 1
  }

  // Check which committees the current user has joined
  const memberSet = new Set<string>()
  if (user) {
    const { data: memberships } = await supabase
      .from('committee_members')
      .select('committee_id')
      .eq('user_id', user.id)
    for (const m of memberships ?? []) memberSet.add(m.committee_id)
  }

  // If chair_id is null, auto-assign the highest-rep user in that policy area
  const chairlessAreas = committees
    .filter((c) => !c.chair_id)
    .map((c) => c.policy_area)

  const autoChairs: Record<string, CommitteeChair> = {}
  if (chairlessAreas.length > 0) {
    const unique = [...new Set(chairlessAreas)]
    for (const area of unique) {
      const { data: topUser } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, reputation_score')
        .order('reputation_score', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (topUser) autoChairs[area] = topUser as CommitteeChair
    }
  }

  const result: SelectCommittee[] = committees.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    policy_area: c.policy_area,
    description: c.description,
    remit: c.remit,
    icon: c.icon,
    colour: c.colour,
    chair_id: c.chair_id,
    member_count: c.member_count ?? 0,
    inquiry_count: c.inquiry_count ?? 0,
    open_inquiry_count: openByCommittee[c.id] ?? 0,
    created_at: c.created_at,
    chair: (c.chair as CommitteeChair | null) ?? autoChairs[c.policy_area] ?? null,
    user_is_member: memberSet.has(c.id),
  }))

  return NextResponse.json({ committees: result })
}
