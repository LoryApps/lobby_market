'use client'

/**
 * /law/[id]/global — International Context
 *
 * Places an established law's consensus in a global political context.
 * Answers: "Is this civic consensus typical globally, or is Lobby Market
 * ahead/behind international norms?"
 *
 * Shows:
 *   - Political spectrum positioning (left/centre/right dial)
 *   - Global region alignment (how major world regions compare)
 *   - Peer laws from the Codex with similar FOR%
 *   - Cross-category laws for wider perspective
 *   - Category stats (average consensus in this domain)
 *
 * Distinct from:
 *   /law/[id]/parallels  — similar laws in Lobby by keyword
 *   /law/[id]/similar    — related Codex entries
 *   /law/[id]/synthesis  — AI synthesis of positions
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Check,
  ChevronRight,
  ExternalLink,
  Gavel,
  Globe,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  GlobalResponse,
  GlobalAlignedLaw,
  GlobalPeerLaw,
} from '@/app/api/laws/[id]/global/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (y >= 1) return `${y}y ago`
  if (m >= 1) return `${m}mo ago`
  if (d >= 1) return `${d}d ago`
  return 'today'
}

const STANCE_CONFIG = {
  'strongly-for': {
    icon: TrendingUp,
    label: 'Strongly Aligned',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    barColor: 'bg-for-500',
    barWidth: 90,
  },
  'for': {
    icon: Check,
    label: 'Generally Aligned',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
    barColor: 'bg-emerald',
    barWidth: 70,
  },
  'mixed': {
    icon: Minus,
    label: 'Divided',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    barColor: 'bg-gold',
    barWidth: 45,
  },
  'against': {
    icon: TrendingDown,
    label: 'Not Aligned',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/20',
    barColor: 'bg-against-500',
    barWidth: 25,
  },
  'strongly-against': {
    icon: X,
    label: 'Strongly Opposed',
    color: 'text-against-300',
    bg: 'bg-against-600/15',
    border: 'border-against-600/30',
    barColor: 'bg-against-600',
    barWidth: 10,
  },
}

function alignmentLabel(score: number): { label: string; color: string; icon: typeof Globe } {
  if (score >= 75) return { label: 'Strong global alignment', color: 'text-for-400', icon: Globe }
  if (score >= 55) return { label: 'Moderate global alignment', color: 'text-emerald', icon: Globe }
  if (score >= 40) return { label: 'Mixed global alignment', color: 'text-gold', icon: Globe }
  return { label: 'Diverges from global norms', color: 'text-against-400', icon: Globe }
}

// ─── Spectrum Dial ────────────────────────────────────────────────────────────

function SpectrumDial({
  position,
  leftLabel,
  rightLabel,
  label,
}: {
  position: number
  leftLabel: string
  rightLabel: string
  label: string
}) {
  const clipped = Math.max(0, Math.min(100, position))

  return (
    <div className="space-y-3">
      <div className="relative h-4 rounded-full overflow-hidden bg-gradient-to-r from-for-600 via-surface-300 to-against-600">
        {/* Marker */}
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${clipped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }}
          className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-lg transform -translate-x-1/2"
          style={{ boxShadow: '0 0 6px rgba(255,255,255,0.8)' }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-for-400 font-mono">{leftLabel}</span>
        <span className="text-xs font-bold text-white">{label}</span>
        <span className="text-[10px] text-against-400 font-mono">{rightLabel}</span>
      </div>
    </div>
  )
}

// ─── Global Region Row ────────────────────────────────────────────────────────

function RegionRow({
  region,
  stance,
  note,
  index,
}: {
  region: string
  stance: keyof typeof STANCE_CONFIG
  note: string
  index: number
}) {
  const cfg = STANCE_CONFIG[stance]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn('rounded-xl border p-3', cfg.border, cfg.bg)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5 h-6 w-6 rounded-full flex items-center justify-center border', cfg.border, cfg.bg)}>
          <Icon className={cn('h-3 w-3', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">{region}</span>
            <span className={cn('text-[10px] font-mono', cfg.color)}>{cfg.label}</span>
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5 leading-relaxed">{note}</p>
          {/* Mini alignment bar */}
          <div className="mt-2 h-1 w-full rounded-full bg-surface-200/60 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', cfg.barColor)}
              style={{ width: `${cfg.barWidth}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Peer Law Card ────────────────────────────────────────────────────────────

function PeerLawCard({ law, index }: { law: GlobalPeerLaw; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      <Link
        href={`/law/${law.id}`}
        className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-for-500/40 hover:bg-for-500/5 transition-all group"
      >
        <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
          <Gavel className="h-3 w-3 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {law.category && (
              <Badge variant="outline" className="text-[10px] py-0">{law.category}</Badge>
            )}
            <span className="text-[10px] font-mono text-for-400">{Math.round(law.blue_pct)}% FOR</span>
            <span className="text-[10px] text-surface-600">{fmtNum(law.total_votes)} votes</span>
            <span className="text-[10px] text-surface-600">{relTime(law.established_at)}</span>
          </div>
          {law.shared_keywords.length > 0 && (
            <p className="text-[10px] text-surface-600 mt-1 italic">
              Shared: {law.shared_keywords.slice(0, 3).join(', ')}
            </p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </Link>
    </motion.div>
  )
}

// ─── Cross-category Law Card ──────────────────────────────────────────────────

function CrossCatLawCard({ law, index }: { law: GlobalAlignedLaw; index: number }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const isHighCons = forPct >= 67

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link
        href={`/law/${law.id}`}
        className="flex items-start gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-all group"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white leading-snug line-clamp-1 group-hover:text-for-300 transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {law.category && (
              <span className="text-[10px] text-purple font-semibold">{law.category}</span>
            )}
            <span className={cn('text-[10px] font-mono', isHighCons ? 'text-for-400' : 'text-surface-400')}>
              {forPct}%
            </span>
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300/60 p-3">
            <Skeleton className="h-7 w-16 mb-1 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200/40 border border-surface-300/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20 ml-auto" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function GlobalClient({ lawId }: { lawId: string }) {
  const params = useParams<{ id: string }>()
  const id = lawId ?? params.id

  const [data, setData] = useState<GlobalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/global`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load global context')
      const json: GlobalResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const alignment = data ? alignmentLabel(data.global_alignment_score) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back link ──────────────────────────────────────────────── */}
        <Link
          href={`/law/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Law
        </Link>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Globe className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">International Context</h1>
              <p className="text-xs text-surface-500">How this consensus compares globally</p>
            </div>
          </div>

          {data && (
            <div className="mt-4 p-4 rounded-xl bg-surface-100 border border-surface-300/60">
              <div className="flex items-start gap-3">
                <Gavel className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium leading-snug line-clamp-2">
                    {data.law_statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {data.law_category && (
                      <Badge variant="outline" className="text-[10px]">{data.law_category}</Badge>
                    )}
                    <span className="text-[10px] font-mono text-for-400">{Math.round(data.law_blue_pct)}% FOR</span>
                    <span className="text-[10px] text-surface-500 font-mono">
                      {fmtNum(data.law_total_votes)} votes
                    </span>
                    <span className="text-[10px] text-surface-500">
                      established {relTime(data.law_established_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-surface-500" />
            <span className="text-sm text-surface-500">
              {loading ? 'Loading...' : 'Global context analysis'}
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={AlertTriangle}
            iconColor="text-against-400"
            title="Could not load global context"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-4">

            {/* ── Stats strip ───────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Global Alignment',
                  value: `${data.global_alignment_score}%`,
                  sub: alignment?.label ?? '',
                  color: alignment?.color ?? 'text-surface-400',
                },
                {
                  label: 'Spectrum Position',
                  value: data.spectrum_label,
                  sub: data.spectrum_profile?.axis ?? 'civic axis',
                  color: 'text-purple',
                  small: true,
                },
                {
                  label: 'Codex Peers',
                  value: data.peer_laws.length > 0 ? data.peer_laws.length : '—',
                  sub: `${data.law_category ?? ''} laws ~${Math.round(data.law_blue_pct)}%`,
                  color: 'text-white',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center"
                >
                  <p className={cn('font-bold leading-tight', stat.small ? 'text-xs' : 'text-lg', stat.color)}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] font-medium text-white mt-0.5">{stat.label}</p>
                  <p className="text-[10px] text-surface-500 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Political Spectrum ──────────────────────────────────── */}
            {data.spectrum_profile && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="h-4 w-4 text-purple" />
                  <h3 className="text-sm font-bold text-white">Political Spectrum</h3>
                </div>

                <SpectrumDial
                  position={data.spectrum_position}
                  leftLabel={data.spectrum_profile.left_label}
                  rightLabel={data.spectrum_profile.right_label}
                  label={data.spectrum_label}
                />

                <p className="text-xs text-surface-500 mt-3 leading-relaxed">
                  {data.spectrum_profile.description}. This law achieved{' '}
                  <span className="text-for-400 font-semibold">{Math.round(data.law_blue_pct)}% FOR</span>{' '}
                  — placing it in the <span className="text-purple font-semibold">{data.spectrum_label}</span> range
                  on the {data.spectrum_profile.axis} axis.
                </p>
              </motion.div>
            )}

            {/* ── Category context ───────────────────────────────────── */}
            {data.law_category && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-bold text-white">
                    {data.law_category} Category Context
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface-200/40 border border-surface-300/40 p-3 text-center">
                    <p className="text-lg font-bold text-white">{data.category_law_count}</p>
                    <p className="text-[10px] text-surface-500">{data.law_category} laws in Codex</p>
                  </div>
                  <div className="rounded-xl bg-surface-200/40 border border-surface-300/40 p-3 text-center">
                    <p className="text-lg font-bold text-for-400">{data.category_avg_blue_pct}%</p>
                    <p className="text-[10px] text-surface-500">avg FOR in this category</p>
                  </div>
                </div>

                {data.category_highest_vote && (
                  <div className="mt-3 pt-3 border-t border-surface-300/40">
                    <p className="text-[10px] text-surface-500 mb-1.5">Most-voted {data.law_category} law:</p>
                    <Link
                      href={`/law/${data.category_highest_vote.id}`}
                      className="flex items-center gap-2 group"
                    >
                      <p className="text-xs text-white line-clamp-1 flex-1 group-hover:text-for-300 transition-colors">
                        {data.category_highest_vote.statement}
                      </p>
                      <span className="text-[10px] text-surface-500 flex-shrink-0">
                        {fmtNum(data.category_highest_vote.total_votes)} votes
                      </span>
                    </Link>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Global Region Alignment ─────────────────────────────── */}
            {data.global_context.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-4 w-4 text-purple" />
                  <h3 className="text-sm font-bold text-white">Global Region Alignment</h3>
                </div>
                <p className="text-xs text-surface-500 mb-4 leading-relaxed">
                  How major world regions compare on {data.law_category ?? 'this'} policy — showing
                  whether real-world political positions align with Lobby Market&apos;s community consensus.
                </p>
                <div className="space-y-2">
                  {data.global_context.map((ctx, i) => (
                    <RegionRow
                      key={ctx.region}
                      region={ctx.region}
                      stance={ctx.stance}
                      note={ctx.note}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Peer Laws ──────────────────────────────────────────── */}
            {data.peer_laws.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Gavel className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-bold text-white">Comparable Codex Laws</h3>
                  <span className="text-[10px] font-mono text-surface-500 bg-surface-200/60 border border-surface-300/40 px-1.5 py-0.5 rounded-full ml-auto">
                    {data.peer_laws.length} peers
                  </span>
                </div>
                <p className="text-xs text-surface-500 mb-3 leading-relaxed">
                  Laws in the same category with a similar FOR% (±15 points) — your peers in the Codex.
                </p>
                <div className="space-y-2">
                  {data.peer_laws.map((law, i) => (
                    <PeerLawCard key={law.id} law={law} index={i} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Cross-Category Laws ─────────────────────────────────── */}
            {data.cross_category_laws.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-emerald" />
                  <h3 className="text-sm font-bold text-white">Cross-Category Perspective</h3>
                </div>
                <p className="text-xs text-surface-500 mb-3 leading-relaxed">
                  Top laws from other civic domains — providing wider context for how this law
                  sits within the full breadth of established Lobby consensus.
                </p>
                <div className="space-y-1.5">
                  {data.cross_category_laws.map((law, i) => (
                    <CrossCatLawCard key={law.id} law={law} index={i} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Alignment note ──────────────────────────────────────── */}
            <div className="p-4 rounded-xl bg-purple/5 border border-purple/20">
              <div className="flex items-start gap-3">
                <Globe className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    <span className="text-purple font-semibold">Global alignment score {data.global_alignment_score}%</span>
                    {' '}— This score compares Lobby Market&apos;s community FOR% ({Math.round(data.law_blue_pct)}%) against
                    typical international policy stances in the <span className="text-white">{data.law_category ?? 'civic'}</span>{' '}
                    domain. A higher score means the platform&apos;s consensus mirrors real-world global norms.
                    This is a reference analysis, not a political endorsement.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Related links ────────────────────────────────────────── */}
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                { label: 'Similar Laws', href: `/law/${id}/similar`, desc: 'Related Codex entries' },
                { label: 'Parallels', href: `/law/${id}/parallels`, desc: 'Laws that build on this' },
                { label: 'Law Synthesis', href: `/law/${id}/synthesis`, desc: 'AI analysis of positions' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-medium text-white group-hover:text-purple transition-colors">
                      {link.label}
                    </p>
                    <p className="text-[10px] text-surface-500">{link.desc}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-purple transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
