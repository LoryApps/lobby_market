'use client'

/**
 * /training — Civic Argument Skills Trainer
 *
 * Three interactive drill modes to sharpen debate and critical thinking:
 *   1. Fallacy Spotter  — identify the logical fallacy in an argument
 *   2. Argument Ranker  — pick the stronger of two arguments on the same topic
 *   3. Vote Calibration — vote on a topic, then see where the community stands
 *
 * Progress is stored in localStorage. All three drills are self-contained
 * and work for both authenticated and anonymous users.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type DrillMode = 'hub' | 'fallacy' | 'ranker' | 'calibration'
type Phase = 'question' | 'feedback' | 'complete'

interface FallacyCase {
  id: number
  argument: string
  topic: string
  correctFallacy: string
  explanation: string
  distractors: string[]
  difficulty: 1 | 2 | 3
}

interface RankerCase {
  id: number
  topic: string
  category: string
  argumentA: string
  argumentB: string
  strongerSide: 'A' | 'B'
  explanation: string
}

interface CalibrationTopic {
  id: number
  statement: string
  category: string
  communityFor: number
}

interface DrillProgress {
  fallacy: { score: number; total: number; lastPlayed: string | null }
  ranker: { score: number; total: number; lastPlayed: string | null }
  calibration: { score: number; total: number; lastPlayed: string | null }
}

// ─── Training content ─────────────────────────────────────────────────────────

const FALLACY_CASES: FallacyCase[] = [
  {
    id: 1,
    topic: 'Climate Policy',
    argument:
      "Senator Walsh has been pushing for stricter emissions standards for years, but she flies a private jet. Why should we listen to anything she says about carbon policy?",
    correctFallacy: 'Ad Hominem',
    explanation: 'This attacks the person\'s behavior rather than addressing the substance of the emissions policy argument.',
    distractors: ['Straw Man', 'Slippery Slope', 'False Dichotomy'],
    difficulty: 1,
  },
  {
    id: 2,
    topic: 'Universal Healthcare',
    argument:
      "If we allow the government to regulate healthcare, next they'll control what we eat, what we wear, and eventually every aspect of our lives.",
    correctFallacy: 'Slippery Slope',
    explanation: 'This assumes a chain of increasingly extreme consequences without evidence for each step.',
    distractors: ['Ad Hominem', 'Appeal to Authority', 'Bandwagon'],
    difficulty: 1,
  },
  {
    id: 3,
    topic: 'Minimum Wage',
    argument:
      "Either we raise the minimum wage to $25/hr or workers will continue to starve. There's no middle ground here.",
    correctFallacy: 'False Dichotomy',
    explanation: 'This presents only two extreme options when many intermediate policies exist.',
    distractors: ['Straw Man', 'Circular Reasoning', 'Ad Hominem'],
    difficulty: 1,
  },
  {
    id: 4,
    topic: 'Drug Policy',
    argument:
      "Most Americans now support marijuana legalization, so clearly it should be legal everywhere. The people have spoken.",
    correctFallacy: 'Bandwagon',
    explanation: 'Popularity does not determine correctness — this confuses majority opinion with valid reasoning.',
    distractors: ['Appeal to Authority', 'False Dichotomy', 'Red Herring'],
    difficulty: 2,
  },
  {
    id: 5,
    topic: 'Tax Reform',
    argument:
      "My opponent claims we need tax reform, but what they're really saying is they want to destroy small businesses and eliminate the middle class entirely.",
    correctFallacy: 'Straw Man',
    explanation: 'This misrepresents the opponent\'s position as something more extreme than what was actually said.',
    distractors: ['Ad Hominem', 'Slippery Slope', 'Bandwagon'],
    difficulty: 1,
  },
  {
    id: 6,
    topic: 'Electoral Reform',
    argument:
      "Ranked choice voting is better because it produces better outcomes, and the reason it produces better outcomes is that it's a superior voting system.",
    correctFallacy: 'Circular Reasoning',
    explanation: 'This uses the conclusion ("better") as a premise for itself — the argument goes in a circle with no external evidence.',
    distractors: ['False Dichotomy', 'Hasty Generalization', 'Appeal to Authority'],
    difficulty: 2,
  },
  {
    id: 7,
    topic: 'Education Policy',
    argument:
      "Professor Chen, who has a PhD in educational psychology, says standardized testing is harmful. Therefore, we should abolish all standardized tests immediately.",
    correctFallacy: 'Appeal to Authority',
    explanation: 'While expertise is relevant, citing one authority without engaging with their evidence or counter-arguments is a logical shortcut.',
    distractors: ['Ad Hominem', 'Bandwagon', 'Red Herring'],
    difficulty: 2,
  },
  {
    id: 8,
    topic: 'Immigration Policy',
    argument:
      "The real problem with the immigration debate is that our city's potholes haven't been fixed in three years, and something needs to be done about our roads.",
    correctFallacy: 'Red Herring',
    explanation: 'Introducing road conditions is an irrelevant distraction from the immigration policy discussion.',
    distractors: ['Straw Man', 'False Dichotomy', 'Circular Reasoning'],
    difficulty: 2,
  },
  {
    id: 9,
    topic: 'Criminal Justice',
    argument:
      "Three of my neighbors were victims of theft after prison sentence reductions passed. This proves that reducing sentences increases crime.",
    correctFallacy: 'Hasty Generalization',
    explanation: 'Drawing broad policy conclusions from three anecdotal cases ignores base rates and correlation vs. causation.',
    distractors: ['Ad Hominem', 'Slippery Slope', 'Bandwagon'],
    difficulty: 2,
  },
  {
    id: 10,
    topic: 'Healthcare Access',
    argument:
      "The DMV takes weeks to process paperwork, so clearly the government can't run healthcare. Both are just administrative services, after all.",
    correctFallacy: 'False Equivalence',
    explanation: 'The DMV and a healthcare system differ fundamentally in complexity, incentives, and structure — treating them as equivalent is misleading.',
    distractors: ['Straw Man', 'Appeal to Authority', 'Hasty Generalization'],
    difficulty: 3,
  },
  {
    id: 11,
    topic: 'Housing Policy',
    argument:
      "Economists at the National Policy Institute say rent control reduces housing quality. Therefore rent control should be abolished everywhere.",
    correctFallacy: 'Appeal to Authority',
    explanation: 'One institute\'s findings are relevant but not conclusive — this skips engaging with the full body of evidence and context.',
    distractors: ['Hasty Generalization', 'Red Herring', 'Circular Reasoning'],
    difficulty: 3,
  },
  {
    id: 12,
    topic: 'Free Speech',
    argument:
      "You support restricting misinformation? So you want the government to decide what is true and imprison anyone who disagrees with the official narrative.",
    correctFallacy: 'Straw Man',
    explanation: 'This wildly exaggerates a nuanced policy position (misinformation rules) into censorship and imprisonment.',
    distractors: ['Slippery Slope', 'False Dichotomy', 'Ad Hominem'],
    difficulty: 3,
  },
]

const RANKER_CASES: RankerCase[] = [
  {
    id: 1,
    topic: 'Should the minimum wage be raised to $15/hour?',
    category: 'Economics',
    argumentA:
      'Raising the minimum wage would help workers afford basic necessities. Low wages are unfair and companies should pay more.',
    argumentB:
      'A federal $15 minimum wage would lift 900,000 workers out of poverty according to the CBO, while affecting 1.4 million jobs — a trade-off that 58 regional economists surveyed say favors areas with higher costs of living over rural regions.',
    strongerSide: 'B',
    explanation: 'Argument B cites specific data, acknowledges trade-offs, and adds geographic nuance. Argument A is emotionally valid but vague.',
  },
  {
    id: 2,
    topic: 'Should social media companies be regulated like public utilities?',
    category: 'Technology',
    argumentA:
      'When a platform has 3 billion users and controls what information billions see daily, its infrastructure becomes as essential as power or water. Utility regulation — rate transparency, non-discrimination, and basic service guarantees — addresses platform power without requiring content censorship.',
    argumentB:
      'Social media should not be regulated because it would destroy innovation and no one is forced to use these platforms. Regulation always goes too far.',
    strongerSide: 'A',
    explanation: 'Argument A defines a specific regulatory model and addresses the scale problem. Argument B uses a slippery slope and ignores the network effects that make "choosing not to use" increasingly costly.',
  },
  {
    id: 3,
    topic: 'Should voting be mandatory for all citizens?',
    category: 'Politics',
    argumentA:
      'Mandatory voting undermines freedom — people should have the right not to vote just as much as the right to vote.',
    argumentB:
      'Compulsory voting removes the strategic incentive to suppress or demobilize voters, since turnout is guaranteed. Australia has operated mandatory voting since 1924 with 90%+ participation and no documented collapse of personal freedom.',
    strongerSide: 'B',
    explanation: 'Argument B provides a historical example, specific mechanisms, and addresses a concrete harm. Argument A raises a valid liberty concern but without evidence that mandatory voting actually suppresses freedom.',
  },
  {
    id: 4,
    topic: 'Should the US transition to 100% renewable energy by 2035?',
    category: 'Environment',
    argumentA:
      'Climate change is an existential threat and we need to act now. Every year we delay costs more lives. A 2035 target sends a clear signal.',
    argumentB:
      'A 2035 full-transition is technically achievable given current grid storage capacity and renewable buildout rates, but would require $4.5T in infrastructure investment and new transmission lines across 47 states. The 2040 IPCC pathway achieves comparable emissions reductions with lower grid stability risk during transition.',
    strongerSide: 'B',
    explanation: 'Argument B engages with the specific timeline, quantifies the cost, and presents an evidence-based alternative. Argument A\'s urgency is valid but doesn\'t address why 2035 specifically is the right target.',
  },
  {
    id: 5,
    topic: 'Should college education be tuition-free?',
    category: 'Education',
    argumentA:
      'Free college worked in Germany. If it works there, it can work here. The government spends money on all sorts of things — why not education?',
    argumentB:
      'Germany\'s tuition-free model succeeds in part because admissions are selective and degree programs are vocationally aligned. A direct US transplant would need to address the community college vs. 4-year distinction, existing Pell Grant infrastructure, and state-level funding variation — otherwise the subsidy primarily benefits already-advantaged 4-year students.',
    strongerSide: 'B',
    explanation: 'Argument B engages with the German example properly and identifies the structural differences that matter for policy transfer. Argument A uses the comparison too loosely.',
  },
  {
    id: 6,
    topic: 'Should term limits be imposed on Supreme Court justices?',
    category: 'Politics',
    argumentA:
      'Eighteen-year staggered terms would ensure every presidential term can appoint at least two justices, normalizing the appointment process and reducing the outsized influence of individual retirements or deaths on court composition — a reform supported by 80% of Americans across partisan lines.',
    argumentB:
      'Term limits would make justices politically accountable at the end of their tenure, potentially politicizing their final years. Life tenure was designed to insulate them from short-term political pressure.',
    strongerSide: 'A',
    explanation: 'Both arguments are substantive, but Argument A proposes a specific mechanism (staggered 18-year terms) and includes polling support. Argument B raises a real concern but doesn\'t engage with how current life tenure has already produced politically strategic timing of retirements.',
  },
]

const CALIBRATION_TOPICS: CalibrationTopic[] = [
  { id: 1, statement: 'The federal minimum wage should be raised to at least $15 per hour', category: 'Economics', communityFor: 68 },
  { id: 2, statement: 'The United States should implement a carbon tax on fossil fuel emissions', category: 'Environment', communityFor: 61 },
  { id: 3, statement: 'Ranked-choice voting should replace first-past-the-post in federal elections', category: 'Politics', communityFor: 57 },
  { id: 4, statement: 'The government should provide universal basic income to all adult citizens', category: 'Economics', communityFor: 44 },
  { id: 5, statement: 'Social media companies should be liable for harmful content on their platforms', category: 'Technology', communityFor: 63 },
  { id: 6, statement: 'Public universities should be tuition-free for all citizens', category: 'Education', communityFor: 52 },
  { id: 7, statement: 'The United States should reduce military spending by at least 20%', category: 'Politics', communityFor: 38 },
  { id: 8, statement: 'Marijuana should be fully legalized at the federal level', category: 'Policy', communityFor: 71 },
]

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_training_progress_v2'

function loadProgress(): DrillProgress {
  const empty: DrillProgress = {
    fallacy: { score: 0, total: 0, lastPlayed: null },
    ranker: { score: 0, total: 0, lastPlayed: null },
    calibration: { score: 0, total: 0, lastPlayed: null },
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DrillProgress) : empty
  } catch {
    return empty
  }
}

function saveProgress(p: DrillProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch { /* best-effort */ }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function skillLevel(score: number, total: number): { label: string; color: string } {
  if (total === 0) return { label: 'Not started', color: 'text-surface-500' }
  const pct = score / total
  if (pct >= 0.9) return { label: 'Expert', color: 'text-gold' }
  if (pct >= 0.75) return { label: 'Advanced', color: 'text-emerald' }
  if (pct >= 0.6) return { label: 'Proficient', color: 'text-for-400' }
  if (pct >= 0.4) return { label: 'Developing', color: 'text-purple' }
  return { label: 'Beginner', color: 'text-surface-400' }
}

function overallScore(p: DrillProgress): number {
  const drills = [p.fallacy, p.ranker, p.calibration]
  const played = drills.filter((d) => d.total > 0)
  if (played.length === 0) return 0
  const avg = played.reduce((s, d) => s + d.score / d.total, 0) / played.length
  return Math.round(avg * 100)
}

// ─── Components ───────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-surface-300" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="text-gold transition-all duration-700"
      />
    </svg>
  )
}

function DrillCard({
  icon: Icon,
  title,
  description,
  progress,
  color,
  bg,
  border,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  progress: { score: number; total: number; lastPlayed: string | null }
  color: string
  bg: string
  border: string
  onClick: () => void
}) {
  const level = skillLevel(progress.score, progress.total)
  const pct = progress.total > 0 ? Math.round((progress.score / progress.total) * 100) : 0

  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-colors',
        bg, border, 'hover:border-surface-400'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0', bg, border, 'border')}>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-mono font-semibold text-white">{title}</p>
            <span className={cn('text-[11px] font-mono font-semibold', level.color)}>{level.label}</span>
          </div>
          <p className="text-[12px] text-surface-500 mt-0.5 leading-relaxed">{description}</p>
          {progress.total > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', color.replace('text-', 'bg-'))}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-surface-500">{progress.score}/{progress.total}</span>
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
      </div>
    </motion.button>
  )
}

// ─── Fallacy Spotter drill ────────────────────────────────────────────────────

function FallacyDrill({
  onComplete,
  onBack,
}: {
  onComplete: (score: number, total: number) => void
  onBack: () => void
}) {
  const cases = useState(() => shuffle(FALLACY_CASES).slice(0, 8))[0]
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('question')
  const [score, setScore] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [options, setOptions] = useState<string[]>([])

  const current = cases[idx]

  useEffect(() => {
    if (!current) return
    setOptions(shuffle([current.correctFallacy, ...current.distractors]))
    setChosen(null)
    setPhase('question')
  }, [idx, current])

  function pick(option: string) {
    if (phase !== 'question') return
    setChosen(option)
    const correct = option === current.correctFallacy
    if (correct) setScore((s) => s + 1)
    setPhase('feedback')
  }

  function next() {
    if (idx + 1 >= cases.length) {
      setPhase('complete')
      onComplete(score + (chosen === current.correctFallacy ? 0 : 0), cases.length)
    } else {
      setIdx((i) => i + 1)
    }
  }

  const diffColor = { 1: 'text-emerald', 2: 'text-gold', 3: 'text-against-400' }

  if (phase === 'complete') {
    const finalScore = score
    const pct = Math.round((finalScore / cases.length) * 100)
    return (
      <DrillComplete
        score={finalScore}
        total={cases.length}
        pct={pct}
        drillName="Fallacy Spotter"
        onBack={onBack}
        nextHref="/coach"
        nextLabel="Try Argument Coach"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="text-xs font-mono text-surface-500">
          {idx + 1} / {cases.length}
        </span>
        <span className={cn('text-xs font-mono', diffColor[current.difficulty])}>
          {['', 'Easy', 'Medium', 'Hard'][current.difficulty]}
        </span>
      </div>

      <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
        <div className="h-full bg-purple/80 rounded-full transition-all duration-500" style={{ width: `${(idx / cases.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="flex flex-col gap-4"
        >
          <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
            <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
              Topic: {current.topic}
            </p>
            <p className="text-sm text-surface-700 leading-relaxed italic">
              &ldquo;{current.argument}&rdquo;
            </p>
          </div>

          <p className="text-xs font-mono text-surface-500 text-center">
            Which logical fallacy does this argument contain?
          </p>

          <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => {
              const isCorrect = opt === current.correctFallacy
              const isChosen = opt === chosen
              let cls = 'border-surface-300 bg-surface-200 text-white hover:border-surface-400'
              if (phase === 'feedback') {
                if (isCorrect) cls = 'border-emerald/50 bg-emerald/10 text-emerald'
                else if (isChosen) cls = 'border-against-500/50 bg-against-500/10 text-against-400'
                else cls = 'border-surface-300/50 bg-surface-200/50 text-surface-500'
              }
              return (
                <button
                  key={opt}
                  onClick={() => pick(opt)}
                  disabled={phase === 'feedback'}
                  className={cn(
                    'p-3 rounded-xl border text-xs font-mono font-semibold text-center transition-all',
                    cls, phase === 'question' && 'hover:scale-[1.02] active:scale-[0.98]'
                  )}
                >
                  {opt}
                  {phase === 'feedback' && isCorrect && <CheckCircle2 className="h-3.5 w-3.5 inline-block ml-1.5" />}
                  {phase === 'feedback' && isChosen && !isCorrect && <XCircle className="h-3.5 w-3.5 inline-block ml-1.5" />}
                </button>
              )
            })}
          </div>

          <AnimatePresence>
            {phase === 'feedback' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <div className={cn(
                  'rounded-xl border p-3',
                  chosen === current.correctFallacy
                    ? 'border-emerald/30 bg-emerald/5'
                    : 'border-against-500/30 bg-against-500/5'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {chosen === current.correctFallacy
                      ? <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
                      : <XCircle className="h-4 w-4 text-against-400 flex-shrink-0" />}
                    <p className={cn('text-xs font-mono font-semibold',
                      chosen === current.correctFallacy ? 'text-emerald' : 'text-against-400'
                    )}>
                      {chosen === current.correctFallacy ? 'Correct!' : `Correct answer: ${current.correctFallacy}`}
                    </p>
                  </div>
                  <p className="text-[12px] text-surface-600 leading-relaxed">{current.explanation}</p>
                </div>
                <button
                  onClick={next}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple/80 hover:bg-purple text-white text-sm font-mono font-semibold transition-colors"
                >
                  {idx + 1 >= cases.length ? 'See Results' : 'Next Case'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Argument Ranker drill ────────────────────────────────────────────────────

function RankerDrill({
  onComplete,
  onBack,
}: {
  onComplete: (score: number, total: number) => void
  onBack: () => void
}) {
  const cases = useState(() => shuffle(RANKER_CASES))[0]
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('question')
  const [score, setScore] = useState(0)
  const [chosen, setChosen] = useState<'A' | 'B' | null>(null)

  const current = cases[idx]

  function pick(side: 'A' | 'B') {
    if (phase !== 'question') return
    setChosen(side)
    if (side === current.strongerSide) setScore((s) => s + 1)
    setPhase('feedback')
  }

  function next() {
    if (idx + 1 >= cases.length) {
      onComplete(score, cases.length)
      setPhase('complete')
    } else {
      setIdx((i) => i + 1)
      setPhase('question')
      setChosen(null)
    }
  }

  if (phase === 'complete') {
    const pct = Math.round((score / cases.length) * 100)
    return (
      <DrillComplete
        score={score}
        total={cases.length}
        pct={pct}
        drillName="Argument Ranker"
        onBack={onBack}
        nextHref="/prep"
        nextLabel="Try Debate Prep"
      />
    )
  }

  const isCorrect = chosen === current.strongerSide

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="text-xs font-mono text-surface-500">{idx + 1} / {cases.length}</span>
        <Badge variant="proposed" className="text-[10px]">{current.category}</Badge>
      </div>

      <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
        <div className="h-full bg-gold/80 rounded-full transition-all duration-500" style={{ width: `${(idx / cases.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="flex flex-col gap-3"
        >
          <div className="rounded-xl border border-surface-300 bg-surface-200 px-4 py-3">
            <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">Topic</p>
            <p className="text-sm text-white font-medium">{current.topic}</p>
          </div>

          <p className="text-xs font-mono text-surface-500 text-center">Which is the stronger argument?</p>

          <div className="flex flex-col gap-3">
            {(['A', 'B'] as const).map((side) => {
              const text = side === 'A' ? current.argumentA : current.argumentB
              const isThisChosen = chosen === side
              const isThisCorrect = side === current.strongerSide
              let containerCls = 'border-surface-300 bg-surface-200'
              if (phase === 'feedback') {
                if (isThisCorrect) containerCls = 'border-emerald/50 bg-emerald/5'
                else if (isThisChosen) containerCls = 'border-against-500/50 bg-against-500/5'
                else containerCls = 'border-surface-300/40 bg-surface-200/40'
              }
              return (
                <button
                  key={side}
                  onClick={() => pick(side)}
                  disabled={phase === 'feedback'}
                  className={cn(
                    'w-full text-left rounded-xl border p-4 transition-all',
                    containerCls,
                    phase === 'question' && 'hover:border-surface-400 hover:scale-[1.01] active:scale-[0.99]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-xs font-mono font-bold border',
                      phase === 'feedback' && isThisCorrect ? 'border-emerald/50 bg-emerald/10 text-emerald'
                        : phase === 'feedback' && isThisChosen ? 'border-against-500/50 bg-against-500/10 text-against-400'
                        : 'border-surface-300 bg-surface-300 text-white'
                    )}>
                      {side}
                    </span>
                    <p className="text-[12px] text-surface-600 leading-relaxed flex-1">{text}</p>
                    {phase === 'feedback' && isThisCorrect && <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />}
                    {phase === 'feedback' && isThisChosen && !isThisCorrect && <XCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />}
                  </div>
                </button>
              )
            })}
          </div>

          <AnimatePresence>
            {phase === 'feedback' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <div className={cn(
                  'rounded-xl border p-3',
                  isCorrect ? 'border-emerald/30 bg-emerald/5' : 'border-against-500/30 bg-against-500/5'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {isCorrect
                      ? <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
                      : <XCircle className="h-4 w-4 text-against-400 flex-shrink-0" />}
                    <p className={cn('text-xs font-mono font-semibold', isCorrect ? 'text-emerald' : 'text-against-400')}>
                      {isCorrect ? 'Well spotted!' : `Argument ${current.strongerSide} was stronger`}
                    </p>
                  </div>
                  <p className="text-[12px] text-surface-600 leading-relaxed">{current.explanation}</p>
                </div>
                <button
                  onClick={next}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold/80 hover:bg-gold text-surface-0 text-sm font-mono font-semibold transition-colors"
                >
                  {idx + 1 >= cases.length ? 'See Results' : 'Next Case'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Vote Calibration drill ───────────────────────────────────────────────────

function CalibrationDrill({
  onComplete,
  onBack,
}: {
  onComplete: (score: number, total: number) => void
  onBack: () => void
}) {
  const topics = useState(() => shuffle(CALIBRATION_TOPICS))[0]
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('question')
  const [score, setScore] = useState(0)
  const [chosen, setChosen] = useState<'for' | 'against' | null>(null)

  const current = topics[idx]

  function vote(side: 'for' | 'against') {
    if (phase !== 'question') return
    setChosen(side)
    const withMajority =
      (side === 'for' && current.communityFor >= 50) ||
      (side === 'against' && current.communityFor < 50)
    if (withMajority) setScore((s) => s + 1)
    setPhase('feedback')
  }

  function next() {
    if (idx + 1 >= topics.length) {
      onComplete(score, topics.length)
      setPhase('complete')
    } else {
      setIdx((i) => i + 1)
      setPhase('question')
      setChosen(null)
    }
  }

  if (phase === 'complete') {
    const pct = Math.round((score / topics.length) * 100)
    return (
      <DrillComplete
        score={score}
        total={topics.length}
        pct={pct}
        drillName="Vote Calibration"
        onBack={onBack}
        nextHref="/"
        nextLabel="Vote on Live Topics"
      />
    )
  }

  const majorityFor = current.communityFor >= 50
  const yourSideForPct = chosen === 'for' ? current.communityFor : 100 - current.communityFor
  const withMajority = chosen && (
    (chosen === 'for' && majorityFor) || (chosen === 'against' && !majorityFor)
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <span className="text-xs font-mono text-surface-500">{idx + 1} / {topics.length}</span>
        <Badge variant="proposed" className="text-[10px]">{current.category}</Badge>
      </div>

      <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
        <div className="h-full bg-for-500/80 rounded-full transition-all duration-500" style={{ width: `${(idx / topics.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="flex flex-col gap-4"
        >
          <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
            <p className="text-sm text-white font-medium leading-relaxed text-center">
              {current.statement}
            </p>
          </div>

          {phase === 'question' && (
            <p className="text-xs font-mono text-surface-500 text-center">
              Vote your position — we&apos;ll reveal where the community stands.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => vote('for')}
              disabled={phase === 'feedback'}
              className={cn(
                'flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-mono font-semibold transition-all',
                phase === 'feedback' && chosen === 'for'
                  ? 'border-for-500/60 bg-for-500/15 text-for-300'
                  : phase === 'feedback'
                  ? 'border-surface-300/40 bg-surface-200/40 text-surface-500'
                  : 'border-for-500/30 bg-for-500/5 text-for-300 hover:border-for-500/60 hover:bg-for-500/10 hover:scale-[1.02]'
              )}
            >
              <ThumbsUp className="h-5 w-5" />
              For
            </button>
            <button
              onClick={() => vote('against')}
              disabled={phase === 'feedback'}
              className={cn(
                'flex flex-col items-center gap-2 py-4 rounded-xl border text-sm font-mono font-semibold transition-all',
                phase === 'feedback' && chosen === 'against'
                  ? 'border-against-500/60 bg-against-500/15 text-against-300'
                  : phase === 'feedback'
                  ? 'border-surface-300/40 bg-surface-200/40 text-surface-500'
                  : 'border-against-500/30 bg-against-500/5 text-against-300 hover:border-against-500/60 hover:bg-against-500/10 hover:scale-[1.02]'
              )}
            >
              <ThumbsDown className="h-5 w-5" />
              Against
            </button>
          </div>

          <AnimatePresence>
            {phase === 'feedback' && chosen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider text-center mb-3">
                    Community Consensus
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-mono text-for-400 w-8 text-right">{current.communityFor}%</span>
                    <div className="flex-1 h-3 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className="h-full bg-for-500 rounded-full transition-all duration-1000"
                        style={{ width: `${current.communityFor}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-against-400 w-8">{100 - current.communityFor}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-3">
                    <span>FOR</span>
                    <span>AGAINST</span>
                  </div>
                  <div className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg',
                    withMajority ? 'bg-emerald/10 border border-emerald/20' : 'bg-surface-300/50 border border-surface-300'
                  )}>
                    {withMajority
                      ? <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
                      : <Scale className="h-4 w-4 text-surface-500 flex-shrink-0" />}
                    <p className={cn('text-[11px] font-mono', withMajority ? 'text-emerald' : 'text-surface-500')}>
                      {withMajority
                        ? `You voted with the ${majorityFor ? current.communityFor : 100 - current.communityFor}% majority`
                        : `You voted with the ${yourSideForPct}% ${chosen === 'for' ? 'FOR' : 'AGAINST'} minority`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={next}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600/80 hover:bg-for-600 text-white text-sm font-mono font-semibold transition-colors"
                >
                  {idx + 1 >= topics.length ? 'See Results' : 'Next Topic'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Drill complete screen ────────────────────────────────────────────────────

function DrillComplete({
  score, total, pct, drillName, onBack, nextHref, nextLabel,
}: {
  score: number; total: number; pct: number; drillName: string
  onBack: () => void; nextHref: string; nextLabel: string
}) {
  const grade =
    pct >= 90 ? { letter: 'A', color: 'text-gold', msg: 'Outstanding analysis!' } :
    pct >= 75 ? { letter: 'B', color: 'text-emerald', msg: 'Solid critical thinking!' } :
    pct >= 60 ? { letter: 'C', color: 'text-for-400', msg: 'Room to sharpen your skills.' } :
    pct >= 40 ? { letter: 'D', color: 'text-purple', msg: 'Keep practicing — it takes time.' } :
              { letter: 'F', color: 'text-against-400', msg: 'Try again — these are learnable skills.' }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 py-4"
    >
      <div className="flex flex-col items-center gap-2">
        <span className={cn('font-mono text-7xl font-black', grade.color)}>{grade.letter}</span>
        <p className="text-sm font-mono text-white">{score}/{total} correct · {pct}%</p>
        <p className="text-xs text-surface-500">{grade.msg}</p>
      </div>

      <div className="w-full rounded-xl border border-surface-300 bg-surface-200 p-4 text-center">
        <p className="text-xs font-mono text-surface-500 mb-1">{drillName} complete</p>
        <p className="text-sm text-white font-medium">Progress saved to your training record</p>
      </div>

      <div className="flex flex-col w-full gap-2">
        <Link
          href={nextHref}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple/80 hover:bg-purple text-white text-sm font-mono font-semibold transition-colors"
        >
          {nextLabel} <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-sm font-mono font-semibold transition-colors"
        >
          Back to Training Hub
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const [mode, setMode] = useState<DrillMode>('hub')
  const [progress, setProgress] = useState<DrillProgress | null>(null)

  useEffect(() => {
    setProgress(loadProgress())
  }, [])

  const handleComplete = useCallback((drill: keyof DrillProgress, score: number, total: number) => {
    setProgress((prev) => {
      const updated: DrillProgress = {
        ...(prev ?? loadProgress()),
        [drill]: { score, total, lastPlayed: new Date().toISOString() },
      }
      saveProgress(updated)
      return updated
    })
  }, [])

  const overallPct = progress ? overallScore(progress) : 0

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8">

        <AnimatePresence mode="wait">
          {mode === 'hub' && (
            <motion.div
              key="hub"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-5"
            >
              {/* ── Header ──────────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
                  aria-label="Back to home"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="flex-1 min-w-0">
                  <h1 className="font-mono text-xl font-bold text-white">Civic Training</h1>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Sharpen your argument analysis and debate skills
                  </p>
                </div>
              </div>

              {/* ── Overall score ────────────────────────────────── */}
              {progress && (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-surface-300 bg-surface-200">
                  <div className="relative flex-shrink-0">
                    <ProgressRing pct={overallPct} size={60} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-white">
                      {overallPct}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-semibold text-white">Civic Fitness Score</p>
                    <p className="text-[12px] text-surface-500 mt-0.5">
                      {[progress.fallacy, progress.ranker, progress.calibration].filter((d) => d.total > 0).length}/3 drills completed
                    </p>
                    <div className="flex gap-3 mt-2">
                      {[
                        { label: 'Fallacy', d: progress.fallacy, color: 'text-purple' },
                        { label: 'Ranker', d: progress.ranker, color: 'text-gold' },
                        { label: 'Calibration', d: progress.calibration, color: 'text-for-400' },
                      ].map(({ label, d, color }) => (
                        <div key={label} className="text-center">
                          <p className={cn('text-xs font-mono font-bold', d.total > 0 ? color : 'text-surface-500')}>
                            {d.total > 0 ? `${Math.round((d.score / d.total) * 100)}%` : '—'}
                          </p>
                          <p className="text-[10px] font-mono text-surface-600">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {overallPct >= 75 && (
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <Trophy className="h-6 w-6 text-gold" />
                      <span className="text-[10px] font-mono text-gold">Elite</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Drill cards ──────────────────────────────────── */}
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">Choose a drill</p>
                {progress ? (
                  <>
                    <DrillCard
                      icon={AlertTriangle}
                      title="Fallacy Spotter"
                      description="Read an argument and identify the logical fallacy. Covers 10 common fallacy types across 3 difficulty levels."
                      progress={progress.fallacy}
                      color="text-purple"
                      bg="bg-purple/5"
                      border="border-purple/20"
                      onClick={() => setMode('fallacy')}
                    />
                    <DrillCard
                      icon={Scale}
                      title="Argument Ranker"
                      description="Compare two arguments on the same topic and pick the stronger one. Trains evidence evaluation and logical structure."
                      progress={progress.ranker}
                      color="text-gold"
                      bg="bg-gold/5"
                      border="border-gold/20"
                      onClick={() => setMode('ranker')}
                    />
                    <DrillCard
                      icon={Target}
                      title="Vote Calibration"
                      description="Cast your vote on real civic topics, then see where the community stands. Reveals your consensus alignment score."
                      progress={progress.calibration}
                      color="text-for-400"
                      bg="bg-for-500/5"
                      border="border-for-500/20"
                      onClick={() => setMode('calibration')}
                    />
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-24 rounded-xl bg-surface-200 animate-pulse" />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Related tools ────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">Advanced tools</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { href: '/coach', icon: Brain, label: 'AI Coach', color: 'text-emerald', bg: 'bg-emerald/5', border: 'border-emerald/20' },
                    { href: '/prep', icon: BookOpen, label: 'Debate Prep', color: 'text-for-400', bg: 'bg-for-500/5', border: 'border-for-500/20' },
                    { href: '/spar', icon: Zap, label: 'Spar AI', color: 'text-against-400', bg: 'bg-against-500/5', border: 'border-against-500/20' },
                    { href: '/arcade', icon: Sparkles, label: 'Civic Arcade', color: 'text-purple', bg: 'bg-purple/5', border: 'border-purple/20' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex flex-col items-center gap-2 py-3 rounded-xl border transition-colors',
                        item.bg, item.border, 'hover:border-surface-400'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4', item.color)} />
                      <span className={cn('text-[11px] font-mono font-semibold', item.color)}>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* ── Reset option ────────────────────────────────── */}
              {progress && (progress.fallacy.total > 0 || progress.ranker.total > 0 || progress.calibration.total > 0) && (
                <button
                  onClick={() => {
                    const empty: DrillProgress = {
                      fallacy: { score: 0, total: 0, lastPlayed: null },
                      ranker: { score: 0, total: 0, lastPlayed: null },
                      calibration: { score: 0, total: 0, lastPlayed: null },
                    }
                    saveProgress(empty)
                    setProgress(empty)
                  }}
                  className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors mx-auto"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset training progress
                </button>
              )}
            </motion.div>
          )}

          {mode === 'fallacy' && (
            <motion.div key="fallacy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-purple" />
                <h2 className="font-mono text-sm font-bold text-white">Fallacy Spotter</h2>
              </div>
              <FallacyDrill
                onComplete={(s, t) => { handleComplete('fallacy', s, t); setProgress(loadProgress()) }}
                onBack={() => { setProgress(loadProgress()); setMode('hub') }}
              />
            </motion.div>
          )}

          {mode === 'ranker' && (
            <motion.div key="ranker" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-4 flex items-center gap-2">
                <Scale className="h-4 w-4 text-gold" />
                <h2 className="font-mono text-sm font-bold text-white">Argument Ranker</h2>
              </div>
              <RankerDrill
                onComplete={(s, t) => { handleComplete('ranker', s, t); setProgress(loadProgress()) }}
                onBack={() => { setProgress(loadProgress()); setMode('hub') }}
              />
            </motion.div>
          )}

          {mode === 'calibration' && (
            <motion.div key="calibration" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-for-400" />
                <h2 className="font-mono text-sm font-bold text-white">Vote Calibration</h2>
              </div>
              <CalibrationDrill
                onComplete={(s, t) => { handleComplete('calibration', s, t); setProgress(loadProgress()) }}
                onBack={() => { setProgress(loadProgress()); setMode('hub') }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
