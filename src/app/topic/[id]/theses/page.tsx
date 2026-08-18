'use client'

/**
 * /topic/[id]/theses — Civic Theses for a Specific Topic
 *
 * Shows all public civic theses (predictions) that users have staked on
 * this specific topic. Users can see who believes what about the topic's
 * outcome and stake their own thesis here.
 *
 * Distinct from:
 *   /thesis              — global thesis board (all topics)
 *   /topic/[id]/predictions — formal binary prediction market bets
 *   /analytics/thesis    — personal thesis analytics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  CircleDot,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Thesis, ThesisListResponse, ThesisCategory } from '@/lib/types/thesis'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'

// ─── Category / status config ─────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics:   'text-gold border-gold/40 bg-gold/10',
  politics:    'text-for-400 border-for-500/40 bg-for-500/10',
  technology:  'text-purple border-purple/40 bg-purple/10',
  science:     'text-emerald border-emerald/40 bg-emerald/10',
  ethics:      'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy:  'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture:     'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health:      'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education:   'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

const STATUS_CONFIG = {
  active: {
    label: 'Active', icon: CircleDot,
    color: 'text-for-400', bg: 'bg-for-500/10 border-for-500/30',
  },
  vindicated: {
    label: 'Vindicated', icon: Trophy,
    color: 'text-gold', bg: 'bg-gold/10 border-gold/30',
  },
  refuted: {
    label: 'Refuted', icon: X,
    color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30',
  },
  expired: {
    label: 'Expired', icon: Clock,
    color: 'text-surface-500', bg: 'bg-surface-200 border-surface-300',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  const h = Math.floor(m / 60)
  const days = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ThesisSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-7 flex-1 rounded-lg" />
        <Skeleton className="h-7 flex-1 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Vote Buttons ─────────────────────────────────────────────────────────────

function VoteButtons({
  thesis,
  isOwner,
  onVoted,
}: {
  thesis: Thesis
  isOwner: boolean
  onVoted: (id: string, agree: boolean | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const cur = thesis.viewer_vote
  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50

  async function vote(agree: boolean) {
    if (isOwner || busy) return
    setBusy(true)
    try {
      if (cur === agree) {
        await fetch(`/api/thesis/${thesis.id}/vote`, { method: 'DELETE' })
        onVoted(thesis.id, null)
      } else {
        await fetch(`/api/thesis/${thesis.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agree }),
        })
        onVoted(thesis.id, agree)
      }
    } catch { /* best-effort */ }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-3 space-y-2">
      {total > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-for-400 w-8 text-right">{agreePct}%</span>
          <div className="flex-1 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
            <div className="h-full rounded-full bg-for-500 transition-all duration-500" style={{ width: `${agreePct}%` }} />
          </div>
          <span className="text-[11px] font-mono text-against-400 w-8">{100 - agreePct}%</span>
        </div>
      )}

      {!isOwner && thesis.status === 'active' && (
        <div className="flex gap-2">
          <button
            onClick={() => vote(true)} disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
              cur === true
                ? 'bg-for-500/25 border-for-500/50 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-500/40 hover:text-for-400'
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            Agree{thesis.agree_count > 0 ? ` · ${thesis.agree_count}` : ''}
          </button>
          <button
            onClick={() => vote(false)} disabled={busy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
              cur === false
                ? 'bg-against-500/25 border-against-500/50 text-against-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-400'
            )}
          >
            <ThumbsDown className="h-3 w-3" />
            Disagree{thesis.disagree_count > 0 ? ` · ${thesis.disagree_count}` : ''}
          </button>
        </div>
      )}

      {(isOwner || thesis.status !== 'active') && total > 0 && (
        <div className="flex gap-4 text-[11px] font-mono">
          <span className="text-for-400"><ThumbsUp className="h-3 w-3 inline mr-1" />{thesis.agree_count} agree</span>
          <span className="text-against-400"><ThumbsDown className="h-3 w-3 inline mr-1" />{thesis.disagree_count} disagree</span>
        </div>
      )}
    </div>
  )
}

// ─── Thesis Card ──────────────────────────────────────────────────────────────

function ThesisCard({
  thesis,
  currentUserId,
  onVoted,
}: {
  thesis: Thesis
  currentUserId: string | null
  onVoted: (id: string, agree: boolean | null) => void
}) {
  const isOwner = thesis.user_id === currentUserId
  const status = STATUS_CONFIG[thesis.status] ?? STATUS_CONFIG.active
  const StatusIcon = status.icon
  const catColor = CAT_COLORS[thesis.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'

  const dl = thesis.resolution_date ? daysLeft(thesis.resolution_date) : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-5 transition-colors"
    >
      {/* Top row — author + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {thesis.author && (
            <Link href={`/profile/${thesis.author.username}`} className="flex-shrink-0">
              <Avatar
                src={thesis.author.avatar_url}
                fallback={thesis.author.display_name || thesis.author.username}
                size="sm"
              />
            </Link>
          )}
          <div className="min-w-0">
            {thesis.author && (
              <Link
                href={`/profile/${thesis.author.username}`}
                className="text-xs font-mono font-semibold text-white hover:text-surface-300 transition-colors truncate block"
              >
                {thesis.author.display_name || `@${thesis.author.username}`}
              </Link>
            )}
            <p className="text-[10px] font-mono text-surface-500">{relTime(thesis.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Category badge */}
          <span className={cn('text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border', catColor)}>
            {thesis.category}
          </span>
          {/* Status badge */}
          <span className={cn('flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border', status.bg, status.color)}>
            <StatusIcon className="h-2.5 w-2.5" />
            {status.label}
          </span>
        </div>
      </div>

      {/* Statement */}
      <Link href={`/thesis/${thesis.id}`} className="group block">
        <p className="font-mono text-sm text-white group-hover:text-surface-200 transition-colors leading-relaxed mb-2">
          &ldquo;{thesis.statement}&rdquo;
        </p>
      </Link>

      {/* Rationale */}
      {thesis.rationale && (
        <p className="text-xs font-mono text-surface-500 leading-relaxed mb-3 line-clamp-2">
          {thesis.rationale}
        </p>
      )}

      {/* Footer metadata */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-surface-500">
        {dl !== null && thesis.status === 'active' && (
          <span className={cn('flex items-center gap-1', dl < 7 ? 'text-gold' : dl < 0 ? 'text-against-400' : '')}>
            <Calendar className="h-3 w-3" />
            {dl < 0 ? 'Overdue' : dl === 0 ? 'Expires today' : `${dl}d to resolve`}
          </span>
        )}
        {thesis.resolved_at && (
          <span className="flex items-center gap-1 text-surface-500">
            <Check className="h-3 w-3" />
            Resolved {relTime(thesis.resolved_at)}
          </span>
        )}
        <Link
          href={`/thesis/${thesis.id}`}
          className="ml-auto flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors"
        >
          View <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>

      {/* Vote buttons */}
      <VoteButtons thesis={thesis} isOwner={isOwner} onVoted={onVoted} />
    </motion.div>
  )
}

// ─── Create Thesis Modal ──────────────────────────────────────────────────────

function CreateThesisModal({
  topicId,
  topicStatement,
  onClose,
  onCreated,
}: {
  topicId: string
  topicStatement: string
  onClose: () => void
  onCreated: (t: Thesis) => void
}) {
  const [statement, setStatement] = useState('')
  const [rationale, setRationale] = useState('')
  const [category, setCategory] = useState<ThesisCategory>('politics')
  const [resolutionDate, setResolutionDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const charLeft = 280 - statement.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (statement.trim().length < 10) {
      setError('Thesis must be at least 10 characters.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: statement.trim(),
          rationale: rationale.trim() || undefined,
          category,
          resolution_date: resolutionDate || undefined,
          related_topic_id: topicId,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to publish thesis')
        return
      }
      const { thesis } = await res.json()
      onCreated(thesis)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-purple/15 border border-purple/30">
              <Scroll className="h-4 w-4 text-purple" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-white">Stake a Thesis</h2>
              <p className="text-[10px] font-mono text-surface-500">Linked to this debate</p>
            </div>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white p-1 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Topic context */}
        <div className="px-5 py-3 border-b border-surface-300 bg-surface-200/40">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Debate</p>
          <p className="text-xs font-mono text-surface-300 line-clamp-2">{topicStatement}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Your Thesis
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value.slice(0, 280))}
              placeholder="I believe this will pass/fail because…"
              rows={3}
              autoFocus
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-surface-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all"
            />
            <div className="flex justify-end">
              <span className={cn('text-[11px] font-mono', charLeft < 20 ? (charLeft < 5 ? 'text-against-400' : 'text-gold') : 'text-surface-500')}>
                {charLeft} left
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Rationale <span className="normal-case font-normal text-surface-600">(optional)</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value.slice(0, 1000))}
              placeholder="Why do you believe this? What evidence supports your view?"
              rows={2}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-surface-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ThesisCategory)}
                  className="w-full appearance-none bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 pr-8 transition-all"
                >
                  {THESIS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                Resolve by <span className="normal-case font-normal text-surface-600">(optional)</span>
              </label>
              <input
                type="date"
                value={resolutionDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setResolutionDate(e.target.value)}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-mono text-against-400 bg-against-500/10 border border-against-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || statement.trim().length < 10}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono font-semibold bg-purple hover:bg-purple/90 text-white border border-purple/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Scroll className="h-3.5 w-3.5" />Stake Thesis</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Sort tabs ────────────────────────────────────────────────────────────────

type SortMode = 'newest' | 'popular' | 'expiring' | 'contested'
type StatusFilter = 'active' | 'vindicated' | 'refuted'

const SORT_TABS: { id: SortMode; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'popular', label: 'Most Agreed' },
  { id: 'contested', label: 'Contested' },
  { id: 'expiring', label: 'Expiring Soon' },
]

const STATUS_TABS: { id: StatusFilter; label: string; color: string }[] = [
  { id: 'active', label: 'Active', color: 'text-for-400' },
  { id: 'vindicated', label: 'Vindicated', color: 'text-gold' },
  { id: 'refuted', label: 'Refuted', color: 'text-against-400' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TopicThesesPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const topicId = params.id

  const [topic, setTopic] = useState<{ statement: string; category: string; status: string; blue_pct: number; total_votes: number } | null>(null)
  const [theses, setTheses] = useState<Thesis[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [sort, setSort] = useState<SortMode>('newest')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  // Auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthed(!!user)
      setCurrentUserId(user?.id ?? null)
    })
  }, [])

  // Load topic
  useEffect(() => {
    if (!topicId) return
    const supabase = createClient()
    supabase
      .from('topics')
      .select('statement, category, status, blue_pct, total_votes')
      .eq('id', topicId)
      .single()
      .then(({ data }) => {
        if (!data) { router.push('/'); return }
        setTopic(data)
      })
  }, [topicId, router])

  const load = useCallback(async (reset = false) => {
    if (!topicId) return
    const newOffset = reset ? 0 : offset
    if (reset) { setLoading(true); setError(null) }
    else setLoadingMore(true)

    try {
      const url = new URL('/api/thesis', window.location.origin)
      url.searchParams.set('topic_id', topicId)
      url.searchParams.set('sort', sort)
      url.searchParams.set('status', statusFilter)
      url.searchParams.set('limit', String(LIMIT))
      url.searchParams.set('offset', String(newOffset))

      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ThesisListResponse = await res.json()

      if (reset) {
        setTheses(data.theses)
        setOffset(data.theses.length)
      } else {
        setTheses((prev) => [...prev, ...data.theses])
        setOffset((prev) => prev + data.theses.length)
      }
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load theses')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [topicId, sort, statusFilter, offset])

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, sort, statusFilter])

  function handleVoted(id: string, agree: boolean | null) {
    setTheses((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const wasAgree = t.viewer_vote === true
        const wasDisagree = t.viewer_vote === false
        let agree_count = t.agree_count
        let disagree_count = t.disagree_count
        if (agree === null) {
          if (wasAgree) agree_count--
          else if (wasDisagree) disagree_count--
        } else if (agree) {
          agree_count++
          if (wasDisagree) disagree_count--
        } else {
          disagree_count++
          if (wasAgree) agree_count--
        }
        return { ...t, viewer_vote: agree, agree_count, disagree_count }
      })
    )
  }

  function handleCreated(t: Thesis) {
    setTheses((prev) => [t, ...prev])
    setTotal((n) => n + 1)
  }

  const hasMore = theses.length < total

  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">

        {/* ── Back nav ────────────────────────────────────────────────── */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {/* ── Topic banner ─────────────────────────────────────────────── */}
        {topic ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-purple/15 border border-purple/30 flex-shrink-0">
                  <BookOpen className="h-4 w-4 text-purple" />
                </div>
                <div>
                  <h1 className="font-mono text-base font-bold text-white">Civic Theses</h1>
                  <p className="text-[10px] font-mono text-surface-500">{total} prediction{total !== 1 ? 's' : ''} staked on this debate</p>
                </div>
              </div>
              {topic.category && (
                <span className="text-xs font-mono font-semibold text-surface-400 flex-shrink-0">{topic.category}</span>
              )}
            </div>

            <p className="font-mono text-sm text-surface-300 leading-relaxed mb-4 line-clamp-2">
              &ldquo;{topic.statement}&rdquo;
            </p>

            {/* Vote bar */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-[11px] font-mono font-bold">
                <span className="text-for-400">{forPct}% FOR</span>
                <span className="text-surface-500">{(topic.total_votes ?? 0).toLocaleString()} votes</span>
                <span className="text-against-400">{againstPct}% AGAINST</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
                <div className="h-full bg-gradient-to-r from-for-700 to-for-400" style={{ width: `${forPct}%` }} />
                <div className="h-full bg-against-600" style={{ width: `${againstPct}%` }} />
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-2">
              {authed ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/80 hover:bg-purple text-white text-xs font-mono font-semibold border border-purple/50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Stake Your Thesis
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/80 hover:bg-purple text-white text-xs font-mono font-semibold border border-purple/50 transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Sign in to stake
                </Link>
              )}
              <Link
                href="/thesis"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold border border-surface-300 transition-colors"
              >
                All Theses
                <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        )}

        {/* ── Status filter ─────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                statusFilter === s.id
                  ? cn(s.color, 'bg-surface-200 border-surface-400')
                  : 'text-surface-500 bg-transparent border-transparent hover:border-surface-400'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Sort bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider flex-shrink-0">Sort:</span>
          {SORT_TABS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={cn(
                'flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                sort === s.id
                  ? 'bg-surface-200 border-surface-400 text-white'
                  : 'border-transparent text-surface-500 hover:text-surface-300'
              )}
            >
              {s.label}
            </button>
          ))}

          <button
            onClick={() => load(true)}
            disabled={loading}
            className="ml-auto flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Thesis list ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <ThesisSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load(true)}
              className="px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-xs font-mono transition-colors"
            >
              Try again
            </button>
          </div>
        ) : theses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No theses yet"
            description={
              statusFilter === 'active'
                ? 'Be the first to stake a thesis on this debate. Share what you believe will happen and why.'
                : `No ${statusFilter} theses for this topic yet.`
            }
            action={
              authed
                ? { label: 'Stake the first thesis', onClick: () => setShowCreate(true) }
                : { label: 'Sign in to stake a thesis', href: '/login' }
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {theses.map((t) => (
                <ThesisCard
                  key={t.id}
                  thesis={t}
                  currentUserId={currentUserId}
                  onVoted={handleVoted}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Load more ────────────────────────────────────────────────── */}
        {hasMore && !loading && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => load(false)}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-sm font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? 'Loading…' : `Load more (${total - theses.length} remaining)`}
            </button>
          </div>
        )}

        {/* ── Footer nav ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href={`/topic/${topicId}`}
            className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 text-center hover:border-surface-400 hover:bg-surface-200 transition-colors"
          >
            <p className="text-sm font-mono font-semibold text-white mb-0.5">Full Debate</p>
            <p className="text-xs font-mono text-surface-500">Arguments, wiki, votes</p>
          </Link>
          <Link
            href="/thesis"
            className="rounded-xl border border-purple/30 bg-purple/5 p-3.5 text-center hover:border-purple/50 hover:bg-purple/10 transition-colors"
          >
            <p className="text-sm font-mono font-semibold text-purple mb-0.5">All Theses</p>
            <p className="text-xs font-mono text-surface-500">Global thesis board</p>
          </Link>
        </div>
      </main>

      <BottomNav />

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && topic && (
          <CreateThesisModal
            topicId={topicId}
            topicStatement={topic.statement}
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
