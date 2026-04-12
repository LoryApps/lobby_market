'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const TUTORIAL_KEY = 'lobby_feed_tutorial_seen_v1'

interface TutorialStep {
  title: string
  body: string
  accent: 'blue' | 'red' | 'gold' | 'purple'
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to the Lobby',
    body: 'Scroll through live political topics. Each card is a proposal that the community can vote into law — or defeat.',
    accent: 'blue',
  },
  {
    title: 'Vote For or Against',
    body: 'Blue is FOR. Red is AGAINST. Cast your vote on active topics to shape what becomes law. Your clout grows with every accurate call.',
    accent: 'red',
  },
  {
    title: 'Support proposals',
    body: 'New topics start in PROPOSED status. Support them to push them to a full vote. Enough support and the Lobby floor opens.',
    accent: 'gold',
  },
  {
    title: 'Chains and debates',
    body: 'Winning topics spawn new proposals in a chain. Debates let you argue your case live. The Floor is where the big decisions happen.',
    accent: 'purple',
  },
]

const accentStyles: Record<TutorialStep['accent'], { bg: string; border: string; text: string; dot: string }> = {
  blue: {
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    text: 'text-for-400',
    dot: 'bg-for-500',
  },
  red: {
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    text: 'text-against-400',
    dot: 'bg-against-500',
  },
  gold: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  purple: {
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    text: 'text-purple',
    dot: 'bg-purple',
  },
}

export function FeedTutorial() {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY)
    if (!seen) {
      // Slight delay so the feed loads first
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(TUTORIAL_KEY, '1')
    setVisible(false)
  }

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setDirection(1)
      setStepIndex((i) => i + 1)
    } else {
      dismiss()
    }
  }

  const goPrev = () => {
    if (stepIndex > 0) {
      setDirection(-1)
      setStepIndex((i) => i - 1)
    }
  }

  const step = STEPS[stepIndex]
  const accent = accentStyles[step.accent]
  const isLast = stepIndex === STEPS.length - 1

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="tutorial-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismiss()
          }}
        >
          <motion.div
            key="tutorial-panel"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative w-full max-w-sm bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Top accent bar */}
            <div className={cn('h-1 w-full', accent.dot === 'bg-for-500' ? 'bg-for-500' : accent.dot === 'bg-against-500' ? 'bg-against-500' : accent.dot === 'bg-amber-500' ? 'bg-amber-500' : 'bg-purple')} />

            {/* Close */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 text-surface-500 hover:text-surface-700 transition-colors"
              aria-label="Close tutorial"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              {/* Step indicator */}
              <div className="flex gap-1.5 mb-5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all duration-300',
                      i <= stepIndex ? accent.dot : 'bg-surface-300'
                    )}
                  />
                ))}
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepIndex}
                  initial={{ opacity: 0, x: direction * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -20 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className={cn('inline-flex px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold mb-3 uppercase tracking-wider', accent.bg, accent.border, accent.text)}>
                    Step {stepIndex + 1}
                  </div>
                  <h3 className="font-mono font-bold text-lg text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-surface-500 leading-relaxed">
                    {step.body}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                  className={cn(
                    'flex items-center gap-1 text-sm font-mono transition-colors',
                    stepIndex === 0
                      ? 'text-surface-400 cursor-not-allowed'
                      : 'text-surface-600 hover:text-white'
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  onClick={goNext}
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-mono font-semibold px-4 py-2 rounded-lg transition-all',
                    accent.bg, accent.border, 'border', accent.text,
                    'hover:opacity-80'
                  )}
                >
                  {isLast ? 'Enter the Lobby' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
