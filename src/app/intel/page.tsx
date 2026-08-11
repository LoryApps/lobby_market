import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BarChart2,
  Bell,
  Flame,
  Gavel,
  Mic,
  Radio,
  Scale,
  Swords,
  Timer,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { Topic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Lobby Intel · Lobby Market',
  description:
    'Real-time intelligence signals — votes about to close, contested races, velocity spikes, and upcoming debates. Know where your voice matters most.',
  openGraph: {
    title: 'Lobby Intel · Lobby Market',
    description:
      'Live signals from across the platform: deadlocks, brink-of-law topics, velocity spikes, and upcoming debates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Lobby Intel · Lobby Market',
    description: 'Real-time civic intelligence — know where your vote matters most, right now.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function futureTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.round(diff / 60000)
  const h = Math.round(m / 60)
  const d = Math.round(h / 24)
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  return `${d}d`
}

function votingTimeLeft(iso: string): { label: string; urgent: boolean } {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return { label: 'Ended', urgent: false }
  const m = Math.round(diff / 60000)
  const h = Math.floor(m / 60)
  const urgent = diff < 2 * 3_600_000
  if (m < 60) return { label: `${m}m left`, urgent }
  if (h < 24) return { label: `${h}h left`, urgent }
  return { label: `${Math.floor(h / 24)}d left`, urgent: false }
}

// ─── Section component ────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  accent,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  accent: string
  count?: number
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg border', accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {count !== undefined && (
              <span className="text-xs font-mono text-surface-400 tabular-nums">{count}</span>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  meta,
  highlight,
}: {
  topic: Topic
  meta?: React.ReactNode
  highlight?: 'red' | 'gold' | 'purple' | 'blue' | 'emerald'
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const borderColor: Record<string, string> = {
    red: 'border-l-against-500',
    gold: 'border-l-gold',
    purple: 'border-l-purple',
    blue: 'border-l-for-500',
    emerald: 'border-l-emerald',
  }

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group block rounded-xl bg-surface-100 border border-surface-300 px-4 py-3',
        'hover:border-surface-400 hover:bg-surface-200/60 transition-all duration-150',
        highlight && 'border-l-2',
        highlight && borderColor[highlight],
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {topic.statement}
          </p>
          {meta && <div className="mt-2">{meta}</div>}
        </div>
        <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0 mt-0.5" />
      </div>

      {/* Vote bar */}
      <div className="mt-3 space-y-1">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
          <div className="bg-for-500 h-full rounded-l-full" style={{ width: `${forPct}%` }} />
          <div className="bg-against-500 h-full rounded-r-full" style={{ width: `${againstPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-surface-500 tabular-nums">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-surface-400">{topic.total_votes.toLocaleString()} votes</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IntelPage() {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // 1. Critical: voting ending in < 2 hours
  const twoHoursFromNow = new Date(Date.now() + 2 * 3_600_000).toISOString()
  const { data: endingSoon } = await supabase
    .from('topics')
    .select('*')
    .eq('status', 'voting')
    .gt('voting_ends_at', now)
    .lte('voting_ends_at', twoHoursFromNow)
    .order('voting_ends_at', { ascending: true })
    .limit(5)

  // 2. Contested: active/voting topics within 3 pts of 50/50 with ≥100 votes
  const { data: contested } = await supabase
    .from('topics')
    .select('*')
    .in('status', ['active', 'voting'])
    .gte('blue_pct', 47)
    .lte('blue_pct', 53)
    .gte('total_votes', 50)
    .order('total_votes', { ascending: false })
    .limit(5)

  // 3. Brink of law: voting topics at 65%+ for
  const { data: brinkOfLaw } = await supabase
    .from('topics')
    .select('*')
    .eq('status', 'voting')
    .gte('blue_pct', 65)
    .order('blue_pct', { ascending: false })
    .limit(5)

  // 4. Velocity: highest feed_score active topics (proxy for recent activity)
  const { data: velocity } = await supabase
    .from('topics')
    .select('*')
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(6)

  // 5. Upcoming debates: scheduled in next 48 hours
  const fortyEightH = new Date(Date.now() + 48 * 3_600_000).toISOString()
  const { data: upcomingDebates } = await supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, topic_id')
    .eq('status', 'scheduled')
    .gt('scheduled_at', now)
    .lte('scheduled_at', fortyEightH)
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // 6. Newly established laws (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const { data: recentLaws } = await supabase
    .from('topics')
    .select('*')
    .eq('status', 'law')
    .gte('updated_at', sevenDaysAgo)
    .order('updated_at', { ascending: false })
    .limit(4)

  // 7. Near-threshold proposed topics (≥ 70% of activation threshold)
  const { data: nearThreshold } = await supabase
    .from('topics')
    .select('*')
    .eq('status', 'proposed')
    .order('support_count', { ascending: false })
    .limit(20)

  const almostActive = (nearThreshold ?? []).filter((t) => {
    const pct = t.activation_threshold > 0 ? t.support_count / t.activation_threshold : 0
    return pct >= 0.6
  }).slice(0, 5)

  const endingSoonList = (endingSoon as Topic[] | null) ?? []
  const contestedList = (contested as Topic[] | null) ?? []
  const brinkList = (brinkOfLaw as Topic[] | null) ?? []
  const velocityList = (velocity as Topic[] | null) ?? []
  const recentLawsList = (recentLaws as Topic[] | null) ?? []
  const nearThresholdList = almostActive as Topic[]

  const totalSignals =
    endingSoonList.length +
    contestedList.length +
    brinkList.length +
    nearThresholdList.length

  const DEBATE_TYPE_LABEL: Record<string, string> = {
    quick: '15m',
    standard: '30m',
    grand: '45m',
    oxford: 'Oxford',
    tribunal: 'Tribunal',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-100 border border-surface-300">
              <Radio className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Lobby Intel</h1>
              <p className="text-xs text-surface-500 mt-0.5">
                Live signals &mdash; updated now
              </p>
            </div>
            {totalSignals > 0 && (
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-against-500/10 border border-against-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
                <span className="text-xs font-mono text-against-300 tabular-nums">{totalSignals} signals</span>
              </div>
            )}
          </div>
          <p className="text-sm text-surface-500 pl-0.5">
            Real-time intelligence from across the platform — where your vote matters most right now.
          </p>
        </div>

        <div className="space-y-8">

          {/* ── 1. Critical: Ending Soon ─────────────────────────────────── */}
          {endingSoonList.length > 0 && (
            <section>
              <SectionHeader
                icon={Timer}
                title="Closing Soon"
                subtitle="Voting ends in under 2 hours — cast yours now"
                accent="bg-against-500/10 border-against-500/30 text-against-400"
                count={endingSoonList.length}
              />
              <div className="space-y-2">
                {endingSoonList.map((t) => {
                  const { label, urgent } = votingTimeLeft(t.voting_ends_at!)
                  return (
                    <TopicRow
                      key={t.id}
                      topic={t}
                      highlight="red"
                      meta={
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                              urgent
                                ? 'bg-against-500/20 text-against-300'
                                : 'bg-surface-300 text-surface-500',
                            )}
                          >
                            <Timer className="h-2.5 w-2.5" />
                            {label}
                          </span>
                          {t.category && (
                            <span className="text-[10px] text-surface-500">{t.category}</span>
                          )}
                        </div>
                      }
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* ── 2. Contested: Deadlocks ──────────────────────────────────── */}
          {contestedList.length > 0 && (
            <section>
              <SectionHeader
                icon={Swords}
                title="Deadlocks"
                subtitle="Within 3 points of 50/50 — your vote breaks the tie"
                accent="bg-purple/10 border-purple/30 text-purple"
                count={contestedList.length}
              />
              <div className="space-y-2">
                {contestedList.map((t) => (
                  <TopicRow
                    key={t.id}
                    topic={t}
                    highlight="purple"
                    meta={
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple/15 text-purple">
                          <Scale className="h-2.5 w-2.5" />
                          Deadlocked
                        </span>
                        <span className="text-[10px] text-surface-500 font-mono">
                          {Math.round(Math.abs((t.blue_pct ?? 50) - 50) * 10) / 10}pt gap
                        </span>
                        {t.category && (
                          <span className="text-[10px] text-surface-500">{t.category}</span>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── 3. Brink of Law ──────────────────────────────────────────── */}
          {brinkList.length > 0 && (
            <section>
              <SectionHeader
                icon={Gavel}
                title="Brink of Law"
                subtitle="65%+ consensus in voting — may become law any moment"
                accent="bg-gold/10 border-gold/30 text-gold"
                count={brinkList.length}
              />
              <div className="space-y-2">
                {brinkList.map((t) => (
                  <TopicRow
                    key={t.id}
                    topic={t}
                    highlight="gold"
                    meta={
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold/15 text-gold">
                          <Gavel className="h-2.5 w-2.5" />
                          {Math.round(t.blue_pct ?? 50)}% For
                        </span>
                        {t.category && (
                          <span className="text-[10px] text-surface-500">{t.category}</span>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── 4. Near Threshold ────────────────────────────────────────── */}
          {nearThresholdList.length > 0 && (
            <section>
              <SectionHeader
                icon={TrendingUp}
                title="Almost Active"
                subtitle="Proposed topics closing in on their activation threshold"
                accent="bg-emerald/10 border-emerald/30 text-emerald"
                count={nearThresholdList.length}
              />
              <div className="space-y-2">
                {nearThresholdList.map((t) => {
                  const pct = t.activation_threshold > 0
                    ? Math.round((t.support_count / t.activation_threshold) * 100)
                    : 0
                  return (
                    <TopicRow
                      key={t.id}
                      topic={t}
                      highlight="emerald"
                      meta={
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald/15 text-emerald">
                            <TrendingUp className="h-2.5 w-2.5" />
                            {pct}% of threshold
                          </span>
                          <span className="text-[10px] text-surface-500 font-mono">
                            {t.support_count}/{t.activation_threshold} supports
                          </span>
                        </div>
                      }
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* ── 5. Velocity Leaders ──────────────────────────────────────── */}
          {velocityList.length > 0 && (
            <section>
              <SectionHeader
                icon={Flame}
                title="Highest Velocity"
                subtitle="Most algorithmically active topics right now"
                accent="bg-for-500/10 border-for-500/30 text-for-400"
                count={velocityList.length}
              />
              <div className="space-y-2">
                {velocityList.map((t, i) => (
                  <TopicRow
                    key={t.id}
                    topic={t}
                    highlight="blue"
                    meta={
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-surface-500">#{i + 1}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-for-500/15 text-for-300">
                          <Activity className="h-2.5 w-2.5" />
                          Score {Math.round(t.feed_score ?? 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-surface-500 capitalize">{t.status}</span>
                        {t.category && (
                          <span className="text-[10px] text-surface-500">{t.category}</span>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── 6. Upcoming Debates ───────────────────────────────────────── */}
          {upcomingDebates && upcomingDebates.length > 0 && (
            <section>
              <SectionHeader
                icon={Mic}
                title="Upcoming Debates"
                subtitle="Scheduled in the next 48 hours — RSVP before they fill"
                accent="bg-purple/10 border-purple/30 text-purple"
                count={upcomingDebates.length}
              />
              <div className="space-y-2">
                {upcomingDebates.map((d) => (
                  <Link
                    key={d.id}
                    href={`/debate/${d.id}`}
                    className="group flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-surface-400 hover:bg-surface-200/60 transition-all duration-150"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
                      <Mic className="h-3.5 w-3.5 text-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-1">
                        {d.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {d.type && (
                          <span className="text-[10px] text-surface-500">
                            {DEBATE_TYPE_LABEL[d.type] ?? d.type}
                          </span>
                        )}
                        {d.scheduled_at && (
                          <span className="text-[10px] font-mono text-purple/80">
                            in {futureTime(d.scheduled_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── 7. Recent Laws ────────────────────────────────────────────── */}
          {recentLawsList.length > 0 && (
            <section>
              <SectionHeader
                icon={Gavel}
                title="New Laws"
                subtitle="Established consensus in the last 7 days"
                accent="bg-gold/10 border-gold/30 text-gold"
                count={recentLawsList.length}
              />
              <div className="space-y-2">
                {recentLawsList.map((t) => (
                  <TopicRow
                    key={t.id}
                    topic={t}
                    highlight="gold"
                    meta={
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold/15 text-gold">
                          <Gavel className="h-2.5 w-2.5" />
                          LAW
                        </span>
                        <span className="text-[10px] text-surface-500">
                          {relativeTime(t.updated_at)}
                        </span>
                        {t.category && (
                          <span className="text-[10px] text-surface-500">{t.category}</span>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Empty state ────────────────────────────────────────────────── */}
          {totalSignals === 0 &&
            (!upcomingDebates || upcomingDebates.length === 0) &&
            recentLawsList.length === 0 &&
            velocityList.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-100 border border-surface-300 mx-auto">
                <Bell className="h-7 w-7 text-surface-500" />
              </div>
              <p className="text-sm text-surface-500">No active signals right now.</p>
              <p className="text-xs text-surface-600">
                The Lobby is quiet — check back soon or{' '}
                <Link href="/" className="text-for-400 hover:underline">
                  browse the feed
                </Link>
                .
              </p>
            </div>
          )}

          {/* Footer links */}
          <div className="pt-4 border-t border-surface-300">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/trending"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Trending
              </Link>
              <Link
                href="/debate"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <Mic className="h-3.5 w-3.5" />
                All Debates
              </Link>
              <Link
                href="/law"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                Law Codex
              </Link>
              <Link
                href="/categories"
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Categories
              </Link>
            </div>
          </div>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
