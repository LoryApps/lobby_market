'use client'

/**
 * /activity/mentions — Your @Mention Inbox
 *
 * Shows every argument and reply that contains @your-username, newest first.
 * Lets you jump directly into the debate thread where someone called you out.
 *
 * Distinct from /activity/replies (replies to your own arguments) and
 * /notifications (system-level events). This is your personal @mention inbox.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  AtSign,
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MentionActivity, MentionsActivityResponse } from '@/app/api/activity/mentions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

/** Highlight @username occurrences in text */
function HighlightedMention({
  text,
  username,
  className,
}: {
  text: string
  username: string
  className?: string
}) {
  if (!username) return <span className={className}>{text}</span>

  const regex = new RegExp(`(@${username})`, 'gi')
  const parts = text.split(regex)

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-purple font-semibold bg-purple/10 rounded px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
}

const ROLE_COLOR: Record<string, string> = {
  person:        'text-surface-500',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
}

const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

type PeriodFilter = 'all' | '7d' | '30d'

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MentionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-16 rounded ml-auto" />
          </div>
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-8 w-3/4 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Mention card ─────────────────────────────────────────────────────────────

function MentionCard({
  item,
  username,
}: {
  item: MentionActivity
  username: string
}) {
  const isFor = item.argument_side === 'blue'
  const isReply = item.type === 'reply'

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'hover:border-surface-400 transition-colors group',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40',
      )}
    >
      {/* Side accent stripe */}
      <div
        className={cn(
          'h-0.5 w-full',
          isFor
            ? 'bg-gradient-to-r from-for-600 to-for-400'
            : 'bg-gradient-to-r from-against-700 to-against-500',
        )}
      />

      <div className="p-4 space-y-3">
        {/* Mentioner row */}
        <div className="flex items-center gap-2.5">
          {item.mentioner ? (
            <Link
              href={`/profile/${item.mentioner.username}`}
              className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={item.mentioner.avatar_url}
                fallback={item.mentioner.display_name ?? item.mentioner.username}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-white truncate">
                  {item.mentioner.display_name ?? item.mentioner.username}
                </p>
                <p
                  className={cn(
                    'text-[11px] font-mono truncate',
                    ROLE_COLOR[item.mentioner.role] ?? 'text-surface-500',
                  )}
                >
                  {ROLE_LABEL[item.mentioner.role] ?? item.mentioner.role}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="h-8 w-8 rounded-full bg-surface-300 flex-shrink-0" />
              <p className="text-xs font-mono text-surface-500">Unknown user</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mention type badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                'bg-purple/10 border-purple/30 text-purple',
              )}
            >
              <AtSign className="h-2.5 w-2.5" />
              {isReply ? 'reply' : 'argument'}
            </span>
            <time className="text-[11px] font-mono text-surface-500">
              {relativeTime(item.created_at)}
            </time>
          </div>
        </div>

        {/* Mention text */}
        <div
          className={cn(
            'rounded-xl p-3 border text-xs font-mono leading-relaxed',
            isFor
              ? 'bg-for-500/5 border-for-500/20 text-for-200'
              : 'bg-against-500/5 border-against-500/20 text-against-200',
          )}
        >
          <HighlightedMention
            text={truncate(item.content, 240)}
            username={username}
          />
        </div>

        {/* For reply mentions: show the parent argument context */}
        {isReply && item.argument_content !== item.content && (
          <div className="rounded-xl p-3 border border-surface-300 bg-surface-200/60">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">
              In reply to this argument
            </p>
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              {truncate(item.argument_content, 120)}
            </p>
          </div>
        )}

        {/* Topic + actions row */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <Link
            href={`/topic/${item.topic_id}`}
            className="flex-1 min-w-0 group/topic"
          >
            <div className="flex items-center gap-1.5">
              {item.argument_side === 'blue' ? (
                <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden />
              ) : (
                <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden />
              )}
              <Badge
                variant={STATUS_VARIANT[item.topic_status] ?? 'proposed'}
                size="sm"
              >
                {item.topic_status.charAt(0).toUpperCase() + item.topic_status.slice(1)}
              </Badge>
              <p className="text-xs font-mono text-surface-400 truncate group-hover/topic:text-white transition-colors">
                {truncate(item.topic_statement, 60)}
              </p>
            </div>
          </Link>

          <Link
            href={`/topic/${item.topic_id}`}
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-semibold transition-colors',
              'bg-surface-200 border-surface-300 text-surface-400',
              'hover:bg-surface-300 hover:text-white',
            )}
            aria-label="View debate"
          >
            View debate
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function MentionsPage() {
  const router = useRouter()
  const [mentions, setMentions] = useState<MentionActivity[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const offset = useRef(0)
  const hasMore = useRef(true)

  const load = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoading(true)
        offset.current = 0
        hasMore.current = true
        setMentions([])
      } else {
        if (!hasMore.current) return
        setLoadingMore(true)
      }

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset.current),
          ...(period !== 'all' && { period }),
        })
        const res = await fetch(`/api/activity/mentions?${params}`)

        if (res.status === 401) {
          router.push('/login')
          return
        }

        if (!res.ok) throw new Error('Failed to load mentions')

        const data = (await res.json()) as MentionsActivityResponse
        setUsername(data.username)
        setTotalCount(data.totalCount)
        setMentions((prev) => (reset ? data.mentions : [...prev, ...data.mentions]))
        hasMore.current = data.mentions.length === PAGE_SIZE
        offset.current += data.mentions.length
      } catch {
        // silent
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [period, router],
  )

  useEffect(() => { load(true) }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-5">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/activity"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Back to activity"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>

            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <AtSign className="h-5 w-5 text-purple" aria-hidden />
            </div>

            <div>
              <h1 className="font-mono text-lg font-bold text-white leading-tight">
                Mentions
              </h1>
              <p className="text-xs font-mono text-surface-500">
                {loading
                  ? 'Loading…'
                  : totalCount === 0
                    ? 'No one has mentioned you yet'
                    : `${totalCount.toLocaleString()} time${totalCount !== 1 ? 's' : ''} you've been mentioned`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Toggle filters"
              aria-expanded={showFilters}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                showFilters
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              Filters
            </button>
            <button
              onClick={() => load(true)}
              disabled={loading}
              aria-label="Refresh mentions"
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
                'bg-surface-200 border-surface-300',
                'text-surface-400 hover:text-white hover:border-surface-400',
                'disabled:opacity-50',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            </button>
          </div>
        </div>

        {/* ── Quick nav ────────────────────────────────────────── */}
        <nav
          className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
          aria-label="Activity navigation"
        >
          {[
            { href: '/activity',           label: 'Feed' },
            { href: '/activity/following', label: 'Following' },
            { href: '/activity/replies',   label: 'Replies' },
            { href: '/activity/upvotes',   label: 'Upvotes' },
            { href: '/activity/mentions',  label: 'Mentions', active: true },
            { href: '/notifications',      label: 'Notifications' },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors whitespace-nowrap',
                active
                  ? 'bg-purple/20 border-purple/40 text-purple'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* ── Filters panel ───────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                  Time period
                </p>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: 'all', label: 'All time' },
                    { id: '30d', label: 'Last 30 days' },
                    { id: '7d',  label: 'Last 7 days' },
                  ] as { id: PeriodFilter; label: string }[]).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setPeriod(id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors',
                        period === id
                          ? 'bg-purple/20 border-purple/40 text-purple'
                          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Content ─────────────────────────────────────────────── */}
        {loading ? (
          <MentionsSkeleton />
        ) : mentions.length === 0 ? (
          <EmptyState
            icon={AtSign}
            title="No mentions yet"
            description={
              username
                ? `No one has mentioned @${username} in arguments or replies yet. When someone tags you in a debate, it will show up here.`
                : 'No one has @mentioned you yet. When someone tags you in a debate, it will show up here.'
            }
            action={{ label: 'Browse debates', href: '/' }}
          />
        ) : (
          <div className="space-y-3" role="feed" aria-label="Mention notifications">
            {mentions.map((item) => (
              <MentionCard key={`${item.type}-${item.id}`} item={item} username={username} />
            ))}

            {/* Load more */}
            {hasMore.current && (
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-mono font-semibold transition-colors',
                    'bg-surface-200 border-surface-300 text-surface-400',
                    'hover:bg-surface-300 hover:text-white hover:border-surface-400',
                    'disabled:opacity-50',
                  )}
                >
                  {loadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Footer nav ────────────────────────────────────────────── */}
        {!loading && mentions.length === 0 && (
          <nav aria-label="Related pages" className="grid grid-cols-2 gap-3 pt-2">
            {[
              {
                href: '/activity/replies',
                label: 'Replies',
                sub: 'Replies to your arguments',
                icon: MessageSquare,
              },
              {
                href: '/notifications',
                label: 'Notifications',
                sub: 'All platform notifications',
                icon: ExternalLink,
              },
            ].map(({ href, label, sub, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
                )}
              >
                <Icon className="h-4 w-4 text-surface-400 flex-shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-white">{label}</p>
                  <p className="text-[11px] font-mono text-surface-500 truncate">{sub}</p>
                </div>
              </Link>
            ))}
          </nav>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
