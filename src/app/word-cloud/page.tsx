'use client'

/**
 * /word-cloud — Platform Lexicon
 *
 * A platform-wide word cloud showing the language of civic debate.
 * Split into FOR (blue) and AGAINST (red) panels, revealing how each
 * side of the argument consistently frames issues — and what words
 * unite or divide the two camps.
 *
 * Filters: category, time window (7d / 30d / all-time).
 * Click any word to search arguments containing it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Type,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PlatformWordEntry, PlatformWordCloudResponse } from '@/app/api/stats/word-cloud/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const PERIODS = [
  { id: 7,  label: 'Last 7 days' },
  { id: 30, label: 'Last 30 days' },
  { id: 0,  label: 'All time' },
]

const CAT_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

// ─── Word rendering ────────────────────────────────────────────────────────────

const MIN_REM = 0.7
const MAX_REM = 2.8
const MIN_OPACITY = 0.4

function wordSize(weight: number): number {
  return MIN_REM + weight * (MAX_REM - MIN_REM)
}
function wordOpacity(weight: number): number {
  return MIN_OPACITY + weight * (1 - MIN_OPACITY)
}

interface CloudWordProps {
  entry: PlatformWordEntry
  side: 'for' | 'against'
  onSearch: (word: string) => void
  delay: number
}

function CloudWord({ entry, side, onSearch, delay }: CloudWordProps) {
  const baseColor = side === 'for' ? 'text-for-400 hover:text-for-200' : 'text-against-400 hover:text-against-200'
  const fontSize = wordSize(entry.weight)
  const opacity = wordOpacity(entry.weight)

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity, scale: 1 }}
      transition={{ duration: 0.35, delay: delay * 0.018 + 0.1 }}
      onClick={() => onSearch(entry.word)}
      title={`"${entry.word}" — ${entry.count} use${entry.count !== 1 ? 's' : ''}`}
      className={cn(
        'font-mono font-semibold leading-tight cursor-pointer transition-all duration-200',
        'hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current rounded',
        baseColor,
      )}
      style={{ fontSize: `${fontSize}rem` }}
    >
      {entry.word}
    </motion.button>
  )
}

// ─── Cloud panel ──────────────────────────────────────────────────────────────

interface CloudPanelProps {
  words: PlatformWordEntry[]
  side: 'for' | 'against'
  totalArgs: number
  onSearch: (word: string) => void
}

function CloudPanel({ words, side, totalArgs, onSearch }: CloudPanelProps) {
  const isFor = side === 'for'

  const headerStyle = isFor
    ? 'text-for-300 border-for-500/30 bg-for-500/5'
    : 'text-against-300 border-against-500/30 bg-against-500/5'

  const containerStyle = isFor
    ? 'border-for-500/20 bg-for-500/3'
    : 'border-against-500/20 bg-against-500/3'

  const empty = words.length === 0

  return (
    <div className={cn('flex-1 min-w-0 rounded-2xl border p-5', containerStyle)}>
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border mb-5', headerStyle)}>
        {isFor
          ? <ThumbsUp className="h-4 w-4 flex-shrink-0" aria-hidden />
          : <ThumbsDown className="h-4 w-4 flex-shrink-0" aria-hidden />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-bold uppercase tracking-widest">
            {isFor ? 'FOR' : 'AGAINST'}
          </p>
          <p className="text-[11px] font-mono opacity-70 mt-0.5">
            {fmtNumber(totalArgs)} argument{totalArgs !== 1 ? 's' : ''}
          </p>
        </div>
        {!empty && (
          <span className="text-[11px] font-mono opacity-60">
            {words.length} words
          </span>
        )}
      </div>

      {/* Cloud */}
      {empty ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <BookOpen className="h-8 w-8 text-surface-600" aria-hidden />
          <p className="text-xs font-mono text-surface-500 text-center">
            No arguments in this range yet.
          </p>
        </div>
      ) : (
        <div
          className="flex flex-wrap gap-x-3 gap-y-2.5 justify-center"
          role="list"
          aria-label={`${isFor ? 'FOR' : 'AGAINST'} argument vocabulary`}
        >
          {words.map((entry, i) => (
            <div key={entry.word} role="listitem">
              <CloudWord
                entry={entry}
                side={side}
                onSearch={onSearch}
                delay={i}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CloudSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-6">
      {(['for', 'against'] as const).map((side) => (
        <div
          key={side}
          className={cn(
            'flex-1 rounded-2xl border p-5',
            side === 'for' ? 'border-for-500/20' : 'border-against-500/20'
          )}
        >
          <Skeleton className="h-12 w-full rounded-xl mb-5" />
          <div className="flex flex-wrap gap-3 justify-center">
            {Array.from({ length: 24 }, (_, i) => (
              <Skeleton
                key={i}
                className="rounded"
                style={{
                  height: `${12 + Math.random() * 20}px`,
                  width: `${30 + Math.random() * 70}px`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WordCloudPage() {
  const router = useRouter()
  const [data, setData] = useState<PlatformWordCloudResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('All')
  const [days, setDays] = useState(30)
  const [showLegend, setShowLegend] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (cat: string, d: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (cat !== 'All') params.set('category', cat)
      params.set('days', String(d))
      const res = await fetch(`/api/stats/word-cloud?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as PlatformWordCloudResponse
      setData(json)
    } catch {
      setError('Could not load word cloud data.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load and on filter change
  useEffect(() => {
    void load(category, days)
  }, [load, category, days])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    timerRef.current = setInterval(() => void load(category, days), 5 * 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load, category, days])

  function handleSearch(word: string) {
    router.push(`/search?q=${encodeURIComponent(word)}&type=arguments`)
  }

  const totalArgs = data
    ? data.total_for_args + data.total_against_args
    : 0

  const periodLabel = PERIODS.find((p) => p.id === days)?.label ?? ''

  return (
    <div className="min-h-screen bg-surface-50 pb-20 md:pb-8">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-5" id="main-content">
        {/* ── Header ── */}
        <div className="mb-6">
          <Link
            href="/arguments"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Arguments
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Type className="h-5 w-5 text-purple" aria-hidden />
                <h1 className="text-xl font-mono font-bold text-white">
                  Platform Lexicon
                </h1>
              </div>
              <p className="text-sm font-mono text-surface-500 max-w-lg">
                The words that define civic debate — the language of agreement and opposition across all arguments on the platform.
              </p>
            </div>

            <button
              onClick={() => void load(category, days)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
              aria-label="Refresh word cloud"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="space-y-3 mb-6">
          {/* Time period */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest w-16 shrink-0">Period</span>
            <div className="flex gap-1.5 flex-wrap">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDays(p.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-mono border transition-all',
                    days === p.id
                      ? 'bg-purple/20 text-purple border-purple/50'
                      : 'text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest w-16 shrink-0">Category</span>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-mono border transition-all',
                    category === cat
                      ? cat === 'All'
                        ? 'bg-surface-300 text-white border-surface-400'
                        : `${CAT_COLORS[cat] ?? 'text-white'} border-current bg-current/10`
                      : 'text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats bar ── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center flex-wrap gap-4 mb-5 text-xs font-mono text-surface-500 bg-surface-100 border border-surface-300 rounded-xl px-4 py-3"
          >
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-for-400" aria-hidden />
              <span className="text-for-400 font-semibold">{fmtNumber(data.total_for_args)}</span>
              {' '}FOR arguments
            </span>
            <span className="text-surface-600">·</span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-against-400" aria-hidden />
              <span className="text-against-400 font-semibold">{fmtNumber(data.total_against_args)}</span>
              {' '}AGAINST arguments
            </span>
            <span className="text-surface-600">·</span>
            <span>
              <span className="text-white font-semibold">{fmtNumber(data.for.length + data.against.length)}</span>
              {' '}unique words
            </span>
            <span className="text-surface-600">·</span>
            <span className="text-surface-400">
              {category !== 'All' ? `${category} · ` : ''}{periodLabel}
            </span>
            <span className="ml-auto text-[10px] text-surface-600">
              Click any word to search
            </span>
          </motion.div>
        )}

        {/* ── Main content ── */}
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
              className="flex flex-col items-center justify-center gap-3 py-20 text-center"
            >
              <BarChart2 className="h-10 w-10 text-surface-600" aria-hidden />
              <p className="text-sm font-mono text-surface-500">{error}</p>
              <button
                onClick={() => void load(category, days)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-white text-xs font-mono hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </motion.div>
          ) : data && totalArgs === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-20 text-center"
            >
              <BookOpen className="h-10 w-10 text-surface-600" aria-hidden />
              <p className="text-base font-mono font-bold text-white">No arguments yet</p>
              <p className="text-sm font-mono text-surface-500 max-w-xs">
                {category !== 'All'
                  ? `No arguments in ${category} for this time period.`
                  : 'No arguments found for this time period.'}
              </p>
              <Link
                href="/"
                className="text-for-400 hover:text-for-300 text-sm font-mono transition-colors"
              >
                Go vote and argue →
              </Link>
            </motion.div>
          ) : data ? (
            <motion.div
              key="clouds"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col md:flex-row gap-5">
                <CloudPanel
                  words={data.for}
                  side="for"
                  totalArgs={data.total_for_args}
                  onSearch={handleSearch}
                />
                <CloudPanel
                  words={data.against}
                  side="against"
                  totalArgs={data.total_against_args}
                  onSearch={handleSearch}
                />
              </div>

              {/* ── Shared vocabulary ── */}
              {data.for.length > 0 && data.against.length > 0 && (
                <SharedVocabulary forWords={data.for} againstWords={data.against} onSearch={handleSearch} />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Legend / help ── */}
        {data && !loading && !error && totalArgs > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 border-t border-surface-300 pt-6"
          >
            <button
              onClick={() => setShowLegend((v) => !v)}
              className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              {showLegend ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              How to read this
            </button>
            <AnimatePresence>
              {showLegend && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-[11px] font-mono text-surface-600 leading-relaxed mt-3 max-w-xl">
                    Word size reflects frequency — larger words appear more often across arguments.
                    Faded words appear occasionally; bright words are the backbone of that side{"'"}s vocabulary.
                    Click any word to search arguments containing it.
                    Stop words and numbers are excluded. The &ldquo;Common Ground&rdquo; section shows words used heavily by both sides.
                  </p>
                  <div className="mt-3 flex items-center gap-6 flex-wrap">
                    <Link href="/arguments" className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
                      Browse arguments →
                    </Link>
                    <Link href="/leaderboard/grades" className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
                      Argument quality →
                    </Link>
                    <Link href="/arguments/dna" className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
                      Argument DNA →
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Shared Vocabulary section ────────────────────────────────────────────────

interface SharedProps {
  forWords: PlatformWordEntry[]
  againstWords: PlatformWordEntry[]
  onSearch: (word: string) => void
}

function SharedVocabulary({ forWords, againstWords, onSearch }: SharedProps) {
  const againstSet = new Map(againstWords.map((w) => [w.word, w]))

  // Words that appear in both top-60 lists
  const shared = forWords
    .filter((w) => againstSet.has(w.word))
    .map((w) => ({
      word: w.word,
      forWeight: w.weight,
      againstWeight: againstSet.get(w.word)!.weight,
      combined: w.weight + againstSet.get(w.word)!.weight,
    }))
    .sort((a, b) => b.combined - a.combined)
    .slice(0, 20)

  if (shared.length < 3) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-6 rounded-2xl border border-surface-300 bg-surface-100 p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-4 w-4 text-surface-400" aria-hidden />
        <p className="text-xs font-mono font-bold text-white uppercase tracking-widest">
          Common Ground
        </p>
        <span className="text-[11px] font-mono text-surface-500 ml-1">
          — words both sides use
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center">
        {shared.map((item, i) => {
          const size = wordSize(item.combined / 2)
          const opacity = wordOpacity(item.combined / 2)
          return (
            <motion.button
              key={item.word}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity, scale: 1 }}
              transition={{ delay: i * 0.025 + 0.1 }}
              onClick={() => onSearch(item.word)}
              title={`"${item.word}" — used by both sides`}
              className="font-mono font-semibold text-surface-300 hover:text-white transition-colors cursor-pointer focus:outline-none rounded"
              style={{ fontSize: `${size * 0.85}rem` }}
            >
              {item.word}
            </motion.button>
          )
        })}
      </div>
      <p className="text-[10px] font-mono text-surface-600 text-center mt-4">
        These words appear in the top vocabulary of both FOR and AGAINST camps
      </p>
    </motion.div>
  )
}
