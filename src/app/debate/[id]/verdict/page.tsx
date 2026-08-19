/**
 * /debate/[id]/verdict — Official Debate Verdict
 *
 * A single-page summary of a concluded debate. Combines:
 *   - Winner poll (audience vote: FOR / AGAINST / Tie)
 *   - Sway margin (how much opinion shifted during the debate)
 *   - Speaker performance snapshot
 *   - Best argument of the debate
 *   - Navigation to detailed sub-pages
 *
 * Server-rendered: verdict data never changes for ended debates.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  BarChart2,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  MessageSquare,
  Mic,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import { VerdictShare } from './VerdictShare'

interface PageProps {
  params: { id: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('title, status, topic_id')
    .eq('id', params.id)
    .single()

  if (!debate) return { title: 'Debate Verdict · Lobby Market' }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement')
    .eq('id', debate.topic_id)
    .maybeSingle()

  const title = `Verdict: ${debate.title ?? topic?.statement ?? 'Debate'} · Lobby Market`
  const description = topic
    ? `Official verdict for the debate on "${topic.statement}" — see who won, the sway margin, and the best argument.`
    : 'Official verdict for this Lobby Market debate.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const secs = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  )
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

const TYPE_LABEL: Record<string, string> = {
  quick: 'Quick Debate',
  grand: 'Grand Debate',
  tribunal: 'Tribunal',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatBlock({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  accent?: 'blue' | 'red' | 'gold' | 'emerald'
}) {
  const accentClass =
    accent === 'blue'
      ? 'text-for-400'
      : accent === 'red'
      ? 'text-against-400'
      : accent === 'gold'
      ? 'text-gold'
      : accent === 'emerald'
      ? 'text-emerald'
      : 'text-white'

  return (
    <div className="flex flex-col gap-1 p-3.5 rounded-xl bg-surface-200/50 border border-surface-300/50">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-surface-500" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">{label}</span>
      </div>
      <span className={cn('text-2xl font-bold font-mono tabular-nums leading-tight', accentClass)}>
        {value}
      </span>
      {sub && <span className="text-[11px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

function SpeakerRow({
  username,
  displayName,
  avatarUrl,
  side,
  messageCount,
  argumentCount,
  totalUpvotes,
  bestArgument,
  swayPct,
  isWinner,
}: {
  username: string
  displayName: string | null
  avatarUrl: string | null
  side: 'blue' | 'red'
  messageCount: number
  argumentCount: number
  totalUpvotes: number
  bestArgument: { content: string; upvotes: number } | null
  swayPct: number
  isWinner: boolean
}) {
  const isBlue = side === 'blue'

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        isBlue ? 'bg-for-950/40 border-for-800/30' : 'bg-against-950/40 border-against-800/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar src={avatarUrl} fallback={displayName || username} size="md" />
          {isWinner && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gold flex items-center justify-center">
              <Crown className="h-2.5 w-2.5 text-black" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${username}`}
              className="text-sm font-semibold text-white hover:underline truncate"
            >
              {displayName || username}
            </Link>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold',
                isBlue ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400'
              )}
            >
              {isBlue ? 'FOR' : 'AGAINST'}
            </span>
            {isWinner && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold bg-gold/20 text-gold">
                Winner
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">@{username}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Messages', value: String(messageCount) },
          { label: 'Arguments', value: String(argumentCount) },
          { label: 'Upvotes', value: String(totalUpvotes) },
        ].map(({ label, value }) => (
          <div key={label} className="text-center rounded-lg bg-surface-200/40 p-2">
            <p className="text-base font-bold font-mono text-white tabular-nums">{value}</p>
            <p className="text-[10px] font-mono text-surface-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Sway */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">Sway</span>
        <div className="flex-1 h-1.5 bg-surface-300/40 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', isBlue ? 'bg-for-500' : 'bg-against-500')}
            style={{ width: `${Math.min(100, Math.max(0, swayPct))}%` }}
          />
        </div>
        <span className={cn('text-[11px] font-mono font-bold tabular-nums', isBlue ? 'text-for-400' : 'text-against-400')}>
          {swayPct.toFixed(1)}%
        </span>
      </div>

      {/* Best argument */}
      {bestArgument && (
        <div className={cn(
          'rounded-xl border px-3 py-2.5',
          isBlue ? 'bg-for-500/5 border-for-500/20' : 'bg-against-500/5 border-against-500/20'
        )}>
          <div className="flex items-center gap-1.5 mb-1">
            <Award className="h-3 w-3 text-gold" />
            <span className="text-[10px] font-mono text-gold uppercase tracking-wider">Best argument</span>
            <span className="ml-auto text-[10px] font-mono text-surface-500">
              +{bestArgument.upvotes}
            </span>
          </div>
          <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-3">
            &ldquo;{bestArgument.content}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DebateVerdictPage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = params

  // ── Core debate data
  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, type, status, blue_sway, red_sway, started_at, ended_at, topic_id, creator_id, viewer_count, description')
    .eq('id', id)
    .single()

  if (!debate || debate.status !== 'ended') notFound()

  // ── Parallel fetch: topic + participants + messages + winner poll
  const [topicRes, participantsRes, messagesRes, pollRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes')
      .eq('id', debate.topic_id)
      .maybeSingle(),

    supabase
      .from('debate_participants')
      .select('user_id, side, is_speaker')
      .eq('debate_id', id)
      .eq('is_speaker', true),

    supabase
      .from('debate_messages')
      .select('id, side, is_argument, upvotes, user_id, content, created_at')
      .eq('debate_id', id),

    supabase
      .from('debate_winner_polls')
      .select('winner')
      .eq('debate_id', id),
  ])

  const topic = topicRes.data
  const participants = participantsRes.data ?? []
  const messages = messagesRes.data ?? []
  const pollRows = pollRes.data ?? []

  // ── Winner poll tally
  const pollCounts = { blue: 0, red: 0, tie: 0 }
  for (const row of pollRows) {
    const w = row.winner as 'blue' | 'red' | 'tie'
    pollCounts[w] = (pollCounts[w] ?? 0) + 1
  }
  const pollTotal = pollRows.length
  const pollWinner =
    pollCounts.blue > pollCounts.red && pollCounts.blue > pollCounts.tie
      ? 'blue'
      : pollCounts.red > pollCounts.blue && pollCounts.red > pollCounts.tie
      ? 'red'
      : 'tie'

  // ── Fetch speaker profiles
  const speakerIds = participants.map((p) => p.user_id)
  const profilesRes =
    speakerIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', speakerIds)
      : { data: [] }

  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  )

  // ── Per-speaker stats
  type SpeakerStats = {
    user_id: string
    side: 'blue' | 'red'
    message_count: number
    argument_count: number
    total_upvotes: number
    best_argument: { content: string; upvotes: number } | null
    sway_pct: number
  }

  const speakerStats: SpeakerStats[] = participants.map((p) => {
    const mine = messages.filter((m) => m.user_id === p.user_id)
    const args = mine.filter((m) => m.is_argument)
    const upvotes = mine.reduce((acc, m) => acc + (m.upvotes ?? 0), 0)
    const best = args.reduce<{ content: string; upvotes: number } | null>((acc, m) => {
      if (!acc || (m.upvotes ?? 0) > acc.upvotes) {
        return { content: m.content ?? '', upvotes: m.upvotes ?? 0 }
      }
      return acc
    }, null)

    const totalSway = (debate.blue_sway ?? 0) + (debate.red_sway ?? 0)
    const mySway = p.side === 'blue' ? (debate.blue_sway ?? 0) : (debate.red_sway ?? 0)
    const swayPct = totalSway > 0 ? (mySway / totalSway) * 100 : 50

    return {
      user_id: p.user_id,
      side: p.side as 'blue' | 'red',
      message_count: mine.length,
      argument_count: args.length,
      total_upvotes: upvotes,
      best_argument: best,
      sway_pct: swayPct,
    }
  })

  // ── Determine winner from sway (for no-poll fallback)
  const swayWinner =
    (debate.blue_sway ?? 0) > (debate.red_sway ?? 0)
      ? 'blue'
      : (debate.red_sway ?? 0) > (debate.blue_sway ?? 0)
      ? 'red'
      : 'tie'

  // Primary winner: poll if enough votes, else sway
  const winner = pollTotal >= 3 ? pollWinner : swayWinner

  const totalMessages = messages.length
  const totalArguments = messages.filter((m) => m.is_argument).length
  const duration = formatDuration(debate.started_at, debate.ended_at)

  // ── Share URL
  const shareUrl = `https://lobby.market/debate/${id}/verdict`

  // ── Sub-navigation tabs
  const tabs = [
    { label: 'Clash Card', href: `/debate/${id}/clash`, icon: Swords },
    { label: 'Audience', href: `/debate/${id}/audience`, icon: Users },
    { label: 'Verdict Census', href: `/debate/${id}/verdict-census`, icon: BarChart2 },
    { label: 'Performance', href: `/debate/${id}/performance`, icon: BarChart2 },
    { label: 'Highlights', href: `/debate/${id}/highlights`, icon: Award },
    { label: 'Transcript', href: `/debate/${id}/transcript`, icon: MessageSquare },
    { label: 'Recap', href: `/debate/${id}/recap`, icon: Scale },
  ]

  const pollBluePct = pollTotal > 0 ? Math.round((pollCounts.blue / pollTotal) * 100) : null
  const pollRedPct = pollTotal > 0 ? Math.round((pollCounts.red / pollTotal) * 100) : null
  const swayTotal = (debate.blue_sway ?? 0) + (debate.red_sway ?? 0)
  const swayMargin = swayTotal > 0
    ? Math.abs((debate.blue_sway ?? 0) - (debate.red_sway ?? 0))
    : 0

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24 space-y-5">
        {/* ── Back + share ── */}
        <div className="flex items-center justify-between">
          <Link
            href={`/debate/${id}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>
          <VerdictShare
            title={debate.title ?? 'Debate Verdict'}
            url={shareUrl}
          />
        </div>

        {/* ── Header ── */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-surface-200/60 border border-surface-300/50 text-surface-400">
              <Mic className="h-2.5 w-2.5 mr-1" />
              {TYPE_LABEL[debate.type] ?? debate.type}
            </span>
            <span className="text-xs font-mono text-surface-500">
              {formatDate(debate.ended_at ?? debate.started_at)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white leading-snug mb-1">
            {debate.title ?? 'Untitled Debate'}
          </h1>
          {topic && (
            <Link
              href={`/topic/${topic.id}`}
              className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              {topic.statement}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* ── Verdict banner ── */}
        <div
          className={cn(
            'rounded-2xl border p-5 text-center relative overflow-hidden',
            winner === 'blue'
              ? 'bg-for-950/60 border-for-700/40'
              : winner === 'red'
              ? 'bg-against-950/60 border-against-700/40'
              : 'bg-surface-200/60 border-surface-400/40'
          )}
        >
          {/* Ambient glow */}
          <div
            className={cn(
              'absolute inset-0 opacity-10 blur-3xl pointer-events-none',
              winner === 'blue' ? 'bg-for-500' : winner === 'red' ? 'bg-against-500' : 'bg-surface-400'
            )}
          />

          <div className="relative z-10">
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-2">
              Official Verdict
            </p>

            {winner === 'tie' ? (
              <>
                <Scale className="h-10 w-10 mx-auto text-surface-400 mb-2" />
                <p className="text-2xl font-black font-mono text-white">Tie</p>
                <p className="text-xs font-mono text-surface-500 mt-1">
                  The debate ended without a clear winner
                </p>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    'mx-auto mb-3 h-14 w-14 rounded-full flex items-center justify-center',
                    winner === 'blue' ? 'bg-for-500/20 border border-for-500/40' : 'bg-against-500/20 border border-against-500/40'
                  )}
                >
                  {winner === 'blue' ? (
                    <ThumbsUp className="h-7 w-7 text-for-400" />
                  ) : (
                    <ThumbsDown className="h-7 w-7 text-against-400" />
                  )}
                </div>
                <p
                  className={cn(
                    'text-3xl font-black font-mono',
                    winner === 'blue' ? 'text-for-400' : 'text-against-400'
                  )}
                >
                  {winner === 'blue' ? 'FOR' : 'AGAINST'}
                </p>
                <p className="text-xs font-mono text-surface-500 mt-1">
                  {winner === 'blue' ? 'The FOR side carried this debate' : 'The AGAINST side carried this debate'}
                </p>
              </>
            )}

            {/* Winner poll bar */}
            {pollTotal > 0 && pollBluePct !== null && pollRedPct !== null && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-for-400 tabular-nums w-8 text-right">{pollBluePct}%</span>
                  <div className="flex-1 h-2 bg-surface-300/40 rounded-full overflow-hidden flex">
                    <div className="h-full bg-for-500 rounded-l-full" style={{ width: `${pollBluePct}%` }} />
                    {pollCounts.tie > 0 && (
                      <div className="h-full bg-surface-400" style={{ width: `${Math.round((pollCounts.tie / pollTotal) * 100)}%` }} />
                    )}
                    <div className="h-full bg-against-500 rounded-r-full flex-1" />
                  </div>
                  <span className="text-[10px] font-mono text-against-400 tabular-nums w-8">{pollRedPct}%</span>
                </div>
                <p className="text-[10px] font-mono text-surface-600">
                  {pollTotal} audience vote{pollTotal !== 1 ? 's' : ''}
                  {pollCounts.tie > 0 && ` · ${pollCounts.tie} tie`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatBlock
            icon={Users}
            label="Viewers"
            value={(debate.viewer_count ?? 0).toLocaleString()}
            sub="watched live"
          />
          <StatBlock
            icon={Clock}
            label="Duration"
            value={duration}
            sub={formatDate(debate.ended_at ?? null)}
          />
          <StatBlock
            icon={MessageSquare}
            label="Arguments"
            value={String(totalArguments)}
            sub={`of ${totalMessages} messages`}
          />
          <StatBlock
            icon={BarChart2}
            label="Sway margin"
            value={swayMargin > 0 ? `+${swayMargin.toFixed(1)}` : '0'}
            sub="opinion shift"
            accent={swayWinner === 'blue' ? 'blue' : swayWinner === 'red' ? 'red' : undefined}
          />
        </div>

        {/* ── Sway breakdown ── */}
        {swayTotal > 0 && (
          <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-3">Sway breakdown</p>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono text-for-400 tabular-nums w-12 text-right">
                {((debate.blue_sway ?? 0) / swayTotal * 100).toFixed(1)}%
              </span>
              <div className="flex-1 h-3 bg-surface-300/40 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-for-500 rounded-l-full transition-all"
                  style={{ width: `${((debate.blue_sway ?? 0) / swayTotal) * 100}%` }}
                />
                <div className="h-full bg-against-500 flex-1 rounded-r-full" />
              </div>
              <span className="text-xs font-mono text-against-400 tabular-nums w-12">
                {((debate.red_sway ?? 0) / swayTotal * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] font-mono text-for-500">FOR sway</span>
              <span className="text-[10px] font-mono text-against-500">AGAINST sway</span>
            </div>
          </div>
        )}

        {/* ── Speaker cards ── */}
        {speakerStats.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-surface-500">Speakers</p>
            {speakerStats.map((s) => {
              const profile = profileMap.get(s.user_id)
              if (!profile) return null
              const isWinner =
                winner !== 'tie' &&
                ((winner === 'blue' && s.side === 'blue') || (winner === 'red' && s.side === 'red'))

              return (
                <SpeakerRow
                  key={s.user_id}
                  username={profile.username}
                  displayName={profile.display_name}
                  avatarUrl={profile.avatar_url}
                  side={s.side}
                  messageCount={s.message_count}
                  argumentCount={s.argument_count}
                  totalUpvotes={s.total_upvotes}
                  bestArgument={s.best_argument}
                  swayPct={s.sway_pct}
                  isWinner={isWinner}
                />
              )
            })}
          </div>
        )}

        {/* ── Explore more ── */}
        <div className="rounded-2xl border border-surface-300/50 bg-surface-200/40 overflow-hidden">
          <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500 px-4 pt-4 pb-2">
            Explore this debate
          </p>
          <div className="divide-y divide-surface-300/30">
            {tabs.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-300/30 transition-colors"
              >
                <Icon className="h-4 w-4 text-surface-500" />
                <span className="text-sm font-mono text-surface-600 hover:text-white transition-colors flex-1">
                  {label}
                </span>
                <ChevronRight className="h-4 w-4 text-surface-600" />
              </Link>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
