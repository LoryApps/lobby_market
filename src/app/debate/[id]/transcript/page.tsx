'use client'

/**
 * /debate/[id]/transcript — Full debate transcript viewer.
 *
 * Renders every message in chronological order, colour-coded by side,
 * with argument highlights, author attribution, and a copy-to-clipboard
 * plain-text export.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TranscriptResponse, TranscriptMessage } from '@/app/api/debates/[id]/transcript/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `+${h}h ${m % 60}m`
  if (m > 0) return `+${m}m ${s % 60}s`
  return `+${s}s`
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  oxford:     'Oxford Debate',
  town_hall:  'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel:      'Panel',
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'proposed' | 'active' | 'law' | 'failed' }> = {
  scheduled:  { label: 'Scheduled',  variant: 'proposed' },
  live:       { label: 'Live Now',   variant: 'active' },
  ended:      { label: 'Ended',      variant: 'failed' },
  cancelled:  { label: 'Cancelled',  variant: 'failed' },
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: TranscriptMessage
  index: number
  startAt: string | null
}

function MessageBubble({ msg, index, startAt }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(true)
  const isFor = msg.side === 'blue'
  const isAgainst = msg.side === 'red'

  const elapsed =
    startAt && msg.created_at
      ? new Date(msg.created_at).getTime() - new Date(startAt).getTime()
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      className={cn(
        'flex gap-3 group',
        isFor && 'flex-row',
        isAgainst && 'flex-row-reverse',
        !msg.side && 'flex-row'
      )}
    >
      {/* Avatar */}
      <Link
        href={`/profile/${msg.author?.username ?? 'unknown'}`}
        className="flex-shrink-0 mt-0.5"
      >
        <Avatar
          src={msg.author?.avatar_url ?? null}
          fallback={msg.author?.display_name ?? msg.author?.username ?? '?'}
          size="sm"
          className={cn(
            'ring-2',
            isFor ? 'ring-for-500/40' : isAgainst ? 'ring-against-500/40' : 'ring-surface-400/30'
          )}
        />
      </Link>

      {/* Bubble */}
      <div className={cn('flex-1 min-w-0', isAgainst && 'flex flex-col items-end')}>
        {/* Author + time */}
        <div className={cn('flex items-center gap-2 mb-1', isAgainst && 'flex-row-reverse')}>
          <Link
            href={`/profile/${msg.author?.username ?? 'unknown'}`}
            className="text-xs font-mono font-semibold text-surface-300 hover:text-white transition-colors"
          >
            {msg.author?.display_name ?? msg.author?.username ?? 'Unknown'}
          </Link>

          {msg.side && (
            <span
              className={cn(
                'text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                isFor
                  ? 'bg-for-500/15 text-for-400 border border-for-500/20'
                  : 'bg-against-500/15 text-against-400 border border-against-500/20'
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
          )}

          {msg.is_argument && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
              Argument
            </span>
          )}

          <span className="text-[10px] font-mono text-surface-600 tabular-nums">
            {formatTime(msg.created_at)}
            {elapsed !== null && elapsed >= 0 && (
              <span className="ml-1 text-surface-700">({relativeTime(elapsed)})</span>
            )}
          </span>
        </div>

        {/* Content */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-lg',
            isFor
              ? 'bg-for-600/15 border border-for-500/20 text-white rounded-tl-sm'
              : isAgainst
                ? 'bg-against-600/15 border border-against-500/20 text-white rounded-tr-sm'
                : 'bg-surface-200/70 border border-surface-300/50 text-surface-200 rounded-tl-sm',
            msg.is_argument && 'border-l-2 ' + (isFor ? 'border-l-for-400' : isAgainst ? 'border-l-against-400' : 'border-l-gold')
          )}
        >
          {/* Long messages: collapse toggle */}
          {msg.content.length > 400 ? (
            <div>
              <p className={cn(!expanded && 'line-clamp-3')}>
                {msg.content}
              </p>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
          ) : (
            <p>{msg.content}</p>
          )}

          {/* Upvotes */}
          {msg.upvotes > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-surface-500">
              <Trophy className="h-3 w-3 text-gold" />
              <span className="font-mono">{msg.upvotes} upvote{msg.upvotes !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TranscriptSkeleton() {
  return (
    <div className="space-y-4 px-4">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={cn('flex gap-3', i % 3 === 1 && 'flex-row-reverse')}>
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
          <div className={cn('flex-1 space-y-1.5', i % 3 === 1 && 'flex flex-col items-end')}>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className={cn('h-14 rounded-2xl', i % 3 === 1 ? 'w-4/5' : 'w-3/4')} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebateTranscriptPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<TranscriptResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showStats, setShowStats] = useState(true)
  const [sideFilter, setSideFilter] = useState<'all' | 'for' | 'against' | 'neutral' | 'arguments'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/debates/${params.id}/transcript`)
      if (!res.ok) throw new Error('Failed to load transcript')
      const json = await res.json() as TranscriptResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { load() }, [load])

  const filteredMessages = (data?.messages ?? []).filter((m) => {
    if (sideFilter === 'all') return true
    if (sideFilter === 'for') return m.side === 'blue'
    if (sideFilter === 'against') return m.side === 'red'
    if (sideFilter === 'neutral') return m.side === null
    if (sideFilter === 'arguments') return m.is_argument
    return true
  })

  async function copyTranscript() {
    if (!data) return
    const lines = [
      `DEBATE TRANSCRIPT — ${data.debate.title}`,
      data.debate.topic ? `Topic: ${data.debate.topic.statement}` : '',
      data.debate.scheduled_at ? `Date: ${formatDate(data.debate.scheduled_at)}` : '',
      `Type: ${DEBATE_TYPE_LABEL[data.debate.type] ?? data.debate.type}`,
      `Messages: ${data.stats.total} · For: ${data.stats.for_count} · Against: ${data.stats.against_count}`,
      '',
      '─────────────────────────────────────────',
      '',
      ...data.messages.map((m) => {
        const name = m.author?.display_name ?? m.author?.username ?? 'Unknown'
        const side = m.side === 'blue' ? '[FOR]' : m.side === 'red' ? '[AGAINST]' : '[NEUTRAL]'
        const tag = m.is_argument ? ' [ARGUMENT]' : ''
        const time = formatTime(m.created_at)
        return `${time} ${name} ${side}${tag}\n${m.content}`
      }),
    ].filter(Boolean).join('\n')

    await navigator.clipboard.writeText(lines)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const debate = data?.debate
  const stats = data?.stats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-12">
        {/* Back link */}
        <Link
          href={`/debate/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>

        {/* Header */}
        {loading ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        ) : debate ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge variant={STATUS_CONFIG[debate.status]?.variant ?? 'proposed'}>
                    {STATUS_CONFIG[debate.status]?.label ?? debate.status}
                  </Badge>
                  <span className="text-xs font-mono text-surface-500">
                    {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
                  </span>
                </div>
                <h1 className="text-lg font-mono font-bold text-white mb-1">
                  {debate.title}
                </h1>
                {debate.topic && (
                  <Link
                    href={`/topic/${debate.topic.id}`}
                    className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="line-clamp-1">{debate.topic.statement}</span>
                  </Link>
                )}
                {debate.scheduled_at && (
                  <p className="mt-1 text-xs font-mono text-surface-600">
                    {formatDate(debate.scheduled_at)}
                  </p>
                )}
              </div>

              {/* Copy button */}
              <button
                onClick={copyTranscript}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex-shrink-0',
                  copied
                    ? 'bg-emerald/20 border border-emerald/30 text-emerald'
                    : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
                )}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Stats bar */}
            {stats && (
              <div>
                <button
                  onClick={() => setShowStats((s) => !s)}
                  className="flex items-center gap-1 mt-4 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showStats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Stats
                </button>

                <AnimatePresence>
                  {showStats && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { icon: MessageSquare, label: 'Messages',  value: stats.total,          color: 'text-surface-300' },
                          { icon: ThumbsUp,      label: 'For',        value: stats.for_count,       color: 'text-for-400' },
                          { icon: ThumbsDown,    label: 'Against',    value: stats.against_count,   color: 'text-against-400' },
                          { icon: Scale,         label: 'Neutral',    value: stats.neutral_count,   color: 'text-surface-400' },
                          { icon: Trophy,        label: 'Arguments',  value: stats.argument_count,  color: 'text-gold' },
                        ].map(({ icon: Icon, label, value, color }) => (
                          <div key={label} className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-3 text-center">
                            <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                            <p className={cn('text-base font-mono font-bold', color)}>{value}</p>
                            <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">{label}</p>
                          </div>
                        ))}
                      </div>

                      {stats.duration_minutes !== null && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-mono text-surface-500">
                          <Timer className="h-3.5 w-3.5" />
                          Duration: {stats.duration_minutes} minute{stats.duration_minutes !== 1 ? 's' : ''}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/20 p-5 mb-6 text-center">
            <p className="text-sm text-against-400 font-mono">{error}</p>
            <button
              onClick={load}
              className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : null}

        {/* Side filter pills */}
        {!loading && data && data.messages.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {[
              { id: 'all',       label: `All (${data.stats.total})`,              color: 'surface' },
              { id: 'for',       label: `For (${data.stats.for_count})`,           color: 'for' },
              { id: 'against',   label: `Against (${data.stats.against_count})`,  color: 'against' },
              { id: 'neutral',   label: `Neutral (${data.stats.neutral_count})`,  color: 'surface' },
              { id: 'arguments', label: `Arguments (${data.stats.argument_count})`, color: 'gold' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSideFilter(f.id as typeof sideFilter)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-mono font-medium border transition-colors',
                  sideFilter === f.id
                    ? f.color === 'for'
                      ? 'bg-for-600 border-for-500 text-white'
                      : f.color === 'against'
                        ? 'bg-against-600 border-against-500 text-white'
                        : f.color === 'gold'
                          ? 'bg-gold/20 border-gold/40 text-gold'
                          : 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Transcript */}
        {loading ? (
          <TranscriptSkeleton />
        ) : error ? null : !data || data.messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="This debate has no recorded messages."
            actions={[{ label: 'Go to debate', href: `/debate/${params.id}` }]}
          />
        ) : filteredMessages.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No messages match this filter"
            description="Try a different side or view all messages."
            actions={[{ label: 'Show all', onClick: () => setSideFilter('all') }]}
          />
        ) : (
          <div className="space-y-3">
            {/* Date header */}
            {debate?.scheduled_at && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-surface-300/50" />
                <span className="text-xs font-mono text-surface-600 flex-shrink-0">
                  {formatDate(debate.scheduled_at)}
                </span>
                <div className="flex-1 h-px bg-surface-300/50" />
              </div>
            )}

            {filteredMessages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                index={i}
                startAt={debate?.scheduled_at ?? filteredMessages[0]?.created_at ?? null}
              />
            ))}

            {/* End marker */}
            <div className="flex items-center gap-3 py-4">
              <div className="flex-1 h-px bg-surface-300/30" />
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-700">
                <Gavel className="h-3.5 w-3.5" />
                End of transcript
              </div>
              <div className="flex-1 h-px bg-surface-300/30" />
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
