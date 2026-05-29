'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  ChevronRight,
  Cpu,
  Crown,
  ExternalLink,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  Quote,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  BookOpen,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CategoryExpert, CategoryExpertsResponse } from '@/app/api/categories/[category]/experts/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: typeof TrendingUp
  color: string
  bg: string
  border: string
  ring: string
  tagline: string
}> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         ring: 'ring-gold/20',         tagline: 'Markets, trade & fiscal policy' },
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      ring: 'ring-for-500/20',      tagline: 'Governance, elections & power' },
  Technology:  { icon: Cpu,           color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       ring: 'ring-purple/20',       tagline: 'AI, digital rights & innovation' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      ring: 'ring-emerald/20',      tagline: 'Research, climate & evidence' },
  Ethics:      { icon: Scale,         color: 'text-against-300',  bg: 'bg-against-600/10',  border: 'border-against-500/30',  ring: 'ring-against-500/20',  tagline: 'Moral philosophy & justice' },
  Philosophy:  { icon: BookOpen,      color: 'text-for-300',      bg: 'bg-for-500/10',      border: 'border-for-400/30',      ring: 'ring-for-400/20',      tagline: 'Foundations of thought & reason' },
  Culture:     { icon: Music2,        color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         ring: 'ring-gold/20',         tagline: 'Arts, identity & society' },
  Health:      { icon: Heart,         color: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  ring: 'ring-against-400/20',  tagline: 'Medicine, wellness & public health' },
  Environment: { icon: Leaf,          color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      ring: 'ring-emerald/20',      tagline: 'Ecology, climate & conservation' },
  Education:   { icon: GraduationCap, color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       ring: 'ring-purple/20',       tagline: 'Learning, schooling & curricula' },
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  elder:         { label: 'Elder',          color: 'text-gold border-gold/40 bg-gold/10' },
  senator:       { label: 'Senator',        color: 'text-purple border-purple/40 bg-purple/10' },
  lawmaker:      { label: 'Lawmaker',       color: 'text-gold border-gold/50 bg-gold/15' },
  debator:       { label: 'Debator',        color: 'text-for-300 border-for-500/40 bg-for-500/10' },
  troll_catcher: { label: 'Troll Catcher',  color: 'text-emerald border-emerald/40 bg-emerald/10' },
  person:        { label: 'Citizen',        color: 'text-surface-400 border-surface-400/40 bg-surface-300/10' },
}

function roleInfo(role: string) {
  return ROLE_BADGE[role] ?? ROLE_BADGE.person
}

// ─── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1 w-full rounded-full bg-surface-300 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── AI score pill ─────────────────────────────────────────────────────────────

function AiScorePill({ score }: { score: number | null }) {
  if (score === null) return null
  const color =
    score >= 80 ? 'text-emerald border-emerald/40 bg-emerald/10' :
    score >= 60 ? 'text-for-400 border-for-500/40 bg-for-500/10' :
    score >= 40 ? 'text-gold border-gold/40 bg-gold/10' :
    'text-surface-500 border-surface-400/40 bg-surface-300/10'
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold', color)}>
      <Sparkles className="h-2.5 w-2.5" />
      {score}
    </span>
  )
}

// ─── Expert card ──────────────────────────────────────────────────────────────

function ExpertCard({
  expert,
  rank,
  maxUpvotes,
  categoryColor,
}: {
  expert: CategoryExpert
  rank: number
  maxUpvotes: number
  categoryColor: string
}) {
  const role = roleInfo(expert.role)
  const isTop3 = rank <= 3
  const rankColor =
    rank === 1 ? 'text-gold' :
    rank === 2 ? 'text-surface-300' :
    rank === 3 ? 'text-against-300' :
    'text-surface-500'
  const rankBg =
    rank === 1 ? 'bg-gold/10 border-gold/30' :
    rank === 2 ? 'bg-surface-200 border-surface-300' :
    rank === 3 ? 'bg-against-600/10 border-against-500/30' :
    'bg-surface-200/50 border-surface-300/50'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 flex flex-col gap-4 transition-colors hover:border-surface-400/60',
        isTop3 ? 'border-surface-300' : 'border-surface-200'
      )}
    >
      {/* Header: rank + avatar + name + badges */}
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-xl border text-sm font-mono font-bold',
          rankBg, rankColor
        )}>
          {rank === 1 ? <Crown className="h-4 w-4" /> : rank}
        </div>

        {/* Avatar */}
        <Link href={`/profile/${expert.username}`} className="flex-shrink-0">
          <Avatar
            src={expert.avatar_url}
            fallback={expert.display_name || expert.username}
            size="md"
            className={cn(isTop3 && 'ring-2 ring-offset-2 ring-offset-surface-100', isTop3 && categoryColor.replace('text-', 'ring-'))}
          />
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${expert.username}`}
              className="font-mono font-bold text-white hover:text-for-300 transition-colors text-sm truncate"
            >
              {expert.display_name || expert.username}
            </Link>
            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium', role.color)}>
              {role.label}
            </span>
            <AiScorePill score={expert.avg_ai_score} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] font-mono text-surface-500">@{expert.username}</span>
            <span className="text-surface-600 text-[11px]">·</span>
            <span className="text-[11px] font-mono text-gold">{expert.clout.toLocaleString()} clout</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-200/60 border border-surface-300/60 px-2 py-2">
          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          <span className="text-base font-mono font-bold text-white">{expert.total_upvotes.toLocaleString()}</span>
          <span className="text-[10px] font-mono text-surface-500">upvotes</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-200/60 border border-surface-300/60 px-2 py-2">
          <MessageSquare className="h-3.5 w-3.5 text-purple" />
          <span className="text-base font-mono font-bold text-white">{expert.argument_count}</span>
          <span className="text-[10px] font-mono text-surface-500">arguments</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-200/60 border border-surface-300/60 px-2 py-2">
          <Gavel className="h-3.5 w-3.5 text-gold" />
          <span className="text-base font-mono font-bold text-white">{expert.law_count}</span>
          <span className="text-[10px] font-mono text-surface-500">laws</span>
        </div>
      </div>

      {/* Upvote bar */}
      <ScoreBar value={expert.total_upvotes} max={maxUpvotes} color={categoryColor.replace('text-', 'bg-')} />

      {/* Best argument */}
      {expert.best_argument && (
        <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Quote className="h-3 w-3 text-surface-500 flex-shrink-0" />
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Best argument</span>
            {expert.best_argument_upvotes > 0 && (
              <span className="ml-auto text-[10px] font-mono text-for-400 flex items-center gap-0.5">
                <ThumbsUp className="h-2.5 w-2.5" /> {expert.best_argument_upvotes}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-3">
            {expert.best_argument}
          </p>
          {expert.best_argument_topic && (
            <p className="text-[10px] font-mono text-surface-600 truncate">
              on: {expert.best_argument_topic}
            </p>
          )}
          {expert.best_argument_id && (
            <Link
              href={`/arguments/${expert.best_argument_id}`}
              className="inline-flex items-center gap-1 text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors mt-0.5"
            >
              Read full argument <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      )}

      {/* Profile link */}
      <Link
        href={`/profile/${expert.username}`}
        className="flex items-center justify-between gap-2 rounded-lg bg-surface-200/40 border border-surface-300/40 px-3 py-2 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors"
      >
        <span>View full profile</span>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ExpertCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-200 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
      <Skeleton className="h-20 rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  category: string
  slug: string
}

export function ExpertsClient({ category, slug }: Props) {
  const [data, setData] = useState<CategoryExpertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Politics
  const Icon = cfg.icon

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/categories/${slug}/experts`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as CategoryExpertsResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  const maxUpvotes = data ? Math.max(1, ...data.experts.map((e) => e.total_upvotes)) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={`/categories/${slug}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back to category"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <nav className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <Link href="/categories" className="hover:text-white transition-colors">Categories</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/categories/${slug}`} className="hover:text-white transition-colors">{category}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">Experts</span>
          </nav>
        </div>

        {/* Header */}
        <div className={cn(
          'rounded-3xl border p-6 mb-6',
          cfg.bg, cfg.border
        )}>
          <div className="flex items-start gap-4">
            <div className={cn('flex items-center justify-center h-12 w-12 rounded-2xl border flex-shrink-0', cfg.bg, cfg.border)}>
              <Icon className={cn('h-6 w-6', cfg.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={cn('font-mono text-2xl font-bold', cfg.color)}>
                  {category} Experts
                </h1>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold', cfg.bg, cfg.border, cfg.color)}>
                  <Trophy className="h-3 w-3" /> Top Voices
                </span>
              </div>
              <p className="text-sm font-mono text-surface-400 mt-1">{cfg.tagline}</p>
            </div>
          </div>

          {/* Stats row */}
          {data && !loading && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-300/40 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <Users className="h-3.5 w-3.5" />
                <span>{data.experts.length} ranked contributors</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{data.total_arguments.toLocaleString()} total arguments</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <BarChart2 className="h-3.5 w-3.5" />
                <span>{data.total_votes_in_category.toLocaleString()} votes cast in {category}</span>
              </div>
            </div>
          )}
        </div>

        {/* How scoring works */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 mb-6 flex items-start gap-3">
          <Award className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Experts are ranked by a composite score: community upvotes (60%), AI argument quality score (30%), and volume of contributions (10%).
          </p>
        </div>

        {/* Refresh */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono font-bold text-white">
            {loading ? 'Loading…' : `Top ${data?.experts.length ?? 0} Contributors`}
          </h2>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4">
              {[0, 1, 2, 3].map((i) => <ExpertCardSkeleton key={i} />)}
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Zap}
                iconColor="text-against-400"
                iconBg="bg-against-500/10"
                iconBorder="border-against-500/30"
                title="Couldn't load experts"
                description="There was an error loading this data. Try refreshing."
                actions={[{ label: 'Try again', onClick: load }]}
              />
            </motion.div>
          ) : data && data.experts.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={MessageSquare}
                iconColor={cfg.color}
                iconBg={cfg.bg}
                iconBorder={cfg.border}
                title={`No experts yet in ${category}`}
                description="Be the first to write arguments in this category and earn your place on the leaderboard."
                actions={[{ label: `Browse ${category} topics`, href: `/categories/${slug}` }]}
              />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4">
              {(data?.experts ?? []).map((expert, i) => (
                <ExpertCard
                  key={expert.user_id}
                  expert={expert}
                  rank={i + 1}
                  maxUpvotes={maxUpvotes}
                  categoryColor={cfg.color}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer links */}
        {!loading && !error && data && data.experts.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/categories/${slug}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Icon className="h-4 w-4" />
              Browse {category} Topics
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Trophy className="h-4 w-4" />
              Global Leaderboard
            </Link>
            <Link
              href="/ladder"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Argument Ladder
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
