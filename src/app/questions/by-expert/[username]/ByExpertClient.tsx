'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  HelpCircle,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  Scale,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ByExpertResponse,
  ExpertAnswerItem,
  ExpertTierInfo,
} from '@/app/api/questions/by-expert/[username]/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string; border: string }> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30'    },
  Economics:   { icon: TrendingUp,    color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30'       },
  Technology:  { icon: Cpu,           color: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30'     },
  Science:     { icon: FlaskConical,  color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30'    },
  Ethics:      { icon: Scale,         color: 'text-for-300',    bg: 'bg-for-400/10',    border: 'border-for-400/30'    },
  Philosophy:  { icon: BookOpen,      color: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30'     },
  Culture:     { icon: Music2,        color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Health:      { icon: Heart,         color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30'    },
  Education:   { icon: GraduationCap, color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30'       },
  Environment: { icon: Leaf,          color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30'    },
}

const DEFAULT_CAT_CONFIG = {
  icon: HelpCircle,
  color: 'text-surface-500',
  bg: 'bg-surface-300/20',
  border: 'border-surface-300/30',
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  sage:        { label: 'Sage',        color: 'text-gold',     bg: 'bg-gold/10',    border: 'border-gold/30'    },
  expert:      { label: 'Expert',      color: 'text-purple',   bg: 'bg-purple/10',  border: 'border-purple/30'  },
  contributor: { label: 'Contributor', color: 'text-for-400',  bg: 'bg-for-500/10', border: 'border-for-500/30' },
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: ExpertTierInfo['tier'] }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
        cfg.color,
        cfg.bg,
        cfg.border
      )}
    >
      <Star className="h-2.5 w-2.5" aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

function ExpertiseCard({ info }: { info: ExpertTierInfo }) {
  const catCfg = CATEGORY_CONFIG[info.category] ?? DEFAULT_CAT_CONFIG
  const CatIcon = catCfg.icon
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border',
        catCfg.bg,
        catCfg.border
      )}
    >
      <CatIcon className={cn('h-4 w-4 flex-shrink-0', catCfg.color)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-semibold truncate', catCfg.color)}>{info.category}</div>
        <div className="text-[10px] text-surface-500 font-mono">
          {info.accepted_count} accepted
        </div>
      </div>
      <TierBadge tier={info.tier} />
    </div>
  )
}

function AnswerCard({ answer }: { answer: ExpertAnswerItem }) {
  const topicCat = answer.topic?.category ?? null
  const catCfg = topicCat ? (CATEGORY_CONFIG[topicCat] ?? DEFAULT_CAT_CONFIG) : DEFAULT_CAT_CONFIG
  const CatIcon = catCfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col gap-3 p-4 rounded-xl border bg-surface-100',
        answer.is_accepted ? 'border-emerald/40' : 'border-surface-300'
      )}
    >
      {/* Question */}
      {answer.question && (
        <Link
          href={`/questions/${answer.question.id}`}
          className="group"
        >
          <div className="flex items-start gap-2">
            <HelpCircle className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-surface-500 group-hover:text-surface-300 transition-colors line-clamp-2">
              {answer.question.content}
            </p>
          </div>
        </Link>
      )}

      {/* Answer content */}
      <p className="text-sm text-white leading-relaxed">{answer.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
          {/* Topic link */}
          {answer.topic && (
            <Link
              href={`/topic/${answer.topic.id}`}
              className="flex items-center gap-1 hover:text-surface-300 transition-colors max-w-[160px]"
            >
              <CatIcon className={cn('h-3 w-3 flex-shrink-0', catCfg.color)} aria-hidden="true" />
              <span className="truncate">{answer.topic.statement}</span>
              <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
          {answer.is_accepted && (
            <span className="flex items-center gap-1 text-emerald">
              <Check className="h-3 w-3" aria-hidden="true" />
              Accepted
            </span>
          )}
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            {answer.upvotes}
          </span>
          <span>
            {new Date(answer.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function StatPill({
  icon: Icon,
  value,
  label,
  colorClass,
}: {
  icon: typeof Star
  value: number
  label: string
  colorClass: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-3 rounded-xl bg-surface-200 border border-surface-300 min-w-[80px]">
      <Icon className={cn('h-4 w-4', colorClass)} aria-hidden="true" />
      <span className="text-base font-bold text-white font-mono">{value}</span>
      <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-60 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  username: string
}

type CategoryFilter = 'All' | string

export function ByExpertClient({ username }: Props) {
  const [data, setData] = useState<ByExpertResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/questions/by-expert/${encodeURIComponent(username)}`)
      if (res.status === 404) {
        setError('This expert could not be found.')
        return
      }
      if (!res.ok) throw new Error('Failed to load expert data')
      const json: ByExpertResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load expert data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    load()
  }, [load])

  // Derive category tabs from expertise entries
  const categoryTabs: CategoryFilter[] = data
    ? ['All', ...data.expertise.map((e) => e.category)]
    : ['All']

  const filteredAnswers = data
    ? activeCategory === 'All'
      ? data.answers
      : data.answers.filter((a) => a.topic?.category === activeCategory)
    : []

  const expert = data?.expert

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28 space-y-6">

        {/* ── Back nav ────────────────────────────────────────────────────────── */}
        <Link
          href="/experts"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Expert Directory
        </Link>

        {loading && <LoadingSkeleton />}

        {error && (
          <EmptyState
            icon={HelpCircle}
            title="Expert not found"
            description={error}
            actions={[{ label: 'Back to Expert Directory', href: '/experts' }]}
            size="sm"
          />
        )}

        {!loading && !error && data && expert && (
          <>
            {/* ── Expert header card ─────────────────────────────────────────── */}
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-surface-100 border border-surface-300">
              <Link href={`/profile/${expert.username}`} className="flex-shrink-0">
                <Avatar
                  src={expert.avatar_url}
                  username={expert.username}
                  size="lg"
                />
              </Link>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/profile/${expert.username}`}
                    className="font-bold text-white hover:text-for-300 transition-colors"
                  >
                    {expert.display_name ?? expert.username}
                  </Link>
                  {data.expertise.length > 0 && (
                    <TierBadge tier={data.expertise[0].tier} />
                  )}
                </div>

                <div className="text-xs font-mono text-surface-500">
                  @{expert.username}
                  {expert.role && expert.role !== 'person' && (
                    <> · <span className="capitalize">{expert.role}</span></>
                  )}
                </div>

                {expert.bio && (
                  <p className="text-xs text-surface-500 line-clamp-2">{expert.bio}</p>
                )}

                <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {expert.followers_count} followers
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    {expert.clout} clout
                  </span>
                </div>
              </div>
            </div>

            {/* ── Stats strip ───────────────────────────────────────────────── */}
            <div className="flex items-stretch gap-2 overflow-x-auto scrollbar-hide pb-1">
              <StatPill
                icon={MessageSquare}
                value={data.stats.total_answers}
                label="Answers"
                colorClass="text-for-400"
              />
              <StatPill
                icon={Check}
                value={data.stats.accepted_answers}
                label="Accepted"
                colorClass="text-emerald"
              />
              <StatPill
                icon={ThumbsUp}
                value={data.stats.total_upvotes}
                label="Upvotes"
                colorClass="text-gold"
              />
              <StatPill
                icon={Star}
                value={data.stats.categories_contributed}
                label="Categories"
                colorClass="text-purple"
              />
            </div>

            {/* ── Expertise tiers ────────────────────────────────────────────── */}
            {data.expertise.length > 0 && (
              <section>
                <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  Expertise
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.expertise.map((e) => (
                    <ExpertiseCard key={e.category} info={e} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Answers section ────────────────────────────────────────────── */}
            <section>
              <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                Answers
              </h2>

              {/* Category filter tabs */}
              {categoryTabs.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Filter answers by category"
                  className="flex items-center gap-1 p-1 bg-surface-200 rounded-xl overflow-x-auto scrollbar-hide mb-4"
                >
                  {categoryTabs.map((cat) => {
                    const isActive = activeCategory === cat
                    const catCfg = cat === 'All' ? null : (CATEGORY_CONFIG[cat] ?? null)
                    const catCount =
                      cat === 'All'
                        ? data.answers.length
                        : data.answers.filter((a) => a.topic?.category === cat).length
                    return (
                      <button
                        key={cat}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveCategory(cat)}
                        className={cn(
                          'flex items-center gap-1.5 flex-shrink-0 h-8 px-3 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap',
                          isActive
                            ? 'bg-surface-100 text-white shadow-sm'
                            : 'text-surface-500 hover:text-surface-300'
                        )}
                      >
                        {cat}
                        {catCount > 0 && (
                          <span
                            className={cn(
                              'inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-bold',
                              isActive && catCfg
                                ? cn(catCfg.color, catCfg.bg)
                                : isActive
                                  ? 'bg-for-500/20 text-for-400'
                                  : 'bg-surface-300 text-surface-500'
                            )}
                          >
                            {catCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Answer list */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  {filteredAnswers.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="No answers yet"
                      description={
                        activeCategory === 'All'
                          ? `${expert.display_name ?? expert.username} hasn't answered any questions yet.`
                          : `No answers in ${activeCategory} yet.`
                      }
                      size="sm"
                    />
                  ) : (
                    filteredAnswers.map((answer) => (
                      <AnswerCard key={answer.id} answer={answer} />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
