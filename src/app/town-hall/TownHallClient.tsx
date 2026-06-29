'use client'

/**
 * /town-hall — The Civic Town Hall
 *
 * A weekly open-session gathering of all platform citizens. Shows:
 *   - This week's active governance (Grand Council motions, referendums, elections)
 *   - Topics needing votes right now
 *   - Recent laws established this week
 *   - Weekly civic stats: votes cast, arguments posted, topics created
 *
 * Distinct from:
 *   /civic-commons — meta-governance hub (lists all governance types)
 *   /council       — Grand Council (elite-only meritocracy)
 *   /assembly      — Citizens' Assembly (sortition-selected)
 *   /intelligence  — AI-curated platform briefing
 *   /proclamations — formal announcements (issued, not debated)
 *
 * The Town Hall is the open weekly check-in: no selection criteria,
 * no appointment needed — just show up and participate.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart2,
  CalendarDays,
  ChevronRight,
  Crown,
  Gavel,
  Globe,
  Landmark,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  TownHallResponse,
  TownHallTopic,
  TownHallLaw,
  TownHallMotion,
  TownHallReferendum,
  TownHallElection,
} from '@/app/api/town-hall/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m left`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-emerald',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Ethics: 'text-amber-400',
  Culture: 'text-pink-400',
  Science: 'text-cyan-400',
  Philosophy: 'text-violet-400',
  Health: 'text-green-400',
  Environment: 'text-lime-400',
  Education: 'text-orange-400',
  Other: 'text-surface-400',
}

const EFFECT_LABEL: Record<string, string> = {
  elevate_topic: 'Elevate Topic',
  issue_statement: 'Issue Statement',
  call_assembly: 'Call Assembly',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-100 border border-surface-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="font-mono text-xs text-surface-400 uppercase tracking-wider">{label}</span>
      </div>
      <AnimatedNumber
        value={value}
        className="font-mono text-2xl font-bold text-white"
      />
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  label,
  count,
  linkTo,
  linkLabel,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  linkTo?: string
  linkLabel?: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <h2 className="font-mono text-sm font-bold text-white uppercase tracking-widest">{label}</h2>
        {count !== undefined && count > 0 && (
          <span className={cn('font-mono text-xs px-1.5 py-0.5 rounded', color, 'bg-surface-200')}>
            {count}
          </span>
        )}
      </div>
      {linkTo && (
        <Link
          href={linkTo}
          className="font-mono text-xs text-surface-400 hover:text-white transition-colors flex items-center gap-1"
        >
          {linkLabel ?? 'View all'} <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function MotionCard({ councilMotion: m }: { councilMotion: TownHallMotion }) {
  const total = m.votes_for + m.votes_against
  const forPct = total > 0 ? Math.round((m.votes_for / total) * 100) : 50
  return (
    <Link
      href="/council"
      className="block rounded-xl bg-surface-100 border border-surface-200 hover:border-purple/40 p-4 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-purple/10 text-purple border border-purple/20">
          {EFFECT_LABEL[m.effect] ?? m.effect}
        </span>
        <span className="font-mono text-xs text-surface-500 flex-shrink-0">{timeUntil(m.closes_at)}</span>
      </div>
      <p className="font-mono text-sm text-white leading-relaxed mb-3 line-clamp-2">{m.title}</p>
      {m.proposer_username && (
        <div className="flex items-center gap-1.5 mb-3">
          <Avatar src={m.proposer_avatar_url} username={m.proposer_username} size="xs" />
          <span className="font-mono text-xs text-surface-400">
            {m.proposer_display_name ?? m.proposer_username}
          </span>
        </div>
      )}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div className="h-full bg-purple rounded-full" style={{ width: `${forPct}%` }} />
          </div>
          <span className="font-mono text-xs text-surface-400">{forPct}% for</span>
        </div>
      )}
    </Link>
  )
}

function ReferendumCard({ referendum: r }: { referendum: TownHallReferendum }) {
  const total = r.for_votes + r.against_votes
  const forPct = total > 0 ? Math.round((r.for_votes / total) * 100) : 50
  const quorumMet = total >= r.quorum_required
  return (
    <Link
      href="/civic-referendums"
      className="block rounded-xl bg-surface-100 border border-surface-200 hover:border-gold/40 p-4 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 capitalize">
          {r.category}
        </span>
        <span className="font-mono text-xs text-surface-500">{timeUntil(r.closes_at)}</span>
      </div>
      <p className="font-mono text-sm text-white leading-relaxed mb-3 line-clamp-2">{r.question}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
        </div>
        <span className="font-mono text-xs text-surface-400">{total} votes</span>
        {quorumMet && (
          <span className="font-mono text-xs text-emerald">quorum met</span>
        )}
      </div>
    </Link>
  )
}

function TopicRow({ topic }: { topic: TownHallTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-for-500/30 p-3 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {topic.category && (
            <span className={cn('font-mono text-xs', CATEGORY_COLORS[topic.category] ?? 'text-surface-400')}>
              {topic.category}
            </span>
          )}
          <span className="font-mono text-xs text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
          {topic.status === 'voting' && (
            <span className="font-mono text-xs px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              VOTING
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-for-400">{forPct}%</span>
          <span className="font-mono text-xs text-surface-600">/</span>
          <span className="font-mono text-xs text-against-400">{againstPct}%</span>
        </div>
        <div className="w-16 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
        </div>
      </div>
    </Link>
  )
}

function LawCard({ law }: { law: TownHallLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  return (
    <Link
      href={`/topic/${law.topic_id}`}
      className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-gold/40 p-3 transition-colors group"
    >
      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
        <Gavel className="h-4 w-4 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {law.category && (
            <span className={cn('font-mono text-xs', CATEGORY_COLORS[law.category] ?? 'text-surface-400')}>
              {law.category}
            </span>
          )}
          <span className="font-mono text-xs text-surface-500">
            {forPct}% for · {relTime(law.established_at)}
          </span>
        </div>
      </div>
    </Link>
  )
}

function ElectionCard({ election }: { election: TownHallElection }) {
  return (
    <Link
      href="/civic-elections"
      className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-emerald/40 p-3 transition-colors group"
    >
      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/20 flex items-center justify-center">
        <Crown className="h-4 w-4 text-emerald" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-white leading-snug line-clamp-1 group-hover:text-emerald transition-colors">
          {election.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-xs text-surface-500 capitalize">{election.role}</span>
          {election.closes_at && (
            <span className="font-mono text-xs text-surface-500">· {timeUntil(election.closes_at)}</span>
          )}
          <span className="font-mono text-xs text-emerald">{election.nominee_count} nominees</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TownHallClient() {
  const [data, setData] = useState<TownHallResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/town-hall', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load the Town Hall. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const governanceCount =
    (data?.active_motions?.length ?? 0) +
    (data?.active_referendums?.length ?? 0) +
    (data?.active_elections?.length ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Landmark className="h-6 w-6 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Town Hall</h1>
              {data ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CalendarDays className="h-3.5 w-3.5 text-surface-500" />
                  <p className="font-mono text-xs text-surface-400">
                    Week of {data.week_label} · {data.total_citizens.toLocaleString()} citizens
                  </p>
                </div>
              ) : (
                <Skeleton className="h-4 w-48 mt-1" />
              )}
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 font-mono text-xs text-surface-400 hover:text-white transition-colors disabled:opacity-50 mt-1"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ─── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="font-mono text-sm text-against-400">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 font-mono text-xs text-white hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-8">

            {/* ─── Weekly Stats ──────────────────────────────────────────── */}
            <section>
              <SectionHeader
                icon={BarChart2}
                label="This Week's Activity"
                color="text-for-400"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Votes Cast"
                  value={data.weekly_stats.votes_cast}
                  icon={Vote}
                  color="text-for-400"
                />
                <StatCard
                  label="Arguments"
                  value={data.weekly_stats.arguments_posted}
                  icon={MessageSquare}
                  color="text-purple"
                />
                <StatCard
                  label="New Topics"
                  value={data.weekly_stats.topics_created}
                  icon={Sparkles}
                  color="text-amber-400"
                />
                <StatCard
                  label="Laws Passed"
                  value={data.weekly_stats.laws_established}
                  icon={Gavel}
                  color="text-gold"
                />
              </div>
            </section>

            {/* ─── Governance ────────────────────────────────────────────── */}
            {governanceCount > 0 && (
              <section>
                <SectionHeader
                  icon={Crown}
                  label="Active Governance"
                  count={governanceCount}
                  color="text-purple"
                />
                <div className="space-y-4">

                  {/* Council Motions */}
                  {data.active_motions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shield className="h-3.5 w-3.5 text-purple" />
                        <span className="font-mono text-xs text-surface-400 uppercase tracking-wider">
                          Grand Council Motions
                        </span>
                      </div>
                      <div className="space-y-2">
                        {data.active_motions.map((m) => (
                          <MotionCard key={m.id} councilMotion={m} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Referendums */}
                  {data.active_referendums.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Scale className="h-3.5 w-3.5 text-gold" />
                        <span className="font-mono text-xs text-surface-400 uppercase tracking-wider">
                          Open Referendums
                        </span>
                      </div>
                      <div className="space-y-2">
                        {data.active_referendums.map((r) => (
                          <ReferendumCard key={r.id} referendum={r} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Elections */}
                  {data.active_elections.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Trophy className="h-3.5 w-3.5 text-emerald" />
                        <span className="font-mono text-xs text-surface-400 uppercase tracking-wider">
                          Active Elections
                        </span>
                      </div>
                      <div className="space-y-2">
                        {data.active_elections.map((e) => (
                          <ElectionCard key={e.id} election={e} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ─── On the Floor ──────────────────────────────────────────── */}
            {(data.hot_topics.length > 0 || data.voting_topics.length > 0) && (
              <section>
                <SectionHeader
                  icon={Mic}
                  label="On the Floor"
                  count={data.hot_topics.length + data.voting_topics.length}
                  linkTo="/topics"
                  linkLabel="All topics"
                  color="text-for-400"
                />

                {/* Voting Now — urgent row */}
                {data.voting_topics.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="font-mono text-xs text-amber-400 uppercase tracking-wider">
                        Voting Now — Close Soon
                      </span>
                    </div>
                    <div className="space-y-2">
                      {data.voting_topics.map((t) => (
                        <TopicRow key={t.id} topic={t} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Active & Proposed */}
                {data.hot_topics.length > 0 && (
                  <div>
                    {data.voting_topics.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap className="h-3.5 w-3.5 text-for-400" />
                        <span className="font-mono text-xs text-surface-400 uppercase tracking-wider">
                          Hottest Debates
                        </span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {data.hot_topics.map((t) => (
                        <TopicRow key={t.id} topic={t} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ─── Recent Laws ───────────────────────────────────────────── */}
            {data.recent_laws.length > 0 && (
              <section>
                <SectionHeader
                  icon={Gavel}
                  label={
                    data.weekly_stats.laws_established > 0
                      ? `Laws Passed This Week`
                      : 'Most Recent Laws'
                  }
                  count={data.weekly_stats.laws_established > 0 ? data.weekly_stats.laws_established : undefined}
                  linkTo="/law"
                  linkLabel="Law Codex"
                  color="text-gold"
                />
                <div className="space-y-2">
                  {data.recent_laws.map((l) => (
                    <LawCard key={l.id} law={l} />
                  ))}
                </div>
              </section>
            )}

            {/* ─── Quick Links ───────────────────────────────────────────── */}
            <section>
              <SectionHeader icon={Globe} label="Participate" color="text-surface-400" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Vote on Topics', href: '/', icon: Vote, color: 'text-for-400' },
                  { label: 'Join a Debate', href: '/debate', icon: Mic, color: 'text-purple' },
                  { label: 'Grand Council', href: '/council', icon: Crown, color: 'text-purple' },
                  { label: 'Referendums', href: '/civic-referendums', icon: Scale, color: 'text-gold' },
                  { label: 'Elections', href: '/civic-elections', icon: Trophy, color: 'text-emerald' },
                  { label: 'Civic Commons', href: '/civic-commons', icon: Landmark, color: 'text-for-400' },
                ].map(({ label, href, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 px-3 py-2.5 transition-colors group"
                  >
                    <Icon className={cn('h-4 w-4', color)} />
                    <span className="font-mono text-xs text-white group-hover:text-surface-200 transition-colors">
                      {label}
                    </span>
                    <ArrowRight className="h-3 w-3 text-surface-500 group-hover:text-surface-300 ml-auto transition-colors" />
                  </Link>
                ))}
              </div>
            </section>

          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
