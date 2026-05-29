'use client'

/**
 * /rhetoric — The Civic Rhetorician
 *
 * Analyses your argument history to reveal your dominant rhetorical style —
 * Evidence-Based, Logical, Historical, Hypothetical, Normative, or Personal
 * Voice — plus how argument length correlates with upvotes and AI scores,
 * your per-category rhetoric fingerprint, and personalised coaching tips.
 *
 * Distinct from:
 *   /analytics    — overall voting & argument stats
 *   /resonance    — cross-partisan upvote impact
 *   /conviction   — ideological consistency per category
 *   /depth        — engagement depth metrics
 *
 * Rhetoric answers: "HOW do you argue — and does it work?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Brain,
  Cpu,
  DollarSign,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Lightbulb,
  MessageSquare,
  Music2,
  Quote,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RhetoricResponse,
  RhetoricalStyle,
  StyleBreakdown,
  LengthDistribution,
  CategoryRhetoric,
  RhetoricTip,
} from '@/app/api/analytics/rhetoric/route'

// ─── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Politics:    Landmark,
  Economics:   DollarSign,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
  General:     Globe,
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-purple',
  General:     'text-surface-400',
}

// ─── Style config ─────────────────────────────────────────────────────────────

const STYLE_CONFIG: Record<RhetoricalStyle, {
  icon: React.ComponentType<{ className?: string }>
  accent: string
  bg: string
  border: string
  gradient: string
  barColor: string
}> = {
  evidence_based: {
    icon: BarChart2,
    accent: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    gradient: 'from-for-500/20 to-transparent',
    barColor: 'bg-for-500',
  },
  logical: {
    icon: Brain,
    accent: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    gradient: 'from-purple/20 to-transparent',
    barColor: 'bg-purple',
  },
  historical: {
    icon: BookOpen,
    accent: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    gradient: 'from-gold/20 to-transparent',
    barColor: 'bg-gold',
  },
  hypothetical: {
    icon: Lightbulb,
    accent: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    gradient: 'from-emerald/20 to-transparent',
    barColor: 'bg-emerald',
  },
  normative: {
    icon: Scale,
    accent: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    gradient: 'from-against-500/20 to-transparent',
    barColor: 'bg-against-500',
  },
  personal: {
    icon: Quote,
    accent: 'text-for-400',
    bg: 'bg-for-600/10',
    border: 'border-for-600/30',
    gradient: 'from-for-600/15 to-transparent',
    barColor: 'bg-for-400',
  },
}

function styleConfig(style: RhetoricalStyle) {
  return STYLE_CONFIG[style] ?? STYLE_CONFIG.logical
}

// ─── Length config ────────────────────────────────────────────────────────────

const LENGTH_CONFIG: Record<string, { color: string; barColor: string }> = {
  concise:       { color: 'text-surface-400', barColor: 'bg-surface-400' },
  standard:      { color: 'text-for-300',     barColor: 'bg-for-400'     },
  detailed:      { color: 'text-purple',      barColor: 'bg-purple'      },
  comprehensive: { color: 'text-gold',        barColor: 'bg-gold'        },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RhetoricSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

// ─── Archetype hero ───────────────────────────────────────────────────────────

function ArchetypeHero({ data }: { data: RhetoricResponse }) {
  const dominant = data.dominant_style
  const cfg = dominant ? styleConfig(dominant) : null
  const Icon = cfg ? cfg.icon : MessageSquare

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5',
        cfg ? `${cfg.bg} ${cfg.border}` : 'bg-surface-100 border-surface-300',
      )}
    >
      {cfg && (
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-30', cfg.gradient)} />
      )}
      <div className="relative flex items-start gap-4">
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl border',
          cfg ? `${cfg.bg} ${cfg.border}` : 'bg-surface-200 border-surface-300',
        )}>
          <Icon className={cn('h-7 w-7', cfg ? cfg.accent : 'text-surface-500')} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-1">
            Rhetorical Archetype
          </p>
          <h2 className={cn('text-xl font-mono font-black mb-1', cfg ? cfg.accent : 'text-white')}>
            {data.archetype ?? 'The Debater'}
          </h2>
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            {data.archetype_description ?? 'Your rhetorical style shapes the quality of civic debate.'}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="relative mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-surface-300/50">
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Arguments</p>
          <p className="text-lg font-mono font-bold text-white tabular-nums">{data.total}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Avg Length</p>
          <p className={cn('text-lg font-mono font-bold tabular-nums', cfg?.accent ?? 'text-white')}>
            {data.avg_words}w
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Style</p>
          <p className={cn('text-lg font-mono font-bold truncate', cfg?.accent ?? 'text-white')}>
            {data.dominant_style_label ?? '—'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Style breakdown card ─────────────────────────────────────────────────────

function StyleCard({ style, isDominant, index }: { style: StyleBreakdown; isDominant: boolean; index: number }) {
  const cfg = styleConfig(style.style)
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-xl border p-3 relative overflow-hidden',
        isDominant
          ? `${cfg.bg} ${cfg.border}`
          : 'bg-surface-100 border-surface-300',
      )}
    >
      {isDominant && (
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-20', cfg.gradient)} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn('h-4 w-4', isDominant ? cfg.accent : 'text-surface-500')} />
          {isDominant && (
            <span className={cn('text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full', cfg.bg, cfg.accent, cfg.border, 'border')}>
              Top
            </span>
          )}
        </div>
        <p className={cn('text-xs font-mono font-bold mb-1', isDominant ? cfg.accent : 'text-surface-300')}>
          {style.label}
        </p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-mono font-black text-white tabular-nums">{style.pct}%</span>
          <span className="text-[10px] font-mono text-surface-500 tabular-nums">{style.count}×</span>
        </div>
        {/* Bar */}
        <div className="h-1 rounded-full bg-surface-300/50 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', cfg.barColor)}
            initial={{ width: 0 }}
            animate={{ width: `${style.pct}%` }}
            transition={{ duration: 0.7, delay: index * 0.05 + 0.1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-[9px] font-mono text-surface-600 mt-1.5 tabular-nums">
          {style.avg_upvotes} avg upvotes
        </p>
      </div>
    </motion.div>
  )
}

// ─── Length distribution ──────────────────────────────────────────────────────

function LengthRow({ bracket, maxPct, index }: { bracket: LengthDistribution; maxPct: number; index: number }) {
  const cfg = LENGTH_CONFIG[bracket.bracket] ?? { color: 'text-surface-400', barColor: 'bg-surface-400' }
  const width = maxPct > 0 ? (bracket.pct / maxPct) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="grid grid-cols-[6rem_1fr_auto] items-center gap-3"
    >
      <div>
        <p className="text-xs font-mono text-surface-300 font-medium">{bracket.label}</p>
        <p className="text-[10px] font-mono text-surface-600">{bracket.wordRange}</p>
      </div>
      <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', cfg.barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.7, delay: index * 0.06 + 0.15, ease: 'easeOut' }}
        />
      </div>
      <div className="text-right min-w-[2.5rem]">
        <p className={cn('text-xs font-mono font-bold tabular-nums', cfg.color)}>{bracket.pct}%</p>
        {bracket.avg_score !== null && (
          <p className="text-[9px] font-mono text-surface-600 tabular-nums">{bracket.avg_score} score</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Category rhetoric row ────────────────────────────────────────────────────

function CategoryRow({ cat, index }: { cat: CategoryRhetoric; index: number }) {
  const Icon = CATEGORY_ICONS[cat.category] ?? Globe
  const color = CATEGORY_COLORS[cat.category] ?? 'text-surface-400'
  const styleCfg = cat.dominant_style ? styleConfig(cat.dominant_style) : null
  const StyleIcon = styleCfg?.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 py-2.5 border-b border-surface-200/50 last:border-0"
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-mono text-surface-300 font-medium">{cat.category}</p>
          {StyleIcon && cat.dominant_style && (
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold',
              styleCfg!.bg, styleCfg!.accent, styleCfg!.border, 'border',
            )}>
              <StyleIcon className="h-2.5 w-2.5" />
              {cat.dominant_style.replace('_', ' ')}
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-surface-600">
          {cat.count} arg{cat.count !== 1 ? 's' : ''} · {cat.avg_length}w avg
          {cat.avg_score !== null ? ` · ${cat.avg_score} score` : ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-mono text-white tabular-nums font-semibold">
          {cat.avg_upvotes}
        </p>
        <p className="text-[9px] font-mono text-surface-600">avg ↑</p>
      </div>
    </motion.div>
  )
}

// ─── Coaching tip ─────────────────────────────────────────────────────────────

function TipCard({ tip, index }: { tip: RhetoricTip; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cn(
        'rounded-xl border p-3.5',
        tip.priority === 'high'
          ? 'bg-for-500/8 border-for-500/30'
          : 'bg-surface-100 border-surface-300',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Zap className={cn('h-4 w-4 flex-shrink-0 mt-0.5', tip.priority === 'high' ? 'text-for-400' : 'text-surface-500')} />
        <div>
          <p className={cn('text-xs font-mono font-bold mb-1', tip.priority === 'high' ? 'text-for-300' : 'text-surface-300')}>
            {tip.title}
          </p>
          <p className="text-[11px] font-mono text-surface-500 leading-relaxed">{tip.body}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RhetoricClient() {
  const router = useRouter()
  const [data, setData] = useState<RhetoricResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/rhetoric', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch {
      setError('Failed to load rhetoric data')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const maxLengthPct = data ? Math.max(...data.length_distribution.map((l) => l.pct), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-mono font-black text-white">Civic Rhetoric</h1>
            <p className="text-xs font-mono text-surface-500">Your debating style, decoded</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && <RhetoricSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="font-mono text-against-400 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-2 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* No arguments yet */}
        {!loading && !error && data && data.total === 0 && (
          <EmptyState
            icon={MessageSquare}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No arguments yet"
            description="Start writing arguments on topics to discover your rhetorical style."
            actions={[{ label: 'Browse topics', href: '/', variant: 'primary', icon: ArrowRight }]}
          />
        )}

        {/* Content */}
        {!loading && !error && data && data.total > 0 && (
          <AnimatePresence mode="wait">
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

              {/* Archetype hero */}
              <ArchetypeHero data={data} />

              {/* Style breakdown */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-bold text-white">Rhetorical Styles</h2>
                  <span className="text-[10px] font-mono text-surface-600 ml-auto">{data.total} arguments analysed</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {data.style_breakdown.map((style, i) => (
                    <StyleCard
                      key={style.style}
                      style={style}
                      isDominant={i === 0}
                      index={i}
                    />
                  ))}
                </div>
              </section>

              {/* Length distribution */}
              {data.length_distribution.length > 0 && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-for-400" />
                    <h2 className="text-sm font-mono font-bold text-white">Argument Length</h2>
                    <span className="text-[10px] font-mono text-surface-600 ml-auto">avg {data.avg_words}w</span>
                  </div>
                  <div className="space-y-3">
                    {data.length_distribution.map((bracket, i) => (
                      <LengthRow key={bracket.bracket} bracket={bracket} maxPct={maxLengthPct} index={i} />
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-surface-600 mt-3 pt-3 border-t border-surface-200/50">
                    Longer arguments tend to score higher with AI grading and attract more thoughtful upvotes.
                  </p>
                </section>
              )}

              {/* Category rhetoric */}
              {data.category_rhetoric.length > 0 && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="h-4 w-4 text-purple" />
                    <h2 className="text-sm font-mono font-bold text-white">Style by Category</h2>
                  </div>
                  <div className="divide-y divide-surface-200/50">
                    {data.category_rhetoric.map((cat, i) => (
                      <CategoryRow key={cat.category} cat={cat} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Coaching tips */}
              {data.tips.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-for-400" />
                    <h2 className="text-sm font-mono font-bold text-white">Coaching Tips</h2>
                    <span className={cn(
                      'ml-auto text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
                      data.tips.filter((t) => t.priority === 'high').length > 0
                        ? 'bg-for-500/10 text-for-400 border border-for-500/30'
                        : 'bg-surface-200 text-surface-500 border border-surface-300',
                    )}>
                      {data.tips.filter((t) => t.priority === 'high').length} high priority
                    </span>
                  </div>
                  <div className="space-y-2">
                    {data.tips.map((tip, i) => (
                      <TipCard key={tip.id} tip={tip} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Footer links */}
              <nav aria-label="Related pages" className="grid grid-cols-2 gap-3 pt-2">
                {([
                  { href: '/resonance', label: 'Cross-aisle impact', icon: ThumbsUp, color: 'text-purple' },
                  { href: '/conviction', label: 'Conviction tracker', icon: Scale, color: 'text-for-400' },
                  { href: '/analytics', label: 'Full analytics', icon: BarChart2, color: 'text-gold' },
                  { href: '/arguments/mine', label: 'My arguments', icon: MessageSquare, color: 'text-emerald' },
                ] as const).map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                    <span className="text-xs font-mono text-surface-400 hover:text-white transition-colors">{label}</span>
                    <ArrowRight className="h-3 w-3 text-surface-600 ml-auto" />
                  </Link>
                ))}
              </nav>

            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
