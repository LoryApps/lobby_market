'use client'

/**
 * /exchange/[id]/narrative — Market Narrative Tracker
 *
 * Synthesises the competing narrative frames driving consensus on a civic
 * prediction market. Rather than raw argument counts or sentiment scores,
 * this page classifies every argument into broad narrative archetypes
 * (Economic, Rights & Liberty, Evidence & Data, Ethics & Morality, etc.)
 * and shows which frames are winning the battle for the community's minds.
 *
 * Distinct from:
 *   /exchange/[id]/sentiment   — emotional tone of arguments
 *   /exchange/[id]/persuasion  — rhetorical power of individual arguments
 *   /exchange/[id]/anatomy     — quality distribution of arguments
 *   /exchange/[id]/steelman    — best-case version of each side
 *   /exchange/[id]/analysis    — quantitative market metrics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronRight,
  ExternalLink,
  Flame,
  Globe,
  Lightbulb,
  MessageSquare,
  Quote,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  NarrativeData,
  NarrativeSide,
  NarrativeTheme,
  NarrativeBalance,
} from '@/app/api/exchange/[id]/narrative/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface NarrativeClientProps {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function statusBadgeVariant(status: string): 'proposed' | 'active' | 'law' | 'failed' | 'gold' | 'purple' {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (status === 'voting') return 'purple'
  if (status === 'active') return 'active'
  return 'proposed'
}

const THEME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  economic:  BarChart2,
  rights:    Scale,
  evidence:  Brain,
  ethics:    Lightbulb,
  practical: Zap,
  social:    Globe,
  future:    TrendingUp,
  precedent: Flame,
}

function ThemeIcon({ themeKey, className }: { themeKey: string; className?: string }) {
  const Icon = THEME_ICONS[themeKey] ?? MessageSquare
  return <Icon className={className} />
}

// ─── Theme strength bar ───────────────────────────────────────────────────────

function ThemeBar({
  theme,
  side,
  delay,
}: {
  theme: NarrativeTheme
  side: 'for' | 'against'
  delay: number
}) {
  const isFor = side === 'for'
  const barColor = isFor
    ? 'bg-gradient-to-r from-for-600 to-for-400'
    : 'bg-gradient-to-r from-against-600 to-against-400'
  const iconColor = isFor ? 'text-for-400' : 'text-against-400'
  const borderColor = isFor ? 'border-for-500/20' : 'border-against-500/20'
  const bgHover = isFor ? 'hover:border-for-500/40 hover:bg-for-500/5' : 'hover:border-against-500/40 hover:bg-against-500/5'

  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn(
        'rounded-xl border p-3.5 transition-all cursor-pointer select-none',
        'bg-surface-200/40',
        borderColor,
        bgHover,
      )}
      onClick={() => setOpen((v) => !v)}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={cn('flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center', isFor ? 'bg-for-500/10' : 'bg-against-500/10')}>
          <ThemeIcon themeKey={theme.key} className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-white">{theme.label}</span>
            <span className={cn('text-[11px] font-mono font-bold tabular-nums', iconColor)}>{theme.strength}%</span>
          </div>
          <p className="text-[10px] text-surface-500 truncate">{theme.description}</p>
        </div>
      </div>

      <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${theme.strength}%` }}
          transition={{ duration: 0.7, delay: delay + 0.15, ease: 'easeOut' }}
          className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
        />
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-surface-500">
        <span>{theme.argument_count} arg{theme.argument_count !== 1 ? 's' : ''}</span>
        {theme.top_upvotes > 0 && (
          <>
            <span className="text-surface-700">·</span>
            <span>top: {theme.top_upvotes} upvotes</span>
          </>
        )}
        {theme.top_argument && (
          <span className="ml-auto">
            <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
          </span>
        )}
      </div>

      <AnimatePresence>
        {open && theme.top_argument && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'mt-3 p-3 rounded-lg border text-[12px] text-surface-300 leading-relaxed',
              isFor ? 'bg-for-500/5 border-for-500/20' : 'bg-against-500/5 border-against-500/20',
            )}>
              <Quote className={cn('h-3 w-3 mb-1.5', iconColor)} />
              {theme.top_argument}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Narrative side panel ─────────────────────────────────────────────────────

function NarrativeSidePanel({ data, delay }: { data: NarrativeSide; delay: number }) {
  const isFor = data.side === 'for'
  const color = isFor ? 'text-for-400' : 'text-against-400'
  const bgLight = isFor ? 'bg-for-500/5' : 'bg-against-500/5'
  const borderLight = isFor ? 'border-for-500/20' : 'border-against-500/20'
  const Icon = isFor ? ThumbsUp : ThumbsDown
  const label = isFor ? 'FOR' : 'AGAINST'

  return (
    <div className="space-y-3">
      <div className={cn('flex items-center gap-3 p-3.5 rounded-xl border', bgLight, borderLight)}>
        <div className={cn('flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center', bgLight)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-sm font-mono font-bold tracking-widest', color)}>{label}</span>
            {data.dominant_theme && (
              <span className="text-[10px] font-mono text-surface-500">
                Leads: {data.dominant_theme}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-surface-500">
            <span>{data.total_arguments} arg{data.total_arguments !== 1 ? 's' : ''}</span>
            <span className="text-surface-700">·</span>
            <span>{data.total_upvotes.toLocaleString()} upvotes</span>
            {data.recent_argument_count > 0 && (
              <>
                <span className="text-surface-700">·</span>
                <span className="text-emerald">+{data.recent_argument_count} this week</span>
              </>
            )}
          </div>
        </div>
      </div>

      {data.themes.length === 0 ? (
        <div className="py-6 text-center text-sm text-surface-500">
          No arguments posted on this side yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.themes.map((theme, i) => (
            <ThemeBar
              key={theme.key}
              theme={theme}
              side={data.side}
              delay={delay + i * 0.06}
            />
          ))}
        </div>
      )}

      {/* Momentum indicator */}
      {data.momentum_score > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-surface-200/40 border border-surface-300">
          <Zap className={cn('h-3.5 w-3.5', data.momentum_score >= 50 ? 'text-emerald' : 'text-surface-500')} />
          <span className="text-[11px] font-mono text-surface-400">7-day momentum</span>
          <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn('h-full rounded-full', data.momentum_score >= 50 ? 'bg-emerald' : 'bg-surface-500')}
              style={{ width: `${data.momentum_score}%` }}
            />
          </div>
          <span className={cn('text-[11px] font-mono font-bold tabular-nums', data.momentum_score >= 50 ? 'text-emerald' : 'text-surface-500')}>
            {data.momentum_score}%
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Balance bar ──────────────────────────────────────────────────────────────

function BalanceBar({ balance }: { balance: NarrativeBalance }) {
  const forPct = balance.for_strength
  const agstPct = balance.against_strength

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400 font-bold">FOR {forPct}%</span>
        <span className={cn(
          'text-xs font-mono px-2 py-0.5 rounded-full border',
          balance.contested
            ? 'text-surface-400 border-surface-400/30 bg-surface-300/20'
            : balance.leading_side === 'for'
            ? 'text-for-400 border-for-500/30 bg-for-500/10'
            : 'text-against-400 border-against-500/30 bg-against-500/10',
        )}>
          {balance.contested ? 'Contested' : balance.leading_side === 'for' ? 'FOR leads' : 'AGAINST leads'}
        </span>
        <span className="text-against-400 font-bold">AGAINST {agstPct}%</span>
      </div>
      <div className="relative h-3 rounded-full bg-against-500/20 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-for-600 to-for-400"
        />
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NarrativeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-16 w-full" />
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-20 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NarrativeClient({
  id,
  statement,
  category,
  status,
  price,
}: NarrativeClientProps) {
  const [data, setData] = useState<NarrativeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/narrative`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json as NarrativeData)
    } catch {
      setError('Could not load narrative data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const forPct = Math.round(price)
  const statusLabel: Record<string, string> = {
    proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'LAW', failed: 'Failed',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10 space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <Link
            href={`/exchange/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to market
          </Link>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-purple/10 border border-purple/30 flex items-center justify-center">
              <Brain className="h-4.5 w-4.5 text-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                  Narrative Analysis
                </span>
                <Badge variant={statusBadgeVariant(status)} size="sm">
                  {statusLabel[status] ?? status}
                </Badge>
                {category && (
                  <span className="text-[10px] font-mono text-surface-500">{category}</span>
                )}
              </div>
              <h1 className="text-base font-semibold text-white leading-snug line-clamp-3">
                {statement}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-[11px] font-mono">
                <span className={cn('font-bold', priceColor(forPct, status))}>
                  {forPct}¢ FOR
                </span>
                <span className="text-surface-700">/</span>
                <span className="text-against-400 font-bold">{100 - forPct}¢ AGAINST</span>
              </div>
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <div className="flex justify-end">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-400 hover:text-white transition-all disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && <NarrativeSkeleton />}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Brain}
            title="Narrative unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* Content */}
        {!loading && !error && data && (
          <div className="space-y-6">

            {/* Core tension */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-purple/30 bg-purple/5 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple" />
                <span className="text-xs font-mono font-semibold text-purple uppercase tracking-widest">
                  Core Tension
                </span>
              </div>
              <p className="text-base font-semibold text-white leading-snug">
                {data.balance.core_tension}
              </p>
              <p className="mt-2 text-[12px] text-surface-400 leading-relaxed">
                {data.analysis_note}
              </p>
            </motion.div>

            {/* Narrative balance bar */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-xl border border-surface-300 bg-surface-200/50 p-4 space-y-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="h-4 w-4 text-surface-400" />
                <span className="text-xs font-mono text-surface-400 uppercase tracking-wider">
                  Narrative Strength
                </span>
                <span className="ml-auto text-[10px] font-mono text-surface-600">
                  {data.total_arguments} arguments total
                </span>
              </div>
              <BalanceBar balance={data.balance} />
            </motion.div>

            {/* Two-column theme breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h2 className="text-xs font-mono font-bold text-for-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" /> FOR Narratives
                </h2>
                <NarrativeSidePanel data={data.for_side} delay={0.1} />
              </div>
              <div>
                <h2 className="text-xs font-mono font-bold text-against-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <ThumbsDown className="h-3.5 w-3.5" /> AGAINST Narratives
                </h2>
                <NarrativeSidePanel data={data.against_side} delay={0.25} />
              </div>
            </div>

            {/* Empty state for no arguments */}
            {data.total_arguments === 0 && (
              <EmptyState
                icon={MessageSquare}
                title="No arguments yet"
                description="Narrative themes emerge from the arguments posted by the community. Be the first to shape the debate."
                action={{ label: 'View debate', href: `/topic/${id}` }}
              />
            )}

            {/* Navigation footer */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <Link
                href={`/exchange/${id}/sentiment`}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-200/50 border border-surface-300 hover:border-surface-400 transition-all group"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Related</span>
                  <span className="text-sm font-medium text-white group-hover:text-for-300 transition-colors">Sentiment</span>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 ml-auto group-hover:text-for-400 transition-colors" />
              </Link>
              <Link
                href={`/exchange/${id}/persuasion`}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-200/50 border border-surface-300 hover:border-surface-400 transition-all group"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Related</span>
                  <span className="text-sm font-medium text-white group-hover:text-for-300 transition-colors">Persuasion</span>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 ml-auto group-hover:text-for-400 transition-colors" />
              </Link>
            </div>

            <div className="flex items-center justify-center">
              <Link
                href={`/exchange/${id}`}
                className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-for-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View full market
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
