import Link from 'next/link'
import { Clock, Users, Calendar, Mic, Trophy } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { DebateRSVPButton } from '@/components/debate/DebateRSVPButton'
import { CalendarExportButton } from '@/components/debate/CalendarExportButton'
import type {
  DebateWithTopic,
  DebateParticipantWithProfile,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface DebateCardProps {
  debate: DebateWithTopic
  participants?: DebateParticipantWithProfile[]
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = d.getTime() - now
  const mins = Math.round(diff / 60000)
  const hours = Math.round(mins / 60)
  const days = Math.round(hours / 24)

  if (diff <= 0) return 'Starting now'
  if (mins < 60) return `in ${mins}m`
  if (hours < 24) return `in ${hours}h`
  if (days < 7) return `in ${days}d`
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const TYPE_LABEL: Record<string, string> = {
  quick: '15m · Quick',
  grand: '45m · Grand',
  tribunal: '60m · Tribunal',
}

export function DebateCard({ debate, participants = [] }: DebateCardProps) {
  const isLive = debate.status === 'live'
  const isEnded = debate.status === 'ended'
  const blueSpeaker = participants.find(
    (p) => p.side === 'blue' && p.is_speaker
  )
  const redSpeaker = participants.find(
    (p) => p.side === 'red' && p.is_speaker
  )

  const winner: 'blue' | 'red' | 'draw' | null = isEnded
    ? debate.blue_sway > debate.red_sway
      ? 'blue'
      : debate.red_sway > debate.blue_sway
        ? 'red'
        : 'draw'
    : null

  return (
    <Link
      href={isEnded ? `/debate/${debate.id}/recap` : `/debate/${debate.id}`}
      className={cn(
        'group block rounded-xl p-5 transition-all duration-200',
        'bg-surface-100 border border-surface-300',
        isLive
          ? 'hover:border-against-500/50 hover:bg-against-500/[0.03]'
          : isEnded
            ? 'hover:border-surface-400/50 hover:bg-surface-200/20'
            : 'hover:border-for-500/50 hover:bg-for-500/[0.03]'
      )}
    >
      {/* Top row: status + type */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-against-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
            </span>
            <span className="font-mono text-[10px] font-bold text-against-400 uppercase tracking-wider">
              Live
            </span>
          </div>
        ) : isEnded ? (
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3 w-3 text-gold" />
            <span className="font-mono text-[10px] font-bold text-gold uppercase tracking-wider">
              Ended
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Clock className="h-3 w-3" />
            <span>{formatTime(debate.scheduled_at)}</span>
          </div>
        )}
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
          {TYPE_LABEL[debate.type] ?? debate.type}
        </span>
      </div>

      {/* Title / topic */}
      <h3 className="font-mono text-base font-semibold text-white leading-snug line-clamp-2 mb-2">
        {debate.title}
      </h3>

      {debate.topic?.statement && (
        <p className="text-[12px] text-surface-500 leading-relaxed line-clamp-2 mb-4">
          {debate.topic.statement}
        </p>
      )}

      {/* Debaters */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-surface-300/60">
        <div className="flex items-center gap-2">
          {blueSpeaker?.profile ? (
            <Avatar
              src={blueSpeaker.profile.avatar_url}
              fallback={
                blueSpeaker.profile.display_name ??
                blueSpeaker.profile.username
              }
              size="sm"
              className="ring-2 ring-for-500/40"
            />
          ) : (
            <div className="h-8 w-8 rounded-full border-2 border-dashed border-for-500/30 flex items-center justify-center">
              <Mic className="h-3 w-3 text-for-500/50" />
            </div>
          )}
          <span className="text-[11px] font-mono text-surface-500">vs</span>
          {redSpeaker?.profile ? (
            <Avatar
              src={redSpeaker.profile.avatar_url}
              fallback={
                redSpeaker.profile.display_name ?? redSpeaker.profile.username
              }
              size="sm"
              className="ring-2 ring-against-500/40"
            />
          ) : (
            <div className="h-8 w-8 rounded-full border-2 border-dashed border-against-500/30 flex items-center justify-center">
              <Mic className="h-3 w-3 text-against-500/50" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{debate.viewer_count.toLocaleString()}</span>
          </div>
          {!isLive && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(debate.scheduled_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Ended: show sway result + recap CTA */}
      {isEnded && (
        <div className="mt-3 pt-3 border-t border-surface-300/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-mono text-for-400 font-bold">
              {debate.blue_sway}% FOR
            </span>
            {winner && winner !== 'draw' && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gold/20 text-gold">
                {winner === 'blue' ? 'FOR wins' : 'AGAINST wins'}
              </span>
            )}
            <span className="text-[11px] font-mono text-against-400 font-bold">
              {debate.red_sway}% AGAINST
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-200/40 overflow-hidden flex">
            <div
              className="h-full bg-for-600 rounded-l-full"
              style={{ width: `${debate.blue_sway}%` }}
            />
            <div
              className="h-full bg-against-600 rounded-r-full"
              style={{ width: `${debate.red_sway}%` }}
            />
          </div>
          <p className="text-[10px] font-mono text-surface-600 mt-2 text-center">
            View full recap →
          </p>
        </div>
      )}

      {/* RSVP + Calendar row — only for scheduled (not yet live) debates */}
      {!isLive && !isEnded && (
        <div className="mt-3 pt-3 border-t border-surface-300/40 flex items-center justify-between gap-2">
          <CalendarExportButton debateId={debate.id} size="sm" />
          <DebateRSVPButton debateId={debate.id} size="sm" />
        </div>
      )}
    </Link>
  )
}
