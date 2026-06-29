'use client'

/**
 * /civic-doctrine — The Civic Doctrine
 *
 * The constitutional document of the Lobby — seven guiding principles that
 * define how democracy works on this platform. Each article is backed by live
 * platform data showing how well the Lobby is living up to its founding ideals.
 *
 * Distinct from:
 *   /manifesto          — personal voting-history declaration (user-specific)
 *   /constitution       — coalition governance document
 *   /civic-oath         — individual commitment ceremony
 *   /proclamations      — community announcements
 *   /grand-council      — governance body motions
 *
 * The Civic Doctrine is the platform's founding charter: immutable principles
 * with living proof that democracy here is working.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  Globe,
  RefreshCw,
  Scale,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { DoctrineStats } from '@/app/api/civic-doctrine/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Doctrine articles ────────────────────────────────────────────────────────

interface Article {
  id: number
  romanNumeral: string
  title: string
  principle: string
  elaboration: string
  color: 'for' | 'against' | 'gold' | 'emerald' | 'purple'
  icon: typeof Scale
  stat: (s: DoctrineStats) => { label: string; value: string; sub: string }
  healthFn: (s: DoctrineStats) => number
}

const ARTICLES: Article[] = [
  {
    id: 1,
    romanNumeral: 'I',
    title: 'The Principle of Democratic Consensus',
    principle:
      'No proposal shall become law without the supermajority consent of the citizenry. A simple majority decides debates; democracy requires more than half.',
    elaboration:
      'A topic ascends to Law only when 75% or more of all votes cast endorse it. This supermajority threshold ensures that laws represent genuine, broad consensus — not merely the dominant faction of the moment. Every law in the Codex earned its place through a decisive popular mandate.',
    color: 'for',
    icon: Gavel,
    stat: (s) => ({
      label: 'Laws Established',
      value: fmt(s.totalLaws),
      sub: `${s.lawSuccessRate}% of resolved topics became law`,
    }),
    healthFn: (s) => Math.min(100, 50 + (s.lawSuccessRate > 0 ? Math.min(50, s.lawSuccessRate) : 25)),
  },
  {
    id: 2,
    romanNumeral: 'II',
    title: 'The Principle of Equal Voice',
    principle:
      'Every citizen holds one vote of equal weight per topic, irrespective of reputation, Clout, or tenure. Authority earns influence — never extra votes.',
    elaboration:
      'Clout, reputation, and roles confer recognition and tools — not additional votes. The Citizen who joined today casts a vote identical in weight to that of an Elder with a thousand debates behind them. This equality of franchise is the bedrock of legitimate consensus.',
    color: 'emerald',
    icon: Users,
    stat: (s) => ({
      label: 'Active Citizens',
      value: fmt(s.totalUsers),
      sub: `${s.voterParticipationRate}% have cast at least one vote`,
    }),
    healthFn: (s) => Math.min(100, 40 + Math.min(60, s.voterParticipationRate)),
  },
  {
    id: 3,
    romanNumeral: 'III',
    title: 'The Principle of Open Deliberation',
    principle:
      'Every vote and every argument shall be recorded in the public ledger. No position is secret; no reasoning is hidden. The Lobby deliberates in full light.',
    elaboration:
      'All arguments are public. All votes are counted in plain view. Citizens may challenge arguments through the Tribunal, inspect the full history of any debate, and trace each law\'s genesis through the chain of votes that created it. Transparency is not optional — it is structural.',
    color: 'purple',
    icon: Globe,
    stat: (s) => ({
      label: 'Arguments Filed',
      value: fmt(s.totalArguments),
      sub: `${s.argumentsPerVoter.toFixed(1)} arguments per active voter`,
    }),
    healthFn: (s) => {
      const ratio = s.argumentsPerVoter
      if (ratio >= 2) return 100
      if (ratio >= 1) return 80
      if (ratio >= 0.5) return 60
      if (ratio >= 0.1) return 40
      return 20
    },
  },
  {
    id: 4,
    romanNumeral: 'IV',
    title: 'The Principle of Immutable Record',
    principle:
      'Laws, once established by the people, are permanent. They are inscribed in the Codex and may only be superseded — never erased — by a new act of democratic consensus.',
    elaboration:
      'The Codex is the Lobby\'s permanent constitutional record. No administrator, no algorithm, and no faction may delete a law from its pages. A law may be effectively overturned by a new consensus topic that contradicts it, but its entry in the Codex endures as historical testimony of what the community believed and chose.',
    color: 'gold',
    icon: ScrollText,
    stat: (s) => ({
      label: 'Votes in the Record',
      value: fmt(s.totalVotes),
      sub: `Across ${fmt(s.totalTopics)} topics — every one permanent`,
    }),
    healthFn: () => 100,
  },
  {
    id: 5,
    romanNumeral: 'V',
    title: 'The Principle of Constructive Dissent',
    principle:
      'An "Against" vote is not a failure of democracy. It is democracy. Rejection is as legitimate an outcome as consensus, and the arguments that shape rejection are as valuable as those that build law.',
    elaboration:
      'This platform does not measure success by the number of laws passed. It measures it by the quality of the reasoning that precedes every outcome. A topic that fails to reach consensus has produced debate, illuminated disagreement, and helped the community understand where it cannot yet agree — which is itself an act of democratic intelligence.',
    color: 'against',
    icon: Scale,
    stat: (s) => ({
      label: 'Debates Hosted',
      value: fmt(s.totalDebates),
      sub: `On ${fmt(s.totalTopics)} contested propositions`,
    }),
    healthFn: (s) =>
      s.totalTopics > 0
        ? Math.min(100, 40 + Math.min(60, Math.round((s.totalDebates / Math.max(1, s.totalTopics)) * 200)))
        : 50,
  },
  {
    id: 6,
    romanNumeral: 'VI',
    title: 'The Principle of Civic Progression',
    principle:
      'Participation earns trust. Trust earns authority. Citizens who demonstrate good faith and depth of engagement are elevated by the community — not appointed from above.',
    elaboration:
      'The Lobby\'s role system — Citizen, Debater, Troll Catcher, Elder — is not a hierarchy of power. It is a system of civic recognition. Each role is earned through demonstrated participation, quality of argument, and peer endorsement. Authority here is a reward the community grants, not a position the platform assigns.',
    color: 'purple',
    icon: Trophy,
    stat: (s) => ({
      label: 'Elevated Citizens',
      value: fmt(
        s.roleBreakdown.debator +
          s.roleBreakdown.troll_catcher +
          s.roleBreakdown.elder,
      ),
      sub: `${s.roleBreakdown.troll_catcher} Troll Catchers · ${s.roleBreakdown.elder} Elders`,
    }),
    healthFn: (s) => {
      const total = s.totalUsers
      if (total === 0) return 50
      const elevated = s.roleBreakdown.debator + s.roleBreakdown.troll_catcher + s.roleBreakdown.elder
      const pct = (elevated / total) * 100
      return Math.min(100, 30 + Math.round(pct * 4))
    },
  },
  {
    id: 7,
    romanNumeral: 'VII',
    title: 'The Principle of Good Faith',
    principle:
      'Every citizen enters the Lobby under an implied covenant: to engage honestly, to argue earnestly, and to accept outcomes gracefully. Those who violate this covenant are not censored — they are held accountable by their peers.',
    elaboration:
      'The Lobby does not rely on platform administrators to police discourse. It relies on Troll Catchers — citizens who have earned the trust of the community to identify and address bad faith participation. Moderation here is a civic act, not a corporate one. The community governs itself.',
    color: 'emerald',
    icon: Shield,
    stat: (s) => ({
      label: 'Troll Catchers',
      value: fmt(s.roleBreakdown.troll_catcher),
      sub: `${s.activeDebaters} citizens engaged in active debate`,
    }),
    healthFn: (s) => {
      if (s.totalUsers === 0) return 50
      const trollCatcherRatio = (s.roleBreakdown.troll_catcher / s.totalUsers) * 1000
      return Math.min(100, 40 + Math.min(60, Math.round(trollCatcherRatio * 10)))
    },
  },
]

// ─── Color maps ────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  for: {
    text: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
    numeral: 'text-for-400',
    glow: 'shadow-for-500/10',
    pill: 'bg-for-500/15 text-for-300 border-for-500/30',
  },
  against: {
    text: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
    numeral: 'text-against-400',
    glow: 'shadow-against-500/10',
    pill: 'bg-against-500/15 text-against-300 border-against-500/30',
  },
  gold: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
    numeral: 'text-gold',
    glow: 'shadow-gold/10',
    pill: 'bg-gold/15 text-gold border-gold/30',
  },
  emerald: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    numeral: 'text-emerald',
    glow: 'shadow-emerald/10',
    pill: 'bg-emerald/15 text-emerald border-emerald/30',
  },
  purple: {
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    bar: 'bg-purple',
    numeral: 'text-purple',
    glow: 'shadow-purple/10',
    pill: 'bg-purple/15 text-purple border-purple/30',
  },
}

function healthLabel(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: 'Thriving', color: 'text-emerald' }
  if (pct >= 65) return { label: 'Healthy', color: 'text-for-400' }
  if (pct >= 45) return { label: 'Developing', color: 'text-gold' }
  if (pct >= 25) return { label: 'Fragile', color: 'text-against-400' }
  return { label: 'At Risk', color: 'text-against-300' }
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({
  article,
  stats,
  index,
}: {
  article: Article
  stats: DoctrineStats | null
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const c = COLOR_MAP[article.color]
  const Icon = article.icon

  const health = stats ? Math.round(article.healthFn(stats)) : null
  const stat = stats ? article.stat(stats) : null
  const hl = health !== null ? healthLabel(health) : null

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-shadow hover:shadow-lg',
        c.border,
        c.glow,
      )}
    >
      {/* ── Article header ───────────────────────────────────────────────────── */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Roman numeral */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl border',
              c.bg,
              c.border,
            )}
          >
            <Icon className={cn('h-5 w-5', c.text)} aria-hidden />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={cn(
                  'text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border',
                  c.pill,
                )}
              >
                Article {article.romanNumeral}
              </span>
              {hl && (
                <span className={cn('text-[10px] font-mono font-semibold', hl.color)}>
                  {hl.label}
                </span>
              )}
            </div>
            <h2 className="font-mono text-base font-bold text-white leading-snug">
              {article.title}
            </h2>
          </div>
        </div>

        {/* Principle statement */}
        <blockquote
          className={cn(
            'mt-4 rounded-xl border p-4',
            c.bg,
            c.border,
          )}
        >
          <p className={cn('text-sm font-mono font-medium leading-relaxed italic', c.text)}>
            &ldquo;{article.principle}&rdquo;
          </p>
        </blockquote>

        {/* Health bar */}
        {health !== null && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                Principle Health
              </span>
              <span className={cn('text-xs font-mono font-bold tabular-nums', hl?.color)}>
                {health}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${health}%` }}
                transition={{ delay: index * 0.06 + 0.3, duration: 0.7, ease: 'easeOut' }}
                className={cn('h-full rounded-full', c.bar)}
              />
            </div>
          </div>
        )}

        {/* Live stat */}
        {stat && (
          <div className={cn('mt-4 rounded-xl border px-4 py-3', c.bg, c.border)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-0.5">
                  {stat.label}
                </div>
                <div className={cn('text-2xl font-mono font-bold tabular-nums', c.text)}>
                  {stat.value}
                </div>
                <div className="text-[11px] font-mono text-surface-400 mt-0.5">{stat.sub}</div>
              </div>
              <BarChart2 className="h-8 w-8 text-surface-600 flex-shrink-0" aria-hidden />
            </div>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="mt-4 flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse article' : 'Read full article'}
        >
          {expanded ? (
            <>Hide elaboration <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Read elaboration <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </button>
      </div>

      {/* ── Expanded elaboration ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300 px-6 py-5">
              <p className="text-sm font-mono text-surface-400 leading-relaxed">
                {article.elaboration}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArticleSkeleton({ index }: { index: number }) {
  return (
    <div
      className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-4 animate-pulse"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-surface-300/50 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-20 rounded-full bg-surface-300/50" />
          <div className="h-5 w-3/4 rounded bg-surface-300/50" />
        </div>
      </div>
      <div className="rounded-xl h-16 bg-surface-300/30" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-surface-300/50 rounded" />
          <div className="h-3 w-8 bg-surface-300/50 rounded" />
        </div>
        <div className="h-1.5 w-full bg-surface-300/50 rounded-full" />
      </div>
      <div className="h-12 rounded-xl bg-surface-300/30" />
    </div>
  )
}

// ─── Doctrine health overview ─────────────────────────────────────────────────

function DoctrineHealthBanner({ stats }: { stats: DoctrineStats }) {
  const healthValues = ARTICLES.map((a) => Math.round(a.healthFn(stats)))
  const avgHealth = Math.round(healthValues.reduce((s, v) => s + v, 0) / healthValues.length)
  const hl = healthLabel(avgHealth)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-8"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
          <Sparkles className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div>
          <h2 className="font-mono text-base font-bold text-white">Doctrine Health Score</h2>
          <p className="text-xs font-mono text-surface-500 mt-0.5">
            How well the Lobby is living up to its founding principles
          </p>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-3xl font-bold text-gold tabular-nums">{avgHealth}%</div>
          <div className={cn('text-xs font-mono font-semibold mt-0.5', hl.color)}>{hl.label}</div>
        </div>
      </div>

      {/* Per-article mini bars */}
      <div className="space-y-2">
        {ARTICLES.map((a, i) => {
          const h = healthValues[i]
          const c = COLOR_MAP[a.color]
          return (
            <div key={a.id} className="flex items-center gap-3">
              <span className={cn('text-[10px] font-mono w-4 text-right flex-shrink-0', c.numeral)}>
                {a.romanNumeral}
              </span>
              <div className="flex-1 h-1 rounded-full bg-surface-300">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${h}%` }}
                  transition={{ delay: 0.2 + i * 0.04, duration: 0.5, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', c.bar)}
                />
              </div>
              <span className="text-[10px] font-mono text-surface-500 tabular-nums w-7 text-right flex-shrink-0">
                {h}%
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-200 border border-surface-300 px-3 py-2.5 text-center">
          <div className="font-mono text-lg font-bold text-white">{fmt(stats.totalVotes)}</div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5">Votes cast</div>
        </div>
        <div className="rounded-xl bg-surface-200 border border-surface-300 px-3 py-2.5 text-center">
          <div className="font-mono text-lg font-bold text-gold">{fmt(stats.totalLaws)}</div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5">Laws established</div>
        </div>
        <div className="rounded-xl bg-surface-200 border border-surface-300 px-3 py-2.5 text-center">
          <div className="font-mono text-lg font-bold text-emerald">{fmt(stats.totalUsers)}</div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5">Citizens</div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Affirmation button ───────────────────────────────────────────────────────

const AFFIRMATION_KEY = 'lm_doctrine_affirmed'

function AffirmationBanner() {
  const [affirmed, setAffirmed] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    try {
      setAffirmed(!!localStorage.getItem(AFFIRMATION_KEY))
    } catch {
      // ignore
    }
  }, [])

  function handleAffirm() {
    try {
      localStorage.setItem(AFFIRMATION_KEY, new Date().toISOString())
    } catch {
      // ignore
    }
    setAffirmed(true)
    setShowConfirm(true)
    setTimeout(() => setShowConfirm(false), 3000)
  }

  if (affirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-10 rounded-2xl border border-emerald/30 bg-emerald/5 p-6 text-center"
      >
        <CheckCircle2 className="h-6 w-6 text-emerald mx-auto mb-3" aria-hidden />
        <h2 className="font-mono text-base font-bold text-white mb-1">
          You have affirmed the Civic Doctrine
        </h2>
        <p className="text-xs font-mono text-surface-500 mb-4">
          Your commitment to these principles is part of the Lobby&apos;s foundation.
        </p>
        <Link
          href="/oath"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald/30 bg-emerald/10 text-emerald text-sm font-mono font-semibold hover:bg-emerald/20 transition-colors"
        >
          Take the Civic Oath
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-2xl border border-gold/30 bg-gold/5 p-6"
    >
      <div className="flex items-start gap-4 mb-5">
        <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
          <Star className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div>
          <h2 className="font-mono text-base font-bold text-white mb-1">
            Affirm the Civic Doctrine
          </h2>
          <p className="text-sm font-mono text-surface-400 leading-relaxed">
            Declare that you have read, understood, and commit to upholding these
            seven principles in your participation on Lobby Market.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-xl bg-emerald/10 border border-emerald/30 px-4 py-3 flex items-center gap-2"
          >
            <Check className="h-4 w-4 text-emerald flex-shrink-0" aria-hidden />
            <span className="text-sm font-mono text-emerald">
              Affirmed. Welcome to the Lobby, citizen.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleAffirm}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl',
            'bg-gold hover:bg-gold/90 text-surface-50 text-sm font-mono font-bold',
            'transition-colors shadow-lg shadow-gold/20',
          )}
        >
          <Check className="h-4 w-4" aria-hidden />
          I affirm these principles
        </button>
        <Link
          href="/oath"
          className={cn(
            'flex items-center justify-center gap-2 px-5 py-3 rounded-xl',
            'bg-surface-200 hover:bg-surface-300 border border-surface-300',
            'text-surface-400 hover:text-white text-sm font-mono font-semibold',
            'transition-colors',
          )}
        >
          Take the full Civic Oath
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CivicDoctrineClient() {
  const [stats, setStats] = useState<DoctrineStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/civic-doctrine')
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as DoctrineStats
      setStats(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Masthead ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <BookOpen className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                The Civic Doctrine
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                The founding principles of the Lobby — in seven articles
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
            <p className="text-sm font-mono text-surface-400 leading-relaxed mb-3">
              The Civic Doctrine is the governing charter of Lobby Market. It establishes
              the philosophical foundations of democratic participation on this platform —
              the principles that every vote, every argument, and every law must honour.
            </p>
            <p className="text-sm font-mono text-surface-400 leading-relaxed">
              These seven articles are not aspirations. They are the structural commitments
              built into how this platform works. The health scores below show, in live
              platform data, how well the Lobby is living up to its own founding ideals.
            </p>

            {/* Provenance strip */}
            <div className="mt-4 flex items-center gap-3 pt-4 border-t border-surface-300">
              <div className="flex h-6 w-6 rounded-full overflow-hidden flex-shrink-0">
                <div className="flex-1 bg-for-500" />
                <div className="flex-1 bg-against-500" />
              </div>
              <span className="text-[11px] font-mono text-surface-500">
                Established by the founding community · Lobby Market · 2025
              </span>
              {!loading && !error && (
                <button
                  onClick={load}
                  title="Refresh stats"
                  className="ml-auto text-surface-600 hover:text-surface-400 transition-colors"
                  aria-label="Refresh doctrine health stats"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Doctrine health overview ──────────────────────────────────────────── */}
        {loading ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-8 animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-surface-300/50 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-surface-300/50 rounded" />
                <div className="h-3 w-56 bg-surface-300/50 rounded" />
              </div>
              <div className="h-10 w-16 bg-surface-300/50 rounded" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-4 bg-surface-300/50 rounded" />
                  <div className="flex-1 h-1 bg-surface-300/50 rounded-full" />
                  <div className="h-3 w-7 bg-surface-300/50 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-5 mb-8 text-center">
            <Zap className="h-5 w-5 text-against-400 mx-auto mb-2" aria-hidden />
            <p className="text-sm font-mono text-surface-400 mb-3">Couldn&apos;t load health stats</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </div>
        ) : stats ? (
          <DoctrineHealthBanner stats={stats} />
        ) : null}

        {/* ── Seven articles ────────────────────────────────────────────────────── */}
        <section aria-label="The Seven Articles of the Civic Doctrine">
          <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-4">
            The Seven Articles
          </h2>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <ArticleSkeleton key={i} index={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {ARTICLES.map((article, i) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  stats={stats}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Affirmation ───────────────────────────────────────────────────────── */}
        {!loading && <AffirmationBanner />}

        {/* ── Related links ─────────────────────────────────────────────────────── */}
        {!loading && (
          <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            aria-label="Related civic pages"
            className="mt-8 grid grid-cols-2 gap-3"
          >
            {[
              { href: '/civic-oath', label: 'Civic Oath', icon: Star, color: 'text-gold' },
              { href: '/manifesto', label: 'Your Manifesto', icon: ScrollText, color: 'text-purple' },
              { href: '/transparency', label: 'Transparency', icon: Globe, color: 'text-for-400' },
              { href: '/law', label: 'The Codex', icon: Gavel, color: 'text-emerald' },
              { href: '/grand-council', label: 'Grand Council', icon: Trophy, color: 'text-gold' },
              { href: '/accountability', label: 'Accountability', icon: Shield, color: 'text-against-400' },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 hover:bg-surface-200 transition-colors group"
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', color)} aria-hidden />
                <span>{label}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
              </Link>
            ))}
          </motion.nav>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
