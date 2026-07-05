'use client'

/**
 * /ama — Expert AMA Sessions
 *
 * Browse upcoming, live, and past Ask Me Anything sessions hosted by
 * civic experts. Sessions are category-specific — an economist answers
 * economics questions, a legal scholar answers law questions, etc.
 *
 * Each session is a moderated Q&A: community members submit and upvote
 * questions; the expert host answers in real time or asynchronously.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  BellOff,
  Calendar,
  ChevronRight,
  Clock,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Mic,
  Music2,
  Plus,
  Radio,
  Scale,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AMASession } from '@/app/api/ama/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Law: Scale,
  Education: GraduationCap,
  Health: Heart,
  Environment: Leaf,
  Culture: Music2,
  International: TrendingUp,
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-for-400',
  Politics: 'text-against-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Law: 'text-gold',
  Education: 'text-for-300',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Culture: 'text-purple',
  International: 'text-for-400',
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'live' | 'ended'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'upcoming', label: 'Upcoming', icon: Calendar },
  { id: 'live', label: 'Live Now', icon: Radio },
  { id: 'ended', label: 'Archive', icon: Clock },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  if (diff < 0) {
    const ago = Math.abs(diff)
    if (ago < 3600_000) return `${Math.floor(ago / 60_000)}m ago`
    if (ago < 86_400_000) return `${Math.floor(ago / 3_600_000)}h ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  if (diff < 3600_000) return `in ${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`
  if (diff < 7 * 86_400_000) {
    const days = Math.floor(diff / 86_400_000)
    return `in ${days} day${days === 1 ? '' : 's'}`
  }
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ session, onRsvp }: { session: AMASession; onRsvp: (id: string) => void }) {
  const [rsvped, setRsvped] = useState(session.user_rsvped)
  const [busy, setBusy] = useState(false)

  const CategoryIcon = session.category ? (CATEGORY_ICONS[session.category] ?? Mic) : Mic
  const catColor = session.category ? (CATEGORY_COLORS[session.category] ?? 'text-surface-400') : 'text-surface-400'

  async function handleRsvp(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/ama/${session.id}/rsvp`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { rsvped: boolean }
        setRsvped(data.rsvped)
        onRsvp(session.id)
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  const isLive = session.status === 'live'
  const isUpcoming = session.status === 'upcoming'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-2xl border transition-colors',
        isLive
          ? 'bg-for-950/40 border-for-600/40 hover:border-for-500/60'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400/60',
      )}
    >
      {/* Live pulse */}
      {isLive && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-for-500" />
          </span>
          <span className="text-[10px] font-mono font-semibold text-for-400 uppercase tracking-wider">Live</span>
        </div>
      )}

      <Link href={`/ama/${session.id}`} className="block p-5">
        {/* Category + time */}
        <div className="flex items-center gap-2 mb-3">
          <CategoryIcon className={cn('h-3.5 w-3.5 flex-shrink-0', catColor)} />
          {session.category && (
            <span className={cn('text-xs font-mono font-semibold', catColor)}>{session.category}</span>
          )}
          <span className="text-xs font-mono text-surface-600 ml-auto">
            {isLive ? 'Started ' : ''}
            {formatSessionTime(isLive ? (session.started_at ?? session.scheduled_at) : session.scheduled_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-mono text-base font-semibold text-white leading-snug mb-3 pr-16 group-hover:text-for-200 transition-colors">
          {session.title}
        </h3>

        {/* Description */}
        {session.description && (
          <p className="text-sm text-surface-500 leading-relaxed mb-3 line-clamp-2">
            {session.description}
          </p>
        )}

        {/* Host */}
        {session.host && (
          <div className="flex items-center gap-2 mb-4">
            <Avatar
              src={session.host.avatar_url}
              fallback={session.host.display_name || session.host.username}
              size="xs"
            />
            <span className="text-xs font-mono text-surface-400">
              {session.host.display_name || session.host.username}
            </span>
            <span className="text-[10px] font-mono text-surface-600">@{session.host.username}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {session.question_count} {session.question_count === 1 ? 'question' : 'questions'}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {session.answer_count} answered
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {session.rsvp_count} attending
          </span>
          <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-surface-400" />
        </div>
      </Link>

      {/* RSVP button — upcoming only */}
      {isUpcoming && (
        <div className="px-5 pb-4 pt-0">
          <button
            onClick={handleRsvp}
            disabled={busy}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
              'border transition-all disabled:opacity-50',
              rsvped
                ? 'bg-for-600/20 border-for-600/40 text-for-400 hover:bg-against-950/40 hover:border-against-500/40 hover:text-against-400'
                : 'bg-for-600 border-for-500 text-white hover:bg-for-500',
            )}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : rsvped ? (
              <BellOff className="h-3 w-3" />
            ) : (
              <Bell className="h-3 w-3" />
            )}
            {rsvped ? 'Cancel RSVP' : 'RSVP'}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SessionSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

// ─── Create session modal ─────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Law',
  'Education', 'Health', 'Environment', 'Culture', 'International',
]

function CreateSessionModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (session: AMASession) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/ama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category: category || undefined, scheduled_at: scheduledAt }),
      })
      const data = await res.json() as { session?: AMASession; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to create session')
      if (data.session) {
        onCreate(data.session)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // Min datetime: 5 minutes from now
  const minDatetime = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-bold text-white">Host an AMA</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-surface-400 mb-1.5">Session Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AMA on Carbon Tax Policy"
              maxLength={120}
              required
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-surface-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What topics will you cover? What's your expertise?"
              maxLength={600}
              rows={3}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 transition-colors resize-none"
            />
            <p className="text-right text-[11px] font-mono text-surface-600 mt-1">{description.length}/600</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-surface-400 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-for-500/60 transition-colors"
              >
                <option value="">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-surface-400 mb-1.5">Scheduled Time *</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minDatetime}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-for-500/60 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-mono text-against-400 bg-against-950/30 border border-against-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !scheduledAt}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AMAPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [sessions, setSessions] = useState<AMASession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [isAuth, setIsAuth] = useState(false)

  const loadSessions = useCallback(async (status: Tab) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ama?status=${status}&limit=20`)
      if (res.ok) {
        const data = await res.json() as { sessions: AMASession[] }
        setSessions(data.sessions ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions(tab)
  }, [tab, loadSessions])

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/me/setup')
        setIsAuth(res.ok)
      } catch {
        setIsAuth(false)
      }
    }
    void checkAuth()
  }, [])

  function handleRsvp(_id: string) {
    void loadSessions(tab)
  }

  const liveSessions = sessions.filter((s) => s.status === 'live')
  const mainSessions = tab === 'live' ? sessions : sessions.filter((s) => s.status !== 'live')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-mono text-2xl font-bold text-white mb-1 flex items-center gap-2">
                <Mic className="h-5 w-5 text-for-400" />
                Expert AMA Sessions
              </h1>
              <p className="text-sm text-surface-500 font-mono">
                Live Q&A with civic experts — submit and upvote questions
              </p>
            </div>
            {isAuth && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href="/ama/highlights"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-colors"
                >
                  Insights
                </Link>
                <Link
                  href="/ama/schedule"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-colors"
                >
                  Schedule
                </Link>
                <Link
                  href="/ama/request"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-colors"
                >
                  Requests
                </Link>
                <Link
                  href="/ama/my"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-colors"
                >
                  My AMAs
                </Link>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Host AMA
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live sessions banner */}
        {tab !== 'live' && liveSessions.length > 0 && (
          <div className="mb-5 p-3 rounded-xl bg-for-950/40 border border-for-600/40 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-for-500" />
            </span>
            <span className="text-sm font-mono text-for-300 font-semibold">
              {liveSessions.length} session{liveSessions.length > 1 ? 's' : ''} live right now
            </span>
            <button
              onClick={() => setTab('live')}
              className="ml-auto flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-200 transition-colors"
            >
              Join <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-surface-100 border border-surface-300 rounded-xl p-1">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-semibold flex-1 justify-center transition-all',
                  tab === t.id
                    ? t.id === 'live'
                      ? 'bg-for-600 text-white shadow-sm'
                      : 'bg-surface-200 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                {t.id === 'live' && tab !== 'live' && liveSessions.length > 0 && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-for-500" />
                  </span>
                )}
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Sessions list */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {[0, 1, 2].map((i) => <SessionSkeleton key={i} />)}
            </motion.div>
          ) : mainSessions.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={tab === 'live' ? Radio : tab === 'upcoming' ? Calendar : Clock}
                iconColor={tab === 'live' ? 'text-for-400' : 'text-surface-500'}
                iconBg={tab === 'live' ? 'bg-for-950/40' : 'bg-surface-200'}
                iconBorder={tab === 'live' ? 'border-for-700/40' : 'border-surface-300'}
                title={
                  tab === 'live' ? 'No live sessions right now'
                    : tab === 'upcoming' ? 'No upcoming sessions'
                    : 'No past sessions yet'
                }
                description={
                  tab === 'live' ? 'Check back soon — sessions go live at their scheduled time.'
                    : tab === 'upcoming' ? isAuth ? 'Be the first expert to host a session.' : 'No sessions scheduled yet — check back soon.'
                    : 'Completed sessions will appear here with full transcripts.'
                }
                action={
                  tab === 'upcoming' && isAuth
                    ? { label: 'Host an AMA', onClick: () => setShowCreate(true), icon: Plus }
                    : undefined
                }
              />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {mainSessions.map((session) => (
                <SessionCard key={session.id} session={session} onRsvp={handleRsvp} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info callout */}
        <div className="mt-8 p-4 rounded-xl bg-surface-100 border border-surface-300 text-sm font-mono text-surface-500 space-y-1.5">
          <p className="font-semibold text-surface-400">How AMAs work</p>
          <ul className="space-y-1 text-xs list-none">
            <li className="flex items-start gap-2"><Zap className="h-3 w-3 text-gold mt-0.5 flex-shrink-0" /> Any member can submit questions before or during a session</li>
            <li className="flex items-start gap-2"><ThumbsUp className="h-3 w-3 text-for-400 mt-0.5 flex-shrink-0" /> Upvote the questions you most want answered</li>
            <li className="flex items-start gap-2"><Mic className="h-3 w-3 text-purple mt-0.5 flex-shrink-0" /> The expert host answers questions, prioritising by upvotes</li>
            <li className="flex items-start gap-2"><Bell className="h-3 w-3 text-for-300 mt-0.5 flex-shrink-0" /> RSVP to upcoming sessions to get notified when they go live</li>
          </ul>
        </div>
      </main>

      <BottomNav />

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateSessionModal
            onClose={() => setShowCreate(false)}
            onCreate={(session) => {
              setSessions((prev) => [session as AMASession, ...prev])
              router.push(`/ama/${session.id}`)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
