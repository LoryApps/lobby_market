'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

// ---------------------------------------------------------------------------
// Quiz definition
// ---------------------------------------------------------------------------

interface QuizQuestion {
  id: string
  prompt: string
  left: { label: string; sublabel: string; categories: string[] }
  right: { label: string; sublabel: string; categories: string[] }
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'economy',
    prompt: 'When it comes to economic progress…',
    left: {
      label: 'Markets lead',
      sublabel: 'Competition drives innovation and prosperity',
      categories: ['Economics'],
    },
    right: {
      label: 'Community governs',
      sublabel: 'Collective rules ensure fairness and stability',
      categories: ['Politics'],
    },
  },
  {
    id: 'technology',
    prompt: 'When new technology emerges…',
    left: {
      label: 'Embrace it',
      sublabel: 'Every breakthrough expands human capability',
      categories: ['Technology', 'Science'],
    },
    right: {
      label: 'Question it',
      sublabel: 'Progress without ethics creates new dangers',
      categories: ['Ethics', 'Philosophy'],
    },
  },
  {
    id: 'values',
    prompt: 'On individual vs collective truth…',
    left: {
      label: 'Individual rights',
      sublabel: 'Each person defines their own values and path',
      categories: ['Philosophy', 'Ethics'],
    },
    right: {
      label: 'Shared truths',
      sublabel: 'Society depends on common ground and norms',
      categories: ['Culture', 'Politics'],
    },
  },
  {
    id: 'power',
    prompt: 'Decisions that affect everyone should be made by…',
    left: {
      label: 'Experts',
      sublabel: 'Specialists understand complex systems best',
      categories: ['Science', 'Technology'],
    },
    right: {
      label: 'The people',
      sublabel: 'Legitimacy flows from democratic consent',
      categories: ['Politics', 'Culture'],
    },
  },
  {
    id: 'future',
    prompt: 'Building a better world means…',
    left: {
      label: 'Honor tradition',
      sublabel: 'The wisdom of the past grounds the future',
      categories: ['Culture', 'Philosophy'],
    },
    right: {
      label: 'Forge ahead',
      sublabel: 'Bold ideas break the constraints of yesterday',
      categories: ['Science', 'Technology'],
    },
  },
]

type Choice = 'left' | 'right'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'intro' | 'quiz' | 'calibrating' | 'done'>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [choices, setChoices] = useState<Choice[]>([])
  const [direction, setDirection] = useState(1)
  const [saving, setSaving] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
    })
  }, [router])

  const handleChoice = useCallback(
    async (choice: Choice) => {
      const nextChoices = [...choices, choice]
      setChoices(nextChoices)

      if (questionIndex < QUESTIONS.length - 1) {
        setDirection(1)
        setQuestionIndex((i) => i + 1)
      } else {
        // All questions answered — compute preferences and save
        setStep('calibrating')
        setSaving(true)

        const categoryScores: Record<string, number> = {}
        nextChoices.forEach((c, i) => {
          const side = QUESTIONS[i][c]
          side.categories.forEach((cat) => {
            categoryScores[cat] = (categoryScores[cat] ?? 0) + 1
          })
        })

        // Sort by score desc, take top categories
        const sortedCategories = Object.entries(categoryScores)
          .sort((a, b) => b[1] - a[1])
          .map(([cat]) => cat)

        try {
          await fetch('/api/onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryPreferences: sortedCategories }),
          })
        } catch {
          // Non-fatal — onboarding data is best-effort
        }

        setSaving(false)

        // Brief pause for the calibrating animation, then redirect
        setTimeout(() => {
          setStep('done')
          setTimeout(() => router.replace('/'), 800)
        }, 2200)
      }
    },
    [choices, questionIndex, router]
  )

  const currentQuestion = QUESTIONS[questionIndex]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-for-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-against-500/5 rounded-full blur-3xl" />
      </div>

      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 max-w-lg w-full text-center"
          >
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-for-500/10 border border-for-500/30 mb-6">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-10 h-10 text-for-400"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75"
                  />
                </svg>
              </div>
              <h1 className="font-mono text-3xl font-bold text-white mb-3">
                Calibrate your Lobby
              </h1>
              <p className="text-surface-500 text-base leading-relaxed max-w-sm mx-auto">
                Five quick questions to tune your feed. Answer honestly — the
                algorithm learns from your instincts, not your ideals.
              </p>
            </div>

            <button
              onClick={() => setStep('quiz')}
              className={cn(
                'w-full max-w-xs mx-auto block',
                'bg-for-600 hover:bg-for-500 text-white',
                'font-mono font-semibold text-base',
                'px-8 py-4 rounded-xl',
                'transition-all duration-200',
                'border border-for-500/50 hover:border-for-400',
                'shadow-lg shadow-for-900/30'
              )}
            >
              Begin calibration
            </button>

            <button
              onClick={() => router.replace('/')}
              className="mt-4 text-sm text-surface-500 hover:text-surface-600 font-mono transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        )}

        {step === 'quiz' && (
          <motion.div
            key={`quiz-${questionIndex}`}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-2xl"
          >
            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
                  Question {questionIndex + 1} of {QUESTIONS.length}
                </span>
                <span className="font-mono text-xs text-surface-500">
                  {Math.round(((questionIndex) / QUESTIONS.length) * 100)}%
                </span>
              </div>
              <div className="h-1 w-full bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-for-500 rounded-full"
                  initial={{ width: `${(questionIndex / QUESTIONS.length) * 100}%` }}
                  animate={{ width: `${((questionIndex + 1) / QUESTIONS.length) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>

            {/* Question */}
            <h2 className="font-mono text-xl font-semibold text-white text-center mb-8">
              {currentQuestion.prompt}
            </h2>

            {/* Choice cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ChoiceCard
                side="left"
                label={currentQuestion.left.label}
                sublabel={currentQuestion.left.sublabel}
                color="blue"
                onClick={() => handleChoice('left')}
              />
              <ChoiceCard
                side="right"
                label={currentQuestion.right.label}
                sublabel={currentQuestion.right.sublabel}
                color="red"
                onClick={() => handleChoice('right')}
              />
            </div>

            {/* Dot indicators */}
            <div className="flex justify-center gap-2 mt-8">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    i < questionIndex
                      ? 'bg-for-400'
                      : i === questionIndex
                      ? 'bg-white scale-110'
                      : 'bg-surface-400'
                  )}
                />
              ))}
            </div>
          </motion.div>
        )}

        {(step === 'calibrating' || step === 'done') && (
          <motion.div
            key="calibrating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="relative z-10 text-center max-w-sm w-full"
          >
            <CalibrationAnimation done={step === 'done'} saving={saving} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChoiceCard({
  label,
  sublabel,
  color,
  onClick,
}: {
  side: 'left' | 'right'
  label: string
  sublabel: string
  color: 'blue' | 'red'
  onClick: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const isBlue = color === 'blue'

  return (
    <motion.button
      onClick={() => {
        setPressed(true)
        setTimeout(onClick, 180)
      }}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative text-left w-full',
        'bg-surface-100 border rounded-2xl p-6',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2',
        isBlue
          ? 'border-surface-300 hover:border-for-500/60 hover:bg-for-950/40 focus:ring-for-500/40'
          : 'border-surface-300 hover:border-against-500/60 hover:bg-against-950/40 focus:ring-against-500/40',
        pressed && (isBlue ? 'border-for-500 bg-for-950/60' : 'border-against-500 bg-against-950/60')
      )}
    >
      <div
        className={cn(
          'inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4',
          'border transition-colors duration-200',
          isBlue
            ? 'bg-for-500/10 border-for-500/30 group-hover:bg-for-500/20'
            : 'bg-against-500/10 border-against-500/30 group-hover:bg-against-500/20'
        )}
      >
        {isBlue ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-for-400">
            <path
              fillRule="evenodd"
              d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-against-400">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      <p
        className={cn(
          'font-mono font-bold text-lg mb-1 transition-colors duration-200',
          isBlue ? 'text-white group-hover:text-for-300' : 'text-white group-hover:text-against-300'
        )}
      >
        {label}
      </p>
      <p className="text-sm text-surface-500 leading-relaxed">{sublabel}</p>
    </motion.button>
  )
}

function CalibrationAnimation({ done, saving }: { done: boolean; saving: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Animated rings */}
      <div className="relative w-24 h-24">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-for-500/30"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-for-400/50"
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />
        <motion.div
          className="absolute inset-4 rounded-full bg-for-500/20 border border-for-500/40 flex items-center justify-center"
          animate={done ? { scale: [1, 1.2, 1], backgroundColor: ['rgba(59,130,246,0.2)', 'rgba(59,130,246,0.4)', 'rgba(59,130,246,0.2)'] } : {}}
        >
          {done ? (
            <motion.svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-8 h-8 text-for-400"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </motion.svg>
          ) : (
            <motion.div
              className="w-6 h-6 border-2 border-for-400 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </motion.div>
      </div>

      <div>
        <motion.h2
          className="font-mono text-xl font-bold text-white mb-2"
          animate={done ? { color: '#60a5fa' } : {}}
        >
          {done ? 'Lobby calibrated' : saving ? 'Saving preferences...' : 'Calibrating your Lobby...'}
        </motion.h2>
        {!done && (
          <p className="text-sm text-surface-500 font-mono">
            Mapping your perspectives to the feed algorithm
          </p>
        )}
        {done && (
          <motion.p
            className="text-sm text-for-400 font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Entering the Lobby
          </motion.p>
        )}
      </div>

      {/* Category pills animation */}
      {!done && (
        <div className="flex flex-wrap justify-center gap-2 max-w-xs">
          {['Politics', 'Economics', 'Technology', 'Ethics', 'Culture', 'Science', 'Philosophy'].map((cat, i) => (
            <motion.span
              key={cat}
              className="px-3 py-1 rounded-full text-xs font-mono bg-surface-200 text-surface-500 border border-surface-300"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.7, 0.3], scale: [0.8, 1, 0.9] }}
              transition={{
                duration: 1.5,
                delay: i * 0.15,
                repeat: Infinity,
                repeatDelay: 0.5,
              }}
            >
              {cat}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  )
}
