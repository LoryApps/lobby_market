'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Flame,
  Gavel,
  GitMerge,
  Globe,
  Layers,
  RefreshCw,
  Scale,
  Tag,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SimilarMarket, SimilarMarketsData } from '@/app/api/exchange/[id]/similar/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-surface-500'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function priceBg(price: number, status: string): string {
  if (status === 'law') return 'bg-gold/10 border-gold/25'
  if (status === 'failed') return 'bg-surface-600/30 border-surface-500/20'
  if (price >= 67) return 'bg-gold/10 border-gold/25'
  if (price >= 55) return 'bg-for-600/15 border-for-500/25'
  if (price <= 33) return 'bg-against-600/15 border-against-500/25'
  if (price <= 45) return 'bg-against-700/10 border-against-500/20'
  return 'bg-surface-600/20 border-surface-500/20'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function statusLabel(status: string): { label: string; cls: string } {
  switch (status) {
    case 'law':    return { label: 'Law',    cls: 'bg-gold/10 text-gold border-gold/20' }
    case 'failed': return { label: 'Failed', cls: 'bg-surface-600/40 text-surface-400 border-surface-500/20' }
    case 'voting': return { label: 'Voting', cls: 'bg-for-500/10 text-for-400 border-for-500/20' }
    default:       return { label: 'Active', cls: 'bg-surface-500/10 text-surface-400 border-surface-500/20' }
  }
}

type IconComponent = React.ComponentType<{ className?: string }>

function matchReasonLabel(reason: SimilarMarket['match_reason']): { label: string; icon: IconComponent; cls: string } {
  switch (reason) {
    case 'category':  return { label: 'Same category',  icon: Tag,       cls: 'text-purple' }
    case 'consensus': return { label: 'Similar price',  icon: Scale,     cls: 'text-for-400' }
    case 'scope':     return { label: 'Same scope',     icon: Globe,     cls: 'text-emerald' }
    case 'contested': return { label: 'Contested',      icon: GitMerge,  cls: 'text-against-300' }
    default:          return { label: 'Related',        icon: Layers,    cls: 'text-surface-400' }
  }
}

// ─── Market Card ──────────────────────────────────────────────────────────────

function MarketCard({ market, showReason = false }: { market: SimilarMarket; showReason?: boolean }) {
  const st = statusLabel(market.status)
  const reason = matchReasonLabel(market.match_reason)
  const ReasonIcon = reason.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link href={`/exchange/${market.id}`} className="group block">
        <div className="p-4 rounded-xl border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all">
          {/* Top row: signals */}
          <div className="flex items-center gap-1.5 mb-2.5">
            {market.category && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-300/50 text-surface-400 uppercase tracking-wide">
                {market.category}
              </span>
            )}
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', st.cls)}>
              {st.label}
            </span>
            {market.is_hot && (
              <span className="flex items-center gap-0.5 text-[10px] text-against-400 font-medium">
                <Flame className="h-2.5 w-2.5" />
                Hot
              </span>
            )}
            {market.is_near_law && (
              <span className="flex items-center gap-0.5 text-[10px] text-gold font-medium">
                <Gavel className="h-2.5 w-2.5" />
                Near Law
              </span>
            )}
            {market.is_closing_soon && (
              <span className="flex items-center gap-0.5 text-[10px] text-against-300 font-medium">
                <Zap className="h-2.5 w-2.5" />
                Closing
              </span>
            )}
          </div>

          {/* Statement */}
          <p className="text-sm text-surface-100 line-clamp-2 leading-snug mb-3 group-hover:text-white transition-colors">
            {market.statement}
          </p>

          {/* Bottom row: price + volume + reason */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Price pill */}
              <div className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold',
                priceBg(market.price, market.status),
                priceColor(market.price, market.status),
              )}>
                {Math.round(market.price)}¢
              </div>
              {/* Volume */}
              <div className="flex items-center gap-1 text-[11px] text-surface-500">
                <BarChart2 className="h-3 w-3" />
                {formatVolume(market.volume)}
              </div>
              {/* Scope */}
              {market.scope && market.scope !== 'national' && (
                <div className="flex items-center gap-1 text-[11px] text-surface-500">
                  <Globe className="h-3 w-3" />
                  {market.scope}
                </div>
              )}
            </div>

            {showReason && (
              <div className={cn('flex items-center gap-1 text-[10px] font-medium', reason.cls)}>
                <ReasonIcon className="h-3 w-3 flex-shrink-0" />
                <span>{reason.label}</span>
              </div>
            )}

            <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  iconCls,
  markets,
  showReason = false,
}: {
  title: string
  subtitle?: string
  icon: IconComponent
  iconCls: string
  markets: SimilarMarket[]
  showReason?: boolean
}) {
  if (markets.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-1.5 rounded-lg bg-surface-200', iconCls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[11px] text-surface-500">{subtitle}</p>}
        </div>
        <Badge variant="secondary" className="ml-auto text-[10px] py-0 px-1.5">
          {markets.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} showReason={showReason} />
        ))}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SimilarSkeleton() {
  return (
    <div className="space-y-6">
      {[6, 4, 5].map((count, sIdx) => (
        <div key={sIdx}>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-surface-300/40 bg-surface-200/40 space-y-2.5">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-12 rounded-lg" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter tab IDs ───────────────────────────────────────────────────────────

const TABS: Array<{ id: string; label: string; icon: IconComponent }> = [
  { id: 'all',       label: 'All',           icon: Layers    },
  { id: 'category',  label: 'Same Category', icon: Tag       },
  { id: 'consensus', label: 'Similar Price', icon: Scale     },
  { id: 'scope',     label: 'Same Scope',    icon: Globe     },
  { id: 'contested', label: 'Contested',     icon: GitMerge  },
]
type TabId = 'all' | 'category' | 'consensus' | 'scope' | 'contested'

// ─── Main Component ───────────────────────────────────────────────────────────

export function SimilarMarketsClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<SimilarMarketsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${topicId}/similar`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load similar markets')
      const json: SimilarMarketsData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const totalInTab = data
    ? tab === 'all'
      ? data.total
      : tab === 'category'
      ? data.by_category.length
      : tab === 'consensus'
      ? data.by_consensus.length
      : tab === 'scope'
      ? data.by_scope.length
      : data.contested.length
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-6">
        {/* Back */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to market
          </Link>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (loading || refreshing) && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-surface-200">
              <TrendingUp className="h-4 w-4 text-for-400" />
            </div>
            <h1 className="text-lg font-bold text-white">Similar Markets</h1>
          </div>
          {data && (
            <p className="text-sm text-surface-500">
              {data.total} related markets found across {data.topic.category ? `${data.topic.category} and` : ''} the exchange
            </p>
          )}
        </div>

        {/* Anchor market summary */}
        {data && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40">
            <div className={cn(
              'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm border',
              priceBg(data.topic.price, data.topic.status),
              priceColor(data.topic.price, data.topic.status),
            )}>
              {Math.round(data.topic.price)}¢
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-surface-500 mb-0.5 uppercase tracking-wide font-medium">This market</p>
              <p className="text-sm text-white line-clamp-2 leading-snug">{data.topic.statement}</p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = data
              ? id === 'all' ? data.total
              : id === 'category' ? data.by_category.length
              : id === 'consensus' ? data.by_consensus.length
              : id === 'scope' ? data.by_scope.length
              : data.contested.length
              : 0
            return (
              <button
                key={id}
                onClick={() => setTab(id as TabId)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
                  tab === id
                    ? 'bg-surface-200 border border-surface-300 text-white'
                    : 'text-surface-500 hover:text-white hover:bg-surface-200/50',
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
                {data && (
                  <span className={cn(
                    'text-[10px] px-1 rounded',
                    tab === id ? 'bg-surface-300 text-surface-300' : 'text-surface-600',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <SimilarSkeleton />
        ) : error ? (
          <EmptyState
            icon={Scale}
            title="Couldn't load similar markets"
            description={error}
            action={{ label: 'Try again', onClick: () => load() }}
          />
        ) : !data || data.total === 0 ? (
          <EmptyState
            icon={Layers}
            title="No similar markets found"
            description="This market appears to be in a unique category or consensus band right now."
            action={{ label: 'Browse all markets', href: '/exchange' }}
          />
        ) : totalInTab === 0 ? (
          <EmptyState
            icon={Scale}
            title={`No ${tab === 'all' ? '' : TABS.find((t) => t.id === tab)?.label ?? ''} matches`}
            description="Try a different filter to explore related markets."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {(tab === 'all' || tab === 'category') && data.by_category.length > 0 && (
                <Section
                  title="Same Category"
                  subtitle={`Other ${data.topic.category ?? 'civic'} markets`}
                  icon={Tag}
                  iconCls="text-purple"
                  markets={data.by_category}
                  showReason={tab === 'all'}
                />
              )}

              {(tab === 'all' || tab === 'consensus') && data.by_consensus.length > 0 && (
                <Section
                  title="Similar Consensus"
                  subtitle={`Markets near ${Math.round(data.topic.price)}¢`}
                  icon={Scale}
                  iconCls="text-for-400"
                  markets={data.by_consensus}
                  showReason={tab === 'all'}
                />
              )}

              {(tab === 'all' || tab === 'scope') && data.by_scope.length > 0 && (
                <Section
                  title="Same Scope"
                  subtitle={`Other ${data.topic.scope} debates`}
                  icon={Globe}
                  iconCls="text-emerald"
                  markets={data.by_scope}
                  showReason={tab === 'all'}
                />
              )}

              {(tab === 'all' || tab === 'contested') && data.contested.length > 0 && (
                <Section
                  title="Contested Right Now"
                  subtitle="Deadlocked markets — 40–60% consensus"
                  icon={GitMerge}
                  iconCls="text-against-300"
                  markets={data.contested}
                  showReason={tab === 'all'}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer CTA */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-surface-300/40">
            <p className="text-xs text-surface-600">
              Showing {totalInTab} of {data.total} related markets
            </p>
            <Link
              href="/exchange"
              className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              Browse all markets
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
