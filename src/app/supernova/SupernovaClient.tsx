'use client'

/**
 * /supernova — The Civic Supernova
 *
 * Topics that burned with explosive initial vote velocity but have since
 * gone dark. A "supernova" debate once attracted a massive, concentrated
 * burst of civic engagement — then collapsed into silence.
 *
 * Supernova Ratio = avg_lifetime_daily_rate / max(0.1, current_7d_daily_rate)
 *
 * Three tiers:
 *   NOVA  — ratio ≥ 20× — once blinding, now nearly dark
 *   FLARE — ratio ≥ 8×  — strong burst that faded fast
 *   EMBER — ratio ≥ 3×  — notably above-average launch, visibly cooling
 *
 * Distinct from:
 *   /decay        — measures recent week-over-week drop (7d vs 14d window)
 *   /drought      — topics with zero recent votes regardless of history
 *   /gravity      — new topics still in their initial surge (opposite signal)
 *   /rebound      — topics recovering from a quiet period
 *   /velocity     — current momentum speed (no historical comparison)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  Clock,
  Flame,
  RefreshCw,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { TopBar }    from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn }        from '@/lib/utils/cn'
import type {
  SupernovaResponse,
  SupernovaTopic,
  SupernovaClass,
} from '@/app/api/topics/supernova/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-purple' },
  law:      { label: 'Law',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-against-400' },
}

// ─── Tier config ──────────────────────────────────────────────────────────────

function tierConfig(cls: SupernovaClass): {
  icon: React.ReactNode
  label: string
  sublabel: string
  bar: string
  bg: string
  border: string
  text: string
  badge: string
  glow: string
} {
  switch (cls) {
    case 'nova':
      return {
        icon:     <Star className="h-4 w-4" />,
        label:    'Nova',
        sublabel: 'Once blinding, now dark',
        bar:      'bg-gold',
        bg:       'bg-gold/8',
        border:   'border-gold/25 hover:border-gold/50',
        text:     'text-gold',
        badge:    'text-yellow-300 bg-gold/10 border-gold/30',
        glow:     'shadow-[0_0_20px_rgba(234,179,8,0.08)]',
      }
    case 'flare':
      return {
        icon:     <Flame className="h-4 w-4" />,
        label:    'Flare',
        sublabel: 'Strong burst, faded fast',
        bar:      'bg-against-500',
        bg:       'bg-against-500/8',
        border:   'border-against-500/25 hover:border-against-500/50',
        text:     'text-against-400',
        badge:    'text-against-300 bg-against-500/10 border-against-500/30',
        glow:     'shadow-[0_0_20px_rgba(239,68,68,0.06)]',
      }
    case 'ember':
      return {
        icon:     <Zap className="h-4 w-4" />,
        label:    'Ember',
        sublabel: 'Above-average launch, cooling',
        bar:      'bg-for-500',
        bg:       'bg-for-500/8',
        border:   'border-for-500/25 hover:border-for-500/50',
        text:     'text-for-400',
        badge:    'text-for-300 bg-for-500/10 border-for-500/30',
        glow:     '',
      }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(days: number): string {
  if (days < 30)  return `${days}d ago`
  if (days < 365) return `${Math.round(days / 30)}mo ago`
  return `${Math.round(days / 365)}yr ago`
}

function ratioLabel(ratio: number): string {
  if (ratio >= 100) return `${Math.round(ratio)}× hotter at peak`
  if (ratio >= 10)  return `${ratio.toFixed(1)}× hotter at peak`
  return `${ratio.toFixed(1)}× hotter at peak`
}

function formatRate(rate: number): string {
  if (rate === 0)   return '0 votes/day now'
  if (rate < 0.1)   return '<0.1 votes/day'
  if (rate < 1)     return `${(rate).toFixed(2)} votes/day`
  return `${rate.toFixed(1)} votes/day`
}

// ─── Supernova Card ───────────────────────────────────────────────────────────

function SupernovaCard({
  topic,
  rank,
}: {
  topic: SupernovaTopic
  rank: number
}) {
  const statusCfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-500' }
  const catClass  = topic.category
    ? (CATEGORY_COLORS[topic.category] ?? 'bg-surface-200 text-surface-400 border-surface-400/30')
    : ''
  const cfg = tierConfig(topic.supernova_class)
  const isDark = topic.recent_7d_count === 0

  // Peak bar: how wide compared to max ratio
  const barWidthPct = Math.min(100, (topic.supernova_ratio / 30) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'group relative rounded-xl border p-4 transition-all duration-200',
        cfg.bg,
        cfg.border,
        cfg.glow,
      )}
    >
      {/* Rank + tier badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono text-surface-600 w-5 text-right flex-shrink-0">
            {rank}
          </span>
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
            cfg.badge,
          )}>
            {cfg.icon}
            {cfg.label}
          </span>
          {isDark && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border bg-surface-200/50 text-surface-500 border-surface-400/30">
              Dark
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {topic.category && (
            <span className={cn(
              'inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono border',
              catClass,
            )}>
              {topic.category}
            </span>
          )}
          <span className={cn('text-[10px] font-mono', statusCfg.color)}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Statement */}
      <Link
        href={`/topic/${topic.id}`}
        className="block text-sm font-mono font-medium text-white leading-snug hover:text-surface-200 transition-colors mb-3"
      >
        {topic.statement}
      </Link>

      {/* Peak bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-[11px] font-mono', cfg.text)}>
            {ratioLabel(topic.supernova_ratio)}
          </span>
          <span className="text-[11px] font-mono text-surface-600">
            {formatAge(topic.age_days)}
          </span>
        </div>
        <div className="h-1 rounded-full bg-surface-200 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidthPct}%` }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={cn('h-full rounded-full', cfg.bar)}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[11px] font-mono text-surface-600">
        <span className="flex items-center gap-1">
          <BarChart2 className="h-3 w-3" />
          {topic.total_votes.toLocaleString()} votes total
        </span>
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {topic.avg_daily_rate}/day lifetime avg
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="h-3 w-3" />
          {formatRate(topic.current_daily_rate)}
        </span>
      </div>

      {/* Consensus bar */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] font-mono text-for-400 w-8 text-right">
          {Math.round(topic.blue_pct)}%
        </span>
        <div className="flex-1 h-1 rounded-full bg-against-800 overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full"
            style={{ width: `${topic.blue_pct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-against-400 w-8">
          {Math.round(100 - topic.blue_pct)}%
        </span>
        <Link
          href={`/topic/${topic.id}`}
          className={cn(
            'ml-2 flex items-center gap-1 text-[10px] font-mono',
            cfg.text,
            'opacity-0 group-hover:opacity-100 transition-opacity',
          )}
        >
          Vote <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Tier Section ─────────────────────────────────────────────────────────────

function TierSection({
  cls,
  topics,
  category,
}: {
  cls: SupernovaClass
  topics: SupernovaTopic[]
  category: string
}) {
  const [expanded, setExpanded] = useState(true)
  const cfg = tierConfig(cls)

  const filtered = category === 'All'
    ? topics
    : topics.filter((t) => t.category === category)

  if (filtered.length === 0) return null

  return (
    <section>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 mb-3 group"
      >
        <div className={cn(
          'flex items-center justify-center h-8 w-8 rounded-lg border',
          cfg.bg, cfg.border, cfg.text,
        )}>
          {cfg.icon}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-mono font-semibold', cfg.text)}>
              {cfg.label}
            </span>
            <span className="text-[10px] font-mono bg-surface-200 text-surface-500 px-1.5 py-0.5 rounded border border-surface-300">
              {filtered.length}
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-600 mt-0.5">
            {cfg.sublabel}
          </p>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-surface-600 transition-transform',
          expanded && 'rotate-180',
        )} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 overflow-hidden"
          >
            {filtered.map((t, i) => (
              <SupernovaCard key={t.id} topic={t} rank={i + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupernovaClient() {
  const [data, setData]         = useState<SupernovaResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [category, setCategory] = useState('All')
  const [catOpen, setCatOpen]   = useState(false)
  const [tab, setTab]           = useState<'all' | SupernovaClass>('all')
  const fetchedAt = useRef<number>(0)

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - fetchedAt.current < 10 * 60_000) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/supernova', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch_fail')
      const json = (await res.json()) as SupernovaResponse
      setData(json)
      fetchedAt.current = Date.now()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalFiltered = data
    ? (
        (tab === 'all' || tab === 'nova')   ? (category === 'All' ? data.nova   : data.nova.filter((t) => t.category === category)).length   : 0
      ) + (
        (tab === 'all' || tab === 'flare')  ? (category === 'All' ? data.flare  : data.flare.filter((t) => t.category === category)).length  : 0
      ) + (
        (tab === 'all' || tab === 'ember')  ? (category === 'All' ? data.ember  : data.ember.filter((t) => t.category === category)).length  : 0
      )
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/trending"
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/10 border border-gold/30">
                <Star className="h-4.5 w-4.5 text-gold" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono text-white leading-tight">
                  Civic Supernova
                </h1>
                <p className="text-xs font-mono text-surface-500">
                  Debates that burned bright — and went dark
                </p>
              </div>
            </div>
            <button
              onClick={() => load(true)}
              disabled={loading}
              aria-label="Refresh"
              className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          <p className="text-sm text-surface-500 leading-relaxed">
            These topics once commanded an explosive surge of civic engagement —
            votes piling in far faster than their current pace. Each was a supernova:
            a brilliant burst, then collapse. Many are still open. Some just need
            your vote to reignite.
          </p>
        </div>

        {/* ── Stats pills ──────────────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              {
                label: 'Total Supernovas',
                value: data.stats.total_supernovas,
                color: 'text-white',
              },
              {
                label: 'Gone Dark',
                value: data.stats.total_dark,
                color: 'text-surface-500',
              },
              {
                label: 'Peak Ratio',
                value: `${data.stats.max_ratio}×`,
                color: 'text-gold',
              },
              {
                label: 'Brightest Cat.',
                value: data.stats.brightest_category ?? '—',
                color: 'text-for-400',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-surface-300 bg-surface-100 px-3 py-2.5"
              >
                <p className="text-[10px] font-mono text-surface-600 mb-0.5">{s.label}</p>
                <p className={cn('text-sm font-mono font-bold truncate', s.color)}>
                  {s.value}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tier tabs */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-lg p-1">
            {(
              [
                { key: 'all',   label: 'All'   },
                { key: 'nova',  label: 'Nova'  },
                { key: 'flare', label: 'Flare' },
                { key: 'ember', label: 'Ember' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-mono transition-colors',
                  tab === key
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category picker */}
          <div className="relative">
            <button
              onClick={() => setCatOpen((o) => !o)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors',
                category !== 'All'
                  ? 'bg-for-500/10 border-for-500/30 text-for-400'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Star className="h-3 w-3" />
              {category === 'All' ? 'All Categories' : category}
              <ChevronDown className={cn('h-3 w-3 transition-transform', catOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute top-full left-0 mt-1 z-10 bg-surface-100 border border-surface-300 rounded-lg shadow-xl overflow-hidden min-w-[160px]"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                        category === cat ? 'text-white' : 'text-surface-400',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {totalFiltered > 0 && (
            <span className="ml-auto text-xs font-mono text-surface-600">
              {totalFiltered} topic{totalFiltered !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Loading ───────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-surface-300 bg-surface-100 p-4 animate-pulse"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-16 bg-surface-200 rounded" />
                  <div className="h-5 w-24 bg-surface-200 rounded ml-auto" />
                </div>
                <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-surface-200 rounded w-1/2 mb-3" />
                <div className="h-1 bg-surface-200 rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">
              Failed to load supernova data
            </p>
            <button
              onClick={() => load(true)}
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Empty ─────────────────────────────────────────────────── */}
        {data && !loading && totalFiltered === 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-8 text-center">
            <Star className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-sm font-mono text-surface-400">
              No supernova topics found
              {category !== 'All' ? ` in ${category}` : ''}.
            </p>
            <p className="text-xs font-mono text-surface-600 mt-1">
              Topics need to be at least 14 days old with 20+ votes to qualify.
            </p>
          </div>
        )}

        {/* ── Tier sections ─────────────────────────────────────────── */}
        {data && !loading && !error && (
          <div className="space-y-8">
            {(tab === 'all' || tab === 'nova') && (
              <TierSection cls="nova"  topics={data.nova}  category={category} />
            )}
            {(tab === 'all' || tab === 'flare') && (
              <TierSection cls="flare" topics={data.flare} category={category} />
            )}
            {(tab === 'all' || tab === 'ember') && (
              <TierSection cls="ember" topics={data.ember} category={category} />
            )}
          </div>
        )}

        {/* ── Category breakdown ────────────────────────────────────── */}
        {data && !loading && !error && data.category_breakdown.length > 0 && (
          <section className="mt-4">
            <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
              Supernova intensity by category
            </h2>
            <div className="space-y-2">
              {data.category_breakdown.map((cat) => {
                const maxRatio = data.stats.max_ratio || 1
                const widthPct = Math.min(100, (cat.avg_ratio / maxRatio) * 100)
                const catClass = CATEGORY_COLORS[cat.category] ?? 'bg-surface-200 text-surface-400 border-surface-400/30'
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className={cn(
                      'inline-flex px-2 py-0.5 rounded text-[10px] font-mono border w-28 justify-center flex-shrink-0',
                      catClass,
                    )}>
                      {cat.category}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gold/60"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-surface-600 w-14 text-right flex-shrink-0">
                      avg {cat.avg_ratio}×
                    </span>
                    <span className="text-[10px] font-mono text-surface-700 w-16 text-right flex-shrink-0">
                      {cat.topic_count} topic{cat.topic_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Footer note ───────────────────────────────────────────── */}
        {data && !loading && (
          <p className="text-[11px] font-mono text-surface-700 text-center pt-2">
            Supernova Ratio = lifetime avg daily votes ÷ current 7-day daily rate.
            Topics ≥ 14 days old with ≥ 20 votes. Updated every 15 minutes.
          </p>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
