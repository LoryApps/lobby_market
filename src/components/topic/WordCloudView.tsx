'use client'

/**
 * WordCloudView
 *
 * Renders a split FOR / AGAINST word cloud for a topic, fetched from
 * /api/topics/[id]/wordcloud.  Word size scales with frequency weight.
 *
 * Layout: two columns (FOR left, AGAINST right) on desktop;
 *         stacked on mobile.  Words are arranged in a flex-wrap flow so
 *         the most-frequent words naturally cluster near the top-centre.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ExternalLink,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { WordCloudResponse, WordEntry } from '@/app/api/topics/[id]/wordcloud/route'

// ─── Config ────────────────────────────────────────────────────────────────────

const MIN_FONT_REM = 0.75
const MAX_FONT_REM = 2.6
const MIN_OPACITY  = 0.45

function fontSize(weight: number): number {
  return MIN_FONT_REM + weight * (MAX_FONT_REM - MIN_FONT_REM)
}

function wordOpacity(weight: number): number {
  return MIN_OPACITY + weight * (1 - MIN_OPACITY)
}

// ─── Subcomponent: single cloud panel ────────────────────────────────────────

interface CloudPanelProps {
  words:     WordEntry[]
  side:      'for' | 'against'
  totalArgs: number
  topicId:   string
}

function CloudPanel({ words, side, totalArgs, topicId }: CloudPanelProps) {
  const isFor    = side === 'for'
  const primary  = isFor ? 'for' : 'against'

  const headerClass = isFor
    ? 'text-for-300 border-for-500/30 bg-for-500/5'
    : 'text-against-300 border-against-500/30 bg-against-500/5'

  const wordClass = isFor
    ? 'text-for-400 hover:text-for-200'
    : 'text-against-400 hover:text-against-200'

  const pillClass = isFor
    ? 'bg-for-500/10 border-for-500/20'
    : 'bg-against-500/10 border-against-500/20'

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-4',
        headerClass,
      )}>
        {isFor
          ? <ThumbsUp  className="h-4 w-4 flex-shrink-0" aria-hidden />
          : <ThumbsDown className="h-4 w-4 flex-shrink-0" aria-hidden />}
        <div className="min-w-0">
          <p className="text-xs font-mono font-bold uppercase tracking-widest">
            {isFor ? 'FOR' : 'AGAINST'}
          </p>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            {totalArgs} argument{totalArgs !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Word cloud */}
      {words.length === 0 ? (
        <div className={cn(
          'flex items-center justify-center h-48 rounded-xl border',
          pillClass,
          'text-surface-500 text-xs font-mono',
        )}>
          No arguments yet
        </div>
      ) : (
        <div
          className={cn(
            'relative flex flex-wrap gap-x-3 gap-y-2 p-5 rounded-xl border',
            pillClass,
            'min-h-48 content-start',
          )}
          role="list"
          aria-label={`${isFor ? 'FOR' : 'AGAINST'} argument vocabulary`}
        >
          {words.map((entry, i) => {
            const fs    = fontSize(entry.weight)
            const alpha = wordOpacity(entry.weight)
            // Link to argument search within this topic
            const searchHref = `/topic/${topicId}?q=${encodeURIComponent(entry.word)}&side=${primary}`

            return (
              <motion.div
                key={entry.word}
                role="listitem"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: alpha, scale: 1 }}
                transition={{
                  duration: 0.35,
                  delay: i * 0.018,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="leading-none"
              >
                <Link
                  href={searchHref}
                  title={`${entry.word} — mentioned ${entry.count} time${entry.count !== 1 ? 's' : ''} in ${isFor ? 'FOR' : 'AGAINST'} arguments`}
                  className={cn(
                    'font-mono font-semibold transition-colors duration-150',
                    wordClass,
                  )}
                  style={{ fontSize: `${fs}rem` }}
                >
                  {entry.word}
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CloudSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-6">
      {(['for', 'against'] as const).map((side) => (
        <div key={side} className="flex-1 min-w-0">
          <div className="h-12 rounded-xl bg-surface-200 animate-pulse mb-4" />
          <div className="h-48 rounded-xl bg-surface-200 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

interface WordCloudViewProps {
  topicId:       string
  topicStatement: string
  topicCategory: string | null
  backHref:      string
}

export function WordCloudView({
  topicId,
  topicStatement,
  topicCategory,
  backHref,
}: WordCloudViewProps) {
  const [data,    setData]    = useState<WordCloudResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/wordcloud`)
      if (!res.ok) throw new Error('Failed to load word cloud')
      const json = (await res.json()) as WordCloudResponse
      setData(json)
    } catch {
      setError('Could not load argument vocabulary.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const noData = !loading && !error && data &&
    data.for.length === 0 && data.against.length === 0

  return (
    <div className="min-h-screen bg-surface-50 pb-24 md:pb-12">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-surface-100/95 backdrop-blur border-b border-surface-300">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href={backHref}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors',
            )}
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BarChart2 className="h-4 w-4 text-purple flex-shrink-0" aria-hidden />
            <span className="text-sm font-mono text-surface-700 truncate">
              Argument Vocabulary
            </span>
            {topicCategory && (
              <span className="hidden sm:inline text-[11px] font-mono text-surface-600 flex-shrink-0">
                · {topicCategory}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/topic/${topicId}/argument-graph`}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
              aria-label="View argument graph"
            >
              <span className="hidden sm:inline">Argument Graph</span>
              <ExternalLink className="sm:hidden h-3.5 w-3.5" />
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
              aria-label="Refresh word cloud"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 pt-6" id="main-content">

        {/* Topic title */}
        <div className="mb-6">
          <p className="text-[11px] font-mono uppercase tracking-widest text-surface-500 mb-1">
            Topic debate vocabulary
          </p>
          <h1 className="text-lg font-mono font-bold text-white leading-snug">
            {topicStatement}
          </h1>
          <p className="text-xs font-mono text-surface-500 mt-2">
            The most-used words in FOR and AGAINST arguments, weighted by frequency.
            Click any word to search the argument thread.
          </p>
        </div>

        {/* Stats bar */}
        {data && !loading && (
          <div className="flex items-center gap-4 mb-6 text-xs font-mono text-surface-500">
            <span>
              <span className="text-for-400 font-semibold">{data.total_for_args}</span>
              {' '}FOR args
            </span>
            <span className="text-surface-600">·</span>
            <span>
              <span className="text-against-400 font-semibold">{data.total_against_args}</span>
              {' '}AGAINST args
            </span>
            <span className="text-surface-600">·</span>
            <span>
              <span className="text-white font-semibold">
                {data.for.length + data.against.length}
              </span>
              {' '}unique words
            </span>
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CloudSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <p className="text-surface-500 text-sm font-mono">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-white text-xs font-mono hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </motion.div>
          ) : noData ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <BarChart2 className="h-10 w-10 text-surface-600" aria-hidden />
              <p className="text-surface-500 text-sm font-mono">
                No arguments yet. Be the first to argue!
              </p>
              <Link
                href={`/topic/${topicId}`}
                className="text-for-400 hover:text-for-300 text-xs font-mono transition-colors"
              >
                Go to debate →
              </Link>
            </motion.div>
          ) : data ? (
            <motion.div
              key="clouds"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col md:flex-row gap-6"
            >
              <CloudPanel
                words={data.for}
                side="for"
                totalArgs={data.total_for_args}
                topicId={topicId}
              />
              <CloudPanel
                words={data.against}
                side="against"
                totalArgs={data.total_against_args}
                topicId={topicId}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Legend */}
        {data && !loading && !error && !noData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 pt-6 border-t border-surface-300"
          >
            <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
              Word size reflects how frequently that word appears across arguments
              on that side. Stop words, numbers, and short words are excluded.
              Click any word to search the argument thread.
            </p>
            <div className="mt-3 flex items-center gap-6">
              <Link
                href={`/topic/${topicId}`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                ← Back to debate
              </Link>
              <Link
                href={`/topic/${topicId}/stats`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                View stats →
              </Link>
              <Link
                href={`/topic/${topicId}/argument-graph`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Argument graph →
              </Link>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
