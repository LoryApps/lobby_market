'use client'

/**
 * /pledges — Civic Pledge Wall
 *
 * A public wall of personal civic commitments. Users pledge to take specific
 * civic actions; the community can "witness" each pledge to provide social
 * accountability. Completing pledges earns recognition.
 *
 * Features:
 *  - Browse public pledges filtered by category / sort
 *  - Witness / un-witness pledges (social accountability)
 *  - Make a new pledge via a bottom-sheet form
 *  - Track your own pledges with progress updates
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  HandHeart,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Scroll,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { Pledge, PledgesResponse } from '@/app/api/pledges/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type Category = 'all' | 'participation' | 'advocacy' | 'debate' | 'research' | 'community' | 'accountability'
type Sort = 'witnesses' | 'newest' | 'deadline' | 'progress'
type StatusFilter = 'active' | 'completed'

const CATEGORIES: { id: Category; label: string; icon: typeof Vote; color: string; bg: string; border: string }[] = [
  { id: 'all',            label: 'All',            icon: Scroll,        color: 'text-white',       bg: 'bg-surface-300',        border: 'border-surface-400' },
  { id: 'participation',  label: 'Participation',  icon: Vote,          color: 'text-for-300',     bg: 'bg-for-500/15',         border: 'border-for-500/40' },
  { id: 'advocacy',       label: 'Advocacy',       icon: Mic,           color: 'text-gold',        bg: 'bg-gold/15',            border: 'border-gold/40' },
  { id: 'debate',         label: 'Debate',         icon: MessageSquare, color: 'text-against-300', bg: 'bg-against-500/15',     border: 'border-against-500/40' },
  { id: 'research',       label: 'Research',       icon: BookOpen,      color: 'text-purple',      bg: 'bg-purple/15',          border: 'border-purple/40' },
  { id: 'community',      label: 'Community',      icon: Users,         color: 'text-emerald',     bg: 'bg-emerald/15',         border: 'border-emerald/40' },
  { id: 'accountability', label: 'Accountability', icon: Award,         color: 'text-for-400',     bg: 'bg-for-500/10',         border: 'border-for-500/30' },
]

const SORTS: { id: Sort; label: string }[] = [
  { id: 'witnesses', label: 'Most Witnessed' },
  { id: 'newest',    label: 'Newest' },
  { id: 'deadline',  label: 'Deadline Soon' },
  { id: 'progress',  label: 'Most Progress' },
]

const CATEGORY_ICON: Record<string, typeof Vote> = {
  participation:  Vote,
  advocacy:       Mic,
  debate:         MessageSquare,
  research:       BookOpen,
  community:      Users,
  accountability: Award,
}

const CATEGORY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  participation:  { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  advocacy:       { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  debate:         { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  research:       { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  community:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  accountability: { text: 'text-for-400',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
}

const PLEDGE_EXAMPLES: Record<string, string[]> = {
  participation:  [
    'I pledge to vote on every active topic this week',
    'I pledge to cast at least one vote every day for 30 days',
    'I pledge to vote on 20 topics across 5 different categories',
  ],
  advocacy:       [
    'I pledge to propose 3 new topics in the next month',
    'I pledge to share a topic that I care about with 5 people',
    'I pledge to write a full description for every topic I propose',
  ],
  debate:         [
    'I pledge to add a cited argument on every topic I vote on this week',
    'I pledge to reply to 5 arguments from the opposing side respectfully',
    'I pledge to participate in at least one live debate this month',
  ],
  research:       [
    'I pledge to cite a real source on every argument I post',
    'I pledge to read both top FOR and AGAINST arguments before voting',
    'I pledge to add evidence to 10 topics lacking citations',
  ],
  community:      [
    'I pledge to welcome 3 new members this month',
    'I pledge to witness 10 other civic pledges this week',
    'I pledge to upvote quality arguments across 5 different topics',
  ],
  accountability: [
    'I pledge to check back on topics I voted on and see how they resolved',
    'I pledge to update my pledge progress every day',
    'I pledge to be honest about which arguments changed my mind',
  ],
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function deadlineLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'Expires soon'
  if (h < 24) return `${h}h left`
  if (d < 7) return `${d}d left`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function progressPct(pledge: Pledge): number {
  if (!pledge.target_count || pledge.target_count <= 0) return 0
  return Math.min(100, Math.round((pledge.current_count / pledge.target_count) * 100))
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  color,
  bg,
}: {
  icon: typeof Trophy
  value: number
  label: string
  color: string
  bg: string
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl p-4 border', bg, 'border-surface-300/50')}>
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', bg, 'border-surface-400/30')}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div>
        <p className="text-xl font-mono font-bold text-white leading-none">
          <AnimatedNumber value={value} />
        </p>
        <p className="text-[11px] font-mono text-surface-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Pledge card ──────────────────────────────────────────────────────────────

interface PledgeCardProps {
  pledge: Pledge
  userId: string | null
  onWitnessToggle: (id: string, currentlyWitnessed: boolean) => void
  onProgressUpdate?: (id: string, newCount: number) => void
  onDelete?: (id: string) => void
  isOwn?: boolean
}

function PledgeCard({
  pledge,
  userId,
  onWitnessToggle,
  onProgressUpdate,
  onDelete,
  isOwn = false,
}: PledgeCardProps) {
  const [busy, setBusy] = useState(false)
  const [witnessed, setWitnessed] = useState(pledge.viewer_is_witness)
  const [witnessCount, setWitnessCount] = useState(pledge.witness_count)
  const [showProgress, setShowProgress] = useState(false)
  const [progressInput, setProgressInput] = useState(String(pledge.current_count))

  const catStyle = CATEGORY_STYLE[pledge.category] ?? CATEGORY_STYLE.participation
  const CatIcon = CATEGORY_ICON[pledge.category] ?? Vote
  const pct = progressPct(pledge)
  const isCompleted = pledge.status === 'completed'

  async function handleWitness() {
    if (!userId || busy || isOwn) return
    setBusy(true)
    const was = witnessed
    setWitnessed(!was)
    setWitnessCount((c) => c + (was ? -1 : 1))
    try {
      await fetch(`/api/pledges/${pledge.id}/witness`, {
        method: was ? 'DELETE' : 'POST',
      })
      onWitnessToggle(pledge.id, was)
    } catch {
      setWitnessed(was)
      setWitnessCount((c) => c + (was ? 1 : -1))
    } finally {
      setBusy(false)
    }
  }

  async function handleProgressSave() {
    const next = parseInt(progressInput, 10)
    if (isNaN(next) || next < 0) return
    setBusy(true)
    try {
      await fetch(`/api/pledges/${pledge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_count: next }),
      })
      onProgressUpdate?.(pledge.id, next)
      setShowProgress(false)
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-4 transition-colors',
        isCompleted
          ? 'bg-emerald/5 border-emerald/25'
          : 'bg-surface-100 border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      {/* Author row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {pledge.author ? (
            <Link href={`/profile/${pledge.author.username}`} className="flex-shrink-0">
              <Avatar
                src={pledge.author.avatar_url}
                fallback={pledge.author.display_name || pledge.author.username}
                size="sm"
              />
            </Link>
          ) : (
            <div className="h-8 w-8 rounded-full bg-surface-300 flex-shrink-0" />
          )}
          <div className="min-w-0">
            {pledge.author ? (
              <Link
                href={`/profile/${pledge.author.username}`}
                className="text-xs font-semibold text-white hover:text-for-400 transition-colors truncate block"
              >
                {pledge.author.display_name || pledge.author.username}
              </Link>
            ) : (
              <span className="text-xs font-semibold text-surface-500">Anonymous</span>
            )}
            <p className="text-[10px] font-mono text-surface-600">{relativeTime(pledge.created_at)}</p>
          </div>
        </div>

        {/* Category badge + status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={cn(
              'flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
              catStyle.text, catStyle.bg, catStyle.border
            )}
          >
            <CatIcon className="h-2.5 w-2.5" />
            {pledge.category}
          </span>
          {isCompleted && (
            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/30 text-emerald">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Done
            </span>
          )}
          {pledge.deadline && !isCompleted && (
            <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {deadlineLabel(pledge.deadline)}
            </span>
          )}
        </div>
      </div>

      {/* Pledge title */}
      <div>
        <p className="text-sm font-semibold text-white leading-snug">
          I pledge to {pledge.title}
        </p>
        {pledge.description && (
          <p className="text-xs text-surface-500 mt-1.5 leading-relaxed">{pledge.description}</p>
        )}
      </div>

      {/* Progress bar */}
      {pledge.target_count && pledge.target_count > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-surface-500">
              {pledge.current_count} / {pledge.target_count} completed
            </span>
            <span className="text-[11px] font-mono text-surface-500">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', isCompleted ? 'bg-emerald' : 'bg-for-500')}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Progress update (own pledges only) */}
      {isOwn && pledge.target_count && pledge.status === 'active' && (
        <AnimatePresence>
          {showProgress ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <input
                type="number"
                min={0}
                max={pledge.target_count}
                value={progressInput}
                onChange={(e) => setProgressInput(e.target.value)}
                className="w-24 bg-surface-200 border border-surface-400 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-for-500/50"
                aria-label="Update progress count"
              />
              <button
                onClick={handleProgressSave}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={() => { setShowProgress(false); setProgressInput(String(pledge.current_count)) }}
                className="px-2 py-1.5 rounded-lg bg-surface-300 hover:bg-surface-400 text-surface-500 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="update-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowProgress(true)}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors underline underline-offset-2"
            >
              Update progress
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between pt-1 border-t border-surface-300/40">
        {/* Witness button */}
        <button
          onClick={handleWitness}
          disabled={busy || !userId || isOwn}
          aria-label={witnessed ? 'Remove witness' : 'Witness this pledge'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            witnessed
              ? 'bg-for-600/20 border-for-600/40 text-for-400 hover:bg-for-600/30'
              : 'bg-surface-200 border-surface-400 text-surface-500 hover:bg-surface-300 hover:text-white'
          )}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <HandHeart className={cn('h-3 w-3', witnessed && 'text-for-400')} />
          )}
          <AnimatedNumber value={witnessCount} />
          <span>{witnessCount === 1 ? 'witness' : 'witnesses'}</span>
        </button>

        {/* Own pledge controls */}
        {isOwn && (
          <div className="flex items-center gap-2">
            {pledge.status === 'active' && (
              <button
                onClick={async () => {
                  if (!window.confirm('Mark this pledge as completed?')) return
                  setBusy(true)
                  try {
                    await fetch(`/api/pledges/${pledge.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'completed' }),
                    })
                    window.location.reload()
                  } finally {
                    setBusy(false)
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald/10 border border-emerald/30 text-emerald text-xs font-mono font-semibold hover:bg-emerald/20 transition-colors"
              >
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </button>
            )}
            <button
              onClick={async () => {
                if (!window.confirm('Delete this pledge?')) return
                setBusy(true)
                try {
                  await fetch(`/api/pledges/${pledge.id}`, { method: 'DELETE' })
                  onDelete?.(pledge.id)
                } finally {
                  setBusy(false)
                }
              }}
              className="flex items-center justify-center h-7 w-7 rounded-lg bg-against-500/10 border border-against-500/20 text-against-400 hover:bg-against-500/20 transition-colors"
              aria-label="Delete pledge"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── New Pledge Form ──────────────────────────────────────────────────────────

interface NewPledgeFormProps {
  onCreated: (pledge: Pledge) => void
  onClose: () => void
}

function NewPledgeForm({ onCreated, onClose }: NewPledgeFormProps) {
  const [category, setCategory] = useState<string>('participation')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetCount, setTargetCount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const examples = PLEDGE_EXAMPLES[category] ?? []
  const remaining = 200 - title.length

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Please write your pledge.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/pledges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          target_count: targetCount ? parseInt(targetCount, 10) : null,
          deadline: deadline || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      onCreated(data.pledge as Pledge)
      onClose()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-2">

      {/* Category picker */}
      <div>
        <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
            const CatIcon = cat.icon
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                  category === cat.id
                    ? cn(cat.color, cat.bg, cat.border)
                    : 'text-surface-500 bg-surface-200 border-surface-300 hover:border-surface-400 hover:text-white'
                )}
              >
                <CatIcon className="h-3 w-3" />
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Examples */}
      {examples.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">
            Examples — click to fill
          </p>
          <div className="space-y-1">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setTitle(ex.replace(/^I pledge to /i, ''))}
                className="w-full text-left text-xs text-surface-500 hover:text-white transition-colors px-2 py-1 rounded bg-surface-200/50 hover:bg-surface-200"
              >
                <span className="text-surface-600">I pledge to</span> {ex.replace(/^I pledge to /i, '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pledge text */}
      <div>
        <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
          Your pledge
        </label>
        <div className="flex items-start gap-2 rounded-xl bg-surface-200 border border-surface-400/60 px-3 py-2.5 focus-within:border-for-500/50">
          <span className="text-xs font-mono text-surface-500 pt-0.5 flex-shrink-0">I pledge to</span>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="vote on every active topic this week…"
            maxLength={200}
            rows={2}
            className="flex-1 bg-transparent text-sm text-white placeholder-surface-600 resize-none focus:outline-none"
            aria-label="Pledge text"
          />
        </div>
        <p className={cn('text-right text-[10px] font-mono mt-1', remaining < 20 ? 'text-against-400' : 'text-surface-600')}>
          {remaining} chars left
        </p>
      </div>

      {/* Optional description */}
      <div>
        <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
          Details <span className="text-surface-600 font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why does this pledge matter to you? What will completing it look like?"
          maxLength={1000}
          rows={3}
          className="w-full bg-surface-200 border border-surface-400/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-surface-600 resize-none focus:outline-none focus:border-for-500/50"
          aria-label="Pledge description"
        />
      </div>

      {/* Target + deadline row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
            Target count <span className="text-surface-600 font-normal normal-case">(opt.)</span>
          </label>
          <input
            type="number"
            min={1}
            value={targetCount}
            onChange={(e) => setTargetCount(e.target.value)}
            placeholder="e.g. 10"
            className="w-full bg-surface-200 border border-surface-400/60 rounded-xl px-3 py-2 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/50 font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
            Deadline <span className="text-surface-600 font-normal normal-case">(opt.)</span>
          </label>
          <input
            type="date"
            value={deadline}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-surface-200 border border-surface-400/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-for-500/50 font-mono"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-against-400 font-mono bg-against-500/10 border border-against-500/30 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !title.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
          'bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-bold',
          'transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scroll className="h-4 w-4" />}
        {saving ? 'Publishing…' : 'Publish Pledge'}
      </button>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PledgesClient() {
  const router = useRouter()
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [myPledges, setMyPledges] = useState<Pledge[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMine, setLoadingMine] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total_active: 0, total_completed: 0, total_witnesses: 0 })
  const [category, setCategory] = useState<Category>('all')
  const [sort, setSort] = useState<Sort>('witnesses')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showMyPledges, setShowMyPledges] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  // Get current user ID (client-only)
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => {
        setUserId(data.user?.id ?? null)
      })
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        sort,
        status: statusFilter,
        limit: '30',
      })
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/pledges?${params}`)
      if (!res.ok) throw new Error('Failed to load pledges')
      const data: PledgesResponse = await res.json()
      setPledges(data.pledges)
      setTotal(data.total)
      setStats(data.stats)
    } catch {
      setError('Unable to load pledges. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [category, sort, statusFilter])

  const loadMine = useCallback(async () => {
    if (!userId) return
    setLoadingMine(true)
    try {
      const res = await fetch('/api/pledges/mine')
      if (res.ok) {
        const data = await res.json()
        setMyPledges(data.pledges ?? [])
      }
    } catch {
      // best-effort
    } finally {
      setLoadingMine(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (showMyPledges && userId) loadMine()
  }, [showMyPledges, userId, loadMine])

  // Close sort menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handlePledgeCreated(pledge: Pledge) {
    setPledges((prev) => [pledge, ...prev])
    setStats((s) => ({ ...s, total_active: s.total_active + 1 }))
    setTotal((t) => t + 1)
    setMyPledges((prev) => [pledge, ...prev])
  }

  function handleWitnessToggle(id: string, wasWitnessed: boolean) {
    setPledges((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, witness_count: p.witness_count + (wasWitnessed ? -1 : 1) }
          : p
      )
    )
  }

  function handleProgressUpdate(id: string, newCount: number) {
    const update = (arr: Pledge[]) =>
      arr.map((p) =>
        p.id === id ? { ...p, current_count: newCount } : p
      )
    setPledges(update)
    setMyPledges(update)
  }

  function handleDelete(id: string) {
    setPledges((prev) => prev.filter((p) => p.id !== id))
    setMyPledges((prev) => prev.filter((p) => p.id !== id))
    setTotal((t) => Math.max(0, t - 1))
  }

  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? 'Sort'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:bg-surface-300/60 transition-colors flex-shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </button>
            <div>
              <h1 className="font-mono text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <HandHeart className="h-6 w-6 text-for-400" />
                Civic Pledge Wall
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Public commitments · Community accountability
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:bg-surface-300/60 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
            </button>
            {userId && (
              <button
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Make a Pledge</span>
                <span className="sm:hidden">Pledge</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={Flame}
            value={stats.total_active}
            label="Active Pledges"
            color="text-for-400"
            bg="bg-for-500/5"
          />
          <StatCard
            icon={Trophy}
            value={stats.total_completed}
            label="Completed"
            color="text-emerald"
            bg="bg-emerald/5"
          />
          <StatCard
            icon={HandHeart}
            value={stats.total_witnesses}
            label="Witnesses"
            color="text-gold"
            bg="bg-gold/5"
          />
        </div>

        {/* ── My pledges toggle ───────────────────────────────────────── */}
        {userId && (
          <button
            onClick={() => setShowMyPledges((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
          >
            <span className="text-sm font-mono font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-for-400" />
              My Pledges
              {myPledges.length > 0 && (
                <span className="text-[10px] font-mono bg-for-600/20 text-for-400 border border-for-600/30 px-2 py-0.5 rounded-full">
                  {myPledges.length}
                </span>
              )}
            </span>
            {showMyPledges ? (
              <ChevronDown className="h-4 w-4 text-surface-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-surface-500" />
            )}
          </button>
        )}

        {/* My pledges list */}
        <AnimatePresence>
          {showMyPledges && userId && (
            <motion.div
              key="my-pledges"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              {loadingMine ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                </div>
              ) : myPledges.length === 0 ? (
                <div className="rounded-2xl bg-surface-100 border border-surface-300/40 px-5 py-6 text-center space-y-2">
                  <Scroll className="h-8 w-8 text-surface-600 mx-auto" />
                  <p className="text-sm font-mono text-surface-500">No pledges yet — make your first commitment.</p>
                  <button
                    onClick={() => setFormOpen(true)}
                    className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors underline underline-offset-2"
                  >
                    Make a pledge
                  </button>
                </div>
              ) : (
                myPledges.map((pledge) => (
                  <PledgeCard
                    key={pledge.id}
                    pledge={{ ...pledge, viewer_is_witness: false }}
                    userId={userId}
                    onWitnessToggle={handleWitnessToggle}
                    onProgressUpdate={handleProgressUpdate}
                    onDelete={handleDelete}
                    isOwn
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Status tabs */}
          <div className="flex gap-2">
            {(['active', 'completed'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                  statusFilter === s
                    ? s === 'active'
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : 'bg-emerald/10 border-emerald/30 text-emerald'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
                )}
              >
                {s === 'active' ? 'Active' : 'Completed'}
              </button>
            ))}

            {/* Sort dropdown */}
            <div className="ml-auto relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white text-xs font-mono font-semibold transition-all"
              >
                {sortLabel}
                <ChevronDown className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 z-30 min-w-[140px] rounded-xl bg-surface-200 border border-surface-400 shadow-xl overflow-hidden"
                  >
                    {SORTS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setSort(s.id); setShowSortMenu(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                          sort === s.id
                            ? 'text-for-400 bg-for-500/10'
                            : 'text-surface-500 hover:text-white hover:bg-surface-300'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => {
              const CatIcon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    category === cat.id
                      ? cn(cat.color, cat.bg, cat.border)
                      : 'text-surface-500 bg-surface-200 border-surface-300 hover:border-surface-400 hover:text-white'
                  )}
                >
                  <CatIcon className="h-3 w-3" />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Pledge list ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center space-y-3">
            <p className="text-against-400 font-mono text-sm">{error}</p>
            <button onClick={load} className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
              Try again
            </button>
          </div>
        ) : pledges.length === 0 ? (
          <EmptyState
            icon={Scroll}
            title="No pledges yet"
            description={
              statusFilter === 'active'
                ? 'Be the first to make a civic pledge in this category.'
                : 'No completed pledges yet in this category.'
            }
            actions={userId ? [{ label: 'Make a Pledge', onClick: () => setFormOpen(true) }] : undefined}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-mono text-surface-600">
              {total} {statusFilter} pledge{total !== 1 ? 's' : ''}
              {category !== 'all' ? ` in ${category}` : ''}
            </p>
            {pledges.map((pledge) => {
              const isOwn = userId === pledge.user_id
              return (
                <PledgeCard
                  key={pledge.id}
                  pledge={pledge}
                  userId={userId}
                  onWitnessToggle={handleWitnessToggle}
                  onProgressUpdate={handleProgressUpdate}
                  onDelete={handleDelete}
                  isOwn={isOwn}
                />
              )
            })}
          </div>
        )}

        {/* ── CTA for logged-out users ──────────────────────────────── */}
        {!userId && (
          <div className="rounded-2xl border border-for-500/30 bg-for-500/5 p-6 text-center space-y-3">
            <Zap className="h-8 w-8 text-for-400 mx-auto" />
            <p className="text-sm font-mono text-white font-semibold">Join the pledge wall</p>
            <p className="text-xs text-surface-500">
              Sign in to make your own civic pledge and witness others.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-bold transition-colors"
            >
              Sign in
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

      </main>

      {/* ── New pledge sheet ──────────────────────────────────────────── */}
      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title="Make a Civic Pledge" maxHeight="92dvh">
        <NewPledgeForm
          onCreated={handlePledgeCreated}
          onClose={() => setFormOpen(false)}
        />
      </BottomSheet>

      <BottomNav />
    </div>
  )
}
