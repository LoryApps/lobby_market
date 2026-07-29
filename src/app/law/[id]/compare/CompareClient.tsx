'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  FileText,
  Gavel,
  GitCompare,
  Loader2,
  Network,
  RefreshCw,
  Scale,
  Search,
  ThumbsUp,
  TrendingUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawCompareResponse, CompareLaw } from '@/app/api/laws/[id]/compare/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtNum(n: number | null): string {
  if (n === null || n === undefined) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function consensusLabel(pct: number | null): string {
  if (pct === null) return '—'
  if (pct >= 75) return 'Strong consensus'
  if (pct >= 60) return 'Solid majority'
  if (pct >= 55) return 'Narrow majority'
  return 'Divided'
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-against-400',
  Health:      'text-emerald',
  Education:   'text-gold',
  Environment: 'text-emerald',
}

// ─── Law search input ─────────────────────────────────────────────────────────

interface LawSearchResult {
  id: string
  statement: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string | null
}

interface LawSearchInputProps {
  label: string
  onSelect: (law: LawSearchResult) => void
  excludeId?: string
  accentClass: string
}

function LawSearchInput({ label, onSelect, excludeId, accentClass }: LawSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LawSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/laws/search?q=${encodeURIComponent(q)}&limit=6`)
        if (res.ok) {
          const data = (await res.json()) as { results: LawSearchResult[] }
          setResults((data.results ?? []).filter((l) => l.id !== excludeId))
          setOpen(true)
        }
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [query, excludeId])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <p className={cn('text-xs font-mono font-bold uppercase tracking-widest mb-2', accentClass)}>
        {label}
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search laws…"
          className={cn(
            'w-full pl-9 pr-9 py-2.5 rounded-xl text-sm',
            'bg-surface-200 border border-surface-300 text-white placeholder-surface-500',
            'focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50',
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-20 top-full mt-1.5 w-full rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden"
          >
            {results.map((law) => (
              <button
                key={law.id}
                onClick={() => {
                  onSelect(law)
                  setQuery('')
                  setOpen(false)
                }}
                className="w-full px-3 py-2.5 text-left hover:bg-surface-300/60 transition-colors"
              >
                <p className="text-xs text-white line-clamp-2 leading-snug">{law.statement}</p>
                <div className="flex items-center gap-2 mt-1">
                  {law.category && (
                    <span className={cn('text-[10px] font-mono', CATEGORY_COLORS[law.category] ?? 'text-surface-500')}>
                      {law.category}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-gold">
                    {law.blue_pct !== null ? `${Math.round(law.blue_pct)}% FOR` : ''}
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
        {open && !loading && results.length === 0 && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 top-full mt-1.5 w-full rounded-xl bg-surface-200 border border-surface-300 shadow-xl px-3 py-4 text-center"
          >
            <p className="text-xs text-surface-500">No laws found</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  a,
  b,
  winner,
  icon: Icon,
}: {
  label: string
  a: string
  b: string
  winner?: 'a' | 'b' | 'tie'
  icon?: typeof BarChart2
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className={cn(
        'text-right text-sm font-mono',
        winner === 'a' ? 'text-emerald font-bold' : 'text-white',
      )}>
        {a}
        {winner === 'a' && <span className="ml-1 text-emerald">▲</span>}
      </div>
      <div className="text-center">
        <div className="flex flex-col items-center gap-0.5">
          {Icon && <Icon className="h-3 w-3 text-surface-500" />}
          <span className="text-[10px] font-mono text-surface-500 whitespace-nowrap">{label}</span>
        </div>
      </div>
      <div className={cn(
        'text-sm font-mono',
        winner === 'b' ? 'text-emerald font-bold' : 'text-white',
      )}>
        {b}
        {winner === 'b' && <span className="ml-1 text-emerald">▲</span>}
      </div>
    </div>
  )
}

// ─── Law card panel ───────────────────────────────────────────────────────────

function LawPanel({
  law,
  side,
}: {
  law: CompareLaw
  side: 'a' | 'b'
}) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const catColor = law.category ? (CATEGORY_COLORS[law.category] ?? 'text-surface-400') : 'text-surface-400'

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 h-full',
      side === 'a'
        ? 'bg-for-500/5 border-for-500/20'
        : 'bg-against-500/5 border-against-500/20',
    )}>
      {/* Status + category */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-[10px] font-mono font-bold uppercase tracking-wider">
          <Gavel className="h-2.5 w-2.5" />
          LAW
        </span>
        {law.category && (
          <span className={cn('text-[10px] font-mono font-semibold', catColor)}>
            {law.category}
          </span>
        )}
        {!law.is_active && (
          <span className="text-[10px] font-mono text-surface-500">Inactive</span>
        )}
      </div>

      {/* Statement */}
      <Link
        href={`/law/${law.id}`}
        className="block text-sm font-semibold text-white leading-snug hover:text-gold transition-colors"
      >
        {law.statement}
      </Link>

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-for-400">{forPct}% FOR</span>
          <span className="text-against-400">{againstPct}% AGAINST</span>
        </div>
      </div>

      {/* Meta stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-300/30 px-3 py-2">
          <p className="text-[10px] text-surface-500">Votes</p>
          <p className="text-sm font-mono font-bold text-white">{fmtNum(law.total_votes)}</p>
        </div>
        <div className="rounded-lg bg-surface-300/30 px-3 py-2">
          <p className="text-[10px] text-surface-500">Amendments</p>
          <p className="text-sm font-mono font-bold text-white">{law.amendment_count}</p>
        </div>
      </div>

      {/* Established */}
      <div className="flex items-center gap-1.5 text-[11px] text-surface-500">
        <Calendar className="h-3 w-3" />
        <span>Established {fmtDate(law.established_at)}</span>
      </div>

      {/* Wiki preview */}
      {law.wiki_content && (
        <div className="rounded-lg bg-surface-300/20 border border-surface-300/40 p-3">
          <p className="text-[10px] text-surface-500 mb-1 flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Wiki excerpt
          </p>
          <p className="text-xs text-surface-400 line-clamp-3 leading-relaxed">
            {law.wiki_content}
          </p>
        </div>
      )}

      {/* Links */}
      <div className="flex items-center gap-2">
        <Link
          href={`/law/${law.id}`}
          className="text-xs text-gold/80 hover:text-gold flex items-center gap-1"
        >
          Full law <ChevronRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/law/${law.id}/wiki`}
          className="text-xs text-purple/80 hover:text-purple flex items-center gap-1"
        >
          Wiki <BookOpen className="h-3 w-3" />
        </Link>
        <Link
          href={`/law/${law.id}/amendments`}
          className="text-xs text-for-400/80 hover:text-for-400 flex items-center gap-1"
        >
          Amend <FileText className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CompareClient({ primaryId }: { primaryId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<LawCompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withId, setWithId] = useState<string | null>(searchParams.get('with'))

  const loadComparison = useCallback(async (secondId: string) => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`/api/laws/${primaryId}/compare?with=${secondId}`)
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Failed to load comparison')
        return
      }
      const json = (await res.json()) as LawCompareResponse
      setData(json)
    } catch {
      setError('Failed to load comparison')
    } finally {
      setLoading(false)
    }
  }, [primaryId])

  useEffect(() => {
    if (withId) {
      void loadComparison(withId)
    }
  }, [withId, loadComparison])

  function handleSelectSecondary(law: { id: string }) {
    setWithId(law.id)
    const url = new URL(window.location.href)
    url.searchParams.set('with', law.id)
    router.replace(url.pathname + url.search, { scroll: false })
  }

  // Helper: which law wins on a numeric stat?
  function winner(a: number | null, b: number | null, higherBetter = true): 'a' | 'b' | 'tie' {
    if (a === null || b === null) return 'tie'
    if (a === b) return 'tie'
    return higherBetter
      ? a > b ? 'a' : 'b'
      : a < b ? 'a' : 'b'
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/law/${primaryId}`}
            className="h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center text-surface-400 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-gold" />
              Law Comparison
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Compare this law side-by-side with another
            </p>
          </div>
        </div>

        {/* Search bar for secondary law */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <LawSearchInput
            label="Pick a law to compare"
            onSelect={handleSelectSecondary}
            excludeId={primaryId}
            accentClass="text-gold"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-12 rounded-lg" />
                  <Skeleton className="h-12 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-4 text-center mb-6">
            <p className="text-sm text-against-400">{error}</p>
            <button
              onClick={() => withId && loadComparison(withId)}
              className="mt-2 text-xs text-surface-500 hover:text-white flex items-center gap-1 mx-auto"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Comparison panels */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Relation badges */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {data.same_category && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald/10 border border-emerald/30 text-emerald text-xs font-mono">
                  <Check className="h-3 w-3" />
                  Same category: {data.primary.category}
                </span>
              )}
              {data.linked && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple/10 border border-purple/30 text-purple text-xs font-mono">
                  <Network className="h-3 w-3" />
                  Linked laws
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono">
                <Scale className="h-3 w-3" />
                {Math.round(data.vote_delta)}% consensus gap
              </span>
            </div>

            {/* Side-by-side panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LawPanel law={data.primary} side="a" />
              <LawPanel law={data.secondary} side="b" />
            </div>

            {/* Head-to-head stats */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h2 className="text-xs font-mono font-bold text-surface-400 uppercase tracking-widest mb-4 text-center">
                Head to Head
              </h2>
              <div className="space-y-3">
                <StatRow
                  label="FOR %"
                  a={`${Math.round(data.primary.blue_pct ?? 50)}%`}
                  b={`${Math.round(data.secondary.blue_pct ?? 50)}%`}
                  winner={winner(data.primary.blue_pct, data.secondary.blue_pct)}
                  icon={ThumbsUp}
                />
                <StatRow
                  label="Total votes"
                  a={fmtNum(data.primary.total_votes)}
                  b={fmtNum(data.secondary.total_votes)}
                  winner={winner(data.primary.total_votes, data.secondary.total_votes)}
                  icon={BarChart2}
                />
                <StatRow
                  label="Amendments"
                  a={String(data.primary.amendment_count)}
                  b={String(data.secondary.amendment_count)}
                  winner={winner(data.primary.amendment_count, data.secondary.amendment_count)}
                  icon={FileText}
                />
                <StatRow
                  label="Consensus"
                  a={consensusLabel(data.primary.blue_pct)}
                  b={consensusLabel(data.secondary.blue_pct)}
                  icon={TrendingUp}
                />
                <StatRow
                  label="Wiki"
                  a={data.primary.wiki_content ? 'Has wiki' : 'No wiki'}
                  b={data.secondary.wiki_content ? 'Has wiki' : 'No wiki'}
                  icon={BookOpen}
                />
              </div>
            </div>

            {/* Explore links */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 mb-2">Explore Law A</p>
                <div className="space-y-1.5">
                  {[
                    { href: `/law/${data.primary.id}`, label: 'Full text' },
                    { href: `/law/${data.primary.id}/wiki`, label: 'Wiki' },
                    { href: `/law/${data.primary.id}/amendments`, label: 'Amendments' },
                    { href: `/law/${data.primary.id}/impact`, label: 'Impact' },
                  ].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="flex items-center justify-between text-xs text-surface-400 hover:text-white transition-colors"
                    >
                      {l.label}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <p className="text-[10px] font-mono text-surface-500 mb-2">Explore Law B</p>
                <div className="space-y-1.5">
                  {[
                    { href: `/law/${data.secondary.id}`, label: 'Full text' },
                    { href: `/law/${data.secondary.id}/wiki`, label: 'Wiki' },
                    { href: `/law/${data.secondary.id}/amendments`, label: 'Amendments' },
                    { href: `/law/${data.secondary.id}/impact`, label: 'Impact' },
                  ].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="flex items-center justify-between text-xs text-surface-400 hover:text-white transition-colors"
                    >
                      {l.label}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state — no secondary selected */}
        {!data && !loading && !error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 border-dashed p-12 text-center">
            <GitCompare className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white mb-1">
              Select a law to compare
            </p>
            <p className="text-xs text-surface-500">
              Search above to pick a second law and see them side by side.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
