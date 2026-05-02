'use client'

/**
 * /wisdom — The Elder Council's Wisdom Feed
 *
 * A curated feed of the most compelling arguments from Lobby Market's
 * most respected members — Elders, Senators, Lawmakers, and veteran Debators.
 * Learn from those who've shaped the platform's consensus most deeply.
 *
 * Distinct from:
 *  - /arguments       (all-time top arguments from anyone)
 *  - /arguments/trending (recent velocity, not author credibility)
 *  - /gallery         (masonry card view, not filtered by author authority)
 *  - /leaderboard     (user rankings, not individual arguments)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  Loader2,
  Quote,
  RefreshCw,
  Scale,
  Shield,
  SortAsc,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { WisdomArgument, WisdomResponse } from '@/app/api/wisdom/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const TIERS = [
  { id: 'all',      label: 'All Veterans',  icon: Shield,  color: 'text-surface-400' },
  { id: 'veteran',  label: 'Lawmakers+',    icon: Award,   color: 'text-gold' },
  { id: 'elder',    label: 'Elders Only',   icon: Crown,   color: 'text-purple' },
] as const
type Tier = (typeof TIERS)[number]['id']

const SIDES = [
  { id: 'all',     label: 'Both Sides' },
  { id: 'for',     label: 'FOR',     color: 'text-for-400' },
  { id: 'against', label: 'AGAINST', color: 'text-against-400' },
] as const

const SORTS = [
  { id: 'upvotes',   label: 'Most Upvoted', icon: ThumbsUp },
  { id: 'citations', label: 'Most Cited',   icon: ExternalLink },
  { id: 'recent',    label: 'Most Recent',  icon: Zap },
] as const

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_META: Record<string, {
  label: string
  icon: typeof Crown
  color: string
  bg: string
  border: string
}> = {
  elder:        { label: 'Elder',        icon: Crown,  color: 'text-gold',    bg: 'bg-gold/10',    border: 'border-gold/40' },
  senator:      { label: 'Senator',      icon: Star,   color: 'text-purple',  bg: 'bg-purple/10',  border: 'border-purple/40' },
  lawmaker:     { label: 'Lawmaker',     icon: Gavel,  color: 'text-gold',    bg: 'bg-gold/15',    border: 'border-gold/50' },
  troll_catcher:{ label: 'Troll Catcher',icon: Shield, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/40' },
  debator:      { label: 'Debator',      icon: Flame,  color: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/40' },
}

function getRoleMeta(role: string) {
  return ROLE_META[role] ?? {
    label: 'Citizen',
    icon: Shield,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-400',
  }
}

// ─── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtNum(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function WisdomSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-surface-300/50 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 bg-surface-300/50 rounded" />
              <div className="h-3 w-20 bg-surface-300/40 rounded" />
            </div>
            <div className="h-5 w-16 bg-surface-300/40 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-surface-300/40 rounded" />
            <div className="h-4 w-5/6 bg-surface-300/40 rounded" />
            <div className="h-4 w-4/6 bg-surface-300/40 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-24 bg-surface-300/40 rounded" />
            <div className="h-3 w-16 bg-surface-300/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function WisdomCard({ arg, index }: { arg: WisdomArgument; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const isFor = arg.side === 'blue'
  const role = arg.author?.role ?? 'person'
  const roleMeta = getRoleMeta(role)
  const RoleIcon = roleMeta.icon
  const catColor = CATEGORY_COLORS[arg.topic?.category ?? ''] ?? 'text-surface-400'
  const isLong = arg.content.length > 280

  const displayContent = isLong && !expanded
    ? arg.content.slice(0, 280) + '…'
    : arg.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      className={cn(
        'group rounded-2xl border p-5 space-y-4 transition-all',
        'bg-surface-100 hover:bg-surface-100/80',
        isFor
          ? 'border-for-600/20 hover:border-for-600/40'
          : 'border-against-600/20 hover:border-against-600/40'
      )}
    >
      {/* Author row */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${arg.author?.username ?? ''}`} className="flex-shrink-0">
          <Avatar
            src={arg.author?.avatar_url ?? null}
            fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
            size="md"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${arg.author?.username ?? ''}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {arg.author?.display_name ?? arg.author?.username ?? 'Unknown'}
            </Link>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border flex-shrink-0',
              roleMeta.bg, roleMeta.border, roleMeta.color
            )}>
              <RoleIcon className="h-2.5 w-2.5" />
              {roleMeta.label}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            @{arg.author?.username} · {relativeTime(arg.created_at)}
          </p>
        </div>

        {/* Side badge */}
        <div className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border',
          isFor
            ? 'bg-for-600/15 border-for-600/30 text-for-300'
            : 'bg-against-600/15 border-against-600/30 text-against-300'
        )}>
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </div>
      </div>

      {/* Quote content */}
      <div className="relative pl-4 border-l-2 border-surface-400/30">
        <Quote className={cn(
          'absolute -left-1 -top-1 h-4 w-4 opacity-30',
          isFor ? 'text-for-400' : 'text-against-400'
        )} />
        <p className="text-sm text-white/90 leading-relaxed font-mono">
          {displayContent}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" /> Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3" /> Read full argument</>
            )}
          </button>
        )}
      </div>

      {/* Topic context */}
      {arg.topic && (
        <Link
          href={`/topic/${arg.topic_id}`}
          className="block rounded-xl bg-surface-200/60 border border-surface-300/60 px-3.5 py-2.5 hover:border-surface-400/60 transition-colors"
        >
          <div className="flex items-start gap-2">
            <Scale className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 leading-snug line-clamp-2">
                {arg.topic.statement}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {arg.topic.category && (
                  <span className={cn('text-[10px] font-mono font-semibold', catColor)}>
                    {arg.topic.category}
                  </span>
                )}
                <span className="text-[10px] text-surface-500">
                  {Math.round(arg.topic.blue_pct)}% FOR · {fmtNum(arg.topic.total_votes)} votes
                </span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
          </div>
        </Link>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-surface-500">
        <div className="flex items-center gap-1.5">
          <ThumbsUp className="h-3.5 w-3.5 text-for-500" />
          <span className="font-mono font-semibold text-white">{fmtNum(arg.upvotes)}</span>
          <span>upvotes</span>
        </div>
        {arg.citation_count > 0 && (
          <div className="flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5 text-purple" />
            <span className="font-mono font-semibold text-white">{arg.citation_count}</span>
            <span>citation{arg.citation_count !== 1 ? 's' : ''}</span>
          </div>
        )}
        {arg.author?.clout != null && arg.author.clout > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <span className="font-mono font-semibold text-gold">{fmtNum(arg.author.clout)}</span>
            <span>clout</span>
          </div>
        )}
        <Link
          href={`/arguments/${arg.id}`}
          className="ml-auto flex items-center gap-1 text-surface-500 hover:text-for-300 transition-colors"
        >
          View thread
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function WisdomPage() {
  const [args, setArgs] = useState<WisdomArgument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const [tier, setTier] = useState<Tier>('all')
  const [side, setSide] = useState('all')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('upvotes')
  const [showFilters, setShowFilters] = useState(false)

  const LIMIT = 15
  const loadingRef = useRef(false)

  const load = useCallback(async (fresh: boolean, options?: {
    tier?: Tier; side?: string; category?: string; sort?: string
  }) => {
    if (loadingRef.current) return
    loadingRef.current = true

    const currentOffset = fresh ? 0 : offset
    const currentTier = options?.tier ?? tier
    const currentSide = options?.side ?? side
    const currentCategory = options?.category ?? category
    const currentSort = options?.sort ?? sort

    if (fresh) setRefreshing(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        tier: currentTier,
        side: currentSide,
        category: currentCategory,
        sort: currentSort,
        limit: String(LIMIT),
        offset: String(currentOffset),
      })
      const res = await fetch(`/api/wisdom?${params}`)
      if (!res.ok) throw new Error('Failed to load wisdom')
      const data: WisdomResponse = await res.json()

      if (fresh) {
        setArgs(data.arguments)
        setOffset(data.arguments.length)
      } else {
        setArgs((prev) => [...prev, ...data.arguments])
        setOffset((prev) => prev + data.arguments.length)
      }
      setTotal(data.total)
      setHasMore(data.arguments.length === LIMIT)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
      loadingRef.current = false
    }
  }, [tier, side, category, sort, offset])

  // Initial load
  useEffect(() => {
    setLoading(true)
    setOffset(0)
    load(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyFilter(updates: { tier?: Tier; side?: string; category?: string; sort?: string }) {
    const next = { tier, side, category, sort, ...updates }
    if (updates.tier !== undefined) setTier(updates.tier)
    if (updates.side !== undefined) setSide(updates.side)
    if (updates.category !== undefined) setCategory(updates.category)
    if (updates.sort !== undefined) setSort(updates.sort)
    setLoading(true)
    setOffset(0)
    setArgs([])
    load(true, next)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Wisdom Feed</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Arguments from the platform&apos;s most respected voices
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Authority tier explainer pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { role: 'elder', label: 'Elder', icon: Crown, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
              { role: 'senator', label: 'Senator', icon: Star, color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
              { role: 'lawmaker', label: 'Lawmaker', icon: Gavel, color: 'text-gold', bg: 'bg-gold/15', border: 'border-gold/40' },
              { role: 'troll_catcher', label: 'Troll Catcher', icon: Shield, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
              { role: 'debator', label: 'Debator', icon: Flame, color: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/30' },
            ].map(({ role, label, icon: Icon, color, bg, border }) => (
              <div key={role} className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold border', bg, border, color)}>
                <Icon className="h-2.5 w-2.5" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-5 space-y-3">
          {/* Tier tabs */}
          <div className="flex gap-1.5 p-1 bg-surface-200/50 rounded-xl border border-surface-300/50">
            {TIERS.map((t) => {
              const TierIcon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => tier !== t.id && applyFilter({ tier: t.id as Tier })}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-mono font-semibold transition-all',
                    tier === t.id
                      ? 'bg-surface-100 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  <TierIcon className={cn('h-3 w-3', tier === t.id ? t.color : '')} />
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Expandable advanced filters */}
          <button
            onClick={() => setShowFilters((f) => !f)}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <SortAsc className="h-3.5 w-3.5" />
            Filters &amp; Sort
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {(side !== 'all' || category !== '' || sort !== 'upvotes') && (
              <span className="ml-1 px-1.5 py-0.5 bg-for-600/20 text-for-400 border border-for-600/30 rounded-full text-[9px]">
                Active
              </span>
            )}
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1 pb-2">
                  {/* Side filter */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">Side</p>
                    <div className="flex gap-1.5">
                      {SIDES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => applyFilter({ side: s.id })}
                          className={cn(
                            'px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all',
                            side === s.id
                              ? 'bg-surface-200 border-surface-400 text-white'
                              : 'border-surface-300/50 text-surface-500 hover:text-surface-300 hover:border-surface-400'
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">Sort by</p>
                    <div className="flex gap-1.5">
                      {SORTS.map((s) => {
                        const SortIcon = s.icon
                        return (
                          <button
                            key={s.id}
                            onClick={() => applyFilter({ sort: s.id })}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all',
                              sort === s.id
                                ? 'bg-surface-200 border-surface-400 text-white'
                                : 'border-surface-300/50 text-surface-500 hover:text-surface-300 hover:border-surface-400'
                            )}
                          >
                            <SortIcon className="h-3 w-3" />
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => applyFilter({ category: '' })}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all',
                          category === ''
                            ? 'bg-surface-200 border-surface-400 text-white'
                            : 'border-surface-300/50 text-surface-500 hover:text-surface-300'
                        )}
                      >
                        All
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => applyFilter({ category: cat })}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all',
                            category === cat
                              ? 'bg-surface-200 border-surface-400 text-white'
                              : 'border-surface-300/50 text-surface-500 hover:text-surface-300'
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Result count */}
        {!loading && (
          <p className="text-xs font-mono text-surface-500 mb-4">
            {args.length} of {total.toLocaleString()} wisdom arguments
          </p>
        )}

        {/* Feed */}
        {loading ? (
          <WisdomSkeleton />
        ) : args.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No wisdom found"
            description="Adjust your filters or check back when more veteran members have posted arguments."
            actions={[{ label: 'Clear filters', onClick: () => applyFilter({ tier: 'all', side: 'all', category: '', sort: 'upvotes' }) }]}
          />
        ) : (
          <div className="space-y-4">
            {args.map((arg, i) => (
              <WisdomCard key={arg.id} arg={arg} index={i} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                  ) : (
                    <>Load more wisdom</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer cTA */}
        {!loading && args.length > 0 && (
          <div className="mt-8 p-4 rounded-2xl bg-surface-100 border border-surface-300 text-center space-y-2">
            <TrendingUp className="h-5 w-5 text-gold mx-auto" />
            <p className="text-sm font-mono text-surface-400">
              Want your arguments featured here?
            </p>
            <p className="text-xs font-mono text-surface-500">
              Earn the Debator role by contributing consistently. Reach Elder status to join the council.
            </p>
            <Link
              href="/skill-tree"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors mt-1"
            >
              View skill tree
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
