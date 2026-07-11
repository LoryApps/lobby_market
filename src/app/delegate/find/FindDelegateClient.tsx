'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Check,
  ChevronRight,
  Flame,
  Info,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { ARCHETYPE_CONFIG } from '@/lib/config/archetypes'
import type { RecommendedDelegate, RecommendationsResponse } from '@/app/api/delegation/recommendations/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/15',     border: 'border-for-500/40' },
  Economics:   { text: 'text-gold',        bg: 'bg-gold/15',        border: 'border-gold/40' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/15',      border: 'border-purple/40' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/15',     border: 'border-emerald/40' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/40' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/15',     border: 'border-for-400/40' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/15',        border: 'border-gold/40' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/15', border: 'border-against-400/40' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/15',     border: 'border-emerald/40' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/15',      border: 'border-purple/40' },
}

function getCatStyle(cat: string) {
  return CATEGORY_COLOR[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── Alignment meter ──────────────────────────────────────────────────────────

function AlignmentBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' }) {
  const color =
    pct >= 80 ? 'bg-emerald' :
    pct >= 65 ? 'bg-for-500' :
    pct >= 50 ? 'bg-gold' :
    'bg-against-500'

  const textColor =
    pct >= 80 ? 'text-emerald' :
    pct >= 65 ? 'text-for-400' :
    pct >= 50 ? 'text-gold' :
    'text-against-400'

  const label =
    pct >= 80 ? 'Highly aligned' :
    pct >= 65 ? 'Well aligned' :
    pct >= 50 ? 'Moderately aligned' :
    'Divergent views'

  return (
    <div className={cn('space-y-1', size === 'sm' && 'space-y-0.5')}>
      <div className="flex items-center justify-between">
        <span className={cn('font-mono font-bold', textColor, size === 'sm' ? 'text-sm' : 'text-lg')}>
          {pct}%
        </span>
        <span className={cn('font-mono', textColor, size === 'sm' ? 'text-[10px]' : 'text-xs')}>
          {label}
        </span>
      </div>
      <div className={cn('w-full rounded-full bg-surface-300', size === 'sm' ? 'h-1' : 'h-1.5')}>
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Delegate card ────────────────────────────────────────────────────────────

function DelegateCard({
  rec,
  rank,
  onDelegate,
}: {
  rec: RecommendedDelegate
  rank: number
  onDelegate: (id: string) => void
}) {
  const [delegating, setDelegating] = useState(false)
  const [delegated, setDelegated] = useState(rec.already_delegating)

  const archetype = rec.civic_archetype
    ? ARCHETYPE_CONFIG[rec.civic_archetype as keyof typeof ARCHETYPE_CONFIG]
    : null

  async function handleDelegate(e: React.MouseEvent) {
    e.preventDefault()
    if (delegating || delegated) return
    setDelegating(true)
    try {
      const res = await fetch('/api/delegation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegate_id: rec.id }),
      })
      if (res.ok) {
        setDelegated(true)
        onDelegate(rec.id)
      }
    } catch {
      // best-effort
    } finally {
      setDelegating(false)
    }
  }

  const topCats = rec.categories.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl border p-5 transition-colors',
        'bg-surface-100',
        rec.alignment_pct >= 80
          ? 'border-emerald/30 hover:border-emerald/50'
          : rec.alignment_pct >= 65
          ? 'border-for-500/30 hover:border-for-500/50'
          : 'border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Top row: rank + avatar + name + badge */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-surface-200 text-xs font-mono font-bold text-surface-500 mt-0.5">
          {rank}
        </div>

        <Link href={`/profile/${rec.username}`} className="flex items-center gap-3 flex-1 min-w-0 group">
          <Avatar
            src={rec.avatar_url}
            fallback={rec.display_name || rec.username}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
              {rec.display_name || rec.username}
            </p>
            <p className="text-xs text-surface-500 truncate">@{rec.username}</p>
            {archetype && (
              <p className={cn('text-[10px] font-mono mt-0.5 truncate', archetype.color)}>
                {archetype.name}
              </p>
            )}
          </div>
        </Link>

        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <Badge variant={rec.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
            {rec.role}
          </Badge>
          {rec.trusted_by > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-surface-500">
              <Users className="h-2.5 w-2.5" />
              <span>{rec.trusted_by} trust</span>
            </div>
          )}
        </div>
      </div>

      {/* Alignment bar */}
      <div className="mb-4">
        <AlignmentBar pct={rec.alignment_pct} />
        <p className="text-[11px] text-surface-500 mt-1">
          On {rec.topics_in_common} shared topic{rec.topics_in_common !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Category breakdown */}
      {topCats.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-600">By category</p>
          <div className="flex flex-wrap gap-1.5">
            {topCats.map((cat) => {
              const style = getCatStyle(cat.category)
              return (
                <div
                  key={cat.category}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono',
                    style.bg, style.border, style.text
                  )}
                  title={`${cat.alignment_pct}% aligned on ${cat.count} ${cat.category} topics`}
                >
                  {cat.category}
                  <span className="opacity-70">· {cat.alignment_pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1 text-xs text-gold">
          <TrendingUp className="h-3 w-3" />
          <span>{rec.clout.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-surface-500">
          <BarChart2 className="h-3 w-3" />
          <span>{rec.total_votes.toLocaleString()} votes</span>
        </div>
        {rec.vote_streak > 0 && (
          <div className="flex items-center gap-1 text-xs text-against-400">
            <Flame className="h-3 w-3" />
            <span>{rec.vote_streak}d streak</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {delegated ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald/10 border border-emerald/30 text-emerald text-xs font-mono">
            <Check className="h-3.5 w-3.5" />
            <span>Delegating globally</span>
          </div>
        ) : (
          <button
            onClick={handleDelegate}
            disabled={delegating}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all',
              'bg-for-600/20 border border-for-600/40 text-for-300',
              'hover:bg-for-600/30 hover:text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
            )}
          >
            {delegating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Delegate globally
          </button>
        )}
        <Link
          href={`/profile/${rec.username}`}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono',
            'bg-surface-200 border border-surface-300 text-surface-500',
            'hover:bg-surface-300 hover:text-white transition-all',
          )}
        >
          View profile
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-6 w-20 rounded-lg" />
        <Skeleton className="h-6 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function FindDelegateClient() {
  const router = useRouter()
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null)

  const load = useCallback(async (cat: Category | null) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/delegation/recommendations?${params}`)
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load recommendations')
      const json = await res.json() as RecommendationsResponse
      setData(json)
    } catch {
      setError('Could not load delegate recommendations. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load(categoryFilter) }, [load, categoryFilter])

  function handleDelegate(id: string) {
    if (!data) return
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        recommendations: prev.recommendations.map((r) =>
          r.id === id ? { ...r, already_delegating: true } : r
        ),
      }
    })
  }

  const hasEnoughVotes = data ? data.my_vote_count >= 5 : true

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-for-400" />
              <h1 className="text-xl font-bold text-white font-mono">Find a Delegate</h1>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Citizens who vote most like you — ranked by alignment
            </p>
          </div>
          <button
            onClick={() => load(categoryFilter)}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-for-500/5 border border-for-500/20 mb-6">
          <Info className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-surface-500 space-y-1">
            <p className="text-for-300 font-medium">How this works</p>
            <p>
              We compare your vote history with active citizens to find who votes most like you.
              Delegate globally so they represent you on any topic, or set up topic or category
              delegations from <Link href="/delegate" className="text-for-400 hover:text-for-300 underline decoration-for-400/40">your delegation page</Link>.
            </p>
          </div>
        </div>

        {/* Category filter */}
        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-3">
            <Shield className="h-3.5 w-3.5 text-surface-500" />
            <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Filter by category
            </p>
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter(null)}
                className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const style = getCatStyle(cat)
              const isActive = categoryFilter === cat
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(isActive ? null : cat)}
                  aria-pressed={isActive}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                    isActive
                      ? `${style.bg} ${style.border} ${style.text}`
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Not enough votes notice */}
        {!loading && !hasEnoughVotes && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gold/10 border border-gold/30 mb-6">
            <Info className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-gold font-medium mb-0.5">Vote more to unlock personalized recommendations</p>
              <p className="text-surface-500">
                Cast at least 5 votes to unlock alignment scoring. Right now you have {data?.my_vote_count ?? 0} vote{data?.my_vote_count !== 1 ? 's' : ''}.
                We&apos;re showing the most active citizens instead.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-against-500/10 border border-against-500/30 mb-6">
            <X className="h-4 w-4 text-against-400 flex-shrink-0" />
            <p className="text-sm text-against-300">{error}</p>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : data?.recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 flex items-center justify-center mb-4">
              <Users className="h-5 w-5 text-surface-500" />
            </div>
            <p className="text-surface-500 text-sm font-medium mb-1">No matches found</p>
            <p className="text-surface-600 text-xs max-w-xs">
              {categoryFilter
                ? `No citizens have enough overlapping ${categoryFilter} votes to score. Try removing the filter.`
                : 'Cast more votes to unlock personalized delegate recommendations.'}
            </p>
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter(null)}
                className="mt-4 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {(data?.recommendations ?? []).map((rec, i) => (
                <DelegateCard
                  key={rec.id}
                  rec={rec}
                  rank={i + 1}
                  onDelegate={handleDelegate}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer links */}
        {!loading && (data?.recommendations.length ?? 0) > 0 && (
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              href="/delegate"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Zap className="h-3 w-3" />
              Manage delegations
            </Link>
            <span className="text-surface-700">·</span>
            <Link
              href="/delegate/guide"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Info className="h-3 w-3" />
              How delegation works
            </Link>
            <span className="text-surface-700">·</span>
            <Link
              href="/leaderboard/delegates"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <TrendingUp className="h-3 w-3" />
              Top delegates
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
