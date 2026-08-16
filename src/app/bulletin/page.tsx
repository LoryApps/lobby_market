import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Calendar,
  Flame,
  Gavel,
  Mic,
  Scale,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronRight,
  Radio,
  Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Bulletin · Lobby Market',
  description:
    'The real-time public board for civic activity — new laws, live debates, hot votes, and community milestones. Stay connected to the pulse of the Lobby.',
  openGraph: {
    title: 'Civic Bulletin · Lobby Market',
    description:
      'New laws, live debates, and hot votes across the Lobby — all in one public bulletin board.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Bulletin · Lobby Market',
    description: 'The Lobby\'s real-time board of civic events — laws, debates, and votes.',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function forPctBar({ blue_pct }: { blue_pct: number }) {
  const red = 100 - blue_pct
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className="text-for-400">{Math.round(blue_pct)}%</span>
      <div className="h-1.5 w-16 bg-surface-300 rounded-full overflow-hidden">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${blue_pct}%` }} />
      </div>
      <span className="text-against-400">{Math.round(red)}%</span>
    </div>
  )
}

// ─── Category badge ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Politics: 'text-for-400 bg-for-500/10 border-for-500/20',
  Technology: 'text-purple bg-purple/10 border-purple/20',
  Economics: 'text-gold bg-gold/10 border-gold/20',
  Ethics: 'text-emerald bg-emerald/10 border-emerald/20',
  Science: 'text-purple bg-purple/10 border-purple/20',
  Culture: 'text-against-400 bg-against-500/10 border-against-500/20',
  Education: 'text-for-400 bg-for-500/10 border-for-500/20',
  Environment: 'text-emerald bg-emerald/10 border-emerald/20',
  Health: 'text-against-400 bg-against-500/10 border-against-500/20',
  Philosophy: 'text-gold bg-gold/10 border-gold/20',
}

function CategoryChip({ cat }: { cat: string | null }) {
  if (!cat) return null
  const cls = CAT_COLORS[cat] ?? 'text-surface-500 bg-surface-300/30 border-surface-400/20'
  return (
    <span className={cn('inline-flex text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border', cls)}>
      {cat}
    </span>
  )
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHead({
  icon: Icon,
  label,
  count,
  color,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  color: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={cn('flex items-center justify-center h-7 w-7 rounded-lg', color)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold text-white">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-mono text-surface-500">{count}</span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
        >
          All <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Law card ────────────────────────────────────────────────────────────────

interface RecentLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number | null
  established_at: string
}

function LawCard({ law }: { law: RecentLaw }) {
  return (
    <Link
      href={`/law/${law.id}`}
      className={cn(
        'group block rounded-xl border bg-surface-100 p-4 transition-all duration-200',
        'border-emerald/20 hover:border-emerald/50 hover:bg-surface-200',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-lg bg-emerald/15 border border-emerald/25">
          <Gavel className="h-3.5 w-3.5 text-emerald" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
              {law.statement}
            </p>
            <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryChip cat={law.category} />
            <span className="text-[10px] font-mono text-emerald/70">
              {law.total_votes?.toLocaleString()} votes
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {timeAgo(law.established_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Vote card ────────────────────────────────────────────────────────────────

interface VotingTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  status: string
  updated_at: string
}

function VoteCard({ topic }: { topic: VotingTopic }) {
  const signal = getTopicSignal(topic)
  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group block rounded-xl border bg-surface-100 p-4 transition-all duration-200',
        'border-purple/20 hover:border-purple/50 hover:bg-surface-200',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-lg bg-purple/15 border border-purple/25">
          <Scale className="h-3.5 w-3.5 text-purple" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-purple transition-colors">
              {topic.statement}
            </p>
            <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryChip cat={topic.category} />
            {signal && (
              <span className={cn('inline-flex text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border', SIGNAL_PILL_CLASSES[signal.color].pill)}>
                {signal.label}
              </span>
            )}
            {forPctBar({ blue_pct: topic.blue_pct })}
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Debate card ─────────────────────────────────────────────────────────────

interface LiveDebate {
  id: string
  title: string
  status: string
  scheduled_at: string
  debate_type: string
  topic_id: string | null
}

function DebateCard({ debate }: { debate: LiveDebate }) {
  const isLive = debate.status === 'live'
  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'group block rounded-xl border bg-surface-100 p-4 transition-all duration-200',
        isLive
          ? 'border-against-400/30 hover:border-against-400/60 hover:bg-surface-200'
          : 'border-gold/20 hover:border-gold/50 hover:bg-surface-200',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-lg',
            isLive
              ? 'bg-against-500/15 border border-against-400/25'
              : 'bg-gold/15 border border-gold/25',
          )}
        >
          <Mic className={cn('h-3.5 w-3.5', isLive ? 'text-against-400' : 'text-gold')} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
              {debate.title}
            </p>
            {isLive && (
              <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-mono text-against-400 bg-against-500/15 border border-against-400/25 px-1.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
                debate.debate_type === 'grand'
                  ? 'text-gold bg-gold/10 border-gold/20'
                  : 'text-surface-500 bg-surface-300/30 border-surface-400/20',
              )}
            >
              {debate.debate_type}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {isLive ? 'Now' : timeAgo(debate.scheduled_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Active topic card ────────────────────────────────────────────────────────

function ActiveTopicCard({ topic }: { topic: VotingTopic }) {
  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex items-center gap-3 rounded-xl border bg-surface-100 p-3 transition-all duration-200',
        'border-for-600/20 hover:border-for-500/50 hover:bg-surface-200',
      )}
    >
      <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-for-600/15 border border-for-600/25">
        <TrendingUp className="h-3.5 w-3.5 text-for-400" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white line-clamp-1 group-hover:text-for-400 transition-colors">
          {topic.statement}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <CategoryChip cat={topic.category} />
          <span className="text-[10px] font-mono text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BulletinPage() {
  const supabase = await createClient()

  const now = new Date().toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const fourHoursAhead = new Date(Date.now() + 4 * 3600_000).toISOString()

  const [
    recentLawsRes,
    votingTopicsRes,
    liveDebatesRes,
    scheduledDebatesRes,
    activeTopicsRes,
  ] = await Promise.all([
    // Laws established in the last 7 days
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, established_at')
      .eq('status', 'law')
      .gte('established_at', sevenDaysAgo)
      .order('established_at', { ascending: false })
      .limit(6),

    // Topics currently in voting phase
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status, updated_at')
      .eq('status', 'voting')
      .order('total_votes', { ascending: false })
      .limit(6),

    // Currently live debates
    supabase
      .from('debates')
      .select('id, title, status, scheduled_at, debate_type, topic_id')
      .eq('status', 'live')
      .order('scheduled_at', { ascending: false })
      .limit(4),

    // Debates starting in the next 4 hours
    supabase
      .from('debates')
      .select('id, title, status, scheduled_at, debate_type, topic_id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now)
      .lte('scheduled_at', fourHoursAhead)
      .order('scheduled_at', { ascending: true })
      .limit(4),

    // Most active topics (highest vote count, currently active)
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status, updated_at')
      .eq('status', 'active')
      .order('total_votes', { ascending: false })
      .limit(5),

  ])

  const recentLaws = (recentLawsRes.data ?? []) as RecentLaw[]
  const votingTopics = (votingTopicsRes.data ?? []) as VotingTopic[]
  const liveDebates = (liveDebatesRes.data ?? []) as LiveDebate[]
  const scheduledDebates = (scheduledDebatesRes.data ?? []) as LiveDebate[]
  const activeTopics = (activeTopicsRes.data ?? []) as VotingTopic[]


  // All debates to show (live first, then upcoming)
  const allDebates = [...liveDebates, ...scheduledDebates].slice(0, 6)

  // Headline counts for the top strip
  const lawCount = recentLaws.length
  const voteCount = votingTopics.length
  const debateCount = liveDebates.length

  const hasContent = recentLaws.length > 0 || votingTopics.length > 0 || allDebates.length > 0 || activeTopics.length > 0

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="h-4 w-4 text-against-400" aria-hidden="true" />
              <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Live</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Civic Bulletin</h1>
            <p className="text-sm text-surface-500 mt-1">
              Platform-wide events, new laws, and active debates — updated in real time.
            </p>
          </div>

          {/* ── Quick stats strip ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              {
                icon: Gavel,
                label: 'New Laws',
                value: lawCount,
                sub: 'last 7 days',
                color: 'text-emerald',
                bg: 'bg-emerald/10 border-emerald/20',
              },
              {
                icon: Scale,
                label: 'In Voting',
                value: voteCount,
                sub: 'open now',
                color: 'text-purple',
                bg: 'bg-purple/10 border-purple/20',
              },
              {
                icon: Mic,
                label: 'Live Debates',
                value: debateCount,
                sub: 'happening now',
                color: 'text-against-400',
                bg: 'bg-against-500/10 border-against-400/20',
              },
            ].map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div
                key={label}
                className={cn('rounded-xl border p-4 text-center', bg, 'bg-surface-100')}
              >
                <Icon className={cn('h-5 w-5 mx-auto mb-1', color)} aria-hidden="true" />
                <div className={cn('text-2xl font-bold font-mono', color)}>{value}</div>
                <div className="text-[10px] font-semibold text-white mt-0.5">{label}</div>
                <div className="text-[9px] text-surface-500">{sub}</div>
              </div>
            ))}
          </div>

          {!hasContent && (
            <div className="text-center py-16 text-surface-500">
              <Activity className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">The Lobby is quiet right now. Check back soon.</p>
            </div>
          )}

          {/* ── Live Debates ─────────────────────────────────────────────── */}
          {allDebates.length > 0 && (
            <section className="mb-8" aria-labelledby="debates-heading">
              <SectionHead
                icon={Mic}
                label="Debates"
                count={allDebates.length}
                color="bg-against-500/15 border border-against-400/25 text-against-400"
                href="/debate"
              />
              <div className="space-y-2.5" id="debates-heading">
                {allDebates.map((d) => (
                  <DebateCard key={d.id} debate={d} />
                ))}
              </div>
            </section>
          )}

          {/* ── Topics in Voting ─────────────────────────────────────────── */}
          {votingTopics.length > 0 && (
            <section className="mb-8" aria-labelledby="voting-heading">
              <SectionHead
                icon={Scale}
                label="Open Votes"
                count={votingTopics.length}
                color="bg-purple/15 border border-purple/25 text-purple"
                href="/topics?status=voting"
              />
              <div className="space-y-2.5" id="voting-heading">
                {votingTopics.map((t) => (
                  <VoteCard key={t.id} topic={t} />
                ))}
              </div>
            </section>
          )}

          {/* ── Recent Laws ───────────────────────────────────────────────── */}
          {recentLaws.length > 0 && (
            <section className="mb-8" aria-labelledby="laws-heading">
              <SectionHead
                icon={Gavel}
                label="New Laws"
                count={recentLaws.length}
                color="bg-emerald/15 border border-emerald/25 text-emerald"
                href="/law"
              />
              <div className="space-y-2.5" id="laws-heading">
                {recentLaws.map((l) => (
                  <LawCard key={l.id} law={l} />
                ))}
              </div>
            </section>
          )}

          {/* ── Active Topics ─────────────────────────────────────────────── */}
          {activeTopics.length > 0 && (
            <section className="mb-8" aria-labelledby="active-heading">
              <SectionHead
                icon={TrendingUp}
                label="Trending Topics"
                count={activeTopics.length}
                color="bg-for-600/15 border border-for-600/25 text-for-400"
                href="/trending"
              />
              <div className="space-y-2" id="active-heading">
                {activeTopics.map((t) => (
                  <ActiveTopicCard key={t.id} topic={t} />
                ))}
              </div>
            </section>
          )}

          {/* ── Footer links ──────────────────────────────────────────────── */}
          <div className="pt-4 border-t border-surface-300">
            <p className="text-xs text-surface-500 text-center mb-4">Explore more civic activity</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { href: '/trending', label: 'Trending', icon: Flame },
                { href: '/timeline', label: 'Timeline', icon: Clock },
                { href: '/daily', label: 'Daily', icon: Calendar },
                { href: '/live', label: 'Live', icon: Activity },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2',
                    'text-xs font-medium text-surface-500 border-surface-300 bg-surface-100',
                    'hover:text-white hover:border-surface-400 hover:bg-surface-200 transition-all',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
