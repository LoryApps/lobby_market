'use client'

/**
 * /motions — The Civic Motions Board
 *
 * A unified legislative floor tracker showing every formal civic action
 * currently in progress on the platform:
 *
 *   Citizens' Assemblies  — sortition-based deliberative bodies
 *   Grand Council Motions — meritocratic governance resolutions
 *   Civic Petitions       — citizen-initiated escalation requests
 *   Civic Referendums     — direct-democracy community votes
 *   Civic Vetoes          — democratic challenges to established laws
 *
 * Distinct from:
 *   /assembly       — single assembly focus (joining, deliberating)
 *   /grand-council  — council membership + motion voting
 *   /petitions      — petition listing + signing
 *   /civic-referendums — referendum detail + voting
 *   /civic-veto     — individual veto challenge pages
 *
 * The Motions Board is the "Hansard" of the platform — a live parliamentary
 * record of everything formally in motion right now.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  FileText,
  Gavel,
  GitBranch,
  RefreshCw,
  Scale,
  Scroll,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  MotionsResponse,
  MotionAssembly,
  MotionCouncil,
  MotionPetition,
  MotionReferendum,
  MotionVeto,
  MotionStats,
} from '@/app/api/motions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (d > 1) return `${d}d left`
  if (d === 1) return `1d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function progressPct(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  color,
  subtitle,
}: {
  icon: typeof Scale
  title: string
  count: number
  color: string
  subtitle: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', color)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="font-mono text-base font-bold text-white">{title}</h2>
          <p className="text-xs font-mono text-surface-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <span className={cn('flex-shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded-full border', color)}>
        {count} active
      </span>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  color,
  href,
}: {
  icon: typeof Scale
  label: string
  value: number
  color: string
  href: string
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="group rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 hover:border-surface-400/60 transition-all"
      >
        <Icon className={cn('h-4 w-4 mb-2', color)} />
        <p className="text-xl font-mono font-bold text-white tabular-nums">{value}</p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5 leading-tight">{label}</p>
      </motion.div>
    </Link>
  )
}

// ─── Assembly card ────────────────────────────────────────────────────────────

function AssemblyCard({ a }: { a: MotionAssembly }) {
  const isDeliberating = a.status === 'deliberating'

  return (
    <Link href="/assembly">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="group rounded-2xl bg-surface-100 border border-surface-300/80 hover:border-purple/40 p-4 transition-all"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-purple transition-colors flex-1">
            {a.title}
          </p>
          <span
            className={cn(
              'flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
              isDeliberating
                ? 'text-gold border-gold/30 bg-gold/10'
                : 'text-emerald border-emerald/30 bg-emerald/10',
            )}
          >
            {isDeliberating ? 'Deliberating' : 'Forming'}
          </span>
        </div>

        <p className="text-xs text-surface-500 line-clamp-2 mb-3">{a.question}</p>

        {a.topic_statement && (
          <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-surface-200/60 border border-surface-300/60">
            <Scale className="h-3 w-3 text-for-400 flex-shrink-0" />
            <span className="text-[11px] font-mono text-surface-400 line-clamp-1">
              {a.topic_statement}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              <span>{a.max_members} seats</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <GitBranch className="h-3 w-3" />
              <span>{a.deliberation_rounds} rounds</span>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-purple transition-colors" />
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Council motion card ──────────────────────────────────────────────────────

const EFFECT_CONFIG = {
  elevate_topic: {
    label: 'Elevate Topic',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Star,
  },
  issue_statement: {
    label: 'Issue Statement',
    color: 'text-for-300',
    bg: 'bg-for-600/10',
    border: 'border-for-500/30',
    icon: FileText,
  },
  call_assembly: {
    label: 'Call Assembly',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Users,
  },
}

function CouncilMotionCard({ m }: { m: MotionCouncil }) {
  const cfg = EFFECT_CONFIG[m.effect]
  const EffectIcon = cfg.icon
  const totalVotes = m.votes_for + m.votes_against
  const forPct = totalVotes > 0 ? Math.round((m.votes_for / totalVotes) * 100) : 0

  return (
    <Link href="/grand-council">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="group rounded-2xl bg-surface-100 border border-surface-300/80 hover:border-gold/40 p-4 transition-all"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors flex-1">
            {m.title}
          </p>
          <span
            className={cn(
              'flex-shrink-0 flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
              cfg.color,
              cfg.bg,
              cfg.border,
            )}
          >
            <EffectIcon className="h-2.5 w-2.5" />
            {cfg.label}
          </span>
        </div>

        <p className="text-xs text-surface-500 line-clamp-2 mb-3">{m.description}</p>

        {m.topic_statement && (
          <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-surface-200/60 border border-surface-300/60">
            <Scale className="h-3 w-3 text-for-400 flex-shrink-0" />
            <span className="text-[11px] font-mono text-surface-400 line-clamp-1">
              {m.topic_statement}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-1.5 flex-1 mr-4">
            {totalVotes > 0 && (
              <>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-for-400">{m.votes_for} FOR</span>
                  <span className="text-against-400">{m.votes_against} AGAINST</span>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden bg-against-600/40">
                  <div
                    className="h-full bg-for-500 rounded-full transition-all"
                    style={{ width: `${forPct}%` }}
                  />
                </div>
              </>
            )}
            {totalVotes === 0 && (
              <span className="text-[11px] font-mono text-surface-500">Awaiting votes</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
            <Clock className="h-3 w-3" />
            <span>{timeLeft(m.closes_at)}</span>
          </div>
        </div>

        {m.proposer_username && (
          <p className="mt-2 text-[10px] font-mono text-surface-500">
            Proposed by <span className="text-surface-400">@{m.proposer_username}</span>
          </p>
        )}
      </motion.div>
    </Link>
  )
}

// ─── Petition card ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  hearing: { label: 'Hearing', color: 'text-for-300', bg: 'bg-for-600/10', border: 'border-for-500/30' },
  referendum: { label: 'Referendum', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  assembly: { label: 'Assembly', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  review: { label: 'Review', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/25' },
}

function PetitionCard({ p }: { p: MotionPetition }) {
  const cfg = ACTION_CONFIG[p.action_type] ?? ACTION_CONFIG.hearing
  const pct = progressPct(p.signature_count, p.target_signatures)

  return (
    <Link href="/petitions">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="group rounded-2xl bg-surface-100 border border-surface-300/80 hover:border-for-500/40 p-4 transition-all"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors flex-1">
            {p.title}
          </p>
          <span
            className={cn(
              'flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
              cfg.color,
              cfg.bg,
              cfg.border,
            )}
          >
            → {cfg.label}
          </span>
        </div>

        <p className="text-xs text-surface-500 line-clamp-2 mb-3">{p.description}</p>

        {p.topic_statement && (
          <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-surface-200/60 border border-surface-300/60">
            <Scale className="h-3 w-3 text-for-400 flex-shrink-0" />
            <span className="text-[11px] font-mono text-surface-400 line-clamp-1">
              {p.topic_statement}
            </span>
          </div>
        )}

        <div className="space-y-1.5 mb-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-white font-bold">
              {p.signature_count.toLocaleString()} / {p.target_signatures.toLocaleString()} signatures
            </span>
            <span className="text-surface-500">{pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-surface-300">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                pct >= 75 ? 'bg-emerald' : pct >= 40 ? 'bg-for-500' : 'bg-for-600',
              )}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-surface-500">{p.committee}</span>
          <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Clock className="h-3 w-3" />
            <span>{timeLeft(p.closes_at)}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Referendum card ──────────────────────────────────────────────────────────

const REF_CATEGORY_COLORS: Record<string, string> = {
  governance: 'text-gold',
  features: 'text-purple',
  community: 'text-emerald',
  policy: 'text-for-400',
  other: 'text-surface-500',
}

function ReferendumCard({ r }: { r: MotionReferendum }) {
  const totalVotes = r.for_votes + r.against_votes
  const forPct = totalVotes > 0 ? Math.round((r.for_votes / totalVotes) * 100) : 50
  const quorumPct = progressPct(totalVotes, r.quorum_required)
  const catColor = REF_CATEGORY_COLORS[r.category] ?? 'text-surface-500'

  return (
    <Link href="/civic-referendums">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="group rounded-2xl bg-surface-100 border border-surface-300/80 hover:border-gold/40 p-4 transition-all"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors flex-1">
            {r.question}
          </p>
          <span className={cn('flex-shrink-0 text-[10px] font-mono font-bold capitalize', catColor)}>
            {r.category}
          </span>
        </div>

        {r.description && (
          <p className="text-xs text-surface-500 line-clamp-2 mb-3">{r.description}</p>
        )}

        {totalVotes > 0 ? (
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-for-400 font-bold">{forPct}% For</span>
              <span className="text-against-400 font-bold">{100 - forPct}% Against</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-against-600/40">
              <div
                className="h-full bg-for-500 rounded-full transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5 mb-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-surface-400">
              {totalVotes} / {r.quorum_required} quorum
            </span>
            <span className="text-surface-500">{quorumPct}%</span>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden bg-surface-300">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${quorumPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gold rounded-full"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <ThumbsUp className="h-3 w-3 text-for-400" />
            <span className="text-for-400">{r.for_votes}</span>
            <ThumbsDown className="h-3 w-3 text-against-400" />
            <span className="text-against-400">{r.against_votes}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Clock className="h-3 w-3" />
            <span>{timeLeft(r.closes_at)}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Veto card ────────────────────────────────────────────────────────────────

const GROUNDS_CONFIG: Record<string, { label: string; color: string }> = {
  unconstitutional: { label: 'Unconstitutional', color: 'text-against-400' },
  ineffective: { label: 'Ineffective', color: 'text-gold' },
  harmful: { label: 'Harmful', color: 'text-against-300' },
  outdated: { label: 'Outdated', color: 'text-surface-400' },
  procedural: { label: 'Procedural', color: 'text-for-300' },
}

function VetoCard({ v }: { v: MotionVeto }) {
  const grounds = GROUNDS_CONFIG[v.grounds_type] ?? { label: v.grounds_type, color: 'text-surface-400' }
  const pct = progressPct(v.signature_count, v.target_signatures)

  return (
    <Link href="/civic-veto">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="group rounded-2xl bg-surface-100 border border-surface-300/80 hover:border-against-500/40 p-4 transition-all"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-against-300 transition-colors flex-1">
            {v.title}
          </p>
          <span className={cn('flex-shrink-0 text-[10px] font-mono font-bold', grounds.color)}>
            {grounds.label}
          </span>
        </div>

        {v.law_statement && (
          <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-against-500/5 border border-against-500/20">
            <Gavel className="h-3 w-3 text-gold flex-shrink-0" />
            <span className="text-[11px] font-mono text-surface-400 line-clamp-1">
              Law: {v.law_statement}
            </span>
          </div>
        )}

        <p className="text-xs text-surface-500 line-clamp-2 mb-3">{v.grounds}</p>

        <div className="space-y-1.5 mb-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-white font-bold">
              {v.signature_count.toLocaleString()} / {v.target_signatures.toLocaleString()} signatures
            </span>
            <span className="text-surface-500">{pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-surface-300">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                pct >= 75 ? 'bg-against-400' : pct >= 40 ? 'bg-against-500' : 'bg-against-600',
              )}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-surface-500">
            Needs {(v.target_signatures - v.signature_count).toLocaleString()} more
          </span>
          <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Clock className="h-3 w-3" />
            <span>{timeLeft(v.closes_at)}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'all' | 'assemblies' | 'council' | 'petitions' | 'referendums' | 'vetoes'

const TABS: { id: Tab; label: string; icon: typeof Scale }[] = [
  { id: 'all', label: 'All', icon: BarChart2 },
  { id: 'assemblies', label: 'Assemblies', icon: Users },
  { id: 'council', label: 'Council', icon: Crown },
  { id: 'petitions', label: 'Petitions', icon: Scroll },
  { id: 'referendums', label: 'Referendums', icon: Vote },
  { id: 'vetoes', label: 'Vetoes', icon: Shield },
]

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MotionSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 flex-1 rounded" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-3/4 rounded" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MotionsClient() {
  const [data, setData] = useState<MotionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/motions', { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as MotionsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load motions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats: MotionStats = data?.stats ?? {
    total_active: 0,
    assemblies_active: 0,
    council_active: 0,
    petitions_active: 0,
    referendums_active: 0,
    vetoes_active: 0,
  }

  const isEmpty =
    !loading &&
    !error &&
    data &&
    stats.total_active === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Scale className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Motions</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The Lobby&apos;s active legislative floor
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh motions"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 disabled:opacity-40 transition-all"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Stats bar ── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6"
          >
            <StatTile icon={Users} label="Assemblies" value={stats.assemblies_active} color="text-purple" href="/assembly" />
            <StatTile icon={Crown} label="Council" value={stats.council_active} color="text-gold" href="/grand-council" />
            <StatTile icon={Scroll} label="Petitions" value={stats.petitions_active} color="text-for-400" href="/petitions" />
            <StatTile icon={Vote} label="Referendums" value={stats.referendums_active} color="text-emerald" href="/civic-referendums" />
            <StatTile icon={Shield} label="Vetoes" value={stats.vetoes_active} color="text-against-400" href="/civic-veto" />
            <StatTile icon={Zap} label="Total" value={stats.total_active} color="text-surface-400" href="/motions" />
          </motion.div>
        )}

        {/* ── Context banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-5 p-3 rounded-xl bg-for-500/5 border border-for-500/20"
        >
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            <span className="text-for-300 font-bold">Civic Motions</span> are formal democratic actions
            with defined procedures, deadlines, and outcomes. Unlike informal topic votes, each motion
            follows a structured process — and your participation matters.
          </p>
        </motion.div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
          {TABS.map((t) => {
            const Icon = t.icon
            const count =
              t.id === 'all' ? stats.total_active
              : t.id === 'assemblies' ? stats.assemblies_active
              : t.id === 'council' ? stats.council_active
              : t.id === 'petitions' ? stats.petitions_active
              : t.id === 'referendums' ? stats.referendums_active
              : t.id === 'vetoes' ? stats.vetoes_active
              : 0
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border',
                  tab === t.id
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400/60',
                )}
              >
                <Icon className="h-3 w-3" />
                {t.label}
                {!loading && (
                  <span className={cn(
                    'ml-0.5 text-[10px] px-1 py-0.5 rounded-full',
                    tab === t.id ? 'bg-for-500/30 text-for-300' : 'bg-surface-300/60 text-surface-500',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-against-500/10 border border-against-500/30 mb-6">
            <XCircle className="h-5 w-5 text-against-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-mono text-against-300">Failed to load motions</p>
              <button
                onClick={() => load()}
                className="text-xs font-mono text-surface-400 hover:text-white mt-1 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <MotionSkeleton key={i} />)}
          </div>
        )}

        {/* ── Empty state ── */}
        {isEmpty && (
          <EmptyState
            icon={CheckCircle2}
            title="No active motions"
            description="The Lobby's civic floor is clear. All motions have been resolved or none have been filed yet."
            action={{ label: 'Browse civic actions', href: '/assembly' }}
          />
        )}

        {/* ── Content ── */}
        {!loading && !error && data && !isEmpty && (
          <div className="space-y-8">

            {/* Citizens' Assemblies */}
            <AnimatePresence>
              {(tab === 'all' || tab === 'assemblies') && data.assemblies.length > 0 && (
                <motion.section
                  key="assemblies"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SectionHeader
                    icon={Users}
                    title="Citizens' Assemblies"
                    count={stats.assemblies_active}
                    color="text-purple bg-purple/10 border-purple/30"
                    subtitle="Sortition-based deliberative bodies"
                  />
                  <div className="space-y-3">
                    {data.assemblies.map((a) => (
                      <AssemblyCard key={a.id} a={a} />
                    ))}
                  </div>
                  {tab === 'all' && (
                    <Link
                      href="/assembly"
                      className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                    >
                      View all assemblies <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Grand Council Motions */}
            <AnimatePresence>
              {(tab === 'all' || tab === 'council') && data.council_motions.length > 0 && (
                <motion.section
                  key="council"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SectionHeader
                    icon={Crown}
                    title="Grand Council Motions"
                    count={stats.council_active}
                    color="text-gold bg-gold/10 border-gold/30"
                    subtitle="Meritocratic governance resolutions"
                  />
                  <div className="space-y-3">
                    {data.council_motions.map((m) => (
                      <CouncilMotionCard key={m.id} m={m} />
                    ))}
                  </div>
                  {tab === 'all' && (
                    <Link
                      href="/grand-council"
                      className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                    >
                      Open Grand Council <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Civic Petitions */}
            <AnimatePresence>
              {(tab === 'all' || tab === 'petitions') && data.petitions.length > 0 && (
                <motion.section
                  key="petitions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SectionHeader
                    icon={Scroll}
                    title="Civic Petitions"
                    count={stats.petitions_active}
                    color="text-for-300 bg-for-600/10 border-for-500/30"
                    subtitle="Citizen-initiated escalation requests"
                  />
                  <div className="space-y-3">
                    {data.petitions.map((p) => (
                      <PetitionCard key={p.id} p={p} />
                    ))}
                  </div>
                  {tab === 'all' && (
                    <Link
                      href="/petitions"
                      className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                    >
                      All petitions <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Civic Referendums */}
            <AnimatePresence>
              {(tab === 'all' || tab === 'referendums') && data.referendums.length > 0 && (
                <motion.section
                  key="referendums"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SectionHeader
                    icon={Vote}
                    title="Civic Referendums"
                    count={stats.referendums_active}
                    color="text-emerald bg-emerald/10 border-emerald/25"
                    subtitle="Direct-democracy community votes"
                  />
                  <div className="space-y-3">
                    {data.referendums.map((r) => (
                      <ReferendumCard key={r.id} r={r} />
                    ))}
                  </div>
                  {tab === 'all' && (
                    <Link
                      href="/civic-referendums"
                      className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                    >
                      All referendums <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Civic Vetoes */}
            <AnimatePresence>
              {(tab === 'all' || tab === 'vetoes') && data.vetoes.length > 0 && (
                <motion.section
                  key="vetoes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SectionHeader
                    icon={Shield}
                    title="Civic Vetoes"
                    count={stats.vetoes_active}
                    color="text-against-400 bg-against-500/10 border-against-500/30"
                    subtitle="Democratic challenges to established laws"
                  />
                  <div className="space-y-3">
                    {data.vetoes.map((v) => (
                      <VetoCard key={v.id} v={v} />
                    ))}
                  </div>
                  {tab === 'all' && (
                    <Link
                      href="/civic-veto"
                      className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                    >
                      All veto challenges <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Empty tab state */}
            {tab !== 'all' && (
              (() => {
                const isEmpty =
                  (tab === 'assemblies' && data.assemblies.length === 0) ||
                  (tab === 'council' && data.council_motions.length === 0) ||
                  (tab === 'petitions' && data.petitions.length === 0) ||
                  (tab === 'referendums' && data.referendums.length === 0) ||
                  (tab === 'vetoes' && data.vetoes.length === 0)
                if (!isEmpty) return null
                return (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No active motions in this category"
                    description="Check back later or explore other types of civic action."
                    action={{ label: 'View all motions', href: '/motions' }}
                  />
                )
              })()
            )}
          </div>
        )}

        {/* ── Footer links ── */}
        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 pt-6 border-t border-surface-300/60"
          >
            <p className="text-xs font-mono text-surface-500 mb-3 text-center">More civic mechanisms</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { href: '/hearings', label: 'Hearings', icon: FileText },
                { href: '/tribunal', label: 'Tribunal', icon: Scale },
                { href: '/elections', label: 'Elections', icon: Vote },
                { href: '/senate', label: 'Senate', icon: Crown },
                { href: '/council', label: 'Council', icon: Users },
                { href: '/appeals', label: 'Appeals', icon: Gavel },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400/60 transition-all"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-40" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
