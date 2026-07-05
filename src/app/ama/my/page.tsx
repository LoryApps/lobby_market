'use client'

/**
 * /ama/my — My AMA Sessions
 *
 * Shows all AMA sessions the current user has hosted or been RSVP'd to.
 * Hosts can start, end, or cancel their upcoming sessions from this page.
 *
 * Distinct from:
 *   /ama     — public browser of all sessions (all users)
 *   /ama/[id] — individual session Q&A view
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Mic,
  Play,
  Plus,
  Square,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { AMASession } from '@/app/api/ama/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPip({ status }: { status: AMASession['status'] }) {
  if (status === 'live') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-for-500" />
        </span>
        <span className="text-[11px] font-mono font-semibold text-for-400 uppercase tracking-wider">Live</span>
      </div>
    )
  }
  if (status === 'upcoming') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
        <Calendar className="h-3 w-3" />
        Upcoming
      </span>
    )
  }
  if (status === 'ended') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500 uppercase tracking-wider">
        <CheckCircle2 className="h-3 w-3 text-emerald" />
        Ended
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-mono text-against-500 uppercase tracking-wider">
      <X className="h-3 w-3" />
      Cancelled
    </span>
  )
}

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  isOwn,
  onStatusChange,
}: {
  session: AMASession
  isOwn: boolean
  onStatusChange: (id: string, status: 'live' | 'ended' | 'cancelled') => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isUpcoming = session.status === 'upcoming'
  const isLive = session.status === 'live'
  const isActive = isUpcoming || isLive

  async function changeStatus(newStatus: 'live' | 'ended' | 'cancelled') {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/ama/${session.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed')
      onStatusChange(session.id, newStatus)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        isLive
          ? 'bg-for-950/30 border-for-600/40'
          : session.status === 'cancelled'
          ? 'bg-surface-50 border-surface-200 opacity-60'
          : 'bg-surface-100 border-surface-300',
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusPip status={session.status} />
            {session.category && (
              <span className="text-[10px] font-mono text-surface-500 bg-surface-200 border border-surface-300 px-1.5 py-0.5 rounded-full">
                {session.category}
              </span>
            )}
          </div>
          <h3 className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2">
            {session.title}
          </h3>
          {session.description && (
            <p className="text-xs text-surface-500 mt-1 line-clamp-2">{session.description}</p>
          )}
        </div>

        <Link
          href={`/ama/${session.id}`}
          className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
        >
          View
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {session.status === 'ended' && session.ended_at
            ? `Ended ${formatDateTime(session.ended_at)}`
            : formatDateTime(session.scheduled_at)}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {session.question_count}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {session.rsvp_count}
        </span>
        {session.answer_count > 0 && (
          <span className="flex items-center gap-1 text-emerald">
            <CheckCircle2 className="h-3 w-3" />
            {session.answer_count} answered
          </span>
        )}
      </div>

      {/* Host controls */}
      {isOwn && isActive && (
        <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
          {isUpcoming && (
            <button
              onClick={() => void changeStatus('live')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Start
            </button>
          )}
          {isLive && (
            <button
              onClick={() => void changeStatus('ended')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-xs font-mono font-semibold border border-surface-300 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
              End
            </button>
          )}
          {isUpcoming && (
            <button
              onClick={() => {
                if (confirm('Cancel this session?')) void changeStatus('cancelled')
              }}
              disabled={busy}
              className="flex items-center gap-1 text-xs font-mono text-against-400 hover:text-against-300 transition-colors disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          )}
          {err && <p className="ml-2 text-xs font-mono text-against-400">{err}</p>}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'hosting' | 'rsvped'

export default function MyAMAPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('hosting')
  const [hosted, setHosted] = useState<AMASession[]>([])
  const [rsvped, setRsvped] = useState<AMASession[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Load user + sessions
  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    if (profile) setUserName(profile.display_name ?? profile.username)

    // Fetch all sessions in parallel
    const [hostedRes, rsvpedRes] = await Promise.all([
      fetch('/api/ama?limit=50&status=all'),
      fetch('/api/ama?limit=50&status=all'),
    ])

    if (hostedRes.ok) {
      const data = await hostedRes.json() as { sessions: AMASession[] }
      setHosted(data.sessions.filter((s) => s.host_id === user.id))
    }
    if (rsvpedRes.ok) {
      const data = await rsvpedRes.json() as { sessions: AMASession[] }
      setRsvped(data.sessions.filter((s) => s.user_rsvped && s.host_id !== user.id))
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  function handleStatusChange(id: string, newStatus: 'live' | 'ended' | 'cancelled') {
    setHosted((prev) =>
      prev.map((s) => s.id === id ? { ...s, status: newStatus } : s)
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof Mic; count: number }[] = [
    { id: 'hosting', label: 'Hosting', icon: Mic, count: hosted.length },
    { id: 'rsvped', label: "RSVP'd", icon: Bell, count: rsvped.length },
  ]

  const displaySessions = tab === 'hosting' ? hosted : rsvped

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/ama"
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            AMA Sessions
          </Link>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">My AMAs</h1>
            <p className="text-sm text-surface-500 mt-1">
              {userName ? `Sessions you host or attend` : 'Your AMA sessions'}
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
          >
            <Plus className="h-4 w-4" />
            Host AMA
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-100 border border-surface-300 rounded-xl mb-6">
          {tabs.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono font-medium transition-colors',
                  isActive
                    ? 'bg-surface-200 text-white'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count > 0 && (
                  <span className={cn(
                    'text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    isActive ? 'bg-for-600/30 text-for-400' : 'bg-surface-200 text-surface-500',
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Session list */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : displaySessions.length === 0 ? (
          <EmptyState
            icon={tab === 'hosting' ? Mic : Bell}
            title={tab === 'hosting' ? 'No hosted sessions yet' : "No RSVPs yet"}
            description={
              tab === 'hosting'
                ? 'Host your first AMA to share your expertise with the community.'
                : 'RSVP to upcoming AMA sessions to see them here.'
            }
            action={
              tab === 'hosting'
                ? { label: 'Host an AMA', href: '/ama' }
                : { label: 'Browse sessions', href: '/ama' }
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {displaySessions
                .sort((a, b) => {
                  const order = { live: 0, upcoming: 1, ended: 2, cancelled: 3 }
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4)
                })
                .map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isOwn={session.host_id === userId}
                    onStatusChange={handleStatusChange}
                  />
                ))}
            </div>
          </AnimatePresence>
        )}

        {/* Quick stats for hosting tab */}
        {tab === 'hosting' && !loading && hosted.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              {
                label: 'Sessions',
                value: hosted.filter((s) => s.status !== 'cancelled').length,
                icon: Mic,
                color: 'text-for-400',
              },
              {
                label: 'Questions',
                value: hosted.reduce((acc, s) => acc + (s.question_count ?? 0), 0),
                icon: MessageSquare,
                color: 'text-purple',
              },
              {
                label: 'Attendees',
                value: hosted.reduce((acc, s) => acc + (s.rsvp_count ?? 0), 0),
                icon: Users,
                color: 'text-gold',
              },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
                >
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', stat.color)} />
                  <p className="font-mono text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-[11px] font-mono text-surface-500">{stat.label}</p>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Create session sheet — reuse the pattern from /ama, link there */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="w-full max-w-md bg-surface-100 border border-surface-300 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-lg font-bold text-white">Host an AMA</h2>
              <button onClick={() => setShowCreate(false)} className="text-surface-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-surface-500 mb-4">
              Schedule a new Ask Me Anything session. Use the full creation form for all options.
            </p>
            <div className="flex gap-2">
              <Link
                href="/ama"
                onClick={() => setShowCreate(false)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Go to AMA Hub
              </Link>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 text-sm font-mono transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
