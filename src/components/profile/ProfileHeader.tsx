'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { UserPlus, UserCheck, Calendar, Settings } from 'lucide-react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { RoleBadge, getRoleRingClass } from './RoleBadge'
import { ReputationMeter } from './ReputationMeter'
import type { Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface ProfileHeaderProps {
  profile: Profile
  isOwner: boolean
}

function formatJoinDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function ProfileHeader({ profile, isOwner }: ProfileHeaderProps) {
  const [following, setFollowing] = useState(false)

  const ring = getRoleRingClass(profile.role)
  const displayName = profile.display_name || profile.username

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-100 to-surface-200 border border-surface-300 p-6 md:p-8">
      {/* Subtle background gradient */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-for-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Avatar with role-colored ring */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={cn(
            'relative rounded-full ring-4 ring-offset-4 ring-offset-surface-100',
            ring
          )}
        >
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
            className="h-24 w-24 md:h-28 md:w-28"
          />
          {profile.is_influencer && (
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gold border-2 border-surface-100 flex items-center justify-center">
              <span className="text-[10px] font-bold text-black">★</span>
            </div>
          )}
        </motion.div>

        {/* Identity column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
              {displayName}
            </h1>
            <RoleBadge role={profile.role} size="md" />
          </div>
          <div className="text-sm font-mono text-surface-500 mb-2">
            @{profile.username}
          </div>
          {profile.bio && (
            <p className="text-sm text-surface-600 max-w-prose mb-3">
              {profile.bio}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
            <Calendar className="h-3.5 w-3.5" />
            Joined {formatJoinDate(profile.created_at)}
          </div>
        </div>

        {/* Reputation meter */}
        <div className="flex-shrink-0">
          <ReputationMeter score={profile.reputation_score} />
        </div>
      </div>

      {/* Actions row */}
      <div className="relative mt-6 flex items-center gap-3">
        {isOwner ? (
          <Link href="/profile/settings">
            <Button variant="default" size="md">
              <Settings className="h-4 w-4" />
              Edit profile
            </Button>
          </Link>
        ) : (
          <Button
            variant={following ? 'default' : 'for'}
            size="md"
            onClick={() => setFollowing((f) => !f)}
          >
            {following ? (
              <>
                <UserCheck className="h-4 w-4" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Follow
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
