'use client'

/**
 * /archetype — Civic Archetype Quiz
 *
 * A 10-question political personality assessment. Each question is a policy
 * scenario or value statement rated 1–5. Answers are scored against 8 civic
 * archetypes via weighted dimension vectors. The archetype with the highest
 * cumulative score wins. Results are persisted in localStorage.
 *
 * No login, no API calls, no database writes — purely client-side.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Crown,
  Flame,
  Globe,
  Heart,
  RefreshCw,
  Scale,
  Share2,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Archetype definitions ────────────────────────────────────────────────────

type ArchetypeId =
  | 'pragmatist'
  | 'idealist'
  | 'guardian'
  | 'reformer'
  | 'libertarian'
  | 'communitarian'
  | 'technocrat'
  | 'democrat'

interface Archetype {
  id: ArchetypeId
  name: string
  tagline: string
  description: string
  traits: string[]
  watchpoints: string[]
  icon: typeof Scale
  color: string        // Tailwind text color
  bgColor: string      // Tailwind bg color
  borderColor: string  // Tailwind border color
  gradient: string     // CSS gradient for hero card
  famousExamples: string[]
}

const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  pragmatist: {
    id: 'pragmatist',
    name: 'The Pragmatist',
    tagline: 'What works matters more than what\'s pure.',
    description:
      'You judge policies by outcomes, not ideology. You\'re comfortable crossing political lines when the evidence points that way, and you distrust both rigid dogma and utopian thinking. In the Lobby, you cast votes based on track records and real-world data — a rare and valuable voice for what\'s actually achievable.',
    traits: ['Evidence-driven', 'Compromise-willing', 'Results-oriented', 'Bipartisan', 'Empirical'],
    watchpoints: ['Can underestimate the role of values in politics', 'May dismiss principled opposition as impractical'],
    icon: Scale,
    color: 'text-for-400',
    bgColor: 'bg-for-500/10',
    borderColor: 'border-for-500/30',
    gradient: 'from-for-900/60 via-for-800/30 to-surface-100',
    famousExamples: ['Michael Bloomberg', 'Angela Merkel', 'Bill Clinton'],
  },
  idealist: {
    id: 'idealist',
    name: 'The Idealist',
    tagline: 'Principles aren\'t negotiable — they\'re the point.',
    description:
      'You believe that politics divorced from values becomes mere administration. You hold firm positions rooted in moral conviction, and you\'re skeptical of "pragmatic" compromises that erode what matters. In the Lobby, you write the arguments that make people think — and sometimes change their minds entirely.',
    traits: ['Values-driven', 'Principled', 'Morally consistent', 'Inspirational', 'Long-term thinker'],
    watchpoints: ['Risk of letting perfect be the enemy of good', 'Can alienate potential allies over purity standards'],
    icon: Heart,
    color: 'text-against-400',
    bgColor: 'bg-against-500/10',
    borderColor: 'border-against-500/30',
    gradient: 'from-against-900/60 via-against-800/30 to-surface-100',
    famousExamples: ['Mahatma Gandhi', 'Nelson Mandela', 'Bernie Sanders'],
  },
  guardian: {
    id: 'guardian',
    name: 'The Guardian',
    tagline: 'Stability is not stagnation — it\'s foundation.',
    description:
      'You understand that civilization\'s greatest achievements — rule of law, democratic norms, social cohesion — are fragile and hard-won. You\'re cautious about rapid change not from fear, but from wisdom about unintended consequences. In the Lobby, you\'re the steady hand that reminds activists what they could be dismantling.',
    traits: ['Institution-trusting', 'Tradition-respecting', 'Risk-aware', 'Stability-focused', 'Incremental'],
    watchpoints: ['Can be slow to recognize when institutions themselves need reform', 'May defend flawed systems too long'],
    icon: Shield,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    gradient: 'from-amber-900/60 via-amber-800/20 to-surface-100',
    famousExamples: ['Edmund Burke', 'Margaret Thatcher', 'John McCain'],
  },
  reformer: {
    id: 'reformer',
    name: 'The Reformer',
    tagline: 'The status quo is a choice — and a bad one.',
    description:
      'You see systemic problems clearly and feel the urgency to fix them. You don\'t just want policy tweaks — you want structures that create better outcomes for everyone. In the Lobby, you propose the bold topics that force the community to confront hard truths, and you argue with a force that moves the needle.',
    traits: ['System-critical', 'Justice-oriented', 'Structurally-minded', 'Urgent', 'Bold'],
    watchpoints: ['Risk of dismissing what current systems do well', 'Reform fatigue from overextension'],
    icon: Flame,
    color: 'text-against-300',
    bgColor: 'bg-against-400/10',
    borderColor: 'border-against-400/30',
    gradient: 'from-red-900/60 via-red-800/20 to-surface-100',
    famousExamples: ['Franklin D. Roosevelt', 'Martin Luther King Jr.', 'Wangari Maathai'],
  },
  libertarian: {
    id: 'libertarian',
    name: 'The Libertarian',
    tagline: 'The individual is the unit of sovereignty.',
    description:
      'You believe that freedom — real, substantive freedom — is the foundation of good governance. You\'re skeptical of both government overreach and social pressure to conform. In the Lobby, you\'re the voice that asks "who gave them the authority to decide this?" — and often, that\'s exactly the right question.',
    traits: ['Individual-rights first', 'State-skeptical', 'Autonomy-maximizing', 'Anti-paternalist', 'Principled'],
    watchpoints: ['Can underweight collective action problems', 'May struggle with genuinely market-resistant issues'],
    icon: Zap,
    color: 'text-purple',
    bgColor: 'bg-purple/10',
    borderColor: 'border-purple/30',
    gradient: 'from-violet-900/60 via-violet-800/20 to-surface-100',
    famousExamples: ['John Stuart Mill', 'Milton Friedman', 'Ron Paul'],
  },
  communitarian: {
    id: 'communitarian',
    name: 'The Communitarian',
    tagline: 'We are stronger, and freer, together.',
    description:
      'You believe that humans are fundamentally social beings and that community bonds are what make individual freedom meaningful. You prioritize solidarity, mutual obligation, and shared flourishing over individual optimization. In the Lobby, you\'re the voice that asks "but what happens to those left behind?" — and makes sure that question gets answered.',
    traits: ['Community-first', 'Solidarity-focused', 'Collectively-minded', 'Empathetic', 'Relational'],
    watchpoints: ['Can underweight individual liberty concerns', 'Risk of enforced conformity in the name of community'],
    icon: Users,
    color: 'text-emerald',
    bgColor: 'bg-emerald/10',
    borderColor: 'border-emerald/30',
    gradient: 'from-emerald-900/60 via-emerald-800/20 to-surface-100',
    famousExamples: ['Robert Putnam', 'Amitai Etzioni', 'Jacinda Ardern'],
  },
  technocrat: {
    id: 'technocrat',
    name: 'The Technocrat',
    tagline: 'Complex problems deserve expert solutions.',
    description:
      'You trust that rigorous analysis, specialized knowledge, and well-designed institutions can solve problems that political will alone cannot. You\'re skeptical of populism and believe that getting policy right matters more than making it feel democratic. In the Lobby, you bring citations, data, and the uncomfortable truth that good intentions aren\'t enough.',
    traits: ['Evidence-based', 'Expert-trusting', 'Analytically rigorous', 'Institution-building', 'Long-range'],
    watchpoints: ['Can drift toward paternalism', 'May underestimate legitimacy problems when experts override public will'],
    icon: Brain,
    color: 'text-for-300',
    bgColor: 'bg-for-400/10',
    borderColor: 'border-for-400/30',
    gradient: 'from-blue-900/60 via-blue-800/20 to-surface-100',
    famousExamples: ['Mario Draghi', 'Alan Greenspan', 'Francis Fukuyama'],
  },
  democrat: {
    id: 'democrat',
    name: 'The Democrat',
    tagline: 'Legitimacy flows from the people — always.',
    description:
      'You believe that democracy isn\'t just a system — it\'s a moral commitment to treating all citizens as capable of self-governance. You\'re suspicious of shortcuts that bypass deliberation, even when those shortcuts might produce "better" outcomes. In the Lobby, you\'re the one building coalitions, listening across disagreements, and making sure every voice has been heard before a decision is made.',
    traits: ['Process-oriented', 'Participatory', 'Consensus-seeking', 'Deliberative', 'Legitimacy-conscious'],
    watchpoints: ['Slow to act in genuine crises requiring decisive action', 'Risk of paralysis when consensus is impossible'],
    icon: Globe,
    color: 'text-for-500',
    bgColor: 'bg-for-600/10',
    borderColor: 'border-for-600/30',
    gradient: 'from-sky-900/60 via-sky-800/20 to-surface-100',
    famousExamples: ['John Dewey', 'Jürgen Habermas', 'Aung San Suu Kyi'],
  },
}

// ─── Questions ────────────────────────────────────────────────────────────────

type ArchetypeWeights = Partial<Record<ArchetypeId, number>>

interface Question {
  id: string
  text: string
  category: string
  // Weight vector: positive = agree boosts archetype, negative = agree hurts archetype.
  // Scale: answer 1–5 maps to (-2, -1, 0, +1, +2) × weight.
  agreeWeights: ArchetypeWeights
}

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'When a policy produces good results in practice, philosophical concerns about its principles should take a back seat.',
    category: 'Philosophy of Policy',
    agreeWeights: { pragmatist: 3, technocrat: 2, idealist: -3, libertarian: -1 },
  },
  {
    id: 'q2',
    text: 'Long-standing social traditions and institutions deserve the benefit of the doubt — they\'ve been tested by time.',
    category: 'Change & Stability',
    agreeWeights: { guardian: 3, communitarian: 1, reformer: -3, libertarian: -1 },
  },
  {
    id: 'q3',
    text: 'Adults should have the right to make choices that harm only themselves, free from legal restriction or social pressure.',
    category: 'Individual Rights',
    agreeWeights: { libertarian: 3, pragmatist: 1, communitarian: -2, guardian: -1 },
  },
  {
    id: 'q4',
    text: 'Technical experts and trained professionals usually have better judgement on policy details than the average voter.',
    category: 'Expertise & Democracy',
    agreeWeights: { technocrat: 3, pragmatist: 1, democrat: -3, libertarian: -1 },
  },
  {
    id: 'q5',
    text: 'Systemic inequality is not just unfortunate — it is a structural injustice that requires active, even disruptive, correction.',
    category: 'Justice',
    agreeWeights: { reformer: 3, idealist: 2, communitarian: 1, guardian: -2, libertarian: -1 },
  },
  {
    id: 'q6',
    text: 'A strong community with shared values and mutual obligations is more important to human flourishing than maximizing individual freedom.',
    category: 'Community vs. Autonomy',
    agreeWeights: { communitarian: 3, guardian: 1, libertarian: -3, pragmatist: -1 },
  },
  {
    id: 'q7',
    text: 'Public decisions should be made through broad deliberation and community consensus, not delegated to unelected experts or officials.',
    category: 'Democratic Process',
    agreeWeights: { democrat: 3, idealist: 1, technocrat: -3, guardian: -1 },
  },
  {
    id: 'q8',
    text: 'Current laws and governance structures generally reflect accumulated civic wisdom and should be changed only with very strong justification.',
    category: 'Rule of Law',
    agreeWeights: { guardian: 3, technocrat: 1, reformer: -2, libertarian: -1 },
  },
  {
    id: 'q9',
    text: 'The most important measure of a civic system is whether it consistently produces outcomes that improve people\'s lives — not whether it follows correct procedures.',
    category: 'Outcomes vs. Process',
    agreeWeights: { pragmatist: 3, technocrat: 2, democrat: -3, idealist: -1 },
  },
  {
    id: 'q10',
    text: 'Society has a collective responsibility to ensure that no one is left behind — and this justifies redistributing resources even from those who earned them.',
    category: 'Collective Responsibility',
    agreeWeights: { communitarian: 3, reformer: 2, idealist: 1, libertarian: -3, guardian: -1 },
  },
]

const RESPONSE_LABELS = [
  'Strongly Disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly Agree',
]

const STORAGE_KEY = 'lm_archetype_result'

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeArchetype(answers: Record<string, number>): ArchetypeId {
  const scores: Record<ArchetypeId, number> = {
    pragmatist: 0,
    idealist: 0,
    guardian: 0,
    reformer: 0,
    libertarian: 0,
    communitarian: 0,
    technocrat: 0,
    democrat: 0,
  }

  for (const q of QUESTIONS) {
    const rawAnswer = answers[q.id]
    if (rawAnswer === undefined) continue
    const delta = rawAnswer - 3 // Maps 1–5 → -2 to +2

    for (const [arch, weight] of Object.entries(q.agreeWeights) as [ArchetypeId, number][]) {
      scores[arch] += delta * weight
    }
  }

  return (Object.entries(scores) as [ArchetypeId, number][]).reduce(
    (best, [id, score]) => (score > scores[best] ? id : best),
    'pragmatist' as ArchetypeId
  )
}

function computeTopThree(answers: Record<string, number>): ArchetypeId[] {
  const scores: Record<ArchetypeId, number> = {
    pragmatist: 0, idealist: 0, guardian: 0, reformer: 0,
    libertarian: 0, communitarian: 0, technocrat: 0, democrat: 0,
  }

  for (const q of QUESTIONS) {
    const rawAnswer = answers[q.id]
    if (rawAnswer === undefined) continue
    const delta = rawAnswer - 3

    for (const [arch, weight] of Object.entries(q.agreeWeights) as [ArchetypeId, number][]) {
      scores[arch] += delta * weight
    }
  }

  return (Object.entries(scores) as [ArchetypeId, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id) as ArchetypeId[]
}

// ─── Component ────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'quiz' | 'results'

interface ArchetypeStatEntry {
  archetype: string
  count: number
  pct: number
}

export function ArchetypeClient() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [result, setResult] = useState<ArchetypeId | null>(null)
  const [topThree, setTopThree] = useState<ArchetypeId[]>([])
  const [copied, setCopied] = useState(false)
  const [distribution, setDistribution] = useState<ArchetypeStatEntry[] | null>(null)

  // Load cached result
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { result: ArchetypeId; topThree: ArchetypeId[] }
        if (parsed.result && ARCHETYPES[parsed.result]) {
          setResult(parsed.result)
          setTopThree(parsed.topThree ?? [])
          setPhase('results')
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Fetch platform distribution when results are shown
  useEffect(() => {
    if (phase !== 'results') return
    fetch('/api/archetype')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.distribution) setDistribution(d.distribution as ArchetypeStatEntry[]) })
      .catch(() => {})
  }, [phase])

  const handleStart = useCallback(() => {
    setPhase('quiz')
    setCurrentQ(0)
    setAnswers({})
    setPendingAnswer(null)
    setResult(null)
    setTopThree([])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }, [])

  const handleAnswer = useCallback((value: number) => {
    setPendingAnswer(value)
  }, [])

  const handleNext = useCallback(() => {
    if (pendingAnswer === null) return
    const q = QUESTIONS[currentQ]
    const newAnswers = { ...answers, [q.id]: pendingAnswer }
    setAnswers(newAnswers)
    setPendingAnswer(null)

    if (currentQ + 1 >= QUESTIONS.length) {
      const archetype = computeArchetype(newAnswers)
      const top = computeTopThree(newAnswers)
      setResult(archetype)
      setTopThree(top)
      setPhase('results')
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ result: archetype, topThree: top }))
      } catch { /* noop */ }
      // Persist to profile (best-effort, no UX impact on failure)
      fetch('/api/profile/archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archetype }),
      }).catch(() => {})
    } else {
      setCurrentQ((n) => n + 1)
    }
  }, [pendingAnswer, currentQ, answers])

  const handleBack = useCallback(() => {
    if (currentQ === 0) {
      setPhase('intro')
    } else {
      setCurrentQ((n) => n - 1)
      const prevQ = QUESTIONS[currentQ - 1]
      setPendingAnswer(answers[prevQ.id] ?? null)
    }
  }, [currentQ, answers])

  const handleShare = useCallback(() => {
    if (!result) return
    const arch = ARCHETYPES[result]
    const text = `I'm a ${arch.name} on Lobby Market — "${arch.tagline}" Discover your civic archetype:`
    const url = `${window.location.origin}/archetype`
    if (navigator.share) {
      navigator.share({ title: arch.name, text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }, [result])

  // ── Intro ──────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-8 pb-28 md:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center text-center gap-6"
          >
            {/* Hero icon */}
            <div className="flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-for-600/20 via-purple/10 to-gold/20 border border-for-500/20">
              <Crown className="h-10 w-10 text-gold" />
            </div>

            <div>
              <h1 className="font-mono text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
                Civic Archetype
              </h1>
              <p className="text-surface-500 font-mono text-sm max-w-md">
                10 questions. 8 archetypes. Discover the political personality behind your votes.
              </p>
            </div>

            {/* Archetype preview grid */}
            <div className="grid grid-cols-4 gap-2 w-full max-w-sm mt-2">
              {(Object.values(ARCHETYPES) as Archetype[]).map((arch) => {
                const Icon = arch.icon
                return (
                  <div
                    key={arch.id}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl',
                      'border text-center transition-colors',
                      arch.bgColor, arch.borderColor
                    )}
                  >
                    <Icon className={cn('h-5 w-5', arch.color)} />
                    <span className={cn('text-[10px] font-mono font-semibold leading-tight', arch.color)}>
                      {arch.name.replace('The ', '')}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* How it works */}
            <div className="w-full bg-surface-100 border border-surface-300 rounded-2xl p-5 text-left space-y-3">
              {[
                { icon: Scale, label: '10 scenario-based questions' },
                { icon: Brain, label: 'No right or wrong answers — just honest takes' },
                { icon: Sparkles, label: 'Weighted scoring across 8 civic dimensions' },
                { icon: Share2, label: 'Shareable result card with archetype breakdown' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                    <Icon className="h-3.5 w-3.5 text-surface-500" />
                  </div>
                  <span className="text-sm font-mono text-surface-600">{label}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleStart}
              className={cn(
                'w-full max-w-xs flex items-center justify-center gap-2',
                'py-4 rounded-2xl font-mono text-base font-bold text-white',
                'bg-gradient-to-r from-for-600 to-for-500',
                'hover:from-for-500 hover:to-for-400',
                'transition-all duration-200 shadow-lg shadow-for-900/40'
              )}
            >
              Discover My Archetype
              <ArrowRight className="h-5 w-5" />
            </button>

            <p className="text-[11px] font-mono text-surface-600 -mt-2">
              ~3 minutes · No login required · Stored locally
            </p>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────

  if (phase === 'quiz') {
    const q = QUESTIONS[currentQ]
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {currentQ === 0 ? 'Back' : 'Previous'}
              </button>
              <span className="text-xs font-mono text-surface-500">
                {currentQ + 1} / {QUESTIONS.length}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="h-full bg-for-500 rounded-full"
                animate={{ width: `${((currentQ + (pendingAnswer !== null ? 1 : 0)) / QUESTIONS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Question */}
          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              {/* Category badge */}
              <div className="mb-4">
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-surface-200 border border-surface-300 text-surface-500">
                  {q.category}
                </span>
              </div>

              {/* Question text */}
              <h2 className="font-mono text-xl md:text-2xl font-bold text-white leading-snug mb-8">
                &ldquo;{q.text}&rdquo;
              </h2>

              {/* Response scale */}
              <div className="space-y-3">
                {RESPONSE_LABELS.map((label, idx) => {
                  const value = idx + 1
                  const isSelected = pendingAnswer === value

                  return (
                    <motion.button
                      key={value}
                      onClick={() => handleAnswer(value)}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'w-full flex items-center gap-4 px-5 py-4 rounded-2xl',
                        'border font-mono text-sm font-medium',
                        'transition-all duration-150',
                        isSelected
                          ? value <= 2
                            ? 'bg-against-500/15 border-against-500/50 text-against-300'
                            : value >= 4
                            ? 'bg-for-500/15 border-for-500/50 text-for-300'
                            : 'bg-surface-300/50 border-surface-400 text-white'
                          : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                      )}
                    >
                      {/* Selection indicator */}
                      <div
                        className={cn(
                          'flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                          isSelected
                            ? value <= 2
                              ? 'border-against-400 bg-against-500/30'
                              : value >= 4
                              ? 'border-for-400 bg-for-500/30'
                              : 'border-surface-500 bg-surface-300/50'
                            : 'border-surface-400'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>

                      {label}

                      {/* Strength indicator dots */}
                      <div className="ml-auto flex items-center gap-0.5">
                        {[...Array(Math.abs(value - 3))].map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              value < 3 ? 'bg-against-500/60' : 'bg-for-500/60'
                            )}
                          />
                        ))}
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              {/* Next button */}
              <motion.button
                onClick={handleNext}
                disabled={pendingAnswer === null}
                animate={{ opacity: pendingAnswer !== null ? 1 : 0.4 }}
                className={cn(
                  'w-full mt-6 py-4 rounded-2xl font-mono text-base font-bold',
                  'flex items-center justify-center gap-2',
                  'bg-for-600 hover:bg-for-500 text-white',
                  'transition-all duration-200',
                  'disabled:cursor-not-allowed'
                )}
              >
                {currentQ + 1 >= QUESTIONS.length ? 'See My Archetype' : 'Next Question'}
                <ArrowRight className="h-5 w-5" />
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────────

  if (!result) return null
  const arch = ARCHETYPES[result]
  const Icon = arch.icon

  // Secondary and tertiary archetypes
  const secondary = topThree[1] ? ARCHETYPES[topThree[1]] : null
  const tertiary = topThree[2] ? ARCHETYPES[topThree[2]] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Hero result card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn(
            'relative overflow-hidden rounded-3xl border p-8 mb-6',
            arch.borderColor,
            'bg-surface-100'
          )}
        >
          {/* Background gradient */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-60',
              arch.gradient
            )}
          />

          <div className="relative">
            {/* Icon */}
            <div
              className={cn(
                'inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-4',
                arch.bgColor, 'border', arch.borderColor
              )}
            >
              <Icon className={cn('h-8 w-8', arch.color)} />
            </div>

            {/* You are... */}
            <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-1">
              Your Civic Archetype
            </p>
            <h1 className={cn('font-mono text-3xl md:text-4xl font-black tracking-tight mb-2', arch.color)}>
              {arch.name}
            </h1>
            <p className="font-mono text-sm text-surface-400 italic mb-5">
              &ldquo;{arch.tagline}&rdquo;
            </p>
            <p className="font-mono text-sm text-surface-600 leading-relaxed">
              {arch.description}
            </p>
          </div>
        </motion.div>

        {/* Traits */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mb-5"
        >
          <h2 className="font-mono text-xs text-surface-500 uppercase tracking-widest mb-3">
            Core Traits
          </h2>
          <div className="flex flex-wrap gap-2">
            {arch.traits.map((t) => (
              <span
                key={t}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border',
                  arch.bgColor, arch.borderColor, arch.color
                )}
              >
                {t}
              </span>
            ))}
          </div>
        </motion.section>

        {/* Watchpoints */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mb-5 bg-surface-100 border border-surface-300 rounded-2xl p-5"
        >
          <h2 className="font-mono text-xs text-surface-500 uppercase tracking-widest mb-3">
            Watch Points
          </h2>
          <ul className="space-y-2">
            {arch.watchpoints.map((w) => (
              <li key={w} className="flex items-start gap-2.5 text-sm font-mono text-surface-600">
                <span className="flex-shrink-0 mt-0.5 text-gold">•</span>
                {w}
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Famous examples */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mb-5 bg-surface-100 border border-surface-300 rounded-2xl p-5"
        >
          <h2 className="font-mono text-xs text-surface-500 uppercase tracking-widest mb-3">
            Real-World Examples
          </h2>
          <div className="flex flex-wrap gap-2">
            {arch.famousExamples.map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-full text-xs font-mono text-surface-500 border border-surface-300 bg-surface-200"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.section>

        {/* Secondary / tertiary archetypes */}
        {(secondary || tertiary) && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mb-6"
          >
            <h2 className="font-mono text-xs text-surface-500 uppercase tracking-widest mb-3">
              Also In You
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[secondary, tertiary].filter(Boolean).map((a) => {
                if (!a) return null
                const AIcon = a.icon
                return (
                  <div
                    key={a.id}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border',
                      a.bgColor, a.borderColor
                    )}
                  >
                    <AIcon className={cn('h-5 w-5 flex-shrink-0', a.color)} />
                    <div>
                      <p className={cn('text-xs font-mono font-bold', a.color)}>{a.name}</p>
                      <p className="text-[11px] font-mono text-surface-600 mt-0.5 leading-tight">{a.tagline}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.section>
        )}

        {/* Platform distribution */}
        {distribution && distribution.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.4 }}
            className="mb-6 bg-surface-100 border border-surface-300 rounded-2xl p-5"
          >
            <h2 className="font-mono text-xs text-surface-500 uppercase tracking-widest mb-4">
              Lobby Distribution
            </h2>
            <div className="space-y-2.5">
              {distribution.map((entry) => {
                const a = ARCHETYPES[entry.archetype as ArchetypeId]
                if (!a) return null
                const AIcon = a.icon
                const isYours = entry.archetype === result
                return (
                  <div key={entry.archetype} className="flex items-center gap-3">
                    <AIcon className={cn('h-3.5 w-3.5 flex-shrink-0', a.color)} />
                    <span className={cn(
                      'text-[11px] font-mono w-28 flex-shrink-0',
                      isYours ? a.color + ' font-bold' : 'text-surface-500'
                    )}>
                      {a.name.replace('The ', '')}
                      {isYours && ' ← you'}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', a.bgColor.replace('/10', ''))}
                        style={{ width: `${entry.pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-surface-500 w-8 text-right flex-shrink-0">
                      {entry.pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.section>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <button
            onClick={handleShare}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-4 rounded-2xl',
              'font-mono text-base font-bold text-white',
              'bg-gradient-to-r from-for-600 to-for-500',
              'hover:from-for-500 hover:to-for-400',
              'transition-all duration-200'
            )}
          >
            {copied ? (
              <>
                <Check className="h-5 w-5" />
                Copied to clipboard!
              </>
            ) : (
              <>
                <Share2 className="h-5 w-5" />
                Share My Archetype
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleStart}
              className={cn(
                'flex items-center justify-center gap-2 py-3.5 rounded-2xl',
                'font-mono text-sm font-semibold text-surface-500',
                'bg-surface-100 border border-surface-300',
                'hover:bg-surface-200 hover:text-white transition-colors'
              )}
            >
              <RefreshCw className="h-4 w-4" />
              Retake Quiz
            </button>

            <Link
              href="/compass"
              className={cn(
                'flex items-center justify-center gap-2 py-3.5 rounded-2xl',
                'font-mono text-sm font-semibold text-surface-500',
                'bg-surface-100 border border-surface-300',
                'hover:bg-surface-200 hover:text-white transition-colors'
              )}
            >
              <BookOpen className="h-4 w-4" />
              Civic Compass
            </Link>
          </div>

          {/* Other archetypes */}
          <div className="mt-2">
            <p className="text-xs font-mono text-surface-600 mb-3 text-center">
              The other archetypes
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(Object.values(ARCHETYPES) as Archetype[]).filter((a) => a.id !== result).map((a) => {
                const AIcon = a.icon
                return (
                  <button
                    key={a.id}
                    title={a.name}
                    onClick={handleStart}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl',
                      'border text-center transition-colors opacity-60 hover:opacity-100',
                      a.bgColor, a.borderColor
                    )}
                  >
                    <AIcon className={cn('h-4 w-4', a.color)} />
                    <span className={cn('text-[10px] font-mono font-semibold leading-tight', a.color)}>
                      {a.name.replace('The ', '')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Flame className="h-3.5 w-3.5" />
              Go to Feed
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/quiz"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              Civic Quiz
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/profile/me"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
              My Profile
            </Link>
          </div>
        </motion.div>
      </main>
      <BottomNav />
    </div>
  )
}
