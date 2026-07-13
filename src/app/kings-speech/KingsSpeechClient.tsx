'use client'

/**
 * /kings-speech — The State Opening of Parliament
 *
 * The ruling coalition delivers a formal King's Speech: a legislative
 * programme listing the bills they intend to champion this civic session.
 * Citizens react with "Hear, hear" or "Shame!". Opposition coalitions
 * respond with formal counter-addresses or amendment motions.
 *
 * If no speech has been delivered this session, shows the platform's
 * live "provisional programme" drawn from the hottest active topics.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Crown,
  FileText,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scroll,
  Shield,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  KingsSpeechData,
  KingsSpeech,
  ProgrammeBill,
  SpeechResponse,
} from '@/app/api/kings-speech/route'

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
}

function catColor(cat: string | null) {
  return cat
    ? (CAT_COLOR[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-400/30' })
    : { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-400/30' }
}

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  flagship:  { label: 'Flagship Bill', color: 'text-gold border-gold/30 bg-gold/10', icon: Star },
  priority:  { label: 'Priority',      color: 'text-for-400 border-for-500/30 bg-for-500/10', icon: Flame },
  secondary: { label: 'Secondary',     color: 'text-surface-400 border-surface-400/20 bg-surface-200', icon: FileText },
}

// ─── Response type config ─────────────────────────────────────────────────────

const RESPONSE_CONFIG = {
  gracious_address: { label: 'Gracious Address',  color: 'text-emerald border-emerald/30 bg-emerald/10' },
  opposition:       { label: 'Opposition Motion', color: 'text-against-400 border-against-400/30 bg-against-500/10' },
  amendment:        { label: 'Amendment Motion',  color: 'text-gold border-gold/30 bg-gold/10' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatSolemn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── Bill Card ────────────────────────────────────────────────────────────────

function BillCard({ bill, index }: { bill: ProgrammeBill; index: number }) {
  const cfg = PRIORITY_CONFIG[bill.priority_label]
  const PriorityIcon = cfg.icon
  const cc = catColor(bill.category)
  const forPct = Math.round(bill.blue_pct ?? 50)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group"
    >
      <Link
        href={`/topic/${bill.topic_id}`}
        className="flex items-start gap-4 p-4 rounded-xl bg-surface-100 border border-surface-200/80 hover:border-surface-300 hover:bg-surface-150 transition-colors"
      >
        {/* Bill number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-200 border border-surface-300/50 flex items-center justify-center text-xs font-bold text-surface-400 mt-0.5">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1.5 flex-wrap">
            {/* Priority badge */}
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium',
              cfg.color
            )}>
              <PriorityIcon className="w-2.5 h-2.5" />
              {cfg.label}
            </span>

            {/* Category */}
            {bill.category && (
              <span className={cn('text-xs font-medium', cc.text)}>
                {bill.category}
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-gold transition-colors">
            {bill.statement}
          </p>

          {bill.note && (
            <p className="text-xs text-surface-400 mb-2 italic">&ldquo;{bill.note}&rdquo;</p>
          )}

          <div className="flex items-center gap-3 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3 text-for-400" />
              {forPct}% For
            </span>
            {bill.total_votes != null && (
              <>
                <span>·</span>
                <span>{bill.total_votes.toLocaleString()} votes</span>
              </>
            )}
            <span>·</span>
            <span className="capitalize">{bill.status}</span>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-surface-500 flex-shrink-0 mt-1 group-hover:text-gold transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Response Card ────────────────────────────────────────────────────────────

function ResponseCard({ response }: { response: SpeechResponse }) {
  const cfg = RESPONSE_CONFIG[response.response_type]

  return (
    <div className="flex gap-3 p-4 bg-surface-100 border border-surface-200/80 rounded-xl">
      <Avatar
        src={response.author_avatar_url ?? undefined}
        username={response.author_username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-white">
            {response.author_display_name ?? response.author_username}
          </span>
          {response.coalition_name && (
            <span className="text-xs text-surface-400">· {response.coalition_name}</span>
          )}
          <span className={cn('inline-flex px-1.5 py-0.5 rounded border text-xs font-medium', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-xs text-surface-500 ml-auto">{relativeTime(response.created_at)}</span>
        </div>
        <p className="text-sm text-surface-300 leading-relaxed">{response.content}</p>
      </div>
    </div>
  )
}

// ─── Reaction Row ─────────────────────────────────────────────────────────────

function ReactionRow({
  speechId: _speechId,
  hearHear,
  shame,
  userReaction,
  isAuthenticated,
  onReact,
}: {
  speechId: string
  hearHear: number
  shame: number
  userReaction: 'hear_hear' | 'shame' | null
  isAuthenticated: boolean
  onReact: (reaction: 'hear_hear' | 'shame') => Promise<void>
}) {
  const [pending, setPending] = useState<'hear_hear' | 'shame' | null>(null)

  async function handleClick(reaction: 'hear_hear' | 'shame') {
    if (!isAuthenticated || pending) return
    setPending(reaction)
    await onReact(reaction)
    setPending(null)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={() => handleClick('hear_hear')}
        disabled={!isAuthenticated || !!pending}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all',
          userReaction === 'hear_hear'
            ? 'bg-emerald/15 border-emerald/40 text-emerald'
            : 'bg-surface-100 border-surface-200 text-surface-300 hover:border-emerald/30 hover:text-emerald',
          (!isAuthenticated || !!pending) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {pending === 'hear_hear' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ThumbsUp className="w-4 h-4" />
        )}
        Hear, hear!
        <span className="text-xs font-mono">{hearHear}</span>
      </button>

      <button
        onClick={() => handleClick('shame')}
        disabled={!isAuthenticated || !!pending}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all',
          userReaction === 'shame'
            ? 'bg-against-500/15 border-against-400/40 text-against-400'
            : 'bg-surface-100 border-surface-200 text-surface-300 hover:border-against-400/30 hover:text-against-400',
          (!isAuthenticated || !!pending) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {pending === 'shame' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ThumbsDown className="w-4 h-4" />
        )}
        Shame!
        <span className="text-xs font-mono">{shame}</span>
      </button>

      {!isAuthenticated && (
        <Link
          href="/sign-in"
          className="text-xs text-surface-500 hover:text-white transition-colors"
        >
          Sign in to react
        </Link>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="rounded-2xl border border-surface-200 bg-surface-100 p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Fallback Programme (no speech yet) ───────────────────────────────────────

function FallbackProgramme({
  data,
}: {
  data: KingsSpeechData['fallback']
}) {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gold/20 bg-gold/5 p-6 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-3">
          <Crown className="w-6 h-6 text-gold" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">No Speech Delivered Yet</h2>
        <p className="text-sm text-surface-400 max-w-sm mx-auto">
          The ruling coalition has not yet delivered their legislative programme for this session.
          The provisional agenda below reflects the current most active civic topics.
        </p>
      </motion.div>

      {/* Platform stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Citizens', value: data.citizen_count.toLocaleString(), icon: Users },
          { label: 'Active Bills', value: data.active_topic_count.toLocaleString(), icon: Vote },
          { label: 'Laws Passed', value: data.law_count.toLocaleString(), icon: Gavel },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-surface-100 border border-surface-200/80 rounded-xl p-3 text-center">
            <Icon className="w-4 h-4 text-surface-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-xs text-surface-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Provisional programme */}
      {data.hot_topics.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Scroll className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
              Provisional Legislative Agenda
            </h3>
          </div>
          <div className="space-y-2">
            {data.hot_topics.map((bill, i) => (
              <BillCard key={bill.topic_id} bill={bill} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Top coalition CTA */}
      {data.top_coalition && (
        <div className="rounded-xl border border-surface-200/80 bg-surface-100 p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-surface-500 mb-0.5">Most powerful coalition</p>
            <p className="text-sm font-semibold text-white">{data.top_coalition.name}</p>
            <p className="text-xs text-surface-400">{data.top_coalition.member_count} members</p>
          </div>
          <Link
            href={`/coalition/${data.top_coalition.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-500/15 border border-for-500/30 text-for-400 text-xs font-semibold hover:bg-for-500/25 transition-colors flex-shrink-0"
          >
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Main Speech View ─────────────────────────────────────────────────────────

function SpeechView({
  speech,
  isAuthenticated,
  onReact,
}: {
  speech: KingsSpeech
  isAuthenticated: boolean
  onReact: (speechId: string, reaction: 'hear_hear' | 'shame') => Promise<void>
}) {
  const [hearHear, setHearHear] = useState(speech.hear_hear_count)
  const [shame, setShame] = useState(speech.shame_count)
  const [userReaction, setUserReaction] = useState(speech.user_reaction)
  const [showResponses, setShowResponses] = useState(false)

  async function handleReact(reaction: 'hear_hear' | 'shame') {
    const prev = userReaction
    const prevHH = hearHear
    const prevShame = shame

    // Optimistic
    if (prev === reaction) {
      setUserReaction(null)
      if (reaction === 'hear_hear') setHearHear((n) => Math.max(0, n - 1))
      else setShame((n) => Math.max(0, n - 1))
    } else {
      if (prev === 'hear_hear') setHearHear((n) => Math.max(0, n - 1))
      if (prev === 'shame') setShame((n) => Math.max(0, n - 1))
      setUserReaction(reaction)
      if (reaction === 'hear_hear') setHearHear((n) => n + 1)
      else setShame((n) => n + 1)
    }

    try {
      await onReact(speech.id, reaction)
    } catch {
      setHearHear(prevHH)
      setShame(prevShame)
      setUserReaction(prev)
    }
  }

  const flagshipBills = speech.bills.filter((b) => b.priority_label === 'flagship')
  const priorityBills = speech.bills.filter((b) => b.priority_label === 'priority')
  const secondaryBills = speech.bills.filter((b) => b.priority_label === 'secondary')

  return (
    <div className="space-y-6">
      {/* Proclamation scroll */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/5 via-surface-100 to-surface-100 overflow-hidden"
      >
        {/* Top ribbon */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold/20 via-gold/60 to-gold/20" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gold/10 border border-gold/25 flex items-center justify-center">
              <Crown className="w-7 h-7 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gold/70 uppercase tracking-widest mb-1">
                State Opening of Parliament
              </div>
              <h2 className="text-xl font-bold text-white leading-tight mb-1">
                {speech.session_name}
              </h2>
              <div className="text-xs text-surface-400">
                Delivered {formatSolemn(speech.delivered_at)}
              </div>
            </div>
          </div>

          {/* Coalition */}
          {speech.coalition && (
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-surface-200/40 border border-surface-200/60">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: speech.coalition.color ?? '#60a5fa' }}
              />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/coalition/${speech.coalition.id}`}
                  className="text-sm font-semibold text-white hover:text-gold transition-colors"
                >
                  {speech.coalition.name}
                </Link>
                <span className="text-xs text-surface-500 ml-2">
                  {speech.coalition.member_count} members · Ruling Coalition
                </span>
              </div>
              {speech.coalition.leader_avatar_url && (
                <Avatar
                  src={speech.coalition.leader_avatar_url}
                  username={speech.coalition.leader_username ?? 'leader'}
                  size="xs"
                />
              )}
            </div>
          )}

          {/* Preamble */}
          <div className="mb-6">
            <p className="text-sm text-surface-300 leading-relaxed italic">
              &ldquo;{speech.preamble}&rdquo;
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
            <Sparkles className="w-3 h-3 text-gold/40" />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
          </div>

          {/* Legislative programme */}
          {speech.bills.length > 0 ? (
            <div className="space-y-5">
              {flagshipBills.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-3.5 h-3.5 text-gold" />
                    <span className="text-xs font-semibold text-gold uppercase tracking-wider">
                      Flagship Bills
                    </span>
                  </div>
                  <div className="space-y-2">
                    {flagshipBills.map((bill, i) => (
                      <BillCard key={bill.topic_id} bill={bill} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {priorityBills.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-3.5 h-3.5 text-for-400" />
                    <span className="text-xs font-semibold text-for-400 uppercase tracking-wider">
                      Priority Bills
                    </span>
                  </div>
                  <div className="space-y-2">
                    {priorityBills.map((bill, i) => (
                      <BillCard
                        key={bill.topic_id}
                        bill={bill}
                        index={flagshipBills.length + i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {secondaryBills.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-3.5 h-3.5 text-surface-400" />
                    <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                      Secondary Bills
                    </span>
                  </div>
                  <div className="space-y-2">
                    {secondaryBills.map((bill, i) => (
                      <BillCard
                        key={bill.topic_id}
                        bill={bill}
                        index={flagshipBills.length + priorityBills.length + i}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-surface-500 text-center py-4">
              No bills listed in this programme.
            </p>
          )}

          {/* Bottom seal */}
          <div className="mt-6 pt-5 border-t border-gold/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-surface-500">
              <Shield className="w-3.5 h-3.5 text-gold/40" />
              <span>Official Civic Record</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gold/50">
              <Sparkles className="w-3 h-3" />
              <span>Lobby Market Parliament</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Reactions */}
      <div className="rounded-xl border border-surface-200/80 bg-surface-100 p-4">
        <p className="text-xs text-surface-500 mb-3">React to the King&apos;s Speech</p>
        <ReactionRow
          speechId={speech.id}
          hearHear={hearHear}
          shame={shame}
          userReaction={userReaction}
          isAuthenticated={isAuthenticated}
          onReact={handleReact}
        />
      </div>

      {/* Responses */}
      {speech.response_count > 0 && (
        <div>
          <button
            onClick={() => setShowResponses((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-surface-300 hover:text-white transition-colors mb-3"
          >
            <MessageSquare className="w-4 h-4" />
            {speech.response_count} Response{speech.response_count !== 1 ? 's' : ''}
            <ChevronRight
              className={cn('w-3.5 h-3.5 transition-transform', showResponses && 'rotate-90')}
            />
          </button>
          <AnimatePresence>
            {showResponses && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {speech.responses.map((r) => (
                  <ResponseCard key={r.id} response={r} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/parliament', label: 'Parliament', icon: Gavel },
          { href: '/lords', label: 'House of Lords', icon: Shield },
          { href: '/westminster-hall', label: 'Westminster Hall', icon: BookOpen },
          { href: '/royal-assent', label: 'Royal Assent', icon: Crown },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-200/80 hover:border-surface-300 hover:bg-surface-150 transition-colors text-sm text-surface-300 hover:text-white"
          >
            <Icon className="w-4 h-4 text-surface-400" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Archive Panel ────────────────────────────────────────────────────────────

function ArchivePanel({ data }: { data: KingsSpeechData }) {
  if (data.archive.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Archive className="w-4 h-4 text-surface-500" />
        <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
          Previous Sessions
        </h3>
      </div>
      <div className="space-y-2">
        {data.archive.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-4 p-3 rounded-xl bg-surface-100 border border-surface-200/80"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-300 truncate">{s.session_name}</p>
              <p className="text-xs text-surface-500">
                {s.coalition_name ?? 'Independent'} · {s.bill_count} bills ·{' '}
                {relativeTime(s.delivered_at)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald flex-shrink-0">
              <ThumbsUp className="w-3 h-3" />
              {s.hear_hear_count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KingsSpeechClient() {
  const [data, setData] = useState<KingsSpeechData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/kings-speech', { signal: abortRef.current.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError('Could not load the King\'s Speech. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    return () => abortRef.current?.abort()
  }, [fetchData])

  async function handleReact(speechId: string, reaction: 'hear_hear' | 'shame') {
    await fetch('/api/kings-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speech_id: speechId, reaction }),
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Page header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">The King&apos;s Speech</h1>
              <p className="text-xs text-surface-500">State Opening of Parliament</p>
            </div>
            <button
              onClick={fetchData}
              className="ml-auto p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Content */}
          {loading && !data ? (
            <PageSkeleton />
          ) : error ? (
            <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-6 text-center">
              <X className="w-8 h-8 text-against-400 mx-auto mb-2" />
              <p className="text-sm text-against-300">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 px-4 py-2 rounded-lg bg-surface-200 text-sm text-white hover:bg-surface-300 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <div className="space-y-8">
              {data.latest ? (
                <SpeechView
                  speech={data.latest}
                  isAuthenticated={data.is_authenticated}
                  onReact={handleReact}
                />
              ) : (
                <FallbackProgramme data={data.fallback} />
              )}

              <ArchivePanel data={data} />
            </div>
          ) : null}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
