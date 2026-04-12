'use client'

import { useState } from 'react'
import {
  CheckCircle,
  Loader2,
  Shield,
  Target,
  XCircle,
} from 'lucide-react'
import type { TrollCatcherTraining } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface TrainingCase {
  id: number
  content: string
  context: string
  correctAnswer: 'approve' | 'remove'
  explanation: string
}

const TRAINING_CASES: TrainingCase[] = [
  {
    id: 1,
    content: 'I disagree with this policy because of these three statistics…',
    context: 'Posted in a policy debate',
    correctAnswer: 'approve',
    explanation:
      'Substantive disagreement backed by evidence is exactly what debate encourages.',
  },
  {
    id: 2,
    content: 'You are a brainwashed idiot and should shut up.',
    context: 'Reply in a voting thread',
    correctAnswer: 'remove',
    explanation:
      'Ad hominem attack with no substantive argument. Remove.',
  },
  {
    id: 3,
    content: 'Actually the source cited here is from 2008, here is a more recent one.',
    context: 'Comment on a topic',
    correctAnswer: 'approve',
    explanation: 'Productive source correction — keep.',
  },
  {
    id: 4,
    content: 'BUY MY CRYPTO NOW 100x GAINS GUARANTEED',
    context: 'Posted as a top-level argument',
    correctAnswer: 'remove',
    explanation: 'Off-topic commercial spam.',
  },
  {
    id: 5,
    content: 'I changed my mind after reading this chain, voting FOR.',
    context: 'Vote explanation',
    correctAnswer: 'approve',
    explanation: 'Vote transparency is always welcome.',
  },
  {
    id: 6,
    content: '[Slur] people ruined this country.',
    context: 'Comment',
    correctAnswer: 'remove',
    explanation: 'Hate speech — remove and escalate if repeated.',
  },
  {
    id: 7,
    content: 'The consensus model here seems to reward loud voices. We should rethink weights.',
    context: 'Meta discussion',
    correctAnswer: 'approve',
    explanation: 'Constructive platform criticism is protected speech.',
  },
  {
    id: 8,
    content: 'KILL YOURSELF',
    context: 'Direct reply',
    correctAnswer: 'remove',
    explanation: 'Harassment / self-harm instigation — immediate remove + ban.',
  },
  {
    id: 9,
    content: 'Isn\'t this topic basically a duplicate of #1234?',
    context: 'Comment on a new topic',
    correctAnswer: 'approve',
    explanation: 'Useful moderation callout — keep.',
  },
  {
    id: 10,
    content: 'Here is a link to the original paper so people can read it: https://…',
    context: 'Evidence comment',
    correctAnswer: 'approve',
    explanation: 'Sharing primary sources strengthens debate.',
  },
  {
    id: 11,
    content: 'Everyone who voted FOR is a sheep.',
    context: 'Post-vote comment',
    correctAnswer: 'remove',
    explanation: 'Insulting half the voter base chills participation.',
  },
  {
    id: 12,
    content: 'Vaccines contain tracking chips, here\'s a YouTube link that proves it.',
    context: 'Health debate',
    correctAnswer: 'remove',
    explanation: 'Debunked medical misinformation — remove.',
  },
  {
    id: 13,
    content: 'I used to agree, but this continuation really changed my view.',
    context: 'Chain discussion',
    correctAnswer: 'approve',
    explanation: 'Genuine mind-change narrative — exactly the point.',
  },
  {
    id: 14,
    content: 'free iphones click here lol',
    context: 'Random comment',
    correctAnswer: 'remove',
    explanation: 'Phishing bait.',
  },
  {
    id: 15,
    content: 'My lobby is recruiting members who care about labor rights.',
    context: 'Lobby intro',
    correctAnswer: 'approve',
    explanation: 'Legitimate lobby recruitment on topic.',
  },
  {
    id: 16,
    content: 'Anyone doxxing user @person is a hero.',
    context: 'Reply',
    correctAnswer: 'remove',
    explanation: 'Doxxing incitement — remove and escalate.',
  },
  {
    id: 17,
    content: 'This vote is rigged, the system is broken.',
    context: 'Comment on a close vote',
    correctAnswer: 'approve',
    explanation:
      'Strong criticism of system is allowed as long as it\'s not coordinated misinformation.',
  },
  {
    id: 18,
    content: 'Here is my thoughtful case for a different interpretation…',
    context: 'Argument',
    correctAnswer: 'approve',
    explanation: 'Exactly the kind of argument the platform exists for.',
  },
  {
    id: 19,
    content: 'I will pay 100 clout to anyone who boosts my continuation.',
    context: 'Lobby post',
    correctAnswer: 'remove',
    explanation:
      'Vote buying violates the Clout economy rules — remove and warn.',
  },
  {
    id: 20,
    content: 'Happy to vote FOR after reading this — good research!',
    context: 'Quick comment',
    correctAnswer: 'approve',
    explanation: 'Positive engagement — keep.',
  },
]

const PASS_THRESHOLD = 0.8

type Phase = 'intro' | 'case' | 'feedback' | 'complete'

interface TrainingModuleProps {
  initialTraining?: TrollCatcherTraining | null
}

export function TrainingModule({ initialTraining }: TrainingModuleProps) {
  const [phase, setPhase] = useState<Phase>(
    initialTraining && initialTraining.cases_attempted >= TRAINING_CASES.length
      ? 'complete'
      : 'intro'
  )
  const [caseIndex, setCaseIndex] = useState(
    initialTraining?.cases_attempted ?? 0
  )
  const [correct, setCorrect] = useState(
    initialTraining?.cases_correct ?? 0
  )
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [passed, setPassed] = useState(initialTraining?.passed ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentCase = TRAINING_CASES[caseIndex]
  const progressPct = (caseIndex / TRAINING_CASES.length) * 100
  const accuracyPct =
    caseIndex > 0 ? Math.round((correct / caseIndex) * 100) : 0

  const submit = async (answer: 'approve' | 'remove') => {
    if (!currentCase) return
    const isCorrect = answer === currentCase.correctAnswer
    setLastCorrect(isCorrect)
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/training/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correct: isCorrect }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to submit answer')
      }
      const data = await res.json()
      if (isCorrect) setCorrect((c) => c + 1)
      if (data.passed) setPassed(true)
      setPhase('feedback')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const advance = () => {
    const next = caseIndex + 1
    if (next >= TRAINING_CASES.length) {
      setPhase('complete')
    } else {
      setCaseIndex(next)
      setLastCorrect(null)
      setPhase('case')
    }
  }

  if (phase === 'intro') {
    return (
      <div className="rounded-2xl border border-emerald/30 bg-surface-100 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-emerald" />
            <h2 className="font-mono text-xl font-semibold text-white">
              Troll Catcher Certification
            </h2>
          </div>
          <p className="font-mono text-sm text-surface-600 leading-relaxed max-w-prose">
            Work through {TRAINING_CASES.length} moderation cases. Decide
            whether each piece of content stays or goes. You need{' '}
            <span className="text-emerald font-semibold">
              {Math.round(PASS_THRESHOLD * 100)}%
            </span>{' '}
            accuracy to be certified and unlock the moderation queue.
          </p>
          <div className="mt-6">
            <Button
              variant="gold"
              size="lg"
              onClick={() => setPhase('case')}
            >
              <Target className="h-4 w-4" />
              Start Training
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'complete' || !currentCase) {
    const didPass =
      passed || correct / Math.max(caseIndex, 1) >= PASS_THRESHOLD
    return (
      <div
        className={cn(
          'rounded-2xl border p-8 relative overflow-hidden text-center',
          didPass
            ? 'border-emerald/40 bg-emerald/5'
            : 'border-against-500/40 bg-against-500/5'
        )}
      >
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4',
            didPass
              ? 'bg-emerald/10 text-emerald'
              : 'bg-against-500/10 text-against-400'
          )}
        >
          {didPass ? (
            <Shield className="h-8 w-8" />
          ) : (
            <XCircle className="h-8 w-8" />
          )}
        </div>
        <h2 className="font-mono text-2xl font-bold text-white mb-2">
          {didPass ? 'Certified' : 'Try again'}
        </h2>
        <p className="font-mono text-sm text-surface-500 mb-5">
          You scored {correct} / {TRAINING_CASES.length} ({accuracyPct}%)
        </p>
        {didPass ? (
          <p className="font-mono text-xs text-emerald max-w-prose mx-auto">
            A community elder will review and promote your role to
            troll_catcher, granting access to the moderation queue.
          </p>
        ) : (
          <p className="font-mono text-xs text-surface-500 max-w-prose mx-auto">
            You need at least {Math.round(PASS_THRESHOLD * 100)}% accuracy
            to be certified. Review the case notes and take the training
            again when you are ready.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between font-mono text-[11px] text-surface-500">
        <span>
          Case {caseIndex + 1} / {TRAINING_CASES.length}
        </span>
        <span>Accuracy: {accuracyPct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full bg-emerald transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
        <div className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-2">
          {currentCase.context}
        </div>
        <blockquote className="font-mono text-base text-white leading-relaxed border-l-2 border-emerald/50 pl-4 py-2">
          {currentCase.content}
        </blockquote>

        {phase === 'case' && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                variant="for"
                size="lg"
                onClick={() => submit('approve')}
                disabled={submitting}
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="against"
                size="lg"
                onClick={() => submit('remove')}
                disabled={submitting}
              >
                <XCircle className="h-4 w-4" />
                Remove
              </Button>
            </div>
            {submitting && (
              <div className="mt-3 flex items-center justify-center gap-2 text-surface-500 font-mono text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Submitting…
              </div>
            )}
          </>
        )}

        {phase === 'feedback' && (
          <div className="mt-6 space-y-4">
            <div
              className={cn(
                'rounded-xl border p-4 flex items-start gap-3',
                lastCorrect
                  ? 'border-emerald/30 bg-emerald/5'
                  : 'border-against-500/30 bg-against-500/5'
              )}
            >
              {lastCorrect ? (
                <CheckCircle className="h-5 w-5 text-emerald flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-against-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div
                  className={cn(
                    'font-mono text-sm font-semibold',
                    lastCorrect ? 'text-emerald' : 'text-against-400'
                  )}
                >
                  {lastCorrect ? 'Correct' : 'Not quite'}
                </div>
                <p className="mt-1 font-mono text-xs text-surface-600 leading-relaxed">
                  Correct answer:{' '}
                  <span className="text-white font-semibold">
                    {currentCase.correctAnswer === 'approve'
                      ? 'Approve'
                      : 'Remove'}
                  </span>
                </p>
                <p className="mt-2 font-mono text-xs text-surface-600 leading-relaxed">
                  {currentCase.explanation}
                </p>
              </div>
            </div>
            <Button
              variant="gold"
              size="md"
              onClick={advance}
              className="w-full"
            >
              Next Case
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-against-500/30 bg-against-500/10 px-3 py-2 text-xs font-mono text-against-400">
          {error}
        </div>
      )}
    </div>
  )
}
