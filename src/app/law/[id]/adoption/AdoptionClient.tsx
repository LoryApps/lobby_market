'use client'

/**
 * /law/[id]/adoption — Law Adoption & Implementation Tracker
 *
 * Shows how well an established law is being adopted by the community:
 *   ADOPTION SCORE    — composite health metric (0–100)
 *   SIGNALS           — mandate strength, wiki stewardship, challenge & amendment pressure
 *   TIMELINE          — post-passage events ordered chronologically
 *   FRICTION GAUGE    — challenge + amendment pressure breakdown
 *
 * Distinct from:
 *   /law/[id]/sentiment  — community opinion and reviews
 *   /law/[id]/velocity   — vote momentum trajectory
 *   /law/[id]/challenge  — formal challenge management
 *   /law/[id]/amendments — amendment proposals
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileWarning,
  Gavel,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawAdoptionData, AdoptionSignal, AdoptionEvent } from '@/app/api/laws/[id]/adoption/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDays(days: number): string {
  if (days < 1) return 'Today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''}`
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''}`
}

// ─── Adoption label config ────────────────────────────────────────────────────

const ADOPTION_CONFIG: Record<LawAdoptionData['adoptionLabel'], {
  color: string; bg: string; border: string; icon: typeof Sparkles; description: string
}> = {
  Thriving: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Sparkles,
    description: 'Stable, actively stewarded, minimal friction',
  },
  Stable: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: CheckCircle2,
    description: 'Healthy adoption with manageable challenges',
  },
  Active: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Zap,
    description: 'Active engagement — evolving through amendments and debate',
  },
  Pressured: {
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: AlertTriangle,
    description: 'Under pressure from challenges or amendment demands',
  },
  'At Risk': {
    color: 'text-against-500',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    icon: XCircle,
    description: 'High friction — stability uncertain',
  },
}

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<AdoptionEvent['type'], {
  icon: typeof Gavel; color: string; bg: string
}> = {
  challenge: { icon: Shield,      color: 'text-against-400', bg: 'bg-against-600/10 border-against-600/30' },
  amendment: { icon: FileWarning, color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' },
  revision:  { icon: BookOpen,    color: 'text-for-400',     bg: 'bg-for-600/10 border-for-600/30' },
  wiki_edit: { icon: BookOpen,    color: 'text-for-400',     bg: 'bg-for-600/10 border-for-600/30' },
  debate:    { icon: Mic,         color: 'text-purple',      bg: 'bg-purple/10 border-purple/30' },
}

// ─── Signal bar ───────────────────────────────────────────────────────────────

function SignalBar({ signal }: { signal: AdoptionSignal }) {
  const TrendIcon = signal.trend === 'up' ? TrendingUp : signal.trend === 'down' ? TrendingDown : Scale
  const trendColor = signal.trend === 'up' ? 'text-emerald' : signal.trend === 'down' ? 'text-against-400' : 'text-surface-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-white font-mono">{signal.label}</span>
        <div className="flex items-center gap-1">
          <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
          <span className={cn('text-xs font-mono font-bold tabular-nums', trendColor)}>
            {signal.value}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            signal.trend === 'up' ? 'bg-emerald' : signal.trend === 'down' ? 'bg-against-500' : 'bg-gold',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${signal.value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[10px] text-surface-500">{signal.description}</p>
    </div>
  )
}

// ─── Adoption score ring ──────────────────────────────────────────────────────

function AdoptionRing({ score, color }: { score: number; color: string }) {
  const r = 30
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
        <circle cx={40} cy={40} r={r} fill="none" stroke="#2a2d36" strokeWidth="8" />
        <motion.circle
          cx={40}
          cy={40}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-xl text-white">{score}</span>
        <span className="text-[9px] font-mono text-surface-500">/ 100</span>
      </div>
    </div>
  )
}

// ─── Friction gauge ───────────────────────────────────────────────────────────

function FrictionGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-surface-500">{label}</span>
        <span className={cn('text-[10px] font-mono font-bold tabular-nums', color)}>{value}</span>
      </div>
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
}

export function AdoptionClient({ lawId }: Props) {
  const [data, setData] = useState<LawAdoptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/adoption`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as LawAdoptionData)
    } catch {
      setError('Could not load adoption data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const cfg = data ? ADOPTION_CONFIG[data.adoptionLabel] : null
  const AdoptionIcon = cfg?.icon ?? Sparkles

  const gaugeColor =
    !data ? '#6b7280'
    : data.adoptionScore >= 75 ? '#10b981'
    : data.adoptionScore >= 58 ? '#3b82f6'
    : data.adoptionScore >= 42 ? '#f59e0b'
    : data.adoptionScore >= 25 ? '#f97316'
    : '#ef4444'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-mono text-lg font-bold text-white">Law Adoption</h1>
            {data && (
              <p className="text-xs text-surface-500 font-mono truncate">
                {data.law.statement.slice(0, 70)}{data.law.statement.length > 70 ? '…' : ''}
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-xl bg-against-600/10 border border-against-600/30 text-against-400 text-sm">
            {error}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-60 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {data && cfg && (
          <>
            {/* ── Score hero card ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('p-5 rounded-2xl border', cfg.bg, cfg.border)}
            >
              <div className="flex items-center gap-5">
                <AdoptionRing score={data.adoptionScore} color={gaugeColor} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <AdoptionIcon className={cn('h-4 w-4', cfg.color)} />
                    <span className={cn('font-mono font-bold text-lg', cfg.color)}>
                      {data.adoptionLabel}
                    </span>
                    {data.stats.daysSincePassage > 0 && (
                      <Badge className="text-[10px] font-mono bg-surface-300/50 text-surface-400 border-surface-400/40">
                        {formatDays(data.stats.daysSincePassage)} old
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-surface-500 mb-3">{cfg.description}</p>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Challenges', value: data.stats.challengeCount, color: data.stats.openChallenges > 0 ? 'text-against-400' : 'text-surface-400' },
                      { label: 'Amendments', value: data.stats.amendmentCount, color: data.stats.pendingAmendments > 0 ? 'text-gold' : 'text-surface-400' },
                      { label: 'Wiki Edits', value: data.stats.wikiRevisions, color: data.stats.wikiRevisions > 0 ? 'text-for-400' : 'text-surface-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <p className={cn('font-mono font-bold text-lg tabular-nums', color)}>{value}</p>
                        <p className="text-[10px] text-surface-500">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Friction breakdown ────────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300">
              <h2 className="font-mono text-sm font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-against-400" />
                Friction Breakdown
              </h2>
              <div className="flex items-center gap-4">
                <FrictionGauge
                  label="Challenge Friction"
                  value={data.friction.challengeFriction}
                  color={data.friction.challengeFriction > 60 ? '#ef4444' : data.friction.challengeFriction > 30 ? '#f97316' : '#6b7280'}
                />
                <FrictionGauge
                  label="Amendment Pressure"
                  value={data.friction.amendmentPressure}
                  color={data.friction.amendmentPressure > 60 ? '#f59e0b' : data.friction.amendmentPressure > 30 ? '#f97316' : '#6b7280'}
                />
              </div>
              <div className="mt-3 pt-3 border-t border-surface-400/20 flex items-center justify-between">
                <span className="text-xs text-surface-500 font-mono">Overall friction</span>
                <span className={cn(
                  'text-sm font-mono font-bold tabular-nums',
                  data.friction.overallFriction > 60 ? 'text-against-400' :
                  data.friction.overallFriction > 30 ? 'text-gold' : 'text-emerald',
                )}>
                  {data.friction.overallFriction}/100
                </span>
              </div>
            </div>

            {/* ── Adoption signals ──────────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300">
              <h2 className="font-mono text-sm font-bold text-white mb-5 flex items-center gap-2">
                <Zap className="h-4 w-4 text-for-400" />
                Adoption Signals
              </h2>
              <div className="space-y-5">
                {data.signals.map((signal) => (
                  <SignalBar key={signal.label} signal={signal} />
                ))}
              </div>
            </div>

            {/* ── Post-passage timeline ─────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-surface-200/60 border border-surface-300">
              <h2 className="font-mono text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple" />
                Post-Passage Timeline
              </h2>

              {data.timeline.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="h-8 w-8 text-surface-500 mx-auto mb-2" />
                  <p className="text-sm text-surface-500 font-mono">No post-passage activity yet</p>
                  <p className="text-xs text-surface-600 mt-1">Challenges, amendments, and wiki edits will appear here</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-surface-300" />

                  <div className="space-y-4">
                    {data.timeline.map((event, i) => {
                      const evtCfg = EVENT_CONFIG[event.type]
                      const EvtIcon = evtCfg.icon

                      return (
                        <motion.div
                          key={`${event.type}-${i}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex gap-3 relative"
                        >
                          {/* Dot */}
                          <div className={cn(
                            'flex-shrink-0 h-8 w-8 rounded-full border flex items-center justify-center z-10',
                            evtCfg.bg,
                          )}>
                            <EvtIcon className={cn('h-3.5 w-3.5', evtCfg.color)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pb-1">
                            {event.link ? (
                              <Link
                                href={event.link}
                                className="flex items-start justify-between gap-2 group"
                              >
                                <p className="text-xs text-white font-mono line-clamp-2 group-hover:text-for-300 transition-colors">
                                  {event.title}
                                </p>
                                <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                              </Link>
                            ) : (
                              <p className="text-xs text-white font-mono line-clamp-2">{event.title}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-surface-500">{formatDate(event.date)}</span>
                              {event.status && (
                                <Badge className={cn(
                                  'text-[9px] font-mono py-0',
                                  event.status === 'open' || event.status === 'pending'
                                    ? 'bg-gold/10 text-gold border-gold/30'
                                    : event.status === 'ratified' || event.status === 'upheld'
                                    ? 'bg-emerald/10 text-emerald border-emerald/30'
                                    : 'bg-surface-300/50 text-surface-500 border-surface-400/30',
                                )}>
                                  {event.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Stat grid ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Days Active', value: data.stats.daysSincePassage, color: 'text-surface-300' },
                { label: 'Open Challenges', value: data.stats.openChallenges, color: data.stats.openChallenges > 0 ? 'text-against-400' : 'text-surface-400' },
                { label: 'Pending Amend.', value: data.stats.pendingAmendments, color: data.stats.pendingAmendments > 0 ? 'text-gold' : 'text-surface-400' },
                { label: 'Ratified Amend.', value: data.stats.ratifiedAmendments, color: 'text-emerald' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="p-3 rounded-xl bg-surface-200/60 border border-surface-300 text-center"
                >
                  <p className={cn('font-mono font-bold text-lg tabular-nums', color)}>{value}</p>
                  <p className="text-[10px] text-surface-500">{label}</p>
                </div>
              ))}
            </div>

            {/* ── Quick links ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Community Sentiment', href: `/law/${lawId}/sentiment`, icon: Sparkles, color: 'text-purple' },
                { label: 'Challenges Filed', href: `/law/${lawId}/challenge`, icon: Shield, color: 'text-against-400' },
                { label: 'Amendments', href: `/law/${lawId}/amendments`, icon: FileWarning, color: 'text-gold' },
                { label: 'Wiki History', href: `/law/${lawId}/wiki-history`, icon: BookOpen, color: 'text-for-400' },
              ].map(({ label, href, icon: Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                    {label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto" />
                </Link>
              ))}
            </div>

            {/* ── Back ──────────────────────────────────────────────────── */}
            <div className="pt-2">
              <Link
                href={`/law/${lawId}`}
                className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
              >
                <Gavel className="h-4 w-4" />
                Back to law
              </Link>
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
