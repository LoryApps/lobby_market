'use client'

/**
 * /arguments/authors — Top Argument Writers
 *
 * Ranks users by the cumulative quality of their arguments:
 * composite score = avg_ai_score × ln(scored_count + 1) + total_upvotes × 0.05
 *
 * Shows: rank badge, avatar, best grade achieved, avg quality score,
 * argument count, total upvotes, and a preview of their highest-scored argument.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Brain,
  Crown,
  ExternalLink,
  Flame,
  RefreshCw,
  Scale,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentAuthor,
  ArgumentAuthorsResponse,
  AuthorPeriod,
} from '@/app/api/arguments/authors/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { id: AuthorPeriod; label: string }[] = [
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all',   label: 'All Time' },
]

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// Grade display config
const GRADE_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  'A+': { text: 'text-emerald',    bg: 'bg-emerald/15',      border: 'border-emerald/40' },
  'A':  { text: 'text-emerald',    bg: 'bg-emerald/12',      border: 'border-emerald/35' },
  'A-': { text: 'text-emerald',    bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  'B+': { text: 'text-for-300',    bg: 'bg-for-500/15',      border: 'border-for-500/40' },
  'B':  { text: 'text-for-400',    bg: 'bg-for-500/12',      border: 'border-for-500/35' },
  'B-': { text: 'text-for-400',    bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  'C+': { text: 'text-gold',       bg: 'bg-gold/15',         border: 'border-gold/40' },
  'C':  { text: 'text-gold',       bg: 'bg-gold/12',         border: 'border-gold/35' },
  'C-': { text: 'text-gold',       bg: 'bg-gold/10',         border: 'border-gold/30' },
  'D':  { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  'F':  { text: 'text-against-500', bg: 'bg-against-600/10', border: 'border-against-600/30' },
}

function gradeStyle(grade: string) {
  return GRADE_STYLE[grade] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30' }
}

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  lawmaker:      'Lawmaker',
  senator:       'Senator',
}

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  person:        'text-surface-500',
}

// Rank medal config for top 3
const RANK_CONFIG: Record<number, { icon: typeof Crown; color: string; bg: string; border: string }> = {
  1: { icon: Crown, color: 'text-gold',     bg: 'bg-gold/15',      border: 'border-gold/40' },
  2: { icon: Award, color: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/40' },
  3: { icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-900/20', border: 'border-amber-700/40' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AuthorSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <Skeleton className="h-5 w-5 rounded-full flex-shrink-0 mt-1" />
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-48 rounded" />
        <Skeleton className="h-12 w-full rounded" />
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <Skeleton className="h-6 w-8 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
    </div>
  )
}

// ─── Author card ──────────────────────────────────────────────────────────────

function AuthorCard({ author, rank }: { author: ArgumentAuthor; rank: number }) {
  const medal = RANK_CONFIG[rank]
  const gs    = gradeStyle(author.best_grade)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank - 1, 9) * 0.04 }}
    >
      <div
        className={cn(
          'flex flex-col gap-3 p-4 rounded-xl border transition-colors',
          'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60',
          rank === 1 && 'border-gold/25 shadow-[0_0_24px_rgba(201,168,76,0.08)]',
          rank === 2 && 'border-surface-400/30',
          rank === 3 && 'border-amber-700/20',
        )}
      >
        {/* Header row */}
        <div className="flex items-center gap-3">
          {/* Rank badge */}
          {medal ? (
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0 border',
                medal.bg, medal.border,
              )}
            >
              <medal.icon className={cn('h-3.5 w-3.5', medal.color)} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0 bg-surface-300/30 border border-surface-400/30">
              <span className="text-[11px] font-mono font-bold text-surface-500">{rank}</span>
            </div>
          )}

          {/* Avatar + name */}
          <Link
            href={`/profile/${author.username}`}
            className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {author.display_name || author.username}
              </p>
              <p className={cn('text-[11px] font-mono', ROLE_COLOR[author.role] ?? 'text-surface-500')}>
                @{author.username} · {ROLE_LABEL[author.role] ?? author.role}
              </p>
            </div>
          </Link>

          {/* Best grade badge */}
          <div
            className={cn(
              'flex-shrink-0 px-2 py-0.5 rounded-md text-sm font-mono font-bold border',
              gs.bg, gs.border, gs.text,
            )}
            title="Best argument grade"
          >
            {author.best_grade}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 flex-wrap ml-10">
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Brain className="h-3 w-3 text-purple flex-shrink-0" />
            <span className="text-white font-semibold">{author.avg_score.toFixed(1)}</span>
            <span>avg score</span>
          </div>
          <div className="h-3 w-px bg-surface-400/40" aria-hidden />
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Zap className="h-3 w-3 text-for-400 flex-shrink-0" />
            <span className="text-white font-semibold">{author.argument_count}</span>
            <span>argument{author.argument_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-3 w-px bg-surface-400/40" aria-hidden />
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3 text-emerald flex-shrink-0" />
            <span className="text-white font-semibold">{author.total_upvotes.toLocaleString()}</span>
            <span>upvotes</span>
          </div>
          <div className="h-3 w-px bg-surface-400/40" aria-hidden />
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Star className="h-3 w-3 text-gold flex-shrink-0" />
            <span className="text-gold font-semibold">{author.author_score.toFixed(1)}</span>
            <span>score</span>
          </div>
        </div>

        {/* Best argument preview */}
        {author.best_argument && (
          <Link
            href={`/arguments/${author.best_argument.id}`}
            className={cn(
              'ml-10 p-3 rounded-lg border transition-colors group',
              author.best_argument.side === 'blue'
                ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/35'
                : 'bg-against-500/5 border-against-500/20 hover:border-against-500/35',
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                {author.best_argument.side === 'blue' ? (
                  <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
                ) : (
                  <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    'text-[10px] font-mono font-bold',
                    author.best_argument.side === 'blue' ? 'text-for-400' : 'text-against-400',
                  )}
                >
                  {author.best_argument.side === 'blue' ? 'FOR' : 'AGAINST'}
                </span>
                <span className="text-[10px] font-mono text-surface-500">·</span>
                <span className="text-[10px] font-mono text-surface-500 truncate max-w-[160px]">
                  {truncate(author.best_argument.topic_statement, 50)}
                </span>
              </div>
              <ExternalLink className="h-3 w-3 text-surface-500 flex-shrink-0 group-hover:text-surface-300 transition-colors" />
            </div>
            <p className="text-xs text-surface-300 leading-relaxed line-clamp-2">
              {author.best_argument.content}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
                gradeStyle(author.best_argument.ai_grade).text,
                gradeStyle(author.best_argument.ai_grade).bg,
                gradeStyle(author.best_argument.ai_grade).border,
              )}>
                {author.best_argument.ai_grade}
              </span>
              <span className="text-[10px] font-mono text-surface-500">
                {author.best_argument.ai_score.toFixed(1)} / 100
              </span>
              <span className="text-[10px] font-mono text-surface-500">·</span>
              <ThumbsUp className="h-2.5 w-2.5 text-surface-500" />
              <span className="text-[10px] font-mono text-surface-500">
                {author.best_argument.upvotes.toLocaleString()}
              </span>
            </div>
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArgumentAuthorsPage() {
  const [authors,   setAuthors]   = useState<ArgumentAuthor[]>([])
  const [period,    setPeriod]    = useState<AuthorPeriod>('month')
  const [category,  setCategory]  = useState<string>('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ period, limit: '30' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/arguments/authors?${params}`)
      if (!res.ok) throw new Error('Failed to load authors')
      const data = (await res.json()) as ArgumentAuthorsResponse
      setAuthors(data.authors)
    } catch {
      setError('Could not load author rankings. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [period, category])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link
                href="/arguments"
                className="text-surface-500 hover:text-surface-300 transition-colors"
                aria-label="Back to arguments"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gold/15 border border-gold/30">
                  <Users className="h-4 w-4 text-gold" />
                </div>
                <h1 className="font-mono text-xl font-bold text-white">Argument Authors</h1>
              </div>
            </div>
            <div className="flex items-center justify-between ml-9">
              <p className="text-sm font-mono text-surface-500">
                The Lobby&apos;s top writers ranked by cumulative argument quality
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href="/arguments/top-scored"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple/10 border border-purple/30 text-[11px] font-mono font-semibold text-purple hover:bg-purple/20 transition-colors flex-shrink-0"
                >
                  <Brain className="h-3 w-3" />
                  Best Quality
                </Link>
                <Link
                  href="/arguments/reactions"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 text-[11px] font-mono font-semibold text-gold hover:bg-gold/20 transition-colors flex-shrink-0"
                >
                  <Flame className="h-3 w-3" />
                  Reactions
                </Link>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            {/* Period tabs */}
            <div className="flex items-center gap-1 p-0.5 bg-surface-200/80 border border-surface-300 rounded-xl w-fit">
              {PERIODS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setPeriod(id)}
                  aria-pressed={period === id}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                    period === id
                      ? 'bg-gold/20 text-gold border border-gold/30 shadow-sm'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                onClick={() => setCategory('')}
                aria-pressed={category === ''}
                className={cn(
                  'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border transition-all',
                  category === ''
                    ? 'bg-surface-400 text-white border-surface-400'
                    : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400',
                )}
              >
                All Categories
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  aria-pressed={category === cat}
                  className={cn(
                    'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border transition-all',
                    category === cat
                      ? 'bg-for-600/80 text-white border-for-600'
                      : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Score key */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/40 border border-surface-300/40">
            <Scale className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
            <p className="text-[11px] font-mono text-surface-500">
              <span className="text-surface-300">Score</span> = avg_quality × log(arguments) + upvotes × 0.05 &mdash; rewards quality <em>and</em> volume
            </p>
          </div>

          {/* Results */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <AuthorSkeleton key={i} />)}
              </motion.div>
            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm font-mono text-against-400">{error}</p>
                  <button
                    onClick={load}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-300 hover:border-surface-400 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              </motion.div>
            ) : authors.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState
                  icon={Users}
                  title="No authors yet"
                  description={
                    category
                      ? `No scored arguments in ${category} for this period. Try a different filter.`
                      : 'No scored arguments for this period yet. Come back soon.'
                  }
                />
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {authors.map((author, i) => (
                  <AuthorCard key={author.user_id} author={author} rank={i + 1} />
                ))}

                {/* CTA to write arguments */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-surface-300/60 bg-surface-200/40">
                  <div>
                    <p className="text-sm font-semibold text-white">Want to rank here?</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">
                      Write well-sourced, substantive arguments on any topic
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-500 transition-colors flex-shrink-0"
                  >
                    Write now
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
