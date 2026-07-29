'use client'

/**
 * /law/[id]/wiki-history — Law Wiki Edit History
 *
 * Wikipedia-style revision history for a law's collaborative wiki page.
 * Shows every edit, who made it, when, and how much changed.
 * Expanding an entry reveals a line-by-line diff.
 *
 * Distinct from:
 *   /law/[id]/wiki      — the live editable wiki page itself
 *   /law/[id]/revisions — community-proposed law text revisions
 *   /law/[id]/community — amendment proposals + community notes
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  Gavel,
  History,
  Minus,
  Plus,
  RefreshCw,
  Trophy,
  User,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawWikiHistoryResponse, LawWikiHistoryEntry } from '@/app/api/laws/[id]/wiki-history/route'

// ─── Diff logic ───────────────────────────────────────────────────────────────

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

function computeDiff(oldText: string | null, newText: string | null): DiffLine[] {
  const oldLines = (oldText ?? '').split('\n')
  const newLines = (newText ?? '').split('\n')

  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const result: DiffLine[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: newLines[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: oldLines[i - 1] })
      i--
    }
  }

  const CONTEXT = 3
  const changed = new Set<number>()
  result.forEach((line, idx) => {
    if (line.type !== 'unchanged') {
      for (let k = Math.max(0, idx - CONTEXT); k <= Math.min(result.length - 1, idx + CONTEXT); k++) {
        changed.add(k)
      }
    }
  })

  if (changed.size === 0) return result.slice(0, 10)

  const collapsed: DiffLine[] = []
  let skipping = false
  result.forEach((line, idx) => {
    if (changed.has(idx)) {
      skipping = false
      collapsed.push(line)
    } else if (!skipping) {
      skipping = true
      collapsed.push({ type: 'unchanged', text: '…' })
    }
  })
  return collapsed
}

// ─── Time formatting ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Contributor aggregation ──────────────────────────────────────────────────

interface Contributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  edits: number
  charsAdded: number
  charsRemoved: number
}

function buildContributors(entries: LawWikiHistoryEntry[]): Contributor[] {
  const map = new Map<string, Contributor>()
  for (const entry of entries) {
    if (!entry.editor) continue
    const key = entry.editor.id
    const existing = map.get(key)
    const delta = entry.char_delta ?? 0
    if (!existing) {
      map.set(key, {
        id: entry.editor.id,
        username: entry.editor.username,
        display_name: entry.editor.display_name,
        avatar_url: entry.editor.avatar_url,
        edits: 1,
        charsAdded: delta > 0 ? delta : 0,
        charsRemoved: delta < 0 ? -delta : 0,
      })
    } else {
      existing.edits++
      if (delta > 0) existing.charsAdded += delta
      else existing.charsRemoved += -delta
    }
  }
  return [...map.values()].sort((a, b) => b.edits - a.edits).slice(0, 5)
}

// ─── Diff view ────────────────────────────────────────────────────────────────

function DiffView({ entry }: { entry: LawWikiHistoryEntry }) {
  const diff = computeDiff(entry.previous_content, entry.new_content)

  if (diff.length === 0) {
    return (
      <p className="text-[11px] font-mono text-surface-500 italic px-3 py-2">
        No content difference recorded.
      </p>
    )
  }

  return (
    <div className="font-mono text-[11px] rounded-xl overflow-hidden border border-surface-300 bg-surface-50">
      {diff.map((line, idx) => (
        <div
          key={idx}
          className={cn(
            'flex items-start gap-2 px-3 py-0.5 leading-relaxed border-b border-surface-300/40 last:border-0',
            line.type === 'added' && 'bg-emerald/5 border-l-2 border-l-emerald/50',
            line.type === 'removed' && 'bg-against-500/5 border-l-2 border-l-against-500/50',
            line.type === 'unchanged' && 'text-surface-600'
          )}
        >
          <span className="flex-shrink-0 w-3 mt-0.5">
            {line.type === 'added' && <Plus className="h-2.5 w-2.5 text-emerald" />}
            {line.type === 'removed' && <Minus className="h-2.5 w-2.5 text-against-400" />}
          </span>
          <span
            className={cn(
              'break-all whitespace-pre-wrap',
              line.type === 'added' && 'text-emerald',
              line.type === 'removed' && 'text-against-400 line-through',
              line.type === 'unchanged' && 'text-surface-600'
            )}
          >
            {line.text || <span className="opacity-40">(empty line)</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  index,
  isFirst,
}: {
  entry: LawWikiHistoryEntry
  index: number
  isFirst: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const delta = entry.char_delta ?? 0
  const isCreation = entry.previous_content === null || entry.previous_content === ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        isFirst ? 'border-emerald/30' : 'border-surface-300'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {entry.editor ? (
          <Link href={`/profile/${entry.editor.username}`} className="flex-shrink-0">
            <Avatar
              src={entry.editor.avatar_url}
              fallback={entry.editor.display_name || entry.editor.username}
              size="sm"
            />
          </Link>
        ) : (
          <div className="h-8 w-8 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0">
            <User className="h-3.5 w-3.5 text-surface-500" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.editor ? (
              <Link
                href={`/profile/${entry.editor.username}`}
                className="text-[13px] font-semibold text-white hover:text-for-300 transition-colors"
              >
                {entry.editor.display_name || entry.editor.username}
              </Link>
            ) : (
              <span className="text-[13px] font-semibold text-surface-500">Anonymous</span>
            )}

            {isCreation && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald/10 border border-emerald/20 text-emerald">
                <Plus className="h-2.5 w-2.5" />
                Created
              </span>
            )}
            {isFirst && !isCreation && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-for-500/10 border border-for-500/20 text-for-400">
                Latest
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1">
            <span
              title={formatDate(entry.created_at)}
              className="text-[11px] font-mono text-surface-500 flex items-center gap-1"
            >
              <Clock className="h-3 w-3" />
              {timeAgo(entry.created_at)}
            </span>

            <span
              className={cn(
                'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold',
                delta > 0
                  ? 'bg-emerald/10 border border-emerald/20 text-emerald'
                  : delta < 0
                    ? 'bg-against-500/10 border border-against-500/20 text-against-400'
                    : 'bg-surface-300/40 border border-surface-400/20 text-surface-500'
              )}
            >
              {delta > 0 ? <Plus className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
              {Math.abs(delta).toLocaleString()} chars
            </span>
          </div>
        </div>

        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse diff' : 'Show diff'}
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium',
            'border transition-all',
            expanded
              ? 'bg-surface-300 border-surface-400 text-white'
              : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
          )}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          diff
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="diff"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-300 pt-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                Changes in this revision
              </p>
              <DiffView entry={entry} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Contributor row ──────────────────────────────────────────────────────────

function ContributorRow({ contributor, rank }: { contributor: Contributor; rank: number }) {
  return (
    <Link
      href={`/profile/${contributor.username}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-all group"
    >
      <span className="font-mono text-[11px] text-surface-500 w-4 text-center flex-shrink-0">
        {rank === 1 ? <Trophy className="h-3.5 w-3.5 text-gold mx-auto" /> : `#${rank}`}
      </span>
      <Avatar
        src={contributor.avatar_url}
        fallback={contributor.display_name || contributor.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white truncate">
          {contributor.display_name || contributor.username}
        </p>
        <p className="text-[11px] font-mono text-surface-500">
          {contributor.edits} edit{contributor.edits !== 1 ? 's' : ''}
          {contributor.charsAdded > 0 && (
            <span className="text-emerald"> · +{contributor.charsAdded.toLocaleString()}</span>
          )}
          {contributor.charsRemoved > 0 && (
            <span className="text-against-400"> · -{contributor.charsRemoved.toLocaleString()}</span>
          )}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-white transition-colors flex-shrink-0" />
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LawWikiHistoryClientProps {
  lawId: string
}

export function LawWikiHistoryClient({ lawId }: LawWikiHistoryClientProps) {
  const router = useRouter()
  const [data, setData] = useState<LawWikiHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContributors, setShowContributors] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/wiki-history`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: LawWikiHistoryResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load wiki history. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const totalCharsAdded = data?.entries.reduce((s, e) => s + Math.max(0, e.char_delta ?? 0), 0) ?? 0
  const uniqueEditors = new Set(data?.entries.map((e) => e.editor?.id).filter(Boolean)).size
  const contributors = data ? buildContributors(data.entries) : []

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24 pt-2">
        <div className="max-w-2xl mx-auto px-4 py-4">

          {/* Back nav */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <span className="text-surface-600 text-[12px]">/</span>
            <Link
              href={`/law/${lawId}`}
              className="text-[12px] font-mono text-surface-500 hover:text-white transition-colors truncate max-w-[120px]"
            >
              {data?.law?.statement
                ? data.law.statement.slice(0, 30) + (data.law.statement.length > 30 ? '…' : '')
                : 'Law'}
            </Link>
            <span className="text-surface-600 text-[12px]">/</span>
            <Link
              href={`/law/${lawId}/wiki`}
              className="text-[12px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              Wiki
            </Link>
            <span className="text-surface-600 text-[12px]">/</span>
            <span className="text-[12px] font-mono text-white">History</span>
          </div>

          {/* Page header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                <History className="h-4 w-4 text-gold" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white font-mono">Law Wiki History</h1>
                <p className="text-[12px] font-mono text-surface-500">
                  Every revision to this law&apos;s wiki — who made it, and what changed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/law/${lawId}/wiki`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-mono font-medium',
                  'border border-surface-400 bg-surface-200 text-white',
                  'hover:bg-surface-300 transition-colors'
                )}
              >
                <Edit3 className="h-3 w-3" />
                Edit wiki
              </Link>
              <button
                onClick={load}
                disabled={loading}
                aria-label="Refresh history"
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-xl',
                  'bg-surface-200 border border-surface-300 text-surface-500',
                  'hover:text-white hover:border-surface-400 transition-colors',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
              <div className="space-y-3 mt-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-2xl bg-against-500/5 border border-against-500/20 p-6 text-center">
              <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          )}

          {/* Content */}
          {!loading && !error && data && (
            <div className="space-y-5">

              {/* Stats */}
              {data.entries.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-3 gap-3"
                >
                  {[
                    { label: 'Total Edits', value: data.total.toLocaleString(), icon: FileText, color: 'text-white' },
                    { label: 'Contributors', value: uniqueEditors.toLocaleString(), icon: Users, color: 'text-for-400' },
                    { label: 'Chars Added', value: `+${totalCharsAdded.toLocaleString()}`, icon: Plus, color: 'text-emerald' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center justify-center py-4 px-2 rounded-xl bg-surface-100 border border-surface-300 text-center"
                    >
                      <Icon className={cn('h-4 w-4 mb-1.5', color)} />
                      <p className={cn('text-base font-bold font-mono', color)}>{value}</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Top contributors */}
              {contributors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                >
                  <button
                    onClick={() => setShowContributors((s) => !s)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-200/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-gold" />
                      <span className="text-[12px] font-mono font-semibold text-white uppercase tracking-wider">
                        Top Wiki Contributors
                      </span>
                    </div>
                    {showContributors
                      ? <ChevronUp className="h-4 w-4 text-surface-500" />
                      : <ChevronDown className="h-4 w-4 text-surface-500" />
                    }
                  </button>

                  <AnimatePresence>
                    {showContributors && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2 border-t border-surface-300">
                          <div className="h-3" />
                          {contributors.map((c, i) => (
                            <ContributorRow key={c.id} contributor={c} rank={i + 1} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Edit timeline */}
              {data.entries.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Revision History
                    <span className="ml-auto text-surface-600 normal-case tracking-normal">
                      Most recent first
                    </span>
                  </p>

                  {data.entries.map((entry, i) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      index={i}
                      isFirst={i === 0}
                    />
                  ))}

                  {data.total >= 50 && (
                    <p className="text-center text-[11px] font-mono text-surface-600 pt-2">
                      Showing 50 most recent revisions
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No wiki edits yet"
                  description="This law doesn't have a wiki article yet. Be the first to write context, history, and impact analysis."
                  action={{ label: 'Write the wiki', href: `/law/${lawId}/wiki` }}
                />
              )}

              {/* Explore links */}
              {data.entries.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                    Explore This Law
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: `/law/${lawId}/revisions`, label: 'Law Revisions', icon: FileText },
                      { href: `/law/${lawId}/community`, label: 'Community Notes', icon: Users },
                      { href: `/law/${lawId}/debate`, label: 'Original Debate', icon: Gavel },
                      { href: `/law/${lawId}/impact`, label: 'Impact Analysis', icon: History },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-all group"
                      >
                        <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
                        <span className="text-[11px] font-mono text-surface-600 group-hover:text-white transition-colors">
                          {label}
                        </span>
                        <ChevronRight className="h-3 w-3 text-surface-600 ml-auto group-hover:text-white transition-colors" />
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}

            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
