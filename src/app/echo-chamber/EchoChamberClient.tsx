'use client'

/**
 * /echo-chamber — Civic Echo Chamber Detector
 *
 * Shows the user where their social follow graph creates a one-sided view
 * of debates, and suggests diverse voices to broaden their civic perspective.
 *
 * Distinct from:
 *   /calibration  — calibrate your topic preferences by category
 *   /bias-check   — analyse your voting patterns for systematic bias
 *   /fingerprint  — your unique civic DNA summary
 *   /blindspots   — topics/categories you've never engaged with
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  EchoChamberResponse,
  EchoChamberTopic,
  EchoChamberUser,
} from '@/app/api/echo-chamber/route'

// ─── Diversity gauge ──────────────────────────────────────────────────────────

function DiversityGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  const color =
    pct >= 70 ? 'text-emerald' : pct >= 40 ? 'text-gold' : 'text-against-400'
  const label =
    pct >= 70 ? 'Diverse' : pct >= 40 ? 'Moderate' : 'Echo Chamber'
  const ringColor =
    pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'

  const circumference = 2 * Math.PI * 40
  const dashOffset = circumference * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#24242e"
            strokeWidth="10"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold font-mono', color)}>{pct}</span>
          <span className="text-[10px] text-surface-500 uppercase tracking-wider">score</span>
        </div>
      </div>
      <span className={cn('text-sm font-semibold', color)}>{label}</span>
    </div>
  )
}

// ─── Echo bar ─────────────────────────────────────────────────────────────────

function EchoBar({ forPct, againstPct }: { forPct: number; againstPct: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono">
      <span className="text-for-400 w-8 text-right">{forPct}%</span>
      <div className="flex-1 h-2 rounded-full bg-surface-300/60 overflow-hidden flex">
        <motion.div
          className="h-full bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-against-500"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-against-400 w-8">{againstPct}%</span>
    </div>
  )
}

// ─── Echo topic card ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Politics: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  Technology: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  Science: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Ethics: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  Culture: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Health: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Environment: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Education: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
}

function getCategory(cat: string | null) {
  return CAT_COLOR[cat ?? ''] ?? {
    text: 'text-surface-500',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/30',
  }
}

function EchoTopicCard({ topic }: { topic: EchoChamberTopic }) {
  const [expanded, setExpanded] = useState(false)
  const catStyle = getCategory(topic.category)
  const consensusLabel = topic.follow_for_pct >= topic.follow_against_pct ? 'FOR' : 'AGAINST'
  const consensusColor =
    topic.follow_for_pct >= topic.follow_against_pct ? 'text-for-400' : 'text-against-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-200/60 border border-surface-300/60 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {topic.category && (
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border mb-2',
                  catStyle.text,
                  catStyle.bg,
                  catStyle.border
                )}
              >
                {topic.category}
              </span>
            )}
            <Link
              href={`/topic/${topic.id}`}
              className="block text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-2"
            >
              {topic.statement}
            </Link>
          </div>

          {/* Echo intensity badge */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div
              className={cn(
                'px-2 py-1 rounded-lg text-[10px] font-mono font-bold',
                topic.echo_score >= 80
                  ? 'bg-against-500/20 text-against-300 border border-against-500/30'
                  : topic.echo_score >= 50
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'bg-surface-300/40 text-surface-500 border border-surface-400/30'
              )}
            >
              {topic.echo_score}% echo
            </div>
            <Link
              href={`/topic/${topic.id}`}
              className="text-surface-500 hover:text-surface-400 transition-colors"
              aria-label="Open topic"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Follow consensus bar */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-surface-500">
            <span>Your follows:</span>
            <span>
              <span className={consensusColor}>{consensusLabel}</span>
              {' '}consensus · {topic.follow_voters} voter{topic.follow_voters !== 1 ? 's' : ''}
            </span>
          </div>
          <EchoBar forPct={topic.follow_for_pct} againstPct={topic.follow_against_pct} />
        </div>

        {/* User vote indicator */}
        {topic.user_vote !== null && (
          <div
            className={cn(
              'mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg',
              topic.user_agrees
                ? 'bg-surface-300/40 text-surface-400'
                : 'bg-emerald/10 text-emerald border border-emerald/30'
            )}
          >
            {topic.user_agrees ? (
              <>
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                You agree with your follows
              </>
            ) : (
              <>
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                You voted differently — good divergence
              </>
            )}
          </div>
        )}
      </div>

      {/* Contrarian argument toggle */}
      {topic.contrarian_argument && (
        <>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-300/30 hover:bg-surface-300/50 border-t border-surface-300/40 transition-colors text-left"
            aria-expanded={expanded}
          >
            <MessageSquare className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 text-[11px] text-surface-400 font-medium">
              Best contrarian argument ({topic.contrarian_argument.side === 'blue' ? 'FOR' : 'AGAINST'})
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-3 bg-surface-100/40 border-t border-surface-300/30">
                  <div
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider mb-2',
                      topic.contrarian_argument.side === 'blue'
                        ? 'text-for-400'
                        : 'text-against-400'
                    )}
                  >
                    {topic.contrarian_argument.side === 'blue' ? 'FOR' : 'AGAINST'}
                    {' '}·{' '}
                    <span className="text-surface-500 normal-case font-normal">
                      {topic.contrarian_argument.upvotes} upvotes
                    </span>
                  </div>
                  <p className="text-sm text-surface-600 leading-relaxed line-clamp-4">
                    &ldquo;{topic.contrarian_argument.content}&rdquo;
                  </p>
                  {topic.contrarian_argument.author_username && (
                    <Link
                      href={`/profile/${topic.contrarian_argument.author_username}`}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors"
                    >
                      <span>—</span>
                      <span className="font-medium">
                        {topic.contrarian_argument.author_display_name ??
                          `@${topic.contrarian_argument.author_username}`}
                      </span>
                    </Link>
                  )}
                  <div className="mt-3">
                    <Link
                      href={`/topic/${topic.id}/arguments`}
                      className="inline-flex items-center gap-1.5 text-[11px] text-for-400 hover:text-for-300 transition-colors font-medium"
                    >
                      See all arguments
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

// ─── Diverse follow card ───────────────────────────────────────────────────────

function DiverseFollowCard({ person }: { person: EchoChamberUser }) {
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function follow() {
    if (busy || following) return
    setBusy(true)
    try {
      await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: person.id }),
      })
      setFollowing(true)
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-200/60 border border-surface-300/60 rounded-xl hover:border-surface-400/60 transition-colors">
      <Link href={`/profile/${person.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
        <Avatar
          src={person.avatar_url}
          fallback={person.display_name || person.username}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {person.display_name || person.username}
          </p>
          <p className="text-[11px] text-surface-500 truncate">@{person.username}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[10px] text-emerald font-mono font-semibold">
              {person.disagreement_rate}% disagrees
            </span>
            <span className="text-[10px] text-surface-500">
              · {person.shared_topics} shared topics
            </span>
          </div>
        </div>
      </Link>
      <button
        onClick={follow}
        disabled={busy || following}
        aria-label={`Follow @${person.username}`}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
          following
            ? 'bg-emerald/20 text-emerald border border-emerald/30'
            : 'bg-for-600 hover:bg-for-700 text-white'
        )}
      >
        {following ? (
          <>
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" aria-hidden="true" />
            Follow
          </>
        )}
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EchoChamberClient() {
  const [data, setData] = useState<EchoChamberResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/echo-chamber')
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to see your echo chamber analysis.')
        } else {
          setError('Failed to load echo chamber data.')
        }
        return
      }
      const json = (await res.json()) as EchoChamberResponse
      setData(json)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-28">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="p-2 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Echo Chamber</h1>
            <p className="text-xs text-surface-500">Where your follow network votes as one</p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="text-center py-16 space-y-4">
            <AlertTriangle className="h-10 w-10 text-against-500 mx-auto" aria-hidden="true" />
            <p className="text-surface-500 text-sm">{error}</p>
            {error.includes('Sign in') ? (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 px-4 py-2 bg-for-600 hover:bg-for-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Sign in
              </Link>
            ) : (
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-200 border border-surface-300 text-surface-400 text-sm font-medium rounded-xl hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Loaded state */}
        {!loading && data && !error && (
          <div className="space-y-6">
            {/* Stats header */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-200/60 border border-surface-300/60 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-white mb-1">Your Diversity Score</h2>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Measures how often your follow network gives you balanced perspectives.
                    Higher is healthier.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-surface-300/40 rounded-xl p-3">
                      <p className="text-2xl font-bold font-mono text-white">
                        {data.following_count}
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5">Following</p>
                    </div>
                    <div className="bg-surface-300/40 rounded-xl p-3">
                      <p
                        className={cn(
                          'text-2xl font-bold font-mono',
                          data.echo_topics_count === 0
                            ? 'text-emerald'
                            : data.echo_topics_count <= 3
                            ? 'text-gold'
                            : 'text-against-400'
                        )}
                      >
                        {data.echo_topics_count}
                      </p>
                      <p className="text-[11px] text-surface-500 mt-0.5">Echo topics</p>
                    </div>
                  </div>
                </div>
                <DiversityGauge score={data.diversity_score} />
              </div>

              {/* Explanation row */}
              <div
                className={cn(
                  'mt-4 flex items-start gap-2.5 p-3 rounded-xl text-xs',
                  data.diversity_score >= 70
                    ? 'bg-emerald/10 border border-emerald/20 text-emerald'
                    : data.diversity_score >= 40
                    ? 'bg-gold/10 border border-gold/20 text-gold'
                    : 'bg-against-500/10 border border-against-500/20 text-against-300'
                )}
              >
                {data.diversity_score >= 70 ? (
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                ) : data.diversity_score >= 40 ? (
                  <Scale className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>
                  {data.diversity_score >= 70
                    ? 'Your feed exposes you to multiple viewpoints. Keep following diverse voices.'
                    : data.diversity_score >= 40
                    ? 'Your feed is somewhat balanced but there are a few echo chambers to watch.'
                    : 'Your follow network is creating blind spots. Consider following people who challenge your views.'}
                </span>
              </div>
            </motion.div>

            {/* No follows yet */}
            {data.following_count === 0 && (
              <EmptyState
                icon={Users}
                title="Follow people first"
                description="Follow citizens with different viewpoints to see your echo chamber analysis."
                action={
                  <Link
                    href="/discover"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-for-600 hover:bg-for-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Discover people
                  </Link>
                }
              />
            )}

            {/* No echo chambers */}
            {data.following_count > 0 && data.echo_topics_count === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald/5 border border-emerald/20 rounded-2xl p-6 text-center"
              >
                <ShieldCheck className="h-10 w-10 text-emerald mx-auto mb-3" aria-hidden="true" />
                <h3 className="text-base font-bold text-white mb-1">No echo chambers detected</h3>
                <p className="text-xs text-surface-500 max-w-xs mx-auto">
                  Your follow network holds a range of viewpoints. Your civic feed is genuinely diverse.
                </p>
              </motion.div>
            )}

            {/* Echo chamber topics */}
            {data.echo_topics.length > 0 && (
              <section aria-label="Echo chamber topics">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-against-400" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-white">
                    {data.echo_topics.length} echo chamber{data.echo_topics.length !== 1 ? 's' : ''} detected
                  </h2>
                </div>
                <p className="text-[11px] text-surface-500 mb-4">
                  On these topics, your follows overwhelmingly vote the same way — you may be missing the other side.
                </p>
                <div className="space-y-3">
                  {data.echo_topics.map((topic) => (
                    <EchoTopicCard key={topic.id} topic={topic} />
                  ))}
                </div>
              </section>
            )}

            {/* Diverse follows suggestions */}
            {data.diverse_follows.length > 0 && (
              <section aria-label="Diverse voices to follow">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-white">Broaden your perspective</h2>
                </div>
                <p className="text-[11px] text-surface-500 mb-4">
                  These citizens frequently vote differently from you on topics you both care about.
                </p>
                <div className="space-y-2">
                  {data.diverse_follows.map((person) => (
                    <DiverseFollowCard key={person.id} person={person} />
                  ))}
                </div>
              </section>
            )}

            {/* How it works */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-surface-200/40 border border-surface-300/40 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-surface-500" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  How this works
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-surface-500">
                <li className="flex items-start gap-2">
                  <span className="text-for-400 font-mono mt-0.5">01.</span>
                  <span>
                    We look at topics where both you and your follows have voted.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-for-400 font-mono mt-0.5">02.</span>
                  <span>
                    A topic is an echo chamber if 75%+ of your follows vote the same way on it.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-for-400 font-mono mt-0.5">03.</span>
                  <span>
                    Your diversity score reflects how often your feed gives you balanced viewpoints.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-for-400 font-mono mt-0.5">04.</span>
                  <span>
                    Suggested follows are citizens who frequently disagree with you — constructively.
                  </span>
                </li>
              </ul>
            </motion.div>

            {/* Related pages */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/calibration', label: 'Calibration', icon: Zap, color: 'text-gold' },
                { href: '/bias', label: 'Bias Check', icon: Scale, color: 'text-purple' },
                { href: '/blindspots', label: 'Blindspots', icon: AlertTriangle, color: 'text-against-400' },
                { href: '/fingerprint', label: 'Civic DNA', icon: Shield, color: 'text-emerald' },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 p-3 bg-surface-200/50 border border-surface-300/50 rounded-xl hover:border-surface-400/60 transition-colors"
                >
                  <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                  <span className="text-xs font-medium text-surface-400">{label}</span>
                  <ArrowRight className="h-3 w-3 text-surface-500 ml-auto" aria-hidden="true" />
                </Link>
              ))}
            </div>

            {/* Refresh */}
            <div className="flex justify-center pt-2">
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 text-xs text-surface-500 hover:text-surface-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Refresh analysis
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
