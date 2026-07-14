'use client'

/**
 * /bills — Civic Bills Register
 *
 * The parliamentary bill listing page. Shows all bills at every stage
 * of the legislative process. Citizens can filter by stage, category,
 * or bill type, and drill into any bill for full detail.
 *
 * Bill journey:
 *   First Reading → Second Reading → Committee → Report → Third Reading
 *   → Lords → Royal Assent (or Defeated at any stage)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Crown,
  FileText,
  Filter,
  Landmark,
  Plus,
  RefreshCw,
  Scale,
  ScrollText,
  Shield,
  Trophy,
  Users,
  Vote,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Bill, BillsResponse, BillsStats } from '@/app/api/bills/route'

// ─── Stage config ──────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; shortLabel: string; color: string; icon: React.ReactNode; step: number }> = {
  first_reading:  { label: 'First Reading',   shortLabel: '1st',       color: 'text-surface-400 bg-surface-800/60 border-surface-700/40',    icon: <FileText  className="h-3 w-3" />, step: 1 },
  second_reading: { label: 'Second Reading',  shortLabel: '2nd',       color: 'text-for-400 bg-for-900/30 border-for-700/40',                icon: <Vote      className="h-3 w-3" />, step: 2 },
  committee_stage:{ label: 'Committee Stage', shortLabel: 'Committee', color: 'text-purple bg-purple/10 border-purple/30',                   icon: <Users     className="h-3 w-3" />, step: 3 },
  report_stage:   { label: 'Report Stage',    shortLabel: 'Report',    color: 'text-gold bg-gold/10 border-gold/30',                         icon: <ScrollText className="h-3 w-3" />, step: 4 },
  third_reading:  { label: 'Third Reading',   shortLabel: '3rd',       color: 'text-emerald bg-emerald/10 border-emerald/30',                icon: <CheckCircle2 className="h-3 w-3" />, step: 5 },
  lords:          { label: 'Lords',           shortLabel: 'Lords',     color: 'text-amber-400 bg-amber-900/20 border-amber-700/30',          icon: <Crown     className="h-3 w-3" />, step: 6 },
  royal_assent:   { label: 'Royal Assent',    shortLabel: 'Enacted',   color: 'text-gold bg-gold/20 border-gold/50',                        icon: <Trophy    className="h-3 w-3" />, step: 7 },
  defeated:       { label: 'Defeated',        shortLabel: 'Defeated',  color: 'text-against-400 bg-against-900/30 border-against-700/40',   icon: <XCircle   className="h-3 w-3" />, step: 0 },
  withdrawn:      { label: 'Withdrawn',       shortLabel: 'Withdrawn', color: 'text-surface-400 bg-surface-800/50 border-surface-700/30',   icon: <X         className="h-3 w-3" />, step: 0 },
}

const BILL_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  government:      { label: 'Government',      color: 'text-for-400 border-for-700/40 bg-for-900/20' },
  private_members: { label: 'Private Member',  color: 'text-purple border-purple/40 bg-purple/10' },
  opposition:      { label: 'Opposition',      color: 'text-against-400 border-against-700/40 bg-against-900/20' },
  lords:           { label: "Lords' Bill",     color: 'text-gold border-gold/40 bg-gold/10' },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-pink-400',
  Health:      'text-red-400',
  Environment: 'text-emerald',
  Education:   'text-amber-400',
}

// Stage filter pills shown at the top
const STAGE_FILTERS: Array<{ id: string | null; label: string }> = [
  { id: null, label: 'All Bills' },
  { id: 'second_reading',  label: '2nd Reading' },
  { id: 'committee_stage', label: 'Committee' },
  { id: 'report_stage',    label: 'Report' },
  { id: 'third_reading',   label: '3rd Reading' },
  { id: 'lords',           label: 'Lords' },
  { id: 'royal_assent',    label: 'Enacted' },
  { id: 'defeated',        label: 'Defeated' },
]

// ─── Reading progress bar ──────────────────────────────────────────────────────

function ReadingProgress({ stage }: { stage: string }) {
  const current = STAGE_CONFIG[stage]?.step ?? 0
  const total = 7

  const steps = [
    { step: 1, label: '1st' },
    { step: 2, label: '2nd' },
    { step: 3, label: 'Com' },
    { step: 4, label: 'Rep' },
    { step: 5, label: '3rd' },
    { step: 6, label: 'Lords' },
    { step: 7, label: 'Assent' },
  ]

  if (stage === 'defeated' || stage === 'withdrawn') {
    return (
      <div className="flex items-center gap-1 text-against-500 text-xs">
        <XCircle className="h-3.5 w-3.5" />
        <span>{stage === 'defeated' ? 'Defeated' : 'Withdrawn'}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5" aria-label={`Bill stage: ${STAGE_CONFIG[stage]?.label ?? stage}`}>
      {steps.map(({ step }) => (
        <div key={step} className="flex items-center gap-0.5">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all',
              step < current
                ? 'w-5 bg-for-500'
                : step === current
                ? 'w-5 bg-for-400 ring-1 ring-for-300/40'
                : 'w-3 bg-surface-700'
            )}
          />
          {step === total && null}
        </div>
      ))}
      <span className="ml-1 text-[10px] text-surface-500 font-medium">{STAGE_CONFIG[stage]?.shortLabel}</span>
    </div>
  )
}

// ─── Vote bar ──────────────────────────────────────────────────────────────────

function VoteBar({ votesFor, votesAgainst }: { votesFor: number; votesAgainst: number }) {
  const total = votesFor + votesAgainst
  if (total === 0) return null
  const forPct = Math.round((votesFor / total) * 100)

  return (
    <div className="flex items-center gap-2">
      <span className="text-for-400 text-xs font-medium w-8 text-right">{forPct}%</span>
      <div className="flex-1 h-1 rounded-full bg-surface-700 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-against-400 text-xs font-medium w-8">{100 - forPct}%</span>
    </div>
  )
}

// ─── Bill card ─────────────────────────────────────────────────────────────────

function BillCard({ bill }: { bill: Bill }) {
  const stage = STAGE_CONFIG[bill.stage] ?? STAGE_CONFIG.first_reading
  const typeConf = BILL_TYPE_CONFIG[bill.bill_type] ?? BILL_TYPE_CONFIG.government
  const catColor = CATEGORY_COLOR[bill.category] ?? 'text-surface-400'
  const total = bill.votes_for + bill.votes_against

  return (
    <Link href={`/bills/${bill.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'group rounded-xl border bg-surface-900 p-4 transition-colors hover:border-surface-600',
          bill.stage === 'royal_assent'
            ? 'border-gold/30 ring-1 ring-gold/10'
            : bill.stage === 'defeated' || bill.stage === 'withdrawn'
            ? 'border-surface-700/50 opacity-75'
            : 'border-surface-700/50'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', stage.color)}>
                <span className="flex items-center gap-1">
                  {stage.icon}
                  {stage.label}
                </span>
              </span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', typeConf.color)}>
                {typeConf.label}
              </span>
              <span className={cn('text-[10px] font-medium', catColor)}>
                {bill.category}
              </span>
            </div>
            <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-for-200 transition-colors line-clamp-2">
              {bill.short_title}
            </h3>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 shrink-0 mt-1 transition-colors" />
        </div>

        <p className="text-surface-400 text-xs leading-relaxed mb-3 line-clamp-2">
          {bill.long_title}
        </p>

        {/* Reading progress */}
        <div className="mb-3">
          <ReadingProgress stage={bill.stage} />
        </div>

        {/* Vote bar */}
        {total > 0 && (
          <div className="mb-3">
            <VoteBar votesFor={bill.votes_for} votesAgainst={bill.votes_against} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-surface-500">
          <div className="flex items-center gap-2">
            {bill.sponsor ? (
              <div className="flex items-center gap-1">
                <Avatar
                  src={bill.sponsor.avatar_url}
                  username={bill.sponsor.username}
                  size="xs"
                />
                <span>{bill.sponsor.display_name ?? bill.sponsor.username}</span>
              </div>
            ) : (
              <span className="flex items-center gap-1">
                <Landmark className="h-3 w-3" />
                Government
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {total > 0 && (
              <span className="flex items-center gap-1">
                <Vote className="h-3 w-3" />
                {total.toLocaleString()}
              </span>
            )}
            {bill.stage === 'royal_assent' && (
              <span className="text-gold font-medium flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Enacted
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BillCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4">
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <Skeleton className="h-4 w-4/5 rounded mb-2" />
      <Skeleton className="h-4 w-3/5 rounded mb-4" />
      <Skeleton className="h-1.5 w-full rounded mb-3" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: BillsStats | null }) {
  if (!stats) return null
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: 'Total Bills', value: stats.total, color: 'text-white' },
        { label: 'In Progress', value: stats.progressing, color: 'text-for-400' },
        { label: 'Enacted',     value: stats.enacted,     color: 'text-gold' },
        { label: 'Defeated',    value: stats.defeated,    color: 'text-against-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-lg border border-surface-700/50 bg-surface-900/60 p-3 text-center">
          <div className={cn('text-xl font-bold', color)}>{value}</div>
          <div className="text-surface-500 text-[10px] mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ───────────────────────────────────────────────────────────────

export function BillsClient() {
  const [bills, setBills] = useState<Bill[]>([])
  const [stats, setStats] = useState<BillsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const CATEGORIES = ['Economics', 'Politics', 'Technology', 'Science', 'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education']
  const BILL_TYPES = [
    { id: 'government', label: 'Government' },
    { id: 'private_members', label: 'Private Member' },
    { id: 'opposition', label: 'Opposition' },
    { id: 'lords', label: "Lords'" },
  ]

  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (stageFilter) params.set('stage', stageFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (typeFilter) params.set('bill_type', typeFilter)
      params.set('limit', '30')

      const res = await fetch(`/api/bills?${params}`)
      if (!res.ok) throw new Error('Failed to fetch bills')
      const data: BillsResponse = await res.json()
      setBills(data.bills)
      setStats(data.stats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [stageFilter, categoryFilter, typeFilter])

  useEffect(() => { fetchBills() }, [fetchBills])

  const activeFilterCount = [stageFilter, categoryFilter, typeFilter].filter(Boolean).length

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-4">

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ScrollText className="h-5 w-5 text-gold" />
                  <h1 className="text-xl font-bold text-white">Civic Bills</h1>
                </div>
                <p className="text-surface-400 text-sm">
                  Legislation before Parliament — from First Reading to Royal Assent.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/bills/introduce"
                  className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold hover:bg-gold/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Introduce</span>
                </Link>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    showFilters || activeFilterCount > 0
                      ? 'border-for-700/60 bg-for-900/30 text-for-300'
                      : 'border-surface-700/50 bg-surface-900 text-surface-400 hover:text-white hover:border-surface-600'
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-for-500 text-white text-[10px] px-1.5 py-0.5">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={fetchBills}
                  disabled={loading}
                  className="rounded-lg border border-surface-700/50 bg-surface-900 p-1.5 text-surface-400 hover:text-white hover:border-surface-600 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <StatsBar stats={stats} />

          {/* Stage filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {STAGE_FILTERS.map(({ id, label }) => (
              <button
                key={id ?? 'all'}
                onClick={() => setStageFilter(id)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  stageFilter === id
                    ? 'bg-for-600 text-white border-for-500'
                    : 'border-surface-700/50 text-surface-400 hover:text-white hover:border-surface-600 bg-surface-900'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-surface-700/50 bg-surface-900/60 p-4 mb-4 space-y-4">
                  {/* Category */}
                  <div>
                    <div className="text-surface-400 text-xs font-medium mb-2">Category</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setCategoryFilter(null)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs border transition-colors',
                          !categoryFilter
                            ? 'bg-surface-700 text-white border-surface-600'
                            : 'border-surface-700/50 text-surface-400 hover:text-white'
                        )}
                      >
                        All
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs border transition-colors',
                            categoryFilter === cat
                              ? 'bg-for-600 text-white border-for-500'
                              : 'border-surface-700/50 text-surface-400 hover:text-white'
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bill type */}
                  <div>
                    <div className="text-surface-400 text-xs font-medium mb-2">Bill Type</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setTypeFilter(null)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs border transition-colors',
                          !typeFilter
                            ? 'bg-surface-700 text-white border-surface-600'
                            : 'border-surface-700/50 text-surface-400 hover:text-white'
                        )}
                      >
                        All Types
                      </button>
                      {BILL_TYPES.map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => setTypeFilter(id === typeFilter ? null : id)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs border transition-colors',
                            typeFilter === id
                              ? 'bg-for-600 text-white border-for-500'
                              : 'border-surface-700/50 text-surface-400 hover:text-white'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => { setStageFilter(null); setCategoryFilter(null); setTypeFilter(null) }}
                      className="text-against-400 text-xs flex items-center gap-1 hover:text-against-300 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear all filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bill list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <BillCardSkeleton key={i} />)}
            </div>
          ) : bills.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No bills found"
              description="No bills match the current filters. Try adjusting your selection."
              action={{ label: 'Clear filters', onClick: () => { setStageFilter(null); setCategoryFilter(null); setTypeFilter(null) } }}
            />
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {bills.map((bill) => (
                  <BillCard key={bill.id} bill={bill} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Footer links */}
          <div className="mt-8 pt-6 border-t border-surface-800 grid grid-cols-2 gap-3">
            {[
              { href: '/parliament', label: 'Parliament', icon: <Landmark className="h-4 w-4" /> },
              { href: '/divisions', label: 'Division Bell', icon: <Scale className="h-4 w-4" /> },
              { href: '/lords', label: 'House of Lords', icon: <Crown className="h-4 w-4" /> },
              { href: '/committees', label: 'Committees', icon: <Shield className="h-4 w-4" /> },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between rounded-lg border border-surface-700/50 bg-surface-900 px-4 py-3 text-sm text-surface-300 hover:text-white hover:border-surface-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">{icon}</span>
                  {label}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-surface-600" />
              </Link>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
