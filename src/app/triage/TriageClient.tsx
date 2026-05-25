'use client'

/**
 * /triage — Civic Triage
 *
 * A ranked action board showing where each user's vote is most urgently needed.
 * Four urgency tiers, sorted by impact potential:
 *
 *   near_threshold — topics within 8% of passing into law or being rejected
 *   deadlocked     — true 50/50 battles (within 4% of dead centre)
 *   starved        — active debates with <40 votes that need more engagement
 *   expiring       — voting topics closing within the next 48 hours
 *
 * Distinct from:
 *   /tipping-point  — snapshot of threshold proximity, no tier system
 *   /surge          — high velocity, not high urgency
 *   /recommended    — personalised by interest, not by civic need
 *   /daily-quorum   — 3 pre-selected daily topics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  RefreshCw,
  Scale,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TriageResponse, TriageTopic, TriageTier } from '@/app/api/triage/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

interface TierMeta {
  label: string
  description: string
  Icon: typeof Flame
  color: {
    badge: string
    border: string
    bg: string
    glow: string
    bar: string
    pill: string
  }
}

const TIER_META: Record<TriageTier, TierMeta> = {
  near_threshold: {
    label: 'Near the Line',
    description: 'Topics within 8% of passing into law or being rejected. Your vote could tip the scale.',
    Icon: Flame,
    color: {
      badge:  'bg-against-500/20 text-against-300 border border-against-500/30',
      border: 'border-against-500/25',
      bg:     'bg-against-500/5',
      glow:   'shadow-against-500/10',
      bar:    'bg-against-500',
      pill:   'bg-against-500/15 text-against-300',
    },
  },
  deadlocked: {
    label: 'Deadlocked',
    description: 'True 50/50 battles. Deeply contested debates where every voice shifts the balance.',
    Icon: Scale,
    color: {
      badge:  'bg-gold/20 text-gold border border-gold/30',
      border: 'border-gold/25',
      bg:     'bg-gold/5',
      glow:   'shadow-gold/10',
      bar:    'bg-gold',
      pill:   'bg-gold/15 text-gold',
    },
  },
  starved: {
    label: 'Needs Votes',
    description: 'Active debates with fewer than 40 votes. These civic questions need more voices to matter.',
    Icon: Zap,
    color: {
      badge:  'bg-purple/20 text-purple border border-purple/30',
      border: 'border-purple/25',
      bg:     'bg-purple/5',
      glow:   'shadow-purple/10',
      bar:    'bg-purple',
      pill:   'bg-purple/15 text-purple',
    },
  },
  expiring: {
    label: 'Expiring Soon',
    description: 'Voting closes within 48 hours. The outcome is decided in real time — act now.',
    Icon: Clock,
    color: {
      badge:  'bg-for-500/20 text-for-300 border border-for-500/30',
      border: 'border-for-500/25',
      bg:     'bg-for-500/5',
      glow:   'shadow-for-500/10',
      bar:    'bg-for-500',
      pill:   'bg-for-500/15 text-for-300',
    },
  },
}

const TIER_ORDER: TriageTier[] = ['near_threshold', 'deadlocked', 'starved', 'expiring']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h <= 0) return `${Math.max(0, m)}m left`
  if (h < 2) return `${h}h ${m}m left`
  return `${h}h left`
}

const CATEGORY_PILL: Record<string, string> = {
  Politics:    'bg-for-500/10 text-for-300',
  Technology:  'bg-purple/10 text-purple',
  Ethics:      'bg-against-500/10 text-against-300',
  Culture:     'bg-gold/10 text-gold',
  Economics:   'bg-emerald/10 text-emerald',
  Science:     'bg-emerald/10 text-emerald',
  Environment: 'bg-emerald/10 text-emerald',
  Health:      'bg-emerald/10 text-emerald',
  Philosophy:  'bg-purple/10 text-purple',
  Education:   'bg-for-500/10 text-for-300',
}

// ─── VoteBar ─────────────────────────────────────────────────────────────────

function VoteBar({ forPct }: { forPct: number }) {
  const against = 100 - Math.round(forPct)
  const forRnd = Math.round(forPct)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-mono w-7 text-right shrink-0 text-for-400">
        {forRnd}%
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 bg-for-500 rounded-full transition-all duration-500"
          style={{ width: `${forRnd}%` }}
        />
      </div>
      <span className="text-[11px] font-mono w-7 shrink-0 text-against-400">
        {against}%
      </span>
    </div>
  )
}

// ─── TopicCard ────────────────────────────────────────────────────────────────

function TopicCard({ topic, tier }: { topic: TriageTopic; tier: TriageTier }) {
  const meta = TIER_META[tier]
  const catPill = CATEGORY_PILL[topic.category ?? ''] ?? 'bg-surface-300/50 text-surface-600'
  const isExpiring = tier === 'expiring' && topic.voting_ends_at

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-shadow hover:shadow-lg',
        meta.color.bg,
        meta.color.border,
        meta.color.glow,
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {/* Category + urgency */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {topic.category && (
              <span className={cn('text-[10px] font-mono font-medium px-1.5 py-0.5 rounded', catPill)}>
                {topic.category}
              </span>
            )}
            <span className={cn('text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded', meta.color.pill)}>
              {topic.urgency_label}
            </span>
            {isExpiring && (
              <span className="text-[10px] font-mono text-against-400 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {relativeExpiry(topic.voting_ends_at!)}
              </span>
            )}
          </div>
          {/* Statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
        </div>
        {/* View link */}
        <Link
          href={`/topic/${topic.id}`}
          className="shrink-0 p-1.5 rounded-lg bg-surface-200/50 hover:bg-surface-200 text-surface-600 hover:text-white transition-colors"
          aria-label="View debate"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Vote bar */}
      <VoteBar forPct={topic.blue_pct} />

      {/* Urgency detail + vote count */}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-surface-500 leading-snug flex-1">
          {topic.urgency_detail}
        </p>
        <span className="text-[10px] font-mono text-surface-500 shrink-0">
          {topic.total_votes.toLocaleString()} vote{topic.total_votes !== 1 ? 's' : ''}
        </span>
      </div>
    </motion.div>
  )
}

// ─── TierSection ──────────────────────────────────────────────────────────────

function TierSection({
  tier,
  topics,
}: {
  tier: TriageTier
  topics: TriageTopic[]
}) {
  const [expanded, setExpanded] = useState(true)
  const meta = TIER_META[tier]
  const Icon = meta.Icon
  const visible = expanded ? topics : topics.slice(0, 3)

  if (topics.length === 0) return null

  return (
    <section>
      {/* Section header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 mb-3 group"
        aria-expanded={expanded}
      >
        <div
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg shrink-0',
            meta.color.badge,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-sm font-semibold text-white group-hover:text-white/90">
            {meta.label}
            <span className="ml-2 text-[11px] font-mono text-surface-500 font-normal">
              {topics.length} debate{topics.length !== 1 ? 's' : ''}
            </span>
          </h2>
          <p className="text-[11px] text-surface-500 leading-snug">{meta.description}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid gap-2.5 mb-6">
              {visible.map((t) => (
                <TopicCard key={t.id} topic={t} tier={tier} />
              ))}
              {!expanded && topics.length > 3 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-surface-500 hover:text-white text-center py-1 transition-colors"
                >
                  +{topics.length - 3} more
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── SkeletonList ─────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="grid gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TriageClient() {
  const [data, setData] = useState<TriageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/triage', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load triage data')
      const json = (await res.json()) as TriageResponse
      setData(json)
    } catch {
      setError('Could not load triage data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalTopics = data
    ? data.near_threshold.length + data.deadlocked.length + data.starved.length + data.expiring.length
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* ─── Hero header ───────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 text-against-400" />
              <h1 className="font-mono text-xl font-bold text-white">Civic Triage</h1>
            </div>
            <p className="text-sm text-surface-500 leading-snug max-w-sm">
              Where is your vote most needed? Sorted by impact — your action could change an outcome.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
              'text-xs font-medium text-surface-400 hover:text-white',
              'bg-surface-200/60 hover:bg-surface-200 border border-surface-300/50',
              'transition-colors disabled:opacity-50',
            )}
            aria-label="Refresh triage"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ─── Summary chips ─────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="flex items-center gap-2 flex-wrap mb-6">
            {TIER_ORDER.map((tier) => {
              const count = data[tier === 'near_threshold' ? 'near_threshold' : tier === 'deadlocked' ? 'deadlocked' : tier === 'starved' ? 'starved' : 'expiring'].length
              if (count === 0) return null
              const meta = TIER_META[tier]
              const Icon = meta.Icon
              return (
                <span
                  key={tier}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium',
                    meta.color.badge,
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {count} {meta.label}
                </span>
              )
            })}
            <span className="text-[11px] text-surface-500 font-mono ml-auto">
              {totalTopics} total
            </span>
          </div>
        )}

        {/* ─── Content ───────────────────────────────────────────────────────── */}
        {loading && <SkeletonList />}

        {error && (
          <div className="text-center py-16">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm text-surface-500 mb-4">{error}</p>
            <button
              onClick={() => load()}
              className="text-sm text-for-400 hover:text-for-300 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {totalTopics === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All clear"
                description="No debates are in urgent need right now. Check back soon — civic activity is always in motion."
              />
            ) : (
              <div className="space-y-2">
                {TIER_ORDER.map((tier) => {
                  const topics = tier === 'near_threshold'
                    ? data.near_threshold
                    : tier === 'deadlocked'
                    ? data.deadlocked
                    : tier === 'starved'
                    ? data.starved
                    : data.expiring
                  return (
                    <TierSection key={tier} tier={tier} topics={topics} />
                  )
                })}
              </div>
            )}

            {/* ─── Footer ──────────────────────────────────────────────────── */}
            <div className="mt-8 pt-6 border-t border-surface-300/50 flex items-center justify-between text-[11px] font-mono text-surface-500">
              <span>Updated {new Date(data.generated_at).toLocaleTimeString()}</span>
              <div className="flex items-center gap-3">
                <Link href="/tipping-point" className="hover:text-white transition-colors">
                  Tipping Point →
                </Link>
                <Link href="/surge" className="hover:text-white transition-colors">
                  Surge →
                </Link>
                <Link href="/floor" className="hover:text-white transition-colors">
                  The Floor →
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
