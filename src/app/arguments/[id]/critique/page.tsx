'use client'

/**
 * /arguments/[id]/critique — AI Argument Critique Breakdown
 *
 * Generates a full per-dimension AI critique of a community argument:
 *   • Overall score (1-10) and letter grade
 *   • Four-dimension analysis: Clarity, Evidence, Logic, Persuasion
 *   • What the argument does best
 *   • Specific actionable improvement suggestions
 *   • Percentile rank among all graded arguments
 *
 * Distinct from:
 *   /coach           — workshop for drafting NEW arguments before posting
 *   /spar/[id]       — live AI debate opponent
 *   /argue           — AI-generated argument starters for a topic
 *
 * This is a post-hoc analysis of an already-posted argument — useful for
 * understanding WHY it got a particular grade and how to improve.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentCritiqueData,
  ArgumentCritiqueResponse,
  CritiqueDimension,
} from '@/app/api/arguments/[id]/critique/route'

// ─── Grade config ──────────────────────────────────────────────

const GRADE_CONFIG: Record<
  string,
  { text: string; bg: string; border: string; bar: string; label: string; description: string }
> = {
  A: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    label: 'Exceptional',
    description: 'This argument is compelling, specific, and well-evidenced.',
  },
  B: {
    text: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-400',
    label: 'Strong',
    description: 'Clear and reasoned with only minor gaps.',
  },
  C: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
    label: 'Adequate',
    description: 'Makes a point but lacks depth or supporting evidence.',
  },
  D: {
    text: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-400',
    label: 'Weak',
    description: 'Vague assertion with logical gaps that need addressing.',
  },
  F: {
    text: 'text-against-400',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    bar: 'bg-against-600',
    label: 'Poor',
    description: 'Unsupported, unclear, or contains logical fallacies.',
  },
}

// ─── Dimension config ─────────────────────────────────────────────

const DIMENSION_CONFIG: Record<
  string,
  { icon: typeof Brain; color: string; bar: string; description: string }
> = {
  Clarity: {
    icon: BookOpen,
    color: 'text-for-400',
    bar: 'bg-for-500',
    description: 'How clearly and accessibly the point is expressed',
  },
  Evidence: {
    icon: BarChart2,
    color: 'text-emerald',
    bar: 'bg-emerald',
    description: 'Quality and quantity of supporting evidence or citations',
  },
  Logic: {
    icon: Brain,
    color: 'text-purple',
    bar: 'bg-purple',
    description: 'Soundness of the reasoning and absence of fallacies',
  },
  Persuasion: {
    icon: Flame,
    color: 'text-gold',
    bar: 'bg-gold',
    description: 'How convincing this would be to an undecided voter',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────

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

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}
const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Score ring SVG ──────────────────────────────────────────────

function ScoreRing({
  score,
  grade,
  animate,
}: {
  score: number
  grade: string
  animate: boolean
}) {
  const gradeCfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG.C
  const pct = (score / 10) * 100
  const radius = 44
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" className="-rotate-90">
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-surface-300"
        />
        <motion.circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={gradeCfg.bar.replace('bg-', 'text-')}
          stroke="currentColor"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={animate ? { strokeDashoffset: circ - dash } : { strokeDashoffset: circ }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-mono font-black', gradeCfg.text)}>{grade}</span>
        <span className="text-xs font-mono text-surface-500">{score}/10</span>
      </div>
    </div>
  )
}

// ─── Dimension bar ───────────────────────────────────────────────────

function DimensionBar({
  dim,
  animate,
  delay,
}: {
  dim: CritiqueDimension
  animate: boolean
  delay: number
}) {
  const cfg = DIMENSION_CONFIG[dim.name] ?? {
    icon: Brain,
    color: 'text-surface-400',
    bar: 'bg-surface-400',
    description: '',
  }
  const Icon = cfg.icon
  const pct = Math.round((dim.score / 10) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', cfg.color)} aria-hidden />
          <span className="text-sm font-mono font-semibold text-white">{dim.name}</span>
          <span className="text-[10px] font-mono text-surface-500 hidden sm:inline">
            {cfg.description}
          </span>
        </div>
        <span className={cn('text-sm font-mono font-bold', cfg.color)}>
          {dim.score}/10
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden mb-3">
        <motion.div
          className={cn('h-full rounded-full', cfg.bar)}
          initial={{ width: '0%' }}
          animate={animate ? { width: `${pct}%` } : { width: '0%' }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
        />
      </div>
      <p className="text-xs font-mono text-surface-500 leading-relaxed">{dim.feedback}</p>
    </motion.div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function ArgumentCritiquePage() {
  const params = useParams()
  const router = useRouter()
  const argId = params?.id as string

  const [argData, setArgData] = useState<ArgumentCritiqueData | null>(null)
  const [critique, setCritique] = useState<ArgumentCritiqueResponse['critique']>(null)
  const [percentile, setPercentile] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadArgument = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/arguments/${argId}/critique`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Failed to load argument')
        return
      }
      const data: ArgumentCritiqueResponse = await res.json()
      setArgData(data.argument)
      setCritique(data.critique)
      setPercentile(data.percentile)
    } catch {
      setError('Failed to load argument')
    } finally {
      setLoading(false)
    }
  }, [argId])

  useEffect(() => {
    if (argId) loadArgument()
  }, [argId, loadArgument])

  const generateCritique = useCallback(async () => {
    if (!argData || generating) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/arguments/${argId}/critique`, { method: 'POST' })
      const data: ArgumentCritiqueResponse = await res.json()
      if (data.unavailable) {
        setUnavailable(true)
        return
      }
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'AI evaluation failed')
        return
      }
      setArgData(data.argument)
      setCritique(data.critique)
      setPercentile(data.percentile)
      setAnimating(true)
    } catch {
      setError('AI evaluation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [argId, argData, generating])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <Skeleton className="h-5 w-40 mb-8" />
          <Skeleton className="h-7 w-2/3 mb-3" />
          <Skeleton className="h-4 w-1/3 mb-6" />
          <Skeleton className="h-28 w-full rounded-2xl mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error && !argData) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-16 pb-24 text-center">
          <Brain className="h-10 w-10 text-surface-500 mx-auto mb-4" />
          <h1 className="font-mono text-xl font-bold text-white mb-2">Argument not found</h1>
          <p className="text-sm text-surface-500 font-mono mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!argData) return null

  const isFor = argData.side === 'blue'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const sideDot = isFor ? 'bg-for-500' : 'bg-against-500'
  const SideIcon = isFor ? ThumbsUp : ThumbsDown

  const existingGrade = argData.ai_grade
  const existingScore = argData.ai_score
  const gradeCfg = existingGrade ? (GRADE_CONFIG[existingGrade] ?? GRADE_CONFIG.C) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">

        <Link
          href={`/arguments/${argId}`}
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to argument
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Brain className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">AI Critique</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Detailed analysis of argument quality across four dimensions
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={STATUS_BADGE[argData.topic.status] ?? 'proposed'}>
              {STATUS_LABEL[argData.topic.status] ?? argData.topic.status}
            </Badge>
            {argData.topic.category && (
              <span className="text-[11px] font-mono text-surface-500">{argData.topic.category}</span>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <ThumbsUp className="h-3 w-3 text-for-400" />
              <span className="text-[11px] font-mono text-for-400">{Math.round(argData.topic.blue_pct)}%</span>
              <span className="text-[11px] font-mono text-surface-600 ml-1">
                {argData.topic.total_votes.toLocaleString()} votes
              </span>
            </div>
          </div>
          <Link
            href={`/topic/${argData.topic.id}`}
            className="text-sm font-mono text-surface-700 hover:text-white transition-colors line-clamp-2"
          >
            {argData.topic.statement}
          </Link>
        </div>

        <div className={cn('rounded-2xl border p-5 mb-6', sideBg, sideBorder)}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                'text-[11px] font-mono font-bold tracking-widest uppercase',
                'border',
                sideBg, sideBorder, sideColor
              )}
            >
              <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', sideDot)} />
              <SideIcon className="h-3 w-3" aria-hidden />
              {sideLabel}
            </div>
            {existingGrade && gradeCfg && (
              <div
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono font-bold border',
                  gradeCfg.bg, gradeCfg.border, gradeCfg.text
                )}
              >
                <Brain className="h-3 w-3" aria-hidden />
                Grade {existingGrade}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2 text-[11px] font-mono text-surface-500">
              <span>{argData.upvotes} upvotes</span>
              <span>·</span>
              <span>{relativeTime(argData.created_at)}</span>
            </div>
          </div>

          <p className="text-white text-sm leading-relaxed font-medium whitespace-pre-wrap">
            {argData.content}
          </p>

          {argData.author && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-300/30">
              <Avatar
                src={argData.author.avatar_url}
                fallback={argData.author.display_name || argData.author.username}
                size="xs"
              />
              <Link
                href={`/profile/${argData.author.username}`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                @{argData.author.username}
              </Link>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {critique ? (
            <motion.div
              key="critique-result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              <div className={cn(
                'rounded-2xl border p-6',
                gradeCfg ? gradeCfg.bg : 'bg-surface-200/40',
                gradeCfg ? gradeCfg.border : 'border-surface-300/60',
              )}>
                <div className="flex items-center gap-6">
                  <ScoreRing
                    score={critique.score}
                    grade={critique.grade}
                    animate={animating}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-lg font-mono font-bold', gradeCfg?.text ?? 'text-white')}>
                        {gradeCfg?.label ?? 'Graded'}
                      </span>
                      <Brain className={cn('h-4 w-4', gradeCfg?.text ?? 'text-surface-400')} />
                    </div>
                    <p className="text-sm font-mono text-surface-500 leading-relaxed">
                      {critique.summary}
                    </p>
                    {percentile !== null && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-300/50 border border-surface-400/30">
                        <Trophy className="h-3 w-3 text-gold" />
                        <span className="text-[11px] font-mono text-gold font-semibold">
                          Better than {percentile}% of graded arguments
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {critique.strong_point && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl border border-emerald/25 bg-emerald/8 p-4"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald uppercase tracking-wider mb-1 block">
                        Strongest point
                      </span>
                      <p className="text-sm font-mono text-surface-600 leading-relaxed">
                        {critique.strong_point}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div>
                <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Dimension breakdown
                </h2>
                <div className="space-y-3">
                  {critique.dimensions.map((dim, i) => (
                    <DimensionBar
                      key={dim.name}
                      dim={dim}
                      animate={animating}
                      delay={0.15 + i * 0.1}
                    />
                  ))}
                </div>
              </div>

              {critique.suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="rounded-xl border border-gold/25 bg-gold/8 p-4"
                >
                  <h2 className="text-xs font-mono font-bold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5" />
                    How to improve
                  </h2>
                  <ul className="space-y-2">
                    {critique.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-gold font-mono text-xs font-bold mt-0.5 flex-shrink-0">
                          {i + 1}.
                        </span>
                        <p className="text-sm font-mono text-surface-600 leading-relaxed">{s}</p>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex flex-wrap gap-3 pt-2"
              >
                <button
                  onClick={() => { setCritique(null); setAnimating(false) }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold border border-surface-400/40 bg-surface-200/40 text-surface-500 hover:text-white hover:border-surface-400 transition-all"
                >
                  <RefreshCw className="h-3 w-3" />
                  Re-run critique
                </button>
                <Link
                  href={`/coach`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold border border-purple/30 bg-purple/10 text-purple hover:bg-purple/20 transition-all"
                >
                  <GraduationCap className="h-3 w-3" />
                  Argument Coach
                  <ChevronRight className="h-3 w-3" />
                </Link>
                <Link
                  href={`/topic/${argData.topic.id}/arguments`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold border border-surface-400/40 bg-surface-200/40 text-surface-500 hover:text-white hover:border-surface-400 transition-all"
                >
                  <MessageSquare className="h-3 w-3" />
                  See all arguments
                  <ExternalLink className="h-3 w-3 ml-0.5" />
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="critique-prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {existingGrade && gradeCfg && existingScore !== null && (
                <div className={cn('rounded-2xl border p-5 flex items-center gap-5', gradeCfg.bg, gradeCfg.border)}>
                  <div className="flex flex-col items-center justify-center h-16 w-16 rounded-xl border flex-shrink-0"
                    style={{ borderColor: 'inherit' }}
                  >
                    <span className={cn('text-3xl font-mono font-black', gradeCfg.text)}>
                      {existingGrade}
                    </span>
                    <span className="text-[11px] font-mono text-surface-500">{existingScore}/10</span>
                  </div>
                  <div>
                    <p className={cn('text-sm font-mono font-bold', gradeCfg.text)}>{gradeCfg.label}</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">
                      {gradeCfg.description}
                    </p>
                    {percentile !== null && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-gold">
                        <Trophy className="h-3 w-3" />
                        Better than {percentile}% of graded arguments
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-5">
                <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5" />
                  What the critique analyses
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(DIMENSION_CONFIG).map(([name, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <div key={name} className="flex items-start gap-2">
                        <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', cfg.color)} />
                        <div>
                          <p className={cn('text-xs font-mono font-semibold', cfg.color)}>{name}</p>
                          <p className="text-[11px] font-mono text-surface-500 leading-snug mt-0.5">
                            {cfg.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-center">
                  <p className="text-sm font-mono text-against-400">{error}</p>
                </div>
              )}

              {unavailable && (
                <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-5 text-center">
                  <Brain className="h-8 w-8 text-surface-500 mx-auto mb-2" />
                  <p className="text-sm font-mono text-surface-500">
                    AI critique is not available in this environment.
                  </p>
                </div>
              )}

              {!unavailable && (
                <button
                  onClick={generateCritique}
                  disabled={generating}
                  className={cn(
                    'w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl',
                    'font-mono text-sm font-bold',
                    'border transition-all',
                    generating
                      ? 'bg-surface-300/50 border-surface-400/30 text-surface-500 cursor-not-allowed'
                      : 'bg-purple/15 border-purple/40 text-purple hover:bg-purple/25 hover:border-purple/60'
                  )}
                  aria-busy={generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Analysing argument…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" aria-hidden />
                      Generate AI Critique
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}

              <p className="text-center text-[11px] font-mono text-surface-600">
                Powered by Claude · Results are saved to this argument
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href="/coach"
                  className="flex items-center gap-2 p-3 rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/40 transition-all group"
                >
                  <GraduationCap className="h-4 w-4 text-purple flex-shrink-0" />
                  <div>
                    <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                      Argument Coach
                    </p>
                    <p className="text-[10px] font-mono text-surface-500">Draft &amp; improve</p>
                  </div>
                </Link>
                <Link
                  href={`/topic/${argData.topic.id}/argue`}
                  className="flex items-center gap-2 p-3 rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-300/40 transition-all group"
                >
                  <Zap className="h-4 w-4 text-gold flex-shrink-0" />
                  <div>
                    <p className="text-xs font-mono font-semibold text-white group-hover:text-gold transition-colors">
                      AI Starters
                    </p>
                    <p className="text-[10px] font-mono text-surface-500">New argument ideas</p>
                  </div>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
