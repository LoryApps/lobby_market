'use client'

/**
 * /analytics/cascade — Civic Influence Cascade
 *
 * Shows how your votes and authored topics have cascaded through the
 * platform's chain system: topics you voted FOR that spawned downstream
 * debates, laws that descended from your chains, and your total cascade
 * footprint on the Lobby's legislative landscape.
 *
 * Distinct from:
 *   /analytics/legacy      — overall contribution summary + legacy tier
 *   /analytics/influence   — composite engagement + quality score
 *   /cascade               — platform-wide law cascade effects (not personal)
 *   /chains                — browse all active topic chains
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Crown,
  ExternalLink,
  Gavel,
  GitBranch,
  GitMerge,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CascadeResponse, CascadeChain, CascadeStats } from '@/app/api/analytics/cascade/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<CascadeStats['cascade_tier'], {
  color: string; bg: string; border: string; glow: string; icon: typeof Crown; label: string
}> = {
  Architect: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    glow: 'shadow-[0_0_24px_rgba(201,168,76,0.3)]',
    icon: Crown,
    label: 'Civic Architect',
  },
  Builder: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.25)]',
    icon: GitMerge,
    label: 'Cascade Builder',
  },
  Catalyst: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-[0_0_16px_rgba(59,130,246,0.2)]',
    icon: Zap,
    label: 'Civic Catalyst',
  },
  Voter: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: '',
    icon: Vote,
    label: 'Active Voter',
  },
  Observer: {
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    glow: '',
    icon: BarChart2,
    label: 'Observer',
  },
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'active',
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
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
  icon: Icon,
}: {
  label: string
  value: number
  sub?: string
  color?: string
  icon: typeof Zap
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('font-mono text-3xl font-bold tabular-nums', color)}>
        <AnimatedNumber value={value} />
      </div>
      {sub && <p className="text-xs text-surface-500 font-mono leading-relaxed">{sub}</p>}
    </div>
  )
}

// ─── Chain card ───────────────────────────────────────────────────────────────

function ChainCard({ chain }: { chain: CascadeChain }) {
  const isLaw = chain.root_outcome === 'law'
  const hasBadge = STATUS_BADGE[chain.root_outcome]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 transition-colors hover:border-surface-400/60',
        chain.law_count > 0 ? 'border-gold/20' : 'border-surface-300',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg mt-0.5',
            isLaw ? 'bg-gold/10 border border-gold/30' : 'bg-for-500/10 border border-for-500/30',
          )}>
            {isLaw
              ? <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden />
              : <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden />
            }
          </div>
          <div className="min-w-0">
            <Link
              href={`/topic/${chain.root_id}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug line-clamp-2"
            >
              {truncate(chain.root_statement, 90)}
            </Link>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5">
              {relativeTime(chain.root_voted_at)} · {chain.root_category ?? 'General'}
            </p>
          </div>
        </div>
        {hasBadge && (
          <Badge variant={hasBadge} className="flex-shrink-0 text-[10px]">
            {chain.root_outcome === 'law' ? 'LAW' : chain.root_outcome}
          </Badge>
        )}
      </div>

      {/* Chain stats row */}
      <div className="flex items-center gap-4 pt-3 border-t border-surface-300">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-for-400" aria-hidden />
          <span className="text-xs font-mono text-for-300 font-semibold">{chain.child_count}</span>
          <span className="text-xs font-mono text-surface-500">topics spawned</span>
        </div>
        {chain.law_count > 0 && (
          <div className="flex items-center gap-1.5">
            <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden />
            <span className="text-xs font-mono text-gold font-semibold">{chain.law_count}</span>
            <span className="text-xs font-mono text-surface-500">laws</span>
          </div>
        )}
        {chain.max_depth > 0 && (
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-purple" aria-hidden />
            <span className="text-xs font-mono text-purple font-semibold">{chain.max_depth}</span>
            <span className="text-xs font-mono text-surface-500">deep</span>
          </div>
        )}
        <Link
          href={`/topic/${chain.root_id}`}
          className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          View <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 1000) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-mono text-surface-500">
        <span>Cascade Score</span>
        <span className="text-white font-bold">{score} / 1000</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-for-500 to-purple"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-surface-600">
        <span>Observer</span>
        <span>Catalyst</span>
        <span>Architect</span>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CascadeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex items-start gap-4 mb-5">
          <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-2 w-full rounded-full mt-3" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-200 p-5 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-4 pt-3 border-t border-surface-300">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CascadePage() {
  const router = useRouter()
  const [data, setData] = useState<CascadeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/cascade')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      if (!json.authenticated) {
        router.push('/login')
        return
      }
      setData(json as CascadeResponse)
    } catch {
      setError('Could not load your cascade data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const stats = data?.stats
  const tier = stats ? TIER_CONFIG[stats.cascade_tier] : null
  const TierIcon = tier?.icon ?? BarChart2

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back nav */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" aria-hidden />
          </Link>
          <div className="flex items-center gap-1.5 text-sm font-mono text-surface-500">
            <Link href="/analytics" className="hover:text-white transition-colors">Analytics</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-white">Influence Cascade</span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <GitMerge className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Influence Cascade</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                How your votes ripple through the civic chain
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh cascade data"
              className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} aria-hidden />
            </button>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed mt-3 max-w-xl">
            When you vote <span className="text-for-400 font-semibold">FOR</span> a topic and it succeeds, the Lobby
            often spawns a chain of new debates. This page tracks how far your civic voice has travelled — topics
            downstream, laws established, and your overall cascade footprint.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CascadeSkeleton />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Scale}
                title="Couldn't load your cascade"
                description={error}
                action={{ label: 'Try again', onClick: fetchData }}
              />
            </motion.div>
          )}

          {data && !loading && !error && (
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

              {/* ── Tier card ── */}
              {tier && stats && (
                <div className={cn(
                  'rounded-3xl bg-surface-100 border p-6',
                  tier.border, tier.glow,
                )}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className={cn(
                      'flex items-center justify-center h-16 w-16 rounded-2xl flex-shrink-0',
                      tier.bg, `border ${tier.border}`,
                    )}>
                      <TierIcon className={cn('h-8 w-8', tier.color)} aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">Cascade Tier</p>
                      <p className={cn('font-mono text-2xl font-bold', tier.color)}>{tier.label}</p>
                      <p className="text-sm text-surface-400 mt-1 leading-relaxed max-w-sm">
                        {stats.tier_description}
                      </p>
                    </div>
                  </div>
                  <ScoreBar score={stats.cascade_score} />
                </div>
              )}

              {/* ── Stats grid ── */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Chains Started"
                    value={stats.chains_started}
                    sub="Topics you voted FOR that spawned new debates"
                    color="text-for-400"
                    icon={GitBranch}
                  />
                  <StatCard
                    label="Topics Spawned"
                    value={stats.total_descendants}
                    sub="Downstream topics across all your chains"
                    color="text-purple"
                    icon={TrendingUp}
                  />
                  <StatCard
                    label="Laws Cascaded"
                    value={stats.laws_from_chains}
                    sub="Established laws that descend from your chains"
                    color="text-gold"
                    icon={Gavel}
                  />
                  <StatCard
                    label="Max Chain Depth"
                    value={stats.max_chain_depth}
                    sub="Deepest level reached in any chain you started"
                    color="text-emerald"
                    icon={Layers}
                  />
                </div>
              )}

              {/* ── Authored stats ── */}
              {stats && (stats.authored_laws > 0 || stats.authored_chains > 0) && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-gold" aria-hidden />
                    <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wide">
                      Your Authored Topics
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-surface-200 p-4">
                      <p className="text-xs font-mono text-surface-500 mb-1">Topics Authored</p>
                      <p className="font-mono text-2xl font-bold text-for-400">
                        <AnimatedNumber value={stats.authored_chains} />
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5">chain-origin debates you created</p>
                    </div>
                    <div className="rounded-xl bg-surface-200 p-4">
                      <p className="text-xs font-mono text-surface-500 mb-1">Laws Authored</p>
                      <p className="font-mono text-2xl font-bold text-gold">
                        <AnimatedNumber value={stats.authored_laws} />
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5">topics you created that became law</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Top chains ── */}
              {data.top_chains.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-gold" aria-hidden />
                    <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wide">
                      Your Cascade Chains
                    </h2>
                    <span className="text-xs font-mono text-surface-500 ml-auto">
                      {data.top_chains.length} chains
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.top_chains.map((chain) => (
                      <ChainCard key={chain.root_id} chain={chain} />
                    ))}
                  </div>
                </div>
              ) : stats?.chains_started === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title="No cascade yet"
                  description="Vote FOR on active topics to start your civic cascade. When those topics spawn chain debates, you'll see them here."
                  action={{
                    label: 'Find active topics',
                    href: '/',
                  }}
                />
              ) : null}

              {/* ── Recent descendants ── */}
              {data.recent_descendants.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-for-400" aria-hidden />
                    <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wide">
                      Recent Downstream Topics
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 divide-y divide-surface-300 overflow-hidden">
                    {data.recent_descendants.slice(0, 10).map((d) => (
                      <Link
                        key={d.id}
                        href={`/topic/${d.id}`}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-200 transition-colors"
                      >
                        <div className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-surface-300 border border-surface-400">
                          <span className="text-[10px] font-mono text-surface-500 font-bold">{d.depth}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate leading-snug">{d.statement}</p>
                          <p className="text-[11px] font-mono text-surface-500 mt-0.5 flex items-center gap-1.5">
                            <span>From: {truncate(d.root_statement, 40)}</span>
                            <span>·</span>
                            <span>{relativeTime(d.created_at)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={STATUS_BADGE[d.status] ?? 'proposed'} className="text-[10px]">
                            {d.status === 'law' ? 'LAW' : d.status}
                          </Badge>
                          <ArrowRight className="h-3.5 w-3.5 text-surface-500" aria-hidden />
                        </div>
                      </Link>
                    ))}
                  </div>
                  {data.recent_descendants.length > 10 && (
                    <p className="text-center text-xs font-mono text-surface-500 pt-1">
                      Showing 10 of {data.recent_descendants.length} downstream topics
                    </p>
                  )}
                </div>
              )}

              {/* ── Links to related pages ── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h3 className="font-mono text-xs text-surface-500 uppercase tracking-wider mb-3">
                  Related Analytics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { href: '/analytics/legacy', label: 'Legacy Report', icon: Crown },
                    { href: '/analytics/influence', label: 'Influence Score', icon: Zap },
                    { href: '/chains', label: 'Browse Chains', icon: GitBranch },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-for-400 flex-shrink-0" aria-hidden />
                      <span className="text-xs font-mono text-white">{label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-surface-500 ml-auto" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
