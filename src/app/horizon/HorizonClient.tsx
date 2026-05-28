'use client'

/**
 * /horizon — The Civic Horizon
 *
 * A forward-looking intelligence page showing what's about to happen in the
 * Lobby: topics nearing law status, debates approaching majority, early-
 * momentum proposals gathering steam, and upcoming scheduled debates.
 *
 * Distinct from:
 *   /surge        — topics currently accelerating (velocity now)
 *   /triage       — where votes are needed most urgently
 *   /forecast     — statistical pass probability
 *   /frontier     — newest proposed topics
 *   /race         — horse-race visual of vote velocity
 *
 * The Horizon asks: "What is ABOUT TO happen — and when?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  MapPin,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  HorizonResponse,
  NearLawTopic,
  ApproachingVoteTopic,
  EarlyMomentumTopic,
  UpcomingDebate,
  CategoryForecast,
} from '@/app/api/horizon/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBATE_TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-amber-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? 'proposed'
}

function formatHoursUntil(hours: number): string {
  if (hours < 1) return 'Starting soon'
  if (hours < 24) return `in ${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  const rem = Math.round(hours % 24)
  return rem > 0 ? `in ${days}d ${rem}h` : `in ${days}d`
}

function formatHoursOld(hours: number): string {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  color,
  count,
}: {
  icon: typeof Gavel
  title: string
  subtitle: string
  color: string
  count: number
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-mono font-bold text-white leading-tight">{title}</h2>
          <p className="text-xs font-mono text-surface-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {count > 0 && (
        <span className="text-xs font-mono font-bold text-surface-500 mt-1 flex-shrink-0">
          {count}
        </span>
      )}
    </div>
  )
}

function NearLawCard({ topic }: { topic: NearLawTopic }) {
  const pct = topic.blue_pct
  const barPct = Math.min(100, (pct / 67) * 100)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border p-3.5 transition-colors',
          'bg-surface-100 border-surface-300',
          'hover:bg-surface-200 hover:border-for-500/40'
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <p className="text-sm font-sans text-surface-700 leading-snug line-clamp-2 flex-1">
            {topic.statement}
          </p>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Progress bar toward 67% law threshold */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-surface-500">
              {pct.toFixed(1)}% FOR
            </span>
            <span className="text-[10px] font-mono text-gold font-semibold">
              {topic.gap_to_law <= 0 ? 'Law threshold reached' : `${topic.gap_to_law.toFixed(1)}pts to law`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-gold"
            />
          </div>
          {/* Threshold marker at 67% */}
          <div className="relative h-0">
            <div
              className="absolute top-[-6px] w-px h-3 bg-gold/60"
              style={{ left: '100%' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusBadge(topic.status)} className="text-[10px]">
            {topic.status}
          </Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
              {topic.category}
            </span>
          )}
          {topic.scope && topic.scope !== 'Global' && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <MapPin className="h-2.5 w-2.5" />
              {topic.scope}
            </span>
          )}
          <span className="ml-auto text-[10px] font-mono text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
        </div>

        {topic.votes_needed > 0 && (
          <p className="mt-1.5 text-[10px] font-mono text-surface-600">
            ~{topic.votes_needed.toLocaleString()} more FOR votes needed
          </p>
        )}
      </Link>
    </motion.div>
  )
}

function ApproachingVoteCard({ topic }: { topic: ApproachingVoteTopic }) {
  const pct = topic.blue_pct
  const barPct = Math.min(100, (pct / 51) * 100)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border p-3.5 transition-colors',
          'bg-surface-100 border-surface-300',
          'hover:bg-surface-200 hover:border-for-500/30'
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <p className="text-sm font-sans text-surface-700 leading-snug line-clamp-2 flex-1">
            {topic.statement}
          </p>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-surface-500">{pct.toFixed(1)}% FOR</span>
            <span className="text-[10px] font-mono text-for-400 font-semibold">
              {topic.gap_to_majority <= 0 ? 'Majority reached' : `${topic.gap_to_majority.toFixed(1)}pts to majority`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-for-700 to-for-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusBadge(topic.status)} className="text-[10px]">
            {topic.status}
          </Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
              {topic.category}
            </span>
          )}
          <span className="ml-auto text-[10px] font-mono text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function EarlyMomentumCard({ topic }: { topic: EarlyMomentumTopic }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border p-3.5 transition-colors',
          'bg-surface-100 border-surface-300',
          'hover:bg-surface-200 hover:border-against-500/30'
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-sans text-surface-700 leading-snug line-clamp-2 flex-1">
            {topic.statement}
          </p>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {topic.category && (
            <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
              {topic.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">
            {formatHoursOld(topic.hours_old)}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-against-400 font-semibold">
            <TrendingUp className="h-3 w-3" />
            {topic.votes_per_hour}/hr
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div
            className={cn(
              'text-[10px] font-mono font-semibold',
              topic.blue_pct >= 50 ? 'text-for-400' : 'text-against-400'
            )}
          >
            {topic.blue_pct.toFixed(0)}% FOR
          </div>
          <span className="text-[10px] font-mono text-surface-500">
            {topic.total_votes} votes
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function UpcomingDebateCard({ debate }: { debate: UpcomingDebate }) {
  const isImminent = debate.hours_until < 2
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Link
        href={`/debate/${debate.id}`}
        className={cn(
          'block rounded-xl border p-3.5 transition-colors',
          'bg-surface-100 border-surface-300',
          isImminent
            ? 'hover:bg-against-950/30 hover:border-against-500/40'
            : 'hover:bg-surface-200 hover:border-surface-400'
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <p className="text-sm font-sans text-surface-700 leading-snug line-clamp-2">
              {debate.title}
            </p>
            {debate.topic_statement && (
              <p className="text-[10px] font-mono text-surface-500 mt-0.5 line-clamp-1">
                {debate.topic_statement}
              </p>
            )}
          </div>
          {isImminent && (
            <span className="flex-shrink-0">
              <span className="relative flex h-2 w-2 mt-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-against-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-against-400" />
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-300/50 text-surface-500">
            {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
          </span>
          {debate.topic_category && (
            <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[debate.topic_category] ?? 'text-surface-500')}>
              {debate.topic_category}
            </span>
          )}
          <span
            className={cn(
              'ml-auto text-[10px] font-mono font-semibold',
              isImminent ? 'text-against-400' : 'text-surface-500'
            )}
          >
            <CalendarClock className="h-3 w-3 inline mr-1" />
            {formatHoursUntil(debate.hours_until)}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function CategoryForecastBar({ cat }: { cat: CategoryForecast }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono w-24 flex-shrink-0', CATEGORY_COLOR[cat.category] ?? 'text-surface-500')}>
        {cat.category}
      </span>
      <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cat.readiness_score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            cat.readiness_score >= 60
              ? 'bg-gradient-to-r from-gold to-gold/60'
              : cat.readiness_score >= 30
              ? 'bg-gradient-to-r from-for-500 to-for-400'
              : 'bg-surface-400'
          )}
        />
      </div>
      <div className="flex gap-2 flex-shrink-0 text-[10px] font-mono">
        {cat.near_law_count > 0 && (
          <span className="text-gold">{cat.near_law_count} near-law</span>
        )}
        {cat.approaching_vote_count > 0 && (
          <span className="text-for-400">{cat.approaching_vote_count} rising</span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HorizonClient() {
  const [data, setData] = useState<HorizonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showAllNearLaw, setShowAllNearLaw] = useState(false)
  const [showAllApproaching, setShowAllApproaching] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/horizon', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: HorizonResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load horizon data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const nearLawVisible = showAllNearLaw ? (data?.near_law ?? []) : (data?.near_law ?? []).slice(0, 6)
  const approachingVisible = showAllApproaching ? (data?.approaching_vote ?? []) : (data?.approaching_vote ?? []).slice(0, 5)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/20">
                <Target className="h-4 w-4 text-for-400" />
              </div>
              <h1 className="font-mono text-2xl font-bold text-white">The Civic Horizon</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 ml-11">
              What&apos;s about to happen — laws near passing, debates gaining momentum, and debates on deck.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className={cn(
              'flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg',
              'border border-surface-300 text-surface-500',
              'hover:border-surface-400 hover:text-surface-400 transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-12 mb-1" />
                  <Skeleton className="h-2 w-20" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Target}
            title="Horizon unavailable"
            description={error ?? undefined}
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        )}

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {!loading && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="horizon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* ─ Stats row ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon={Gavel}
                  value={data.stats.total_near_law}
                  label="Near law"
                  sublabel="within 7% of threshold"
                  color="text-gold"
                  bg="bg-gold/10 border-gold/20"
                />
                <StatCard
                  icon={Scale}
                  value={data.stats.total_approaching_vote}
                  label="Approaching majority"
                  sublabel="gaining momentum"
                  color="text-for-400"
                  bg="bg-for-500/10 border-for-500/20"
                />
                <StatCard
                  icon={Flame}
                  value={data.stats.total_early_momentum}
                  label="Early momentum"
                  sublabel="rising in 48h"
                  color="text-against-400"
                  bg="bg-against-500/10 border-against-500/20"
                />
                <StatCard
                  icon={CalendarClock}
                  value={data.stats.total_upcoming_debates}
                  label="Upcoming debates"
                  sublabel="next 7 days"
                  color="text-purple"
                  bg="bg-purple/10 border-purple/20"
                />
              </div>

              {/* ─ Main grid ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Near Law */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <SectionHeader
                    icon={Gavel}
                    title="Near-Law Topics"
                    subtitle="60%+ FOR · within reach of the 67% threshold"
                    color="bg-gold/10 border border-gold/20 text-gold"
                    count={data.near_law.length}
                  />
                  {data.near_law.length === 0 ? (
                    <EmptyState
                      icon={Gavel}
                      title="No topics near law"
                      description="No active debates have reached 60% consensus yet."
                      className="py-6"
                    />
                  ) : (
                    <div className="space-y-2">
                      {nearLawVisible.map((topic, i) => (
                        <motion.div
                          key={topic.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <NearLawCard topic={topic} />
                        </motion.div>
                      ))}
                      {data.near_law.length > 6 && (
                        <button
                          onClick={() => setShowAllNearLaw((v) => !v)}
                          className="w-full text-[11px] font-mono text-surface-500 hover:text-surface-400 py-1.5 flex items-center justify-center gap-1 transition-colors"
                        >
                          {showAllNearLaw ? 'Show less' : `Show ${data.near_law.length - 6} more`}
                          <ChevronDown className={cn('h-3 w-3 transition-transform', showAllNearLaw && 'rotate-180')} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Approaching Vote */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <SectionHeader
                    icon={Scale}
                    title="Approaching Majority"
                    subtitle="42–59% FOR · approaching the 51% tipping point"
                    color="bg-for-500/10 border border-for-500/20 text-for-400"
                    count={data.approaching_vote.length}
                  />
                  {data.approaching_vote.length === 0 ? (
                    <EmptyState
                      icon={Scale}
                      title="No topics approaching majority"
                      description="No active debates are currently between 42–59% FOR."
                      className="py-6"
                    />
                  ) : (
                    <div className="space-y-2">
                      {approachingVisible.map((topic, i) => (
                        <motion.div
                          key={topic.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <ApproachingVoteCard topic={topic} />
                        </motion.div>
                      ))}
                      {data.approaching_vote.length > 5 && (
                        <button
                          onClick={() => setShowAllApproaching((v) => !v)}
                          className="w-full text-[11px] font-mono text-surface-500 hover:text-surface-400 py-1.5 flex items-center justify-center gap-1 transition-colors"
                        >
                          {showAllApproaching ? 'Show less' : `Show ${data.approaching_vote.length - 5} more`}
                          <ChevronDown className={cn('h-3 w-3 transition-transform', showAllApproaching && 'rotate-180')} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Early Momentum */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <SectionHeader
                    icon={Flame}
                    title="Early Momentum"
                    subtitle="New topics · high votes-per-hour in first 48h"
                    color="bg-against-500/10 border border-against-500/20 text-against-400"
                    count={data.early_momentum.length}
                  />
                  {data.early_momentum.length === 0 ? (
                    <EmptyState
                      icon={Flame}
                      title="No early-momentum topics"
                      description="No new topics from the last 48 hours are gaining fast momentum yet."
                      className="py-6"
                    />
                  ) : (
                    <div className="space-y-2">
                      {data.early_momentum.map((topic, i) => (
                        <motion.div
                          key={topic.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <EarlyMomentumCard topic={topic} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Debates + Category Forecast combined panel */}
                <div className="space-y-4">
                  {/* Upcoming Debates */}
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                    <SectionHeader
                      icon={CalendarClock}
                      title="Upcoming Debates"
                      subtitle="Scheduled in the next 7 days"
                      color="bg-purple/10 border border-purple/20 text-purple"
                      count={data.upcoming_debates.length}
                    />
                    {data.upcoming_debates.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-xs font-mono text-surface-500">No debates scheduled this week.</p>
                        <Link
                          href="/debate"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                        >
                          Browse all debates <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {data.upcoming_debates.slice(0, 4).map((debate, i) => (
                          <motion.div
                            key={debate.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <UpcomingDebateCard debate={debate} />
                          </motion.div>
                        ))}
                        {data.upcoming_debates.length > 4 && (
                          <Link
                            href="/calendar"
                            className="flex items-center justify-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-400 py-1.5 transition-colors"
                          >
                            View full calendar <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Category Forecast */}
                  {data.category_forecast.length > 0 && (
                    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                      <SectionHeader
                        icon={BarChart2}
                        title="Category Readiness"
                        subtitle="Which categories have the most near-threshold topics"
                        color="bg-emerald/10 border border-emerald/20 text-emerald"
                        count={0}
                      />
                      <div className="space-y-2.5">
                        {data.category_forecast.slice(0, 6).map((cat) => (
                          <CategoryForecastBar key={cat.category} cat={cat} />
                        ))}
                      </div>
                      <Link
                        href="/categories"
                        className="mt-3 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
                      >
                        <Globe className="h-3 w-3" />
                        Browse by category
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* ─ Footer links ──────────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  { href: '/surge', label: 'Surging now', icon: TrendingUp },
                  { href: '/triage', label: 'Vote needed', icon: Zap },
                  { href: '/forecast', label: 'Pass probability', icon: BarChart2 },
                  { href: '/frontier', label: 'New proposals', icon: Sparkles },
                  { href: '/calendar', label: 'Full calendar', icon: CalendarClock },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono',
                      'border border-surface-300 text-surface-500',
                      'hover:border-surface-400 hover:text-surface-400 transition-colors'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </Link>
                ))}
              </div>

              <p className="text-[10px] font-mono text-surface-600 text-center">
                Generated {new Date(data.generated_at).toLocaleTimeString()} · refreshes every 2 min
              </p>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  sublabel,
  color,
  bg,
}: {
  icon: typeof Gavel
  value: number
  label: string
  sublabel: string
  color: string
  bg: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-2xl border p-4', bg)}
    >
      <div className={cn('flex items-center gap-1.5 mb-2', color)}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-3xl font-mono font-bold tabular-nums', color)}>
        {value}
      </div>
      <div className="text-[10px] font-mono text-surface-500 mt-0.5">{sublabel}</div>
    </motion.div>
  )
}
