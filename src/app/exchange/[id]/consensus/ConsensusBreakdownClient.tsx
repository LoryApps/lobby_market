'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Brain,
  ChevronRight,
  Crown,
  Flame,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
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
import type { ConsensusResponse } from '@/app/api/exchange/[id]/consensus/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

function priceColor(p: number): string {
  if (p >= 75) return 'text-gold'
  if (p >= 55) return 'text-for-400'
  if (p <= 25) return 'text-against-400'
  if (p <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function priceBg(p: number): string {
  if (p >= 75) return 'bg-gold/20 border-gold/40'
  if (p >= 55) return 'bg-for-500/20 border-for-500/40'
  if (p <= 25) return 'bg-against-600/20 border-against-600/40'
  if (p <= 45) return 'bg-against-500/20 border-against-500/40'
  return 'bg-surface-300/20 border-surface-400/20'
}

function deltaColor(d: number | null): string {
  if (d === null) return 'text-surface-500'
  if (d > 0) return 'text-emerald'
  if (d < 0) return 'text-against-400'
  return 'text-surface-500'
}

function deltaSign(d: number | null): string {
  if (d === null) return '—'
  return d >= 0 ? `+${d}¢` : `${d}¢`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-surface-500" />
      </div>
      <div>
        <h2 className="font-mono text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ forPct, height = 'h-2' }: { forPct: number; height?: string }) {
  return (
    <div className={cn('w-full rounded-full overflow-hidden bg-against-900/40', height)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-700"
        style={{ width: `${forPct}%` }}
      />
    </div>
  )
}

// ─── Voter tier row ───────────────────────────────────────────────────────────

function TierRow({ label, cloutRange, forPct, total, crowdForPct }: {
  label: string
  cloutRange: string
  forPct: number
  total: number
  crowdForPct: number
}) {
  const diff = forPct - crowdForPct
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-white">{label}</span>
          <span className="text-surface-500">{cloutRange} clout</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-xs', priceColor(forPct))}>
            {forPct}% FOR
          </span>
          {Math.abs(diff) >= 3 && (
            <span className={cn('text-[10px] font-mono', diff > 0 ? 'text-emerald' : 'text-against-400')}>
              {diff > 0 ? '+' : ''}{diff}¢ vs avg
            </span>
          )}
          <span className="text-surface-500 text-[10px]">{fmt(total)} voters</span>
        </div>
      </div>
      <VoteBar forPct={forPct} />
    </div>
  )
}

// ─── Turning point row ────────────────────────────────────────────────────────

function TurningPointRow({ point }: { point: ConsensusResponse['turning_points'][0] }) {
  const isUp = point.direction === 'surge'
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300/30 last:border-0">
      <div className={cn(
        'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center border',
        isUp ? 'bg-for-500/15 border-for-500/30' : 'bg-against-500/15 border-against-500/30',
      )}>
        {isUp
          ? <TrendingUp className="h-3.5 w-3.5 text-for-400" />
          : <TrendingDown className="h-3.5 w-3.5 text-against-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-sm font-bold', isUp ? 'text-for-400' : 'text-against-400')}>
            {isUp ? '+' : ''}{point.price_change}¢
          </span>
          <span className="text-xs text-surface-500">
            {point.price_before}¢ → {point.price_after}¢
          </span>
        </div>
        <p className="text-[10px] text-surface-600 mt-0.5">{relDate(point.date)}</p>
      </div>
    </div>
  )
}

// ─── Peer topic row ───────────────────────────────────────────────────────────

function PeerRow({ peer }: { peer: ConsensusResponse['category_peers_by_consensus'][0] }) {
  return (
    <Link
      href={`/exchange/${peer.id}`}
      className="flex items-center gap-3 py-2.5 border-b border-surface-300/30 last:border-0 hover:bg-surface-200/30 -mx-4 px-4 transition-colors"
    >
      <div className={cn('flex-shrink-0 text-sm font-mono font-bold w-12 text-right', priceColor(peer.price))}>
        {peer.price}¢
      </div>
      <VoteBar forPct={peer.price} height="h-1.5" />
      <p className="flex-1 text-xs text-surface-400 truncate min-w-0">{peer.statement}</p>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
    </Link>
  )
}

// ─── Page component ──────────────────────────────────────────────────────────

export function ConsensusBreakdownClient() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ConsensusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/consensus`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as ConsensusResponse
      setData(json)
    } catch {
      setError('Could not load consensus data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const topic = data?.topic
  const strength = data?.strength
  const composition = data?.composition

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/exchange/${id}`} className="text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Consensus Breakdown</h1>
            {topic && (
              <p className="text-xs text-surface-500 mt-0.5 truncate">{topic.statement}</p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && !data && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {error && !loading && (
          <EmptyState
            icon={Scale}
            title="Couldn't load consensus"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {data && topic && strength && composition && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Consensus Strength Card */}
            <div className={cn('rounded-xl border p-5', priceBg(topic.price))}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('font-mono text-3xl font-bold', priceColor(topic.price))}>
                      {topic.price}¢
                    </span>
                    <Badge variant={topic.price >= 67 ? 'for' : topic.price <= 33 ? 'against' : 'neutral'} size="sm">
                      {strength.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-400">{strength.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-surface-500 mb-1">Total votes</div>
                  <div className="font-mono text-lg font-bold text-white">{fmt(topic.total_votes)}</div>
                </div>
              </div>

              {/* FOR / AGAINST bar */}
              <div className="space-y-2">
                <VoteBar forPct={topic.price} height="h-3" />
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-for-400">FOR {topic.blue_votes.toLocaleString()}</span>
                  <span className="text-against-400">AGAINST {topic.red_votes.toLocaleString()}</span>
                </div>
              </div>

              {/* Momentum */}
              <div className="flex gap-3 mt-4 pt-4 border-t border-surface-300/20">
                <div className="flex-1 text-center">
                  <div className="text-xs text-surface-500 mb-1">7-day shift</div>
                  <div className={cn('font-mono text-sm font-bold', deltaColor(data.momentum_7d))}>
                    {deltaSign(data.momentum_7d)}
                  </div>
                </div>
                <div className="h-full w-px bg-surface-300/30" />
                <div className="flex-1 text-center">
                  <div className="text-xs text-surface-500 mb-1">30-day shift</div>
                  <div className={cn('font-mono text-sm font-bold', deltaColor(data.momentum_30d))}>
                    {deltaSign(data.momentum_30d)}
                  </div>
                </div>
                <div className="h-full w-px bg-surface-300/30" />
                <div className="flex-1 text-center">
                  <div className="text-xs text-surface-500 mb-1">Direction</div>
                  <div className={cn('font-mono text-sm font-bold capitalize',
                    data.momentum_direction === 'growing' ? 'text-emerald'
                    : data.momentum_direction === 'contracting' ? 'text-against-400'
                    : 'text-surface-400'
                  )}>
                    {data.momentum_direction === 'growing' ? '↑ Growing'
                      : data.momentum_direction === 'contracting' ? '↓ Falling'
                      : '→ Stable'}
                  </div>
                </div>
              </div>
            </div>

            {/* Expert vs Crowd */}
            {(composition.expert_for_pct !== null || composition.elder_for_pct !== null) && (
              <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-5">
                <SectionHeader icon={Brain} title="Expert vs Crowd" subtitle="How high-reputation voters lean vs the general population" />
                <div className="space-y-4">
                  {/* Crowd */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-400 font-mono">All voters</span>
                      <span className={cn('font-mono font-semibold', priceColor(composition.crowd_for_pct))}>
                        {composition.crowd_for_pct}% FOR
                      </span>
                    </div>
                    <VoteBar forPct={composition.crowd_for_pct} />
                  </div>

                  {composition.expert_for_pct !== null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3 w-3 text-for-400" />
                          <span className="text-surface-400 font-mono">High-rep voters (500+ clout)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('font-mono font-semibold', priceColor(composition.expert_for_pct))}>
                            {composition.expert_for_pct}% FOR
                          </span>
                          {composition.expert_premium !== null && Math.abs(composition.expert_premium) >= 3 && (
                            <span className={cn(
                              'text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-200',
                              composition.expert_premium > 0 ? 'text-emerald' : 'text-against-400'
                            )}>
                              {composition.expert_premium > 0 ? '+' : ''}{composition.expert_premium}¢ premium
                            </span>
                          )}
                        </div>
                      </div>
                      <VoteBar forPct={composition.expert_for_pct} />
                    </div>
                  )}

                  {composition.elder_for_pct !== null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Crown className="h-3 w-3 text-gold" />
                          <span className="text-surface-400 font-mono">Elders</span>
                        </div>
                        <span className={cn('font-mono font-semibold', priceColor(composition.elder_for_pct))}>
                          {composition.elder_for_pct}% FOR
                        </span>
                      </div>
                      <VoteBar forPct={composition.elder_for_pct} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Voter Tiers */}
            {data.voter_tiers.length > 0 && (
              <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-5">
                <SectionHeader icon={Users} title="Voter Tiers" subtitle="Consensus breakdown by civic reputation level" />
                <div className="space-y-4">
                  {data.voter_tiers.map(tier => (
                    <TierRow
                      key={tier.label}
                      label={tier.label}
                      cloutRange={tier.clout_range}
                      forPct={tier.for_pct}
                      total={tier.total}
                      crowdForPct={topic.price}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Role Breakdown */}
            {data.role_breakdown.length > 1 && (
              <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-5">
                <SectionHeader icon={Shield} title="By Role" subtitle="How each civic role votes on this market" />
                <div className="space-y-3">
                  {data.role_breakdown.map(r => (
                    <div key={r.role} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-surface-400 font-mono">{r.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('font-mono font-semibold', priceColor(r.for_pct))}>
                            {r.for_pct}% FOR
                          </span>
                          <span className="text-surface-600 text-[10px]">{fmt(r.total)}</span>
                        </div>
                      </div>
                      <VoteBar forPct={r.for_pct} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Argument Edge */}
            <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-5">
              <SectionHeader icon={Swords} title="Argument Quality" subtitle="Which side has the stronger case in the debate arena" />
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  'rounded-lg border p-4 text-center',
                  data.argument_edge === 'for'
                    ? 'bg-for-500/10 border-for-500/30'
                    : 'bg-surface-200/40 border-surface-300/40'
                )}>
                  <ThumbsUp className={cn('h-5 w-5 mx-auto mb-2', data.argument_edge === 'for' ? 'text-for-400' : 'text-surface-500')} />
                  <div className="font-mono text-xl font-bold text-for-400">{data.for_argument_count}</div>
                  <div className="text-xs text-surface-500 mt-0.5">FOR arguments</div>
                  {data.top_for_upvotes > 0 && (
                    <div className="text-[10px] text-surface-600 mt-1">
                      Top: {data.top_for_upvotes} upvotes
                    </div>
                  )}
                  {data.argument_edge === 'for' && (
                    <div className="mt-2 text-[10px] font-mono text-for-400 font-semibold">STRONGER CASE</div>
                  )}
                </div>
                <div className={cn(
                  'rounded-lg border p-4 text-center',
                  data.argument_edge === 'against'
                    ? 'bg-against-500/10 border-against-500/30'
                    : 'bg-surface-200/40 border-surface-300/40'
                )}>
                  <ThumbsDown className={cn('h-5 w-5 mx-auto mb-2', data.argument_edge === 'against' ? 'text-against-400' : 'text-surface-500')} />
                  <div className="font-mono text-xl font-bold text-against-400">{data.against_argument_count}</div>
                  <div className="text-xs text-surface-500 mt-0.5">AGAINST arguments</div>
                  {data.top_against_upvotes > 0 && (
                    <div className="text-[10px] text-surface-600 mt-1">
                      Top: {data.top_against_upvotes} upvotes
                    </div>
                  )}
                  {data.argument_edge === 'against' && (
                    <div className="mt-2 text-[10px] font-mono text-against-400 font-semibold">STRONGER CASE</div>
                  )}
                </div>
              </div>
              {data.argument_edge === 'even' && (
                <p className="text-center text-xs text-surface-500 mt-3">
                  Both sides have comparable argument quality — the debate is genuinely balanced.
                </p>
              )}
              <Link
                href={`/topic/${id}/arguments`}
                className="flex items-center justify-center gap-1.5 mt-4 text-xs text-for-400 hover:text-for-300 transition-colors"
              >
                View all arguments <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Turning Points */}
            {data.turning_points.length > 0 && (
              <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-5">
                <SectionHeader icon={Activity} title="Key Turning Points" subtitle="The largest consensus shifts in this market's history" />
                <div className="space-y-0">
                  {data.turning_points.map((tp, i) => (
                    <TurningPointRow key={i} point={tp} />
                  ))}
                </div>
              </div>
            )}

            {/* Category Context */}
            {data.category_market_count !== null && data.category_avg_price !== null && (
              <div className="rounded-xl border border-surface-300/50 bg-surface-100/50 p-5">
                <SectionHeader
                  icon={BarChart2}
                  title={`${topic.category ?? 'Category'} Context`}
                  subtitle={`How this market compares to ${data.category_market_count} others in the same category`}
                />

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="text-center">
                    <div className={cn('font-mono text-xl font-bold', priceColor(topic.price))}>
                      {topic.price}¢
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">This market</div>
                  </div>
                  <div className="text-center">
                    <div className={cn('font-mono text-xl font-bold', priceColor(data.category_avg_price))}>
                      {data.category_avg_price}¢
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">Category avg</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-xl font-bold text-white">
                      {data.category_rank !== null ? `#${data.category_rank}` : '—'}
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      of {data.category_market_count}
                    </div>
                  </div>
                </div>

                {data.category_peers_by_consensus.length > 0 && (
                  <>
                    <h3 className="text-[11px] font-mono text-surface-600 uppercase tracking-wide mb-2">
                      Highest consensus in {topic.category}
                    </h3>
                    <div className="-mx-4 px-4">
                      {data.category_peers_by_consensus.map(peer => (
                        <PeerRow key={peer.id} peer={peer} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Navigation footer */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/exchange/${id}/analysis`}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <BarChart2 className="h-4 w-4 text-surface-500" />
                <div>
                  <div className="text-xs font-semibold text-white">Market Analysis</div>
                  <div className="text-[10px] text-surface-500">Price statistics</div>
                </div>
              </Link>
              <Link
                href={`/exchange/${id}/traders`}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <Users className="h-4 w-4 text-surface-500" />
                <div>
                  <div className="text-xs font-semibold text-white">Traders</div>
                  <div className="text-[10px] text-surface-500">Who&apos;s FOR / AGAINST</div>
                </div>
              </Link>
              <Link
                href={`/exchange/${id}/signal`}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <Zap className="h-4 w-4 text-surface-500" />
                <div>
                  <div className="text-xs font-semibold text-white">Market Signal</div>
                  <div className="text-[10px] text-surface-500">Buy / sell signals</div>
                </div>
              </Link>
              <Link
                href={`/exchange/${id}`}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <Flame className="h-4 w-4 text-surface-500" />
                <div>
                  <div className="text-xs font-semibold text-white">Market Overview</div>
                  <div className="text-[10px] text-surface-500">Back to market</div>
                </div>
              </Link>
            </div>

          </motion.div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
