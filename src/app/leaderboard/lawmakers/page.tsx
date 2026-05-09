'use client'

/**
 * /leaderboard/lawmakers — Civic Lawmakers Leaderboard
 *
 * Ranks users by the number of laws they helped PASS — specifically,
 * the count of topics they voted FOR that subsequently became laws.
 *
 * This is the "co-author" concept: every civic vote on a winning topic
 * earns its caster a place in the record as a co-author of that law.
 *
 * Distinct from:
 *   /leaderboard/arguments (top arguers)
 *   /leaderboard/laws      (best laws, not the people)
 *   /leaderboard/calibration (prediction accuracy)
 *   /impact                (personal view of YOUR laws)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  Gavel,
  RefreshCw,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'

import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawmakerEntry, LawmakersResponse } from '@/app/api/leaderboard/lawmakers/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const w = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (w < 5) return `${w}w ago`
  if (mo < 12) return `${mo}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  senator: 'Senator',
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  senator: 'text-purple',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}

// ─── Category colors ────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Period tabs ───────────────────────────────────────────────────────────

type Period = 'all' | '90d' | '30d'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'All Time' },
  { id: '90d', label: 'Last 90 Days' },
  { id: '30d', label: 'Last 30 Days' },
]

// ─── Rank badge ────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gold/10 border border-gold/40 flex-shrink-0">
        <Trophy className="h-4 w-4 text-gold" />
      </div>
    )
  if (rank === 2)
    return (
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-surface-300/30 border border-surface-400/30 flex-shrink-0">
        <span className="text-xs font-mono font-bold text-surface-300">2</span>
      </div>
    )
  if (rank === 3)
    return (
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-against-600/10 border border-against-600/30 flex-shrink-0">
        <span className="text-xs font-mono font-bold text-against-400">3</span>
      </div>
    )
  return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-surface-200 border border-surface-300 flex-shrink-0">
      <span className="text-[11px] font-mono text-surface-500">{rank}</span>
    </div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="flex-shrink-0 space-y-1 text-right pt-1">
        <Skeleton className="h-6 w-14 ml-auto" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </div>
  )
}

// ─── Signature law chip ───────────────────────────────────────────────────

function SignatureLawChip({
  law,
}: {
  law: { id: string; statement: string; category: string | null; established_at: string; blue_pct: number }
}) {
  const catColor = CAT_COLOR[law.category ?? ''] ?? 'text-surface-500'
  return (
    <Link
      href={`/law/${law.id}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono',
        'bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60',
        'hover:bg-surface-200 transition-colors group'
      )}
    >
      <Gavel className={cn('h-2.5 w-2.5 flex-shrink-0', catColor)} />
      <span className="text-surface-400 group-hover:text-white transition-colors truncate max-w-[180px]">
        {truncate(law.statement, 48)}
      </span>
      <span className="text-surface-600 ml-auto hidden sm:block">{relativeTime(law.established_at)}</span>
    </Link>
  )
}

// ─── Contributor row ──────────────────────────────────────────────────────

function LawmakerRow({ entry, rank, isMe }: { entry: LawmakerEntry; rank: number; isMe: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.03, 0.4) }}
      className={cn(
        'rounded-2xl border transition-colors',
        isMe
          ? 'border-for-500/40 bg-for-500/5'
          : rank <= 3
          ? 'border-gold/20 bg-gold/5'
          : 'border-surface-300 bg-surface-100 hover:border-surface-400'
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        <RankBadge rank={rank} />

        <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name ?? entry.username}
            size="md"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {entry.display_name ?? entry.username}
            </Link>
            {isMe && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-for-600/20 border border-for-600/30 text-for-400">
                YOU
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-xs font-mono', ROLE_COLOR[entry.role] ?? 'text-surface-500')}>
              {ROLE_LABEL[entry.role] ?? entry.role}
            </span>
            <span className="text-surface-600 text-xs">·</span>
            <span className="text-xs font-mono text-surface-500">
              {fmtNum(entry.clout)} clout
            </span>
          </div>

          {/* Contribution rate bar */}
          {entry.total_for_votes > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden max-w-[120px]">
                <div
                  className="h-full bg-for-500 rounded-full"
                  style={{ width: `${Math.min(100, entry.contribution_rate)}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-surface-500">
                {entry.contribution_rate}% hit rate
              </span>
            </div>
          )}

          {/* Signature laws (collapsed or expanded) */}
          {entry.signature_laws.length > 0 && (
            <div className="mt-2">
              {expanded ? (
                <div className="flex flex-col gap-1">
                  {entry.signature_laws.map((law) => (
                    <SignatureLawChip key={law.id} law={law} />
                  ))}
                </div>
              ) : (
                <SignatureLawChip law={entry.signature_laws[0]} />
              )}
              {entry.signature_laws.length > 1 && (
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="mt-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  {expanded
                    ? 'Show less'
                    : `+${entry.signature_laws.length - 1} more law${entry.signature_laws.length - 1 > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: laws count */}
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <Gavel
              className={cn(
                'h-4 w-4',
                rank === 1
                  ? 'text-gold'
                  : rank <= 3
                  ? 'text-for-300'
                  : 'text-for-400'
              )}
            />
            <span
              className={cn(
                'text-lg font-mono font-bold',
                rank === 1
                  ? 'text-gold'
                  : rank <= 3
                  ? 'text-for-300'
                  : 'text-white'
              )}
            >
              {entry.laws_contributed}
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            law{entry.laws_contributed !== 1 ? 's' : ''} co-authored
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawmakersLeaderboardPage() {
  const [data, setData] = useState<LawmakersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<Period>('all')
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fetch current user id for "YOU" highlight
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setMyUserId(user.id)
      })
    })
  }, [])

  const load = useCallback(
    async (p: Period, refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        const res = await fetch(`/api/leaderboard/lawmakers?period=${p}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as LawmakersResponse
        setData(json)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // best-effort — data stays as previous
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    load(period)
  }, [load, period])

  const entries = data?.entries ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-10">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-gold flex-shrink-0" />
              <h1 className="font-mono text-xl font-bold text-white">Civic Lawmakers</h1>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Users ranked by the number of laws they helped pass — via a winning FOR vote
              {data && (
                <span className="ml-1 text-surface-600">
                  · {data.total_laws} law{data.total_laws !== 1 ? 's' : ''} in this period
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => load(period, true)}
            disabled={refreshing || loading}
            aria-label="Refresh leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── What counts info banner ─────────────────────────────── */}
        <div className="mb-5 rounded-xl bg-for-600/10 border border-for-600/20 px-4 py-3 flex items-start gap-3">
          <ThumbsUp className="h-4 w-4 text-for-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            Every vote FOR a topic that later becomes a law earns you a{' '}
            <span className="text-for-400 font-semibold">co-authorship</span>. Your civic voice
            helped shape the platform&apos;s living law codex.
          </p>
        </div>

        {/* ── Period filter ───────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPeriod(p.id)
              }}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                period === p.id
                  ? 'bg-for-600/20 border-for-600/40 text-for-400'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Calendar className="h-3 w-3" />
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Podium / top 3 ──────────────────────────────────────── */}
        {!loading && entries.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {/* 2nd place */}
            <Link
              href={`/profile/${entries[1].username}`}
              className="flex flex-col items-center gap-2 pt-4 pb-3 px-2 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
            >
              <div className="relative">
                <Avatar
                  src={entries[1].avatar_url}
                  fallback={entries[1].display_name ?? entries[1].username}
                  size="lg"
                />
                <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-surface-200 border border-surface-400 flex items-center justify-center text-[10px] font-mono font-bold text-surface-300">
                  2
                </span>
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="text-xs font-semibold text-white truncate px-1">
                  {entries[1].display_name ?? entries[1].username}
                </p>
                <p className="text-[11px] font-mono font-bold text-for-400 mt-0.5">
                  {entries[1].laws_contributed} laws
                </p>
              </div>
            </Link>

            {/* 1st place */}
            <Link
              href={`/profile/${entries[0].username}`}
              className="flex flex-col items-center gap-2 pt-2 pb-3 px-2 rounded-2xl bg-gold/5 border border-gold/30 hover:border-gold/50 transition-colors -mt-3"
            >
              <Trophy className="h-5 w-5 text-gold" />
              <div className="relative">
                <Avatar
                  src={entries[0].avatar_url}
                  fallback={entries[0].display_name ?? entries[0].username}
                  size="xl"
                />
                <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gold/20 border border-gold/50 flex items-center justify-center">
                  <Trophy className="h-3 w-3 text-gold" />
                </span>
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="text-xs font-semibold text-white truncate px-1">
                  {entries[0].display_name ?? entries[0].username}
                </p>
                <p className="text-sm font-mono font-bold text-gold mt-0.5">
                  {entries[0].laws_contributed} laws
                </p>
              </div>
            </Link>

            {/* 3rd place */}
            <Link
              href={`/profile/${entries[2].username}`}
              className="flex flex-col items-center gap-2 pt-4 pb-3 px-2 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
            >
              <div className="relative">
                <Avatar
                  src={entries[2].avatar_url}
                  fallback={entries[2].display_name ?? entries[2].username}
                  size="lg"
                />
                <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-against-700/20 border border-against-600/40 flex items-center justify-center text-[10px] font-mono font-bold text-against-400">
                  3
                </span>
              </div>
              <div className="text-center min-w-0 w-full">
                <p className="text-xs font-semibold text-white truncate px-1">
                  {entries[2].display_name ?? entries[2].username}
                </p>
                <p className="text-[11px] font-mono font-bold text-for-400 mt-0.5">
                  {entries[2].laws_contributed} laws
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* ── Full ranked list ──────────────────────────────────────── */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title="No laws yet in this period"
              description={
                period === 'all'
                  ? 'Once topics reach consensus and become law, contributors will appear here.'
                  : 'Try extending the time range — no laws were established in this window.'
              }
              action={{ label: 'Browse laws', href: '/laws' }}
            />
          ) : (
            <AnimatePresence initial={false}>
              {entries.map((entry, idx) => (
                <LawmakerRow
                  key={entry.user_id}
                  entry={entry}
                  rank={idx + 1}
                  isMe={entry.user_id === myUserId}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* ── Footnote / navigation ─────────────────────────────────── */}
        {!loading && entries.length > 0 && (
          <div className="mt-8 rounded-xl border border-surface-300 bg-surface-100 px-4 py-4">
            <p className="text-xs font-mono text-surface-500 mb-3">
              Rankings update every 5 minutes. Only FOR votes on topics that reached law status
              are counted. Your personal impact breakdown is on your{' '}
              <Link href="/impact" className="text-for-400 hover:underline">
                Civic Impact
              </Link>{' '}
              page.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/laws"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <Gavel className="h-3 w-3" />
                Browse all laws
              </Link>
              <Link
                href="/impact"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <BarChart2 className="h-3 w-3" />
                Your civic impact
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <Trophy className="h-3 w-3" />
                All leaderboards
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
