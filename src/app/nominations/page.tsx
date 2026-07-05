'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Scale,
  ShieldCheck,
  Star,
  ThumbsUp,
  User,
  Users,
} from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NominationEntry, NominationRole, NominationStatus } from '@/app/api/nominations/route'

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

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<NominationRole, {
  label: string
  short: string
  icon: typeof Award
  color: string
  bg: string
  border: string
  description: string
}> = {
  grand_council: {
    label: 'Grand Council',
    short: 'Council',
    icon: Star,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Top-20 platform governance members',
  },
  tribunal_judge: {
    label: 'Tribunal Judge',
    short: 'Judge',
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'Civic Tribunal adjudicator panel',
  },
  fact_checker: {
    label: 'Fact Checker',
    short: 'Fact Check',
    icon: ShieldCheck,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Verified platform fact-checker badge',
  },
  debate_moderator: {
    label: 'Debate Moderator',
    short: 'Moderator',
    icon: Users,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Licensed to moderate live debates',
  },
  assembly_rapporteur: {
    label: 'Assembly Rapporteur',
    short: 'Rapporteur',
    icon: Award,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'Citizens Assembly facilitator',
  },
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<NominationStatus, { label: string; color: string }> = {
  open:     { label: 'Open',    color: 'text-gold' },
  elected:  { label: 'Elected', color: 'text-emerald' },
  declined: { label: 'Declined', color: 'text-against-400' },
  expired:  { label: 'Expired', color: 'text-surface-500' },
}

// ─── Endorsement progress bar ─────────────────────────────────────────────────

function EndorseBar({ count, target }: { count: number; target: number }) {
  const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100))
  const color = pct >= 100 ? 'bg-emerald' : pct >= 60 ? 'bg-gold' : 'bg-for-500'
  const textColor = pct >= 100 ? 'text-emerald' : pct >= 60 ? 'text-gold' : 'text-surface-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-white font-semibold">
          {count.toLocaleString()} / {target.toLocaleString()} endorsements
        </span>
        <span className={cn('font-semibold', textColor)}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Nomination Card ──────────────────────────────────────────────────────────

function NominationCard({ nom }: { nom: NominationEntry }) {
  const [expanded, setExpanded] = useState(false)
  const [endorsing, setEndorsing] = useState(false)
  const [endorsed, setEndorsed] = useState(nom.user_has_endorsed)
  const [endorseCount, setEndorseCount] = useState(nom.endorsement_count)

  const role = ROLE_CONFIG[nom.role]
  const RoleIcon = role.icon
  const status = STATUS_BADGE[nom.status]
  const isOpen = nom.status === 'open'
  const isExpiringSoon =
    isOpen && new Date(nom.closes_at).getTime() - Date.now() < 3 * 86_400_000

  async function handleEndorse() {
    if (endorsing) return
    setEndorsing(true)
    try {
      const method = endorsed ? 'DELETE' : 'POST'
      const res = await fetch(`/api/nominations/${nom.id}/endorse`, { method })
      if (res.ok) {
        const next = !endorsed
        setEndorsed(next)
        setEndorseCount((c) => c + (next ? 1 : -1))
      }
    } catch {
      // best-effort
    } finally {
      setEndorsing(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden bg-surface-100 transition-colors',
        isOpen ? `${role.border} hover:opacity-90` : 'border-surface-300',
      )}
    >
      <div className="p-4">
        {/* Role badge + status */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-mono font-semibold', role.bg, role.border, role.color)}>
            <RoleIcon className="h-3 w-3" />
            {role.label}
          </div>
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', status.color)}>
            {status.label}
          </span>
          {isExpiringSoon && (
            <span className="text-[10px] font-mono text-against-400 flex items-center gap-0.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {timeLeft(nom.closes_at)}
            </span>
          )}
          {!isExpiringSoon && isOpen && (
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {timeLeft(nom.closes_at)}
            </span>
          )}
        </div>

        {/* Nominee */}
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', role.bg, role.border, 'border')}>
            {nom.nominee?.avatar_url ? (
              <Avatar src={nom.nominee.avatar_url} fallback={nom.nominee.display_name || nom.nominee.username} size="md" />
            ) : (
              <User className={cn('h-5 w-5', role.color)} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {nom.nominee ? (
              <Link href={`/profile/${nom.nominee.username}`} className="group">
                <p className={cn('text-sm font-bold group-hover:opacity-80 transition-colors', role.color)}>
                  {nom.nominee.display_name || nom.nominee.username}
                </p>
                <p className="text-xs text-surface-500">@{nom.nominee.username}</p>
              </Link>
            ) : (
              <p className="text-sm font-bold text-white">Unknown user</p>
            )}
          </div>
          {nom.nominee && (
            <div className="flex-shrink-0 text-right">
              <div className="text-xs font-mono text-gold">{nom.nominee.clout.toLocaleString()} clout</div>
              <div className="text-[10px] text-surface-600">rep {Math.round(nom.nominee.reputation_score)}</div>
            </div>
          )}
        </div>

        {/* Endorsement progress */}
        <div className="mb-3">
          <EndorseBar count={endorseCount} target={nom.endorsement_target} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {/* Nominator */}
          <div className="flex items-center gap-2">
            {nom.nominator ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-surface-600">by</span>
                <Link href={`/profile/${nom.nominator.username}`} className="text-xs text-surface-500 hover:text-surface-400 transition-colors">
                  {nom.nominator.display_name || nom.nominator.username}
                </Link>
              </div>
            ) : null}
            <span className="text-surface-700 text-[10px]">·</span>
            <span className="text-[10px] text-surface-600">{relativeTime(nom.created_at)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>Less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Reason <ChevronDown className="h-3 w-3" /></>
              )}
            </button>

            {isOpen && nom.nominee_id !== undefined && (
              <button
                onClick={handleEndorse}
                disabled={endorsing}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                  'border transition-all duration-150 disabled:opacity-50',
                  endorsed
                    ? 'bg-emerald/10 border-emerald/40 text-emerald hover:bg-against-500/10 hover:border-against-500/40 hover:text-against-400'
                    : 'bg-surface-300 border-surface-400 text-white hover:bg-for-600/20 hover:border-for-600/50 hover:text-for-300'
                )}
              >
                {endorsing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : endorsed ? (
                  <>
                    <Check className="h-3 w-3" />
                    Endorsed
                  </>
                ) : (
                  <>
                    <ThumbsUp className="h-3 w-3" />
                    Endorse
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded reason */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="p-3.5 rounded-xl bg-surface-200/60 border border-surface-300">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
                  Nomination Reason
                </p>
                <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
                  {nom.reason}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NominationListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = 'open' | 'elected' | 'all'

const TABS: { id: TabId; label: string; param: string }[] = [
  { id: 'open',    label: 'Open',    param: 'open' },
  { id: 'elected', label: 'Elected', param: 'elected' },
  { id: 'all',     label: 'All',     param: 'all' },
]

export default function NominationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('open')
  const [roleFilter, setRoleFilter] = useState<NominationRole | 'all'>('all')
  const [nominations, setNominations] = useState<NominationEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchNominations = useCallback(async (
    tab: TabId,
    role: NominationRole | 'all',
    offset = 0
  ) => {
    const param = TABS.find((t) => t.id === tab)?.param ?? 'open'
    const roleParam = role !== 'all' ? `&role=${role}` : ''
    const res = await fetch(`/api/nominations?status=${param}${roleParam}&limit=20&offset=${offset}`)
    if (!res.ok) return null
    return res.json() as Promise<{ nominations: NominationEntry[]; total: number }>
  }, [])

  useEffect(() => {
    setLoading(true)
    setNominations([])
    fetchNominations(activeTab, roleFilter, 0)
      .then((data) => {
        if (data) {
          setNominations(data.nominations)
          setTotal(data.total)
        }
      })
      .finally(() => setLoading(false))
  }, [activeTab, roleFilter, fetchNominations])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    const data = await fetchNominations(activeTab, roleFilter, nominations.length)
    if (data) {
      setNominations((prev) => [...prev, ...data.nominations])
      setTotal(data.total)
    }
    setLoadingMore(false)
  }

  const hasMore = nominations.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="h-8 w-8 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Award className="h-4 w-4 text-gold" />
              </div>
              <h1 className="text-xl font-bold font-mono text-white">Civic Nominations</h1>
            </div>
            <p className="text-xs text-surface-500 leading-relaxed max-w-sm">
              Citizens nominate each other for formal platform roles. Endorsements
              elect nominees into governance, moderation, and oversight positions.
            </p>
          </div>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          {(Object.entries(ROLE_CONFIG) as [NominationRole, typeof ROLE_CONFIG[NominationRole]][]).map(([key, cfg]) => {
            const Icon = cfg.icon
            const isActive = roleFilter === key
            return (
              <button
                key={key}
                onClick={() => setRoleFilter(isActive ? 'all' : key)}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors text-xs font-mono',
                  isActive
                    ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="leading-tight">{cfg.short}</span>
              </button>
            )
          })}
          {roleFilter !== 'all' && (
            <button
              onClick={() => setRoleFilter('all')}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-surface-300 bg-surface-200 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              All Roles
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-5" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 h-8 rounded-lg text-sm font-mono font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <NominationListSkeleton />
        ) : nominations.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No nominations"
            description={
              activeTab === 'open'
                ? 'No open nominations at the moment. Be the first to nominate a fellow citizen.'
                : 'No nominations match this filter.'
            }
          />
        ) : (
          <div className="space-y-3">
            {nominations.map((nom) => (
              <NominationCard key={nom.id} nom={nom} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50'
              )}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}

        {/* Role guide */}
        <div className="mt-8 pt-6 border-t border-surface-300 space-y-3">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Role Guide</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.entries(ROLE_CONFIG) as [NominationRole, typeof ROLE_CONFIG[NominationRole]][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <div key={key} className={cn('flex items-start gap-2 p-3 rounded-xl border', cfg.bg, cfg.border)}>
                  <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', cfg.color)} />
                  <div>
                    <p className={cn('text-xs font-mono font-semibold', cfg.color)}>{cfg.label}</p>
                    <p className="text-[11px] text-surface-600 mt-0.5 leading-snug">{cfg.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
