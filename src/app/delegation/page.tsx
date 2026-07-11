'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Globe,
  Info,
  Layers,
  Loader2,
  Search,
  Shield,
  Tag,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DelegationResponse, DelegationEntry, ReceivedDelegation } from '@/app/api/delegation/route'
import type { DelegateCandidate, DelegateSearchResponse } from '@/app/api/delegation/search/route'

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health',
  'Environment', 'Education',
] as const

type Category = typeof CATEGORIES[number]

type ScopeType = 'global' | 'category'

const ROLE_COLORS: Record<string, string> = {
  person: 'text-surface-400',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  elder: 'text-gold',
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Scope badge ──────────────────────────────────────────────────────────────

function ScopeBadge({ category, topicStatement }: { category: string | null; topicStatement: string | null }) {
  if (topicStatement) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-purple bg-purple/10 border border-purple/20 rounded-md px-1.5 py-0.5">
        <Tag className="h-2.5 w-2.5" />
        {topicStatement.length > 40 ? topicStatement.slice(0, 40) + '…' : topicStatement}
      </span>
    )
  }
  if (category) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-for-400 bg-for-500/10 border border-for-500/20 rounded-md px-1.5 py-0.5">
        <Layers className="h-2.5 w-2.5" />
        {category}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gold bg-gold/10 border border-gold/20 rounded-md px-1.5 py-0.5">
      <Globe className="h-2.5 w-2.5" />
      Global
    </span>
  )
}

// ─── Given delegation card ────────────────────────────────────────────────────

function GivenDelegationCard({
  delegation,
  onRevoke,
}: {
  delegation: DelegationEntry
  onRevoke: (id: string) => void
}) {
  const [revoking, setRevoking] = useState(false)

  async function handleRevoke() {
    setRevoking(true)
    try {
      await fetch(`/api/delegation?id=${delegation.id}`, { method: 'DELETE' })
      onRevoke(delegation.id)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors"
    >
      <Link href={`/profile/${delegation.delegate_username}`} className="flex-shrink-0">
        <Avatar
          src={delegation.delegate_avatar_url}
          fallback={delegation.delegate_display_name ?? delegation.delegate_username}
          size="sm"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${delegation.delegate_username}`}
            className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors truncate"
          >
            {delegation.delegate_display_name ?? `@${delegation.delegate_username}`}
          </Link>
          <span className={cn('text-[10px] font-mono', ROLE_COLORS[delegation.delegate_role] ?? 'text-surface-400')}>
            {ROLE_LABELS[delegation.delegate_role] ?? delegation.delegate_role}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <ScopeBadge category={delegation.category} topicStatement={delegation.topic_statement} />
          <span className="text-[10px] text-surface-600 font-mono">
            {delegation.delegate_clout.toLocaleString()} clout
          </span>
        </div>
      </div>

      <button
        onClick={handleRevoke}
        disabled={revoking}
        aria-label="Revoke delegation"
        className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-against-500/10 border border-against-500/20 text-against-400 hover:bg-against-500/20 transition-colors disabled:opacity-50"
      >
        {revoking ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
      </button>
    </motion.div>
  )
}

// ─── Received delegation card ─────────────────────────────────────────────────

function ReceivedDelegationCard({ delegation }: { delegation: ReceivedDelegation }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200">
      <Link href={`/profile/${delegation.delegator_username}`} className="flex-shrink-0">
        <Avatar
          src={delegation.delegator_avatar_url}
          fallback={delegation.delegator_display_name ?? delegation.delegator_username}
          size="sm"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${delegation.delegator_username}`}
          className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors block truncate"
        >
          {delegation.delegator_display_name ?? `@${delegation.delegator_username}`}
        </Link>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <ScopeBadge category={delegation.category} topicStatement={delegation.topic_statement} />
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
    </div>
  )
}

// ─── Candidate card ────────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  existingDelegateIds,
  onDelegate,
}: {
  candidate: DelegateCandidate
  existingDelegateIds: Set<string>
  onDelegate: (candidate: DelegateCandidate) => Promise<void>
}) {
  const [delegating, setDelegating] = useState(false)
  const alreadyDelegated = existingDelegateIds.has(candidate.id)

  async function handle() {
    if (alreadyDelegated) return
    setDelegating(true)
    try {
      await onDelegate(candidate)
    } finally {
      setDelegating(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200">
      <Link href={`/profile/${candidate.username}`} className="flex-shrink-0">
        <Avatar
          src={candidate.avatar_url}
          fallback={candidate.display_name ?? candidate.username}
          size="sm"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${candidate.username}`}
            className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors truncate"
          >
            {candidate.display_name ?? `@${candidate.username}`}
          </Link>
          <span className={cn('text-[10px] font-mono', ROLE_COLORS[candidate.role] ?? 'text-surface-400')}>
            {ROLE_LABELS[candidate.role] ?? candidate.role}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[10px] font-mono text-surface-600">
          <span>{candidate.clout.toLocaleString()} clout</span>
          <span>·</span>
          <span>{candidate.total_votes} votes</span>
          {candidate.trusted_by > 0 && (
            <>
              <span>·</span>
              <span className="text-emerald">{candidate.trusted_by} trust</span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={handle}
        disabled={delegating || alreadyDelegated}
        className={cn(
          'flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all',
          alreadyDelegated
            ? 'bg-emerald/10 border border-emerald/20 text-emerald cursor-default'
            : 'bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/30 disabled:opacity-50',
        )}
      >
        {delegating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : alreadyDelegated ? (
          'Delegated'
        ) : (
          'Delegate'
        )}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DelegationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DelegationResponse | null>(null)

  // Search state
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState<DelegateCandidate[]>([])
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Scope state
  const [scopeType, setScopeType] = useState<ScopeType>('global')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [scopeOpen, setScopeOpen] = useState(false)

  // Info banner
  const [infoOpen, setInfoOpen] = useState(false)

  // Auth check
  useEffect(() => {
    createClient().then((supabase) =>
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) router.replace('/login')
      })
    )
  }, [router])

  // Load delegations
  useEffect(() => {
    fetch('/api/delegation')
      .then((r) => r.json())
      .then((json: DelegationResponse) => {
        setData(json)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) {
      setCandidates([])
      return
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/delegation/search?q=${encodeURIComponent(query)}`)
        const json: DelegateSearchResponse = await res.json()
        setCandidates(json.candidates ?? [])
      } catch {
        setCandidates([])
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [query])

  // Show top candidates when search is empty (on focus)
  const [showDefault, setShowDefault] = useState(false)
  const [defaultCandidates, setDefaultCandidates] = useState<DelegateCandidate[]>([])

  useEffect(() => {
    if (!showDefault || defaultCandidates.length > 0) return
    fetch('/api/delegation/search?q=')
      .then((r) => r.json())
      .then((json: DelegateSearchResponse) => setDefaultCandidates(json.candidates ?? []))
      .catch(() => {})
  }, [showDefault, defaultCandidates.length])

  const existingDelegateIds = new Set((data?.given ?? []).map((d) => d.delegate_id))

  const displayCandidates = query.trim() ? candidates : showDefault ? defaultCandidates : []

  async function handleDelegate(candidate: DelegateCandidate) {
    const body: Record<string, string | null> = {
      delegate_id: candidate.id,
      topic_id: null,
      category: scopeType === 'category' ? (selectedCategory ?? null) : null,
    }

    const res = await fetch('/api/delegation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) return

    // Refresh delegation list
    const fresh = await fetch('/api/delegation').then((r) => r.json())
    setData(fresh)
    // Dismiss search
    setQuery('')
    setCandidates([])
    setShowDefault(false)
  }

  function handleRevoke(id: string) {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        given: prev.given.filter((d) => d.id !== id),
        received: prev.received,
        trustedByCount: prev.trustedByCount,
      }
    })
  }

  const scopeLabel =
    scopeType === 'category' && selectedCategory
      ? `Category: ${selectedCategory}`
      : scopeType === 'category'
      ? 'Pick a category…'
      : 'Global'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-mono font-bold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-gold" />
              Vote Delegation
            </h1>
            <p className="text-xs text-surface-500 font-mono">Liquid Democracy</p>
          </div>
          <button
            onClick={() => setInfoOpen((v) => !v)}
            aria-label="How it works"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
          >
            <Info className="h-4 w-4 text-surface-400" />
          </button>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {infoOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-2xl bg-gold/5 border border-gold/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gold flex-shrink-0" />
                  <p className="text-xs font-mono font-semibold text-gold">How Delegation Works</p>
                </div>
                <ul className="space-y-1.5 text-[11px] font-mono text-surface-500 leading-relaxed">
                  <li>• Delegate your vote to someone you trust on <span className="text-white">specific topics</span>, an entire <span className="text-for-400">category</span>, or <span className="text-gold">globally</span>.</li>
                  <li>• When you haven&apos;t voted on a topic, your delegate&apos;s position is shown with a &ldquo;Mirror vote?&rdquo; prompt.</li>
                  <li>• Your own explicit vote <span className="text-emerald">always takes precedence</span> — you&apos;re never locked in.</li>
                  <li>• Delegations are advisory; you retain full voting autonomy at all times.</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add delegation */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
            <User className="h-3 w-3" />
            Delegate Your Vote
          </h2>

          {/* Scope selector */}
          <div className="relative">
            <button
              onClick={() => setScopeOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors text-sm font-mono"
            >
              <div className="flex items-center gap-2">
                {scopeType === 'global' ? (
                  <Globe className="h-3.5 w-3.5 text-gold" />
                ) : (
                  <Layers className="h-3.5 w-3.5 text-for-400" />
                )}
                <span className={cn('text-sm font-mono', scopeType === 'global' ? 'text-white' : selectedCategory ? 'text-white' : 'text-surface-500')}>
                  {scopeLabel}
                </span>
              </div>
              <ChevronDown className={cn('h-3.5 w-3.5 text-surface-500 transition-transform', scopeOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {scopeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  className="absolute top-full left-0 right-0 mt-1 z-20 bg-surface-100 border border-surface-200 rounded-xl shadow-xl overflow-hidden"
                >
                  {/* Global option */}
                  <button
                    onClick={() => { setScopeType('global'); setSelectedCategory(null); setScopeOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2.5 text-sm font-mono hover:bg-surface-200 transition-colors text-left',
                      scopeType === 'global' ? 'text-gold bg-gold/5' : 'text-white'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                    Global — all topics
                  </button>

                  {/* Divider */}
                  <div className="h-px bg-surface-200" />

                  {/* Category options */}
                  <div className="py-1">
                    <p className="px-3 py-1 text-[10px] font-mono text-surface-600 uppercase tracking-widest">By Category</p>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setScopeType('category'); setSelectedCategory(cat); setScopeOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-sm font-mono hover:bg-surface-200 transition-colors text-left',
                          scopeType === 'category' && selectedCategory === cat ? 'text-for-400 bg-for-500/5' : 'text-white'
                        )}
                      >
                        <Layers className="h-3.5 w-3.5 flex-shrink-0 text-surface-500" />
                        {cat}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User search */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search citizens to delegate to…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowDefault(true)}
                className="w-full pl-9 pr-9 py-2.5 bg-surface-100 border border-surface-200 focus:border-for-500/40 rounded-xl text-sm font-mono text-white placeholder:text-surface-600 outline-none transition-colors"
              />
              {(query || showDefault) && (
                <button
                  onClick={() => { setQuery(''); setCandidates([]); setShowDefault(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-600 hover:text-surface-400 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Candidate results */}
            {(showDefault || query.trim()) && (
              <div className="mt-2 space-y-2">
                {searching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-surface-500" />
                  </div>
                ) : displayCandidates.length === 0 ? (
                  query.trim() ? (
                    <p className="text-center text-xs font-mono text-surface-600 py-4">No citizens found for &ldquo;{query}&rdquo;</p>
                  ) : null
                ) : (
                  displayCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      existingDelegateIds={existingDelegateIds}
                      onDelegate={handleDelegate}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        {/* My delegations */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
            <Shield className="h-3 w-3" />
            My Delegations
            {data && data.given.length > 0 && (
              <span className="ml-auto text-[10px] text-surface-600 normal-case tracking-normal">
                {data.given.length} active
              </span>
            )}
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : data?.given.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 rounded-xl bg-surface-100 border border-surface-200 border-dashed">
              <Shield className="h-6 w-6 text-surface-600" />
              <p className="text-xs font-mono text-surface-600 text-center max-w-xs">
                You haven&apos;t delegated your vote yet. Find a trusted citizen above.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {(data?.given ?? []).map((delegation) => (
                <GivenDelegationCard
                  key={delegation.id}
                  delegation={delegation}
                  onRevoke={handleRevoke}
                />
              ))}
            </AnimatePresence>
          )}
        </section>

        {/* Trusted by */}
        {(loading || (data && data.received.length > 0)) && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
              <Users className="h-3 w-3" />
              Trusts Me
              {data && data.trustedByCount > 0 && (
                <span className="ml-auto text-[10px] text-emerald normal-case tracking-normal">
                  {data.trustedByCount} citizens
                </span>
              )}
            </h2>

            {loading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <div className="space-y-2">
                {(data?.received ?? []).map((delegation) => (
                  <ReceivedDelegationCard key={delegation.id} delegation={delegation} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Footer note */}
        {!loading && (
          <p className="text-center text-[10px] font-mono text-surface-700 pb-2">
            Your vote always takes precedence over any delegation.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
