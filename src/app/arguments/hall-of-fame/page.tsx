'use client'

/**
 * /arguments/hall-of-fame — The Civic Arguments Hall of Fame
 *
 * A prestige showcase of the most impactful arguments in Lobby Market
 * history — those that earned top AI grades on topics that became law.
 *
 * Two wings:
 *   Law Architects — FOR (blue) arguments on winning topics that became law.
 *     These are the arguments that helped build the Lobby's legislative record.
 *   Noble Dissent  — AGAINST (red) arguments on topics that became law despite
 *     opposition. The best cases made for a side that lost but argued well.
 *
 * Distinct from:
 *   /arguments/top-scored — all arguments by AI score, regardless of outcome
 *   /arguments/champions  — users ranked by faceoff win rate
 *   /spotlight            — weekly platform highlights (not argument-focused)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  Brain,
  ChevronDown,
  Crown,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HallArgument, HallResponse, HallTab } from '@/app/api/arguments/hall-of-fame/route'

// ─── Grade badge ──────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { label: string; className: string; icon: typeof Star }> = {
  A: { label: 'Grade A', className: 'bg-gold/15 text-gold border-gold/30', icon: Crown },
  B: { label: 'Grade B', className: 'bg-emerald/15 text-emerald border-emerald/30', icon: Star },
  C: { label: 'Grade C', className: 'bg-for-500/15 text-for-400 border-for-500/30', icon: Brain },
  D: { label: 'Grade D', className: 'bg-surface-300/50 text-surface-500 border-surface-400/30', icon: Brain },
  F: { label: 'Grade F', className: 'bg-against-500/10 text-against-400 border-against-500/30', icon: Brain },
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG.C
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Category pill helpers ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-400 border-against-500/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Health:      'bg-for-500/10 text-for-400 border-for-500/30',
  Society:     'bg-gold/10 text-gold border-gold/30',
  Law:         'bg-gold/10 text-gold border-gold/30',
}
function catClass(cat: string | null) {
  if (!cat) return 'bg-surface-300/40 text-surface-500 border-surface-400/30'
  return CATEGORY_COLORS[cat] ?? 'bg-surface-300/40 text-surface-500 border-surface-400/30'
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const mo = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (y >= 1) return `${y}y ago`
  if (mo >= 1) return `${mo}mo ago`
  if (d >= 1) return `${d}d ago`
  return 'today'
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  tab,
  index,
}: {
  arg: HallArgument
  tab: HallTab
  index: number
}) {
  const isArchitect = tab === 'architects'
  const rankColor =
    index === 0
      ? 'text-gold'
      : index === 1
        ? 'text-surface-600'
        : index === 2
          ? 'text-amber-600'
          : 'text-surface-500'

  const sideBg = isArchitect
    ? 'border-for-500/20 bg-for-950/20'
    : 'border-against-500/20 bg-against-950/20'
  const sideAccent = isArchitect ? 'bg-for-500' : 'bg-against-500'

  const forPct = Math.round(arg.topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.35 }}
      className={cn(
        'relative rounded-2xl border p-5 space-y-4 transition-colors hover:border-surface-400/60',
        'bg-surface-100/60',
        index < 3 ? sideBg : 'border-surface-300/50',
      )}
    >
      {/* Accent bar */}
      <div className={cn('absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full', sideAccent)} />

      {/* Rank + grade row */}
      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-mono font-bold w-6 text-right flex-shrink-0', rankColor)}>
            #{index + 1}
          </span>
          <Link
            href={`/profile/${arg.author?.username ?? ''}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
          >
            <Avatar
              src={arg.author?.avatar_url ?? null}
              username={arg.author?.username ?? '?'}
              size="sm"
              className="flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {arg.author?.display_name ?? arg.author?.username ?? 'Unknown'}
              </p>
              {arg.author?.username && (
                <p className="text-xs text-surface-500">@{arg.author.username}</p>
              )}
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <GradeBadge grade={arg.ai_grade} />
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
              isArchitect
                ? 'bg-for-500/15 text-for-400 border-for-500/30'
                : 'bg-against-500/10 text-against-400 border-against-500/30',
            )}
          >
            {isArchitect ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            {isArchitect ? 'FOR' : 'AGAINST'}
          </span>
        </div>
      </div>

      {/* Argument text */}
      <div className="pl-3">
        <blockquote className="text-sm text-surface-700 leading-relaxed line-clamp-4 italic border-l-2 border-surface-400/30 pl-3">
          &ldquo;{arg.content}&rdquo;
        </blockquote>
      </div>

      {/* Topic context */}
      {arg.topic && (
        <div className="pl-3">
          <Link
            href={`/topic/${arg.topic_id}`}
            className="group block rounded-xl border border-surface-300/40 bg-surface-200/40 p-3 hover:border-surface-400/60 transition-colors"
          >
            <div className="flex items-start gap-2">
              <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-surface-500 font-medium uppercase tracking-wide mb-1">
                  Established Law
                </p>
                <p className="text-sm text-white font-medium line-clamp-2 group-hover:text-for-400 transition-colors">
                  {arg.topic.statement}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {arg.topic.category && (
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded-md border font-medium',
                        catClass(arg.topic.category),
                      )}
                    >
                      {arg.topic.category}
                    </span>
                  )}
                  <span className="text-xs text-surface-500">
                    {forPct}% For · {againstPct}% Against
                  </span>
                  {arg.topic.total_votes > 0 && (
                    <span className="text-xs text-surface-500">
                      {arg.topic.total_votes.toLocaleString()} votes
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pl-3">
        <div className="flex items-center gap-3 text-xs text-surface-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes.toLocaleString()} upvotes
          </span>
          {arg.ai_score != null && (
            <span className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              {arg.ai_score}/10
            </span>
          )}
          <span>{relativeTime(arg.created_at)}</span>
        </div>
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <div className="rounded-xl border border-surface-300/30 p-3 space-y-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS: { id: HallTab; label: string; icon: typeof Trophy; description: string }[] = [
  {
    id: 'architects',
    label: 'Law Architects',
    icon: Trophy,
    description: 'FOR arguments that helped debates become law',
  },
  {
    id: 'dissent',
    label: 'Noble Dissent',
    icon: Shield,
    description: 'AGAINST arguments that earned respect in defeat',
  },
]

const PAGE_SIZE = 24

export default function HallOfFamePage() {
  const [tab, setTab] = useState<HallTab>('architects')
  const [category, setCategory] = useState<string>('all')
  const [args, setArgs] = useState<HallArgument[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetchArgs = useCallback(
    async (tab_: HallTab, cat: string, off: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          tab: tab_,
          category: cat,
          limit: String(PAGE_SIZE),
          offset: String(off),
        })
        const res = await fetch(`/api/arguments/hall-of-fame?${params}`)
        if (!res.ok) throw new Error('Failed to load')
        const data: HallResponse = await res.json()

        if (append) {
          setArgs((prev) => [...prev, ...data.arguments])
        } else {
          setArgs(data.arguments)
          setCategories(data.categories)
        }
        setTotal(data.total)
        setOffset(off + data.arguments.length)
      } catch (_e) {
        setError('Failed to load the Hall of Fame. Please try again.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    setOffset(0)
    fetchArgs(tab, category, 0, false)
  }, [tab, category, fetchArgs])

  const loadMore = () => {
    if (!loadingMore && args.length < total) {
      fetchArgs(tab, category, offset, true)
    }
  }

  const handleTabChange = (newTab: HallTab) => {
    if (newTab === tab) return
    setTab(newTab)
    setCategory('all')
    setArgs([])
  }

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    setArgs([])
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 pb-24 pt-4 md:pt-8">
        <div className="mx-auto max-w-3xl px-4 space-y-8">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4 py-6"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Award className="h-6 w-6 text-gold" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Hall of Fame
            </h1>
            <p className="text-surface-500 max-w-xl mx-auto text-sm leading-relaxed">
              The most impactful arguments in Lobby Market history — those that earned top marks
              on debates that shaped the Lobby&apos;s laws. These arguments moved the needle.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-surface-500">
              <Gavel className="h-3.5 w-3.5 text-gold" />
              <span>Arguments from established laws only</span>
              <span>·</span>
              <Zap className="h-3.5 w-3.5 text-gold" />
              <span>Ranked by quality + upvotes</span>
            </div>
          </motion.div>

          {/* Tab switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-surface-200/60 border border-surface-300/40">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = t.id === tab
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-all text-center',
                    active
                      ? t.id === 'architects'
                        ? 'bg-for-600 text-white shadow-lg shadow-for-900/40'
                        : 'bg-against-600 text-white shadow-lg shadow-against-900/40'
                      : 'text-surface-500 hover:text-white hover:bg-surface-300/40',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span className={cn('text-xs leading-tight', active ? 'opacity-80' : 'opacity-60')}>
                    {t.description}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Category filters */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCategoryChange('all')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  category === 'all'
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-surface-500 border-surface-400/30 hover:border-surface-400/60 hover:text-white',
                )}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    category === cat
                      ? cn('border', catClass(cat))
                      : 'text-surface-500 border-surface-400/30 hover:border-surface-400/60 hover:text-white',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Stats bar */}
          {!loading && args.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm text-surface-500"
            >
              <Scale className="h-4 w-4 text-gold" />
              <span>
                {total > 0 ? (
                  <>
                    <span className="text-white font-semibold">{total.toLocaleString()}</span>{' '}
                    {tab === 'architects' ? 'law-shaping arguments' : 'dissenting arguments'}{' '}
                    {category !== 'all' && `in ${category}`}
                  </>
                ) : (
                  'No arguments found'
                )}
              </span>
            </motion.div>
          )}

          {/* Argument list */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-against-500/20 bg-against-950/10 p-6 text-center space-y-3">
              <p className="text-against-400 font-medium">{error}</p>
              <button
                onClick={() => fetchArgs(tab, category, 0, false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 text-white text-sm font-medium hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : args.length === 0 ? (
            <EmptyState
              icon={Award}
              iconColor="text-gold"
              iconBg="bg-gold/10"
              iconBorder="border-gold/20"
              title={
                tab === 'architects'
                  ? 'No law-architect arguments yet'
                  : 'No noble dissent recorded yet'
              }
              description={
                tab === 'architects'
                  ? 'As debates become laws, the best FOR arguments will be enshrined here.'
                  : 'When debates resolve, the highest-quality AGAINST arguments will be honoured here.'
              }
              actions={[
                { label: 'Browse debates', href: '/', variant: 'primary' },
                { label: 'Write an argument', href: '/topics', variant: 'secondary' },
              ]}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${tab}-${category}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {args.map((arg, i) => (
                  <ArgumentCard key={arg.id} arg={arg} tab={tab} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Load more */}
          {!loading && args.length < total && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface-200 border border-surface-300/60 text-white text-sm font-medium hover:bg-surface-300 transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load more ({total - args.length} remaining)
                  </>
                )}
              </button>
            </div>
          )}

          {/* Navigation links */}
          <div className="pt-4 border-t border-surface-300/40 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/arguments', label: 'All Arguments', icon: Scale },
              { href: '/arguments/top-scored', label: 'Top Scored', icon: Brain },
              { href: '/arguments/champions', label: 'Champions', icon: Trophy },
              { href: '/arguments/daily', label: 'Daily Argument', icon: Award },
              { href: '/law', label: 'Law Codex', icon: Gavel },
              { href: '/arguments/faceoff', label: 'Argument Faceoff', icon: Zap },
            ].map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-100/50 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
                >
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  <span className="text-xs font-medium text-surface-500 group-hover:text-white transition-colors">
                    {link.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
