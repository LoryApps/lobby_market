'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Shield,
  Star,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  HallOfFameResponse,
  HallOfFameExchange,
  MinisterStat,
} from '@/app/api/civic-questions/hall-of-fame/route'

// ─── Category styles ──────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Culture:     { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Health:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
}

const RANK_COLORS = ['text-gold', 'text-surface-300', 'text-against-400']
const RANK_LABELS = ['1st', '2nd', '3rd']

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

// ─── Exchange Card ────────────────────────────────────────────────────────────

function ExchangeCard({
  exchange,
  rank,
}: {
  exchange: HallOfFameExchange
  rank?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const cat = CAT_STYLE[exchange.category] ?? {
    text: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
  }

  return (
    <motion.div
      layout
      className={cn(
        'bg-surface-100 border rounded-2xl p-5 transition-colors',
        rank !== undefined && rank < 3
          ? 'border-gold/30 bg-surface-100/80'
          : 'border-surface-300',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        {rank !== undefined && (
          <div className={cn('flex-shrink-0 font-mono font-bold text-sm mt-0.5', RANK_COLORS[rank] ?? 'text-surface-500')}>
            {rank < 3 ? (
              <span className="flex items-center gap-1">
                {rank === 0 && <Crown className="h-4 w-4" />}
                {RANK_LABELS[rank]}
              </span>
            ) : (
              `#${rank + 1}`
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Category + score */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn('text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border', cat.text, cat.bg, cat.border)}>
              {exchange.category}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <ThumbsUp className="h-3 w-3" />
              {exchange.question_upvotes + exchange.answer.answer_upvotes} combined
            </span>
            {exchange.topic_statement && (
              <Link
                href={`/topic/${exchange.id}`}
                className="flex items-center gap-0.5 text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {exchange.topic_statement.slice(0, 40)}{exchange.topic_statement.length > 40 ? '…' : ''}
              </Link>
            )}
          </div>

          {/* Question */}
          <p className="text-sm font-semibold text-white leading-snug mb-3">
            &ldquo;{exchange.question_text}&rdquo;
          </p>

          {/* Participants row */}
          <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
            <Link
              href={`/profile/${exchange.questioner.username}`}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Avatar
                src={exchange.questioner.avatar_url}
                fallback={exchange.questioner.display_name ?? exchange.questioner.username}
                size="xs"
              />
              <span>@{exchange.questioner.username}</span>
            </Link>
            <span className="text-surface-600">asked</span>
            <Shield className="h-3 w-3 text-gold flex-shrink-0" />
            <Link
              href={`/profile/${exchange.minister.username}`}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Avatar
                src={exchange.minister.avatar_url}
                fallback={exchange.minister.display_name ?? exchange.minister.username}
                size="xs"
              />
              <span className="font-semibold text-gold">
                {exchange.minister.display_name ?? exchange.minister.username}
              </span>
            </Link>
            <span className="ml-auto text-surface-600">{relativeTime(exchange.answered_at)}</span>
          </div>
        </div>
      </div>

      {/* Answer preview / full */}
      <div className={cn(
        'rounded-xl border p-3.5 transition-all',
        'bg-surface-200/40 border-surface-400/30',
      )}>
        <div className="flex items-center gap-1.5 mb-2">
          <Mic className="h-3 w-3 text-gold flex-shrink-0" />
          <span className="text-[10px] font-mono font-semibold text-gold uppercase tracking-wider">
            Ministerial Response
          </span>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {exchange.answer.answer_upvotes}
          </span>
        </div>

        <p className={cn('text-sm text-surface-300 leading-relaxed', !expanded && 'line-clamp-3')}>
          {exchange.answer.answer_text}
        </p>

        {exchange.answer.answer_text.length > 200 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Read full answer
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Minister stat card ───────────────────────────────────────────────────────

function MinisterStatCard({ stat, rank }: { stat: MinisterStat; rank: number }) {
  return (
    <Link href={`/profile/${stat.minister.username}`}>
      <div className={cn(
        'flex items-center gap-3 p-3.5 rounded-xl border transition-colors hover:border-surface-400',
        rank === 0
          ? 'border-gold/40 bg-gold/5'
          : rank === 1
          ? 'border-surface-300/80 bg-surface-100'
          : 'border-surface-300/50 bg-surface-100',
      )}>
        <div className={cn(
          'flex-shrink-0 w-7 text-center font-mono font-bold text-sm',
          rank === 0 ? 'text-gold' : rank === 1 ? 'text-surface-300' : rank === 2 ? 'text-against-400' : 'text-surface-600',
        )}>
          {rank === 0 ? <Crown className="h-4 w-4 mx-auto" /> : `#${rank + 1}`}
        </div>
        <Avatar
          src={stat.minister.avatar_url}
          fallback={stat.minister.display_name ?? stat.minister.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {stat.minister.display_name ?? stat.minister.username}
          </p>
          <p className="text-[11px] font-mono text-surface-500 truncate">@{stat.minister.username}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-mono font-bold text-gold">{stat.total_answer_upvotes}</p>
          <p className="text-[10px] font-mono text-surface-500">total upvotes</p>
        </div>
        <div className="flex-shrink-0 text-right hidden sm:block">
          <p className="text-sm font-mono font-bold text-emerald">{stat.total_answered}</p>
          <p className="text-[10px] font-mono text-surface-500">answered</p>
        </div>
      </div>
    </Link>
  )
}

// ─── Category spotlight ───────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Environment', 'Health', 'Education', 'Culture', 'Philosophy',
]

function CategorySpotlight({
  categoryBest,
}: {
  categoryBest: Record<string, HallOfFameExchange>
}) {
  const [activeCategory, setActiveCategory] = useState<string>(
    Object.keys(categoryBest)[0] ?? 'Politics'
  )

  const orderedCategories = CATEGORY_ORDER.filter((c) => categoryBest[c])
  if (orderedCategories.length === 0) return null

  const active = categoryBest[activeCategory]
  if (!active) return null

  return (
    <div>
      <h2 className="font-mono font-semibold text-white text-sm mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 text-gold" />
        Category Champions
      </h2>

      {/* Category tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {orderedCategories.map((cat) => {
          const style = CAT_STYLE[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30' }
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors',
                activeCategory === cat
                  ? cn(style.text, style.bg, style.border)
                  : 'text-surface-500 bg-surface-200/30 border-surface-400/20 hover:border-surface-400/40 hover:text-surface-300',
              )}
            >
              {cat}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          <ExchangeCard exchange={active} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'exchanges' | 'ministers' | 'categories'

export function HallOfFameClient() {
  const [data, setData] = useState<HallOfFameResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('exchanges')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-questions/hall-of-fame')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as HallOfFameResponse
      setData(json)
    } catch {
      setError('Could not load hall of fame data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
    { id: 'exchanges', label: 'Top Exchanges', icon: Trophy },
    { id: 'ministers', label: 'Top Ministers', icon: Shield },
    { id: 'categories', label: 'By Category', icon: Star },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/civic-questions"
            className="p-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-mono text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-gold" />
              Hall of Fame
            </h1>
            <p className="text-xs font-mono text-surface-500">
              The greatest Q&amp;A exchanges in Lobby history
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto p-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats strip */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Questions', value: data.stats.total_questions, icon: MessageSquare, color: 'text-for-400' },
              { label: 'Answered', value: data.stats.total_answered, icon: Mic, color: 'text-emerald' },
              { label: 'Q Upvotes', value: data.stats.total_question_upvotes, icon: ThumbsUp, color: 'text-purple' },
              { label: 'A Upvotes', value: data.stats.total_answer_upvotes, icon: Zap, color: 'text-gold' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-surface-100 border border-surface-300 rounded-xl p-3.5 text-center">
                <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                <p className={cn('text-xl font-mono font-bold', color)}>
                  <AnimatedNumber value={value} />
                </p>
                <p className="text-[10px] font-mono text-surface-500">{label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Intro callout */}
        {!loading && data && data.stats.total_answered === 0 && (
          <div className="bg-surface-100 border border-gold/20 rounded-2xl p-5 mb-6 text-center">
            <Gavel className="h-8 w-8 text-gold mx-auto mb-3" />
            <p className="text-sm font-semibold text-white mb-1">No exchanges yet</p>
            <p className="text-xs font-mono text-surface-500 mb-4">
              The Hall of Fame fills up as citizens question Shadow Cabinet ministers and ministers respond.
              Be the first to make history.
            </p>
            <div className="flex gap-2 justify-center">
              <Link href="/civic-questions">
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/20 border border-gold/30 text-xs font-mono font-semibold text-gold hover:bg-gold/30 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask a Question
                </button>
              </Link>
              <Link href="/shadow-cabinet">
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors">
                  <Users className="h-3.5 w-3.5" />
                  View Cabinet
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        {!loading && data && data.stats.total_answered > 0 && (
          <>
            <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1 mb-5">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-colors',
                    tab === id
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-white',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{label.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'exchanges' && (
                <motion.div
                  key="exchanges"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  {data.top_exchanges.length === 0 ? (
                    <EmptyState
                      icon={<Trophy className="h-8 w-8 text-surface-500" />}
                      title="No answered exchanges yet"
                      description="Ministers need to respond to questions to appear here."
                    />
                  ) : (
                    data.top_exchanges.map((ex, i) => (
                      <ExchangeCard key={ex.id} exchange={ex} rank={i} />
                    ))
                  )}
                </motion.div>
              )}

              {tab === 'ministers' && (
                <motion.div
                  key="ministers"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-2"
                >
                  {data.top_ministers.length === 0 ? (
                    <EmptyState
                      icon={<Shield className="h-8 w-8 text-surface-500" />}
                      title="No minister stats yet"
                      description="Minister rankings will appear once questions are answered."
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="font-mono font-semibold text-white text-sm flex items-center gap-2">
                          <Flame className="h-4 w-4 text-against-400" />
                          Ministers Ranked by Impact
                        </h2>
                        <Link href="/shadow-cabinet" className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1">
                          View Cabinet
                          <Users className="h-3 w-3" />
                        </Link>
                      </div>
                      {data.top_ministers.map((stat, i) => (
                        <MinisterStatCard key={stat.minister.id} stat={stat} rank={i} />
                      ))}
                    </>
                  )}
                </motion.div>
              )}

              {tab === 'categories' && (
                <motion.div
                  key="categories"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {Object.keys(data.category_best).length === 0 ? (
                    <EmptyState
                      icon={<Star className="h-8 w-8 text-surface-500" />}
                      title="No category champions yet"
                      description="Category highlights appear once questions are answered across different civic domains."
                    />
                  ) : (
                    <CategorySpotlight categoryBest={data.category_best} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-5 w-8 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex gap-3">
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-20 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-surface-100 border border-against-500/30 rounded-2xl p-5 text-center">
            <p className="text-sm text-against-300 font-mono mb-3">{error}</p>
            <button
              onClick={load}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {/* CTA footer */}
        {!loading && !error && (
          <div className="mt-8 bg-surface-100 border border-surface-300 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Mic className="h-5 w-5 text-gold" />
              <h3 className="font-mono font-semibold text-white text-sm">Make your mark</h3>
            </div>
            <p className="text-xs text-surface-500 font-mono mb-4">
              Ask a sharp question to a Shadow Cabinet minister and, if it gets upvoted enough, it could appear here.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link href="/civic-questions">
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold/20 border border-gold/30 text-xs font-mono font-semibold text-gold hover:bg-gold/30 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask a Question
                </button>
              </Link>
              <Link href="/shadow-cabinet">
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors">
                  <Shield className="h-3.5 w-3.5" />
                  Shadow Cabinet
                </button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
