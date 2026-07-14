'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  Building2,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  ScrollText,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Minister {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

interface Statement {
  id: string
  title: string
  summary: string | null
  body: string
  department: string
  category: string
  statement_type: 'oral' | 'written'
  question_count: number
  upvote_count: number
  published_at: string
  topic_id: string | null
  minister: Minister | null
}

type FilterType = 'all' | 'oral' | 'written'
type FilterDept = 'all' | string

// ─── Config ───────────────────────────────────────────────────────────────────

const DEPARTMENTS: { id: string; label: string }[] = [
  { id: 'all',             label: 'All Departments' },
  { id: 'treasury',        label: 'Treasury' },
  { id: 'health',          label: 'Health' },
  { id: 'education',       label: 'Education' },
  { id: 'home-affairs',    label: 'Home Affairs' },
  { id: 'foreign-affairs', label: 'Foreign Affairs' },
  { id: 'environment',     label: 'Environment' },
  { id: 'transport',       label: 'Transport' },
  { id: 'housing',         label: 'Housing' },
  { id: 'science',         label: 'Science' },
  { id: 'culture',         label: 'Culture' },
  { id: 'justice',         label: 'Justice' },
  { id: 'parliament',      label: 'Parliament' },
  { id: 'other',           label: 'Other' },
]


const DEPT_BADGE: Record<string, string> = {
  treasury:        'bg-gold/10 border-gold/25 text-gold',
  health:          'bg-emerald/10 border-emerald/25 text-emerald',
  education:       'bg-for-900/30 border-for-700/20 text-for-300',
  'home-affairs':  'bg-against-900/30 border-against-700/20 text-against-300',
  'foreign-affairs': 'bg-purple/10 border-purple/25 text-purple',
  environment:     'bg-emerald/10 border-emerald/25 text-emerald',
  transport:       'bg-for-900/20 border-for-800/20 text-for-400',
  housing:         'bg-gold/10 border-gold/20 text-gold',
  science:         'bg-purple/10 border-purple/25 text-purple',
  culture:         'bg-against-900/20 border-against-700/20 text-against-300',
  justice:         'bg-against-900/20 border-against-700/20 text-against-400',
  parliament:      'bg-for-900/20 border-for-600/20 text-for-300',
}

function deptLabel(dept: string) {
  return DEPARTMENTS.find((d) => d.id === dept)?.label ?? dept
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Statement card ───────────────────────────────────────────────────────────

function StatementCard({ statement, upvoted, onUpvote }: {
  statement: Statement
  upvoted: boolean
  onUpvote: (id: string) => void
}) {
  const deptBadgeClass = DEPT_BADGE[statement.department] ?? 'bg-surface-200 border-surface-400 text-surface-400'
  const isOral = statement.statement_type === 'oral'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
    >
      <Link href={`/ministerial-statements/${statement.id}`} className="block p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar
            src={statement.minister?.avatar_url}
            fallback={statement.minister?.display_name || statement.minister?.username || '?'}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
                {statement.minister?.display_name || statement.minister?.username}
              </span>
              {statement.minister?.role && statement.minister.role !== 'person' && (
                <Badge variant={statement.minister.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
                  {statement.minister.role}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-surface-500">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  deptBadgeClass
                )}
              >
                <Building2 className="h-2.5 w-2.5" />
                {deptLabel(statement.department)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  isOral
                    ? 'bg-for-500/10 border-for-500/25 text-for-400'
                    : 'bg-surface-300/40 border-surface-400/40 text-surface-500'
                )}
              >
                {isOral ? <Mic className="h-2.5 w-2.5" /> : <ScrollText className="h-2.5 w-2.5" />}
                {isOral ? 'Oral' : 'Written'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(statement.published_at)}
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white flex-shrink-0 transition-colors mt-1" />
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-for-300 transition-colors line-clamp-2">
          {statement.title}
        </h3>

        {/* Summary or truncated body */}
        {(statement.summary || statement.body) && (
          <p className="text-xs text-surface-500 leading-relaxed line-clamp-2 mb-3">
            {statement.summary || statement.body}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-4 text-xs text-surface-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {statement.question_count} question{statement.question_count !== 1 ? 's' : ''}
          </span>
          <span className={cn('flex items-center gap-1', upvoted && 'text-for-400')}>
            <ThumbsUp className="h-3.5 w-3.5" />
            {statement.upvote_count}
          </span>
          {statement.category !== 'Politics' && (
            <span className="ml-auto font-mono">{statement.category}</span>
          )}
        </div>
      </Link>

      {/* Upvote button outside the link */}
      <div className="px-5 pb-4 -mt-1 flex">
        <button
          onClick={(e) => { e.preventDefault(); onUpvote(statement.id) }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold border transition-all',
            upvoted
              ? 'bg-for-600/20 border-for-600/50 text-for-400 hover:bg-for-600/30'
              : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/40 hover:text-for-400'
          )}
        >
          <ThumbsUp className="h-3 w-3" />
          {upvoted ? 'Endorsed' : 'Endorse'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── New statement modal ──────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics','Economics','Technology','Science','Ethics',
  'Philosophy','Culture','Health','Environment','Education','Other',
] as const

function NewStatementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (s: Statement) => void
}) {
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [summary, setSummary]       = useState('')
  const [department, setDepartment] = useState('parliament')
  const [category, setCategory]     = useState('Politics')
  const [type, setType]             = useState<'written' | 'oral'>('written')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr]               = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setErr(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/ministerial-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, summary: summary || undefined, department, category, statement_type: type }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'Failed'); return }
      onCreated(json.statement)
      onClose()
    } catch {
      setErr('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-300">
            <div>
              <h2 className="text-sm font-bold text-white">Make a Ministerial Statement</h2>
              <p className="text-xs text-surface-500 mt-0.5">Formal statement on any civic matter. Citizens will respond with supplementary questions.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-lg bg-surface-200 flex items-center justify-center text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Statement type */}
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Type
              </label>
              <div className="flex gap-2">
                {(['written', 'oral'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                      type === t
                        ? t === 'oral'
                          ? 'bg-for-500/15 border-for-500/50 text-for-300'
                          : 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400'
                    )}
                  >
                    {t === 'oral' ? <Mic className="h-3 w-3" /> : <ScrollText className="h-3 w-3" />}
                    {t === 'oral' ? 'Oral Statement' : 'Written Statement'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-surface-600 mt-1.5">
                {type === 'oral'
                  ? 'Made "at the despatch box" — higher visibility, immediate Q&A period.'
                  : 'Published in the parliamentary record — more considered, formal tone.'}
              </p>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20"
              >
                {DEPARTMENTS.filter((d) => d.id !== 'all').map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Statement Title <span className="text-against-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Government position on universal basic income"
                maxLength={200}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-surface-600">Min 10 characters</span>
                <span className="text-[11px] text-surface-600">{title.length}/200</span>
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Summary <span className="text-surface-600">(optional)</span>
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One-line headline for the statement card"
                maxLength={400}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Full Statement <span className="text-against-400">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="With permission, I wish to make a statement to the Lobby on..."
                rows={6}
                maxLength={5000}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20 resize-none"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-surface-600">Min 100 characters</span>
                <span className="text-[11px] text-surface-600">{body.length}/5000</span>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-against-500/10 border border-against-500/20">
                <AlertCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-against-300">{err}</p>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm text-surface-500 hover:text-white transition-colors font-mono font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || title.length < 10 || body.length < 100}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold transition-all',
                'bg-for-600 border border-for-600 text-white',
                'hover:bg-for-500 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</>
              ) : (
                <><ScrollText className="h-4 w-4" /> Issue Statement</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MinisterialStatementsClient() {
  const [statements, setStatements]   = useState<Statement[]>([])
  const [userUpvotes, setUserUpvotes] = useState<string[]>([])
  const [userId, setUserId]           = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [typeFilter, setTypeFilter]   = useState<FilterType>('all')
  const [deptFilter, setDeptFilter]   = useState<FilterDept>('all')
  const [showModal, setShowModal]     = useState(false)
  const [showDeptMenu, setShowDeptMenu] = useState(false)

  const fetchStatements = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (deptFilter !== 'all') params.set('department', deptFilter)
    try {
      const res = await fetch(`/api/ministerial-statements?${params}`)
      if (!res.ok) return
      const json = await res.json()
      setStatements(json.statements ?? [])
      setUserUpvotes(json.userUpvotes ?? [])
      setUserId(json.userId ?? null)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [typeFilter, deptFilter])

  useEffect(() => { fetchStatements() }, [fetchStatements])

  async function handleUpvote(id: string) {
    if (!userId) return
    const wasUp = userUpvotes.includes(id)
    setUserUpvotes((prev) => wasUp ? prev.filter((u) => u !== id) : [...prev, id])
    setStatements((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, upvote_count: s.upvote_count + (wasUp ? -1 : 1) }
          : s
      )
    )
    try {
      await fetch(`/api/ministerial-statements/${id}/upvote`, { method: 'POST' })
    } catch {
      // rollback on error
      setUserUpvotes((prev) => wasUp ? [...prev, id] : prev.filter((u) => u !== id))
    }
  }

  function handleCreated(s: Statement) {
    setStatements((prev) => [s, ...prev])
  }

  const activeDeptLabel = DEPARTMENTS.find((d) => d.id === deptFilter)?.label ?? 'All Departments'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center flex-shrink-0">
                <ScrollText className="h-4 w-4 text-for-400" />
              </div>
              <h1 className="text-xl font-bold text-white font-mono">Ministerial Statements</h1>
            </div>
            <p className="text-sm text-surface-500 ml-10">
              Formal statements from civic ministers, followed by citizen supplementary questions.
            </p>
          </div>
          {userId && (
            <button
              onClick={() => setShowModal(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-for-600/20 border border-for-600/40 text-for-300 text-sm font-mono font-semibold hover:bg-for-600/30 hover:text-white transition-all"
            >
              <Plus className="h-4 w-4" />
              Make Statement
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {/* Type tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-surface-200 rounded-lg" role="group">
            {(['all', 'oral', 'written'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                  typeFilter === t
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                {t === 'oral' && <Mic className="h-3 w-3" />}
                {t === 'written' && <ScrollText className="h-3 w-3" />}
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Department picker */}
          <div className="relative">
            <button
              onClick={() => setShowDeptMenu((o) => !o)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all',
                deptFilter !== 'all'
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              <Building2 className="h-3 w-3" />
              {activeDeptLabel}
            </button>
            {showDeptMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDeptMenu(false)} />
                <div className="absolute top-full left-0 mt-1 z-20 w-48 bg-surface-100 border border-surface-300 rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto">
                  {DEPARTMENTS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { setDeptFilter(d.id); setShowDeptMenu(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        deptFilter === d.id
                          ? 'text-white bg-surface-200'
                          : 'text-surface-500 hover:text-white hover:bg-surface-200'
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {(typeFilter !== 'all' || deptFilter !== 'all') && (
            <button
              onClick={() => { setTypeFilter('all'); setDeptFilter('all') }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : statements.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No ministerial statements yet"
            description={
              deptFilter !== 'all' || typeFilter !== 'all'
                ? 'Try clearing the filters to see more statements.'
                : userId
                  ? 'Be the first to issue a formal statement on a civic matter.'
                  : 'No ministerial statements have been published yet.'
            }
            action={userId ? { label: 'Make a Statement', onClick: () => setShowModal(true) } : undefined}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {statements.map((s) => (
                <StatementCard
                  key={s.id}
                  statement={s}
                  upvoted={userUpvotes.includes(s.id)}
                  onUpvote={handleUpvote}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
      <BottomNav />

      {/* New statement modal */}
      <AnimatePresence>
        {showModal && (
          <NewStatementModal
            onClose={() => setShowModal(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
