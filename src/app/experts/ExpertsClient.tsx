'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  HelpCircle,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CategoryExpert, CategorySection, ExpertsResponse } from '@/app/api/experts/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: typeof TrendingUp
  color: string
  bg: string
  border: string
}> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30'    },
  Economics:   { icon: TrendingUp,    color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Technology:  { icon: Cpu,           color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { icon: FlaskConical,  color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { icon: Scale,         color: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30'     },
  Philosophy:  { icon: BookOpen,      color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Culture:     { icon: Music2,        color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Health:      { icon: Heart,         color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { icon: GraduationCap, color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Environment: { icon: Leaf,          color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
}

function getCategoryConfig(name: string) {
  return CATEGORY_CONFIG[name] ?? {
    icon: BookOpen,
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  }
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  sage: {
    label: 'Sage',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/30',
  },
  expert: {
    label: 'Expert',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    ring: 'ring-purple/30',
  },
  contributor: {
    label: 'Contributor',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/30',
  },
}

// ─── Expert card ──────────────────────────────────────────────────────────────

function ExpertCard({
  expert,
  rank,
  delay = 0,
}: {
  expert: CategoryExpert
  rank?: number
  delay?: number
}) {
  const tier = TIER_CONFIG[expert.tier]
  const isTopThree = rank !== undefined && rank < 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-2xl border transition-colors',
        isTopThree
          ? 'bg-surface-200 border-surface-400/60'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Rank indicator */}
      {rank !== undefined && (
        <span className={cn(
          'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-xs font-mono font-bold border',
          rank === 0 ? 'bg-gold/10 border-gold/30 text-gold' :
          rank === 1 ? 'bg-surface-300/30 border-surface-400/30 text-surface-400' :
          rank === 2 ? 'bg-amber-900/20 border-amber-700/30 text-amber-600' :
          'bg-surface-200 border-surface-300/60 text-surface-500'
        )}>
          {rank + 1}
        </span>
      )}

      {/* Avatar with tier ring */}
      <Link
        href={`/profile/${expert.username}`}
        className={cn(
          'flex-shrink-0 rounded-full ring-2',
          tier.ring
        )}
      >
        <Avatar
          src={expert.avatar_url}
          fallback={expert.display_name ?? expert.username}
          size="sm"
          className="h-10 w-10"
        />
      </Link>

      {/* Name + tier badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${expert.username}`}
            className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {expert.display_name ?? expert.username}
          </Link>
          <span className={cn(
            'flex-shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border',
            tier.color, tier.bg, tier.border
          )}>
            {tier.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-surface-500">
          <span>@{expert.username}</span>
          <span className="text-surface-600">·</span>
          <Star className="h-3 w-3 text-gold" />
          <span className="text-gold font-medium">{expert.accepted_count} accepted</span>
          {expert.total_answers > 0 && (
            <>
              <span className="text-surface-600">·</span>
              <span>{expert.total_answers} answers</span>
            </>
          )}
        </div>
      </div>

      {/* Ask button */}
      <Link
        href={`/questions?expert=${expert.username}&category=${encodeURIComponent(expert.category)}`}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/30 text-xs font-mono font-semibold transition-colors"
        aria-label={`Ask ${expert.display_name ?? expert.username} a question`}
      >
        <HelpCircle className="h-3 w-3" />
        <span className="hidden sm:inline">Ask</span>
      </Link>
    </motion.div>
  )
}

// ─── Top sages banner ─────────────────────────────────────────────────────────

function TopSagesBanner({ sages }: { sages: CategoryExpert[] }) {
  if (sages.length === 0) return null
  return (
    <div className="mb-6 rounded-2xl bg-gold/5 border border-gold/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-gold" />
        <span className="text-sm font-mono font-bold text-gold">Platform Sages</span>
        <span className="text-xs font-mono text-surface-500 ml-1">Top cross-category experts</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {sages.map((sage) => (
          <Link
            key={sage.user_id}
            href={`/profile/${sage.username}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-200/60 border border-gold/20 hover:border-gold/40 transition-colors"
          >
            <Avatar
              src={sage.avatar_url}
              fallback={sage.display_name ?? sage.username}
              size="xs"
              className="h-7 w-7 ring-1 ring-gold/40"
            />
            <div>
              <p className="text-xs font-semibold text-white leading-tight">
                {sage.display_name ?? sage.username}
              </p>
              <p className="text-[10px] text-gold font-mono">{sage.category} · Sage</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategoryExpertSection({ section }: { section: CategorySection }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = getCategoryConfig(section.category)
  const Icon = cfg.icon

  const topExperts = [
    ...section.sages,
    ...section.experts,
    ...section.contributors,
  ].slice(0, expanded ? 10 : 5)

  if (topExperts.length === 0) return null

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg border', cfg.bg, cfg.border)}>
          <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
        </div>
        <h2 className="text-sm font-mono font-bold text-white">{section.category}</h2>
        <span className="text-xs font-mono text-surface-500">
          {section.total_experts} expert{section.total_experts !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {topExperts.map((expert, i) => (
          <ExpertCard key={expert.user_id} expert={expert} rank={i} delay={i * 0.03} />
        ))}
      </div>

      {[...section.sages, ...section.experts, ...section.contributors].length > 5 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 w-full py-2.5 text-xs font-mono font-medium text-surface-500 hover:text-white border border-surface-300/60 rounded-xl hover:border-surface-400 transition-colors"
        >
          {expanded
            ? 'Show less'
            : `Show ${[...section.sages, ...section.experts, ...section.contributors].length - 5} more`}
        </button>
      )}
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({
  stats,
}: {
  stats: ExpertsResponse['stats']
}) {
  const items = [
    { label: 'Sages', value: stats.total_sages, color: 'text-gold', icon: Star },
    { label: 'Experts', value: stats.total_experts, color: 'text-purple', icon: GraduationCap },
    { label: 'Contributors', value: stats.total_contributors, color: 'text-emerald', icon: Users },
    { label: 'Categories', value: stats.categories_with_experts, color: 'text-for-400', icon: BookOpen },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map(({ label, value, color, icon: Icon }) => (
        <div
          key={label}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center"
        >
          <Icon className={cn('h-4 w-4 mx-auto mb-1.5', color)} />
          <p className="text-xl font-mono font-bold text-white">{value}</p>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Philosophy',
  'Science',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

export function ExpertsClient() {
  const [data, setData] = useState<ExpertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const load = useCallback(async (cat: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = cat === 'All' ? '/api/experts' : `/api/experts?category=${encodeURIComponent(cat)}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load experts')
      const json = await res.json() as ExpertsResponse
      setData(json)
    } catch (_e) {
      setError('Could not load the expert directory. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(activeCategory)
  }, [load, activeCategory])

  const visibleCategories = activeCategory === 'All'
    ? (data?.categories ?? [])
    : (data?.categories ?? []).filter((s) => s.category === activeCategory)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 mb-6"
        >
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono text-2xl font-bold text-white">Expert Directory</h1>
              <Link
                href="/questions"
                className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                Browse Q&amp;A
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Citizens ranked by accepted answers — the Lobby&apos;s most trusted voices by category.
            </p>
          </div>
          <button
            onClick={() => load(activeCategory)}
            disabled={loading}
            aria-label="Refresh expert list"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </motion.div>

        {/* Stats */}
        {data && !loading && <StatsStrip stats={data.stats} />}
        {loading && !data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-4 w-4 mx-auto" />
                <Skeleton className="h-6 w-10 mx-auto" />
                <Skeleton className="h-3 w-14 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat
            const cfg = cat !== 'All' ? getCategoryConfig(cat) : null
            const Icon = cfg?.icon ?? BookOpen
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold flex-shrink-0 border transition-all',
                  isActive
                    ? cat === 'All'
                      ? 'bg-gold text-surface-900 border-gold'
                      : cn(cfg?.bg, cfg?.border, cfg?.color)
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
                aria-pressed={isActive}
              >
                {cat !== 'All' && <Icon className="h-3 w-3" />}
                {cat}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-100 border border-surface-300">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-14 rounded-full" />
                        <Skeleton className="h-4 w-20 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-16 rounded-lg" />
                  </div>
                ))}
              </div>
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={GraduationCap}
                iconColor="text-against-400"
                iconBg="bg-against-500/10"
                iconBorder="border-against-500/30"
                title="Could not load experts"
                description={error}
                action={{ label: 'Try again', onClick: () => load(activeCategory) }}
              />
            </motion.div>
          ) : visibleCategories.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={GraduationCap}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title="No experts yet"
                description={
                  activeCategory === 'All'
                    ? 'Be the first to earn expertise by answering questions on civic topics.'
                    : `No ${activeCategory} experts yet. Answer questions in this category to earn your badge.`
                }
                action={{ label: 'Browse Q&A', href: '/questions', icon: MessageSquare }}
              />
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Top sages banner — only shown in "All" view */}
              {activeCategory === 'All' && data && (
                <TopSagesBanner sages={data.topSages.slice(0, 8)} />
              )}

              {/* Category sections */}
              {visibleCategories.map((section) => (
                <CategoryExpertSection key={section.category} section={section} />
              ))}

              {/* Footer CTA */}
              <div className="mt-6 p-5 rounded-2xl bg-surface-100 border border-surface-300 text-center">
                <p className="text-sm font-mono text-surface-400 mb-3">
                  Want to appear in this directory? Answer questions in your area of expertise.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/questions"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Browse questions
                  </Link>
                  <Link
                    href="/questions/leaders"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 text-sm font-mono font-semibold transition-colors"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Leaderboard
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
