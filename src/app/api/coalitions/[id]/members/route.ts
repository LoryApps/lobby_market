import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ────────────────────────────────────────────────────────────

export type MemberRole = 'leader' | 'officer' | 'member'

export interface CoalitionMemberEntry {
  memberId: string
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  userRole: string        // platform role (e.g. 'citizen', 'senator')
  coalitionRole: MemberRole
  clout: number
  reputationScore: number
  joinedAt: string
}

export interface PendingInviteEntry {
  inviteId: string
  inviteeId: string
  inviteeUsername: string
  inviteeDisplayName: string | null
  inviteeAvatarUrl: string | null
  createdAt: string
}

export interface PendingRequestEntry {
  requestId: string
  requesterId: string
  requesterUsername: string
  requesterDisplayName: string | null
  requesterAvatarUrl: string | null
  createdAt: string
}

export interface MembersResponse {
  coalition: {
    id: string
    name: string
    description: string | null
    memberCount: number
    maxMembers: number
    isPublic: boolean
    wins: number
    losses: number
  }
  currentUserRole: MemberRole | null
  members: CoalitionMemberEntry[]
  pendingInvites: PendingInviteEntry[]
  pendingRequests: PendingRequestEntry[]
  openSlots: number
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const coalitionId = params.id

  // ── Auth (optional) ──────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // ── Coalition info ────────────────────────────────────────────────────────────
  const { data: coalition, error: coalErr } = await supabase
    .from('coalitions')
    .select('id, name, description, member_count, max_members, is_public, wins, losses')
    .eq('id', coalitionId)
    .single()

  if (coalErr || !coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // ── Current user's role ───────────────────────────────────────────────────────
  let currentUserRole: MemberRole | null = null
  if (userId) {
    const { data: selfMember } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', coalitionId)
      .eq('user_id', userId)
      .maybeSingle()
    currentUserRole = (selfMember?.role as MemberRole) ?? null
  }

  // Private coalitions: only members can view the full member list
  if (!coalition.is_public && !currentUserRole) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // ── Member list ───────────────────────────────────────────────────────────────
  const { data: memberRows } = await supabase
    .from('coalition_members')
    .select('id, user_id, role, joined_at')
    .eq('coalition_id', coalitionId)
    .order('joined_at', { ascending: true })

  const memberList = memberRows ?? []
  const memberIds = memberList.map((m) => m.user_id)

  // Bulk-fetch profiles for all members
  const profileMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
  }>()

  if (memberIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', memberIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role ?? 'citizen',
        clout: p.clout ?? 0,
        reputation_score: p.reputation_score ?? 0,
      })
    }
  }

  // Build role-priority sort: leader → officer → member, then clout desc
  const ROLE_ORDER: Record<MemberRole, number> = { leader: 0, officer: 1, member: 2 }

  const members: CoalitionMemberEntry[] = memberList
    .map((m) => {
      const p = profileMap.get(m.user_id)
      return {
        memberId: m.id,
        userId: m.user_id,
        username: p?.username ?? m.user_id,
        displayName: p?.display_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
        userRole: p?.role ?? 'citizen',
        coalitionRole: m.role as MemberRole,
        clout: p?.clout ?? 0,
        reputationScore: p?.reputation_score ?? 0,
        joinedAt: m.joined_at,
      }
    })
    .sort((a, b) => {
      const roleDiff = ROLE_ORDER[a.coalitionRole] - ROLE_ORDER[b.coalitionRole]
      if (roleDiff !== 0) return roleDiff
      return b.clout - a.clout
    })

  // ── Pending invites (leaders/officers only) ───────────────────────────────────
  let pendingInvites: PendingInviteEntry[] = []
  let pendingRequests: PendingRequestEntry[] = []

  if (currentUserRole === 'leader' || currentUserRole === 'officer') {
    const { data: inviteRows } = await supabase
      .from('coalition_invites')
      .select('id, invitee_id, created_at')
      .eq('coalition_id', coalitionId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    const inviteeIds = (inviteRows ?? []).map((i) => i.invitee_id)
    const inviteeMap = new Map<string, {
      username: string; display_name: string | null; avatar_url: string | null
    }>()
    if (inviteeIds.length > 0) {
      const { data: inviteeProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', inviteeIds)
      for (const p of inviteeProfiles ?? []) {
        inviteeMap.set(p.id, {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        })
      }
    }

    pendingInvites = (inviteRows ?? []).map((inv) => {
      const p = inviteeMap.get(inv.invitee_id)
      return {
        inviteId: inv.id,
        inviteeId: inv.invitee_id,
        inviteeUsername: p?.username ?? inv.invitee_id,
        inviteeDisplayName: p?.display_name ?? null,
        inviteeAvatarUrl: p?.avatar_url ?? null,
        createdAt: inv.created_at,
      }
    })

    // Join requests
    const { data: requestRows } = await supabase
      .from('coalition_join_requests')
      .select('id, user_id, created_at')
      .eq('coalition_id', coalitionId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    const requesterIds = (requestRows ?? []).map((r) => r.user_id)
    const requesterMap = new Map<string, {
      username: string; display_name: string | null; avatar_url: string | null
    }>()
    if (requesterIds.length > 0) {
      const { data: requesterProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', requesterIds)
      for (const p of requesterProfiles ?? []) {
        requesterMap.set(p.id, {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        })
      }
    }

    pendingRequests = (requestRows ?? []).map((req) => {
      const p = requesterMap.get(req.user_id)
      return {
        requestId: req.id,
        requesterId: req.user_id,
        requesterUsername: p?.username ?? req.user_id,
        requesterDisplayName: p?.display_name ?? null,
        requesterAvatarUrl: p?.avatar_url ?? null,
        createdAt: req.created_at,
      }
    })
  }

  return NextResponse.json({
    coalition: {
      id: coalition.id,
      name: coalition.name,
      description: coalition.description,
      memberCount: coalition.member_count,
      maxMembers: coalition.max_members,
      isPublic: coalition.is_public,
      wins: coalition.wins ?? 0,
      losses: coalition.losses ?? 0,
    },
    currentUserRole,
    members,
    pendingInvites,
    pendingRequests,
    openSlots: Math.max(0, coalition.max_members - coalition.member_count),
  } satisfies MembersResponse)
}
