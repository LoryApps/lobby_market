'use client'

/**
 * /delegate — Liquid Democracy Hub
 *
 * Users can delegate their voting power to trusted citizens for:
 *   • A specific topic          (topic-scoped delegation)
 *   • An entire category        (category-scoped delegation)
 *   • Everything (global)       (global catch-all delegation)
 *
 * Your own explicit vote always takes precedence over any delegation.
 * Delegations are advisory — this page helps you discover and act on
 * delegate positions, but you remain in full control of your vote.
 *
 * Sections:
 *   1. Stats header (delegations given / received)
 *   2. Your active delegations (with revoke)
 *   3. Trusted By you (people who delegated to you)
 *   4. Add delegation — search + scope picker
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Check,
  Crown,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Tag,
  ThumbsUp,
  Trash2,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DelegationResponse,
  DelegationEntry,
  ReceivedDelegation,
} from '@/app/api/delegation/route'
import type {
  DelegateCandidate,
  DelegateSearchResponse,
} from '@/app/api/delegation/search/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

type Category = typeof CATEGORIES[number]

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debater',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ARCHETYPE_LABEL: Record<string, string> = {
  guardian: 'Guardian',
  reformer: 'Reformer',
  skeptic: 'Skeptic',
  visionary: 'Visionary',
  analyst: 'Analyst',
  advocate: 'Advocate',
}

function scopeLabel(entry: Pick<DelegationEntry, 'topic_statement' | 'category'>): string {
  if (entry.topic_statement) return `Topic: "${entry.topic_statement.slice(0, 50)}..."`
  if (entry.category) return `Category: ${entry.category}`
  return 'Global (all topics)'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex-1 min-w-0 rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center gap-1">
      <Icon className={cn('h-5 w-5', color)} />
      <span className={cn('text-2xl font-mono font-bold tabular-nums', color)}>{value}</span>
      <span className="text-[11px] text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

function DelegationCard({
  entry,
  onRevoke,
}: {
  entry: DelegationEntry
  onRevoke: (id: string) => void
}) {
  const [revoking, setRevoking] = useState(false)

  async function handleRevoke() {
    setRevoking(true)
    try {
      const res = await fetch(`/api/delegation?id=${entry.id}`, { method: 'DELETE' })
      if (res.ok) onRevoke(entry.id)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-start gap-3">
        <Link href={`/profile/${entry.delegate_username}`}>
          <Avatar
            src={entry.delegate_avatar_url}
            fallback={entry.delegate_display_name || entry.delegate_username}
            size="md"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.delegate_username}`}
              className="font-semibold text-white hover:text-for-300 transition-colors text-sm"
            >
              {entry.delegate_display_name || `@${entry.delegate_username}`}
            </Link>
            <span className="text-[11px] text-surface-500">@{entry.delegate_username}</span>
            <Badge variant={entry.delegate_role as 'proposed'} className="text-[10px] py-0 px-1.5">
              {ROLE_LABELS[entry.delegate_role] ?? entry.delegate_role}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-gold font-mono">{entry.delegate_clout.toLocaleString()} clout</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {entry.topic_statement ? (
              <Tag className="h-3 w-3 text-purple flex-shrink-0" />
            ) : entry.category ? (
              <Shield className="h-3 w-3 text-emerald flex-shrink-0" />
            ) : (
              <Globe className="h-3 w-3 text-for-400 flex-shrink-0" />
            )}
            <span className="text-[11px] text-surface-500 truncate">
              {scopeLabel(entry)}
            </span>
          </div>
          <p className="text-[10px] text-surface-600 mt-1">
            Delegated {relativeTime(entry.created_at)}
          </p>
        </div>
        <button
          onClick={handleRevoke}
          disabled={revoking}
          aria-label="Revoke delegation"
          className={cn(
            'flex-shrink-0 p-2 rounded-lg border transition-all',
            'text-surface-500 border-surface-300',
            'hover:text-against-400 hover:border-against-500/50 hover:bg-against-500/10',
            'disabled:opacity-50',
          )}
        >
          {revoking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </motion.div>
  )
}

function ReceivedCard({ entry }: { entry: ReceivedDelegation }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-start gap-3">
        <Link href={`/profile/${entry.delegator_username}`}>
          <Avatar
            src={entry.delegator_avatar_url}
            fallback={entry.delegator_display_name || entry.delegator_username}
            size="md"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.delegator_username}`}
              className="font-semibold text-white hover:text-for-300 transition-colors text-sm"
            >
              {entry.delegator_display_name || `@${entry.delegator_username}`}
            </Link>
            <span className="text-[11px] text-surface-500">@{entry.delegator_username}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {entry.topic_statement ? (
              <Tag className="h-3 w-3 text-purple flex-shrink-0" />
            ) : entry.category ? (
              <Shield className="h-3 w-3 text-emerald flex-shrink-0" />
            ) : (
              <Globe className="h-3 w-3 text-for-400 flex-shrink-0" />
            )}
            <span className="text-[11px] text-surface-500 truncate">
              {scopeLabel({
                topic_statement: entry.topic_statement,
                category: entry.category,
              })}
            </span>
          </div>
          <p className="text-[10px] text-surface-600 mt-1">
            Trusted you {relativeTime(entry.created_at)}
          </p>
        </div>
        <UserCheck className="h-4 w-4 text-emerald flex-shrink-0 mt-1" />
      </div>
    </motion.div>
  )
}

// ─── Alignment badge ──────────────────────────────────────────────────────────

function AlignmentBadge({ pct, common }: { pct: number; common: number }) {
  const color =
    pct >= 75 ? 'bg-emerald/15 border-emerald/40 text-emerald' :
    pct >= 50 ? 'bg-for-500/15 border-for-500/40 text-for-300' :
    pct >= 30 ? 'bg-gold/15 border-gold/40 text-gold' :
                'bg-against-500/10 border-against-500/30 text-against-300'

  const label =
    pct >= 75 ? 'Aligned' :
    pct >= 50 ? 'Moderate' :
    pct >= 30 ? 'Mixed' :
                'Divergent'

  return (
    <span
      title={`${pct}% alignment on ${common} shared topics`}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full',
        'text-[10px] font-mono font-semibold border leading-none flex-shrink-0',
        color,
      )}
    >
      {pct}% {label}
    </span>
  )
}

function CandidateRow({
  candidate,
  onDelegate,
  scope,
}: {
  candidate: DelegateCandidate
  onDelegate: (id: string) => void
  scope: { type: 'global' | 'category' | 'topic'; category?: string; topicId?: string }
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleDelegate() {
    setBusy(true)
    try {
      const body: Record<string, unknown> = { delegate_id: candidate.id }
      if (scope.type === 'category') body.category = scope.category
      if (scope.type === 'topic') body.topic_id = scope.topicId
      const res = await fetch('/api/delegation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setDone(true)
        onDelegate(candidate.id)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors">
      <Link href={`/profile/${candidate.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
        <Avatar
          src={candidate.avatar_url}
          fallback={candidate.display_name || candidate.username}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-white truncate">
              {candidate.display_name || candidate.username}
            </span>
            {candidate.civic_archetype && (
              <span className="text-[10px] text-purple">
                {ARCHETYPE_LABEL[candidate.civic_archetype] ?? candidate.civic_archetype}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-gold font-mono">{candidate.clout.toLocaleString()} clout</span>
            <span className="text-[10px] text-surface-500">{candidate.total_votes.toLocaleString()} votes</span>
            {candidate.trusted_by > 0 && (
              <span className="text-[10px] text-emerald">{candidate.trusted_by} trust</span>
            )}
            {candidate.alignment_pct !== null && candidate.topics_in_common >= 5 && (
              <AlignmentBadge pct={candidate.alignment_pct} common={candidate.topics_in_common} />
            )}
          </div>
        </div>
      </Link>
      <button
        onClick={handleDelegate}
        disabled={busy || done}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all',
          done
            ? 'bg-emerald/20 border-emerald/50 text-emerald'
            : 'bg-for-600/80 border-for-600/50 text-white hover:bg-for-600',
          'disabled:opacity-60',
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : done ? (
          <Check className="h-3 w-3" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
        {done ? 'Delegated' : 'Delegate'}
      </button>
    </div>
  )
}

// ─── Add Delegation Panel ──────────────────────────────────────────────────────

type ScopeType = 'global' | 'category' | 'topic'

interface AddPanelProps {
  onAdded: () => void
}

function AddDelegationPanel({ onAdded }: AddPanelProps) {
  const [scopeType, setScopeType] = useState<ScopeType>('global')
  const [selectedCategory, setSelectedCategory] = useState<Category>('Politics')
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<DelegateCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/delegation/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json() as DelegateSearchResponse
          setCandidates(data.candidates)
        }
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [query])

  const scope = {
    type: scopeType,
    category: scopeType === 'category' ? selectedCategory : undefined,
    topicId: undefined,
  }

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-for-400" />
        <h3 className="text-sm font-semibold text-white">Add Delegation</h3>
      </div>

      {/* Scope picker */}
      <div>
        <p className="text-[11px] text-surface-500 mb-2 uppercase tracking-wider font-medium">Delegation Scope</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'global', label: 'Global', icon: Globe, desc: 'All topics', color: 'text-for-400' },
              { id: 'category', label: 'Category', icon: Shield, desc: 'One category', color: 'text-emerald' },
              { id: 'topic', label: 'Topic', icon: Tag, desc: 'One topic', color: 'text-purple' },
            ] as const
          ).map(({ id, label, icon: Icon, desc, color }) => (
            <button
              key={id}
              onClick={() => setScopeType(id)}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all',
                scopeType === id
                  ? 'border-for-500/60 bg-for-500/10'
                  : 'border-surface-300 bg-surface-200/40 hover:border-surface-400',
              )}
            >
              <Icon className={cn('h-4 w-4', scopeType === id ? color : 'text-surface-500')} />
              <span className={cn('text-xs font-semibold', scopeType === id ? 'text-white' : 'text-surface-400')}>
                {label}
              </span>
              <span className="text-[10px] text-surface-600">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category picker when scope = category */}
      <AnimatePresence>
        {scopeType === 'category' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="text-[11px] text-surface-500 mb-2 uppercase tracking-wider font-medium">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                    selectedCategory === cat
                      ? 'bg-emerald/20 border-emerald/50 text-emerald'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topic scope notice */}
      <AnimatePresence>
        {scopeType === 'topic' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 rounded-xl bg-purple/10 border border-purple/30">
              <Tag className="h-3.5 w-3.5 text-purple flex-shrink-0" />
              <p className="text-[11px] text-purple">
                Topic-scoped delegations can also be set from any individual topic page.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div>
        <p className="text-[11px] text-surface-500 mb-2 uppercase tracking-wider font-medium">Choose Delegate</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name…"
            className={cn(
              'w-full pl-8 pr-3 py-2.5 rounded-xl text-sm',
              'bg-surface-200 border border-surface-300',
              'text-white placeholder-surface-500',
              'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30',
              'transition-all',
            )}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
          )}
        </div>
      </div>

      {/* Candidates */}
      <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin scrollbar-track-surface-200 scrollbar-thumb-surface-400">
        {candidates.length === 0 && !searching ? (
          <p className="text-center text-xs text-surface-500 py-4">
            No citizens found. Try a different search.
          </p>
        ) : (
          candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              scope={scope}
              onDelegate={onAdded}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'given' | 'received' | 'add'

export function DelegateClient() {
  const [data, setData] = useState<DelegationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('given')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/delegation')
      if (res.status === 401) {
        setError('Sign in to manage your vote delegations.')
        return
      }
      if (!res.ok) throw new Error('Failed to load delegations')
      const json = await res.json() as DelegationResponse
      setData(json)
    } catch {
      setError('Could not load delegations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleRevoke(id: string) {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, given: prev.given.filter((g) => g.id !== id) }
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-bold text-white">Vote Delegation</h1>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed">
            Liquid democracy for the Lobby. Trust someone&apos;s judgment? Delegate your vote
            to them for specific topics, categories, or globally. Your own explicit vote
            always takes precedence.
          </p>
        </div>

        {/* How it works */}
        <div className="rounded-2xl bg-for-500/8 border border-for-500/20 p-4">
          <p className="text-[11px] text-surface-500 uppercase tracking-wider font-medium mb-3">How it works</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: UserCheck, color: 'text-for-400', title: 'Choose a delegate', desc: 'Pick someone whose civic judgment you trust' },
              { icon: Shield, color: 'text-emerald', title: 'Set the scope', desc: 'Global, category, or a single topic' },
              { icon: Zap, color: 'text-gold', title: 'Stay in control', desc: 'Your direct vote always overrides the delegation' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="text-center">
                <div className="flex justify-center mb-1.5">
                  <div className={cn('p-2 rounded-xl bg-surface-200/60', `bg-${color.replace('text-', '')}/10`)}>
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                </div>
                <p className="text-xs font-semibold text-white mb-0.5">{title}</p>
                <p className="text-[10px] text-surface-500 leading-tight">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {data && !loading && (
          <div className="flex gap-3">
            <StatPill
              value={data.given.length}
              label="Delegations given"
              icon={ArrowRight}
              color="text-for-400"
            />
            <StatPill
              value={data.received.length}
              label="Trusted by"
              icon={Crown}
              color="text-gold"
            />
            <StatPill
              value={data.given.filter((g) => !g.category && !g.topic_id).length}
              label="Global"
              icon={Globe}
              color="text-purple"
            />
          </div>
        )}
        {loading && (
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="flex-1 h-24 rounded-2xl" />)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-5 text-center">
            <p className="text-sm text-against-300 mb-3">{error}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-for-400 hover:text-for-300"
            >
              Sign in <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Tabs */}
        {data && !error && (
          <>
            <div className="flex bg-surface-100 border border-surface-300 rounded-xl p-1 gap-1">
              {(
                [
                  { id: 'given', label: `Given (${data.given.length})`, icon: ArrowRight },
                  { id: 'received', label: `Received (${data.received.length})`, icon: UserCheck },
                  { id: 'add', label: 'Add', icon: Plus },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                    tab === id
                      ? 'bg-for-500/20 text-for-300 border border-for-500/40'
                      : 'text-surface-400 hover:text-white hover:bg-surface-200/60',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'given' && (
                <motion.div
                  key="given"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {data.given.length === 0 ? (
                    <EmptyState
                      icon={ArrowRight}
                      title="No active delegations"
                      description="You haven't delegated your vote to anyone yet. Switch to the Add tab to find someone you trust."
                    />
                  ) : (
                    <AnimatePresence>
                      {data.given.map((entry) => (
                        <DelegationCard key={entry.id} entry={entry} onRevoke={handleRevoke} />
                      ))}
                    </AnimatePresence>
                  )}
                </motion.div>
              )}

              {tab === 'received' && (
                <motion.div
                  key="received"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {data.received.length === 0 ? (
                    <EmptyState
                      icon={Crown}
                      title="No delegations received yet"
                      description="When other citizens trust you with their vote, they'll appear here. Build your reputation with consistent, quality votes."
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30">
                        <Crown className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                        <p className="text-[11px] text-gold">
                          {data.received.length} citizen{data.received.length !== 1 ? 's' : ''} trust
                          your civic judgment. Vote wisely — your votes represent them too.
                        </p>
                      </div>
                      {data.received.map((entry) => (
                        <ReceivedCard key={entry.id} entry={entry} />
                      ))}
                    </>
                  )}
                </motion.div>
              )}

              {tab === 'add' && (
                <motion.div
                  key="add"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <AddDelegationPanel
                    onAdded={() => {
                      setTab('given')
                      load()
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Refresh */}
        {data && (
          <div className="flex justify-center">
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        )}

        {/* Delegate leaderboard link */}
        <Link
          href="/leaderboard/delegates"
          className="flex items-center justify-between w-full p-4 rounded-xl bg-emerald/5 border border-emerald/20 hover:border-emerald/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/20 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-emerald" />
            </div>
            <div>
              <p className="text-sm font-mono font-semibold text-white group-hover:text-emerald transition-colors">
                Top Trusted Delegates
              </p>
              <p className="text-[11px] font-mono text-surface-600">
                See who the community trusts most
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-emerald transition-colors" />
        </Link>

        {/* Delegation Impact link */}
        <Link
          href="/delegate/impact"
          className="flex items-center justify-between w-full p-4 rounded-xl bg-gold/5 border border-gold/20 hover:border-gold/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
              <BarChart2 className="h-4 w-4 text-gold" />
            </div>
            <div>
              <p className="text-sm font-mono font-semibold text-white group-hover:text-gold transition-colors">
                Delegation Impact
              </p>
              <p className="text-[11px] font-mono text-surface-600">
                Platform trust network analytics
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-gold transition-colors" />
        </Link>

        {/* Network Graph link */}
        <Link
          href="/delegate/network"
          className="flex items-center justify-between w-full p-4 rounded-xl bg-for-500/5 border border-for-500/20 hover:border-for-500/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center flex-shrink-0">
              <Zap className="h-4 w-4 text-for-400" />
            </div>
            <div>
              <p className="text-sm font-mono font-semibold text-white group-hover:text-for-400 transition-colors">
                Trust Network Graph
              </p>
              <p className="text-[11px] font-mono text-surface-600">
                Visualise how voting power flows
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 transition-colors" />
        </Link>

        {/* Explainer footer */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <p className="text-xs font-semibold text-white">About Liquid Democracy</p>
          <p className="text-[11px] text-surface-400 leading-relaxed">
            Liquid Democracy combines direct voting (you vote yourself) with proxy voting (you
            delegate to a trusted representative). Unlike rigid representative democracy, you
            can revoke your delegation at any time, override it with a direct vote on any topic,
            or delegate to different people for different topics.
          </p>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Your vote wins', icon: ThumbsUp, color: 'text-for-400' },
              { label: 'Revoke anytime', icon: X, color: 'text-against-400' },
              { label: 'Delegate chain', icon: Users, color: 'text-purple' },
              { label: 'Stay anonymous', icon: Shield, color: 'text-gold' },
            ].map(({ label, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-surface-500">
                <Icon className={cn('h-3 w-3', color)} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
