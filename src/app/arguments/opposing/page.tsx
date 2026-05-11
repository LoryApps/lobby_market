'use client'

/**
 * /arguments/opposing — Opposing Voices
 *
 * The best arguments on the opposing side of every topic the user has voted on.
 *
 * If you voted FOR, you see the top AGAINST arguments.
 * If you voted AGAINST, you see the top FOR arguments.
 *
 * Sorted by AI quality score first, then upvotes — so the most rigorous
 * counterarguments surface first. Each card shows:
 *   • The argument text
 *   • AI grade (if scored)
 *   • The topic context with user's own vote indicated
 *   • Author info, upvote count, creation date
 *   • A "Respond" CTA linking to the topic's argument thread
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  ExternalLink,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  User,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { OpposingArgument, OpposingArgumentsResponse } from '@/app/api/arguments/opposing/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const GRADE_CONFIG: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-gold/15',         border: 'border-gold/40',         text: 'text-gold' },
  B: { bg: 'bg-emerald/15',      border: 'border-emerald/40',      text: 'text-emerald' },
  C: { bg: 'bg-for-500/15',      border: 'border-for-500/40',      text: 'text-for-400' },
  D: { bg: 'bg-surface-300/20',  border: 'border-surface-400/40',  text: 'text-surface-500' },
  F: { bg: 'bg-against-500/15',  border: 'border-against-500/30',  text: 'text-against-400' },
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
}

// ─── Category filter options ──────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

type Category = (typeof CATEGORIES)[number]

// ─── Argument card ────────────────────────────────────────────────────────────

function OpposingCard({ arg, index }: { arg: OpposingArgument; index: number }) {
  const isBlue = arg.side === 'blue'
  const grade = arg.ai_grade
  const gradeCfg = grade ? GRADE_CONFIG[grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-shadow hover:shadow-lg',
        isBlue ? 'border-for-500/30' : 'border-against-500/30',
      )}
    >
      {/* Side accent strip */}
      <div className={cn(
        'h-0.5 w-full',
        isBlue ? 'bg-for-500' : 'bg-against-500',
      )} />

      <div className="p-4 space-y-3">
        {/* Side badge + grade */}
        <div className="flex items-center justify-between gap-2">
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold',
            isBlue
              ? 'bg-for-500/10 border-for-500/30 text-for-300'
              : 'bg-against-500/10 border-against-500/30 text-against-300',
          )}>
            {isBlue
              ? <ThumbsUp className="h-2.5 w-2.5" />
              : <ThumbsDown className="h-2.5 w-2.5" />}
            {isBlue ? 'FOR' : 'AGAINST'}
          </div>

          {gradeCfg && grade && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold',
              gradeCfg.bg, gradeCfg.border, gradeCfg.text,
            )}>
              <Brain className="h-2.5 w-2.5" />
              {grade}
            </div>
          )}
        </div>

        {/* Argument text */}
        <p className="text-sm font-mono text-white leading-relaxed line-clamp-4">
          {renderWithMentions(arg.content)}
        </p>

        {/* Topic context */}
        {arg.topic && (
          <Link
            href={`/topic/${arg.topic.id}`}
            className={cn(
              'flex items-start gap-2 px-3 py-2 rounded-xl border',
              'bg-surface-200/60 border-surface-300 hover:border-surface-400',
              'transition-colors group/topic',
            )}
          >
            {/* User's vote badge */}
            <div className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex-shrink-0 mt-0.5',
              arg.user_vote === 'blue'
                ? 'bg-for-500/20 text-for-300 border border-for-500/40'
                : 'bg-against-500/20 text-against-300 border border-against-500/40',
            )}>
              {arg.user_vote === 'blue' ? 'You: FOR' : 'You: vs'}
            </div>
            <span className="text-[11px] font-mono text-surface-500 group-hover/topic:text-white transition-colors line-clamp-2 flex-1">
              {arg.topic.statement}
            </span>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} size="xs">
                {arg.topic.status === 'law' ? 'LAW' : arg.topic.status}
              </Badge>
              <ExternalLink className="h-2.5 w-2.5 text-surface-500 opacity-0 group-hover/topic:opacity-100 transition-opacity" />
            </div>
          </Link>
        )}

        {/* Author + meta */}
        <div className="flex items-center justify-between gap-3">
          {arg.author ? (
            <Link
              href={`/profile/${arg.author.username}`}
              className="flex items-center gap-2 min-w-0 group/author"
            >
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name || arg.author.username}
                size="xs"
              />
              <div className="min-w-0">
                <span className="text-[11px] font-mono text-surface-400 group-hover/author:text-white transition-colors truncate block">
                  {arg.author.display_name || arg.author.username}
                </span>
                <span className="text-[9px] font-mono text-surface-600">
                  {ROLE_LABEL[arg.author.role] ?? arg.author.role}
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-surface-600" />
              <span className="text-[11px] font-mono text-surface-600">Anonymous</span>
            </div>
          )}

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[10px] font-mono text-surface-500">
              {relativeTime(arg.created_at)}
            </span>
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-surface-500" />
              <span className="text-[10px] font-mono text-surface-500">{arg.upvotes}</span>
            </div>
          </div>
        </div>

        {/* Respond CTA */}
        {arg.topic && (
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/topic/${arg.topic.id}?tab=argue`}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold',
                'border transition-colors',
                isBlue
                  ? 'bg-for-500/10 border-for-500/30 text-for-300 hover:bg-for-500/20'
                  : 'bg-against-500/10 border-against-500/30 text-against-300 hover:bg-against-500/20',
              )}
            >
              <MessageSquare className="h-3 w-3" />
              Respond to this argument
            </Link>
            <Link
              href={`/arguments/${arg.id}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors"
            >
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OpposingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden animate-pulse">
          <div className="h-0.5 bg-surface-300" />
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-16 bg-surface-200 rounded-md" />
              <div className="h-5 w-8 bg-surface-200 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-surface-200 rounded" />
              <div className="h-3 w-5/6 bg-surface-200 rounded" />
              <div className="h-3 w-4/6 bg-surface-200 rounded" />
            </div>
            <div className="h-14 bg-surface-200 rounded-xl" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-surface-200" />
                <div className="h-3 w-20 bg-surface-200 rounded" />
              </div>
              <div className="h-3 w-12 bg-surface-200 rounded" />
            </div>
            <div className="h-8 bg-surface-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpposingPage() {
  const [data, setData] = useState<OpposingArgumentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState<Category>('All')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/arguments/opposing', { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as OpposingArgumentsResponse
      setData(json)
    } catch {
      setError('Could not load opposing arguments. Try again in a moment.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredArgs = data?.arguments.filter((arg) =>
    category === 'All' || arg.topic?.category === category,
  ) ?? []

  const forCount = filteredArgs.filter((a) => a.side === 'blue').length
  const againstCount = filteredArgs.filter((a) => a.side === 'red').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link
              href="/arguments"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Arguments
            </Link>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-against-500/10 border border-against-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Scale className="h-4 w-4 text-against-400" />
              </div>
              <div>
                <h1 className="text-xl font-mono font-bold text-white">Opposing Voices</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5 max-w-md">
                  The strongest arguments challenging your positions — know what the other side is saying
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {data && data.is_authenticated && (
                <span className="text-[11px] font-mono text-surface-500 flex-shrink-0">
                  {data.voted_topic_count} voted topics
                </span>
              )}
              <button
                onClick={() => load(true)}
                disabled={refreshing || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 border border-surface-300 transition-colors disabled:opacity-40"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          {/* Context note */}
          {!loading && data?.is_authenticated && data.voted_topic_count > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-against-500/5 border border-against-500/20"
            >
              <Zap className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
                These are the most rigorous arguments opposing your votes — ranked by AI quality score.
                Engaging with the strongest counterarguments makes your own reasoning sharper.
              </p>
            </motion.div>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <OpposingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Scale}
                title="Could Not Load"
                description={error}
                actions={[{ label: 'Try again', onClick: () => load() }]}
              />
            </motion.div>
          ) : !data?.is_authenticated ? (
            <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={User}
                iconColor="text-for-400"
                iconBg="bg-for-500/10"
                iconBorder="border-for-500/30"
                title="Sign in to see opposing voices"
                description="Once you vote on topics, we'll surface the best arguments from the other side."
                actions={[{ label: 'Sign in', href: '/login' }]}
              />
            </motion.div>
          ) : data.voted_topic_count === 0 ? (
            <motion.div key="no-votes" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Gavel}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title="No votes yet"
                description="Start voting on topics and we'll show you the strongest counterarguments."
                actions={[{ label: 'Browse topics', href: '/' }]}
              />
            </motion.div>
          ) : (
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Stats + category filter */}
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-for-400">
                    <ThumbsUp className="h-3 w-3" />
                    {forCount} FOR challenges
                  </span>
                  <span className="text-surface-600">·</span>
                  <span className="flex items-center gap-1 text-against-400">
                    <ThumbsDown className="h-3 w-3" />
                    {againstCount} AGAINST challenges
                  </span>
                </div>
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {CATEGORIES.map((cat) => {
                  const count =
                    cat === 'All'
                      ? (data.arguments.length)
                      : data.arguments.filter((a) => a.topic?.category === cat).length
                  if (cat !== 'All' && count === 0) return null
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors border',
                        category === cat
                          ? 'bg-for-500/20 border-for-500/40 text-for-300'
                          : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                      )}
                    >
                      {cat}
                      {cat !== 'All' && (
                        <span className="ml-1 text-surface-600">({count})</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Empty category filter state */}
              {filteredArgs.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No arguments in this category"
                  description="Try selecting a different category or vote on more topics."
                  actions={[{ label: 'Show all', onClick: () => setCategory('All') }]}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredArgs.map((arg, i) => (
                      <OpposingCard key={arg.id} arg={arg} index={i} />
                    ))}
                  </div>

                  {/* Footer CTA */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-10 flex flex-col items-center gap-2 text-center"
                  >
                    <p className="text-xs font-mono text-surface-500 max-w-sm">
                      Vote on more topics to see more counterarguments
                    </p>
                    <div className="flex gap-3 flex-wrap justify-center">
                      <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-500/15 border border-for-500/40 text-for-300 text-xs font-mono hover:bg-for-500/25 transition-colors"
                      >
                        Vote on topics
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                      <Link
                        href="/arguments/foryou"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono hover:border-surface-400 hover:text-white transition-colors"
                      >
                        Arguments For You
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </motion.div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
