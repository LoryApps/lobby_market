'use client'

/**
 * /journal — The Civic Journal
 *
 * A personal notes system tied to platform topics. Write private
 * reflections on debates you care about, track your evolving views,
 * and see how topics evolved since you wrote your entry.
 *
 * Inspired by Obsidian-style personal knowledge management —
 * your private layer on top of the collective debate.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Check,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { JournalEntry, JournalMood } from '@/app/api/journal/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 2000

const MOOD_OPTIONS: { value: JournalMood; label: string; color: string; bg: string; border: string }[] = [
  { value: 'hopeful',    label: 'Hopeful',    color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  { value: 'confident',  label: 'Confident',  color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  { value: 'neutral',    label: 'Neutral',    color: 'text-surface-400', bg: 'bg-surface-200/50', border: 'border-surface-400/30' },
  { value: 'uncertain',  label: 'Uncertain',  color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  { value: 'concerned',  label: 'Concerned',  color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
]

const MOOD_META: Record<JournalMood, { color: string; dot: string }> = {
  hopeful:   { color: 'text-emerald',     dot: 'bg-emerald' },
  confident: { color: 'text-for-400',     dot: 'bg-for-500' },
  neutral:   { color: 'text-surface-400', dot: 'bg-surface-400' },
  uncertain: { color: 'text-gold',        dot: 'bg-gold' },
  concerned: { color: 'text-against-400', dot: 'bg-against-500' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pctChange(now: number, then: number): { diff: number; dir: 'up' | 'down' | 'same' } {
  const diff = Math.round(now - then)
  return { diff: Math.abs(diff), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' }
}

// ─── Topic search result ──────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Topic picker component ───────────────────────────────────────────────────

function TopicPicker({
  value,
  onChange,
}: {
  value: TopicResult | null
  onChange: (t: TopicResult | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics`)
        const d = await r.json()
        setResults((d.results ?? []).slice(0, 8) as TopicResult[])
      } catch {
        //
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  if (value) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-200/50 border border-surface-300">
        <Scale className="h-4 w-4 text-surface-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white leading-snug line-clamp-2">{value.statement}</p>
          <div className="flex items-center gap-2 mt-1">
            {value.category && (
              <span className="text-xs font-mono text-surface-500">{value.category}</span>
            )}
            <span className="text-xs font-mono text-for-400">{Math.round(value.blue_pct)}% FOR</span>
          </div>
        </div>
        <button
          onClick={() => onChange(null)}
          className="flex-shrink-0 p-1 rounded hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
          aria-label="Remove topic"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Link to a debate topic (optional)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className={cn(
            'w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-mono',
            'bg-surface-200/50 border border-surface-300',
            'text-white placeholder:text-surface-500',
            'focus:outline-none focus:border-for-500/50 focus:bg-surface-200',
            'transition-colors'
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 left-0 right-0 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden"
          >
            {results.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t)
                  setQuery('')
                  setOpen(false)
                }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left"
              >
                <Scale className="h-4 w-4 text-surface-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-white line-clamp-1">{t.statement}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.category && (
                      <span className="text-xs font-mono text-surface-500">{t.category}</span>
                    )}
                    <span className="text-xs font-mono text-for-400">{Math.round(t.blue_pct)}% FOR</span>
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Snapshot comparison ──────────────────────────────────────────────────────

function SnapshotDiff({
  snapshot,
  current,
}: {
  snapshot: { blue_pct: number; total_votes: number; status: string }
  current: { blue_pct: number; total_votes: number; status: string }
}) {
  const pct = pctChange(current.blue_pct, snapshot.blue_pct)
  const votes = current.total_votes - snapshot.total_votes
  const statusChanged = current.status !== snapshot.status

  if (pct.dir === 'same' && votes === 0 && !statusChanged) {
    return (
      <span className="text-xs font-mono text-surface-500">No change since you wrote this</span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pct.dir !== 'same' && (
        <span className={cn(
          'text-xs font-mono flex items-center gap-1',
          pct.dir === 'up' ? 'text-for-400' : 'text-against-400'
        )}>
          {pct.dir === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
          FOR {pct.dir === 'up' ? '+' : '-'}{pct.diff}%
        </span>
      )}
      {votes > 0 && (
        <span className="text-xs font-mono text-surface-400">
          +{votes.toLocaleString()} votes
        </span>
      )}
      {statusChanged && (
        <span className={cn(
          'text-xs font-mono px-1.5 py-0.5 rounded-full border',
          current.status === 'law'
            ? 'text-gold bg-gold/10 border-gold/30'
            : current.status === 'failed'
            ? 'text-against-400 bg-against-500/10 border-against-500/30'
            : 'text-for-400 bg-for-500/10 border-for-500/30'
        )}>
          Now {current.status === 'law' ? 'LAW' : current.status.toUpperCase()}
        </span>
      )}
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onDelete,
  onTogglePublic,
  onEdit,
}: {
  entry: JournalEntry & { currentTopic?: { blue_pct: number; total_votes: number; status: string } }
  onDelete: (id: string) => void
  onTogglePublic: (id: string, val: boolean) => void
  onEdit: (entry: JournalEntry) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const mood = entry.mood ? MOOD_META[entry.mood] : null

  const isLong = entry.content.length > 280

  async function handleDelete() {
    if (!confirm('Delete this journal entry?')) return
    setDeleting(true)
    try {
      await fetch(`/api/journal/${entry.id}`, { method: 'DELETE' })
      onDelete(entry.id)
    } finally {
      setDeleting(false)
    }
  }

  async function handleTogglePublic() {
    setToggling(true)
    try {
      const res = await fetch(`/api/journal/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: !entry.is_public }),
      })
      if (res.ok) {
        onTogglePublic(entry.id, !entry.is_public)
      }
    } finally {
      setToggling(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="group bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden hover:border-surface-400 transition-colors"
    >
      {/* Topic header */}
      {entry.topic && (
        <Link
          href={`/topic/${entry.topic.id}`}
          className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-surface-200/50 hover:bg-surface-200/30 transition-colors"
        >
          <Scale className="h-4 w-4 text-surface-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-white line-clamp-1 group-hover:text-for-300 transition-colors">
              {entry.topic.statement}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {entry.topic.category && (
                <span className="text-xs font-mono text-surface-500">{entry.topic.category}</span>
              )}
              <span className="text-xs font-mono text-for-400">
                {Math.round(entry.topic.blue_pct)}% FOR
              </span>
              <span className="text-xs font-mono text-surface-500">
                {entry.topic.total_votes.toLocaleString()} votes
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
        </Link>
      )}

      {/* Entry body */}
      <div className="px-4 pt-3 pb-2">
        {/* Mood + meta row */}
        <div className="flex items-center gap-2 mb-2">
          {mood && (
            <div className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', mood.dot)} />
              <span className={cn('text-xs font-mono', mood.color)}>
                {MOOD_OPTIONS.find(m => m.value === entry.mood)?.label}
              </span>
            </div>
          )}
          <span className="text-xs font-mono text-surface-500">{relativeTime(entry.created_at)}</span>
          {entry.is_public && (
            <span className="text-xs font-mono text-surface-500 flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Public
            </span>
          )}
          {!entry.is_public && (
            <span className="text-xs font-mono text-surface-600 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Private
            </span>
          )}
        </div>

        {/* Content */}
        <p className={cn(
          'text-sm font-mono text-surface-200 whitespace-pre-wrap leading-relaxed',
          !expanded && isLong && 'line-clamp-4'
        )}>
          {entry.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-mono text-for-400 hover:text-for-300 mt-1 transition-colors"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Snapshot diff */}
        {entry.vote_snapshot && entry.topic && entry.currentTopic && (
          <div className="mt-2 pt-2 border-t border-surface-200/50">
            <SnapshotDiff
              snapshot={entry.vote_snapshot}
              current={entry.currentTopic}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(entry)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          onClick={handleTogglePublic}
          disabled={toggling}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
        >
          {entry.is_public ? (
            <><EyeOff className="h-3.5 w-3.5" />Make private</>
          ) : (
            <><Eye className="h-3.5 w-3.5" />Make public</>
          )}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-400 hover:text-against-400 hover:bg-against-500/10 transition-colors disabled:opacity-50 ml-auto"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete
        </button>
      </div>
    </motion.div>
  )
}

// ─── Compose / edit drawer ────────────────────────────────────────────────────

interface ComposeState {
  content: string
  topic: TopicResult | null
  mood: JournalMood | null
  isPublic: boolean
}

function ComposePanel({
  initial,
  editId,
  onSave,
  onCancel,
}: {
  initial?: Partial<ComposeState>
  editId?: string
  onSave: (entry: JournalEntry) => void
  onCancel: () => void
}) {
  const [content, setContent] = useState(initial?.content ?? '')
  const [topic, setTopic] = useState<TopicResult | null>(initial?.topic ?? null)
  const [mood, setMood] = useState<JournalMood | null>(initial?.mood ?? null)
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  const remaining = MAX_CHARS - content.length

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/journal/${editId}` : '/api/journal'
      const method = editId ? 'PATCH' : 'POST'
      const body = editId
        ? { content, mood, is_public: isPublic }
        : { content, topic_id: topic?.id ?? null, mood, is_public: isPublic }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save')
        return
      }
      onSave(data.entry as JournalEntry)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200/50">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-for-400" />
          <span className="text-sm font-mono font-bold text-white">
            {editId ? 'Edit entry' : 'New journal entry'}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Topic picker — only on new entries */}
        {!editId && (
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-1.5 uppercase tracking-wider">
              Linked Topic
            </label>
            <TopicPicker value={topic} onChange={setTopic} />
          </div>
        )}

        {/* Text area */}
        <div>
          <label className="block text-xs font-mono text-surface-500 mb-1.5 uppercase tracking-wider">
            Your thoughts
          </label>
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder="What do you think about this topic? Why did you vote the way you did? What are you watching for?"
            rows={6}
            className={cn(
              'w-full px-4 py-3 rounded-xl text-sm font-mono',
              'bg-surface-200/50 border border-surface-300',
              'text-white placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/50',
              'resize-none leading-relaxed transition-colors'
            )}
          />
          <div className={cn(
            'text-xs font-mono mt-1 text-right',
            remaining < 100 ? 'text-against-400' : 'text-surface-500'
          )}>
            {remaining} left
          </div>
        </div>

        {/* Mood picker */}
        <div>
          <label className="block text-xs font-mono text-surface-500 mb-2 uppercase tracking-wider">
            How do you feel about this?
          </label>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(mood === m.value ? null : m.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  mood === m.value
                    ? cn(m.color, m.bg, m.border)
                    : 'text-surface-500 bg-surface-200/30 border-surface-300 hover:border-surface-400'
                )}
              >
                {mood === m.value && <Check className="h-3 w-3" />}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy toggle */}
        <div className="flex items-center justify-between py-2 border-t border-surface-200/50">
          <div>
            <p className="text-sm font-mono text-white">Make public</p>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Visible to other users on your profile</p>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors duration-200',
              isPublic ? 'bg-for-500' : 'bg-surface-300'
            )}
            aria-label="Toggle public visibility"
          >
            <span className={cn(
              'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
              isPublic ? 'translate-x-6' : 'translate-x-1'
            )} />
          </button>
        </div>

        {error && (
          <p className="text-xs font-mono text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>{editId ? 'Save changes' : 'Add to journal'}</>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type EnrichedEntry = JournalEntry & {
  currentTopic?: { blue_pct: number; total_votes: number; status: string }
}

export default function JournalPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<EnrichedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [stats, setStats] = useState({ total: 0, public: 0, withTopic: 0 })

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
      } else {
        setAuthed(true)
      }
    })
  }, [router])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/journal?limit=100')
      const data = await res.json()
      const rawEntries: JournalEntry[] = data.entries ?? []

      // Enrich with current topic state for snapshot comparison
      const enriched: EnrichedEntry[] = rawEntries.map((e) => ({
        ...e,
        currentTopic: e.topic
          ? { blue_pct: e.topic.blue_pct, total_votes: e.topic.total_votes, status: e.topic.status }
          : undefined,
      }))

      setEntries(enriched)
      setStats({
        total: data.total ?? enriched.length,
        public: enriched.filter((e) => e.is_public).length,
        withTopic: enriched.filter((e) => e.topic_id).length,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) loadEntries()
  }, [authed, loadEntries])

  function handleSaved(entry: JournalEntry) {
    if (editEntry) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...entry, currentTopic: e.currentTopic }
            : e
        )
      )
      setEditEntry(null)
    } else {
      const enriched: EnrichedEntry = {
        ...entry,
        currentTopic: entry.topic
          ? { blue_pct: entry.topic.blue_pct, total_votes: entry.topic.total_votes, status: entry.topic.status }
          : undefined,
      }
      setEntries((prev) => [enriched, ...prev])
      setStats((s) => ({
        total: s.total + 1,
        public: entry.is_public ? s.public + 1 : s.public,
        withTopic: entry.topic_id ? s.withTopic + 1 : s.withTopic,
      }))
      setComposing(false)
    }
  }

  function handleDelete(id: string) {
    const entry = entries.find((e) => e.id === id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setStats((s) => ({
      total: s.total - 1,
      public: entry?.is_public ? s.public - 1 : s.public,
      withTopic: entry?.topic_id ? s.withTopic - 1 : s.withTopic,
    }))
  }

  function handleTogglePublic(id: string, val: boolean) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, is_public: val } : e))
    )
    setStats((s) => ({
      ...s,
      public: val ? s.public + 1 : s.public - 1,
    }))
  }

  if (authed === null) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-for-400 animate-spin" />
      </div>
    )
  }

  const editInitial = editEntry
    ? {
        content: editEntry.content,
        mood: editEntry.mood,
        isPublic: editEntry.is_public,
      }
    : undefined

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <BookOpen className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Journal</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Your private thoughts on the debates that matter
              </p>
            </div>
          </div>
          <button
            onClick={() => { setComposing(true); setEditEntry(null) }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-medium',
              'bg-for-500 hover:bg-for-600 text-white transition-colors'
            )}
          >
            <Plus className="h-4 w-4" />
            New entry
          </button>
        </div>

        {/* Stats strip */}
        {!loading && entries.length > 0 && (
          <div className="flex items-center gap-4 mb-5 px-1">
            <div className="flex items-center gap-1.5 text-sm font-mono text-surface-400">
              <MessageSquare className="h-4 w-4" />
              <span className="text-white font-medium">{stats.total}</span> entries
            </div>
            <div className="flex items-center gap-1.5 text-sm font-mono text-surface-400">
              <Scale className="h-4 w-4" />
              <span className="text-white font-medium">{stats.withTopic}</span> linked to topics
            </div>
            <div className="flex items-center gap-1.5 text-sm font-mono text-surface-400">
              <Eye className="h-4 w-4" />
              <span className="text-white font-medium">{stats.public}</span> public
            </div>
          </div>
        )}

        {/* Compose / Edit panel */}
        <AnimatePresence mode="wait">
          {(composing || editEntry) && (
            <div className="mb-6">
              <ComposePanel
                initial={editInitial}
                editId={editEntry?.id}
                onSave={handleSaved}
                onCancel={() => { setComposing(false); setEditEntry(null) }}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Entry list */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 && !composing ? (
          <EmptyState
            icon={BookOpen}
            title="Your journal is empty"
            description="Write your first reflection — link it to a debate, record your stance, and watch how the community's verdict evolves over time."
            action={
              <button
                onClick={() => setComposing(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-for-500 hover:bg-for-600 text-white font-mono text-sm rounded-xl transition-colors"
              >
                <Plus className="h-4 w-4" />
                Write your first entry
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDelete}
                  onTogglePublic={handleTogglePublic}
                  onEdit={(e) => { setEditEntry(e); setComposing(false) }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* About section */}
        {entries.length > 0 && (
          <div className="mt-8 p-4 bg-surface-100/50 border border-surface-200/50 rounded-2xl">
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              <span className="text-surface-400 font-medium">About your journal —</span>{' '}
              Entries are private by default. Public entries appear on your profile.
              When you link an entry to a topic, you can see how the vote has moved
              since you wrote it — turning your journal into a living record of how
              civic consensus evolves.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
