import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Flame,
  MessageSquare,
  Mic,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Clock
}> = {
  scheduled: { label: 'Scheduled', color: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30', icon: Clock },
  live:      { label: 'LIVE',      color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: Flame },
  ended:     { label: 'Ended',     color: 'text-surface-500', bg: 'bg-surface-200/50', border: 'border-surface-300/40', icon: Timer },
  cancelled: { label: 'Cancelled', color: 'text-surface-600', bg: 'bg-surface-200/30', border: 'border-surface-300/20', icon: Scale },
}

// ─── Type config ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  quick:    'Quick',
  grand:    'Grand',
  tribunal: 'Tribunal',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface PageProps {
  params: { username: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Debates · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Debates · Lobby Market`
  const description = `${displayName}'s complete debate record on Lobby Market — every arena they've stepped into, their side, and the outcomes.`
  const ogImage = `${BASE_URL}/api/og/profile/${profile.username}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileDebatesPage({ params }: PageProps) {
  const supabase = await createClient()

  // Look up the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // Fetch this user's debate participations, joined with debate + topic data
  const { data: participations } = await supabase
    .from('debate_participants')
    .select(`
      id,
      side,
      is_speaker,
      joined_at,
      debate:debates (
        id,
        title,
        type,
        status,
        scheduled_at,
        started_at,
        ended_at,
        blue_sway,
        red_sway,
        viewer_count,
        topic:topics ( id, statement, category, status )
      )
    `)
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false })
    .limit(100)

  type ParticipationRow = {
    id: string
    side: 'blue' | 'red'
    is_speaker: boolean
    joined_at: string
    debate: {
      id: string
      title: string
      type: string
      status: string
      scheduled_at: string
      started_at: string | null
      ended_at: string | null
      blue_sway: number
      red_sway: number
      viewer_count: number
      topic: { id: string; statement: string; category: string | null; status: string } | null
    } | null
  }

  const rows = (participations as ParticipationRow[] | null) ?? []
  const validRows = rows.filter((r) => r.debate !== null)

  // For ended debates, fetch winner poll aggregates
  const endedDebateIds = validRows
    .filter((r) => r.debate?.status === 'ended')
    .map((r) => r.debate!.id)

  type PollAgg = { debate_id: string; blue_votes: number; red_votes: number; tie_votes: number }
  const pollMap = new Map<string, PollAgg>()

  if (endedDebateIds.length > 0) {
    const { data: polls } = await supabase
      .from('debate_winner_polls')
      .select('debate_id, winner')
      .in('debate_id', endedDebateIds)

    if (polls) {
      for (const poll of polls) {
        const existing = pollMap.get(poll.debate_id) ?? { debate_id: poll.debate_id, blue_votes: 0, red_votes: 0, tie_votes: 0 }
        if (poll.winner === 'blue') existing.blue_votes++
        else if (poll.winner === 'red') existing.red_votes++
        else existing.tie_votes++
        pollMap.set(poll.debate_id, existing)
      }
    }
  }

  // Per-debate message counts for this user
  const debateIds = validRows.map((r) => r.debate!.id)
  const msgCountMap = new Map<string, number>()
  const msgUpvoteMap = new Map<string, number>()

  if (debateIds.length > 0) {
    const { data: msgs } = await supabase
      .from('debate_messages')
      .select('debate_id, upvotes')
      .eq('user_id', profile.id)
      .in('debate_id', debateIds)

    if (msgs) {
      for (const msg of msgs) {
        msgCountMap.set(msg.debate_id, (msgCountMap.get(msg.debate_id) ?? 0) + 1)
        msgUpvoteMap.set(msg.debate_id, (msgUpvoteMap.get(msg.debate_id) ?? 0) + msg.upvotes)
      }
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalDebates = validRows.length
  const asBlue = validRows.filter((r) => r.side === 'blue').length
  const asRed = validRows.filter((r) => r.side === 'red').length
  const asSpeaker = validRows.filter((r) => r.is_speaker).length
  const endedRows = validRows.filter((r) => r.debate!.status === 'ended')

  // "Wins" = debates where the user's side won the winner poll majority
  const wins = endedRows.filter((r) => {
    const poll = pollMap.get(r.debate!.id)
    if (!poll) return false
    const totalPollVotes = poll.blue_votes + poll.red_votes + poll.tie_votes
    if (totalPollVotes < 3) return false // need meaningful sample
    if (r.side === 'blue') return poll.blue_votes > poll.red_votes && poll.blue_votes > poll.tie_votes
    return poll.red_votes > poll.blue_votes && poll.red_votes > poll.tie_votes
  }).length

  const totalMessages = Array.from(msgCountMap.values()).reduce((s, v) => s + v, 0)

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-2 text-surface-500 hover:text-white transition-colors text-sm font-mono mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar src={profile.avatar_url} fallback={displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white truncate">{displayName}</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              @{profile.username} · Debate Record
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-white">{totalDebates}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">debates</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className={cn('font-mono text-xl font-bold', wins > 0 ? 'text-gold' : 'text-surface-500')}>
              {wins}
            </div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">wins</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-purple">{asSpeaker}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">as speaker</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-emerald">{totalMessages}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">messages</div>
          </div>
        </div>

        {/* Side breakdown */}
        {totalDebates > 0 && (
          <div className="mb-6 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Sides Argued</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                <span className="font-mono text-sm font-semibold text-for-400">{asBlue}</span>
                <span className="text-xs font-mono text-surface-500">FOR</span>
              </div>
              <div className="flex-1 relative h-2 bg-surface-300 rounded-full overflow-hidden">
                {totalDebates > 0 && (
                  <>
                    <div
                      className="absolute left-0 top-0 h-full bg-for-500 rounded-l-full"
                      style={{ width: `${(asBlue / totalDebates) * 100}%` }}
                    />
                    <div
                      className="absolute right-0 top-0 h-full bg-against-500 rounded-r-full"
                      style={{ width: `${(asRed / totalDebates) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-semibold text-against-400">{asRed}</span>
                <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                <span className="text-xs font-mono text-surface-500">AGAINST</span>
              </div>
            </div>
          </div>
        )}

        {/* Debate list */}
        {validRows.length === 0 ? (
          <EmptyState
            icon={Swords}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No debates yet"
            description={`${displayName} has not participated in any debates on the platform.`}
            actions={[{ label: 'Browse debates', href: '/debate' }]}
          />
        ) : (
          <div className="space-y-3">
            {validRows.map((row) => {
              const debate = row.debate!
              const statusCfg = STATUS_CONFIG[debate.status] ?? STATUS_CONFIG.ended
              const StatusIcon = statusCfg.icon
              const msgCount = msgCountMap.get(debate.id) ?? 0
              const msgUpvotes = msgUpvoteMap.get(debate.id) ?? 0
              const poll = pollMap.get(debate.id)

              // Determine poll outcome for this user
              let outcomeLabel: string | null = null
              let outcomeColor = 'text-surface-500'
              if (poll && debate.status === 'ended') {
                const totalPollVotes = poll.blue_votes + poll.red_votes + poll.tie_votes
                if (totalPollVotes >= 3) {
                  const userSideWins = row.side === 'blue'
                    ? poll.blue_votes > poll.red_votes && poll.blue_votes > poll.tie_votes
                    : poll.red_votes > poll.blue_votes && poll.red_votes > poll.tie_votes
                  const isTie = poll.tie_votes >= poll.blue_votes && poll.tie_votes >= poll.red_votes

                  if (isTie) {
                    outcomeLabel = 'Draw'
                    outcomeColor = 'text-surface-400'
                  } else if (userSideWins) {
                    outcomeLabel = 'Win'
                    outcomeColor = 'text-emerald'
                  } else {
                    outcomeLabel = 'Loss'
                    outcomeColor = 'text-against-400'
                  }
                }
              }

              const dateStr = debate.ended_at
                ? formatDate(debate.ended_at)
                : debate.started_at
                  ? relativeTime(debate.started_at)
                  : formatDate(debate.scheduled_at)

              return (
                <Link
                  key={row.id}
                  href={`/debate/${debate.id}`}
                  className={cn(
                    'block rounded-xl border bg-surface-100 p-4 hover:bg-surface-200/60 transition-colors group',
                    row.side === 'blue' ? 'border-for-500/20' : 'border-against-500/20'
                  )}
                >
                  {/* Top row: title + status */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Swords className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
                      <p className="text-sm font-mono text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                        {debate.title}
                      </p>
                    </div>
                    <div className={cn(
                      'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border',
                      statusCfg.bg, statusCfg.border, statusCfg.color
                    )}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {statusCfg.label}
                    </div>
                  </div>

                  {/* Topic context */}
                  {debate.topic && (
                    <div className="flex items-center gap-1.5 mb-3 pl-6">
                      <Scale className="h-3 w-3 text-surface-600 flex-shrink-0" aria-hidden />
                      <span className="text-[11px] font-mono text-surface-500 truncate">
                        {debate.topic.statement.length > 70
                          ? debate.topic.statement.slice(0, 70) + '…'
                          : debate.topic.statement}
                      </span>
                      {debate.topic.category && (
                        <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">
                          · {debate.topic.category}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bottom row: meta */}
                  <div className="flex items-center gap-3 flex-wrap pl-6">
                    {/* Side pill */}
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                      row.side === 'blue'
                        ? 'bg-for-500/10 text-for-400 border-for-500/30'
                        : 'bg-against-500/10 text-against-400 border-against-500/30'
                    )}>
                      {row.side === 'blue' ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
                      {row.side === 'blue' ? 'FOR' : 'AGAINST'}
                    </span>

                    {/* Role: speaker vs audience */}
                    {row.is_speaker && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-purple/10 text-purple border-purple/30">
                        <Mic className="h-2.5 w-2.5" />
                        Speaker
                      </span>
                    )}

                    {/* Outcome */}
                    {outcomeLabel && (
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-mono font-semibold', outcomeColor)}>
                        {outcomeLabel === 'Win' && <Trophy className="h-2.5 w-2.5" />}
                        {outcomeLabel === 'Loss' && <ThumbsDown className="h-2.5 w-2.5" />}
                        {outcomeLabel === 'Draw' && <Scale className="h-2.5 w-2.5" />}
                        {outcomeLabel}
                      </span>
                    )}

                    {/* Type */}
                    <span className="text-[10px] font-mono text-surface-600">
                      {TYPE_LABEL[debate.type] ?? debate.type}
                    </span>

                    {/* Messages */}
                    {msgCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
                        <MessageSquare className="h-2.5 w-2.5" />
                        {msgCount} msg{msgCount !== 1 ? 's' : ''}
                        {msgUpvotes > 0 && (
                          <span className="text-emerald">· +{msgUpvotes}</span>
                        )}
                      </span>
                    )}

                    {/* Audience size */}
                    {debate.viewer_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-600">
                        <Users className="h-2.5 w-2.5" />
                        {debate.viewer_count}
                      </span>
                    )}

                    {/* Date */}
                    <span className="ml-auto text-[10px] font-mono text-surface-600 flex-shrink-0">
                      {dateStr}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination note */}
        {validRows.length >= 100 && (
          <p className="text-xs font-mono text-surface-600 text-center mt-6">
            Showing most recent 100 debates
          </p>
        )}

        {/* CTA footer */}
        {validRows.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-between">
            <Link
              href={`/profile/${profile.username}`}
              className="text-sm font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              ← Back to {displayName}&apos;s profile
            </Link>
            <Link
              href="/debate"
              className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Swords className="h-3.5 w-3.5" />
              Browse debates
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
