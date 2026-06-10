'use client'

/**
 * /law/[id]/community — Law Community Hub
 *
 * Central dashboard for ongoing civic activity around an established law:
 * amendment proposals, blueprint community notes, and related active debates.
 * Complements:
 *   /law/[id]           — full law text + wiki
 *   /law/[id]/blueprint — AI implementation plan
 *   /law/[id]/impact    — vote timeline + stats
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  GitFork,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawCommunityData, CommunityAmendment, CommunityNote } from '@/app/api/laws/[id]/community/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Community Score visual ───────────────────────────────────────────────────

const SCORE_CONFIG = (score: number) => {
  if (score >= 75) return { label: 'Thriving', color: 'text-emerald', ring: 'stroke-emerald', bg: 'bg-emerald/10 border-emerald/30' }
  if (score >= 55) return { label: 'Stable', color: 'text-for-400', ring: 'stroke-for-400', bg: 'bg-for-500/10 border-for-500/30' }
  if (score >= 35) return { label: 'Under Review', color: 'text-gold', ring: 'stroke-gold', bg: 'bg-gold/10 border-gold/30' }
  return { label: 'Contested', color: 'text-against-400', ring: 'stroke-against-400', bg: 'bg-against-500/10 border-against-500/30' }
}

function ScoreRing({ score }: { score: number }) {
  const cfg = SCORE_CONFIG(score)
  const r = 28
  const circ = 2 * Math.PI * r
  const dashArray = `${(score / 100) * circ} ${circ}`

  return (
    <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4', cfg.bg)}>
      <div className="relative h-16 w-16">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" className="stroke-surface-300" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            className={cfg.ring}
            strokeWidth="6"
            strokeDasharray={dashArray}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center font-mono text-lg font-bold', cfg.color)}>
          {score}
        </span>
      </div>
      <span className={cn('text-xs font-mono font-bold uppercase tracking-widest', cfg.color)}>
        {cfg.label}
      </span>
      <span className="text-[10px] font-mono text-surface-500 text-center leading-tight">
        Civic Vitality Score
      </span>
    </div>
  )
}

// ─── Amendment aspect labels ──────────────────────────────────────────────────

const ASPECT_LABELS: Record<string, { label: string; color: string }> = {
  phase:       { label: 'Phase',       color: 'text-for-400' },
  stakeholder: { label: 'Stakeholder', color: 'text-purple' },
  challenge:   { label: 'Challenge',   color: 'text-against-400' },
  metric:      { label: 'Metric',      color: 'text-emerald' },
  resource:    { label: 'Resource',    color: 'text-gold' },
  general:     { label: 'General',     color: 'text-surface-400' },
}

// ─── Amendment status config ──────────────────────────────────────────────────

const AMEND_STATUS: Record<string, { icon: typeof CheckCircle2; label: string; color: string; bg: string }> = {
  pending:  { icon: Clock,         label: 'Pending',  color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' },
  ratified: { icon: CheckCircle2,  label: 'Ratified', color: 'text-emerald',     bg: 'bg-emerald/10 border-emerald/30' },
  rejected: { icon: XCircle,       label: 'Rejected', color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' },
}

// ─── Amendment card ───────────────────────────────────────────────────────────

function AmendmentCard({ amendment }: { amendment: CommunityAmendment }) {
  const [voted, setVoted] = useState<boolean | null>(amendment.user_vote)
  const [forCount, setForCount] = useState(amendment.for_count)
  const [againstCount, setAgainstCount] = useState(amendment.against_count)
  const [voting, setVoting] = useState(false)

  const statusCfg = AMEND_STATUS[amendment.status]
  const StatusIcon = statusCfg.icon
  const total = forCount + againstCount
  const forPct = total > 0 ? Math.round((forCount / total) * 100) : 0
  const daysLeft = daysUntil(amendment.expires_at)

  async function castVote(v: boolean) {
    if (voting) return
    setVoting(true)
    try {
      const res = await fetch(`/api/amendments/${amendment.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voted === v ? null : v }),
      })
      if (res.ok) {
        if (voted === v) {
          // Undo vote
          setVoted(null)
          if (v) setForCount((c) => c - 1)
          else setAgainstCount((c) => c - 1)
        } else {
          // Undo previous + set new
          if (voted === true) setForCount((c) => c - 1)
          if (voted === false) setAgainstCount((c) => c - 1)
          setVoted(v)
          if (v) setForCount((c) => c + 1)
          else setAgainstCount((c) => c + 1)
        }
      }
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white leading-snug">
            {amendment.title}
          </p>
          {amendment.proposer && (
            <div className="flex items-center gap-1.5 mt-1">
              <Avatar
                src={amendment.proposer.avatar_url}
                fallback={amendment.proposer.display_name ?? amendment.proposer.username}
                size="xs"
              />
              <span className="text-[10px] font-mono text-surface-500">
                @{amendment.proposer.username} · {relativeDate(amendment.created_at)}
              </span>
            </div>
          )}
        </div>
        <span className={cn(
          'flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
          statusCfg.bg, statusCfg.color
        )}>
          <StatusIcon className="h-2.5 w-2.5" />
          {statusCfg.label}
        </span>
      </div>

      {/* Body preview */}
      <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-2">
        {amendment.body}
      </p>

      {/* Vote bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex text-[10px] font-mono justify-between">
            <span className="text-for-400">{forPct}% FOR</span>
            <span className="text-surface-500">{total} votes</span>
            <span className="text-against-400">{100 - forPct}% AGAINST</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden flex">
            <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-against-500" style={{ width: `${100 - forPct}%` }} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {amendment.status === 'pending' && (
          <>
            <button
              onClick={() => castVote(true)}
              disabled={voting}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                voted === true
                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-for-300 hover:border-for-500/50'
              )}
            >
              {voting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
              {formatCount(forCount)}
            </button>
            <button
              onClick={() => castVote(false)}
              disabled={voting}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                voted === false
                  ? 'bg-against-500/20 border-against-500/50 text-against-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-against-300 hover:border-against-500/50'
              )}
            >
              {voting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
              {formatCount(againstCount)}
            </button>
            {daysLeft <= 7 && (
              <span className="text-[10px] font-mono text-gold ml-auto flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {daysLeft}d left
              </span>
            )}
          </>
        )}
        {amendment.status !== 'pending' && (
          <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3 text-for-500" />{formatCount(forCount)}</span>
            <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3 text-against-500" />{formatCount(againstCount)}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Blueprint note card ──────────────────────────────────────────────────────

function NoteCard({ note, lawId }: { note: CommunityNote; lawId: string }) {
  const [upvoted, setUpvoted] = useState(note.has_upvoted)
  const [count, setCount] = useState(note.upvotes)
  const [busy, setBusy] = useState(false)

  const aspectCfg = ASPECT_LABELS[note.aspect] ?? { label: note.aspect, color: 'text-surface-400' }

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/blueprint/notes/${note.id}/upvote`, { method: 'POST' })
      if (res.ok) {
        const { upvotes: newCount, has_upvoted: newUpvoted } = await res.json() as { upvotes: number; has_upvoted: boolean }
        setUpvoted(newUpvoted)
        setCount(newCount)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 space-y-2"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-surface-300 leading-relaxed">
            {note.content}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {note.author && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Avatar
              src={note.author.avatar_url}
              fallback={note.author.display_name ?? note.author.username}
              size="xs"
            />
            <span className="text-[10px] font-mono text-surface-500 truncate">
              @{note.author.username}
            </span>
          </div>
        )}
        <span className={cn('text-[10px] font-mono font-semibold', aspectCfg.color)}>
          {aspectCfg.label}
        </span>
        <button
          onClick={toggle}
          disabled={busy}
          className={cn(
            'ml-auto flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors',
            upvoted
              ? 'bg-for-500/15 border-for-500/40 text-for-300'
              : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-for-300 hover:border-for-500/40'
          )}
        >
          {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ThumbsUp className="h-2.5 w-2.5" />}
          {count}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LawCommunityPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<LawCommunityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/community`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const law = data?.law
  const forPct = Math.round(law?.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const daysSince = law
    ? Math.floor((Date.now() - new Date(law.established_at).getTime()) / 86_400_000)
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">

        {/* Back nav */}
        <Link
          href={`/law?id=${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to law
        </Link>

        {loading && <PageSkeleton />}

        {error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button onClick={load} className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* ── Hero header ────────────────────────────────────────── */}
              <div className="rounded-2xl border border-gold/25 bg-gold/5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-gold bg-gold/15 border border-gold/35 px-2.5 py-0.5 rounded-full">
                        <Gavel className="h-2.5 w-2.5" />
                        Established Law
                      </span>
                      {law.category && (
                        <span className="text-[10px] font-mono font-semibold text-surface-400">
                          {law.category}
                        </span>
                      )}
                      {law.scope && (
                        <span className="text-[10px] font-mono text-surface-500">
                          · {law.scope}
                        </span>
                      )}
                    </div>
                    <h1 className="font-mono text-base font-bold text-white leading-snug mb-3">
                      {law.statement}
                    </h1>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-surface-500">
                      <span className="flex items-center gap-1"><Gavel className="h-3 w-3 text-gold" />{daysSince}d since established</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{formatCount(law.total_votes)} votes</span>
                    </div>
                  </div>
                  <ScoreRing score={data.community_score} />
                </div>

                {/* Original vote margin */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-for-400">FOR {forPct}%</span>
                    <span className="text-surface-500">passed by consensus</span>
                    <span className="text-against-400">{againstPct}% AGAINST</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-for-700 to-for-400" style={{ width: `${forPct}%` }} />
                    <div className="h-full bg-against-600" style={{ width: `${againstPct}%` }} />
                  </div>
                </div>
              </div>

              {/* ── Quick stats ─────────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Amendments', value: data.amendments.total, sub: `${data.amendments.pending} pending`, icon: GitFork, color: 'text-for-400', iconBg: 'bg-for-500/10' },
                  { label: 'Notes', value: data.notes.total, sub: data.notes.has_blueprint ? 'blueprint exists' : 'no blueprint yet', icon: MessageSquare, color: 'text-purple', iconBg: 'bg-purple/10' },
                  { label: 'Related', value: data.related.length, sub: 'active debates', icon: Zap, color: 'text-emerald', iconBg: 'bg-emerald/10' },
                ].map(({ label, value, sub, icon: Icon, color, iconBg }) => (
                  <div key={label} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 text-center">
                    <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg mx-auto mb-2', iconBg)}>
                      <Icon className={cn('h-4 w-4', color)} />
                    </div>
                    <div className={cn('font-mono text-2xl font-bold', color)}>{value}</div>
                    <div className="text-[10px] font-mono font-semibold text-surface-400 mt-0.5">{label}</div>
                    <div className="text-[10px] font-mono text-surface-600 truncate">{sub}</div>
                  </div>
                ))}
              </div>

              {/* ── Navigation strip ────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { href: `/law/${id}`, icon: FileText, label: 'Law Text' },
                  { href: `/law/${id}/impact`, icon: BarChart2, label: 'Impact' },
                  { href: `/law/${id}/blueprint`, icon: Sparkles, label: 'Blueprint' },
                ].map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-xs font-mono font-medium text-surface-400 hover:text-white hover:border-surface-400 hover:bg-surface-200 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                ))}
              </div>

              {/* ── Amendment proposals ─────────────────────────────────── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold flex items-center gap-1.5">
                    <GitFork className="h-3.5 w-3.5" />
                    Amendment Proposals
                    {data.amendments.pending > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-gold/20 text-gold text-[10px] font-bold">
                        {data.amendments.pending}
                      </span>
                    )}
                  </h2>
                  <Link
                    href={`/amendments?law=${id}`}
                    className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
                  >
                    All amendments <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                {data.amendments.total === 0 ? (
                  <EmptyState
                    icon={GitFork}
                    title="No amendments yet"
                    description="Be the first to propose a change to this law."
                    action={{ label: 'Propose amendment', href: `/amendments?law=${id}&action=propose` }}
                    variant="compact"
                  />
                ) : (
                  <div className="space-y-3">
                    {/* Status summary pills */}
                    {(data.amendments.ratified > 0 || data.amendments.rejected > 0) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {data.amendments.ratified > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {data.amendments.ratified} ratified
                          </span>
                        )}
                        {data.amendments.rejected > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-against-400 bg-against-500/10 border border-against-500/30 px-2 py-0.5 rounded-full">
                            <XCircle className="h-2.5 w-2.5" />
                            {data.amendments.rejected} rejected
                          </span>
                        )}
                      </div>
                    )}
                    {data.amendments.recent.map((a) => (
                      <AmendmentCard key={a.id} amendment={a} />
                    ))}
                    {data.amendments.total > 5 && (
                      <Link
                        href={`/amendments?law=${id}`}
                        className="block rounded-xl border border-surface-300 bg-surface-100 p-3 text-center text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                      >
                        View all {data.amendments.total} amendments <ArrowRight className="inline h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </section>

              {/* ── Blueprint notes ─────────────────────────────────────── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    Community Notes
                    {data.notes.total > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-purple/20 text-purple text-[10px] font-bold">
                        {data.notes.total}
                      </span>
                    )}
                  </h2>
                  {data.notes.has_blueprint && (
                    <Link
                      href={`/law/${id}/blueprint`}
                      className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
                    >
                      View blueprint <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                {!data.notes.has_blueprint && data.notes.total === 0 ? (
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                    <Sparkles className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                    <p className="text-xs font-mono text-surface-500 mb-2">
                      No implementation blueprint yet.
                    </p>
                    <Link
                      href={`/law/${id}/blueprint`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate blueprint
                    </Link>
                  </div>
                ) : data.notes.total === 0 ? (
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                    <MessageSquare className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                    <p className="text-xs font-mono text-surface-500 mb-2">
                      No community notes yet.
                    </p>
                    <Link
                      href={`/law/${id}/blueprint`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                    >
                      Be the first to add a note
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Aspect breakdown */}
                    {Object.keys(data.notes.by_aspect).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(data.notes.by_aspect)
                          .sort((a, b) => b[1] - a[1])
                          .map(([aspect, count]) => {
                            const cfg = ASPECT_LABELS[aspect] ?? { label: aspect, color: 'text-surface-400' }
                            return (
                              <span key={aspect} className={cn('text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300', cfg.color)}>
                                {cfg.label} ({count})
                              </span>
                            )
                          })}
                      </div>
                    )}
                    {data.notes.top_notes.map((n) => (
                      <NoteCard key={n.id} note={n} lawId={id} />
                    ))}
                    {data.notes.total > 3 && (
                      <Link
                        href={`/law/${id}/blueprint`}
                        className="block rounded-xl border border-surface-300 bg-surface-100 p-3 text-center text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                      >
                        See all {data.notes.total} notes on the blueprint <ArrowRight className="inline h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </section>

              {/* ── Related active debates ──────────────────────────────── */}
              {data.related.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Active Debates in {law.category}
                  </h2>
                  <div className="space-y-2.5">
                    {data.related.map((topic) => {
                      const tForPct = Math.round(topic.blue_pct)
                      return (
                        <Link
                          key={topic.id}
                          href={`/topic/${topic.id}`}
                          className="block rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono font-semibold text-surface-300 group-hover:text-white leading-snug line-clamp-2 transition-colors">
                                {topic.statement}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={cn(
                                  'text-[10px] font-mono font-bold uppercase tracking-widest',
                                  topic.status === 'voting' ? 'text-purple' : 'text-for-400'
                                )}>
                                  {topic.status}
                                </span>
                                <span className="text-[10px] font-mono text-surface-500">
                                  {tForPct}% For · {formatCount(topic.total_votes)} votes
                                </span>
                              </div>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-0.5 transition-colors" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── Propose amendment CTA ───────────────────────────────── */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 text-center space-y-3">
                <Edit3 className="h-7 w-7 text-surface-600 mx-auto" />
                <div>
                  <p className="text-sm font-mono font-semibold text-white mb-1">
                    Want to improve this law?
                  </p>
                  <p className="text-xs font-mono text-surface-500">
                    Propose an amendment to update, clarify, or strengthen this consensus law.
                  </p>
                </div>
                <Link
                  href={`/amendments?law=${id}&action=propose`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  Propose Amendment
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
