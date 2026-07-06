'use client'

import { useState } from 'react'
import { Check, Loader2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Props {
  targetId: string
  initialFollowing: boolean
}

export function PeopleFollowButton({ targetId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/follow', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
      })
      if (res.ok) {
        setFollowing(!following)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={following ? 'Unfollow user' : 'Follow user'}
      className={cn(
        'flex-shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-mono border transition-colors',
        following
          ? 'bg-for-500/10 border-for-500/30 text-for-400 hover:bg-against-500/10 hover:border-against-500/30 hover:text-against-400'
          : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-for-500/50 hover:text-for-400',
        loading && 'opacity-50 cursor-not-allowed'
      )}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : following ? (
        <Check className="h-3 w-3" />
      ) : (
        <UserPlus className="h-3 w-3" />
      )}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
