'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  Gavel,
  Loader2,
  RefreshCw,
  Shield,
  Star,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Election, ElectionNominee, ElectionsResponse } from '@/app/api/elections/route'

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, {
  label: string
  icon: typeof Crown
  color: string
  bg: string
  border: string
  description: string
}> = {
  senator: {
    label: 'Senator',
    icon: Crown,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Senators gain enhanced voting weight and the ability to fast-track topics to the active chamber.',
  },
  lawmaker: {
    label: 'Lawmaker',
    icon: Gavel,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Lawmakers can propose constitutional amendments and veto low-quality laws.',
  },
  troll_catcher: {
    label: 'Troll Catcher',
    icon: Shield,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Troll Catchers are the first line of defence against bad-faith arguments.',
  },
  elder: {
    label: 'Elder',
    icon: Star,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'Elders serve as trusted arbiters and mentors for new citizens.',
  },
}

// ─── Countdown timer ───────────────────────────────────────────────────────────

function useCountdown(endsAt: string) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(endsAt).getTime() - Date.now()))

  useEffect(() => {
    const tick = () => setMs(Math.max(0, new Date(endsAt).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  const secs = Math.floor((ms % 60_000) / 1_000)

  if (ms === 0) return 'Ended'
  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${mins}m remaining`
  return `${mins}m ${secs}s remaining`
}

// ─── Nomination modal ──────────────────────────────────────────────────────────

function NominationModal({
  election,
  onClose,
  onSuccess,
}: {
  election: Election
  onClose: () => void
  onSuccess: () => void
}) {
  const [statement, setStatement] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (statement.trim().length < 10) {
      setError('Statement must be at least 10 characters.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: election.id, statement: statement.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to nominate')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const remaining = 500 - statement.length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="w-full max-w-lg rounded-t-2xl border border-surface-300 bg-surface-100 p-6 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-surface-900">Nominate yourself</h2>
            <p className="mt-0.5 text-sm text-surface-500">{election.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-surface-500 hover:bg-surface-200 hover:text-surface-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-surface-500">
          Write a campaign statement explaining why you should be elected. Be specific about what
          you&apos;d do with the role.
        </p>

        <textarea
          ref={textareaRef}
          value={statement}
          onChange={(e) => setStatement(e.target.value.slice(0, 500))}
          placeholder="Why should the Lobby elect you? What will you do with this role?"
          rows={5}
          className="w-full resize-none rounded-xl border border-surface-300 bg-surface-200 px-4 py-3 text-sm text-surface-800 placeholder:text-surface-500 focus:border-for-500/50 focus:outline-none focus:ring-2 focus:ring-for-500/20"
        />

        <div className="mt-1 flex justify-between text-xs text-surface-500">
          <span>{statement.trim().length}/500 chars</span>
          <span className={remaining < 50 ? 'text-against-400' : ''}>{remaining} remaining</span>
        </div>

        {error && (
          <p className="mt-2 text-sm text-against-400">{error}</p>
        )}

        <div className="mt-4 flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="for"
            onClick={handleSubmit}
            disabled={loading || statement.trim().length < 10}
            className="flex-1"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Submit nomination
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Nominee card ──────────────────────────────────────────────────────────────

function NomineeCard({
  nominee,
  election,
  isVoted,
  onVote,
  totalVotes,
  rank,
  seats,
  isCompleted,
}: {
  nominee: ElectionNominee
  election: Election
  isVoted: boolean
  onVote: (nomineeId: string) => void
  totalVotes: number
  rank: number
  seats: number
  isCompleted: boolean
}) {
  const pct = totalVotes > 0 ? Math.round((nominee.vote_count / totalVotes) * 100) : 0
  const isWinner = nominee.is_winner
  const isLeading = !isCompleted && rank <= seats
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isWinner
          ? 'border-gold/40 bg-gold/5'
          : isLeading
          ? 'border-for-500/30 bg-for-500/5'
          : 'border-surface-300 bg-surface-200',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
            isWinner
              ? 'bg-gold/20 text-gold'
              : isLeading
              ? 'bg-for-500/20 text-for-400'
              : 'bg-surface-300 text-surface-500',
          )}
        >
          {isWinner ? <Trophy className="h-3.5 w-3.5" /> : rank}
        </div>

        {/* Avatar */}
        <Link href={`/profile/${nominee.username}`}>
          <Avatar
            src={nominee.avatar_url}
            fallback={nominee.display_name ?? nominee.username}
            size="md"
          />
        </Link>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/profile/${nominee.username}`}
              className="font-semibold text-surface-800 hover:text-surface-900"
            >
              {nominee.display_name ?? nominee.username}
            </Link>
            <Badge variant={nominee.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
              {nominee.role === 'person' ? 'Citizen' : nominee.role.replace('_', ' ')}
            </Badge>
            {isWinner && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                <Trophy className="h-3 w-3" /> Elected
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-gold" />
              {nominee.clout.toLocaleString()} clout
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-for-400" />
              {nominee.total_votes.toLocaleString()} votes
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3 w-3 text-purple" />
              {nominee.total_arguments.toLocaleString()} arguments
            </span>
          </div>

          {/* Statement */}
          <div className="mt-2">
            <p
              className={cn(
                'text-sm text-surface-600',
                !expanded && 'line-clamp-2',
              )}
            >
              {nominee.statement}
            </p>
            {nominee.statement.length > 120 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 flex items-center gap-0.5 text-xs text-surface-500 hover:text-surface-700"
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3" /> Read more</>
                )}
              </button>
            )}
          </div>

          {/* Vote bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-surface-500">
              <span>{nominee.vote_count} vote{nominee.vote_count !== 1 ? 's' : ''}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-300">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={cn(
                  'h-full rounded-full',
                  isWinner ? 'bg-gold' : isLeading ? 'bg-for-500' : 'bg-surface-400',
                )}
              />
            </div>
          </div>
        </div>

        {/* Vote button */}
        {!isCompleted && election.status === 'active' && (
          <div className="flex-shrink-0">
            {isVoted ? (
              <div className="flex items-center gap-1 rounded-lg bg-for-500/20 px-3 py-1.5 text-xs font-medium text-for-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Voted
              </div>
            ) : election.user_vote_nominee_id ? (
              <div className="rounded-lg bg-surface-300/50 px-3 py-1.5 text-xs text-surface-500">
                Voted
              </div>
            ) : (
              <Button
                size="sm"
                variant="for"
                onClick={() => onVote(nominee.id)}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Vote
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Election card ─────────────────────────────────────────────────────────────

function ElectionCard({
  election,
  onNominate,
  onVote,
}: {
  election: Election
  onNominate: (election: Election) => void
  onVote: (electionId: string, nomineeId: string) => void
}) {
  const roleConf = ROLE_CONFIG[election.role] ?? ROLE_CONFIG.senator
  const RoleIcon = roleConf.icon
  const countdown = useCountdown(election.ends_at)
  const isCompleted = election.status === 'completed'
  const isActive = election.status === 'active'
  const isUpcoming = election.status === 'upcoming'

  const sortedNominees = [...election.nominees].sort((a, b) => b.vote_count - a.vote_count)

  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        isCompleted
          ? 'border-surface-300/50 bg-surface-100/50'
          : 'border-surface-300 bg-surface-100',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-xl p-2.5', roleConf.bg, roleConf.border, 'border')}>
            <RoleIcon className={cn('h-5 w-5', roleConf.color)} />
          </div>
          <div>
            <h2 className="font-bold text-surface-900">{election.title}</h2>
            <p className="mt-0.5 text-sm text-surface-500 leading-snug">{election.description}</p>
          </div>
        </div>

        <div
          className={cn(
            'flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
            isActive ? 'bg-emerald/15 text-emerald' : isCompleted ? 'bg-surface-300 text-surface-500' : 'bg-gold/15 text-gold',
          )}
        >
          {isActive ? 'Active' : isCompleted ? 'Completed' : 'Upcoming'}
        </div>
      </div>

      {/* Meta row */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-surface-500">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {election.seats} seat{election.seats !== 1 ? 's' : ''} available
        </span>
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" />
          {election.total_votes} vote{election.total_votes !== 1 ? 's' : ''} cast
        </span>
        {!isCompleted && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {countdown}
          </span>
        )}
      </div>

      {/* Role description */}
      <p className="mb-4 rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-xs text-surface-600">
        {roleConf.description}
      </p>

      {/* Nominees */}
      {sortedNominees.length > 0 ? (
        <div className="space-y-3">
          {sortedNominees.map((nominee, i) => (
            <NomineeCard
              key={nominee.id}
              nominee={nominee}
              election={election}
              isVoted={election.user_vote_nominee_id === nominee.id}
              onVote={(nomineeId) => onVote(election.id, nomineeId)}
              totalVotes={election.total_votes}
              rank={i + 1}
              seats={election.seats}
              isCompleted={isCompleted}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-200/50 py-8 text-center">
          <UserPlus className="mx-auto mb-2 h-8 w-8 text-surface-400" />
          <p className="text-sm font-medium text-surface-600">No candidates yet</p>
          <p className="mt-1 text-xs text-surface-500">Be the first to put your name forward.</p>
        </div>
      )}

      {/* Nominate CTA */}
      {isActive && !election.user_nominated && (
        <div className="mt-4 border-t border-surface-300 pt-4">
          <Button
            variant="default"
            className="w-full"
            onClick={() => onNominate(election)}
          >
            <UserPlus className="h-4 w-4" />
            Nominate myself for {roleConf.label}
          </Button>
        </div>
      )}

      {isActive && election.user_nominated && (
        <p className="mt-4 border-t border-surface-300 pt-4 text-center text-xs text-surface-500">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald" />
          You&apos;re running in this election
        </p>
      )}

      {isUpcoming && (
        <p className="mt-4 border-t border-surface-300 pt-4 text-center text-xs text-surface-500">
          <Clock className="mr-1 inline h-3.5 w-3.5 text-gold" />
          Opens {new Date(election.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'active' | 'completed' | 'upcoming'

export function ElectionsClient() {
  const [data, setData] = useState<ElectionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('active')
  const [nominateTarget, setNominateTarget] = useState<Election | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/elections')
      if (!res.ok) throw new Error('Failed to load elections')
      const json = await res.json() as ElectionsResponse
      setData(json)
      // Default to whichever tab has content
      if (json.active.length > 0) setTab('active')
      else if (json.upcoming.length > 0) setTab('upcoming')
      else setTab('completed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleVote = useCallback(async (electionId: string, nomineeId: string) => {
    if (votingId) return
    setVotingId(nomineeId)
    try {
      const res = await fetch('/api/elections/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ election_id: electionId, nominee_id: nomineeId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to vote')
      }
      const body = await res.json() as { vote_count?: number }
      // Optimistically update the nominee vote count
      setData((prev) => {
        if (!prev) return prev
        const patch = (elections: Election[]) =>
          elections.map((e) => {
            if (e.id !== electionId) return e
            return {
              ...e,
              user_vote_nominee_id: nomineeId,
              nominees: e.nominees.map((n) =>
                n.id === nomineeId
                  ? { ...n, vote_count: body.vote_count ?? n.vote_count + 1 }
                  : n,
              ),
              total_votes: e.total_votes + 1,
            }
          })
        return {
          active: patch(prev.active),
          completed: patch(prev.completed),
          upcoming: patch(prev.upcoming),
        }
      })
    } catch {
      // silent — re-fetch for source-of-truth
      load()
    } finally {
      setVotingId(null)
    }
  }, [votingId, load])

  const handleNominateSuccess = () => {
    setNominateTarget(null)
    load()
  }

  const elections = data?.[tab] ?? []

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: data?.active.length ?? 0 },
    { id: 'upcoming', label: 'Upcoming', count: data?.upcoming.length ?? 0 },
    { id: 'completed', label: 'Completed', count: data?.completed.length ?? 0 },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-20">
        {/* Page header */}
        <div className="mb-6">
          <Link
            href="/"
            className="mb-4 flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gold/30 bg-gold/10 p-2.5">
              <Trophy className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">Civic Elections</h1>
              <p className="text-sm text-surface-500">
                The Lobby governs itself — vote for those who should represent you.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-surface-300 bg-surface-200 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'bg-surface-100 text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700',
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs',
                    tab === t.id ? 'bg-surface-300 text-surface-700' : 'bg-surface-300/60 text-surface-500',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="mb-4 flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-4 w-48" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                {[1, 2, 3].map((j) => (
                  <div key={j} className="mb-3 flex items-center gap-3 rounded-xl bg-surface-200 p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="mb-1.5 h-3.5 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="mb-3 text-sm text-against-400">{error}</p>
            <Button variant="default" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : elections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-100 py-16 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-surface-400" />
            <p className="font-semibold text-surface-600">No {tab} elections</p>
            <p className="mt-1 text-sm text-surface-500">
              {tab === 'active'
                ? 'No elections are running right now.'
                : tab === 'upcoming'
                ? 'No elections are scheduled yet.'
                : 'No elections have been completed yet.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {elections.map((election) => (
                <ElectionCard
                  key={election.id}
                  election={election}
                  onNominate={setNominateTarget}
                  onVote={handleVote}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* How it works */}
        <div className="mt-8 rounded-2xl border border-surface-300 bg-surface-100 p-5">
          <h3 className="mb-3 font-semibold text-surface-700">How elections work</h3>
          <ul className="space-y-2 text-sm text-surface-500">
            <li className="flex items-start gap-2">
              <UserPlus className="mt-0.5 h-4 w-4 flex-shrink-0 text-for-400" />
              Any citizen can self-nominate during an active election with a campaign statement.
            </li>
            <li className="flex items-start gap-2">
              <ThumbsUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-for-400" />
              Each citizen gets one vote per election — you can&apos;t vote for yourself.
            </li>
            <li className="flex items-start gap-2">
              <Trophy className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
              The top candidates (by vote count) fill the available seats when the election closes.
            </li>
            <li className="flex items-start gap-2">
              <Crown className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
              Winners earn the council role and its special platform powers for the term.
            </li>
          </ul>
        </div>
      </main>

      <BottomNav />

      {/* Nomination modal */}
      <AnimatePresence>
        {nominateTarget && (
          <NominationModal
            election={nominateTarget}
            onClose={() => setNominateTarget(null)}
            onSuccess={handleNominateSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
