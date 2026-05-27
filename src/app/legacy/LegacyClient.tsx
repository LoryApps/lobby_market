'use client'

/**
 * /legacy — Civic Legacy
 *
 * A user's permanent civic record: laws authored that became law, top
 * arguments, debate wins/losses, and a chronological milestone timeline.
 * Culminates in a Legacy Score (0–100) and tier badge: Newcomer → Citizen
 * → Advocate → Lawmaker → Legend.
 *
 * Distinct from:
 *   /impact      — tracks which established laws you voted FOR (not authored)
 *   /dossier     — compact shareable identity card
 *   /wrapped     — time-period snapshots (monthly/yearly)
 *   /analytics   — deep multi-tab stats dashboard
 *   /report-card — academic letter-grade assessment
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import { cn } from '@/lib/utils/cn'
import type {
  LegacyResponse,
  LegacyTier,
  LegacyLaw,
  LegacyArgument,
  LegacyMilestone,
} from '@/app/api/analytics/legacy/route'

// ─── Tier config ───────────────────────────────────────────────────────────────

const TIER_STYLE: Record<
  LegacyTier,
  {
    color: string
    bg: string
    border: string
    glow: string
    icon: typeof Trophy
    label: string
    barColor: string
  }
> = {
  legend: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    glow: 'shadow-gold/20',
    icon: Crown,
    label: 'Legend',
    barColor: 'bg-gold',
  },
  lawmaker: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    glow: 'shadow-for-500/20',
    icon: Gavel,
    label: 'Lawmaker',
    barColor: 'bg-for-500',
  },
  advocate: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    glow: 'shadow-purple/20',
    icon: Shield,
    label: 'Advocate',
    barColor: 'bg-purple',
  },
  citizen: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    glow: 'shadow-emerald/20',
    icon: Vote,
    label: 'Citizen',
    barColor: 'bg-emerald',
  },
  newcomer: {
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    glow: '',
    icon: Flame,
    label: 'Newcomer',
    barColor: 'bg-surface-400',
  },
}

// ─── Category colors ───────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-against-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

const CAT_BG: Record<string, string> = {
  Economics: 'bg-gold/10',
  Politics: 'bg-for-500/10',
  Technology: 'bg-purple/10',
  Science: 'bg-emerald/10',
  Ethics: 'bg-against-500/10',
  Philosophy: 'bg-for-400/10',
  Culture: 'bg-against-500/10',
  Health: 'bg-emerald/10',
  Environment: 'bg-emerald/10',
  Education: 'bg-gold/10',
}

// ─── AI grade badge ────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const map: Record<string, { text: string; bg: string }> = {
    S: { text: 'text-gold', bg: 'bg-gold/15' },
    A: { text: 'text-emerald', bg: 'bg-emerald/15' },
    B: { text: 'text-for-400', bg: 'bg-for-500/15' },
    C: { text: 'text-surface-400', bg: 'bg-surface-300/30' },
    D: { text: 'text-against-400', bg: 'bg-against-500/15' },
    F: { text: 'text-against-500', bg: 'bg-against-950/40' },
  }
  const style = map[grade.toUpperCase()] ?? { text: 'text-surface-400', bg: 'bg-surface-300/30' }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-black',
        style.text,
        style.bg,
      )}
    >
      {grade.toUpperCase()}
    </span>
  )
}

// ─── Relative time ─────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(diff / 2_592_000_000)
  const y = Math.floor(diff / 31_536_000_000)
  if (y >= 1) return `${y}y ago`
  if (m >= 1) return `${m}mo ago`
  if (d >= 1) return `${d}d ago`
  return 'today'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Milestone icon map ────────────────────────────────────────────────────────

const MILESTONE_ICON: Record<
  LegacyMilestone['type'],
  { icon: typeof Vote; color: string; bg: string }
> = {
  joined:              { icon: Flame,          color: 'text-gold',         bg: 'bg-gold/15'         },
  first_vote:          { icon: Vote,           color: 'text-for-400',      bg: 'bg-for-500/15'      },
  first_argument:      { icon: MessageSquare,  color: 'text-purple',       bg: 'bg-purple/15'       },
  first_law_authored:  { icon: Gavel,          color: 'text-emerald',      bg: 'bg-emerald/15'      },
  first_debate:        { icon: Swords,         color: 'text-against-400',  bg: 'bg-against-500/15'  },
}

// ─── Skeleton layout ───────────────────────────────────────────────────────────

function LegacySkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 md:p-8">
        <div className="flex items-start gap-5">
          <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-16 w-28 rounded-2xl flex-shrink-0" />
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="space-y-3">
            {[0, 1].map((j) => (
              <Skeleton key={j} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Law card ──────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: LegacyLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const catColor = law.category ? CAT_COLOR[law.category] : 'text-surface-500'
  const catBg = law.category ? CAT_BG[law.category] : 'bg-surface-200'

  return (
    <Link
      href={`/law/${law.id}`}
      className="group flex items-start gap-3 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-emerald/30 hover:bg-surface-200 transition-colors"
    >
      <div className="flex-shrink-0 mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/15 border border-emerald/25">
        <Gavel className="h-4 w-4 text-emerald" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
          {law.statement}
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {law.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', catColor, catBg)}>
              {law.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-emerald">
            {forPct}% for
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {law.total_votes.toLocaleString()} votes
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {relTime(law.established_at)}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-emerald flex-shrink-0 mt-1 transition-colors" />
    </Link>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: LegacyArgument }) {
  const isFor = arg.side === 'blue'
  const catColor = arg.topic_category ? CAT_COLOR[arg.topic_category] : 'text-surface-500'
  const catBg = arg.topic_category ? CAT_BG[arg.topic_category] : 'bg-surface-200'

  return (
    <Link
      href={`/arguments/${arg.id}`}
      className="group block p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-lg',
            isFor
              ? 'bg-for-500/15 border border-for-500/25'
              : 'bg-against-500/15 border border-against-500/25',
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {arg.content}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {arg.topic_category && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded', catColor, catBg)}>
                {arg.topic_category}
              </span>
            )}
            <span className={cn('text-[10px] font-mono', isFor ? 'text-for-400' : 'text-against-400')}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <GradeBadge grade={arg.ai_grade} />
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-for-400" />
            <span className="text-xs font-mono text-for-400">{arg.upvotes}</span>
          </div>
          {arg.reply_count > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-surface-500" />
              <span className="text-xs font-mono text-surface-500">{arg.reply_count}</span>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] font-mono text-surface-500 line-clamp-1">
        on: {arg.topic_statement}
      </p>
    </Link>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function LegacyClient() {
  const router = useRouter()
  const [data, setData] = useState<LegacyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const scoreRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/legacy', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load legacy data')
      const json = (await res.json()) as LegacyResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  async function handleShare() {
    if (!data) return
    const url = `${window.location.origin}/legacy`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${data.user.display_name ?? data.user.username}'s Civic Legacy`,
          text: `${data.tier_label} — Legacy score ${data.legacy_score}/100 on Lobby Market`,
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-16">

        {/* ── Page header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Civic Legacy
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Your permanent civic record
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white disabled:opacity-40 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors text-xs font-mono"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────────── */}
        {loading && <LegacySkeleton />}

        {/* ── Error ───────────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Scale}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="Couldn't load your legacy"
            description={error}
            actions={[{ label: 'Try again', onClick: load, variant: 'primary' }]}
          />
        )}

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        {!loading && data && (() => {
          const tier = TIER_STYLE[data.tier]
          const TierIcon = tier.icon
          const archetype = data.user.civic_archetype
            ? ARCHETYPE_CONFIG[data.user.civic_archetype as ArchetypeId]
            : null

          return (
            <div className="space-y-5">

              {/* ── Profile + score card ──────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={cn(
                  'rounded-3xl bg-surface-100 border p-6 md:p-8 shadow-xl',
                  tier.border,
                  tier.glow && `shadow-lg ${tier.glow}`,
                )}
              >
                <div className="flex items-start gap-4 md:gap-6">
                  <Avatar
                    src={data.user.avatar_url}
                    username={data.user.username}
                    size="lg"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-white truncate">
                      {data.user.display_name ?? data.user.username}
                    </h2>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">
                      @{data.user.username}
                    </p>
                    {archetype && (
                      <div className="mt-2">
                        <Badge
                          label={archetype.name}
                          color={archetype.color}
                          bgColor={archetype.bgColor}
                          borderColor={archetype.borderColor}
                        />
                      </div>
                    )}
                    <p className="mt-2 text-xs font-mono text-surface-500">
                      Member since {formatDate(data.user.created_at)}
                    </p>
                  </div>

                  {/* Tier badge */}
                  <div
                    className={cn(
                      'flex-shrink-0 flex flex-col items-center justify-center gap-1.5',
                      'rounded-2xl border px-4 py-3',
                      tier.bg, tier.border,
                    )}
                  >
                    <TierIcon className={cn('h-6 w-6', tier.color)} />
                    <span className={cn('text-xs font-black', tier.color)}>
                      {tier.label}
                    </span>
                  </div>
                </div>

                {/* Tier description */}
                <p className="mt-4 text-sm text-surface-500 italic leading-relaxed">
                  &ldquo;{data.tier_description}&rdquo;
                </p>

                {/* Legacy score bar */}
                <div className="mt-5 space-y-2" ref={scoreRef}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      Legacy Score
                    </span>
                    <span className={cn('text-lg font-black tabular-nums', tier.color)}>
                      <AnimatedNumber value={data.legacy_score} />
                      <span className="text-sm font-mono text-surface-500">/100</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', tier.barColor)}
                      initial={{ width: 0 }}
                      animate={{ width: `${data.legacy_score}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-surface-600">
                    {(['newcomer', 'citizen', 'advocate', 'lawmaker', 'legend'] as LegacyTier[]).map((t) => (
                      <span
                        key={t}
                        className={cn(data.tier === t ? TIER_STYLE[t].color : '')}
                      >
                        {TIER_STYLE[t].label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quick stats */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Votes cast',  value: data.total_votes,   icon: Vote,         color: 'text-for-400'  },
                    { label: 'Arguments',   value: data.total_arguments, icon: MessageSquare, color: 'text-purple'  },
                    { label: 'Clout',       value: data.user.clout,    icon: Zap,          color: 'text-gold'     },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div
                      key={label}
                      className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-3 text-center"
                    >
                      <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                      <div className={cn('text-base font-black tabular-nums', color)}>
                        <AnimatedNumber value={value} />
                      </div>
                      <div className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Milestone timeline ────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-black text-white">Milestones</h3>
                  <span className="ml-auto text-xs font-mono text-surface-500">
                    {data.milestones.length} reached
                  </span>
                </div>

                {data.milestones.length === 0 ? (
                  <p className="text-xs font-mono text-surface-500 text-center py-6">
                    Cast your first vote to unlock milestones.
                  </p>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[19px] top-3 bottom-3 w-px bg-surface-300" />

                    <div className="space-y-4">
                      {data.milestones.map((m, i) => {
                        const cfg = MILESTONE_ICON[m.type]
                        const MIcon = cfg.icon
                        const isLatest = i === data.milestones.length - 1

                        return (
                          <motion.div
                            key={`${m.type}-${i}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                            className="relative flex items-start gap-3 pl-1"
                          >
                            <div
                              className={cn(
                                'relative z-10 flex-shrink-0 flex items-center justify-center',
                                'h-10 w-10 rounded-xl border',
                                cfg.bg,
                                isLatest ? 'border-gold/40 ring-2 ring-gold/20' : 'border-surface-300',
                              )}
                            >
                              <MIcon className={cn('h-4 w-4', cfg.color)} />
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5">
                              <p className="text-sm font-semibold text-white">
                                {m.label}
                              </p>
                              <p className="text-xs font-mono text-surface-500 mt-0.5">
                                {formatDate(m.date)}
                              </p>
                            </div>
                            {isLatest && (
                              <span className="flex-shrink-0 text-[10px] font-mono text-gold bg-gold/10 border border-gold/20 rounded px-1.5 py-0.5 mt-1.5">
                                Latest
                              </span>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* ── Laws authored ─────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.16 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Gavel className="h-4 w-4 text-emerald" />
                  <h3 className="text-sm font-black text-white">Laws Authored</h3>
                  <span className="ml-auto text-xs font-mono text-surface-500">
                    {data.laws_authored_count} established
                  </span>
                </div>

                {data.laws_authored.length === 0 ? (
                  <EmptyState
                    icon={Gavel}
                    iconColor="text-surface-500"
                    iconBg="bg-surface-200"
                    iconBorder="border-surface-300"
                    title="No laws authored yet"
                    description="Propose a topic and rally support to see it become law."
                    size="sm"
                    actions={[{ label: 'Browse topics', href: '/', variant: 'secondary' }]}
                  />
                ) : (
                  <div className="space-y-2">
                    {data.laws_authored.map((law) => (
                      <LawCard key={law.id} law={law} />
                    ))}
                    {data.laws_authored_count > data.laws_authored.length && (
                      <Link
                        href="/law"
                        className="flex items-center justify-center gap-1.5 py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                      >
                        View all {data.laws_authored_count} laws
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </motion.div>

              {/* ── Top arguments ─────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.24 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-purple" />
                  <h3 className="text-sm font-black text-white">Signature Arguments</h3>
                  <span className="ml-auto text-xs font-mono text-surface-500">
                    {data.total_upvotes_received} total upvotes
                  </span>
                </div>

                {data.top_arguments.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    iconColor="text-surface-500"
                    iconBg="bg-surface-200"
                    iconBorder="border-surface-300"
                    title="No arguments yet"
                    description="Write your first argument to start building your legacy."
                    size="sm"
                    actions={[{ label: 'Browse debates', href: '/', variant: 'secondary' }]}
                  />
                ) : (
                  <div className="space-y-2">
                    {data.top_arguments.map((arg, i) => (
                      <div key={arg.id} className="flex gap-2">
                        <div className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-surface-200 text-surface-500 text-[10px] font-black mt-3">
                          #{i + 1}
                        </div>
                        <div className="flex-1">
                          <ArgumentCard arg={arg} />
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/arguments"
                      className="flex items-center justify-center gap-1.5 py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      View all {data.total_arguments} arguments
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </motion.div>

              {/* ── Debate record ─────────────────────────────────────────────── */}
              {data.debate_record.total > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.32 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Swords className="h-4 w-4 text-against-400" />
                    <h3 className="text-sm font-black text-white">Debate Record</h3>
                    {data.debate_record.win_rate !== null && (
                      <span className="ml-auto text-xs font-mono text-gold">
                        {data.debate_record.win_rate}% win rate
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Total',     value: data.debate_record.total,      color: 'text-white'         },
                      { label: 'As speaker', value: data.debate_record.as_speaker, color: 'text-for-400'      },
                      { label: 'Wins',       value: data.debate_record.wins,       color: 'text-emerald'      },
                      { label: 'Losses',     value: data.debate_record.losses,     color: 'text-against-400'  },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-3 text-center"
                      >
                        <div className={cn('text-xl font-black tabular-nums', color)}>
                          <AnimatedNumber value={value} />
                        </div>
                        <div className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {data.debate_record.total > 0 && data.debate_record.wins + data.debate_record.losses > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-surface-500">
                        <span className="text-emerald">
                          W {data.debate_record.wins}
                        </span>
                        <span className="text-against-400">
                          L {data.debate_record.losses}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
                        {data.debate_record.wins > 0 && (
                          <div
                            className="h-full bg-emerald rounded-l-full"
                            style={{
                              width: `${(data.debate_record.wins / (data.debate_record.wins + data.debate_record.losses)) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <Link
                    href="/debate"
                    className="mt-4 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-500 hover:border-against-500/30 hover:text-against-400 hover:bg-against-950/20 transition-colors"
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Enter a debate
                  </Link>
                </motion.div>
              )}

              {/* ── CTA for newcomers ─────────────────────────────────────────── */}
              {data.tier === 'newcomer' && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-4 w-4 text-for-400" />
                    <h3 className="text-sm font-black text-white">Build your legacy</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Cast 10 votes',         href: '/',        color: 'text-for-400',  bg: 'bg-for-500/10',  border: 'border-for-500/20'   },
                      { label: 'Write your first argument', href: '/',     color: 'text-purple',   bg: 'bg-purple/10',   border: 'border-purple/20'    },
                      { label: 'Propose a topic',        href: '/',        color: 'text-gold',     bg: 'bg-gold/10',     border: 'border-gold/20'      },
                      { label: 'Join a debate',          href: '/debate',  color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
                    ].map(({ label, href, color, bg, border }) => (
                      <Link
                        key={label}
                        href={href}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                          bg, border,
                          'hover:brightness-110',
                        )}
                      >
                        <ChevronRight className={cn('h-4 w-4', color)} />
                        <span className={cn('text-sm font-mono', color)}>{label}</span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Share CTA ─────────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: data.tier === 'newcomer' ? 0.48 : 0.4 }}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/15 border border-for-500/25">
                    <Share2 className="h-4 w-4 text-for-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Share your legacy</p>
                    <p className="text-xs font-mono text-surface-500">
                      Let the world know your civic record
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl bg-for-500 text-white text-xs font-mono font-semibold hover:bg-for-600 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </motion.div>

            </div>
          )
        })()}
      </main>

      <BottomNav />
    </div>
  )
}
