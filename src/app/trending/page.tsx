import type { Metadata } from 'next'
import Link from 'next/link'
import {
  TrendingUp,
  Flame,
  Gavel,
  Mic,
  ArrowRight,
  Users,
  Eye,
  Zap,
  Scale,
  Clock,
  ChevronRight,
  GitFork,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { Topic, Law, Profile } from '@/lib/supabase/types'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Trending · Lobby Market',
  description:
    'The hottest topics, newest laws, and upcoming debates — what the Lobby is talking about right now.',
  openGraph: {
    title: 'Trending · Lobby Market',
    description: 'What the Lobby is debating right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function futureTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Starting now'
  const m = Math.round(diff / 60000)
  const h = Math.round(m / 60)
  const d = Math.round(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  if (d < 7) return `in ${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; variant: 'proposed' | 'active' | 'law' | 'failed' }
> = {
  proposed: { label: 'Proposed', dot: 'bg-surface-400', variant: 'proposed' },
  active:   { label: 'Active',   dot: 'bg-for-500',     variant: 'active' },
  voting:   { label: 'Voting',   dot: 'bg-purple',      variant: 'active' },
  law:      { label: 'LAW',      dot: 'bg-gold',        variant: 'law' },
  failed:   { label: 'Failed',   dot: 'bg-against-500', variant: 'failed' },
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  quick: '15m',
  grand: '45m',
  tribunal: '60m',
}

// ─── Topic Row Card ───────────────────────────────────────────────────────────

interface TopicWithAuthor extends Topic {
  author?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null
}

function TrendingTopicCard({
  topic,
  rank,
}: {
  topic: TopicWithAuthor
  rank: number
}) {
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const signal = getTopicSignal(topic)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex items-start gap-4 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-200/60',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
      )}
    >
      {/* Rank */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
          'font-mono text-sm font-bold',
          rank <= 3
            ? 'bg-gold/10 border border-gold/30 text-gold'
            : 'bg-surface-200 border border-surface-300 text-surface-500'
        )}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Statement */}
        <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors mb-2">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <div className="h-1 w-full rounded-full overflow-hidden bg-surface-300 mb-2">
          <div className="flex h-full">
            <div
              className="bg-for-500 h-full transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="bg-against-500 h-full transition-all duration-500"
              style={{ width: `${againstPct}%` }}
            />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider',
              'px-1.5 py-0.5 rounded',
              topic.status === 'active'
                ? 'bg-for-500/20 text-for-300 border border-for-500/30'
                : topic.status === 'voting'
                ? 'bg-purple/20 text-purple border border-purple/30'
                : topic.status === 'law'
                ? 'bg-gold/20 text-gold border border-gold/30'
                : 'bg-surface-200 text-surface-500 border border-surface-300'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full inline-block', cfg.dot)} />
            {cfg.label}
          </span>

          {/* Votes */}
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" />
            {topic.total_votes.toLocaleString()}
          </span>

          {/* Views */}
          {topic.view_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Eye className="h-3 w-3" />
              {topic.view_count.toLocaleString()}
            </span>
          )}

          {/* Category */}
          {topic.category && (
            <span className="text-[11px] font-mono text-surface-500 truncate">
              {topic.category}
            </span>
          )}

          {/* Relevance signal */}
          {signal && (() => {
            const classes = SIGNAL_PILL_CLASSES[signal.color]
            return (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  classes.pill,
                )}
                title={signal.description}
              >
                <span className={cn('h-1 w-1 rounded-full', classes.dot)} aria-hidden="true" />
                {signal.label}
              </span>
            )
          })()}

          {/* For/against */}
          <span className="ml-auto text-[11px] font-mono">
            <span className="text-for-400">{forPct}%</span>
            <span className="text-surface-500 mx-1">/</span>
            <span className="text-against-400">{againstPct}%</span>
          </span>
        </div>
      </div>

      <ChevronRight
        className="flex-shrink-0 h-4 w-4 text-surface-500 mt-1 group-hover:text-surface-300 transition-colors"
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── Recent Law Card ──────────────────────────────────────────────────────────

function RecentLawCard({ law }: { law: Law }) {
  const bluePct = Math.round(law.blue_pct ?? 0)
  const winPct = bluePct >= 50 ? bluePct : 100 - bluePct
  const sideLabel = bluePct >= 50 ? 'FOR' : 'AGAINST'
  const sideColor = bluePct >= 50 ? 'text-for-400' : 'text-against-400'

  return (
    <Link
      href={`/law/${law.id}`}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-emerald/40 hover:bg-emerald/[0.03]',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50'
      )}
    >
      <Gavel className="flex-shrink-0 h-4 w-4 text-emerald mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn('text-[10px] font-mono font-bold', sideColor)}>
            {sideLabel} {winPct}%
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            · {relativeTime(law.established_at)}
          </span>
          {law.category && (
            <span className="text-[10px] font-mono text-surface-500 truncate">
              · {law.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Debate Row Card ──────────────────────────────────────────────────────────

interface TrendingDebate {
  id: string
  title: string
  status: string
  scheduled_at: string
  type: string
  viewer_count: number
  topic: Pick<Topic, 'id' | 'statement' | 'category'> | null
}

function DebateRow({ debate }: { debate: TrendingDebate }) {
  const isLive = debate.status === 'live'

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-xl',
        'bg-surface-100 border border-surface-300',
        isLive
          ? 'hover:border-against-500/40 hover:bg-against-500/[0.03]'
          : 'hover:border-for-500/40 hover:bg-for-500/[0.03]',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isLive ? (
          <span className="relative flex h-3 w-3 mt-0.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-against-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-against-500" />
          </span>
        ) : (
          <Mic className="h-4 w-4 text-for-400" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {debate.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {isLive ? (
            <span className="text-[10px] font-mono font-bold text-against-400 uppercase tracking-wider">
              Live now
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {futureTime(debate.scheduled_at)}
            </span>
          )}
          {debate.type && (
            <span className="text-[10px] font-mono text-surface-500">
              · {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
            </span>
          )}
          {debate.viewer_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Eye className="h-3 w-3" />
              {debate.viewer_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  description,
  href,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  href?: string
  iconClass: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5">
        <Icon className={cn('h-4 w-4', iconClass)} aria-hidden="true" />
        <div>
          <h2 className="font-mono text-base font-bold text-white">{title}</h2>
          {description && (
            <p className="text-[11px] font-mono text-surface-500 mt-0">{description}</p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-mono text-surface-500',
            'hover:text-surface-300 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50 rounded'
          )}
          aria-label={`See all ${title}`}
        >
          See all
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Pulse Stats ─────────────────────────────────────────────────────────────

function PulseStat({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: number
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
      </div>
      <span className={cn('text-xl font-mono font-bold', color)}>{value.toLocaleString()}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TrendingPage() {
  const supabase = await createClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Parallel fetches
  const [
    hotTopicsRes,
    risingTopicsRes,
    recentLawsRes,
    upcomingDebatesRes,
  ] = await Promise.all([
    // Hot: active/voting topics by feed_score
    supabase
      .from('topics')
      .select('*')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(12),

    // Rising: recently created proposed topics with support momentum
    supabase
      .from('topics')
      .select('*')
      .eq('status', 'proposed')
      .gte('created_at', sevenDaysAgo)
      .order('support_count', { ascending: false })
      .limit(6),

    // New laws in last 30 days
    supabase
      .from('laws')
      .select('*')
      .gte('established_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('established_at', { ascending: false })
      .limit(8),

    // Upcoming + live debates
    supabase
      .from('debates')
      .select('id, title, status, scheduled_at, type, viewer_count, topic_id')
      .in('status', ['live', 'scheduled'])
      .order('status', { ascending: true }) // 'live' sorts before 'scheduled'
      .order('scheduled_at', { ascending: true })
      .limit(5),
  ])

  const hotTopics = (hotTopicsRes.data ?? []) as Topic[]
  const risingTopics = (risingTopicsRes.data ?? []) as Topic[]
  const recentLaws = (recentLawsRes.data ?? []) as Law[]
  const rawDebates = upcomingDebatesRes.data ?? []

  // Enrich debates with topic titles
  const debateTopicIds = Array.from(new Set(rawDebates.map((d) => d.topic_id as string)))
  const topicsForDebatesRes = debateTopicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category')
        .in('id', debateTopicIds)
    : { data: [] as Pick<Topic, 'id' | 'statement' | 'category'>[] }

  const topicMap = new Map<string, Pick<Topic, 'id' | 'statement' | 'category'>>()
  for (const t of topicsForDebatesRes.data ?? []) {
    topicMap.set(t.id, t as Pick<Topic, 'id' | 'statement' | 'category'>)
  }

  const debates: TrendingDebate[] = rawDebates.map((d) => ({
    id: d.id as string,
    title: d.title as string,
    status: d.status as string,
    scheduled_at: d.scheduled_at as string,
    type: d.type as string,
    viewer_count: (d.viewer_count as number) ?? 0,
    topic: topicMap.get(d.topic_id as string) ?? null,
  }))

  // Enrich topics with author profiles
  const allTopics = [...hotTopics, ...risingTopics]
  const authorIds = Array.from(new Set(allTopics.map((t) => t.author_id)))
  const authorsRes = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds)
    : { data: [] as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>[] }

  const authorMap = new Map<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
  >()
  for (const a of authorsRes.data ?? []) {
    authorMap.set(
      a.id,
      a as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>
    )
  }

  const hotTopicsEnriched: TopicWithAuthor[] = hotTopics.map((t) => ({
    ...t,
    author: authorMap.get(t.author_id) ?? null,
  }))

  const risingTopicsEnriched: TopicWithAuthor[] = risingTopics.map((t) => ({
    ...t,
    author: authorMap.get(t.author_id) ?? null,
  }))

  // Pulse stats
  const liveDebateCount = debates.filter((d) => d.status === 'live').length
  const scheduledDebateCount = debates.filter((d) => d.status === 'scheduled').length

  const isEmpty =
    hotTopics.length === 0 &&
    risingTopics.length === 0 &&
    recentLaws.length === 0 &&
    debates.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Flame className="h-5 w-5 text-against-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white leading-tight">
                Trending
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                What the Lobby is debating right now
              </p>
            </div>
          </div>
          <Link
            href="/"
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
              'bg-surface-200 border border-surface-300 text-surface-400',
              'hover:bg-surface-300 hover:text-white transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
            )}
          >
            Full Feed
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* ── Pulse stats ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <PulseStat
            icon={Zap}
            value={hotTopics.length}
            label="Hot Topics"
            color="text-for-400"
          />
          <PulseStat
            icon={TrendingUp}
            value={risingTopics.length}
            label="Rising"
            color="text-purple"
          />
          <PulseStat
            icon={Gavel}
            value={recentLaws.length}
            label="New Laws"
            color="text-emerald"
          />
          <PulseStat
            icon={Mic}
            value={liveDebateCount + scheduledDebateCount}
            label="Debates"
            color="text-against-400"
          />
        </div>

        {isEmpty ? (
          /* ── Empty state ─────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-against-500/10 border border-against-500/30">
              <Flame className="h-8 w-8 text-against-400" />
            </div>
            <div>
              <p className="font-mono font-semibold text-white text-lg">
                Nothing trending yet
              </p>
              <p className="text-sm text-surface-500 font-mono mt-1 max-w-xs">
                Be the first to propose a topic and kick off the conversation.
              </p>
            </div>
            <Link
              href="/topic/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400"
            >
              Propose a Topic
            </Link>
          </div>
        ) : (
          /* ── Main two-column layout ───────────────────────────── */
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left: Topics ─────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-8">
              {/* Hot Topics */}
              {hotTopicsEnriched.length > 0 && (
                <section aria-labelledby="hot-topics-heading">
                  <SectionHeader
                    icon={Flame}
                    title="Hot Topics"
                    description="Active debates ranked by momentum"
                    href="/?status=active"
                    iconClass="text-against-400"
                  />
                  <div className="space-y-2">
                    {hotTopicsEnriched.map((topic, idx) => (
                      <TrendingTopicCard
                        key={topic.id}
                        topic={topic}
                        rank={idx + 1}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Rising Proposals */}
              {risingTopicsEnriched.length > 0 && (
                <section aria-labelledby="rising-topics-heading">
                  <SectionHeader
                    icon={TrendingUp}
                    title="Rising"
                    description="New proposals gaining support this week"
                    href="/?status=proposed"
                    iconClass="text-purple"
                  />
                  <div className="space-y-2">
                    {risingTopicsEnriched.map((topic, idx) => (
                      <TrendingTopicCard
                        key={topic.id}
                        topic={topic}
                        rank={idx + 1}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Sidebar ─────────────────────────────────── */}
            <aside className="lg:w-80 flex-shrink-0 space-y-6" aria-label="Recent laws and debates">
              {/* New Laws */}
              {recentLaws.length > 0 && (
                <section aria-labelledby="new-laws-heading">
                  <SectionHeader
                    icon={Gavel}
                    title="New Laws"
                    description="Established in the last 30 days"
                    href="/law"
                    iconClass="text-emerald"
                  />
                  <div className="space-y-2">
                    {recentLaws.map((law) => (
                      <RecentLawCard key={law.id} law={law} />
                    ))}
                  </div>
                  <Link
                    href="/law"
                    className={cn(
                      'flex items-center justify-center gap-1.5 mt-3 py-2.5 rounded-lg',
                      'text-xs font-mono text-surface-500',
                      'bg-surface-100 border border-surface-300',
                      'hover:bg-surface-200 hover:text-surface-300 transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50'
                    )}
                  >
                    View Law Codex
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </section>
              )}

              {/* Upcoming & Live Debates */}
              {debates.length > 0 && (
                <section aria-labelledby="debates-heading">
                  <SectionHeader
                    icon={Mic}
                    title="Debates"
                    description={
                      liveDebateCount > 0
                        ? `${liveDebateCount} live now`
                        : 'Coming up'
                    }
                    href="/debate"
                    iconClass="text-against-400"
                  />
                  <div className="space-y-2">
                    {debates.map((debate) => (
                      <DebateRow key={debate.id} debate={debate} />
                    ))}
                  </div>
                  <Link
                    href="/debate"
                    className={cn(
                      'flex items-center justify-center gap-1.5 mt-3 py-2.5 rounded-lg',
                      'text-xs font-mono text-surface-500',
                      'bg-surface-100 border border-surface-300',
                      'hover:bg-surface-200 hover:text-surface-300 transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                    )}
                  >
                    All Debates
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </section>
              )}

              {/* Quick nav */}
              <nav
                aria-label="Explore more"
                className="bg-surface-100 border border-surface-300 rounded-xl p-4"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  Explore
                </p>
                <div className="space-y-0.5">
                  {[
                    { href: '/surge', label: 'Surge', icon: Flame },
                    { href: '/digest', label: 'Weekly Digest', icon: Calendar },
                    { href: '/split', label: 'The Split', icon: GitFork },
                    { href: '/topic/categories', label: 'Browse Categories', icon: Scale },
                    { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
                    { href: '/floor', label: 'The Floor', icon: Gavel },
                    { href: '/lobby', label: 'Lobbies', icon: Users },
                    { href: '/coalitions', label: 'Coalitions', icon: Users },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-lg',
                        'text-xs font-mono text-surface-500',
                        'hover:text-white hover:bg-surface-200 transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                </div>
              </nav>
            </aside>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
