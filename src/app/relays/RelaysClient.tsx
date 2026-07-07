'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RelayRow, RelaysResponse } from '@/app/api/relays/route'

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
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: RelayRow['status'] }) {
  const config: Record<RelayRow['status'], { label: string; cls: string }> = {
    open:        { label: 'Open',        cls: 'text-emerald border-emerald/30 bg-emerald/10' },
    in_progress: { label: 'In Progress', cls: 'text-gold border-gold/30 bg-gold/10' },
    complete:    { label: 'Complete',    cls: 'text-for-400 border-for-500/30 bg-for-500/10' },
    voted:       { label: 'Voted',       cls: 'text-surface-400 border-surface-400/30 bg-surface-300/10' },
  }
  const { label, cls } = config[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', cls)}>
      {label}
    </span>
  )
}

// ─── Leg progress dots ────────────────────────────────────────────────────────

function LegDots({ filled, total, isFor }: { filled: number; total: number; isFor: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${filled} of ${total} legs`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            i < filled
              ? isFor ? 'bg-for-500' : 'bg-against-500'
              : 'bg-surface-500'
          )}
        />
      ))}
    </div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function RelayCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Relay card ────────────────────────────────────────────────────────────────

function RelayCard({
  relay,
  userId,
  onRefresh,
}: {
  relay: RelayRow
  userId: string | null
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [legText, setLegText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [voting, setVoting] = useState(false)
  const [localVote, setLocalVote] = useState(relay.user_vote)
  const [localHasLeg, setLocalHasLeg] = useState(relay.user_has_leg)
  const [err, setErr] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isFor = relay.side === 'for'
  const legCount = relay.legs.length
  const isAccepting = ['open', 'in_progress'].includes(relay.status)

  const canAddLeg =
    userId &&
    !localHasLeg &&
    relay.starter_id !== userId &&
    isAccepting &&
    legCount < relay.max_legs

  const canVote = userId && !localVote && relay.status === 'complete'

  async function handleAddLeg() {
    const trimmed = legText.trim()
    if (trimmed.length < 30) {
      setErr('Minimum 30 characters required')
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/relays/${relay.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_leg', content: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? 'Failed to add leg')
      } else {
        setLegText('')
        setLocalHasLeg(true)
        onRefresh()
      }
    } catch {
      setErr('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVote(vote: 'compelling' | 'not_compelling') {
    setVoting(true)
    try {
      const res = await fetch(`/api/relays/${relay.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', vote }),
      })
      if (res.ok) {
        setLocalVote(vote)
        onRefresh()
      }
    } catch {
      // best-effort
    } finally {
      setVoting(false)
    }
  }

  const charCount = legText.length
  const charColorCls =
    charCount > 280 ? 'text-against-400' : charCount > 250 ? 'text-gold' : 'text-surface-500'

  const displayedLegs = expanded ? relay.legs : relay.legs.slice(0, 2)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        isFor
          ? 'bg-for-900/20 border-for-900/60 hover:border-for-800/70'
          : 'bg-against-900/20 border-against-900/60 hover:border-against-800/70'
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black font-mono uppercase tracking-widest border',
            isFor
              ? 'bg-for-600/15 text-for-300 border-for-600/30'
              : 'bg-against-600/15 text-against-300 border-against-600/30'
          )}>
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {relay.topic_category && (
            <span className="text-[10px] font-mono text-surface-500 bg-surface-200/50 px-2 py-0.5 rounded-full border border-surface-400/20">
              {relay.topic_category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <LegDots filled={legCount} total={relay.max_legs} isFor={isFor} />
          <StatusPill status={relay.status} />
        </div>
      </div>

      {/* ── Topic link ──────────────────────────────────────────────── */}
      {relay.topic_statement && relay.topic_id && (
        <Link
          href={`/topic/${relay.topic_id}`}
          className="block rounded-xl border border-surface-300/40 bg-surface-200/30 hover:bg-surface-200/60 hover:border-surface-400 p-3 transition-colors group"
        >
          <p className="text-sm font-mono text-white leading-snug line-clamp-2">
            {relay.topic_statement}
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 group-hover:text-surface-300 mt-1.5 transition-colors">
            View topic <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </Link>
      )}

      {/* ── Legs chain ──────────────────────────────────────────────── */}
      <div className={cn(
        'border-l-2 pl-3 space-y-3',
        isFor ? 'border-for-800/60' : 'border-against-800/60'
      )}>
        {displayedLegs.map((leg) => (
          <div key={leg.id} className="flex gap-2.5">
            <Link href={`/profile/${leg.author?.username ?? ''}`} className="flex-shrink-0">
              <Avatar
                src={leg.author?.avatar_url ?? null}
                fallback={leg.author?.display_name || leg.author?.username || '?'}
                size="xs"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
                <Link
                  href={`/profile/${leg.author?.username ?? ''}`}
                  className="text-[11px] font-mono font-semibold text-white hover:text-for-300 transition-colors"
                >
                  {leg.author?.display_name || leg.author?.username || 'Unknown'}
                </Link>
                <span className="text-[10px] font-mono text-surface-600">
                  leg {leg.leg_number} · {relativeTime(leg.created_at)}
                </span>
              </div>
              <p className="text-sm font-mono text-surface-300 leading-relaxed">{leg.content}</p>
            </div>
          </div>
        ))}

        {/* Open slots */}
        {isAccepting &&
          Array.from({ length: Math.max(0, relay.max_legs - legCount) })
            .slice(0, 2)
            .map((_, i) => (
              <div key={`slot-${i}`} className="flex gap-2.5 opacity-35">
                <div className="h-6 w-6 rounded-full border border-dashed border-surface-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-surface-500">+</span>
                </div>
                <p className="text-[11px] font-mono text-surface-600 italic self-center">
                  Open slot — add your perspective
                </p>
              </div>
            ))}
      </div>

      {/* Expand / collapse */}
      {relay.legs.length > 2 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" />Show less</>
          ) : (
            <><ChevronDown className="h-3 w-3" />Show all {relay.legs.length} legs</>
          )}
        </button>
      )}

      {/* Vote tally */}
      {(relay.status === 'complete' || relay.status === 'voted') && (
        <div className="flex items-center gap-4 pt-1 border-t border-surface-400/20 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald">
            <ThumbsUp className="h-3.5 w-3.5" />
            {relay.vote_compelling} compelling
          </span>
          <span className="flex items-center gap-1.5 text-against-400">
            <ThumbsDown className="h-3.5 w-3.5" />
            {relay.vote_not_compelling} not compelling
          </span>
        </div>
      )}

      {/* Add-leg form */}
      {canAddLeg && (
        <div className="pt-1 space-y-2">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
            Add your {isFor ? 'FOR' : 'AGAINST'} argument (30–300 chars)
          </p>
          <textarea
            ref={textareaRef}
            value={legText}
            onChange={(e) => setLegText(e.target.value)}
            placeholder="Build on the chain — one clear, reasoned argument…"
            rows={3}
            maxLength={300}
            className={cn(
              'w-full rounded-xl border p-3 text-sm font-mono bg-surface-200/80 text-white placeholder:text-surface-600',
              'focus:outline-none focus:ring-1 resize-none transition-colors',
              isFor
                ? 'border-for-800/40 focus:border-for-600/60 focus:ring-for-600/20'
                : 'border-against-800/40 focus:border-against-600/60 focus:ring-against-600/20'
            )}
          />
          {err && <p className="text-xs text-against-400 font-mono">{err}</p>}
          <div className="flex items-center justify-between">
            <span className={cn('text-[10px] font-mono', charColorCls)}>
              {charCount}/300
            </span>
            <button
              onClick={handleAddLeg}
              disabled={submitting || charCount < 30}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-mono font-semibold transition-all',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isFor
                  ? 'bg-for-600 hover:bg-for-500 text-white border border-for-500/50'
                  : 'bg-against-600 hover:bg-against-500 text-white border border-against-500/50'
              )}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" />
              )}
              Add leg
            </button>
          </div>
        </div>
      )}

      {/* Already contributed badge */}
      {localHasLeg && isAccepting && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald">
          <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Your leg has been submitted
        </div>
      )}

      {/* Vote CTA for completed relays */}
      {canVote && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
            Was this relay compelling?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleVote('compelling')}
              disabled={voting}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
                'bg-emerald/10 hover:bg-emerald/20 text-emerald border border-emerald/30',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {voting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
              Compelling
            </button>
            <button
              onClick={() => handleVote('not_compelling')}
              disabled={voting}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
                'bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white border border-surface-300 hover:border-surface-400',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {voting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4" />
              )}
              Not compelling
            </button>
          </div>
        </div>
      )}

      {/* Voted indicator */}
      {localVote && (
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-mono',
          localVote === 'compelling' ? 'text-emerald' : 'text-surface-400'
        )}>
          {localVote === 'compelling' ? (
            <ThumbsUp className="h-3.5 w-3.5" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
          You voted: {localVote === 'compelling' ? 'Compelling' : 'Not compelling'}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-surface-600 pt-1 border-t border-surface-400/20">
        <span>
          Started by{' '}
          <Link href={`/profile/${relay.starter_username}`} className="hover:text-surface-400 transition-colors">
            @{relay.starter_username}
          </Link>
        </span>
        <span>·</span>
        <span>{relativeTime(relay.created_at)}</span>
        <span>·</span>
        <span>{legCount}/{relay.max_legs} legs</span>
      </div>
    </motion.div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'open' | 'in_progress' | 'complete'

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'open',        label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'complete',    label: 'Complete' },
]

// ─── Main export ──────────────────────────────────────────────────────────────

export function RelaysClient() {
  const router = useRouter()
  const [data, setData] = useState<RelaysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [userId, setUserId] = useState<string | null>(null)

  const load = useCallback(async (status: StatusFilter = filter) => {
    setLoading(true)
    try {
      const params = status === 'all' ? '' : `?status=${status}`
      const res = await fetch(`/api/relays${params}`, { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.ok) {
        const json = await res.json() as RelaysResponse
        setData(json)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [filter, router])

  useEffect(() => {
    async function getUser() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [])

  useEffect(() => {
    load(filter)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(f: StatusFilter) {
    setFilter(f)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <GitMerge className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Relays</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Collaborative argument chains built leg by leg
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/relays/create"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/20 border border-purple/40 text-purple hover:bg-purple/30 hover:border-purple/60 transition-colors text-xs font-mono"
            >
              <GitMerge className="h-3.5 w-3.5" />
              Start Relay
            </Link>
            <button
              onClick={() => load(filter)}
              disabled={loading}
              aria-label="Refresh relays"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-surface-200 border border-surface-300 overflow-x-auto">
          {FILTER_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleFilterChange(id)}
              className={cn(
                'flex-1 min-w-max py-2 px-3 rounded-lg text-sm font-mono font-medium transition-all whitespace-nowrap',
                filter === id
                  ? 'bg-surface-100 text-white shadow-sm border border-surface-300'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <RelayCardSkeleton key={i} />)}
          </div>
        ) : !data || data.relays.length === 0 ? (
          <EmptyState
            icon={GitMerge}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No relays yet"
            description={
              filter === 'all'
                ? 'Civic relays are collaborative argument chains. Start one from any topic page.'
                : `No ${filter.replace('_', ' ')} relays right now — check back soon.`
            }
            actions={[
              { label: 'Start a Relay', href: '/relays/create' },
              { label: 'Browse Topics', href: '/' },
            ]}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {data.relays.map((relay) => (
                <RelayCard
                  key={relay.id}
                  relay={relay}
                  userId={userId}
                  onRefresh={() => load(filter)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── How it works ────────────────────────────────────────────── */}
        {!loading && (
          <div className="mt-8 rounded-2xl border border-surface-300/60 bg-surface-100/50 p-5 space-y-3">
            <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              How Civic Relays work
            </p>
            <div className="space-y-2.5">
              {[
                { text: 'A citizen starts a relay by posting the first leg of an argument — FOR or AGAINST a topic.' },
                { text: 'Other citizens each add one leg, building on the chain. Each relay has a maximum number of legs.' },
                { text: 'Once complete, the community votes on whether the collaborative argument was compelling.' },
              ].map(({ text }, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-purple">{i + 1}</span>
                  </div>
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
