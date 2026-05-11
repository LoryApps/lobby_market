'use client'

/**
 * /arguments/faceoff — Argument Arena: Head-to-Head
 *
 * Two real arguments from different topics appear side-by-side.
 * Pick which one makes the more compelling case — regardless of whether
 * you agree with the position — and the community's collective judgement
 * builds an Arena leaderboard distinct from upvotes and AI scores.
 *
 * Rules:
 *   • Arguments come from DIFFERENT topics so you're judging rhetoric,
 *     not which topic you prefer.
 *   • Up to 10 matchups per day. More tomorrow.
 *   • Your vote is anonymous to the argument authors.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  FaceoffResponse,
  FaceoffArgument,
  FaceoffLeader,
} from '@/app/api/arguments/faceoff/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed', active: 'Active', voting: 'Voting',
  law: 'LAW', failed: 'Failed',
}
const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Grade badge ──────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald bg-emerald/10 border-emerald/30',
  B: 'text-for-400 bg-for-500/10 border-for-500/30',
  C: 'text-gold bg-gold/10 border-gold/30',
  D: 'text-against-400 bg-against-500/10 border-against-500/30',
  F: 'text-surface-500 bg-surface-300/40 border-surface-400/30',
}

function GradePill({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cls = GRADE_COLOR[grade] ?? 'text-surface-500 bg-surface-300/40 border-surface-400/30'
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border', cls)}>
      {grade}
    </span>
  )
}

// ─── Win-rate bar ─────────────────────────────────────────────────────────────

function WinBar({ wins, bouts, win_pct, revealed }: {
  wins: number; bouts: number; win_pct: number | null; revealed: boolean
}) {
  if (!revealed || bouts === 0) return null
  const pct = win_pct ?? 0
  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono text-surface-400">
        <span>{wins} win{wins !== 1 ? 's' : ''} / {bouts} bout{bouts !== 1 ? 's' : ''}</span>
        <span className={pct >= 60 ? 'text-emerald font-semibold' : pct <= 40 ? 'text-against-400' : 'text-gold'}>
          {pct}% win rate
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            pct >= 60 ? 'bg-emerald' : pct <= 40 ? 'bg-against-500' : 'bg-gold'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

interface ArgCardProps {
  arg: FaceoffArgument
  side: 'a' | 'b'
  chosen: string | null
  winner: string | null
  onPick: (id: string) => void
  disabled: boolean
  updatedArena?: { wins: number; bouts: number; win_pct: number } | null
}

function ArgCard({ arg, side, chosen, winner, onPick, disabled, updatedArena }: ArgCardProps) {
  const isChosen = chosen === arg.id
  const isWinner = winner === arg.id
  const revealed = winner !== null
  const arena = updatedArena ?? arg.arena

  const sideColor = arg.side === 'blue'
    ? 'text-for-400 bg-for-500/10 border-for-500/30'
    : 'text-against-400 bg-against-500/10 border-against-500/30'
  const sideLabel = arg.side === 'blue' ? 'FOR' : 'AGAINST'
  const SideIcon = arg.side === 'blue' ? ThumbsUp : ThumbsDown

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: side === 'a' ? 0 : 0.08 }}
      className={cn(
        'relative rounded-2xl border transition-all duration-300 flex flex-col',
        'bg-surface-100',
        revealed
          ? isWinner
            ? 'border-emerald/60 shadow-lg shadow-emerald/10'
            : 'border-surface-300 opacity-60'
          : isChosen
            ? 'border-for-500/60'
            : 'border-surface-300',
        !disabled && !revealed && 'cursor-pointer hover:border-surface-400 hover:bg-surface-200',
      )}
      onClick={() => { if (!disabled && !revealed) onPick(arg.id) }}
    >
      {/* Winner crown */}
      <AnimatePresence>
        {revealed && isWinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-emerald/20 border border-emerald/40 text-emerald text-xs font-mono font-bold shadow-lg"
          >
            <Crown className="h-3 w-3" />
            Winner
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header: side badge + grade */}
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold border', sideColor)}>
            <SideIcon className="h-3 w-3" />
            {sideLabel}
          </span>
          <GradePill grade={arg.ai_grade} />
          <span className="ml-auto text-[10px] font-mono text-surface-500">
            {relativeTime(arg.created_at)}
          </span>
        </div>

        {/* Argument text */}
        <p className="text-sm text-surface-100 leading-relaxed flex-1">
          {arg.content.length > 380 ? arg.content.slice(0, 380) + '…' : arg.content}
        </p>

        {/* Topic chip */}
        <Link
          href={`/topic/${arg.topic.id}`}
          className="flex items-center gap-1.5 text-[11px] font-mono text-surface-400 hover:text-surface-200 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <span className="truncate">{arg.topic.statement}</span>
          <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
          {arg.topic.status && (
            <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} size="xs">
              {STATUS_LABEL[arg.topic.status] ?? arg.topic.status}
            </Badge>
          )}
        </Link>

        {/* Author row */}
        <div className="flex items-center gap-2">
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name ?? arg.author.username}
            size="xs"
          />
          <Link
            href={`/profile/${arg.author.username}`}
            className="text-[11px] font-mono text-surface-400 hover:text-surface-200 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            @{arg.author.username}
          </Link>
          <div className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes.toLocaleString()}
          </div>
        </div>

        {/* Arena stats revealed after vote */}
        <WinBar
          wins={arena.wins}
          bouts={arena.bouts}
          win_pct={arena.win_pct}
          revealed={revealed}
        />
      </div>

      {/* Pick button (shown when not yet voted) */}
      {!revealed && (
        <div className="px-4 pb-4">
          <button
            className={cn(
              'w-full py-2.5 rounded-xl text-sm font-mono font-semibold transition-all border',
              isChosen
                ? 'bg-for-500 border-for-500 text-white'
                : 'bg-surface-200 border-surface-300 text-surface-300 hover:bg-surface-300 hover:border-surface-400 hover:text-white'
            )}
            disabled={disabled}
            onClick={e => { e.stopPropagation(); onPick(arg.id) }}
          >
            {isChosen ? 'Selected' : 'Pick this argument'}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({ leaders }: { leaders: FaceoffLeader[] }) {
  if (leaders.length === 0) return null

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center">
          <Trophy className="h-3.5 w-3.5 text-gold" />
        </div>
        <h2 className="font-mono text-base font-bold text-white">Arena Champions</h2>
        <span className="text-xs font-mono text-surface-500">most wins in head-to-head</span>
      </div>

      <div className="space-y-2">
        {leaders.map((leader, idx) => (
          <motion.div
            key={leader.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <div className={cn(
              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold',
              idx === 0 ? 'bg-gold/20 text-gold border border-gold/30' :
              idx === 1 ? 'bg-surface-300/50 text-surface-200 border border-surface-300' :
              idx === 2 ? 'bg-against-500/10 text-against-300 border border-against-500/20' :
                          'bg-surface-200 text-surface-400'
            )}>
              {idx + 1}
            </div>

            <Avatar
              src={leader.author.avatar_url}
              fallback={leader.author.display_name ?? leader.author.username}
              size="sm"
            />

            <div className="flex-1 min-w-0">
              <p className="text-xs text-surface-100 font-mono truncate leading-tight">
                {leader.content.slice(0, 80)}{leader.content.length > 80 ? '…' : ''}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  'text-[10px] font-mono font-bold',
                  leader.side === 'blue' ? 'text-for-400' : 'text-against-400'
                )}>
                  {leader.side === 'blue' ? 'FOR' : 'AGAINST'}
                </span>
                <span className="text-[10px] font-mono text-surface-500 truncate">
                  {leader.topic.statement.slice(0, 50)}{leader.topic.statement.length > 50 ? '…' : ''}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              <div className="text-sm font-mono font-bold text-emerald">{leader.wins}</div>
              <div className="text-[10px] font-mono text-surface-500">{leader.win_pct}% WR</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FaceoffPage() {
  const [data, setData] = useState<FaceoffResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('All')

  // Local vote state
  const [chosen, setChosen] = useState<string | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [updatedStats, setUpdatedStats] = useState<Record<string, { wins: number; bouts: number; win_pct: number }>>({})
  const [roundCount, setRoundCount] = useState(0)

  const load = useCallback(async (cat = category, refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/arguments/faceoff?${params}`)
      if (res.ok) {
        const json = await res.json() as FaceoffResponse
        setData(json)
        setChosen(null)
        setWinner(null)
        setUpdatedStats({})
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCategoryChange(cat: string) {
    setCategory(cat)
    setChosen(null)
    setWinner(null)
    setUpdatedStats({})
    setRoundCount(0)
    load(cat)
  }

  function handlePick(id: string) {
    if (winner || submitting) return
    setChosen(id)
  }

  async function handleConfirm() {
    if (!chosen || !data?.pair || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/arguments/faceoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argument_a_id: data.pair.a.id,
          argument_b_id: data.pair.b.id,
          winner_id: chosen,
        }),
      })

      if (res.ok) {
        const json = await res.json() as { ok: boolean; stats: Record<string, { wins: number; bouts: number; win_pct: number }> }
        setWinner(chosen)
        setUpdatedStats(json.stats ?? {})
        setRoundCount(c => c + 1)
        // Update daily count
        setData(prev => prev ? { ...prev, daily_count: prev.daily_count + 1 } : prev)
      } else if (res.status === 401) {
        setWinner(chosen) // still reveal locally even if not logged in
      }
    } catch {
      setWinner(chosen)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleNext() {
    setChosen(null)
    setWinner(null)
    setUpdatedStats({})
    await load(category, true)
  }

  const pair = data?.pair ?? null
  const dailyCount = data?.daily_count ?? 0
  const dailyLimit = data?.daily_limit ?? 10
  const leaderboard = data?.leaderboard ?? []
  const atLimit = dailyCount >= dailyLimit

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-6">
          <Link href="/arguments" className="mt-0.5 text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-against-500/20 border border-against-500/30 flex items-center justify-center">
                <Swords className="h-4 w-4 text-against-400" />
              </div>
              <h1 className="font-mono text-xl font-bold text-white">Argument Arena</h1>
              <span className="px-2 py-0.5 rounded-full bg-against-500/10 border border-against-500/30 text-[10px] font-mono text-against-400 font-semibold">
                HEAD-TO-HEAD
              </span>
            </div>
            <p className="text-sm font-mono text-surface-400 ml-10">
              Two arguments, one choice. Which makes the more compelling case — regardless of your position?
            </p>
          </div>
        </div>

        {/* ── Category filter ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                category === cat
                  ? 'bg-against-500/20 border-against-500/40 text-against-300'
                  : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-surface-400 hover:text-surface-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Daily progress ── */}
        {data && (
          <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-surface-100 border border-surface-300">
            <Flame className="h-4 w-4 text-against-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-surface-400">Today&apos;s matchups</span>
                <span className="text-xs font-mono text-surface-300 font-semibold">
                  {dailyCount} / {dailyLimit}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-against-500 to-against-400 transition-all duration-500"
                  style={{ width: `${Math.min((dailyCount / dailyLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
            {roundCount > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald font-semibold">
                <Award className="h-3.5 w-3.5" />
                +{roundCount} voted
              </div>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="grid md:grid-cols-2 gap-6">
            {[0, 1].map(i => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* ── Daily limit reached ── */}
        {!loading && atLimit && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gold/10 border border-gold/30 mb-4">
              <Trophy className="h-8 w-8 text-gold" />
            </div>
            <h2 className="font-mono text-xl font-bold text-white mb-2">Arena closed for today</h2>
            <p className="text-sm font-mono text-surface-400 max-w-sm mx-auto mb-6">
              You&apos;ve completed all {dailyLimit} matchups for today. Come back tomorrow for fresh bouts.
            </p>
            <Link
              href="/arguments"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-100 border border-surface-300 text-sm font-mono text-surface-200 hover:border-surface-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Arguments
            </Link>
          </div>
        )}

        {/* ── No pair available ── */}
        {!loading && !atLimit && !pair && (
          <EmptyState
            icon={Scale}
            title="No matchups available"
            description="Not enough high-quality arguments yet. Check back after more debates get underway."
            actions={[
              { label: 'Browse arguments', href: '/arguments' },
            ]}
          />
        )}

        {/* ── Active pair ── */}
        {!loading && pair && !atLimit && (
          <>
            {/* VS divider label */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-surface-300" />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-surface-300">
                <span className="text-xs font-mono text-surface-400 font-semibold">
                  {pair.category ?? 'Civic Debate'}
                </span>
                <Swords className="h-3.5 w-3.5 text-against-400" />
                <span className="text-xs font-mono text-surface-400 font-semibold">Round</span>
              </div>
              <div className="flex-1 h-px bg-surface-300" />
            </div>

            {/* Two argument cards */}
            <div className="grid md:grid-cols-2 gap-6 mt-2">
              <ArgCard
                arg={pair.a}
                side="a"
                chosen={chosen}
                winner={winner}
                onPick={handlePick}
                disabled={submitting || winner !== null}
                updatedStats={updatedStats[pair.a.id] ?? null}
              />

              {/* Mobile VS separator */}
              <div className="flex items-center gap-3 md:hidden">
                <div className="flex-1 h-px bg-surface-300" />
                <span className="text-xs font-mono text-surface-500 font-bold">VS</span>
                <div className="flex-1 h-px bg-surface-300" />
              </div>

              <ArgCard
                arg={pair.b}
                side="b"
                chosen={chosen}
                winner={winner}
                onPick={handlePick}
                disabled={submitting || winner !== null}
                updatedStats={updatedStats[pair.b.id] ?? null}
              />
            </div>

            {/* Action row */}
            <div className="flex items-center justify-center gap-4 mt-8">
              {!winner ? (
                <button
                  onClick={handleConfirm}
                  disabled={!chosen || submitting}
                  className={cn(
                    'flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-mono font-bold transition-all border',
                    chosen && !submitting
                      ? 'bg-against-500/20 border-against-500/40 text-against-300 hover:bg-against-500/30 cursor-pointer'
                      : 'bg-surface-100 border-surface-300 text-surface-500 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Swords className="h-4 w-4" />
                  )}
                  {submitting ? 'Submitting…' : chosen ? 'Lock in my choice' : 'Pick an argument first'}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald/10 border border-emerald/30 text-emerald text-sm font-mono font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Vote recorded
                  </div>
                  {dailyCount < dailyLimit ? (
                    <button
                      onClick={handleNext}
                      disabled={refreshing}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-against-500/20 border border-against-500/40 text-against-300 text-sm font-mono font-semibold hover:bg-against-500/30 transition-colors"
                    >
                      {refreshing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Next matchup
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm font-mono font-semibold">
                      <Trophy className="h-4 w-4" />
                      Daily limit reached
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Instructions */}
            {!winner && (
              <p className="text-center text-[11px] font-mono text-surface-500 mt-4">
                Judge the argument itself — not whether you agree with the topic position
              </p>
            )}
          </>
        )}

        {/* ── Leaderboard ── */}
        {!loading && <Leaderboard leaders={leaderboard} />}

        {/* ── Nav links ── */}
        <div className="mt-10 pt-6 border-t border-surface-300 flex flex-wrap gap-2">
          <Link
            href="/arguments"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
            Top Arguments
          </Link>
          <Link
            href="/arguments/top-scored"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
            Best Quality
          </Link>
          <Link
            href="/arguments/common-threads"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
            Common Threads
          </Link>
          <Link
            href="/arguments/contested"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            <Gavel className="h-3 w-3" />
            Most Contested
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
