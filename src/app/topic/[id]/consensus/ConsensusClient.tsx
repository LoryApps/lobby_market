'use client'

/**
 * /topic/[id]/consensus — Common Ground Finder
 *
 * Maps the value domains that FOR and AGAINST voters share, revealing that
 * even deeply divided debates often argue from common premises to different
 * conclusions. Shows:
 *   • Consensus Score — % of active value domains that both sides invoke
 *   • Shared Domains — values both sides cite (with examples)
 *   • Shared Premises — what agreement in a domain actually means
 *   • Divergence Points — values exclusive to one side
 *
 * Distinct from:
 *   /synthesis     — AI text that merges arguments
 *   /themes        — Argument clustering by rhetorical theme
 *   /correlations  — Voter overlap across different topics
 *   /steelman      — Best version of the opposing view
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Gavel,
  GitMerge,
  Handshake,
  Heart,
  Landmark,
  Leaf,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ConsensusResponse, ValueDomain, SharedPremise, DivergencePoint } from '@/app/api/topics/[id]/consensus/route'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Scale> = {
  TrendingUp,
  Shield,
  BookOpen,
  AlertTriangle,
  Scale,
  Leaf,
  Users,
  Landmark,
  Zap,
  Heart,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'active' || status === 'voting') return <Zap className="h-3 w-3" />
  if (status === 'law') return <Gavel className="h-3 w-3" />
  return <Scale className="h-3 w-3" />
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'High Common Ground', color: 'text-emerald' }
  if (score >= 45) return { label: 'Moderate Common Ground', color: 'text-gold' }
  if (score >= 25) return { label: 'Low Common Ground', color: 'text-against-400' }
  return { label: 'Fundamental Divide', color: 'text-against-300' }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConsensusGauge({ score }: { score: number }) {
  const { label, color } = scoreLabel(score)
  const RADIUS = 60
  const CIRCUMFERENCE = Math.PI * RADIUS  // half circle
  const progress = (score / 100) * CIRCUMFERENCE

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-20 overflow-hidden">
        {/* Background track */}
        <svg
          viewBox="0 0 160 80"
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scaleY(1)' }}
        >
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-surface-300"
          />
          <motion.path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.18} 999`}
            initial={{ strokeDasharray: '0 999' }}
            animate={{ strokeDasharray: `${progress * 2.18} 999` }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <div className={cn('text-3xl font-bold tabular-nums', color)}>{score}</div>
          </motion.div>
        </div>
      </div>
      <div className={cn('text-xs font-mono uppercase tracking-wider', color)}>{label}</div>
    </div>
  )
}

function DomainBar({ domain, expanded, onToggle }: { domain: ValueDomain; expanded: boolean; onToggle: () => void }) {
  const Icon = ICON_MAP[domain.icon] ?? Scale
  const maxScore = Math.max(domain.forScore, domain.againstScore, 1)
  const forW = Math.round((domain.forScore / maxScore) * 100)
  const againstW = Math.round((domain.againstScore / maxScore) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-200/50 transition-colors"
      >
        <div className="flex-shrink-0 rounded-lg bg-surface-200 p-2 mt-0.5">
          <Icon className="h-4 w-4 text-surface-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{domain.label}</span>
            {domain.shared && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald bg-emerald/10 border border-emerald/25 rounded px-1.5 py-0.5">
                Shared
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500 mb-2">{domain.description}</p>
          {/* Bar chart */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-for-400 w-5 text-right">{domain.forScore}%</span>
              <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${forW}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full bg-for-500 rounded-full"
                />
              </div>
              <span className="text-[10px] font-mono text-surface-500">FOR</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-against-400 w-5 text-right">{domain.againstScore}%</span>
              <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${againstW}%` }}
                  transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                  className="h-full bg-against-500 rounded-full"
                />
              </div>
              <span className="text-[10px] font-mono text-surface-500">AGAINST</span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 text-surface-500 mt-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (domain.forArgs.length > 0 || domain.againstArgs.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-surface-300"
          >
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {domain.forArgs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-for-400">
                    <ThumbsUp className="h-3 w-3" />
                    FOR voices
                  </div>
                  {domain.forArgs.map((ex, i) => (
                    <p key={i} className="text-xs text-surface-400 leading-relaxed italic border-l-2 border-for-600 pl-2">
                      &ldquo;{ex}&rdquo;
                    </p>
                  ))}
                </div>
              )}
              {domain.againstArgs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-against-400">
                    <ThumbsDown className="h-3 w-3" />
                    AGAINST voices
                  </div>
                  {domain.againstArgs.map((ex, i) => (
                    <p key={i} className="text-xs text-surface-400 leading-relaxed italic border-l-2 border-against-600 pl-2">
                      &ldquo;{ex}&rdquo;
                    </p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PremiseCard({ premise, index }: { premise: SharedPremise; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border border-emerald/20 bg-emerald/5 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-full bg-emerald/15 p-1.5 mt-0.5">
          <Handshake className="h-3.5 w-3.5 text-emerald" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium leading-snug mb-3">{premise.premise}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {premise.forEvidence && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-for-400">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  FOR
                </div>
                <p className="text-xs text-surface-400 italic leading-relaxed">
                  &ldquo;{premise.forEvidence}&rdquo;
                </p>
              </div>
            )}
            {premise.againstEvidence && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-against-400">
                  <ThumbsDown className="h-2.5 w-2.5" />
                  AGAINST
                </div>
                <p className="text-xs text-surface-400 italic leading-relaxed">
                  &ldquo;{premise.againstEvidence}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function DivergenceCard({ point, index }: { point: DivergencePoint; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4"
    >
      <p className="text-xs font-mono uppercase tracking-wider text-surface-500 mb-3">{point.topic}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-for-500/8 border border-for-600/20 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-for-400 mb-1.5">
            <ThumbsUp className="h-2.5 w-2.5" />
            FOR position
          </div>
          <p className="text-xs text-surface-300 leading-relaxed">{point.forPosition}</p>
        </div>
        <div className="rounded-lg bg-against-500/8 border border-against-600/20 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-against-400 mb-1.5">
            <ThumbsDown className="h-2.5 w-2.5" />
            AGAINST position
          </div>
          <p className="text-xs text-surface-300 leading-relaxed">{point.againstPosition}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ConsensusClient() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<ConsensusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'shared' | 'for' | 'against'>('shared')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/consensus`)
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

  const activeDomains =
    activeTab === 'shared' ? data?.sharedDomains ?? []
    : activeTab === 'for' ? data?.forOnlyDomains ?? []
    : data?.againstOnlyDomains ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* Header nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={topic ? `/topic/${topic.id}` : '/'}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
          <div className="flex items-center gap-2">
            {topic && (
              <Link
                href={`/topic/${topic.id}/arguments`}
                className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
              >
                Arguments
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Topic title */}
        {topic && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={STATUS_LABEL[topic.status]?.toLowerCase() as Parameters<typeof Badge>[0]['variant'] ?? 'proposed'}>
                <StatusIcon status={topic.status} />
                {STATUS_LABEL[topic.status] ?? topic.status}
              </Badge>
              {topic.category && (
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                  {topic.category}
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-white leading-tight">{topic.statement}</h1>
          </div>
        )}

        {/* Page label */}
        <div className="flex items-center gap-2 mb-6">
          <GitMerge className="h-4 w-4 text-emerald" />
          <span className="text-xs font-mono uppercase tracking-widest text-surface-500">Common Ground Finder</span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Skeleton className="w-40 h-20 rounded-xl" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Scale}
            title="Could not load"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* Content */}
        {!loading && !error && data && (
          <div className="space-y-6">

            {/* Consensus Score */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
              <div className="text-center mb-4">
                <ConsensusGauge score={data.consensusScore} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-white tabular-nums">{data.stats.sharedDomainCount}</div>
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Shared values</div>
                </div>
                <div className="text-center border-x border-surface-300">
                  <div className="text-lg font-bold text-white tabular-nums">{data.stats.agreementZones}</div>
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Common premises</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white tabular-nums">{data.stats.totalArgs}</div>
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Args analysed</div>
                </div>
              </div>
            </div>

            {/* Shared premises */}
            {data.sharedPremises.length > 0 && (
              <section>
                <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3 flex items-center gap-2">
                  <Handshake className="h-3.5 w-3.5 text-emerald" />
                  What both sides agree on
                </h2>
                <div className="space-y-3">
                  {data.sharedPremises.map((p, i) => (
                    <PremiseCard key={i} premise={p} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Value domains — tabbed */}
            <section>
              <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3 flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-for-400" />
                Value domains
              </h2>

              {/* Tab bar */}
              <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-4">
                {(
                  [
                    { key: 'shared', label: `Shared (${data.sharedDomains.length})` },
                    { key: 'for', label: `FOR only (${data.forOnlyDomains.length})` },
                    { key: 'against', label: `AGAINST only (${data.againstOnlyDomains.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-colors',
                      activeTab === tab.key
                        ? 'bg-surface-50 text-white shadow-sm'
                        : 'text-surface-500 hover:text-surface-400'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeDomains.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No domains found"
                  description="Not enough arguments to identify distinct value domains for this filter."
                />
              ) : (
                <div className="space-y-2">
                  {activeDomains.map((d) => (
                    <DomainBar
                      key={d.key}
                      domain={d}
                      expanded={expandedDomain === d.key}
                      onToggle={() => setExpandedDomain(expandedDomain === d.key ? null : d.key)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Divergence points */}
            {data.divergencePoints.length > 0 && (
              <section>
                <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-against-400" />
                  Where they diverge
                </h2>
                <div className="space-y-3">
                  {data.divergencePoints.map((pt, i) => (
                    <DivergenceCard key={i} point={pt} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Footer links */}
            <div className="pt-2 flex flex-wrap gap-2">
              {topic && (
                <>
                  <Link
                    href={`/topic/${topic.id}/synthesis`}
                    className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white border border-surface-300 hover:border-surface-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <GitMerge className="h-3 w-3" />
                    Synthesis
                  </Link>
                  <Link
                    href={`/topic/${topic.id}/steelman`}
                    className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white border border-surface-300 hover:border-surface-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Shield className="h-3 w-3" />
                    Steelman
                  </Link>
                  <Link
                    href={`/topic/${topic.id}/themes`}
                    className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white border border-surface-300 hover:border-surface-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Landmark className="h-3 w-3" />
                    Themes
                  </Link>
                </>
              )}
            </div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
