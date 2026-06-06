'use client'

/**
 * /anthology — The Argument Anthology
 *
 * A daily editorial curation of the five best civic arguments written on
 * the platform, ranked by a composite of community upvotes and AI quality
 * score. A weekly edition shows the top 15 from the past seven days.
 *
 * Distinct from:
 *   /arguments/daily    — single Argument of the Day, 7-day archive
 *   /arguments/trending — raw trending list, no editorial curation
 *   /brief              — AI-generated summary prose, not actual arguments
 *   /newspaper          — platform-wide editorial, not argument-focused
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Gavel,
  Quote,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AnthologyResponse, AnthologyArgument, AnthologyEdition } from '@/app/api/anthology/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald',
  A: 'text-emerald',
  'A-': 'text-emerald',
  'B+': 'text-for-400',
  B: 'text-for-400',
  'B-': 'text-for-400',
  C: 'text-gold',
  D: 'text-surface-500',
  F: 'text-against-400',
}

const ORDINAL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV']

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, index }: { arg: AnthologyArgument; index: number }) {
  const isFor = arg.side === 'blue'
  const gradeColor = arg.ai_grade ? (GRADE_COLOR[arg.ai_grade] ?? 'text-surface-400') : 'text-surface-400'

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="rounded-2xl border border-surface-300/60 bg-surface-100/80 overflow-hidden"
    >
      {/* Header strip */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2.5 border-b border-surface-300/40',
          isFor ? 'bg-for-900/20' : 'bg-against-900/20',
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-mono text-xs font-bold tracking-widest',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            {ORDINAL[index] ?? String(index + 1)}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5',
              isFor
                ? 'bg-for-500/15 text-for-400 border border-for-500/25'
                : 'bg-against-500/15 text-against-400 border border-against-500/25',
            )}
          >
            {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {arg.ai_grade && (
            <span className={cn('font-mono text-xs font-bold', gradeColor)}>
              {arg.ai_grade}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-surface-500 font-mono">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Topic context */}
        {arg.topic && (
          <Link
            href={`/topic/${arg.topic_id}`}
            className="flex items-start gap-1.5 group"
          >
            <Scale className="h-3.5 w-3.5 text-surface-500 shrink-0 mt-0.5" />
            <span className="text-[11px] text-surface-500 group-hover:text-white line-clamp-2 leading-relaxed transition-colors">
              {arg.topic.statement}
            </span>
            <ChevronRight className="h-3 w-3 text-surface-600 shrink-0 mt-0.5 group-hover:text-surface-400 transition-colors" />
          </Link>
        )}

        {/* Argument text */}
        <blockquote className="relative pl-4">
          <Quote className="absolute left-0 top-0 h-3 w-3 text-surface-600/60" />
          <p className="text-sm text-white leading-relaxed font-light">{arg.content}</p>
        </blockquote>

        {/* Source */}
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-for-400 hover:text-for-300 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-300/40 bg-surface-200/40">
        <div className="flex items-center gap-2">
          <Avatar
            src={arg.author?.avatar_url ?? null}
            fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
            size="xs"
          />
          <div className="min-w-0">
            {arg.author ? (
              <Link
                href={`/profile/${arg.author.username}`}
                className="text-xs font-semibold text-surface-300 hover:text-white transition-colors truncate block"
              >
                {arg.author.display_name ?? arg.author.username}
              </Link>
            ) : (
              <span className="text-xs text-surface-500">Anonymous</span>
            )}
          </div>
          {arg.author?.role && arg.author.role !== 'person' && (
            <Badge variant={arg.author.role as Parameters<typeof Badge>[0]['variant']}>
              {arg.author.role}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {arg.topic && (
            <span
              className={cn(
                'text-[10px] font-mono font-semibold',
                arg.topic.status === 'law' ? 'text-gold' : 'text-surface-500',
              )}
            >
              {arg.topic.blue_pct != null
                ? `${Math.round(arg.topic.blue_pct)}% FOR`
                : arg.topic.status.toUpperCase()}
            </span>
          )}
          <span className="text-[11px] text-surface-600 font-mono">
            {relativeTime(arg.created_at)}
          </span>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Edition Panel ────────────────────────────────────────────────────────────

function EditionPanel({ edition, isLoading }: { edition: AnthologyEdition | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!edition || edition.arguments.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No entries yet"
        description="Arguments will appear here once they've earned enough community votes and quality scores."
        actions={[{ label: 'Browse Topics', href: '/' }]}
      />
    )
  }

  return (
    <div className="space-y-4">
      {edition.arguments.map((arg, i) => (
        <ArgumentCard key={arg.id} arg={arg} index={i} />
      ))}
      <p className="text-center text-[11px] text-surface-600 font-mono pt-2">
        Selected from {edition.totalConsidered} arguments · ranked by upvotes + quality score
      </p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Edition = 'daily' | 'weekly'

export function AnthologyClient() {
  const [data, setData] = useState<AnthologyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [edition, setEdition] = useState<Edition>('daily')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/anthology')
      if (res.ok) setData(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const currentEdition = data ? (edition === 'daily' ? data.daily : data.weekly) : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/arguments"
              className="text-surface-500 hover:text-white transition-colors"
              aria-label="Back to arguments"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-gold" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                The Argument Anthology
              </h1>
            </div>
          </div>
          <p className="text-sm text-surface-500 ml-6">
            The platform&apos;s finest civic arguments — curated by the community
          </p>
        </div>

        {/* Edition tabs */}
        <div className="flex gap-2 mb-6">
          {(
            [
              { id: 'daily' as Edition, label: 'Today\'s Five', icon: Sparkles },
              { id: 'weekly' as Edition, label: 'Weekly Fifteen', icon: Trophy },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setEdition(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold',
                'border transition-all',
                edition === id
                  ? 'bg-gold/15 border-gold/40 text-gold'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh anthology"
            className="px-3 py-2 rounded-xl border border-surface-300/60 bg-surface-200/60 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Edition meta */}
        <AnimatePresence mode="wait">
          {currentEdition && !loading && (
            <motion.div
              key={edition}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-gold" />
                  <span className="text-sm font-semibold text-white">
                    {currentEdition.editionLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/arguments/trending"
                    className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors"
                  >
                    <Zap className="h-3 w-3" />
                    All trending
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  {edition === 'daily' && (
                    <Link
                      href="/argument-of-the-day"
                      className="inline-flex items-center gap-1 text-[11px] text-gold hover:text-gold/80 transition-colors"
                    >
                      <Gavel className="h-3 w-3" />
                      Arg of Day
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={edition + (loading ? '-loading' : '-loaded')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EditionPanel edition={currentEdition} isLoading={loading} />
          </motion.div>
        </AnimatePresence>

        {/* Footer links */}
        {!loading && (
          <div className="mt-8 pt-6 border-t border-surface-300/40">
            <p className="text-xs text-surface-600 text-center mb-4">
              Want to appear in the Anthology? Write compelling, well-reasoned arguments with sources.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              {[
                { href: '/arguments/champions', label: 'Hall of Fame', icon: Trophy },
                { href: '/leaderboard/arguments', label: 'Argument Leaderboard', icon: Award },
                { href: '/coach', label: 'Argument Coach', icon: Sparkles },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 text-xs text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
