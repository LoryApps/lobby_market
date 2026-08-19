'use client'

/**
 * /footprint — Civic Footprint
 *
 * Shows the permanent mark a user has left on the civic platform:
 * how many laws they've helped shape, how far their arguments have reached,
 * and their overall footprint score and tier.
 *
 * Distinct from:
 *   /fingerprint  — uniqueness vs. the consensus
 *   /analytics    — general vote stats & streaks
 *   /legacy       — milestone timeline
 *   /impact       — argument quality breakdown
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Footprints,
  Gavel,
  Globe,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { FootprintData, FootprintResponse, FootprintTier } from '@/app/api/analytics/footprint/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<FootprintTier, { ring: string; glow: string; badge: string; text: string; icon: string }> = {
  newcomer:    { ring: 'ring-surface-400',    glow: 'bg-surface-400/10',    badge: 'bg-surface-300 text-surface-600',    text: 'text-surface-400',    icon: '🌱' },
  citizen:     { ring: 'ring-for-500',        glow: 'bg-for-500/10',        badge: 'bg-for-500/15 text-for-400',         text: 'text-for-400',        icon: '🗳️' },
  contributor: { ring: 'ring-emerald',        glow: 'bg-emerald/10',        badge: 'bg-emerald/15 text-emerald',         text: 'text-emerald',        icon: '✍️' },
  influencer:  { ring: 'ring-purple',         glow: 'bg-purple/10',         badge: 'bg-purple/15 text-purple',           text: 'text-purple',         icon: '📢' },
  architect:   { ring: 'ring-gold',           glow: 'bg-gold/10',           badge: 'bg-gold/15 text-gold',               text: 'text-gold',           icon: '🏛️' },
  legend:      { ring: 'ring-against-400',    glow: 'bg-against-400/10',    badge: 'bg-against-400/15 text-against-300', text: 'text-against-300',    icon: '👑' },
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'bg-for-500/20 text-for-400 border-for-500/30',
  Economics:   'bg-gold/15 text-gold border-gold/30',
  Technology:  'bg-purple/20 text-purple border-purple/30',
  Ethics:      'bg-emerald/20 text-emerald border-emerald/30',
  Science:     'bg-for-300/20 text-for-300 border-for-300/30',
  Culture:     'bg-against-400/20 text-against-300 border-against-400/30',
  Philosophy:  'bg-purple/15 text-purple border-purple/25',
  Health:      'bg-emerald/15 text-emerald border-emerald/25',
  Environment: 'bg-emerald/20 text-emerald border-emerald/30',
  Education:   'bg-gold/20 text-gold border-gold/30',
  Other:       'bg-surface-300/30 text-surface-400 border-surface-400/30',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function fmtNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── Footprint gauge ──────────────────────────────────────────────────────────

function FootprintGauge({
  score,
  nextScore,
  tier,
}: {
  score: number
  nextScore: number | null
  tier: FootprintTier
}) {
  const colors = TIER_COLORS[tier]
  const pct = nextScore ? Math.min((score / nextScore) * 100, 100) : 100
  const radius = 52
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ

  return (
    <div className="relative flex items-center justify-center w-40 h-40 mx-auto">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} stroke="currentColor" strokeWidth="8"
          className="text-surface-300" fill="none" />
        <motion.circle
          cx="60" cy="60" r={radius}
          stroke="currentColor" strokeWidth="8"
          className={colors.text}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      </svg>
      <div className="relative text-center">
        <div className={cn('text-2xl font-black tabular-nums', colors.text)}>
          {fmtNum(score)}
        </div>
        <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
          footprint
        </div>
      </div>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: number | string
  icon: typeof Gavel
  color: string
  sub?: string
}) {
  return (
    <div className={cn(
      'flex flex-col gap-1 rounded-xl border p-4 bg-surface-50',
      'border-surface-300/50',
    )}>
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        {label}
      </div>
      <div className={cn('text-2xl font-black tabular-nums', color)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-surface-500">{sub}</div>}
    </div>
  )
}

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({
  contribution,
}: {
  contribution: FootprintData['law_contributions'][0]
}) {
  const isFor = contribution.user_side === 'for'
  const withMajority = contribution.voted_with_majority
  return (
    <Link
      href={`/topic/${contribution.topic_id}`}
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-surface-100 transition-colors"
    >
      <div className={cn(
        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
        isFor ? 'bg-for-500/15 text-for-400' : 'bg-against-500/15 text-against-400',
      )}>
        {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-900 group-hover:text-for-400 transition-colors leading-snug line-clamp-2">
          {contribution.statement}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {contribution.category && (
            <span className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded border',
              CATEGORY_COLORS[contribution.category] ?? CATEGORY_COLORS['Other'],
            )}>
              {contribution.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">
            {relDate(contribution.established_at)}
          </span>
          {!withMajority && (
            <span className="text-[10px] font-mono text-against-400">minority vote</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Argument row ─────────────────────────────────────────────────────────────

function ArgumentRow({ arg }: { arg: FootprintData['top_arguments'][0] }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/topic/${arg.topic_id}#argument-${arg.id}`}
      className="group block p-3 rounded-lg hover:bg-surface-100 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold',
          isFor ? 'bg-for-500/15 text-for-400' : 'bg-against-500/15 text-against-400',
        )}>
          {isFor ? 'F' : 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-500 mb-0.5 truncate">
            {truncate(arg.topic_statement, 60)}
          </p>
          <p className="text-sm text-surface-800 group-hover:text-for-400 transition-colors leading-snug line-clamp-2">
            {arg.content}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[11px] text-surface-500">
              <ThumbsUp className="h-3 w-3" />
              {arg.upvotes}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-surface-500">
              <MessageSquare className="h-3 w-3" />
              {arg.reply_count}
            </span>
            <span className="text-[11px] font-mono text-gold">
              +{arg.footprint_score} pts
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  category,
  points,
  maxPoints,
}: {
  category: string
  points: number
  maxPoints: number
}) {
  const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0
  const cls = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Other']
  const textColor = cls.split(' ')[1]
  const bgColor = cls.split(' ')[0]

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-medium', textColor)}>{category}</span>
        <span className="text-surface-500 font-mono tabular-nums">{points} pts</span>
      </div>
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', bgColor.replace('bg-', 'bg-').replace('/15', '/60').replace('/20', '/60'))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FootprintSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-300/50 bg-surface-100 p-6 text-center space-y-4">
        <Skeleton className="h-40 w-40 rounded-full mx-auto" />
        <Skeleton className="h-6 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FootprintClient() {
  const router = useRouter()
  const [data, setData] = useState<FootprintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)
  const mountRef = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/footprint', { cache: 'no-store' })
      const json = (await res.json()) as FootprintResponse
      if (!mountRef.current) return
      if (!json.authenticated) {
        router.push('/login')
        return
      }
      setData(json)
    } catch {
      if (mountRef.current) setError(true)
    } finally {
      if (mountRef.current) setLoading(false)
    }
  }, [router])

  useEffect(() => {
    mountRef.current = true
    load()
    return () => { mountRef.current = false }
  }, [load])

  async function share() {
    const url = window.location.href
    try {
      await navigator.share({ title: 'My Civic Footprint · Lobby Market', url })
    } catch {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tierColors = data ? TIER_COLORS[data.tier] : TIER_COLORS.newcomer
  const maxCategoryPts = data
    ? Math.max(...data.categories.map((c) => c.footprint_points), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <Footprints className="h-5 w-5 text-for-400" />
              Civic Footprint
            </h1>
            <p className="text-xs text-surface-500">The permanent mark you&apos;ve left on the Lobby</p>
          </div>
          <button
            onClick={share}
            className="ml-auto flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-900 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-surface-200"
          >
            <Share2 className="h-3.5 w-3.5" />
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>

        {loading && <FootprintSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={Globe}
            title="Couldn't load your footprint"
            description="Check your connection and try again."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="footprint"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >

              {/* ── Tier hero ── */}
              <div className={cn(
                'rounded-2xl border p-6 text-center space-y-4',
                'bg-gradient-to-b from-surface-100 to-surface-50',
                tierColors.ring, 'ring-1',
              )}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-2xl">{tierColors.icon}</span>
                  <Badge className={cn('text-xs font-mono uppercase', tierColors.badge)}>
                    {data.tier_label}
                  </Badge>
                </div>

                <FootprintGauge
                  score={data.footprint_score}
                  nextScore={data.next_tier_score}
                  tier={data.tier}
                />

                <div className="space-y-1.5">
                  <p className="text-sm text-surface-600 leading-relaxed max-w-xs mx-auto">
                    {data.tier_description}
                  </p>
                  {data.next_tier_score && data.next_tier_label && (
                    <p className="text-xs font-mono text-surface-500">
                      {(data.next_tier_score - data.footprint_score).toLocaleString()} pts to{' '}
                      <span className="text-surface-700">{data.next_tier_label}</span>
                    </p>
                  )}
                </div>

                {/* User identity */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-surface-300/40">
                  <Avatar
                    src={data.user.avatar_url ?? undefined}
                    username={data.user.username}
                    size="sm"
                  />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-surface-900">
                      {data.user.display_name ?? data.user.username}
                    </p>
                    <p className="text-[11px] text-surface-500">
                      {data.days_active} days active · {data.user.clout.toLocaleString()} clout
                    </p>
                  </div>
                  <Link
                    href={`/profile/${data.user.username}`}
                    className="ml-auto text-xs text-for-400 hover:underline"
                  >
                    Profile
                  </Link>
                </div>
              </div>

              {/* ── Stat tiles ── */}
              <div className="grid grid-cols-2 gap-3">
                <Tile
                  label="Laws Shaped"
                  value={data.laws_shaped}
                  icon={Gavel}
                  color="text-gold"
                  sub={data.laws_shaped === 0 ? 'Vote on topics to shape laws' : `${data.laws_against_majority} minority votes`}
                />
                <Tile
                  label="Argument Reach"
                  value={data.total_argument_upvotes}
                  icon={ThumbsUp}
                  color="text-emerald"
                  sub={`${data.total_arguments} arguments posted`}
                />
                <Tile
                  label="Topics Voted"
                  value={data.total_topics_voted}
                  icon={Scale}
                  color="text-for-400"
                  sub="Across all categories"
                />
                <Tile
                  label="Footprint Score"
                  value={data.footprint_score}
                  icon={Sparkles}
                  color={tierColors.text}
                  sub="Composite impact score"
                />
              </div>

              {/* ── Category footprint ── */}
              {data.categories.length > 0 && (
                <section className="rounded-xl border border-surface-300/50 bg-surface-50 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-surface-900">Footprint by Category</h2>
                  </div>
                  <div className="space-y-3">
                    {data.categories.map((cat) => (
                      <CategoryBar
                        key={cat.category}
                        category={cat.category}
                        points={cat.footprint_points}
                        maxPoints={maxCategoryPts}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Laws shaped ── */}
              <section className="rounded-xl border border-surface-300/50 bg-surface-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/40">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-gold" />
                    <h2 className="text-sm font-semibold text-surface-900">Laws You Helped Shape</h2>
                  </div>
                  <span className="text-xs font-mono text-surface-500">{data.laws_shaped} total</span>
                </div>

                {data.law_contributions.length === 0 ? (
                  <div className="p-6 text-center">
                    <Gavel className="h-8 w-8 text-surface-400 mx-auto mb-2" />
                    <p className="text-sm text-surface-500">No laws shaped yet.</p>
                    <p className="text-xs text-surface-400 mt-1">
                      Vote on active topics — when they reach consensus and become law, they'll appear here.
                    </p>
                    <Link
                      href="/topics?status=voting"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-for-400 hover:underline"
                    >
                      Browse voting topics <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-300/30">
                    {data.law_contributions.map((law) => (
                      <LawRow key={law.law_id} contribution={law} />
                    ))}
                    {data.laws_shaped > data.law_contributions.length && (
                      <div className="px-4 py-2 text-center text-xs text-surface-500">
                        +{data.laws_shaped - data.law_contributions.length} more laws
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Top arguments ── */}
              <section className="rounded-xl border border-surface-300/50 bg-surface-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/40">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald" />
                    <h2 className="text-sm font-semibold text-surface-900">Highest-Impact Arguments</h2>
                  </div>
                  {data.total_arguments > 0 && (
                    <Link
                      href="/analytics/impact"
                      className="text-xs text-for-400 hover:underline"
                    >
                      Full analysis
                    </Link>
                  )}
                </div>

                {data.top_arguments.length === 0 ? (
                  <div className="p-6 text-center">
                    <MessageSquare className="h-8 w-8 text-surface-400 mx-auto mb-2" />
                    <p className="text-sm text-surface-500">No arguments posted yet.</p>
                    <p className="text-xs text-surface-400 mt-1">
                      Write arguments on topics you care about to start building your footprint.
                    </p>
                    <Link
                      href="/forge"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-for-400 hover:underline"
                    >
                      Open the Argument Forge <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-300/30">
                    {data.top_arguments.map((arg) => (
                      <ArgumentRow key={arg.id} arg={arg} />
                    ))}
                  </div>
                )}
              </section>

              {/* ── Score breakdown ── */}
              <section className="rounded-xl border border-surface-300/50 bg-surface-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-semibold text-surface-900">How Footprint Is Scored</h2>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Law shaped (majority vote)', pts: '+200', color: 'text-gold' },
                    { label: 'Law shaped (minority vote)', pts: '+100', color: 'text-gold' },
                    { label: 'Argument upvote received', pts: '+5', color: 'text-emerald' },
                    { label: 'Argument reply received', pts: '+2', color: 'text-emerald' },
                    { label: 'Topic voted on', pts: '+1', color: 'text-for-400' },
                  ].map(({ label, pts, color }) => (
                    <div key={label} className="flex items-center justify-between gap-2 py-1 border-b border-surface-300/30 last:border-0 col-span-2">
                      <span className="text-surface-600">{label}</span>
                      <span className={cn('font-mono font-bold', color)}>{pts}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Actions ── */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/topics?status=voting"
                  className="flex items-center justify-center gap-2 rounded-xl border border-surface-300/50 bg-surface-100 hover:bg-surface-200 transition-colors px-4 py-3 text-sm font-medium text-surface-700"
                >
                  <Scale className="h-4 w-4" />
                  Vote Now
                </Link>
                <Link
                  href="/forge"
                  className="flex items-center justify-center gap-2 rounded-xl bg-for-500 hover:bg-for-600 transition-colors px-4 py-3 text-sm font-semibold text-white"
                >
                  <Zap className="h-4 w-4" />
                  Argue
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
