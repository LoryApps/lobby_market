'use client'

/**
 * SetupChecklist
 *
 * A dismissible card injected into the feed (after FeedTutorial) that
 * guides new users through completing their civic profile.
 *
 * Rules:
 *  - Only shown to logged-in users who haven't completed all setup steps.
 *  - Permanently hidden once all 6 steps are complete (or manually dismissed).
 *  - Dismissed state is stored in localStorage — no extra DB write needed.
 *  - Auto-hides with animation when dismissed.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Pencil,
  Sparkles,
  UserCircle2,
  Vote,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SetupProgress } from '@/app/api/me/setup/route'

// ─── Persistence ──────────────────────────────────────────────────────────────

const DISMISSED_KEY = 'lm_setup_checklist_dismissed_v1'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {}
}

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  id: keyof SetupProgress
  label: string
  description: string
  href: string
  icon: typeof UserCircle2
  color: string
}

const STEPS: Step[] = [
  {
    id: 'onboarding_complete',
    label: 'Complete the welcome quiz',
    description: 'Take 5 quick questions to calibrate your feed',
    href: '/onboarding',
    icon: Sparkles,
    color: 'text-gold',
  },
  {
    id: 'has_display_name',
    label: 'Add a display name',
    description: 'Give your civic voice a name',
    href: '/profile/settings',
    icon: UserCircle2,
    color: 'text-for-400',
  },
  {
    id: 'has_avatar',
    label: 'Upload a profile photo',
    description: 'Put a face to your civic identity',
    href: '/profile/settings',
    icon: Pencil,
    color: 'text-purple',
  },
  {
    id: 'has_bio',
    label: 'Write a short bio',
    description: 'Tell the Lobby who you are',
    href: '/profile/settings',
    icon: MessageSquare,
    color: 'text-emerald',
  },
  {
    id: 'has_voted',
    label: 'Cast your first vote',
    description: 'Weigh in on a topic in the feed',
    href: '/',
    icon: Vote,
    color: 'text-for-400',
  },
  {
    id: 'has_argued',
    label: 'Write your first argument',
    description: 'Make the case on any active topic',
    href: '/trending',
    icon: Award,
    color: 'text-against-400',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function SetupChecklist() {
  const [progress, setProgress] = useState<SetupProgress | null>(null)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [justCompleted, setJustCompleted] = useState(false)

  const load = useCallback(async () => {
    if (isDismissed()) return
    try {
      const res = await fetch('/api/me/setup')
      if (!res.ok) return
      const data: SetupProgress = await res.json()
      // Never show if already dismissed or fully complete at load time
      if (data.is_complete) {
        setDismissed()
        return
      }
      setProgress(data)
      setVisible(true)
    } catch {
      // best-effort — silently skip if unauthenticated
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDismissed()
    setVisible(false)
  }

  // When all steps complete while the card is showing, show a celebration
  // state for 2s then auto-dismiss.
  useEffect(() => {
    if (progress?.is_complete && visible) {
      setJustCompleted(true)
      setDismissed()
      const t = setTimeout(() => setVisible(false), 2500)
      return () => clearTimeout(t)
    }
  }, [progress, visible])

  if (!visible || !progress) return null

  const completedCount = progress.completed_count
  const totalCount = progress.total_count
  const pct = Math.round((completedCount / totalCount) * 100)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="setup-checklist"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="feed-card"
        >
          <div
            className={cn(
              'mx-4 my-2 rounded-2xl border overflow-hidden',
              justCompleted
                ? 'border-gold/50 bg-gold/5'
                : 'border-surface-300 bg-surface-100',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <div
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
                  justCompleted
                    ? 'bg-gold/15 border border-gold/30'
                    : 'bg-for-500/10 border border-for-500/20',
                )}
              >
                {justCompleted ? (
                  <Award className="h-4.5 w-4.5 text-gold" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4.5 w-4.5 text-for-400" aria-hidden="true" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-semibold',
                    justCompleted ? 'text-gold' : 'text-white',
                  )}
                >
                  {justCompleted ? 'Civic profile complete!' : 'Complete your civic profile'}
                </p>
                {!justCompleted && (
                  <p className="text-xs text-surface-500 mt-0.5">
                    {completedCount} of {totalCount} steps done
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!justCompleted && (
                  <button
                    onClick={() => setExpanded((e) => !e)}
                    className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                    aria-label={expanded ? 'Collapse setup checklist' : 'Expand setup checklist'}
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                  aria-label="Dismiss setup checklist"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {!justCompleted && (
              <div className="px-4 pb-3">
                <div
                  className="h-1.5 rounded-full bg-surface-300 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Profile ${pct}% complete`}
                >
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Steps list */}
            <AnimatePresence initial={false}>
              {expanded && !justCompleted && (
                <motion.div
                  key="steps"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ul className="px-4 pb-4 space-y-1">
                    {STEPS.map((step) => {
                      const done = !!progress[step.id]
                      const Icon = step.icon
                      return (
                        <li key={step.id}>
                          {done ? (
                            <div className="flex items-center gap-3 py-2 px-3 rounded-xl opacity-50">
                              <CheckCircle2
                                className="h-4 w-4 text-emerald flex-shrink-0"
                                aria-hidden="true"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-surface-400 line-through truncate">
                                  {step.label}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <Link
                              href={step.href}
                              className={cn(
                                'flex items-center gap-3 py-2 px-3 rounded-xl',
                                'hover:bg-surface-200 transition-colors group',
                              )}
                            >
                              <Circle
                                className="h-4 w-4 text-surface-500 flex-shrink-0 group-hover:text-surface-400"
                                aria-hidden="true"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{step.label}</p>
                                <p className="text-xs text-surface-500 truncate">
                                  {step.description}
                                </p>
                              </div>
                              <Icon
                                className={cn(
                                  'h-4 w-4 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity',
                                  step.color,
                                )}
                                aria-hidden="true"
                              />
                            </Link>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Just-completed celebration */}
            {justCompleted && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 pb-4 text-center"
              >
                <p className="text-sm text-surface-400">
                  Your civic identity is fully established. Time to debate.
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
