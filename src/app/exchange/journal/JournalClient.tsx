'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  Filter,
  MessageSquare,
  RefreshCw,
  Save,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { JournalEntry, JournalResponse } from '@/app/api/exchange/journal/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const NOTES_KEY = 'lm_journal_notes_v1'

type FilterMode = 'all' | 'open' | 'settled' | 'wins' | 'losses'
type SortMode = 'recent' | 'pnl_high' | 'pnl_low' | 'entry_price'

const CAT_COLOR: Record<string, { text: string; border: string }> = {
  Economics:   { text: 'text-gold',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     border: 'border-for-500/30' },
}

function getCatStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-500', border: 'border-surface-400/30' }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return 'text-emerald'
  if (pnl < 0) return 'text-against-400'
  return 'text-surface-400'
}

function pnlSign(pnl: number): string {
  return pnl > 0 ? '+' : pnl < 0 ? '' : '±'
}

function outcomeIcon(outcome: JournalEntry['outcome']) {
  switch (outcome) {
    case 'settled_win': return { Icon: Trophy, color: 'text-gold', label: 'Won' }
    case 'settled_loss': return { Icon: XCircle, color: 'text-against-400', label: 'Lost' }
    case 'winning': return { Icon: TrendingUp, color: 'text-emerald', label: 'Up' }
    case 'losing': return { Icon: TrendingDown, color: 'text-against-400', label: 'Down' }
    case 'push': return { Icon: Scale, color: 'text-surface-500', label: 'Even' }
    default: return { Icon: Scale, color: 'text-surface-500', label: 'Open' }
  }
}

// ─── Note storage ──────────────────────────────────────────────────────────────

function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') } catch { return {} }
}
function saveNotes(notes: Record<string, string>) {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)) } catch { /* best-effort */ }
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color = 'text-surface-900',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300/40 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-surface-500 font-medium uppercase tracking-wider">{label}</span>
      <span className={cn('text-2xl font-bold tabular-nums', color)}>{value}</span>
      {sub && <span className="text-xs text-surface-500">{sub}</span>}
    </div>
  )
}

// ─── Journal Entry Card ────────────────────────────────────────────────────────

function EntryCard({
  entry,
  notes,
  onNoteSave,
}: {
  entry: JournalEntry
  notes: Record<string, string>
  onNoteSave: (id: string, note: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes[entry.topic_id] ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const note = notes[entry.topic_id] ?? ''
  const { Icon, color: iconColor, label: outcomeLabel } = outcomeIcon(entry.outcome)
  const catStyle = getCatStyle(entry.category)
  const pnlCol = pnlColor(entry.pnl)
  const sign = pnlSign(entry.pnl)

  function handleSave() {
    onNoteSave(entry.topic_id, draft.trim())
    setEditing(false)
  }

  function handleEditClick() {
    setDraft(note)
    setEditing(true)
    setExpanded(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        'bg-surface-100 border rounded-xl overflow-hidden transition-colors',
        entry.is_settled
          ? entry.outcome === 'settled_win'
            ? 'border-gold/20'
            : entry.outcome === 'settled_loss'
              ? 'border-against-500/20'
              : 'border-surface-300/40'
          : 'border-surface-300/40',
      )}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        {/* Side indicator */}
        <div
          className={cn(
            'mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
            entry.side === 'blue'
              ? 'bg-for-500/20 text-for-400'
              : 'bg-against-500/20 text-against-400',
          )}
        >
          {entry.side === 'blue' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
        </div>

        {/* Statement + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-800 leading-snug line-clamp-2">
            {entry.statement}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {entry.category && (
              <span className={cn('text-xs font-medium', catStyle.text)}>
                {entry.category}
              </span>
            )}
            <span className="text-xs text-surface-500">{relTime(entry.voted_at)}</span>
            {note && (
              <span className="text-xs text-purple flex items-center gap-1">
                <MessageSquare size={10} /> note
              </span>
            )}
          </div>
        </div>

        {/* P&L + outcome */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className={cn('text-sm font-bold tabular-nums', pnlCol)}>
            {sign}{entry.pnl > 0 || entry.pnl < 0 ? Math.abs(entry.pnl).toFixed(1) : '0'}¢
          </span>
          <div className={cn('flex items-center gap-1 text-xs', iconColor)}>
            <Icon size={11} />
            <span>{outcomeLabel}</span>
          </div>
        </div>

        <div className="flex-shrink-0 ml-1 text-surface-500">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-3 border-t border-surface-300/30">
              {/* Price details */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center">
                  <div className="text-xs text-surface-500 mb-0.5">Entry</div>
                  <div className="text-sm font-semibold text-surface-700 tabular-nums">
                    {entry.entry_price.toFixed(1)}¢
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-surface-500 mb-0.5">Current</div>
                  <div className="text-sm font-semibold text-surface-700 tabular-nums">
                    {entry.current_price.toFixed(1)}¢
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-surface-500 mb-0.5">P&L</div>
                  <div className={cn('text-sm font-semibold tabular-nums', pnlCol)}>
                    {sign}{entry.pnl > 0 || entry.pnl < 0 ? Math.abs(entry.pnl).toFixed(1) : '0'}¢
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    entry.status === 'law'
                      ? 'law'
                      : entry.status === 'failed'
                        ? 'failed'
                        : entry.status === 'voting' || entry.status === 'active'
                          ? 'active'
                          : 'proposed'
                  }
                >
                  {entry.status === 'law'
                    ? 'Law'
                    : entry.status === 'failed'
                      ? 'Failed'
                      : entry.status === 'voting'
                        ? 'Voting'
                        : entry.status === 'active'
                          ? 'Active'
                          : 'Proposed'}
                </Badge>
                <span className="text-xs text-surface-500">
                  {entry.total_votes.toLocaleString()} votes
                </span>
              </div>

              {/* Top arguments context */}
              {(entry.top_for_arg || entry.top_against_arg) && (
                <div className="space-y-2">
                  {entry.top_for_arg && (
                    <div className="bg-for-500/5 border border-for-500/20 rounded-lg px-3 py-2">
                      <div className="text-xs font-semibold text-for-400 mb-1 uppercase tracking-wide">
                        Top FOR
                      </div>
                      <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">
                        {entry.top_for_arg}
                      </p>
                    </div>
                  )}
                  {entry.top_against_arg && (
                    <div className="bg-against-500/5 border border-against-500/20 rounded-lg px-3 py-2">
                      <div className="text-xs font-semibold text-against-400 mb-1 uppercase tracking-wide">
                        Top AGAINST
                      </div>
                      <p className="text-xs text-surface-600 leading-relaxed line-clamp-2">
                        {entry.top_against_arg}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Note editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    My Thesis
                  </span>
                  {!editing && (
                    <button
                      onClick={handleEditClick}
                      className="text-xs text-purple flex items-center gap-1 hover:text-purple/80 transition-colors"
                    >
                      <Edit3 size={11} />
                      {note ? 'Edit note' : 'Add note'}
                    </button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Why did you take this position? What was your reasoning? What would change your mind?"
                      rows={4}
                      className="w-full text-sm bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2 text-surface-800 placeholder-surface-500 focus:outline-none focus:border-purple/50 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 text-xs bg-purple/20 text-purple border border-purple/30 rounded-lg px-3 py-1.5 hover:bg-purple/30 transition-colors font-medium"
                      >
                        <Save size={12} /> Save
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="text-xs text-surface-500 hover:text-surface-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : note ? (
                  <p className="text-sm text-surface-600 leading-relaxed bg-surface-200/50 rounded-lg px-3 py-2 border border-surface-300/30">
                    {note}
                  </p>
                ) : (
                  <button
                    onClick={handleEditClick}
                    className="w-full text-xs text-surface-500 border border-dashed border-surface-400/30 rounded-lg py-3 hover:border-purple/30 hover:text-purple transition-colors"
                  >
                    Add your reasoning for this position…
                  </button>
                )}
              </div>

              {/* Link to market */}
              <Link
                href={`/exchange/${entry.topic_id}`}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={11} />
                Open in Exchange
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function JournalClient() {
  const router = useRouter()
  const [data, setData] = useState<JournalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('recent')
  const [showFilters, setShowFilters] = useState(false)

  // Load notes from localStorage on mount
  useEffect(() => {
    setNotes(loadNotes())
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/journal')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load journal')
      const json: JournalResponse = await res.json()
      setData(json)
    } catch {
      setError('Unable to load your trade journal. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  function handleNoteSave(id: string, note: string) {
    const updated = { ...notes }
    if (note) updated[id] = note
    else delete updated[id]
    setNotes(updated)
    saveNotes(updated)
  }

  const filtered = (data?.entries ?? []).filter((e) => {
    if (filter === 'open') return !e.is_settled
    if (filter === 'settled') return e.is_settled
    if (filter === 'wins') return e.outcome === 'settled_win'
    if (filter === 'losses') return e.outcome === 'settled_loss'
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'pnl_high') return b.pnl - a.pnl
    if (sort === 'pnl_low') return a.pnl - b.pnl
    if (sort === 'entry_price') return b.entry_price - a.entry_price
    return new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime()
  })

  const noteCount = Object.keys(notes).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg text-surface-500 hover:text-surface-800 hover:bg-surface-200/60 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <BookOpen size={20} className="text-purple flex-shrink-0" />
              Trade Journal
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Your positions, reasoning, and reflections
            </p>
          </div>
          <Link
            href="/exchange"
            className="text-xs text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
          >
            Exchange <ArrowRight size={12} />
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-surface-500 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 mx-auto text-sm text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 mb-5 sm:grid-cols-6">
              <StatTile
                label="Positions"
                value={data.summary.total}
                sub="total"
              />
              <StatTile
                label="Open"
                value={data.summary.open}
                sub="active"
                color="text-for-400"
              />
              <StatTile
                label="Settled"
                value={data.summary.settled}
                sub="resolved"
              />
              <StatTile
                label="Win rate"
                value={data.summary.win_rate !== null ? `${data.summary.win_rate}%` : '—'}
                sub={`${data.summary.wins}W / ${data.summary.losses}L`}
                color={
                  data.summary.win_rate !== null
                    ? data.summary.win_rate >= 60
                      ? 'text-emerald'
                      : data.summary.win_rate >= 40
                        ? 'text-gold'
                        : 'text-against-400'
                    : 'text-surface-500'
                }
              />
              <StatTile
                label="Net P&L"
                value={`${data.summary.net_pnl > 0 ? '+' : ''}${data.summary.net_pnl.toFixed(1)}¢`}
                sub="all positions"
                color={pnlColor(data.summary.net_pnl)}
              />
              <StatTile
                label="Notes"
                value={noteCount}
                sub="annotated"
                color={noteCount > 0 ? 'text-purple' : 'text-surface-500'}
              />
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setShowFilters((p) => !p)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors',
                  showFilters
                    ? 'bg-purple/20 text-purple border-purple/30'
                    : 'bg-surface-200/50 text-surface-500 border-surface-300/40 hover:text-surface-700',
                )}
              >
                <Filter size={12} />
                {showFilters ? 'Hide filters' : 'Filters'}
              </button>

              {(['all', 'open', 'settled', 'wins', 'losses'] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors capitalize',
                    filter === f
                      ? 'bg-for-500/20 text-for-300 border-for-500/30'
                      : 'bg-surface-200/50 text-surface-500 border-surface-300/40 hover:text-surface-700',
                  )}
                >
                  {f}
                </button>
              ))}

              <span className="ml-auto text-xs text-surface-500">
                {sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'}
              </span>
            </div>

            {/* Sort row */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="flex items-center gap-2 pb-1 flex-wrap">
                    <span className="text-xs text-surface-500">Sort by:</span>
                    {(
                      [
                        { id: 'recent', label: 'Most recent' },
                        { id: 'pnl_high', label: 'Best P&L' },
                        { id: 'pnl_low', label: 'Worst P&L' },
                        { id: 'entry_price', label: 'Highest entry' },
                      ] as { id: SortMode; label: string }[]
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setSort(id)}
                        className={cn(
                          'text-xs rounded-lg px-2.5 py-1 border transition-colors',
                          sort === id
                            ? 'bg-surface-300/60 text-surface-800 border-surface-400/40'
                            : 'bg-surface-200/30 text-surface-500 border-surface-300/30 hover:text-surface-700',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Entry list */}
            {sorted.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No entries yet"
                description={
                  filter === 'all'
                    ? "Vote on topics in the Exchange to build your trade journal."
                    : `No positions match the "${filter}" filter.`
                }
                action={
                  filter !== 'all'
                    ? { label: 'Show all', onClick: () => setFilter('all') }
                    : { label: 'Browse Exchange', href: '/exchange' }
                }
              />
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {sorted.map((entry) => (
                    <EntryCard
                      key={entry.topic_id}
                      entry={entry}
                      notes={notes}
                      onNoteSave={handleNoteSave}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Reflection callout for settled positions with notes */}
            {data.summary.settled > 0 && noteCount > 0 && (
              <div className="mt-6 bg-purple/5 border border-purple/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-purple mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-surface-700">
                      {noteCount} position{noteCount === 1 ? '' : 's'} annotated
                    </p>
                    <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">
                      Keeping a thesis for each trade helps you learn from your decisions over time.
                      Review settled positions to see what your reasoning missed or got right.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
