'use client'

/**
 * /topic/[id]/contributors — Top Voices
 *
 * The most influential arguers in this debate — ranked by total upvotes
 * earned across all their arguments on this topic. Shows FOR-dominant,
 * AGAINST-dominant, and mixed contributors.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicContributor, ContributorsResponse } from '@/app/api/topics/[id]/contributors/route'

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const ROLE_COLOR: Record<string, string> = {
  person: 'text-surface-400',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  elder: 'text-gold',
}

// ─── Medal component ──────────────────────────────────────────────────────────

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-gold text-sm font-bold">🥇</span>
  if (rank === 2) return <span className="text-surface-300 text-sm font-bold">🥈</span>
  if (rank === 3) return <span className="text-amber-700 text-sm font-bold">🥉</span>
  return (
    <span className="text-[11px] font-mono font-bold text-surface-500 w-5 text-center">
      {rank}
    </span>
  )
}

// ─── Contributor row ──────────────────────────────────────────────────────────

function ContributorRow({
  contributor,
  rank,
  index,
}: {
  contributor: TopicContributor
  rank: number
  index: number
}) {
  const isFor = contributor.dominant_side === 'for'
  const isAgainst = contributor.dominant_side === 'against'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border transition-all group',
        'bg-surface-100/60 hover:bg-surface-100',
        rank === 1
          ? 'border-gold/30 hover:border-gold/60'
          : 'border-surface-300/60 hover:border-surface-400/80'
      )}
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-6 flex items-center justify-center">
        <Medal rank={rank} />
      </div>

      {/* Avatar */}
      <Link
        href={`/profile/${contributor.username}`}
        className="flex-shrink-0"
        tabIndex={-1}
      >
        <Avatar
          src={contributor.avatar_url}
          fallback={contributor.display_name || contributor.username}
          size="sm"
        />
      </Link>

      {/* Identity */}
      <Link
        href={`/profile/${contributor.username}`}
        className="flex-1 min-w-0 group/link"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white truncate group-hover/link:text-for-300 transition-colors">
            {contributor.display_name || contributor.username}
          </span>
          <span className={cn('text-[10px] font-medium flex-shrink-0', ROLE_COLOR[contributor.role] ?? 'text-surface-500')}>
            {ROLE_LABEL[contributor.role] ?? contributor.role}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            isFor
              ? 'text-for-400 bg-for-600/15'
              : isAgainst
              ? 'text-against-400 bg-against-600/15'
              : 'text-surface-400 bg-surface-300/30'
          )}>
            {isFor ? 'FOR' : isAgainst ? 'AGAINST' : 'MIXED'}
          </span>
          <span className="text-[10px] text-surface-500">
            {contributor.argument_count} arg{contributor.argument_count !== 1 ? 's' : ''}
          </span>
        </div>
      </Link>

      {/* Stats */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1 text-sm font-mono font-bold text-white">
          <ThumbsUp className="w-3 h-3 text-for-400" />
          {contributor.total_upvotes.toLocaleString()}
        </div>
        {/* FOR/AGAINST breakdown bar */}
        {contributor.total_upvotes > 0 && (
          <div className="w-16 h-1 rounded-full bg-surface-400/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500"
              style={{
                width: `${Math.round(contributor.for_upvotes / contributor.total_upvotes * 100)}%`,
              }}
            />
          </div>
        )}
        <div className="flex items-center gap-1 text-[10px] text-surface-500">
          <span className="text-for-500 font-mono">{contributor.for_upvotes}</span>
          <span>/</span>
          <span className="text-against-500 font-mono">{contributor.against_upvotes}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Main client ───────────────────────────────────────────────────────────────

export function ContributorsClient({
  topicId,
  statement,
  category,
  status: _status,
  bluePct,
  totalVotes,
}: Props) {
  const [data, setData] = useState<ContributorsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/topics/${topicId}/contributors`)
        if (!res.ok) throw new Error('Failed')
        const json: ContributorsResponse = await res.json()
        setData(json)
      } catch {
        // best-effort
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [topicId])

  const contributors = data?.contributors ?? []
  const totalArgs = data?.total_arguments ?? 0
  const forCount = contributors.filter((c) => c.dominant_side === 'for').length
  const againstCount = contributors.filter((c) => c.dominant_side === 'against').length
  const forPct = Math.round(bluePct)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="border-b border-surface-300/60 bg-surface-100/40">
          <div className="max-w-2xl mx-auto px-4 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Link
                href={`/topic/${topicId}`}
                className="p-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold" />
                <span className="text-sm font-bold text-white">Top Voices</span>
              </div>
              {category && (
                <Badge variant="proposed" className="text-[10px]">
                  {category}
                </Badge>
              )}
            </div>

            {/* Topic statement */}
            <p className="text-sm text-surface-400 line-clamp-2 leading-snug mb-3">
              {statement}
            </p>

            {/* Overview bar */}
            <div className="flex items-center gap-3 text-[11px] text-surface-500 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-for-500" />
                <span className="font-mono font-bold text-for-400">{forPct}%</span>
                <span>FOR</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-against-500" />
                <span className="font-mono font-bold text-against-400">{100 - forPct}%</span>
                <span>AGAINST</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span className="font-mono">{totalArgs.toLocaleString()}</span>
                <span>arguments</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span className="font-mono">{totalVotes.toLocaleString()}</span>
                <span>votes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : contributors.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contributors yet"
              description="No arguments have been posted in this debate yet. Be the first to make your case."
              actions={[
                {
                  label: 'Post an argument',
                  href: `/topic/${topicId}/argue`,
                  icon: MessageSquare,
                  variant: 'primary',
                },
              ]}
            />
          ) : (
            <>
              {/* Side summary */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-for-600/10 border border-for-600/20">
                  <span className="text-lg font-bold font-mono text-for-400">{forCount}</span>
                  <span className="text-[10px] text-surface-500 text-center">FOR voices</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-surface-100/60 border border-surface-300/60">
                  <span className="text-lg font-bold font-mono text-white">{contributors.length}</span>
                  <span className="text-[10px] text-surface-500 text-center">Total</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 p-3 rounded-xl bg-against-600/10 border border-against-600/20">
                  <span className="text-lg font-bold font-mono text-against-400">{againstCount}</span>
                  <span className="text-[10px] text-surface-500 text-center">AGAINST voices</span>
                </div>
              </div>

              {/* Ranked list */}
              <div className="space-y-2">
                {contributors.map((contributor, i) => (
                  <ContributorRow
                    key={contributor.user_id}
                    contributor={contributor}
                    rank={i + 1}
                    index={i}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-surface-300/40 flex items-center justify-between">
                <div className="text-[11px] text-surface-600">
                  Ranked by total upvotes earned across all arguments
                </div>
                <Link
                  href={`/topic/${topicId}/arguments`}
                  className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                >
                  All arguments
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
