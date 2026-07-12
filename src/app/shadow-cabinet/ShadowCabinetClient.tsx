'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  ChevronRight,
  Crown,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ShadowCabinetResponse, CabinetSeat, CabinetMember } from '@/app/api/shadow-cabinet/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-gold/20' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      glow: 'shadow-purple/20' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/20' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     glow: 'shadow-for-500/20' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30', glow: 'shadow-against-500/20' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/20' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      glow: 'shadow-purple/20' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30', glow: 'shadow-against-400/20' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-gold/20' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/30',     glow: 'shadow-for-300/20' },
}

function catStyle(cat: string) {
  return CAT_STYLE[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30', glow: 'shadow-surface-400/10' }
}

// ─── Skeleton seat card ──────────────────────────────────────────────────────

function SeatSkeleton() {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      <Skeleton className="h-3 w-44 rounded" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

// ─── Member card row ──────────────────────────────────────────────────────────

function MemberRow({
  member,
  label,
  catText,
}: {
  member: CabinetMember
  label: string
  catText: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/profile/${member.username}`} className="shrink-0">
        <Avatar
          src={member.avatar_url}
          fallback={member.display_name ?? member.username}
          size="md"
          className="ring-2 ring-surface-300 hover:ring-surface-500 transition-all"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {label === 'Incumbent' && (
            <Crown className={cn('h-3.5 w-3.5 shrink-0', catText)} aria-hidden="true" />
          )}
          <Link
            href={`/profile/${member.username}`}
            className="text-sm font-semibold text-white hover:text-surface-600 truncate transition-colors"
          >
            {member.display_name ?? member.username}
          </Link>
          <span className="text-[10px] font-medium text-surface-500 shrink-0">
            {label === 'Incumbent' ? 'Incumbent' : 'Challenger'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-surface-500">
          <span className="flex items-center gap-0.5">
            <Vote className="h-3 w-3" aria-hidden="true" />
            {(member.total_votes ?? 0).toLocaleString()}
          </span>
          <span className="text-surface-600" aria-hidden="true">·</span>
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            {(member.total_arguments ?? 0).toLocaleString()}
          </span>
          <span className="text-surface-600" aria-hidden="true">·</span>
          <span className="flex items-center gap-0.5">
            <Zap className="h-3 w-3" aria-hidden="true" />
            {member.clout.toLocaleString()} clout
          </span>
        </div>
      </div>
      <Link
        href={`/profile/${member.username}/analytics`}
        className="shrink-0 text-surface-500 hover:text-surface-700 transition-colors"
        aria-label={`View ${member.display_name ?? member.username} analytics`}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

// ─── Score bar ───────────────────────────────────────────────────────────────

function ScoreBar({ score, maxScore, colorClass }: { score: number; maxScore: number; colorClass: string }) {
  const pct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0
  return (
    <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', colorClass)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
      />
    </div>
  )
}

// ─── Seat card ────────────────────────────────────────────────────────────────

function SeatCard({ seat, maxScore }: { seat: CabinetSeat; maxScore: number }) {
  const [expanded, setExpanded] = useState(false)
  const style = catStyle(seat.category)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-surface-100 border rounded-2xl p-5 space-y-4 transition-shadow duration-300',
        style.border,
        expanded && `shadow-lg ${style.glow}`,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'flex items-center justify-center h-6 w-6 rounded-full text-sm font-medium',
                style.bg,
                style.text,
              )}
              aria-hidden="true"
            >
              {seat.icon}
            </span>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', style.text)}>
              {seat.category}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white leading-snug">{seat.title}</h3>
          <p className="text-[11px] text-surface-600 mt-0.5">{seat.metric}</p>
        </div>
        <button
          onClick={() => setExpanded((p) => !p)}
          className="shrink-0 mt-0.5 text-surface-500 hover:text-surface-700 transition-colors"
          aria-label={expanded ? 'Collapse seat details' : 'Expand seat details'}
        >
          {expanded ? <X className="h-4 w-4" /> : <BarChart2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Incumbent */}
      {seat.incumbent ? (
        <MemberRow member={seat.incumbent} label="Incumbent" catText={style.text} />
      ) : (
        <div className="flex items-center gap-3 text-surface-600 text-sm">
          <div className="h-10 w-10 rounded-full bg-surface-200 flex items-center justify-center">
            <Users className="h-5 w-5 text-surface-500" aria-hidden="true" />
          </div>
          <span>No incumbent yet — be the first</span>
        </div>
      )}

      {/* Score bar */}
      {seat.incumbent && (
        <ScoreBar
          score={seat.incumbent.score}
          maxScore={maxScore}
          colorClass={
            style.text === 'text-gold' ? 'bg-gold' :
            style.text === 'text-emerald' ? 'bg-emerald' :
            style.text === 'text-purple' ? 'bg-purple' :
            style.text === 'text-for-400' ? 'bg-for-500' :
            'bg-against-500'
          }
        />
      )}

      {/* Challenger — expandable */}
      <AnimatePresence initial={false}>
        {expanded && seat.challenger && (
          <motion.div
            key="challenger"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-surface-300">
              <p className="text-[11px] text-surface-500 mb-3 uppercase tracking-wide font-medium">
                Closest Challenger
              </p>
              <MemberRow member={seat.challenger} label="Challenger" catText={style.text} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand hint */}
      {!expanded && seat.challenger && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-xs text-surface-500 hover:text-surface-600 transition-colors text-left"
        >
          <span className={cn('font-medium', style.text)}>
            {seat.challenger.display_name ?? seat.challenger.username}
          </span>{' '}
          is challenging for this seat
        </button>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShadowCabinetClient() {
  const [data, setData] = useState<ShadowCabinetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shadow-cabinet', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load cabinet data')
      const json: ShadowCabinetResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const maxScore = data
    ? Math.max(
        0,
        ...data.seats.map((s) => s.incumbent?.score ?? 0),
      )
    : 0

  return (
    <div className="relative flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/15 text-gold"
              aria-hidden="true"
            >
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Civic Shadow Cabinet</h1>
              <p className="text-xs text-surface-500">
                The top civic voices in each policy domain
              </p>
            </div>
          </div>

          <p className="text-sm text-surface-500 leading-relaxed mt-3">
            The <span className="text-white font-medium">Shadow Cabinet</span> is a live ranking of
            the most credible civic voices in each policy category — determined by votes cast,
            arguments written, and community reputation. Challenge for a seat by being active in
            your strongest domains.
          </p>

          {data && (
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-xs text-surface-500">
                <Users className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                <span>
                  <span className="text-white font-medium">{data.total_members}</span> citizens in cabinet
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-surface-500">
                <Shield className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                <span>
                  <span className="text-white font-medium">{data.seats.length}</span> open seats
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* How to compete */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3 mb-6 flex items-start gap-3"
        >
          <Sparkles className="h-4 w-4 text-gold mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-xs text-surface-500 leading-relaxed">
            <span className="text-white font-medium">Want a seat?</span>{' '}
            Vote on topics and write strong arguments in your chosen policy category. The more active
            and credible you are, the higher you rank. Rankings update in real-time.
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-surface-500 text-sm">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-for-400 text-sm hover:text-for-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && !data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <SeatSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Cabinet seats */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.seats.map((seat, i) => (
              <motion.div
                key={seat.category}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <SeatCard seat={seat} maxScore={maxScore} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Refresh footer */}
        {data && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-surface-300">
            <p className="text-xs text-surface-600">
              Updated {new Date(data.last_updated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
