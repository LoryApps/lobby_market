'use client'

/**
 * /ama/request — AMA Request Board
 *
 * Community-driven wishlist for expert AMA sessions. Users propose topics
 * they want experts to cover and upvote the requests they care about most.
 * Experts can browse the leaderboard to see where demand is highest.
 *
 * Features:
 *   - Sortable list: top (most upvoted) | new (most recent)
 *   - Category tabs to filter by civic domain
 *   - Toggle: open requests vs fulfilled sessions
 *   - Submit new request with title, description, category, optional topic link
 *   - One-click upvote / unvote (optimistic UI)
 *   - Fulfilled badge + link to the resulting session
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Mic,
  Music2,
  Plus,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { haptics } from '@/lib/hooks/useHaptics'
import type { AMARequestItem, AMARequestsResponse } from '@/app/api/ama/requests/route'

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Law',
  'Education', 'Health', 'Environment', 'Culture', 'International',
]

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:     TrendingUp,
  Politics:      Landmark,
  Technology:    Cpu,
  Science:       FlaskConical,
  Law:           Scale,
  Education:     GraduationCap,
  Health:        Heart,
  Environment:   Leaf,
  Culture:       Music2,
  International: TrendingUp,
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:     'text-for-400',
  Politics:      'text-against-400',
  Technology:    'text-purple',
  Science:       'text-emerald',
  Law:           'text-gold',
  Education:     'text-for-300',
  Health:        'text-against-300',
  Environment:   'text-emerald',
  Culture:       'text-purple',
  International: 'text-for-400',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Submit Modal ───────────────────────────────────────────────────────────────

interface SubmitModalProps {
  onClose: () => void
  onCreated: (r: AMARequestItem) => void
}

function SubmitModal({ onClose, onCreated }: SubmitModalProps) {
  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [category, setCat]      = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const titleRef                = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError(null)

    const t = title.trim()
    if (t.length < 10) { setError('Title must be at least 10 characters'); return }
    if (t.length > 150) { setError('Title max 150 characters'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/ama/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, description: description.trim() || undefined, category: category || undefined }),
      })
      const json = await res.json() as { request?: AMARequestItem; error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed to submit'); return }
      if (json.request) {
        haptics.success()
        onCreated(json.request)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <motion.div
        className={cn(
          'relative z-10 w-full sm:max-w-lg',
          'bg-surface-100 border border-surface-300',
          'rounded-t-2xl sm:rounded-2xl',
          'p-6 shadow-2xl',
        )}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-mono text-lg font-bold text-white">Request an AMA</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Describe the expert conversation you want to see
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-mono text-surface-500 uppercase tracking-wider block mb-1.5">
              What do you want to ask? *
            </label>
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              maxLength={150}
              placeholder="e.g. Can an economist explain why inflation keeps rising despite rate hikes?"
              className={cn(
                'w-full rounded-xl bg-surface-200 border text-white text-sm px-4 py-3 resize-none',
                'placeholder-surface-500 focus:outline-none focus:ring-2 transition-colors',
                title.trim().length < 10 && title.length > 0
                  ? 'border-against-500/60 focus:ring-against-500/30'
                  : 'border-surface-300 focus:ring-for-500/30 focus:border-for-500/50',
              )}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-surface-600">Min 10 characters</span>
              <span className={cn('text-xs', title.length > 130 ? 'text-against-400' : 'text-surface-600')}>
                {title.length}/150
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-mono text-surface-500 uppercase tracking-wider block mb-1.5">
              Why would this be valuable? <span className="text-surface-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Explain the context, what expertise you're looking for, and why the community would benefit…"
              className="w-full rounded-xl bg-surface-200 border border-surface-300 text-white text-sm px-4 py-3 resize-none placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-for-500/30 focus:border-for-500/50 transition-colors"
            />
            <div className="flex justify-end mt-1">
              <span className={cn('text-xs', description.length > 450 ? 'text-against-400' : 'text-surface-600')}>
                {description.length}/500
              </span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-mono text-surface-500 uppercase tracking-wider block mb-1.5">
              Category <span className="text-surface-600">(optional)</span>
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCat(e.target.value)}
                className="w-full rounded-xl bg-surface-200 border border-surface-300 text-white text-sm px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-for-500/30 focus:border-for-500/50 transition-colors"
              >
                <option value="">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-against-400 bg-against-500/10 rounded-lg px-3 py-2 border border-against-500/20">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || title.trim().length < 10}
              className={cn(
                'flex-1 h-11 rounded-xl text-sm font-mono font-semibold',
                'flex items-center justify-center gap-2 transition-all',
                saving || title.trim().length < 10
                  ? 'bg-surface-300 text-surface-500 cursor-not-allowed'
                  : 'bg-for-600 text-white hover:bg-for-500',
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Request Card ───────────────────────────────────────────────────────────────

interface RequestCardProps {
  request: AMARequestItem
  onVote: (id: string) => void
  votePending: boolean
}

function RequestCard({ request, onVote, votePending }: RequestCardProps) {
  const CatIcon = request.category ? (CATEGORY_ICONS[request.category] ?? Mic) : Mic
  const catColor = request.category ? (CATEGORY_COLORS[request.category] ?? 'text-surface-400') : 'text-surface-400'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'bg-surface-100 border rounded-2xl p-4 transition-colors',
        request.fulfilled_session_id
          ? 'border-emerald/30 bg-emerald/5'
          : 'border-surface-300 hover:border-surface-400',
      )}
    >
      <div className="flex gap-3">
        {/* Upvote button */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <button
            onClick={() => onVote(request.id)}
            disabled={votePending}
            aria-label={request.user_voted ? 'Remove upvote' : 'Upvote this request'}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2',
              'border transition-all duration-150 active:scale-95',
              votePending ? 'opacity-50 cursor-not-allowed' : '',
              request.user_voted
                ? 'bg-for-600/20 border-for-500/50 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/50 hover:text-for-400',
            )}
          >
            <ArrowUpCircle className={cn('h-5 w-5 transition-transform', request.user_voted && 'scale-110')} />
            <span className="text-xs font-mono font-bold leading-none">
              {request.upvote_count.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {request.fulfilled_session_id ? (
              <Badge variant="success" size="sm" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Fulfilled
              </Badge>
            ) : null}
            {request.category && (
              <span className={cn('text-xs font-mono font-semibold flex items-center gap-1', catColor)}>
                <CatIcon className="h-3 w-3" />
                {request.category}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-medium text-white leading-snug">{request.title}</p>

          {/* Description */}
          {request.description && (
            <p className="text-xs text-surface-500 mt-1.5 leading-relaxed line-clamp-2">
              {request.description}
            </p>
          )}

          {/* Linked topic */}
          {request.topic_statement && (
            <Link
              href={`/topic/${request.topic_id}`}
              className="inline-flex items-center gap-1 mt-2 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-1">{request.topic_statement}</span>
            </Link>
          )}

          {/* Fulfilled session link */}
          {request.fulfilled_session_id && (
            <Link
              href={`/ama/${request.fulfilled_session_id}`}
              className="inline-flex items-center gap-1 mt-2 text-xs text-emerald hover:text-emerald/80 transition-colors"
            >
              <Mic className="h-3 w-3" />
              View the AMA session →
            </Link>
          )}

          {/* Author + timestamp */}
          <div className="flex items-center gap-2 mt-3">
            {request.author && (
              <Link
                href={`/profile/${request.author.username}`}
                className="flex items-center gap-1.5 group"
              >
                <Avatar
                  src={request.author.avatar_url}
                  fallback={request.author.display_name || request.author.username}
                  size="xs"
                />
                <span className="text-xs text-surface-500 group-hover:text-white transition-colors">
                  {request.author.display_name || `@${request.author.username}`}
                </span>
              </Link>
            )}
            <span className="text-xs text-surface-600 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(request.created_at)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function RequestBoardClient() {
  const [requests, setRequests]     = useState<AMARequestItem[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadMore]  = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [category, setCat]          = useState('')
  const [sort, setSort]             = useState<'top' | 'new'>('top')
  const [status, setStatus]         = useState<'open' | 'fulfilled'>('open')
  const [pendingVotes, setPending]  = useState<Set<string>>(new Set())

  const PAGE = 20
  const hasMore = requests.length < total

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true)
    else setLoadMore(true)
    try {
      const params = new URLSearchParams({
        sort,
        status,
        limit: String(PAGE),
        offset: reset ? '0' : String(requests.length),
      })
      if (category) params.set('category', category)
      const res  = await fetch(`/api/ama/requests?${params}`)
      const data = await res.json() as AMARequestsResponse
      if (reset) {
        setRequests(data.requests ?? [])
      } else {
        setRequests((prev) => [...prev, ...(data.requests ?? [])])
      }
      setTotal(data.total ?? 0)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      setLoadMore(false)
    }
  }, [sort, status, category, requests.length])

  // Initial load and when filters change
  useEffect(() => { load(true) }, [sort, status, category]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVote(id: string) {
    if (pendingVotes.has(id)) return
    setPending((s) => new Set(s).add(id))

    // Optimistic update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, user_voted: !r.user_voted, upvote_count: r.upvote_count + (r.user_voted ? -1 : 1) }
          : r
      )
    )

    try {
      const res  = await fetch(`/api/ama/requests/${id}/vote`, { method: 'POST' })
      const data = await res.json() as { voted?: boolean; error?: string }
      if (!res.ok) {
        // Revert
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, user_voted: !r.user_voted, upvote_count: r.upvote_count + (r.user_voted ? -1 : 1) }
              : r
          )
        )
      } else {
        haptics.light()
        // Re-sort top if needed
        if (sort === 'top') {
          setRequests((prev) => [...prev].sort((a, b) => b.upvote_count - a.upvote_count))
        }
        void data
      }
    } catch {
      // Revert on error
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, user_voted: !r.user_voted, upvote_count: r.upvote_count + (r.user_voted ? -1 : 1) }
            : r
        )
      )
    } finally {
      setPending((s) => { const next = new Set(s); next.delete(id); return next })
    }
  }

  function handleCreated(r: AMARequestItem) {
    setShowModal(false)
    setRequests((prev) => [r, ...prev])
    setTotal((t) => t + 1)
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24">
        {/* Back */}
        <Link
          href="/ama"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AMAs
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-mono font-bold text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-gold" />
              AMA Request Board
            </h1>
            <p className="text-sm text-surface-500 mt-1">
              Upvote topics you want experts to cover. The most-wanted sessions get scheduled first.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Request
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 text-xs font-mono text-surface-500 mb-5">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {total.toLocaleString()} request{total !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Search className="h-3.5 w-3.5" />
            Sorted by {sort === 'top' ? 'votes' : 'newest'}
          </span>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Status toggle */}
          <div className="flex bg-surface-200 rounded-lg p-0.5 border border-surface-300">
            {(['open', 'fulfilled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                  status === s
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                {s === 'open' ? 'Open' : 'Fulfilled'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex bg-surface-200 rounded-lg p-0.5 border border-surface-300">
            {([['top', 'Top'], ['new', 'New']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSort(val)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                  sort === val
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setCat('')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all',
              category === ''
                ? 'bg-surface-300 text-white border-surface-400'
                : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-white',
            )}
          >
            All
          </button>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c] ?? Mic
            const col  = CATEGORY_COLORS[c] ?? 'text-surface-400'
            return (
              <button
                key={c}
                onClick={() => setCat(c === category ? '' : c)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all',
                  category === c
                    ? `bg-surface-300 ${col} border-surface-400`
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-white',
                )}
              >
                <Icon className="h-3 w-3" />
                {c}
              </button>
            )
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-14 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/4 mt-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={status === 'open' ? 'No requests yet' : 'No fulfilled requests'}
            description={
              status === 'open'
                ? category
                  ? `No AMA requests in ${category} yet. Be the first to ask!`
                  : 'No one has requested an AMA yet. Start the conversation!'
                : 'No requests have been fulfilled yet.'
            }
            action={{ label: 'Request an AMA', href: '#' }}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {requests.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  onVote={handleVote}
                  votePending={pendingVotes.has(r.id)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => load(false)}
              disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? 'Loading…' : `Load more (${total - requests.length} remaining)`}
            </button>
          </div>
        )}

        {/* How it works */}
        {!loading && requests.length > 0 && (
          <div className="mt-8 p-4 bg-surface-100 border border-surface-300 rounded-2xl">
            <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
              How it works
            </h3>
            <div className="space-y-2 text-xs text-surface-500">
              <div className="flex gap-2">
                <span className="text-for-400 font-mono font-bold flex-shrink-0">01</span>
                <span>Submit a request describing the expert conversation you want to see</span>
              </div>
              <div className="flex gap-2">
                <span className="text-for-400 font-mono font-bold flex-shrink-0">02</span>
                <span>The community upvotes the most important requests</span>
              </div>
              <div className="flex gap-2">
                <span className="text-for-400 font-mono font-bold flex-shrink-0">03</span>
                <span>Experts browse the board and schedule AMAs for top-requested topics</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gold font-mono font-bold flex-shrink-0">✓</span>
                <span>Fulfilled requests get linked to the resulting AMA session</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Submit Modal */}
      <AnimatePresence>
        {showModal && (
          <SubmitModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
        )}
      </AnimatePresence>
    </div>
  )
}
