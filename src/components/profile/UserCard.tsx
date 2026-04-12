import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge, getRoleRingClass } from './RoleBadge'
import type { Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface UserCardProps {
  profile: Pick<
    Profile,
    | 'id'
    | 'username'
    | 'display_name'
    | 'avatar_url'
    | 'role'
    | 'reputation_score'
    | 'is_influencer'
  >
  className?: string
}

export function UserCard({ profile, className }: UserCardProps) {
  const displayName = profile.display_name || profile.username
  const ring = getRoleRingClass(profile.role)

  return (
    <Link
      href={`/profile/${profile.username}`}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3',
        'hover:border-for-500/40 hover:bg-surface-200 transition-colors',
        className
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-surface-100',
          ring
        )}
      >
        <Avatar
          src={profile.avatar_url}
          fallback={displayName}
          size="md"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-white">
            {displayName}
          </span>
          {profile.is_influencer && (
            <span className="text-gold text-xs">★</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
          <span className="truncate">@{profile.username}</span>
          <RoleBadge role={profile.role} size="sm" />
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-white">
            {Math.round(profile.reputation_score).toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            rep
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-500 transition-colors" />
      </div>
    </Link>
  )
}
