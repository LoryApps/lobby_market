'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CircleDot,
  Clock,
  Loader2,
  Scale,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { ThesisComments } from './ThesisComments'
import { cn } from '@/lib/utils/cn'
import type { Thesis } from '@/lib/types/thesis'

const STATUS_CONFIG = {
  active: { label: 'Active', icon: CircleDot, color: 'text-for-400', bg: 'bg-for-500/10 border-for-500/30' },
  vindicated: { label: 'Vindicated', icon: Trophy, color: 'text-gold', bg: 'bg-gold/10 border-gold/30' },
  refuted: { label: 'Refuted', icon: X, color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' },
  expired: { label: 'Expired', icon: Clock, color: 'text-surface-500', bg: 'bg-surface-200 border-surface-300' },
}

const CAT_COLORS: Record<string, string> = {
  economics: 'text-gold border-gold/40 bg-gold/10',
  politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  technology: 'text-purple border-purple/40 bg-purple/10',
  science: 'text-emerald border-emerald/40 bg-emerald/10',
  ethics: 'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy: 'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health: 'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

export function ThesisDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [thesis, setThesis] = useState<Thesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [voteBusy, setVoteBusy] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    fetch(`/api/thesis/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setThesis(d?.thesis ?? null))
      .finally(() => setLoading(false))
  }, [id])

  async function vote(agree: boolean) {
    if (!thesis || voteBusy) return
    setVoteBusy(true)
    try {
      const currentVote = thesis.viewer_vote
      if (currentVote === agree) {
        await fetch(`/api/thesis/${id}/vote`, { method: 'DELETE' })
        setThesis((t) =>
          t
            ? {
                ...t,
                viewer_vote: null,
                agree_count: agree ? Math.max(0, t.agree_count - 1) : t.agree_count,
                disagree_count: !agree ? Math.max(0, t.disagree_count - 1) : t.disagree_count,
              }
            : t
        )
      } else {
        await fetch(`/api/thesis/${id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agree }),
        })
        setThesis((t) => {
          if (!t) return t
          let { agree_count, disagree_count } = t
          if (t.viewer_vote === true) agree_count = Math.max(0, agree_count - 1)
          if (t.viewer_vote === false) disagree_count = Math.max(0, disagree_count - 1)
          if (agree) agree_count++
          else disagree_count++
          return { ...t, viewer_vote: agree, agree_count, disagree_count }
        })
      }
    } finally {
      setVoteBusy(false)
    }
  }

  async function resolve(status: 'vindicated' | 'refuted') {
    if (!thesis || resolving) return
    setResolving(true)
    try {
      const res = await fetch(`/api/thesis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const { thesis: updated } = await res.json()
        setThesis((t) => (t ? { ...t, ...updated } : t))
        setShowResolve(false)
      }
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <div className="mb-5">
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!thesis) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-12 pb-24 text-center">
          <p className="font-mono text-surface-400">Thesis not found.</p>
          <Link href="/thesis" className="text-purple text-sm font-mono hover:underline mt-4 block">
            Back to Theses
          </Link>
        </main>
        <BottomNav />
      </div>
    )
  }

  const isOwner = thesis.user_id === currentUserId
  const status = STATUS_CONFIG[thesis.status]
  const StatusIcon = status.icon
  const catColor = CAT_COLORS[thesis.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50
  const daysLeft = thesis.resolution_date
    ? Math.ceil((new Date(thesis.resolution_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="mb-5 h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-5"
        >
          {/* Author + badges */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {thesis.author && (
                <Link href={`/profile/${thesis.author.username}`} className="flex-shrink-0">
                  <Avatar
                    src={thesis.author.avatar_url}
                    fallback={thesis.author.display_name || thesis.author.username}
                    size="sm"
                  />
                </Link>
              )}
              <div className="min-w-0">
                {thesis.author && (
                  <Link
                    href={`/profile/${thesis.author.username}`}
                    className="text-sm font-mono font-bold text-white hover:text-for-300 transition-colors block"
                  >
                    {thesis.author.display_name || thesis.author.username}
                  </Link>
                )}
                <p className="text-xs font-mono text-surface-500">
                  {new Date(thesis.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  catColor
                )}
              >
                {thesis.category}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  status.bg,
                  status.color
                )}
              >
                <StatusIcon className="h-2.5 w-2.5" />
                {status.label}
              </span>
            </div>
          </div>

          {/* Statement */}
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-lg bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Scroll className="h-3.5 w-3.5 text-purple" />
            </div>
            <p className="text-base font-mono text-white leading-relaxed">{thesis.statement}</p>
          </div>

          {/* Rationale */}
          {thesis.rationale && (
            <div className="bg-surface-200 border border-surface-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  Rationale
                </span>
              </div>
              <p className="text-sm font-mono text-surface-300 leading-relaxed whitespace-pre-line">
                {thesis.rationale}
              </p>
            </div>
          )}

          {/* Meta: resolution date + related topic */}
          <div className="flex flex-wrap gap-3">
            {daysLeft !== null && thesis.status === 'active' && (
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border',
                  daysLeft < 7
                    ? 'bg-against-500/10 border-against-500/30 text-against-400'
                    : daysLeft < 30
                    ? 'bg-gold/10 border-gold/30 text-gold'
                    : 'bg-surface-200 border-surface-300 text-surface-400'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {daysLeft > 0 ? `Resolves in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'Overdue'}
              </div>
            )}
            {thesis.resolved_at && thesis.status !== 'active' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-200 border border-surface-300 text-surface-400">
                <Check className="h-3.5 w-3.5" />
                Resolved{' '}
                {new Date(thesis.resolved_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            )}
            {thesis.related_topic_id && thesis.related_topic_statement && (
              <Link
                href={`/topic/${thesis.related_topic_id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 transition-colors max-w-xs"
              >
                <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{thesis.related_topic_statement}</span>
              </Link>
            )}
          </div>

          {/* Agree / disagree bar */}
          {total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-for-400">{thesis.agree_count} agree ({agreePct}%)</span>
                <span className="text-against-400">{thesis.disagree_count} disagree ({100 - agreePct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-against-900/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-for-500 transition-all duration-700"
                  style={{ width: `${agreePct}%` }}
                />
              </div>
            </div>
          )}

          {/* Vote buttons (non-owners on active theses) */}
          {!isOwner && thesis.status === 'active' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => vote(true)}
                disabled={voteBusy}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-semibold border transition-all',
                  thesis.viewer_vote === true
                    ? 'bg-for-500/30 border-for-500/60 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-500/50 hover:text-for-400'
                )}
              >
                {voteBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4" />
                )}
                I Agree
              </button>
              <button
                onClick={() => vote(false)}
                disabled={voteBusy}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-semibold border transition-all',
                  thesis.viewer_vote === false
                    ? 'bg-against-500/30 border-against-500/60 text-against-300'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-500/50 hover:text-against-400'
                )}
              >
                {voteBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsDown className="h-4 w-4" />
                )}
                I Disagree
              </button>
            </div>
          )}

          {/* Owner resolve controls */}
          {isOwner && thesis.status === 'active' && (
            <div className="border-t border-surface-300 pt-4">
              {showResolve ? (
                <div className="space-y-3">
                  <p className="text-xs font-mono text-surface-400">
                    How did your thesis play out?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolve('vindicated')}
                      disabled={resolving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold/20 border border-gold/40 text-gold text-sm font-mono font-semibold hover:bg-gold/30 transition-colors disabled:opacity-50"
                    >
                      {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                      Vindicated — I was right
                    </button>
                    <button
                      onClick={() => resolve('refuted')}
                      disabled={resolving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-against-500/20 border border-against-500/40 text-against-400 text-sm font-mono font-semibold hover:bg-against-500/30 transition-colors disabled:opacity-50"
                    >
                      {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Refuted — I was wrong
                    </button>
                  </div>
                  <button
                    onClick={() => setShowResolve(false)}
                    className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowResolve(true)}
                  className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Scale className="h-4 w-4" />
                  Resolve this thesis
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Discussion thread */}
        <ThesisComments thesisId={id} />

        {/* Back to thesis list */}
        <div className="mt-6 text-center">
          <Link
            href="/thesis"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            All Civic Theses
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
