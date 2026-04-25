'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Gavel,
  Loader2,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { WrappedData } from '@/app/api/analytics/wrapped/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debator',
    troll_catcher: 'Troll Catcher',
    elder: 'Elder',
    lawmaker: 'Lawmaker',
    senator: 'Senator',
  }
  return map[role] ?? role
}

function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    elder: 'border-gold/40 text-gold bg-gold/10',
    senator: 'border-purple/40 text-purple bg-purple/10',
    lawmaker: 'border-gold/60 text-gold bg-gold/20',
    debator: 'border-for-500/40 text-for-300 bg-for-500/10',
    troll_catcher: 'border-emerald/40 text-emerald bg-emerald/10',
    person: 'border-surface-400 text-surface-500 bg-surface-300/20',
  }
  return map[role] ?? 'border-surface-400 text-surface-500'
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
  Uncategorized: 'text-surface-500',
}

const CAT_BG: Record<string, string> = {
  Economics: 'bg-gold/10 border-gold/30',
  Politics: 'bg-for-500/10 border-for-500/30',
  Technology: 'bg-purple/10 border-purple/30',
  Science: 'bg-emerald/10 border-emerald/30',
  Ethics: 'bg-against-500/10 border-against-500/30',
  Philosophy: 'bg-for-400/10 border-for-400/30',
  Culture: 'bg-gold/10 border-gold/30',
  Health: 'bg-emerald/10 border-emerald/30',
  Environment: 'bg-emerald/10 border-emerald/30',
  Education: 'bg-purple/10 border-purple/30',
  Uncategorized: 'bg-surface-300/20 border-surface-400',
}

function catColor(name: string): string {
  return CAT_COLOR[name] ?? 'text-surface-500'
}

function catBg(name: string): string {
  return CAT_BG[name] ?? 'bg-surface-300/20 border-surface-400'
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// ─── Slide components ──────────────────────────────────────────────────────────

// Slide 0: Intro
function SlideIntro({ data, active }: { data: WrappedData; active: boolean }) {
  const since = new Date(data.profile.created_at)
  const sinceLabel = since.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'backOut' }}
      >
        <Avatar
          src={data.profile.avatar_url}
          fallback={data.profile.display_name ?? data.profile.username}
          size="lg"
          className="ring-4 ring-for-500/30 ring-offset-4 ring-offset-surface-100 !w-20 !h-20"
        />
      </motion.div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="space-y-2"
      >
        <p className="font-mono text-sm text-surface-500 tracking-widest uppercase">
          {data.period_label} · Lobby Wrapped
        </p>
        <h1 className="font-mono text-4xl font-black text-white leading-tight">
          {data.profile.display_name ?? data.profile.username}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className={cn('font-mono text-xs px-2 py-0.5 rounded border', roleBadgeClass(data.profile.role))}>
            {roleLabel(data.profile.role)}
          </span>
          <span className="font-mono text-xs text-surface-500">since {sinceLabel}</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="flex items-center gap-6"
      >
        <div className="text-center">
          <p className="font-mono text-2xl font-bold text-white">{data.profile.clout.toLocaleString()}</p>
          <p className="font-mono text-xs text-surface-500">clout</p>
        </div>
        <div className="w-px h-8 bg-surface-300" />
        <div className="text-center">
          <p className="font-mono text-2xl font-bold text-white">{data.profile.reputation_score.toLocaleString()}</p>
          <p className="font-mono text-xs text-surface-500">reputation</p>
        </div>
        <div className="w-px h-8 bg-surface-300" />
        <div className="text-center">
          <p className="font-mono text-2xl font-bold text-gold">{data.profile.vote_streak}</p>
          <p className="font-mono text-xs text-surface-500">streak</p>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="font-mono text-sm text-surface-500 max-w-xs"
      >
        Your civic year — every vote, every argument, every impact.
      </motion.p>
    </div>
  )
}

// Slide 1: Votes
function SlideVotes({ data, active }: { data: WrappedData; active: boolean }) {
  const forPct = data.profile.total_votes > 0
    ? Math.round((data.profile.blue_vote_count / data.profile.total_votes) * 100)
    : 50
  const againstPct = 100 - forPct
  const vsAvg = data.platform_avg_votes > 0
    ? Math.round(((data.votes_this_year - data.platform_avg_votes) / data.platform_avg_votes) * 100)
    : 0

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'backOut' }}
        className="flex items-center justify-center w-28 h-28 rounded-full bg-for-500/10 border-2 border-for-500/30"
      >
        <Scale className="w-12 h-12 text-for-400" />
      </motion.div>

      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 32, opacity: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="space-y-2"
      >
        <p className="font-mono text-sm text-surface-500 uppercase tracking-widest">You voted</p>
        <div className="font-mono text-7xl font-black text-white tabular-nums">
          {active ? <AnimatedNumber value={data.votes_this_year} /> : 0}
        </div>
        <p className="font-mono text-xl text-surface-400">times in {data.year}</p>
      </motion.div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="w-full max-w-xs space-y-3"
      >
        {/* FOR/AGAINST bar */}
        <div className="h-3 rounded-full overflow-hidden bg-surface-300 flex">
          <motion.div
            className="h-full bg-for-500 rounded-l-full"
            initial={{ width: 0 }}
            animate={active ? { width: `${forPct}%` } : { width: 0 }}
            transition={{ delay: 0.7, duration: 0.8, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full bg-against-500 rounded-r-full"
            initial={{ width: 0 }}
            animate={active ? { width: `${againstPct}%` } : { width: 0 }}
            transition={{ delay: 0.7, duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between font-mono text-sm">
          <span className="text-for-400 flex items-center gap-1">
            <ThumbsUp className="w-3.5 h-3.5" />
            {forPct}% FOR
          </span>
          <span className="text-against-400 flex items-center gap-1">
            {againstPct}% AGAINST
            <ThumbsDown className="w-3.5 h-3.5" />
          </span>
        </div>
      </motion.div>

      {vsAvg !== 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className={cn(
            'font-mono text-sm px-4 py-2 rounded-lg border',
            vsAvg > 0
              ? 'bg-emerald/10 border-emerald/30 text-emerald'
              : 'bg-surface-300/30 border-surface-400 text-surface-500'
          )}
        >
          {vsAvg > 0 ? '+' : ''}{vsAvg}% vs. platform average
        </motion.div>
      )}
    </div>
  )
}

// Slide 2: Category
function SlideCategory({ data, active }: { data: WrappedData; active: boolean }) {
  const top = data.top_category
  const maxCount = data.all_categories[0]?.count ?? 1

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: -20, opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <p className="font-mono text-sm text-surface-500 uppercase tracking-widest">Your civic home</p>
        <p className="font-mono text-lg text-surface-400">Where you debate the most</p>
      </motion.div>

      {top && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={active ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: 'backOut' }}
          className={cn(
            'px-8 py-4 rounded-2xl border-2 text-center',
            catBg(top.category)
          )}
        >
          <p className={cn('font-mono text-4xl font-black', catColor(top.category))}>
            {top.category}
          </p>
          <p className="font-mono text-sm text-surface-400 mt-1">
            {top.count} vote{top.count !== 1 ? 's' : ''} ·{' '}
            <span className={
              top.side === 'for' ? 'text-for-400' : top.side === 'against' ? 'text-against-400' : 'text-surface-400'
            }>
              mostly {top.side === 'for' ? 'FOR' : top.side === 'against' ? 'AGAINST' : 'balanced'}
            </span>
          </p>
        </motion.div>
      )}

      {!top && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          className="text-surface-500 font-mono text-sm"
        >
          No votes yet this year.
        </motion.div>
      )}

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="w-full max-w-xs space-y-2"
      >
        {data.all_categories.slice(0, 5).map((cat, i) => (
          <div key={cat.category} className="flex items-center gap-2">
            <span className={cn('font-mono text-xs w-24 text-right truncate', catColor(cat.category))}>
              {cat.category}
            </span>
            <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', i === 0 ? 'bg-for-500' : 'bg-for-600')}
                style={{ opacity: 1 - i * 0.15 }}
                initial={{ width: 0 }}
                animate={active ? { width: `${(cat.count / maxCount) * 100}%` } : { width: 0 }}
                transition={{ delay: 0.6 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="font-mono text-xs text-surface-500 w-6 text-right">{cat.count}</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// Slide 3: Impact
function SlideImpact({ data, active }: { data: WrappedData; active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'backOut' }}
        className="flex items-center justify-center w-28 h-28 rounded-full bg-gold/10 border-2 border-gold/30"
      >
        <Gavel className="w-12 h-12 text-gold" />
      </motion.div>

      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 32, opacity: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="space-y-2"
      >
        <p className="font-mono text-sm text-surface-500 uppercase tracking-widest">You helped make</p>
        <div className="font-mono text-7xl font-black text-gold tabular-nums">
          {active ? <AnimatedNumber value={data.laws_supported} /> : 0}
        </div>
        <p className="font-mono text-xl text-surface-400">
          {data.laws_supported === 1 ? 'law' : 'laws'} pass
        </p>
      </motion.div>

      {data.accuracy !== null && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="space-y-2"
        >
          <div className="w-full max-w-xs">
            <div className="flex justify-between font-mono text-xs text-surface-500 mb-1">
              <span>Civic Accuracy</span>
              <span>{data.accuracy}%</span>
            </div>
            <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="h-full bg-emerald rounded-full"
                initial={{ width: 0 }}
                animate={active ? { width: `${data.accuracy}%` } : { width: 0 }}
                transition={{ delay: 0.7, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <p className="font-mono text-xs text-surface-500 mt-1 text-right">
              from {data.resolved_votes} resolved vote{data.resolved_votes !== 1 ? 's' : ''}
            </p>
          </div>
          <p className={cn(
            'font-mono text-sm px-4 py-2 rounded-lg border',
            data.accuracy >= 70
              ? 'bg-emerald/10 border-emerald/30 text-emerald'
              : data.accuracy >= 50
              ? 'bg-gold/10 border-gold/30 text-gold'
              : 'bg-surface-300/30 border-surface-400 text-surface-500'
          )}>
            {data.accuracy >= 70
              ? 'Sharp civic instincts'
              : data.accuracy >= 50
              ? 'On the right side more often than not'
              : 'Contrarian streak — keep debating'}
          </p>
        </motion.div>
      )}

      {data.accuracy === null && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6 }}
          className="font-mono text-sm text-surface-500 max-w-xs"
        >
          Vote on more topics that reach a verdict to unlock your accuracy score.
        </motion.p>
      )}
    </div>
  )
}

// Slide 4: Arguments
function SlideArguments({ data, active }: { data: WrappedData; active: boolean }) {
  const arg = data.best_argument

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'backOut' }}
        className="flex items-center justify-center w-28 h-28 rounded-full bg-purple/10 border-2 border-purple/30"
      >
        <Zap className="w-12 h-12 text-purple" />
      </motion.div>

      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 32, opacity: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="space-y-2"
      >
        <p className="font-mono text-sm text-surface-500 uppercase tracking-widest">You wrote</p>
        <div className="font-mono text-7xl font-black text-purple tabular-nums">
          {active ? <AnimatedNumber value={data.arguments_this_year} /> : 0}
        </div>
        <p className="font-mono text-xl text-surface-400">
          argument{data.arguments_this_year !== 1 ? 's' : ''} in {data.year}
        </p>
      </motion.div>

      {arg && arg.upvotes > 0 && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className={cn(
            'w-full max-w-sm rounded-xl border p-4 text-left',
            arg.side === 'blue'
              ? 'bg-for-500/5 border-for-500/20'
              : 'bg-against-500/5 border-against-500/20'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              'font-mono text-xs px-2 py-0.5 rounded border',
              arg.side === 'blue'
                ? 'bg-for-500/10 border-for-500/30 text-for-400'
                : 'bg-against-500/10 border-against-500/30 text-against-400'
            )}>
              {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
            <span className="font-mono text-xs text-surface-500">
              {arg.upvotes} upvote{arg.upvotes !== 1 ? 's' : ''} · your best
            </span>
          </div>
          <p className="font-mono text-sm text-surface-700 leading-relaxed line-clamp-3">
            &ldquo;{arg.content}&rdquo;
          </p>
          {arg.topic_statement && (
            <p className="font-mono text-xs text-surface-500 mt-2 truncate">
              on: {arg.topic_statement}
            </p>
          )}
        </motion.div>
      )}

      {(!arg || arg.upvotes === 0) && data.arguments_this_year === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6 }}
          className="font-mono text-sm text-surface-500 max-w-xs"
        >
          No arguments written this year. Next year, share your voice.
        </motion.p>
      )}
    </div>
  )
}

// Slide 5: Standing
function SlideStanding({ data, active }: { data: WrappedData; active: boolean }) {
  const isTop10 = data.percentile >= 90
  const isTop25 = data.percentile >= 75
  const isTop50 = data.percentile >= 50

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'backOut' }}
        className={cn(
          'flex items-center justify-center w-28 h-28 rounded-full border-2',
          isTop10
            ? 'bg-gold/10 border-gold/40'
            : isTop25
            ? 'bg-for-500/10 border-for-500/30'
            : 'bg-surface-300/20 border-surface-400'
        )}
      >
        <Trophy className={cn(
          'w-12 h-12',
          isTop10 ? 'text-gold' : isTop25 ? 'text-for-400' : 'text-surface-500'
        )} />
      </motion.div>

      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 32, opacity: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="space-y-2"
      >
        <p className="font-mono text-sm text-surface-500 uppercase tracking-widest">You&apos;re ranked</p>
        <div className={cn(
          'font-mono text-7xl font-black tabular-nums',
          isTop10 ? 'text-gold' : isTop25 ? 'text-for-400' : 'text-white'
        )}>
          {active ? ordinalSuffix(data.leaderboard_rank) : '—'}
        </div>
        <p className="font-mono text-xl text-surface-400">
          of {data.total_users.toLocaleString()} citizens
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="space-y-3"
      >
        {/* Percentile bar */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between font-mono text-xs text-surface-500 mb-1">
            <span>Top {100 - data.percentile + 1}% of the Lobby</span>
            <span>{data.percentile}th percentile</span>
          </div>
          <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                isTop10 ? 'bg-gold' : isTop25 ? 'bg-for-500' : 'bg-surface-500'
              )}
              initial={{ width: 0 }}
              animate={active ? { width: `${data.percentile}%` } : { width: 0 }}
              transition={{ delay: 0.7, duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        <p className={cn(
          'font-mono text-sm px-4 py-2 rounded-lg border',
          isTop10
            ? 'bg-gold/10 border-gold/30 text-gold'
            : isTop25
            ? 'bg-for-500/10 border-for-500/30 text-for-300'
            : isTop50
            ? 'bg-emerald/10 border-emerald/30 text-emerald'
            : 'bg-surface-300/30 border-surface-400 text-surface-500'
        )}>
          {isTop10
            ? 'Elite Lobbyist — your voice carries real weight'
            : isTop25
            ? 'Influential — more active than most citizens'
            : isTop50
            ? 'Engaged — above the median citizen'
            : 'Keep showing up — every vote counts'}
        </p>
      </motion.div>
    </div>
  )
}

// Slide 6: Share
function SlideShare({ data, active, onCopy, copied }: {
  data: WrappedData
  active: boolean
  onCopy: () => void
  copied: boolean
}) {
  const forPct = data.profile.total_votes > 0
    ? Math.round((data.profile.blue_vote_count / data.profile.total_votes) * 100)
    : 50

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: -20, opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-1"
      >
        <p className="font-mono text-sm text-surface-500 uppercase tracking-widest">Your {data.year} in numbers</p>
        <h2 className="font-mono text-2xl font-bold text-white">
          {data.profile.display_name ?? data.profile.username}&apos;s Lobby Wrapped
        </h2>
      </motion.div>

      {/* Summary card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-sm rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
      >
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-mono text-xl font-bold text-white">{data.votes_this_year}</p>
            <p className="font-mono text-xs text-surface-500">votes</p>
          </div>
          <div>
            <p className="font-mono text-xl font-bold text-gold">{data.laws_supported}</p>
            <p className="font-mono text-xs text-surface-500">laws</p>
          </div>
          <div>
            <p className="font-mono text-xl font-bold text-purple">{data.arguments_this_year}</p>
            <p className="font-mono text-xs text-surface-500">arguments</p>
          </div>
        </div>

        <div className="h-px bg-surface-300" />

        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="font-mono text-lg font-bold text-for-400">{forPct}% FOR</p>
            <p className="font-mono text-xs text-surface-500">typical stance</p>
          </div>
          <div>
            <p className={cn(
              'font-mono text-lg font-bold',
              data.accuracy !== null
                ? data.accuracy >= 70 ? 'text-emerald' : data.accuracy >= 50 ? 'text-gold' : 'text-against-400'
                : 'text-surface-500'
            )}>
              {data.accuracy !== null ? `${data.accuracy}%` : '—'}
            </p>
            <p className="font-mono text-xs text-surface-500">accuracy</p>
          </div>
        </div>

        <div className="h-px bg-surface-300" />

        <div className="text-center">
          <p className="font-mono text-sm text-surface-400">
            Ranked <span className="text-white font-bold">{ordinalSuffix(data.leaderboard_rank)}</span> of{' '}
            {data.total_users.toLocaleString()} citizens
          </p>
          {data.top_category && (
            <p className={cn('font-mono text-sm mt-1', catColor(data.top_category.category))}>
              Top category: {data.top_category.category}
            </p>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={active ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="flex flex-col gap-3 w-full max-w-sm"
      >
        <button
          onClick={onCopy}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-mono text-sm font-semibold bg-for-500 hover:bg-for-600 text-white transition-colors"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Copied to clipboard!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Wrapped summary
            </>
          )}
        </button>
        <Link
          href="/analytics"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-mono text-sm font-semibold bg-surface-300 hover:bg-surface-400 text-white transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
          Full analytics
        </Link>
      </motion.div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SLIDE_LABELS = ['Intro', 'Votes', 'Category', 'Impact', 'Arguments', 'Standing', 'Share']
const TOTAL_SLIDES = SLIDE_LABELS.length

export default function WrappedPage() {
  const router = useRouter()
  const [data, setData] = useState<WrappedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slide, setSlide] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [copied, setCopied] = useState(false)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/analytics/wrapped')
      .then((r) => {
        if (r.status === 401) {
          router.replace('/login?next=/wrapped')
          return null
        }
        return r.json()
      })
      .then((json) => {
        if (json) setData(json as WrappedData)
      })
      .catch(() => setError('Failed to load your Wrapped.'))
      .finally(() => setLoading(false))
  }, [router])

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= TOTAL_SLIDES) return
    setDirection(next > slide ? 1 : -1)
    setSlide(next)
  }, [slide])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(slide + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(slide - 1)
  }, [goTo, slide])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) goTo(slide + 1)
      else goTo(slide - 1)
    }
    touchStartX.current = null
  }

  const handleCopy = useCallback(() => {
    if (!data) return
    const forPct = data.profile.total_votes > 0
      ? Math.round((data.profile.blue_vote_count / data.profile.total_votes) * 100)
      : 50
    const text = [
      `My ${data.year} Lobby Wrapped 🏛️`,
      ``,
      `🗳️ ${data.votes_this_year} votes cast`,
      `⚖️ ${forPct}% FOR / ${100 - forPct}% AGAINST`,
      `⚡ ${data.arguments_this_year} arguments written`,
      `🏛️ ${data.laws_supported} laws supported to passage`,
      data.accuracy !== null ? `🎯 ${data.accuracy}% civic accuracy` : null,
      `🏆 Ranked ${ordinalSuffix(data.leaderboard_rank)} of ${data.total_users.toLocaleString()} citizens`,
      data.top_category ? `📂 Top category: ${data.top_category.category}` : null,
      ``,
      `lobbymarket.com/wrapped`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 text-for-400 animate-spin mx-auto" />
            <p className="font-mono text-sm text-surface-500">Loading your Wrapped…</p>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4 max-w-sm">
            <p className="font-mono text-lg text-white">
              {error ?? 'Could not load your Wrapped.'}
            </p>
            <Link
              href="/analytics"
              className="inline-flex items-center gap-2 font-mono text-sm text-for-400 hover:text-for-300"
            >
              <BarChart2 className="w-4 h-4" />
              View analytics instead
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 60, opacity: 0 }),
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      {/* Slide area */}
      <div
        className="flex-1 relative overflow-hidden pb-24 md:pb-12"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-4 pt-3">
          {SLIDE_LABELS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'flex-1 h-1 rounded-full transition-all duration-300',
                i < slide
                  ? 'bg-for-500'
                  : i === slide
                  ? 'bg-for-400'
                  : 'bg-surface-300'
              )}
            />
          ))}
        </div>

        {/* Slides */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="absolute inset-0 pt-10"
          >
            {slide === 0 && <SlideIntro data={data} active />}
            {slide === 1 && <SlideVotes data={data} active />}
            {slide === 2 && <SlideCategory data={data} active />}
            {slide === 3 && <SlideImpact data={data} active />}
            {slide === 4 && <SlideArguments data={data} active />}
            {slide === 5 && <SlideStanding data={data} active />}
            {slide === 6 && <SlideShare data={data} active onCopy={handleCopy} copied={copied} />}
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        <div className="absolute bottom-28 md:bottom-16 left-0 right-0 flex justify-between px-4 z-10 pointer-events-none">
          <button
            onClick={() => goTo(slide - 1)}
            disabled={slide === 0}
            className={cn(
              'pointer-events-auto flex items-center gap-1 font-mono text-sm px-4 py-2 rounded-lg border transition-all',
              slide === 0
                ? 'opacity-0 pointer-events-none'
                : 'bg-surface-200/80 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {slide < TOTAL_SLIDES - 1 ? (
            <button
              onClick={() => goTo(slide + 1)}
              className="pointer-events-auto flex items-center gap-1 font-mono text-sm px-4 py-2 rounded-lg border bg-for-500/10 border-for-500/30 text-for-400 hover:bg-for-500/20 transition-all"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <Link
              href="/analytics"
              className="pointer-events-auto flex items-center gap-1 font-mono text-sm px-4 py-2 rounded-lg border bg-for-500 border-for-600 text-white hover:bg-for-600 transition-all"
            >
              Full stats
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
