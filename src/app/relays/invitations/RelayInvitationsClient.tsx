'use client'

/**
 * /relays/invitations — Relay Chain Invitations Dashboard
 *
 * Shows relay invitations the user has RECEIVED (accept / decline)
 * and invitations they have SENT (with their current status).
 *
 * Distinct from:
 *   /notifications  — all notification types mixed together
 *   /relays/mine    — relay chains you participate in
 *   /relays/[id]    — single relay chain view
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  GitMerge,
  Loader2,
  MailOpen,
  MessageSquare,
  RefreshCw,
  Send,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RelayInvitation {
  id: string
  relay_id: string
  inviter_id: string
  invitee_id: string
  message: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
  responded_at: string | null
  expires_at: string
  relay: {
    id: string
    is_for: boolean
    status: string
    leg_count: number
    max_legs: number
    topic: {
      id: string
      statement: string
      category: string | null
    } | null
  } | null
  inviter: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  invitee: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

interface InvitationsResponse {
  invitations: RelayInvitation[]
}

type Tab = 'received' | 'sent'
type StatusFilter = 'all' | 'pending' | 'accepted' | 'declined' | 'expired'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'expiring soon'
  if (h < 24) return `expires in ${h}h`
  return `expires in ${d}d`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RelayInvitation['status'] }) {
  const config = {
    pending:  { label: 'Pending',  cls: 'text-gold border-gold/30 bg-gold/10',              Icon: Clock },
    accepted: { label: 'Accepted', cls: 'text-emerald border-emerald/30 bg-emerald/10',     Icon: CheckCircle2 },
    declined: { label: 'Declined', cls: 'text-surface-500 border-surface-400/30 bg-surface-300/10', Icon: XCircle },
    expired:  { label: 'Expired',  cls: 'text-surface-500 border-surface-400/30 bg-surface-300/10', Icon: Clock },
  }
  const { label, cls, Icon } = config[status]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', cls)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

// ─── Relay side pill ──────────────────────────────────────────────────────────

function SidePill({ isFor }: { isFor: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
      isFor
        ? 'text-for-400 border-for-500/30 bg-for-500/10'
        : 'text-against-400 border-against-500/30 bg-against-500/10'
    )}>
      {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
      {isFor ? 'FOR' : 'AGAINST'}
    </span>
  )
}

// ─── Leg progress dots ────────────────────────────────────────────────────────

function LegDots({ filled, total, isFor }: { filled: number; total: number; isFor: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${filled} of ${total} legs filled`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < filled
              ? isFor ? 'bg-for-500' : 'bg-against-500'
              : 'bg-surface-500'
          )}
        />
      ))}
    </div>
  )
}

// ─── Received invitation card ─────────────────────────────────────────────────

function ReceivedCard({
  invite,
  onRespond,
}: {
  invite: RelayInvitation
  onRespond: (id: string, action: 'accept' | 'decline') => Promise<void>
}) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const relay = invite.relay
  const inviter = invite.inviter

  async function respond(action: 'accept' | 'decline') {
    setBusy(action)
    await onRespond(invite.id, action)
    setBusy(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        invite.status === 'pending'
          ? 'border-purple/30'
          : 'border-surface-300/60'
      )}
    >
      {/* Header: inviter + relay info */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Link href={`/profile/${inviter?.username}`} className="flex-shrink-0">
            <Avatar
              src={inviter?.avatar_url}
              fallback={inviter?.display_name || inviter?.username || '?'}
              size="sm"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/profile/${inviter?.username}`}
                className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors"
              >
                {inviter?.display_name || inviter?.username}
              </Link>
              <span className="text-xs font-mono text-surface-500">invited you to join their relay</span>
            </div>
            <p className="text-[11px] font-mono text-surface-600 mt-0.5">
              {relativeTime(invite.created_at)}
              {invite.status === 'pending' && (
                <span className="ml-2 text-gold">· {timeUntil(invite.expires_at)}</span>
              )}
            </p>
          </div>
          <StatusBadge status={invite.status} />
        </div>

        {/* Relay info */}
        {relay && (
          <Link
            href={`/relays/${relay.id}`}
            className="block rounded-xl border border-surface-300/60 bg-surface-200/60 p-3 hover:border-surface-400/80 hover:bg-surface-200 transition-colors group mb-3"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <GitMerge className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              <SidePill isFor={relay.is_for} />
              {relay.topic?.category && (
                <span className="text-[10px] font-mono text-surface-500">{relay.topic.category}</span>
              )}
            </div>
            <p className="text-xs font-mono text-white leading-relaxed group-hover:text-for-300 transition-colors line-clamp-2">
              {relay.topic?.statement ?? 'Untitled topic'}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <LegDots filled={relay.leg_count} total={relay.max_legs} isFor={relay.is_for} />
              <span className="text-[10px] font-mono text-surface-500">
                {relay.leg_count}/{relay.max_legs} legs
              </span>
              <span className={cn(
                'text-[10px] font-mono',
                relay.status === 'open' ? 'text-emerald' : relay.status === 'in_progress' ? 'text-gold' : 'text-surface-500'
              )}>
                {relay.status === 'open' ? 'Open' : relay.status === 'in_progress' ? 'In progress' : relay.status}
              </span>
            </div>
          </Link>
        )}

        {/* Personal message */}
        {invite.message && (
          <div className="flex items-start gap-2 rounded-lg bg-surface-200/60 border border-surface-300/40 px-3 py-2 mb-3">
            <MessageSquare className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-400 leading-relaxed italic">
              &ldquo;{invite.message}&rdquo;
            </p>
          </div>
        )}

        {/* Action buttons (only for pending) */}
        {invite.status === 'pending' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => respond('accept')}
              disabled={!!busy}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl',
                'bg-for-600 hover:bg-for-500 border border-for-500/50 text-white',
                'text-xs font-mono font-semibold transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
              )}
              aria-label="Accept relay invitation"
            >
              {busy === 'accept' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Accept & Join Relay
            </button>
            <button
              onClick={() => respond('decline')}
              disabled={!!busy}
              className={cn(
                'flex items-center justify-center gap-2 py-2 px-3 rounded-xl',
                'bg-surface-200 hover:bg-surface-300 border border-surface-300/60 text-surface-400 hover:text-white',
                'text-xs font-mono font-semibold transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-500/50'
              )}
              aria-label="Decline relay invitation"
            >
              {busy === 'decline' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Decline
            </button>
          </div>
        )}

        {/* Accepted state — link to relay */}
        {invite.status === 'accepted' && relay && (
          <Link
            href={`/relays/${relay.id}`}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-4 rounded-xl',
              'bg-emerald/10 hover:bg-emerald/20 border border-emerald/30 text-emerald',
              'text-xs font-mono font-semibold transition-colors'
            )}
          >
            <GitMerge className="h-3.5 w-3.5" />
            View Relay Chain
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Sent invitation card ─────────────────────────────────────────────────────

function SentCard({ invite }: { invite: RelayInvitation }) {
  const relay = invite.relay
  const invitee = invite.invitee

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-surface-300/60 bg-surface-100 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Link href={`/profile/${invitee?.username}`} className="flex-shrink-0">
            <Avatar
              src={invitee?.avatar_url}
              fallback={invitee?.display_name || invitee?.username || '?'}
              size="sm"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-surface-500">You invited</span>
              <Link
                href={`/profile/${invitee?.username}`}
                className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors"
              >
                {invitee?.display_name || invitee?.username}
              </Link>
            </div>
            <p className="text-[11px] font-mono text-surface-600 mt-0.5">
              {relativeTime(invite.created_at)}
              {invite.status === 'pending' && (
                <span className="ml-2 text-gold">· {timeUntil(invite.expires_at)}</span>
              )}
              {invite.responded_at && (
                <span className="ml-2 text-surface-600">· responded {relativeTime(invite.responded_at)}</span>
              )}
            </p>
          </div>
          <StatusBadge status={invite.status} />
        </div>

        {/* Relay info */}
        {relay && (
          <Link
            href={`/relays/${relay.id}`}
            className="block rounded-xl border border-surface-300/60 bg-surface-200/60 p-3 hover:border-surface-400/80 hover:bg-surface-200 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <GitMerge className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              <SidePill isFor={relay.is_for} />
              {relay.topic?.category && (
                <span className="text-[10px] font-mono text-surface-500">{relay.topic.category}</span>
              )}
            </div>
            <p className="text-xs font-mono text-white leading-relaxed group-hover:text-for-300 transition-colors line-clamp-2">
              {relay.topic?.statement ?? 'Untitled topic'}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <LegDots filled={relay.leg_count} total={relay.max_legs} isFor={relay.is_for} />
              <span className="text-[10px] font-mono text-surface-500">
                {relay.leg_count}/{relay.max_legs} legs
              </span>
            </div>
          </Link>
        )}

        {/* Personal message */}
        {invite.message && (
          <div className="flex items-start gap-2 rounded-lg bg-surface-200/60 border border-surface-300/40 px-3 py-2 mt-3">
            <MessageSquare className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-400 leading-relaxed italic">
              &ldquo;{invite.message}&rdquo;
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function InvitationSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function RelayInvitationsClient() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('received')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [invitations, setInvitations] = useState<RelayInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ direction: tab })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/relay-invitations?${params}`)
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        throw new Error(`HTTP ${res.status}`)
      }
      const data: InvitationsResponse = await res.json()
      setInvitations(data.invitations ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }, [tab, statusFilter, router])

  useEffect(() => { load() }, [load])

  const handleRespond = useCallback(async (inviteId: string, action: 'accept' | 'decline') => {
    setRespondingTo((s) => new Set([...s, inviteId]))
    try {
      const res = await fetch(`/api/relay-invitations/${inviteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      // Optimistically update the card status
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === inviteId
            ? { ...inv, status: action === 'accept' ? 'accepted' : 'declined', responded_at: new Date().toISOString() }
            : inv
        )
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to respond')
    }
  }, [])

  const pendingCount = invitations.filter(
    (inv) => tab === 'received' && inv.status === 'pending'
  ).length

  const filtered = statusFilter === 'all'
    ? invitations
    : invitations.filter((inv) => inv.status === statusFilter)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <UserPlus className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              Relay Invitations
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Manage invitations to join argument relay chains
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh invitations"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300/60 mb-4">
          {(['received', 'sent'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono font-semibold transition-colors',
                tab === t
                  ? 'bg-surface-100 text-white shadow-sm border border-surface-300/60'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              {t === 'received' ? (
                <>
                  <MailOpen className="h-3.5 w-3.5" />
                  Received
                  {pendingCount > 0 && tab !== 'received' && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-purple text-white text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Sent
                </>
              )}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          {(['all', 'pending', 'accepted', 'declined', 'expired'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors',
                statusFilter === s
                  ? 'bg-for-600/20 border-for-500/40 text-for-400'
                  : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[0, 1, 2].map((i) => <InvitationSkeleton key={i} />)}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300/60 text-sm font-mono text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={tab === 'received' ? MailOpen : Send}
                title={
                  statusFilter !== 'all'
                    ? `No ${statusFilter} invitations`
                    : tab === 'received'
                    ? 'No invitations received'
                    : 'No invitations sent'
                }
                description={
                  tab === 'received'
                    ? 'When relay participants invite you to add a leg to their chain, invitations will appear here.'
                    : 'When you invite someone to join a relay chain, your sent invitations will appear here.'
                }
                action={
                  tab === 'received'
                    ? { label: 'Browse relay chains', href: '/relays' }
                    : { label: 'Start a relay chain', href: '/relays/create' }
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <AnimatePresence>
                {filtered.map((invite) =>
                  tab === 'received' ? (
                    <ReceivedCard
                      key={invite.id}
                      invite={invite}
                      onRespond={handleRespond}
                    />
                  ) : (
                    <SentCard key={invite.id} invite={invite} />
                  )
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer link */}
        {!loading && !error && filtered.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/relays"
              className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <GitMerge className="h-3.5 w-3.5" />
              Browse all relay chains
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
