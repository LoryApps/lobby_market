'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  OpportunityResponse,
  OpportunitySection,
  OpportunityMarket,
  OpportunityType,
} from '@/app/api/exchange/opportunity/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function priceBarColor(price: number): string {
  if (price >= 67) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 33) return 'bg-against-600'
  if (price <= 45) return 'bg-against-500'
  return 'bg-surface-500'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Section icon + color config ─────────────────────────────────────────────

const SECTION_CONFIG: Record<
  OpportunityType,
  {
    icon: React.ComponentType<{ className?: string }>
    iconColor: string
    iconBg: string
    border: string
    badgeBg: string
    badgeText: string
  }
> = {
  closing_soon: {
    icon: Clock,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/15',
    border: 'border-against-500/30',
    badgeBg: 'bg-against-500/20',
    badgeText: 'text-against-300',
  },
  impact_zone: {
    icon: Target,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/15',
    border: 'border-for-500/30',
    badgeBg: 'bg-for-500/20',
    badgeText: 'text-for-300',
  },
  tipping_point: {
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/15',
    border: 'border-gold/30',
    badgeBg: 'bg-gold/20',
    badgeText: 'text-gold',
  },
  debate_needed: {
    icon: MessageSquare,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/15',
    border: 'border-purple/30',
    badgeBg: 'bg-purple/20',
    badgeText: 'text-purple',
  },
  momentum_play: {
    icon: Zap,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/15',
    border: 'border-emerald/30',
    badgeBg: 'bg-emerald/20',
    badgeText: 'text-emerald',
  },
}

const URGENCY_DOT: Record<string, string> = {
  high: 'bg-against-500',
  medium: 'bg-gold',
  low: 'bg-surface-500',
}

// ─── Market card ──────────────────────────────────────────────────────────────

function OpportunityCard({
  market,
  sectionType,
  index,
}: {
  market: OpportunityMarket
  sectionType: OpportunityType
  index: number
}) {
  const cfg = SECTION_CONFIG[sectionType]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'block p-4 rounded-xl bg-surface-100 border transition-all',
          'hover:border-surface-400/70 hover:bg-surface-100/80',
          cfg.border,
        )}
      >
        {/* Top row: statement + urgency */}
        <div className="flex items-start gap-2 mb-3">
          <span
            className={cn('mt-1 h-2 w-2 rounded-full flex-shrink-0', URGENCY_DOT[market.urgency])}
            title={`${market.urgency} urgency`}
            aria-label={`${market.urgency} urgency`}
          />
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 flex-1">
            {market.statement}
          </p>
        </div>

        {/* Price bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-xs font-mono font-bold', priceColor(market.price))}>
              {market.price}¢
            </span>
            {market.price_delta_24h !== null && market.price_delta_24h !== undefined && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-[11px] font-mono',
                  market.price_delta_24h > 0 ? 'text-emerald' : market.price_delta_24h < 0 ? 'text-against-400' : 'text-surface-500',
                )}
              >
                {market.price_delta_24h > 0 ? (
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                ) : market.price_delta_24h < 0 ? (
                  <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                ) : null}
                {market.price_delta_24h > 0 ? '+' : ''}{market.price_delta_24h}¢
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', priceBarColor(market.price))}
              style={{ width: `${market.price}%` }}
              role="progressbar"
              aria-valuenow={market.price}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${market.price}% FOR consensus`}
            />
          </div>
        </div>

        {/* Bottom row: reason + meta */}
        <div className="flex items-end justify-between gap-2">
          <p className="text-[11px] text-surface-500 leading-tight flex-1">{market.reason}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {market.category && (
              <span className="text-[10px] font-mono text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded">
                {market.category.slice(0, 4).toUpperCase()}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[11px] text-surface-600">
              <Users className="h-3 w-3" aria-hidden="true" />
              {formatVolume(market.volume)}
            </span>
            {market.argument_count > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-surface-600">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                {market.argument_count}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function OpportunitySection({ section }: { section: OpportunitySection }) {
  const cfg = SECTION_CONFIG[section.type]
  const Icon = cfg.icon

  return (
    <section aria-labelledby={`section-${section.type}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('p-2 rounded-lg flex-shrink-0', cfg.iconBg)}>
          <Icon className={cn('h-4 w-4', cfg.iconColor)} aria-hidden="true" />
        </div>
        <div>
          <h2
            id={`section-${section.type}`}
            className="text-sm font-bold text-white"
          >
            {section.label}
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">{section.tagline}</p>
        </div>
      </div>

      <div className="grid gap-2.5">
        {section.markets.map((market, i) => (
          <OpportunityCard
            key={market.id}
            market={market}
            sectionType={section.type}
            index={i}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function OpportunitySkeleton() {
  return (
    <div className="space-y-8">
      {[3, 4, 2].map((count, si) => (
        <div key={si}>
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="grid gap-2.5">
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function OpportunityClient() {
  const [data, setData] = useState<OpportunityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/opportunity', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as OpportunityResponse
        setData(json)
        setLastRefresh(new Date())
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalOpps = data?.total_opportunities ?? 0

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-16">
        {/* Page header */}
        <div className="py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/exchange"
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors"
              aria-label="Back to Exchange"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" aria-hidden="true" />
              <h1 className="text-xl font-bold text-white">Market Opportunity</h1>
            </div>
          </div>
          <p className="text-sm text-surface-500 ml-10">
            Where your vote and your voice will have the greatest civic impact right now.
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-4 ml-10">
            {!loading && data && (
              <>
                <div className="flex items-center gap-1.5 text-xs text-surface-500">
                  <Target className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                  <span>
                    <span className="font-bold text-white">{totalOpps}</span> opportunities
                  </span>
                </div>
                {data.user_top_categories.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-500">
                    <Flame className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    <span>Personalised for your expertise</span>
                  </div>
                )}
                {lastRefresh && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-600 ml-auto">
                    <span>Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <button
                      onClick={load}
                      disabled={loading}
                      className="p-0.5 rounded text-surface-600 hover:text-white transition-colors disabled:opacity-40"
                      aria-label="Refresh opportunities"
                    >
                      <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-surface-300/50 mb-6" />

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && !data ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OpportunitySkeleton />
            </motion.div>
          ) : data && data.sections.length > 0 ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {data.sections.map((section) => (
                <OpportunitySection key={section.type} section={section} />
              ))}

              {/* Footer CTA */}
              <div className="pt-4 pb-2 border-t border-surface-300/50 flex items-center justify-between text-xs text-surface-600">
                <span>Refreshes in real time</span>
                <div className="flex items-center gap-3">
                  <Link href="/exchange/signals" className="hover:text-white transition-colors">
                    Signals
                  </Link>
                  <Link href="/exchange/screener" className="hover:text-white transition-colors">
                    Screener
                  </Link>
                  <Link href="/exchange" className="hover:text-white transition-colors">
                    All Markets
                  </Link>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <EmptyState
                icon={Target}
                title="No opportunities right now"
                description="All markets are either settled or have strong consensus. Check back soon as new debates open."
                action={
                  <Button variant="secondary" onClick={load} className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
