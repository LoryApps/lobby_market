'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Gavel,
  Globe,
  Landmark,
  RefreshCw,
  Scale,
  Share2,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MarketDetail, MarketArgument } from '@/app/api/exchange/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function priceBarBg(price: number): string {
  if (price >= 75) return 'bg-gold'
  if (price >= 60) return 'bg-for-400'
  if (price >= 50) return 'bg-for-500'
  if (price <= 25) return 'bg-against-600'
  return 'bg-against-500'
}

function priceTextColor(price: number): string {
  if (price >= 75) return 'text-gold'
  if (price >= 55) return 'text-for-300'
  if (price <= 25) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function changeColor(delta: number | null): string {
  if (delta === null) return 'text-surface-500'
  if (delta > 0) return 'text-emerald'
  if (delta < 0) return 'text-against-400'
  return 'text-surface-500'
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500 bg-surface-300/40 border-surface-500/30',
  active: 'text-for-300 bg-for-500/10 border-for-500/30',
  voting: 'text-gold bg-gold/10 border-gold/30',
  law: 'text-gold bg-gold/15 border-gold/40',
  failed: 'text-against-400 bg-against-500/10 border-against-500/30',
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
}: {
  arg: MarketArgument
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'border-for-500/20 bg-for-500/5'
          : 'border-against-500/20 bg-against-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
        >
          {isFor ? 'For' : 'Against'} · {arg.upvote_count} upvotes
        </span>
      </div>
      <p className="text-sm text-surface-800 leading-relaxed line-clamp-4">{arg.body}</p>
      <div className="flex items-center gap-1.5 pt-0.5">
        <Avatar
          src={arg.author_avatar_url}
          username={arg.author_username}
          size="xs"
        />
        <span className="text-xs text-surface-500">
          {arg.author_display_name ?? arg.author_username}
        </span>
        <span className="text-xs text-surface-600 ml-auto">{relTime(arg.created_at)}</span>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BriefSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-28 rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BriefClient({ id }: { id: string }) {
  const [detail, setDetail] = useState<MarketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voting, setVoting] = useState<'for' | 'against' | null>(null)
  const [voted, setVoted] = useState<'for' | 'against' | null>(null)
  const [userVote, setUserVote] = useState<'for' | 'against' | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/exchange/${id}`)
      if (!res.ok) throw new Error('Failed to load')
      const data: MarketDetail = await res.json()
      setDetail(data)
    } catch {
      setError('Unable to load market brief')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Check existing vote
  useEffect(() => {
    async function checkVote() {
      try {
        const res = await fetch(`/api/topics/${id}/vote-check`)
        if (!res.ok) return
        const data = await res.json()
        if (data.side) setUserVote(data.side === 'blue' ? 'for' : 'against')
      } catch {
        // no-op
      }
    }
    checkVote()
  }, [id])

  async function handleVote(side: 'for' | 'against') {
    if (userVote || voting) return
    setVoting(side)
    try {
      const res = await fetch(`/api/topics/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: side === 'for' ? 'blue' : 'red' }),
      })
      if (res.ok) {
        setVoted(side)
        setUserVote(side)
      }
    } finally {
      setVoting(null)
    }
  }

  if (loading) return <BriefSkeleton />

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 flex flex-col items-center justify-center gap-4">
          <FileText className="h-10 w-10 text-surface-500" />
          <p className="text-surface-500 text-sm">{error ?? 'Market not found'}</p>
          <button onClick={load} className="flex items-center gap-1.5 text-for-400 text-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const price = Math.round(detail.price)
  const againstPrice = 100 - price
  const days = daysUntil(detail.voting_ends_at)
  const change24h = detail.price_change_24h
  const change7d = detail.price_change_7d

  // Resolution outlook
  const resolutionLabel =
    price >= 75
      ? 'Near-law threshold — strong consensus forming'
      : price >= 60
      ? 'FOR leading — building momentum'
      : price <= 25
      ? 'Likely to fail — strong opposition'
      : price <= 40
      ? 'AGAINST leading — market resistant'
      : 'Contested — deadlocked near 50/50'

  const resolutionColor =
    price >= 75
      ? 'text-gold'
      : price >= 60
      ? 'text-for-300'
      : price <= 25 || price <= 40
      ? 'text-against-300'
      : 'text-surface-500'

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">

        {/* Back + title row */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-surface-500 hover:text-surface-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Market</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: detail.statement, url: shareUrl }).catch(() => {})
                } else {
                  navigator.clipboard.writeText(shareUrl).catch(() => {})
                }
              }}
              className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors text-surface-600"
              title="Share brief"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <span className="text-xs text-surface-500 font-mono">BRIEF</span>
          </div>
        </div>

        {/* ── Header card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
        >
          {/* Status + category row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                STATUS_COLOR[detail.status] ?? STATUS_COLOR.proposed,
              )}
            >
              {STATUS_LABEL[detail.status] ?? detail.status}
            </span>
            {detail.category && (
              <span className="text-[10px] text-surface-500 uppercase tracking-wider">
                {detail.category}
              </span>
            )}
            {detail.scope && detail.scope !== 'national' && (
              <div className="flex items-center gap-1 text-[10px] text-surface-500 uppercase tracking-wider">
                <Globe className="h-3 w-3" />
                {detail.scope}
              </div>
            )}
          </div>

          {/* Statement */}
          <h1 className="text-base md:text-lg font-semibold text-white leading-snug">
            {detail.statement}
          </h1>

          {/* Price bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-mono">
              <span className="text-for-300 font-bold">{price}¢ FOR</span>
              <span className="text-surface-600 text-xs">
                {fmt(detail.volume)} votes
              </span>
              <span className="text-against-400 font-bold">{againstPrice}¢ AGN</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', priceBarBg(price))}
                style={{ width: `${price}%` }}
              />
            </div>
          </div>

          {/* Signal badges */}
          <div className="flex flex-wrap gap-1.5">
            {detail.is_hot && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                <Flame className="h-3 w-3" /> Hot
              </span>
            )}
            {detail.is_near_law && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold/10 border border-gold/20 rounded-full px-2 py-0.5">
                <Gavel className="h-3 w-3" /> Near Law
              </span>
            )}
            {detail.is_closing_soon && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-against-300 bg-against-500/10 border border-against-500/20 rounded-full px-2 py-0.5">
                <Clock className="h-3 w-3" /> Closing Soon
              </span>
            )}
            {detail.is_deadlocked && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-surface-500 bg-surface-300/50 border border-surface-500/20 rounded-full px-2 py-0.5">
                <Scale className="h-3 w-3" /> Deadlocked
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Price metrics ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {[
            {
              label: '24h Change',
              value: change24h !== null ? `${change24h > 0 ? '+' : ''}${change24h.toFixed(1)}¢` : '—',
              color: changeColor(change24h),
              icon: change24h !== null && change24h > 0 ? TrendingUp : TrendingDown,
            },
            {
              label: '7d Change',
              value: change7d !== null ? `${change7d > 0 ? '+' : ''}${change7d.toFixed(1)}¢` : '—',
              color: changeColor(change7d),
              icon: change7d !== null && change7d > 0 ? TrendingUp : TrendingDown,
            },
            {
              label: 'High',
              value: `${Math.round(detail.price_high)}¢`,
              color: 'text-for-300',
              icon: BarChart2,
            },
            {
              label: 'Low',
              value: `${Math.round(detail.price_low)}¢`,
              color: 'text-against-400',
              icon: BarChart2,
            },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex flex-col gap-1"
            >
              <div className="flex items-center gap-1 text-[10px] text-surface-500 uppercase tracking-wider">
                <Icon className="h-3 w-3" />
                {label}
              </div>
              <span className={cn('text-lg font-mono font-bold', color)}>{value}</span>
            </div>
          ))}
        </motion.div>

        {/* ── FOR vs AGAINST arguments ── */}
        {(detail.top_for.length > 0 || detail.top_against.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-700">Top Arguments</h2>
              <Link
                href={`/topic/${id}/arguments`}
                className="ml-auto text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {detail.top_for[0] && (
                <ArgumentCard arg={detail.top_for[0]} side="for" />
              )}
              {detail.top_against[0] && (
                <ArgumentCard arg={detail.top_against[0]} side="against" />
              )}
            </div>
          </motion.div>
        )}

        {/* ── Resolution outlook ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-semibold text-surface-700">Resolution Outlook</h2>
          </div>

          <p className={cn('text-sm font-medium', resolutionColor)}>{resolutionLabel}</p>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="space-y-0.5">
              <div className="text-xs text-surface-500">FOR votes</div>
              <div className="text-base font-mono font-bold text-for-300">
                {fmt(detail.blue_votes)}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-surface-500">AGAINST votes</div>
              <div className="text-base font-mono font-bold text-against-400">
                {fmt(detail.red_votes)}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-surface-500">
                {days !== null ? 'Days left' : 'Market age'}
              </div>
              <div className="text-base font-mono font-bold text-surface-700">
                {days !== null
                  ? days === 0
                    ? 'Closing'
                    : days
                  : Math.floor(
                      (Date.now() - new Date(detail.created_at).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )}
              </div>
            </div>
          </div>

          {detail.voting_ends_at && (
            <div className="flex items-center gap-1.5 text-xs text-surface-500 pt-1">
              <Calendar className="h-3.5 w-3.5" />
              Voting closes{' '}
              {new Date(detail.voting_ends_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          )}
        </motion.div>

        {/* ── Quick vote ── */}
        {detail.status === 'active' || detail.status === 'voting' ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-700">
                {userVote ? 'Your Position' : 'Cast Your Vote'}
              </h2>
            </div>

            {userVote ? (
              <div
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl border text-sm font-medium',
                  userVote === 'for'
                    ? 'border-for-500/30 bg-for-500/10 text-for-300'
                    : 'border-against-500/30 bg-against-500/10 text-against-400',
                )}
              >
                {userVote === 'for' ? (
                  <ThumbsUp className="h-4 w-4" />
                ) : (
                  <ThumbsDown className="h-4 w-4" />
                )}
                You voted {userVote === 'for' ? 'FOR' : 'AGAINST'} this topic
                <Link
                  href={`/topic/${id}`}
                  className="ml-auto text-xs text-surface-500 hover:text-surface-700 flex items-center gap-1"
                >
                  Change <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote('for')}
                  disabled={!!voting}
                  className={cn(
                    'flex items-center justify-center gap-2 py-3 rounded-xl',
                    'border font-semibold text-sm transition-all',
                    voted === 'for'
                      ? 'border-for-400 bg-for-500/20 text-for-300'
                      : 'border-for-500/40 bg-for-500/10 text-for-400 hover:bg-for-500/20 hover:border-for-400',
                    voting === 'for' && 'opacity-60 cursor-wait',
                  )}
                >
                  <ThumbsUp className="h-4 w-4" />
                  Vote FOR
                </button>
                <button
                  onClick={() => handleVote('against')}
                  disabled={!!voting}
                  className={cn(
                    'flex items-center justify-center gap-2 py-3 rounded-xl',
                    'border font-semibold text-sm transition-all',
                    voted === 'against'
                      ? 'border-against-400 bg-against-500/20 text-against-300'
                      : 'border-against-500/40 bg-against-500/10 text-against-400 hover:bg-against-500/20 hover:border-against-400',
                    voting === 'against' && 'opacity-60 cursor-wait',
                  )}
                >
                  <ThumbsDown className="h-4 w-4" />
                  Vote AGAINST
                </button>
              </div>
            )}
          </motion.div>
        ) : null}

        {/* ── Related markets ── */}
        {detail.related.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-700">Related Markets</h2>
            </div>
            <div className="space-y-2">
              {detail.related.slice(0, 3).map((r) => (
                <Link
                  key={r.id}
                  href={`/exchange/${r.id}`}
                  className="flex items-center gap-3 py-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-1">
                      {r.statement}
                    </p>
                  </div>
                  <span className={cn('text-sm font-mono font-bold flex-shrink-0', priceTextColor(r.price))}>
                    {Math.round(r.price)}¢
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Footer nav ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: `/exchange/${id}`, icon: BarChart2, label: 'Price Chart' },
              { href: `/topic/${id}/arguments`, icon: Swords, label: 'All Arguments' },
              { href: `/exchange/${id}/analysis`, icon: TrendingUp, label: 'Analysis' },
              { href: `/exchange/${id}/forecast`, icon: Zap, label: 'Forecasts' },
              { href: `/exchange/${id}/research`, icon: FileText, label: 'Research' },
              { href: `/exchange/${id}/traders`, icon: Users, label: 'Traders' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-surface-600 hover:text-white"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs font-medium truncate">{label}</span>
                <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0 opacity-50" />
              </Link>
            ))}
          </div>
        </motion.div>

      </main>
      <BottomNav />
    </div>
  )
}
