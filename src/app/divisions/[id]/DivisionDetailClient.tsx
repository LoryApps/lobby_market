'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  FileText,
  Loader2,
  Minus,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Division, DivisionLobby } from '@/app/api/divisions/route'

type DetailDivision = Division & {
  aye_voters: Array<{
    user_id: string
    voted_at: string
    profile: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
  }> | null
  noe_voters: Array<{
    user_id: string
    voted_at: string
    profile: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
  }> | null
}

const RESULT_CONFIG: Record<string, { label: string; detail: string; color: string; icon: React.ReactNode; bg: string }> = {
  ayes_win:      { label: 'Ayes Have It',  detail: 'The motion passes.', color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-700/40', icon: <ThumbsUp className="h-5 w-5" /> },
  noes_win:      { label: 'Noes Have It',  detail: 'The motion fails.', color: 'text-against-400', bg: 'bg-against-900/20 border-against-700/40', icon: <ThumbsDown className="h-5 w-5" /> },
  tied:          { label: 'Tied — Noe',    detail: 'Equal votes. By convention, the Speaker votes No and the motion fails.', color: 'text-gold', bg: 'bg-gold/10 border-gold/30', icon: <Scale className="h-5 w-5" /> },
  quorum_failed: { label: 'Quorum Failed', detail: 'Insufficient participation. The division result is void.', color: 'text-surface-400', bg: 'bg-surface-800 border-surface-700/30', icon: <AlertCircle className="h-5 w-5" /> },
  withdrawn:     { label: 'Withdrawn',     detail: 'The division was withdrawn before closing.', color: 'text-surface-400', bg: 'bg-surface-800 border-surface-700/30', icon: <X className="h-5 w-5" /> },
}

function useCountdown(closesAt: string) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    function tick() {
      const diff = new Date(closesAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Closed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [closesAt])
  return remaining
}

function LobbyVoterList({
  voters,
  side,
}: {
  voters: DetailDivision['aye_voters']
  side: 'aye' | 'no'
}) {
  if (!voters || voters.length === 0) {
    return <p className="text-xs text-surface-500 italic py-2">No members yet</p>
  }
  return (
    <div className="space-y-1.5">
      {voters.map((v) => (
        <div key={v.user_id} className="flex items-center gap-2">
          <Avatar
            src={v.profile?.avatar_url ?? null}
            username={v.profile?.username ?? '?'}
            size={24}
            className="h-6 w-6 rounded-full shrink-0"
          />
          {v.profile ? (
            <Link
              href={`/profile/${v.profile.username}`}
              className={cn(
                'text-xs font-medium hover:underline transition-colors',
                side === 'aye' ? 'text-emerald-300 hover:text-emerald-200' : 'text-against-300 hover:text-against-200'
              )}
            >
              {v.profile.display_name ?? v.profile.username}
            </Link>
          ) : (
            <span className="text-xs text-surface-500">Deleted user</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function DivisionDetailClient({ id }: { id: string }) {
  const [division, setDivision] = useState<DetailDivision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voting, setVoting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const countdown = useCountdown(division?.closes_at ?? new Date().toISOString())

  const fetchDivision = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/divisions/${id}`)
      if (!res.ok) throw new Error('Division not found')
      const json = await res.json()
      setDivision(json.division)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load division')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchDivision() }, [fetchDivision])

  const handleVote = async (lobby: DivisionLobby) => {
    setVoting(true)
    try {
      const res = await fetch(`/api/divisions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobby }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Vote failed')
      }
      await fetchDivision()
    } catch {
      // noop
    } finally {
      setVoting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!confirm('Withdraw this division? This cannot be undone.')) return
    setWithdrawing(true)
    try {
      await fetch(`/api/divisions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      })
      await fetchDivision()
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <Skeleton className="h-6 w-24 rounded mb-4" />
          <SkeletonText lines={3} className="mb-6" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !division) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-12 w-12 text-against-400 mx-auto mb-3" />
          <p className="text-surface-400">{error ?? 'Division not found'}</p>
          <Link href="/divisions" className="mt-4 inline-block text-sm text-for-400 hover:text-for-300">← Back to divisions</Link>
        </main>
        <BottomNav />
      </div>
    )
  }

  const isOpen = division.status === 'open' && new Date(division.closes_at) > new Date()
  const total = division.ayes + division.noes + division.abstentions
  const ayePct = total > 0 ? Math.round((division.ayes / total) * 100) : 0
  const noePct = total > 0 ? Math.round((division.noes / total) * 100) : 0
  const res = division.result ? RESULT_CONFIG[division.result] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back */}
        <Link href="/divisions" className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Division Register
        </Link>

        {/* Title + status */}
        <div className="mb-5">
          <div className="flex flex-wrap gap-2 mb-2">
            {isOpen && (
              <motion.span
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-700/40"
              >
                <BellRing className="h-3 w-3" />
                Bell ringing
              </motion.span>
            )}
            {res && (
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', res.bg, res.color)}>
                {res.icon}
                {res.label}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-surface-100 leading-snug">{division.title}</h1>
          {division.topic && (
            <Link href={`/topic/${division.topic.id}`} className="text-sm text-for-400 hover:text-for-300 transition-colors mt-1 block">
              Re: {division.topic.statement}
            </Link>
          )}
        </div>

        {/* Motion text */}
        <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-surface-500" />
            <span className="text-xs font-medium text-surface-400 uppercase tracking-wide">Motion</span>
          </div>
          <p className="text-sm text-surface-200 leading-relaxed whitespace-pre-wrap">{division.motion_text}</p>
        </div>

        {/* Result declaration */}
        {res && division.result_declared_at && (
          <div className={cn('flex items-start gap-3 rounded-xl border p-4 mb-5', res.bg)}>
            <div className={cn('mt-0.5', res.color)}>{res.icon}</div>
            <div>
              <p className={cn('font-semibold', res.color)}>{res.label}</p>
              <p className="text-xs text-surface-400 mt-0.5">{res.detail}</p>
              {division.speaker_note && (
                <p className="text-xs text-surface-300 mt-2 italic">&ldquo;{division.speaker_note}&rdquo;</p>
              )}
            </div>
          </div>
        )}

        {/* Countdown */}
        {isOpen && (
          <div className="flex items-center justify-between rounded-xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 mb-5">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">Division closes in</span>
            </div>
            <span className="text-sm font-bold text-amber-400 tabular-nums">{countdown}</span>
          </div>
        )}

        {/* Vote tally bar */}
        <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-surface-400 uppercase tracking-wide">Division Count</span>
            <span className="text-xs text-surface-500">{total} members voted</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-800 mb-3">
            <motion.div
              className="bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${ayePct}%` }}
              transition={{ duration: 0.8 }}
            />
            <motion.div
              className="bg-against-500"
              initial={{ width: 0 }}
              animate={{ width: `${noePct}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="grid grid-cols-3 text-center gap-2">
            <div className="bg-emerald-900/20 rounded-lg p-2.5 border border-emerald-700/30">
              <div className="text-xl font-bold text-emerald-400">{division.ayes}</div>
              <div className="text-xs text-emerald-600 mt-0.5">Ayes</div>
            </div>
            <div className="bg-surface-800 rounded-lg p-2.5 border border-surface-700/30">
              <div className="text-xl font-bold text-surface-400">{division.abstentions}</div>
              <div className="text-xs text-surface-600 mt-0.5">Abstained</div>
            </div>
            <div className="bg-against-900/20 rounded-lg p-2.5 border border-against-700/30">
              <div className="text-xl font-bold text-against-400">{division.noes}</div>
              <div className="text-xs text-against-600 mt-0.5">Noes</div>
            </div>
          </div>
        </div>

        {/* Walk through a lobby (open + not yet voted) */}
        {isOpen && !division.user_lobby && (
          <div className="rounded-xl border border-for-700/40 bg-for-900/10 p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <BellRing className="h-4 w-4 text-for-400" />
              <h3 className="text-sm font-semibold text-surface-200">Walk through a lobby</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['aye', 'no', 'abstain'] as DivisionLobby[]).map((lobby) => (
                <button
                  key={lobby}
                  onClick={() => handleVote(lobby)}
                  disabled={voting}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 py-4 rounded-xl border font-semibold transition-all',
                    lobby === 'aye'
                      ? 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-500'
                      : lobby === 'no'
                      ? 'border-against-700/50 text-against-400 hover:bg-against-900/30 hover:border-against-500'
                      : 'border-surface-700/50 text-surface-400 hover:bg-surface-800 hover:border-surface-500',
                    voting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {voting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      {lobby === 'aye' ? <ThumbsUp className="h-6 w-6" /> : lobby === 'no' ? <ThumbsDown className="h-6 w-6" /> : <Minus className="h-6 w-6" />}
                      <span className="text-xs capitalize">{lobby === 'aye' ? 'Aye Lobby' : lobby === 'no' ? 'No Lobby' : 'Abstain'}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Already voted */}
        {isOpen && division.user_lobby && (
          <div className={cn(
            'flex items-center gap-3 rounded-xl border p-4 mb-5',
            division.user_lobby === 'aye' ? 'bg-emerald-900/20 border-emerald-700/40' :
            division.user_lobby === 'no' ? 'bg-against-900/20 border-against-700/40' :
            'bg-surface-800 border-surface-700/40'
          )}>
            <CheckCircle2 className={cn('h-5 w-5 shrink-0', division.user_lobby === 'aye' ? 'text-emerald-400' : division.user_lobby === 'no' ? 'text-against-400' : 'text-surface-400')} />
            <div>
              <p className={cn('text-sm font-medium', division.user_lobby === 'aye' ? 'text-emerald-300' : division.user_lobby === 'no' ? 'text-against-300' : 'text-surface-300')}>
                You walked through the {division.user_lobby === 'aye' ? 'Aye' : division.user_lobby === 'no' ? 'No' : 'Abstain'} lobby
              </p>
              <p className="text-xs text-surface-500 mt-0.5">Your vote is recorded in the division register</p>
            </div>
          </div>
        )}

        {/* Lobby registers side by side */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Aye Lobby</span>
              <span className="ml-auto text-xs text-emerald-500">{division.ayes}</span>
            </div>
            <LobbyVoterList voters={division.aye_voters} side="aye" />
          </div>
          <div className="rounded-xl border border-against-700/30 bg-against-900/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="h-4 w-4 text-against-400" />
              <span className="text-sm font-semibold text-against-300">No Lobby</span>
              <span className="ml-auto text-xs text-against-500">{division.noes}</span>
            </div>
            <LobbyVoterList voters={division.noe_voters} side="no" />
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-surface-500 block">Called by</span>
              {division.caller ? (
                <Link href={`/profile/${division.caller.username}`} className="text-surface-300 hover:text-surface-100 flex items-center gap-1 mt-0.5">
                  <Avatar src={division.caller.avatar_url} username={division.caller.username} size={16} className="h-4 w-4 rounded-full" />
                  {division.caller.display_name ?? division.caller.username}
                </Link>
              ) : <span className="text-surface-400">—</span>}
            </div>
            <div>
              <span className="text-surface-500 block">Opened</span>
              <span className="text-surface-300 mt-0.5 block">
                {new Date(division.opens_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-surface-500 block">Quorum</span>
              <span className="text-surface-300 mt-0.5 block">{division.quorum} members</span>
            </div>
            <div>
              <span className="text-surface-500 block">
                {division.status === 'closed' ? 'Closed' : 'Closes'}
              </span>
              <span className="text-surface-300 mt-0.5 block">
                {new Date(division.closes_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Withdraw (caller only) */}
        {isOpen && (
          <div className="flex justify-end">
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-700/50 text-xs text-surface-500 hover:text-against-400 hover:border-against-700/40 transition-colors"
            >
              {withdrawing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Withdraw Division
            </button>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
