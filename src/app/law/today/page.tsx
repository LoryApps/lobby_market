'use client'

/**
 * /law/today — Law of the Day
 *
 * A single established law is spotlighted each calendar day, chosen
 * deterministically so every visitor sees the same law on the same day.
 * Shows: the law statement, vote split, top FOR/AGAINST arguments,
 * category/scope metadata, and a social-share panel.
 *
 * Refreshes at midnight UTC automatically (client-side countdown).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  ChevronRight,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Gavel,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TodayLawResponse, TodayArgument } from '@/app/api/law/today/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const mo = Math.floor(d / 30)
  const y = Math.floor(mo / 12)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  if (mo < 12) return `${mo}mo ago`
  return `${y}y ago`
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function msUntilMidnightUTC(): number {
  const now = Date.now()
  const tomorrow = new Date()
  tomorrow.setUTCHours(24, 0, 0, 0)
  return tomorrow.getTime() - now
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-gold/10' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     glow: 'shadow-for-500/10' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      glow: 'shadow-purple/10' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/10' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', glow: 'shadow-against-500/10' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30',     glow: 'shadow-for-400/10' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-gold/10' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/10' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/10' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      glow: 'shadow-purple/10' },
}

function getCategoryStyle(cat: string | null) {
  return CATEGORY_STYLES[cat ?? ''] ?? {
    text: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    glow: 'shadow-none',
  }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function TodaySkeleton() {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {/* Arguments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Argument card ──────────────────────────────────────────────────────────────

function ArgumentCard({ arg, side }: { arg: TodayArgument; side: 'for' | 'against' }) {
  const isFor = side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-3',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border',
            isFor
              ? 'bg-for-500/15 border-for-500/30 text-for-400'
              : 'bg-against-500/15 border-against-500/30 text-against-400'
          )}
        >
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-600 leading-relaxed flex-1">{arg.content}</p>

      {/* Author */}
      {arg.author && (
        <Link
          href={`/profile/${arg.author.username}`}
          className="flex items-center gap-2 mt-1 group"
        >
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name ?? arg.author.username}
            size="xs"
          />
          <span className="text-xs font-mono text-surface-500 group-hover:text-surface-400 transition-colors">
            @{arg.author.username}
          </span>
          <span className="text-[10px] font-mono text-surface-600 ml-auto">
            {relativeTime(arg.created_at)}
          </span>
        </Link>
      )}
    </motion.div>
  )
}

// ─── Vote bar ──────────────────────────────────────────────────────────────────

function VoteSplitBar({ bluePct, totalVotes }: { bluePct: number; totalVotes: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2">
      {/* Labels */}
      <div className="flex justify-between text-xs font-mono">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span className="text-surface-500">{fmtVotes(totalVotes)} votes</span>
        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
      </div>
      {/* Bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300/30">
        <motion.div
          className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

// ─── Share button ──────────────────────────────────────────────────────────────

function ShareButton({ law }: { law: TodayLawResponse }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const url = `https://lobby.market/law/${law.id}`
  const text = `Today's Law of the Day: "${law.statement}" — ${Math.round(law.blue_pct)}% in favour with ${fmtVotes(law.total_votes)} votes cast.`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: law.statement, text, url })
        return
      } catch {
        // fall through
      }
    }
    setOpen((v) => !v)
  }

  return (
    <div className="relative">
      <button
        onClick={handleNativeShare}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl',
          'text-sm font-mono font-semibold transition-all',
          'bg-surface-200 border border-surface-300 text-surface-400',
          'hover:bg-surface-300 hover:border-surface-400 hover:text-white'
        )}
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute right-0 top-full mt-2 z-20',
              'bg-surface-100 border border-surface-300 rounded-xl shadow-2xl',
              'w-52 py-1 overflow-hidden'
            )}
          >
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors text-left"
            >
              {copied ? <Check className="h-4 w-4 text-emerald" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' ' + url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Post on X
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Countdown clock ───────────────────────────────────────────────────────────

function NextLawCountdown() {
  const [ms, setMs] = useState(msUntilMidnightUTC())

  useEffect(() => {
    const id = setInterval(() => setMs(msUntilMidnightUTC()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
      <Clock className="h-3 w-3 flex-shrink-0" />
      Next law in{' '}
      <span className="text-surface-400 tabular-nums">{formatCountdown(ms)}</span>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LawOfTheDayPage() {
  const [data, setData] = useState<TodayLawResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLaw = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/law/today', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      setData(await res.json())
    } catch {
      setError('Could not load today\'s law. The Codex may still be empty.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLaw()
  }, [fetchLaw])

  const catStyle = data ? getCategoryStyle(data.category) : getCategoryStyle(null)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/law"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
              aria-label="Back to Law Codex"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                  <Gavel className="h-4 w-4 text-gold" />
                </div>
                <h1 className="font-mono text-xl font-bold text-white">Law of the Day</h1>
              </div>
              <p className="text-xs font-mono text-surface-500 mt-0.5 ml-10">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {data && <NextLawCountdown />}
        </div>

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TodaySkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
                <Scale className="h-5 w-5 text-against-400" />
              </div>
              <p className="text-sm font-mono text-surface-500 text-center max-w-xs">{error}</p>
              <button
                onClick={fetchLaw}
                className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-surface-400 bg-surface-200 border border-surface-300 rounded-lg hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </motion.div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-5"
            >
              {/* ── Hero law card ── */}
              <div
                className={cn(
                  'relative bg-surface-100 rounded-2xl border overflow-hidden',
                  'border-surface-300'
                )}
              >
                {/* Top accent bar */}
                <div className={cn('h-1 w-full', catStyle.bg.replace('/10', ''))} />

                {/* Ambient glow */}
                <div
                  className={cn(
                    'absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 pointer-events-none',
                    'blur-3xl',
                    catStyle.bg
                  )}
                  aria-hidden
                />

                <div className="relative p-6 space-y-5">
                  {/* Badges row */}
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Day counter */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 text-xs font-mono font-bold text-gold">
                      <Award className="h-3 w-3" />
                      Day #{data.day_index + 1}
                    </div>

                    {/* Category */}
                    {data.category && (
                      <div
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border',
                          catStyle.bg,
                          catStyle.border,
                          catStyle.text
                        )}
                      >
                        {data.category}
                      </div>
                    )}

                    {/* Scope */}
                    {data.scope && data.scope !== 'Global' && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500">
                        <Globe className="h-3 w-3" />
                        {data.scope}
                      </div>
                    )}

                    {/* Established */}
                    <div className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-500">
                      <Calendar className="h-3 w-3" />
                      {new Date(data.established_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>

                  {/* Statement */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Gavel className="h-4 w-4 text-gold flex-shrink-0" />
                      <span className="text-xs font-mono font-semibold uppercase tracking-widest text-gold">
                        Established Law
                      </span>
                    </div>
                    <blockquote className="text-white font-mono text-lg leading-relaxed font-semibold">
                      &ldquo;{data.statement}&rdquo;
                    </blockquote>
                  </div>

                  {/* Description if available */}
                  {data.description && (
                    <p className="text-sm text-surface-500 leading-relaxed border-l-2 border-surface-400 pl-3">
                      {data.description}
                    </p>
                  )}

                  {/* Vote split */}
                  <VoteSplitBar bluePct={data.blue_pct} totalVotes={data.total_votes} />

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-1">
                    <ShareButton law={data} />

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/law/${data.id}`}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-xl',
                          'text-sm font-mono font-semibold transition-all',
                          'bg-gold/10 border border-gold/30 text-gold',
                          'hover:bg-gold/20 hover:border-gold/50'
                        )}
                      >
                        View full law
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Law index strip ── */}
              <div className="flex items-center gap-3 px-4 py-3 bg-surface-100 border border-surface-300 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-surface-500">
                    Law{' '}
                    <span className="text-white font-semibold">
                      #{data.law_index + 1}
                    </span>{' '}
                    of{' '}
                    <Link href="/law" className="text-for-400 hover:text-for-300 transition-colors">
                      {data.total_laws} established laws
                    </Link>{' '}
                    in the Codex
                  </div>
                </div>
                <Link
                  href="/law"
                  className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
                >
                  Browse all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* ── Top arguments ── */}
              {(data.top_for || data.top_against) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-wider">
                      The Debate
                    </h2>
                    <span className="text-xs font-mono text-surface-600">
                      — top arguments that shaped this law
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.top_for && (
                      <ArgumentCard arg={data.top_for} side="for" />
                    )}
                    {data.top_against && (
                      <ArgumentCard arg={data.top_against} side="against" />
                    )}
                  </div>

                  <Link
                    href={`/topic/${data.topic_id}`}
                    className="flex items-center justify-center gap-2 w-full py-3 text-sm font-mono text-surface-500 bg-surface-100 border border-surface-300 rounded-xl hover:text-white hover:bg-surface-200 transition-all"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    View full debate
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* ── Navigation: related features ── */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/law"
                  className="flex items-center gap-3 p-4 bg-surface-100 border border-surface-300 rounded-xl hover:bg-surface-200 hover:border-surface-400 transition-all group"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Gavel className="h-4 w-4 text-gold" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-semibold text-white group-hover:text-gold transition-colors truncate">Law Codex</div>
                    <div className="text-xs font-mono text-surface-500 truncate">All {data.total_laws} laws</div>
                  </div>
                </Link>

                <Link
                  href="/flashcards"
                  className="flex items-center gap-3 p-4 bg-surface-100 border border-surface-300 rounded-xl hover:bg-surface-200 hover:border-surface-400 transition-all group"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Scale className="h-4 w-4 text-for-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-semibold text-white group-hover:text-for-400 transition-colors truncate">Flashcards</div>
                    <div className="text-xs font-mono text-surface-500 truncate">Study the laws</div>
                  </div>
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
