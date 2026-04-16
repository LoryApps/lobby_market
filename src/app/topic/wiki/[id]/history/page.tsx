'use client'

/**
 * /topic/wiki/[id]/history
 *
 * Shows the full edit history for a topic's wiki description (context field).
 * Each revision shows:
 *   - Editor attribution (avatar, username, role)
 *   - Timestamp
 *   - Character delta (+N / -N)
 *   - Expandable before/after diff view (word-level highlighting)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  FileEdit,
  RefreshCw,
  User,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { WikiHistoryEntry, WikiHistoryResponse } from '@/app/api/topics/[id]/wiki-history/route'

// ─── Word-diff engine ─────────────────────────────────────────────────────────

type DiffToken =
  | { type: 'same'; value: string }
  | { type: 'add'; value: string }
  | { type: 'remove'; value: string }

function tokenize(text: string): string[] {
  // Split on word boundaries, keeping whitespace tokens
  return text.split(/(\s+)/)
}

function wordDiff(oldText: string, newText: string): DiffToken[] {
  const oldTokens = tokenize(oldText)
  const newTokens = tokenize(newText)

  // LCS-based diff — cap at 800 tokens to avoid O(n²) blowup on large texts
  const oLen = Math.min(oldTokens.length, 800)
  const nLen = Math.min(newTokens.length, 800)

  // Build LCS table
  const dp: number[][] = Array.from({ length: oLen + 1 }, () =>
    new Array<number>(nLen + 1).fill(0)
  )

  for (let i = 1; i <= oLen; i++) {
    for (let j = 1; j <= nLen; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff tokens
  const result: DiffToken[] = []
  let i = oLen
  let j = nLen

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      result.unshift({ type: 'same', value: oldTokens[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', value: newTokens[j - 1] })
      j--
    } else {
      result.unshift({ type: 'remove', value: oldTokens[i - 1] })
      i--
    }
  }

  // If we capped at 800 tokens, append truncation markers
  if (oldTokens.length > 800 || newTokens.length > 800) {
    result.push({ type: 'same', value: ' …[truncated]' })
  }

  return result
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function deltaLabel(n: number): string {
  if (n === 0) return '±0'
  return n > 0 ? `+${n}` : `${n}`
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}

function EditorBadge({
  editor,
}: {
  editor: WikiHistoryEntry['editor']
}) {
  if (!editor) {
    return (
      <span className="flex items-center gap-1.5 text-surface-500">
        <User className="h-4 w-4" />
        <span className="text-xs font-mono">anonymous</span>
      </span>
    )
  }

  return (
    <Link
      href={`/profile/${editor.username}`}
      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity group"
    >
      <Avatar
        src={editor.avatar_url}
        fallback={editor.display_name || editor.username}
        size="xs"
      />
      <span
        className={cn(
          'text-xs font-mono',
          ROLE_COLOR[editor.role] ?? 'text-surface-400'
        )}
      >
        @{editor.username}
      </span>
    </Link>
  )
}

function DiffView({
  oldText,
  newText,
}: {
  oldText: string | null
  newText: string | null
}) {
  const tokens = wordDiff(oldText ?? '', newText ?? '')

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-50 p-4 text-sm leading-relaxed font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-96 overflow-y-auto">
      {tokens.length === 0 ? (
        <span className="text-surface-500 italic">No content</span>
      ) : (
        tokens.map((token, i) => {
          if (token.type === 'add') {
            return (
              <mark
                key={i}
                className="bg-emerald/20 text-emerald rounded-sm px-0.5"
              >
                {token.value}
              </mark>
            )
          }
          if (token.type === 'remove') {
            return (
              <del
                key={i}
                className="bg-against-500/15 text-against-400 rounded-sm px-0.5 line-through"
              >
                {token.value}
              </del>
            )
          }
          return <span key={i}>{token.value}</span>
        })
      )}
    </div>
  )
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  )
}

// ─── Entry card ────────────────────────────────────────────────────────────────

function HistoryCard({
  entry,
  index,
  isLatest,
}: {
  entry: WikiHistoryEntry
  index: number
  isLatest: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const delta = entry.char_delta ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
        <EditorBadge editor={entry.editor} />

        <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Clock className="h-3 w-3" />
          {relativeTime(entry.created_at)}
        </span>

        {/* Character delta badge */}
        <span
          className={cn(
            'ml-auto flex-shrink-0 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            delta > 0
              ? 'bg-emerald/10 border-emerald/30 text-emerald'
              : delta < 0
                ? 'bg-against-500/10 border-against-500/30 text-against-400'
                : 'bg-surface-200 border-surface-300 text-surface-500'
          )}
        >
          {deltaLabel(delta)} chars
        </span>

        {isLatest && (
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-for-500/10 border border-for-500/30 text-for-400">
            CURRENT
          </span>
        )}

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors ml-1"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide diff' : 'Show diff'}
        >
          {expanded ? (
            <>
              Hide <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Diff <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>

      {/* Diff view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] font-mono text-surface-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald/30" />
                  Added
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-against-500/25" />
                  Removed
                </span>
              </div>
              <DiffView
                oldText={entry.previous_content}
                newText={entry.new_content}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TopicWikiHistoryPage() {
  const params = useParams()
  const topicId = Array.isArray(params.id) ? params.id[0] : params.id

  const [data, setData] = useState<WikiHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!topicId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/wiki-history`)
      if (!res.ok) throw new Error('Failed to load history')
      const json = await res.json() as WikiHistoryResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">
        {/* Back / breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          {topicId && (
            <Link
              href={`/topic/${topicId}`}
              className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to topic
            </Link>
          )}
        </div>

        {/* Page header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-for-400" aria-hidden="true" />
              <h1 className="text-xl font-bold text-white">Wiki Edit History</h1>
            </div>

            {data?.topic && (
              <p className="text-sm text-surface-400 line-clamp-2 max-w-lg">
                {data.topic.statement}
              </p>
            )}
          </div>

          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh history"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Status badges */}
        {data?.topic && (
          <div className="flex items-center gap-2 mb-6">
            <Badge variant={
              data.topic.status === 'law' ? 'law'
              : data.topic.status === 'failed' ? 'failed'
              : data.topic.status === 'active' ? 'active'
              : 'proposed'
            }>
              {data.topic.status.charAt(0).toUpperCase() + data.topic.status.slice(1)}
            </Badge>
            {data.topic.category && (
              <span className="text-[11px] font-mono uppercase tracking-wider text-surface-500">
                {data.topic.category}
              </span>
            )}
            {!loading && data.entries.length > 0 && (
              <span className="text-[11px] font-mono text-surface-600 ml-auto">
                {data.entries.length} revision{data.entries.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <HistorySkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <FileEdit className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={load}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-10 text-center">
            <BookOpen className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white mb-1">No edit history yet</p>
            <p className="text-xs font-mono text-surface-500">
              Edits to this topic&apos;s wiki description will appear here.
            </p>
            {topicId && (
              <Link
                href={`/topic/${topicId}`}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <FileEdit className="h-3.5 w-3.5" />
                Edit the wiki
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {data.entries.map((entry, i) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                index={i}
                isLatest={i === 0}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
