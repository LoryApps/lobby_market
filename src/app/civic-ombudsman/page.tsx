'use client'

/**
 * /civic-ombudsman — Civic Ombudsman
 *
 * The Civic Ombudsman is an independent oversight body. Any citizen can file a
 * formal complaint about civic process fairness, transparency failures, or norm
 * breaches. Officers publish formal findings (upheld / dismissed / referred).
 *
 * Distinct from moderation (content violations) and the grand_council (governance
 * proposals). The Ombudsman covers process integrity and civic fairness.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  FileText,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  ShieldCheck,
  ThumbsUp,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OmbudsmanCase {
  id: string
  case_number: string
  category: string
  title: string
  status: string
  support_count: number
  created_at: string
  resolved_at: string | null
  supported: boolean
  complainant: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  topic: { id: string; statement: string } | null
}

interface ListResponse {
  cases: OmbudsmanCase[]
  hasMore: boolean
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  process_fairness: 'Process Fairness',
  decision_appeal: 'Decision Appeal',
  bias_report: 'Bias Report',
  norm_breach: 'Norm Breach',
  transparency: 'Transparency',
  other: 'Other',
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  process_fairness: { bg: 'bg-for-500/10', text: 'text-for-400', border: 'border-for-500/30' },
  decision_appeal:  { bg: 'bg-purple/10',  text: 'text-purple',  border: 'border-purple/30' },
  bias_report:      { bg: 'bg-against-500/10', text: 'text-against-400', border: 'border-against-500/30' },
  norm_breach:      { bg: 'bg-gold/10',    text: 'text-gold',    border: 'border-gold/30' },
  transparency:     { bg: 'bg-emerald/10', text: 'text-emerald', border: 'border-emerald/30' },
  other:            { bg: 'bg-surface-300/40', text: 'text-surface-500', border: 'border-surface-400/30' },
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string; icon: typeof Shield }> = {
  open:         { bg: 'bg-for-500/10',      text: 'text-for-400',      border: 'border-for-500/30',      label: 'Open',         icon: FileText },
  under_review: { bg: 'bg-purple/10',       text: 'text-purple',       border: 'border-purple/30',       label: 'Under Review', icon: Scale },
  upheld:       { bg: 'bg-emerald/10',      text: 'text-emerald',      border: 'border-emerald/30',      label: 'Upheld',       icon: ShieldCheck },
  dismissed:    { bg: 'bg-against-500/10',  text: 'text-against-400',  border: 'border-against-500/30',  label: 'Dismissed',    icon: X },
  referred:     { bg: 'bg-gold/10',         text: 'text-gold',         border: 'border-gold/30',         label: 'Referred',     icon: ArrowRight },
  withdrawn:    { bg: 'bg-surface-300/40',  text: 'text-surface-500',  border: 'border-surface-400/30',  label: 'Withdrawn',    icon: X },
}

const STATUS_TABS = [
  { id: null, label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'upheld', label: 'Upheld' },
  { id: 'dismissed', label: 'Dismissed' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Case Card ──────────────────────────────────────────────────────────────────

function CaseCard({ cas, onSupport }: { cas: OmbudsmanCase; onSupport: (id: string) => void }) {
  const catStyle = CATEGORY_STYLES[cas.category] ?? CATEGORY_STYLES.other
  const statusCfg = STATUS_STYLES[cas.status] ?? STATUS_STYLES.open
  const StatusIcon = statusCfg.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors p-5 flex flex-col gap-4"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-mono text-[11px] text-surface-500 flex-shrink-0">{cas.case_number}</span>
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border', catStyle.bg, catStyle.text, catStyle.border)}>
            {CATEGORY_LABELS[cas.category] ?? cas.category}
          </span>
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border', statusCfg.bg, statusCfg.text, statusCfg.border)}>
            <StatusIcon className="h-2.5 w-2.5" />
            {statusCfg.label}
          </span>
        </div>
        <span className="text-[11px] text-surface-500 flex-shrink-0">{relTime(cas.created_at)}</span>
      </div>

      {/* Title + topic */}
      <div>
        <Link href={`/civic-ombudsman/${cas.id}`} className="font-semibold text-white hover:text-for-300 transition-colors text-sm leading-snug">
          {cas.title}
        </Link>
        {cas.topic && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Scale className="h-3 w-3 text-surface-500 flex-shrink-0" />
            <Link href={`/topic/${cas.topic.id}`} className="text-[11px] text-surface-500 hover:text-surface-400 truncate transition-colors">
              {cas.topic.statement}
            </Link>
          </div>
        )}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {cas.complainant && (
            <Link href={`/profile/${cas.complainant.username}`} className="flex items-center gap-1.5 group">
              <Avatar src={cas.complainant.avatar_url} fallback={cas.complainant.display_name || cas.complainant.username} size="xs" />
              <span className="text-[11px] text-surface-500 group-hover:text-surface-400 transition-colors">
                @{cas.complainant.username}
              </span>
            </Link>
          )}
        </div>
        <button
          onClick={() => onSupport(cas.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
            cas.supported
              ? 'bg-for-600/20 border-for-600/40 text-for-400'
              : 'bg-surface-200 border-surface-400 text-surface-500 hover:border-surface-300 hover:text-white'
          )}
          aria-label={cas.supported ? 'Withdraw support' : 'Support this case'}
        >
          <ThumbsUp className="h-3 w-3" />
          {cas.support_count}
        </button>
      </div>
    </motion.div>
  )
}

// ─── File Case Form ─────────────────────────────────────────────────────────────

function FileCaseForm({ onClose, onFiled }: { onClose: () => void; onFiled: (c: OmbudsmanCase) => void }) {
  const [category, setCategory] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!category) { setError('Please select a category'); return }
    if (title.trim().length < 10) { setError('Title must be at least 10 characters'); return }
    if (description.trim().length < 50) { setError('Description must be at least 50 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ombudsman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title: title.trim(), description: description.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to file case'); return }
      onFiled(json.case)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/30">
            <FileText className="h-4 w-4 text-against-400" />
          </div>
          <h2 className="font-mono font-bold text-white text-base">File a Case</h2>
        </div>
        <button onClick={onClose} aria-label="Close form" className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Category */}
        <div>
          <label className="block font-mono text-xs text-surface-400 mb-1.5 uppercase tracking-wide">Category</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full bg-surface-200 border border-surface-400 text-white rounded-xl px-3 py-2.5 text-sm font-mono appearance-none focus:outline-none focus:border-for-500 transition-colors"
              aria-label="Case category"
            >
              <option value="" disabled>Select a category…</option>
              {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block font-mono text-xs text-surface-400 mb-1.5 uppercase tracking-wide">
            Title <span className="text-surface-500">(10–200 chars)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            placeholder="Brief summary of your complaint…"
            className="w-full bg-surface-200 border border-surface-400 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-surface-600 focus:outline-none focus:border-for-500 transition-colors"
          />
          <div className="text-right mt-1 font-mono text-[10px] text-surface-600">{title.length}/200</div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-mono text-xs text-surface-400 mb-1.5 uppercase tracking-wide">
            Description <span className="text-surface-500">(50–3000 chars)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={3000}
            required
            rows={6}
            placeholder="Describe the civic process concern in detail. What happened? Why is it a fairness issue? What outcome do you seek?"
            className="w-full bg-surface-200 border border-surface-400 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-surface-600 focus:outline-none focus:border-for-500 transition-colors resize-none"
          />
          <div className="text-right mt-1 font-mono text-[10px] text-surface-600">{description.length}/3000</div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-against-500/10 border border-against-500/30">
            <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0" />
            <span className="text-xs text-against-300">{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors border border-surface-400">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold text-white bg-against-600 hover:bg-against-500 disabled:opacity-50 disabled:pointer-events-none transition-colors border border-against-500/60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            File Case
          </button>
        </div>
      </form>
    </motion.div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function CivicOmbudsmanPage() {
  const [cases, setCases] = useState<OmbudsmanCase[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(async (status: string | null, offset = 0) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(offset) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/ombudsman?${params}`)
      const json: ListResponse = await res.json()
      if (offset === 0) setCases(json.cases)
      else setCases((prev) => [...prev, ...json.cases])
      setHasMore(json.hasMore)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { load(statusFilter) }, [load, statusFilter])

  async function handleSupport(id: string) {
    if (!userId) return
    const res = await fetch(`/api/ombudsman/${id}/support`, { method: 'POST' })
    if (!res.ok) return
    const { supported, support_count } = await res.json()
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, supported, support_count } : c))
  }

  function handleFiled(newCase: OmbudsmanCase) {
    setShowForm(false)
    setCases((prev) => [{ ...newCase, supported: false, complainant: null, topic: null }, ...prev])
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Shield className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Civic Ombudsman</h1>
              <p className="text-xs text-surface-500 mt-0.5">Independent oversight for civic process integrity</p>
            </div>
          </div>
          <Link href="/" aria-label="Back to home" className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors mt-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>

        {/* ── About banner ─────────────────────────────────────────────── */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3.5 mb-6 text-xs text-surface-400 leading-relaxed">
          <span className="font-semibold text-surface-300">What is the Civic Ombudsman?</span> An independent body that reviews formal complaints about civic fairness — how votes are conducted, whether decisions are transparent, and whether community norms are upheld. Findings are non-punitive and publicly visible.
        </div>

        {/* ── File case CTA ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {showForm ? (
            <FileCaseForm key="form" onClose={() => setShowForm(false)} onFiled={handleFiled} />
          ) : (
            <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {userId ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-sm font-semibold text-white bg-against-600/80 hover:bg-against-600 border border-against-500/50 transition-colors mb-6"
                >
                  <Plus className="h-4 w-4" />
                  File a Complaint
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-sm text-surface-500 bg-surface-100 border border-surface-300 mb-6">
                  <Shield className="h-4 w-4" />
                  <Link href="/sign-in" className="text-for-400 hover:text-for-300 transition-colors">Sign in</Link>
                  &nbsp;to file a complaint
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Status filter tabs ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={String(tab.id)}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border transition-all',
                statusFilter === tab.id
                  ? 'bg-against-600/30 border-against-500/50 text-against-300'
                  : 'bg-surface-200 border-surface-400 text-surface-500 hover:text-white hover:border-surface-300'
              )}
            >
              {tab.label}
            </button>
          ))}

          <button
            onClick={() => load(statusFilter)}
            aria-label="Refresh cases"
            className="ml-auto flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 border border-surface-400 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Cases list ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center gap-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-24" /></div>
                <Skeleton className="h-5 w-3/4" />
                <div className="flex items-center justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-7 w-16 rounded-lg" /></div>
              </div>
            ))}
          </div>
        ) : cases.length === 0 ? (
          <EmptyState
            icon={Gavel}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="No cases yet"
            description={statusFilter ? `No ${STATUS_STYLES[statusFilter]?.label.toLowerCase() ?? statusFilter} cases at this time.` : 'No formal complaints have been filed. The Lobby is running clean.'}
            action={userId ? { label: 'File the first case', onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {cases.map((c) => (
                <CaseCard key={c.id} cas={c} onSupport={handleSupport} />
              ))}
            </AnimatePresence>

            {hasMore && (
              <button
                onClick={() => load(statusFilter, cases.length)}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl font-mono text-sm text-surface-400 hover:text-white bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                Load more
              </button>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
