'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicArgumentWithAuthor } from '@/lib/supabase/types'
import type { LawArgumentsResponse } from '@/app/api/laws/[id]/arguments/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'blue' | 'red'
type SortOption = 'top' | 'quality' | 'new'

// ─── Config ───────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'top', label: 'Top Voted' },
  { id: 'quality', label: 'AI Quality' },
  { id: 'new', label: 'Newest' },
]

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  B: { text: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  C: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  D: { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  F: { text: 'text-against-400', bg: 'bg-against-600/10', border: 'border-against-600/30' },
}

const ROLE_STYLE: Record<string, string> = {
  elder: 'text-gold',
  senator: 'text-purple',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  person: 'text-surface-400',
}

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60_000)
  const h = Math.floor(m / 60)
  const day = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  topicId,
}: {
  arg: TopicArgumentWithAuthor
  topicId: string
}) {
  const isFor = arg.side === 'blue'
  const grade = arg.ai_grade ?? null
  const gradeConfig = grade ? GRADE_CONFIG[grade] ?? null : null
  const authorName = arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-surface-100 p-4 transition-colors',
        isFor
          ? 'border-for-600/30 hover:border-for-500/50'
          : 'border-against-600/30 hover:border-against-500/50'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Side pill */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider flex-shrink-0',
              isFor
                ? 'bg-for-600/20 border border-for-600/40 text-for-400'
                : 'bg-against-600/20 border border-against-600/40 text-against-400'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-3 w-3" />
            ) : (
              <ThumbsDown className="h-3 w-3" />
            )}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>

          {/* AI grade */}
          {gradeConfig && grade && (
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border flex-shrink-0',
                gradeConfig.bg,
                gradeConfig.border,
                gradeConfig.text
              )}
            >
              {grade}
            </span>
          )}
        </div>

        {/* Upvotes */}
        <div className="flex items-center gap-1 text-xs font-mono text-surface-400 flex-shrink-0">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes.toLocaleString()}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm font-mono text-surface-200 leading-relaxed mb-3">
        {arg.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {arg.author ? (
            <Link
              href={`/profile/${arg.author.username}`}
              className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={arg.author.avatar_url ?? null}
                username={arg.author.username}
                size="xs"
              />
              <span
                className={cn(
                  'text-[11px] font-mono truncate max-w-[120px]',
                  ROLE_STYLE[arg.author.role] ?? 'text-surface-500'
                )}
              >
                {authorName}
              </span>
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-surface-600">Anonymous</span>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {relTime(arg.created_at)}
          </span>
          {(arg.reply_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-600">
              <MessageSquare className="h-2.5 w-2.5" />
              {arg.reply_count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {arg.source_url && (
            <a
              href={arg.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Source
            </a>
          )}
          <Link
            href={`/topic/${topicId}/arguments`}
            className="flex items-center gap-0.5 text-[10px] font-mono text-surface-600 hover:text-white transition-colors"
          >
            View thread
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
  initialData: LawArgumentsResponse
  currentUserId: string | null
}

export function LawArgumentsClient({ lawId, initialData }: Props) {
  const [data, setData] = useState<LawArgumentsResponse>(initialData)
  const [loading, setLoading] = useState(false)
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [sort, setSort] = useState<SortOption>('top')

  const { law, totalFor, totalAgainst } = data

  const filtered = data.arguments.filter((a) => {
    if (sideFilter === 'blue') return a.side === 'blue'
    if (sideFilter === 'red') return a.side === 'red'
    return true
  })

  const refresh = useCallback(async (newSort: SortOption) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/arguments?sort=${newSort}`)
      if (res.ok) {
        const json = (await res.json()) as LawArgumentsResponse
        setData(json)
        setSort(newSort)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [lawId])

  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Law
        </Link>

        {/* Law header */}
        <div className="rounded-2xl bg-surface-100 border border-emerald/20 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="law">
              <Gavel className="h-3 w-3 mr-1" />
              Established Law
            </Badge>
            {law.category && (
              <span className="text-xs font-mono text-surface-500">{law.category}</span>
            )}
          </div>

          <p className="font-mono text-white font-semibold leading-snug mb-4">
            {law.statement}
          </p>

          {/* Vote bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-for-400">{forPct}% For</span>
              <span className="text-surface-500">
                {(law.total_votes ?? 0).toLocaleString()} votes
              </span>
              <span className="text-against-400">{againstPct}% Against</span>
            </div>
            <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-500 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-for-400" />
              {totalFor} FOR arguments
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="h-3 w-3 text-against-400" />
              {totalAgainst} AGAINST arguments
            </span>
          </div>
        </div>

        {/* Page title */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-gold" />
            <h1 className="font-mono text-lg font-bold text-white">
              Founding Arguments
            </h1>
          </div>
          <button
            onClick={() => refresh(sort)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        <p className="text-xs font-mono text-surface-500 mb-5">
          The arguments made during the original debate that shaped this law.
        </p>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {/* Side filter */}
          <div className="flex rounded-lg overflow-hidden border border-surface-300">
            {([
              { id: 'all' as const, label: 'All' },
              { id: 'blue' as const, label: 'FOR' },
              { id: 'red' as const, label: 'AGAINST' },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSideFilter(opt.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-mono font-medium transition-colors',
                  sideFilter === opt.id
                    ? opt.id === 'blue'
                      ? 'bg-for-600 text-white'
                      : opt.id === 'red'
                      ? 'bg-against-600 text-white'
                      : 'bg-surface-300 text-white'
                    : 'bg-surface-100 text-surface-500 hover:text-white hover:bg-surface-200'
                )}
              >
                {opt.label}
                {opt.id === 'blue' && ` (${totalFor})`}
                {opt.id === 'red' && ` (${totalAgainst})`}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 ml-auto">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => sort !== opt.id && refresh(opt.id)}
                disabled={loading}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors',
                  sort === opt.id
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-white hover:bg-surface-200'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arguments list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No arguments found"
            description={
              sideFilter !== 'all'
                ? `No ${sideFilter === 'blue' ? 'FOR' : 'AGAINST'} arguments for this filter.`
                : 'No arguments were recorded for this topic.'
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map((arg) => (
                <ArgumentCard
                  key={arg.id}
                  arg={arg}
                  topicId={law.topic_id ?? ''}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Link to original topic */}
        {law.topic_id && (
          <div className="mt-8 pt-6 border-t border-surface-300">
            <p className="text-xs font-mono text-surface-600 mb-3">
              See the full debate that preceded this law:
            </p>
            <Link
              href={`/topic/${law.topic_id}/arguments`}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                'text-sm font-mono transition-colors'
              )}
            >
              <Scale className="h-4 w-4" />
              View full argument thread
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
