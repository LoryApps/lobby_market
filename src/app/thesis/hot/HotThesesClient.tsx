'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Calendar,
  CircleDot,
  Clock,
  Flame,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HotThesisEntry, HotThesesResponse } from '@/app/api/thesis/hot/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics: 'text-gold border-gold/40 bg-gold/10',
  politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  technology: 'text-purple border-purple/40 bg-purple/10',
  science: 'text-emerald border-emerald/40 bg-emerald/10',
  ethics: 'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy: 'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health: 'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

const SECTION_CONFIG = [
  {
    key: 'most_debated' as const,
    label: 'Most Debated',
    icon: Flame,
    color: 'text-against-400',
    iconBg: 'bg-against-500/20 border-against-500/30',
    desc: 'Theses drawing the most engagement from the community',
  },
  {
    key: 'closest_call' as const,
    label: 'Closest Call',
    icon: Scale,
    color: 'text-gold',
    iconBg: 'bg-gold/20 border-gold/30',
    desc: 'Nearest to a 50/50 split — the community is truly divided',
  },
  {
    key: 'oracle_watch' as const,
    label: 'Oracle Watch',
    icon: Clock,
    color: 'text-purple',
    iconBg: 'bg-purple/20 border-purple/30',
    desc: 'Resolving within 30 days — will they be vindicated or refuted?',
  },
  {
    key: 'recently_resolved' as const,
    label: 'Recently Resolved',
    icon: Trophy,
    color: 'text-emerald',
    iconBg: 'bg-emerald/20 border-emerald/30',
    desc: 'Latest verdicts — see who was right',
  },
]

// ─── Thesis Card ──────────────────────────────────────────────────────────────

function ThesisCard({
  entry,
  index,
  showDaysLeft,
  showOutcome,
}: {
  entry: HotThesisEntry
  index: number
  showDaysLeft?: boolean
  showOutcome?: boolean
}) {
  const catColor = CAT_COLORS[entry.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const total = entry.total_engagement
  const agreeWidth = total > 0 ? Math.round(((entry.agree_count) / total) * 100) : 50
  const disagreeWidth = 100 - agreeWidth

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
    >
      <Link href={`/thesis/${entry.id}`}>
        <div className="group flex flex-col gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-150 transition-all cursor-pointer">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {entry.author && (
                <Avatar
                  src={entry.author.avatar_url}
                  username={entry.author.username}
                  size={22}
                  className="flex-shrink-0"
                />
              )}
              <span className="text-[11px] font-mono text-surface-500 truncate">
                {entry.author?.display_name || entry.author?.username || 'Anonymous'}
              </span>
            </div>
            <span
              className={cn(
                'flex-shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border capitalize',
                catColor
              )}
            >
              {entry.category}
            </span>
          </div>

          {/* Statement */}
          <p className="text-sm font-mono text-white leading-relaxed line-clamp-3 group-hover:text-surface-100 transition-colors">
            {entry.statement}
          </p>

          {/* Vote bar */}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                <div
                  className="bg-for-500 transition-all"
                  style={{ width: `${agreeWidth}%` }}
                />
                <div
                  className="bg-against-500 transition-all"
                  style={{ width: `${disagreeWidth}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1 text-for-400">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  {entry.agree_count} agree ({agreeWidth}%)
                </span>
                <span className="flex items-center gap-1 text-against-400">
                  {entry.disagree_count} disagree ({disagreeWidth}%)
                  <ThumbsDown className="h-2.5 w-2.5" />
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showDaysLeft && entry.days_to_resolve !== null && (
                <span className={cn(
                  'flex items-center gap-1 text-[10px] font-mono font-semibold',
                  entry.days_to_resolve <= 7 ? 'text-against-400' : 'text-purple'
                )}>
                  <Clock className="h-3 w-3" />
                  {entry.days_to_resolve <= 0 ? 'Today' : `${entry.days_to_resolve}d left`}
                </span>
              )}
              {showOutcome && (
                <span className={cn(
                  'flex items-center gap-1 text-[10px] font-mono font-bold',
                  entry.status === 'vindicated' ? 'text-gold' : 'text-against-400'
                )}>
                  {entry.status === 'vindicated' ? (
                    <><Trophy className="h-3 w-3" /> Vindicated</>
                  ) : (
                    <><X className="h-3 w-3" /> Refuted</>
                  )}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-surface-500">
              {total} vote{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  config,
  entries,
  loading,
}: {
  config: (typeof SECTION_CONFIG)[number]
  entries: HotThesisEntry[]
  loading: boolean
}) {
  const Icon = config.icon
  const showDaysLeft = config.key === 'oracle_watch'
  const showOutcome = config.key === 'recently_resolved'

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn('h-8 w-8 rounded-xl border flex items-center justify-center flex-shrink-0', config.iconBg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div>
          <h2 className={cn('text-sm font-mono font-bold', config.color)}>{config.label}</h2>
          <p className="text-[10px] font-mono text-surface-500 leading-tight">{config.desc}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="py-6 text-center text-[11px] font-mono text-surface-500">
          Nothing here yet
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <ThesisCard
              key={e.id}
              entry={e}
              index={i}
              showDaysLeft={showDaysLeft}
              showOutcome={showOutcome}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HotThesesClient() {
  const [data, setData] = useState<HotThesesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/thesis/hot')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((d: HotThesesResponse) => setData(d))
      .catch(() => setError('Could not load hot theses — try refreshing.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-against-500/20 border border-against-500/30 flex items-center justify-center flex-shrink-0">
              <Flame className="h-4.5 w-4.5 text-against-400" />
            </div>
            <div>
              <h1 className="text-base font-mono font-bold text-white">Hot Theses</h1>
              <p className="text-[11px] font-mono text-surface-500">
                The sharpest predictions trending now
              </p>
            </div>
          </div>

          {/* Quick nav pills */}
          <div className="flex gap-2 pt-1 overflow-x-auto pb-0.5 scrollbar-none">
            {SECTION_CONFIG.map((s) => {
              const Icon = s.icon
              return (
                <a
                  key={s.key}
                  href={`#${s.key}`}
                  className={cn(
                    'flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-mono font-semibold border transition-colors',
                    'bg-surface-100 border-surface-300 hover:border-surface-400 text-surface-400 hover:text-white'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {s.label}
                </a>
              )
            })}
          </div>
        </motion.div>

        {error ? (
          <EmptyState message={error} />
        ) : (
          SECTION_CONFIG.map((cfg) => (
            <div key={cfg.key} id={cfg.key}>
              <Section
                config={cfg}
                entries={data?.[cfg.key] ?? []}
                loading={loading}
              />
            </div>
          ))
        )}

        {/* Footer link */}
        {!loading && !error && (
          <div className="pt-2 pb-4 flex items-center justify-center gap-4 text-[11px] font-mono text-surface-500">
            <Link href="/thesis" className="hover:text-white transition-colors flex items-center gap-1">
              <CircleDot className="h-3 w-3" />
              Browse all theses
            </Link>
            <span className="text-surface-600">·</span>
            <Link href="/leaderboard/theses" className="hover:text-white transition-colors flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Top forecasters
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
