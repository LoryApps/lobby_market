'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  HelpCircle,
  Lock,
  Mic,
  Target,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { Achievement, AchievementTier } from '@/lib/supabase/types'
import type { AchievementProgress, AchievementProgressResponse } from '@/app/api/achievements/progress/route'
import { cn } from '@/lib/utils/cn'

interface AchievementsGalleryProps {
  allAchievements: Achievement[]
  earnMap: Record<string, number>
  totalProfiles: number
  myEarnedIds: string[]
  showBranchMastery?: boolean
  /** When true, fetches and overlays per-achievement progress for logged-in user */
  showProgress?: boolean
}

type TierFilter = 'all' | AchievementTier
type BranchFilter = 'all' | 'voter' | 'orator' | 'scholar' | 'economist' | 'strategist' | 'citizen'

const TIER_FILTERS: { id: TierFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'epic', label: 'Epic' },
  { id: 'rare', label: 'Rare' },
  { id: 'common', label: 'Common' },
]

const TIER_STYLES: Record<
  AchievementTier,
  {
    label: string
    border: string
    bg: string
    text: string
    iconBg: string
    pill: string
    bar: string
  }
> = {
  legendary: {
    label: 'Legendary',
    border: 'border-gold/50',
    bg: 'bg-gold/10',
    text: 'text-gold',
    iconBg: 'bg-gold/15',
    pill: 'bg-gold/15 border-gold/40 text-gold',
    bar: 'bg-gold',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple/50',
    bg: 'bg-purple/10',
    text: 'text-purple',
    iconBg: 'bg-purple/15',
    pill: 'bg-purple/15 border-purple/40 text-purple',
    bar: 'bg-purple',
  },
  rare: {
    label: 'Rare',
    border: 'border-for-500/50',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    iconBg: 'bg-for-500/15',
    pill: 'bg-for-500/15 border-for-500/40 text-for-400',
    bar: 'bg-for-500',
  },
  common: {
    label: 'Common',
    border: 'border-surface-400/30',
    bg: 'bg-surface-200/40',
    text: 'text-surface-400',
    iconBg: 'bg-surface-300/40',
    pill: 'bg-surface-300/30 border-surface-400/30 text-surface-500',
    bar: 'bg-surface-400',
  },
}

interface BranchMeta {
  label: string
  icon: LucideIcon
  border: string
  bg: string
  text: string
  pill: string
  barColor: string
}

const BRANCH_META: Record<string, BranchMeta> = {
  voter: {
    label: 'Voter',
    icon: ThumbsUp,
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    pill: 'bg-for-500/15 border-for-500/40 text-for-400',
    barColor: '#3b82f6',
  },
  orator: {
    label: 'Orator',
    icon: Mic,
    border: 'border-purple/40',
    bg: 'bg-purple/10',
    text: 'text-purple',
    pill: 'bg-purple/15 border-purple/40 text-purple',
    barColor: '#8b5cf6',
  },
  scholar: {
    label: 'Scholar',
    icon: BookOpen,
    border: 'border-emerald/40',
    bg: 'bg-emerald/10',
    text: 'text-emerald',
    pill: 'bg-emerald/15 border-emerald/40 text-emerald',
    barColor: '#10b981',
  },
  economist: {
    label: 'Economist',
    icon: TrendingUp,
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    text: 'text-gold',
    pill: 'bg-gold/15 border-gold/40 text-gold',
    barColor: '#f59e0b',
  },
  strategist: {
    label: 'Strategist',
    icon: Target,
    border: 'border-against-500/40',
    bg: 'bg-against-500/10',
    text: 'text-against-400',
    pill: 'bg-against-500/15 border-against-500/40 text-against-400',
    barColor: '#ef4444',
  },
  citizen: {
    label: 'Citizen',
    icon: Users,
    border: 'border-surface-400/40',
    bg: 'bg-surface-200/50',
    text: 'text-surface-300',
    pill: 'bg-surface-300/20 border-surface-400/30 text-surface-300',
    barColor: '#a1a1aa',
  },
}

const BRANCH_ORDER: BranchFilter[] = ['voter', 'orator', 'scholar', 'economist', 'strategist', 'citizen']
const TIER_ORDER: AchievementTier[] = ['legendary', 'epic', 'rare', 'common']

function resolveIcon(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>
  return map[name] ?? HelpCircle
}

export function AchievementsGallery({
  allAchievements,
  earnMap,
  totalProfiles,
  myEarnedIds,
  showBranchMastery = true,
  showProgress = false,
}: AchievementsGalleryProps) {
  const [activeTier, setActiveTier] = useState<TierFilter>('all')
  const [activeBranch, setActiveBranch] = useState<BranchFilter>('all')
  const [progressMap, setProgressMap] = useState<Map<string, AchievementProgress>>(new Map())
  const myEarnedSet = new Set(myEarnedIds)

  useEffect(() => {
    if (!showProgress || myEarnedIds.length === 0) return
    fetch('/api/achievements/progress')
      .then((r) => r.ok ? r.json() : null)
      .then((d: AchievementProgressResponse | null) => {
        if (!d?.inProgress) return
        setProgressMap(new Map(d.inProgress.map((p) => [p.id, p])))
      })
      .catch(() => {})
  }, [showProgress, myEarnedIds.length])

  // Compute which branches exist in the data
  const availableBranches = BRANCH_ORDER.filter((b) =>
    allAchievements.some((a) => a.category === b)
  )

  // Branch progress stats (per branch earned / total)
  const branchStats = BRANCH_ORDER.map((branch) => {
    const inBranch = allAchievements.filter((a) => a.category === branch)
    const earned = inBranch.filter((a) => myEarnedSet.has(a.id)).length
    return { branch, total: inBranch.length, earned }
  }).filter((s) => s.total > 0)

  // Filtering logic
  const filtered = allAchievements.filter((a) => {
    if (activeTier !== 'all' && a.tier !== activeTier) return false
    if (activeBranch !== 'all' && a.category !== activeBranch) return false
    return true
  })

  // Sort: earned first, then tier order, then name
  const sorted = [...filtered].sort((a, b) => {
    const ae = myEarnedSet.has(a.id) ? 0 : 1
    const be = myEarnedSet.has(b.id) ? 0 : 1
    if (ae !== be) return ae - be
    const tierDiff = TIER_ORDER.indexOf(a.tier as AchievementTier) - TIER_ORDER.indexOf(b.tier as AchievementTier)
    if (tierDiff !== 0) return tierDiff
    return a.name.localeCompare(b.name)
  })

  if (allAchievements.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
        <TrophyIcon className="h-8 w-8 text-surface-500 mx-auto mb-3" />
        <p className="text-sm font-mono text-surface-500">No achievements defined yet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Branch Mastery Progress (logged-in users) ──────────────────────── */}
      {showBranchMastery && branchStats.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-3">
            Civic Branch Progress
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {branchStats.map(({ branch, total, earned }) => {
              const meta = BRANCH_META[branch]
              if (!meta) return null
              const BranchIcon = meta.icon
              const pct = total > 0 ? Math.round((earned / total) * 100) : 0
              const isActive = activeBranch === branch
              return (
                <button
                  key={branch}
                  onClick={() => setActiveBranch(isActive ? 'all' : branch)}
                  aria-pressed={isActive}
                  className={cn(
                    'group flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                    isActive
                      ? cn(meta.border, meta.bg)
                      : 'border-surface-300 bg-surface-100 hover:border-surface-400',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      isActive ? meta.bg : 'bg-surface-200',
                    )}
                  >
                    <BranchIcon
                      className={cn('h-4 w-4', isActive ? meta.text : 'text-surface-500')}
                      aria-hidden
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-mono font-semibold',
                      isActive ? meta.text : 'text-surface-400',
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-mono text-surface-500">
                    {earned}/{total}
                  </span>
                  <div className="w-full h-0.5 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: meta.barColor }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tier filter pills ───────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label="Filter by tier">
        {TIER_FILTERS.map((f) => {
          const isActive = activeTier === f.id
          const tierStyle = f.id !== 'all' ? TIER_STYLES[f.id as AchievementTier] : null
          const count =
            f.id === 'all'
              ? undefined
              : allAchievements.filter((a) => {
                  if (a.tier !== f.id) return false
                  if (activeBranch !== 'all' && a.category !== activeBranch) return false
                  return true
                }).length
          return (
            <button
              key={f.id}
              onClick={() => setActiveTier(f.id)}
              aria-pressed={isActive}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                isActive
                  ? tierStyle
                    ? tierStyle.pill
                    : 'bg-white/10 border-white/20 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
              )}
            >
              {f.label}
              {count !== undefined && (
                <span className="ml-1.5 opacity-60">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Branch filter pills (when showing all branches) ─────────────────── */}
      {availableBranches.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter by civic branch">
          <button
            onClick={() => setActiveBranch('all')}
            aria-pressed={activeBranch === 'all'}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-mono font-medium border transition-all',
              activeBranch === 'all'
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
            )}
          >
            All Branches
          </button>
          {availableBranches.map((branch) => {
            const meta = BRANCH_META[branch]
            if (!meta) return null
            const BranchIcon = meta.icon
            const isActive = activeBranch === branch
            const count = allAchievements.filter((a) => {
              if (a.category !== branch) return false
              if (activeTier !== 'all' && a.tier !== activeTier) return false
              return true
            }).length
            return (
              <button
                key={branch}
                onClick={() => setActiveBranch(isActive ? 'all' : branch)}
                aria-pressed={isActive}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium border transition-all',
                  isActive
                    ? meta.pill
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
                )}
              >
                <BranchIcon className="h-3 w-3 flex-shrink-0" aria-hidden />
                {meta.label}
                <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {sorted.map((achievement, idx) => {
            const earned = myEarnedSet.has(achievement.id)
            const tier = achievement.tier as AchievementTier
            const style = TIER_STYLES[tier]
            const Icon = resolveIcon(achievement.icon ?? '')
            const earnCount = earnMap[achievement.id] ?? 0
            const rarityPct =
              totalProfiles > 0
                ? Math.round((earnCount / totalProfiles) * 100 * 10) / 10
                : 0
            const branchMeta = achievement.category ? BRANCH_META[achievement.category] : null
            const BranchIconSmall = branchMeta?.icon
            const progress = !earned ? progressMap.get(achievement.id) : undefined

            return (
              <motion.div
                key={achievement.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
              >
                <Link
                  href={`/achievements/${achievement.id}`}
                  className={cn(
                    'group relative flex items-start gap-4 rounded-2xl border p-4 transition-all',
                    'hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                    earned
                      ? cn(style.border, style.bg)
                      : 'border-surface-300 bg-surface-100 opacity-70',
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                      earned ? style.iconBg : 'bg-surface-300/40',
                    )}
                    aria-hidden
                  >
                    {earned ? (
                      <Icon className={cn('h-5 w-5', style.text)} />
                    ) : (
                      <Lock className="h-5 w-5 text-surface-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span
                        className={cn(
                          'text-sm font-semibold font-mono truncate',
                          earned ? 'text-white' : 'text-surface-500',
                        )}
                      >
                        {achievement.name}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border flex-shrink-0',
                          style.pill,
                        )}
                      >
                        {style.label}
                      </span>
                    </div>

                    <p
                      className={cn(
                        'text-xs font-mono leading-relaxed line-clamp-2',
                        earned ? 'text-surface-400' : 'text-surface-600',
                      )}
                    >
                      {achievement.description}
                    </p>

                    {/* Progress bar — shown on unearned achievements when logged in */}
                    {progress && progress.pct > 0 && (
                      <div className="mt-2 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-surface-600">
                            {progress.current.toLocaleString()} / {progress.threshold.toLocaleString()}
                          </span>
                          <span className={cn('text-[10px] font-mono font-semibold', style.text)}>
                            {progress.pct}%
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-surface-300/50 overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-full', style.bar)}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.pct}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Branch + Rarity row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {branchMeta && BranchIconSmall && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-mono',
                            branchMeta.text,
                            'opacity-70',
                          )}
                        >
                          <BranchIconSmall className="h-3 w-3" aria-hidden />
                          {branchMeta.label}
                        </span>
                      )}
                      {branchMeta && (
                        <span className="text-surface-600 text-[10px]">·</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Icons.Users className="h-3 w-3 text-surface-600 flex-shrink-0" aria-hidden />
                        <span className="text-[10px] font-mono text-surface-600">
                          {earnCount === 0
                            ? 'No earners yet'
                            : earnCount === 1
                            ? '1 earner'
                            : `${earnCount.toLocaleString()} earners`}
                          {totalProfiles > 0 && earnCount > 0
                            ? ` · ${rarityPct < 0.1 ? '<0.1' : rarityPct}%`
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Earned check */}
                  {earned && (
                    <div
                      aria-label="Earned"
                      className={cn(
                        'absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full',
                        style.bg,
                        style.text,
                        'border',
                        style.border,
                      )}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {sorted.length === 0 && (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-10 text-center">
          <p className="text-sm font-mono text-surface-500">
            {activeBranch !== 'all' && activeTier !== 'all'
              ? `No ${activeTier} achievements in the ${BRANCH_META[activeBranch]?.label ?? activeBranch} branch.`
              : activeBranch !== 'all'
              ? `No achievements in the ${BRANCH_META[activeBranch]?.label ?? activeBranch} branch.`
              : `No achievements in this tier.`}
          </p>
        </div>
      )}
    </div>
  )
}

function TrophyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 2h12M6 2v6a6 6 0 0012 0V2M6 2H4a2 2 0 00-2 2v2a4 4 0 004 4h.06M18 2h2a2 2 0 012 2v2a4 4 0 01-4 4h-.06M12 14v4M8 22h8"
      />
    </svg>
  )
}
