'use client'

/**
 * CoalitionManagePanel
 *
 * Client component rendered on the coalition detail page.
 * Shows:
 *  - Leaders/officers: invite form + pending invites + join request queue + member list with kick
 *  - Members: leave button
 *  - Non-members (public): join button
 *  - Non-members (private): request to join / pending request state
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
  Lock,
  Send,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { CoalitionInvite, Profile } from '@/lib/supabase/types'
import type { JoinRequestWithProfile } from '@/app/api/coalitions/[id]/join-requests/route'

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

interface OwnJoinRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface CoalitionManagePanelProps {
  coalitionId: string
  isPublic: boolean
  currentUserId: string | null
  currentUserRole: MemberRole | null
  pendingInviteId: string | null
  pendingInvites: PendingInviteWithProfile[]
  members: MemberWithProfile[]
  memberCount: number
  maxMembers: number
  /** The current user's own join request, if any (private coalitions only) */
  ownJoinRequest: OwnJoinRequest | null
  /** Pending join requests from other users (leaders/officers only) */
  incomingJoinRequests: JoinRequestWithProfile[]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: MemberRole }) {
  if (role === 'leader')
    return <Crown className="h-3.5 w-3.5 text-gold" aria-label="Leader" />
  if (role === 'officer')
    return <Shield className="h-3.5 w-3.5 text-for-400" aria-label="Officer" />
  return null
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
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
  ownJoinRequest: initialOwnJoinRequest,
  incomingJoinRequests: initialIncomingJoinRequests,
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

  // Join requests (for non-members of private coalitions)
  const [ownJoinRequest, setOwnJoinRequest] = useState<OwnJoinRequest | null>(initialOwnJoinRequest)
  const [isRequestingJoin, setIsRequestingJoin] = useState(false)
  const [isCancellingRequest, setIsCancellingRequest] = useState(false)
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null)

  // Incoming join requests (for leaders/officers)
  const [incomingRequests, setIncomingRequests] = useState(initialIncomingJoinRequests)
  const [showJoinRequests, setShowJoinRequests] = useState(false)
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null)

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
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
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

  // ─── Request to join (private coalition) ─────────────────────────────────────

  async function handleRequestJoin() {
    setIsRequestingJoin(true)
    setJoinRequestError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/join-request`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setJoinRequestError(data.error ?? 'Failed to submit request')
      } else {
        setOwnJoinRequest(data.request)
      }
    } catch {
      setJoinRequestError('Network error — please try again')
    } finally {
      setIsRequestingJoin(false)
    }
  }

  // ─── Cancel own join request ──────────────────────────────────────────────────

  async function handleCancelRequest() {
    setIsCancellingRequest(true)
    try {
      await fetch(`/api/coalitions/${coalitionId}/join-request`, { method: 'DELETE' })
      setOwnJoinRequest(null)
      setJoinRequestError(null)
    } catch {
      // silent
    } finally {
      setIsCancellingRequest(false)
    }
  }

  // ─── Respond to incoming join request ────────────────────────────────────────

  async function respondToJoinRequest(requestId: string, action: 'approve' | 'reject') {
    setRespondingRequestId(requestId)
    try {
      const res = await fetch(
        `/api/coalitions/${coalitionId}/join-requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId))
        if (action === 'approve') {
          startTransition(() => router.refresh())
        }
      } else {
        alert(data.error ?? 'Failed to respond to request')
      }
    } catch {
      alert('Network error — please try again')
    } finally {
      setRespondingRequestId(null)
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

      {/* ── Non-member: Public coalition join ─────────────────────────── */}
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

      {/* ── Non-member: Private coalition — request to join ────────────── */}
      {currentUserId && currentUserRole === null && !pendingInviteId && !isPublic && (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-surface-400">
              Private Coalition
            </span>
          </div>

          {!ownJoinRequest && (
            <>
              <p className="font-mono text-xs text-surface-500 mb-3">
                Membership is invite-only or by approval. Send a join request to the coalition leadership.
              </p>
              {joinRequestError && (
                <p className="font-mono text-[11px] text-against-400 mb-2">
                  {joinRequestError}
                </p>
              )}
              <Button
                variant="gold"
                size="sm"
                disabled={isRequestingJoin || memberCount >= maxMembers}
                onClick={handleRequestJoin}
                className="w-full"
              >
                <Send className="h-3.5 w-3.5" />
                {isRequestingJoin
                  ? 'Sending…'
                  : memberCount >= maxMembers
                  ? 'Coalition full'
                  : 'Request to Join'}
              </Button>
            </>
          )}

          {ownJoinRequest?.status === 'pending' && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-gold shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-mono text-xs font-semibold text-gold">
                      Request pending
                    </p>
                    <p className="font-mono text-[10px] text-surface-500">
                      Sent {relativeTime(ownJoinRequest.created_at)} · awaiting leader approval
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelRequest}
                  disabled={isCancellingRequest}
                  className="font-mono text-[11px] text-surface-500 hover:text-against-400 transition-colors disabled:opacity-50 shrink-0"
                >
                  {isCancellingRequest ? 'Cancelling…' : 'Cancel'}
                </button>
              </motion.div>
            </AnimatePresence>
          )}

          {ownJoinRequest?.status === 'rejected' && (
            <p className="font-mono text-[11px] text-against-400">
              Your request was declined. You may contact the coalition leadership directly.
            </p>
          )}
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

      {/* ── Leader / Officer: join request queue ───────────────────────── */}
      {isLeaderOrOfficer && incomingRequests.length > 0 && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gold/10 transition-colors"
            onClick={() => setShowJoinRequests((v) => !v)}
          >
            <span className="flex items-center gap-2 font-mono text-xs font-semibold text-gold">
              <Inbox className="h-3.5 w-3.5" />
              Join Requests
              <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] text-gold">
                {incomingRequests.length}
              </span>
            </span>
            {showJoinRequests ? (
              <ChevronUp className="h-3.5 w-3.5 text-gold/60" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gold/60" />
            )}
          </button>

          <AnimatePresence>
            {showJoinRequests && (
              <motion.div
                key="join-requests-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-gold/20"
              >
                <div className="divide-y divide-surface-300/60">
                  {incomingRequests.map((req) => {
                    const p = req.requester
                    const isResponding = respondingRequestId === req.id
                    return (
                      <div
                        key={req.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <Avatar
                          src={p?.avatar_url}
                          fallback={p?.display_name ?? p?.username ?? '?'}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-medium text-white truncate">
                            {p?.display_name ?? p?.username ?? 'Unknown'}
                          </p>
                          <p className="font-mono text-[10px] text-surface-500">
                            @{p?.username ?? '…'} · {relativeTime(req.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => respondToJoinRequest(req.id, 'approve')}
                            disabled={isResponding}
                            aria-label={`Approve request from ${p?.username}`}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg',
                              'font-mono text-[11px] font-semibold',
                              'bg-for-500/15 text-for-400 border border-for-500/30',
                              'hover:bg-for-500/25 transition-colors',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => respondToJoinRequest(req.id, 'reject')}
                            disabled={isResponding}
                            aria-label={`Reject request from ${p?.username}`}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg',
                              'font-mono text-[11px] font-semibold',
                              'bg-against-500/10 text-against-400 border border-against-500/20',
                              'hover:bg-against-500/20 transition-colors',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          >
                            <X className="h-3 w-3" />
                            Decline
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
