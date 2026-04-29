'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Award,
  Clock,
  Coins,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BountyEntry, BountiesResponse } from '@/app/api/bounties/route'

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

function deadlineLabel(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return `< 1h left`
  if (h < 24) return `${h}h left`
  if (d < 7) return `${d}d left`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── BountyCard ───────────────────────────────────────────────────────────────

function BountyCard({ bounty }: { bounty: BountyEntry }) {
  const dl = deadlineLabel(bounty.deadline)
  const catColor = CATEGORY_COLORS[bounty.topic_category ?? ''] ?? 'text-surface-500'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-5 space-y-4 transition-colors hover:border-surface-400',
        bounty.status === 'awarded'
          ? 'border-gold/30 bg-gold/5'
          : bounty.status === 'expired'
          ? 'border-surface-300/50 opacity-60'
          : 'border-surface-300'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${bounty.creator_username}`} className="flex-shrink-0">
          <Avatar
            src={bounty.creator_avatar_url}
            fallback={bounty.creator_display_name ?? bounty.creator_username}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${bounty.creator_username}`}
              className="text-sm font-medium text-white hover:text-for-300 transition-colors"
            >
              {bounty.creator_display_name ?? bounty.creator_username}
            </Link>
            <span className="text-[11px] text-surface-500">{relativeTime(bounty.created_at)}</span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5 font-mono">
            @{bounty.creator_username}
          </p>
        </div>

        {/* Reward pill */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 border font-mono text-sm font-bold flex-shrink-0',
            bounty.status === 'awarded'
              ? 'bg-gold/20 border-gold/50 text-gold'
              : 'bg-for-500/10 border-for-500/30 text-for-300'
          )}
        >
          <Coins className="h-3.5 w-3.5" aria-hidden="true" />
          {bounty.amount}
        </div>
      </div>

      {/* Topic */}
      <Link
        href={`/topic/${bounty.topic_id}`}
        className="block rounded-xl border border-surface-300 bg-surface-200 p-3 hover:border-surface-400 transition-colors group"
      >
        <div className="flex items-center gap-2 mb-1.5">
          {bounty.topic_category && (
            <span className={cn('text-[10px] font-mono uppercase tracking-wider', catColor)}>
              {bounty.topic_category}
            </span>
          )}
          <Badge variant={STATUS_BADGE[bounty.topic_status] ?? 'proposed'} className="text-[10px] px-1.5 py-0">
            {bounty.topic_status === 'voting' ? 'VOTING' : bounty.topic_status.toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-2 leading-snug">
          {bounty.topic_statement}
        </p>
        <ArrowRight
          className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 mt-1.5 transition-colors"
          aria-hidden="true"
        />
      </Link>

      {/* Description */}
      <p className="text-sm text-surface-600 leading-relaxed">{bounty.description}</p>

      {/* Footer */}
      <div className="flex items-center gap-3 flex-wrap">
        {bounty.side && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border',
              bounty.side === 'for'
                ? 'bg-for-500/10 border-for-500/30 text-for-400'
                : 'bg-against-500/10 border-against-500/30 text-against-400'
            )}
          >
            {bounty.side === 'for' ? (
              <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ThumbsDown className="h-3 w-3" aria-hidden="true" />
            )}
            {bounty.side === 'for' ? 'FOR arguments only' : 'AGAINST arguments only'}
          </span>
        )}

        {dl && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-mono',
              dl === 'Expired' ? 'text-against-400' : 'text-surface-500'
            )}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {dl}
          </span>
        )}

        {bounty.status === 'awarded' && bounty.winner_username && (
          <span className="inline-flex items-center gap-1 text-xs text-gold font-mono ml-auto">
            <Trophy className="h-3 w-3" aria-hidden="true" />
            Awarded to @{bounty.winner_username}
          </span>
        )}
      </div>

      {bounty.status === 'open' && (
        <Link href={`/topic/${bounty.topic_id}`}>
          <Button variant="for" size="sm" className="w-full">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            Write a winning argument
          </Button>
        </Link>
      )}
    </motion.article>
  )
}

// ─── CreateBountyModal ────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void
  onCreated: () => void
}

function CreateBountyModal({ onClose, onCreated }: CreateModalProps) {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<
    { id: string; statement: string; category: string | null; status: string }[]
  >([])
  const [selectedTopic, setSelectedTopic] = useState<{
    id: string
    statement: string
    category: string | null
    status: string
  } | null>(null)
  const [side, setSide] = useState<'for' | 'against' | ''>('')
  const [amount, setAmount] = useState(25)
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 3) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics`)
      const json = await res.json()
      setSearchResults(json.results ?? [])
    } catch {
      // silent
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(search), 300)
  }, [search, doSearch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTopic) { setError('Select a topic'); return }
    if (description.trim().length < 5) { setError('Description too short'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          side: side || null,
          amount,
          description: description.trim(),
          deadline: deadline || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create bounty')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const minDeadline = new Date(Date.now() + 60 * 60_000)
    .toISOString()
    .slice(0, 16)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-gold" aria-hidden="true" />
            <h2 className="font-semibold text-white">Post a Bounty</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Topic picker */}
          {!selectedTopic ? (
            <div className="space-y-2">
              <label className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                Topic
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for a topic…"
                  className="w-full bg-surface-200 border border-surface-300 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" aria-hidden="true" />
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="rounded-xl border border-surface-300 bg-surface-200 divide-y divide-surface-300 max-h-48 overflow-y-auto">
                  {searchResults.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelectedTopic(t); setSearch(''); setSearchResults([]) }}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface-300 transition-colors"
                    >
                      <p className="text-sm text-white line-clamp-1">{t.statement}</p>
                      {t.category && (
                        <p className="text-[10px] text-surface-500 font-mono mt-0.5">{t.category}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-for-500/30 bg-for-500/5 p-3 flex items-start gap-2">
              <Gavel className="h-4 w-4 text-for-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white line-clamp-2">{selectedTopic.statement}</p>
                {selectedTopic.category && (
                  <p className="text-[10px] text-surface-500 font-mono mt-0.5">{selectedTopic.category}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTopic(null)}
                className="text-surface-500 hover:text-white transition-colors flex-shrink-0"
                aria-label="Clear topic"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Side */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              Argument side (optional)
            </label>
            <div className="flex gap-2">
              {(['', 'for', 'against'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={cn(
                    'flex-1 rounded-xl border py-2 text-sm font-medium transition-colors',
                    side === s
                      ? s === 'for'
                        ? 'bg-for-500/20 border-for-500/50 text-for-300'
                        : s === 'against'
                        ? 'bg-against-500/20 border-against-500/50 text-against-300'
                        : 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                  )}
                >
                  {s === '' ? 'Either' : s === 'for' ? 'FOR only' : 'AGAINST only'}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              Clout reward: <span className="text-gold">{amount}</span>
            </label>
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-gold"
            />
            <div className="flex justify-between text-[10px] text-surface-500 font-mono">
              <span>5</span>
              <span>100</span>
              <span>250</span>
              <span>500</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              What makes a winning argument?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Describe what you're looking for — the angle, evidence type, or key points you want addressed…"
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-surface-500 resize-none focus:outline-none focus:border-for-500/50"
            />
            <div className="text-right text-[10px] text-surface-500 font-mono">
              {description.length}/280
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-surface-500 uppercase tracking-wider">
              Deadline (optional)
            </label>
            <input
              type="datetime-local"
              min={minDeadline}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-for-500/50 [color-scheme:dark]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-against-500/40 bg-against-500/10 px-4 py-3 text-sm text-against-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="gold"
            size="md"
            className="w-full"
            disabled={submitting || !selectedTopic || description.trim().length < 5}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Award className="h-4 w-4" aria-hidden="true" />
            )}
            {submitting ? 'Posting…' : `Post Bounty · ${amount} Clout`}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── BountiesPage ─────────────────────────────────────────────────────────────

type FilterMode = 'open' | 'all'

export default function BountiesPage() {
  const [data, setData] = useState<BountiesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('open')
  const [showCreate, setShowCreate] = useState(false)
  const [authed, setAuthed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bounties?filter=${filter}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load bounties')
    } finally {
      setLoading(false)
    }
  }, [filter])

  // Check auth status
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setAuthed(!!d?.id))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const bounties = data?.bounties ?? []

  return (
    <>
      <div className="min-h-screen bg-surface-50 pb-24">
        <TopBar />

        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6 text-gold" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-white">Civic Bounties</h1>
            </div>
            <p className="text-surface-500 text-sm leading-relaxed">
              Stake clout to commission the best arguments on topics you care about.
              Writers compete — the creator picks the winner.
            </p>
          </div>

          {/* Stats row */}
          {data && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                  Active Bounties
                </div>
                <div className="font-mono text-2xl font-bold text-white">
                  {data.total_open}
                </div>
              </div>
              <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
                <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                  Clout Pledged
                </div>
                <div className="font-mono text-2xl font-bold text-gold">
                  {data.total_clout_pledged.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-surface-300 bg-surface-200 p-0.5 gap-0.5">
              {(['open', 'all'] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors capitalize',
                    filter === f
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  {f === 'open' ? 'Open' : 'All'}
                </button>
              ))}
            </div>

            <button
              onClick={load}
              className="p-2 rounded-xl text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex-1" />

            {authed ? (
              <Button
                variant="gold"
                size="sm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Post Bounty
              </Button>
            ) : (
              <Link href="/login">
                <Button variant="for" size="sm">
                  Sign in to post
                </Button>
              </Link>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-6 w-16 rounded-full ml-auto" />
                  </div>
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-9 rounded-xl" />
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={AlertCircle}
              title="Failed to load bounties"
              description={error}
              actions={[{ label: 'Retry', onClick: load }]}
            />
          ) : bounties.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No bounties yet"
              description={
                filter === 'open'
                  ? 'No open bounties right now. Be the first to commission a great argument!'
                  : 'No bounties found.'
              }
              actions={
                authed
                  ? [{ label: 'Post the first bounty', onClick: () => setShowCreate(true) }]
                  : [{ label: 'Browse topics', href: '/' }]
              }
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {bounties.map((bounty) => (
                  <BountyCard key={bounty.id} bounty={bounty} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* How it works */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Scale className="h-4 w-4 text-purple" aria-hidden="true" />
              How Bounties Work
            </h2>
            <ol className="space-y-2.5 text-sm text-surface-500">
              <li className="flex gap-3">
                <span className="font-mono text-for-400 flex-shrink-0 w-5">1.</span>
                <span>
                  Post a bounty on any active topic. Set a clout reward (1–500) and describe what
                  makes a winning argument.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-for-400 flex-shrink-0 w-5">2.</span>
                <span>
                  Other users write arguments on that topic. The best arguments earn upvotes and
                  visibility.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-for-400 flex-shrink-0 w-5">3.</span>
                <span>
                  When you find the best argument, use the <strong className="text-white">Gift Clout</strong> button
                  on the author&apos;s profile to send the reward manually. Mark the bounty awarded.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <BottomNav />

      <AnimatePresence>
        {showCreate && (
          <CreateBountyModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              load()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
