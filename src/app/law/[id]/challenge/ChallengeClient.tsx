'use client'

/**
 * /law/[id]/challenge — Formal Challenge Filing System
 *
 * Citizens can file formal challenges to established laws on specific grounds:
 *   Constitutional  – challenges the law's alignment with civic principles
 *   Procedural      – disputes how the law was enacted
 *   Factual         – contests the empirical basis of the law
 *   Ethical         – raises moral or rights-based objections
 *   Practical       – argues the law is unworkable or counterproductive
 *
 * Others can vote to support or oppose each challenge, creating a structured
 * record of civic contestation distinct from the debates and amendments flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Gavel,
  Loader2,
  Plus,
  Scale,
  Send,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LawChallengeData,
  ChallengeItem,
  ChallengeGrounds,
} from '@/app/api/laws/[id]/challenge/route'

// ─── Grounds config ───────────────────────────────────────────────────────────

const GROUNDS_CONFIG: Record<
  ChallengeGrounds,
  { label: string; description: string; icon: typeof Shield; color: string; bg: string; border: string; badge: string }
> = {
  constitutional: {
    label: 'Constitutional',
    description: 'Challenges alignment with civic principles or foundational rights',
    icon: Shield,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    badge: 'bg-purple/20 text-purple border-purple/40',
  },
  procedural: {
    label: 'Procedural',
    description: 'Disputes how the law was enacted or the vote process',
    icon: FileText,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    badge: 'bg-for-500/20 text-for-300 border-for-500/40',
  },
  factual: {
    label: 'Factual',
    description: 'Contests the empirical evidence or data underlying the law',
    icon: AlertCircle,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    badge: 'bg-emerald/20 text-emerald border-emerald/40',
  },
  ethical: {
    label: 'Ethical',
    description: 'Raises moral, rights-based, or fairness objections',
    icon: Scale,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    badge: 'bg-gold/20 text-gold border-gold/40',
  },
  practical: {
    label: 'Practical',
    description: 'Argues the law is unworkable, unenforceable, or counterproductive',
    icon: Zap,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    badge: 'bg-against-500/20 text-against-300 border-against-500/40',
  },
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-surface-400', icon: Clock },
  upheld: { label: 'Upheld', color: 'text-emerald', icon: CheckCircle2 },
  dismissed: { label: 'Dismissed', color: 'text-against-400', icon: X },
}

const FILTER_TABS: Array<{ key: ChallengeGrounds | 'all'; label: string }> = [
  { key: 'all',            label: 'All' },
  { key: 'constitutional', label: 'Constitutional' },
  { key: 'procedural',     label: 'Procedural' },
  { key: 'factual',        label: 'Factual' },
  { key: 'ethical',        label: 'Ethical' },
  { key: 'practical',      label: 'Practical' },
]

// ─── Filing form ──────────────────────────────────────────────────────────────

interface FilingFormProps {
  lawId: string
  onSubmit: (c: ChallengeItem) => void
  onClose: () => void
}

function FilingForm({ lawId, onSubmit, onClose }: FilingFormProps) {
  const [grounds, setGrounds] = useState<ChallengeGrounds>('constitutional')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (title.trim().length < 10)     { setError('Title must be at least 10 characters.'); return }
    if (description.trim().length < 30) { setError('Description must be at least 30 characters.'); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grounds, title: title.trim(), description: description.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to file challenge.'); return }
      // Optimistic new item
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .eq('id', user?.id ?? '')
        .maybeSingle()
      const newChallenge: ChallengeItem = {
        id: json.id,
        grounds,
        title: title.trim(),
        description: description.trim(),
        status: 'open',
        support_count: 0,
        oppose_count: 0,
        created_at: new Date().toISOString(),
        user_vote: null,
        author: profile
          ? { id: profile.id, username: profile.username, display_name: profile.display_name,
              avatar_url: profile.avatar_url, role: profile.role, clout: profile.clout }
          : null,
      }
      onSubmit(newChallenge)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const cfg = GROUNDS_CONFIG[grounds]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
          <Gavel className="h-4 w-4 text-against-400" />
          File a Formal Challenge
        </h3>
        <button
          onClick={onClose}
          aria-label="Close form"
          className="p-1 rounded text-surface-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Grounds selector */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-surface-500 font-mono mb-2">
            Grounds for Challenge
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(GROUNDS_CONFIG) as ChallengeGrounds[]).map((g) => {
              const c = GROUNDS_CONFIG[g]
              const Icon = c.icon
              const selected = grounds === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrounds(g)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs font-mono transition-all',
                    selected
                      ? cn(c.bg, c.border, c.color, 'font-semibold')
                      : 'bg-surface-200 border-surface-400 text-surface-400 hover:border-surface-300 hover:text-white'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {c.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] font-mono text-surface-500 mt-2">{cfg.description}</p>
        </div>

        {/* Title */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-surface-500 font-mono block mb-1">
            Challenge Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A concise statement of your challenge…"
            maxLength={120}
            className={cn(
              'w-full bg-surface-200 border border-surface-400 rounded-lg px-3 py-2',
              'text-sm font-mono text-white placeholder-surface-500',
              'focus:outline-none focus:border-against-500 focus:bg-surface-200',
              'transition-colors'
            )}
          />
          <p className="text-[10px] font-mono text-surface-600 mt-1 text-right">
            {title.length}/120
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-surface-500 font-mono block mb-1">
            Full Argument
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Make your case clearly and specifically. Include evidence, references, or logical arguments…"
            maxLength={1200}
            rows={5}
            className={cn(
              'w-full bg-surface-200 border border-surface-400 rounded-lg px-3 py-2',
              'text-sm font-mono text-white placeholder-surface-500 resize-none',
              'focus:outline-none focus:border-against-500 focus:bg-surface-200',
              'transition-colors'
            )}
          />
          <p className="text-[10px] font-mono text-surface-600 mt-1 text-right">
            {description.length}/1200
          </p>
        </div>

        {error && (
          <p className="text-xs font-mono text-against-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-9 rounded-lg bg-surface-200 border border-surface-400 text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || title.trim().length < 10 || description.trim().length < 30}
            className={cn(
              'flex-1 h-9 rounded-lg border text-xs font-mono font-semibold',
              'flex items-center justify-center gap-1.5 transition-all',
              'bg-against-600/20 border-against-600/40 text-against-300',
              'hover:bg-against-600/30 hover:border-against-500/60',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            File Challenge
          </button>
        </div>
      </form>
    </motion.div>
  )
}

// ─── Challenge card ───────────────────────────────────────────────────────────

interface ChallengeCardProps {
  challenge: ChallengeItem
  onVote: (id: string, vote: 'support' | 'oppose' | null) => void
  isOwn: boolean
}

function ChallengeCard({ challenge, onVote, isOwn }: ChallengeCardProps) {
  const [expanded, setExpanded] = useState(false)
  const cfg = GROUNDS_CONFIG[challenge.grounds]
  const statusCfg = STATUS_CONFIG[challenge.status]
  const StatusIcon = statusCfg.icon
  const GroundsIcon = cfg.icon
  const total = challenge.support_count + challenge.oppose_count
  const supportPct = total > 0 ? Math.round((challenge.support_count / total) * 100) : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-surface-100 border rounded-xl overflow-hidden transition-colors',
        challenge.status === 'upheld'   ? 'border-emerald/30' :
        challenge.status === 'dismissed'? 'border-surface-400/40' :
        'border-surface-300'
      )}
    >
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg flex-shrink-0', cfg.bg, cfg.border, 'border')}>
            <GroundsIcon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border',
                cfg.badge
              )}>
                {challenge.grounds.charAt(0).toUpperCase() + challenge.grounds.slice(1)}
              </span>
              <span className={cn('flex items-center gap-0.5 text-[10px] font-mono', statusCfg.color)}>
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>
              {isOwn && (
                <span className="text-[10px] font-mono text-surface-500 border border-surface-400 rounded px-1">
                  Your challenge
                </span>
              )}
            </div>
            <h3 className="text-sm font-mono font-semibold text-white leading-snug">
              {challenge.title}
            </h3>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className={cn(
            'text-[13px] font-mono text-surface-400 leading-relaxed',
            !expanded && 'line-clamp-3'
          )}>
            {challenge.description}
          </p>
          {challenge.description.length > 180 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 mt-1 transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read more</>}
            </button>
          )}
        </div>

        {/* Support bar */}
        {total > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-emerald rounded-full transition-all duration-500"
                style={{ width: `${supportPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-surface-500">
              <span className="text-emerald">{supportPct}% support</span>
              <span>{total} vote{total !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {challenge.author && (
              <Link
                href={`/profile/${challenge.author.username}`}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <Avatar
                  src={challenge.author.avatar_url}
                  fallback={challenge.author.display_name || challenge.author.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500">
                  {challenge.author.display_name || challenge.author.username}
                </span>
              </Link>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {new Date(challenge.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: '2-digit'
              })}
            </span>
          </div>

          {/* Vote buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onVote(challenge.id, challenge.user_vote === 'support' ? null : 'support')}
              aria-label="Support this challenge"
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
                challenge.user_vote === 'support'
                  ? 'bg-emerald/20 border-emerald/50 text-emerald'
                  : 'bg-surface-200 border-surface-400 text-surface-400 hover:border-emerald/50 hover:text-emerald'
              )}
            >
              <ThumbsUp className="h-3 w-3" />
              {challenge.support_count}
            </button>
            <button
              onClick={() => onVote(challenge.id, challenge.user_vote === 'oppose' ? null : 'oppose')}
              aria-label="Oppose this challenge"
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
                challenge.user_vote === 'oppose'
                  ? 'bg-against-500/20 border-against-500/50 text-against-300'
                  : 'bg-surface-200 border-surface-400 text-surface-400 hover:border-against-500/50 hover:text-against-300'
              )}
            >
              <ThumbsDown className="h-3 w-3" />
              {challenge.oppose_count}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
}

export function ChallengeClient({ lawId }: Props) {
  const [data, setData]           = useState<LawChallengeData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<ChallengeGrounds | 'all'>('all')
  const [sort, setSort]           = useState<'support' | 'recent'>('support')
  const [showForm, setShowForm]   = useState(false)
  const [authed, setAuthed]       = useState(false)
  const abortRef                  = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (g: ChallengeGrounds | 'all', s: 'support' | 'recent') => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const params = new URLSearchParams({ grounds: g, sort: s })
      const res = await fetch(`/api/laws/${lawId}/challenge?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json() as LawChallengeData
      setData(json)
    } catch {
      // ignore abort
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => {
    fetchData(filter, sort)
  }, [fetchData, filter, sort])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user))
  }, [])

  function handleVote(challengeId: string, vote: 'support' | 'oppose' | null) {
    if (!authed) return

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        challenges: prev.challenges.map((c) => {
          if (c.id !== challengeId) return c
          const prevVote = c.user_vote
          let support = c.support_count
          let oppose  = c.oppose_count
          // Remove previous vote
          if (prevVote === 'support') support--
          if (prevVote === 'oppose')  oppose--
          // Add new vote
          if (vote === 'support') support++
          if (vote === 'oppose')  oppose++
          return { ...c, user_vote: vote, support_count: Math.max(0, support), oppose_count: Math.max(0, oppose) }
        }),
      }
    })

    fetch(`/api/laws/${lawId}/challenge`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challengeId, vote }),
    }).catch(() => {
      // revert on failure by re-fetching
      fetchData(filter, sort)
    })
  }

  function handleNewChallenge(c: ChallengeItem) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            total_challenges: prev.total_challenges + 1,
            challenges: [c, ...prev.challenges],
            user_challenge_ids: [...prev.user_challenge_ids, c.id],
          }
        : prev
    )
    setShowForm(false)
  }

  const law = data

  // Stats
  const totalSupport = data?.challenges.reduce((s, c) => s + c.support_count, 0) ?? 0
  const upheld    = data?.challenges.filter((c) => c.status === 'upheld').length ?? 0
  const byGrounds = data
    ? (Object.keys(GROUNDS_CONFIG) as ChallengeGrounds[]).reduce<Record<string, number>>(
        (acc, g) => {
          acc[g] = data.challenges.filter((c) => c.grounds === g).length
          return acc
        },
        {} as Record<string, number>
      )
    : {}

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24 space-y-6">
        {/* Back link */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to law
        </Link>

        {/* Page header */}
        <div className="space-y-1">
          <h1 className="text-xl font-mono font-bold text-white flex items-center gap-2">
            <Gavel className="h-5 w-5 text-against-400" />
            Formal Challenges
          </h1>
          {law && (
            <p className="text-sm font-mono text-surface-400 line-clamp-2">
              {law.law_statement}
            </p>
          )}
        </div>

        {/* Stats row */}
        {law && !loading ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center">
              <p className="text-2xl font-mono font-bold text-white">{law.total_challenges}</p>
              <p className="text-[10px] uppercase tracking-widest font-mono text-surface-500 mt-0.5">Challenges</p>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center">
              <p className="text-2xl font-mono font-bold text-emerald">{totalSupport}</p>
              <p className="text-[10px] uppercase tracking-widest font-mono text-surface-500 mt-0.5">Support Votes</p>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center">
              <p className="text-2xl font-mono font-bold text-gold">{upheld}</p>
              <p className="text-[10px] uppercase tracking-widest font-mono text-surface-500 mt-0.5">Upheld</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {/* Grounds breakdown */}
        {!loading && data && data.total_challenges > 0 && (
          <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest font-mono text-surface-500 mb-3">
              Breakdown by Grounds
            </p>
            <div className="space-y-2">
              {(Object.keys(GROUNDS_CONFIG) as ChallengeGrounds[])
                .filter((g) => byGrounds[g] > 0)
                .map((g) => {
                  const cfg = GROUNDS_CONFIG[g]
                  const count = byGrounds[g] ?? 0
                  const pct = data.total_challenges > 0 ? Math.round((count / data.total_challenges) * 100) : 0
                  const Icon = cfg.icon
                  return (
                    <div key={g} className="flex items-center gap-3">
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.color)} />
                      <span className="text-xs font-mono text-surface-400 w-28">{cfg.label}</span>
                      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', cfg.color.replace('text-', 'bg-'))}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-surface-500 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-medium transition-all',
                  filter === tab.key
                    ? 'bg-against-600/20 border-against-600/40 text-against-300'
                    : 'bg-surface-200 border-surface-400 text-surface-400 hover:text-white hover:border-surface-300'
                )}
              >
                {tab.label}
                {data && tab.key !== 'all' && (byGrounds[tab.key] ?? 0) > 0 && (
                  <span className="ml-1 opacity-60">({byGrounds[tab.key]})</span>
                )}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            {(['support', 'recent'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-all',
                  sort === s
                    ? 'bg-surface-200 border-surface-300 text-white'
                    : 'bg-transparent border-surface-500 text-surface-500 hover:text-white'
                )}
              >
                {s === 'support' ? 'Top' : 'Recent'}
              </button>
            ))}
          </div>
        </div>

        {/* File challenge button */}
        {authed && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className={cn(
              'w-full flex items-center justify-center gap-2 h-10 rounded-xl border',
              'bg-against-600/10 border-against-600/30 text-against-400',
              'hover:bg-against-600/20 hover:border-against-500/50 hover:text-against-300',
              'text-sm font-mono font-medium transition-all'
            )}
          >
            <Plus className="h-4 w-4" />
            File a Formal Challenge
          </button>
        )}

        {!authed && (
          <p className="text-[11px] font-mono text-surface-500 text-center">
            <Link href="/sign-in" className="text-for-400 hover:text-for-300 underline underline-offset-2">
              Sign in
            </Link>{' '}
            to file or vote on challenges
          </p>
        )}

        {/* Filing form */}
        <AnimatePresence>
          {showForm && (
            <FilingForm
              lawId={lawId}
              onSubmit={handleNewChallenge}
              onClose={() => setShowForm(false)}
            />
          )}
        </AnimatePresence>

        {/* Challenge list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : !data || data.challenges.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No challenges yet"
            description={
              filter !== 'all'
                ? `No ${filter} challenges have been filed for this law.`
                : 'This law has not been formally challenged. Be the first to file one.'
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {data.challenges.map((c) => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  onVote={handleVote}
                  isOwn={data.user_challenge_ids.includes(c.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Context note */}
        <div className="bg-surface-100/60 border border-surface-300/60 rounded-xl p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-mono text-surface-500 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            About Formal Challenges
          </p>
          <p className="text-[12px] font-mono text-surface-500 leading-relaxed">
            A formal challenge is a structured civic objection to an established law. Unlike debate
            arguments or amendment proposals, a challenge questions the law&apos;s foundational validity
            on specific grounds. Challenges accumulate community support and create a permanent
            record of civic contestation.
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {(Object.keys(GROUNDS_CONFIG) as ChallengeGrounds[]).map((g) => {
              const cfg = GROUNDS_CONFIG[g]
              const Icon = cfg.icon
              return (
                <div key={g} className="flex items-start gap-1.5">
                  <Icon className={cn('h-3 w-3 mt-0.5 flex-shrink-0', cfg.color)} />
                  <span className="text-[11px] font-mono text-surface-500">
                    <span className={cn('font-semibold', cfg.color)}>{cfg.label}</span>
                    {' — '}
                    {cfg.description.split(' ').slice(0, 4).join(' ')}…
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
