import Link from 'next/link'
import { Clock, Users, Calendar, Mic } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
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
  const blueSpeaker = participants.find(
    (p) => p.side === 'blue' && p.is_speaker
  )
  const redSpeaker = participants.find(
    (p) => p.side === 'red' && p.is_speaker
  )

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'group block rounded-xl p-5 transition-all duration-200',
        'bg-surface-100 border border-surface-300',
        isLive
          ? 'hover:border-against-500/50 hover:bg-against-500/[0.03]'
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
    </Link>
  )
}
