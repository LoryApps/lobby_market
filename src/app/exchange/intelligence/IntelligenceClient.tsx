'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  Brain,
  ChevronRight,
  Flame,
  FlaskConical,
  Gavel,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  IntelligenceResponse,
  LawWatchEntry,
  BreakoutEntry,
  ArbitrageEntry,
  CategoryRotation,
  ContrarySignal,
  IntelligenceTheme,
} from '@/app/api/exchange/intelligence/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function priceColor(price: number): string {
  if (price >= 66) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price >= 50) return 'text-for-300'
  if (price >= 45) return 'text-surface-500'
  return 'text-against-400'
}

const ACCENT_CLASSES: Record<string, { text: string; bg: string; border: string; glow: string; bar: string }> = {
  gold:    { text: 'text-gold',      bg: 'bg-gold/8',       border: 'border-gold/20',      glow: 'shadow-gold/10',   bar: 'bg-gold' },
  for:     { text: 'text-for-400',   bg: 'bg-for-500/8',    border: 'border-for-500/20',   glow: 'shadow-for-500/10', bar: 'bg-for-500' },
  against: { text: 'text-against-400', bg: 'bg-against-500/8', border: 'border-against-500/20', glow: 'shadow-against-500/10', bar: 'bg-against-500' },
  purple:  { text: 'text-purple',    bg: 'bg-purple/8',     border: 'border-purple/20',    glow: 'shadow-purple/10', bar: 'bg-purple' },
  emerald: { text: 'text-emerald',   bg: 'bg-emerald/8',    border: 'border-emerald/20',   glow: 'shadow-emerald/10', bar: 'bg-emerald' },
  surface: { text: 'text-surface-400', bg: 'bg-surface-200/40', border: 'border-surface-300/40', glow: '', bar: 'bg-surface-400' },
}

const CAT_TEXT: Record<string, string> = {
  gold: 'text-gold', for: 'text-for-400', purple: 'text-purple',
  emerald: 'text-emerald', against: 'text-against-400', surface: 'text-surface-400',
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function IntelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
        <Skeleton className="h-6 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-full rounded-lg" />
        <Skeleton className="h-4 w-5/6 rounded-lg" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300/40 p-4 space-y-3">
          <Skeleton className="h-4 w-1/3 rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Market Health Bar ────────────────────────────────────────────────────────

function HealthBar({ health }: { health: IntelligenceResponse['market_health'] }) {
  const advPct = health.total > 0 ? (health.advancing / health.total) * 100 : 33
  const decPct = health.total > 0 ? (health.declining / health.total) * 100 : 33
  const neutPct = 100 - advPct - decPct

  const sentimentConfig = {
    bullish: { text: 'text-for-400',   label: 'Bullish',  icon: TrendingUp   },
    bearish: { text: 'text-against-400', label: 'Bearish', icon: TrendingDown },
    mixed:   { text: 'text-purple',    label: 'Mixed',    icon: Scale        },
    neutral: { text: 'text-surface-400', label: 'Neutral', icon: Activity    },
  }
  const cfg = sentimentConfig[health.sentiment]
  const SentIcon = cfg.icon

  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-surface-500" />
          <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Market Health</span>
        </div>
        <span className={cn('flex items-center gap-1 text-xs font-mono font-semibold', cfg.text)}>
          <SentIcon className="h-3.5 w-3.5" />
          {cfg.label}
        </span>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        <div className="bg-for-500 rounded-l-full transition-all" style={{ width: `${advPct}%` }} />
        <div className="bg-surface-300 transition-all" style={{ width: `${neutPct}%` }} />
        <div className="bg-against-500 rounded-r-full transition-all" style={{ width: `${decPct}%` }} />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Total', value: health.total, color: 'text-white' },
          { label: 'For',   value: health.advancing, color: 'text-for-400' },
          { label: 'Against', value: health.declining, color: 'text-against-400' },
          { label: 'Near Law', value: health.near_law, color: 'text-gold' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className={cn('text-base font-mono font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] font-mono text-surface-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Law Watch ────────────────────────────────────────────────────────────────

function LawWatchRow({ entry, idx }: { entry: LawWatchEntry; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Link
        href={`/exchange/${entry.id}`}
        className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-gold/20 hover:border-gold/50 hover:bg-gold/5 transition-all group"
      >
        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-gold/10 border border-gold/30">
          <Gavel className="h-4 w-4 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate leading-tight">
            {entry.statement}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] font-mono text-gold font-semibold">{entry.price}¢</span>
            <span className="text-[10px] font-mono text-surface-500">·</span>
            <span className="text-[11px] font-mono text-surface-500">{entry.gap.toFixed(1)} pts to law</span>
            <span className="text-[10px] font-mono text-surface-500">·</span>
            <span className="text-[11px] font-mono text-gold/70">{entry.eta_label}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="h-6 w-12 bg-surface-300 rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(entry.price / 66) * 100}%` }} />
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-gold transition-colors mt-1 ml-auto" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Breakout Row ─────────────────────────────────────────────────────────────

function BreakoutRow({ entry, idx }: { entry: BreakoutEntry; idx: number }) {
  const isSurge = entry.direction === 'surge'
  const isExtreme = entry.strength === 'extreme'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Link
        href={`/exchange/${entry.id}`}
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border transition-all group',
          isSurge
            ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40 hover:bg-for-500/10'
            : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40 hover:bg-against-500/10',
        )}
      >
        <div className={cn(
          'flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center border',
          isSurge ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30',
        )}>
          {isSurge
            ? <ArrowUpRight className="h-4 w-4 text-for-400" />
            : <ArrowDownRight className="h-4 w-4 text-against-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{entry.statement}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[11px] font-mono font-semibold', isSurge ? 'text-for-400' : 'text-against-400')}>
              {entry.price}¢
            </span>
            {entry.category && (
              <span className="text-[10px] font-mono text-surface-500">{entry.category}</span>
            )}
            {isExtreme && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', isSurge ? 'text-for-300 border-for-500/30 bg-for-500/10' : 'text-against-300 border-against-500/30 bg-against-500/10')}>
                Extreme
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-white transition-colors flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Arbitrage Row ────────────────────────────────────────────────────────────

function ArbitrageRow({ entry, idx }: { entry: ArbitrageEntry; idx: number }) {
  const isUnder = entry.signal === 'undervalued'
  const absDev = Math.abs(entry.price_deviation)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Link
        href={`/exchange/${entry.id}/model`}
        className="flex items-center gap-3 p-3 rounded-xl bg-purple/5 border border-purple/20 hover:border-purple/40 hover:bg-purple/10 transition-all group"
      >
        <div className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center bg-purple/10 border border-purple/30">
          <FlaskConical className="h-4 w-4 text-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{entry.statement}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-surface-500">Price: <span className="text-white">{entry.price}¢</span></span>
            <span className="text-[10px] text-surface-500">·</span>
            <span className="text-[11px] font-mono text-surface-500">Quality: <span className="text-purple">{entry.argument_quality}</span></span>
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', isUnder ? 'text-emerald border-emerald/30 bg-emerald/10' : 'text-against-400 border-against-500/30 bg-against-500/10')}>
              {isUnder ? `Under by ${absDev}¢` : `Over by ${absDev}¢`}
            </span>
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-purple transition-colors flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Category Rotation Card ───────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryRotation }) {
  const accent = ACCENT_CLASSES[cat.color] ?? ACCENT_CLASSES.surface
  const textColor = CAT_TEXT[cat.color] ?? 'text-surface-400'
  const momIcon = cat.momentum === 'rising' ? TrendingUp : cat.momentum === 'declining' ? TrendingDown : Activity
  const MomIcon = momIcon

  return (
    <Link
      href={`/categories/${cat.category.toLowerCase()}`}
      className={cn(
        'block rounded-xl border p-3 transition-all hover:scale-[1.01]',
        accent.bg, accent.border,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs font-mono font-semibold', textColor)}>{cat.category}</span>
        <MomIcon className={cn('h-3.5 w-3.5', cat.momentum === 'rising' ? 'text-for-400' : cat.momentum === 'declining' ? 'text-against-400' : 'text-surface-500')} />
      </div>
      <p className={cn('text-lg font-mono font-bold tabular-nums', textColor)}>{cat.avg_price}¢</p>
      <p className="text-[10px] font-mono text-surface-500 mt-0.5">{cat.market_count} markets</p>
      <div className="mt-2 h-1 bg-surface-300/40 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', accent.bar)} style={{ width: `${cat.avg_price}%` }} />
      </div>
    </Link>
  )
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({ theme, idx }: { theme: IntelligenceTheme; idx: number }) {
  const accent = ACCENT_CLASSES[theme.accent] ?? ACCENT_CLASSES.surface

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06 }}
      className={cn('rounded-xl border p-4', accent.bg, accent.border)}
    >
      <div className="flex items-start gap-2 mb-2">
        <Sparkles className={cn('h-4 w-4 mt-0.5 flex-shrink-0', accent.text)} />
        <h3 className={cn('text-sm font-mono font-bold', accent.text)}>{theme.title}</h3>
      </div>
      <p className="text-xs text-surface-400 leading-relaxed mb-3">{theme.body}</p>
      <div className="space-y-1.5">
        {theme.markets.slice(0, 3).map((m) => (
          <Link
            key={m.id}
            href={`/exchange/${m.id}`}
            className="flex items-center gap-2 group"
          >
            <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors truncate flex-1">
              {m.statement}
            </span>
            <span className={cn('text-[11px] font-mono font-semibold flex-shrink-0', priceColor(m.price))}>
              {m.price}¢
            </span>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Contrary Row ─────────────────────────────────────────────────────────────

function ContraryRow({ signal, idx }: { signal: ContrarySignal; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Link
        href={`/exchange/${signal.id}`}
        className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/40 transition-all group"
      >
        <div className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center bg-against-500/10 border border-against-500/20">
          <AlertTriangle className="h-4 w-4 text-against-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{signal.statement}</p>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">{signal.note}</p>
        </div>
        <span className="text-against-400 font-mono text-sm font-bold flex-shrink-0">{signal.price}¢</span>
      </Link>
    </motion.div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconColor,
  count,
  children,
  empty,
}: {
  title: string
  icon: typeof Activity
  iconColor: string
  count?: number
  children: React.ReactNode
  empty?: boolean
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="ml-auto text-xs font-mono text-surface-500">{count}</span>
        )}
      </div>
      {empty ? (
        <p className="text-xs font-mono text-surface-600 text-center py-6">No signals at this time</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function IntelligenceClient() {
  const [data, setData] = useState<IntelligenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/intelligence', { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as IntelligenceResponse
      setData(json)
    } catch {
      setError('Could not load market intelligence. Try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/exchange"
            className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple" />
              <h1 className="font-mono text-2xl font-bold text-white">Intelligence</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Cross-market signals, law watch, and rotation
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh intelligence"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-400', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <IntelSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={AlertTriangle}
                iconColor="text-against-400"
                title="Intelligence unavailable"
                description={error}
                action={{ label: 'Try again', onClick: () => load() }}
              />
            </motion.div>
          ) : data ? (
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

              {/* Narrative Banner */}
              <div className="rounded-2xl bg-gradient-to-br from-surface-100 to-surface-100/40 border border-purple/20 p-5">
                <div className="flex items-start gap-2 mb-3">
                  <Zap className="h-4 w-4 text-purple mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-mono text-purple uppercase tracking-wider font-semibold">
                    Daily Market Intelligence
                  </p>
                </div>
                <h2 className="text-base font-semibold text-white mb-2 leading-snug">{data.headline}</h2>
                <p className="text-sm text-surface-400 leading-relaxed">{data.narrative}</p>
                <p className="text-[10px] font-mono text-surface-600 mt-3">
                  Updated {timeAgo(data.as_of)}
                </p>
              </div>

              {/* Market Health */}
              <HealthBar health={data.market_health} />

              {/* Themes */}
              {data.themes.length > 0 && (
                <Section title="Emerging Themes" icon={Sparkles} iconColor="text-purple" count={data.themes.length}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.themes.map((theme, i) => (
                      <ThemeCard key={theme.title} theme={theme} idx={i} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Law Watch */}
              <Section
                title="Law Watch"
                icon={Gavel}
                iconColor="text-gold"
                count={data.law_watch.length}
                empty={data.law_watch.length === 0}
              >
                {data.law_watch.map((entry, i) => (
                  <LawWatchRow key={entry.id} entry={entry} idx={i} />
                ))}
                {data.law_watch.length > 0 && (
                  <Link
                    href="/exchange/near-law"
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
                  >
                    View all near-law markets <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </Section>

              {/* Breakouts */}
              <Section
                title="Breakouts"
                icon={Flame}
                iconColor="text-for-400"
                count={data.breakouts.length}
                empty={data.breakouts.length === 0}
              >
                {data.breakouts.map((entry, i) => (
                  <BreakoutRow key={entry.id} entry={entry} idx={i} />
                ))}
              </Section>

              {/* Category Rotation */}
              <Section
                title="Category Rotation"
                icon={Layers}
                iconColor="text-emerald"
                count={data.rotation.length}
                empty={data.rotation.length === 0}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {data.rotation.map((cat) => (
                    <CategoryCard key={cat.category} cat={cat} />
                  ))}
                </div>
              </Section>

              {/* Quality Divergence / Arbitrage */}
              {data.arbitrage.length > 0 && (
                <Section
                  title="Quality Divergence"
                  icon={Target}
                  iconColor="text-purple"
                  count={data.arbitrage.length}
                >
                  {data.arbitrage.map((entry, i) => (
                    <ArbitrageRow key={entry.id} entry={entry} idx={i} />
                  ))}
                  <Link
                    href="/exchange/divergence"
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-purple transition-colors"
                  >
                    Open Divergence Detector <ArrowRight className="h-3 w-3" />
                  </Link>
                </Section>
              )}

              {/* Contrarian Watch */}
              {data.contrary.length > 0 && (
                <Section
                  title="Contrarian Watch"
                  icon={Scale}
                  iconColor="text-against-400"
                  count={data.contrary.length}
                >
                  {data.contrary.map((signal, i) => (
                    <ContraryRow key={signal.id} signal={signal} idx={i} />
                  ))}
                </Section>
              )}

              {/* Quick nav to related tools */}
              <div className="pt-2 border-t border-surface-200">
                <p className="text-xs font-mono text-surface-600 mb-3 uppercase tracking-wider">Related Tools</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: '/exchange/signals', label: 'Signal Board', icon: Zap },
                    { href: '/exchange/divergence', label: 'Divergence', icon: FlaskConical },
                    { href: '/exchange/near-law', label: 'Near Law', icon: Gavel },
                    { href: '/exchange/rotation', label: 'Rotation', icon: Layers },
                    { href: '/exchange/screener', label: 'Screener', icon: BarChart2 },
                    { href: '/exchange/momentum', label: 'Momentum', icon: TrendingUp },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/40 transition-all text-sm text-surface-400 hover:text-white group"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-surface-500 group-hover:text-for-400 transition-colors" />
                      <span className="text-xs font-mono">{label}</span>
                      <ArrowRight className="h-3 w-3 ml-auto shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </div>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
