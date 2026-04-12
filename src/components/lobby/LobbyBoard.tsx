'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Megaphone, Plus } from 'lucide-react'
import type { Lobby, Profile } from '@/lib/supabase/types'
import { LobbyCard } from './LobbyCard'
import { cn } from '@/lib/utils/cn'

type LobbyWithCreator = Lobby & {
  creator?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface LobbyBoardProps {
  topicId: string
  initialLobbies?: LobbyWithCreator[]
}

export function LobbyBoard({ topicId, initialLobbies }: LobbyBoardProps) {
  const [lobbies, setLobbies] = useState<LobbyWithCreator[]>(
    initialLobbies ?? []
  )
  const [loading, setLoading] = useState(!initialLobbies)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialLobbies) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/lobbies?topic_id=${topicId}`)
        if (!res.ok) throw new Error('Failed to load lobbies')
        const data = await res.json()
        if (cancelled) return
        setLobbies(data.lobbies ?? [])
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [topicId, initialLobbies])

  const forLobbies = lobbies
    .filter((l) => l.position === 'for')
    .sort((a, b) => b.member_count - a.member_count)
  const againstLobbies = lobbies
    .filter((l) => l.position === 'against')
    .sort((a, b) => b.member_count - a.member_count)

  const forJoiners = forLobbies.reduce((sum, l) => sum + l.member_count, 0)
  const againstJoiners = againstLobbies.reduce(
    (sum, l) => sum + l.member_count,
    0
  )
  const totalJoiners = forJoiners + againstJoiners
  const forPct = totalJoiners > 0 ? (forJoiners / totalJoiners) * 100 : 50

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-surface-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm font-mono">Loading lobbies…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-sm font-mono text-against-400">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary balance bar */}
      <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-[11px] font-semibold text-for-400 uppercase tracking-wider">
            {forLobbies.length} FOR · {forJoiners.toLocaleString()} joined
          </div>
          <div className="font-mono text-[11px] font-semibold text-against-400 uppercase tracking-wider">
            {againstJoiners.toLocaleString()} joined · {againstLobbies.length}{' '}
            AGAINST
          </div>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden bg-surface-300">
          <div className="flex h-full">
            <div
              className="bg-for-500 transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="flex-1 bg-against-500 transition-all duration-500"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-gold" />
          Active Lobbies
        </h3>
        <Link
          href={`/lobby/create?topic_id=${topicId}`}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
            'bg-gold/10 border border-gold/30 text-gold',
            'hover:bg-gold/20 text-xs font-mono font-medium transition-colors'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Start a Lobby
        </Link>
      </div>

      {lobbies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100 p-10 text-center">
          <Megaphone className="h-8 w-8 text-surface-500 mx-auto mb-3" />
          <p className="font-mono text-sm text-white">No lobbies yet</p>
          <p className="font-mono text-xs text-surface-500 mt-1">
            Be the first to rally support on this topic.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="font-mono text-[11px] font-semibold text-for-400 uppercase tracking-wider">
              FOR — {forLobbies.length}
            </div>
            {forLobbies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-for-500/30 bg-for-500/5 p-4 text-xs font-mono text-surface-500 text-center">
                No FOR lobbies yet
              </div>
            ) : (
              forLobbies.map((lobby) => (
                <LobbyCard key={lobby.id} lobby={lobby} />
              ))
            )}
          </div>
          <div className="space-y-3">
            <div className="font-mono text-[11px] font-semibold text-against-400 uppercase tracking-wider">
              AGAINST — {againstLobbies.length}
            </div>
            {againstLobbies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-against-500/30 bg-against-500/5 p-4 text-xs font-mono text-surface-500 text-center">
                No AGAINST lobbies yet
              </div>
            ) : (
              againstLobbies.map((lobby) => (
                <LobbyCard key={lobby.id} lobby={lobby} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
