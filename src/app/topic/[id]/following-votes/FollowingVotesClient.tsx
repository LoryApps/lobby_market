'use client'

/**
 * /topic/[id]/following-votes — Your Circle's Take
 *
 * Shows how the users you follow voted on this specific topic.
 * Gives social context to the vote — see where your civic network stands.
 *
 * Distinct from:
 *   /topic/[id]/voters   — top voters by reputation (platform-wide)
 *   /topic/[id]/blocs    — coalition voting patterns
 *   /topic/[id]/consensus — community-wide agreement analysis
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FollowingVoter, FollowingVotesResponse } from '@/app/api/topics/[id]/following-votes/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

// ─── Voter row ────────────────────────────────────────────────────────────────

function VoterRow({ voter }: { voter: FollowingVoter }) {
  const isFor = voter.side === 'blue'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 p-3.5 rounded-xl border transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/30'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/30'
      )}
    >
      <Link href={`/profile/${voter.username}`} className="flex-shrink-0">
        <Avatar
          src={voter.avatar_url}
          fallback={voter.display_name || voter.username}
          size="sm"
        />
      </Link>

      <Link href={`/profile/${voter.username}`} className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {voter.display_name || voter.username}
        </p>
        <p className="text-xs text-surface-500 truncate font-mono">@{voter.username}</p>
      </Link>

      <span
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex-shrink-0',
          isFor
            ? 'bg-for-500/15 text-for-300 border border-for-500/25'
            : 'bg-against-500/15 text-against-300 border border-against-500/25'
        )}
      >
        {isFor ? (
          <ThumbsUp className="h-3 w-3" />
        ) : (
          <ThumbsDown className="h-3 w-3" />
        )}
        {isFor ? 'For' : 'Against'}
      </span>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function FollowingVotesClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: Props) {
  const router = useRouter()
  const [data, setData] = useState<FollowingVotesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/topics/${topicId}/following-votes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FollowingVotesResponse | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [topicId])

  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const statusText = STATUS_LABEL[status] ?? status

  const forVoters = data?.voters.filter((v) => v.side === 'blue') ?? []
  const againstVoters = data?.voters.filter((v) => v.side === 'red') ?? []
  const total = data?.total ?? 0
  const circleForPct = total > 0 ? Math.round((data!.for_count / total) * 100) : 0
  const circleAgainstPct = total > 0 ? 100 - circleForPct : 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </button>

        {/* Topic card */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6">
          {category && (
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2 block">
              {category} · {statusText}
            </span>
          )}
          <h1 className="text-base font-medium text-white leading-snug mb-4">{statement}</h1>

          {/* Platform-wide vote bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-for-400 font-semibold">{forPct}% For</span>
              <span className="text-surface-500 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {totalVotes.toLocaleString()} total
              </span>
              <span className="text-against-400 font-semibold">{againstPct}% Against</span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden bg-against-900/40">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-surface-600 text-center">Platform-wide consensus</p>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300">
            <Users className="h-4 w-4 text-purple" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-semibold text-white">Your Circle&apos;s Take</h2>
            <p className="text-xs font-mono text-surface-500">
              How the people you follow voted
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300"
              >
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        ) : !data || total === 0 ? (
          <EmptyState
            icon={UserPlus}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/20"
            title="No circle votes yet"
            description={
              data === null
                ? 'Sign in to see how the people you follow voted on this topic.'
                : 'None of the people you follow have voted on this topic yet.'
            }
            action={
              data === null
                ? { label: 'Sign in', href: '/sign-in' }
                : { label: 'Find people to follow', href: '/discover' }
            }
          />
        ) : (
          <>
            {/* Circle consensus summary */}
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 mb-5 space-y-3">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                Your circle&apos;s consensus · {total} {total === 1 ? 'person' : 'people'}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-for-400 font-mono font-semibold text-sm w-10 text-right">
                  {circleForPct}%
                </span>
                <div className="flex-1 relative h-3 rounded-full overflow-hidden bg-against-900/40">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${circleForPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                  />
                </div>
                <span className="text-against-400 font-mono font-semibold text-sm w-10">
                  {circleAgainstPct}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-surface-600">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3 text-for-400" />
                  {data.for_count} For
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3 text-against-400" />
                  {data.against_count} Against
                </span>
              </div>

              {/* Circle vs Platform comparison */}
              {circleForPct !== forPct && (
                <div
                  className={cn(
                    'text-xs font-mono px-3 py-2 rounded-lg border',
                    Math.abs(circleForPct - forPct) >= 15
                      ? 'bg-gold/5 border-gold/20 text-gold'
                      : 'bg-surface-200 border-surface-300 text-surface-400'
                  )}
                >
                  {circleForPct > forPct
                    ? `Your circle leans ${circleForPct - forPct}pp more FOR than the platform average`
                    : `Your circle leans ${forPct - circleForPct}pp more AGAINST than the platform average`}
                </div>
              )}
            </div>

            {/* Two-column voter list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* FOR column */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                  <span className="text-xs font-mono font-semibold text-for-400 uppercase tracking-wider">
                    For · {forVoters.length}
                  </span>
                </div>
                {forVoters.length === 0 ? (
                  <p className="text-xs font-mono text-surface-600 py-6 text-center">
                    No one you follow voted For
                  </p>
                ) : (
                  forVoters.map((v) => <VoterRow key={v.id} voter={v} />)
                )}
              </div>

              {/* AGAINST column */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                  <span className="text-xs font-mono font-semibold text-against-400 uppercase tracking-wider">
                    Against · {againstVoters.length}
                  </span>
                </div>
                {againstVoters.length === 0 ? (
                  <p className="text-xs font-mono text-surface-600 py-6 text-center">
                    No one you follow voted Against
                  </p>
                ) : (
                  againstVoters.map((v) => <VoterRow key={v.id} voter={v} />)
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-center text-xs font-mono text-surface-600">
                Showing up to 50 followed voters. Discover more voices to follow.
              </p>
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Find more people to follow →
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
