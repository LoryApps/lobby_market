import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Crown, Trophy, Users, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CoalitionManagePanel } from '@/components/lobby/CoalitionManagePanel'
import type {
  Coalition,
  CoalitionMember,
  CoalitionInvite,
  Lobby,
  Profile,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface CoalitionPageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export default async function CoalitionPage({ params }: CoalitionPageProps) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  const { data: coalition, error } = await supabase
    .from('coalitions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !coalition) {
    notFound()
  }

  const typedCoalition = coalition as Coalition

  // Parallel data fetches
  const [
    { data: memberRows },
    { data: activeLobbyRows },
    { data: creator },
    currentMemberRes,
    pendingInviteRes,
  ] = await Promise.all([
    supabase
      .from('coalition_members')
      .select('*')
      .eq('coalition_id', typedCoalition.id)
      .order('joined_at', { ascending: true })
      .limit(200),
    supabase
      .from('lobbies')
      .select('*')
      .eq('coalition_id', typedCoalition.id)
      .eq('is_active', true)
      .order('member_count', { ascending: false })
      .limit(20),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', typedCoalition.creator_id)
      .maybeSingle(),
    authUser
      ? supabase
          .from('coalition_members')
          .select('id, role')
          .eq('coalition_id', typedCoalition.id)
          .eq('user_id', authUser.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    authUser
      ? supabase
          .from('coalition_invites')
          .select('id')
          .eq('coalition_id', typedCoalition.id)
          .eq('invitee_id', authUser.id)
          .eq('status', 'pending')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const members = (memberRows as CoalitionMember[] | null) ?? []
  const activeLobbies = (activeLobbyRows as Lobby[] | null) ?? []
  const currentMember = currentMemberRes.data as {
    id: string
    role: 'leader' | 'officer' | 'member'
  } | null
  const pendingInvite = pendingInviteRes.data as { id: string } | null

  // Fetch pending invites if leader/officer
  let pendingInvitesForLeader: (CoalitionInvite & {
    invitee?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
  })[] = []

  if (
    currentMember &&
    ['leader', 'officer'].includes(currentMember.role)
  ) {
    const { data: invRows } = await supabase
      .from('coalition_invites')
      .select('*')
      .eq('coalition_id', typedCoalition.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    const inviteeIds = (invRows ?? []).map(
      (i: CoalitionInvite) => i.invitee_id
    )
    const { data: inviteeProfiles } = inviteeIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', inviteeIds)
      : { data: [] as Profile[] }

    const inviteeMap = new Map<string, Profile>()
    for (const p of inviteeProfiles ?? []) inviteeMap.set(p.id, p as Profile)

    pendingInvitesForLeader = (invRows ?? []).map(
      (inv: CoalitionInvite) => ({
        ...inv,
        invitee: inviteeMap.get(inv.invitee_id) ?? null,
      })
    )
  }

  // Build member list with profiles
  const memberIds = members.map((m) => m.user_id)
  const { data: memberProfiles } = memberIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', memberIds)
    : { data: [] as Profile[] }

  const profileMap = new Map<string, Profile>()
  for (const p of memberProfiles ?? []) {
    profileMap.set(p.id, p as Profile)
  }

  const membersWithProfiles = members.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id) ?? null,
  }))

  const totalMatches = typedCoalition.wins + typedCoalition.losses
  const winRate =
    totalMatches > 0
      ? Math.round((typedCoalition.wins / totalMatches) * 100)
      : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-3xl mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/coalitions"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to coalitions"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-medium text-surface-500">
            Coalition
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple/10 border border-purple/30 text-purple flex-shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl md:text-3xl font-bold text-white leading-tight">
              {typedCoalition.name}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-surface-500">
              Founded by @{creator?.username ?? 'anonymous'} ·{' '}
              {new Date(typedCoalition.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* ── Mission ─────────────────────────────────────────────────── */}
        {typedCoalition.description && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-2">
              Mission
            </div>
            <p className="font-mono text-sm text-white whitespace-pre-wrap leading-relaxed">
              {typedCoalition.description}
            </p>
          </div>
        )}

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Users className="h-3 w-3" />
              Members
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {typedCoalition.member_count}
              <span className="font-mono text-xs text-surface-500">
                /{typedCoalition.max_members}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Trophy className="h-3 w-3" />
              Win Rate
            </div>
            <div
              className={cn(
                'mt-1 font-mono text-2xl font-bold tabular-nums',
                winRate >= 50 ? 'text-emerald' : 'text-against-400'
              )}
            >
              {totalMatches === 0 ? '—' : `${winRate}%`}
            </div>
            <div className="font-mono text-[10px] text-surface-500">
              {typedCoalition.wins}W · {typedCoalition.losses}L
            </div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Zap className="h-3 w-3" />
              Influence
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-gold tabular-nums">
              {Math.round(typedCoalition.coalition_influence)}
            </div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Crown className="h-3 w-3" />
              Visibility
            </div>
            <div className="mt-1 font-mono text-sm font-semibold text-white">
              {typedCoalition.is_public ? 'Public' : 'Private'}
            </div>
          </div>
        </div>

        {/* ── Active Lobbies ───────────────────────────────────────────── */}
        <section>
          <h2 className="font-mono text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-gold" />
            Active Lobbies ({activeLobbies.length})
          </h2>
          {activeLobbies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100 p-8 text-center font-mono text-xs text-surface-500">
              This coalition is not currently running any lobbies.
            </div>
          ) : (
            <div className="space-y-2">
              {activeLobbies.map((lobby) => (
                <Link
                  key={lobby.id}
                  href={`/lobby/${lobby.id}`}
                  className={cn(
                    'flex items-center justify-between rounded-xl border border-surface-300 bg-surface-100 px-4 py-3',
                    'hover:border-gold/40 transition-colors'
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-white truncate">
                      {lobby.name}
                    </div>
                    <div className="font-mono text-[10px] text-surface-500 truncate">
                      {lobby.campaign_statement}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'ml-3 rounded-md px-2 py-0.5 font-mono text-[9px] font-bold flex-shrink-0',
                      lobby.position === 'for'
                        ? 'bg-for-500/10 text-for-400'
                        : 'bg-against-500/10 text-against-400'
                    )}
                  >
                    {lobby.position === 'for' ? 'FOR' : 'AGAINST'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Members + Management Panel ─────────────────────────────── */}
        <section>
          <h2 className="font-mono text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple" />
            Membership
          </h2>
          <CoalitionManagePanel
            coalitionId={typedCoalition.id}
            isPublic={typedCoalition.is_public}
            currentUserId={authUser?.id ?? null}
            currentUserRole={currentMember?.role ?? null}
            pendingInviteId={pendingInvite?.id ?? null}
            pendingInvites={pendingInvitesForLeader}
            members={membersWithProfiles}
            memberCount={typedCoalition.member_count}
            maxMembers={typedCoalition.max_members}
          />
        </section>
      </div>
    </div>
  )
}
