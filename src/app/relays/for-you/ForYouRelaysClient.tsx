'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Hash,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { ForYouRelaysResponse, RecommendedRelay, RecommendationReason } from '@/app/api/relays/for-you/route'

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

// ─── Reason chips ─────────────────────────────────────────────────────────────

const REASON_CONFIG: Record<
  RecommendationReason,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  voted_topic: {
    label: 'You voted on this',
    icon: Vote,
    cls: 'bg-for-600/15 text-for-300 border-for-600/30',
  },
  followed_tag: {
    label: 'Matches your tags',
    icon: Hash,
    cls: 'bg-purple/15 text-purple border-purple/30',
  },
  almost_complete: {
    label: 'Almost complete',
    icon: Zap,
    cls: 'bg-gold/15 text-gold border-gold/30',
  },
  trending: {
    label: 'Trending',
    icon: TrendingUp,
    cls: 'bg-emerald/15 text-emerald border-emerald/30',
  },
  fresh: {
    label: 'Just started',
    icon: Sparkles,
    cls: 'bg-surface-300/50 text-surface-400 border-surface-400/30',
  },
}

function ReasonChips({ reasons }: { reasons: RecommendationReason[] }) {
  const topReasons = reasons.slice(0, 2)
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {topReasons.map((r) => {
        const { label, icon: Icon, cls } = REASON_CONFIG[r]
        return (
          <span
            key={r}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              cls
            )}
          >
            <Icon className="h-2.5 w-2.5" aria-hidden="true" />
            {label}
          </span>
        )
      })}
    </div>
  )
}

// ─── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: RecommendedRelay['status'] }) {
  const config: Record<RecommendedRelay['status'], { label: string; cls: string }> = {
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

function RelaySkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="space-y-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
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
  relay: RecommendedRelay
  userId: string | null
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [legText, setLegText] = useState('')
  const [submitting, setSubmitting] = useState(false)
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
      {/* ── Reason chips ──────────────────────────────────────────── */}
      <ReasonChips reasons={relay.reasons} />

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black font-mono uppercase tracking-widest border',
              isFor
                ? 'bg-for-600/15 text-for-300 border-for-600/30'
                : 'bg-against-600/15 text-against-300 border-against-600/30'
            )}
          >
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
          <Link
            href={`/relays/${relay.id}`}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono text-surface-500 hover:text-white border border-surface-400/30 hover:border-surface-400 bg-surface-200/30 hover:bg-surface-200/60 transition-colors"
            title="View relay"
          >
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── Topic link ────────────────────────────────────────────── */}
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

      {/* ── Legs chain ────────────────────────────────────────────── */}
      <div
        className={cn(
          'border-l-2 pl-3 space-y-3',
          isFor ? 'border-for-800/60' : 'border-against-800/60'
        )}
      >
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

      {/* Already contributed */}
      {localHasLeg && isAccepting && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald">
          <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8l3 3 7-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Your leg has been submitted
        </div>
      )}

      {/* Starter credit */}
      <div className="flex items-center gap-1.5 pt-0.5 border-t border-surface-400/15">
        <Link href={`/profile/${relay.starter_username}`} className="flex items-center gap-1.5 group">
          <Avatar
            src={relay.starter_avatar_url}
            fallback={relay.starter_display_name || relay.starter_username}
            size="xs"
          />
          <span className="text-[10px] font-mono text-surface-600 group-hover:text-surface-400 transition-colors">
            started by{' '}
            <span className="text-surface-400 group-hover:text-white">
              {relay.starter_display_name || relay.starter_username}
            </span>{' '}
            · {relativeTime(relay.created_at)}
          </span>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Hero section ─────────────────────────────────────────────────────────────

function Hero({ isPersonalized }: { isPersonalized: boolean }) {
  return (
    <div className="px-4 pt-4 pb-2 space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-purple/30 to-for-600/20 border border-purple/20">
          <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-black font-mono text-white tracking-tight">
          For You
        </h1>
      </div>
      <p className="text-[12px] font-mono text-surface-500 leading-relaxed">
        {isPersonalized
          ? "Relay chains picked from topics you've voted on and tags you follow."
          : 'Vote on topics and follow tags to unlock personalized relay picks.'}
      </p>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function ForYouRelaysClient() {
  const [data, setData] = useState<ForYouRelaysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [resData, resAuth] = await Promise.all([
        fetch('/api/relays/for-you').then((r) => r.json() as Promise<ForYouRelaysResponse>),
        createClient().then((sb) => sb.auth.getUser()),
      ])
      setData(resData)
      setUserId(resAuth.data.user?.id ?? null)
    } catch {
      setError('Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const relays = data?.relays ?? []
  const isPersonalized = data?.is_personalized ?? false

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full pb-24">
        {/* Back nav */}
        <div className="px-4 pt-3">
          <Link
            href="/relays"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Relays
          </Link>
        </div>

        <Hero isPersonalized={isPersonalized} />

        {/* Legend */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.entries(REASON_CONFIG) as [RecommendationReason, typeof REASON_CONFIG[RecommendationReason]][])
              .map(([key, { label, icon: Icon, cls }]) => (
                <span
                  key={key}
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono border',
                    cls
                  )}
                >
                  <Icon className="h-2 w-2" aria-hidden="true" />
                  {label}
                </span>
              ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-surface-300/40 mb-3" />

        {/* Content */}
        <div className="px-4 space-y-3">
          {loading && (
            <>
              <RelaySkeleton />
              <RelaySkeleton />
              <RelaySkeleton />
            </>
          )}

          {!loading && error && (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          )}

          {!loading && !error && relays.length === 0 && (
            <EmptyState
              icon={<GitMerge className="h-8 w-8 text-surface-500" />}
              title="No relay picks yet"
              description={
                isPersonalized
                  ? "You've contributed to all relays that match your interests — check back soon as new ones open."
                  : 'Vote on topics and follow topic tags to unlock personalized relay recommendations.'
              }
              action={
                <div className="flex flex-col items-center gap-2">
                  <Link
                    href="/relays"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                  >
                    <GitMerge className="h-4 w-4" />
                    Browse all relays
                  </Link>
                  {!isPersonalized && (
                    <Link
                      href="/tags"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      <Hash className="h-3 w-3" />
                      Follow topic tags
                    </Link>
                  )}
                </div>
              }
            />
          )}

          {!loading && !error && relays.length > 0 && (
            <AnimatePresence initial={false}>
              {relays.map((relay) => (
                <RelayCard
                  key={relay.id}
                  relay={relay}
                  userId={userId}
                  onRefresh={load}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Refresh footer */}
        {!loading && !error && relays.length > 0 && (
          <div className="px-4 pt-4 pb-2 flex justify-center">
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh recommendations
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
