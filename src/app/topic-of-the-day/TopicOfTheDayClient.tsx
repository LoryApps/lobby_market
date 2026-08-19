'use client'

/**
 * /topic-of-the-day — The Civic Spotlight
 *
 * A daily featured debate — the single most debated active topic on the
 * platform today. Stable for the UTC day, rotates at midnight.
 *
 * Distinct from:
 *   /today          — platform-wide daily pulse (multiple topics/stats)
 *   /trending       — algorithmic trending feed (multiple topics)
 *   /argument-of-the-day — spotlight on a single argument, not a topic
 *   /brief          — AI-curated daily briefing
 *
 * This is the definitive answer to "what should I engage with today?"
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  MapPin,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { SpotlightTopic } from './page'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Society:     'text-against-400',
  Environment: 'text-emerald',
  Health:      'text-against-300',
  Education:   'text-gold',
  Law:         'text-surface-400',
  Defense:     'text-for-300',
}

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Final Vote',
  law:      'Now Law',
  failed:   'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function useCountdown(targetMidnightUTC: number) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((targetMidnightUTC - Date.now()) / 1000)))

  useEffect(() => {
    const id = setInterval(() => {
      setSecs(Math.max(0, Math.floor((targetMidnightUTC - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [targetMidnightUTC])

  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getSpotlightReason(topic: SpotlightTopic): { icon: typeof Flame; text: string } {
  const pct = topic.blue_pct ?? 50
  if (topic.status === 'voting') {
    if (pct >= 60) return { icon: Gavel, text: 'Near consensus — this debate may become law today.' }
    return { icon: Gavel, text: 'In final voting — the community is deciding right now.' }
  }
  if (pct >= 72) return { icon: Zap, text: 'Strong majority forming — consensus building fast.' }
  if (pct <= 38) return { icon: Scale, text: 'Contested and polarised — both sides are fighting hard.' }
  if (Math.abs(pct - 50) <= 7) return { icon: Scale, text: 'Deadlocked — one of the closest debates on the platform.' }
  if (topic.total_votes >= 1000) return { icon: Flame, text: "One of today's most voted debates — high civic energy." }
  return { icon: Sparkles, text: "Today's most engaged civic debate — your voice counts." }
}

function useTodayDate(): string {
  return useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }, [])
}

// ─── Argument Card ─────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
}: {
  arg: SpotlightTopic['for_arg'] | SpotlightTopic['against_arg']
  side: 'blue' | 'red'
}) {
  const isFor = side === 'blue'

  if (!arg) {
    return (
      <div className={cn(
        'rounded-xl border p-5 flex flex-col gap-3',
        isFor
          ? 'border-for-500/20 bg-for-600/5'
          : 'border-against-500/20 bg-against-600/5',
      )}>
        <div className="flex items-center gap-2">
          {isFor
            ? <ThumbsUp className="h-4 w-4 text-for-400" />
            : <ThumbsDown className="h-4 w-4 text-against-400" />}
          <span className={cn('text-xs font-mono font-bold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400',
          )}>
            Top {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
        <p className="text-sm text-surface-500 italic">No arguments yet — be the first to make the case.</p>
      </div>
    )
  }

  const displayName = arg.author_display_name || arg.author_username || 'Citizen'

  return (
    <div className={cn(
      'rounded-xl border p-5 flex flex-col gap-3',
      isFor
        ? 'border-for-500/25 bg-for-600/5'
        : 'border-against-500/25 bg-against-600/5',
    )}>
      {/* Side label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFor
            ? <ThumbsUp className="h-4 w-4 text-for-400" />
            : <ThumbsDown className="h-4 w-4 text-against-400" />}
          <span className={cn('text-xs font-mono font-bold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400',
          )}>
            Top {isFor ? 'FOR' : 'AGAINST'} Argument
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          {fmt(arg.upvotes)}
        </span>
      </div>

      {/* Argument text */}
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-4">
        &ldquo;{arg.content}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-2 pt-1 border-t border-surface-200">
        <Avatar
          src={arg.author_avatar_url}
          fallback={displayName}
          size="xs"
        />
        <Link
          href={`/u/${arg.author_username}`}
          className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          {displayName}
        </Link>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  topic: SpotlightTopic
}

export function TopicOfTheDayClient({ topic }: Props) {
  // Midnight UTC countdown target
  const midnightUTC = useMemo(() => {
    const now = new Date()
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    return tomorrow.getTime()
  }, [])

  const countdown = useCountdown(midnightUTC)
  const todayDate = useTodayDate()
  const reason = getSpotlightReason(topic)
  const ReasonIcon = reason.icon

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const categoryColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-400'
  const topicUrl = typeof window !== 'undefined' ? `${window.location.origin}/topic/${topic.id}` : `/topic/${topic.id}`

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-for-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-80 h-80 bg-against-600/4 rounded-full blur-3xl" />
      </div>

      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <span className="text-xs font-mono font-bold text-gold uppercase tracking-widest">
                    Civic Spotlight
                  </span>
                </div>
                <h1 className="text-lg font-mono font-bold text-white">
                  Topic of the Day
                </h1>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 mb-0.5">
                  <Calendar className="h-3 w-3" />
                  {todayDate}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-surface-600">
                  <RefreshCw className="h-3 w-3" />
                  Next in {countdown}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Spotlight reason banner ──────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gold/20 bg-gold/5"
          >
            <ReasonIcon className="h-4 w-4 text-gold flex-shrink-0" />
            <p className="text-sm text-gold/90 leading-snug">{reason.text}</p>
          </motion.div>

          {/* ── Main topic card ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
          >
            {/* Card header */}
            <div className="p-5 border-b border-surface-200">
              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
                  {STATUS_LABELS[topic.status] ?? topic.status}
                </Badge>
                {topic.category && (
                  <span className={cn('text-xs font-mono font-semibold', categoryColor)}>
                    {topic.category}
                  </span>
                )}
                {topic.scope && topic.scope !== 'Global' && (
                  <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
                    <MapPin className="h-3 w-3" />
                    {topic.scope}
                  </span>
                )}
                {topic.scope === 'Global' && (
                  <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
                    <Globe className="h-3 w-3" />
                    Global
                  </span>
                )}
              </div>

              {/* Statement */}
              <h2 className="text-xl font-bold text-white leading-tight mb-4">
                {topic.statement}
              </h2>

              {/* Description if available */}
              {topic.description && (
                <p className="text-sm text-surface-600 leading-relaxed mb-4 line-clamp-3">
                  {topic.description}
                </p>
              )}

              {/* Vote split bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-for-400 font-semibold">{forPct}% FOR</span>
                  <span className="text-surface-500">{fmt(topic.total_votes)} votes</span>
                  <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden bg-against-900/50 flex">
                  <motion.div
                    className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-l-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${forPct}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                  />
                  <div className="flex-1 bg-gradient-to-r from-against-400 to-against-600 rounded-r-full" />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-surface-200 border-b border-surface-200">
              {[
                { icon: Users, label: 'Votes Cast', value: fmt(topic.total_votes) },
                { icon: BarChart2, label: 'FOR %', value: `${forPct}%` },
                { icon: MessageSquare, label: 'Arguments', value: '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center py-4 gap-1">
                  <Icon className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-base font-mono font-bold text-white">{value}</span>
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="p-4 flex items-center gap-3">
              <Link href={`/topic/${topic.id}`} className="flex-1">
                <Button variant="for" size="md" className="w-full gap-2">
                  <ThumbsUp className="h-4 w-4" />
                  Vote & Debate
                </Button>
              </Link>
              <Link href={`/topic/${topic.id}/arguments`}>
                <Button variant="secondary" size="md" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Arguments
                </Button>
              </Link>
              <SharePanel
                url={topicUrl}
                text={`Today's Civic Spotlight: "${topic.statement.slice(0, 80)}…" — ${forPct}% FOR · Lobby Market`}
                topicId={topic.id}
              />
            </div>
          </motion.div>

          {/* ── Top Arguments ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h3 className="text-sm font-mono font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Best Arguments Today
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ArgumentCard arg={topic.for_arg} side="blue" />
              <ArgumentCard arg={topic.against_arg} side="red" />
            </div>
            <Link
              href={`/topic/${topic.id}/arguments`}
              className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors py-2"
            >
              See all arguments
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>

          {/* ── Related actions ───────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-surface-200">
              <h3 className="text-sm font-mono font-bold text-white">Go deeper</h3>
            </div>
            <div className="divide-y divide-surface-200">
              {[
                {
                  href: `/topic/${topic.id}/debate`,
                  icon: MessageSquare,
                  label: 'Watch the live debate',
                  desc: 'Real-time arguments and rebuttals',
                  color: 'text-purple',
                },
                {
                  href: `/topic/${topic.id}/vote-trend`,
                  icon: BarChart2,
                  label: 'Consensus trend',
                  desc: 'How opinion has shifted over time',
                  color: 'text-for-400',
                },
                {
                  href: `/topic/${topic.id}/synthesis`,
                  icon: Sparkles,
                  label: 'AI synthesis',
                  desc: 'Key points distilled from all arguments',
                  color: 'text-gold',
                },
                {
                  href: `/topic/${topic.id}/voters`,
                  icon: Users,
                  label: 'Who voted',
                  desc: 'The voters shaping this debate',
                  color: 'text-emerald',
                },
              ].map(({ href, icon: Icon, label, desc, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-200/50 transition-colors group"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium group-hover:text-for-300 transition-colors">{label}</p>
                    <p className="text-xs text-surface-500">{desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* ── Daily context ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="rounded-xl border border-surface-300 bg-surface-100 p-5"
          >
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-surface-500 mb-1">
                  Daily spotlight · Resets at midnight UTC
                </p>
                <p className="text-xs text-surface-600 leading-relaxed">
                  Every day, the Civic Spotlight surfaces the debate with the highest civic energy —
                  a combination of vote velocity, argument quality, and community attention.
                  Check back tomorrow for a new spotlight.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href="/trending"
                    className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                  >
                    See all trending <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    href="/today"
                    className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    Today&apos;s full digest <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── No active topics fallback note ────────────────────────── */}
          <div className="text-center">
            <p className="text-xs font-mono text-surface-600">
              Day #{topic.day_ordinal} of civic debate · Lobby Market
            </p>
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
