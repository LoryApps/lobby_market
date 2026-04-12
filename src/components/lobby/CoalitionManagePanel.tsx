'use client'

/**
 * CoalitionManagePanel
 *
 * Client component rendered on the coalition detail page.
 * Shows:
 *  - Leaders/officers: invite form + pending invites + member list with kick
 *  - Members: leave button
 *  - Non-members: join button (public coalition) or message
 *  - Pending invitees: accept / decline buttons
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus,
  UserMinus,
  LogOut,
  Crown,
  Shield,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Mail,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { CoalitionInvite, Profile } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberRole = 'leader' | 'officer' | 'member'

interface MemberWithProfile {
  id: string
  user_id: string
  role: MemberRole
  joined_at: string
  profile?: Profile | null
}

interface PendingInviteWithProfile extends CoalitionInvite {
  invitee?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
}

interface CoalitionManagePanelProps {
  coalitionId: string
  isPublic: boolean
  /** Current user's relation to this coalition */
  currentUserId: string | null
  currentUserRole: MemberRole | null     // null = not a member
  pendingInviteId: string | null          // invite sent to current user
  pendingInvites: PendingInviteWithProfile[]   // pending invites (for leaders)
  members: MemberWithProfile[]
  memberCount: number
  maxMembers: number
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: MemberRole }) {
  if (role === 'leader')
    return <Crown className="h-3.5 w-3.5 text-gold" aria-label="Leader" />
  if (role === 'officer')
    return <Shield className="h-3.5 w-3.5 text-for-400" aria-label="Officer" />
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CoalitionManagePanel({
  coalitionId,
  isPublic,
  currentUserId,
  currentUserRole,
  pendingInviteId,
  pendingInvites: initialPendingInvites,
  members: initialMembers,
  memberCount,
  maxMembers,
}: CoalitionManagePanelProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Invite form
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)

  // Pending invites (local state, updated after actions)
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites)

  // Member list (local state for optimistic kick)
  const [members, setMembers] = useState(initialMembers)
  const [kickingId, setKickingId] = useState<string | null>(null)

  // Response to own invite
  const [respondingInvite, setRespondingInvite] = useState(false)
  const [ownInviteGone, setOwnInviteGone] = useState(false)

  // Join / leave
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const isLeaderOrOfficer =
    currentUserRole === 'leader' || currentUserRole === 'officer'

  // ─── Invite handler ─────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteUsername.trim()) return

    setIsInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: inviteUsername.trim(),
          message: inviteMessage.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setInviteError(data.error ?? 'Failed to send invite')
      } else {
        setInviteSuccess(`Invite sent to @${inviteUsername.trim().replace(/^@/, '')}`)
        setInviteUsername('')
        setInviteMessage('')
        // Refresh pending invites
        const invRes = await fetch(`/api/coalitions/${coalitionId}/invite`)
        if (invRes.ok) {
          const invData = await invRes.json()
          setPendingInvites(invData.invites ?? [])
        }
      }
    } catch {
      setInviteError('Network error — please try again')
    } finally {
      setIsInviting(false)
    }
  }

  // ─── Cancel / revoke pending invite ─────────────────────────────────────────

  async function cancelInvite(inviteId: string) {
    // Optimistic remove
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
    // Note: No dedicated cancel endpoint — just update status via a simple DELETE
    // For simplicity we re-invite with "declined" by patching (handled server-side on next invite)
  }

  // ─── Respond to own pending invite ──────────────────────────────────────────

  async function respondToInvite(action: 'accept' | 'decline') {
    if (!pendingInviteId) return
    setRespondingInvite(true)

    try {
      const res = await fetch(
        `/api/coalition-invites/${pendingInviteId}/respond`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      )
      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? 'Failed to respond to invite')
      } else {
        setOwnInviteGone(true)
        startTransition(() => router.refresh())
      }
    } catch {
      alert('Network error — please try again')
    } finally {
      setRespondingInvite(false)
    }
  }

  // ─── Join (public coalition) ─────────────────────────────────────────────────

  async function handleJoin() {
    setIsJoining(true)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/join`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Failed to join coalition')
      } else {
        startTransition(() => router.refresh())
      }
    } catch {
      alert('Network error — please try again')
    } finally {
      setIsJoining(false)
    }
  }

  // ─── Leave ───────────────────────────────────────────────────────────────────

  async function handleLeave() {
    if (!confirm('Leave this coalition?')) return
    setIsLeaving(true)

    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/leave`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Failed to leave coalition')
      } else {
        startTransition(() => router.refresh())
      }
    } catch {
      alert('Network error — please try again')
    } finally {
      setIsLeaving(false)
    }
  }

  // ─── Kick member ─────────────────────────────────────────────────────────────

  async function kickMember(userId: string, username: string) {
    if (!confirm(`Remove @${username} from this coalition?`)) return
    setKickingId(userId)

    try {
      const res = await fetch(
        `/api/coalitions/${coalitionId}/members/${userId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? 'Failed to remove member')
      } else {
        // Optimistic update
        setMembers((prev) => prev.filter((m) => m.user_id !== userId))
      }
    } catch {
      alert('Network error — please try again')
    } finally {
      setKickingId(null)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Pending invite banner (for non-members who were invited) ─── */}
      {pendingInviteId && !ownInviteGone && currentUserRole === null && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-purple/40 bg-purple/10 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-purple" />
            <span className="font-mono text-xs font-semibold text-purple">
              You have a pending invitation to join this coalition
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="for"
              size="sm"
              disabled={respondingInvite}
              onClick={() => respondToInvite('accept')}
              className="flex-1"
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
            <Button
              variant="against"
              size="sm"
              disabled={respondingInvite}
              onClick={() => respondToInvite('decline')}
              className="flex-1"
            >
              <X className="h-3.5 w-3.5" />
              Decline
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Non-member: Join button ─────────────────────────────────── */}
      {currentUserId && currentUserRole === null && !pendingInviteId && isPublic && (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
          <p className="font-mono text-xs text-surface-500 mb-3">
            This coalition is public — anyone can join.
            ({memberCount}/{maxMembers} members)
          </p>
          <Button
            variant="gold"
            size="sm"
            disabled={isJoining || memberCount >= maxMembers}
            onClick={handleJoin}
            className="w-full"
          >
            <Users className="h-3.5 w-3.5" />
            {isJoining
              ? 'Joining…'
              : memberCount >= maxMembers
              ? 'Coalition full'
              : 'Join Coalition'}
          </Button>
        </div>
      )}

      {/* ── Member: leave button ────────────────────────────────────── */}
      {currentUserRole === 'member' && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={isLeaving}
            onClick={handleLeave}
            className="text-against-400 hover:text-against-300 hover:bg-against-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isLeaving ? 'Leaving…' : 'Leave Coalition'}
          </Button>
        </div>
      )}

      {/* ── Leader / Officer: invite form + pending invites ─────────── */}
      {isLeaderOrOfficer && (
        <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
          {/* Header */}
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-200 transition-colors"
            onClick={() => setShowInviteForm((v) => !v)}
          >
            <span className="flex items-center gap-2 font-mono text-xs font-semibold text-white">
              <UserPlus className="h-3.5 w-3.5 text-purple" />
              Invite Members
              {pendingInvites.length > 0 && (
                <span className="rounded-full bg-purple/20 px-1.5 py-0.5 text-[10px] text-purple">
                  {pendingInvites.length} pending
                </span>
              )}
            </span>
            {showInviteForm ? (
              <ChevronUp className="h-3.5 w-3.5 text-surface-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
            )}
          </button>

          <AnimatePresence>
            {showInviteForm && (
              <motion.div
                key="invite-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-surface-300"
              >
                <div className="p-4 space-y-4">
                  {/* Invite form */}
                  <form onSubmit={handleInvite} className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-surface-500">
                          @
                        </span>
                        <input
                          type="text"
                          value={inviteUsername}
                          onChange={(e) => {
                            setInviteUsername(e.target.value)
                            setInviteError(null)
                            setInviteSuccess(null)
                          }}
                          placeholder="username"
                          className="w-full h-9 rounded-lg bg-surface-200 border border-surface-300 pl-7 pr-3 font-mono text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/60 focus:ring-1 focus:ring-purple/30"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isInviting || !inviteUsername.trim()}
                        className="bg-purple/20 text-purple border border-purple/30 hover:bg-purple/30 shrink-0"
                      >
                        {isInviting ? 'Sending…' : 'Invite'}
                      </Button>
                    </div>

                    <input
                      type="text"
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      placeholder="Optional message…"
                      maxLength={160}
                      className="w-full h-9 rounded-lg bg-surface-200 border border-surface-300 px-3 font-mono text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/60 focus:ring-1 focus:ring-purple/30"
                    />

                    {inviteError && (
                      <p className="font-mono text-[11px] text-against-400">
                        {inviteError}
                      </p>
                    )}
                    {inviteSuccess && (
                      <p className="font-mono text-[11px] text-for-400">
                        {inviteSuccess}
                      </p>
                    )}
                  </form>

                  {/* Pending invites list */}
                  {pendingInvites.length > 0 && (
                    <div>
                      <p className="font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-2">
                        Pending ({pendingInvites.length})
                      </p>
                      <div className="space-y-1.5">
                        {pendingInvites.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center gap-2 rounded-lg bg-surface-200 px-3 py-2"
                          >
                            <Avatar
                              src={inv.invitee?.avatar_url}
                              fallback={
                                inv.invitee?.display_name ||
                                inv.invitee?.username ||
                                '?'
                              }
                              size="xs"
                            />
                            <span className="flex-1 font-mono text-xs text-white truncate">
                              @{inv.invitee?.username ?? '…'}
                            </span>
                            <Clock className="h-3 w-3 text-surface-500 shrink-0" />
                            <button
                              onClick={() => cancelInvite(inv.id)}
                              className="ml-1 rounded p-0.5 text-surface-500 hover:text-against-400 hover:bg-against-500/10 transition-colors"
                              aria-label="Cancel invite"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Member list (with kick for leaders/officers) ─────────────── */}
      <div>
        <h3 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Members ({members.length})
        </h3>

        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100 p-8 text-center font-mono text-xs text-surface-500">
            No members yet
          </div>
        ) : (
          <div className="rounded-xl border border-surface-300 bg-surface-100 divide-y divide-surface-300/60">
            {members.map((m) => {
              const profile = m.profile
              const canKick =
                isLeaderOrOfficer &&
                m.user_id !== currentUserId &&
                m.role !== 'leader' &&
                !(currentUserRole === 'officer' && m.role === 'officer')

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Avatar
                    src={profile?.avatar_url}
                    fallback={
                      profile?.display_name || profile?.username || 'U'
                    }
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-medium text-white truncate">
                      {profile?.display_name ?? profile?.username ?? 'anonymous'}
                    </p>
                    <p className="font-mono text-[10px] text-surface-500 capitalize">
                      {m.role}
                    </p>
                  </div>

                  <RoleBadge role={m.role} />

                  {canKick && (
                    <button
                      onClick={() =>
                        kickMember(
                          m.user_id,
                          profile?.username ?? m.user_id
                        )
                      }
                      disabled={kickingId === m.user_id}
                      className={cn(
                        'ml-2 rounded-lg p-1.5 transition-colors',
                        'text-surface-500 hover:text-against-400 hover:bg-against-500/10',
                        kickingId === m.user_id && 'opacity-50 cursor-not-allowed'
                      )}
                      aria-label={`Remove ${profile?.username ?? 'member'}`}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Leader leave (must transfer first) ──────────────────────── */}
      {currentUserRole === 'leader' && (
        <p className="font-mono text-[10px] text-surface-500 text-center">
          As the leader, you must transfer leadership before leaving.
        </p>
      )}
    </div>
  )
}
