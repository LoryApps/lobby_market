'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ThesisOfTheDay, ThesisOfTheDayResponse } from '@/app/api/thesis/today/route'

// ─── Category styles ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, {
  text: string; bg: string; border: string; glow: string
}> = {
  economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-gold/20' },
  politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     glow: 'shadow-for-500/20' },
  technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      glow: 'shadow-purple/20' },
  science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/20' },
  ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', glow: 'shadow-against-500/20' },
  philosophy:  { text: 'text-surface-300', bg: 'bg-surface-300/10', border: 'border-surface-300/30', glow: 'shadow-surface-300/20' },
  culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        glow: 'shadow-gold/20' },
  health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/20' },
  environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     glow: 'shadow-emerald/20' },
  education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     glow: 'shadow-for-500/20' },
}

function getCatStyle(cat: string) {
  return CAT_COLORS[cat] ?? {
    text: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
    glow: 'shadow-surface-400/20',
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ agreePct, total }: { agreePct: number; total: number }) {
  const disagreePct = 100 - agreePct
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-surface-400">
        <span className="flex items-center gap-1">
          <ThumbsUp className="w-3 h-3 text-emerald" />
          <span className="text-emerald font-medium">{agreePct}% agree</span>
        </span>
        <span className="text-surface-500">{total.toLocaleString()} votes</span>
        <span className="flex items-center gap-1">
          <span className="text-against-400 font-medium">{disagreePct}% disagree</span>
          <ThumbsDown className="w-3 h-3 text-against-400" />
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-200 overflow-hidden flex">
        <motion.div
          className="h-full bg-emerald rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${agreePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
        <motion.div
          className="h-full bg-against-500 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${disagreePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ThesisSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-100 bg-surface-50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-6 w-3/4 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ─── Share logic ──────────────────────────────────────────────────────────────

async function shareThesis(thesis: ThesisOfTheDay) {
  const text = `"${thesis.statement}" — Do you agree or disagree? Today's Civic Thesis on Lobby Market`
  const url = `${window.location.origin}/thesis/${thesis.id}`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Thesis of the Day · Lobby Market', text, url })
      return
    } catch {
      // fallthrough to clipboard
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ThesisOfTheDayClient() {
  const [thesis, setThesis] = useState<ThesisOfTheDay | null>(null)
  const [dateKey, setDateKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [voteBusy, setVoteBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, supabase] = await Promise.all([
        fetch('/api/thesis/today'),
        createClient(),
      ])
      const data: ThesisOfTheDayResponse = await res.json()
      setThesis(data.thesis)
      setDateKey(data.date)

      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function vote(agree: boolean) {
    if (!thesis || voteBusy) return
    setVoteBusy(true)

    const prevVote = thesis.viewer_vote
    const wasVoted = prevVote !== null

    // Optimistic update
    const newThesis = { ...thesis }
    if (wasVoted) {
      if (prevVote === agree) {
        // Undo vote
        if (agree) newThesis.agree_count -= 1
        else newThesis.disagree_count -= 1
        newThesis.viewer_vote = null
      } else {
        // Flip vote
        if (agree) { newThesis.agree_count += 1; newThesis.disagree_count -= 1 }
        else { newThesis.agree_count -= 1; newThesis.disagree_count += 1 }
        newThesis.viewer_vote = agree
      }
    } else {
      if (agree) newThesis.agree_count += 1
      else newThesis.disagree_count += 1
      newThesis.viewer_vote = agree
    }
    const newTotal = newThesis.agree_count + newThesis.disagree_count
    newThesis.total_votes = newTotal
    newThesis.agree_pct = newTotal > 0 ? Math.round((newThesis.agree_count / newTotal) * 100) : 50
    setThesis(newThesis)

    try {
      const res = await fetch(`/api/thesis/${thesis.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agree }),
      })
      if (!res.ok) {
        // revert
        setThesis(thesis)
      }
    } catch {
      setThesis(thesis)
    } finally {
      setVoteBusy(false)
    }
  }

  async function handleShare() {
    if (!thesis) return
    try {
      await shareThesis(thesis)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const cat = thesis ? getCatStyle(thesis.category) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 text-gold mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Thesis of the Day</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900">{todayLabel()}</h1>
          <p className="text-sm text-surface-500 mt-1">
            One civic prediction spotlighted daily — the most engaged, most contested thesis on the Lobby.
          </p>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ThesisSkeleton />
            </motion.div>
          ) : !thesis ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<Sparkles className="w-8 h-8" />}
                title="No thesis today"
                description="Come back tomorrow — or be the first to stake your civic prediction."
                action={
                  <Link href="/thesis/create">
                    <Button size="sm">Write a Thesis</Button>
                  </Link>
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key="thesis"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Main card */}
              <div className={cn(
                'rounded-2xl border bg-surface-50 overflow-hidden shadow-lg',
                cat?.border,
              )}>
                {/* Gold spotlight banner */}
                <div className="bg-gradient-to-r from-gold/20 via-gold/10 to-transparent px-6 py-3 flex items-center gap-2 border-b border-gold/20">
                  <Trophy className="w-4 h-4 text-gold" />
                  <span className="text-xs font-semibold text-gold uppercase tracking-wider">
                    Today's Spotlight
                  </span>
                  <span className="ml-auto text-xs text-surface-500">{dateKey}</span>
                </div>

                <div className="p-6 space-y-5">
                  {/* Category + meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize',
                      cat?.text, cat?.bg, cat?.border,
                    )}>
                      {thesis.category}
                    </span>
                    {thesis.days_until_resolution !== null && (
                      <span className="text-xs text-surface-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {thesis.days_until_resolution === 0
                          ? 'Resolves today'
                          : `${thesis.days_until_resolution}d until resolution`}
                      </span>
                    )}
                  </div>

                  {/* Statement */}
                  <blockquote className="text-xl font-semibold text-surface-900 leading-snug">
                    &ldquo;{thesis.statement}&rdquo;
                  </blockquote>

                  {/* Rationale */}
                  {thesis.rationale && (
                    <p className="text-sm text-surface-400 leading-relaxed border-l-2 border-surface-200 pl-3">
                      {thesis.rationale}
                    </p>
                  )}

                  {/* Author */}
                  {thesis.author && (
                    <Link
                      href={`/profile/${thesis.author.username}`}
                      className="flex items-center gap-2.5 group"
                    >
                      <Avatar
                        src={thesis.author.avatar_url}
                        fallback={thesis.author.display_name ?? thesis.author.username}
                        size="sm"
                      />
                      <div>
                        <span className="text-sm font-medium text-surface-800 group-hover:text-for-400 transition-colors">
                          {thesis.author.display_name ?? thesis.author.username}
                        </span>
                        <span className="text-xs text-surface-500 ml-1.5">@{thesis.author.username}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )}

                  {/* Related topic */}
                  {thesis.related_topic_id && thesis.related_topic_statement && (
                    <Link
                      href={`/topic/${thesis.related_topic_id}`}
                      className="flex items-start gap-2 rounded-xl bg-surface-100 hover:bg-surface-200 transition-colors p-3 group"
                    >
                      <Scale className="w-4 h-4 text-for-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-surface-500 mb-0.5">Related topic</p>
                        <p className="text-sm text-surface-800 line-clamp-2 group-hover:text-for-400 transition-colors">
                          {thesis.related_topic_statement}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" />
                    </Link>
                  )}

                  {/* Vote bar */}
                  <VoteBar agreePct={thesis.agree_pct} total={thesis.total_votes} />

                  {/* Vote buttons */}
                  {userId ? (
                    <div className="flex gap-3">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => vote(true)}
                        disabled={voteBusy}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
                          thesis.viewer_vote === true
                            ? 'bg-emerald text-white shadow-lg shadow-emerald/20'
                            : 'bg-surface-100 text-surface-700 hover:bg-emerald/10 hover:text-emerald border border-transparent hover:border-emerald/30',
                        )}
                      >
                        {voteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                        {thesis.viewer_vote === true ? 'Agreed' : 'I Agree'}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => vote(false)}
                        disabled={voteBusy}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
                          thesis.viewer_vote === false
                            ? 'bg-against-500 text-white shadow-lg shadow-against-500/20'
                            : 'bg-surface-100 text-surface-700 hover:bg-against-500/10 hover:text-against-400 border border-transparent hover:border-against-500/30',
                        )}
                      >
                        {voteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                        {thesis.viewer_vote === false ? 'Disagreed' : 'I Disagree'}
                      </motion.button>
                    </div>
                  ) : (
                    <Link href="/login" className="block">
                      <Button className="w-full" variant="default">
                        Sign in to vote
                      </Button>
                    </Link>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1">
                    <Link href={`/thesis/${thesis.id}`} className="flex-1">
                      <Button variant="ghost" size="sm" className="w-full gap-2">
                        <BookOpen className="w-4 h-4" />
                        Full discussion
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShare}
                      className="gap-2"
                    >
                      {copied ? (
                        <><Check className="w-4 h-4 text-emerald" /> Copied</>
                      ) : (
                        <><Share2 className="w-4 h-4" /> Share</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Total Votes',
                    value: thesis.total_votes.toLocaleString(),
                    icon: <Scale className="w-4 h-4" />,
                    color: 'text-for-400',
                  },
                  {
                    label: 'Agree',
                    value: `${thesis.agree_pct}%`,
                    icon: <ThumbsUp className="w-4 h-4" />,
                    color: 'text-emerald',
                  },
                  {
                    label: 'Contestedness',
                    value: `${Math.round(100 - Math.abs(thesis.agree_pct - 50) * 2)}%`,
                    icon: <Flame className="w-4 h-4" />,
                    color: 'text-gold',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-surface-100 bg-surface-50 p-3 text-center"
                  >
                    <div className={cn('flex justify-center mb-1', stat.color)}>{stat.icon}</div>
                    <div className={cn('text-lg font-bold', stat.color)}>{stat.value}</div>
                    <div className="text-xs text-surface-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Footer nav */}
              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/thesis"
                  className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  All Theses
                </Link>
                <Link
                  href="/thesis/hot"
                  className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 transition-colors"
                >
                  <Flame className="w-4 h-4" />
                  Hot Today
                </Link>
                <Link
                  href="/thesis/create"
                  className="flex items-center gap-1.5 text-sm text-for-400 hover:text-for-300 transition-colors font-medium"
                >
                  Write a Thesis
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
