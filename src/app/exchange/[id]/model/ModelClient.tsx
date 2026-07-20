'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Info,
  Layers,
  MessageSquare,
  RefreshCw,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ModelResponse, ModelFactor } from '@/app/api/exchange/[id]/model/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verdictColor(verdict: ModelResponse['verdict']): string {
  if (verdict === 'overvalued') return 'text-against-400'
  if (verdict === 'undervalued') return 'text-for-400'
  return 'text-emerald'
}

function verdictBg(verdict: ModelResponse['verdict']): string {
  if (verdict === 'overvalued') return 'bg-against-500/10 border-against-500/30'
  if (verdict === 'undervalued') return 'bg-for-500/10 border-for-500/30'
  return 'bg-emerald/10 border-emerald/30'
}

function verdictLabel(verdict: ModelResponse['verdict'], strength: ModelResponse['verdict_strength']): string {
  if (verdict === 'fairly_valued') return 'Fairly Valued'
  const s = strength === 'strong' ? 'Strongly ' : strength === 'moderate' ? 'Moderately ' : 'Slightly '
  return verdict === 'overvalued' ? `${s}Overvalued` : `${s}Undervalued`
}

function verdictIcon(verdict: ModelResponse['verdict']) {
  if (verdict === 'overvalued') return <TrendingDown className="h-5 w-5" />
  if (verdict === 'undervalued') return <TrendingUp className="h-5 w-5" />
  return <CheckCircle2 className="h-5 w-5" />
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function impactColor(impact: ModelFactor['impact']): string {
  if (impact === 'positive') return 'text-for-400'
  if (impact === 'negative') return 'text-against-400'
  return 'text-surface-400'
}

function impactBarColor(impact: ModelFactor['impact']): string {
  if (impact === 'positive') return 'bg-for-500'
  if (impact === 'negative') return 'bg-against-500'
  return 'bg-surface-500'
}

function FactorIcon({ name }: { name: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  if (name.includes('Consensus')) return <Scale className={cls} />
  if (name.includes('Forecaster')) return <Target className={cls} />
  if (name.includes('Category')) return <Layers className={cls} />
  if (name.includes('Argument')) return <MessageSquare className={cls} />
  if (name.includes('Law')) return <Gavel className={cls} />
  return <BarChart2 className={cls} />
}

function confidenceColor(c: number): string {
  if (c >= 70) return 'text-emerald'
  if (c >= 50) return 'text-gold'
  return 'text-surface-400'
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function PriceGauge({ current, fairValue }: { current: number; fairValue: number }) {
  const min = Math.max(0, Math.min(current, fairValue) - 15)
  const max = Math.min(100, Math.max(current, fairValue) + 15)
  const range = max - min || 1

  const currentPct = ((current - min) / range) * 100
  const fairPct = ((fairValue - min) / range) * 100

  return (
    <div className="relative mt-6 mb-2">
      {/* Track */}
      <div className="h-2 w-full rounded-full bg-surface-700 relative overflow-hidden">
        {/* Fill between the two */}
        <div
          className={cn(
            'absolute h-full',
            current > fairValue ? 'bg-against-600/60' : 'bg-for-600/60',
          )}
          style={{
            left: `${Math.min(currentPct, fairPct)}%`,
            width: `${Math.abs(currentPct - fairPct)}%`,
          }}
        />
      </div>

      {/* Fair value marker */}
      <div
        className="absolute -top-1 flex flex-col items-center"
        style={{ left: `${fairPct}%`, transform: 'translateX(-50%)' }}
      >
        <div className="h-4 w-0.5 bg-emerald rounded-full" />
        <span className="text-[9px] text-emerald font-semibold mt-0.5 whitespace-nowrap">
          FV {fairValue}¢
        </span>
      </div>

      {/* Current price marker */}
      <div
        className="absolute -top-1 flex flex-col items-center"
        style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
      >
        <div className="h-4 w-0.5 bg-surface-300 rounded-full" />
        <span className="text-[9px] text-surface-300 font-semibold mt-0.5 whitespace-nowrap">
          NOW {current}¢
        </span>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  id: string
}

export function ModelClient({ id }: Props) {
  const [data, setData] = useState<ModelResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/model`)
      if (!res.ok) throw new Error('Failed to load model data')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load fair value model.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const stmtSlice = data?.statement
    ? data.statement.slice(0, 60) + (data.statement.length > 60 ? '…' : '')
    : ''

  return (
    <div className="min-h-screen bg-surface-900 text-surface-100">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        {/* Back */}
        <Link
          href={`/exchange/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Market
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold text-gold uppercase tracking-widest">Fair Value Model</span>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-3/4" />
          ) : (
            <h1 className="text-lg font-bold text-surface-100 leading-snug">{stmtSlice}</h1>
          )}
        </div>

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={<Info className="h-8 w-8 text-surface-500" />}
            title="Model unavailable"
            description={error}
            action={
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-sm text-for-400 hover:text-for-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <div className="space-y-4">

            {/* ── Verdict card ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                'rounded-xl border p-5',
                verdictBg(data.verdict),
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={cn('flex items-center gap-2 mb-1', verdictColor(data.verdict))}>
                    {verdictIcon(data.verdict)}
                    <span className="text-xl font-bold">
                      {verdictLabel(data.verdict, data.verdict_strength)}
                    </span>
                  </div>
                  <p className="text-sm text-surface-400">
                    Current price <span className={cn('font-semibold', priceColor(data.current_price))}>{data.current_price}¢</span>
                    {' vs '}
                    fair value <span className="font-semibold text-emerald">{data.fair_value}¢</span>
                    {' '}
                    <span className={cn('font-semibold', data.current_price > data.fair_value ? 'text-against-400' : 'text-for-400')}>
                      ({data.current_price > data.fair_value ? '+' : ''}{data.current_price - data.fair_value}¢)
                    </span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={cn('text-xs font-semibold uppercase tracking-wide mb-1', confidenceColor(data.confidence))}>
                    Model Confidence
                  </div>
                  <div className={cn('text-2xl font-bold', confidenceColor(data.confidence))}>
                    {data.confidence}%
                  </div>
                </div>
              </div>

              {/* Gauge */}
              <PriceGauge current={data.current_price} fairValue={data.fair_value} />

              <div className="flex items-center justify-between mt-6 pt-3 border-t border-surface-700/50">
                <span className="text-xs text-surface-500">
                  Volume: <span className={cn('font-semibold',
                    data.volume_signal === 'high' ? 'text-for-400' :
                    data.volume_signal === 'medium' ? 'text-gold' : 'text-surface-400'
                  )}>{data.volume_signal.toUpperCase()}</span>
                </span>
                {data.category && (
                  <Badge className="text-[10px] bg-surface-700/60 border-surface-600 text-surface-400 py-0 px-1.5">
                    {data.category}
                  </Badge>
                )}
                <Badge className={cn('text-[10px] py-0 px-1.5',
                  data.status === 'law' ? 'bg-gold/10 border-gold/30 text-gold' :
                  data.status === 'active' ? 'bg-for-500/10 border-for-500/30 text-for-400' :
                  'bg-surface-700/40 border-surface-600 text-surface-400'
                )}>
                  {data.status}
                </Badge>
              </div>
            </motion.div>

            {/* ── Factors ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="rounded-xl border border-surface-700 bg-surface-800/50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-surface-700 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-surface-400" />
                <span className="text-sm font-semibold text-surface-200">Model Factors</span>
                <span className="text-xs text-surface-500 ml-auto">{data.factors.length} signals</span>
              </div>

              <div className="divide-y divide-surface-700/50">
                {data.factors.map((factor, i) => (
                  <motion.div
                    key={factor.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: 0.08 + i * 0.04 }}
                    className="px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('flex-shrink-0', impactColor(factor.impact))}>
                          <FactorIcon name={factor.name} />
                        </span>
                        <span className="text-sm font-medium text-surface-200 truncate">{factor.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn('text-sm font-bold', impactColor(factor.impact))}>
                          {factor.value}¢
                        </span>
                        <Badge className="text-[10px] bg-surface-700/60 border-surface-600 text-surface-500 py-0 px-1.5">
                          {factor.weight}%
                        </Badge>
                      </div>
                    </div>

                    {/* Weight bar */}
                    <div className="h-1 w-full rounded-full bg-surface-700 overflow-hidden mb-2">
                      <motion.div
                        className={cn('h-full rounded-full', impactBarColor(factor.impact))}
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.value}%` }}
                        transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
                      />
                    </div>

                    <p className="text-xs text-surface-500 leading-relaxed">{factor.description}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ── Forecaster sentiment ─────────────────────────── */}
            {data.forecaster.count > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="rounded-xl border border-surface-700 bg-surface-800/50 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-surface-400" />
                  <span className="text-sm font-semibold text-surface-200">Forecaster Sentiment</span>
                  <span className="text-xs text-surface-500 ml-auto">{data.forecaster.count} forecasters</span>
                </div>

                {/* Bull/Bear/Neutral bar */}
                <div className="flex h-2 rounded-full overflow-hidden mb-3 gap-px">
                  {data.forecaster.bullish_pct > 0 && (
                    <div className="bg-for-500 rounded-l-full" style={{ width: `${data.forecaster.bullish_pct}%` }} />
                  )}
                  {data.forecaster.neutral_pct > 0 && (
                    <div className="bg-surface-500" style={{ width: `${data.forecaster.neutral_pct}%` }} />
                  )}
                  {data.forecaster.bearish_pct > 0 && (
                    <div className="bg-against-500 rounded-r-full" style={{ width: `${data.forecaster.bearish_pct}%` }} />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-for-400 font-semibold">{Math.round(data.forecaster.bullish_pct)}% Bullish</span>
                  <span className="text-surface-500">{Math.round(data.forecaster.neutral_pct)}% Neutral</span>
                  <span className="text-against-400 font-semibold">{Math.round(data.forecaster.bearish_pct)}% Bearish</span>
                </div>

                {data.forecaster.avg_target !== null && (
                  <div className="mt-3 pt-3 border-t border-surface-700/50 flex items-center justify-between text-xs">
                    <span className="text-surface-400">Avg target price</span>
                    <span className={cn('font-bold', priceColor(data.forecaster.avg_target))}>
                      {data.forecaster.avg_target}¢
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Benchmarks ───────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="rounded-xl border border-surface-700 bg-surface-800/50 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-surface-400" />
                <span className="text-sm font-semibold text-surface-200">Benchmarks</span>
              </div>

              <div className="space-y-3">
                {data.benchmarks.category_avg !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-400">Category average</span>
                    <span className={cn('text-sm font-semibold', priceColor(data.benchmarks.category_avg))}>
                      {data.benchmarks.category_avg}¢
                    </span>
                  </div>
                )}
                {data.benchmarks.similar_avg !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-400">Similar status avg</span>
                    <span className={cn('text-sm font-semibold', priceColor(data.benchmarks.similar_avg))}>
                      {data.benchmarks.similar_avg}¢
                    </span>
                  </div>
                )}
                {data.benchmarks.category_law_rate !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-400">Category law passage rate</span>
                    <span className={cn('text-sm font-semibold',
                      data.benchmarks.category_law_rate >= 30 ? 'text-for-400' :
                      data.benchmarks.category_law_rate >= 15 ? 'text-gold' : 'text-surface-400'
                    )}>
                      {data.benchmarks.category_law_rate}%
                    </span>
                  </div>
                )}
                {data.benchmarks.category_avg === null && data.benchmarks.similar_avg === null && data.benchmarks.category_law_rate === null && (
                  <p className="text-xs text-surface-500 text-center py-2">No benchmark data available</p>
                )}
              </div>
            </motion.div>

            {/* ── Argument quality ─────────────────────────────── */}
            {data.argument_quality.quality_signal !== 'no_data' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="rounded-xl border border-surface-700 bg-surface-800/50 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-surface-400" />
                  <span className="text-sm font-semibold text-surface-200">Argument Quality</span>
                  <Badge className={cn('text-[10px] py-0 px-1.5 ml-auto',
                    data.argument_quality.quality_signal === 'for_leads' ? 'bg-for-500/10 border-for-500/30 text-for-400' :
                    data.argument_quality.quality_signal === 'against_leads' ? 'bg-against-500/10 border-against-500/30 text-against-400' :
                    'bg-surface-700/40 border-surface-600 text-surface-400'
                  )}>
                    {data.argument_quality.quality_signal === 'for_leads' ? 'FOR Leads' :
                     data.argument_quality.quality_signal === 'against_leads' ? 'AGAINST Leads' : 'Balanced'}
                  </Badge>
                </div>

                <div className="flex items-center gap-4">
                  {data.argument_quality.for_avg !== null && (
                    <div className="flex-1 text-center">
                      <div className="text-xs text-surface-500 mb-1">FOR avg score</div>
                      <div className="text-lg font-bold text-for-400">{data.argument_quality.for_avg}</div>
                    </div>
                  )}
                  {data.argument_quality.for_avg !== null && data.argument_quality.against_avg !== null && (
                    <div className="text-surface-600 text-lg">vs</div>
                  )}
                  {data.argument_quality.against_avg !== null && (
                    <div className="flex-1 text-center">
                      <div className="text-xs text-surface-500 mb-1">AGAINST avg score</div>
                      <div className="text-lg font-bold text-against-400">{data.argument_quality.against_avg}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Methodology note ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="rounded-xl border border-surface-700/50 bg-surface-800/20 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Methodology</span>
              </div>
              <p className="text-xs text-surface-500 leading-relaxed">
                Fair value is a weighted composite of: Market Consensus (40%), Forecaster Targets (30%),
                Category Benchmark (15%), Argument Quality (10%), and Category Law Rate (5%).
                Weights redistribute to market consensus when data is unavailable. Model confidence
                reflects data completeness — more forecasters, votes, and AI-scored arguments
                yield higher confidence.
              </p>
            </motion.div>

            {/* ── Related links ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="rounded-xl border border-surface-700 bg-surface-800/50 overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-surface-700">
                <span className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Explore More</span>
              </div>
              {[
                { href: `/exchange/${id}/forecast`, icon: <Target className="h-4 w-4" />, label: 'Price Forecasts' },
                { href: `/exchange/${id}/signal`, icon: <Zap className="h-4 w-4" />, label: 'Market Signal' },
                { href: `/exchange/${id}/analysis`, icon: <BarChart2 className="h-4 w-4" />, label: 'Analysis' },
              ].map(({ href, icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-700/30 transition-colors border-b border-surface-700/30 last:border-0"
                >
                  <div className="flex items-center gap-2.5 text-surface-300">
                    <span className="text-surface-500">{icon}</span>
                    <span className="text-sm">{label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600" />
                </Link>
              ))}
            </motion.div>

          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
