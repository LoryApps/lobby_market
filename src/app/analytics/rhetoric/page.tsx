'use client'

/**
 * /analytics/rhetoric — Civic Rhetorical Style Analysis
 *
 * Analyses the text of your arguments to surface your dominant writing patterns:
 * what rhetorical styles you favour (evidence-based, logical, historical,
 * hypothetical, normative, personal), your length distribution, how style
 * varies by category, and improvement tips.
 *
 * Distinct from:
 *   /analytics/arguments     — argument portfolio (grades, arena, topics)
 *   /analytics/sentiment     — emotional tone analysis
 *   /analytics/argument-quality — platform-wide quality index (not personal)
 *   /analytics/depth         — engagement depth (voted, bookmarked, etc.)
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
  FileText,
  Flame,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RhetoricResponse,
  RhetoricalStyle,
  LengthBracket,
  StyleBreakdown,
  LengthDistribution,
  CategoryRhetoric,
  MonthlyRhetoric,
  RhetoricTip,
} from '@/app/api/analytics/rhetoric/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonth(iso: string): string {
  const [year, month] = iso.split('-')
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${m[parseInt(month, 10) - 1]} ${year}`
}

// ─── Color maps ───────────────────────────────────────────────────────────────

const STYLE_BG: Record<RhetoricalStyle, string> = {
  evidence_based: 'bg-for-500/15 border-for-500/30',
  logical:        'bg-purple/15 border-purple/30',
  historical:     'bg-gold/15 border-gold/30',
  hypothetical:   'bg-emerald/15 border-emerald/30',
  normative:      'bg-against-500/15 border-against-500/30',
  personal:       'bg-for-400/15 border-for-400/30',
}

const STYLE_BAR: Record<RhetoricalStyle, string> = {
  evidence_based: 'bg-for-400',
  logical:        'bg-purple',
  historical:     'bg-gold',
  hypothetical:   'bg-emerald',
  normative:      'bg-against-400',
  personal:       'bg-for-300',
}

const BRACKET_ICON: Record<LengthBracket, typeof Zap> = {
  concise:       Zap,
  standard:      MessageSquare,
  detailed:      FileText,
  comprehensive: BookOpen,
}

const BRACKET_COLOR: Record<LengthBracket, string> = {
  concise:       'text-gold',
  standard:      'text-for-400',
  detailed:      'text-purple',
  comprehensive: 'text-emerald',
}

// ─── Style card ───────────────────────────────────────────────────────────────

function StyleCard({ style, rank }: { style: StyleBreakdown; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06, duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-4',
        STYLE_BG[style.style]
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {rank === 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-gold uppercase tracking-wider">
                <Star className="h-2.5 w-2.5 fill-gold" />
                Dominant
              </span>
            )}
            <span className={cn('text-sm font-mono font-bold', style.color)}>
              {style.label}
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
            {style.description}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={cn('font-mono font-bold text-xl', style.color)}>
            {style.pct}%
          </div>
          <div className="text-[10px] font-mono text-surface-500">
            {style.count} arg{style.count !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', STYLE_BAR[style.style])}
          initial={{ width: 0 }}
          animate={{ width: `${style.pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: rank * 0.06 + 0.2 }}
        />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className="text-[10px] font-mono text-surface-500">
          avg upvotes: <span className="text-white font-semibold">{style.avg_upvotes}</span>
        </span>
      </div>
    </motion.div>
  )
}

// ─── Length bar ───────────────────────────────────────────────────────────────

function LengthRow({ l, maxCount }: { l: LengthDistribution; maxCount: number }) {
  const Icon = BRACKET_ICON[l.bracket]
  const color = BRACKET_COLOR[l.bracket]

  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200', color)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono font-semibold text-white">{l.label}</span>
          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
            <span>{l.wordRange}</span>
            <span className="text-white font-semibold">{l.count}</span>
          </div>
        </div>
        <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              l.bracket === 'concise'       ? 'bg-gold' :
              l.bracket === 'standard'      ? 'bg-for-400' :
              l.bracket === 'detailed'      ? 'bg-purple' : 'bg-emerald'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${(l.count / maxCount) * 100}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
        {l.avg_score !== null && (
          <div className="mt-0.5 text-[10px] font-mono text-surface-500">
            avg AI score: <span className="text-white font-semibold">{l.avg_score}/10</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: CategoryRhetoric }) {
  const styleColor = cat.dominant_style ? {
    evidence_based: 'text-for-300 bg-for-500/10 border-for-500/20',
    logical:        'text-purple bg-purple/10 border-purple/20',
    historical:     'text-gold bg-gold/10 border-gold/20',
    hypothetical:   'text-emerald bg-emerald/10 border-emerald/20',
    normative:      'text-against-300 bg-against-500/10 border-against-500/20',
    personal:       'text-for-400 bg-for-400/10 border-for-400/20',
  }[cat.dominant_style] : 'text-surface-500 bg-surface-200 border-surface-300'

  const styleLabel = cat.dominant_style ? {
    evidence_based: 'Evidence',
    logical: 'Logical',
    historical: 'Historical',
    hypothetical: 'Hypothetical',
    normative: 'Normative',
    personal: 'Personal',
  }[cat.dominant_style] : 'Mixed'

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300/40 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono font-semibold text-white">{cat.category}</span>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-surface-500">
          <span>{cat.count} arg{cat.count !== 1 ? 's' : ''}</span>
          <span>~{cat.avg_length} words</span>
          {cat.avg_upvotes > 0 && <span>{cat.avg_upvotes} avg upvotes</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {cat.avg_score !== null && (
          <span className="text-[11px] font-mono text-surface-500">
            {cat.avg_score}<span className="text-surface-600">/10</span>
          </span>
        )}
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
          styleColor
        )}>
          {styleLabel}
        </span>
      </div>
    </div>
  )
}

// ─── Tip card ─────────────────────────────────────────────────────────────────

function TipCard({ tip, index }: { tip: RhetoricTip; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-4 flex items-start gap-3',
        tip.priority === 'high'
          ? 'bg-gold/5 border-gold/20'
          : 'bg-surface-100 border-surface-300/40'
      )}
    >
      <div className={cn(
        'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
        tip.priority === 'high' ? 'bg-gold/15' : 'bg-surface-200'
      )}>
        <Lightbulb className={cn(
          'h-4 w-4',
          tip.priority === 'high' ? 'text-gold' : 'text-surface-500'
        )} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-semibold text-white mb-0.5">{tip.title}</p>
        <p className="text-[11px] font-mono text-surface-500 leading-relaxed">{tip.body}</p>
      </div>
      {tip.priority === 'high' && (
        <span className="flex-shrink-0 text-[10px] font-mono font-bold text-gold uppercase tracking-wider mt-0.5">
          Priority
        </span>
      )}
    </motion.div>
  )
}

// ─── Monthly sparkline ────────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthlyRhetoric[] }) {
  if (months.length === 0) return null
  const maxCount = Math.max(...months.map((m) => m.count), 1)

  return (
    <div className="flex items-end gap-1 h-16">
      {months.map((m) => {
        const h = Math.max((m.count / maxCount) * 100, 4)
        return (
          <div
            key={m.month}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${formatMonth(m.month)}: ${m.count} argument${m.count !== 1 ? 's' : ''}${m.avg_score !== null ? ` · avg ${m.avg_score}/10` : ''}`}
          >
            <motion.div
              className="w-full rounded-sm bg-for-500/60 hover:bg-for-400 transition-colors"
              style={{ height: `${h}%` }}
              initial={{ scaleY: 0, originY: 1 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, delay: months.indexOf(m) * 0.03 }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-2xl bg-surface-100 border border-surface-300/40" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-100 border border-surface-300/40" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-surface-100 border border-surface-300/40" />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RhetoricPage() {
  const router = useRouter()
  const [data, setData] = useState<RhetoricResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/rhetoric')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as RhetoricResponse
      setData(json)
    } catch {
      setError('Could not load your rhetoric analysis. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const maxLengthCount = data ? Math.max(...data.length_distribution.map((l) => l.count), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400 transition-all"
              aria-label="Back to analytics"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Brain className="h-5 w-5 text-purple" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Rhetorical Style
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                How you argue — patterns, structures, and voice
              </p>
            </div>
          </div>

          {!loading && (
            <button
              onClick={load}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 border border-surface-400/40 hover:text-white hover:border-surface-400 transition-all"
              aria-label="Refresh analysis"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Brain}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load rhetoric analysis"
            description={error}
            actions={[{ label: 'Try again', onClick: load, variant: 'primary', icon: RefreshCw }]}
          />
        )}

        {/* Empty state — no arguments yet */}
        {!loading && !error && data && data.total === 0 && (
          <EmptyState
            icon={MessageSquare}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No arguments yet"
            description="Write your first civic argument to see your rhetorical style analysis."
            actions={[
              { label: 'Browse topics', href: '/', variant: 'primary', icon: Flame },
              { label: 'View analytics', href: '/analytics', variant: 'secondary', icon: BarChart2 },
            ]}
          />
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {!loading && !error && data && data.total > 0 && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >

              {/* Archetype card */}
              {data.archetype && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-2xl border border-purple/30 bg-purple/5 p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-purple" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-purple uppercase tracking-wider">
                          Your Rhetorical Archetype
                        </span>
                        <span className="text-[10px] font-mono text-surface-500">
                          · {data.total} arguments · avg {data.avg_words} words
                        </span>
                      </div>
                      <p className="font-mono font-bold text-xl text-white mb-1">
                        {data.archetype}
                      </p>
                      <p className="text-sm font-mono text-surface-400 leading-relaxed">
                        {data.archetype_description}
                      </p>
                      {data.dominant_style_label && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple/15 border border-purple/25 text-[11px] font-mono text-purple">
                          <Brain className="h-3 w-3" />
                          Dominant style: {data.dominant_style_label}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Style breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-3.5 w-3.5 text-surface-500" />
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                    Rhetorical Style Mix
                  </h2>
                </div>
                <div className="space-y-3">
                  {data.style_breakdown.map((style, i) => (
                    <StyleCard key={style.style} style={style} rank={i} />
                  ))}
                </div>
              </div>

              {/* Length distribution */}
              {data.length_distribution.length > 0 && (
                <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-3.5 w-3.5 text-surface-500" />
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Argument Length Distribution
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {data.length_distribution.map((l) => (
                      <LengthRow key={l.bracket} l={l} maxCount={maxLengthCount} />
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly activity */}
              {data.monthly_rhetoric.length >= 2 && (
                <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-surface-500" />
                      <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                        Monthly Writing Activity
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono text-surface-500">
                      Last {data.monthly_rhetoric.length} months
                    </span>
                  </div>
                  <MonthlyChart months={data.monthly_rhetoric} />
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-surface-600">
                    <span>{formatMonth(data.monthly_rhetoric[0].month)}</span>
                    <span>{formatMonth(data.monthly_rhetoric[data.monthly_rhetoric.length - 1].month)}</span>
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              {data.category_rhetoric.length > 0 && (
                <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-3.5 w-3.5 text-surface-500" />
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Style by Category
                    </h2>
                  </div>
                  <div>
                    {data.category_rhetoric.map((cat) => (
                      <CategoryRow key={cat.category} cat={cat} />
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement tips */}
              {data.tips.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-3.5 w-3.5 text-surface-500" />
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Improvement Tips
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {data.tips.map((tip, i) => (
                      <TipCard key={tip.id} tip={tip} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 gap-3 pt-2"
              >
                <Link
                  href="/analytics/arguments"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Argument Portfolio</p>
                    <p className="text-[11px] font-mono text-surface-500">Grades & arena record</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
                <Link
                  href="/analytics/sentiment"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Sentiment</p>
                    <p className="text-[11px] font-mono text-surface-500">Emotional tone analysis</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
                <Link
                  href="/coach"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Argument Coach</p>
                    <p className="text-[11px] font-mono text-surface-500">AI critique of a draft</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
                <Link
                  href="/steelman"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Steelman Engine</p>
                    <p className="text-[11px] font-mono text-surface-500">Strengthen any argument</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
