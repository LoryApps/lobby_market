'use client'

/**
 * /vote-map — Civic Scope Map
 *
 * Visualises every active topic's vote split nested by geographic scope.
 * Four scope rings: Global → National → Regional → Local.
 *
 * Each scope panel shows:
 *   - Topic count and law count
 *   - Average FOR% gauge bar
 *   - Consensus breakdown (strong for / lean for / contested / lean against / strong against)
 *   - Total votes cast at that scope
 *
 * Clicking a scope filters the topic list on the right panel.
 *
 * Distinct from:
 *   /heatmap     — category × scope matrix (static grid)
 *   /pipeline    — status-based Kanban view
 *   /spectrum    — consensus × engagement 2D scatter
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Circle,
  Gavel,
  Globe,
  MapPin,
  RefreshCw,
  Scale,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  VoteMapResponse,
  VoteMapTopic,
  ScopeStats,
  Scope,
  ConsensusTier,
} from '@/app/api/vote-map/route'

// ─── Constants ────────────────────────────────────────────────────────────────────

const SCOPE_ICONS: Record<Scope, typeof Globe> = {
  Global: Globe,
  National: MapPin,
  Regional: Circle,
  Local: Zap,
}

const SCOPE_COLORS: Record<Scope, { text: string; bg: string; border: string; ring: string }> = {
  Global: {
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/40',
  },
  National: {
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    ring: 'ring-purple/40',
  },
  Regional: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/40',
  },
  Local: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/40',
  },
}

const CONSENSUS_CONFIG: Record<
  ConsensusTier,
  { label: string; shortLabel: string; bar: string; text: string }
> = {
  strong_for:     { label: 'Strong FOR',     shortLabel: 'S.FOR',     bar: 'bg-for-500',          text: 'text-for-400' },
  lean_for:       { label: 'Lean FOR',       shortLabel: 'L.FOR',     bar: 'bg-for-500/50',       text: 'text-for-300' },
  contested:      { label: 'Contested',      shortLabel: 'CONT',      bar: 'bg-surface-400',      text: 'text-surface-500' },
  lean_against:   { label: 'Lean AGAINST',   shortLabel: 'L.AGN',     bar: 'bg-against-500/50',   text: 'text-against-300' },
  strong_against: { label: 'Strong AGAINST', shortLabel: 'S.AGN',     bar: 'bg-against-500',      text: 'text-against-400' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: 'Active',  color: 'text-for-400',  dot: 'bg-for-400'  },
  voting: { label: 'Voting',  color: 'text-purple',   dot: 'bg-purple'   },
  law:    { label: 'LAW',     color: 'text-gold',     dot: 'bg-gold'     },
}

// ─── Sub-components ──────────────────────────────────────────────────────────────────

function ScopeCard({
  stats,
  isSelected,
  onSelect,
}: {
  stats: ScopeStats
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = SCOPE_ICONS[stats.scope]
  const colors = SCOPE_COLORS[stats.scope]
  const total = stats.topicCount
  const forTotal = stats.strongFor + stats.leanFor
  const againstTotal = stats.leanAgainst + stats.strongAgainst

  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all',
        isSelected
          ? cn('ring-2', colors.ring, colors.border, 'bg-surface-200/80')
          : 'border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/60',
      )}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-xl', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-mono font-bold', colors.text)}>
              {stats.scope}
            </span>
            {isSelected && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full', colors.bg, colors.text)}>
                selected
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 font-mono">
            {stats.topicCount} topic{stats.topicCount !== 1 ? 's' : ''} · {stats.lawCount} law{stats.lawCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono font-bold text-white">{stats.avgBluePct}%</div>
          <div className="text-[10px] text-surface-500 font-mono">avg FOR</div>
        </div>
      </div>

      {/* Consensus breakdown bar */}
      {total > 0 ? (
        <div className="space-y-1.5">
          <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex gap-px">
            {(
              [
                ['strong_for', stats.strongFor],
                ['lean_for', stats.leanFor],
                ['contested', stats.contested],
                ['lean_against', stats.leanAgainst],
                ['strong_against', stats.strongAgainst],
              ] as [ConsensusTier, number][]
            )
              .filter(([, n]) => n > 0)
              .map(([tier, n]) => (
                <motion.div
                  key={tier}
                  className={cn('h-full', CONSENSUS_CONFIG[tier].bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${(n / total) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                />
              ))}
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">
              {forTotal} FOR-leaning
            </span>
            <span className="text-surface-500">{stats.contested} contested</span>
            <span className="text-against-400">
              {againstTotal} AGN-leaning
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-surface-500 font-mono">No topics at this scope</p>
      )}
    </motion.button>
  )
}

function TopicRow({ topic }: { topic: VoteMapTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const st = STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-500', dot: 'bg-surface-400' }
  const consensus = CONSENSUS_CONFIG[topic.consensus]

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-surface-300/60 bg-surface-100/80 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-mono', st.color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />
            {st.label}
          </span>
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
          )}
          <span className={cn('text-[10px] font-mono', consensus.text)}>
            {consensus.shortLabel}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
          <motion.div
            className="h-full bg-for-500"
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full bg-against-500"
            initial={{ width: 0 }}
            animate={{ width: `${againstPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
          <span className="text-[10px] font-mono text-against-400">{againstPct}% AGN</span>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0 group-hover:text-white transition-colors" />
    </Link>
  )
}

// ─── Sunburst-style scope rings ───────────────────────────────────────────────

function ScopeRings({
  scopes,
  selected,
  onSelect,
}: {
  scopes: ScopeStats[]
  selected: Scope | null
  onSelect: (s: Scope | null) => void
}) {
  const scopeOrder: Scope[] = ['Global', 'National', 'Regional', 'Local']
  const maxCount = Math.max(...scopes.map((s) => s.topicCount), 1)

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {scopeOrder.map((scope) => {
        const stats = scopes.find((s) => s.scope === scope)
        if (!stats) return null

        const colors = SCOPE_COLORS[scope]
        const Icon = SCOPE_ICONS[scope]
        const isSelected = selected === scope
        const widthPct = Math.max(20, (stats.topicCount / maxCount) * 100)

        return (
          <motion.button
            key={scope}
            onClick={() => onSelect(isSelected ? null : scope)}
            whileTap={{ scale: 0.97 }}
            style={{ width: `${widthPct}%` }}
            className={cn(
              'relative rounded-2xl border px-4 py-3 transition-all text-left',
              'min-w-[200px] max-w-full',
              isSelected
                ? cn(colors.bg, colors.border, 'ring-2', colors.ring)
                : 'border-surface-300 bg-surface-100 hover:border-surface-400',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4 flex-shrink-0', colors.text)} />
                <span className={cn('text-sm font-mono font-bold', colors.text)}>
                  {scope}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-white">
                    {stats.topicCount}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">topics</div>
                </div>
                {stats.lawCount > 0 && (
                  <div className="text-right">
                    <div className="text-xs font-mono font-semibold text-gold">
                      {stats.lawCount}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500">laws</div>
                  </div>
                )}
                <div className="text-right">
                  <div className={cn('text-xs font-mono font-semibold', colors.text)}>
                    {stats.avgBluePct}%
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">FOR</div>
                </div>
              </div>
            </div>

            {/* Mini consensus bar */}
            {stats.topicCount > 0 && (
              <div className="mt-2 h-1 rounded-full overflow-hidden bg-surface-300 flex gap-px">
                {(
                  [
                    ['strong_for', stats.strongFor],
                    ['lean_for', stats.leanFor],
                    ['contested', stats.contested],
                    ['lean_against', stats.leanAgainst],
                    ['strong_against', stats.strongAgainst],
                  ] as [ConsensusTier, number][]
                )
                  .filter(([, n]) => n > 0)
                  .map(([tier, n]) => (
                    <div
                      key={tier}
                      className={cn('h-full', CONSENSUS_CONFIG[tier].bar)}
                      style={{ width: `${(n / stats.topicCount) * 100}%` }}
                    />
                  ))}
              </div>
            )}

            {isSelected && (
              <span className={cn(
                'absolute -top-1.5 -right-1.5 text-[9px] font-mono font-bold',
                'px-1.5 py-0.5 rounded-full border',
                colors.bg, colors.border, colors.text
              )}>
                selected
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function VoteMapPage() {
  const [data, setData] = useState<VoteMapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null)
  const [consensusFilter, setConsensusFilter] = useState<ConsensusTier | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voting' | 'law'>('all')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(false)

    try {
      const url = '/api/vote-map'
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as VoteMapResponse
      setData(json)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  // Filtered topics for the sidebar
  const filteredTopics = (data?.topics ?? []).filter((t) => {
    if (selectedScope && t.scope !== selectedScope) return false
    if (consensusFilter && t.consensus !== consensusFilter) return false
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    return true
  })

  const totalVotes = data?.scopes.reduce((sum, s) => sum + s.totalVotes, 0) ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-28">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <h1 className="font-mono text-3xl font-bold text-white mb-2">Civic Scope Map</h1>
          <p className="text-sm text-surface-500 font-mono max-w-lg">
            How the Lobby votes across geographic scope — Global, National, Regional, and Local.
            Each ring represents one scope level; width reflects topic count.
          </p>

          {/* Platform summary */}
          {data && (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Total Topics',
                  value: data.totalTopics,
                  icon: BarChart2,
                  color: 'text-for-400',
                  bg: 'bg-for-500/10',
                },
                {
                  label: 'Established Laws',
                  value: data.totalLaws,
                  icon: Gavel,
                  color: 'text-gold',
                  bg: 'bg-gold/10',
                },
                {
                  label: 'Platform FOR%',
                  value: `${data.globalAvgBluePct}%`,
                  icon: Vote,
                  color: data.globalAvgBluePct >= 50 ? 'text-for-400' : 'text-against-400',
                  bg: data.globalAvgBluePct >= 50 ? 'bg-for-500/10' : 'bg-against-500/10',
                },
                {
                  label: 'Total Votes',
                  value: totalVotes >= 1000
                    ? `${(totalVotes / 1000).toFixed(0)}k`
                    : totalVotes,
                  icon: Activity,
                  color: 'text-purple',
                  bg: 'bg-purple/10',
                },
              ].map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn('p-1 rounded-lg', stat.bg)}>
                        <Icon className={cn('h-3.5 w-3.5', stat.color)} />
                      </div>
                    </div>
                    <div className={cn('font-mono text-xl font-bold', stat.color)}>
                      {stat.value}
                    </div>
                    <div className="text-[11px] font-mono text-surface-500">{stat.label}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {loading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <div className="grid grid-cols-1 gap-3">
              {[...Array(5)].map((_, idx) => (
                <Skeleton key={idx} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Scale className="h-8 w-8 text-surface-500" />
            <p className="text-sm text-surface-500 font-mono">Failed to load scope data</p>
            <button
              onClick={load}
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Scope rings */}
            <div>
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                Scope Rings
              </h2>
              <p className="text-[11px] text-surface-500 font-mono mb-4">
                Width reflects number of topics at that scope. Click to filter.
              </p>

              <ScopeRings
                scopes={data.scopes}
                selected={selectedScope}
                onSelect={(s) => {
                  setSelectedScope(s)
                  setConsensusFilter(null)
                }}
              />

              {/* Consensus legend */}
              <div className="mt-6 rounded-xl border border-surface-300 bg-surface-100 p-4">
                <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  Consensus Legend
                </h3>
                <div className="space-y-2">
                  {(
                    [
                      'strong_for',
                      'lean_for',
                      'contested',
                      'lean_against',
                      'strong_against',
                    ] as ConsensusTier[]
                  ).map((tier) => {
                    const cfg = CONSENSUS_CONFIG[tier]
                    const isActive = consensusFilter === tier
                    return (
                      <button
                        key={tier}
                        onClick={() => setConsensusFilter(isActive ? null : tier)}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                          isActive ? 'bg-surface-200' : 'hover:bg-surface-200/60',
                        )}
                      >
                        <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', cfg.bar)} />
                        <span className={cn('text-xs font-mono', cfg.text)}>{cfg.label}</span>
                        {tier === 'strong_for' && (
                          <span className="text-[10px] font-mono text-surface-500 ml-1">≥ 70% FOR</span>
                        )}
                        {tier === 'lean_for' && (
                          <span className="text-[10px] font-mono text-surface-500 ml-1">55–69%</span>
                        )}
                        {tier === 'contested' && (
                          <span className="text-[10px] font-mono text-surface-500 ml-1">45–54%</span>
                        )}
                        {tier === 'lean_against' && (
                          <span className="text-[10px] font-mono text-surface-500 ml-1">30–44%</span>
                        )}
                        {tier === 'strong_against' && (
                          <span className="text-[10px] font-mono text-surface-500 ml-1">≤ 29% FOR</span>
                        )}
                        {isActive && (
                          <span className="ml-auto text-[10px] font-mono text-for-400">active</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Status filter */}
              <div className="mt-4 flex gap-2 flex-wrap">
                {(['all', 'active', 'voting', 'law'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                      statusFilter === s
                        ? s === 'all'
                          ? 'bg-surface-300 text-white border-surface-400'
                          : s === 'law'
                          ? 'bg-gold/20 text-gold border-gold/50'
                          : s === 'voting'
                          ? 'bg-purple/20 text-purple border-purple/50'
                          : 'bg-for-500/20 text-for-400 border-for-500/50'
                        : 'border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                    )}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Topic list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  {selectedScope
                    ? `${selectedScope} Topics`
                    : 'All Topics'}
                  {' '}
                  <span className="text-surface-400 normal-case">({filteredTopics.length})</span>
                </h2>
                {(selectedScope || consensusFilter || statusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedScope(null)
                      setConsensusFilter(null)
                      setStatusFilter('all')
                    }}
                    className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${selectedScope}-${consensusFilter}-${statusFilter}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 max-h-[640px] overflow-y-auto pr-1"
                >
                  {filteredTopics.length === 0 ? (
                    <EmptyState
                      icon={Globe}
                      title="No topics match"
                      description="Try adjusting your filters"
                    />
                  ) : (
                    filteredTopics.slice(0, 50).map((topic) => (
                      <TopicRow key={topic.id} topic={topic} />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>

              {filteredTopics.length > 50 && (
                <p className="text-[11px] text-surface-500 font-mono mt-3 text-center">
                  Showing top 50 of {filteredTopics.length} topics
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scope cards at bottom — detailed breakdown */}
        {data && (
          <div className="mt-10">
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4">
              Scope Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.scopes.map((stats) => (
                <ScopeCard
                  key={stats.scope}
                  stats={stats}
                  isSelected={selectedScope === stats.scope}
                  onSelect={() =>
                    setSelectedScope(
                      selectedScope === stats.scope ? null : stats.scope,
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* CTA links */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/heatmap"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Category Heatmap
          </Link>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            Pipeline View
          </Link>
          <Link
            href="/spectrum"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            Civic Spectrum
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-xs font-mono text-white transition-colors"
          >
            Browse Feed
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
