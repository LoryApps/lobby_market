import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  MessageSquare,
  Scale,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
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
export const revalidate = 120

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportPageProps {
  params: { id: string }
}

interface FoundingArgument {
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
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Report · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 50)
  const stmt = law.statement ?? ''
  const title = `${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} — Law Report · Lobby Market`
  const desc =
    `Established Law · ${forPct}% For · ${(law.total_votes ?? 0).toLocaleString()} votes cast` +
    (law.category ? ` · ${law.category}` : '')

  return {
    title,
    description: desc,
    openGraph: {
      title: `Law Report: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`,
      description: desc,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `Law Report: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`,
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

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ArgumentRow({ arg, rank }: { arg: FoundingArgument; rank: number }) {
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

export default async function LawReportPage({ params }: ReportPageProps) {
  const supabase = await createClient()

  // ── Fetch law ────────────────────────────────────────────────────────────
  const { data: law } = await supabase
    .from('laws')
    .select(`
      id, topic_id, statement, full_statement, body_markdown, category,
      established_at, is_active, blue_pct, total_votes,
      wiki_content, wiki_updated_at, created_at, updated_at
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  // ── Fetch topic for additional context ───────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, description, scope, view_count, created_at')
    .eq('id', law.topic_id)
    .maybeSingle()

  // ── Fetch founding arguments (top FOR + AGAINST from original debate) ────
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(`
      id, content, side, upvotes, created_at,
      author:profiles!arguments_author_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `)
    .eq('topic_id', law.topic_id)
    .in('side', ['blue', 'red'])
    .order('upvotes', { ascending: false })
    .limit(20)

  const allArgs = (rawArgs ?? []) as FoundingArgument[]
  const forArgs = allArgs.filter((a) => a.side === 'blue').slice(0, 3)
  const againstArgs = allArgs.filter((a) => a.side === 'red').slice(0, 3)

  // ── Fetch top reviews ────────────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('law_reviews')
    .select('id, stars, body, created_at, user_id')
    .eq('law_id', params.id)
    .order('helpful', { ascending: false })
    .limit(3)

  const { count: reviewCount } = await supabase
    .from('law_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  const avgStars =
    reviews && reviews.length > 0
      ? reviews.reduce((s, r) => s + (r.stars ?? 0), 0) / reviews.length
      : null

  // ── Fetch debate count ────────────────────────────────────────────────────
  const { count: debateCount } = await supabase
    .from('debates')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', law.topic_id)

  // ── Fetch amendment count ─────────────────────────────────────────────────
  const { count: amendmentCount } = await supabase
    .from('law_amendments')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  // ── Derived values ────────────────────────────────────────────────────────
  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const totalVotes = law.total_votes ?? 0
  const forVotes = Math.round(totalVotes * (law.blue_pct ?? 50) / 100)
  const againstVotes = totalVotes - forVotes
  const daysActive = daysSince(law.established_at)
  const reportUrl = `https://lobby.market/law/${params.id}/report`
  const lawUrl = `https://lobby.market/law/${params.id}`

  // Consensus verdict
  const consensusLabel =
    forPct >= 75 ? 'Overwhelming Mandate' :
    forPct >= 60 ? 'Strong Majority' :
    forPct >= 55 ? 'Clear Majority' :
    forPct >= 50 ? 'Narrow Majority' :
    'Contested'
  const consensusColor =
    forPct >= 75 ? 'text-emerald' :
    forPct >= 60 ? 'text-for-400' :
    forPct >= 55 ? 'text-for-300' :
    forPct >= 50 ? 'text-for-200' :
    'text-against-400'
  const consensusBorder =
    forPct >= 75 ? 'border-emerald/30 bg-emerald/10' :
    forPct >= 60 ? 'border-for-500/30 bg-for-500/10' :
    forPct >= 50 ? 'border-for-500/20 bg-for-500/5' :
    'border-against-500/20 bg-against-500/5'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back nav ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/law/${params.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to law
          </Link>
          <div className="flex items-center gap-2">
            <SharePanel
              url={reportUrl}
              text={`Law Report: ${law.statement}`}
              lawId={params.id}
            />
          </div>
        </div>

        {/* ── Report card ───────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gold/30 bg-gold/5 overflow-hidden">

          {/* Header band */}
          <div className="px-6 py-4 border-b border-gold/20 bg-gold/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                <Gavel className="h-4 w-4 text-gold" />
              </div>
              <div>
                <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-surface-500">
                  Law Report
                </p>
                <p className="text-xs font-mono font-semibold text-gold">
                  Established Law
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="law">Law</Badge>
              {law.category && (
                <span className="text-[10px] font-mono text-surface-500 hidden sm:inline">
                  {law.category}
                </span>
              )}
            </div>
          </div>

          {/* Law statement */}
          <div className="px-6 pt-5 pb-4">
            <h1 className="font-mono text-xl md:text-2xl font-bold text-white leading-snug">
              {law.statement}
            </h1>
            {topic?.description && (
              <p className="mt-3 text-sm font-mono text-surface-400 leading-relaxed">
                {topic.description}
              </p>
            )}
            {law.body_markdown && !topic?.description && (
              <p className="mt-3 text-sm font-mono text-surface-400 leading-relaxed line-clamp-3">
                {law.body_markdown}
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
                <div className="bg-for-500 transition-all" style={{ width: `${forPct}%` }} />
                <div className="bg-against-600 flex-1" />
              </div>

              {/* Percentages + verdict */}
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-for-400">{forPct}%</p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                    {fmtVotes(forVotes)} votes
                  </p>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-mono border px-2 py-0.5 rounded-full',
                    consensusBorder, consensusColor
                  )}
                >
                  {consensusLabel}
                </span>
                <div className="text-center">
                  <p className="text-2xl font-mono font-bold text-against-400">{againstPct}%</p>
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
                  label: 'Votes Cast',
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
                  icon: Calendar,
                  label: 'Days Active',
                  value: daysActive.toLocaleString(),
                  color: 'text-emerald',
                },
                {
                  icon: FileText,
                  label: 'Amendments',
                  value: amendmentCount != null ? String(amendmentCount) : '0',
                  color: 'text-gold',
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
            <SectionLabel>Legislative history</SectionLabel>
            <div className="space-y-2">
              {[
                {
                  icon: FileText,
                  label: 'Proposed',
                  date: topic?.created_at ?? law.created_at,
                  color: 'text-surface-400',
                  dotColor: 'bg-surface-400',
                },
                {
                  icon: CheckCircle2,
                  label: 'Established as Law',
                  date: law.established_at,
                  color: 'text-gold',
                  dotColor: 'bg-gold',
                },
                ...(law.wiki_updated_at
                  ? [{
                      icon: BookOpen,
                      label: 'Wiki last updated',
                      date: law.wiki_updated_at,
                      color: 'text-emerald',
                      dotColor: 'bg-emerald',
                    }]
                  : []),
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

          {/* Law active status */}
          <div className="px-6 pb-5">
            <div
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-mono',
                law.is_active
                  ? 'border-emerald/30 bg-emerald/5 text-emerald'
                  : 'border-surface-400/30 bg-surface-300/10 text-surface-500'
              )}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  law.is_active ? 'bg-emerald animate-pulse' : 'bg-surface-500'
                )}
              />
              {law.is_active
                ? 'This law is currently active and in force'
                : 'This law has been superseded or repealed'}
            </div>
          </div>
        </div>

        {/* ── Wiki preview ──────────────────────────────────────────────────── */}
        {law.wiki_content && law.wiki_content.trim().length > 0 && (
          <div className="mt-6">
            <SectionLabel>Community wiki</SectionLabel>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-sm font-mono text-surface-300 leading-relaxed line-clamp-4">
                {law.wiki_content.trim().slice(0, 400)}
                {law.wiki_content.trim().length > 400 ? '…' : ''}
              </p>
              <Link
                href={`/law/${params.id}/wiki`}
                className="inline-flex items-center gap-1 mt-3 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
              >
                Read full wiki <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Community reviews ─────────────────────────────────────────────── */}
        {reviews && reviews.length > 0 && (
          <div className="mt-6">
            <SectionLabel>
              Community reviews
              {avgStars !== null && (
                <span className="ml-2 flex items-center gap-1 text-gold">
                  <Star className="h-3 w-3 fill-gold" />
                  {avgStars.toFixed(1)}
                  <span className="text-surface-500">
                    ({reviewCount ?? reviews.length} {(reviewCount ?? reviews.length) === 1 ? 'review' : 'reviews'})
                  </span>
                </span>
              )}
            </SectionLabel>
            <div className="space-y-2">
              {reviews.slice(0, 2).map((r) => (
                r.body ? (
                  <div
                    key={r.id}
                    className="rounded-xl border border-surface-300 bg-surface-100 p-4"
                  >
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'h-3 w-3',
                            i < r.stars ? 'text-gold fill-gold' : 'text-surface-600'
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-sm font-mono text-surface-300 leading-relaxed line-clamp-3">
                      {r.body}
                    </p>
                  </div>
                ) : null
              ))}
              <Link
                href={`/law/${params.id}/reviews`}
                className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                All reviews <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Founding arguments FOR ────────────────────────────────────────── */}
        <div className="mt-6">
          <SectionLabel>
            Founding arguments — FOR ({forArgs.length}/{allArgs.filter((a) => a.side === 'blue').length} shown)
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
              <p className="text-sm font-mono text-surface-500">No FOR arguments on record.</p>
            </div>
          )}
        </div>

        {/* ── Founding arguments AGAINST ────────────────────────────────────── */}
        <div className="mt-6">
          <SectionLabel>
            Founding arguments — AGAINST ({againstArgs.length}/{allArgs.filter((a) => a.side === 'red').length} shown)
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
              <p className="text-sm font-mono text-surface-500">No AGAINST arguments on record.</p>
            </div>
          )}
        </div>

        {/* ── Action footer ─────────────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href={`/law/${params.id}`}
            className={cn(
              'flex items-center justify-center gap-2 h-11 rounded-xl',
              'border font-mono text-sm font-semibold transition-all',
              'bg-gold/80 hover:bg-gold border-gold/40 text-white'
            )}
          >
            <Gavel className="h-4 w-4" />
            View Full Law
          </Link>
          <Link
            href={`/topic/${law.topic_id}`}
            className={cn(
              'flex items-center justify-center gap-2 h-11 rounded-xl',
              'border border-surface-300 bg-surface-200 hover:bg-surface-300',
              'font-mono text-sm font-semibold text-surface-400 hover:text-white transition-all'
            )}
          >
            <Scale className="h-4 w-4" />
            Original Debate
          </Link>
        </div>

        {/* ── Deeper dives ──────────────────────────────────────────────────── */}
        <div className="mt-6">
          <SectionLabel>Deeper dives</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Wiki',        href: `/law/${params.id}/wiki`,        icon: BookOpen     },
              { label: 'Arguments',   href: `/law/${params.id}/arguments`,   icon: BarChart2    },
              { label: 'Timeline',    href: `/law/${params.id}/timeline`,    icon: Calendar     },
              { label: 'Amendments',  href: `/law/${params.id}/amendments`,  icon: FileText     },
              { label: 'Reviews',     href: `/law/${params.id}/reviews`,     icon: Star         },
              { label: 'Verdict',     href: `/law/${params.id}/verdict`,     icon: CheckCircle2 },
              { label: 'Scorecard',   href: `/law/${params.id}/scorecard`,   icon: Scale        },
              ...(debateCount ? [{ label: 'Debates', href: `/law/${params.id}/debate`, icon: MessageSquare }] : []),
              { label: 'Global View', href: `/law/${params.id}/global`,      icon: Globe        },
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

        {/* ── Print + footer ────────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <PrintButton />
          <p className="text-[10px] font-mono text-surface-600 text-center">
            Generated by Lobby Market · {lawUrl}
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
