'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  Send,
  Swords,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ChallengesResponse, ChallengeEntry } from '@/app/api/challenges/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  return 'Expires soon'
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ChallengeEntry['status'] }) {
  const config: Record<ChallengeEntry['status'], { label: string; className: string }> = {
    pending:   { label: 'Pending',   className: 'text-gold border-gold/30 bg-gold/10' },
    accepted:  { label: 'Accepted',  className: 'text-emerald border-emerald/30 bg-emerald/10' },
    declined:  { label: 'Declined',  className: 'text-against-400 border-against-500/30 bg-against-500/10' },
    cancelled: { label: 'Cancelled', className: 'text-surface-500 border-surface-400/30 bg-surface-300/20' },
    expired:   { label: 'Expired',   className: 'text-surface-500 border-surface-400/30 bg-surface-300/20' },
  }
  const { label, className } = config[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', className)}>
      {label}
    </span>
  )
}

// ─── Vote bar mini ─────────────────────────────────────────────────────────────

function MiniVoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-for-400 w-10 text-right">{forPct}%</span>
      <div className="flex flex-1 h-1.5 rounded-full overflow-hidden bg-surface-400">
        <div className="bg-for-500 h-full" style={{ width: `${forPct}%` }} />
        <div className="bg-against-500 h-full" style={{ width: `${againstPct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-10">{againstPct}%</span>
    </div>
  )
}

// ─── Challenge card ────────────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  viewerId,
  onRespond,
  responding,
}: {
  challenge: ChallengeEntry
  viewerId: string
  onRespond: (id: string, action: 'accept' | 'decline' | 'cancel') => void
  responding: string | null
}) {
  const isReceived = challenge.challenged_id === viewerId
  const counterpart = isReceived ? challenge.challenger : challenge.challenged
  const topic = challenge.topic
  const isPending = challenge.status === 'pending'
  const isBusy = responding === challenge.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        isPending
          ? 'bg-surface-100 border-surface-300 hover:border-surface-400'
          : 'bg-surface-100/60 border-surface-300/50'
      )}
    >
      {/* Header: user + status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href={`/profile/${counterpart.username}`}>
            <Avatar
              src={counterpart.avatar_url}
              fallback={counterpart.display_name || counterpart.username}
              size="sm"
            />
          </Link>
          <div className="min-w-0">
            <Link
              href={`/profile/${counterpart.username}`}
              className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors truncate block"
            >
              {counterpart.display_name || counterpart.username}
            </Link>
            <p className="text-[10px] font-mono text-surface-500">
              {isReceived ? 'challenged you' : 'you challenged'} · {relativeTime(challenge.created_at)}
            </p>
          </div>
        </div>
        <StatusPill status={challenge.status} />
      </div>

      {/* Topic */}
      <Link
        href={`/topic/${topic.id}`}
        className="block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400 hover:bg-surface-200/70 p-3 space-y-2 transition-colors"
      >
        <div className="flex items-start gap-2">
          <Swords className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-mono text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
        </div>
        {topic.total_votes > 0 && (
          <MiniVoteBar bluePct={topic.blue_pct} />
        )}
        <div className="flex items-center gap-2">
          <Badge variant={
            topic.status === 'law' ? 'law' :
            topic.status === 'active' || topic.status === 'voting' ? 'active' :
            topic.status === 'failed' ? 'failed' : 'proposed'
          } size="xs">
            {topic.status === 'law' ? 'LAW' :
             topic.status === 'voting' ? 'Voting' :
             topic.status === 'active' ? 'Active' :
             topic.status === 'proposed' ? 'Proposed' : 'Failed'}
          </Badge>
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
          )}
          <span className="text-[10px] font-mono text-surface-500 ml-auto flex items-center gap-1">
            <ArrowRight className="h-2.5 w-2.5" />
            View debate
          </span>
        </div>
      </Link>

      {/* Optional message */}
      {challenge.message && (
        <div className="rounded-lg border border-surface-300/40 bg-surface-200/30 px-3 py-2">
          <p className="text-xs font-mono text-surface-400 italic leading-relaxed">
            &ldquo;{challenge.message}&rdquo;
          </p>
        </div>
      )}

      {/* Expiry notice for pending */}
      {isPending && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500">
          <Clock className="h-3 w-3 flex-shrink-0" />
          {timeLeft(challenge.expires_at)}
        </div>
      )}

      {/* Accepted — link to debate */}
      {challenge.status === 'accepted' && challenge.debate_id && (
        <Link
          href={`/debate/${challenge.debate_id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald/10 border border-emerald/30 text-emerald text-sm font-mono font-semibold hover:bg-emerald/20 transition-colors"
        >
          <Swords className="h-4 w-4" />
          Enter the debate
        </Link>
      )}

      {/* Action buttons */}
      {isPending && isReceived && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onRespond(challenge.id, 'accept')}
            disabled={isBusy}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
              'bg-for-600 hover:bg-for-500 text-white border border-for-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Accept
          </button>
          <button
            onClick={() => onRespond(challenge.id, 'decline')}
            disabled={isBusy}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
              'bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white border border-surface-300 hover:border-surface-400',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Decline
          </button>
        </div>
      )}

      {isPending && !isReceived && (
        <button
          onClick={() => onRespond(challenge.id, 'cancel')}
          disabled={isBusy}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-mono font-semibold transition-all',
            'bg-surface-200/60 hover:bg-surface-300 text-surface-500 hover:text-against-400',
            'border border-surface-300/60 hover:border-against-500/30',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Cancel challenge
        </button>
      )}
    </motion.div>
  )
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function ChallengeCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="rounded-xl border border-surface-300/60 p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-2 w-full rounded-full mt-1" />
      </div>
    </div>
  )
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

type Tab = 'received' | 'sent'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const router = useRouter()
  const [data, setData] = useState<ChallengesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('received')
  const [responding, setResponding] = useState<string | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/challenges', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.ok) {
        const json = await res.json()
        setData(json as ChallengesResponse)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [router])

  // Load viewer ID from local session
  useEffect(() => {
    async function getViewer() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setViewerId(user.id)
    }
    getViewer()
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRespond = useCallback(async (id: string, action: 'accept' | 'decline' | 'cancel') => {
    setResponding(id)
    try {
      const res = await fetch(`/api/challenges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        await load()
      }
    } catch {
      // best-effort
    } finally {
      setResponding(null)
    }
  }, [load])

  const displayed = data ? (tab === 'received' ? data.received : data.sent) : []
  const pendingCount = data?.pending_received ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 relative flex-shrink-0">
              <Swords className="h-5 w-5 text-against-400" />
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-against-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Challenges</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                1-on-1 debate duels with other citizens
              </p>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
            aria-label="Refresh challenges"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-surface-200 border border-surface-300">
          {([
            { id: 'received' as Tab, label: 'Received', icon: Inbox, count: pendingCount },
            { id: 'sent' as Tab, label: 'Sent', icon: Send, count: 0 },
          ] as const).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono font-medium transition-all',
                tab === id
                  ? 'bg-surface-100 text-white shadow-sm border border-surface-300'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count > 0 && (
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-against-500 text-white text-[9px] font-bold">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <ChallengeCardSkeleton key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={Swords}
            iconColor="text-surface-500"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title={tab === 'received' ? 'No challenges received' : 'No challenges sent'}
            description={
              tab === 'received'
                ? 'When someone challenges you to a debate, it will appear here.'
                : 'Visit a user\'s profile and hit "Challenge" to issue a debate duel.'
            }
            actions={[
              {
                label: 'Browse profiles',
                href: '/leaderboard',
                icon: Swords,
              },
            ]}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {viewerId && displayed.map((c) => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  viewerId={viewerId}
                  onRespond={handleRespond}
                  responding={responding}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Status legend ────────────────────────────────────────────── */}
        {!loading && displayed.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-surface-300">
            <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Legend:</span>
            {([
              { status: 'pending' as const, icon: Clock },
              { status: 'accepted' as const, icon: CheckCircle2 },
              { status: 'declined' as const, icon: XCircle },
              { status: 'expired' as const, icon: Clock },
            ]).map(({ status, icon: Icon }) => (
              <div key={status} className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-surface-500" />
                <StatusPill status={status} />
              </div>
            ))}
          </div>
        )}

        {/* ── How it works ────────────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-surface-300/60 bg-surface-100/50 p-5 space-y-3">
          <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
            How challenges work
          </p>
          <div className="space-y-2.5">
            {[
              { icon: ThumbsUp, text: 'Visit any user\'s profile and tap "Challenge" to issue a debate duel on any topic.' },
              { icon: Swords, text: 'The challenged user has 7 days to accept or decline.' },
              { icon: CheckCircle2, text: 'Accepted challenges create a new debate — both participants get to argue their side live.' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-2.5 w-2.5 text-surface-500" />
                </div>
                <p className="text-xs font-mono text-surface-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
