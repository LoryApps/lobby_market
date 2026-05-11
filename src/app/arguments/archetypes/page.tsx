'use client'

/**
 * /arguments/archetypes — Rhetorical Archetype Leaderboard
 *
 * Platform-wide breakdown of the 8 rhetorical archetypes from the DNA system.
 * Shows per-archetype stats (user count, avg quality score, A-grade rate,
 * top categories) and the top 3 users per archetype by argument volume + grade.
 *
 * Complements /arguments/dna (personal view) with a community-wide lens.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronDown,
  ChevronUp,
  Crown,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ArchetypeEntry, ArchetypeUser, ArchetypesResponse } from '@/app/api/arguments/archetypes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreBar(score: number | null): { width: string; color: string } {
  if (score === null) return { width: '0%', color: 'bg-surface-400' }
  const pct = Math.round((score / 10) * 100)
  let color = 'bg-against-500'
  if (score >= 8) color = 'bg-emerald'
  else if (score >= 6) color = 'bg-for-400'
  else if (score >= 5) color = 'bg-gold'
  return { width: `${pct}%`, color }
}

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
}

function UserRow({
  user,
  rank,
}: {
  user: ArchetypeUser
  rank: number
}) {
  const name = user.display_name || user.username
  const role = ROLE_LABEL[user.role] ?? 'Citizen'
  const { width, color } = scoreBar(user.avg_score)

  return (
    <Link
      href={`/profile/${user.username}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
    >
      <span
        className={cn(
          'w-5 text-center text-xs font-mono font-bold flex-shrink-0',
          rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-300' : 'text-surface-500'
        )}
      >
        {rank === 1 ? <Crown className="h-3.5 w-3.5 mx-auto" /> : rank}
      </span>

      <Avatar
        src={user.avatar_url}
        alt={name}
        size={28}
        className="flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-mono font-semibold text-white truncate leading-tight">
            {name}
          </span>
          <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">{role}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1 bg-surface-300/30 rounded-full overflow-hidden max-w-[60px]">
            <div className={cn('h-full rounded-full transition-all', color)} style={{ width }} />
          </div>
          {user.avg_score !== null && (
            <span className="text-[10px] font-mono text-surface-400">{user.avg_score}/10</span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-400">
          <MessageSquare className="h-3 w-3" />
          <span>{user.argument_count}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <ThumbsUp className="h-2.5 w-2.5" />
          <span>{user.best_upvotes}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg bg-surface-200/40 border border-surface-300/30">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <span className={cn('text-sm font-mono font-bold', color)}>{value}</span>
      <span className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Archetype Card ────────────────────────────────────────────────────────────

function ArchetypeCard({
  entry,
  isMine,
  myRank,
  isExpanded,
  onToggle,
}: {
  entry: ArchetypeEntry
  isMine: boolean
  myRank: number | null
  isExpanded: boolean
  onToggle: () => void
}) {
  const { width: scoreWidth, color: scoreColor } = scoreBar(entry.avg_score)

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border overflow-hidden transition-all',
        isMine ? 'ring-1 ring-white/20' : '',
        entry.border,
        entry.bg
      )}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 pt-4 pb-3 flex items-start gap-3"
      >
        {/* Archetype icon placeholder — colored circle */}
        <div
          className={cn(
            'h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5',
            entry.border,
            entry.bg
          )}
        >
          <Brain className={cn('h-5 w-5', entry.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('font-mono text-base font-bold leading-tight', entry.color)}>
              {entry.name}
            </h2>
            {isMine && (
              <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border', entry.badge)}>
                YOU
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-surface-400 mt-0.5 italic">&ldquo;{entry.tagline}&rdquo;</p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs font-mono text-surface-400">
            <Users className="h-3 w-3" />
            <span className="font-bold text-white">{entry.user_count}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-surface-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-500" />
          )}
        </div>
      </button>

      {/* Stats strip (always visible) */}
      <div className="px-4 pb-3 grid grid-cols-4 gap-2">
        <StatPill
          icon={MessageSquare}
          label="arguments"
          value={entry.argument_count >= 1000 ? `${(entry.argument_count / 1000).toFixed(1)}k` : String(entry.argument_count)}
          color={entry.color}
        />
        <StatPill
          icon={Star}
          label="avg score"
          value={entry.avg_score !== null ? `${entry.avg_score}/10` : '–'}
          color={entry.color}
        />
        <StatPill
          icon={Trophy}
          label="A-grade %"
          value={entry.pct_a_grade > 0 ? `${entry.pct_a_grade}%` : '–'}
          color={entry.color}
        />
        <StatPill
          icon={ThumbsUp}
          label="avg ♥"
          value={String(entry.avg_upvotes)}
          color={entry.color}
        />
      </div>

      {/* Quality bar */}
      {entry.avg_score !== null && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-surface-500 w-20">Quality score</span>
            <div className="flex-1 h-1.5 bg-surface-300/30 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', scoreColor)}
                initial={{ width: 0 }}
                animate={{ width: scoreWidth }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className={cn('text-[11px] font-mono font-bold', entry.color)}>
              {entry.avg_score}/10
            </span>
          </div>
        </div>
      )}

      {/* Categories */}
      {entry.top_categories.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
          <Tag className="h-3 w-3 text-surface-500 flex-shrink-0" />
          {entry.top_categories.map((cat) => (
            <span
              key={cat}
              className="text-[10px] font-mono text-surface-400 bg-surface-200/40 border border-surface-300/30 px-1.5 py-0.5 rounded"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* My rank row (if logged in and this archetype) */}
      {isMine && myRank !== null && (
        <div className={cn('mx-4 mb-3 px-3 py-2 rounded-lg border text-xs font-mono', entry.badge)}>
          You rank <strong>#{myRank}</strong> among {entry.name}s by argument volume
        </div>
      )}

      {/* Expanded: top users */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-3 border-t border-surface-300/20 pt-2">
              {entry.top_users.length === 0 ? (
                <p className="text-xs font-mono text-surface-500 text-center py-3">
                  No arguers classified yet
                </p>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider px-3 mb-1">
                    Top {entry.name}s
                  </p>
                  {entry.top_users.map((u, i) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      rank={i + 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function ArchetypeCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/30 bg-surface-100/40 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-4 w-8" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    </div>
  )
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'users' | 'quality' | 'volume' | 'a_grade'

const SORT_OPTIONS: { id: SortKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'users',   label: 'Most Users',    icon: Users },
  { id: 'quality', label: 'Best Quality',  icon: Star },
  { id: 'volume',  label: 'Most Args',     icon: MessageSquare },
  { id: 'a_grade', label: 'A-Grade Rate',  icon: Trophy },
]

function sortArchetypes(list: ArchetypeEntry[], key: SortKey): ArchetypeEntry[] {
  return [...list].sort((a, b) => {
    switch (key) {
      case 'users':   return b.user_count - a.user_count
      case 'quality': return (b.avg_score ?? 0) - (a.avg_score ?? 0)
      case 'volume':  return b.argument_count - a.argument_count
      case 'a_grade': return b.pct_a_grade - a.pct_a_grade
    }
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArgumentArchetypesPage() {
  const [data, setData]         = useState<ArchetypesResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [sortKey, setSortKey]   = useState<SortKey>('users')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/arguments/archetypes')
      if (!res.ok) throw new Error()
      const json: ArchetypesResponse = await res.json()
      setData(json)
      // Auto-expand the user's archetype
      if (json.my_archetype) {
        setExpanded(new Set([json.my_archetype]))
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sorted = data ? sortArchetypes(data.archetypes, sortKey) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/arguments"
            className="h-8 w-8 rounded-lg bg-surface-200/60 border border-surface-300/40 flex items-center justify-center hover:bg-surface-200 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="h-8 w-8 rounded-lg bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-lg font-bold text-white leading-tight">
              Archetype Leaderboard
            </h1>
            <p className="text-xs font-mono text-surface-500">
              How each rhetorical style performs across the platform
            </p>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="flex items-center gap-2 ml-20 mb-5">
          <Link
            href="/arguments/dna"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-for-500/10 border border-for-500/30 text-[11px] font-mono font-semibold text-for-400 hover:bg-for-500/20 transition-colors"
          >
            <Brain className="h-3 w-3" aria-hidden />
            My DNA
          </Link>
          <Link
            href="/arguments/authors"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 text-[11px] font-mono font-semibold text-gold hover:bg-gold/20 transition-colors"
          >
            <Trophy className="h-3 w-3" aria-hidden />
            Authors
          </Link>
        </div>

        {/* Summary strip */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-surface-100/60 border border-surface-300/30 text-xs font-mono text-surface-400"
          >
            <BarChart2 className="h-3.5 w-3.5 text-purple flex-shrink-0" />
            <span>
              <strong className="text-white">{data.total_classified_users}</strong> arguers
              across <strong className="text-white">8</strong> rhetorical archetypes
            </span>
            {data.my_archetype && (
              <>
                <span className="mx-1 text-surface-600">&middot;</span>
                <span>
                  You are{' '}
                  <Link
                    href="/arguments/dna"
                    className={cn(
                      'font-semibold hover:underline',
                      sorted.find((a) => a.archetype === data.my_archetype)?.color ?? 'text-white'
                    )}
                  >
                    {sorted.find((a) => a.archetype === data.my_archetype)?.name ?? data.my_archetype}
                  </Link>
                </span>
              </>
            )}
            <button
              onClick={load}
              className="ml-auto hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}

        {/* Sort controls */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSortKey(id)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                sortKey === id
                  ? 'bg-purple/20 border-purple/50 text-purple'
                  : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <ArchetypeCardSkeleton key={i} />)}
          </div>
        )}

        {error && !loading && (
          <EmptyState
            icon={Brain}
            title="Could not load archetypes"
            description="An error occurred while computing archetype stats. Try refreshing."
            actions={[{ label: 'Try again', onClick: load, variant: 'secondary', icon: RefreshCw }]}
          />
        )}

        {!loading && !error && data && (
          <>
            <div className="space-y-3">
              <AnimatePresence mode="sync">
                {sorted.map((entry) => (
                  <motion.div
                    key={entry.archetype}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ArchetypeCard
                      entry={entry}
                      isMine={data.my_archetype === entry.archetype}
                      myRank={data.my_archetype === entry.archetype ? data.my_rank : null}
                      isExpanded={expanded.has(entry.archetype)}
                      onToggle={() => toggleExpand(entry.archetype)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Footer CTA */}
            <div className="mt-8 p-4 rounded-xl bg-surface-100/60 border border-surface-300/30 text-center space-y-2">
              <p className="text-xs font-mono text-surface-400">
                Don&apos;t know your archetype yet?
              </p>
              <Link
                href="/arguments/dna"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 text-sm font-mono font-semibold text-for-400 hover:bg-for-500/20 transition-colors"
              >
                <Brain className="h-4 w-4" aria-hidden />
                Discover My Argument DNA
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
