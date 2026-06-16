'use client'

/**
 * /coalitions/[id]/members — Coalition Member Directory
 *
 * Full roster for a coalition: leaders, officers, members — each with their
 * civic stats (clout, reputation, join date). Leaders can manage roles
 * and view pending invites / join requests from this page.
 *
 * Distinct from:
 *   /coalitions/[id]          — coalition overview with inline manage panel
 *   /coalitions/[id]/war-room — tactical campaign dashboard
 *   /coalitions/[id]/analytics — historical performance metrics
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Inbox,
  MailPlus,
  RefreshCw,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  UserMinus,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { RoleBadge } from '@/components/profile/RoleBadge'
import { cn } from '@/lib/utils/cn'
import type {
  MembersResponse,
  CoalitionMemberEntry,
  PendingInviteEntry,
  PendingRequestEntry,
  MemberRole,
} from '@/app/api/coalitions/[id]/members/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const w = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (w === 1) return '1w ago'
  if (w < 5) return `${w}w ago`
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<MemberRole, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  bg: string
  border: string
  text: string
}> = {
  leader: {
    label: 'Leader',
    icon: Crown,
    bg: 'bg-gold/15',
    border: 'border-gold/40',
    text: 'text-gold',
  },
  officer: {
    label: 'Officer',
    icon: Shield,
    bg: 'bg-purple/15',
    border: 'border-purple/40',
    text: 'text-purple',
  },
  member: {
    label: 'Member',
    icon: Users,
    bg: 'bg-surface-200/60',
    border: 'border-surface-400/40',
    text: 'text-surface-400',
  },
}

// ─── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isCurrentLeader,
  onRoleChange,
  onKick,
  busy,
}: {
  member: CoalitionMemberEntry
  isCurrentLeader: boolean
  onRoleChange: (userId: string, role: MemberRole) => void
  onKick: (userId: string, username: string) => void
  busy: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const rc = ROLE_CONFIG[member.coalitionRole]
  const Icon = rc.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-surface-100 border border-surface-300/40 hover:border-surface-400/60 transition-colors"
    >
      {/* Avatar */}
      <Link href={`/profile/${member.username}`} className="flex-shrink-0">
        <Avatar
          src={member.avatarUrl}
          fallback={member.displayName || member.username}
          size="md"
        />
      </Link>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${member.username}`}
            className="font-mono text-sm font-semibold text-white hover:text-for-400 transition-colors truncate"
          >
            {member.displayName || member.username}
          </Link>
          <RoleBadge role={member.userRole} size="sm" />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[11px] font-mono text-surface-500">
            @{member.username}
          </span>
          <span className="text-[11px] font-mono text-surface-600">
            Joined {relativeTime(member.joinedAt)}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
        <div className="text-center">
          <p className="font-mono text-xs font-bold text-gold tabular-nums">
            <AnimatedNumber value={member.clout} />
          </p>
          <p className="font-mono text-[9px] text-surface-600 uppercase tracking-wider mt-0.5">
            Clout
          </p>
        </div>
        <div className="text-center">
          <p className="font-mono text-xs font-bold text-for-400 tabular-nums">
            <AnimatedNumber value={member.reputationScore} />
          </p>
          <p className="font-mono text-[9px] text-surface-600 uppercase tracking-wider mt-0.5">
            Rep
          </p>
        </div>
      </div>

      {/* Coalition role badge */}
      <div
        className={cn(
          'flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border',
          rc.bg, rc.border, rc.text
        )}
      >
        <Icon className="h-3 w-3" />
        {rc.label}
      </div>

      {/* Leader actions */}
      {isCurrentLeader && member.coalitionRole !== 'leader' && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={busy}
            className="flex items-center justify-center h-7 w-7 rounded-lg border border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-white transition-all disabled:opacity-40"
            aria-label="Manage member"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-8 z-20 min-w-[160px] rounded-xl bg-surface-200 border border-surface-300/60 shadow-xl overflow-hidden"
              >
                {member.coalitionRole === 'member' && (
                  <button
                    onClick={() => { onRoleChange(member.userId, 'officer'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-purple hover:bg-surface-300/60 transition-colors"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Promote to Officer
                  </button>
                )}
                {member.coalitionRole === 'officer' && (
                  <button
                    onClick={() => { onRoleChange(member.userId, 'member'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-surface-400 hover:bg-surface-300/60 transition-colors"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Demote to Member
                  </button>
                )}
                <button
                  onClick={() => { onKick(member.userId, member.username); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-against-400 hover:bg-against-500/10 transition-colors border-t border-surface-300/40"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  Remove from Coalition
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

// ─── Invite row ────────────────────────────────────────────────────────────────

function InviteRow({ invite }: { invite: PendingInviteEntry }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-100/60 border border-surface-300/30">
      <Avatar
        src={invite.inviteeAvatarUrl}
        fallback={invite.inviteeDisplayName || invite.inviteeUsername}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-semibold text-white/80 truncate">
          {invite.inviteeDisplayName || invite.inviteeUsername}
        </p>
        <p className="font-mono text-[11px] text-surface-500">
          @{invite.inviteeUsername} · Invited {relativeTime(invite.createdAt)}
        </p>
      </div>
      <span className="text-[10px] font-mono text-gold/70 bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
        Pending
      </span>
    </div>
  )
}

// ─── Request row ───────────────────────────────────────────────────────────────

function RequestRow({
  request,
  onApprove,
  onReject,
  busy,
}: {
  request: PendingRequestEntry
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  busy: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-100/60 border border-surface-300/30">
      <Avatar
        src={request.requesterAvatarUrl}
        fallback={request.requesterDisplayName || request.requesterUsername}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-semibold text-white/80 truncate">
          {request.requesterDisplayName || request.requesterUsername}
        </p>
        <p className="font-mono text-[11px] text-surface-500">
          @{request.requesterUsername} · Requested {relativeTime(request.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onApprove(request.requestId)}
          disabled={busy}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-for-500/20 border border-for-500/40 text-for-400 hover:bg-for-500/30 transition-all disabled:opacity-40"
          aria-label="Approve request"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onReject(request.requestId)}
          disabled={busy}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-against-500/20 border border-against-500/40 text-against-400 hover:bg-against-500/30 transition-all disabled:opacity-40"
          aria-label="Reject request"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function MemberSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-2xl bg-surface-100 border border-surface-300/40"
        >
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  iconClass: string
}) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', iconClass)} />
      <span className="font-mono text-xs text-surface-500 font-semibold uppercase tracking-wider">
        {label}
      </span>
      <span className="font-mono text-xs text-surface-600 ml-1">{count}</span>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CoalitionMembersPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const coalitionId = params.id

  const [data, setData] = useState<MembersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/members`)
      if (res.status === 403) { setError('Access denied. You must be a member to view this roster.'); return }
      if (res.status === 404) { setError('Coalition not found.'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load members. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => { load() }, [load])

  // Toast helper
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Role change ──────────────────────────────────────────────────────────────
  async function handleRoleChange(userId: string, role: MemberRole) {
    if (busy || !data) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/coalitions/${coalitionId}/members/${userId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) },
      )
      if (!res.ok) { showToast('Could not update role.'); return }
      showToast(`Role updated to ${role}.`)
      await load()
    } catch {
      showToast('Network error.')
    } finally {
      setBusy(false)
    }
  }

  // ── Kick member ───────────────────────────────────────────────────────────────
  async function handleKick(userId: string, username: string) {
    if (busy || !data) return
    if (!confirm(`Remove @${username} from the coalition?`)) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/coalitions/${coalitionId}/members/${userId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) { showToast('Could not remove member.'); return }
      showToast(`@${username} removed.`)
      await load()
    } catch {
      showToast('Network error.')
    } finally {
      setBusy(false)
    }
  }

  // ── Handle join request ───────────────────────────────────────────────────────
  async function handleRequest(requestId: string, action: 'approve' | 'reject') {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/coalitions/${coalitionId}/join-requests/${requestId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) },
      )
      if (!res.ok) { showToast('Could not update request.'); return }
      showToast(action === 'approve' ? 'Request approved!' : 'Request rejected.')
      await load()
    } catch {
      showToast('Network error.')
    } finally {
      setBusy(false)
    }
  }

  // ── Filter members by search ─────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const filteredMembers = data
    ? data.members.filter(
        (m) =>
          !q ||
          m.username.toLowerCase().includes(q) ||
          (m.displayName?.toLowerCase() ?? '').includes(q),
      )
    : []

  // Group by role
  const leaders = filteredMembers.filter((m) => m.coalitionRole === 'leader')
  const officers = filteredMembers.filter((m) => m.coalitionRole === 'officer')
  const members = filteredMembers.filter((m) => m.coalitionRole === 'member')

  const isLeader = data?.currentUserRole === 'leader'
  const isOfficer = data?.currentUserRole === 'officer'
  const canManage = isLeader || isOfficer

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-white transition-all flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Users className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                {loading ? 'Members' : (data?.coalition.name ?? 'Members')}
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading
                  ? 'Loading roster…'
                  : `${data?.coalition.memberCount ?? 0} / ${data?.coalition.maxMembers ?? 0} members`}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {canManage && data && (
              <Link
                href={`/coalitions/${coalitionId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 transition-all"
              >
                <MailPlus className="h-3.5 w-3.5" />
                Invite
              </Link>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-white transition-all disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Users}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Can't load members"
            description={error}
            actions={[
              { label: 'Try again', onClick: load, variant: 'primary', icon: RefreshCw },
              { label: 'Back to coalition', href: `/coalitions/${coalitionId}`, variant: 'ghost', icon: ArrowLeft },
            ]}
          />
        )}

        {loading && <MemberSkeleton />}

        {!loading && !error && data && (
          <div className="space-y-5">
            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Members', value: data.coalition.memberCount, icon: Users, color: 'text-purple' },
                { label: 'Open Slots', value: data.openSlots, icon: UserPlus, color: 'text-for-400' },
                { label: 'Wins', value: data.coalition.wins, icon: Zap, color: 'text-gold' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface-100 border border-surface-300/40"
                >
                  <Icon className={cn('h-4 w-4', color)} />
                  <span className={cn('font-mono text-lg font-bold tabular-nums', color)}>
                    <AnimatedNumber value={value} />
                  </span>
                  <span className="font-mono text-[10px] text-surface-500 uppercase tracking-wider">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Pending requests (leaders/officers) */}
            {canManage && data.pendingRequests.length > 0 && (
              <div>
                <SectionHeader
                  icon={Inbox}
                  label="Join Requests"
                  count={data.pendingRequests.length}
                  iconClass="text-gold"
                />
                <div className="space-y-2">
                  {data.pendingRequests.map((req) => (
                    <RequestRow
                      key={req.requestId}
                      request={req}
                      onApprove={(id) => handleRequest(id, 'approve')}
                      onReject={(id) => handleRequest(id, 'reject')}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending invites (leaders/officers) */}
            {canManage && data.pendingInvites.length > 0 && (
              <div>
                <SectionHeader
                  icon={MailPlus}
                  label="Sent Invites"
                  count={data.pendingInvites.length}
                  iconClass="text-purple"
                />
                <div className="space-y-2">
                  {data.pendingInvites.map((inv) => (
                    <InviteRow
                      key={inv.inviteId}
                      invite={inv}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            {data.members.length > 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-100 border border-surface-300/40 text-sm font-mono text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-400/60 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Member groups */}
            {filteredMembers.length === 0 && search && (
              <p className="text-center font-mono text-sm text-surface-500 py-6">
                No members matching &ldquo;{search}&rdquo;
              </p>
            )}

            {leaders.length > 0 && (
              <div>
                <SectionHeader icon={Crown} label="Leadership" count={leaders.length} iconClass="text-gold" />
                <div className="space-y-2">
                  {leaders.map((m) => (
                    <MemberRow
                      key={m.memberId}
                      member={m}
                      isCurrentLeader={isLeader}
                      onRoleChange={handleRoleChange}
                      onKick={handleKick}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            )}

            {officers.length > 0 && (
              <div>
                <SectionHeader icon={Shield} label="Officers" count={officers.length} iconClass="text-purple" />
                <div className="space-y-2">
                  {officers.map((m) => (
                    <MemberRow
                      key={m.memberId}
                      member={m}
                      isCurrentLeader={isLeader}
                      onRoleChange={handleRoleChange}
                      onKick={handleKick}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            )}

            {members.length > 0 && (
              <div>
                <SectionHeader icon={Users} label="Members" count={members.length} iconClass="text-surface-400" />
                <div className="space-y-2">
                  {members.map((m) => (
                    <MemberRow
                      key={m.memberId}
                      member={m}
                      isCurrentLeader={isLeader}
                      onRoleChange={handleRoleChange}
                      onKick={handleKick}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state when coalition has no members yet (shouldn't happen) */}
            {filteredMembers.length === 0 && !search && (
              <EmptyState
                icon={Users}
                iconColor="text-surface-400"
                iconBg="bg-surface-200"
                iconBorder="border-surface-300"
                title="No members yet"
                description="This coalition is waiting for its first recruits."
              />
            )}

            {/* Back nav */}
            <div className="pt-2 flex items-center justify-center gap-4">
              <Link
                href={`/coalitions/${coalitionId}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Coalition overview
              </Link>
              <span className="text-surface-600">·</span>
              <Link
                href={`/coalitions/${coalitionId}/war-room`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
              >
                War Room
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-200 border border-surface-300/60 shadow-xl"
          >
            <Check className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
            <span className="font-mono text-sm text-white">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
