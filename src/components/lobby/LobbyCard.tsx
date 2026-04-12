import Link from 'next/link'
import { Megaphone, Users, Zap, Crown } from 'lucide-react'
import type { Lobby, LobbyPosition, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

type LobbyWithMaybeCreator = Lobby & {
  creator?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface LobbyCardProps {
  lobby: LobbyWithMaybeCreator
  showTopicLink?: boolean
  topicLabel?: string | null
}

const positionMeta: Record<
  LobbyPosition,
  { label: string; color: string; bg: string; border: string }
> = {
  for: {
    label: 'FOR',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  against: {
    label: 'AGAINST',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
}

export function LobbyCard({
  lobby,
  showTopicLink = false,
  topicLabel,
}: LobbyCardProps) {
  const meta = positionMeta[lobby.position]
  const creatorName =
    lobby.creator?.display_name ??
    lobby.creator?.username ??
    'anonymous'

  return (
    <Link
      href={`/lobby/${lobby.id}`}
      className={cn(
        'group block rounded-xl bg-surface-100 border border-surface-300',
        'p-5 transition-all duration-200',
        'hover:border-gold/40 hover:bg-gold/[0.03]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border flex-shrink-0',
              meta.bg,
              meta.border,
              meta.color
            )}
          >
            <Megaphone className="h-4 w-4" />
          </div>
          <h3 className="font-mono text-sm font-semibold text-white truncate group-hover:text-gold transition-colors">
            {lobby.name}
          </h3>
        </div>
        <div
          className={cn(
            'flex-shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold',
            meta.bg,
            meta.color
          )}
        >
          {meta.label}
        </div>
      </div>

      <p className="mt-3 font-mono text-xs text-surface-600 line-clamp-3 leading-relaxed">
        {lobby.campaign_statement}
      </p>

      <div className="mt-4 pt-3 border-t border-surface-300/60 flex items-center justify-between gap-2 font-mono text-[11px] text-surface-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <Crown className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">@{creatorName}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="tabular-nums">
              {lobby.member_count.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span className="tabular-nums">
              {Math.round(lobby.influence_score).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {showTopicLink && topicLabel && (
        <div className="mt-3 text-[10px] font-mono text-surface-500 uppercase tracking-wider">
          On: <span className="text-surface-700">{topicLabel}</span>
        </div>
      )}
    </Link>
  )
}
