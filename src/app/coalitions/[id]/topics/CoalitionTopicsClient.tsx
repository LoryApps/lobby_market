'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Minus,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { StanceWithTopic, CoalitionSummary } from './page'

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'for' | 'against' | 'neutral'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getAlignment(stance: 'for' | 'against' | 'neutral', bluePct: number) {
  if (stance === 'neutral') {
    return { label: 'Neutral', color: 'text-surface-400', bg: 'bg-surface-200/40', border: 'border-surface-300' }
  }
  const communityFor = bluePct > 50
  const withCommunity = (stance === 'for' && communityFor) || (stance === 'against' && !communityFor)
  return withCommunity
    ? { label: 'With majority', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/20' }
    : { label: 'Against majority', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' }
}

const STATUS_CLASSES: Record<string, string> = {
  proposed: 'text-surface-400 bg-surface-300/20 border-surface-300/40',
  active: 'text-for-400 bg-for-500/10 border-for-500/20',
  voting: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  law: 'text-emerald bg-emerald/10 border-emerald/20',
  failed: 'text-against-400 bg-against-500/10 border-against-500/20',
}

const STANCE_CONFIG = {
  for: {
    icon: ThumbsUp,
    label: 'FOR',
    cardBorder: 'border-for-500/30 hover:border-for-500/60',
    badge: 'bg-for-500/10 border-for-500/30 text-for-300',
  },
  against: {
    icon: ThumbsDown,
    label: 'AGAINST',
    cardBorder: 'border-against-500/30 hover:border-against-500/60',
    badge: 'bg-against-500/10 border-against-500/30 text-against-300',
  },
  neutral: {
    icon: Minus,
    label: 'NEUTRAL',
    cardBorder: 'border-surface-300 hover:border-surface-400',
    badge: 'bg-surface-200/60 border-surface-300 text-surface-400',
  },
} as const

// ─── Stance card ──────────────────────────────────────────────────────────────

function StanceCard({ stance }: { stance: StanceWithTopic }) {
  const topic = stance.topic
  if (!topic) return null

  const cfg = STANCE_CONFIG[stance.stance]
  const Icon = cfg.icon
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const align = getAlignment(stance.stance, topic.blue_pct ?? 50)
  const statusLabel = topic.status.charAt(0).toUpperCase() + topic.status.slice(1)
  const statusClass = STATUS_CLASSES[topic.status] ?? STATUS_CLASSES.proposed

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-5 transition-colors',
        cfg.cardBorder
      )}
    >
      {/* Stance badge + topic status + category */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border',
            cfg.badge
          )}
        >
          <Icon className="h-2.5 w-2.5" aria-hidden="true" />
          {cfg.label}
        </span>
        <span className={cn('text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border', statusClass)}>
          {statusLabel}
        </span>
        {topic.category && (
          <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
        )}
      </div>

      {/* Topic statement */}
      <Link href={`/topic/${topic.id}`} className="group flex items-start gap-1.5">
        <p className="font-mono text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-3">
          {topic.statement}
        </p>
        <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-for-400 flex-shrink-0 mt-0.5 transition-colors" aria-hidden="true" />
      </Link>

      {/* Coalition reasoning */}
      {stance.statement && (
        <p className="mt-2 text-[11px] font-mono text-surface-500 italic leading-relaxed border-l-2 border-surface-300 pl-3">
          &ldquo;{stance.statement}&rdquo;
        </p>
      )}

      {/* Community vote bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-[10px] font-mono text-surface-500">
          <span className="text-for-400">{forPct}% For</span>
          <span>{topic.total_votes.toLocaleString()} votes</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-500 rounded-full"
            style={{ width: `${forPct}%` }}
            role="meter"
            aria-valuenow={forPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${forPct}% support`}
          />
        </div>
      </div>

      {/* Alignment indicator + timestamp */}
      <div className="mt-3 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border',
            align.bg, align.border, align.color
          )}
        >
          {stance.stance === 'neutral' ? (
            <Minus className="h-2.5 w-2.5" aria-hidden="true" />
          ) : align.label === 'With majority' ? (
            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
          ) : (
            <XCircle className="h-2.5 w-2.5" aria-hidden="true" />
          )}
          {align.label}
        </span>
        <span className="text-[10px] font-mono text-surface-500">
          {relativeTime(stance.created_at)}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Filter tab bar ───────────────────────────────────────────────────────────

const FILTER_TABS: { id: Filter; label: string; icon: typeof Shield }[] = [
  { id: 'all', label: 'All', icon: Shield },
  { id: 'for', label: 'FOR', icon: ThumbsUp },
  { id: 'against', label: 'AGAINST', icon: ThumbsDown },
  { id: 'neutral', label: 'NEUTRAL', icon: Minus },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface CoalitionTopicsClientProps {
  coalition: CoalitionSummary
  initialStances: StanceWithTopic[]
}

export function CoalitionTopicsClient({ coalition, initialStances }: CoalitionTopicsClientProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const counts = {
    all: initialStances.length,
    for: initialStances.filter((s) => s.stance === 'for').length,
    against: initialStances.filter((s) => s.stance === 'against').length,
    neutral: initialStances.filter((s) => s.stance === 'neutral').length,
  }

  const filtered = filter === 'all' ? initialStances : initialStances.filter((s) => s.stance === filter)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* Sub-header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-3xl mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href={`/coalitions/${coalition.id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to coalition"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-mono font-semibold text-white truncate">
              {coalition.name}
            </span>
            <span className="ml-2 text-xs font-mono text-surface-500">· Policy Positions</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-for-500/10 border border-for-500/20 text-for-400 flex-shrink-0">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Policy Positions</h1>
              <p className="font-mono text-[11px] text-surface-500">
                {counts.all} official stance{counts.all !== 1 ? 's' : ''} declared
              </p>
            </div>
          </div>
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Where <span className="text-white">{coalition.name}</span> officially stands on civic debates. Stances are
            declared by coalition leaders and appear publicly on each topic page.
          </p>
        </div>

        {/* Summary pills */}
        {counts.all > 0 && (
          <div className="flex flex-wrap gap-2">
            {counts.for > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-for-500/10 border border-for-500/20 text-for-300">
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                {counts.for} FOR
              </span>
            )}
            {counts.against > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-against-500/10 border border-against-500/20 text-against-300">
                <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                {counts.against} AGAINST
              </span>
            )}
            {counts.neutral > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-surface-200 border border-surface-300 text-surface-400">
                <Minus className="h-3 w-3" aria-hidden="true" />
                {counts.neutral} NEUTRAL
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-surface-200 border border-surface-300 text-surface-400 ml-auto">
              <Users className="h-3 w-3" aria-hidden="true" />
              {coalition.member_count} members
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold">
              <Zap className="h-3 w-3" aria-hidden="true" />
              {Math.round(coalition.coalition_influence)} influence
            </span>
          </div>
        )}

        {/* Filter tabs */}
        <div
          className="flex gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1"
          role="tablist"
          aria-label="Filter positions by stance"
        >
          {FILTER_TABS.map((tab) => {
            const count = counts[tab.id]
            const Icon = tab.icon
            const isActive = filter === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors',
                  isActive
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                <span className="hidden sm:inline">{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1 tabular-nums text-[9px]',
                      isActive ? 'bg-surface-400/50 text-surface-300' : 'bg-surface-200 text-surface-500'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Stance cards */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={filter === 'all' ? 'No positions declared yet' : `No ${filter.toUpperCase()} positions`}
            description={
              filter === 'all'
                ? 'This coalition has not declared any official policy positions yet. Coalition leaders can add positions from the main coalition page.'
                : `This coalition has not declared any ${filter.toUpperCase()} positions. Try a different filter.`
            }
            actions={[{
              label: 'Go to coalition page',
              href: `/coalitions/${coalition.id}`,
              icon: Users,
            }]}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {filtered.map((stance) => (
                <StanceCard key={stance.id} stance={stance} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Footer note for leaders */}
        {counts.all > 0 && (
          <p className="text-center text-[11px] font-mono text-surface-500 pt-2">
            Coalition leaders can manage positions on the{' '}
            <Link href={`/coalitions/${coalition.id}`} className="text-for-400 hover:text-for-300 underline">
              coalition page
            </Link>
            .
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
