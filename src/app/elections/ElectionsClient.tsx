'use client'

/**
 * /elections — Civic Elections
 *
 * Monthly democratic elections for platform council roles:
 *   • Senate       — enhanced voting weight + fast-track powers
 *   • Troll Catcher Council — content moderation authority
 *   • Elder Circle — platform wisdom and arbitration
 *
 * Users can self-nominate with a civic statement, vote for nominees,
 * and track results in real-time.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  ExternalLink,
  Gavel,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Election, ElectionNominee, ElectionsResponse } from '@/app/api/elections/route'

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  border: string
  bg: string
  text: string
  desc: string
}> = {
  senator: {
    label: 'Senator',
    icon: Crown,
    color: 'text-purple',
    border: 'border-purple/40',
    bg: 'bg-purple/10',
    text: 'text-purple',
    desc: 'Senators gain enhanced voting weight and the ability to fast-track urgent topics.',
  },
  troll_catcher: {
    label: 'Troll Catcher',
    icon: Shield,
    color: 'text-emerald',
    border: 'border-emerald/40',
    bg: 'bg-emerald/10',
    text: 'text-emerald',
    desc: 'Troll Catchers defend the Lobby\'s discourse quality by flagging bad-faith arguments.',
  },
  elder: {
    label: 'Elder',
    icon: Sparkles,
    color: 'text-gold',
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    text: 'text-gold',
    desc: 'Elders provide platform wisdom, settle disputes, and guide long-term civic direction.',
  },
  lawmaker: {
    label: 'Lawmaker',
    icon: Gavel,
    color: 'text-for-400',
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    text: 'text-for-300',
    desc: 'Lawmakers can propose binding civic policies and codify community decisions into law.',
  },
}

const FALLBACK_ROLE = {
  label: 'Representative',
  icon: Users,
  color: 'text-surface-400',
  border: 'border-surface-400/40',
  bg: 'bg-surface-300/20',
  text: 'text-surface-400',
  desc: 'Platform representatives elected by the community.',
}

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? FALLBACK_ROLE
}

// ─── Time helpers ──────────────────────────────────────────────────────────────

function useCountdown(endsAt: string): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function compute() {
      const ms = new Date(endsAt).getTime() - Date.now()
      if (ms <= 0) return setLabel('Ended')
      const d = Math.floor(ms / 86_400_000)
      const h = Math.floor((ms % 86_400_000) / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      if (d > 0) setLabel(`${d}d ${h}h left`)
      else if (h > 0) setLabel(`${h}h ${m}m left`)
      else setLabel(`${m}m left`)
    }
    compute()
    const id = setInterval(compute, 60_000)
    return () => clearInterval(id)
  }, [endsAt])

  return label
}

// ─── Nominee card ──────────────────────────────────────────────────────────────

interface NomineeCardProps {
  nominee: ElectionNominee
  rank: number
  totalVotes: number
  userVoted: string | null
  electionStatus: string
  seats: number
  onVote: (nomineeId: string) => void
  voting: boolean
}

function NomineeCard({
  nominee,
  rank,
  totalVotes,
  userVoted,
  electionStatus,
  seats,
  onVote,
  voting,
}: NomineeCardProps) {
  const [expanded, setExpanded] = useState(false)
  const pct = totalVotes > 0 ? Math.round((nominee.vote_count / totalVotes) * 100) : 0
  const isVotedFor = userVoted === nominee.id
  const isLeading = rank <= seats
  const canVote = electionStatus === 'active' && !userVoted

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isVotedFor
          ? 'border-for-500/60 bg-for-500/8'
          : nominee.is_winner
            ? 'border-gold/50 bg-gold/5'
            : 'border-surface-300 bg-surface-100 hover:border-surface-400',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
          nominee.is_winner
            ? 'bg-gold/20 text-gold border border-gold/40'
            : isLeading && electionStatus === 'active'
              ? 'bg-for-500/15 text-for-300 border border-for-500/30'
              : 'bg-surface-200 text-surface-500',
        )}>
          {nominee.is_winner ? <Trophy className="h-3.5 w-3.5" /> : rank}
        </div>

        {/* Avatar + name */}
        <Link href={`/profile/${nominee.username}`} className="flex items-center gap-2 min-w-0 flex-1 group">
          <Avatar
            src={nominee.avatar_url}
            fallback={nominee.display_name ?? nominee.username}
            size="sm"
          />
          <div className="min-w-0">
            <span className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors truncate block">
              {nominee.display_name ?? nominee.username}
            </span>
            <span className="text-xs text-surface-500">@{nominee.username}</span>
          </div>
        </Link>

        {/* Stats */}
        <div className="flex-shrink-0 flex items-center gap-3 text-xs text-surface-500">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-gold" />
            {nominee.clout.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Vote className="h-3 w-3 text-for-400" />
            {nominee.total_votes.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Vote bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full',
              isVotedFor
                ? 'bg-for-500'
                : nominee.is_winner
                  ? 'bg-gold'
                  : 'bg-surface-500',
            )}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs font-mono text-surface-500 w-10 text-right">
          {nominee.vote_count} {nominee.vote_count === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      {/* Statement (expandable) */}
      <div className="mt-3">
        <button
          className="w-full text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-1 text-xs text-surface-500 mb-1">
            <MessageSquare className="h-3 w-3" />
            <span>Nomination statement</span>
            {expanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </div>
          {!expanded && (
            <p className="text-xs text-surface-400 line-clamp-1 italic">
              &ldquo;{nominee.statement}&rdquo;
            </p>
          )}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-surface-400 italic overflow-hidden"
            >
              &ldquo;{nominee.statement}&rdquo;
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Vote button */}
      {electionStatus === 'active' && (
        <div className="mt-3 flex items-center gap-2">
          {isVotedFor ? (
            <div className="flex items-center gap-1.5 text-xs text-for-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Your vote
            </div>
          ) : canVote ? (
            <Button
              size="sm"
              variant="for"
              onClick={() => onVote(nominee.id)}
              disabled={voting}
              className="gap-1.5"
            >
              {voting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
              Vote
            </Button>
          ) : null}
          {nominee.is_winner && (
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-gold">
              <Trophy className="h-3.5 w-3.5" />
              Elected
            </span>
          )}
          {isLeading && electionStatus === 'active' && !isVotedFor && (
            <span className="ml-auto text-xs text-for-300 font-medium">Leading</span>
          )}
        </div>
      )}
      {electionStatus === 'completed' && nominee.is_winner && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gold font-semibold">
          <Trophy className="h-3.5 w-3.5" />
          Elected to office
        </div>
      )}
    </motion.div>
  )
}

// ─── Election card ─────────────────────────────────────────────────────────────

interface ElectionCardProps {
  election: Election
  onVote: (electionId: string, nomineeId: string) => void
  onNominate: (electionId: string, statement: string) => void
  voting: string | null
  nominating: string | null
}

function ElectionCard({ election, onVote, onNominate, voting, nominating }: ElectionCardProps) {
  const roleConfig = getRoleConfig(election.role)
  const RoleIcon = roleConfig.icon
  const countdown = useCountdown(election.ends_at)
  const [nominateOpen, setNominateOpen] = useState(false)
  const [statement, setStatement] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  const isActive = election.status === 'active'
  const isCompleted = election.status === 'completed'

  const sortedNominees = [...election.nominees].sort((a, b) => b.vote_count - a.vote_count)

  function handleNominateSubmit() {
    if (statement.trim().length < 10) return
    onNominate(election.id, statement.trim())
    setNominateOpen(false)
    setStatement('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        isCompleted
          ? 'border-surface-300 bg-surface-100'
          : 'border-surface-300 bg-surface-100',
      )}
    >
      {/* Header */}
      <div className={cn(
        'px-5 py-4 border-b flex items-start gap-3',
        isCompleted ? 'border-surface-300 bg-surface-200/50' : 'border-surface-300 bg-surface-200/30',
      )}>
        <div className={cn('p-2 rounded-lg border', roleConfig.border, roleConfig.bg)}>
          <RoleIcon className={cn('h-5 w-5', roleConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-sm">{election.title}</h3>
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
              isCompleted
                ? 'bg-surface-300 text-surface-500'
                : 'bg-for-500/20 text-for-300 border border-for-500/30',
            )}>
              {isCompleted ? 'Completed' : 'Live'}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">{roleConfig.desc}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-3 flex items-center gap-4 border-b border-surface-300 text-xs text-surface-500">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {election.nominees.length} {election.nominees.length === 1 ? 'nominee' : 'nominees'}
        </span>
        <span className="flex items-center gap-1">
          <BarChart2 className="h-3.5 w-3.5" />
          {election.total_votes} votes cast
        </span>
        <span className="flex items-center gap-1">
          <Award className="h-3.5 w-3.5" />
          {election.seats} {election.seats === 1 ? 'seat' : 'seats'} available
        </span>
        {isActive && (
          <span className="ml-auto flex items-center gap-1 text-for-300">
            <Clock className="h-3.5 w-3.5" />
            {countdown}
          </span>
        )}
        {isCompleted && (
          <span className="ml-auto flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
            <span className="text-emerald">Results finalised</span>
          </span>
        )}
      </div>

      {/* Nominees list */}
      <div className="px-5 py-4 space-y-3">
        {sortedNominees.length === 0 ? (
          <div className="text-center py-8 text-surface-500">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No nominees yet.</p>
            {isActive && (
              <p className="text-xs mt-1">Be the first to put yourself forward.</p>
            )}
          </div>
        ) : (
          sortedNominees.map((nominee, i) => (
            <NomineeCard
              key={nominee.id}
              nominee={nominee}
              rank={i + 1}
              totalVotes={election.total_votes}
              userVoted={election.user_vote_nominee_id}
              electionStatus={election.status}
              seats={election.seats}
              onVote={(nomineeId) => onVote(election.id, nomineeId)}
              voting={voting === `${election.id}:${nominee.id}`}
            />
          ))
        )}
      </div>

      {/* Nominate yourself */}
      {isActive && !election.user_nominated && (
        <div className="px-5 pb-4">
          <AnimatePresence>
            {!nominateOpen ? (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={() => {
                    setNominateOpen(true)
                    setTimeout(() => textRef.current?.focus(), 50)
                  }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-medium transition-colors',
                    'border-surface-400 text-surface-500 hover:border-surface-500 hover:text-white hover:bg-surface-200',
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nominate yourself for this election
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-surface-400 bg-surface-200 p-4 space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Your nomination statement</span>
                  <button onClick={() => setNominateOpen(false)} className="text-surface-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  ref={textRef}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Why should the community elect you? What will you do with this role?"
                  className="w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-500">{statement.length}/500</span>
                  <Button
                    size="sm"
                    variant="for"
                    onClick={handleNominateSubmit}
                    disabled={statement.trim().length < 10 || nominating === election.id}
                  >
                    {nominating === election.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Scale className="h-3.5 w-3.5" />
                    )}
                    Submit nomination
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {isActive && election.user_nominated && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 text-xs text-emerald font-medium py-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            You are nominated in this election
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ElectionsClient() {
  const [data, setData] = useState<ElectionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voting, setVoting] = useState<string | null>(null)
  const [nominating, setNominating] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/elections', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load elections')
      const json = await res.json() as ElectionsResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleVote(electionId: string, nomineeId: string) {
    const key = `${electionId}:${nomineeId}`
    setVoting(key)
    try {
      const res = await fetch('/api/elections/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, nominee_id: nomineeId }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error ?? 'Vote failed')
        return
      }
      showToast('Vote cast successfully!')
      // Optimistically update the UI
      setData((prev) => {
        if (!prev) return prev
        function updateElection(e: Election): Election {
          if (e.id !== electionId) return e
          const newNominees = e.nominees.map((n) =>
            n.id === nomineeId ? { ...n, vote_count: json.vote_count } : n,
          )
          const total = newNominees.reduce((s, n) => s + n.vote_count, 0)
          return { ...e, nominees: newNominees, total_votes: total, user_vote_nominee_id: nomineeId }
        }
        return {
          active: prev.active.map(updateElection),
          completed: prev.completed.map(updateElection),
          upcoming: prev.upcoming.map(updateElection),
        }
      })
    } catch {
      showToast('Failed to cast vote')
    } finally {
      setVoting(null)
    }
  }

  async function handleNominate(electionId: string, statement: string) {
    setNominating(electionId)
    try {
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, statement }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error ?? 'Nomination failed')
        return
      }
      showToast('Nomination submitted!')
      await load()
    } catch {
      showToast('Failed to submit nomination')
    } finally {
      setNominating(null)
    }
  }

  const allElections = data ? [...data.active, ...data.completed, ...data.upcoming] : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-surface-100 border border-surface-300 text-white text-sm px-4 py-2 rounded-full shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Vote className="h-6 w-6 text-for-400" />
                Civic Elections
              </h1>
              <p className="text-sm text-surface-500 mt-1">
                The community elects its representatives. Every citizen gets one vote per election.
              </p>
            </div>
            <button
              onClick={() => { setLoading(true); load() }}
              disabled={loading}
              className="flex-shrink-0 p-2 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
          <h2 className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">How elections work</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Plus, label: 'Nominate', desc: 'Any citizen can self-nominate with a civic statement' },
              { icon: ThumbsUp, label: 'Vote', desc: 'One vote per election — vote for who you trust most' },
              { icon: Trophy, label: 'Elected', desc: 'Top candidates win seats and receive their platform role' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Icon className="h-3.5 w-3.5 text-for-400" />
                  {label}
                </div>
                <p className="text-xs text-surface-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-surface-500">
            <AlertTriangleIcon className="h-8 w-8 text-against-400" />
            <p className="text-sm">{error}</p>
            <button
              onClick={() => { setLoading(true); load() }}
              className="text-xs text-for-400 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* No elections */}
        {!loading && !error && allElections.length === 0 && (
          <EmptyState
            icon={Vote}
            title="No elections scheduled"
            description="Check back soon — elections are held monthly for Senate, Troll Catcher, and Elder roles."
          />
        )}

        {/* Active elections */}
        {!loading && !error && data && data.active.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-xs font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-for-500 animate-pulse" />
              Live Elections
            </h2>
            {data.active.map((election) => (
              <ElectionCard
                key={election.id}
                election={election}
                onVote={handleVote}
                onNominate={handleNominate}
                voting={voting}
                nominating={nominating}
              />
            ))}
          </div>
        )}

        {/* Upcoming elections */}
        {!loading && !error && data && data.upcoming.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-xs font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Upcoming Elections
            </h2>
            {data.upcoming.map((election) => (
              <ElectionCard
                key={election.id}
                election={election}
                onVote={handleVote}
                onNominate={handleNominate}
                voting={voting}
                nominating={nominating}
              />
            ))}
          </div>
        )}

        {/* Completed elections */}
        {!loading && !error && data && data.completed.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
              Past Elections
            </h2>
            {data.completed.map((election) => (
              <ElectionCard
                key={election.id}
                election={election}
                onVote={handleVote}
                onNominate={handleNominate}
                voting={voting}
                nominating={nominating}
              />
            ))}
          </div>
        )}

        {/* Footer note */}
        {!loading && !error && allElections.length > 0 && (
          <div className="mt-8 text-center text-xs text-surface-500 space-y-1">
            <p>Elections are held monthly. Role assignments update automatically when results are finalised.</p>
            <Link href="/leaderboard" className="text-for-400 hover:underline inline-flex items-center gap-1">
              View civic leaderboard
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// Inline icon to avoid import issue
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}
