'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ChevronUp,
  ExternalLink,
  Link2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/Badge'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileArgumentEntry {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  source_url?: string | null
  created_at: string
  topic_id: string
  topic_statement: string | null
  topic_status: string | null
  topic_category: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> =
  {
    proposed: 'proposed',
    active: 'active',
    voting: 'active',
    law: 'law',
    failed: 'failed',
    continued: 'proposed',
    archived: 'proposed',
  }

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

// ─── Single argument row ──────────────────────────────────────────────────────

function ArgumentRow({
  arg,
  index,
}: {
  arg: ProfileArgumentEntry
  index: number
}) {
  const isFor = arg.side === 'blue'
  const badgeVariant = arg.topic_status
    ? STATUS_BADGE[arg.topic_status] ?? 'proposed'
    : 'proposed'
  const statusLabel = arg.topic_status
    ? STATUS_LABEL[arg.topic_status] ?? arg.topic_status
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className={cn(
        'group relative rounded-2xl border p-5 transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Side indicator stripe */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-0.5 rounded-full',
          isFor ? 'bg-for-500' : 'bg-against-500'
        )}
        style={{ left: '-1px' }}
      />

      {/* Header: FOR/AGAINST + upvotes + date */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider',
              'px-2 py-0.5 rounded-full border',
              isFor
                ? 'text-for-400 bg-for-500/10 border-for-500/30'
                : 'text-against-400 bg-against-500/10 border-against-500/30'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
            )}
            {isFor ? 'For' : 'Against'}
          </span>

          {arg.topic_category && (
            <span className="text-[10px] font-mono text-surface-500">
              {arg.topic_category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Upvote count */}
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-mono',
              arg.upvotes > 0 ? 'text-gold' : 'text-surface-500'
            )}
            aria-label={`${arg.upvotes} upvote${arg.upvotes !== 1 ? 's' : ''}`}
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold">{arg.upvotes}</span>
          </div>

          <span className="text-[10px] font-mono text-surface-500">
            {relativeTime(arg.created_at)}
          </span>
        </div>
      </div>

      {/* Argument content */}
      <p className="text-sm text-surface-700 leading-relaxed mb-2">
        {arg.content}
      </p>

      {/* Citation source URL */}
      {arg.source_url && (
        <a
          href={arg.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1 mb-3 text-[11px] font-mono transition-colors max-w-full',
            arg.side === 'blue' ? 'text-for-500/80 hover:text-for-400' : 'text-against-500/80 hover:text-against-400'
          )}
          aria-label={`Source: ${arg.source_url}`}
        >
          <Link2 className="h-3 w-3 flex-shrink-0" aria-hidden />
          <span className="truncate">
            {(() => {
              try { return new URL(arg.source_url).hostname.replace(/^www\./, '') }
              catch { return arg.source_url }
            })()}
          </span>
          <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-60" aria-hidden />
        </a>
      )}

      {/* Topic link */}
      {arg.topic_statement && (
        <Link
          href={`/topic/${arg.topic_id}`}
          className="flex items-start gap-2 group/link"
        >
          <MessageSquare
            className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-mono text-surface-500 group-hover/link:text-surface-700 transition-colors line-clamp-1">
              {arg.topic_statement}
            </span>
          </div>
          {statusLabel && (
            <Badge variant={badgeVariant} className="flex-shrink-0 text-[9px]">
              {statusLabel}
            </Badge>
          )}
        </Link>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfileArgumentsProps {
  arguments: ProfileArgumentEntry[]
  username: string
}

export function ProfileArguments({
  arguments: args,
  username,
}: ProfileArgumentsProps) {
  // No state needed — static server-rendered list
  // Sorted by upvotes desc on the server already

  if (args.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300">
          <MessageSquare className="h-7 w-7 text-surface-500" />
        </div>
        <div className="text-center">
          <p className="font-mono font-semibold text-white">No arguments yet</p>
          <p className="text-sm text-surface-500 font-mono mt-1 max-w-xs">
            @{username} hasn&apos;t posted any debate arguments yet.
          </p>
        </div>
      </div>
    )
  }

  const forCount = args.filter((a) => a.side === 'blue').length
  const againstCount = args.filter((a) => a.side === 'red').length
  const totalUpvotes = args.reduce((sum, a) => sum + a.upvotes, 0)

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-center">
          <div className="text-lg font-mono font-bold text-white">
            {args.length}
          </div>
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
            Total
          </div>
        </div>
        <div className="rounded-xl bg-for-500/5 border border-for-500/20 px-4 py-3 text-center">
          <div className="text-lg font-mono font-bold text-for-400">
            {forCount}
          </div>
          <div className="text-[10px] font-mono text-for-500 uppercase tracking-wider mt-0.5">
            For
          </div>
        </div>
        <div className="rounded-xl bg-against-500/5 border border-against-500/20 px-4 py-3 text-center">
          <div className="text-lg font-mono font-bold text-against-400">
            {againstCount}
          </div>
          <div className="text-[10px] font-mono text-against-500 uppercase tracking-wider mt-0.5">
            Against
          </div>
        </div>
      </div>

      {/* Upvote total */}
      {totalUpvotes > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-gold">
          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {totalUpvotes.toLocaleString()} upvote
            {totalUpvotes !== 1 ? 's' : ''} received
          </span>
        </div>
      )}

      {/* Arguments list */}
      <div className="space-y-3">
        {args.map((arg, i) => (
          <ArgumentRow key={arg.id} arg={arg} index={i} />
        ))}
      </div>
    </div>
  )
}
