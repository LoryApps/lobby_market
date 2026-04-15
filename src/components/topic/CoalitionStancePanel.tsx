'use client'

/**
 * CoalitionStancePanel
 *
 * Displays which coalitions have officially declared FOR, AGAINST, or NEUTRAL
 * on this topic.  Fetches from /api/topics/[id]/coalition-stances.
 *
 * Rendered inside the Details tab of TopicDetail for active and voting topics.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { CoalitionStanceEntry } from '@/app/api/topics/[id]/coalition-stances/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stanceConfig(stance: 'for' | 'against' | 'neutral') {
  switch (stance) {
    case 'for':
      return {
        label: 'FOR',
        dot: 'bg-for-500',
        border: 'border-for-500/30',
        bg: 'bg-for-500/10',
        text: 'text-for-300',
        header: 'text-for-300',
        headerBg: 'bg-for-500/10 border-for-500/20',
      }
    case 'against':
      return {
        label: 'AGAINST',
        dot: 'bg-against-500',
        border: 'border-against-500/30',
        bg: 'bg-against-500/10',
        text: 'text-against-300',
        header: 'text-against-300',
        headerBg: 'bg-against-500/10 border-against-500/20',
      }
    default:
      return {
        label: 'NEUTRAL',
        dot: 'bg-surface-400',
        border: 'border-surface-300',
        bg: 'bg-surface-200/60',
        text: 'text-surface-500',
        header: 'text-surface-500',
        headerBg: 'bg-surface-200/30 border-surface-300',
      }
  }
}

function formatInfluence(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(0)
}

// ─── Single stance row ────────────────────────────────────────────────────────

function StanceRow({ entry }: { entry: CoalitionStanceEntry }) {
  const cfg = stanceConfig(entry.stance)
  const coalition = entry.coalition
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 transition-colors',
        cfg.border,
        cfg.bg
      )}
    >
      <div className="flex items-center gap-3">
        {/* Coalition identity */}
        <Link
          href={`/coalitions/${coalition.id}`}
          className="flex items-center gap-2.5 flex-1 min-w-0 group"
          aria-label={`View ${coalition.name}`}
        >
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-surface-300 bg-surface-200 text-xs font-bold"
            style={{ color: coalition.color ?? undefined }}
            aria-hidden="true"
          >
            {coalition.badge_emoji ?? coalition.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate group-hover:text-for-300 transition-colors">
              {coalition.name}
            </p>
            <p className="text-[11px] font-mono text-surface-500 truncate">
              {coalition.member_count} members · {formatInfluence(coalition.coalition_influence)} influence
            </p>
          </div>
        </Link>

        {/* Stance badge */}
        <span
          className={cn(
            'flex-shrink-0 text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border',
            cfg.headerBg,
            cfg.header
          )}
        >
          {cfg.label}
        </span>

        {/* Expand statement toggle */}
        {entry.statement && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse statement' : 'Read statement'}
            className="flex-shrink-0 text-surface-500 hover:text-white transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Expandable statement */}
      <AnimatePresence>
        {expanded && entry.statement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-surface-300/50">
              <p className="text-xs text-surface-700 leading-relaxed italic">
                &ldquo;{entry.statement}&rdquo;
              </p>
              {entry.declarer && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Avatar
                    src={entry.declarer.avatar_url}
                    fallback={entry.declarer.display_name || entry.declarer.username}
                    size="xs"
                  />
                  <Link
                    href={`/profile/${entry.declarer.username}`}
                    className="text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
                  >
                    — @{entry.declarer.username}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Stance group ──────────────────────────────────────────────────────────────

function StanceGroup({
  stance,
  entries,
}: {
  stance: 'for' | 'against' | 'neutral'
  entries: CoalitionStanceEntry[]
}) {
  if (entries.length === 0) return null
  const cfg = stanceConfig(stance)
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} aria-hidden="true" />
        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', cfg.text)}>
          {cfg.label} ({entries.length})
        </span>
      </div>
      <div className="space-y-2">
        {entries.map((e) => (
          <StanceRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-200 mb-3">
        <Users className="h-5 w-5 text-surface-500" aria-hidden="true" />
      </div>
      <p className="text-sm font-mono text-surface-500">
        No coalitions have declared a stance yet.
      </p>
      <p className="text-[11px] font-mono text-surface-600 mt-1">
        Coalition leaders can go to their coalition page to weigh in.
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CoalitionStancePanelProps {
  topicId: string
  className?: string
}

export function CoalitionStancePanel({
  topicId,
  className,
}: CoalitionStancePanelProps) {
  const [stances, setStances] = useState<CoalitionStanceEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch(`/api/topics/${topicId}/coalition-stances`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!mounted) return
        setStances((d?.stances as CoalitionStanceEntry[]) ?? [])
      })
      .catch(() => {
        if (mounted) setStances([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [topicId])

  const forStances = stances?.filter((s) => s.stance === 'for') ?? []
  const againstStances = stances?.filter((s) => s.stance === 'against') ?? []
  const neutralStances = stances?.filter((s) => s.stance === 'neutral') ?? []

  const totalStances = (stances?.length ?? 0)

  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-300 bg-surface-100',
        className
      )}
      role="region"
      aria-label="Coalition stances"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-200">
            <Shield className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
          </div>
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
            Coalition Stances
          </span>
        </div>
        {totalStances > 0 && (
          <span className="text-[10px] font-mono text-surface-500">
            {totalStances} coalition{totalStances !== 1 ? 's' : ''} weighed in
          </span>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-surface-200/50 animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : totalStances === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            <StanceGroup stance="for" entries={forStances} />
            <StanceGroup stance="against" entries={againstStances} />
            <StanceGroup stance="neutral" entries={neutralStances} />
          </div>
        )}
      </div>
    </div>
  )
}
