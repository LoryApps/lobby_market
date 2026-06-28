'use client'

/**
 * /assembly — Citizens' Assembly
 *
 * A sortition-based deliberative body. Randomly selected citizens study
 * a contested topic, deliberate across multiple rounds, and produce a
 * collective recommendation that carries special weight in platform consensus.
 *
 * Distinct from:
 *   /debate      — adversarial, timed, live events
 *   /relay       — collaborative argument chaining
 *   /tribunal    — argument moderation / punitive
 *   /polls       — simple binary opinion gathering
 *
 * The assembly is deliberative, not adversarial. Members are expected to
 * update their views in light of evidence and other members' arguments.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AssemblyRow, AssembliesResponse } from '@/app/api/assemblies/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_CONFIG = {
  forming: {
    label: 'Forming',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Accepting members via sortition',
  },
  deliberating: {
    label: 'Deliberating',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Assembly in session',
  },
  concluded: {
    label: 'Concluded',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Recommendation delivered',
  },
} as const

const STANCE_CONFIG: Record<string, { label: string; color: string }> = {
  strong_for:      { label: 'Strongly For',    color: 'text-for-400' },
  lean_for:        { label: 'Leaning For',     color: 'text-for-300' },
  divided:         { label: 'Divided',         color: 'text-gold' },
  lean_against:    { label: 'Leaning Against', color: 'text-against-300' },
  strong_against:  { label: 'Strongly Against', color: 'text-against-400' },
}

const REACTION_CONFIG = {
  endorse: { label: 'Endorse', icon: ThumbsUp,    color: 'text-emerald',   bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  question: { label: 'Question', icon: HelpCircle, color: 'text-gold',      bg: 'bg-gold/10',       border: 'border-gold/30' },
  object:   { label: 'Object',   icon: ThumbsDown, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
} as const

// ─── Member Avatars ───────────────────────────────────────────────────────────

function MemberAvatars({
  members,
  totalCount,
  maxShown = 6,
}: {
  members: AssemblyRow['members']
  totalCount: number
  maxShown?: number
}) {
  const shown = members.slice(0, maxShown)
  const overflow = totalCount - shown.length

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div
          key={m.id}
          className="relative"
          style={{ marginLeft: i > 0 ? '-8px' : '0', zIndex: shown.length - i }}
        >
          <Link href={`/profile/${m.profile?.username ?? ''}`} onClick={(e) => e.stopPropagation()}>
            <Avatar
              src={m.profile?.avatar_url ?? null}
              fallback={m.profile?.display_name || m.profile?.username || '?'}
              size="xs"
              className={cn(
                'border-2 border-surface-100',
                m.is_chair && 'ring-1 ring-gold'
              )}
            />
          </Link>
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative w-6 h-6 rounded-full bg-surface-300 border-2 border-surface-100 flex items-center justify-center text-[9px] font-mono text-surface-500"
          style={{ marginLeft: '-8px' }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

// ─── Assembly Card ────────────────────────────────────────────────────────────

function AssemblyCard({
  assembly,
  onJoin,
  onReact,
  expanded,
  onToggle,
}: {
  assembly: AssemblyRow
  onJoin: (id: string) => void
  onReact: (id: string, reaction: 'endorse' | 'question' | 'object') => void
  expanded: boolean
  onToggle: () => void
}) {
  const statusCfg = STATUS_CONFIG[assembly.status]
  const stanceCfg = assembly.stance ? STANCE_CONFIG[assembly.stance] : null
  const memberFill = assembly.member_count / assembly.max_members
  const canJoin = assembly.status === 'forming' && !assembly.user_is_member

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-surface-200/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple/10 border border-purple/20 flex-shrink-0 mt-0.5">
            <Gavel className="h-4 w-4 text-purple" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Status + topic category */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                statusCfg.color, statusCfg.bg, statusCfg.border
              )}>
                {statusCfg.label}
              </span>
              {assembly.topic_category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface-300 text-surface-500 border border-surface-400/30">
                  {assembly.topic_category}
                </span>
              )}
              {assembly.user_is_member && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple/10 text-purple border border-purple/30">
                  Member
                </span>
              )}
            </div>

            <h3 className="text-sm font-semibold text-white leading-snug mb-1">
              {assembly.title}
            </h3>

            <p className="text-xs text-surface-600 line-clamp-2 leading-relaxed">
              {assembly.question}
            </p>

            {assembly.topic_statement && (
              <Link
                href={`/topic/${assembly.topic_id}`}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-for-400 hover:text-for-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{assembly.topic_statement}</span>
              </Link>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className="text-xs text-surface-600 font-mono whitespace-nowrap">
              {relativeTime(assembly.convened_at)}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-surface-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-surface-500" />
            )}
          </div>
        </div>

        {/* Member progress bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                assembly.status === 'concluded' ? 'bg-emerald' :
                assembly.status === 'deliberating' ? 'bg-for-500' : 'bg-gold'
              )}
              style={{ width: `${Math.min(memberFill * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <MemberAvatars
              members={assembly.members}
              totalCount={assembly.member_count}
              maxShown={5}
            />
            <span className="text-[11px] font-mono text-surface-600">
              {assembly.member_count}/{assembly.max_members}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 border-t border-surface-300 space-y-4">
              {/* How this assembly works */}
              <div className="p-3 rounded-xl bg-surface-200 border border-surface-300">
                <p className="text-xs text-surface-600 leading-relaxed">
                  <span className="text-purple font-semibold">Deliberation process: </span>
                  {assembly.deliberation_rounds} rounds of structured discussion. Members are
                  expected to engage with opposing views and update their position based on
                  evidence. The assembly concludes with a collective recommendation.
                </p>
              </div>

              {/* Concluded: show recommendation */}
              {assembly.status === 'concluded' && assembly.recommendation && (
                <div className="p-4 rounded-xl bg-emerald/5 border border-emerald/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald" />
                    <span className="text-xs font-mono font-semibold text-emerald">
                      Assembly Recommendation
                    </span>
                    {stanceCfg && (
                      <span className={cn('text-xs font-mono font-bold ml-auto', stanceCfg.color)}>
                        {stanceCfg.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-700 leading-relaxed">
                    &ldquo;{assembly.recommendation}&rdquo;
                  </p>
                  {(assembly.recommendation_votes_for + assembly.recommendation_votes_against) > 0 && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-surface-600">
                      <ThumbsUp className="h-3 w-3 text-emerald" />
                      <span>{assembly.recommendation_votes_for}</span>
                      <ThumbsDown className="h-3 w-3 text-against-400 ml-2" />
                      <span>{assembly.recommendation_votes_against}</span>
                      <span className="ml-1">community endorsements</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                {canJoin && (
                  <Button
                    size="sm"
                    variant="for"
                    onClick={() => onJoin(assembly.id)}
                    className="flex items-center gap-1.5"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Join Assembly
                  </Button>
                )}

                {/* Observer reactions (for non-members or concluded) */}
                {!assembly.user_is_member && assembly.status !== 'forming' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-surface-600 mr-1">Observer:</span>
                    {(Object.entries(REACTION_CONFIG) as [keyof typeof REACTION_CONFIG, typeof REACTION_CONFIG[keyof typeof REACTION_CONFIG]][]).map(([key, cfg]) => {
                      const Icon = cfg.icon
                      const isActive = assembly.user_reaction === key
                      return (
                        <button
                          key={key}
                          onClick={() => onReact(assembly.id, key)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-all border',
                            isActive
                              ? `${cfg.color} ${cfg.bg} ${cfg.border} opacity-100`
                              : 'text-surface-500 bg-surface-200 border-surface-300 hover:border-surface-400'
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                <Link
                  href={`/assembly/${assembly.id}`}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  View deliberations
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── New Assembly Modal ───────────────────────────────────────────────────────

interface NewAssemblyModalProps {
  onClose: () => void
  onCreated: () => void
}

function NewAssemblyModal({ onClose, onCreated }: NewAssemblyModalProps) {
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<Array<{ id: string; statement: string; category: string | null }>>([])
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; statement: string } | null>(null)
  const [maxMembers, setMaxMembers] = useState(12)
  const [submitting, setSubmitting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const searchTopics = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setTopicResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics&limit=5`)
      if (!res.ok) return
      const data = (await res.json()) as { topics?: Array<{ id: string; statement: string; category: string | null }> }
      setTopicResults(data.topics ?? [])
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }, [])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchTopics(topicQuery), 300)
    return () => clearTimeout(searchTimer.current)
  }, [topicQuery, searchTopics])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (title.trim().length < 10) { setError('Title must be at least 10 characters'); return }
    if (question.trim().length < 20) { setError('Question must be at least 20 characters'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/assemblies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          question: question.trim(),
          topic_id: selectedTopic?.id ?? null,
          max_members: maxMembers,
        }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Failed to convene assembly')
        return
      }
      onCreated()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-surface-0/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300 sticky top-0 bg-surface-100 z-10">
          <div>
            <h2 className="text-sm font-mono font-bold text-white">Convene a Citizens&apos; Assembly</h2>
            <p className="text-xs text-surface-600 mt-0.5">
              Invite random citizens to deliberate on a contested question
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* What is this about explainer */}
          <div className="p-3 rounded-xl bg-purple/5 border border-purple/20 text-xs text-surface-600 leading-relaxed">
            <span className="text-purple font-semibold">Sortition, not election. </span>
            Members join by lottery — any citizen can volunteer, and from volunteers a random
            selection is made. This mimics real citizens&apos; assemblies and prevents
            coordinated capture.
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-mono text-surface-600 mb-2">
              Assembly title <span className="text-against-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="e.g. Should the voting age be lowered to 16?"
              className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 transition-colors"
            />
            <div className="flex justify-between mt-1">
              {error && title.trim().length < 10 && (
                <span className="text-xs text-against-400">{error}</span>
              )}
              <span className="ml-auto text-xs font-mono text-surface-600">{title.length}/120</span>
            </div>
          </div>

          {/* Central question */}
          <div>
            <label className="block text-xs font-mono text-surface-600 mb-2">
              Central question <span className="text-against-400">*</span>
              <span className="ml-2 text-surface-700">The question the assembly will deliberate on</span>
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 600))}
              rows={3}
              placeholder="State the precise question citizens should deliberate on. Include relevant context, constraints, or considerations they should weigh…"
              className="w-full px-3 py-2.5 rounded-lg bg-surface-200 border border-surface-300 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 transition-colors resize-none"
            />
            <span className="text-xs font-mono text-surface-600 float-right">{question.length}/600</span>
          </div>

          {/* Optional topic link */}
          <div className="relative">
            <label className="block text-xs font-mono text-surface-600 mb-2">
              Linked topic <span className="text-surface-700">(optional)</span>
            </label>
            {selectedTopic ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300">
                <ExternalLink className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                <span className="text-xs text-white flex-1 truncate">{selectedTopic.statement}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="text-surface-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
                  <input
                    type="text"
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    placeholder="Search a topic to link…"
                    className="w-full pl-8 pr-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
                  )}
                </div>
                {topicResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-surface-200 border border-surface-300 rounded-lg shadow-xl overflow-hidden">
                    {topicResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopic({ id: t.id, statement: t.statement })
                          setTopicQuery('')
                          setTopicResults([])
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-surface-300 transition-colors border-b border-surface-300 last:border-0"
                      >
                        <span className="text-surface-600 text-[10px] font-mono mr-1">{t.category}</span>
                        {t.statement}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Member count */}
          <div>
            <label className="block text-xs font-mono text-surface-600 mb-2">
              Assembly size
            </label>
            <div className="flex gap-2">
              {[6, 9, 12, 15, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxMembers(n)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-mono transition-all border',
                    maxMembers === n
                      ? 'bg-purple/20 text-purple border-purple/40'
                      : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-surface-600 mt-1">
              Citizens will be randomly selected to fill {maxMembers} seats
            </p>
          </div>

          {error && !['Title', 'Question'].some((k) => error.startsWith(k)) && (
            <div className="flex items-center gap-2 text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg p-3">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || title.trim().length < 10 || question.trim().length < 20}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Gavel className="h-4 w-4" />
                Convene Assembly
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── How It Works Banner ──────────────────────────────────────────────────────

function HowItWorksBanner() {
  const [open, setOpen] = useState(false)

  const steps = [
    {
      icon: Zap,
      color: 'text-gold',
      bg: 'bg-gold/10',
      title: 'Sortition',
      body: 'Citizens volunteer; members are randomly selected — not elected. This prevents coordinated capture and ensures diverse representation.',
    },
    {
      icon: Users,
      color: 'text-for-400',
      bg: 'bg-for-500/10',
      title: 'Deliberation',
      body: 'Members discuss in structured rounds. They read briefings, ask questions, and update their views in response to new arguments.',
    },
    {
      icon: Gavel,
      color: 'text-purple',
      bg: 'bg-purple/10',
      title: 'Recommendation',
      body: 'The assembly reaches a collective stance and writes a recommendation. This carries special weight in the platform\'s consensus mechanism.',
    },
    {
      icon: CheckCircle2,
      color: 'text-emerald',
      bg: 'bg-emerald/10',
      title: 'Community ratification',
      body: 'Observers endorse or object to the recommendation. A strong endorsement boosts its weight in the topic\'s consensus score.',
    },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-200/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-purple" />
          <span className="text-xs font-mono font-semibold text-surface-600">
            How do Citizens&apos; Assemblies work?
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-surface-300 pt-3">
              {steps.map((step) => {
                const Icon = step.icon
                return (
                  <div key={step.title} className="flex gap-3">
                    <div className={cn('p-2 rounded-xl flex-shrink-0 h-fit', step.bg)}>
                      <Icon className={cn('h-4 w-4', step.color)} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-semibold text-white mb-0.5">{step.title}</p>
                      <p className="text-[11px] text-surface-600 leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'forming' | 'deliberating' | 'concluded'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'forming',      label: 'Forming' },
  { key: 'deliberating', label: 'In Session' },
  { key: 'concluded',    label: 'Concluded' },
]

export function AssemblyClient() {
  const [assemblies, setAssemblies] = useState<AssemblyRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAssemblies = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(`/api/assemblies?status=${statusFilter}&limit=20`)
      if (!res.ok) return
      const data = (await res.json()) as AssembliesResponse
      setAssemblies(data.assemblies)
      setTotal(data.total)
    } catch { /* ignore */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchAssemblies() }, [fetchAssemblies])

  async function handleJoin(assemblyId: string) {
    try {
      const res = await fetch('/api/assemblies/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assembly_id: assemblyId }),
      })
      if (res.ok) fetchAssemblies(true)
    } catch { /* ignore */ }
  }

  async function handleReact(assemblyId: string, reaction: 'endorse' | 'question' | 'object') {
    try {
      await fetch('/api/assemblies/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assembly_id: assemblyId, reaction }),
      })
      fetchAssemblies(true)
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple/10 border border-purple/20">
                <Gavel className="h-5 w-5 text-purple" />
              </div>
              <div>
                <h1 className="text-xl font-mono font-bold text-white">Citizens&apos; Assembly</h1>
                <p className="text-xs text-surface-600">
                  Sortition-based deliberative democracy
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAssemblies(true)}
                disabled={refreshing}
                className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </button>
              <Button size="sm" onClick={() => setShowNewModal(true)}>
                <Plus className="h-3.5 w-3.5" />
                Convene
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          {!loading && total > 0 && (
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-surface-100 border border-surface-300 text-xs text-surface-600">
              <span className="font-mono font-semibold text-white">{total}</span>
              <span>total assemblies</span>
              <span className="mx-1 text-surface-700">·</span>
              <span className="font-mono font-semibold text-gold">
                {assemblies.filter(a => a.status === 'forming').length}
              </span>
              <span>forming</span>
              <span className="mx-1 text-surface-700">·</span>
              <span className="font-mono font-semibold text-for-400">
                {assemblies.filter(a => a.status === 'deliberating').length}
              </span>
              <span>in session</span>
            </div>
          )}
        </div>

        {/* How it works collapsible */}
        <HowItWorksBanner />

        {/* Status filter */}
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all',
                statusFilter === tab.key
                  ? 'bg-purple/20 text-purple border border-purple/30'
                  : 'bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 border border-transparent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Assembly list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex gap-3 mb-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-20 rounded-full" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                  <div className="flex gap-1">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-6 w-6 rounded-full" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : assemblies.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No assemblies yet"
            description={
              statusFilter === 'all'
                ? 'Be the first to convene a Citizens\' Assembly — bring sortition-based deliberation to a contested topic.'
                : `No ${statusFilter} assemblies right now.`
            }
            actions={[{ label: 'Convene the first assembly', onClick: () => setShowNewModal(true) }]}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {assemblies.map((assembly) => (
                <AssemblyCard
                  key={assembly.id}
                  assembly={assembly}
                  expanded={expandedId === assembly.id}
                  onToggle={() => setExpandedId(expandedId === assembly.id ? null : assembly.id)}
                  onJoin={handleJoin}
                  onReact={handleReact}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
      <BottomNav />

      <AnimatePresence>
        {showNewModal && (
          <NewAssemblyModal
            onClose={() => setShowNewModal(false)}
            onCreated={() => {
              setShowNewModal(false)
              fetchAssemblies()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
