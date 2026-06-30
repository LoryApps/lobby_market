'use client'

/**
 * /topic/[id]/what-if — Scenario Lab
 *
 * Explores two alternate civic timelines for a topic:
 *   • If FOR Wins  — consensus cascades, aligned debates shift, chains unlock
 *   • If AGAINST Wins — opposition gains momentum, counter-chains energised
 *
 * Data sources: topic correlations, chain topology, category context.
 * Distinct from /forecast (single probability), /correlations (raw alignment
 * matrix), /connections (wiki graph), /simulate (open-ended policy simulation).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  GitBranch,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
  Copy,
  Check,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { WhatIfResponse, WhatIfCorrelatedTopic, WhatIfChainTopic, WhatIfScenarioEffect } from '@/app/api/topics/[id]/what-if/route'

// ─── Types ───────────────────────────────────────────────────────────────────

type Scenario = 'pass' | 'fail'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctBar(pct: number, side: 'for' | 'against') {
  const clr = side === 'for' ? 'bg-for-500' : 'bg-against-500'
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
      <div className={cn('h-full rounded-full', clr)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function shiftLabel(shift: number) {
  if (Math.abs(shift) < 1) return <span className="text-surface-500 text-xs">~unchanged</span>
  if (shift > 0)
    return <span className="text-for-400 text-xs font-medium">+{shift.toFixed(1)}% FOR</span>
  return <span className="text-against-400 text-xs font-medium">{shift.toFixed(1)}% FOR</span>
}

function magnitudeColor(magnitude: string) {
  if (magnitude === 'high') return 'text-gold'
  if (magnitude === 'medium') return 'text-for-300'
  return 'text-surface-500'
}

function effectIcon(type: string) {
  switch (type) {
    case 'consensus_shift': return <BarChart2 className="w-4 h-4 shrink-0" />
    case 'chain_unlock': return <GitBranch className="w-4 h-4 shrink-0" />
    case 'coalition_impact': return <Zap className="w-4 h-4 shrink-0" />
    case 'category_ripple': return <TrendingUp className="w-4 h-4 shrink-0" />
    case 'precedent': return <Scale className="w-4 h-4 shrink-0" />
    default: return <Sparkles className="w-4 h-4 shrink-0" />
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EffectCard({ effect, scenario }: { effect: WhatIfScenarioEffect; scenario: Scenario }) {
  const borderColor =
    effect.direction === 'positive'
      ? scenario === 'pass'
        ? 'border-for-500/30'
        : 'border-against-500/30'
      : effect.direction === 'negative'
        ? scenario === 'pass'
          ? 'border-against-500/20'
          : 'border-for-500/20'
        : 'border-surface-400/30'

  const iconColor =
    effect.direction === 'positive'
      ? scenario === 'pass' ? 'text-for-400' : 'text-against-400'
      : effect.direction === 'negative'
        ? scenario === 'pass' ? 'text-against-400' : 'text-for-400'
        : 'text-surface-500'

  return (
    <div className={cn('rounded-xl border bg-surface-100/60 p-4', borderColor)}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', iconColor)}>{effectIcon(effect.type)}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-white">{effect.label}</span>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', magnitudeColor(effect.magnitude))}>
              {effect.magnitude} impact
            </span>
          </div>
          <p className="text-xs text-surface-600 leading-relaxed">{effect.description}</p>
        </div>
      </div>
    </div>
  )
}

function CorrelatedTopicRow({ topic, scenario }: { topic: WhatIfCorrelatedTopic; scenario: Scenario }) {
  const shift = scenario === 'pass' ? topic.projected_shift_if_pass : topic.projected_shift_if_fail
  const absShift = Math.abs(shift)
  const projectedPct = Math.max(2, Math.min(98, (topic.blue_pct ?? 50) + shift))

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="block rounded-xl border border-surface-400/30 bg-surface-100/60 p-4 hover:bg-surface-200/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm text-surface-700 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {topic.statement}
        </p>
        <ExternalLink className="w-3 h-3 shrink-0 text-surface-500 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex items-center gap-2 mb-2">
        {topic.category && (
          <Badge variant="secondary" className="text-[10px] py-0">{topic.category}</Badge>
        )}
        <span className="text-[10px] text-surface-600">
          {topic.direction === 'aligned' ? 'aligned' : 'opposed'} ·{' '}
          {Math.round(Math.abs(topic.correlation) * 100)}% signal
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-600 w-20">Current</span>
          {pctBar(topic.blue_pct ?? 50, 'for')}
          <span className="text-[10px] text-surface-500 w-12 text-right">{Math.round(topic.blue_pct ?? 50)}% FOR</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-600 w-20">Projected</span>
          {pctBar(projectedPct, 'for')}
          <span className="w-12 text-right">{shiftLabel(shift)}</span>
        </div>
      </div>
      {absShift >= 5 && (
        <div className={cn(
          'mt-2 text-[10px] font-medium flex items-center gap-1',
          shift > 0 ? 'text-for-400' : 'text-against-400'
        )}>
          {shift > 0
            ? <><TrendingUp className="w-3 h-3" /> Shifts FOR</>
            : <><TrendingDown className="w-3 h-3" /> Shifts AGAINST</>}
        </div>
      )}
    </Link>
  )
}

function ChainTopicRow({ chain, scenario }: { chain: WhatIfChainTopic; scenario: Scenario }) {
  const isActivated =
    chain.activated_by === 'either' ||
    (scenario === 'pass' && chain.activated_by === 'pass') ||
    (scenario === 'fail' && chain.activated_by === 'fail')

  return (
    <Link
      href={`/topic/${chain.id}`}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 transition-colors group',
        isActivated
          ? 'border-emerald/30 bg-emerald/5 hover:bg-emerald/10'
          : 'border-surface-400/20 bg-surface-100/40 opacity-60 hover:opacity-80'
      )}
    >
      <div className={cn(
        'mt-0.5 flex-none w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border',
        chain.connector === 'and' ? 'border-for-500/40 text-for-400' : 'border-against-500/40 text-against-400'
      )}>
        {chain.connector === 'and' ? '+' : '÷'}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] py-0',
              chain.connector === 'and' ? 'bg-for-500/10 text-for-400' : 'bg-against-500/10 text-against-400'
            )}
          >
            {chain.connector === 'and' ? 'AND' : 'BUT'} chain
          </Badge>
          {isActivated && (
            <span className="text-[10px] text-emerald font-medium">activated</span>
          )}
        </div>
        <p className="text-sm text-surface-700 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {chain.statement}
        </p>
      </div>
      <ExternalLink className="w-3 h-3 shrink-0 text-surface-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WhatIfClient({ topicId }: { topicId: string }) {
  const params = useParams()
  const id = topicId || (params?.id as string)

  const [data, setData] = useState<WhatIfResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<Scenario>('pass')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/what-if`)
      if (!res.ok) throw new Error('Failed to load scenario data')
      const json: WhatIfResponse = await res.json()
      setData(json)
      // Default to the MORE LIKELY scenario
      if (json.scenarios.fail.probability > json.scenarios.pass.probability) {
        setActiveScenario('fail')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  if (loading) return <WhatIfSkeleton />

  if (error || !data) {
    return (
      <div className="flex flex-col h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-against-400 mx-auto" />
            <p className="text-surface-600">{error ?? 'No data available'}</p>
            <button onClick={load} className="text-sm text-for-400 hover:text-for-300 flex items-center gap-1 mx-auto">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const scenario = data.scenarios[activeScenario]
  const otherScenario = activeScenario === 'pass' ? data.scenarios.fail : data.scenarios.pass
  const forPct = Math.round(data.topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href={`/topic/${id}`} className="text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <span className="hover:text-surface-700 transition-colors">
              <Link href={`/topic/${id}`}>Topic</Link>
            </span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white font-medium">What If?</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>

        {/* Page title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-purple" />
            <span className="text-xs font-semibold text-purple uppercase tracking-wider">Scenario Lab</span>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight mb-2">What If?</h1>
          <p className="text-sm text-surface-600 line-clamp-3">{data.topic.statement}</p>
        </div>

        {/* Current vote snapshot */}
        <div className="rounded-2xl border border-surface-400/30 bg-surface-100/60 p-4">
          <p className="text-xs text-surface-500 mb-3">Current vote distribution</p>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-for-400">{forPct}%</div>
              <div className="text-[10px] text-surface-500">FOR</div>
            </div>
            <div className="flex-1 h-3 rounded-full bg-surface-300 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400" style={{ width: `${forPct}%` }} />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-against-400">{againstPct}%</div>
              <div className="text-[10px] text-surface-500">AGAINST</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-surface-600">
            <span>{(data.topic.total_votes ?? 0).toLocaleString()} votes cast</span>
            {data.topic.category && <Badge variant="secondary" className="text-[10px] py-0">{data.topic.category}</Badge>}
            <span className="capitalize">{data.topic.status}</span>
          </div>
        </div>

        {/* Scenario selector */}
        <div className="grid grid-cols-2 gap-3">
          {(['pass', 'fail'] as const).map(s => {
            const sc = data.scenarios[s]
            const isActive = s === activeScenario
            const isFor = s === 'pass'
            return (
              <button
                key={s}
                onClick={() => setActiveScenario(s)}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all',
                  isActive
                    ? isFor
                      ? 'border-for-500/50 bg-for-500/10 ring-1 ring-for-500/30'
                      : 'border-against-500/50 bg-against-500/10 ring-1 ring-against-500/30'
                    : 'border-surface-400/30 bg-surface-100/60 hover:bg-surface-200/60'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isFor
                    ? <ThumbsUp className={cn('w-4 h-4', isActive ? 'text-for-400' : 'text-surface-500')} />
                    : <ThumbsDown className={cn('w-4 h-4', isActive ? 'text-against-400' : 'text-surface-500')} />}
                  <span className={cn(
                    'text-sm font-bold',
                    isActive ? (isFor ? 'text-for-300' : 'text-against-300') : 'text-surface-600'
                  )}>
                    {sc.label}
                  </span>
                </div>
                <div className={cn(
                  'text-2xl font-bold mb-1',
                  isFor ? 'text-for-400' : 'text-against-400'
                )}>
                  {sc.probability}%
                </div>
                <div className="text-[10px] text-surface-600 leading-tight">{sc.tagline}</div>
              </button>
            )
          })}
        </div>

        {/* Active scenario panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScenario}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Net consensus shift */}
            {Math.abs(scenario.consensus_shift) >= 1 && data.has_correlation_data && (
              <div className={cn(
                'rounded-xl border p-4 flex items-center gap-4',
                scenario.consensus_shift > 0
                  ? 'border-for-500/30 bg-for-500/5'
                  : 'border-against-500/30 bg-against-500/5'
              )}>
                {scenario.consensus_shift > 0
                  ? <TrendingUp className="w-8 h-8 text-for-400 shrink-0" />
                  : <TrendingDown className="w-8 h-8 text-against-400 shrink-0" />}
                <div>
                  <div className={cn(
                    'text-xl font-bold',
                    scenario.consensus_shift > 0 ? 'text-for-300' : 'text-against-300'
                  )}>
                    {scenario.consensus_shift > 0 ? '+' : ''}{scenario.consensus_shift.toFixed(1)} pts
                  </div>
                  <p className="text-xs text-surface-600">
                    Net platform consensus shift across {data.correlated.length} correlated topic{data.correlated.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Scenario effects */}
            {scenario.effects.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple" />
                  Cascade Effects
                </h2>
                <div className="space-y-3">
                  {scenario.effects.map((effect, i) => (
                    <EffectCard key={i} effect={effect} scenario={activeScenario} />
                  ))}
                </div>
              </section>
            )}

            {/* Correlated topics */}
            {data.correlated.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-for-400" />
                  Correlated Debates
                  <span className="text-surface-500 font-normal text-xs ml-auto">projected shifts</span>
                </h2>
                <div className="space-y-3">
                  {data.correlated
                    .sort((a, b) => {
                      const shiftA = Math.abs(activeScenario === 'pass' ? a.projected_shift_if_pass : a.projected_shift_if_fail)
                      const shiftB = Math.abs(activeScenario === 'pass' ? b.projected_shift_if_pass : b.projected_shift_if_fail)
                      return shiftB - shiftA
                    })
                    .slice(0, 6)
                    .map(t => (
                      <CorrelatedTopicRow key={t.id} topic={t} scenario={activeScenario} />
                    ))}
                </div>
                {data.correlated.length > 6 && (
                  <p className="text-xs text-surface-600 text-center mt-3">
                    +{data.correlated.length - 6} more correlated debate{data.correlated.length - 6 !== 1 ? 's' : ''} ·{' '}
                    <Link href={`/topic/${id}/correlations`} className="text-for-400 hover:text-for-300">
                      View full correlations
                    </Link>
                  </p>
                )}
              </section>
            )}

            {/* Chain topics */}
            {data.chains.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-emerald" />
                  Chain Debates
                </h2>
                <p className="text-xs text-surface-600 mb-3">
                  Connected &ldquo;AND&rdquo; and &ldquo;BUT&rdquo; topics that gain or lose urgency depending on this outcome.
                </p>
                <div className="space-y-2">
                  {data.chains.map(c => (
                    <ChainTopicRow key={c.id} chain={c} scenario={activeScenario} />
                  ))}
                </div>
              </section>
            )}

            {/* No correlation data fallback */}
            {!data.has_correlation_data && data.correlated.length === 0 && (
              <div className="rounded-xl border border-surface-400/20 bg-surface-100/40 p-6 text-center">
                <BarChart2 className="w-8 h-8 text-surface-500 mx-auto mb-3" />
                <p className="text-sm text-surface-600 mb-1">Not enough cross-voter data yet</p>
                <p className="text-xs text-surface-500">
                  Correlation data requires at least 3 shared voters with other topics.
                  As this debate grows, the scenario model will sharpen.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Compare the other scenario teaser */}
        <div className={cn(
          'rounded-xl border p-4 flex items-center justify-between cursor-pointer group',
          activeScenario === 'pass'
            ? 'border-against-500/20 hover:border-against-500/40'
            : 'border-for-500/20 hover:border-for-500/40'
        )}
          onClick={() => setActiveScenario(activeScenario === 'pass' ? 'fail' : 'pass')}
        >
          <div>
            <p className="text-xs text-surface-500 mb-0.5">Switch scenario</p>
            <p className="text-sm font-semibold text-white">{otherScenario.label}</p>
            <p className="text-xs text-surface-600">{otherScenario.probability}% probability · {otherScenario.tagline}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-surface-500 group-hover:text-white transition-colors" />
        </div>

        {/* Nav links */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href={`/topic/${id}/forecast`}
            className="flex items-center justify-between rounded-xl border border-surface-400/20 bg-surface-100/40 p-3 hover:bg-surface-200/60 transition-colors group text-sm"
          >
            <span className="text-surface-600 group-hover:text-white transition-colors">Law Forecast</span>
            <ChevronRight className="w-4 h-4 text-surface-500" />
          </Link>
          <Link
            href={`/topic/${id}/correlations`}
            className="flex items-center justify-between rounded-xl border border-surface-400/20 bg-surface-100/40 p-3 hover:bg-surface-200/60 transition-colors group text-sm"
          >
            <span className="text-surface-600 group-hover:text-white transition-colors">Correlations</span>
            <ChevronRight className="w-4 h-4 text-surface-500" />
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function WhatIfSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4 space-y-5">
        <Skeleton className="h-4 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
