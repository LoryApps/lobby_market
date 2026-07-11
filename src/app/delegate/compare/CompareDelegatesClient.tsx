'use client'

/**
 * /delegate/compare — Delegate Head-to-Head Comparison
 *
 * Pick two citizens and compare them side-by-side: alignment with your votes,
 * category expertise, trust from others, and activity stats.  The verdict
 * section highlights who's the better delegate for your civic voice.
 *
 * Distinct from:
 *   /delegate/find   — ranked single-user recommendations
 *   /delegate        — manage active delegations
 *   /leaderboard/delegates — platform-wide trust rankings
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Check,
  GitCompare,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { ARCHETYPE_CONFIG } from '@/lib/config/archetypes'
import type { CompareCandidate, CompareResponse } from '@/app/api/delegation/compare/route'
import type { DelegateCandidate, DelegateSearchResponse } from '@/app/api/delegation/search/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debater',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/15',     border: 'border-for-500/40' },
  Economics:   { text: 'text-gold',        bg: 'bg-gold/15',        border: 'border-gold/40' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/15',      border: 'border-purple/40' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/15',     border: 'border-emerald/40' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/40' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/15',     border: 'border-for-400/40' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/15',        border: 'border-gold/40' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/15', border: 'border-against-400/40' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/15',     border: 'border-emerald/40' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/15',      border: 'border-purple/40' },
}

function getCatStyle(cat: string) {
  return CATEGORY_COLOR[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── Alignment bar ────────────────────────────────────────────────────────────

function AlignmentBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-emerald' :
    pct >= 65 ? 'bg-for-500' :
    pct >= 50 ? 'bg-gold' :
    'bg-against-500'

  const textColor =
    pct >= 80 ? 'text-emerald' :
    pct >= 65 ? 'text-for-400' :
    pct >= 50 ? 'text-gold' :
    'text-against-400'

  const label =
    pct >= 80 ? 'Highly aligned' :
    pct >= 65 ? 'Well aligned' :
    pct >= 50 ? 'Moderate' :
    'Divergent'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={cn('font-mono font-bold text-xl', textColor)}>{pct}%</span>
        <span className={cn('text-xs font-mono', textColor)}>{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-300">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, colorClass }: { label: string; value: string | number; colorClass?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-surface-200 bg-surface-100 p-3 text-center">
      <span className={cn('font-mono font-bold text-lg leading-tight', colorClass ?? 'text-white')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="mt-0.5 text-[10px] font-mono uppercase tracking-wide text-surface-500">{label}</span>
    </div>
  )
}

// ─── User search dropdown ─────────────────────────────────────────────────────

function UserSearchBox({
  slot,
  selected,
  onSelect,
  onClear,
  disabled,
}: {
  slot: 'A' | 'B'
  selected: CompareCandidate | null
  onSelect: (candidate: DelegateCandidate) => void
  onClear: () => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<DelegateCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim() && q !== '') {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/delegation/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('search failed')
      const data: DelegateSearchResponse = await res.json()
      setResults(data.candidates.slice(0, 8))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (v: string) => {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 300)
  }

  const handleFocus = () => {
    setOpen(true)
    if (!results.length) search('')
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-surface-200 bg-surface-100 px-4 py-3">
        <div className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          slot === 'A' ? 'bg-for-500/20 text-for-300' : 'bg-against-500/20 text-against-300',
        )}>
          {slot}
        </div>
        <Avatar
          src={selected.avatar_url}
          fallback={selected.display_name || selected.username}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-medium text-white">
            {selected.display_name || selected.username}
          </span>
          <span className="ml-1.5 text-xs text-surface-500">@{selected.username}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg p-1 text-surface-500 transition hover:bg-surface-200 hover:text-white"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-100 px-4 py-3">
        <div className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          slot === 'A' ? 'bg-for-500/20 text-for-300' : 'bg-against-500/20 text-against-300',
        )}>
          {slot}
        </div>
        <Search className="h-4 w-4 flex-shrink-0 text-surface-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={handleFocus}
          placeholder={`Search for delegate ${slot}…`}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-surface-500 focus:outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-surface-500" />}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-surface-200 bg-surface-100 shadow-xl"
          >
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-200"
              >
                <Avatar src={c.avatar_url} fallback={c.display_name || c.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {c.display_name || c.username}
                  </span>
                  <span className="text-xs text-surface-500">@{c.username}</span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5 text-right">
                  {c.alignment_pct !== null && (
                    <span className={cn(
                      'font-mono text-xs font-semibold',
                      c.alignment_pct >= 70 ? 'text-emerald' :
                      c.alignment_pct >= 55 ? 'text-for-400' : 'text-surface-400',
                    )}>
                      {c.alignment_pct}%
                    </span>
                  )}
                  <span className="text-[10px] text-gold font-mono">
                    {(c.clout as number).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  slot,
  isWinner,
}: {
  candidate: CompareCandidate
  slot: 'A' | 'B'
  isWinner: boolean
}) {
  const archetype = candidate.civic_archetype
    ? ARCHETYPE_CONFIG[candidate.civic_archetype as keyof typeof ARCHETYPE_CONFIG]
    : null

  const slotColor = slot === 'A' ? 'for' : 'against'
  const winnerRing = isWinner ? (slot === 'A' ? 'ring-2 ring-for-500/50' : 'ring-2 ring-against-500/50') : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative flex flex-col gap-4 rounded-2xl border border-surface-200 bg-surface-100 p-5',
        winnerRing,
      )}
    >
      {isWinner && (
        <div className={cn(
          'absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold',
          slot === 'A'
            ? 'border-for-500/40 bg-for-500/20 text-for-300'
            : 'border-against-500/40 bg-against-500/20 text-against-300',
        )}>
          <Trophy className="h-3 w-3" />
          Better aligned
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <Avatar
            src={candidate.avatar_url}
            fallback={candidate.display_name || candidate.username}
            size="lg"
          />
          {candidate.already_delegating && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-surface-100 bg-emerald">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${candidate.username}`}
            className="block truncate font-semibold text-white hover:text-for-300 transition-colors"
          >
            {candidate.display_name || candidate.username}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-surface-500">@{candidate.username}</span>
            <Badge variant={candidate.role as 'proposed'} className="text-[10px] py-0 px-1.5">
              {ROLE_LABELS[candidate.role] ?? candidate.role}
            </Badge>
          </div>
          {archetype && (
            <span className={cn('mt-1 block text-[11px] font-mono', archetype.color)}>
              {archetype.name}
            </span>
          )}
        </div>
      </div>

      {/* Alignment */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-mono text-surface-500">
          <Scale className="h-3.5 w-3.5" />
          Vote alignment with you
        </div>
        {candidate.topics_in_common >= 5 ? (
          <AlignmentBar pct={candidate.alignment_pct} />
        ) : (
          <p className="text-sm text-surface-500 italic">Not enough shared votes to compute</p>
        )}
        {candidate.topics_in_common > 0 && (
          <p className="mt-1 text-[11px] text-surface-600">
            {candidate.topics_in_common} topics in common
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Clout" value={candidate.clout} colorClass="text-gold" />
        <StatTile label="Votes" value={candidate.total_votes} colorClass="text-for-400" />
        <StatTile label="Trusted by" value={candidate.trusted_by} colorClass="text-purple" />
      </div>

      {/* Category breakdown */}
      {candidate.categories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <BarChart2 className="h-3.5 w-3.5" />
            Category alignment
          </div>
          {candidate.categories.map((cat) => {
            const style = getCatStyle(cat.category)
            return (
              <div key={cat.category} className="flex items-center gap-2">
                <span className={cn(
                  'min-w-[80px] rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold',
                  style.text, style.bg, style.border,
                )}>
                  {cat.category}
                </span>
                <div className="flex flex-1 items-center gap-1.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-300">
                    <motion.div
                      className={cn(
                        'h-full rounded-full',
                        cat.alignment_pct >= 70 ? 'bg-emerald' :
                        cat.alignment_pct >= 55 ? 'bg-for-500' :
                        cat.alignment_pct >= 40 ? 'bg-gold' : 'bg-against-500',
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.alignment_pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="w-9 text-right text-[11px] font-mono text-surface-400">
                    {cat.alignment_pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delegate CTA */}
      <div className="pt-1">
        {candidate.already_delegating ? (
          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald/30 bg-emerald/10 px-4 py-2.5 text-sm font-medium text-emerald">
            <Check className="h-4 w-4" />
            Delegating to this person
          </div>
        ) : (
          <Link
            href={`/delegate?delegate_id=${candidate.id}`}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              slotColor === 'for'
                ? 'bg-for-500 text-white hover:bg-for-600'
                : 'bg-against-500 text-white hover:bg-against-600',
            )}
          >
            <UserCheck className="h-4 w-4" />
            Delegate to {candidate.display_name || candidate.username}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Verdict banner ───────────────────────────────────────────────────────────

function VerdictBanner({
  verdict,
  a,
  b,
}: {
  verdict: 'a' | 'b' | 'tied'
  a: CompareCandidate
  b: CompareCandidate
}) {
  const winner = verdict === 'a' ? a : verdict === 'b' ? b : null

  if (verdict === 'tied') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 px-5 py-4"
      >
        <Scale className="h-5 w-5 flex-shrink-0 text-gold" />
        <div>
          <p className="font-semibold text-gold">Closely matched</p>
          <p className="text-sm text-surface-400">
            Both delegates are similarly aligned with your votes. Consider their activity, trust level, and category expertise to decide.
          </p>
        </div>
      </motion.div>
    )
  }

  if (!winner) return null

  const diff = Math.abs(a.alignment_pct - b.alignment_pct)
  const loser = verdict === 'a' ? b : a

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-emerald/30 bg-emerald/10 px-5 py-4"
    >
      <Trophy className="h-5 w-5 flex-shrink-0 text-emerald" />
      <div>
        <p className="font-semibold text-emerald">
          {winner.display_name || winner.username} is the better match
        </p>
        <p className="text-sm text-surface-400">
          {diff}% more aligned with your voting history than {loser.display_name || loser.username}.
          {winner.trusted_by > loser.trusted_by && ` Also trusted by ${winner.trusted_by - loser.trusted_by} more people.`}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Placeholder card ─────────────────────────────────────────────────────────

function PlaceholderCard({ slot }: { slot: 'A' | 'B' }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center',
      slot === 'A' ? 'border-for-500/30' : 'border-against-500/30',
    )}>
      <div className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full',
        slot === 'A' ? 'bg-for-500/10' : 'bg-against-500/10',
      )}>
        <span className={cn(
          'text-xl font-bold',
          slot === 'A' ? 'text-for-400' : 'text-against-400',
        )}>
          {slot}
        </span>
      </div>
      <p className="text-sm text-surface-500">
        {slot === 'A' ? 'Select first delegate above' : 'Select second delegate above'}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompareDelegatesClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedA, setSelectedA] = useState<DelegateCandidate | null>(null)
  const [selectedB, setSelectedB] = useState<DelegateCandidate | null>(null)
  const [result, setResult] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComparison = useCallback(async (aId: string, bId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delegation/compare?a=${aId}&b=${bId}`)
      if (!res.ok) throw new Error('Failed to load comparison')
      const data: CompareResponse = await res.json()
      setResult(data)
    } catch {
      setError('Could not load comparison data. Please try again.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedA && selectedB) {
      fetchComparison(selectedA.id, selectedB.id)
      router.replace(`/delegate/compare?a=${selectedA.id}&b=${selectedB.id}`, { scroll: false })
    } else {
      setResult(null)
    }
  }, [selectedA, selectedB, fetchComparison, router])

  // Pre-populate from URL params if available
  useEffect(() => {
    const aId = searchParams.get('a')
    const bId = searchParams.get('b')
    if (aId && bId) {
      // We don't pre-populate selections since we'd need to fetch profiles,
      // so just trigger the comparison directly
      setLoading(true)
      fetch(`/api/delegation/compare?a=${aId}&b=${bId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: CompareResponse | null) => {
          if (data?.a && data?.b) {
            // Convert to DelegateCandidate format for state
            const toCandidate = (c: CompareCandidate): DelegateCandidate => ({
              id: c.id,
              username: c.username,
              display_name: c.display_name,
              avatar_url: c.avatar_url,
              clout: c.clout,
              role: c.role,
              total_votes: c.total_votes,
              vote_streak: c.vote_streak,
              civic_archetype: c.civic_archetype,
              trusted_by: c.trusted_by,
              alignment_pct: c.alignment_pct,
              topics_in_common: c.topics_in_common,
            })
            setSelectedA(toCandidate(data.a))
            setSelectedB(toCandidate(data.b))
            setResult(data)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasResult = !!result?.a && !!result?.b

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="mx-auto max-w-4xl px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <Link
          href="/delegate"
          className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-surface-300 bg-surface-100 px-3 py-2 text-sm text-surface-400 transition hover:bg-surface-200 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Delegation Hub
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-300 bg-surface-100">
              <GitCompare className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Compare Delegates</h1>
              <p className="text-sm text-surface-500">
                Pick two citizens and see who votes more like you
              </p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-6 rounded-xl border border-surface-200 bg-surface-100/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-surface-500">
            <span className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-for-400" />
              Vote alignment — based on topics you&apos;ve both voted on
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-purple" />
              Trusted by — how many others delegate to this person
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Verdict — who&apos;s the stronger match for your voice
            </span>
          </div>
        </div>

        {/* Search boxes */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UserSearchBox
            slot="A"
            selected={result?.a ?? null}
            onSelect={(c) => setSelectedA(c)}
            onClear={() => {
              setSelectedA(null)
              setResult(null)
            }}
          />
          <UserSearchBox
            slot="B"
            selected={result?.b ?? null}
            onSelect={(c) => setSelectedB(c)}
            onClear={() => {
              setSelectedB(null)
              setResult(null)
            }}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12 text-surface-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Comparing delegates…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-against-500/30 bg-against-500/10 px-5 py-4 text-sm text-against-300">
            {error}
            <button
              onClick={() => selectedA && selectedB && fetchComparison(selectedA.id, selectedB.id)}
              className="ml-auto flex items-center gap-1 text-xs hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Verdict */}
        <AnimatePresence>
          {hasResult && result?.verdict && !loading && (
            <div className="mb-5">
              <VerdictBanner verdict={result.verdict} a={result.a!} b={result.b!} />
            </div>
          )}
        </AnimatePresence>

        {/* Side-by-side cards */}
        {!loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {hasResult ? (
              <>
                <CandidateCard
                  candidate={result!.a!}
                  slot="A"
                  isWinner={result?.verdict === 'a'}
                />
                <CandidateCard
                  candidate={result!.b!}
                  slot="B"
                  isWinner={result?.verdict === 'b'}
                />
              </>
            ) : !selectedA && !selectedB ? (
              <>
                <PlaceholderCard slot="A" />
                <PlaceholderCard slot="B" />
              </>
            ) : null}
          </div>
        )}

        {/* Empty state — both not selected */}
        {!loading && !hasResult && !selectedA && !selectedB && (
          <div className="mt-4 text-center text-sm text-surface-600">
            Use the search boxes above to find two citizens to compare.{' '}
            <Link href="/delegate/find" className="text-for-400 hover:text-for-300 transition-colors">
              Not sure who to pick? Find top delegates →
            </Link>
          </div>
        )}

        {/* Footnote — my vote count */}
        {result?.my_vote_count !== undefined && result.my_vote_count < 10 && (
          <p className="mt-4 text-center text-xs text-surface-600">
            You have only {result.my_vote_count} votes cast — vote on more topics to get accurate alignment scores.
          </p>
        )}

        {/* Navigation footer */}
        <div className="mt-10 grid grid-cols-2 gap-3 border-t border-surface-200 pt-6 sm:grid-cols-4">
          {[
            { href: '/delegate/find', icon: Sparkles, label: 'Find Delegates' },
            { href: '/delegate', icon: UserCheck, label: 'My Delegations' },
            { href: '/leaderboard/delegates', icon: Trophy, label: 'Leaderboard' },
            { href: '/delegate/network', icon: Users, label: 'Trust Network' },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-surface-200 bg-surface-100 px-3 py-3 text-center text-xs text-surface-400 transition hover:bg-surface-200 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
