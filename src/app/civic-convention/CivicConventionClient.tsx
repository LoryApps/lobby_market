'use client'

/**
 * /civic-convention — The Civic Constitutional Convention
 *
 * The highest deliberative body on Lobby Market. Citizens with sufficient
 * standing (1,000+ Clout or Elder/Troll Catcher role) may propose amendments
 * to the seven articles of the Civic Doctrine. Amendments are put to the
 * platform as governance referendums; a 75% supermajority is required to
 * ratify any change.
 *
 * Distinct from:
 *   /civic-doctrine     — the founding principles (read-only view)
 *   /grand-council      — ongoing governance motions
 *   /civic-referendums  — general community referendums
 *   /assembly           — sortition deliberative bodies
 *   /tribunal           — argument adjudication
 *
 * The Convention is rare and ceremonial. It exists to signal that the
 * founding principles are living, revisable, and owned by the citizenry —
 * not imposed from above.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Gavel,
  Globe,
  Loader2,
  Lock,
  PenLine,
  RefreshCw,
  Scale,
  ScrollText,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { ConventionData, ConventionAmendment } from '@/app/api/civic-convention/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRoman(n: number): string {
  const vals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'],  [90, 'XC'],  [50, 'L'],  [40, 'XL'],
    [10, 'X'],   [9, 'IX'],   [5, 'V'],   [4, 'IV'],   [1, 'I'],
  ]
  let result = ''
  for (const [val, sym] of vals) {
    while (n >= val) { result += sym; n -= val }
  }
  return result
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h remaining`
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${mins}m remaining`
  return `${mins}m remaining`
}

function pct(a: number, b: number): number {
  const total = a + b
  return total === 0 ? 0 : Math.round((a / total) * 100)
}

// ─── Doctrine article stubs (mirrored from /civic-doctrine) ────────────────────

interface Article {
  romanNumeral: string
  title: string
  principle: string
  color: string
  icon: React.ComponentType<{ className?: string }>
}

const ARTICLES: Article[] = [
  {
    romanNumeral: 'I',
    title: 'Democratic Consensus',
    principle: 'No proposal shall become law without the supermajority consent of the citizenry.',
    color: 'text-for-400',
    icon: Gavel,
  },
  {
    romanNumeral: 'II',
    title: 'Equal Voice',
    principle: 'Every citizen holds one vote of equal weight per topic, irrespective of reputation or Clout.',
    color: 'text-emerald',
    icon: Users,
  },
  {
    romanNumeral: 'III',
    title: 'Meritocratic Argument',
    principle: 'Arguments rise or fall on their merit alone; the best reasoning earns recognition.',
    color: 'text-purple',
    icon: Scale,
  },
  {
    romanNumeral: 'IV',
    title: 'Radical Transparency',
    principle: 'Every vote, argument, and law is permanently public. Democracy cannot exist in the dark.',
    color: 'text-gold',
    icon: Globe,
  },
  {
    romanNumeral: 'V',
    title: 'Civic Accountability',
    principle: 'Bad-faith actors face community review. The Lobby is self-governing and self-correcting.',
    color: 'text-against-400',
    icon: Shield,
  },
  {
    romanNumeral: 'VI',
    title: 'Evolving Consensus',
    principle: 'Truth is not fixed. The community may revisit any topic as evidence and opinion evolve.',
    color: 'text-for-300',
    icon: Zap,
  },
  {
    romanNumeral: 'VII',
    title: 'Civic Dignity',
    principle: 'Every participant is treated as a reasonable citizen of good faith until they prove otherwise.',
    color: 'text-gold',
    icon: Star,
  },
]

// ─── Sub-components ─────────────────────────────────────────────────────────────

function ArticleCard({ article, index }: { article: Article; index: number }) {
  const Icon = article.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      <div className={cn('flex-shrink-0 mt-0.5', article.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={cn('text-[10px] font-mono font-bold tracking-widest', article.color)}>
            ART. {article.romanNumeral}
          </span>
          <span className="text-xs font-semibold text-white truncate">{article.title}</span>
        </div>
        <p className="text-[11px] text-surface-500 leading-relaxed line-clamp-2">{article.principle}</p>
      </div>
    </motion.div>
  )
}

interface AmendmentCardProps {
  amendment: ConventionAmendment
  onVote: (id: string, vote: 'for' | 'against') => void
  voting: string | null
}

function AmendmentCard({ amendment, onVote, voting }: AmendmentCardProps) {
  const forPct = pct(amendment.for_votes, amendment.against_votes)
  const total = amendment.for_votes + amendment.against_votes
  const quorumPct = Math.min(100, Math.round((total / amendment.quorum_required) * 100))
  const passes = forPct >= 75

  const isOpen = amendment.status === 'open' && new Date(amendment.closes_at) > new Date()
  const isBusy = voting === amendment.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        amendment.status === 'passed'
          ? 'bg-for-600/10 border-for-600/30'
          : amendment.status === 'failed' || amendment.status === 'vetoed'
          ? 'bg-against-600/10 border-against-600/30'
          : 'bg-surface-200/70 border-surface-300/70'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {amendment.status === 'passed' ? (
            <CheckCircle2 className="h-4 w-4 text-for-400" />
          ) : amendment.status === 'failed' ? (
            <XCircle className="h-4 w-4 text-against-400" />
          ) : amendment.status === 'vetoed' ? (
            <Lock className="h-4 w-4 text-surface-500" />
          ) : (
            <ScrollText className="h-4 w-4 text-gold" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                amendment.status === 'open'
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : amendment.status === 'passed'
                  ? 'bg-for-600/30 text-for-300 border border-for-600/40'
                  : 'bg-against-600/30 text-against-300 border border-against-600/40'
              )}
            >
              {amendment.status === 'open' ? 'In Convention' : amendment.status}
            </span>
            {isOpen && (
              <span className="text-[10px] text-surface-500 font-mono flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {timeLeft(amendment.closes_at)}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{amendment.question}</p>
          {amendment.description && (
            <p className="mt-1 text-xs text-surface-500 leading-relaxed line-clamp-3">
              {amendment.description}
            </p>
          )}
        </div>
      </div>

      {/* Proposer */}
      {amendment.proposer && (
        <div className="flex items-center gap-1.5 text-[11px] text-surface-500">
          <span>Proposed by</span>
          <Link
            href={`/profile/${amendment.proposer.username}`}
            className="font-semibold text-surface-400 hover:text-white transition-colors"
          >
            @{amendment.proposer.username}
          </Link>
          <span className="text-surface-600">·</span>
          <span className="font-mono text-gold">{amendment.proposer.clout.toLocaleString()} Clout</span>
        </div>
      )}

      {/* Vote bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-for-400">{amendment.for_votes} For ({forPct}%)</span>
          <span className={cn('text-xs font-bold', passes ? 'text-for-300' : 'text-surface-500')}>
            {passes ? '✓ Supermajority' : `Need 75% — ${75 - forPct}% gap`}
          </span>
          <span className="text-against-400">{amendment.against_votes} Against</span>
        </div>
        <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              forPct >= 75 ? 'bg-for-500' : 'bg-for-600/70'
            )}
            style={{ width: `${forPct}%` }}
          />
        </div>
        {/* Quorum bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold/60 transition-all duration-500"
              style={{ width: `${quorumPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
            Quorum {quorumPct}%
          </span>
        </div>
      </div>

      {/* Vote buttons */}
      {isOpen && (
        <div className="flex gap-2">
          <button
            onClick={() => onVote(amendment.id, 'for')}
            disabled={isBusy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
              amendment.user_vote === 'for'
                ? 'bg-for-600/30 border-for-600/50 text-for-300'
                : 'bg-surface-300/60 border-surface-400/60 text-surface-400 hover:bg-for-600/20 hover:border-for-600/40 hover:text-for-400'
            )}
          >
            {isBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <ThumbsUp className="h-3 w-3" />
                Ratify
              </>
            )}
          </button>
          <button
            onClick={() => onVote(amendment.id, 'against')}
            disabled={isBusy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
              amendment.user_vote === 'against'
                ? 'bg-against-600/30 border-against-600/50 text-against-300'
                : 'bg-surface-300/60 border-surface-400/60 text-surface-400 hover:bg-against-600/20 hover:border-against-600/40 hover:text-against-400'
            )}
          >
            {isBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <ThumbsDown className="h-3 w-3" />
                Reject
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Propose amendment modal ──────────────────────────────────────────────────

interface ProposeModalProps {
  onClose: () => void
  onSubmit: (q: string, desc: string) => Promise<void>
}

function ProposeModal({ onClose, onSubmit }: ProposeModalProps) {
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxQ = 180
  const maxDesc = 1000

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (question.trim().length < 20) {
      setError('Amendment title must be at least 20 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(question.trim(), description.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl bg-surface-200 border border-gold/30 p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-gold" />
            <span className="text-sm font-semibold text-white">Propose an Amendment</span>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Notice */}
        <div className="rounded-xl bg-gold/10 border border-gold/30 p-3 text-xs text-surface-400 leading-relaxed">
          This proposal will be submitted as a <strong className="text-gold">governance referendum</strong>.
          A supermajority of <strong className="text-white">75%</strong> and quorum of{' '}
          <strong className="text-white">25 votes</strong> is required for ratification.
          The convention remains open for <strong className="text-white">14 days</strong>.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Amendment title */}
          <div>
            <label className="block text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">
              Proposed Amendment <span className="text-against-400">*</span>
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, maxQ))}
              placeholder="State the proposed change to the Civic Doctrine clearly and concisely…"
              rows={2}
              className="w-full rounded-xl bg-surface-300/60 border border-surface-400/60 px-3.5 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-gold/50 resize-none transition-colors"
            />
            <p className="text-right text-[10px] font-mono text-surface-600 mt-0.5">
              {question.length}/{maxQ}
            </p>
          </div>

          {/* Reasoning */}
          <div>
            <label className="block text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">
              Constitutional Reasoning
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, maxDesc))}
              placeholder="Explain why this amendment strengthens civic democracy on Lobby Market. Reference the relevant article if applicable…"
              rows={4}
              className="w-full rounded-xl bg-surface-300/60 border border-surface-400/60 px-3.5 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-gold/50 resize-none transition-colors"
            />
            <p className="text-right text-[10px] font-mono text-surface-600 mt-0.5">
              {description.length}/{maxDesc}
            </p>
          </div>

          {error && (
            <p className="text-xs text-against-400 bg-against-600/10 rounded-lg px-3 py-2 border border-against-600/30">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || question.trim().length < 20}
            className="w-full py-2.5 rounded-xl bg-gold/20 border border-gold/40 text-gold text-sm font-mono font-semibold hover:bg-gold/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Gavel className="h-4 w-4" />
                Submit to Convention
              </>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Convention rules ──────────────────────────────────────────────────────────

function ConventionRules() {
  const rules = [
    {
      step: '01',
      title: 'Proposal',
      desc: 'A citizen with 1,000+ Clout or Elder standing submits an amendment to the Convention.',
      color: 'text-for-400',
    },
    {
      step: '02',
      title: 'Public Debate',
      desc: 'The amendment is open for 14 days. All citizens may vote and argue their position.',
      color: 'text-purple',
    },
    {
      step: '03',
      title: 'Supermajority Ratification',
      desc: 'Ratification requires 75% FOR votes and a quorum of at least 25 citizen votes.',
      color: 'text-gold',
    },
    {
      step: '04',
      title: 'Constitutional Record',
      desc: 'Ratified amendments are recorded permanently in the Civic Convention Record.',
      color: 'text-emerald',
    },
  ]

  return (
    <div className="rounded-2xl bg-surface-200/50 border border-surface-300/60 p-4 space-y-3">
      <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5" />
        Convention Rules of Order
      </h3>
      <div className="space-y-2.5">
        {rules.map((r) => (
          <div key={r.step} className="flex gap-3 items-start">
            <span className={cn('text-[10px] font-mono font-bold tracking-widest mt-0.5 flex-shrink-0', r.color)}>
              §{r.step}
            </span>
            <div>
              <span className="text-xs font-semibold text-white">{r.title} — </span>
              <span className="text-xs text-surface-500">{r.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CivicConventionClient() {
  const [data, setData] = useState<ConventionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)
  const [showPropose, setShowPropose] = useState(false)
  const [showArticles, setShowArticles] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'passed' | 'failed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/civic-convention', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleVote = useCallback(
    async (id: string, vote: 'for' | 'against') => {
      if (!data) return
      setVoting(id)
      try {
        const res = await fetch(`/api/referendums/${id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vote }),
        })
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/login'
            return
          }
          throw new Error()
        }
        const result = await res.json()
        // Optimistically update counts
        setData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            amendments: prev.amendments.map((a) =>
              a.id === id
                ? {
                    ...a,
                    for_votes: result.for_votes ?? a.for_votes,
                    against_votes: result.against_votes ?? a.against_votes,
                    user_vote: vote,
                  }
                : a
            ),
          }
        })
      } catch {
        // silent — vote failed
      } finally {
        setVoting(null)
      }
    },
    [data]
  )

  const handlePropose = useCallback(
    async (question: string, description: string) => {
      const res = await fetch('/api/referendums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          description,
          category: 'governance',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Failed to submit amendment')
      }
      setShowPropose(false)
      await load()
    },
    [load]
  )

  const filteredAmendments = data
    ? data.amendments.filter((a) => {
        if (activeFilter === 'all') return true
        if (activeFilter === 'open') return a.status === 'open'
        if (activeFilter === 'passed') return a.status === 'passed'
        if (activeFilter === 'failed') return a.status === 'failed' || a.status === 'vetoed'
        return true
      })
    : []

  const openCount = data?.amendments.filter((a) => a.status === 'open').length ?? 0
  const passedCount = data?.amendments.filter((a) => a.status === 'passed').length ?? 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      {/* Hero — parchment-style constitutional header */}
      <div className="relative overflow-hidden border-b border-gold/20 bg-gradient-to-b from-gold/5 via-surface-200/40 to-transparent">
        {/* Background rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
          <div className="w-[600px] h-[600px] rounded-full border border-gold" />
          <div className="absolute w-[400px] h-[400px] rounded-full border border-gold" />
          <div className="absolute w-[200px] h-[200px] rounded-full border border-gold" />
        </div>

        <div className="relative max-w-2xl mx-auto px-4 pt-16 pb-10 text-center">
          {/* Back link */}
          <Link
            href="/civic-doctrine"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors mb-6"
          >
            <ArrowLeft className="h-3 w-3" />
            Civic Doctrine
          </Link>

          {/* Seal icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="flex items-center justify-center mb-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gold/10 border-2 border-gold/40 flex items-center justify-center">
                <ScrollText className="h-7 w-7 text-gold" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface-100 border border-gold/40 flex items-center justify-center">
                <Star className="h-2.5 w-2.5 text-gold" />
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-[10px] font-mono text-gold/70 tracking-[0.3em] uppercase mb-2">
              {loading || !data
                ? 'Loading…'
                : `Convention Session ${toRoman(data.sessionNumber)} — Anno Domini MMXXVI`}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">
              The Civic Constitutional
              <br />
              <span className="text-gold">Convention</span>
            </h1>
            <p className="text-sm text-surface-500 leading-relaxed max-w-md mx-auto">
              The highest deliberative body of the Lobby. Where citizens propose, debate, and ratify
              amendments to the founding Civic Doctrine — by supermajority will of the citizenry.
            </p>
          </motion.div>

          {/* Stats row */}
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-6 mt-6 text-center"
            >
              <div>
                <p className="text-lg font-bold font-mono text-gold">{openCount}</p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider">In Session</p>
              </div>
              <div className="w-px h-8 bg-surface-300" />
              <div>
                <p className="text-lg font-bold font-mono text-for-400">{passedCount}</p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider">Ratified</p>
              </div>
              <div className="w-px h-8 bg-surface-300" />
              <div>
                <p className="text-lg font-bold font-mono text-white">7</p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider">Articles</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6 pb-24">

        {/* Propose CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4',
            data?.userCanPropose
              ? 'bg-gold/8 border-gold/30'
              : 'bg-surface-200/50 border-surface-300/60'
          )}
        >
          <div className="flex-1 min-w-0">
            {data?.userCanPropose ? (
              <>
                <p className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
                  <PenLine className="h-3.5 w-3.5 text-gold" />
                  You may propose an amendment
                </p>
                <p className="text-xs text-surface-500">
                  Your standing ({data.userClout.toLocaleString()} Clout
                  {data.userRole === 'elder' || data.userRole === 'troll_catcher'
                    ? ` · ${data.userRole}`
                    : ''}) grants you floor access.
                </p>
              </>
            ) : data && !data.userClout ? (
              <>
                <p className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-surface-500" />
                  Sign in to participate
                </p>
                <p className="text-xs text-surface-500">
                  Delegates must be authenticated citizens of the Lobby.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-surface-500" />
                  Floor access requires 1,000 Clout
                </p>
                <p className="text-xs text-surface-500">
                  You have {(data?.userClout ?? 0).toLocaleString()} Clout.{' '}
                  {1000 - (data?.userClout ?? 0) > 0
                    ? `${(1000 - (data?.userClout ?? 0)).toLocaleString()} more needed to propose.`
                    : ''}
                </p>
              </>
            )}
          </div>
          {data?.userCanPropose ? (
            <button
              onClick={() => setShowPropose(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/20 border border-gold/40 text-gold text-sm font-mono font-semibold hover:bg-gold/30 transition-all"
            >
              <Gavel className="h-3.5 w-3.5" />
              Propose
            </button>
          ) : !data?.userClout ? (
            <Link
              href="/login"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-300 border border-surface-400 text-surface-300 text-sm font-mono font-semibold hover:text-white transition-colors"
            >
              Sign In
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href="/leaderboard"
              className="flex-shrink-0 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors flex items-center gap-1"
            >
              Earn Clout
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </motion.div>

        {/* Amendment proposals */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Gavel className="h-4 w-4 text-gold" />
              Amendment Proposals
            </h2>
            <button
              onClick={load}
              disabled={loading}
              className="text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'open', label: 'In Session' },
                { id: 'passed', label: 'Ratified' },
                { id: 'failed', label: 'Rejected' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                  activeFilter === f.id
                    ? 'bg-gold/20 border-gold/40 text-gold'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-surface-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 rounded-2xl bg-surface-200/50 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-surface-500 text-sm">
              Failed to load convention records.{' '}
              <button onClick={load} className="text-gold underline">
                Retry
              </button>
            </div>
          ) : filteredAmendments.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <ScrollText className="h-8 w-8 text-surface-600 mx-auto" />
              <p className="text-sm text-surface-500">
                {activeFilter === 'open'
                  ? 'No amendments currently in session.'
                  : activeFilter === 'passed'
                  ? 'No amendments have been ratified yet.'
                  : activeFilter === 'failed'
                  ? 'No rejected amendments on record.'
                  : 'The Convention record is empty. Be the first to propose an amendment.'}
              </p>
              {data?.userCanPropose && activeFilter !== 'passed' && activeFilter !== 'failed' && (
                <button
                  onClick={() => setShowPropose(true)}
                  className="inline-flex items-center gap-1.5 text-gold text-xs font-mono hover:underline"
                >
                  <PenLine className="h-3 w-3" />
                  Propose the first amendment
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAmendments.map((a) => (
                <AmendmentCard
                  key={a.id}
                  amendment={a}
                  onVote={handleVote}
                  voting={voting}
                />
              ))}
            </div>
          )}
        </section>

        {/* The 7 Doctrine Articles (collapsible) */}
        <section className="rounded-2xl bg-surface-200/50 border border-surface-300/60 overflow-hidden">
          <button
            onClick={() => setShowArticles((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-300/40 transition-colors"
          >
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-gold" />
              The Seven Doctrine Articles
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-surface-500 transition-transform',
                showArticles && 'rotate-180'
              )}
            />
          </button>
          <AnimatePresence>
            {showArticles && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2 border-t border-surface-300/60 pt-3">
                  {ARTICLES.map((a, i) => (
                    <ArticleCard key={a.romanNumeral} article={a} index={i} />
                  ))}
                  <Link
                    href="/civic-doctrine"
                    className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-gold transition-colors py-2"
                  >
                    Read full Civic Doctrine
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Convention rules */}
        <ConventionRules />

        {/* Cross-links to governance */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
            Governance Chambers
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/grand-council', label: 'Grand Council', icon: Trophy, desc: 'Governance motions' },
              { href: '/assembly', label: 'Citizens\' Assembly', icon: Users, desc: 'Sortition bodies' },
              { href: '/tribunal', label: 'Civic Tribunal', icon: Scale, desc: 'Argument review' },
              { href: '/civic-referendums', label: 'Referendums', icon: CheckCircle2, desc: 'Community votes' },
            ].map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-surface-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white leading-tight">{link.label}</p>
                    <p className="text-[10px] text-surface-500">{link.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </main>

      {/* Propose modal */}
      <AnimatePresence>
        {showPropose && (
          <ProposeModal onClose={() => setShowPropose(false)} onSubmit={handlePropose} />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
