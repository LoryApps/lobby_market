'use client'

/**
 * /exchange/[id]/persuasion — Market Persuasion Lab
 *
 * Analyses argument effectiveness in this prediction market:
 *   • Top Persuaders — highest composite persuasion score
 *   • Cross-Aisle Breakers — arguments that drew replies from opposite voters
 *   • Overlooked Gems — silently compelling (high upvotes, no replies)
 *   • Rhetorical Style breakdown — evidence / logical / narrative / emotional
 *
 * Exchange-specific framing: persuasion → price movement / consensus shift.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Flame,
  Heart,
  Lightbulb,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ExchangePersuasionResponse,
  PersuasionArgument,
} from '@/app/api/exchange/[id]/persuasion/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-surface-500'
  if (price >= 67) return 'text-gold'
  if (price >= 50) return 'text-for-300'
  if (price <= 33) return 'text-against-400'
  return 'text-surface-400'
}

// ─── Style config ─────────────────────────────────────────────────────────────

const STYLE_CONFIG = {
  evidence: {
    label: 'Evidence-Based',
    icon: BookOpen,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/25',
    pill: 'bg-emerald/15 text-emerald border-emerald/30',
    desc: 'Cites data, studies, or statistics',
  },
  logical: {
    label: 'Logical',
    icon: Brain,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/25',
    pill: 'bg-purple/15 text-purple border-purple/30',
    desc: 'Structured reasoning and inference',
  },
  narrative: {
    label: 'Narrative',
    icon: Heart,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/25',
    pill: 'bg-gold/15 text-gold border-gold/30',
    desc: 'Personal experience or story',
  },
  emotional: {
    label: 'Emotional',
    icon: Flame,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/25',
    pill: 'bg-against-500/15 text-against-400 border-against-500/30',
    desc: 'Values-driven, urgent appeal',
  },
} as const

type StyleKey = keyof typeof STYLE_CONFIG

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArgSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-12 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-3 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  rank,
  highlight,
}: {
  arg: PersuasionArgument
  rank?: number
  highlight?: 'cross-aisle' | 'gem'
}) {
  const [expanded, setExpanded] = useState(false)
  const style = STYLE_CONFIG[arg.rhetorical_style as StyleKey]
  const isFor = arg.side === 'for'
  const isLong = arg.content.length > 200

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {rank !== undefined && (
            <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-surface-200 text-[11px] font-mono font-bold text-surface-500">
              {rank}
            </span>
          )}
          {arg.author ? (
            <Avatar
              src={arg.author.avatar_url}
              username={arg.author.username}
              size="sm"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-surface-300" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold text-surface-300 truncate">
              {arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'}
            </p>
            <p className="text-[10px] font-mono text-surface-600">
              {reltime(arg.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Side badge */}
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border',
              isFor
                ? 'bg-for-500/15 text-for-300 border-for-500/30'
                : 'bg-against-500/15 text-against-300 border-against-500/30',
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div>
        <p
          className={cn(
            'text-sm font-mono text-surface-200 leading-relaxed',
            !expanded && isLong && 'line-clamp-3',
          )}
        >
          {arg.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Read more
              </>
            )}
          </button>
        )}
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {/* Rhetorical style */}
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
            style.pill,
          )}
        >
          <style.icon className="h-2.5 w-2.5" />
          {style.label}
        </span>

        {/* Citation badge */}
        {arg.has_citation && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald/10 text-emerald border border-emerald/25">
            <BookOpen className="h-2.5 w-2.5" />
            Cited
          </span>
        )}

        {/* Cross-aisle badge */}
        {arg.cross_aisle_replies > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-purple/10 text-purple border border-purple/25">
            <Users className="h-2.5 w-2.5" />
            {arg.cross_aisle_replies} cross-aisle
          </span>
        )}

        {/* Highlight badge */}
        {highlight === 'gem' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-gold/10 text-gold border border-gold/25">
            <Sparkles className="h-2.5 w-2.5" />
            Gem
          </span>
        )}

        {/* Stats */}
        <div className="ml-auto flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes}
          </span>
          {arg.reply_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <BarChart2 className="h-3 w-3" />
              {arg.reply_count}
            </span>
          )}
          <span className="text-[11px] font-mono font-bold text-surface-400">
            {arg.persuasion_score}pts
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className={cn(
          'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
          'bg-surface-200 border border-surface-300',
        )}
      >
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <h2 className="text-sm font-mono font-bold text-white">{title}</h2>
        <p className="text-xs font-mono text-surface-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PersuasionClient({ id }: { id: string }) {
  const [data, setData] = useState<ExchangePersuasionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/persuasion`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as ExchangePersuasionResponse
      setData(json)
    } catch {
      setError('Could not load persuasion data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const market = data?.market
  const stats = data?.stats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href={`/exchange/${id}`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors text-sm font-mono mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Market
        </Link>

        {/* Market header */}
        {loading ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
            <div className="grid grid-cols-4 gap-3 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          </div>
        ) : market ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
            {/* Category + status */}
            <div className="flex items-center gap-2 mb-3">
              {market.category && (
                <Badge variant="proposed" className="text-[10px]">
                  {market.category}
                </Badge>
              )}
              <Badge
                variant={
                  market.status === 'law' ? 'law' :
                  market.status === 'failed' ? 'failed' :
                  market.status === 'voting' ? 'active' : 'proposed'
                }
                className="text-[10px]"
              >
                {market.status.toUpperCase()}
              </Badge>
              <Link
                href={`/exchange/${id}`}
                className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                Full Market
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <p className="text-base font-mono font-semibold text-white leading-snug mb-4">
              {market.statement}
            </p>

            {/* Stats grid */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl bg-surface-200/60 p-3 text-center">
                  <p className={cn('text-xl font-mono font-bold', priceColor(market.price, market.status))}>
                    {market.price}¢
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">Current Price</p>
                </div>
                <div className="rounded-xl bg-surface-200/60 p-3 text-center">
                  <p className="text-xl font-mono font-bold text-white">
                    {stats.total_arguments}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">Arguments</p>
                </div>
                <div className="rounded-xl bg-surface-200/60 p-3 text-center">
                  <p className="text-xl font-mono font-bold text-purple">
                    {stats.cross_aisle_count}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">Cross-Aisle</p>
                </div>
                <div className="rounded-xl bg-surface-200/60 p-3 text-center">
                  <p className="text-xl font-mono font-bold text-emerald">
                    {stats.citation_rate}%
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">Citation Rate</p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/20 p-4 mb-6">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={load}
              className="mt-2 flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Style breakdown */}
        {!loading && data?.style_breakdown && (
          <div className="mb-6">
            <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider mb-3">
              Rhetorical Style Breakdown
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {data.style_breakdown.map((s) => {
                const cfg = STYLE_CONFIG[s.style as StyleKey]
                if (!cfg) return null
                const maxScore = Math.max(...data.style_breakdown.map((x) => x.avg_score), 1)
                const barPct = maxScore > 0 ? (s.avg_score / maxScore) * 100 : 0
                return (
                  <div
                    key={s.style}
                    className={cn(
                      'rounded-xl border p-4',
                      cfg.bg,
                      cfg.border,
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <cfg.icon className={cn('h-4 w-4 flex-shrink-0', cfg.color)} />
                      <span className={cn('text-xs font-mono font-semibold', cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-white mb-0.5">
                      {s.count}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 mb-2">
                      {cfg.desc}
                    </p>
                    {/* Avg score bar */}
                    <div className="h-1 rounded-full bg-surface-200/60 overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', cfg.color.replace('text-', 'bg-'))}
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-surface-600 mt-1">
                      avg {s.avg_score}pts · {s.for_pct}% FOR
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FOR vs AGAINST comparison */}
        {!loading && stats && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
            <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider mb-3">
              FOR vs AGAINST Comparison
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'FOR',
                  count: stats.for_arguments,
                  avgScore: stats.for_avg_score,
                  avgLength: stats.for_avg_length,
                  color: 'text-for-300',
                  bg: 'bg-for-500/10',
                  border: 'border-for-500/25',
                },
                {
                  label: 'AGAINST',
                  count: stats.against_arguments,
                  avgScore: stats.against_avg_score,
                  avgLength: stats.against_avg_length,
                  color: 'text-against-300',
                  bg: 'bg-against-500/10',
                  border: 'border-against-500/25',
                },
              ].map((side) => (
                <div
                  key={side.label}
                  className={cn('rounded-xl border p-3 space-y-2', side.bg, side.border)}
                >
                  <p className={cn('text-xs font-mono font-bold', side.color)}>
                    {side.label}
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-surface-500">Count</span>
                      <span className="text-white font-semibold">{side.count}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-surface-500">Avg Score</span>
                      <span className="text-white font-semibold">{side.avgScore}pts</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-surface-500">Avg Length</span>
                      <span className="text-white font-semibold">{side.avgLength}w</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Persuaders */}
        <div className="mb-8">
          <SectionHeader
            icon={Trophy}
            iconColor="text-gold"
            title="Top Persuaders"
            subtitle="Highest composite persuasion scores — upvotes × reach × cross-aisle engagement"
          />

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => <ArgSkeleton key={i} />)}
            </div>
          ) : !data?.top_persuaders.length ? (
            <EmptyState
              icon={Zap}
              title="No arguments yet"
              description="Be the first to argue your case on this market."
              size="sm"
              action={{ label: 'Go to Market', href: `/exchange/${id}` }}
            />
          ) : (
            <div className="space-y-3">
              {data.top_persuaders.map((arg, i) => (
                <ArgumentCard key={arg.id} arg={arg} rank={i + 1} />
              ))}
            </div>
          )}
        </div>

        {/* Cross-Aisle Breakers */}
        {!loading && (data?.cross_aisle_breakers.length ?? 0) > 0 && (
          <div className="mb-8">
            <SectionHeader
              icon={Users}
              iconColor="text-purple"
              title="Cross-Aisle Breakers"
              subtitle="Arguments that drew engagement from voters on the opposite side"
            />
            <div className="space-y-3">
              {data!.cross_aisle_breakers.map((arg) => (
                <ArgumentCard key={arg.id} arg={arg} highlight="cross-aisle" />
              ))}
            </div>
          </div>
        )}

        {/* Overlooked Gems */}
        {!loading && (data?.overlooked_gems.length ?? 0) > 0 && (
          <div className="mb-8">
            <SectionHeader
              icon={Sparkles}
              iconColor="text-gold"
              title="Overlooked Gems"
              subtitle="Silently persuasive — high upvotes with no debate noise"
            />
            <div className="space-y-3">
              {data!.overlooked_gems.map((arg) => (
                <ArgumentCard key={arg.id} arg={arg} highlight="gem" />
              ))}
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="pt-4 border-t border-surface-300 flex flex-wrap gap-2">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
          >
            <Scale className="h-3.5 w-3.5" />
            Market Overview
          </Link>
          <Link
            href={`/exchange/${id}/arguments`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            All Arguments
          </Link>
          <Link
            href={`/exchange/${id}/analysis`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Analysis
          </Link>
          <button
            onClick={load}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
