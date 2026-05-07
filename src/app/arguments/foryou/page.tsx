'use client'

/**
 * /arguments/foryou — Arguments For You
 *
 * Personalized argument feed built from three ranked signals:
 *   1. Arguments on topics you've already voted on  (highest relevance)
 *   2. Arguments in your preferred categories       (from onboarding/vote history)
 *   3. Platform-wide trending arguments             (fallback)
 *
 * Relevance badges distinguish the source so users understand why each
 * argument surfaced for them.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Compass,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
  TrendingUp,
  UserCheck,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type {
  RecommendedArgument,
  RecommendedArgumentsResponse,
} from '@/app/api/arguments/recommended/route'
import { createClient } from '@/lib/supabase/client'

// ─── Config ───────────────────────────────────────────────────────────────────

const RELEVANCE_CONFIG = {
  voted_topic: {
    icon: UserCheck,
    label: 'Your debate',
    bg: 'bg-for-500/10 border-for-500/20',
    text: 'text-for-300',
    badge: 'bg-for-500/15 text-for-300 border-for-500/30',
  },
  preferred_category: {
    icon: Compass,
    label: 'Your category',
    bg: 'bg-purple/10 border-purple/20',
    text: 'text-purple',
    badge: 'bg-purple/15 text-purple border-purple/30',
  },
  trending: {
    icon: TrendingUp,
    label: 'Trending',
    bg: 'bg-surface-200 border-surface-300',
    text: 'text-surface-500',
    badge: 'bg-surface-300/40 text-surface-500 border-surface-400/40',
  },
} as const

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ArgSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="ml-auto h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-5/6" />
      <Skeleton className="h-3.5 w-4/6" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  index,
  isBookmarked,
  onBookmark,
}: {
  arg: RecommendedArgument
  index: number
  isBookmarked: boolean
  onBookmark: (id: string) => void
}) {
  const rel = RELEVANCE_CONFIG[arg.relevance]
  const RelIcon = rel.icon
  const isFor = arg.side === 'blue'

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.035 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-all',
        rel.bg
      )}
    >
      {/* Author row */}
      <div className="flex items-center gap-2 min-w-0">
        {arg.author ? (
          <Link href={`/profile/${arg.author.username}`} className="flex-shrink-0">
            <Avatar
              src={arg.author.avatar_url}
              alt={arg.author.display_name ?? arg.author.username}
              size="sm"
            />
          </Link>
        ) : (
          <div className="h-7 w-7 rounded-full bg-surface-300 flex-shrink-0" />
        )}

        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {arg.author ? (
            <Link
              href={`/profile/${arg.author.username}`}
              className="text-xs font-mono font-semibold text-white truncate hover:text-for-300 transition-colors"
            >
              {arg.author.display_name ?? arg.author.username}
            </Link>
          ) : (
            <span className="text-xs font-mono text-surface-500">Anonymous</span>
          )}
          {arg.author?.role && arg.author.role !== 'person' && (
            <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
              · {ROLE_LABEL[arg.author.role] ?? arg.author.role}
            </span>
          )}
        </div>

        {/* Relevance badge */}
        <span
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border flex-shrink-0',
            rel.badge
          )}
        >
          <RelIcon className="h-2.5 w-2.5" aria-hidden />
          {rel.label}
        </span>
      </div>

      {/* Content */}
      <div className="flex gap-2.5">
        <div
          className={cn(
            'mt-0.5 flex-shrink-0 h-4 w-0.5 rounded-full',
            isFor ? 'bg-for-500' : 'bg-against-500'
          )}
          aria-hidden
        />
        <p className="text-sm font-mono text-surface-700 leading-relaxed">
          {renderWithMentions(arg.content)}
        </p>
      </div>

      {/* Topic + stats row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {arg.topic && (
            <Link
              href={`/topic/${arg.topic.id}`}
              className="flex items-start gap-1.5 group"
            >
              <ArrowRight className="h-3 w-3 mt-0.5 text-surface-500 group-hover:text-for-300 transition-colors flex-shrink-0" />
              <span className="text-[11px] font-mono text-surface-500 group-hover:text-for-300 transition-colors leading-tight line-clamp-2">
                {arg.topic.statement}
              </span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Side badge */}
          <span
            className={cn(
              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
              isFor
                ? 'bg-for-500/20 text-for-300'
                : 'bg-against-500/20 text-against-300'
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>

          {/* Topic status */}
          {arg.topic && (
            <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} size="sm" />
          )}
        </div>
      </div>

      {/* Footer: upvotes + time + bookmark */}
      <div className="flex items-center gap-3 pt-0.5">
        <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" aria-hidden />
          {arg.upvotes}
        </span>
        <span className="text-[11px] font-mono text-surface-400">
          {relativeTime(arg.created_at)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onBookmark(arg.id)}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark argument'}
            className={cn(
              'flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg transition-colors',
              isBookmarked
                ? 'text-gold bg-gold/10 hover:bg-gold/20'
                : 'text-surface-500 hover:text-white hover:bg-surface-200'
            )}
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-3 w-3" aria-hidden />
            ) : (
              <Bookmark className="h-3 w-3" aria-hidden />
            )}
          </button>

          <Link
            href={`/topic/${arg.topic_id}#arg-${arg.id}`}
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white px-2 py-0.5 rounded-lg hover:bg-surface-200 transition-colors"
            aria-label="View argument in context"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            View
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  color,
}: {
  icon: typeof TrendingUp
  title: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-4 w-4', color)} aria-hidden />
      <h2 className={cn('text-sm font-mono font-semibold', color)}>{title}</h2>
      <span className="text-[11px] font-mono text-surface-500 ml-1">
        {count} argument{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArgumentsForYouPage() {
  const [data, setData] = useState<RecommendedArgumentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/arguments/recommended')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Load initial bookmarks
  useEffect(() => {
    async function loadBookmarks() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('argument_bookmarks')
          .select('argument_id')
          .eq('user_id', user.id)
        if (data) {
          setBookmarkedIds(new Set(data.map((b: { argument_id: string }) => b.argument_id)))
        }
      } catch {
        // no-op
      }
    }
    loadBookmarks()
  }, [])

  useEffect(() => { load() }, [load])

  const handleBookmark = useCallback(async (argId: string) => {
    if (bookmarkingId) return
    setBookmarkingId(argId)
    const wasBookmarked = bookmarkedIds.has(argId)

    setBookmarkedIds((prev) => {
      const next = new Set(prev)
      if (wasBookmarked) next.delete(argId)
      else next.add(argId)
      return next
    })

    try {
      await fetch(`/api/arguments/${argId}/bookmark`, {
        method: wasBookmarked ? 'DELETE' : 'POST',
      })
    } catch {
      // revert
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (wasBookmarked) next.add(argId)
        else next.delete(argId)
        return next
      })
    } finally {
      setBookmarkingId(null)
    }
  }, [bookmarkedIds, bookmarkingId])

  const args = data?.arguments ?? []
  const votedArgs = args.filter((a) => a.relevance === 'voted_topic')
  const catArgs = args.filter((a) => a.relevance === 'preferred_category')
  const trendingArgs = args.filter((a) => a.relevance === 'trending')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main
        className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12"
        id="main-content"
      >
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/arguments"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
              aria-label="Back to arguments"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" aria-hidden />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-for-400" aria-hidden />
                <h1 className="font-mono text-2xl font-bold text-white">
                  Arguments for You
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {data?.source === 'personalized'
                  ? `Personalised from ${data.voted_topic_count} voted topic${data.voted_topic_count !== 1 ? 's' : ''}${data.preferred_categories.length > 0 ? ` + ${data.preferred_categories.length} preferred categor${data.preferred_categories.length !== 1 ? 'ies' : 'y'}` : ''}`
                  : 'Top arguments across all debates'}
              </p>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
              aria-label="Refresh recommendations"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden />
              Refresh
            </button>
          </div>

          {/* Quick nav */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { label: 'Daily Pick', href: '/arguments/daily', icon: Trophy },
              { label: 'Trending', href: '/arguments/trending', icon: Flame },
              { label: 'Bookmarked', href: '/arguments/bookmarked', icon: Bookmark },
              { label: 'Mine', href: '/arguments/mine', icon: MessageSquare },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors whitespace-nowrap flex-shrink-0"
              >
                <Icon className="h-3 w-3" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArgSkeleton key={i} index={i} />
            ))}
          </div>
        ) : args.length === 0 ? (
          <EmptyState
            icon={Zap}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="No recommendations yet"
            description="Vote on a few topics or complete the onboarding quiz to get personalised argument recommendations."
            actions={[
              { label: 'Browse topics', href: '/', variant: 'primary' },
              { label: 'Trending arguments', href: '/arguments/trending', variant: 'secondary' },
            ]}
          />
        ) : (
          <div className="space-y-8">
            <AnimatePresence>
              {/* ── Section 1: from your voted topics ─────────────────────── */}
              {votedArgs.length > 0 && (
                <motion.section
                  key="voted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <SectionHeader
                    icon={UserCheck}
                    title="From debates you voted on"
                    count={votedArgs.length}
                    color="text-for-400"
                  />
                  <div className="space-y-3">
                    {votedArgs.map((arg, i) => (
                      <ArgumentCard
                        key={arg.id}
                        arg={arg}
                        index={i}
                        isBookmarked={bookmarkedIds.has(arg.id)}
                        onBookmark={handleBookmark}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* ── Section 2: from preferred categories ──────────────────── */}
              {catArgs.length > 0 && (
                <motion.section
                  key="categories"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <SectionHeader
                    icon={Compass}
                    title="From your preferred categories"
                    count={catArgs.length}
                    color="text-purple"
                  />
                  <div className="space-y-3">
                    {catArgs.map((arg, i) => (
                      <ArgumentCard
                        key={arg.id}
                        arg={arg}
                        index={i}
                        isBookmarked={bookmarkedIds.has(arg.id)}
                        onBookmark={handleBookmark}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* ── Section 3: trending fallback ──────────────────────────── */}
              {trendingArgs.length > 0 && (
                <motion.section
                  key="trending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <SectionHeader
                    icon={TrendingUp}
                    title={data?.source === 'personalized' ? 'Also trending' : 'Trending now'}
                    count={trendingArgs.length}
                    color="text-surface-500"
                  />
                  <div className="space-y-3">
                    {trendingArgs.map((arg, i) => (
                      <ArgumentCard
                        key={arg.id}
                        arg={arg}
                        index={i}
                        isBookmarked={bookmarkedIds.has(arg.id)}
                        onBookmark={handleBookmark}
                      />
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* CTA: personalisation prompt for non-personalised feed */}
            {data?.source === 'trending' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-for-500/20 bg-for-500/5 p-5 text-center"
              >
                <Gavel className="h-6 w-6 text-for-400 mx-auto mb-2" aria-hidden />
                <p className="text-sm font-mono font-semibold text-white mb-1">
                  Personalise your feed
                </p>
                <p className="text-xs font-mono text-surface-500 mb-3">
                  Vote on topics to unlock recommendations tailored to your positions.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono transition-colors"
                >
                  Start voting
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </motion.div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
