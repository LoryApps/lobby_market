import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Link2,
  Loader2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Loader2,
  },
  complete: {
    label: 'Complete',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: CheckCircle2,
  },
  voted: {
    label: 'Voted',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Trophy,
  },
} as const

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Relays · Lobby Market' }

  const name = profile.display_name ?? profile.username
  const title = `${name}'s Civic Relays · Lobby Market`
  const description = `See the civic relay chains ${name} has started and contributed to on Lobby Market.`
  const ogImageUrl = `${BASE_URL}/api/og/profile/${encodeURIComponent(profile.username)}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl] },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileRelaysPage({ params }: PageProps) {
  const supabase = await createClient()

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // Auth user (for self-detection)
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const isOwnProfile = authUser?.id === profile.id

  // Relays this user started
  const { data: startedRelays } = await supabase
    .from('civic_relays')
    .select(`
      id,
      side,
      status,
      max_legs,
      vote_compelling,
      vote_not_compelling,
      created_at,
      completed_at,
      topics(id, statement, category)
    `)
    .eq('starter_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30)

  // Relay legs this user has written (excluding their own started relays)
  const { data: legRows } = await supabase
    .from('relay_legs')
    .select(`
      id,
      relay_id,
      leg_number,
      content,
      created_at,
      civic_relays(id, side, status, starter_id, vote_compelling, vote_not_compelling, topics(id, statement, category))
    `)
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30)

  // Filter out legs that belong to relays the user also started
  const startedRelayIds = new Set((startedRelays ?? []).map((r) => r.id))
  const contributedLegs = (legRows ?? []).filter(
    (l) => !startedRelayIds.has(l.relay_id),
  )

  // Stats
  const totalStarted = (startedRelays ?? []).length
  const totalCompleted = (startedRelays ?? []).filter(
    (r) => r.status === 'complete' || r.status === 'voted',
  ).length
  const totalLegs = (legRows ?? []).length
  const totalCompelling = (startedRelays ?? [])
    .filter((r) => r.status === 'voted')
    .reduce((s, r) => s + (r.vote_compelling ?? 0), 0)

  const displayName = profile.display_name ?? profile.username
  const hasActivity = totalStarted > 0 || totalLegs > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href={`/profile/${profile.username}`}
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <Avatar
                src={profile.avatar_url ?? undefined}
                fallback={displayName}
                size="sm"
              />
              <div className="min-w-0">
                <h1 className="font-mono text-xl font-bold text-white truncate">
                  {displayName}&rsquo;s Relays
                </h1>
                <p className="text-xs font-mono text-surface-500">
                  Civic relay chains — collaborative argument building
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/leaderboard/relay"
            className="mt-1 flex items-center gap-1.5 rounded-xl bg-purple/10 border border-purple/30 text-purple text-xs font-mono font-semibold px-3 py-2 hover:bg-purple/20 transition-colors flex-shrink-0"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Rankings</span>
          </Link>
        </div>

        {/* Stats summary */}
        {hasActivity && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Relays Started', value: totalStarted, icon: Link2, color: 'text-purple' },
              { label: 'Completed', value: totalCompleted, icon: CheckCircle2, color: 'text-emerald' },
              { label: 'Legs Written', value: totalLegs, icon: MessageSquare, color: 'text-for-400' },
              { label: 'Compelling Votes', value: totalCompelling, icon: ThumbsUp, color: 'text-gold' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-surface-300 bg-surface-100 p-3"
              >
                <s.icon className={cn('h-4 w-4 mb-1', s.color)} />
                <p className="text-lg font-mono font-bold text-white">{s.value}</p>
                <p className="text-[10px] font-mono text-surface-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasActivity && (
          <EmptyState
            icon={Link2}
            title={
              isOwnProfile
                ? 'You haven\'t joined any relays yet'
                : `${displayName} hasn't joined any relays yet`
            }
            description={
              isOwnProfile
                ? 'Relays are collaborative argument chains — up to 5 citizens build a case together. Head to /relay to start or join one.'
                : 'No relay contributions yet.'
            }
            action={isOwnProfile ? { label: 'Browse Relays', href: '/relay' } : undefined}
          />
        )}

        {/* Relays Started */}
        {(startedRelays ?? []).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple" />
                Relays Started
                <span className="text-surface-500 font-normal normal-case tracking-normal">
                  ({(startedRelays ?? []).length})
                </span>
              </h2>
            </div>
            <div className="space-y-2">
              {(startedRelays ?? []).map((relay) => {
                const topic = relay.topics as { id: string; statement: string; category: string | null } | null
                const statusCfg = STATUS_CONFIG[relay.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open
                const StatusIcon = statusCfg.icon
                const totalVotes = (relay.vote_compelling ?? 0) + (relay.vote_not_compelling ?? 0)
                const compellingPct = totalVotes > 0
                  ? Math.round(((relay.vote_compelling ?? 0) / totalVotes) * 100)
                  : null

                return (
                  <Link
                    key={relay.id}
                    href={`/relay`}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border transition-all',
                      'bg-surface-100 border-surface-300 hover:border-surface-400 group',
                    )}
                  >
                    {/* Side indicator */}
                    <div className={cn(
                      'mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold',
                      relay.side === 'for'
                        ? 'bg-for-500/15 text-for-400 border border-for-500/30'
                        : 'bg-against-500/15 text-against-400 border border-against-500/30',
                    )}>
                      {relay.side === 'for' ? 'FOR' : 'AGN'}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Topic */}
                      {topic && (
                        <p className="text-sm font-mono text-white group-hover:text-for-400 transition-colors line-clamp-2 leading-snug">
                          {topic.statement}
                        </p>
                      )}
                      {!topic && (
                        <p className="text-sm font-mono text-surface-500 italic">Topic removed</p>
                      )}

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Status */}
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-full px-2 py-0.5',
                          statusCfg.badge ?? `${statusCfg.bg} ${statusCfg.color}`,
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>

                        {/* Compelling rate */}
                        {compellingPct !== null && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                            <ThumbsUp className="h-3 w-3" />
                            {compellingPct}% compelling
                          </span>
                        )}

                        {/* Category */}
                        {topic?.category && (
                          <span className="text-[10px] font-mono text-surface-500">
                            {topic.category}
                          </span>
                        )}

                        {/* Time */}
                        <span className="text-[10px] font-mono text-surface-500 ml-auto">
                          {relativeTime(relay.created_at)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Relay Legs Contributed */}
        {contributedLegs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Link2 className="h-4 w-4 text-for-400" />
                Relay Legs Contributed
                <span className="text-surface-500 font-normal normal-case tracking-normal">
                  ({contributedLegs.length})
                </span>
              </h2>
            </div>
            <div className="space-y-2">
              {contributedLegs.map((leg) => {
                const relay = leg.civic_relays as {
                  id: string
                  side: string
                  status: string
                  vote_compelling: number
                  vote_not_compelling: number
                  topics: { id: string; statement: string; category: string | null } | null
                } | null

                if (!relay) return null

                const topic = relay.topics
                const statusCfg = STATUS_CONFIG[relay.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open
                const StatusIcon = statusCfg.icon
                const totalVotes = (relay.vote_compelling ?? 0) + (relay.vote_not_compelling ?? 0)
                const compellingPct = totalVotes > 0
                  ? Math.round(((relay.vote_compelling ?? 0) / totalVotes) * 100)
                  : null

                return (
                  <Link
                    key={leg.id}
                    href={`/relay`}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border transition-all',
                      'bg-surface-100 border-surface-300 hover:border-surface-400 group',
                    )}
                  >
                    {/* Leg number badge */}
                    <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg bg-for-500/10 border border-for-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-for-400">
                      L{leg.leg_number}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Topic */}
                      {topic && (
                        <p className="text-sm font-mono text-white group-hover:text-for-400 transition-colors line-clamp-1 leading-snug">
                          {topic.statement}
                        </p>
                      )}
                      {!topic && (
                        <p className="text-sm font-mono text-surface-500 italic">Topic removed</p>
                      )}

                      {/* Leg content preview */}
                      <p className="text-xs font-mono text-surface-500 line-clamp-2 mt-1 leading-relaxed">
                        &ldquo;{leg.content}&rdquo;
                      </p>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-full px-2 py-0.5',
                          `${statusCfg.bg} ${statusCfg.color}`,
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>

                        {compellingPct !== null && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                            {relay.vote_compelling > relay.vote_not_compelling
                              ? <ThumbsUp className="h-3 w-3 text-emerald" />
                              : <ThumbsDown className="h-3 w-3 text-against-400" />
                            }
                            {compellingPct}% compelling
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-surface-500">
                          {relay.side === 'for' ? 'FOR' : 'AGAINST'}
                        </span>

                        <span className="text-[10px] font-mono text-surface-500 ml-auto">
                          {relativeTime(leg.created_at)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* CTA to relay hub */}
        {hasActivity && (
          <div className="rounded-2xl border border-purple/30 bg-purple/5 p-5 text-center space-y-2">
            <Link2 className="h-7 w-7 text-purple mx-auto" />
            <p className="text-sm font-mono font-semibold text-white">
              Join another relay
            </p>
            <p className="text-xs font-mono text-surface-500">
              Collaborative chains carry more weight than solo arguments.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/relay"
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple/20 border border-purple/30 text-purple text-xs font-mono font-semibold px-4 py-2 hover:bg-purple/30 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" />
                Browse Relays
              </Link>
              <Link
                href="/leaderboard/relay"
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono font-semibold px-4 py-2 hover:bg-surface-300 transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                Rankings
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
