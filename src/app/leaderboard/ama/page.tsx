'use client'

/**
 * /leaderboard/ama — AMA Expert Rankings
 *
 * Ranks the platform's top Ask Me Anything hosts by:
 *   Top Hosts    — combined session count + answers given
 *   Most Attended — total RSVPs / community reach
 *   Rising       — high-quality newcomers (active in last 90 days)
 *
 * Distinct from /ama/experts (browseable grid) and /questions/leaders
 * (individual Q&A answers). This is the competitive ranking table that
 * celebrates the experts who show up consistently and answer well.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  Crown,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Medal,
  MessageSquare,
  Mic,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { AMAExpertEntry, AMALeaderboardResponse } from '@/app/api/leaderboard/ama/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Law:         Scale,
  Philosophy:  GraduationCap,
  Health:      Heart,
  Environment: Leaf,
  Culture:     Music2,
  Education:   GraduationCap,
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold border-gold/25 bg-gold/8',
  Politics:    'text-for-400 border-for-500/25 bg-for-500/8',
  Technology:  'text-purple border-purple/25 bg-purple/8',
  Science:     'text-emerald border-emerald/25 bg-emerald/8',
  Law:         'text-for-300 border-for-400/25 bg-for-400/8',
  Philosophy:  'text-against-300 border-against-400/25 bg-against-400/8',
  Health:      'text-against-400 border-against-500/25 bg-against-500/8',
  Environment: 'text-emerald border-emerald/25 bg-emerald/8',
  Culture:     'text-gold border-gold/25 bg-gold/8',
  Education:   'text-purple border-purple/25 bg-purple/8',
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  person:        'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder:         'Elder',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  person:        'Citizen',
}

// ─── Rank display ─────────────────────────────────────────────────────────────

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-gold" aria-label="1st" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-300" aria-label="2nd" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" aria-label="3rd" />
  return <span className="text-xs font-mono text-surface-500 w-5 text-center tabular-nums">{rank}</span>
}

// ─── Podium card (top 3) ──────────────────────────────────────────────────────

interface PodiumProps {
  entry: AMAExpertEntry
  position: 1 | 2 | 3
  metric: 'sessions' | 'attended'
}

function PodiumCard({ entry, position, metric }: PodiumProps) {
  const isFirst = position === 1
  const primaryStat = metric === 'sessions'
    ? { value: entry.session_count, label: 'sessions' }
    : { value: entry.rsvp_count, label: 'RSVPs' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.08 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all hover:border-surface-400',
          isFirst
            ? 'bg-surface-100 border-gold/40 ring-1 ring-gold/20'
            : 'bg-surface-100 border-surface-300'
        )}
      >
        {isFirst && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Crown className="h-6 w-6 text-gold drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
          </div>
        )}

        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size={isFirst ? 'lg' : 'md'}
        />
        <div className="min-w-0 w-full">
          <p className={cn('font-semibold truncate', isFirst ? 'text-sm text-white' : 'text-xs text-white')}>
            {entry.display_name || entry.username}
          </p>
          <p className="text-[10px] text-surface-500 font-mono truncate">@{entry.username}</p>
        </div>

        {/* Category pills */}
        {entry.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {entry.categories.slice(0, 2).map((cat) => {
              const CatIcon = CATEGORY_ICON[cat]
              return (
                <span
                  key={cat}
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono border',
                    CATEGORY_COLOR[cat] ?? 'text-surface-400 border-surface-400/25 bg-surface-400/8'
                  )}
                >
                  {CatIcon && <CatIcon className="h-2 w-2" />}
                  {cat}
                </span>
              )
            })}
          </div>
        )}

        <div className="text-center">
          <p className={cn('font-mono font-bold tabular-nums', isFirst ? 'text-lg text-white' : 'text-base text-white')}>
            {fmtNum(primaryStat.value)}
          </p>
          <p className="text-[10px] text-surface-500 font-mono">{primaryStat.label}</p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

interface RowProps {
  entry: AMAExpertEntry
  index: number
  tab: 'topHosts' | 'mostAttended' | 'rising'
}

function ExpertRow({ entry, index, tab }: RowProps) {
  const primaryStat =
    tab === 'topHosts'
      ? { value: fmtNum(entry.session_count), label: entry.session_count === 1 ? 'session' : 'sessions' }
      : tab === 'mostAttended'
      ? { value: fmtNum(entry.rsvp_count), label: 'RSVPs' }
      : { value: fmtNum(entry.answer_count), label: 'answers' }

  const secondaryStat =
    tab === 'topHosts'
      ? { value: fmtNum(entry.answer_count), label: 'answers' }
      : tab === 'mostAttended'
      ? { value: fmtNum(entry.session_count), label: 'sessions' }
      : { value: fmtNum(entry.rsvp_count), label: 'attended' }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0 hover:bg-surface-200/40 transition-colors group"
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-6 flex items-center justify-center">
          <RankDisplay rank={entry.rank} />
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {entry.display_name || entry.username}
            </p>
            {entry.role && entry.role !== 'person' && (
              <span className={cn('text-[10px] font-mono flex-shrink-0', ROLE_COLOR[entry.role] ?? 'text-surface-500')}>
                {ROLE_LABEL[entry.role] ?? entry.role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-surface-500 font-mono">@{entry.username}</span>
            {/* Category pills */}
            {entry.categories.slice(0, 2).map((cat) => {
              const CatIcon = CATEGORY_ICON[cat]
              return (
                <span
                  key={cat}
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-mono border',
                    CATEGORY_COLOR[cat] ?? 'text-surface-400 border-surface-400/25 bg-surface-400/8'
                  )}
                >
                  {CatIcon && <CatIcon className="h-2 w-2" />}
                  {cat}
                </span>
              )
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-mono font-bold text-white tabular-nums">{primaryStat.value}</p>
          <p className="text-[10px] font-mono text-surface-500">{primaryStat.label}</p>
        </div>
        <div className="flex-shrink-0 text-right hidden sm:block">
          <p className="text-xs font-mono text-surface-400 tabular-nums">{secondaryStat.value}</p>
          <p className="text-[10px] font-mono text-surface-500">{secondaryStat.label}</p>
        </div>

        {/* Last active */}
        {entry.last_session_at && (
          <div className="flex-shrink-0 text-right hidden md:block">
            <p className="text-[10px] font-mono text-surface-600">{relativeTime(entry.last_session_at)}</p>
          </div>
        )}

        <ArrowRight className="h-3 w-3 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </motion.div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabKey = 'topHosts' | 'mostAttended' | 'rising'

const TABS: { key: TabKey; label: string; icon: typeof Mic; description: string }[] = [
  { key: 'topHosts',     label: 'Top Hosts',     icon: Mic,       description: 'Ranked by sessions × answers' },
  { key: 'mostAttended', label: 'Most Attended',  icon: Users,     description: 'Ranked by total community reach' },
  { key: 'rising',       label: 'Rising',         icon: Sparkles,  description: 'High-quality experts from last 90 days' },
]

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-mono', color)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="font-mono text-2xl font-bold text-white tabular-nums">
        <AnimatedNumber value={value} />
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AMALeaderboardPage() {
  const [data, setData] = useState<AMALeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('topHosts')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leaderboard/ama')
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as AMALeaderboardResponse
      setData(json)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const entries = data ? data[tab] : []

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  // Podium order: 2nd, 1st, 3rd (centre is highest)
  const podiumOrder: (1 | 2 | 3)[] = [2, 1, 3]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back nav */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Leaderboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Mic className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">AMA Rankings</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The Lobby&rsquo;s top civic experts by session count, reach, and quality
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh rankings"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <Skeleton className="h-3 w-16 mb-3" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatTile label="Sessions" value={data.stats.total_sessions} icon={Mic} color="text-purple" />
            <StatTile label="Experts" value={data.stats.total_experts} icon={GraduationCap} color="text-gold" />
            <StatTile label="Answers" value={data.stats.total_answers} icon={MessageSquare} color="text-for-400" />
            <StatTile label="Attendees" value={data.stats.total_attendees} icon={Users} color="text-emerald" />
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono whitespace-nowrap flex-shrink-0 transition-all border',
                tab === key
                  ? 'bg-surface-200 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={tab}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="text-xs font-mono text-surface-500 mb-5"
          >
            {TABS.find((t) => t.key === tab)?.description}
          </motion.p>
        </AnimatePresence>

        {loading ? (
          <>
            {/* Podium skeleton */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[1, 0, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center gap-2',
                    i === 0 && 'ring-1 ring-gold/20'
                  )}
                >
                  <Skeleton className={cn('rounded-full', i === 0 ? 'h-14 w-14' : 'h-11 w-11')} />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-6 w-10" />
                </div>
              ))}
            </div>
            {/* List skeleton */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0">
                  <Skeleton className="h-4 w-5 flex-shrink-0" />
                  <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="space-y-1 text-right flex-shrink-0">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No experts yet"
            description="AMA sessions haven't started yet. Be the first to host one."
            action={{ label: 'Host an AMA', href: '/ama' }}
          />
        ) : (
          <>
            {/* Podium — top 3 */}
            {top3.length >= 2 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {podiumOrder.map((pos) => {
                  const entry = top3[pos - 1]
                  if (!entry) return <div key={pos} />
                  return (
                    <PodiumCard
                      key={entry.user_id}
                      entry={entry}
                      position={pos}
                      metric={tab === 'mostAttended' ? 'attended' : 'sessions'}
                    />
                  )
                })}
              </div>
            )}

            {/* Ranked list — 4th and below */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
              {rest.map((entry, index) => (
                <ExpertRow key={entry.user_id} entry={entry} index={index} tab={tab} />
              ))}
              {top3.length < 2 &&
                top3.map((entry, index) => (
                  <ExpertRow key={entry.user_id} entry={entry} index={index} tab={tab} />
                ))}
            </div>

            {/* CTA to experts browse */}
            <div className="mt-6 flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">Browse all experts</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5">Find experts by category and RSVP to upcoming sessions</p>
              </div>
              <Link
                href="/ama/experts"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple/15 border border-purple/30 text-xs font-mono text-purple hover:bg-purple/25 transition-colors flex-shrink-0"
              >
                Explore
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
