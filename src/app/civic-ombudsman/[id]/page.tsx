'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Send,
  Shield,
  ShieldCheck,
  ThumbsUp,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProfileSnippet {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

interface OmbudsmanCase {
  id: string
  case_number: string
  category: string
  title: string
  description: string
  status: string
  finding: string | null
  support_count: number
  created_at: string
  resolved_at: string | null
  respondent_type: string | null
  complainant: ProfileSnippet | null
  officer: ProfileSnippet | null
  topic: { id: string; statement: string; status: string; blue_pct: number } | null
}

interface Statement {
  id: string
  role: string
  content: string
  created_at: string
  author: ProfileSnippet | null
}

interface CaseResponse {
  case: OmbudsmanCase
  statements: Statement[]
  supported: boolean
  isComplainant: boolean
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

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string; icon: typeof Shield }> = {
  open:         { bg: 'bg-for-500/10',      text: 'text-for-400',      border: 'border-for-500/30',      label: 'Open',         icon: FileText },
  under_review: { bg: 'bg-purple/10',       text: 'text-purple',       border: 'border-purple/30',       label: 'Under Review', icon: Scale },
  upheld:       { bg: 'bg-emerald/10',      text: 'text-emerald',      border: 'border-emerald/30',      label: 'Upheld',       icon: ShieldCheck },
  dismissed:    { bg: 'bg-against-500/10',  text: 'text-against-400',  border: 'border-against-500/30',  label: 'Dismissed',    icon: X },
  referred:     { bg: 'bg-gold/10',         text: 'text-gold',         border: 'border-gold/30',         label: 'Referred',     icon: ArrowRight },
  withdrawn:    { bg: 'bg-surface-300/40',  text: 'text-surface-500',  border: 'border-surface-400/30',  label: 'Withdrawn',    icon: X },
}

const ROLE_STYLES: Record<string, { label: string; color: string }> = {
  complainant: { label: 'Complainant', color: 'text-against-400' },
  officer:     { label: 'Officer',     color: 'text-gold' },
  observer:    { label: 'Observer',    color: 'text-surface-500' },
}

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

// ─── Statement bubble ───────────────────────────────────────────────────────────

function StatementBubble({ stmt }: { stmt: Statement }) {
  const role = ROLE_STYLES[stmt.role] ?? ROLE_STYLES.observer
  return (
    <div className="flex gap-3">
      {stmt.author && (
        <Link href={`/profile/${stmt.author.username}`} className="flex-shrink-0 mt-0.5">
          <Avatar src={stmt.author.avatar_url} fallback={stmt.author.display_name || stmt.author.username} size="sm" />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {stmt.author && (
            <Link href={`/profile/${stmt.author.username}`} className="font-semibold text-xs text-white hover:text-for-300 transition-colors">
              {stmt.author.display_name || stmt.author.username}
            </Link>
          )}
          <span className={cn('font-mono text-[10px] font-medium', role.color)}>{role.label}</span>
          <span className="text-[10px] text-surface-500">{relTime(stmt.created_at)}</span>
        </div>
        <div className="rounded-xl bg-surface-200 border border-surface-300 px-3.5 py-2.5 text-sm text-surface-300 leading-relaxed">
          {stmt.content}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function OmbudsmanCasePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<CaseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [supported, setSupported] = useState(false)
  const [supporting, setSupporting] = useState(false)
  const [stmtText, setStmtText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stmtError, setStmtError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ombudsman/${id}`)
      if (res.status === 404) { router.replace('/civic-ombudsman'); return }
      const json: CaseResponse = await res.json()
      setData(json)
      setSupported(json.supported)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function toggleSupport() {
    if (!userId || !data) return
    setSupporting(true)
    try {
      const res = await fetch(`/api/ombudsman/${id}/support`, { method: 'POST' })
      if (!res.ok) return
      const { supported: newVal, support_count } = await res.json()
      setSupported(newVal)
      setData((prev) => prev ? { ...prev, case: { ...prev.case, support_count } } : prev)
    } finally {
      setSupporting(false)
    }
  }

  async function submitStatement(e: React.FormEvent) {
    e.preventDefault()
    setStmtError(null)
    if (stmtText.trim().length < 10) { setStmtError('Statement must be at least 10 characters'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ombudsman/${id}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: stmtText.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setStmtError(json.error ?? 'Failed to submit'); return }
      setData((prev) => prev ? { ...prev, statements: [...prev.statements, json.statement] } : prev)
      setStmtText('')
    } catch {
      setStmtError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12 space-y-4">
          <Skeleton className="h-8 w-40" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
            <div className="flex gap-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /></div>
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) return null

  const { case: cas, statements } = data
  const statusCfg = STATUS_STYLES[cas.status] ?? STATUS_STYLES.open
  const StatusIcon = statusCfg.icon
  const isResolved = ['upheld', 'dismissed', 'referred', 'withdrawn'].includes(cas.status)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12 space-y-5">

        {/* ── Back ─────────────────────────────────────────────────────── */}
        <Link
          href="/civic-ombudsman"
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Civic Ombudsman
        </Link>

        {/* ── Case card ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/30 flex-shrink-0">
                <Shield className="h-4 w-4 text-against-400" />
              </div>
              <span className="font-mono text-xs text-surface-500">{cas.case_number}</span>
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border', statusCfg.bg, statusCfg.text, statusCfg.border)}>
                <StatusIcon className="h-2.5 w-2.5" />
                {statusCfg.label}
              </span>
              <span className="text-[11px] text-surface-500 font-mono">{CATEGORY_LABELS[cas.category] ?? cas.category}</span>
            </div>
            <button
              onClick={toggleSupport}
              disabled={!userId || supporting}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all flex-shrink-0',
                supported
                  ? 'bg-for-600/20 border-for-600/40 text-for-400'
                  : 'bg-surface-200 border-surface-400 text-surface-500 hover:border-surface-300 hover:text-white',
                (!userId || supporting) && 'opacity-50 pointer-events-none'
              )}
              aria-label={supported ? 'Withdraw support' : 'Support this case'}
            >
              {supporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
              {cas.support_count} support{cas.support_count === 1 ? '' : 's'}
            </button>
          </div>

          {/* Title */}
          <h1 className="font-semibold text-white text-lg leading-snug">{cas.title}</h1>

          {/* Description */}
          <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">{cas.description}</p>

          {/* Topic link */}
          {cas.topic && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
              <Scale className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              <span className="text-[11px] text-surface-500 font-mono mr-1">Topic:</span>
              <Link href={`/topic/${cas.topic.id}`} className="text-xs text-for-400 hover:text-for-300 transition-colors truncate flex-1">
                {cas.topic.statement}
              </Link>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-surface-300">
            <div className="flex items-center gap-3">
              {cas.complainant && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 font-mono">Filed by</span>
                  <Link href={`/profile/${cas.complainant.username}`} className="flex items-center gap-1.5 group">
                    <Avatar src={cas.complainant.avatar_url} fallback={cas.complainant.display_name || cas.complainant.username} size="xs" />
                    <span className="text-xs text-surface-400 group-hover:text-white transition-colors">@{cas.complainant.username}</span>
                  </Link>
                </div>
              )}
              {cas.officer && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gold font-mono">Officer</span>
                  <Link href={`/profile/${cas.officer.username}`} className="text-xs text-gold hover:text-yellow-300 transition-colors">
                    @{cas.officer.username}
                  </Link>
                </div>
              )}
            </div>
            <span className="text-[11px] text-surface-500">{relTime(cas.created_at)}</span>
          </div>
        </div>

        {/* ── Officer finding ───────────────────────────────────────────── */}
        {cas.finding && (
          <div className={cn('rounded-xl border px-5 py-4 space-y-2', statusCfg.bg, statusCfg.border)}>
            <div className="flex items-center gap-2">
              <Gavel className={cn('h-4 w-4', statusCfg.text)} />
              <span className={cn('font-mono text-xs font-bold uppercase tracking-wide', statusCfg.text)}>
                Officer Finding — {statusCfg.label}
              </span>
            </div>
            <p className="text-sm text-surface-300 leading-relaxed">{cas.finding}</p>
            {cas.resolved_at && (
              <p className="text-[11px] text-surface-500">Resolved {relTime(cas.resolved_at)}</p>
            )}
          </div>
        )}

        {/* ── Statements ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-surface-500" />
              Public Record
              <span className="text-surface-500 font-normal">({statements.length})</span>
            </h2>
            <button onClick={load} aria-label="Refresh" className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {statements.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              iconColor="text-surface-500"
              title="No statements yet"
              description="Be the first to add a public statement to this case."
              size="sm"
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {statements.map((stmt) => (
                  <motion.div key={stmt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <StatementBubble stmt={stmt} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Add statement form */}
          {userId && !isResolved && (
            <form onSubmit={submitStatement} className="flex gap-3 mt-4 items-start">
              <textarea
                ref={textareaRef}
                value={stmtText}
                onChange={(e) => setStmtText(e.target.value)}
                maxLength={1000}
                placeholder="Add a public statement (10–1000 chars)…"
                rows={3}
                className="flex-1 bg-surface-200 border border-surface-400 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-surface-600 focus:outline-none focus:border-for-500 transition-colors resize-none"
              />
              <button
                type="submit"
                disabled={submitting || stmtText.trim().length < 10}
                className="flex-shrink-0 p-2.5 rounded-xl bg-for-600/80 hover:bg-for-600 border border-for-500/50 text-white disabled:opacity-50 disabled:pointer-events-none transition-colors mt-0.5"
                aria-label="Submit statement"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          )}

          {stmtError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-against-500/10 border border-against-500/30">
              <AlertTriangle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
              <span className="text-xs text-against-300">{stmtError}</span>
            </div>
          )}

          {isResolved && (
            <p className="text-center text-xs text-surface-500 py-2">This case is closed — no further statements accepted.</p>
          )}
          {!userId && (
            <p className="text-center text-xs text-surface-500 py-2">
              <Link href="/sign-in" className="text-for-400 hover:text-for-300">Sign in</Link> to add a statement
            </p>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
