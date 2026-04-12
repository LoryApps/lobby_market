'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Crown,
  Link as LinkIcon,
  Loader2,
  Megaphone,
  UserMinus,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import type {
  Lobby,
  LobbyPosition,
  Profile,
} from '@/lib/supabase/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

type LobbyMemberWithProfile = {
  id: string
  lobby_id: string
  user_id: string
  joined_at: string
  profile?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface LobbyDetailProps {
  lobby: Lobby
  creator: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
  topic: { id: string; statement: string; category: string | null } | null
  members: LobbyMemberWithProfile[]
  viewerId: string | null
  viewerIsMember: boolean
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

export function LobbyDetail({
  lobby: initialLobby,
  creator,
  topic,
  members,
  viewerId,
  viewerIsMember: initialIsMember,
}: LobbyDetailProps) {
  const router = useRouter()
  const [lobby, setLobby] = useState<Lobby>(initialLobby)
  const [isMember, setIsMember] = useState(initialIsMember)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = positionMeta[lobby.position]
  const canToggle = Boolean(viewerId)

  const handleJoin = async () => {
    if (!viewerId) {
      router.push('/login')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/lobbies/${lobby.id}/join`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to join lobby')
      }
      const data = await res.json()
      setLobby(data.lobby ?? lobby)
      setIsMember(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!viewerId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/lobbies/${lobby.id}/leave`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to leave lobby')
      }
      const data = await res.json()
      setLobby(data.lobby ?? lobby)
      setIsMember(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-3xl mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-surface-500">Lobby</span>
          <div
            className={cn(
              'ml-auto px-2 py-0.5 rounded-md font-mono text-[10px] font-bold',
              meta.bg,
              meta.color
            )}
          >
            {meta.label}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl border flex-shrink-0',
              meta.bg,
              meta.border,
              meta.color
            )}
          >
            <Megaphone className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl md:text-3xl font-bold text-white leading-tight">
              {lobby.name}
            </h1>
            {topic && (
              <Link
                href={`/topic/${topic.id}`}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
              >
                <span className="uppercase tracking-wider">On topic:</span>
                <span className="text-surface-700 underline">
                  {topic.statement}
                </span>
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-2">
            Campaign Statement
          </div>
          <p className="font-mono text-sm text-white whitespace-pre-wrap leading-relaxed">
            {lobby.campaign_statement}
          </p>

          {lobby.evidence_links.length > 0 && (
            <div className="mt-5 pt-4 border-t border-surface-300/60">
              <div className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-3">
                Evidence
              </div>
              <div className="space-y-2">
                {lobby.evidence_links.map((link, idx) => (
                  <a
                    key={`${link}-${idx}`}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors break-all"
                  >
                    <LinkIcon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{link}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Users className="h-3 w-3" />
              Members
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {lobby.member_count.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Zap className="h-3 w-3" />
              Influence
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-gold tabular-nums">
              {Math.round(lobby.influence_score).toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <Crown className="h-3 w-3" />
              Creator
            </div>
            <div className="mt-1 font-mono text-xs text-white truncate">
              @{creator?.username ?? 'anonymous'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isMember ? (
            <Button
              variant="default"
              size="lg"
              onClick={handleLeave}
              disabled={busy}
              className="flex-1"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Leaving…
                </>
              ) : (
                <>
                  <UserMinus className="h-4 w-4" />
                  Leave Lobby
                </>
              )}
            </Button>
          ) : (
            <Button
              variant={lobby.position === 'for' ? 'for' : 'against'}
              size="lg"
              onClick={handleJoin}
              disabled={busy || !canToggle}
              className="flex-1"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Joining…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Join {meta.label}
                </>
              )}
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-against-500/30 bg-against-500/10 px-3 py-2 text-xs font-mono text-against-400">
            {error}
          </div>
        )}

        <section>
          <h2 className="font-mono text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            Members ({members.length})
          </h2>
          {members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100 p-8 text-center">
              <p className="font-mono text-xs text-surface-500">
                No members yet
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-surface-300 bg-surface-100 divide-y divide-surface-300/60">
              {members.slice(0, 50).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Avatar
                    src={m.profile?.avatar_url}
                    fallback={
                      m.profile?.display_name ||
                      m.profile?.username ||
                      'U'
                    }
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-medium text-white truncate">
                      {m.profile?.display_name ??
                        m.profile?.username ??
                        'anonymous'}
                    </p>
                    <p className="font-mono text-[10px] text-surface-500">
                      joined {new Date(m.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  {m.user_id === creator?.id && (
                    <Crown className="h-3.5 w-3.5 text-gold" />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
