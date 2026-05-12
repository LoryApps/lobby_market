'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ExternalLink,
  GitBranch,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { RelatedArgument, RelatedArgumentsResponse } from '@/app/api/arguments/[id]/related/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const GRADE_CONFIG: Record<string, { text: string; bg: string }> = {
  A: { text: 'text-emerald', bg: 'bg-emerald/10' },
  B: { text: 'text-for-300', bg: 'bg-for-500/10' },
  C: { text: 'text-gold', bg: 'bg-gold/10' },
  D: { text: 'text-against-300', bg: 'bg-against-500/10' },
  F: { text: 'text-against-400', bg: 'bg-against-600/10' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Single related argument card ────────────────────────────────────────────

function RelatedArgumentCard({ arg }: { arg: RelatedArgument }) {
  const gradeConf = arg.ai_grade ? GRADE_CONFIG[arg.ai_grade] : null
  const catColor = arg.topic?.category ? CATEGORY_COLORS[arg.topic.category] : 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-colors group',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Topic header */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {arg.topic?.category && (
              <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', catColor)}>
                {arg.topic.category}
              </span>
            )}
            {arg.topic?.status && (
              <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} size="xs">
                {STATUS_LABEL[arg.topic.status] ?? arg.topic.status}
              </Badge>
            )}
          </div>
          <Link
            href={`/topic/${arg.topic?.id}`}
            className="text-xs font-medium text-surface-600 hover:text-white transition-colors line-clamp-2 leading-snug"
          >
            {arg.topic?.statement}
            <ExternalLink className="inline h-2.5 w-2.5 ml-1 mb-0.5 opacity-50 group-hover:opacity-100" />
          </Link>
        </div>
        {/* Side indicator */}
        <span
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
            arg.side === 'blue'
              ? 'text-for-300 bg-for-600/15 border-for-600/30'
              : 'text-against-300 bg-against-600/15 border-against-600/30',
          )}
        >
          {arg.side === 'blue' ? (
            <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
          ) : (
            <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
          )}
          {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
        </span>
      </div>

      {/* Argument content */}
      <p className="text-sm text-surface-600 leading-relaxed line-clamp-3 mb-3">
        {arg.content}
      </p>

      {/* Footer: author, upvotes, grade, link */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {arg.author && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name ?? arg.author.username}
                size="xs"
              />
              <span className="text-[11px] text-surface-500 font-mono truncate">
                @{arg.author.username}
              </span>
            </div>
          )}
          <span className="text-[11px] text-surface-600 flex items-center gap-0.5 flex-shrink-0">
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            {arg.upvotes}
          </span>
          {gradeConf && arg.ai_grade && (
            <span className={cn('text-[10px] font-mono font-bold px-1.5 rounded', gradeConf.text, gradeConf.bg)}>
              {arg.ai_grade}
            </span>
          )}
        </div>

        <Link
          href={`/arguments/${arg.id}`}
          aria-label={`View argument by @${arg.author?.username ?? 'anonymous'}`}
          className={cn(
            'flex-shrink-0 flex items-center gap-0.5 text-[11px] font-mono',
            'text-surface-500 hover:text-for-300 transition-colors',
          )}
        >
          View
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface RelatedArgumentsPanelProps {
  argumentId: string
}

export function RelatedArgumentsPanel({ argumentId }: RelatedArgumentsPanelProps) {
  const [related, setRelated] = useState<RelatedArgument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/arguments/${argumentId}/related`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RelatedArgumentsResponse | null) => {
        if (!cancelled && d?.related) setRelated(d.related)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [argumentId])

  if (loading) {
    return (
      <section aria-label="Related arguments" className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="h-4 w-4 text-surface-500" aria-hidden="true" />
          <h2 className="text-sm font-mono font-semibold text-surface-500 uppercase tracking-wider">
            Related Arguments
          </h2>
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-surface-300 p-4 space-y-2 animate-pulse"
            >
              <div className="flex gap-2">
                <div className="h-3 w-20 rounded bg-surface-300" />
                <div className="h-3 w-14 rounded bg-surface-300" />
              </div>
              <div className="h-3 w-full rounded bg-surface-300" />
              <div className="h-3 w-4/5 rounded bg-surface-300" />
              <div className="h-3 w-3/5 rounded bg-surface-300" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (related.length === 0) return null

  return (
    <section aria-label="Related arguments from other debates" className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="h-4 w-4 text-purple" aria-hidden="true" />
        <h2 className="text-sm font-mono font-semibold text-surface-500 uppercase tracking-wider">
          Similar Arguments
        </h2>
        <span className="text-[10px] font-mono text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded-full">
          Cross-topic
        </span>
      </div>

      <AnimatePresence>
        <div className="space-y-3">
          {related.map((arg, i) => (
            <motion.div
              key={arg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <RelatedArgumentCard arg={arg} />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      <p className="mt-3 text-[10px] font-mono text-surface-600 text-center">
        Arguments from other debates making similar points &middot; ranked by quality &amp; upvotes
      </p>
    </section>
  )
}
