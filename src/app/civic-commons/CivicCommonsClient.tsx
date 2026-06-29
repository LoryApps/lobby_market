'use client'

/**
 * /civic-commons — The Civic Commons
 *
 * Central governance hub for Lobby Market — a parliament-style dashboard
 * surfacing all active civic governance activity in one place:
 *
 *   • Grand Council motions awaiting votes
 *   • Citizens' Assemblies forming and deliberating
 *   • Open civic referendums
 *   • Tribunal cases under review
 *   • Upcoming / active civic elections
 *
 * Distinct from:
 *   /council        — Grand Council chamber with full voting UI
 *   /proclamations  — Historical record of all passed motions
 *   /assembly       — Citizens' Assembly deliberation space
 *   /tribunal       — Full tribunal case management
 *   /civic-referendums — Full referendum voting UI
 *   /elections      — Full elections UI
 *
 * This is the pulse page — "what is the civic body debating right now?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Crown,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  Scroll,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  CivicCommonsData,
  CommonsMotion,
  CommonsAssembly,
  CommonsReferendum,
  CommonsTribunalCase,
  CommonsElection,
} from '@/app/api/civic-commons/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const m = Math.round(diff / 60_000)
  const h = Math.round(m / 60)
  const d = Math.round(h / 24)
  if (m < 60) return `${m}m left`
  if (h < 24) return `${h}h left`
  return `${d}d left`
}

function voteBar(forVotes: number, against: number) {
  const total = forVotes + against
  if (total === 0) return 50
  return Math.round((forVotes / total) * 100)
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
          <Skeleton className="h-3 w-10 mb-2" />
          <Skeleton className="h-6 w-8" />
        </div>
      ))}
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ─── Stats row ────────────────────────────────────────────────────────────────

const STAT_CONFIG = [
  { key: 'active_motions',            label: 'Motions',       color: 'text-gold',        icon: Crown,   href: '/council' },
  { key: 'total_passed_proclamations',label: 'Proclamations', color: 'text-gold',        icon: Scroll,  href: '/proclamations' },
  { key: 'active_assemblies',         label: 'Assemblies',    color: 'text-purple',      icon: Users,   href: '/assembly' },
  { key: 'open_referendums',          label: 'Referendums',   color: 'text-for-400',     icon: Vote,    href: '/civic-referendums' },
  { key: 'open_tribunal_cases',       label: 'Tribunal',      color: 'text-against-400', icon: Gavel,   href: '/tribunal' },
  { key: 'active_elections',          label: 'Elections',     color: 'text-emerald',     icon: Shield,  href: '/elections' },
] as const

function StatsRow({ stats }: { stats: CivicCommonsData['stats'] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
      {STAT_CONFIG.map(({ key, label, color, icon: Icon, href }) => (
        <Link
          key={key}
          href={href}
          className="group rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 transition-colors text-center"
        >
          <div className={cn('flex items-center justify-center gap-1 text-xs font-mono mb-1', color)}>
            <Icon className="h-3 w-3" />
            <span>{label}</span>
          </div>
          <p className="text-2xl font-bold font-mono text-white group-hover:text-gold transition-colors">
            {stats[key]}
          </p>
        </Link>
      ))}
    </div>
  )
}

// ─── Motion card ─────────────────────────────────────────────────────────────

const EFFECT_CONFIG: Record<CommonsMotion['effect'], { label: string; color: string; icon: typeof Crown }> = {
  elevate_topic:   { label: 'Topic Elevation',  color: 'text-for-400',   icon: Zap },
  issue_statement: { label: 'Statement',         color: 'text-gold',      icon: Scroll },
  call_assembly:   { label: 'Assembly Call',     color: 'text-purple',    icon: Users },
}

function MotionCard({ motion }: { motion: CommonsMotion }) {
  const cfg = EFFECT_CONFIG[motion.effect]
  const forPct = voteBar(motion.votes_for, motion.votes_against)
  const total = motion.votes_for + motion.votes_against
  const EffectIcon = cfg.icon

  return (
    <Link href="/council" className="block group">
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-gold/40 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className={cn('flex items-center gap-1.5 text-xs font-mono mb-1.5', cfg.color)}>
              <EffectIcon className="h-3 w-3" aria-hidden="true" />
              {cfg.label}
            </div>
            <p className="text-sm font-semibold text-white line-clamp-2 group-hover:text-gold transition-colors">
              {motion.title}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-[10px] font-mono text-against-400">{timeUntil(motion.closes_at)}</span>
          </div>
        </div>

        {/* Vote bar */}
        {total > 0 ? (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
              <span className="flex items-center gap-1"><ThumbsUp className="h-2.5 w-2.5 text-for-400" aria-hidden="true" />{motion.votes_for}</span>
              <span className="flex items-center gap-1">{motion.votes_against}<ThumbsDown className="h-2.5 w-2.5 text-against-400" aria-hidden="true" /></span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-surface-600 mt-2">No votes yet</p>
        )}

        {/* Proposer */}
        {motion.proposer_username && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-surface-300/50">
            <Avatar src={motion.proposer_avatar_url} fallback={motion.proposer_display_name || motion.proposer_username} size="xs" />
            <span className="text-[11px] text-surface-500 font-mono truncate">
              @{motion.proposer_username}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Assembly card ─────────────────────────────────────────────────────────────

const ASSEMBLY_STATUS: Record<CommonsAssembly['status'], { label: string; color: string; dot: string }> = {
  forming:      { label: 'Forming',      color: 'text-gold',   dot: 'bg-gold' },
  deliberating: { label: 'Deliberating', color: 'text-purple', dot: 'bg-purple' },
  concluded:    { label: 'Concluded',    color: 'text-emerald', dot: 'bg-emerald' },
}

function AssemblyCard({ assembly }: { assembly: CommonsAssembly }) {
  const statusCfg = ASSEMBLY_STATUS[assembly.status]

  return (
    <Link href={`/assembly/${assembly.id}`} className="block group">
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-purple/40 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-white line-clamp-2 group-hover:text-purple transition-colors flex-1">
            {assembly.title}
          </p>
          <div className={cn('flex items-center gap-1 text-[10px] font-mono flex-shrink-0', statusCfg.color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
            {statusCfg.label}
          </div>
        </div>
        {assembly.topic_statement && (
          <p className="text-[11px] text-surface-500 line-clamp-1 mb-2">
            On: <span className="text-surface-400">{assembly.topic_statement}</span>
          </p>
        )}
        <div className="flex items-center gap-3 text-[10px] font-mono text-surface-600">
          <span className="flex items-center gap-1">
            <Users className="h-2.5 w-2.5" aria-hidden="true" />
            {assembly.member_count}/{assembly.max_members} members
          </span>
          <span>{relativeTime(assembly.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Referendum card ──────────────────────────────────────────────────────────

const REF_CATEGORY_COLOR: Record<string, string> = {
  governance: 'text-gold',
  features:   'text-purple',
  community:  'text-for-400',
  policy:     'text-emerald',
  other:      'text-surface-500',
}

function ReferendumCard({ referendum }: { referendum: CommonsReferendum }) {
  const total = referendum.for_votes + referendum.against_votes
  const forPct = voteBar(referendum.for_votes, referendum.against_votes)
  const quorumPct = Math.min(Math.round((total / referendum.quorum_required) * 100), 100)
  const catColor = REF_CATEGORY_COLOR[referendum.category] ?? 'text-surface-500'

  return (
    <Link href="/civic-referendums" className="block group">
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-for-500/40 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-white line-clamp-2 group-hover:text-for-300 transition-colors flex-1">
            {referendum.question}
          </p>
          <span className="text-[10px] font-mono text-against-400 flex-shrink-0">
            {timeUntil(referendum.closes_at)}
          </span>
        </div>

        <div className={cn('text-[10px] font-mono mb-3', catColor)}>
          {referendum.category.charAt(0).toUpperCase() + referendum.category.slice(1)}
        </div>

        {/* Quorum bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] font-mono text-surface-600 mb-1">
            <span>Quorum: {total}/{referendum.quorum_required}</span>
            <span>{quorumPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-purple rounded-full transition-all"
              style={{ width: `${quorumPct}%` }}
            />
          </div>
        </div>

        {/* Vote split */}
        {total > 0 && (
          <div className="h-1 rounded-full bg-against-700 overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Tribunal card ────────────────────────────────────────────────────────────

function TribunalCard({ case: c }: { case: CommonsTribunalCase }) {
  return (
    <Link href="/tribunal" className="block group">
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-against-500/40 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0',
              c.status === 'deliberating' ? 'bg-against-900/40 border border-against-500/30' : 'bg-surface-200 border border-surface-300'
            )}>
              <Gavel className={cn('h-3.5 w-3.5', c.status === 'deliberating' ? 'text-against-400' : 'text-surface-500')} aria-hidden="true" />
            </div>
            <div>
              <p className={cn(
                'text-[10px] font-mono uppercase tracking-wider',
                c.status === 'deliberating' ? 'text-against-400' : 'text-surface-500'
              )}>
                {c.status === 'deliberating' ? 'Deliberating' : 'Awaiting Jury'}
              </p>
              <p className="text-[10px] font-mono text-surface-600">
                {c.challenge_count} challenge{c.challenge_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-surface-600">{relativeTime(c.opened_at)}</span>
        </div>
        {c.argument_preview && (
          <p className="text-xs text-surface-400 line-clamp-2 mt-2 italic">
            &ldquo;{c.argument_preview}{c.argument_preview.length >= 120 ? '…' : ''}&rdquo;
          </p>
        )}
        {c.argument_topic && (
          <p className="text-[10px] text-surface-600 mt-1.5 font-mono truncate">
            Topic: {c.argument_topic}
          </p>
        )}
      </div>
    </Link>
  )
}

// ─── Election card ─────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  senator:      { label: 'Senator',      color: 'text-gold' },
  lawmaker:     { label: 'Lawmaker',     color: 'text-for-400' },
  troll_catcher:{ label: 'Troll Catcher',color: 'text-emerald' },
  elder:        { label: 'Elder',        color: 'text-gold' },
}

function ElectionCard({ election }: { election: CommonsElection }) {
  const roleCfg = ROLE_LABEL[election.role] ?? { label: election.role, color: 'text-surface-500' }
  const isActive = election.status === 'active'

  return (
    <Link href="/elections" className="block group">
      <div className={cn(
        'rounded-xl bg-surface-100 border p-4 transition-colors',
        isActive ? 'border-emerald/30 hover:border-emerald/50' : 'border-surface-300 hover:border-surface-400'
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', roleCfg.color)}>
                {roleCfg.label}
              </span>
              {isActive && (
                <span className="text-[10px] font-mono text-emerald flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white line-clamp-1 group-hover:text-emerald transition-colors">
              {election.title}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] font-mono text-surface-500">{election.seats} seat{election.seats !== 1 ? 's' : ''}</p>
            <p className="text-[10px] font-mono text-purple">{election.nominee_count} running</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 text-[10px] font-mono text-surface-600">
          <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{isActive ? 'Closes' : 'Opens'} {timeUntil(isActive ? election.ends_at : election.starts_at)}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  title: string
  subtitle: string
  count: number
  href: string
  children: React.ReactNode
  emptyTitle: string
  emptyDescription: string
}

function Section({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  count,
  href,
  children,
  emptyTitle,
  emptyDescription,
}: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300', iconColor)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-mono text-white">{title}</h2>
            <p className="text-[10px] font-mono text-surface-500">{subtitle}</p>
          </div>
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          View all
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {count === 0 ? (
        <EmptyState
          icon={Icon}
          iconColor={iconColor}
          title={emptyTitle}
          description={emptyDescription}
          size="sm"
          animate={false}
        />
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </motion.section>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function CivicCommonsClient() {
  const [data, setData] = useState<CivicCommonsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/civic-commons')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col min-h-screen bg-surface-950">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-mono text-white tracking-tight">
                The Civic Commons
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                All active civic governance in one place
              </p>
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh governance data"
              className="p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>

          {/* Quick governance links */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { href: '/council',           label: 'Grand Council', icon: Crown,  color: 'text-gold border-gold/30 hover:border-gold/60' },
              { href: '/proclamations',     label: 'Proclamations', icon: Scroll, color: 'text-gold border-gold/30 hover:border-gold/60' },
              { href: '/assembly',          label: 'Assembly',      icon: Users,  color: 'text-purple border-purple/30 hover:border-purple/60' },
              { href: '/civic-referendums', label: 'Referendums',   icon: Vote,   color: 'text-for-400 border-for-500/30 hover:border-for-500/60' },
              { href: '/tribunal',          label: 'Tribunal',      icon: Gavel,  color: 'text-against-400 border-against-500/30 hover:border-against-500/60' },
              { href: '/elections',         label: 'Elections',     icon: Shield, color: 'text-emerald border-emerald/30 hover:border-emerald/60' },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border text-[11px] font-mono font-semibold transition-colors',
                  color
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Stats row */}
        {loading ? (
          <StatsSkeleton />
        ) : data ? (
          <StatsRow stats={data.stats} />
        ) : null}

        {/* Sections */}
        {loading ? (
          <div className="space-y-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-32 mb-3" />
                <SectionSkeleton />
              </div>
            ))}
          </div>
        ) : !data ? (
          <EmptyState
            icon={AlertTriangle}
            iconColor="text-against-400"
            title="Failed to load"
            description="Couldn't reach the civic commons. Try refreshing."
            actions={[{ label: 'Retry', onClick: () => load() }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <div className="space-y-10">

              {/* Grand Council motions */}
              <Section
                icon={Crown}
                iconColor="text-gold"
                title="Grand Council"
                subtitle="Active motions awaiting council vote"
                count={data.motions.length}
                href="/council"
                emptyTitle="No active motions"
                emptyDescription="The Grand Council has no pending motions right now."
              >
                {data.motions.map((m) => (
                  <MotionCard key={m.id} motion={m} />
                ))}
              </Section>

              {/* Citizens' Assemblies */}
              <Section
                icon={Users}
                iconColor="text-purple"
                title="Citizens' Assemblies"
                subtitle="Sortition bodies forming and deliberating"
                count={data.assemblies.length}
                href="/assembly"
                emptyTitle="No active assemblies"
                emptyDescription="No citizens' assemblies are deliberating right now."
              >
                {data.assemblies.map((a) => (
                  <AssemblyCard key={a.id} assembly={a} />
                ))}
              </Section>

              {/* Civic Referendums */}
              <Section
                icon={Vote}
                iconColor="text-for-400"
                title="Civic Referendums"
                subtitle="Open platform-governance votes"
                count={data.referendums.length}
                href="/civic-referendums"
                emptyTitle="No open referendums"
                emptyDescription="All referendums have been decided. Propose one to start a new civic conversation."
              >
                {data.referendums.map((r) => (
                  <ReferendumCard key={r.id} referendum={r} />
                ))}
              </Section>

              {/* Tribunal */}
              <Section
                icon={Gavel}
                iconColor="text-against-400"
                title="The Tribunal"
                subtitle="Arguments under community review"
                count={data.tribunal_cases.length}
                href="/tribunal"
                emptyTitle="No open cases"
                emptyDescription="The Tribunal is clear — all challenged arguments have been decided."
              >
                {data.tribunal_cases.map((c) => (
                  <TribunalCard key={c.id} case={c} />
                ))}
              </Section>

              {/* Elections */}
              {(data.elections.length > 0 || data.stats.active_elections > 0) && (
                <Section
                  icon={Shield}
                  iconColor="text-emerald"
                  title="Civic Elections"
                  subtitle="Role elections: nominate, campaign, vote"
                  count={data.elections.length}
                  href="/elections"
                  emptyTitle="No active elections"
                  emptyDescription="No civic elections are running right now."
                >
                  {data.elections.map((e) => (
                    <ElectionCard key={e.id} election={e} />
                  ))}
                </Section>
              )}

              {/* Footer links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-surface-500" aria-hidden="true" />
                  <p className="text-xs font-mono font-bold text-surface-400 uppercase tracking-widest">
                    Governance archives
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: '/proclamations', label: 'All Proclamations', icon: Scroll },
                    { href: '/constitution',  label: 'The Constitution',  icon: BookOpen },
                    { href: '/senate',        label: 'The Senate',        icon: Scale },
                    { href: '/petitions',     label: 'Petitions',         icon: ExternalLink },
                    { href: '/amendments',    label: 'Amendments',        icon: CheckCircle2 },
                    { href: '/elections',     label: 'Election History',  icon: Shield },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      {label}
                      <ArrowRight className="h-3 w-3 ml-auto" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </motion.div>

            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
