'use client'

/**
 * /fact-bank — The Civic Fact Bank
 *
 * A crowd-sourced, community-verified database of verifiable civic facts.
 * Citizens submit factual claims backed by sources; the community upvotes
 * reliable facts and disputes questionable ones. Facts reaching ≥ 10 net
 * upvotes with < 25% dispute rate are automatically promoted to "Verified".
 *
 * Verified facts can be cited in arguments, giving debates an evidence layer.
 *
 * Distinct from:
 *   /sources        — links attached to specific topics
 *   /evidence       — argument-specific evidence panels
 *   /argument_citations — per-argument external source links
 *   /fact-bank      — standalone, searchable, verifiable claim registry (this)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CivicFact, FactBankResponse } from '@/app/api/fact-bank/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education', 'General',
]

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-surface-400',
  Culture:     'text-orange-400',
  Health:      'text-green-400',
  Environment: 'text-teal-400',
  Education:   'text-sky-400',
  General:     'text-surface-400',
}

type SortMode = 'top' | 'new' | 'disputed'

const SORT_OPTIONS: { id: SortMode; label: string; icon: typeof Flame }[] = [
  { id: 'top',      label: 'Most Verified', icon: ThumbsUp  },
  { id: 'new',      label: 'Newest',        icon: Clock     },
  { id: 'disputed', label: 'Disputed',      icon: AlertTriangle },
]

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CivicFact['status'] }) {
  if (status === 'verified') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald/15 text-emerald border border-emerald/30">
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </span>
    )
  }
  if (status === 'disputed') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-against-500/15 text-against-400 border border-against-500/30">
        <AlertTriangle className="h-3 w-3" />
        Disputed
      </span>
    )
  }
  return null
}

// ─── Fact card ────────────────────────────────────────────────────────────────

interface FactCardProps {
  fact: CivicFact
  onVote: (factId: string, vote: 1 | -1) => void
  voting: boolean
}

function FactCard({ fact, onVote, voting }: FactCardProps) {
  const netScore   = fact.upvotes - fact.downvotes
  const totalVotes = fact.upvotes + fact.downvotes
  const forPct     = totalVotes > 0 ? Math.round((fact.upvotes / totalVotes) * 100) : 50

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        fact.status === 'verified'
          ? 'bg-emerald/5 border-emerald/20'
          : fact.status === 'disputed'
          ? 'bg-against-500/5 border-against-500/20'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Header: category + status */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-wider', CATEGORY_COLORS[fact.category] ?? 'text-surface-400')}>
          {fact.category}
        </span>
        <StatusBadge status={fact.status} />
        <span className="ml-auto text-[11px] text-surface-500 font-mono">
          {new Date(fact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Claim */}
      <p className="text-sm font-medium text-white leading-relaxed">{fact.claim}</p>

      {/* Context (optional) */}
      {fact.context && (
        <p className="text-xs text-surface-400 leading-relaxed border-l-2 border-surface-300 pl-3">
          {fact.context}
        </p>
      )}

      {/* Source */}
      {fact.source_url && (
        <a
          href={fact.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-for-400 hover:text-for-300 transition-colors truncate"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{fact.source_title || fact.source_url}</span>
        </a>
      )}

      {/* Footer: author + vote bar + actions */}
      <div className="flex items-center gap-3 pt-1">
        {/* Author */}
        <Link href={`/profile/${fact.author_username}`} className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
          <Avatar src={fact.author_avatar_url} fallback={fact.author_display_name || fact.author_username} size="xs" />
          <span className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors truncate">
            @{fact.author_username}
          </span>
        </Link>

        {/* Vote bar */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className={cn('text-[11px] font-mono font-bold tabular-nums', netScore > 0 ? 'text-for-400' : netScore < 0 ? 'text-against-400' : 'text-surface-400')}>
            {netScore > 0 ? '+' : ''}{netScore}
          </span>
        </div>

        {/* Vote buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onVote(fact.id, 1)}
            disabled={voting}
            aria-label="Upvote — I can verify this"
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              fact.user_vote === 1
                ? 'bg-for-500/20 border-for-500/40 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-500/40 hover:text-for-400'
            )}
          >
            {voting && fact.user_vote !== 1 ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : fact.user_vote === 1 ? (
              <Check className="h-3 w-3" />
            ) : (
              <ThumbsUp className="h-3 w-3" />
            )}
            <span>{fact.upvotes}</span>
          </button>

          <button
            onClick={() => onVote(fact.id, -1)}
            disabled={voting}
            aria-label="Downvote — I dispute this"
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              fact.user_vote === -1
                ? 'bg-against-500/20 border-against-500/40 text-against-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/40 hover:text-against-400'
            )}
          >
            {voting && fact.user_vote !== -1 ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : fact.user_vote === -1 ? (
              <XCircle className="h-3 w-3" />
            ) : (
              <ThumbsDown className="h-3 w-3" />
            )}
            <span>{fact.downvotes}</span>
          </button>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Submit modal ─────────────────────────────────────────────────────────────

function SubmitModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [claim,        setClaim]        = useState('')
  const [category,     setCategory]     = useState('General')
  const [sourceUrl,    setSourceUrl]    = useState('')
  const [sourceTitle,  setSourceTitle]  = useState('')
  const [context,      setContext]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const claimRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { claimRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!claim.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/fact-bank/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim, category, source_url: sourceUrl, source_title: sourceTitle, context }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Submission failed')
        return
      }
      onSubmitted()
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-3xl p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald" />
            <h2 className="text-base font-semibold text-white">Submit a Civic Fact</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Claim */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-400">
              Factual Claim <span className="text-against-400">*</span>
            </label>
            <textarea
              ref={claimRef}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="State a specific, verifiable fact about a civic or policy topic..."
              maxLength={500}
              rows={3}
              required
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 focus:border-for-500/60 focus:outline-none text-sm text-white placeholder:text-surface-500 resize-none"
            />
            <p className="text-[10px] text-surface-500 text-right">{claim.length}/500</p>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-400">
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 focus:border-for-500/60 focus:outline-none text-sm text-white appearance-none"
              >
                {CATEGORIES.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 pointer-events-none" />
            </div>
          </div>

          {/* Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-400">
                Source URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 focus:border-for-500/60 focus:outline-none text-sm text-white placeholder:text-surface-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-400">
                Source Title
              </label>
              <input
                type="text"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                placeholder="e.g. CBO Report 2024"
                maxLength={120}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 focus:border-for-500/60 focus:outline-none text-sm text-white placeholder:text-surface-500"
              />
            </div>
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-400">
              Context / Nuance <span className="text-surface-500">(optional)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add any important caveats, time periods, or scope limitations..."
              maxLength={1000}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 focus:border-for-500/60 focus:outline-none text-sm text-white placeholder:text-surface-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-surface-300 text-sm text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || claim.trim().length < 10}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                'bg-for-600 text-white hover:bg-for-500 disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {submitting ? 'Submitting…' : 'Submit Fact'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300">
      <span className={cn('text-sm font-bold font-mono tabular-nums', color)}>{value}</span>
      <span className="text-[11px] text-surface-500">{label}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FactBankClient() {
  const [facts,       setFacts]       = useState<CivicFact[]>([])
  const [total,       setTotal]       = useState(0)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query,       setQuery]       = useState('')
  const [category,    setCategory]    = useState('All')
  const [sort,        setSort]        = useState<SortMode>('top')
  const [showSubmit,  setShowSubmit]  = useState(false)
  const [votingId,    setVotingId]    = useState<string | null>(null)

  const PAGE_SIZE = 24
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const buildUrl = useCallback((offset = 0, q?: string, cat?: string, s?: SortMode) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      sort: s ?? sort,
    })
    const qVal = q !== undefined ? q : query
    if (qVal.trim())    params.set('q', qVal.trim())
    const catVal = cat !== undefined ? cat : category
    if (catVal && catVal !== 'All') params.set('category', catVal)
    return `/api/fact-bank?${params}`
  }, [query, category, sort, PAGE_SIZE])

  const loadFacts = useCallback(async (override?: { q?: string; cat?: string; s?: SortMode }) => {
    setLoading(true)
    try {
      const url = buildUrl(0, override?.q, override?.cat, override?.s)
      const res = await fetch(url)
      if (!res.ok) return
      const data: FactBankResponse = await res.json()
      setFacts(data.facts)
      setTotal(data.total)
      setHasMore(data.has_more)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const url = buildUrl(facts.length)
      const res = await fetch(url)
      if (!res.ok) return
      const data: FactBankResponse = await res.json()
      setFacts(prev => [...prev, ...data.facts])
      setHasMore(data.has_more)
    } catch {
      // best-effort
    } finally {
      setLoadingMore(false)
    }
  }, [buildUrl, facts.length, hasMore, loadingMore])

  // Initial load
  useEffect(() => { loadFacts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  function handleSearch(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadFacts({ q: value }), 350)
  }

  function handleCategory(cat: string) {
    setCategory(cat)
    loadFacts({ cat })
  }

  function handleSort(s: SortMode) {
    setSort(s)
    loadFacts({ s })
  }

  // ── Vote handler ─────────────────────────────────────────────────────────────

  async function handleVote(factId: string, vote: 1 | -1) {
    if (votingId) return
    setVotingId(factId)
    try {
      const res = await fetch('/api/fact-bank/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact_id: factId, vote }),
      })
      if (!res.ok) return
      const updated = await res.json() as { upvotes: number; downvotes: number; status: CivicFact['status']; user_vote: -1 | 0 | 1 }
      setFacts(prev => prev.map(f =>
        f.id === factId
          ? { ...f, upvotes: updated.upvotes, downvotes: updated.downvotes, status: updated.status, user_vote: updated.user_vote }
          : f
      ))
    } catch {
      // best-effort
    } finally {
      setVotingId(null)
    }
  }

  // Derive counts for stats
  const verifiedCount = facts.filter(f => f.status === 'verified').length
  const disputedCount = facts.filter(f => f.status === 'disputed').length

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-5 w-5 text-emerald" />
              <h1 className="text-xl font-bold text-white tracking-tight">Civic Fact Bank</h1>
            </div>
            <p className="text-sm text-surface-400 leading-relaxed max-w-md">
              Community-verified civic facts. Submit what you know, verify what you can confirm, dispute what&apos;s wrong.
            </p>
          </div>
          <button
            onClick={() => setShowSubmit(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-semibold hover:bg-for-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Submit
          </button>
        </div>

        {/* Stats row */}
        {!loading && total > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <StatPill label="total facts" value={total} color="text-white" />
            <StatPill label="verified"    value={verifiedCount} color="text-emerald" />
            <StatPill label="disputed"    value={disputedCount} color="text-against-400" />
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search facts, topics, or keywords…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-100 border border-surface-300 focus:border-for-500/60 focus:outline-none text-sm text-white placeholder:text-surface-500"
          />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                category === cat
                  ? 'bg-for-600/20 border-for-600/40 text-for-300'
                  : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-surface-400 hover:text-surface-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort options */}
        <div className="flex items-center gap-2 mb-5">
          <ArrowUpDown className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <div className="flex gap-1.5">
            {SORT_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSort(opt.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                    sort === opt.id
                      ? 'bg-surface-200 border-surface-400 text-white'
                      : 'bg-transparent border-transparent text-surface-500 hover:text-surface-300'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => loadFacts()}
            className="ml-auto p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Fact list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
        ) : facts.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-10 w-10 text-surface-500" />}
            title={query ? 'No facts match your search' : 'The Fact Bank is empty'}
            description={
              query
                ? 'Try different keywords or broaden your category filter.'
                : 'Be the first to submit a verifiable civic fact. Back it with a source and let the community verify it.'
            }
            action={
              <Button onClick={() => setShowSubmit(true)} variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Submit the first fact
              </Button>
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {facts.map(fact => (
                <FactCard
                  key={fact.id}
                  fact={fact}
                  onVote={handleVote}
                  voting={votingId === fact.id}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-300 text-sm text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40"
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
              {loadingMore ? 'Loading…' : `Load more (${total - facts.length} remaining)`}
            </button>
          </div>
        )}

        {/* Info footer */}
        {!loading && facts.length > 0 && (
          <div className="mt-8 p-4 rounded-2xl bg-surface-100 border border-surface-300 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
              <p className="text-xs text-surface-400">
                Facts with <span className="text-emerald font-semibold">≥ 10 upvotes</span> and under 25% dispute rate are automatically promoted to <span className="text-emerald font-semibold">Verified</span>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0" />
              <p className="text-xs text-surface-400">
                Facts with a <span className="text-against-400 font-semibold">&gt;40% downvote ratio</span> are marked <span className="text-against-400 font-semibold">Disputed</span> and flagged for review.
              </p>
            </div>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Submit modal */}
      <AnimatePresence>
        {showSubmit && (
          <SubmitModal
            onClose={() => setShowSubmit(false)}
            onSubmitted={() => { setShowSubmit(false); loadFacts() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
