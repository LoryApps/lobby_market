'use client'

/**
 * /seasons — Civic Hall of Fame
 *
 * An all-time record of every civic season on Lobby Market:
 * the current active season (with live leaderboard link) and
 * all concluded seasons with their champion and podium.
 *
 * Serves as institutional memory for the platform — citizens
 * can see who shaped history in each chapter.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  RefreshCw,
  Scroll,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SeasonsResponse, SeasonRecord, SeasonChampion } from '@/app/api/seasons/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function relativeDate(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return 'Today'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

// ─── Medal badge ──────────────────────────────────────────────────────────────

const MEDAL_CONFIG = [
  { label: '1st', bg: 'bg-gold/15', border: 'border-gold/40', text: 'text-gold' },
  { label: '2nd', bg: 'bg-for-500/10', border: 'border-for-500/30', text: 'text-for-300' },
  { label: '3rd', bg: 'bg-surface-300/20', border: 'border-surface-400/30', text: 'text-surface-400' },
]

function PodiumRow({
  entry,
  rank,
  themeColor,
}: {
  entry: SeasonChampion
  rank: number
  themeColor: string
}) {
  const medal = MEDAL_CONFIG[rank] ?? MEDAL_CONFIG[2]
  const isFirst = rank === 0

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-5 w-8 rounded text-[10px] font-mono font-bold border',
          medal.bg,
          medal.border,
          medal.text
        )}
      >
        {medal.label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="xs"
        />
        <span className={cn('text-xs font-mono truncate', isFirst ? 'text-white font-semibold' : 'text-surface-300')}>
          {entry.display_name || entry.username}
        </span>
      </div>
      <span
        className="flex-shrink-0 text-[11px] font-mono font-semibold"
        style={{ color: isFirst ? themeColor : undefined }}
      >
        {entry.total_pts.toLocaleString()} pts
      </span>
    </div>
  )
}

// ─── Active season card ────────────────────────────────────────────────────────

function ActiveSeasonCard({ season }: { season: SeasonRecord }) {
  const remaining = daysLeft(season.ends_at)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Link
        href="/season"
        className="block rounded-2xl border bg-surface-100 hover:bg-surface-200/80 transition-colors overflow-hidden group"
        style={{ borderColor: season.theme_color + '50' }}
      >
        {/* Top accent */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${season.theme_color} 50%, transparent 100%)` }}
        />

        <div className="p-5 space-y-4">
          {/* Status row */}
          <div className="flex items-center justify-between gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold border"
              style={{
                backgroundColor: season.theme_color + '18',
                borderColor: season.theme_color + '50',
                color: season.theme_color,
              }}
            >
              <Flame className="h-3 w-3" aria-hidden="true" />
              LIVE NOW
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {remaining}d remaining
            </div>
          </div>

          {/* Season title */}
          <div>
            <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">Current Season</p>
            <h2
              className="text-xl font-mono font-bold text-white group-hover:text-surface-100 transition-colors"
            >
              {season.name}
            </h2>
            {season.tagline && (
              <p className="text-sm font-mono text-surface-400 mt-1 leading-relaxed">{season.tagline}</p>
            )}
          </div>

          {/* Podium preview */}
          {season.podium.length > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Current Standings</p>
              {season.podium.map((entry, i) => (
                <PodiumRow key={entry.user_id} entry={entry} rank={i} themeColor={season.theme_color} />
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-surface-600 italic">No participants yet — be the first to earn Season Points</p>
          )}

          {/* Stats row */}
          <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
            <span className="text-surface-600">
              {season.participant_count.toLocaleString()} participant{season.participant_count !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1 text-surface-400 group-hover:text-white transition-colors">
              View leaderboard <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Past season card ──────────────────────────────────────────────────────────

function PastSeasonCard({ season, index }: { season: SeasonRecord; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4 hover:border-surface-400 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: season.theme_color }}
              />
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">
                {formatDate(season.starts_at)} – {formatDate(season.ends_at)}
              </p>
            </div>
            <h3 className="text-base font-mono font-bold text-white leading-tight">{season.name}</h3>
            {season.tagline && (
              <p className="text-[12px] font-mono text-surface-500 mt-0.5 line-clamp-2">{season.tagline}</p>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono text-surface-600">{relativeDate(season.ends_at)}</span>
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              {season.participant_count}
            </div>
          </div>
        </div>

        {/* Podium */}
        {season.podium.length > 0 ? (
          <div className="space-y-2">
            {season.podium.map((entry, i) => (
              <PodiumRow key={entry.user_id} entry={entry} rank={i} themeColor={season.theme_color} />
            ))}
          </div>
        ) : (
          <p className="text-xs font-mono text-surface-600 italic">No recorded participants</p>
        )}

        {/* Champion CTA */}
        {season.champion && (
          <div className="flex items-center gap-2 pt-1">
            <Crown className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden="true" />
            <span className="text-xs font-mono text-surface-500">
              Champion:{' '}
              <Link
                href={`/profile/${season.champion.username}`}
                className="text-white hover:text-gold transition-colors font-semibold"
              >
                {season.champion.display_name || season.champion.username}
              </Link>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SeasonSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="space-y-2 pt-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-8 rounded" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeasonsPage() {
  const [data, setData] = useState<SeasonsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/seasons', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as SeasonsResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalSeasons = (data?.active ? 1 : 0) + (data?.past.length ?? 0)
  const totalChampions = (data?.past.filter((s) => s.champion).length ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Seasons Hall of Fame</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">Every season, every champion</p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh seasons"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Summary stats */}
          {!loading && data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-3 gap-3"
            >
              {[
                { icon: Scroll, label: 'Seasons', value: totalSeasons, color: 'text-gold' },
                { icon: Award, label: 'Champions', value: totalChampions, color: 'text-for-400' },
                {
                  icon: Star,
                  label: 'Active',
                  value: data.active ? 1 : 0,
                  color: 'text-emerald',
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300"
                >
                  <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                  <span className="text-lg font-mono font-bold text-white">{value}</span>
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* How seasons work */}
        <div className="mb-6 rounded-xl bg-surface-100 border border-surface-300 p-4">
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            Each season spans ~30 days. Earn{' '}
            <span className="text-white">Season Points</span>{' '}
            for every vote (1pt), argument (5pts), debate (10pts), correct prediction (15pts), and law you help pass (25pts). Top citizens earn{' '}
            <span className="text-gold">exclusive seasonal titles</span>{' '}
            that appear on their profile forever.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/season"
              className="flex items-center gap-1.5 text-xs font-mono font-semibold text-for-400 hover:text-for-300 transition-colors"
            >
              View live leaderboard <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading && (
          <div className="space-y-4">
            <SeasonSkeleton />
            <SeasonSkeleton />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={Zap}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="Couldn't load seasons"
            description="The hall of records is temporarily unavailable."
            actions={[{ label: 'Retry', onClick: load }]}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Active season */}
            {data.active && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="h-4 w-4 text-against-400" aria-hidden="true" />
                  <h2 className="text-sm font-mono font-semibold text-white uppercase tracking-wider">Active Season</h2>
                </div>
                <ActiveSeasonCard season={data.active} />
              </section>
            )}

            {/* Past seasons */}
            {data.past.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-4 w-4 text-gold" aria-hidden="true" />
                  <h2 className="text-sm font-mono font-semibold text-white uppercase tracking-wider">Past Champions</h2>
                </div>
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {data.past.map((season, i) => (
                      <PastSeasonCard key={season.id} season={season} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Empty — no seasons at all */}
            {!data.active && data.past.length === 0 && (
              <EmptyState
                icon={Trophy}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title="No seasons yet"
                description="The first civic season hasn't started. Check back soon."
                actions={[{ label: 'Go to feed', href: '/' }]}
              />
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
