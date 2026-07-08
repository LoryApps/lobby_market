'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Brain,
  ChevronRight,
  Crown,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { RelayIntelligence, LegAnalysis, ContributorStat } from '@/app/api/relays/[id]/intelligence/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  relayId: string
  side: 'for' | 'against'
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, typeof Users> = {
  elder:         Crown,
  troll_catcher: Shield,
  debator:       Swords,
  person:        Users,
}

function sideColors(side: 'for' | 'against') {
  return side === 'for'
    ? { text: 'text-for-400', bar: 'bg-for-500', badge: 'bg-for-500/10 text-for-400 border-for-500/30', ring: 'ring-for-500/30' }
    : { text: 'text-against-400', bar: 'bg-against-500', badge: 'bg-against-500/10 text-against-400 border-against-500/30', ring: 'ring-against-500/30' }
}

function tierColor(tier: RelayIntelligence['intel_tier'] | LegAnalysis['quality_tier']) {
  switch (tier) {
    case 'exceptional': case 'excellent': return { text: 'text-emerald', bar: 'bg-emerald', badge: 'bg-emerald/10 text-emerald border-emerald/30' }
    case 'strong':      return { text: 'text-for-400', bar: 'bg-for-500', badge: 'bg-for-500/10 text-for-400 border-for-500/30' }
    case 'adequate':    return { text: 'text-gold', bar: 'bg-gold', badge: 'bg-gold/10 text-gold border-gold/30' }
    case 'weak':        return { text: 'text-against-400', bar: 'bg-against-500', badge: 'bg-against-500/10 text-against-400 border-against-500/30' }
    default:            return { text: 'text-surface-500', bar: 'bg-surface-400', badge: 'bg-surface-300/30 text-surface-400 border-surface-300/30' }
  }
}

function tierLabel(tier: RelayIntelligence['intel_tier']) {
  switch (tier) {
    case 'exceptional': return 'Exceptional'
    case 'strong':      return 'Strong'
    case 'adequate':    return 'Adequate'
    case 'weak':        return 'Weak'
    case 'poor':        return 'Poor'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'open':        return 'Open'
    case 'in_progress': return 'In Progress'
    case 'complete':    return 'Complete'
    case 'voted':       return 'Voted'
    default:            return status
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RelayIntelligenceClient({ relayId, side, status }: Props) {
  const [data, setData] = useState<RelayIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${relayId}/intelligence`)
      if (!res.ok) throw new Error('Failed to load intelligence')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [relayId])

  useEffect(() => { load() }, [load])

  const colors = sideColors(side)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-5">

        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/relays/${relayId}`}
            className="flex-shrink-0 h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            {loading || !data ? (
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : (
              <>
                <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50 truncate leading-tight">
                  Relay Intelligence
                </h1>
                <p className="text-xs text-surface-500 truncate">
                  {data.topic_statement
                    ? data.topic_statement.slice(0, 60) + (data.topic_statement.length > 60 ? '…' : '')
                    : 'Relay Analysis'}
                </p>
              </>
            )}
          </div>
          <span className={cn(
            'flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border',
            side === 'for'
              ? 'bg-for-500/10 text-for-400 border-for-500/30'
              : 'bg-against-500/10 text-against-400 border-against-500/30'
          )}>
            {side === 'for' ? 'FOR' : 'AGAINST'}
          </span>
        </div>

        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/20 p-4 text-sm text-against-400">
            {error} —{' '}
            <button onClick={load} className="underline">retry</button>
          </div>
        )}

        {/* Intel score card */}
        {loading ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="flex items-end gap-3">
              <Skeleton className="h-14 w-20" />
              <Skeleton className="h-6 w-24 rounded-full mb-1" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ) : data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-surface-500" />
                <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">Intel Score</span>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full border', tierColor(data.intel_tier).badge)}>
                {statusLabel(status)}
              </span>
            </div>

            <div className="flex items-end gap-3">
              <span className={cn('text-5xl font-black tabular-nums', tierColor(data.intel_tier).text)}>
                {data.intel_score}
              </span>
              <span className={cn('mb-1.5 text-sm font-semibold px-2.5 py-0.5 rounded-full border', tierColor(data.intel_tier).badge)}>
                {tierLabel(data.intel_tier)}
              </span>
            </div>

            <div className="h-2.5 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', tierColor(data.intel_tier).bar)}
                initial={{ width: 0 }}
                animate={{ width: `${data.intel_score}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>

            <p className="text-xs text-surface-500 leading-relaxed">
              Based on argument quality ({Math.round(data.avg_quality)}/100 avg), flow coherence ({data.flow_score}%), and vocabulary richness across {data.legs_filled} leg{data.legs_filled !== 1 ? 's' : ''} by {data.unique_contributors} contributor{data.unique_contributors !== 1 ? 's' : ''}.
            </p>
          </motion.div>
        )}

        {/* Metrics row */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-3 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              {
                label: 'Avg Quality',
                value: data.avg_quality,
                suffix: '/100',
                pct: data.avg_quality,
                icon: Zap,
                color: tierColor(data.avg_quality >= 70 ? 'excellent' : data.avg_quality >= 50 ? 'strong' : data.avg_quality >= 30 ? 'adequate' : 'weak'),
              },
              {
                label: 'Flow Score',
                value: data.flow_score,
                suffix: '%',
                pct: data.flow_score,
                icon: TrendingUp,
                color: tierColor(data.flow_score >= 70 ? 'excellent' : data.flow_score >= 50 ? 'strong' : data.flow_score >= 30 ? 'adequate' : 'weak'),
              },
              {
                label: 'Vocab Rich',
                value: Math.round(data.vocabulary_richness * 100),
                suffix: '%',
                pct: Math.round(data.vocabulary_richness * 100),
                icon: BookOpen,
                color: tierColor(data.vocabulary_richness >= 0.7 ? 'excellent' : data.vocabulary_richness >= 0.55 ? 'strong' : data.vocabulary_richness >= 0.4 ? 'adequate' : 'weak'),
              },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-surface-300 bg-surface-100 p-3 space-y-1.5">
                <div className="flex items-center gap-1">
                  <m.icon className={cn('h-3 w-3', m.color.text)} />
                  <span className="text-xs text-surface-500 truncate">{m.label}</span>
                </div>
                <div className={cn('text-xl font-bold tabular-nums', m.color.text)}>
                  {m.value}<span className="text-xs font-normal text-surface-500">{m.suffix}</span>
                </div>
                <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', m.color.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, m.pct)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Community verdict */}
        {loading ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-3">
              <Skeleton className="h-12 flex-1 rounded-xl" />
              <Skeleton className="h-12 flex-1 rounded-xl" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        ) : data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-surface-500" />
                <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">Community Verdict</span>
              </div>
              {data.verdict !== 'pending' && (
                <span className={cn(
                  'text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                  data.verdict === 'compelling'
                    ? 'bg-emerald/10 text-emerald border-emerald/30'
                    : data.verdict === 'not_compelling'
                    ? 'bg-against-500/10 text-against-400 border-against-500/30'
                    : 'bg-gold/10 text-gold border-gold/30'
                )}>
                  {data.verdict === 'compelling' ? 'Compelling' : data.verdict === 'not_compelling' ? 'Not Compelling' : 'Mixed'}
                </span>
              )}
            </div>

            {data.compelling_rate === null ? (
              <p className="text-sm text-surface-500 py-2">No votes yet — verdict pending.</p>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-emerald/10 border border-emerald/20 p-3 flex flex-col items-center gap-1">
                    <ThumbsUp className="h-4 w-4 text-emerald" />
                    <span className="text-xl font-bold text-emerald">{data.vote_compelling}</span>
                    <span className="text-xs text-surface-500">Compelling</span>
                  </div>
                  <div className="flex-1 rounded-xl bg-against-500/10 border border-against-500/20 p-3 flex flex-col items-center gap-1">
                    <ThumbsDown className="h-4 w-4 text-against-400" />
                    <span className="text-xl font-bold text-against-400">{data.vote_not_compelling}</span>
                    <span className="text-xs text-surface-500">Not Compelling</span>
                  </div>
                </div>

                <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.compelling_rate}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-surface-500 text-center">
                  {data.compelling_rate}% found this relay compelling
                </p>
              </>
            )}
          </motion.div>
        )}

        {/* Signal words */}
        {!loading && data && data.signal_words.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
          >
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">Signal Words</span>
            <div className="flex flex-wrap gap-2">
              {data.signal_words.map((w) => (
                <span
                  key={w}
                  className={cn(
                    'text-xs font-medium px-2.5 py-1 rounded-full border',
                    colors.badge
                  )}
                >
                  {w}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Leg breakdown */}
        {loading ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4">
            <Skeleton className="h-5 w-32" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 pt-3 border-t border-surface-300 first:border-0 first:pt-0">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : data && data.legs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-4"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-surface-500" />
              <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">Leg Breakdown</span>
              <span className="ml-auto text-xs text-surface-500">{data.legs.length} leg{data.legs.length !== 1 ? 's' : ''}</span>
            </div>

            {data.legs.map((leg, idx) => {
              const tc = tierColor(leg.quality_tier)
              const RoleIcon = ROLE_ICON[leg.author_role] ?? Users
              return (
                <div
                  key={leg.leg_number}
                  className={cn(
                    'flex gap-3',
                    idx > 0 && 'pt-4 border-t border-surface-300'
                  )}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 relative">
                    {leg.author_avatar_url ? (
                      <Image
                        src={leg.author_avatar_url}
                        alt={leg.author_display_name ?? leg.author_username}
                        width={32}
                        height={32}
                        className="rounded-full object-cover w-8 h-8"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-surface-300 flex items-center justify-center">
                        <RoleIcon className="h-4 w-4 text-surface-500" />
                      </div>
                    )}
                    <span className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-surface-200 border border-surface-300',
                      colors.text
                    )}>
                      {leg.leg_number}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">
                        {leg.author_display_name ?? leg.author_username}
                      </span>
                      <span className={cn('flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border', tc.badge)}>
                        {leg.quality_score}/100
                      </span>
                    </div>

                    <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed line-clamp-3">
                      {leg.content}
                    </p>

                    <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', tc.bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${leg.quality_score}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 * idx }}
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full">
                        {leg.word_count}w
                      </span>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        tc.badge
                      )}>
                        {leg.quality_tier}
                      </span>
                      {leg.builds_on_prev && idx > 0 && (
                        <span className="text-[10px] text-emerald bg-emerald/10 px-2 py-0.5 rounded-full">
                          builds on prev
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* Contributors */}
        {loading ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
            <Skeleton className="h-5 w-36" />
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-7 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : data && data.contributors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-surface-500" />
              <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">Contributors</span>
              <span className="ml-auto text-xs text-surface-500">{data.unique_contributors} unique</span>
            </div>

            {data.contributors.map((c: ContributorStat) => {
              const RoleIcon = ROLE_ICON[c.author_role] ?? Users
              const tc = tierColor(c.avg_quality >= 70 ? 'excellent' : c.avg_quality >= 50 ? 'strong' : c.avg_quality >= 30 ? 'adequate' : 'weak')
              return (
                <Link
                  key={c.author_id}
                  href={`/profile/${c.author_username}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="relative flex-shrink-0">
                    {c.author_avatar_url ? (
                      <Image
                        src={c.author_avatar_url}
                        alt={c.author_display_name ?? c.author_username}
                        width={36}
                        height={36}
                        className="rounded-full object-cover w-9 h-9"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-300 flex items-center justify-center">
                        <RoleIcon className="h-4 w-4 text-surface-500" />
                      </div>
                    )}
                    {c.is_starter && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-gold rounded-full flex items-center justify-center">
                        <Crown className="h-2 w-2 text-surface-900" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-800 dark:text-surface-100 group-hover:text-for-400 transition-colors truncate">
                      {c.author_display_name ?? c.author_username}
                    </div>
                    <div className="text-xs text-surface-500">
                      {c.legs_contributed} leg{c.legs_contributed !== 1 ? 's' : ''}
                      {c.is_starter && ' · starter'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', tc.badge)}>
                      {c.avg_quality}/100
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-400 group-hover:text-surface-600 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </motion.div>
        )}

        {/* Footer links */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex gap-3 pt-2"
          >
            <Link
              href={`/relays/${relayId}`}
              className="flex-1 text-center text-sm font-medium py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-700 dark:text-surface-200 transition-colors"
            >
              View Relay
            </Link>
            <Link
              href="/relays"
              className="flex-1 text-center text-sm font-medium py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-700 dark:text-surface-200 transition-colors"
            >
              All Relays
            </Link>
          </motion.div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
