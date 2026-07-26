'use client'

/**
 * /exchange/[id]/impact — Civic Impact Analysis
 *
 * Shows the broader civic footprint of a prediction market: how many related
 * topics reference or are referenced by this one, which categories would be
 * affected if it resolves as LAW, and what precedent established laws in the
 * same category provide.
 *
 * Distinct from:
 *   /exchange/[id]/ripple     — price correlation between markets
 *   /exchange/[id]/similar    — markets with similar consensus price / scope
 *   /exchange/[id]/research   — full intelligence research pack
 *   /exchange/[id]/scenarios  — price-level what-if projections
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ExternalLink,
  Gavel,
  GitMerge,
  Globe,
  Layers,
  MapPin,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ImpactData, ImpactTopic, PrecedentLaw } from '@/app/api/exchange/[id]/impact/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImpactClientProps {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  scope: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}


function statusBadgeVariant(status: string): 'proposed' | 'active' | 'law' | 'failed' | 'gold' | 'purple' {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (status === 'voting') return 'purple'
  if (status === 'active') return 'active'
  return 'proposed'
}

function impactColor(label: string): { text: string; bg: string; border: string } {
  if (label === 'Systemic') return { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' }
  if (label === 'Broad')    return { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' }
  if (label === 'Moderate') return { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' }
  return                           { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30' }
}

function categoryColor(cat: string): string {
  const MAP: Record<string, string> = {
    Economics:   'text-gold',
    Politics:    'text-for-400',
    Technology:  'text-purple',
    Science:     'text-emerald',
    Ethics:      'text-against-400',
    Philosophy:  'text-purple',
    Culture:     'text-gold',
    Health:      'text-against-300',
    Environment: 'text-emerald',
    Education:   'text-purple',
  }
  return MAP[cat] ?? 'text-surface-400'
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(diff / 2_592_000_000)
  const y = Math.floor(diff / 31_536_000_000)
  if (y >= 1) return `${y}y ago`
  if (m >= 1) return `${m}mo ago`
  if (d >= 1) return `${d}d ago`
  return 'today'
}

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ImpactGauge({ score, label }: { score: number; label: string }) {
  const color = impactColor(label)
  const pct = Math.min(100, score)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Impact Score</span>
        <span className={cn('text-xs font-mono font-semibold', color.text)}>{label}</span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            label === 'Systemic' ? 'bg-against-500' :
            label === 'Broad'    ? 'bg-gold' :
            label === 'Moderate' ? 'bg-for-500' :
            'bg-surface-500'
          )}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
        <span>Narrow</span>
        <span className={cn('font-semibold tabular-nums', color.text)}>{score}/100</span>
        <span>Systemic</span>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: ImpactTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const linkTypeLabel = topic.link_type === 'incoming'
    ? 'References this'
    : topic.link_type === 'outgoing'
    ? 'Referenced by this'
    : 'Same category'

  return (
    <Link
      href={`/exchange/${topic.id}`}
      className="block rounded-xl bg-surface-200/50 border border-surface-300 p-3.5 hover:border-for-500/40 hover:bg-for-500/5 transition-all group"
    >
      <p className="text-[13px] font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
        {topic.statement}
      </p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <Badge variant={statusBadgeVariant(topic.status)} size="sm">
          {topic.status === 'law' ? 'LAW' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
        </Badge>

        {topic.category && (
          <span className={cn('text-[10px] font-mono', categoryColor(topic.category))}>
            {topic.category}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-mono text-for-400 tabular-nums">{forPct}%</span>
          <span className="text-[10px] font-mono text-surface-600">/</span>
          <span className="text-[10px] font-mono text-against-400 tabular-nums">{100 - forPct}%</span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] font-mono text-surface-600">{linkTypeLabel}</span>
        {topic.scope && (
          <>
            <span className="text-[10px] text-surface-700">·</span>
            <span className="text-[10px] font-mono text-surface-600 flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {topic.scope}
            </span>
          </>
        )}
        {topic.total_votes > 0 && (
          <>
            <span className="text-[10px] text-surface-700">·</span>
            <span className="text-[10px] font-mono text-surface-600">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </>
        )}
      </div>
    </Link>
  )
}

// ─── Precedent law card ────────────────────────────────────────────────────────

function PrecedentCard({ law }: { law: PrecedentLaw }) {
  const pct = Math.round(law.blue_pct_at_law ?? 0)

  return (
    <Link
      href={`/topic/${law.id}`}
      className="block rounded-xl bg-gold/5 border border-gold/20 p-3.5 hover:border-gold/50 hover:bg-gold/10 transition-all group"
    >
      <div className="flex items-start gap-2">
        <Gavel className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
        <p className="text-[13px] font-medium text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
          {law.statement}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-mono flex-wrap">
        <span className="text-gold">{pct}% consensus</span>
        {law.established_at && (
          <>
            <span className="text-surface-700">·</span>
            <span className="text-surface-500">Established {relTime(law.established_at)}</span>
          </>
        )}
        {law.total_votes > 0 && (
          <>
            <span className="text-surface-700">·</span>
            <span className="text-surface-500">{law.total_votes.toLocaleString()} votes</span>
          </>
        )}
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImpactClient({
  id,
  statement,
  category,
  status,
  price,
  scope,
}: ImpactClientProps) {
  const [data, setData] = useState<ImpactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/impact`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load impact data')
      const json = await res.json() as ImpactData
      setData(json)
    } catch {
      setError('Could not load impact analysis.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const priceStr = `${Math.round(price)}¢`
  const color = impactColor(data?.stats.impact_label ?? 'Narrow')

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-24 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Market
          </Link>
          {category && (
            <>
              <span className="text-surface-600">/</span>
              <span className="text-xs text-surface-500">{category}</span>
            </>
          )}
          <span className="text-surface-600">/</span>
          <span className="text-xs text-white">Impact</span>
        </div>

        {/* Header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          {/* Status + labels */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusBadgeVariant(status)} size="sm">
              {status === 'law' ? 'LAW' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            {category && (
              <span className={cn('text-xs font-mono', categoryColor(category))}>{category}</span>
            )}
            {scope && (
              <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
                <MapPin className="h-3 w-3" />
                {scope}
              </span>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="ml-auto p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Statement */}
          <div>
            <h1 className="text-base font-semibold text-white leading-snug">{statement}</h1>
            <div className="mt-1.5 flex items-center gap-2 text-xs font-mono">
              <span className={cn('font-bold', priceColor(price, status))}>{priceStr} FOR</span>
              <span className="text-surface-600">·</span>
              <span className="text-surface-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Civic Impact Analysis
              </span>
            </div>
          </div>

          {/* Impact score gauge */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : data ? (
            <ImpactGauge score={data.stats.impact_score} label={data.stats.impact_label} />
          ) : null}
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-200 p-3 space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          </div>
        ) : data ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
              <BarChart2 className="h-3.5 w-3.5" />
              Impact Metrics
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-200 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Affected Topics</p>
                <p className={cn('text-xl font-mono font-bold', color.text)}>
                  {data.stats.affected_topics}
                </p>
              </div>
              <div className="rounded-xl bg-surface-200 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Categories</p>
                <p className={cn('text-xl font-mono font-bold', color.text)}>
                  {data.stats.affected_categories.length}
                </p>
              </div>
              <div className="rounded-xl bg-surface-200 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Precedent Laws</p>
                <p className="text-xl font-mono font-bold text-gold">
                  {data.stats.laws_as_precedent}
                </p>
              </div>
              <div className="rounded-xl bg-surface-200 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Total Reach</p>
                <p className="text-xl font-mono font-bold text-for-400">
                  {data.stats.total_affected_votes >= 1000
                    ? `${(data.stats.total_affected_votes / 1000).toFixed(1)}K`
                    : data.stats.total_affected_votes.toString()}
                </p>
              </div>
            </div>

            {/* Affected categories */}
            {data.stats.affected_categories.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Affected Areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.stats.affected_categories.map((cat) => (
                    <span
                      key={cat}
                      className={cn(
                        'text-[10px] font-mono px-2 py-0.5 rounded-md border',
                        'bg-surface-200 border-surface-300',
                        categoryColor(cat),
                      )}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Scope breakdown */}
            {Object.keys(data.stats.scope_breakdown).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Scope Distribution</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.stats.scope_breakdown).map(([scope, count]) => (
                    <span
                      key={scope}
                      className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-200 border border-surface-300 text-surface-400"
                    >
                      <Globe className="h-2.5 w-2.5" />
                      {scope} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : null}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-5">
            <EmptyState
              icon={Scale}
              title="Impact data unavailable"
              description={error}
              action={{ label: 'Retry', onClick: () => load() }}
            />
          </div>
        )}

        {/* Incoming links — topics whose wikis reference this one */}
        {!loading && data && data.incoming_links.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <GitMerge className="h-3.5 w-3.5 text-for-400" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                Referencing Topics
              </h2>
              <span className="ml-auto text-[10px] font-mono text-surface-500">
                {data.incoming_links.length} topics link here
              </span>
            </div>
            <p className="text-[11px] text-surface-500 -mt-1">
              These debates explicitly cite this market in their community wiki — a change here would affect their framing.
            </p>
            <div className="space-y-2">
              {data.incoming_links.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Outgoing links — topics this one's wiki links to */}
        {!loading && data && data.outgoing_links.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-purple" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                Referenced Debates
              </h2>
              <span className="ml-auto text-[10px] font-mono text-surface-500">
                {data.outgoing_links.length} cited
              </span>
            </div>
            <p className="text-[11px] text-surface-500 -mt-1">
              Debates this market&apos;s wiki cites — topics that provide context or precedent for this debate.
            </p>
            <div className="space-y-2">
              {data.outgoing_links.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Related active/voting topics in same category */}
        {!loading && data && data.related_topics.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-emerald" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                Active in {category ?? 'Same Category'}
              </h2>
              <span className="ml-auto text-[10px] font-mono text-surface-500">
                {data.related_topics.length} debates
              </span>
            </div>
            <p className="text-[11px] text-surface-500 -mt-1">
              Live and voting debates in the same category — markets likely to be influenced if this resolves as law.
            </p>
            <div className="space-y-2">
              {data.related_topics.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Precedent laws */}
        {!loading && data && data.precedent_laws.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Gavel className="h-3.5 w-3.5 text-gold" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                Precedent Laws
              </h2>
              <span className="ml-auto text-[10px] font-mono text-surface-500">
                {data.precedent_laws.length} established
              </span>
            </div>
            <p className="text-[11px] text-surface-500 -mt-1">
              Already-established laws in {category ?? 'the same category'} — showing what civic consensus looks like when it reaches law status.
            </p>
            <div className="space-y-2">
              {data.precedent_laws.map((law) => (
                <PrecedentCard key={law.id} law={law} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Empty state when no connections */}
        {!loading && data &&
          data.incoming_links.length === 0 &&
          data.outgoing_links.length === 0 &&
          data.related_topics.length === 0 &&
          data.precedent_laws.length === 0 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8">
            <EmptyState
              icon={GitMerge}
              title="No civic connections yet"
              description="This topic hasn't been linked from other debates, and its wiki hasn't cited any related topics yet. The impact analysis will grow as the community adds wiki content."
            />
          </div>
        )}

        {/* Loading state */}
        {loading && !data && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <Skeleton className="h-4 w-36" />
                <div className="space-y-2">
                  {[...Array(2)].map((_, j) => (
                    <div key={j} className="rounded-xl bg-surface-200 p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-14 rounded" />
                        <Skeleton className="h-4 w-20 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer links */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mb-3">More analysis</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/exchange/${id}/ripple`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-for-300 transition-colors"
            >
              <TrendingUp className="h-3 w-3" />
              Price Ripple
            </Link>
            <Link
              href={`/exchange/${id}/similar`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-for-300 transition-colors"
            >
              <Layers className="h-3 w-3" />
              Similar Markets
            </Link>
            <Link
              href={`/exchange/${id}/research`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 hover:border-gold/60 text-xs text-gold hover:text-gold/90 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Full Research
            </Link>
            <Link
              href={`/exchange/${id}/scenarios`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-purple/40 text-xs text-surface-500 hover:text-purple transition-colors"
            >
              <Zap className="h-3 w-3" />
              Scenarios
            </Link>
            <Link
              href={`/topic/${id}/wiki`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View Wiki
            </Link>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
