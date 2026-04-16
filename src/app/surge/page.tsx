import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Flame,
  Gavel,
  LayoutGrid,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { SurgeTopic } from '@/app/api/topics/surge/route'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Surge · Lobby Market',
  description:
    'Topics hitting critical mass right now — about to activate, in final voting hours, or gaining rapid momentum.',
  openGraph: {
    title: 'Surge · Lobby Market',
    description: 'Where the Lobby needs your voice most right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Surge · Lobby Market',
    description: 'Where the Lobby needs your voice most right now.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'closing now'
  const totalMinutes = Math.floor(diff / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m left`
  if (h < 24) return m > 0 ? `${h}h ${m}m left` : `${h}h left`
  const d = Math.floor(h / 24)
  return `${d}d left`
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

function categoryColor(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  title: string
  subtitle: string
  href?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
            iconColor,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-mono text-base font-bold text-white leading-tight">
            {title}
          </h2>
          <p className="text-xs font-mono text-surface-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className={cn(
            'flex items-center gap-1 text-[11px] font-mono text-surface-500',
            'hover:text-white transition-colors flex-shrink-0 mt-1',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50 rounded'
          )}
        >
          See all <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// ── Near-Activation Card ──────────────────────────────────────────────────────

function NearActivationCard({ topic }: { topic: SurgeTopic }) {
  const pct = Math.min(
    100,
    Math.round((topic.support_count / Math.max(1, topic.activation_threshold)) * 100),
  )
  const remaining = Math.max(0, topic.activation_threshold - topic.support_count)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border border-surface-300 bg-surface-100',
        'p-4 hover:border-for-500/40 hover:bg-surface-200/60',
        'transition-all duration-200 group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
          {STATUS_LABEL[topic.status] ?? topic.status}
        </Badge>
        {topic.category && (
          <span
            className={cn('text-[10px] font-mono font-medium flex-shrink-0', categoryColor(topic.category))}
          >
            {topic.category}
          </span>
        )}
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2 group-hover:text-for-200 transition-colors">
        {topic.statement}
      </p>

      {/* Support progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span className="text-for-400 font-semibold">
            {topic.support_count.toLocaleString()} supporters
          </span>
          <span>
            {remaining === 0
              ? 'Threshold reached!'
              : `${remaining.toLocaleString()} needed`}
          </span>
        </div>
        <div
          className="relative h-2 w-full rounded-full bg-surface-300 overflow-hidden"
          role="progressbar"
          aria-valuenow={topic.support_count}
          aria-valuemax={topic.activation_threshold}
          aria-label={`${pct}% of activation threshold reached`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-for-700 to-for-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span>{pct}% of activation threshold</span>
          <span className="text-for-500 font-semibold">{topic.activation_threshold.toLocaleString()} goal</span>
        </div>
      </div>
    </Link>
  )
}

// ── Final Countdown Card ──────────────────────────────────────────────────────

function FinalCountdownCard({ topic }: { topic: SurgeTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const countdown = topic.voting_ends_at ? relativeCountdown(topic.voting_ends_at) : null
  const isClose = Math.abs(forPct - 50) <= 10

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border bg-surface-100',
        isClose ? 'border-gold/40 hover:border-gold/60' : 'border-surface-300 hover:border-against-500/40',
        'p-4 transition-all duration-200 group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <Badge variant="active">Voting</Badge>
        {countdown && (
          <span
            className={cn(
              'flex items-center gap-1 text-[10px] font-mono font-semibold flex-shrink-0',
              isClose ? 'text-gold' : 'text-against-400',
            )}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {countdown}
          </span>
        )}
      </div>

      <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2 group-hover:text-for-200 transition-colors">
        {topic.statement}
      </p>

      {/* Vote split bar */}
      <div className="space-y-1.5">
        <div className="relative h-2.5 w-full rounded-full overflow-hidden bg-surface-300">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-for-700 to-for-500 transition-all"
            style={{ width: `${forPct}%` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-against-600 transition-all"
            style={{ width: `${againstPct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-surface-500">{formatVotes(topic.total_votes)} votes</span>
          <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
        </div>
      </div>

      {topic.category && (
        <p className={cn('text-[10px] font-mono mt-2', categoryColor(topic.category))}>
          {topic.category}
        </p>
      )}
    </Link>
  )
}

// ── High Velocity Card ────────────────────────────────────────────────────────

function HighVelocityCard({ topic, rank }: { topic: SurgeTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-surface-300 bg-surface-100',
        'p-4 hover:border-for-500/30 hover:bg-surface-200/60',
        'transition-all duration-200 group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
      )}
    >
      {/* Rank badge */}
      <div
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-mono font-bold',
          rank === 1
            ? 'bg-gold/15 text-gold'
            : rank === 2
            ? 'bg-surface-400/20 text-surface-600'
            : rank === 3
            ? 'bg-against-500/10 text-against-400'
            : 'bg-surface-200 text-surface-500',
        )}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant={STATUS_BADGE[topic.status] ?? 'active'}>
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono', categoryColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>

        <p className="text-sm font-mono text-white leading-snug mb-2 group-hover:text-for-200 transition-colors line-clamp-2">
          {topic.statement}
        </p>

        {/* Compact vote bar */}
        <div className="space-y-1">
          <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-surface-300">
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-for-500"
              style={{ width: `${forPct}%` }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-y-0 right-0 rounded-r-full bg-against-600"
              style={{ width: `${againstPct}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
            <span className="text-for-400">{forPct}%</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
              {formatVotes(topic.total_votes)} votes
            </span>
            <span className="text-against-400">{againstPct}%</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100/50 p-8 text-center">
      <p className="text-sm font-mono text-surface-500">{message}</p>
    </div>
  )
}

const TOPIC_COLS =
  'id, statement, category, status, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, feed_score, scope, created_at'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SurgePage() {
  const supabase = await createClient()

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const nowIso = now.toISOString()

  const [nearRes, countdownRes, velocityRes] = await Promise.all([
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'proposed')
      .gt('support_count', 0)
      .order('support_count', { ascending: false })
      .limit(50),
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'voting')
      .gt('voting_ends_at', nowIso)
      .lte('voting_ends_at', in24h)
      .order('voting_ends_at', { ascending: true })
      .limit(12),
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .in('status', ['active', 'voting'])
      .gt('total_votes', 0)
      .order('feed_score', { ascending: false })
      .limit(20),
  ])

  const nearActivation: SurgeTopic[] = (
    (nearRes.data as SurgeTopic[] | null) ?? []
  )
    .filter(
      (t) =>
        t.activation_threshold > 0 &&
        t.support_count / t.activation_threshold >= 0.6,
    )
    .sort(
      (a, b) =>
        b.support_count / b.activation_threshold -
        a.support_count / a.activation_threshold,
    )
    .slice(0, 8)

  const finalCountdown: SurgeTopic[] =
    (countdownRes.data as SurgeTopic[] | null) ?? []

  const countdownIds = new Set(finalCountdown.map((t) => t.id))
  const highVelocity: SurgeTopic[] = (
    (velocityRes.data as SurgeTopic[] | null) ?? []
  )
    .filter((t) => !countdownIds.has(t.id))
    .slice(0, 8)
  const totalTopics = nearActivation.length + finalCountdown.length + highVelocity.length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main
        id="main-content"
        className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12"
      >
        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Flame className="h-5 w-5 text-against-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
                Surge
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Where the Lobby needs your voice most right now
              </p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-against-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-against-500" />
            </span>
            <span className="text-xs font-mono text-surface-500">
              {totalTopics > 0
                ? `${totalTopics} topic${totalTopics !== 1 ? 's' : ''} need attention`
                : 'Checking for activity…'}
            </span>
          </div>
        </header>

        {/* ── Near Activation ─────────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="near-activation-heading">
          <SectionHeader
            icon={Zap}
            iconColor="bg-for-500/15 text-for-400"
            title="Near Activation"
            subtitle="Proposed topics close to their support threshold — a few more votes unlocks debate"
            href="/topic/categories"
          />

          {nearActivation.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nearActivation.map((topic) => (
                <NearActivationCard key={topic.id} topic={topic} />
              ))}
            </div>
          ) : (
            <EmptySection message="No topics approaching activation right now. Propose one and rally support!" />
          )}
        </section>

        {/* ── Final Countdown ──────────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="final-countdown-heading">
          <SectionHeader
            icon={Clock}
            iconColor="bg-gold/15 text-gold"
            title="Final Countdown"
            subtitle="Voting closes in under 24 hours — these topics are about to become law or fail"
            href="/split"
          />

          {finalCountdown.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {finalCountdown.map((topic) => (
                <FinalCountdownCard key={topic.id} topic={topic} />
              ))}
            </div>
          ) : (
            <EmptySection message="No topics closing in the next 24 hours. Check The Split for contested votes." />
          )}
        </section>

        {/* ── High Velocity ────────────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="high-velocity-heading">
          <SectionHeader
            icon={TrendingUp}
            iconColor="bg-emerald/15 text-emerald"
            title="High Velocity"
            subtitle="Active topics gaining the most momentum right now"
            href="/trending"
          />

          {highVelocity.length > 0 ? (
            <div className="space-y-2">
              {highVelocity.map((topic, i) => (
                <HighVelocityCard key={topic.id} topic={topic} rank={i + 1} />
              ))}
            </div>
          ) : (
            <EmptySection message="No active topics right now. Be the first to propose one!" />
          )}
        </section>

        {/* ── Quick nav ────────────────────────────────────────────────────── */}
        <nav
          aria-label="Explore more"
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4"
        >
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
            More to Explore
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { href: '/trending', label: 'Trending', icon: TrendingUp },
              { href: '/split', label: 'The Split', icon: AlertTriangle },
              { href: '/floor', label: 'The Floor', icon: Gavel },
              { href: '/topic/categories', label: 'Categories', icon: LayoutGrid },
              { href: '/predictions', label: 'Predictions', icon: TrendingUp },
              { href: '/debate', label: 'Debates', icon: Users },
              { href: '/lobby', label: 'Lobbies', icon: Users },
              { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  'text-xs font-mono text-surface-500',
                  'hover:text-white hover:bg-surface-200 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </main>

      <BottomNav />
    </div>
  )
}
