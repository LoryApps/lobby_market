'use client'

/**
 * /tribunal — The Civic Tribunal
 *
 * Democratic argument review system. When an argument accumulates 3+
 * community challenges, it enters the Tribunal Queue. Eligible jurors
 * (debator+) deliberate and cast 'sustained' or 'dismissed' votes.
 * 2-of-3 majority delivers the verdict.
 *
 * Distinct from:
 *  - /moderation (admin-only report queue for Troll Catchers/Elders)
 *  - /arguments  (open browsing and upvoting)
 * This is the civic governance layer: citizens judging civic discourse.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TribunalCase, TribunalResponse } from '@/app/api/tribunal/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 45_000

const STATUS_TABS = [
  { key: 'open',         label: 'Open',         icon: Clock },
  { key: 'deliberating', label: 'Deliberating',  icon: Scale },
  { key: 'closed',       label: 'Closed',        icon: Gavel },
] as const

type StatusTab = (typeof STATUS_TABS)[number]['key']

const REASON_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  misleading:  { label: 'Misleading',   color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  fallacious:  { label: 'Fallacious',   color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  irrelevant:  { label: 'Off-topic',    color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  spam:        { label: 'Spam',         color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300' },
}

const VERDICT_CONFIG = {
  sustained: { label: 'Sustained',  icon: ThumbsDown, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  dismissed:  { label: 'Dismissed', icon: ThumbsUp,   color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',        border: 'border-gold/20' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',      border: 'border-purple/20' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Ethics:      { text: 'text-against-400',   bg: 'bg-against-500/10', border: 'border-against-500/20' },
  Philosophy:  { text: 'text-for-300',       bg: 'bg-for-400/10',     border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',          bg: 'bg-gold/10',        border: 'border-gold/20' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Education:   { text: 'text-purple',        bg: 'bg-purple/10',      border: 'border-purple/20' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',     border: 'border-emerald/20' },
}

function getCatColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30' }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Clock
  color: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-surface-100 border border-surface-300 p-4 min-w-0">
      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
      <span className={cn('text-xl font-bold font-mono', color)}>{value}</span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide text-center leading-tight">
        {label}
      </span>
    </div>
  )
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteProgress({ votes }: { votes: TribunalCase['juror_votes'] }) {
  const sustained = votes.filter((v) => v.vote === 'sustained').length
  const dismissed = votes.filter((v) => v.vote === 'dismissed').length
  const pending = votes.filter((v) => !v.vote).length
  const total = votes.length

  if (total === 0) {
    return (
      <p className="text-xs font-mono text-surface-500">No jurors assigned yet</p>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-against-400">{sustained} sustained</span>
        <span className="text-surface-500">·</span>
        <span className="text-emerald">{dismissed} dismissed</span>
        {pending > 0 && (
          <>
            <span className="text-surface-500">·</span>
            <span className="text-surface-500">{pending} pending</span>
          </>
        )}
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
        {sustained > 0 && (
          <div
            className="bg-against-500 transition-all"
            style={{ width: `${(sustained / Math.max(total, 3)) * 100}%` }}
          />
        )}
        {dismissed > 0 && (
          <div
            className="bg-emerald transition-all"
            style={{ width: `${(dismissed / Math.max(total, 3)) * 100}%` }}
          />
        )}
      </div>
      <p className="text-[10px] text-surface-500 font-mono">2-of-3 majority decides verdict</p>
    </div>
  )
}

// ─── Case Card ────────────────────────────────────────────────────────────────

function CaseCard({
  tribunalCase,
  onVote,
}: {
  tribunalCase: TribunalCase
  onVote: (caseId: string, vote: 'sustained' | 'dismissed') => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [voting, setVoting] = useState<'sustained' | 'dismissed' | null>(null)
  const [voted, setVoted] = useState(tribunalCase.my_vote)

  const catColor = getCatColor(tribunalCase.argument.topic_category)
  const canVote = tribunalCase.can_serve && !voted && tribunalCase.status !== 'closed'

  const reasonCounts: Record<string, number> = {}
  for (const ch of tribunalCase.challenges) {
    reasonCounts[ch.reason] = (reasonCounts[ch.reason] ?? 0) + 1
  }

  async function handleVote(v: 'sustained' | 'dismissed') {
    if (!canVote || voting) return
    setVoting(v)
    try {
      await onVote(tribunalCase.id, v)
      setVoted(v)
    } finally {
      setVoting(null)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 md:p-5">
        {/* Topic + category */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <Link
              href={`/topic/${tribunalCase.argument.topic_id}`}
              className="group flex items-center gap-1.5 mb-1"
            >
              <span className="text-[11px] font-mono text-surface-500 group-hover:text-surface-400 transition-colors line-clamp-1">
                {tribunalCase.argument.topic_statement}
              </span>
              <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 group-hover:text-surface-400 transition-colors" />
            </Link>
            {tribunalCase.argument.topic_category && (
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium border',
                  catColor.text, catColor.bg, catColor.border
                )}
              >
                {tribunalCase.argument.topic_category}
              </span>
            )}
          </div>

          {/* Status / verdict badge */}
          {tribunalCase.status === 'closed' && tribunalCase.verdict ? (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border flex-shrink-0',
                VERDICT_CONFIG[tribunalCase.verdict].color,
                VERDICT_CONFIG[tribunalCase.verdict].bg,
                VERDICT_CONFIG[tribunalCase.verdict].border
              )}
            >
              {tribunalCase.verdict === 'sustained'
                ? <ThumbsDown className="h-3 w-3" />
                : <ThumbsUp className="h-3 w-3" />
              }
              {VERDICT_CONFIG[tribunalCase.verdict].label}
            </div>
          ) : (
            <span
              className={cn(
                'text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border flex-shrink-0',
                tribunalCase.status === 'deliberating'
                  ? 'text-gold bg-gold/10 border-gold/30'
                  : 'text-for-400 bg-for-500/10 border-for-500/30'
              )}
            >
              {tribunalCase.status === 'deliberating' ? 'Deliberating' : 'Open'}
            </span>
          )}
        </div>

        {/* Argument content */}
        <div
          className={cn(
            'rounded-xl border p-3 mb-3',
            tribunalCase.argument.side === 'blue'
              ? 'bg-for-600/5 border-for-600/20'
              : 'bg-against-600/5 border-against-600/20'
          )}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Avatar
              src={tribunalCase.argument.author_avatar_url}
              fallback={tribunalCase.argument.author_display_name || tribunalCase.argument.author_username}
              size="xs"
            />
            <Link
              href={`/profile/${tribunalCase.argument.author_username}`}
              className="text-[11px] font-mono text-surface-400 hover:text-white transition-colors"
            >
              @{tribunalCase.argument.author_username}
            </Link>
            <span
              className={cn(
                'text-[10px] font-mono ml-auto',
                tribunalCase.argument.side === 'blue' ? 'text-for-400' : 'text-against-400'
              )}
            >
              {tribunalCase.argument.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
          </div>
          <p className="text-sm font-mono text-white leading-relaxed line-clamp-3">
            {tribunalCase.argument.content}
          </p>
          {tribunalCase.argument.ai_grade && (
            <span className="mt-1.5 inline-flex text-[10px] font-mono text-surface-500">
              AI Grade: {tribunalCase.argument.ai_grade}
            </span>
          )}
        </div>

        {/* Challenges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(reasonCounts).map(([reason, count]) => {
            const cfg = REASON_LABELS[reason] ?? REASON_LABELS.spam
            return (
              <span
                key={reason}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border',
                  cfg.color, cfg.bg, cfg.border
                )}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {cfg.label} × {count}
              </span>
            )
          })}
          <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
            <Users className="h-2.5 w-2.5" />
            {tribunalCase.challenge_count} challenge{tribunalCase.challenge_count !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] font-mono text-surface-600 ml-auto">
            {timeAgo(tribunalCase.created_at)}
          </span>
        </div>

        {/* Vote progress */}
        <div className="mb-3">
          <VoteProgress votes={tribunalCase.juror_votes} />
        </div>

        {/* Juror actions */}
        {canVote && (
          <div className="flex gap-2">
            <button
              onClick={() => handleVote('sustained')}
              disabled={!!voting}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-mono font-semibold',
                'border transition-all disabled:opacity-50',
                'bg-against-600/10 border-against-600/30 text-against-400 hover:bg-against-600/20'
              )}
            >
              {voting === 'sustained'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ThumbsDown className="h-4 w-4" />
              }
              Sustain
            </button>
            <button
              onClick={() => handleVote('dismissed')}
              disabled={!!voting}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-mono font-semibold',
                'border transition-all disabled:opacity-50',
                'bg-emerald/10 border-emerald/30 text-emerald hover:bg-emerald/20'
              )}
            >
              {voting === 'dismissed'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ThumbsUp className="h-4 w-4" />
              }
              Dismiss
            </button>
          </div>
        )}

        {/* Already voted */}
        {voted && (
          <div
            className={cn(
              'flex items-center gap-2 py-2 px-3 rounded-xl text-sm font-mono border',
              voted === 'sustained'
                ? 'bg-against-600/10 border-against-600/30 text-against-400'
                : 'bg-emerald/10 border-emerald/30 text-emerald'
            )}
          >
            <Check className="h-4 w-4 flex-shrink-0" />
            You voted to {voted === 'sustained' ? 'Sustain' : 'Dismiss'}
          </div>
        )}

        {/* Ineligible to vote hint */}
        {!tribunalCase.can_serve && !voted && tribunalCase.status !== 'closed' && (
          <p className="text-[11px] font-mono text-surface-600 text-center">
            Juror eligibility requires Debator rank or higher
          </p>
        )}
      </div>

      {/* Expand: juror list */}
      {tribunalCase.juror_votes.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-surface-300 text-xs font-mono text-surface-500 hover:text-surface-400 hover:bg-surface-200/30 transition-colors"
          >
            <span>Jurors ({tribunalCase.juror_votes.length})</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                <div className="px-4 pb-4 space-y-2">
                  {tribunalCase.juror_votes.map((jv) => (
                    <div key={jv.juror_id} className="flex items-center gap-2.5">
                      <Avatar
                        src={jv.juror_avatar_url}
                        fallback={jv.juror_display_name || jv.juror_username}
                        size="xs"
                      />
                      <Link
                        href={`/profile/${jv.juror_username}`}
                        className="text-xs font-mono text-surface-400 hover:text-white transition-colors"
                      >
                        @{jv.juror_username}
                      </Link>
                      <span className="ml-auto text-[11px] font-mono">
                        {jv.vote ? (
                          <span
                            className={jv.vote === 'sustained' ? 'text-against-400' : 'text-emerald'}
                          >
                            {jv.vote === 'sustained' ? 'Sustained' : 'Dismissed'}
                          </span>
                        ) : (
                          <span className="text-surface-600">Deliberating…</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

// ─── About Panel ──────────────────────────────────────────────────────────────

function AboutPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-mono text-surface-400 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-gold" />
          <span>How the Tribunal works</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-surface-300 pt-3">
              {[
                {
                  n: '1',
                  title: 'Challenge',
                  desc: 'Any citizen can challenge an argument they believe is misleading, fallacious, off-topic, or spam.',
                  color: 'text-against-400',
                  bg: 'bg-against-500/10',
                  border: 'border-against-500/30',
                },
                {
                  n: '2',
                  title: 'Case Opens',
                  desc: 'Once an argument accumulates 3 challenges, a Tribunal Case is opened for public deliberation.',
                  color: 'text-gold',
                  bg: 'bg-gold/10',
                  border: 'border-gold/30',
                },
                {
                  n: '3',
                  title: 'Jury Deliberates',
                  desc: 'Citizens with Debator rank or higher serve as jurors. Each juror votes Sustain or Dismiss independently.',
                  color: 'text-purple',
                  bg: 'bg-purple/10',
                  border: 'border-purple/30',
                },
                {
                  n: '4',
                  title: 'Verdict',
                  desc: '2-of-3 majority delivers the verdict. Jurors on the winning side earn 5 Clout for their service.',
                  color: 'text-emerald',
                  bg: 'bg-emerald/10',
                  border: 'border-emerald/30',
                },
              ].map((step) => (
                <div key={step.n} className="flex gap-3">
                  <div
                    className={cn(
                      'flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold border',
                      step.color, step.bg, step.border
                    )}
                  >
                    {step.n}
                  </div>
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">{step.title}</p>
                    <p className="text-[11px] font-mono text-surface-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TribunalClient() {
  const [data, setData] = useState<TribunalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<StatusTab>('open')
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/tribunal?status=${activeTab}&limit=20`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as TribunalResponse
      setData(json)
    } catch {
      setError('Could not load Tribunal cases.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => {
    load()
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  async function handleVote(caseId: string, vote: 'sustained' | 'dismissed') {
    const res = await fetch(`/api/tribunal/${caseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed' }))
      throw new Error(err.error ?? 'Vote failed')
    }
    // Refresh after vote
    await load(true)
  }

  const stats = data?.stats ?? { open: 0, deliberating: 0, closed: 0, sustained: 0, dismissed: 0 }
  const myServiceCount = data?.my_service_count ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Gavel className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono text-white">The Civic Tribunal</h1>
              <p className="text-xs font-mono text-surface-500">Democratic argument review · 2-of-3 jury verdict</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh tribunal"
            className="flex-shrink-0 p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="Open" value={stats.open} icon={Clock} color="text-for-400" />
          <StatCard label="Hearing" value={stats.deliberating} icon={Scale} color="text-gold" />
          <StatCard label="Closed" value={stats.closed} icon={Gavel} color="text-surface-400" />
          <StatCard label="Sustained" value={stats.sustained} icon={ThumbsDown} color="text-against-400" />
          <StatCard label="Dismissed" value={stats.dismissed} icon={ThumbsUp} color="text-emerald" />
        </div>

        {/* My service */}
        {myServiceCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-gold/5 border border-gold/20 px-4 py-3">
            <Award className="h-5 w-5 text-gold flex-shrink-0" />
            <div>
              <p className="text-sm font-mono font-semibold text-white">
                {myServiceCount} jury {myServiceCount === 1 ? 'verdict' : 'verdicts'} delivered
              </p>
              <p className="text-[11px] font-mono text-surface-500">
                Thank you for your civic service
              </p>
            </div>
            <Zap className="h-4 w-4 text-gold ml-auto flex-shrink-0" />
          </div>
        )}

        {/* About panel */}
        <AboutPanel />

        {/* Status tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-100 border border-surface-300">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon
            const count = stats[tab.key]
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-mono font-medium transition-all',
                  activeTab === tab.key
                    ? 'bg-surface-50 text-white border border-surface-300 shadow-sm'
                    : 'text-surface-500 hover:text-surface-400'
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      activeTab === tab.key ? 'bg-surface-300 text-white' : 'bg-surface-300/50 text-surface-500'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Cases list */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !data?.cases.length ? (
          <EmptyState
            icon={Gavel}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title={
              activeTab === 'open'
                ? 'No open cases'
                : activeTab === 'deliberating'
                ? 'No active deliberations'
                : 'No closed cases'
            }
            description={
              activeTab === 'open'
                ? 'When arguments accumulate 3 challenges, they enter the Tribunal queue here.'
                : activeTab === 'deliberating'
                ? 'Cases with jurors actively voting will appear here.'
                : 'Decided cases and their verdicts will be archived here.'
            }
          />
        ) : (
          <div className="space-y-3">
            {data.cases.map((c) => (
              <CaseCard key={c.id} tribunalCase={c} onVote={handleVote} />
            ))}
          </div>
        )}

        {/* Footer link to challenge from argument threads */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 flex items-center gap-3">
          <Shield className="h-4 w-4 text-surface-500 flex-shrink-0" />
          <p className="text-xs font-mono text-surface-500 flex-1">
            Challenge an argument from its topic page to send it to the Tribunal queue.
          </p>
          <Link
            href="/discover"
            className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Browse topics
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
