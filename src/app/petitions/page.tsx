'use client'

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
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsUp,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PetitionEntry, PetitionsResponse } from '@/app/api/petitions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  return 'Expires soon'
}

// ─── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

function categoryColor(cat: string | null) {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Scale; color: string; bg: string; border: string }
> = {
  pending:  { label: 'Active',   icon: Scale,         color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  approved: { label: 'Approved', icon: CheckCircle2,  color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  rejected: { label: 'Rejected', icon: XCircle,       color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  expired:  { label: 'Expired',  icon: Clock,         color: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-400/20' },
}

// ─── Status tabs ──────────────────────────────────────────────────────────────

type TabId = 'pending' | 'approved' | 'all'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pending',  label: 'Active' },
  { id: 'approved', label: 'Approved' },
  { id: 'all',      label: 'All' },
]

// ─── Petition Card ─────────────────────────────────────────────────────────────

function PetitionCard({ petition }: { petition: PetitionEntry }) {
  const [expanded, setExpanded] = useState(false)
  const [consenting, setConsenting] = useState(false)
  const [consented, setConsented] = useState(petition.user_has_consented)
  const [consentCount, setConsentCount] = useState(petition.consent_count)
  const [consentError, setConsentError] = useState<string | null>(null)

  const statusCfg = STATUS_CONFIG[petition.status] ?? STATUS_CONFIG.pending
  const StatusIcon = statusCfg.icon
  const pct = petition.total_original_voters > 0
    ? Math.round((consentCount / petition.total_original_voters) * 100)
    : 0
  const isActive = petition.status === 'pending'

  async function handleConsent() {
    if (consented || consenting || !isActive) return
    setConsenting(true)
    setConsentError(null)
    try {
      const res = await fetch(`/api/laws/${petition.law_id}/reopen/consent`, {
        method: 'POST',
      })
      if (res.ok) {
        setConsented(true)
        setConsentCount((n) => n + 1)
      } else {
        const body = await res.json()
        setConsentError(body.error ?? 'Failed to sign')
      }
    } catch {
      setConsentError('Network error')
    } finally {
      setConsenting(false)
    }
  }

  const casePreview = petition.case_for_repeal.slice(0, 200)
  const caseIsTruncated = petition.case_for_repeal.length > 200

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'transition-colors hover:border-surface-400',
        isActive ? 'border-surface-300' : 'border-surface-200/60'
      )}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold border flex-shrink-0',
              statusCfg.color, statusCfg.bg, statusCfg.border
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </span>

          {/* Time info */}
          {isActive && (
            <span className="text-xs font-mono text-surface-500 flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3 w-3" />
              {timeLeft(petition.expires_at)}
            </span>
          )}
          {!isActive && (
            <span className="text-xs font-mono text-surface-600">
              {relativeTime(petition.created_at)}
            </span>
          )}
        </div>

        {/* Law statement */}
        {petition.law ? (
          <Link
            href={`/law/${petition.law_id}`}
            className="group block mb-2"
          >
            <div className="flex items-start gap-2">
              <Gavel className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" />
              <p className="font-mono text-sm font-semibold text-white group-hover:text-gold transition-colors leading-snug">
                {petition.law.statement}
              </p>
            </div>
            {petition.law.category && (
              <span className={cn('text-xs font-mono mt-1 inline-block pl-6', categoryColor(petition.law.category))}>
                {petition.law.category}
              </span>
            )}
          </Link>
        ) : (
          <p className="font-mono text-sm text-surface-500 mb-2">Law not found</p>
        )}

        {/* Requester */}
        {petition.requester && (
          <div className="flex items-center gap-2 mb-3 pl-6">
            <span className="text-xs font-mono text-surface-500">Filed by</span>
            <Link href={`/profile/${petition.requester.username}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <Avatar
                src={petition.requester.avatar_url}
                fallback={petition.requester.username}
                size="xs"
              />
              <span className="text-xs font-mono text-surface-600 hover:text-white transition-colors">
                {petition.requester.display_name ?? petition.requester.username}
              </span>
            </Link>
            <span className="text-xs font-mono text-surface-600">·</span>
            <span className="text-xs font-mono text-surface-600">{relativeTime(petition.created_at)}</span>
          </div>
        )}

        {/* Case preview */}
        <div className="bg-surface-200/50 rounded-xl p-3 border border-surface-300/50">
          <p className="text-xs font-mono text-surface-500 mb-1.5 flex items-center gap-1">
            <Scale className="h-3 w-3" />
            Case for repeal
          </p>
          <p className="text-sm text-surface-700 leading-relaxed">
            {expanded ? petition.case_for_repeal : casePreview}
            {!expanded && caseIsTruncated && '…'}
          </p>
          {caseIsTruncated && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" />Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" />Read full case</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Progress bar + consent action ────────────────────────────────── */}
      <div className={cn(
        'px-4 py-3 border-t border-surface-300/50',
        isActive ? 'bg-surface-200/30' : 'bg-surface-100'
      )}>
        <div className="flex items-center justify-between gap-4">
          {/* Progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono text-surface-500 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {consentCount.toLocaleString()} / {petition.total_original_voters.toLocaleString()} original voters
              </span>
              <span className={cn(
                'text-xs font-mono font-bold',
                pct >= 50 ? 'text-gold' : pct >= 25 ? 'text-for-400' : 'text-surface-500'
              )}>
                {pct}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  pct >= 100 ? 'bg-emerald' : pct >= 50 ? 'bg-gold' : 'bg-for-500'
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>

          {/* Action */}
          {isActive && (
            <div className="flex-shrink-0">
              {petition.user_can_consent ? (
                consented ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald/10 border border-emerald/30 text-emerald text-xs font-mono">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed
                  </span>
                ) : (
                  <button
                    onClick={handleConsent}
                    disabled={consenting}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                      'bg-gold/10 border border-gold/30 text-gold',
                      'hover:bg-gold/20 hover:border-gold/50 transition-all',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {consenting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-3.5 w-3.5" />
                    )}
                    Sign
                  </button>
                )
              ) : (
                <Link
                  href={`/law/${petition.law_id}`}
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:text-white transition-colors'
                  )}
                >
                  View <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </div>

        {consentError && (
          <p className="mt-2 text-xs font-mono text-against-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {consentError}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Loading skeletons ─────────────────────────────────────────────────────────

function PetitionSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-40 rounded" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PetitionsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pending')
  const [petitions, setPetitions] = useState<PetitionEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (tab: TabId, refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/petitions?status=${tab}&limit=40`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PetitionsResponse = await res.json()
      setPetitions(data.petitions)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load petitions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(activeTab)
  }, [activeTab, load])

  function handleTabChange(tab: TabId) {
    if (tab === activeTab) return
    setActiveTab(tab)
    setPetitions([])
  }

  const pendingCount = activeTab === 'pending' ? total : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0 mt-0.5">
                <Scale className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Repeal Petitions
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
                  Active challenges to established laws. Original voters may sign to trigger a re-vote.
                </p>
              </div>
            </div>

            <button
              onClick={() => load(activeTab, true)}
              disabled={refreshing}
              aria-label="Refresh petitions"
              className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Stats strip */}
          {!loading && pendingCount !== null && (
            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-surface-500">
              <Scale className="h-3.5 w-3.5 text-gold" />
              <span>
                {pendingCount === 0
                  ? 'No active petitions'
                  : pendingCount === 1
                  ? '1 active petition'
                  : `${pendingCount} active petitions`}
              </span>
            </div>
          )}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-surface-200 rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-surface-50 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-600'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── How it works info box ─────────────────────────────────────── */}
        <div className={cn(
          'mb-6 rounded-xl border border-surface-300/50 bg-surface-200/30 p-4',
          'flex items-start gap-3'
        )}>
          <AlertTriangle className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-surface-500 leading-relaxed space-y-1">
            <p className="text-surface-600 font-semibold">How repeal petitions work</p>
            <p>Any original voter on a topic may file a repeal petition with a written case (200+ chars). If a majority of original voters sign, the law is sent back for re-vote. Petitions expire after 30 days.</p>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <PetitionSkeleton key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" />
              <p className="font-mono text-sm text-surface-500">{error}</p>
              <button
                onClick={() => load(activeTab)}
                className="mt-4 text-xs font-mono text-for-400 hover:text-for-300 transition-colors underline"
              >
                Try again
              </button>
            </motion.div>
          ) : petitions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Scale}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title={
                  activeTab === 'pending'
                    ? 'No active petitions'
                    : activeTab === 'approved'
                    ? 'No approved petitions'
                    : 'No petitions yet'
                }
                description={
                  activeTab === 'pending'
                    ? 'No laws are currently being challenged. When an original voter files a repeal petition, it will appear here.'
                    : activeTab === 'approved'
                    ? 'No petitions have reached the consent threshold yet.'
                    : 'No repeal petitions have been filed. Visit any established law to challenge it.'
                }
                actions={[
                  {
                    label: 'Browse the Codex',
                    href: '/law',
                    icon: ArrowRight,
                  },
                ]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {petitions.map((petition) => (
                <PetitionCard key={petition.id} petition={petition} />
              ))}

              {/* Load-more hint if there are more */}
              {total > petitions.length && (
                <p className="text-center text-xs font-mono text-surface-600 pt-2">
                  Showing {petitions.length} of {total} petitions
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
