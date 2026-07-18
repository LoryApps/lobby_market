'use client'

/**
 * /exchange/ideas/leaderboard — Market Thesis Leaderboard
 *
 * Ranks the top market idea authors by community engagement score
 * (net upvotes across all submitted theses). Filterable by time period.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Calendar,
  Crown,
  Flame,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { IdeaAuthorRank, IdeasLeaderboardResponse } from '@/app/api/exchange/ideas/leaderboard/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_TABS = [
  { id: 'all',   label: 'All Time', icon: Crown   },
  { id: 'month', label: '30 Days',  icon: Calendar },
  { id: 'week',  label: '7 Days',   icon: Flame    },
] as const
type Period = (typeof PERIOD_TABS)[number]['id']

const DIRECTION_CONFIG = {
  for:     { label: 'For',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20'    },
  against: { label: 'Against', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
  neutral: { label: 'Neutral', color: 'text-surface-400', bg: 'bg-surface-300/10', border: 'border-surface-300/20' },
}

const RANK_STYLES: Record<number, { medal: string; glow: string; numColor: string }> = {
  1: { medal: '🥇', glow: 'ring-1 ring-gold/30',    numColor: 'text-gold'     },
  2: { medal: '🥈', glow: 'ring-1 ring-surface-400/40', numColor: 'text-surface-300' },
  3: { medal: '🥉', glow: 'ring-1 ring-amber-700/40',   numColor: 'text-amber-600' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClout(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Author Row ────────────────────────────────────────────────────────────────

function AuthorRow({ author, rank }: { author: IdeaAuthorRank; rank: number }) {
  const style = RANK_STYLES[rank]
  const dirCfg = author.top_idea_direction
    ? DIRECTION_CONFIG[author.top_idea_direction as keyof typeof DIRECTION_CONFIG]
    : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.5) }}
      className={cn(
        'bg-surface-100 border border-surface-300/50 rounded-xl p-4 hover:border-surface-300/80 transition-colors',
        style?.glow
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className="flex-shrink-0 w-8 text-center pt-0.5">
          {style ? (
            <span className="text-lg leading-none">{style.medal}</span>
          ) : (
            <span className={cn('text-sm font-mono font-bold', 'text-surface-500')}>
              #{rank}
            </span>
          )}
        </div>

        {/* Avatar */}
        <Link href={`/profile/${author.username}`} className="flex-shrink-0">
          <Avatar
            src={author.avatar_url}
            fallback={author.display_name || author.username || '?'}
            size="md"
          />
        </Link>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link
              href={`/profile/${author.username}`}
              className="font-semibold text-white text-sm hover:text-for-300 transition-colors truncate"
            >
              {author.display_name || author.username}
            </Link>
            {author.featured_count > 0 && (
              <span className="flex items-center gap-1 text-xs font-mono text-gold">
                <Sparkles className="h-3 w-3" />
                {author.featured_count} featured
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-surface-500 mb-3">
            <span className="flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              {author.idea_count} {author.idea_count === 1 ? 'thesis' : 'theses'}
            </span>
            <span className="flex items-center gap-1 text-for-400">
              <TrendingUp className="h-3 w-3" />
              +{author.total_upvotes}
            </span>
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              {author.avg_score > 0 ? '+' : ''}{author.avg_score} avg
            </span>
            <span className="flex items-center gap-1 text-surface-400">
              <Zap className="h-3 w-3" />
              {formatClout(author.clout)} clout
            </span>
          </div>

          {/* Top idea */}
          {author.top_idea_title && (
            <div className="flex items-start gap-2 p-2.5 bg-surface-200/60 rounded-lg border border-surface-300/30">
              <Target className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-300 line-clamp-2 leading-snug">{author.top_idea_title}</p>
              </div>
              {dirCfg && (
                <span className={cn(
                  'flex-shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border',
                  dirCfg.color, dirCfg.bg, dirCfg.border
                )}>
                  {dirCfg.label}
                </span>
              )}
              <span className={cn(
                'flex-shrink-0 text-xs font-mono font-bold',
                author.top_idea_score > 0 ? 'text-for-400' : author.top_idea_score < 0 ? 'text-against-400' : 'text-surface-500'
              )}>
                {author.top_idea_score > 0 ? '+' : ''}{author.top_idea_score}
              </span>
            </div>
          )}
        </div>

        {/* Net score badge */}
        <div className="flex-shrink-0 text-right">
          <div className={cn(
            'text-xl font-mono font-black tabular-nums',
            author.net_score > 0 ? 'text-for-400' : author.net_score < 0 ? 'text-against-400' : 'text-surface-500'
          )}>
            {author.net_score > 0 ? '+' : ''}{author.net_score}
          </div>
          <div className="text-xs font-mono text-surface-600 mt-0.5">net score</div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function IdeasLeaderboardClient() {
  const [authors,  setAuthors]  = useState<IdeaAuthorRank[]>([])
  const [period,   setPeriod]   = useState<Period>('all')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/ideas/leaderboard?period=${period}`)
      if (!res.ok) throw new Error('Failed to load leaderboard')
      const data: IdeasLeaderboardResponse = await res.json()
      setAuthors(data.authors)
    } catch {
      setError('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const top3       = authors.slice(0, 3)
  const rest       = authors.slice(3)
  const totalIdeas = authors.reduce((s, a) => s + a.idea_count, 0)
  const totalScore = authors.reduce((s, a) => s + a.total_upvotes, 0)

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24 pt-14">
        {/* Header */}
        <div className="border-b border-surface-300/40 bg-surface-100/60 backdrop-blur-sm sticky top-14 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Link
                href="/exchange/ideas"
                className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-mono">Market Ideas</span>
              </Link>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-gold/10 border border-gold/20">
                <Award className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Thesis Leaderboard</h1>
                <p className="text-xs text-surface-400 font-mono">
                  Top prediction authors · ranked by community score
                </p>
              </div>
            </div>

            {/* Period tabs */}
            <div className="flex bg-surface-200/80 rounded-lg p-0.5 gap-0.5">
              {PERIOD_TABS.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setPeriod(tab.id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-mono transition-colors',
                      period === tab.id
                        ? 'bg-surface-100 text-white'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={<Award className="h-8 w-8 text-against-400" />}
              title="Failed to load"
              description={error}
              action={{ label: 'Retry', onClick: fetchData }}
            />
          ) : authors.length === 0 ? (
            <EmptyState
              icon={<Lightbulb className="h-8 w-8 text-gold" />}
              title="No ideas yet"
              description={
                period === 'all'
                  ? 'No prediction theses have been submitted yet.'
                  : `No theses submitted in the last ${period === 'week' ? '7' : '30'} days.`
              }
              action={{ label: 'Be First', onClick: () => window.location.href = '/exchange/ideas' }}
            />
          ) : (
            <>
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-100 border border-surface-300/50 rounded-xl p-3 text-center">
                  <div className="text-xl font-mono font-black text-white">{authors.length}</div>
                  <div className="text-xs font-mono text-surface-500 mt-0.5">Authors</div>
                </div>
                <div className="bg-surface-100 border border-surface-300/50 rounded-xl p-3 text-center">
                  <div className="text-xl font-mono font-black text-for-400">{totalIdeas}</div>
                  <div className="text-xs font-mono text-surface-500 mt-0.5">Theses</div>
                </div>
                <div className="bg-surface-100 border border-surface-300/50 rounded-xl p-3 text-center">
                  <div className="text-xl font-mono font-black text-gold">+{totalScore}</div>
                  <div className="text-xs font-mono text-surface-500 mt-0.5">Upvotes</div>
                </div>
              </div>

              {/* Top 3 podium */}
              {top3.length > 0 && (
                <div className="grid gap-3">
                  {top3.map((author, i) => (
                    <AuthorRow key={author.user_id} author={author} rank={i + 1} />
                  ))}
                </div>
              )}

              {/* Divider */}
              {rest.length > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-surface-300/30" />
                    <span className="text-xs font-mono text-surface-600">Rising Voices</span>
                    <div className="flex-1 h-px bg-surface-300/30" />
                  </div>

                  <div className="space-y-3">
                    {rest.map((author, i) => (
                      <AuthorRow key={author.user_id} author={author} rank={i + 4} />
                    ))}
                  </div>
                </>
              )}

              {/* Footer links */}
              <div className="flex items-center justify-center gap-4 pt-2 pb-4">
                <Link
                  href="/exchange/ideas"
                  className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  ← All Ideas
                </Link>
                <span className="text-surface-700">·</span>
                <button
                  onClick={fetchData}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
