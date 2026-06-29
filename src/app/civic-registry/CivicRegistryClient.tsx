'use client'

/**
 * /civic-registry — The Civic Registry
 *
 * A unified live dashboard showing the current state of every civic
 * institution on the platform:
 *   - Citizens' Assemblies in session
 *   - Open committee hearings
 *   - Ombudsman cases under review
 *   - Pending appeals before the panel
 *   - Grand Council motions open for vote
 *   - Civic petitions gathering signatures
 *
 * Distinct from:
 *   /assembly   — manage / join a specific assembly
 *   /hearings   — submit testimony to a hearing
 *   /ombudsman  — file or view ombudsman cases
 *   /appeals    — file or view appeals
 *   /grand-council — vote on council motions
 *   /petitions  — sign civic petitions
 *
 * The Registry is the institutional overview — a bird's-eye view of ALL
 * active civic processes, surfacing what demands citizen attention right now.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Landmark,
  Mic2,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RegistryResponse,
  RegistryAssembly,
  RegistryHearing,
  RegistryOmbudsmanCase,
  RegistryAppeal,
  RegistryMotion,
  RegistryPetition,
} from '@/app/api/registry/route'

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

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return '<1h left'
  if (h < 24) return `${h}h left`
  if (d < 7) return `${d}d left`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  iconBorder,
  title,
  count,
  href,
  description,
  expanded,
  onToggle,
}: {
  icon: typeof Landmark
  iconColor: string
  iconBg: string
  iconBorder: string
  title: string
  count: number
  href: string
  description: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
          iconBg, iconBorder
        )}
      >
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-mono text-base font-bold text-white">{title}</h2>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold',
              count > 0
                ? 'bg-for-500/20 text-for-400 border border-for-500/30'
                : 'bg-surface-300/50 text-surface-500 border border-surface-400/30'
            )}
          >
            {count} active
          </span>
        </div>
        <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={href}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold',
            'border border-surface-400/40 bg-surface-200/40 text-surface-500',
            'hover:text-white hover:border-surface-400 transition-all'
          )}
        >
          View all
          <ExternalLink className="h-3 w-3" />
        </Link>
        {count > 0 && (
          <button
            onClick={onToggle}
            aria-label={expanded ? 'Collapse section' : 'Expand section'}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-400/40 bg-surface-200/40 text-surface-500 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Assembly card ─────────────────────────────────────────────────────────────

function AssemblyCard({ assembly }: { assembly: RegistryAssembly }) {
  const statusCfg = {
    forming:      { color: 'text-gold',     bg: 'bg-gold/10',     border: 'border-gold/30',     label: 'Forming' },
    deliberating: { color: 'text-for-400',  bg: 'bg-for-500/10',  border: 'border-for-500/30',  label: 'Deliberating' },
    concluded:    { color: 'text-emerald',  bg: 'bg-emerald/10',  border: 'border-emerald/30',  label: 'Concluded' },
  }[assembly.status]

  return (
    <Link
      href={`/assembly`}
      className="block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors line-clamp-1">
          {assembly.title}
        </h3>
        <span
          className={cn(
            'flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
            statusCfg.bg, statusCfg.border, statusCfg.color
          )}
        >
          {statusCfg.label}
        </span>
      </div>
      <p className="text-xs font-mono text-surface-500 leading-relaxed line-clamp-2 mb-3">
        {assembly.question}
      </p>
      {assembly.topic_statement && (
        <div className="text-[11px] font-mono text-surface-600 line-clamp-1 mb-2">
          Re: {assembly.topic_statement}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-600">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{assembly.member_count}/{assembly.max_members} members</span>
        </div>
        <span>{relativeTime(assembly.created_at)}</span>
      </div>
    </Link>
  )
}

// ─── Hearing card ──────────────────────────────────────────────────────────────

function HearingCard({ hearing }: { hearing: RegistryHearing }) {
  const recCfg: Record<string, { color: string; label: string; icon: typeof CheckCircle2 }> = {
    for:     { color: 'text-for-400',      label: 'Recommends: For',     icon: ThumbsUp },
    against: { color: 'text-against-400',  label: 'Recommends: Against', icon: ThumbsDown },
    hold:    { color: 'text-gold',          label: 'Recommends: Hold',    icon: Clock },
    neutral: { color: 'text-surface-500',   label: 'Neutral',             icon: Scale },
  }
  const rec = hearing.recommendation ? recCfg[hearing.recommendation] : null

  return (
    <Link
      href={`/hearings/${hearing.id}`}
      className="block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors line-clamp-1">
          {hearing.title}
        </h3>
        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-emerald/30 bg-emerald/10 text-emerald">
          Open
        </span>
      </div>
      <p className="text-[11px] font-mono text-surface-600 mb-2">
        Committee: {hearing.committee}
      </p>
      {hearing.topic_statement && (
        <div className="text-[11px] font-mono text-surface-600 line-clamp-1 mb-2">
          Re: {hearing.topic_statement}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-600">
        <div className="flex items-center gap-2">
          {rec && (
            <span className={cn('flex items-center gap-1', rec.color)}>
              <rec.icon className="h-3 w-3" />
              {rec.label}
            </span>
          )}
          {!rec && (
            <span className="flex items-center gap-1">
              <Mic2 className="h-3 w-3" />
              {hearing.testimony_count} testimonies
            </span>
          )}
        </div>
        <span>{relativeTime(hearing.created_at)}</span>
      </div>
    </Link>
  )
}

// ─── Ombudsman case card ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  process_fairness: 'Process Fairness',
  decision_appeal:  'Decision Appeal',
  bias_report:      'Bias Report',
  norm_breach:      'Norm Breach',
  transparency:     'Transparency',
  other:            'Other',
}

const STATUS_CFG_OMBUDSMAN: Record<string, { color: string; label: string }> = {
  open:         { color: 'text-for-400',   label: 'Open' },
  under_review: { color: 'text-gold',       label: 'Under Review' },
  upheld:       { color: 'text-emerald',    label: 'Upheld' },
  dismissed:    { color: 'text-surface-500', label: 'Dismissed' },
  referred:     { color: 'text-purple',     label: 'Referred' },
  withdrawn:    { color: 'text-surface-500', label: 'Withdrawn' },
}

function OmbudsmanCard({ case: c }: { case: RegistryOmbudsmanCase }) {
  const statusCfg = STATUS_CFG_OMBUDSMAN[c.status] ?? { color: 'text-surface-500', label: c.status }

  return (
    <Link
      href={`/ombudsman`}
      className="block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0 text-[10px] font-mono font-bold text-surface-500">{c.case_number}</span>
          <h3 className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors line-clamp-1">
            {c.title}
          </h3>
        </div>
        <span className={cn('flex-shrink-0 text-[10px] font-mono font-bold', statusCfg.color)}>
          {statusCfg.label}
        </span>
      </div>
      <p className="text-[11px] font-mono text-surface-600 mb-2">
        {CATEGORY_LABELS[c.category] ?? c.category}
      </p>
      {c.topic_statement && (
        <div className="text-[11px] font-mono text-surface-600 line-clamp-1 mb-2">
          Re: {c.topic_statement}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-600">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" />
          {c.support_count} supporters
        </span>
        <span>{relativeTime(c.created_at)}</span>
      </div>
    </Link>
  )
}

// ─── Appeal card ──────────────────────────────────────────────────────────────

const GROUNDS_LABELS: Record<string, string> = {
  procedural_error: 'Procedural Error',
  new_evidence:     'New Evidence',
  bias:             'Bias',
  disproportionate: 'Disproportionate',
  other:            'Other',
}

const APPEAL_TYPE_COLOR: Record<string, string> = {
  ombudsman:  'text-purple',
  council:    'text-gold',
  moderation: 'text-against-400',
  vote:       'text-for-400',
}

function AppealCard({ appeal }: { appeal: RegistryAppeal }) {
  const typeColor = APPEAL_TYPE_COLOR[appeal.appeal_type] ?? 'text-surface-500'

  return (
    <Link
      href={`/appeals`}
      className="block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0 text-[10px] font-mono font-bold text-surface-500">{appeal.appeal_number}</span>
          <span className={cn('flex-shrink-0 text-[10px] font-mono font-bold capitalize', typeColor)}>
            {appeal.appeal_type}
          </span>
        </div>
        <span className={cn(
          'flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
          appeal.status === 'pending'
            ? 'bg-gold/10 border-gold/30 text-gold'
            : 'bg-for-500/10 border-for-500/30 text-for-400'
        )}>
          {appeal.status === 'pending' ? 'Pending' : 'Reviewing'}
        </span>
      </div>
      {appeal.target_label && (
        <p className="text-xs font-mono text-surface-600 line-clamp-2 mb-2 leading-relaxed">
          {appeal.target_label}
        </p>
      )}
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-600">
        <span>Grounds: {GROUNDS_LABELS[appeal.grounds] ?? appeal.grounds}</span>
        <span>{relativeTime(appeal.created_at)}</span>
      </div>
    </Link>
  )
}

// ─── Motion card ──────────────────────────────────────────────────────────────

const EFFECT_CFG: Record<string, { color: string; label: string; icon: typeof Landmark }> = {
  elevate_topic:   { color: 'text-for-400',  label: 'Elevate Topic',   icon: Zap },
  issue_statement: { color: 'text-gold',      label: 'Issue Statement', icon: FileText },
  call_assembly:   { color: 'text-purple',    label: 'Call Assembly',   icon: Users },
}

function MotionCard({ motion }: { motion: RegistryMotion }) {
  const effectCfg = EFFECT_CFG[motion.effect] ?? { color: 'text-surface-500', label: motion.effect, icon: Gavel }
  const EffectIcon = effectCfg.icon
  const total = motion.votes_for + motion.votes_against
  const forPct = total > 0 ? Math.round((motion.votes_for / total) * 100) : 0

  return (
    <Link
      href={`/grand-council`}
      className="block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors line-clamp-1">
          {motion.title}
        </h3>
        <span className={cn('flex-shrink-0 flex items-center gap-1 text-[10px] font-mono font-bold', effectCfg.color)}>
          <EffectIcon className="h-3 w-3" />
          {effectCfg.label}
        </span>
      </div>
      <p className="text-xs font-mono text-surface-500 line-clamp-2 mb-3 leading-relaxed">
        {motion.description}
      </p>
      {motion.topic_statement && (
        <div className="text-[11px] font-mono text-surface-600 line-clamp-1 mb-2">
          Re: {motion.topic_statement}
        </div>
      )}
      {total > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[11px] font-mono mb-1">
            <span className="text-for-400">{forPct}% For</span>
            <span className="text-surface-600">{total} votes</span>
          </div>
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>
      )}
      <div className="text-[11px] font-mono text-surface-600 text-right">
        {timeUntil(motion.closes_at)}
      </div>
    </Link>
  )
}

// ─── Petition card ─────────────────────────────────────────────────────────────

const ACTION_CFG: Record<string, { color: string; label: string }> = {
  hearing:    { color: 'text-for-400',   label: 'Triggers Hearing' },
  referendum: { color: 'text-gold',       label: 'Triggers Referendum' },
  assembly:   { color: 'text-purple',     label: 'Convenes Assembly' },
  review:     { color: 'text-emerald',    label: 'Triggers Review' },
}

function PetitionCard({ petition }: { petition: RegistryPetition }) {
  const actionCfg = ACTION_CFG[petition.action_type] ?? { color: 'text-surface-500', label: petition.action_type }
  const progressPct = Math.min(100, Math.round((petition.signature_count / petition.target_signatures) * 100))

  return (
    <Link
      href={`/petitions`}
      className="block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h3 className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors line-clamp-1">
          {petition.title}
        </h3>
        <span className={cn('flex-shrink-0 text-[10px] font-mono font-bold', actionCfg.color)}>
          {actionCfg.label}
        </span>
      </div>
      <p className="text-[11px] font-mono text-surface-600 mb-2">
        Committee: {petition.committee}
      </p>
      {petition.topic_statement && (
        <div className="text-[11px] font-mono text-surface-600 line-clamp-1 mb-2">
          Re: {petition.topic_statement}
        </div>
      )}
      <div className="mb-1">
        <div className="flex justify-between text-[11px] font-mono mb-1">
          <span className="text-for-400">{petition.signature_count} / {petition.target_signatures} signatures</span>
          <span className="text-surface-600">{progressPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progressPct >= 100 ? 'bg-emerald' : 'bg-for-500'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <div className="text-[11px] font-mono text-surface-600 text-right mt-1">
        {timeUntil(petition.closes_at)}
      </div>
    </Link>
  )
}

// ─── Stats panel ──────────────────────────────────────────────────────────────

function StatPill({
  count,
  label,
  icon: Icon,
  color,
  bg,
  border,
  href,
}: {
  count: number
  label: string
  icon: typeof Landmark
  color: string
  bg: string
  border: string
  href: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all hover:scale-105',
        bg, border,
        count === 0 ? 'opacity-50' : ''
      )}
    >
      <div className={cn('flex items-center gap-1.5 font-mono text-xl font-black', color)}>
        <Icon className="h-4 w-4" />
        {count}
      </div>
      <span className="text-[10px] font-mono text-surface-500 text-center leading-snug">{label}</span>
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RegistrySkeleton() {
  return (
    <div className="space-y-8">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-surface-300/40 animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-surface-300/40 animate-pulse mb-1.5" />
              <div className="h-3 w-64 rounded bg-surface-300/30 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(2)].map((_, j) => (
              <div key={j} className="h-28 rounded-xl bg-surface-300/20 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SectionKey = 'assemblies' | 'hearings' | 'ombudsman' | 'appeals' | 'motions' | 'petitions'

export function CivicRegistryClient() {
  const [data, setData] = useState<RegistryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    assemblies: true,
    hearings: true,
    ombudsman: true,
    appeals: true,
    motions: true,
    petitions: true,
  })

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/registry')
      if (!res.ok) throw new Error('Failed to load registry')
      const json: RegistryResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load civic registry. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function toggle(key: SectionKey) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const totalActive = data
    ? Object.values(data.stats).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Landmark className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Registry
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading
                  ? 'Loading institutional activity…'
                  : totalActive > 0
                    ? `${totalActive} active civic process${totalActive !== 1 ? 'es' : ''} — your participation matters`
                    : 'All civic institutions are currently quiet'}
              </p>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              aria-label="Refresh registry"
              className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg border border-surface-400/40 bg-surface-200/40 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Stats grid */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-3 sm:grid-cols-6 gap-2"
            >
              <StatPill count={data.stats.assemblies_active} label="Assemblies" icon={Users} color="text-for-400" bg="bg-for-500/10" border="border-for-500/25" href="/assembly" />
              <StatPill count={data.stats.hearings_open} label="Hearings" icon={Mic2} color="text-emerald" bg="bg-emerald/10" border="border-emerald/25" href="/hearings" />
              <StatPill count={data.stats.ombudsman_open} label="Cases" icon={Shield} color="text-purple" bg="bg-purple/10" border="border-purple/25" href="/ombudsman" />
              <StatPill count={data.stats.appeals_pending} label="Appeals" icon={Scale} color="text-against-400" bg="bg-against-500/10" border="border-against-500/25" href="/appeals" />
              <StatPill count={data.stats.motions_active} label="Motions" icon={Gavel} color="text-gold" bg="bg-gold/10" border="border-gold/25" href="/grand-council" />
              <StatPill count={data.stats.petitions_open} label="Petitions" icon={Vote} color="text-for-300" bg="bg-for-400/10" border="border-for-400/25" href="/petitions" />
            </motion.div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-against-500/30 bg-against-500/10 mb-6">
            <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0" />
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => fetchData()}
              className="ml-auto text-xs font-mono text-against-400 hover:text-against-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <RegistrySkeleton />
        ) : (
          <div className="space-y-8">

            {/* Citizens' Assemblies */}
            <section>
              <SectionHeader
                icon={Users}
                iconColor="text-for-400"
                iconBg="bg-for-500/10"
                iconBorder="border-for-500/30"
                title="Citizens' Assemblies"
                count={data?.stats.assemblies_active ?? 0}
                href="/assembly"
                description="Randomly selected citizens deliberating on contested topics and issuing collective recommendations."
                expanded={expanded.assemblies}
                onToggle={() => toggle('assemblies')}
              />
              <AnimatePresence>
                {expanded.assemblies && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4">
                      {data?.assemblies.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.assemblies.map((a) => (
                            <AssemblyCard key={a.id} assembly={a} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={Users}
                          title="No active assemblies"
                          description="No Citizens' Assemblies are currently in session. Petitions can convene new assemblies."
                          action={{ label: 'View assemblies', href: '/assembly' }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Committee Hearings */}
            <section>
              <SectionHeader
                icon={Mic2}
                iconColor="text-emerald"
                iconBg="bg-emerald/10"
                iconBorder="border-emerald/30"
                title="Committee Hearings"
                count={data?.stats.hearings_open ?? 0}
                href="/hearings"
                description="Open pre-vote testimony sessions where citizens submit evidence to the relevant committee."
                expanded={expanded.hearings}
                onToggle={() => toggle('hearings')}
              />
              <AnimatePresence>
                {expanded.hearings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4">
                      {data?.hearings.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.hearings.map((h) => (
                            <HearingCard key={h.id} hearing={h} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={Mic2}
                          title="No open hearings"
                          description="No committee hearings are accepting testimony right now."
                          action={{ label: 'View hearings', href: '/hearings' }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Ombudsman Cases */}
            <section>
              <SectionHeader
                icon={Shield}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                iconBorder="border-purple/30"
                title="Ombudsman Cases"
                count={data?.stats.ombudsman_open ?? 0}
                href="/ombudsman"
                description="Open complaints about civic process fairness, contested decisions, and norm breaches."
                expanded={expanded.ombudsman}
                onToggle={() => toggle('ombudsman')}
              />
              <AnimatePresence>
                {expanded.ombudsman && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4">
                      {data?.ombudsman_cases.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.ombudsman_cases.map((c) => (
                            <OmbudsmanCard key={c.id} case={c} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={Shield}
                          title="No open cases"
                          description="The Civic Ombudsman has no active cases under review."
                          action={{ label: 'View cases', href: '/ombudsman' }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Civic Appeals */}
            <section>
              <SectionHeader
                icon={Scale}
                iconColor="text-against-400"
                iconBg="bg-against-500/10"
                iconBorder="border-against-500/30"
                title="Civic Appeals"
                count={data?.stats.appeals_pending ?? 0}
                href="/appeals"
                description="Formal appeals of ombudsman findings, council motions, moderation actions, and vote results."
                expanded={expanded.appeals}
                onToggle={() => toggle('appeals')}
              />
              <AnimatePresence>
                {expanded.appeals && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4">
                      {data?.appeals.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.appeals.map((a) => (
                            <AppealCard key={a.id} appeal={a} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={Scale}
                          title="No pending appeals"
                          description="No appeals are currently before the Civic Appeals Panel."
                          action={{ label: 'View appeals', href: '/appeals' }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Grand Council Motions */}
            <section>
              <SectionHeader
                icon={Gavel}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title="Grand Council Motions"
                count={data?.stats.motions_active ?? 0}
                href="/grand-council"
                description="Active governance motions proposed by Council members open for vote among the top citizens."
                expanded={expanded.motions}
                onToggle={() => toggle('motions')}
              />
              <AnimatePresence>
                {expanded.motions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4">
                      {data?.motions.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.motions.map((m) => (
                            <MotionCard key={m.id} motion={m} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={Gavel}
                          title="No active motions"
                          description="The Grand Council has no motions open for vote right now."
                          action={{ label: 'View council', href: '/grand-council' }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Civic Petitions */}
            <section>
              <SectionHeader
                icon={Vote}
                iconColor="text-for-300"
                iconBg="bg-for-400/10"
                iconBorder="border-for-400/30"
                title="Civic Petitions"
                count={data?.stats.petitions_open ?? 0}
                href="/petitions"
                description="Citizen-driven petitions gathering signatures to trigger hearings, referendums, or assemblies."
                expanded={expanded.petitions}
                onToggle={() => toggle('petitions')}
              />
              <AnimatePresence>
                {expanded.petitions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4">
                      {data?.petitions.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.petitions.map((p) => (
                            <PetitionCard key={p.id} petition={p} />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={Vote}
                          title="No open petitions"
                          description="No civic petitions are currently gathering signatures."
                          action={{ label: 'View petitions', href: '/petitions' }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Footer nav */}
            <nav
              aria-label="Civic institution links"
              className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-surface-300/40"
            >
              {[
                { href: '/assembly',    icon: Users,   label: 'Assemblies',    color: 'text-for-400' },
                { href: '/hearings',    icon: Mic2,    label: 'Hearings',      color: 'text-emerald' },
                { href: '/ombudsman',   icon: Shield,  label: 'Ombudsman',     color: 'text-purple' },
                { href: '/appeals',     icon: Scale,   label: 'Appeals',       color: 'text-against-400' },
                { href: '/grand-council', icon: Gavel, label: 'Grand Council', color: 'text-gold' },
                { href: '/petitions',   icon: Vote,    label: 'Petitions',     color: 'text-for-300' },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 p-3 rounded-xl border border-surface-300/50 bg-surface-200/30 hover:border-surface-400/50 hover:bg-surface-300/30 transition-all group"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                  <span className="text-xs font-mono font-semibold text-surface-500 group-hover:text-white transition-colors">
                    {label}
                  </span>
                  <ArrowRight className="h-3 w-3 text-surface-600 ml-auto" />
                </Link>
              ))}
            </nav>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
