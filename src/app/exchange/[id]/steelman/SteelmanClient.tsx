'use client'

/**
 * /exchange/[id]/steelman — Market Steelman View
 *
 * Surfaces the strongest real community arguments for each side of a
 * prediction market, curated by upvotes, AI quality grade, author role,
 * and source citations. Distinct from:
 *
 *   /exchange/[id]/arguments  — browse all arguments with filters/sort
 *   /exchange/[id]/persuasion — which arguments historically moved the price
 *   /exchange/[id]/anatomy    — structural stats (word counts, grade distribution)
 *   /exchange/[id]/depth      — voter conviction tiers
 *
 * This page answers: "What is the single best case for each side?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Brain,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  SteelmanResponse,
  SteelmanArgument,
  SteelmanSide,
} from '@/app/api/exchange/[id]/steelman/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: 'A',  color: 'text-emerald',     bg: 'bg-emerald/10 border-emerald/30' },
  B: { label: 'B',  color: 'text-for-400',     bg: 'bg-for-500/10 border-for-500/30' },
  C: { label: 'C',  color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' },
  D: { label: 'D',  color: 'text-against-300', bg: 'bg-against-500/10 border-against-500/30' },
  F: { label: 'F',  color: 'text-against-400', bg: 'bg-surface-200 border-surface-400' },
}

const ROLE_LABEL: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  elder:         { label: 'Elder',         color: 'text-gold',    icon: Crown },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald', icon: Gavel },
  debator:       { label: 'Debator',       color: 'text-for-400', icon: Zap },
  person:        { label: 'Citizen',       color: 'text-surface-500', icon: MessageSquare },
}

const TAG_CONFIG: Record<SteelmanArgument['tag'], { label: string; icon: typeof Trophy; color: string }> = {
  champion: { label: 'Top Voted',    icon: Trophy,     color: 'text-gold' },
  quality:  { label: 'Best Rated',   icon: Brain,      color: 'text-purple' },
  expert:   { label: 'Expert Voice', icon: Crown,      color: 'text-emerald' },
  cited:    { label: 'Most Cited',   icon: BookMarked, color: 'text-for-400' },
  recent:   { label: 'Rising',       icon: Sparkles,   color: 'text-against-300' },
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  isFor,
  index,
}: {
  arg: SteelmanArgument
  isFor: boolean
  index: number
}) {
  const tagCfg  = TAG_CONFIG[arg.tag]
  const TagIcon = tagCfg.icon
  const gradeCfg = arg.ai_grade ? GRADE_CONFIG[arg.ai_grade] : null
  const roleInfo = ROLE_LABEL[arg.author.role] ?? ROLE_LABEL.person
  const RoleIcon = roleInfo.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-900/20 border-for-600/30 hover:border-for-500/50'
          : 'bg-against-900/20 border-against-600/30 hover:border-against-500/50',
        'transition-colors',
      )}
    >
      {/* Tag row */}
      <div className="flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-1.5 text-xs font-mono font-semibold', tagCfg.color)}>
          <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {tagCfg.label}
        </div>
        <div className="flex items-center gap-2">
          {gradeCfg && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
                gradeCfg.bg,
                gradeCfg.color,
              )}
            >
              {arg.ai_grade}
            </span>
          )}
          {arg.ai_score != null && (
            <span className="text-[10px] font-mono text-surface-500">
              {Math.round(arg.ai_score)}pts
            </span>
          )}
        </div>
      </div>

      {/* Argument body */}
      <p className="text-sm text-white leading-relaxed">{arg.content}</p>

      {/* Source citation */}
      {arg.source_url && (
        <a
          href={arg.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-for-400 hover:underline"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          {(() => {
            try {
              return new URL(arg.source_url).hostname.replace(/^www\./, '')
            } catch {
              return 'Source'
            }
          })()}
        </a>
      )}

      {/* Author + stats */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/profile/${arg.author.username}`}
          className="flex items-center gap-2 min-w-0 group"
        >
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name || arg.author.username}
            size="xs"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white group-hover:text-for-400 transition-colors truncate">
              {arg.author.display_name || `@${arg.author.username}`}
            </p>
            <div className="flex items-center gap-1">
              <RoleIcon className={cn('h-2.5 w-2.5', roleInfo.color)} aria-hidden="true" />
              <span className={cn('text-[10px] font-mono', roleInfo.color)}>{roleInfo.label}</span>
              {arg.author.clout > 0 && (
                <>
                  <span className="text-surface-600 text-[10px]">·</span>
                  <TrendingUp className="h-2.5 w-2.5 text-gold" aria-hidden="true" />
                  <span className="text-[10px] font-mono text-gold">{fmt(arg.author.clout)}</span>
                </>
              )}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-surface-500">
            {isFor
              ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
              : <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
            }
            <span className={cn('font-mono font-semibold', isFor ? 'text-for-400' : 'text-against-400')}>
              {arg.upvotes}
            </span>
          </div>
          <span className="text-[10px] text-surface-600">{relTime(arg.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function SidePanel({
  data,
  isFor,
  marketId,
  price,
}: {
  data: SteelmanSide
  isFor: boolean
  marketId: string
  price: number
}) {
  const args: Array<{ arg: SteelmanArgument; label: string }> = [
    data.champion  && { arg: data.champion,  label: 'champion' },
    data.quality   && { arg: data.quality,   label: 'quality' },
    data.expert    && { arg: data.expert,    label: 'expert' },
    data.cited     && { arg: data.cited,     label: 'cited' },
    data.recent    && { arg: data.recent,    label: 'recent' },
  ].filter(Boolean) as Array<{ arg: SteelmanArgument; label: string }>

  const hasData = args.length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Side header */}
      <div
        className={cn(
          'rounded-xl border p-4',
          isFor
            ? 'bg-for-900/30 border-for-600/40'
            : 'bg-against-900/30 border-against-600/40',
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isFor
              ? <ThumbsUp className="h-5 w-5 text-for-400" aria-hidden="true" />
              : <ThumbsDown className="h-5 w-5 text-against-400" aria-hidden="true" />
            }
            <span className={cn('text-base font-mono font-bold', isFor ? 'text-for-300' : 'text-against-300')}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
          </div>
          <div className={cn('text-xl font-mono font-bold tabular-nums', isFor ? 'text-for-400' : 'text-against-400')}>
            {isFor ? price : 100 - price}¢
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-surface-500">
          <span className="font-mono">{data.total} argument{data.total !== 1 ? 's' : ''}</span>
          {data.avg_score != null && (
            <span className="font-mono">Avg quality: {data.avg_score}pts</span>
          )}
          {data.top_upvotes > 0 && (
            <span className="font-mono">Best: {data.top_upvotes} upvotes</span>
          )}
        </div>
      </div>

      {/* Arguments */}
      {hasData ? (
        <div className="space-y-3">
          {args.map(({ arg }, i) => (
            <ArgCard
              key={arg.id}
              arg={arg}
              isFor={isFor}
              index={i}
            />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            'rounded-xl border border-dashed p-6 text-center',
            isFor ? 'border-for-600/30' : 'border-against-600/30',
          )}
        >
          <p className="text-sm text-surface-500">No arguments yet on this side.</p>
          <Link
            href={`/topic/${marketId}`}
            className={cn(
              'mt-3 inline-flex items-center gap-1 text-xs font-mono font-semibold',
              isFor ? 'text-for-400 hover:text-for-300' : 'text-against-400 hover:text-against-300',
              'transition-colors',
            )}
          >
            Be first to argue {isFor ? 'FOR' : 'AGAINST'}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SteelmanSkeleton() {
  return (
    <div className="space-y-6">
      {/* Market header */}
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-5 w-3/4 mb-3" />
        <div className="flex gap-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
      {/* Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SteelmanClientProps {
  marketId: string
  statement: string
}

export function SteelmanClient({ marketId, statement }: SteelmanClientProps) {
  const [data, setData] = useState<SteelmanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setError(null)
    else setLoading(true)
    try {
      const res = await fetch(`/api/exchange/${marketId}/steelman`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json() as SteelmanResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [marketId])

  useEffect(() => { load() }, [load])

  const market = data?.market
  const price  = market?.price ?? 50

  const STATUS_LABEL: Record<string, string> = {
    proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'LAW', failed: 'Failed',
  }
  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/exchange/${marketId}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Market
          </Link>
          <span className="text-surface-600 text-xs">/</span>
          <span className="text-xs font-mono text-surface-400">Steelman</span>
        </div>

        {loading && <SteelmanSkeleton />}

        {error && (
          <EmptyState
            icon={Scale}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="Couldn't load steelman"
            description={error}
            action={{ label: 'Retry', href: '' }}
          />
        )}

        {!loading && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Market header */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Scale className="h-4 w-4 text-for-400 flex-shrink-0" aria-hidden="true" />
                    <h1 className="text-sm font-mono font-bold text-white">Steelman View</h1>
                    {market?.category && (
                      <span className="text-xs font-mono text-surface-500">{market.category}</span>
                    )}
                    {market?.status && (
                      <Badge variant={STATUS_BADGE[market.status] ?? 'proposed'}>
                        {STATUS_LABEL[market.status] ?? market.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-base text-white font-medium leading-snug line-clamp-3">
                    {market?.statement ?? statement}
                  </p>
                </div>
                <button
                  onClick={() => load(true)}
                  aria-label="Refresh"
                  className="flex-shrink-0 p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Price bar */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-for-400 w-8 text-right tabular-nums">{price}¢</span>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-against-900/40">
                  <motion.div
                    className="h-full bg-for-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${price}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-xs font-mono text-against-400 w-8 tabular-nums">{100 - price}¢</span>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-surface-500 flex-wrap">
                <span className="font-mono">
                  <span className="text-for-400">{fmt(market?.blue_votes ?? 0)} FOR</span>
                  {' · '}
                  <span className="text-against-400">{fmt(market?.red_votes ?? 0)} AGAINST</span>
                  {' · '}
                  {fmt(market?.total_votes ?? 0)} total
                </span>
                <span className="font-mono">
                  {(data.for.total + data.against.total)} argument{(data.for.total + data.against.total) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.entries(TAG_CONFIG).map(([tag, cfg]) => {
                const Icon = cfg.icon
                return (
                  <div
                    key={tag}
                    className="flex items-center gap-1.5 rounded-lg bg-surface-200 border border-surface-300 px-2.5 py-1.5"
                  >
                    <Icon className={cn('h-3 w-3 flex-shrink-0', cfg.color)} aria-hidden="true" />
                    <span className="text-[10px] font-mono text-surface-400">{cfg.label}</span>
                  </div>
                )
              })}
            </div>

            {/* No data empty state */}
            {!data.has_data && (
              <EmptyState
                icon={MessageSquare}
                iconColor="text-surface-500"
                iconBg="bg-surface-200"
                iconBorder="border-surface-300"
                title="No arguments yet"
                description="Be the first to make the case for or against this market."
                action={{ label: 'Go to market', href: `/topic/${marketId}` }}
              />
            )}

            {/* Two-column steelman grid */}
            {data.has_data && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SidePanel
                  data={data.for}
                  isFor
                  marketId={marketId}
                  price={price}
                />
                <SidePanel
                  data={data.against}
                  isFor={false}
                  marketId={marketId}
                  price={price}
                />
              </div>
            )}

            {/* Footer nav */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-300">
              <Link
                href={`/exchange/${marketId}/arguments`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                All Arguments
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
              <div className="flex items-center gap-3">
                <Link
                  href={`/exchange/${marketId}/persuasion`}
                  className="text-xs font-mono text-surface-500 hover:text-purple transition-colors"
                >
                  Persuasion Lab
                </Link>
                <Link
                  href={`/exchange/${marketId}/anatomy`}
                  className="text-xs font-mono text-surface-500 hover:text-gold transition-colors"
                >
                  Anatomy
                </Link>
                <Link
                  href={`/exchange/${marketId}`}
                  className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  <Flame className="h-3 w-3" aria-hidden="true" />
                  Market
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
