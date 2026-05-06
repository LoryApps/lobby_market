'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  GitCompare,
  Loader2,
  RotateCcw,
  Scale,
  Search,
  Share2,
  Shield,
  Trophy,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LawResult {
  id: string
  statement: string
  full_statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  is_active: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const mo = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (y >= 1) return `${y}y ago`
  if (mo >= 1) return `${mo}mo ago`
  return `${d}d ago`
}

function mandateLabel(pct: number): { label: string; color: string } {
  const win = pct >= 50 ? pct : 100 - pct
  const side = pct >= 50 ? 'FOR' : 'AGAINST'
  if (win >= 75) return { label: `${side} ${Math.round(win)}% — Supermajority`, color: 'text-emerald' }
  if (win >= 60) return { label: `${side} ${Math.round(win)}% — Strong`, color: 'text-for-400' }
  return { label: `${side} ${Math.round(win)}% — Narrow`, color: 'text-surface-400' }
}

// ─── Law Search Picker ────────────────────────────────────────────────────────

interface LawPickerProps {
  label: string
  value: LawResult | null
  onSelect: (law: LawResult) => void
  onClear: () => void
  excluded?: string
}

function LawPicker({ label, value, onSelect, onClear, excluded }: LawPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LawResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) { setResults([]); return }
      setLoading(true)
      try {
        const res = await fetch(`/api/laws/search?q=${encodeURIComponent(q)}&limit=8`)
        const json = await res.json() as { results: LawResult[] }
        setResults((json.results ?? []).filter((r) => r.id !== excluded))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [excluded]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  if (value) {
    return (
      <div className="relative flex flex-col gap-1.5">
        <p className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">{label}</p>
        <div className="flex items-start gap-2 bg-surface-100 border border-emerald/40 rounded-xl p-3">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2">{value.statement}</p>
            {value.category && (
              <p className="text-[11px] font-mono text-surface-400 mt-0.5">{value.category}</p>
            )}
          </div>
          <button
            onClick={onClear}
            aria-label="Remove selected law"
            className="flex-shrink-0 p-1 text-surface-400 hover:text-white transition-colors rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <p className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">{label}</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search established laws…"
          className={cn(
            'w-full pl-9 pr-4 py-2.5 bg-surface-100 border border-surface-300 rounded-xl',
            'font-mono text-sm text-white placeholder:text-surface-500',
            'focus:outline-none focus:border-emerald/50 transition-colors'
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400 animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden"
          >
            {results.map((law) => (
              <button
                key={law.id}
                onMouseDown={() => { onSelect(law); setQuery(''); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-200 transition-colors border-b border-surface-300/50 last:border-b-0"
              >
                <p className="font-mono text-sm text-white line-clamp-1 leading-snug">{law.statement}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {law.category && (
                    <span className="text-[10px] font-mono text-surface-400">{law.category}</span>
                  )}
                  <span className="text-[10px] font-mono text-surface-500">
                    {law.total_votes.toLocaleString()} votes
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

// ─── Mandate Bar ──────────────────────────────────────────────────────────────

function MandateBar({ pct, total }: { pct: number; total: number }) {
  const forPct = Math.round(pct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400 font-semibold">FOR {forPct}%</span>
        <span className="text-surface-400">{total.toLocaleString()} votes</span>
        <span className="text-against-400 font-semibold">AGAINST {againstPct}%</span>
      </div>
      <div className="h-2 rounded-full bg-against-500/30 overflow-hidden flex">
        <div
          className="h-full bg-for-500 rounded-full transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  a,
  b,
  winnerSide,
  highlight,
}: {
  label: string
  a: React.ReactNode
  b: React.ReactNode
  winnerSide?: 'a' | 'b' | 'tie' | null
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 px-3 rounded-lg',
        highlight ? 'bg-surface-200/60' : 'bg-transparent'
      )}
    >
      <div className={cn('text-right font-mono text-sm', winnerSide === 'a' ? 'text-white font-semibold' : 'text-surface-300')}>
        {a}
        {winnerSide === 'a' && <Trophy className="inline-block ml-1.5 h-3 w-3 text-gold align-middle" />}
      </div>
      <div className="text-center text-[10px] font-mono text-surface-500 uppercase tracking-wider whitespace-nowrap px-1">
        {label}
      </div>
      <div className={cn('text-left font-mono text-sm', winnerSide === 'b' ? 'text-white font-semibold' : 'text-surface-300')}>
        {winnerSide === 'b' && <Trophy className="inline-block mr-1.5 h-3 w-3 text-gold align-middle" />}
        {b}
      </div>
    </div>
  )
}

// ─── Comparison Panel ─────────────────────────────────────────────────────────

function ComparisonPanel({ lawA, lawB }: { lawA: LawResult; lawB: LawResult }) {
  const winA = lawA.blue_pct >= 50 ? lawA.blue_pct : 100 - lawA.blue_pct
  const winB = lawB.blue_pct >= 50 ? lawB.blue_pct : 100 - lawB.blue_pct
  const mandateWinner = winA > winB ? 'a' : winA < winB ? 'b' : 'tie'

  const votesWinner = lawA.total_votes > lawB.total_votes ? 'a' : lawA.total_votes < lawB.total_votes ? 'b' : 'tie'

  const dateA = new Date(lawA.established_at).getTime()
  const dateB = new Date(lawB.established_at).getTime()
  const olderWinner = dateA < dateB ? 'a' : dateA > dateB ? 'b' : 'tie'

  const sameCategory = lawA.category && lawB.category && lawA.category === lawB.category

  const mandateA = mandateLabel(lawA.blue_pct)
  const mandateB = mandateLabel(lawB.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Header cards */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
        <Link
          href={`/law/${lawA.id}`}
          className="group bg-surface-100 border border-surface-300 hover:border-emerald/40 rounded-xl p-4 transition-colors"
        >
          <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-3 group-hover:text-emerald transition-colors">
            {lawA.statement}
          </p>
          <p className={cn('font-mono text-[11px] mt-1.5', mandateA.color)}>{mandateA.label}</p>
          <div className="flex items-center gap-1 mt-2">
            {lawA.is_active ? (
              <CheckCircle2 className="h-3 w-3 text-emerald" />
            ) : (
              <XCircle className="h-3 w-3 text-surface-400" />
            )}
            <span className="text-[10px] font-mono text-surface-400">
              {lawA.is_active ? 'Active' : 'Inactive'}
            </span>
            <ExternalLink className="h-3 w-3 text-surface-500 ml-auto" />
          </div>
        </Link>

        <div className="flex flex-col items-center gap-1">
          <GitCompare className="h-5 w-5 text-surface-500" />
          <span className="text-[9px] font-mono text-surface-500 uppercase tracking-widest">vs</span>
        </div>

        <Link
          href={`/law/${lawB.id}`}
          className="group bg-surface-100 border border-surface-300 hover:border-emerald/40 rounded-xl p-4 transition-colors"
        >
          <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-3 group-hover:text-emerald transition-colors">
            {lawB.statement}
          </p>
          <p className={cn('font-mono text-[11px] mt-1.5', mandateB.color)}>{mandateB.label}</p>
          <div className="flex items-center gap-1 mt-2">
            {lawB.is_active ? (
              <CheckCircle2 className="h-3 w-3 text-emerald" />
            ) : (
              <XCircle className="h-3 w-3 text-surface-400" />
            )}
            <span className="text-[10px] font-mono text-surface-400">
              {lawB.is_active ? 'Active' : 'Inactive'}
            </span>
            <ExternalLink className="h-3 w-3 text-surface-500 ml-auto" />
          </div>
        </Link>
      </div>

      {/* Mandate bars */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
          <MandateBar pct={lawA.blue_pct} total={lawA.total_votes} />
        </div>
        <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
          <MandateBar pct={lawB.blue_pct} total={lawB.total_votes} />
        </div>
      </div>

      {/* Stats comparison table */}
      <div className="bg-surface-100 border border-surface-300 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-300/60">
          <p className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">Head-to-Head</p>
        </div>
        <div className="p-2 space-y-0.5">
          <StatRow
            label="Mandate"
            a={`${Math.round(winA)}%`}
            b={`${Math.round(winB)}%`}
            winnerSide={mandateWinner}
            highlight
          />
          <StatRow
            label="Total Votes"
            a={lawA.total_votes.toLocaleString()}
            b={lawB.total_votes.toLocaleString()}
            winnerSide={votesWinner}
          />
          <StatRow
            label="Established"
            a={formatDate(lawA.established_at)}
            b={formatDate(lawB.established_at)}
            winnerSide={olderWinner}
            highlight
          />
          <StatRow
            label="Age"
            a={relativeTime(lawA.established_at)}
            b={relativeTime(lawB.established_at)}
            winnerSide={null}
          />
          <StatRow
            label="Category"
            a={lawA.category ?? '—'}
            b={lawB.category ?? '—'}
            winnerSide={null}
            highlight
          />
          <StatRow
            label="Status"
            a={lawA.is_active ? 'Active' : 'Inactive'}
            b={lawB.is_active ? 'Active' : 'Inactive'}
            winnerSide={null}
          />
        </div>
      </div>

      {/* Category match badge */}
      {sameCategory && (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-200/40 border border-surface-300/60 rounded-xl">
          <Scale className="h-4 w-4 text-gold flex-shrink-0" />
          <p className="font-mono text-sm text-surface-300">
            Both laws fall under <span className="text-white font-semibold">{lawA.category}</span> — they operate in the same civic domain.
          </p>
        </div>
      )}

      {/* Verdict */}
      <div className="bg-surface-100 border border-surface-300 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-300/60">
          <p className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">Verdict</p>
        </div>
        <div className="p-4 space-y-2">
          <VerdictRow
            icon={<Zap className="h-4 w-4 text-gold" />}
            label="Stronger Mandate"
            value={
              mandateWinner === 'tie'
                ? 'Equal mandate — tied consensus'
                : mandateWinner === 'a'
                ? `Law A — ${Math.round(winA)}% win margin`
                : `Law B — ${Math.round(winB)}% win margin`
            }
          />
          <VerdictRow
            icon={<Users className="h-4 w-4 text-for-400" />}
            label="More Participation"
            value={
              votesWinner === 'tie'
                ? 'Equal voter participation'
                : votesWinner === 'a'
                ? `Law A — ${(lawA.total_votes - lawB.total_votes).toLocaleString()} more votes`
                : `Law B — ${(lawB.total_votes - lawA.total_votes).toLocaleString()} more votes`
            }
          />
          <VerdictRow
            icon={<Calendar className="h-4 w-4 text-purple" />}
            label="More Established"
            value={
              olderWinner === 'tie'
                ? 'Established at the same time'
                : olderWinner === 'a'
                ? `Law A — established first (${relativeTime(lawA.established_at)})`
                : `Law B — established first (${relativeTime(lawB.established_at)})`
            }
          />
          <VerdictRow
            icon={<Shield className="h-4 w-4 text-emerald" />}
            label="Active Status"
            value={
              lawA.is_active === lawB.is_active
                ? lawA.is_active ? 'Both laws are currently active' : 'Both laws are inactive'
                : lawA.is_active ? 'Law A is active; Law B is inactive' : 'Law B is active; Law A is inactive'
            }
          />
        </div>
      </div>
    </motion.div>
  )
}

function VerdictRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
        <p className="font-mono text-sm text-white">{value}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawComparePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [lawA, setLawA] = useState<LawResult | null>(null)
  const [lawB, setLawB] = useState<LawResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [loadingDeepLink, setLoadingDeepLink] = useState(false)

  // Hydrate from query params ?a=<id>&b=<id>
  useEffect(() => {
    const idA = searchParams.get('a')
    const idB = searchParams.get('b')
    if (!idA && !idB) return
    setLoadingDeepLink(true)

    async function fetchLaw(id: string): Promise<LawResult | null> {
      try {
        const res = await fetch(`/api/laws/search?q=${id}&limit=20`)
        const json = await res.json() as { results: LawResult[] }
        return json.results.find((r) => r.id === id) ?? null
      } catch {
        return null
      }
    }

    Promise.all([
      idA ? fetchLaw(idA) : Promise.resolve(null),
      idB ? fetchLaw(idB) : Promise.resolve(null),
    ]).then(([a, b]) => {
      if (a) setLawA(a)
      if (b) setLawB(b)
      setLoadingDeepLink(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync selected laws to URL params
  useEffect(() => {
    const params = new URLSearchParams()
    if (lawA) params.set('a', lawA.id)
    if (lawB) params.set('b', lawB.id)
    const qs = params.toString()
    router.replace(qs ? `/law/compare?${qs}` : '/law/compare', { scroll: false })
  }, [lawA, lawB, router])

  function copyShareUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function reset() {
    setLawA(null)
    setLawB(null)
  }

  const canCompare = lawA !== null && lawB !== null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="px-4 py-6 pb-24 md:pb-12 max-w-2xl mx-auto space-y-6">

        {/* Page header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-emerald" />
            <h1 className="font-mono text-xl font-bold text-white">Law Compare</h1>
          </div>
          <p className="font-mono text-sm text-surface-400">
            Side-by-side comparison of two established consensus laws.
          </p>
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Link href="/law/atlas" className="hover:text-surface-300 transition-colors">Atlas</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/law/timeline" className="hover:text-surface-300 transition-colors">Timeline</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-surface-400">Compare</span>
          </div>
        </div>

        {/* Pickers */}
        {loadingDeepLink ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-surface-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LawPicker
              label="Law A"
              value={lawA}
              onSelect={setLawA}
              onClear={() => setLawA(null)}
              excluded={lawB?.id}
            />
            <div className="hidden sm:flex items-end pb-2 justify-center">
              <ArrowRight className="h-4 w-4 text-surface-500" />
            </div>
            <LawPicker
              label="Law B"
              value={lawB}
              onSelect={setLawB}
              onClear={() => setLawB(null)}
              excluded={lawA?.id}
            />
          </div>
        )}

        {/* Action bar */}
        {canCompare && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyShareUrl}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors',
                'bg-surface-200 border border-surface-300 hover:border-surface-400',
                copied ? 'text-emerald' : 'text-surface-300'
              )}
            >
              {copied ? <Copy className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-300 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        )}

        {/* Comparison */}
        <AnimatePresence>
          {canCompare && <ComparisonPanel lawA={lawA} lawB={lawB} />}
        </AnimatePresence>

        {/* Empty state */}
        {!canCompare && !loadingDeepLink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 gap-4 text-center"
          >
            <Scale className="h-10 w-10 text-surface-500" />
            <div>
              <p className="font-mono text-base font-semibold text-surface-300">Select two laws to compare</p>
              <p className="font-mono text-sm text-surface-500 mt-1">
                Search by keyword, topic, or category above.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/law/atlas"
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-200 border border-surface-300 rounded-lg font-mono text-xs text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
              >
                Browse Atlas <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="/law/timeline"
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-200 border border-surface-300 rounded-lg font-mono text-xs text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
              >
                Law Timeline <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
