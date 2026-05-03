'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Flame,
  Gavel,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  HotspotResponse,
  HotspotTopic,
  HotspotDebate,
  HotspotLaw,
} from '@/app/api/hotspot/route'

// ─── Metadata (static export from client-only page) ───────────────────────────
// Using a separate layout.tsx or just <title> via metadata export isn't
// possible from 'use client'. The <head> title is set below via useEffect.

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 60_000

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'closing now'
  const totalMin = Math.floor(diff / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m left`
  if (h < 24) return m > 0 ? `${h}h ${m}m left` : `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

function supportPct(topic: HotspotTopic): number {
  if (topic.activation_threshold <= 0) return 0
  return Math.min(100, Math.round((topic.support_count / topic.activation_threshold) * 100))
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function heatColor(score: number): string {
  if (score >= 80) return 'text-against-300'
  if (score >= 60) return 'text-gold'
  if (score >= 40) return 'text-for-400'
  return 'text-surface-500'
}

function heatBg(score: number): string {
  if (score >= 80) return 'bg-against-500/10 border-against-500/30'
  if (score >= 60) return 'bg-gold/10 border-gold/30'
  if (score >= 40) return 'bg-for-500/10 border-for-500/30'
  return 'bg-surface-200/60 border-surface-300'
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({
  bluePct,
  small,
}: {
  bluePct: number
  small?: boolean
}) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className={cn('space-y-0.5', small ? 'mt-1.5' : 'mt-2')}>
      <div className={cn('flex rounded-full overflow-hidden', small ? 'h-1' : 'h-1.5')}>
        <div className="bg-for-500 transition-all" style={{ width: `${forPct}%` }} />
        <div className="bg-against-500 transition-all" style={{ width: `${againstPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-for-400 flex items-center gap-0.5">
          <ThumbsUp className="h-2.5 w-2.5" />
          {forPct}%
        </span>
        <span className="text-against-400 flex items-center gap-0.5">
          {againstPct}%
          <ThumbsDown className="h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  iconClass,
  title,
  subtitle,
  children,
  isEmpty,
  emptyText,
  delay = 0,
}: {
  icon: typeof Flame
  iconClass: string
  title: string
  subtitle: string
  children: React.ReactNode
  isEmpty?: boolean
  emptyText?: string
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-xl border flex-shrink-0', iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-mono font-bold text-white">{title}</h2>
          <p className="text-[11px] font-mono text-surface-500 leading-none mt-0.5">{subtitle}</p>
        </div>
      </div>

      {isEmpty ? (
        <p className="text-xs font-mono text-surface-600 text-center py-5 rounded-xl bg-surface-100/50 border border-surface-300/50">
          {emptyText ?? 'Nothing here right now.'}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </motion.section>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  variant,
  index,
}: {
  topic: HotspotTopic
  variant: 'final' | 'brink' | 'frozen'
  index: number
}) {
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border p-3.5 transition-all group',
          heatBg(topic.heat_score),
          'hover:border-surface-400'
        )}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {topic.category && (
                <span className={cn('text-[10px] font-mono font-semibold', catColor)}>
                  {topic.category}
                </span>
              )}
              <Badge
                variant={
                  topic.status === 'law'
                    ? 'law'
                    : topic.status === 'active'
                    ? 'active'
                    : topic.status === 'voting'
                    ? 'active'
                    : 'proposed'
                }
                className="text-[10px] h-4"
              >
                {topic.status === 'voting' ? 'VOTING' : topic.status}
              </Badge>
              {variant === 'final' && topic.voting_ends_at && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-against-400 font-semibold">
                  <Clock className="h-2.5 w-2.5" />
                  {countdown(topic.voting_ends_at)}
                </span>
              )}
              {variant === 'frozen' && (
                <span className="text-[10px] font-mono text-purple font-semibold">
                  {Math.abs(Math.round(topic.blue_pct) - 50) <= 1 ? 'DEADLOCK' : 'CONTESTED'}
                </span>
              )}
            </div>

            <p className="text-xs font-mono text-white leading-snug line-clamp-2 mb-1.5">
              {topic.statement}
            </p>

            {variant === 'brink' ? (
              /* Support progress bar */
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-surface-500">{formatNum(topic.support_count)} supporters</span>
                  <span className={cn(heatColor(topic.heat_score), 'font-semibold')}>
                    {supportPct(topic)}% to activation
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-400/30 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full transition-all"
                    style={{ width: `${supportPct(topic)}%` }}
                  />
                </div>
              </div>
            ) : (
              <VoteBar bluePct={topic.blue_pct} small />
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={cn('text-[11px] font-mono font-bold', heatColor(topic.heat_score))}>
              {topic.heat_score > 0 ? `🔥 ${topic.heat_score}` : ''}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {formatNum(topic.total_votes)} votes
            </span>
            <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors mt-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate, index }: { debate: HotspotDebate; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className="flex items-center gap-3 rounded-xl bg-for-500/10 border border-for-500/30 p-3.5 hover:border-for-500/50 transition-all group"
      >
        <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/20 border border-for-500/40">
          <Mic className="h-4 w-4 text-for-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold text-for-300 uppercase tracking-wide">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-for-500" />
              </span>
              Live Now
            </span>
            <span className="text-[10px] font-mono text-surface-500 capitalize">{debate.debate_type}</span>
          </div>
          <p className="text-xs font-mono text-white leading-snug line-clamp-2">
            {debate.topic_statement}
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law, index }: { law: HotspotLaw; index: number }) {
  const catColor = CATEGORY_COLOR[law.category ?? ''] ?? 'text-surface-500'
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Link
        href={law.topic_id ? `/topic/${law.topic_id}` : '/law'}
        className="flex items-start gap-3 rounded-xl bg-gold/5 border border-gold/25 p-3.5 hover:border-gold/40 transition-all group"
      >
        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 mt-0.5">
          <Gavel className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          {law.category && (
            <span className={cn('text-[10px] font-mono font-semibold mb-0.5 block', catColor)}>
              {law.category}
            </span>
          )}
          <p className="text-xs font-mono text-white leading-snug line-clamp-2 mb-1">
            {law.statement}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-surface-500">{relTime(law.established_at)}</span>
            {law.total_votes && (
              <span className="text-[10px] font-mono text-surface-600">{formatNum(law.total_votes)} votes</span>
            )}
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-gold transition-colors flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

// ─── Top heat spotlight ───────────────────────────────────────────────────────

function TopHeatSpotlight({ topic }: { topic: HotspotTopic }) {
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-against-500/40 bg-against-500/5 p-5 mb-6"
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.07) 0%, transparent 70%)' }}
        aria-hidden
      />

      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-4 w-4 text-against-400" />
        <span className="text-xs font-mono font-bold text-against-400 uppercase tracking-wider">
          Hottest Topic Right Now
        </span>
        <span className="ml-auto text-[11px] font-mono font-bold text-against-300">
          Heat {topic.heat_score}
        </span>
      </div>

      <Link href={`/topic/${topic.id}`} className="group">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {topic.category && (
            <span className={cn('text-[11px] font-mono font-semibold', catColor)}>
              {topic.category}
            </span>
          )}
          <Badge
            variant={
              topic.status === 'voting' ? 'active' : topic.status === 'active' ? 'active' : 'proposed'
            }
            className="text-[10px] h-4"
          >
            {topic.status === 'voting' ? 'VOTING' : topic.status}
          </Badge>
          {topic.voting_ends_at && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-against-400 font-semibold">
              <Clock className="h-2.5 w-2.5" />
              {countdown(topic.voting_ends_at)}
            </span>
          )}
        </div>

        <p className="text-sm font-mono font-semibold text-white leading-snug mb-3 group-hover:text-against-200 transition-colors">
          {topic.statement}
        </p>

        <VoteBar bluePct={topic.blue_pct} />

        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] font-mono text-surface-500">
            {formatNum(topic.total_votes)} votes cast
          </span>
          <span className="flex items-center gap-1 text-[11px] font-mono text-against-400 group-hover:text-against-300 transition-colors font-semibold">
            Vote now
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function HotspotSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <Skeleton className="h-36 rounded-2xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          {[0, 1, 2].map((j) => (
            <Skeleton key={j} className="h-20 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({
  stats,
}: {
  stats: HotspotResponse['stats']
}) {
  const items = [
    { label: 'Active', value: stats.total_active, icon: Zap, color: 'text-for-400' },
    { label: 'Voting', value: stats.total_voting, icon: Scale, color: 'text-purple' },
    { label: 'Live Debates', value: stats.total_live_debates, icon: Mic, color: 'text-for-300' },
    { label: 'New Laws (3h)', value: stats.laws_last_3h, icon: Gavel, color: 'text-gold' },
  ]

  return (
    <div className="grid grid-cols-4 gap-2 mb-6">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1 rounded-xl bg-surface-200/60 border border-surface-300/60 py-2.5 px-2"
        >
          <Icon className={cn('h-3.5 w-3.5', color)} />
          <span className={cn('text-base font-mono font-bold', color)}>{value}</span>
          <span className="text-[9px] font-mono text-surface-600 text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HotspotPage() {
  const [data, setData] = useState<HotspotResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_ = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/hotspot', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as HotspotResponse
      setData(json)
      setLastUpdated(new Date())
    } catch {
      setError('Could not load hotspot data. Retrying…')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
    timerRef.current = setInterval(() => fetch_(true), POLL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetch_])

  const allEmpty =
    data &&
    data.final_hours.length === 0 &&
    data.brink_of_law.length === 0 &&
    data.frozen_votes.length === 0 &&
    data.live_debates.length === 0 &&
    data.flash_laws.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Flame className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Civic Hotspot</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Critical moments happening right now
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {lastUpdated && (
              <span className="text-[10px] font-mono text-surface-600">
                {relTime(lastUpdated.toISOString())}
              </span>
            )}
            <button
              onClick={() => fetch_(true)}
              disabled={refreshing || loading}
              aria-label="Refresh hotspot"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" exit={{ opacity: 0 }}>
              <HotspotSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center"
            >
              <p className="text-surface-500 font-mono text-sm mb-4">{error}</p>
              <button
                onClick={() => fetch_()}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </motion.div>
          ) : data ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Stats row */}
              <StatsBar stats={data.stats} />

              {/* Top heat spotlight */}
              {data.top_heat && data.top_heat.heat_score >= 20 && (
                <TopHeatSpotlight topic={data.top_heat} />
              )}

              {allEmpty ? (
                <EmptyState
                  icon={Sparkles}
                  title="All quiet for now"
                  description="No critical civic moments are happening right now. Check back soon — the Lobby never sleeps for long."
                  actions={[
                    { label: 'Browse all topics', href: '/' },
                    { label: 'View trending', href: '/trending' },
                  ]}
                />
              ) : (
                <div className="space-y-8">
                  {/* ── Live Debates ──────────────────────────────────── */}
                  {data.live_debates.length > 0 && (
                    <Section
                      icon={Mic}
                      iconClass="bg-for-500/10 border-for-500/30 text-for-300"
                      title="Live Debates"
                      subtitle="Active right now — join the arena"
                      delay={0.05}
                    >
                      {data.live_debates.map((d, i) => (
                        <DebateCard key={d.id} debate={d} index={i} />
                      ))}
                    </Section>
                  )}

                  {/* ── Final Hours ───────────────────────────────────── */}
                  <Section
                    icon={Clock}
                    iconClass="bg-against-500/10 border-against-500/30 text-against-400"
                    title="Final Hours"
                    subtitle="Votes closing within 6 hours — your vote matters most here"
                    isEmpty={data.final_hours.length === 0}
                    emptyText="No votes closing in the next 6 hours."
                    delay={0.1}
                  >
                    {data.final_hours.map((t, i) => (
                      <TopicCard key={t.id} topic={t} variant="final" index={i} />
                    ))}
                  </Section>

                  {/* ── Frozen Votes ─────────────────────────────────── */}
                  <Section
                    icon={Scale}
                    iconClass="bg-purple/10 border-purple/30 text-purple"
                    title="Frozen Votes"
                    subtitle="Perfect deadlocks — every vote tips the balance"
                    isEmpty={data.frozen_votes.length === 0}
                    emptyText="No contested deadlocks right now."
                    delay={0.15}
                  >
                    {data.frozen_votes.map((t, i) => (
                      <TopicCard key={t.id} topic={t} variant="frozen" index={i} />
                    ))}
                  </Section>

                  {/* ── Brink of Law ─────────────────────────────────── */}
                  <Section
                    icon={TrendingUp}
                    iconClass="bg-emerald/10 border-emerald/30 text-emerald"
                    title="Brink of Law"
                    subtitle="Proposals within reach of activation — one push away"
                    isEmpty={data.brink_of_law.length === 0}
                    emptyText="No proposals near activation threshold."
                    delay={0.2}
                  >
                    {data.brink_of_law.map((t, i) => (
                      <TopicCard key={t.id} topic={t} variant="brink" index={i} />
                    ))}
                  </Section>

                  {/* ── Flash Laws ────────────────────────────────────── */}
                  <Section
                    icon={Gavel}
                    iconClass="bg-gold/10 border-gold/30 text-gold"
                    title="Flash Laws"
                    subtitle="Consensus reached in the last 3 hours"
                    isEmpty={data.flash_laws.length === 0}
                    emptyText="No laws established in the last 3 hours."
                    delay={0.25}
                  >
                    {data.flash_laws.map((l, i) => (
                      <LawCard key={l.id} law={l} index={i} />
                    ))}
                  </Section>
                </div>
              )}

              {/* ── Related links ──────────────────────────────────────── */}
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-surface-300 pt-8">
                {[
                  { href: '/trending', label: 'Trending', icon: TrendingUp, color: 'text-for-400' },
                  { href: '/radar', label: 'Radar', icon: AlertTriangle, color: 'text-against-400' },
                  { href: '/surge', label: 'Surge', icon: Zap, color: 'text-purple' },
                  { href: '/debate', label: 'Debates', icon: Mic, color: 'text-for-300' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100/60 border border-surface-300/60 hover:border-surface-400/80 transition-colors group"
                  >
                    <item.icon className={cn('h-3.5 w-3.5 flex-shrink-0', item.color)} />
                    <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                    <ArrowRight className="h-3 w-3 text-surface-700 group-hover:text-surface-500 ml-auto flex-shrink-0 transition-colors" />
                  </Link>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
