'use client'

/**
 * /evidence — The Civic Evidence Library
 *
 * A platform-wide leaderboard of the best community-submitted evidence
 * from the Evidence Board, ranked by community upvotes. Distinct from
 * /sources (which tracks domains cited in arguments) — this shows the
 * explicit evidence submissions with their voting context.
 *
 * Features:
 *  - Filter by stance (FOR / AGAINST / NEUTRAL)
 *  - Sort by most upvoted or most recent
 *  - Domain Intelligence sidebar: which sources the community trusts most
 *  - Click-through to the topic debate
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  RefreshCw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type {
  TrendingEvidenceItem,
  DomainStat,
  TrendingEvidenceResponse,
} from '@/app/api/evidence/trending/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'for' | 'against' | 'neutral'
type SortMode = 'votes' | 'recent'

const SIDE_CONFIG = {
  for: {
    label: 'FOR',
    labelLong: 'Supporting',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    pill: 'bg-for-500/20 text-for-300 border-for-500/40',
    activeBtn: 'bg-for-500/20 text-for-300 border-for-500/50',
    icon: ThumbsUp,
  },
  against: {
    label: 'AGAINST',
    labelLong: 'Opposing',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    pill: 'bg-against-500/20 text-against-300 border-against-500/40',
    activeBtn: 'bg-against-500/20 text-against-300 border-against-500/50',
    icon: ThumbsDown,
  },
  neutral: {
    label: 'NEUTRAL',
    labelLong: 'Contextual',
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/30',
    pill: 'bg-surface-300/20 text-surface-300 border-surface-300/40',
    activeBtn: 'bg-surface-300/20 text-surface-300 border-surface-400/50',
    icon: Shield,
  },
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-400 border-surface-400/40',
  active: 'text-for-400 border-for-500/40',
  voting: 'text-purple border-purple/40',
  law: 'text-gold border-gold/40',
  failed: 'text-against-400 border-against-500/40',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Favicon ──────────────────────────────────────────────────────────────────

function FaviconIcon({ domain }: { domain: string | null }) {
  const [errored, setErrored] = useState(false)

  if (!domain || errored) {
    return (
      <div className="h-5 w-5 rounded flex items-center justify-center bg-surface-300/60">
        <Globe className="h-3 w-3 text-surface-500" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt={domain}
      width={20}
      height={20}
      className="h-5 w-5 rounded object-contain"
      onError={() => setErrored(true)}
    />
  )
}

// ─── EvidenceCard ─────────────────────────────────────────────────────────────

function EvidenceCard({
  item,
  idx,
}: {
  item: TrendingEvidenceItem
  idx: number
}) {
  const [expanded, setExpanded] = useState(false)
  const sideCfg = SIDE_CONFIG[item.side] ?? SIDE_CONFIG.neutral
  const SideIcon = sideCfg.icon
  const statusLabel = STATUS_LABEL[item.topic_status] ?? item.topic_status
  const statusColor = STATUS_COLOR[item.topic_status] ?? 'text-surface-400 border-surface-400/40'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.4) }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden hover:border-surface-400 transition-colors"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Rank & upvotes */}
          <div className="flex flex-col items-center gap-0.5 shrink-0 w-10 pt-0.5">
            <div
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-xl border-2 text-sm font-bold font-mono',
                item.upvotes >= 10
                  ? 'bg-gold/10 border-gold/50 text-gold'
                  : item.upvotes >= 5
                    ? 'bg-for-500/10 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-400'
              )}
            >
              <ChevronUp className="h-4 w-4" />
            </div>
            <span className="text-xs font-mono font-bold text-surface-300">{item.upvotes}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Stance + domain row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wide border',
                  sideCfg.pill
                )}
              >
                <SideIcon className="h-2.5 w-2.5" />
                {sideCfg.label}
              </span>
              {item.domain && (
                <span className="inline-flex items-center gap-1 text-[11px] text-surface-500 font-mono">
                  <FaviconIcon domain={item.domain} />
                  {item.domain}
                </span>
              )}
            </div>

            {/* Evidence title */}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
                {item.title}
              </p>
            </a>

            {/* Description (toggleable) */}
            {item.description && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show details
                  </>
                )}
              </button>
            )}
            <AnimatePresence>
              {expanded && item.description && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-surface-400 leading-relaxed overflow-hidden"
                >
                  {item.description}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Topic link */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/topic/${item.topic_id}`}
                className="flex items-center gap-1.5 text-[11px] text-surface-400 hover:text-white transition-colors"
              >
                <span className="line-clamp-1 max-w-[200px] sm:max-w-[320px]">
                  {item.topic_statement}
                </span>
                <ArrowUpRight className="h-3 w-3 shrink-0" />
              </Link>
              <span
                className={cn(
                  'inline-block text-[10px] font-mono px-1.5 py-0 rounded border',
                  statusColor
                )}
              >
                {statusLabel}
              </span>
              {item.topic_category && (
                <span className="text-[10px] font-mono text-surface-500">
                  {item.topic_category}
                </span>
              )}
            </div>
          </div>

          {/* External link */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            title="Open source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-surface-300/50 flex items-center justify-between">
          {item.author ? (
            <Link
              href={`/profile/${item.author.username}`}
              className="flex items-center gap-1.5 text-[11px] text-surface-500 hover:text-surface-300 transition-colors"
            >
              <Avatar
                url={item.author.avatar_url}
                username={item.author.username}
                size={16}
              />
              <span>{item.author.display_name ?? item.author.username}</span>
            </Link>
          ) : (
            <span className="text-[11px] text-surface-600">anonymous</span>
          )}
          <span className="text-[11px] font-mono text-surface-600">{relativeTime(item.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── DomainCard ───────────────────────────────────────────────────────────────

function DomainCard({ stat, onFilter }: { stat: DomainStat; onFilter: (d: string) => void }) {
  const forPct = stat.total > 0 ? Math.round((stat.for_count / stat.total) * 100) : 50
  const againstPct = stat.total > 0 ? Math.round((stat.against_count / stat.total) * 100) : 50

  return (
    <button
      onClick={() => onFilter(stat.domain)}
      className="w-full text-left rounded-xl p-3 bg-surface-200/50 border border-surface-300/60 hover:border-surface-400 hover:bg-surface-200 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <FaviconIcon domain={stat.domain} />
        <span className="text-xs font-mono text-white truncate flex-1">{stat.domain}</span>
        <span className="text-[10px] font-mono text-surface-500 shrink-0">
          {stat.total} items
        </span>
      </div>
      {/* Bias bar */}
      <div className="h-1 rounded-full overflow-hidden bg-surface-300 flex">
        <div
          className="h-full bg-for-500/70 transition-all"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="h-full bg-against-500/70 transition-all"
          style={{ width: `${againstPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] font-mono text-surface-500">
        <span className="text-for-400">{forPct}% for</span>
        <span className="text-gold">{stat.total_upvotes} votes</span>
        <span className="text-against-400">{againstPct}% against</span>
      </div>
    </button>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function EvidenceSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-0.5 w-10">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-3 w-6" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          </div>
          <div className="mt-3 pt-3 border-t border-surface-300/50 flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvidencePage() {
  const [data, setData] = useState<TrendingEvidenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('votes')
  const [domainFilter, setDomainFilter] = useState<string | null>(null)
  const [showDomains, setShowDomains] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sideFilter !== 'all') params.set('side', sideFilter)
      params.set('sort', sortMode)
      if (domainFilter) params.set('domain', domainFilter)
      const res = await fetch(`/api/evidence/trending?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json: TrendingEvidenceResponse = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [sideFilter, sortMode, domainFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const clearDomainFilter = () => setDomainFilter(null)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <BookOpen className="h-5 w-5 text-emerald" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">Civic Evidence Library</h1>
            <p className="text-sm text-surface-400 mt-0.5">
              The best community-curated sources across every debate — ranked by votes
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        {data && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                label: 'Supporting',
                value: data.counts.for,
                color: 'text-for-300',
                bg: 'bg-for-500/10 border-for-500/20',
                icon: ThumbsUp,
              },
              {
                label: 'Opposing',
                value: data.counts.against,
                color: 'text-against-300',
                bg: 'bg-against-500/10 border-against-500/20',
                icon: ThumbsDown,
              },
              {
                label: 'Contextual',
                value: data.counts.neutral,
                color: 'text-surface-300',
                bg: 'bg-surface-200 border-surface-300',
                icon: Shield,
              },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div
                key={label}
                className={cn(
                  'rounded-xl border px-4 py-3 flex items-center gap-3',
                  bg
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', color)} />
                <div>
                  <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
                  <p className="text-[11px] text-surface-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Side filters */}
              <div className="flex items-center rounded-xl overflow-hidden border border-surface-300 bg-surface-100 p-1 gap-1">
                {(['all', 'for', 'against', 'neutral'] as SideFilter[]).map((s) => {
                  const cfg = s !== 'all' ? SIDE_CONFIG[s] : null
                  return (
                    <button
                      key={s}
                      onClick={() => setSideFilter(s)}
                      className={cn(
                        'px-3 h-7 rounded-lg text-xs font-mono transition-colors',
                        sideFilter === s
                          ? s === 'all'
                            ? 'bg-surface-300 text-white'
                            : cfg?.activeBtn
                          : 'text-surface-400 hover:text-white'
                      )}
                    >
                      {s === 'all' ? 'All' : cfg?.label}
                    </button>
                  )
                })}
              </div>

              {/* Sort */}
              <div className="flex items-center rounded-xl overflow-hidden border border-surface-300 bg-surface-100 p-1 gap-1">
                <button
                  onClick={() => setSortMode('votes')}
                  className={cn(
                    'flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-mono transition-colors',
                    sortMode === 'votes' ? 'bg-surface-300 text-white' : 'text-surface-400 hover:text-white'
                  )}
                >
                  <TrendingUp className="h-3 w-3" />
                  Top
                </button>
                <button
                  onClick={() => setSortMode('recent')}
                  className={cn(
                    'flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-mono transition-colors',
                    sortMode === 'recent' ? 'bg-surface-300 text-white' : 'text-surface-400 hover:text-white'
                  )}
                >
                  <Clock className="h-3 w-3" />
                  New
                </button>
              </div>

              {/* Domain filter active */}
              {domainFilter && (
                <div className="flex items-center gap-1.5 px-3 h-7 rounded-xl bg-emerald/10 border border-emerald/30 text-xs font-mono text-emerald">
                  <Globe className="h-3 w-3" />
                  {domainFilter}
                  <button onClick={clearDomainFilter} className="hover:text-white ml-0.5 transition-colors">
                    ×
                  </button>
                </div>
              )}

              {/* Domain toggle (mobile) */}
              <button
                onClick={() => setShowDomains((v) => !v)}
                className="lg:hidden flex items-center gap-1 px-3 h-7 rounded-xl bg-surface-100 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors ml-auto"
              >
                <BarChart2 className="h-3 w-3" />
                Sources
                {showDomains ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Mobile domain panel */}
            <AnimatePresence>
              {showDomains && data && data.domain_stats.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="lg:hidden overflow-hidden mb-4"
                >
                  <div className="grid grid-cols-2 gap-2 pb-1">
                    {data.domain_stats.slice(0, 6).map((stat) => (
                      <DomainCard
                        key={stat.domain}
                        stat={stat}
                        onFilter={(d) => {
                          setDomainFilter(domainFilter === d ? null : d)
                          setShowDomains(false)
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Evidence list */}
            {loading ? (
              <EvidenceSkeleton />
            ) : !data || data.items.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No evidence yet"
                description={
                  domainFilter
                    ? `No evidence from ${domainFilter} with the current filters.`
                    : sideFilter !== 'all'
                      ? 'No evidence submitted with this stance yet.'
                      : 'Be the first to submit evidence — open any debate and click the Evidence tab.'
                }
                action={
                  domainFilter
                    ? { label: 'Clear filter', onClick: clearDomainFilter }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {data.items.map((item, idx) => (
                  <EvidenceCard key={item.id} item={item} idx={idx} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar — Domain Intelligence */}
          <div className="hidden lg:block lg:w-72 xl:w-80 shrink-0">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-emerald" />
                  <h2 className="text-sm font-semibold text-white">Source Intelligence</h2>
                </div>
                <p className="text-[11px] text-surface-500 mb-3 leading-relaxed">
                  Which sources the community trusts most. Bias bars show FOR / AGAINST lean.
                </p>
                {!data ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                  </div>
                ) : data.domain_stats.length === 0 ? (
                  <p className="text-xs text-surface-500 text-center py-4">
                    No domain stats yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.domain_stats.slice(0, 12).map((stat) => (
                      <DomainCard
                        key={stat.domain}
                        stat={stat}
                        onFilter={(d) =>
                          setDomainFilter(domainFilter === d ? null : d)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Quick links */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <h2 className="text-sm font-semibold text-white mb-3">Related</h2>
                <div className="space-y-1.5">
                  {[
                    { href: '/sources', label: 'Argument Citations', icon: Filter },
                    { href: '/trending', label: 'Trending Topics', icon: Zap },
                    { href: '/laws', label: 'Established Laws', icon: BookOpen },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
