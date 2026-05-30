'use client'

/**
 * /epoch — The Civic Epoch
 *
 * A platform-wide periodization view. Shows the Lobby's history broken into
 * "epochs" — each month characterised by its defining civic events: laws passed,
 * dominant categories, consensus direction, and debate intensity.
 *
 * Think of it as a "political history book" view of the platform. Each epoch
 * gets a name ("Legislative Era", "Great Debate", "Civic Surge") derived from
 * the data for that month.
 *
 * Distinct from:
 *   /chronicle       — raw chronological event log
 *   /annual          — all-time aggregated statistics
 *   /cascade         — downstream ripple effect of individual laws
 *   /timeline        — single-topic vote history
 *   /drift           — category-level consensus shift
 *
 * This is the only view that gives each period of platform history
 * a CHARACTER — showing not just WHAT happened, but WHAT KIND of civic
 * moment that month represented.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cpu,
  DollarSign,
  ExternalLink,
  FlaskConical,
  Gavel,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { EpochMonth, EpochResponse, EpochCharacter } from '@/app/api/epoch/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: DollarSign,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-for-300',
  Philosophy: 'text-surface-500',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

const CATEGORY_BG: Record<string, string> = {
  Economics: 'bg-gold/10 border-gold/30',
  Politics: 'bg-for-500/10 border-for-500/30',
  Technology: 'bg-purple/10 border-purple/30',
  Science: 'bg-emerald/10 border-emerald/30',
  Ethics: 'bg-for-300/10 border-for-300/30',
  Philosophy: 'bg-surface-300/30 border-surface-400/30',
  Culture: 'bg-against-500/10 border-against-500/30',
  Health: 'bg-emerald/10 border-emerald/30',
  Environment: 'bg-emerald/10 border-emerald/30',
  Education: 'bg-gold/10 border-gold/30',
}

// ─── Epoch character config ───────────────────────────────────────────────────

const CHARACTER_CONFIG: Record<
  EpochCharacter,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; glow: string }
> = {
  legislative: { icon: Gavel,        color: 'text-gold',         bg: 'bg-gold/10 border-gold/30',         glow: 'shadow-gold/10' },
  contested:   { icon: Scale,        color: 'text-purple',       bg: 'bg-purple/10 border-purple/30',     glow: 'shadow-purple/10' },
  consensus:   { icon: ThumbsUp,     color: 'text-for-400',      bg: 'bg-for-500/10 border-for-500/30',   glow: 'shadow-for-500/10' },
  resistance:  { icon: ThumbsDown,   color: 'text-against-400',  bg: 'bg-against-500/10 border-against-500/30', glow: 'shadow-against-500/10' },
  surge:       { icon: Zap,          color: 'text-emerald',      bg: 'bg-emerald/10 border-emerald/30',   glow: 'shadow-emerald/10' },
  quiet:       { icon: Activity,     color: 'text-surface-500',  bg: 'bg-surface-200/50 border-surface-300/50', glow: '' },
  debate:      { icon: MessageSquare,color: 'text-for-300',      bg: 'bg-for-300/10 border-for-300/30',   glow: 'shadow-for-300/10' },
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function EpochSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-4/5" />
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
      <span className="text-[11px] text-surface-500">{label}</span>
      <span className={cn('text-[11px] font-mono font-semibold', color)}>{value}</span>
    </div>
  )
}

function ConsensusMeter({ pct }: { pct: number }) {
  const forWidth = `${pct}%`
  const againstWidth = `${100 - pct}%`
  const isFor = pct > 52
  const isAgainst = pct < 48
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-for-400 w-8 text-right">{pct}%</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden flex">
        <div className="bg-for-500 h-full transition-all" style={{ width: forWidth }} />
        <div className="bg-against-500 h-full transition-all" style={{ width: againstWidth }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-8">{100 - pct}%</span>
      {isFor && <TrendingUp className="h-3 w-3 text-for-400 flex-shrink-0" />}
      {isAgainst && <TrendingDown className="h-3 w-3 text-against-400 flex-shrink-0" />}
    </div>
  )
}

function EpochCard({ epoch, index }: { epoch: EpochMonth; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = CHARACTER_CONFIG[epoch.character]
  const CharIcon = cfg.icon
  const CatIcon = epoch.dominant_category
    ? (CATEGORY_ICON[epoch.dominant_category] ?? Globe)
    : null
  const catColor = epoch.dominant_category ? CATEGORY_COLOR[epoch.dominant_category] : 'text-surface-500'
  const catBg = epoch.dominant_category ? CATEGORY_BG[epoch.dominant_category] : 'bg-surface-200/50 border-surface-300/50'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden',
        'hover:border-surface-400 transition-colors',
      )}
    >
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${epoch.month_label}: ${epoch.character_label}`}
        className="w-full text-left p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500 focus-visible:ring-inset"
      >
        <div className="flex items-start gap-3">
          {/* Character icon */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border',
              cfg.bg,
            )}
          >
            <CharIcon className={cn('h-5 w-5', cfg.color)} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-white">{epoch.character_label}</h2>
              {epoch.law_count > 0 && (
                <span className="text-[10px] font-mono font-bold text-gold bg-gold/10 border border-gold/30 rounded-full px-1.5 py-0.5">
                  {epoch.law_count} LAW{epoch.law_count !== 1 ? 'S' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] text-surface-500 mt-0.5 font-mono">{epoch.month_label}</p>
          </div>

          {/* Category + chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {epoch.dominant_category && CatIcon && (
              <div className={cn('flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono', catBg, catColor)}>
                <CatIcon className="h-3 w-3" />
                <span className="hidden sm:inline">{epoch.dominant_category}</span>
              </div>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-surface-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-surface-500" />
            )}
          </div>
        </div>

        {/* Description + stats */}
        <p className="text-xs text-surface-500 mt-2.5 leading-relaxed">{epoch.character_desc}</p>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
          <StatPill icon={Gavel} label="Laws" value={epoch.law_count} color="text-gold" />
          <StatPill icon={BarChart2} label="Topics" value={epoch.topic_count} color="text-for-400" />
          <StatPill icon={MessageSquare} label="Arguments" value={epoch.argument_count} color="text-purple" />
        </div>

        {/* Consensus meter */}
        <div className="mt-3">
          <ConsensusMeter pct={epoch.avg_blue_pct} />
        </div>
      </button>

      {/* ── Expanded laws ── */}
      <AnimatePresence>
        {expanded && epoch.laws_passed.length > 0 && (
          <motion.div
            key="laws"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300 px-5 py-4 space-y-2">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                Laws Established
              </p>
              {epoch.laws_passed.map((law) => {
                const LawCatIcon = law.category
                  ? (CATEGORY_ICON[law.category] ?? Globe)
                  : Globe
                const lawCatColor = law.category ? CATEGORY_COLOR[law.category] : 'text-surface-500'
                const forPct = Math.round(law.blue_pct ?? 50)
                return (
                  <Link
                    key={law.id}
                    href={`/topic/${law.topic_id}`}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl',
                      'bg-surface-200/50 hover:bg-surface-200 border border-surface-300/50 hover:border-surface-400/50',
                      'transition-colors group',
                    )}
                  >
                    <LawCatIcon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', lawCatColor)} />
                    <p className="text-xs text-white/80 group-hover:text-white leading-relaxed flex-1 min-w-0 transition-colors">
                      {law.statement}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
                      <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-surface-400 transition-colors" />
                    </div>
                  </Link>
                )
              })}
              {epoch.law_count > epoch.laws_passed.length && (
                <p className="text-[10px] text-surface-500 text-center py-1">
                  +{epoch.law_count - epoch.laws_passed.length} more laws this epoch
                </p>
              )}
            </div>
          </motion.div>
        )}
        {expanded && epoch.laws_passed.length === 0 && (
          <motion.div
            key="no-laws"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300 px-5 py-4">
              <p className="text-xs text-surface-500 italic">
                No laws passed this epoch — debate was active but consensus was elusive.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Summary banner ───────────────────────────────────────────────────────────

function SummaryBanner({
  totalLaws,
  totalTopics,
  totalVotes,
  epochCount,
}: {
  totalLaws: number
  totalTopics: number
  totalVotes: number
  epochCount: number
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-gold" />
        <h2 className="text-sm font-semibold text-white">Platform History</h2>
      </div>
      <p className="text-xs text-surface-500 leading-relaxed mb-4">
        The Lobby has passed through <span className="text-white font-semibold">{epochCount}</span> epochs
        of civic democracy. Each period shaped the platform&apos;s character — from quiet beginnings to
        legislative waves, contested debates, and civic surges.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Laws Passed', value: totalLaws.toLocaleString(), icon: Gavel, color: 'text-gold' },
          { label: 'Topics Debated', value: totalTopics.toLocaleString(), icon: BarChart2, color: 'text-for-400' },
          { label: 'Arguments Made', value: totalVotes.toLocaleString(), icon: MessageSquare, color: 'text-purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-surface-200/50 border border-surface-300/50">
            <Icon className={cn('h-4 w-4', color)} />
            <span className={cn('text-base font-mono font-bold', color)}>{value}</span>
            <span className="text-[10px] text-surface-500 text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function EpochLegend() {
  const entries: { character: EpochCharacter; label: string }[] = [
    { character: 'legislative', label: 'Legislative Era' },
    { character: 'consensus',   label: 'Progressive Wave' },
    { character: 'resistance',  label: 'Conservative Surge' },
    { character: 'contested',   label: 'Great Debate' },
    { character: 'surge',       label: 'Civic Surge' },
    { character: 'debate',      label: 'Age of Argument' },
    { character: 'quiet',       label: 'Quiet Quarter' },
  ]
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">Epoch Types</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(({ character, label }) => {
          const cfg = CHARACTER_CONFIG[character]
          const Icon = cfg.icon
          return (
            <div
              key={character}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px]', cfg.bg, cfg.color)}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EpochClient() {
  const [data, setData] = useState<EpochResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [charFilter, setCharFilter] = useState<EpochCharacter | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const res = await fetch('/api/epoch', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as EpochResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load epoch data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = charFilter
    ? (data?.epochs ?? []).filter((e) => e.character === charFilter)
    : (data?.epochs ?? [])

  const CHARACTER_FILTERS: { character: EpochCharacter; label: string }[] = [
    { character: 'legislative', label: 'Legislative' },
    { character: 'consensus',   label: 'Progressive' },
    { character: 'resistance',  label: 'Conservative' },
    { character: 'contested',   label: 'Contested' },
    { character: 'surge',       label: 'Surge' },
    { character: 'debate',      label: 'Debate' },
    { character: 'quiet',       label: 'Quiet' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Page header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-gold" />
            <h1 className="text-lg font-bold text-white tracking-tight">The Civic Epoch</h1>
          </div>
          <p className="text-xs text-surface-500 leading-relaxed">
            Every period of the platform&apos;s history, characterised by its defining civic events.
            Expand any epoch to see the laws that shaped it.
          </p>
        </div>

        {/* ── Refresh ── */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            aria-label="Refresh epoch data"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 hover:border-surface-400 text-xs text-surface-500 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading && <EpochSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={<Scale className="h-8 w-8 text-surface-500" />}
            title="Unable to load epochs"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {!loading && data && (
          <>
            {/* Summary */}
            <SummaryBanner
              totalLaws={data.total_laws}
              totalTopics={data.total_topics}
              totalVotes={data.total_votes}
              epochCount={data.epochs.length}
            />

            {/* Legend */}
            <EpochLegend />

            {/* Character filter */}
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                onClick={() => setCharFilter(null)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-mono transition-all',
                  !charFilter
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                )}
              >
                All Epochs
              </button>
              {CHARACTER_FILTERS.map(({ character, label }) => {
                const cfg = CHARACTER_CONFIG[character]
                const active = charFilter === character
                return (
                  <button
                    key={character}
                    onClick={() => setCharFilter(active ? null : character)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all',
                      active
                        ? cn(cfg.bg, cfg.color)
                        : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                    )}
                  >
                    <cfg.icon className="h-3 w-3" />
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Epoch list */}
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-8 w-8 text-surface-500" />}
                title="No epochs match this filter"
                description="Try a different epoch type or clear the filter to see all periods."
                action={{ label: 'Show All', onClick: () => setCharFilter(null) }}
              />
            ) : (
              <div className="space-y-4">
                {filtered.map((epoch, i) => (
                  <EpochCard
                    key={`${epoch.year}-${epoch.month}`}
                    epoch={epoch}
                    index={i}
                  />
                ))}
              </div>
            )}

            {/* Footer note */}
            <div className="mt-8 text-center">
              <p className="text-[10px] text-surface-500 font-mono">
                Showing {filtered.length} epoch{filtered.length !== 1 ? 's' : ''} ·{' '}
                Updated {new Date(data.generated_at).toLocaleTimeString()}
              </p>
              <div className="flex justify-center gap-4 mt-3">
                <Link href="/chronicle" className="text-[11px] text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Full Chronicle
                </Link>
                <Link href="/annual" className="text-[11px] text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Annual Stats
                </Link>
                <Link href="/drift" className="text-[11px] text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Opinion Drift
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
