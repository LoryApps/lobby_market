import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Gavel,
  MessageSquare,
  Mic,
  Network,
  Scale,
  ScrollText,
  Swords,
  Vote,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { Topic, Law } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Order Paper · Lobby Market',
  description:
    'The official Order Paper for the Lobby — all bills before the House, recently enacted laws, chamber debates, committee reports, and council motions in one formal document.',
  openGraph: {
    title: 'Order Paper · Lobby Market',
    description: 'The formal record of all legislative business currently before the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Order Paper · Lobby Market',
    description: 'Bills, laws, debates, committee reports, and council motions — the formal Order Paper.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  })
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:   'text-for-400',
  Economics:  'text-gold',
  Technology: 'text-purple',
  Health:     'text-emerald',
  Science:    'text-for-300',
  Ethics:     'text-against-300',
  Culture:    'text-against-400',
  Philosophy: 'text-purple',
  Education:  'text-for-400',
  Environment:'text-emerald',
  Security:   'text-against-400',
  Social:     'text-surface-500',
}

function categoryColor(cat: string | null): string {
  return CATEGORY_COLORS[cat ?? ''] ?? 'text-surface-500'
}

const RECOMMENDATION_LABEL: Record<string, { label: string; color: string }> = {
  for:     { label: 'Recommends FOR',     color: 'text-for-400' },
  against: { label: 'Recommends AGAINST', color: 'text-against-400' },
  neutral: { label: 'Neutral',            color: 'text-surface-500' },
  hold:    { label: 'Hold — Further Study', color: 'text-gold' },
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  number,
  icon: Icon,
  title,
  subtitle,
}: {
  number: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-surface-300">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
        <Icon className="h-4 w-4 text-surface-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-mono text-surface-500 tracking-widest uppercase">
            {number}
          </span>
          <h2 className="text-base font-semibold text-surface-800 tracking-tight">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

// ─── Bill row ─────────────────────────────────────────────────────────────────

function BillRow({
  number,
  topic,
  reading,
}: {
  number: number
  topic: Topic
  reading: '1st' | '2nd' | '3rd'
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const readingColor: Record<string, string> = {
    '1st': 'text-surface-500 bg-surface-200/50 border-surface-300',
    '2nd': 'text-for-400 bg-for-950/50 border-for-900',
    '3rd': 'text-gold bg-amber-950/50 border-amber-900',
  }

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
    >
      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
        {String(number).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border',
            readingColor[reading]
          )}>
            {reading} Reading
          </span>
          {topic.category && (
            <span className={cn('text-xs font-medium', categoryColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>
        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
          {topic.statement}
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
          <span className="text-for-400 font-medium">{forPct}% For</span>
          <span className="text-against-400 font-medium">{againstPct}% Against</span>
          {topic.total_votes != null && topic.total_votes > 0 && (
            <span>{topic.total_votes.toLocaleString()} votes</span>
          )}
        </div>
        <div className="h-1 w-full rounded-full bg-surface-300 mt-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
    </Link>
  )
}

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({ number, law }: { number: number; law: Law }) {
  return (
    <Link
      href={`/law/${law.id}`}
      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
    >
      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
        {String(number).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-gold bg-amber-950/50 border-amber-900">
            Enacted
          </span>
          {law.category && (
            <span className={cn('text-xs font-medium', categoryColor(law.category))}>
              {law.category}
            </span>
          )}
        </div>
        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
          {law.statement}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
          {law.established_at && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-gold" />
              Enacted {formatDate(law.established_at)}
            </span>
          )}
          {law.total_votes != null && law.total_votes > 0 && (
            <span>{law.total_votes.toLocaleString()} votes</span>
          )}
        </div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
    </Link>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebateRow {
  id: string
  title: string
  status: string
  type: string
  scheduled_at: string
  viewer_count: number
  topic: { id: string; statement: string; category: string | null } | null
}

interface CommitteeReportRow {
  id: string
  title: string
  summary: string
  category: string
  recommendation: string
  endorsement_count: number
  published_at: string | null
  created_at: string
  topic: { id: string; statement: string } | null
  author: { username: string; display_name: string | null } | null
}

interface CouncilMotionRow {
  id: string
  title: string
  description: string
  effect: string
  votes_for: number
  votes_against: number
  status: string
  created_at: string
  topic: { id: string; statement: string } | null
  proposer: { username: string; display_name: string | null } | null
}

interface AmendmentRow {
  id: string
  title: string
  status: string
  for_count: number
  against_count: number
  created_at: string
  expires_at: string
  law: { id: string; statement: string } | null
  proposer: { username: string | null; display_name: string | null } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrderPaperPage() {
  const supabase = await createClient()

  const now = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Parallel fetches
  const [
    proposedRes,
    activeRes,
    votingRes,
    recentLawsRes,
    upcomingDebatesRes,
    liveDebatesRes,
    committeeReportsRes,
    councilMotionsRes,
    amendmentsRes,
  ] = await Promise.all([
    // 1st reading: proposed
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('status', 'proposed')
      .order('created_at', { ascending: false })
      .limit(8),

    // 2nd reading: active
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('status', 'active')
      .order('feed_score', { ascending: false })
      .limit(10),

    // 3rd reading: voting
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('status', 'voting')
      .order('blue_pct', { ascending: false })
      .limit(10),

    // Recently enacted laws (last 7 days)
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, established_at')
      .gte('established_at', sevenDaysAgo)
      .order('established_at', { ascending: false })
      .limit(8),

    // Upcoming debates
    supabase
      .from('debates')
      .select('id, title, status, type, scheduled_at, viewer_count, topic:topics(id, statement, category)')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(6),

    // Live debates
    supabase
      .from('debates')
      .select('id, title, status, type, scheduled_at, viewer_count, topic:topics(id, statement, category)')
      .eq('status', 'live')
      .order('viewer_count', { ascending: false })
      .limit(4),

    // Recent committee reports
    supabase
      .from('civic_committee_reports')
      .select('id, title, summary, category, recommendation, endorsement_count, published_at, created_at, topic:topics(id, statement), author:profiles(username, display_name)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5),

    // Active council motions
    supabase
      .from('council_motions')
      .select('id, title, description, effect, votes_for, votes_against, status, created_at, topic:topics(id, statement), proposer:profiles(username, display_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),

    // Pending amendments
    supabase
      .from('law_amendments')
      .select('id, title, status, for_count, against_count, created_at, expires_at, law:laws(id, statement), proposer:profiles(username, display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const proposed = (proposedRes.data ?? []) as Topic[]
  const active = (activeRes.data ?? []) as Topic[]
  const voting = (votingRes.data ?? []) as Topic[]
  const recentLaws = (recentLawsRes.data ?? []) as Law[]
  const upcomingDebates = (upcomingDebatesRes.data ?? []) as unknown as DebateRow[]
  const liveDebates = (liveDebatesRes.data ?? []) as unknown as DebateRow[]
  const committeeReports = (committeeReportsRes.data ?? []) as unknown as CommitteeReportRow[]
  const councilMotions = (councilMotionsRes.data ?? []) as unknown as CouncilMotionRow[]
  const amendments = (amendmentsRes.data ?? []) as unknown as AmendmentRow[]

  const allDebates = [...liveDebates, ...upcomingDebates]
  const totalBills = proposed.length + active.length + voting.length

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-24">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">

          {/* ── Document header ─────────────────────────────────────────── */}
          <div className="mb-8 border-b-2 border-surface-300 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ScrollText className="h-5 w-5 text-gold" />
                  <span className="text-xs font-mono text-surface-500 tracking-widest uppercase">
                    Official Document
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-surface-900 tracking-tight">
                  Order Paper
                </h1>
                <p className="text-sm text-surface-500 mt-1">
                  Lobby Market — Civic Legislature
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                  Issued
                </p>
                <p className="text-sm text-surface-700 font-medium mt-0.5">
                  {todayLabel}
                </p>
              </div>
            </div>

            {/* Summary counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Bills Before House', value: totalBills, icon: FileText, color: 'text-for-400' },
                { label: 'Recent Laws Enacted', value: recentLaws.length, icon: Gavel, color: 'text-gold' },
                { label: 'Active Debates', value: allDebates.length, icon: Mic, color: 'text-against-400' },
                { label: 'Committee Reports', value: committeeReports.length, icon: ScrollText, color: 'text-emerald' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center"
                >
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                  <div className={cn('text-xl font-bold tabular-nums', color)}>{value}</div>
                  <div className="text-[10px] text-surface-500 leading-tight mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Part I: Bills Before the House ──────────────────────────── */}
          <section className="mb-10">
            <SectionHeader
              number="Part I"
              icon={Vote}
              title="Bills Before the House"
              subtitle="All topics currently open for civic deliberation, ordered by reading stage"
            />

            {totalBills === 0 ? (
              <p className="text-sm text-surface-500 py-6 text-center">
                No bills currently before the House.
              </p>
            ) : (
              <div className="mt-4 space-y-0.5">
                {/* 3rd Reading (voting) — most urgent */}
                {voting.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-mono text-gold uppercase tracking-widest px-4 mb-2">
                      Third Reading — Final Division ({voting.length})
                    </p>
                    {voting.map((t, i) => (
                      <BillRow key={t.id} number={i + 1} topic={t} reading="3rd" />
                    ))}
                  </div>
                )}
                {/* 2nd Reading (active) */}
                {active.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-mono text-for-400 uppercase tracking-widest px-4 mb-2">
                      Second Reading — Debate in Progress ({active.length})
                    </p>
                    {active.map((t, i) => (
                      <BillRow key={t.id} number={i + 1} topic={t} reading="2nd" />
                    ))}
                  </div>
                )}
                {/* 1st Reading (proposed) */}
                {proposed.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest px-4 mb-2">
                      First Reading — Newly Proposed ({proposed.length})
                    </p>
                    {proposed.map((t, i) => (
                      <BillRow key={t.id} number={i + 1} topic={t} reading="1st" />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 px-4">
              <Link
                href="/topics"
                className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
              >
                View all topics
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          {/* ── Part II: Royal Assent — Recently Enacted ────────────────── */}
          <section className="mb-10">
            <SectionHeader
              number="Part II"
              icon={Gavel}
              title="Royal Assent"
              subtitle="Laws enacted by civic consensus in the past seven days"
            />

            {recentLaws.length === 0 ? (
              <p className="text-sm text-surface-500 py-6 text-center">
                No laws enacted in the past seven days.
              </p>
            ) : (
              <div className="mt-4 space-y-0.5">
                {recentLaws.map((law, i) => (
                  <LawRow key={law.id} number={i + 1} law={law} />
                ))}
              </div>
            )}

            <div className="mt-3 px-4">
              <Link
                href="/laws"
                className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-amber-400 transition-colors"
              >
                View full Codex
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          {/* ── Part III: Chamber Business ──────────────────────────────── */}
          <section className="mb-10">
            <SectionHeader
              number="Part III"
              icon={Mic}
              title="Chamber Business"
              subtitle="Live and scheduled debates before the Lobby chamber"
            />

            {allDebates.length === 0 ? (
              <p className="text-sm text-surface-500 py-6 text-center">
                No debates currently scheduled or live.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {allDebates.map((debate, i) => {
                  const isLive = debate.status === 'live'
                  return (
                    <Link
                      key={debate.id}
                      href={`/debate/${debate.id}`}
                      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
                    >
                      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-against-400 bg-against-950/50 border-against-900 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-against-400 inline-block" />
                              Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-surface-500 bg-surface-200/50 border-surface-300">
                              Scheduled
                            </span>
                          )}
                          <span className="text-xs font-mono text-for-400 capitalize">
                            {debate.type}
                          </span>
                        </div>
                        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-1">
                          {debate.title}
                        </p>
                        {debate.topic && (
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                            Re: {debate.topic.statement}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
                          {isLive ? (
                            <span className="flex items-center gap-1 text-against-400">
                              <MessageSquare className="h-3 w-3" />
                              {debate.viewer_count} watching
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(debate.scheduled_at)} · {formatTime(debate.scheduled_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="mt-3 px-4">
              <Link
                href="/debate"
                className="inline-flex items-center gap-1.5 text-xs text-against-400 hover:text-against-300 transition-colors"
              >
                View all debates
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          {/* ── Part IV: Committee Reports Tabled ───────────────────────── */}
          {committeeReports.length > 0 && (
            <section className="mb-10">
              <SectionHeader
                number="Part IV"
                icon={ScrollText}
                title="Committee Reports Tabled"
                subtitle="Formal findings and recommendations recently submitted by committee chairs"
              />

              <div className="mt-4 space-y-3">
                {committeeReports.map((report, i) => {
                  const rec = RECOMMENDATION_LABEL[report.recommendation] ??
                    { label: report.recommendation, color: 'text-surface-500' }
                  return (
                    <Link
                      key={report.id}
                      href={`/committee-reports`}
                      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
                    >
                      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={cn('text-xs font-medium', rec.color)}>
                            {rec.label}
                          </span>
                          <span className={cn('text-xs', categoryColor(report.category))}>
                            {report.category}
                          </span>
                        </div>
                        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-1">
                          {report.title}
                        </p>
                        {report.topic && (
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                            Re: {report.topic.statement}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
                          {report.author && (
                            <span>
                              {report.author.display_name ?? report.author.username}
                            </span>
                          )}
                          {report.endorsement_count > 0 && (
                            <span>{report.endorsement_count} endorsed</span>
                          )}
                          {(report.published_at ?? report.created_at) && (
                            <span>{formatDate(report.published_at ?? report.created_at)}</span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
                    </Link>
                  )
                })}
              </div>

              <div className="mt-3 px-4">
                <Link
                  href="/committee-reports"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald hover:text-emerald/80 transition-colors"
                >
                  View all committee reports
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          )}

          {/* ── Part V: Grand Council Motions ───────────────────────────── */}
          {councilMotions.length > 0 && (
            <section className="mb-10">
              <SectionHeader
                number="Part V"
                icon={Network}
                title="Grand Council Motions"
                subtitle="Active motions before the Grand Council (top citizens by clout)"
              />

              <div className="mt-4 space-y-3">
                {councilMotions.map((motion, i) => {
                  const total = motion.votes_for + motion.votes_against
                  const forPct = total > 0 ? Math.round((motion.votes_for / total) * 100) : 50

                  const EFFECT_LABEL: Record<string, string> = {
                    elevate_topic:   'Elevate Topic',
                    issue_statement: 'Issue Statement',
                    call_assembly:   'Call Assembly',
                  }

                  return (
                    <Link
                      key={motion.id}
                      href="/grand-council"
                      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
                    >
                      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-purple bg-purple/10 border-purple/30">
                            {EFFECT_LABEL[motion.effect] ?? motion.effect}
                          </span>
                        </div>
                        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-1">
                          {motion.title}
                        </p>
                        {motion.topic && (
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                            Re: {motion.topic.statement}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="text-for-400">{motion.votes_for} For</span>
                          <span className="text-against-400">{motion.votes_against} Against</span>
                          {total > 0 && (
                            <span className="text-surface-500">{forPct}% support</span>
                          )}
                          {motion.proposer && (
                            <span className="text-surface-500">
                              by {motion.proposer.display_name ?? motion.proposer.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
                    </Link>
                  )
                })}
              </div>

              <div className="mt-3 px-4">
                <Link
                  href="/grand-council"
                  className="inline-flex items-center gap-1.5 text-xs text-purple hover:text-purple/80 transition-colors"
                >
                  View Grand Council
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          )}

          {/* ── Part VI: Amendments on Notice ───────────────────────────── */}
          {amendments.length > 0 && (
            <section className="mb-10">
              <SectionHeader
                number="Part VI"
                icon={Swords}
                title="Amendments on Notice"
                subtitle="Pending amendments to enacted laws — open for citizen ratification"
              />

              <div className="mt-4 space-y-3">
                {amendments.map((amendment, i) => {
                  const total = amendment.for_count + amendment.against_count
                  const forPct = total > 0 ? Math.round((amendment.for_count / total) * 100) : 0
                  const daysLeft = Math.ceil(
                    (new Date(amendment.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )

                  return (
                    <Link
                      key={amendment.id}
                      href={amendment.law ? `/law/${amendment.law.id}/amendments` : '/laws'}
                      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
                    >
                      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border',
                            daysLeft <= 2
                              ? 'text-against-400 bg-against-950/50 border-against-900'
                              : 'text-surface-500 bg-surface-200/50 border-surface-300'
                          )}>
                            {daysLeft <= 0 ? 'Expiring' : `${daysLeft}d remaining`}
                          </span>
                        </div>
                        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-1">
                          {amendment.title}
                        </p>
                        {amendment.law && (
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                            Amends: {amendment.law.statement}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          {total > 0 ? (
                            <>
                              <span className="text-for-400">{amendment.for_count} For</span>
                              <span className="text-against-400">{amendment.against_count} Against</span>
                              <span className="text-surface-500">{forPct}% support</span>
                            </>
                          ) : (
                            <span className="text-surface-500">No votes yet</span>
                          )}
                          {amendment.proposer && (
                            <span className="text-surface-500">
                              by {amendment.proposer.display_name ?? amendment.proposer.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="border-t border-surface-300 pt-6 mt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  This Order Paper is generated from live platform data and updated continuously.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/floor"
                  className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                >
                  <Scale className="h-3 w-3" />
                  The Floor
                </Link>
                <Link
                  href="/laws"
                  className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-amber-400 transition-colors"
                >
                  <Gavel className="h-3 w-3" />
                  Full Codex
                </Link>
                <Link
                  href="/calendar"
                  className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                >
                  <Clock className="h-3 w-3" />
                  Calendar
                </Link>
                <Link
                  href="/adjournment"
                  className="inline-flex items-center gap-1.5 text-xs text-purple hover:text-purple/70 transition-colors"
                >
                  <Mic className="h-3 w-3" />
                  Adjournment
                </Link>
              </div>
            </div>
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
