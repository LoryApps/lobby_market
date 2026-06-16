'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Gavel, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface TopicResolutionBannerProps {
  status: 'law' | 'failed'
  lawId?: string | null
  establishedAt?: string | null
  failedAt?: string | null
  forPct?: number
  totalVotes?: number
  topicId: string
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function TopicResolutionBanner({
  status,
  lawId,
  establishedAt,
  failedAt,
  forPct = 50,
  totalVotes = 0,
  topicId,
}: TopicResolutionBannerProps) {
  const isLaw = status === 'law'
  const date = isLaw ? establishedAt : failedAt
  const againstPct = 100 - Math.round(forPct)
  const forPctRounded = Math.round(forPct)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-5 mb-5',
        isLaw
          ? 'bg-emerald/5 border-emerald/30'
          : 'bg-against-500/5 border-against-500/25'
      )}
      role="status"
      aria-label={isLaw ? 'This topic became an established law' : 'This topic failed the vote'}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl',
            isLaw
              ? 'bg-emerald/10 text-emerald'
              : 'bg-against-500/10 text-against-400'
          )}
        >
          {isLaw ? (
            <Gavel className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm font-mono font-bold uppercase tracking-widest mb-0.5',
              isLaw ? 'text-emerald' : 'text-against-400'
            )}
          >
            {isLaw ? 'Established Law' : 'Motion Failed'}
          </p>
          <p className="text-white font-semibold text-base leading-snug">
            {isLaw
              ? 'The community reached consensus. This topic is now law.'
              : 'The community voted this motion down.'}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {/* Vote split bar */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative h-2 w-32 rounded-full overflow-hidden bg-surface-300 flex-shrink-0">
                <div
                  className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
                  style={{ width: `${forPctRounded}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-against-500"
                  style={{ width: `${againstPct}%` }}
                />
              </div>
              <span className="text-xs font-mono text-for-400 font-semibold tabular-nums">
                {forPctRounded}% For
              </span>
              <span className="text-xs text-surface-500">/</span>
              <span className="text-xs font-mono text-against-400 font-semibold tabular-nums">
                {againstPct}% Against
              </span>
            </div>

            {totalVotes > 0 && (
              <span className="text-xs font-mono text-surface-500 tabular-nums">
                {totalVotes.toLocaleString()} votes
              </span>
            )}

            {date && (
              <span className="text-xs font-mono text-surface-500">
                {formatDate(date)}
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex-shrink-0">
          {isLaw && lawId ? (
            <Link
              href={`/law/${lawId}`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold',
                'bg-emerald/10 border border-emerald/30 text-emerald',
                'hover:bg-emerald/20 transition-colors'
              )}
              aria-label="View the law document"
            >
              View Law
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href={`/topic/${topicId}/recap`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold',
                'bg-surface-300/50 border border-surface-400/40 text-surface-400',
                'hover:bg-surface-300 transition-colors'
              )}
              aria-label="View topic recap"
            >
              Recap
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}
