'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flame,
  MessageSquare,
  RefreshCw,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CrossfireData, CrossfireExchange, CrossfireReply } from '@/app/api/topics/[id]/crossfire/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function clashLabel(score: number): { label: string; color: string } {
  if (score >= 20) return { label: 'Raging', color: 'text-against-400' }
  if (score >= 10) return { label: 'Heated', color: 'text-gold' }
  if (score >= 5) return { label: 'Active', color: 'text-emerald' }
  return { label: 'Contested', color: 'text-purple' }
}

// ─── Reply card ───────────────────────────────────────────────────────────────

function ReplyCard({ reply }: { reply: CrossfireReply }) {
  return (
    <div className="flex gap-2.5 pl-4 border-l-2 border-surface-400/50">
      <Avatar
        src={reply.author?.avatar_url ?? null}
        fallback={reply.author?.display_name || reply.author?.username || '?'}
        size="xs"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          {reply.author ? (
            <Link
              href={`/profile/${reply.author.username}`}
              className="text-[11px] font-semibold text-surface-700 hover:text-white transition-colors"
            >
              {reply.author.display_name || reply.author.username}
            </Link>
          ) : (
            <span className="text-[11px] text-surface-500">Anonymous</span>
          )}
          <span className="text-[10px] font-mono text-surface-600">{reltime(reply.created_at)}</span>
        </div>
        <p className="text-[12px] text-surface-700 leading-relaxed">{reply.content}</p>
      </div>
    </div>
  )
}

// ─── Exchange card ────────────────────────────────────────────────────────────

function ExchangeCard({ exchange, index }: { exchange: CrossfireExchange; index: number }) {
  const [expanded, setExpanded] = useState(index < 3)

  const isFor = exchange.side === 'blue'
  const clash = clashLabel(exchange.clash_score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        isFor ? 'border-for-600/30' : 'border-against-600/30'
      )}
    >
      {/* Clash intensity bar */}
      <div
        className={cn(
          'h-0.5',
          isFor ? 'bg-for-600' : 'bg-against-600'
        )}
        style={{ width: `${Math.min(100, (exchange.clash_score / 30) * 100)}%` }}
      />

      {/* Argument header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Side indicator */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border mt-0.5',
              isFor
                ? 'bg-for-600/15 border-for-600/30 text-for-400'
                : 'bg-against-600/15 border-against-600/30 text-against-400'
            )}
            aria-label={isFor ? 'FOR argument' : 'AGAINST argument'}
          >
            {isFor ? (
              <ThumbsUp className="h-3.5 w-3.5" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge
                variant={isFor ? 'for' : 'against'}
                className="text-[10px] px-1.5 py-0"
              >
                {isFor ? 'FOR' : 'AGAINST'}
              </Badge>
              <span className={cn('text-[10px] font-mono font-semibold', clash.color)}>
                {clash.label}
              </span>
              <span className="text-[10px] font-mono text-surface-600">·</span>
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-600">
                <MessageSquare className="h-3 w-3" />
                {exchange.reply_count} {exchange.reply_count === 1 ? 'reply' : 'replies'}
              </span>
              <span className="text-[10px] font-mono text-surface-600">·</span>
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-600">
                <Zap className="h-3 w-3" />
                {exchange.upvotes}
              </span>
            </div>

            {/* Argument content */}
            <p className="text-sm text-white leading-relaxed mb-3">{exchange.content}</p>

            {/* Author */}
            <div className="flex items-center gap-2">
              {exchange.author ? (
                <Link
                  href={`/profile/${exchange.author.username}`}
                  className="flex items-center gap-1.5 group"
                >
                  <Avatar
                    src={exchange.author.avatar_url ?? null}
                    fallback={exchange.author.display_name || exchange.author.username}
                    size="xs"
                  />
                  <span className="text-[11px] font-mono text-surface-600 group-hover:text-surface-400 transition-colors">
                    @{exchange.author.username}
                  </span>
                </Link>
              ) : null}
              <span className="text-[10px] font-mono text-surface-600">
                {reltime(exchange.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Expand/collapse toggle */}
        {exchange.replies.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className={cn(
              'w-full mt-3 flex items-center justify-between',
              'px-3 py-2 rounded-xl border border-surface-300/60',
              'bg-surface-200/60 hover:bg-surface-300/60 transition-colors',
              'text-[11px] font-mono text-surface-500 hover:text-surface-400'
            )}
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              {expanded ? 'Hide' : 'Show'} {exchange.replies.length}{' '}
              {exchange.replies.length === 1 ? 'reply' : 'replies'}
              {exchange.reply_count > exchange.replies.length &&
                ` (${exchange.reply_count - exchange.replies.length} more)`}
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Reply thread */}
      <AnimatePresence>
        {expanded && exchange.replies.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-surface-300/40 pt-3">
              {exchange.replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
              {exchange.reply_count > exchange.replies.length && (
                <Link
                  href={`/arguments/${exchange.id}`}
                  className="block text-center text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors py-1"
                >
                  View all {exchange.reply_count} replies →
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CrossfireSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type SortKey = 'clash' | 'replies' | 'upvotes'

export function CrossfireClient() {
  const params = useParams<{ id: string }>()
  const topicId = params?.id

  const [data, setData] = useState<CrossfireData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('clash')

  const load = useCallback(async () => {
    if (!topicId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/crossfire`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as CrossfireData
      setData(json)
    } catch {
      setError('Could not load crossfire data.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const sorted = data?.exchanges
    ? [...data.exchanges].sort((a, b) => {
        if (sort === 'replies') return b.reply_count - a.reply_count
        if (sort === 'upvotes') return b.upvotes - a.upvotes
        return b.clash_score - a.clash_score
      })
    : []

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={topicId ? `/topic/${topicId}` : '/'}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-against-600/15 border border-against-600/30">
              <Swords className="h-4 w-4 text-against-400" />
            </div>
            <h1 className="text-lg font-bold text-white">Crossfire</h1>
          </div>

          {data?.topic && (
            <p className="text-sm text-surface-500 leading-snug line-clamp-2">
              {data.topic.statement}
            </p>
          )}
        </div>

        {/* Stats strip */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              {
                label: 'Contested',
                value: data.stats.contested_arguments,
                icon: Swords,
                color: 'text-against-400',
              },
              {
                label: 'Total replies',
                value: data.stats.total_replies,
                icon: MessageSquare,
                color: 'text-for-400',
              },
              {
                label: 'Arguments',
                value: data.stats.total_arguments,
                icon: Users,
                color: 'text-purple',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300"
              >
                <Icon className={cn('h-4 w-4', color)} />
                <span className="text-base font-bold text-white tabular-nums">{value}</span>
                <span className="text-[10px] font-mono text-surface-600 text-center">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Side breakdown bar */}
        {data && data.stats.contested_arguments > 0 && (
          <div className="mb-5 p-3 rounded-xl bg-surface-100 border border-surface-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-for-400 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                FOR under fire: {data.stats.blue_contested}
              </span>
              <span className="text-[11px] font-mono text-against-400 flex items-center gap-1">
                {data.stats.red_contested} :AGAINST under fire
                <ThumbsDown className="h-3 w-3" />
              </span>
            </div>
            <div className="h-2 bg-surface-300 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-for-600 rounded-l-full"
                style={{
                  width: `${data.stats.contested_arguments > 0
                    ? (data.stats.blue_contested / data.stats.contested_arguments) * 100
                    : 50}%`,
                }}
              />
              <div
                className="h-full bg-against-600 rounded-r-full flex-1"
              />
            </div>
          </div>
        )}

        {/* Sort controls */}
        {data && data.exchanges.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-mono text-surface-600">Sort:</span>
            {(
              [
                { key: 'clash' as SortKey, label: 'Clash', icon: Flame },
                { key: 'replies' as SortKey, label: 'Replies', icon: MessageSquare },
                { key: 'upvotes' as SortKey, label: 'Upvotes', icon: Zap },
              ] as { key: SortKey; label: string; icon: typeof Flame }[]
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                  sort === key
                    ? 'bg-surface-200 border-surface-400 text-white'
                    : 'bg-transparent border-surface-300 text-surface-500 hover:text-surface-400'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}

            <button
              onClick={load}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border border-surface-300 text-surface-500 hover:text-surface-400 transition-all"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <CrossfireSkeleton />
        ) : error ? (
          <div className="text-center py-20 text-surface-600 text-sm">{error}</div>
        ) : !data || data.exchanges.length === 0 ? (
          <EmptyState
            icon={Swords}
            iconColor="text-surface-600"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title="No crossfire yet"
            description="Once arguments receive replies, the most contested exchanges will appear here."
            actions={[
              {
                label: 'View arguments',
                href: topicId ? `/topic/${topicId}/arguments` : '/',
                variant: 'primary',
              },
            ]}
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((exchange, i) => (
              <ExchangeCard key={exchange.id} exchange={exchange} index={i} />
            ))}

            <p className="text-center text-[11px] font-mono text-surface-600 pt-2">
              Showing {sorted.length} of {data.stats.contested_arguments} contested argument
              {data.stats.contested_arguments !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
