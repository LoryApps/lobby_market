'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  CircleDot,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
  Scroll,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ThesisStatus } from '@/lib/types/thesis'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { RisingThesisEntry, RisingThesesResponse } from '@/app/api/thesis/rising/route'

// ─── Config ───────────────────────────────────────────────────────────────────

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

const STATUS_CONFIG: Record<ThesisStatus, { label: string; color: string; icon: typeof Zap }> = {
  active:     { label: 'Active',     color: 'text-for-400',     icon: CircleDot },
  vindicated: { label: 'Vindicated', color: 'text-gold',        icon: Trophy },
  refuted:    { label: 'Refuted',    color: 'text-against-400', icon: X },
  expired:    { label: 'Expired',    color: 'text-surface-500', icon: Clock },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysLeft(iso: string): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

// ─── Thesis Card ─────────────────────────────────────────────────────────────

function ThesisCard({
  entry,
  index,
  showRank,
  onVote,
}: {
  entry: RisingThesisEntry
  index: number
  showRank: boolean
  onVote: (id: string, agree: boolean, prev: boolean | null) => void
}) {
  const [voting, setVoting] = useState(false)
  const [localVote, setLocalVote] = useState<boolean | null>(entry.viewer_vote ?? null)
  const [localAgree, setLocalAgree] = useState(entry.agree_count)
  const [localDisagree, setLocalDisagree] = useState(entry.disagree_count)

  const catColor = CAT_COLORS[entry.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const statusCfg = STATUS_CONFIG[entry.status as ThesisStatus] ?? STATUS_CONFIG.active
  const StatusIcon = statusCfg.icon
  const total = localAgree + localDisagree
  const agreeWidth = total > 0 ? Math.round((localAgree / total) * 100) : 50
  const days = entry.resolution_date ? daysLeft(entry.resolution_date) : null

  async function handleVote(agree: boolean) {
    if (voting) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const prev = localVote
    const isSame = prev === agree
    setVoting(true)

    setLocalVote(isSame ? null : agree)
    if (isSame) {
      setLocalAgree(a => agree ? Math.max(0, a - 1) : a)
      setLocalDisagree(d => !agree ? Math.max(0, d - 1) : d)
    } else {
      if (prev === true) setLocalAgree(a => Math.max(0, a - 1))
      if (prev === false) setLocalDisagree(d => Math.max(0, d - 1))
      if (agree) setLocalAgree(a => a + 1)
      else setLocalDisagree(d => d + 1)
    }

    try {
      await fetch('/api/thesis/' + entry.id + '/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agree: isSame ? null : agree }),
      })
      onVote(entry.id, agree, prev)
    } catch {
      setLocalVote(prev)
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative bg-surface-100 border border-surface-200 rounded-2xl p-4 hover:border-surface-300 transition-colors group"
    >
      {/* Rank badge */}
      {showRank && (
        <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-surface-50 border border-surface-200 flex items-center justify-center z-10">
          <span className="text-xs font-mono font-bold text-surface-500">#{index + 1}</span>
        </div>
      )}

      {/* Rising velocity badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald/10 border border-emerald/30 rounded-full px-2 py-0.5">
        <TrendingUp className="h-3 w-3 text-emerald" />
        <span className="text-[11px] font-mono font-bold text-emerald">+{entry.recent_agree_count}</span>
        <span className="text-[9px] text-emerald/70 font-mono">this week</span>
      </div>

      {/* Author */}
      {entry.author && (
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/profile/${entry.author.username}`} className="flex items-center gap-2 group/author">
            <Avatar
              src={entry.author.avatar_url}
              username={entry.author.username}
              size="xs"
              className="ring-1 ring-surface-300"
            />
            <span className="text-xs font-mono text-surface-500 group-hover/author:text-white transition-colors">
              {entry.author.display_name ?? entry.author.username}
            </span>
          </Link>
          <span className="text-xs text-surface-600 font-mono">{relTime(entry.created_at)}</span>
        </div>
      )}

      {/* Statement */}
      <Link href={`/thesis/${entry.id}`} className="block mb-3 group/link">
        <p className="font-mono text-sm text-white leading-snug group-hover/link:text-for-300 transition-colors line-clamp-3">
          &ldquo;{entry.statement}&rdquo;
        </p>
      </Link>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge
          variant="outline"
          className={cn('text-[10px] font-mono border capitalize', catColor)}
        >
          {entry.category}
        </Badge>
        <div className={cn('flex items-center gap-1 text-[10px] font-mono', statusCfg.color)}>
          <StatusIcon className="h-3 w-3" />
          {statusCfg.label}
        </div>
        {days !== null && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Calendar className="h-3 w-3" />
            {days === 0 ? 'Resolves today' : `${days}d left`}
          </div>
        )}
      </div>

      {/* Related topic */}
      {entry.related_topic_statement && entry.related_topic_id && (
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-mono text-surface-500 bg-surface-200/60 rounded-lg px-2 py-1">
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <Link
            href={`/topic/${entry.related_topic_id}`}
            className="truncate hover:text-white transition-colors"
          >
            {entry.related_topic_statement}
          </Link>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-500"
          style={{ width: `${agreeWidth}%` }}
        />
      </div>

      {/* Vote actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote(true)}
            disabled={voting}
            aria-label="Agree"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
              localVote === true
                ? 'bg-for-500/30 text-for-300 border border-for-500/50'
                : 'bg-surface-200 text-surface-500 border border-surface-300 hover:bg-for-500/10 hover:text-for-400 hover:border-for-500/30'
            )}
          >
            {voting && localVote !== true ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
            <span>{localAgree}</span>
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={voting}
            aria-label="Disagree"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
              localVote === false
                ? 'bg-against-500/30 text-against-300 border border-against-500/50'
                : 'bg-surface-200 text-surface-500 border border-surface-300 hover:bg-against-500/10 hover:text-against-400 hover:border-against-500/30'
            )}
          >
            {voting && localVote !== false ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
            <span>{localDisagree}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-surface-600">
            {agreeWidth}% agree
          </span>
          <Link
            href={`/thesis/${entry.id}`}
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowRight className="h-3 w-3" />
            View
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ThesisSkeleton() {
  return (
    <div className="bg-surface-100 border border-surface-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  entries,
  showRank,
  onVote,
  loading,
}: {
  title: string
  subtitle: string
  icon: typeof TrendingUp
  iconColor: string
  entries: RisingThesisEntry[]
  showRank: boolean
  onVote: (id: string, agree: boolean, prev: boolean | null) => void
  loading: boolean
}) {
  if (!loading && entries.length === 0) return null

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <h2 className="text-sm font-mono font-bold text-white">{title}</h2>
      </div>
      <p className="text-xs font-mono text-surface-500 mb-4">{subtitle}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ThesisSkeleton key={i} />)
          : entries.map((e, i) => (
              <ThesisCard key={e.id} entry={e} index={i} showRank={showRank} onVote={onVote} />
            ))}
      </div>
    </section>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RisingThesesClient() {
  const [data, setData] = useState<RisingThesesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [showCats, setShowCats] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      const res = await fetch(`/api/thesis/rising?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json() as RisingThesesResponse
      if (mountedRef.current) setData(json)
    } catch {
      if (mountedRef.current) setError(true)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [category])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  function handleVote(id: string, agree: boolean, prev: boolean | null) {
    // Optimistic update already done in card; no server-side refresh needed
    void id; void agree; void prev
  }

  const isEmpty = !loading && data && (
    data.fastest_rising.length === 0 &&
    data.new_consensus.length === 0 &&
    data.breakout_predictions.length === 0
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/thesis"
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Theses
          </Link>
          <span className="text-surface-600">/</span>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald" />
            <h1 className="text-sm font-mono font-bold text-white">Rising</h1>
          </div>
          {data && (
            <span className="ml-auto text-xs font-mono text-surface-600">
              {data.total_rising} gaining momentum
            </span>
          )}
        </div>

        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald/10 via-surface-100 to-surface-100 border border-emerald/20 rounded-2xl p-5 mb-6">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-2 right-6 text-[120px] font-mono font-black text-emerald select-none">
              ↑
            </div>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-emerald" />
              <span className="text-xs font-mono font-bold text-emerald tracking-wider uppercase">Rising Theses</span>
            </div>
            <p className="text-sm font-mono text-surface-400 leading-relaxed max-w-lg">
              Civic predictions gaining the most agreement in the last 7 days — ideas the community is rallying behind right now.
            </p>
          </div>
        </div>

        {/* Category filter */}
        <div className="mb-6">
          <button
            onClick={() => setShowCats(!showCats)}
            className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-2"
          >
            <Scroll className="h-3.5 w-3.5" />
            {category ? `Category: ${category}` : 'All categories'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showCats && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showCats && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5 mb-4"
              >
                <button
                  onClick={() => { setCategory(null); setShowCats(false) }}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-mono border transition-colors',
                    category === null
                      ? 'bg-surface-300 text-white border-surface-400'
                      : 'bg-surface-100 text-surface-500 border-surface-200 hover:border-surface-300'
                  )}
                >
                  All
                </button>
                {THESIS_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); setShowCats(false) }}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-mono border capitalize transition-colors',
                      category === cat
                        ? cn('border', CAT_COLORS[cat])
                        : 'bg-surface-100 text-surface-500 border-surface-200 hover:border-surface-300'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Refresh */}
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <EmptyState
            icon={Zap}
            title="Could not load rising theses"
            description="Something went wrong. Try refreshing."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* Empty */}
        {isEmpty && !error && (
          <EmptyState
            icon={TrendingUp}
            title="No rising theses yet"
            description={
              category
                ? `No ${category} theses are gaining traction this week.`
                : 'No theses are gaining traction yet this week. Check back soon.'
            }
            action={{ label: 'Browse all theses', href: '/thesis' }}
          />
        )}

        {/* Sections */}
        {!error && (
          <>
            <Section
              title="Fastest Rising"
              subtitle="Most agreements earned in the last 7 days — ranked by momentum"
              icon={TrendingUp}
              iconColor="text-emerald"
              entries={data?.fastest_rising ?? []}
              showRank
              onVote={handleVote}
              loading={loading}
            />
            <Section
              title="Emerging Consensus"
              subtitle="Active theses where 70%+ of voters agree — ideas finding broad support"
              icon={Sparkles}
              iconColor="text-gold"
              entries={data?.new_consensus ?? []}
              showRank={false}
              onVote={handleVote}
              loading={loading}
            />
            <Section
              title="Breakout Predictions"
              subtitle="New theses (last 14 days) already gaining significant agreement"
              icon={Rocket}
              iconColor="text-purple"
              entries={data?.breakout_predictions ?? []}
              showRank={false}
              onVote={handleVote}
              loading={loading}
            />
          </>
        )}

        {/* Navigation */}
        <div className="mt-8 pt-6 border-t border-surface-200 grid grid-cols-2 gap-3">
          {[
            { href: '/thesis/hot',      label: 'Hot Theses',       icon: Zap,       color: 'text-against-400' },
            { href: '/thesis/following', label: 'Following',        icon: ArrowRight, color: 'text-for-400' },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between p-3 bg-surface-100 border border-surface-200 rounded-xl hover:border-surface-300 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', color)} />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">{label}</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-white transition-colors" />
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
