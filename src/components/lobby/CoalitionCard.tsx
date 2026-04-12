import Link from 'next/link'
import { Crown, Trophy, Users } from 'lucide-react'
import type { Coalition, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

type CoalitionWithMaybeCreator = Coalition & {
  creator?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface CoalitionCardProps {
  coalition: CoalitionWithMaybeCreator
}

export function CoalitionCard({ coalition }: CoalitionCardProps) {
  const totalMatches = coalition.wins + coalition.losses
  const winRate =
    totalMatches > 0 ? Math.round((coalition.wins / totalMatches) * 100) : 0

  return (
    <Link
      href={`/coalitions/${coalition.id}`}
      className={cn(
        'group block rounded-xl bg-surface-100 border border-surface-300 p-5',
        'hover:border-purple/40 hover:bg-purple/[0.03]',
        'transition-all duration-200'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple/10 border border-purple/30 text-purple flex-shrink-0">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-mono text-sm font-semibold text-white truncate group-hover:text-purple transition-colors">
              {coalition.name}
            </h3>
            <p className="font-mono text-[10px] text-surface-500 truncate">
              @{coalition.creator?.username ?? 'anonymous'}
            </p>
          </div>
        </div>
        {totalMatches > 0 && (
          <div
            className={cn(
              'flex-shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold',
              winRate >= 50
                ? 'bg-emerald/10 text-emerald'
                : 'bg-against-500/10 text-against-400'
            )}
          >
            {winRate}% W
          </div>
        )}
      </div>

      {coalition.description && (
        <p className="mt-3 font-mono text-xs text-surface-600 line-clamp-3 leading-relaxed">
          {coalition.description}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-surface-300/60 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="flex items-center gap-1 text-surface-500">
          <Users className="h-3 w-3" />
          <span className="tabular-nums text-surface-700">
            {coalition.member_count.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1 text-emerald">
          <Trophy className="h-3 w-3" />
          <span className="tabular-nums">{coalition.wins}</span>
          <span className="text-surface-500">/</span>
          <span className="tabular-nums text-against-400">
            {coalition.losses}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gold justify-end">
          <Crown className="h-3 w-3" />
          <span className="tabular-nums">
            {Math.round(coalition.coalition_influence).toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  )
}
