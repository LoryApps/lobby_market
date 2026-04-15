'use client'

/**
 * CoalitionStanceDeclare
 *
 * Shown on the coalition detail page to leaders and officers.
 * Lists the coalition's existing stances and lets them declare new ones
 * on active/voting topics.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  PlusCircle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stance = 'for' | 'against' | 'neutral'

interface ActiveTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface ExistingStance {
  id: string
  topic_id: string
  stance: Stance
  statement: string | null
  created_at: string
  updated_at: string
  topic?: ActiveTopic | null
}

// ─── Stance option button ─────────────────────────────────────────────────────

const STANCE_OPTIONS: {
  id: Stance
  label: string
  icon: typeof ThumbsUp
  activeClasses: string
  idleClasses: string
}[] = [
  {
    id: 'for',
    label: 'FOR',
    icon: ThumbsUp,
    activeClasses: 'bg-for-500/20 border-for-500/60 text-for-300',
    idleClasses: 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/40 hover:text-for-400',
  },
  {
    id: 'against',
    label: 'AGAINST',
    icon: ThumbsDown,
    activeClasses: 'bg-against-500/20 border-against-500/60 text-against-300',
    idleClasses: 'bg-surface-200 border-surface-300 text-surface-500 hover:border-against-500/40 hover:text-against-400',
  },
  {
    id: 'neutral',
    label: 'NEUTRAL',
    icon: Minus,
    activeClasses: 'bg-surface-300/60 border-surface-400 text-surface-600',
    idleClasses: 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400',
  },
]

function stanceBadge(stance: Stance) {
  switch (stance) {
    case 'for':
      return 'bg-for-500/10 border-for-500/30 text-for-300'
    case 'against':
      return 'bg-against-500/10 border-against-500/30 text-against-300'
    default:
      return 'bg-surface-200/60 border-surface-300 text-surface-500'
  }
}

// ─── Declare form ──────────────────────────────────────────────────────────────

function DeclareForm({
  coalitionId,
  onDeclared,
}: {
  coalitionId: string
  onDeclared: (stance: ExistingStance) => void
}) {
  const [topics, setTopics] = useState<ActiveTopic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [selectedTopic, setSelectedTopic] = useState<ActiveTopic | null>(null)
  const [selectedStance, setSelectedStance] = useState<Stance | null>(null)
  const [statementText, setStatementText] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch active and voting topics (two requests, then merge)
    Promise.all([
      fetch('/api/feed?status=active&limit=30&sort=top').then((r) =>
        r.ok ? r.json() : { topics: [] }
      ),
      fetch('/api/feed?status=voting&limit=30&sort=top').then((r) =>
        r.ok ? r.json() : { topics: [] }
      ),
    ])
      .then(([activeData, votingData]) => {
        // Feed route returns array directly (not { topics: [...] })
        const combined: ActiveTopic[] = [
          ...((Array.isArray(activeData) ? activeData : activeData?.topics ?? []) as ActiveTopic[]),
          ...((Array.isArray(votingData) ? votingData : votingData?.topics ?? []) as ActiveTopic[]),
        ]
        // De-dupe by id
        const seen = new Set<string>()
        setTopics(
          combined.filter((t) => {
            if (seen.has(t.id)) return false
            seen.add(t.id)
            return true
          })
        )
      })
      .catch(() => {})
      .finally(() => setTopicsLoading(false))
  }, [])

  async function handleSubmit() {
    if (!selectedTopic || !selectedStance) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/stance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          stance: selectedStance,
          statement: statementText.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null
        setError(d?.error ?? 'Failed to declare stance.')
        return
      }
      const { stance } = (await res.json()) as { stance: ExistingStance }
      onDeclared({ ...stance, topic: selectedTopic })
      setOpen(false)
      setSelectedTopic(null)
      setSelectedStance(null)
      setStatementText('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl',
          'border border-dashed border-surface-300 bg-surface-100',
          'text-surface-500 hover:text-white hover:border-surface-400 hover:bg-surface-200/50',
          'transition-colors text-xs font-mono'
        )}
      >
        <PlusCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        Declare official stance on a topic
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300 bg-surface-200/40">
        <span className="text-xs font-mono font-semibold text-white">Declare Official Stance</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-surface-500 hover:text-white transition-colors"
          aria-label="Close form"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Topic picker */}
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-1.5">
            Topic
          </label>
          {topicsLoading ? (
            <div className="h-9 rounded-lg bg-surface-200/50 animate-pulse" />
          ) : (
            <select
              value={selectedTopic?.id ?? ''}
              onChange={(e) => {
                const t = topics.find((x) => x.id === e.target.value) ?? null
                setSelectedTopic(t)
              }}
              className={cn(
                'w-full h-9 px-3 rounded-lg border bg-surface-50 text-sm font-mono',
                'text-white focus:outline-none focus:ring-1 focus:ring-for-500/40',
                'border-surface-300 focus:border-for-500/50 transition-colors'
              )}
            >
              <option value="">Select an active topic…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.statement.slice(0, 80)}{t.statement.length > 80 ? '…' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stance selector */}
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-1.5">
            Our official stance
          </label>
          <div className="flex items-center gap-2">
            {STANCE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = selectedStance === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedStance(opt.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono font-semibold transition-colors',
                    isActive ? opt.activeClasses : opt.idleClasses
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Optional statement */}
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-1.5">
            Statement{' '}
            <span className="normal-case tracking-normal text-surface-400">(optional)</span>
          </label>
          <textarea
            value={statementText}
            onChange={(e) => setStatementText(e.target.value)}
            placeholder="Explain why the coalition supports or opposes this topic…"
            maxLength={500}
            rows={3}
            className={cn(
              'w-full px-3 py-2 rounded-lg border border-surface-300 bg-surface-50',
              'text-sm text-white placeholder:text-surface-400 font-mono leading-relaxed',
              'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20',
              'resize-y transition-colors'
            )}
          />
          <div className="flex justify-end mt-1">
            <span className="text-[10px] font-mono text-surface-500">
              {statementText.length}/500
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs font-mono text-against-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="for"
            size="sm"
            disabled={!selectedTopic || !selectedStance || saving}
            onClick={handleSubmit}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {saving ? 'Declaring…' : 'Declare Stance'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Existing stance row ───────────────────────────────────────────────────────

function ExistingStanceRow({
  stance,
  coalitionId,
  onDelete,
}: {
  stance: ExistingStance
  coalitionId: string
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Remove this stance?')) return
    setDeleting(true)
    try {
      await fetch(`/api/coalitions/${coalitionId}/stance?topic_id=${stance.topic_id}`, {
        method: 'DELETE',
      })
      onDelete(stance.id)
      router.refresh()
    } catch {
      // best-effort
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-surface-300 bg-surface-100">
      <div className="flex-1 min-w-0">
        <Link
          href={`/topic/${stance.topic_id}`}
          className="text-xs font-mono text-white hover:text-for-300 transition-colors line-clamp-2"
        >
          {stance.topic?.statement ?? 'Unknown topic'}
        </Link>
        {stance.statement && (
          <p className="mt-1 text-[11px] font-mono text-surface-500 italic line-clamp-2">
            &ldquo;{stance.statement}&rdquo;
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={cn(
            'text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border',
            stanceBadge(stance.stance)
          )}
        >
          {stance.stance}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Remove stance"
          className="text-surface-500 hover:text-against-400 transition-colors disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CoalitionStanceDeclareProps {
  coalitionId: string
  isLeaderOrOfficer: boolean
}

export function CoalitionStanceDeclare({
  coalitionId,
  isLeaderOrOfficer,
}: CoalitionStanceDeclareProps) {
  const [stances, setStances] = useState<ExistingStance[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    // Fetch all stances for this coalition across all topics
    fetch(`/api/coalitions/${coalitionId}/stances`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stances) setStances(d.stances as ExistingStance[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [coalitionId])

  function handleDeclared(s: ExistingStance) {
    setStances((prev) => {
      // Replace if same topic exists, else prepend
      const idx = prev.findIndex((x) => x.topic_id === s.topic_id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = s
        return next
      }
      return [s, ...prev]
    })
  }

  function handleDelete(id: string) {
    setStances((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <section
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
      aria-label="Coalition official stances"
    >
      {/* Section header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-200/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-for-400" aria-hidden="true" />
          <span className="text-sm font-mono font-semibold text-white">
            Official Stances
          </span>
          {stances.length > 0 && (
            <span className="text-[11px] font-mono text-surface-500">
              · {stances.length} declared
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-surface-300 pt-4">
              {/* Description */}
              <p className="text-[11px] font-mono text-surface-500">
                Coalitions can declare official positions on active topics. These stances
                are publicly visible on the topic page.
              </p>

              {/* Existing stances */}
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-surface-200/50 animate-pulse" />
                  ))}
                </div>
              ) : stances.length === 0 ? (
                <p className="text-xs font-mono text-surface-500 italic">
                  No official stances declared yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {stances.map((s) => (
                    <ExistingStanceRow
                      key={s.id}
                      stance={s}
                      coalitionId={coalitionId}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}

              {/* Declare form — leaders/officers only */}
              {isLeaderOrOfficer && (
                <DeclareForm
                  coalitionId={coalitionId}
                  onDeclared={handleDeclared}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
