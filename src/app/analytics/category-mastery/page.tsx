'use client'

/**
 * /analytics/category-mastery — Civic Category Mastery
 *
 * RPG-style progression system showing mastery levels across all 10
 * civic categories. Each category earns XP from votes, arguments,
 * quality scores, law wins, and debate participation.
 *
 * Levels: Novice → Apprentice → Journeyman → Specialist → Expert → Master
 *
 * Distinct from:
 *   /analytics/territory  — category × scope coverage grid
 *   /analytics/tags       — tag-level engagement
 *   /analytics/rhetoric   — writing style analysis
 *   /analytics/topics     — topic list by category
 *   /analytics/depth      — engagement depth scoring
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  ChevronRight,
  Coins,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CategoryMastery,
  CategoryMasteryResponse,
  MasteryLevel,
} from '@/app/api/analytics/category-mastery/route'

// ─── Category icons ───────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, typeof BarChart2> = {
  Economics:   Coins,
  Politics:    Gavel,
  Technology:  Zap,
  Science:     Brain,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Flame,
  Health:      Shield,
  Environment: TrendingUp,
  Education:   Star,
}

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<MasteryLevel, {
  color: string
  border: string
  bg: string
  ring: string
  badge: string
  icon: typeof Trophy
}> = {
  novice:      { color: 'text-surface-500',  border: 'border-surface-400/40',   bg: 'bg-surface-300/30',    ring: 'ring-surface-400/20',    badge: 'bg-surface-300/40 text-surface-400',    icon: Shield },
  apprentice:  { color: 'text-for-400',      border: 'border-for-500/40',       bg: 'bg-for-500/10',        ring: 'ring-for-500/20',        badge: 'bg-for-500/20 text-for-300',            icon: Star },
  journeyman:  { color: 'text-emerald',      border: 'border-emerald/40',       bg: 'bg-emerald/10',        ring: 'ring-emerald/20',        badge: 'bg-emerald/20 text-emerald',            icon: TrendingUp },
  specialist:  { color: 'text-purple',       border: 'border-purple/40',        bg: 'bg-purple/10',         ring: 'ring-purple/20',         badge: 'bg-purple/20 text-purple',              icon: Brain },
  expert:      { color: 'text-gold',         border: 'border-gold/40',          bg: 'bg-gold/10',           ring: 'ring-gold/20',           badge: 'bg-gold/20 text-gold',                  icon: Award },
  master:      { color: 'text-against-300',  border: 'border-against-400/50',   bg: 'bg-against-500/10',    ring: 'ring-against-400/30',    badge: 'bg-against-500/20 text-against-300',    icon: Crown },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function XpBar({ xp, max, color }: { xp: number; max: number; color: string }) {
  const pct = max === 0 ? 100 : Math.min(100, Math.round((xp / max) * 100))
  return (
    <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  )
}

function StatPill({ icon: Icon, value, label, color }: {
  icon: typeof Trophy
  value: number | string
  label: string
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3 w-3 flex-shrink-0', color)} />
      <span className="text-[11px] font-mono font-semibold text-white">{value}</span>
      <span className="text-[10px] font-mono text-surface-500">{label}</span>
    </div>
  )
}

// ─── Category mastery card ────────────────────────────────────────────────────

function MasteryCard({
  cat,
  expanded,
  onToggle,
}: {
  cat: CategoryMastery
  expanded: boolean
  onToggle: () => void
}) {
  const cfg = LEVEL_CONFIG[cat.level]
  const CategoryIcon = CATEGORY_ICONS[cat.category] ?? BarChart2
  const LevelIcon = cfg.icon
  const isMaster = cat.level === 'master'

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border transition-all cursor-pointer',
        cfg.border,
        cfg.bg,
        'hover:brightness-110',
        expanded && cn('ring-1', cfg.ring)
      )}
      onClick={onToggle}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        {/* Category icon box */}
        <div
          className="flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0"
          style={{ borderColor: `${cat.color}30`, backgroundColor: `${cat.color}10` }}
        >
          <CategoryIcon className="h-5 w-5" style={{ color: cat.color }} />
        </div>

        {/* Middle: name + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono font-bold text-white">{cat.category}</span>
            {/* Level badge */}
            <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full', cfg.badge)}>
              {cat.levelLabel.toUpperCase()}
            </span>
            {isMaster && (
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="text-against-400"
              >
                ✦
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <XpBar xp={cat.currentLevelXp} max={cat.nextLevelXp} color={cat.color} />
            <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
              {isMaster ? 'MAX' : `${cat.currentLevelXp} / ${cat.nextLevelXp} XP`}
            </span>
          </div>
        </div>

        {/* Right: XP + icon */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className={cn('text-sm font-mono font-bold', cfg.color)}>{cat.xp.toLocaleString()}</div>
            <div className="text-[9px] font-mono text-surface-500">XP</div>
          </div>
          <LevelIcon className={cn('h-4 w-4', cfg.color)} />
        </div>
      </div>

      {/* Expanded stats */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-300/30 pt-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-4">
                <StatPill icon={Scale} value={cat.votes} label="votes" color="text-for-400" />
                <StatPill icon={MessageSquare} value={cat.arguments} label="arguments" color="text-purple" />
                <StatPill icon={Gavel} value={cat.lawWins} label="law wins" color="text-gold" />
                <StatPill icon={ThumbsUp} value={cat.totalUpvotes} label="upvotes recv." color="text-emerald" />
                {cat.debates > 0 && (
                  <StatPill icon={Mic} value={cat.debates} label="debates" color="text-against-400" />
                )}
                {cat.avgQualityScore !== null && (
                  <StatPill icon={Brain} value={`${cat.avgQualityScore}/10`} label="avg quality" color="text-for-300" />
                )}
                {cat.topGrade && (
                  <StatPill icon={Award} value={`Grade ${cat.topGrade}`} label="best arg" color="text-gold" />
                )}
                {cat.aGradeArgs > 0 && (
                  <StatPill icon={Trophy} value={cat.aGradeArgs} label="A-grade args" color="text-emerald" />
                )}
              </div>

              {/* Level description */}
              <p className="text-xs font-mono text-surface-400 mb-3 leading-relaxed">
                {cat.levelDescription}
              </p>

              {/* What earns XP */}
              {cat.level !== 'master' && (
                <div className="text-[10px] font-mono text-surface-500 bg-surface-200/50 rounded-xl px-3 py-2 mb-3">
                  <span className="text-surface-400 font-semibold">Earn more XP:</span>{' '}
                  Vote (+1 XP) · Argument (+10 XP) · Law win (+5 XP) · Upvote recv (+2 XP) · A-grade arg (+25 XP) · Debate (+15 XP)
                </div>
              )}

              {/* CTA */}
              <Link
                href={`/topics?category=${cat.category}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 text-surface-300 hover:text-white transition-all"
              >
                <ExternalLink className="h-3 w-3" />
                Browse {cat.category} debates
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200 p-3 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-3 w-8 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SortMode = 'xp' | 'level' | 'category'

export default function CategoryMasteryPage() {
  const router = useRouter()
  const [data, setData] = useState<CategoryMasteryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('xp')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/category-mastery', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as CategoryMasteryResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const sorted = data
    ? [...data.categories].sort((a, b) => {
        if (sortMode === 'xp') return b.xp - a.xp
        if (sortMode === 'level') {
          const LEVEL_ORDER = ['novice', 'apprentice', 'journeyman', 'specialist', 'expert', 'master']
          return LEVEL_ORDER.indexOf(b.level) - LEVEL_ORDER.indexOf(a.level) || b.xp - a.xp
        }
        return a.category.localeCompare(b.category)
      })
    : []

  // Overall progress
  const overallPct = data
    ? Math.round((sorted.filter((c) => c.level !== 'novice').length / sorted.length) * 100)
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Trophy className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Category Mastery</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Level up across 10 civic categories through votes, arguments, and debate
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors flex-shrink-0 mt-0.5 disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <EmptyState
            icon={Trophy}
            iconColor="text-surface-400"
            title="Could not load mastery data"
            description="Check your connection and try again."
            actions={[{ label: 'Retry', onClick: fetchData }]}
          />
        ) : !data ? null : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* ── Overall stats strip ──────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-white">
                      {data.overallLevelLabel}
                    </span>
                    <span className={cn(
                      'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full',
                      LEVEL_CONFIG[data.overallLevel].badge
                    )}>
                      {data.overallXp.toLocaleString()} XP
                    </span>
                  </div>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Overall civic mastery • {data.masteredCount} expert+ categor{data.masteredCount === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-gold" />
                  <span className="text-2xl font-mono font-bold text-gold">
                    {overallPct}%
                  </span>
                </div>
              </div>

              {/* Stat grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 text-center">
                  <div className="text-lg font-mono font-bold text-for-400">{data.totalVotes.toLocaleString()}</div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">Total Votes</div>
                </div>
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 text-center">
                  <div className="text-lg font-mono font-bold text-purple">{data.totalArguments.toLocaleString()}</div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">Arguments</div>
                </div>
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 text-center">
                  <div className="text-lg font-mono font-bold text-gold">{data.totalLawWins.toLocaleString()}</div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">Law Wins</div>
                </div>
              </div>

              {/* Top / weakest category callouts */}
              {(data.topCategory || data.weakestCategory) && (
                <div className="grid grid-cols-2 gap-3">
                  {data.topCategory && (
                    <div className="flex items-center gap-2 rounded-xl bg-surface-200/60 border border-gold/20 px-3 py-2">
                      <Crown className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">Strongest</div>
                        <div className="text-xs font-mono font-bold text-white truncate">{data.topCategory}</div>
                      </div>
                    </div>
                  )}
                  {data.weakestCategory && (
                    <div className="flex items-center gap-2 rounded-xl bg-surface-200/60 border border-for-500/20 px-3 py-2">
                      <TrendingUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">Grow here</div>
                        <div className="text-xs font-mono font-bold text-white truncate">{data.weakestCategory}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── XP guide strip ────────────────────────────────────────────── */}
            <div className="rounded-xl bg-surface-100/60 border border-surface-300/60 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-3 w-3 text-gold" />
                <span className="text-[10px] font-mono font-bold text-surface-400 uppercase tracking-wide">How XP is earned</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {[
                  ['Vote cast', '+1 XP'],
                  ['Law win vote', '+5 XP'],
                  ['Argument posted', '+10 XP'],
                  ['Debate participation', '+15 XP'],
                  ['B-grade argument', '+10 XP bonus'],
                  ['A-grade argument', '+25 XP bonus'],
                  ['Upvote received', '+2 XP each'],
                ].map(([label, xp]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-surface-500">{label}</span>
                    <span className="text-[10px] font-mono font-bold text-emerald">{xp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sort controls ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mr-1">Sort:</span>
              {(['xp', 'level', 'category'] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={cn(
                    'text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg border transition-all',
                    sortMode === mode
                      ? 'bg-for-600 border-for-500/50 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                  )}
                >
                  {mode === 'xp' ? 'By XP' : mode === 'level' ? 'By Level' : 'A–Z'}
                </button>
              ))}
            </div>

            {/* ── Level legend ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.entries(LEVEL_CONFIG) as [MasteryLevel, typeof LEVEL_CONFIG[MasteryLevel]][]).map(([level, cfg]) => (
                <span key={level} className={cn('text-[9px] font-mono font-bold px-2 py-0.5 rounded-full', cfg.badge)}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </span>
              ))}
            </div>

            {/* ── Category cards ─────────────────────────────────────────────── */}
            <div className="space-y-3">
              {sorted.map((cat, idx) => (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                >
                  <MasteryCard
                    cat={cat}
                    expanded={expandedCat === cat.category}
                    onToggle={() => setExpandedCat(
                      expandedCat === cat.category ? null : cat.category
                    )}
                  />
                </motion.div>
              ))}
            </div>

            {/* ── Navigation ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link
                href="/analytics/territory"
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-surface-400 transition-colors"
              >
                <div>
                  <div className="text-xs font-mono font-bold text-white">Territory Map</div>
                  <div className="text-[10px] font-mono text-surface-500">Category × scope coverage</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              </Link>
              <Link
                href="/analytics/rhetoric"
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-surface-400 transition-colors"
              >
                <div>
                  <div className="text-xs font-mono font-bold text-white">Rhetoric Style</div>
                  <div className="text-[10px] font-mono text-surface-500">How you write arguments</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              </Link>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
