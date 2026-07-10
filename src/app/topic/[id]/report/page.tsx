import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  MapPin,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SharePanel } from '@/components/ui/SharePanel'
import { PrintButton } from './PrintButton'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportPageProps {
  params: { id: string }
}

interface ReportArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes, description')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Civic Report · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const statusLabel: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'In Voting',
    law: 'Established Law',
    failed: 'Failed',
  }
  const label = statusLabel[topic.status] ?? topic.status
  const desc = topic.description
    ? topic.description.slice(0, 150)
    : `${label} · ${forPct}% For / ${againstPct}% Against · ${topic.total_votes ?? 0} votes`

  return {
    title: `${topic.statement} — Civic Report · Lobby Market`,
    description: desc,
    openGraph: {
      title: `Civic Report: ${topic.statement}`,
      description: desc,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `Civic Report: ${topic.statement}`,
      description: desc,
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function pctBar(pct: number) {
  return {
    for: Math.round(pct),
    against: Math.round(100 - pct),
  }
}

const STATUS_CONFIG: Record<string, { label: string; badge: 'proposed' | 'active' | 'law' | 'failed'; icon: typeof Scale }> = {
  proposed: { label: 'Proposed',         badge: 'proposed', icon: FileText },
  active:   { label: 'Active Debate',    badge: 'active',   icon: Zap },
  voting:   { label: 'In Final Voting',  badge: 'active',   icon: Scale },
  law:      { label: 'Established Law',  badge: 'law',      icon: Gavel },
  failed:   { label: 'Failed',           badge: 'failed',   icon: Scale },
}

const SCOPE_ICON: Record<string, typeof Globe> = {
  global: Globe,
  national: MapPin,
  local: MapPin,
}

// ─── Components ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-surface-500">
        {children}
      </span>
      <div className="flex-1 h-px bg-surface-300" />
    </div>
  )
}

function ArgumentRow({
  arg,
  rank,
}: {
  arg: ReportArgument
  rank: number
}) {
  const isFor = arg.side === 'blue'

  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'group block p-4 rounded-xl border transition-all',
        isFor
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/40 hover:bg-for-500/10'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/40 hover:bg-against-500/10'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-mono font-bold mt-0.5',
            isFor
              ? 'bg-for-500/20 text-for-300'
              : 'bg-against-500/20 text-against-300'
          )}
        >
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white leading-relaxed line-clamp-3">
            {arg.content}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {arg.author && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={arg.author.avatar_url}
                  username={arg.author.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500">
                  {arg.author.display_name || `@${arg.author.username}`}
                </span>
              </div>
            )}
            <span className="text-[11px] font-mono text-surface-600 flex items-center gap-1">
              <ThumbsUp className="h-2.5 w-2.5" />
              {arg.upvotes}
            </span>
            <ExternalLink className="h-3 w-3 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TopicReportPage({ params }: ReportPageProps) {
  const supabase = await createClient()

  // ── Fetch topic ──────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select(`
      id, statement, description, category, scope, status,
      blue_pct, total_votes, view_count,
      created_at, updated_at
    `)
    .eq('id', params.id)
    .single()

  if (!topic) notFound()

  // ── Fetch law info if established ────────────────────────────────────────
  const { data: lawRow } = await supabase
    .from('laws')
    .select('id, established_at')
    .eq('topic_id', params.id)
    .maybeSingle()

  // ── Fetch top arguments (3 FOR + 3 AGAINST) ──────────────────────────────
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(`
      id, content, side, upvotes, created_at,
      author:profiles!arguments_author_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `)
    .eq('topic_id', params.id)
    .in('side', ['blue', 'red'])
    .order('upvotes', { ascending: false })
    .limit(20)

  const allArgs = (rawArgs ?? []) as ReportArgument[]
  const forArgs = allArgs.filter((a) => a.side === 'blue').slice(0, 3)
  const againstArgs = allArgs.filter((a) => a.side === 'red').slice(0, 3)

  // ── Fetch debate count ────────────────────────────────────────────────────
  const { count: debateCount } = await supabase
    .from('debates')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)

  // ── Derived values ────────────────────────────────────────────────────────
  const pct = pctBar(topic.blue_pct ?? 50)
  const statusCfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const StatusIcon = statusCfg.icon
  const ScopeIcon = SCOPE_ICON[topic.scope ?? 'global'] ?? Globe
  const isLaw = topic.status === 'law'
  const isVotable = topic.status === 'active' || topic.status === 'voting'
  const reportUrl = `https://lobby.market/topic/${params.id}/report`
  const topicUrl = `https://lobby.market/topic/${params.id}`
  const totalVotes = topic.total_votes ?? 0
  const forVotes = Math.round(totalVotes * (topic.blue_pct ?? 50) / 100)
  const againstVotes = totalVotes - forVotes

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back nav ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/topic/${params.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>

          <div className="flex items-center gap-2">
            <SharePanel
              url={reportUrl}
              text={`Civic Report: ${topic.statement}`}
              topicId={params.id}
            />
          </div>
        </div>

        {/* ── Report card ───────────────────────────────────────────────────── */}
        <div
          className={cn(
            'rounded-2xl border overflow-hidden',
            isLaw ? 'border-gold/30 bg-gold/5' : 'border-surface-300 bg-surface-100'
          )}
        >
          {/* Header band */}
          <div className={cn(
            'px-6 py-4 border-b flex items-center justify-between',
            isLaw ? 'border-gold/20 bg-gold/5' : 'border-surface-300 bg-surface-200'
          )}>
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg border',
                isLaw
                  ? 'bg-gold/10 border-gold/30'
                  : 'bg-surface-300 border-surface-400'
              )}>
                <StatusIcon className={cn('h-4 w-4', isLaw ? 'text-gold' : 'text-surface-500')} />
              </div>
              <div>
                <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-surface-500">
                  Civic Report
                </p>
                <p className={cn('text-xs font-mono font-semibold', isLaw ? 'text-gold' : 'text-surface-400')}>
                  {statusCfg.label}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
              {topic.category && (
                <span className="text-[10px] font-mono text-surface-500 hidden sm:inline">
                  {topic.category}
                </span>
              )}
            </div>
          </div>

          {/* Topic statement */}
          <div className="px-6 pt-5 pb-4">
            <h1 className="font-mono text-xl md:text-2xl font-bold text-white leading-snug">
              {topic.statement}
            </h1>

            {topic.description && (
              <p className="mt-3 text-sm font-mono text-surface-400 leading-relaxed">
                {topic.description}
              </p>
            )}
          </div>

          {/* Vote split visualization */}
          <div className="px-6 pb-5">
            <div className="bg-surface-200 rounded-xl border border-surface-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold text-for-400 flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  FOR
                </span>
                <span className="text-[11px] font-mono text-surface-500">
                  {fmtVotes(totalVotes)} total votes
                </span>
                <span className="text-xs font-mono font-semibold text-against-400 flex items-center gap-1.5">
                  AGAINST
                  <ThumbsDown className="h-3.5 w-3.5" />
                </span>
              </div>

              {/* Bar */}
              <div className="h-3 rounded-full overflow-hidden flex mb-3">
                <div
                  className="bg-for-500 transition-all"
                  style={{ width: `${pct.for}%` }}
                />
                <div
                  className="bg-against-600 transition-all flex-1"
                />
              </div>

              {/* Percentages */}
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-for-400">{pct.for}%</p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                    {fmtVotes(forVotes)} votes
                  </p>
                </div>

                <div className="text-center">
                  {pct.for >= 60 ? (
                    <span className="text-[10px] font-mono text-for-400 border border-for-500/30 bg-for-500/10 px-2 py-0.5 rounded-full">
                      Strong Majority FOR
                    </span>
                  ) : pct.against >= 60 ? (
                    <span className="text-[10px] font-mono text-against-400 border border-against-500/30 bg-against-500/10 px-2 py-0.5 rounded-full">
                      Strong Majority AGAINST
                    </span>
                  ) : Math.abs(pct.for - 50) <= 5 ? (
                    <span className="text-[10px] font-mono text-surface-400 border border-surface-400/30 bg-surface-400/10 px-2 py-0.5 rounded-full">
                      Deadlocked
                    </span>
                  ) : pct.for > 50 ? (
                    <span className="text-[10px] font-mono text-for-400 border border-for-500/20 bg-for-500/5 px-2 py-0.5 rounded-full">
                      Leaning FOR
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-against-400 border border-against-500/20 bg-against-500/5 px-2 py-0.5 rounded-full">
                      Leaning AGAINST
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-against-400">{pct.against}%</p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                    {fmtVotes(againstVotes)} votes
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="px-6 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  icon: Users,
                  label: 'Total Votes',
                  value: fmtVotes(totalVotes),
                  color: 'text-for-400',
                },
                {
                  icon: BarChart2,
                  label: 'Arguments',
                  value: fmtVotes(allArgs.length),
                  color: 'text-purple',
                },
                {
                  icon: BookOpen,
                  label: 'Debates Held',
                  value: debateCount != null ? String(debateCount) : '—',
                  color: 'text-gold',
                },
                {
                  icon: ScopeIcon,
                  label: 'Scope',
                  value: topic.scope
                    ? topic.scope.charAt(0).toUpperCase() + topic.scope.slice(1)
                    : 'Global',
                  color: 'text-emerald',
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <div
                  key={label}
                  className="bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-center"
                >
                  <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', color)} />
                  <p className="text-base font-mono font-bold text-white">{value}</p>
                  <p className="text-[10px] font-mono text-surface-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="px-6 pb-5">
            <SectionLabel>Timeline</SectionLabel>

            <div className="space-y-2">
              {[
                {
                  icon: FileText,
                  label: 'Proposed',
                  date: topic.created_at,
                  color: 'text-surface-400',
                  dotColor: 'bg-surface-400',
                },
                ...(isLaw && lawRow
                  ? [{
                      icon: Gavel,
                      label: 'Established as Law',
                      date: lawRow.established_at,
                      color: 'text-gold',
                      dotColor: 'bg-gold',
                    }]
                  : []),
                {
                  icon: Calendar,
                  label: 'Last Activity',
                  date: topic.updated_at,
                  color: 'text-surface-500',
                  dotColor: 'bg-surface-500',
                },
              ].map(({ icon: Icon, label, date, color, dotColor }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                  <span className={cn('text-xs font-mono flex-1', color)}>{label}</span>
                  <span className="text-xs font-mono text-surface-500">{fmtDate(date)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Arguments FOR ─────────────────────────────────────────────────── */}
        <div className="mt-6">
          <SectionLabel>
            Top Arguments FOR ({forArgs.length}/{allArgs.filter(a => a.side === 'blue').length} shown)
          </SectionLabel>

          {forArgs.length > 0 ? (
            <div className="space-y-2">
              {forArgs.map((arg, i) => (
                <ArgumentRow key={arg.id} arg={arg} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center rounded-xl border border-surface-300 bg-surface-100">
              <ThumbsUp className="h-5 w-5 text-surface-600 mx-auto mb-2" />
              <p className="text-sm font-mono text-surface-500">No FOR arguments yet.</p>
              <Link
                href={`/topic/${params.id}#arguments`}
                className="inline-flex items-center gap-1 mt-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Add the first argument <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* ── Arguments AGAINST ──────────────────────────────────────────────── */}
        <div className="mt-6">
          <SectionLabel>
            Top Arguments AGAINST ({againstArgs.length}/{allArgs.filter(a => a.side === 'red').length} shown)
          </SectionLabel>

          {againstArgs.length > 0 ? (
            <div className="space-y-2">
              {againstArgs.map((arg, i) => (
                <ArgumentRow key={arg.id} arg={arg} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center rounded-xl border border-surface-300 bg-surface-100">
              <ThumbsDown className="h-5 w-5 text-surface-600 mx-auto mb-2" />
              <p className="text-sm font-mono text-surface-500">No AGAINST arguments yet.</p>
              <Link
                href={`/topic/${params.id}#arguments`}
                className="inline-flex items-center gap-1 mt-1 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
              >
                Add the first argument <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* ── Action footer ─────────────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/topic/${params.id}`}
            className={cn(
              'flex items-center justify-center gap-2 h-11 rounded-xl',
              'border font-mono text-sm font-semibold transition-all',
              isVotable
                ? 'bg-for-600 hover:bg-for-500 border-for-500/40 text-white'
                : 'bg-surface-200 hover:bg-surface-300 border-surface-300 text-surface-400'
            )}
          >
            {isVotable ? (
              <>
                <Scale className="h-4 w-4" />
                Cast Your Vote
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" />
                View Full Debate
              </>
            )}
          </Link>

          <Link
            href={`/topic/${params.id}/arguments`}
            className={cn(
              'flex items-center justify-center gap-2 h-11 rounded-xl',
              'border border-surface-300 bg-surface-200 hover:bg-surface-300',
              'font-mono text-sm font-semibold text-surface-400 hover:text-white transition-all'
            )}
          >
            <BarChart2 className="h-4 w-4" />
            All Arguments
          </Link>
        </div>

        {/* ── Related sub-pages ─────────────────────────────────────────────── */}
        <div className="mt-6">
          <SectionLabel>Deeper dives</SectionLabel>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'AI Brief',      href: `/topic/${params.id}/brief`,         icon: BookOpen  },
              { label: 'Stats',         href: `/topic/${params.id}/stats`,         icon: BarChart2 },
              { label: 'Score Card',    href: `/topic/${params.id}/scorecard`,     icon: Scale     },
              { label: 'Intelligence',  href: `/topic/${params.id}/intelligence`,  icon: Zap       },
              { label: 'Arguments',     href: `/topic/${params.id}/arguments`,     icon: ThumbsUp  },
              ...(debateCount ? [{ label: 'Debates', href: `/topic/${params.id}/debates`, icon: BookOpen }] : []),
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl',
                  'border border-surface-300 bg-surface-100 hover:bg-surface-200',
                  'text-xs font-mono text-surface-400 hover:text-white transition-all'
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-surface-500" />
                {label}
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Print hint + footer ───────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <PrintButton />

          <p className="text-[10px] font-mono text-surface-600 text-center">
            Generated by Lobby Market · {topicUrl}
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
