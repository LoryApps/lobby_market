'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Globe,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Tag,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DelegateCandidate, DelegateSearchResponse } from '@/app/api/delegation/search/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const

type Category = typeof CATEGORIES[number]

type ScopeType = 'global' | 'categories'

interface SelectedScope {
  type: ScopeType
  categories: Category[]
}

// ─── Role labels ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debater',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_COLORS: Record<string, string> = {
  person: 'text-surface-500',
  debator: 'text-for-300',
  troll_catcher: 'text-emerald',
  elder: 'text-gold',
  lawmaker: 'text-purple',
  senator: 'text-against-300',
}

// ─── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Learn', icon: Sparkles },
  { id: 2, label: 'Choose Delegate', icon: Users },
  { id: 3, label: 'Set Scope', icon: Globe },
  { id: 4, label: 'Done', icon: CheckCircle2 },
] as const

// ─── Concept cards ─────────────────────────────────────────────────────────────

const CONCEPTS = [
  {
    icon: Scale,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    title: 'Your vote, your rules',
    body: "Your explicit vote always wins. Delegation only activates when you haven't voted on a topic yourself.",
  },
  {
    icon: Shield,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
    title: 'Revocable any time',
    body: 'Delegations are not permanent. Revoke, change, or narrow the scope at any moment from your delegation dashboard.',
  },
  {
    icon: Globe,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
    title: 'Scoped trust',
    body: 'Delegate globally, by category, or topic-by-topic. You choose exactly how far your trust extends.',
  },
  {
    icon: Zap,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    title: 'Amplify your impact',
    body: "Can't follow every debate? Let a trusted citizen represent your views while you focus on what matters most.",
  },
]

// ─── Candidate card ────────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: DelegateCandidate
  selected: boolean
  onSelect: (c: DelegateCandidate) => void
}) {
  const roleLabel = ROLE_LABELS[candidate.role] ?? candidate.role
  const roleColor = ROLE_COLORS[candidate.role] ?? 'text-surface-500'
  const hasAlignment = candidate.alignment_pct !== null && candidate.topics_in_common >= 3

  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className={cn(
        'w-full flex items-start gap-3 p-4 rounded-2xl border transition-all text-left',
        selected
          ? 'bg-for-600/15 border-for-500/50 ring-1 ring-for-500/30'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400/70 hover:bg-surface-200/50',
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar
          src={candidate.avatar_url}
          fallback={candidate.display_name || candidate.username}
          size="md"
        />
        {selected && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-for-500 border-2 border-surface-100">
            <Check className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">
            {candidate.display_name || candidate.username}
          </span>
          <span className={cn('text-[11px] font-mono', roleColor)}>{roleLabel}</span>
        </div>
        <p className="text-xs text-surface-500 truncate">@{candidate.username}</p>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {hasAlignment && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                candidate.alignment_pct! >= 75
                  ? 'bg-for-500/15 text-for-300'
                  : candidate.alignment_pct! >= 55
                  ? 'bg-emerald/15 text-emerald'
                  : 'bg-surface-300/50 text-surface-500',
              )}
            >
              <Scale className="h-3 w-3" />
              {candidate.alignment_pct}% aligned
              <span className="text-surface-600 font-normal">({candidate.topics_in_common} topics)</span>
            </span>
          )}
          {candidate.trusted_by > 0 && (
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <Users className="h-3 w-3" />
              {candidate.trusted_by} delegating
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-surface-500">
            <Award className="h-3 w-3 text-gold/70" />
            {candidate.clout.toLocaleString()} clout
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Scope picker ──────────────────────────────────────────────────────────────

function CategoryPill({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: (label: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(label)}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
        active
          ? 'bg-for-600/20 border-for-500/50 text-for-300'
          : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
      )}
    >
      {active ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {label}
    </button>
  )
}

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 justify-center mb-6">
      {STEPS.map((s, i) => {
        const done = step > s.id
        const active = step === s.id
        return (
          <div key={s.id} className="flex items-center gap-1">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                done ? 'bg-for-500 text-white' : active ? 'bg-for-600/30 border border-for-500/50 text-for-300' : 'bg-surface-200 text-surface-500 border border-surface-300',
              )}
            >
              {done ? <Check className="h-3 w-3" /> : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-8 h-0.5 rounded-full transition-all', done ? 'bg-for-500/50' : 'bg-surface-300')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DelegateGuideClient() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [candidates, setCandidates] = useState<DelegateCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [selected, setSelected] = useState<DelegateCandidate | null>(null)
  const [scope, setScope] = useState<SelectedScope>({ type: 'global', categories: [] })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [_delegatedIds, setDelegatedIds] = useState<Set<string>>(new Set())

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true)
    try {
      const res = await fetch('/api/delegation/search?q=')
      if (res.ok) {
        const data = (await res.json()) as DelegateSearchResponse
        setCandidates(data.candidates.slice(0, 8))
      }
    } finally {
      setLoadingCandidates(false)
    }
  }, [])

  useEffect(() => {
    if (step === 2) loadCandidates()
  }, [step, loadCandidates])

  function toggleCategory(cat: string) {
    setScope((prev) => {
      const cats = prev.categories as string[]
      return {
        type: 'categories',
        categories: cats.includes(cat)
          ? (cats.filter((c) => c !== cat) as Category[])
          : ([...cats, cat] as Category[]),
      }
    })
  }

  function selectGlobal() {
    setScope({ type: 'global', categories: [] })
  }

  async function handleSubmit() {
    if (!selected) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      if (scope.type === 'global' || scope.categories.length === 0) {
        // Create a single global delegation
        const res = await fetch('/api/delegation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delegate_id: selected.id }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? 'Failed to create delegation')
        }
      } else {
        // Create one delegation per selected category
        const results = await Promise.allSettled(
          scope.categories.map((cat) =>
            fetch('/api/delegation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ delegate_id: selected.id, category: cat }),
            })
          )
        )
        const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
        if (failed.length > 0) throw new Error('Some category delegations could not be created')
      }

      setDelegatedIds((prev) => new Set([...prev, selected.id]))
      setStep(4)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const scopeDescription =
    scope.type === 'global'
      ? 'All topics on the platform'
      : scope.categories.length === 0
      ? 'Select categories below'
      : scope.categories.join(', ')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back button */}
        <div className="mb-5">
          <Link
            href="/delegate"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Delegation
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Delegation Setup Guide</h1>
          <p className="text-sm text-surface-500 mt-1">
            Set up Liquid Democracy in a few minutes — your vote, amplified.
          </p>
        </div>

        <StepIndicator step={step} />

        <AnimatePresence mode="wait">
          {/* ── Step 1: Learn ─────────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="rounded-3xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/15 border border-for-500/30">
                    <Sparkles className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">What is Liquid Democracy?</h2>
                    <p className="text-xs text-surface-500">How vote delegation works on Lobby Market</p>
                  </div>
                </div>

                <p className="text-sm text-surface-400 leading-relaxed mb-5">
                  Liquid Democracy lets you delegate your voting power to someone you trust — a friend,
                  an expert, or a public figure whose civic judgment you respect. When a topic comes up
                  that you haven&apos;t voted on, your delegate&apos;s vote automatically represents you.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CONCEPTS.map((c) => {
                    const Icon = c.icon
                    return (
                      <div
                        key={c.title}
                        className={cn('rounded-2xl border p-3.5', c.bg, c.border)}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className={cn('h-4 w-4', c.color)} />
                          <span className="text-sm font-semibold text-white">{c.title}</span>
                        </div>
                        <p className="text-xs text-surface-400 leading-relaxed">{c.body}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-start gap-3">
                <Tag className="h-4 w-4 text-surface-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-surface-400 leading-relaxed">
                  <span className="text-surface-300 font-semibold">Already delegating?</span>{' '}
                  Visit your{' '}
                  <Link href="/delegate" className="text-for-400 hover:underline">
                    Delegation Dashboard
                  </Link>{' '}
                  to manage existing delegations, or view your{' '}
                  <Link href="/delegate/history" className="text-for-400 hover:underline">
                    Delegation History
                  </Link>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-for-600 hover:bg-for-500 text-white font-semibold text-sm transition-colors"
              >
                Find my delegate
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Choose delegate ────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="rounded-3xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Recommended Delegates</h2>
                    <p className="text-xs text-surface-500 mt-0.5">
                      Citizens ranked by trust and alignment with your votes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadCandidates}
                    disabled={loadingCandidates}
                    className="p-2 rounded-lg bg-surface-200 text-surface-500 hover:text-surface-300 hover:bg-surface-300 transition-colors disabled:opacity-50"
                    aria-label="Refresh suggestions"
                  >
                    <RefreshCw className={cn('h-4 w-4', loadingCandidates && 'animate-spin')} />
                  </button>
                </div>

                {loadingCandidates ? (
                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-surface-200/40 border border-surface-300">
                        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-surface-500 mx-auto mb-2" />
                    <p className="text-sm text-surface-500">No candidates found</p>
                    <p className="text-xs text-surface-600 mt-1">Vote on more topics to get alignment-based suggestions</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {candidates.map((c) => (
                      <CandidateCard
                        key={c.id}
                        candidate={c}
                        selected={selected?.id === c.id}
                        onSelect={setSelected}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white font-semibold text-sm transition-colors border border-surface-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selected}
                  className="flex-[2] flex items-center justify-center gap-2 h-12 rounded-2xl bg-for-600 hover:bg-for-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                >
                  {selected ? (
                    <>
                      Continue with {selected.display_name || selected.username}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    'Select a delegate to continue'
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Choose scope ───────────────────────────────────────── */}
          {step === 3 && selected && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="rounded-3xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar
                    src={selected.avatar_url}
                    fallback={selected.display_name || selected.username}
                    size="sm"
                  />
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Delegating to {selected.display_name || selected.username}
                    </h2>
                    <p className="text-xs text-surface-500">How far should their trust extend?</p>
                  </div>
                </div>

                {/* Scope options */}
                <div className="space-y-2 mb-4">
                  <button
                    type="button"
                    onClick={selectGlobal}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left',
                      scope.type === 'global'
                        ? 'bg-for-600/15 border-for-500/50 ring-1 ring-for-500/30'
                        : 'bg-surface-200/50 border-surface-300 hover:border-surface-400',
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
                      scope.type === 'global' ? 'bg-for-500/20' : 'bg-surface-300',
                    )}>
                      <Globe className={cn('h-4 w-4', scope.type === 'global' ? 'text-for-300' : 'text-surface-500')} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Global delegation</p>
                      <p className="text-xs text-surface-500">Trust them on all topics you haven&apos;t voted on</p>
                    </div>
                    {scope.type === 'global' && (
                      <Check className="h-4 w-4 text-for-400 ml-auto flex-shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope({ type: 'categories', categories: [] })}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left',
                      scope.type === 'categories'
                        ? 'bg-purple/10 border-purple/40 ring-1 ring-purple/20'
                        : 'bg-surface-200/50 border-surface-300 hover:border-surface-400',
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
                      scope.type === 'categories' ? 'bg-purple/20' : 'bg-surface-300',
                    )}>
                      <Tag className={cn('h-4 w-4', scope.type === 'categories' ? 'text-purple' : 'text-surface-500')} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Specific categories</p>
                      <p className="text-xs text-surface-500">Pick the policy areas you trust them most in</p>
                    </div>
                    {scope.type === 'categories' && (
                      <Check className="h-4 w-4 text-purple ml-auto flex-shrink-0" />
                    )}
                  </button>
                </div>

                {/* Category picker */}
                <AnimatePresence>
                  {scope.type === 'categories' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-surface-500 mb-2">Select categories (at least one):</p>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((cat) => (
                          <CategoryPill
                            key={cat}
                            label={cat}
                            active={scope.categories.includes(cat)}
                            onToggle={toggleCategory}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Scope summary */}
                <div className="mt-4 p-3 rounded-xl bg-surface-200/50 border border-surface-300 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-surface-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-surface-400 leading-relaxed">
                    <span className="text-surface-300 font-semibold">Scope: </span>
                    {scopeDescription}
                    <span className="text-surface-600"> · Your explicit votes always override this.</span>
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="rounded-xl bg-against-600/15 border border-against-500/30 p-3 text-sm text-against-300">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white font-semibold text-sm transition-colors border border-surface-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || (scope.type === 'categories' && scope.categories.length === 0)}
                  className="flex-[2] flex items-center justify-center gap-2 h-12 rounded-2xl bg-for-600 hover:bg-for-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating delegation…</>
                  ) : (
                    <>Activate delegation <Zap className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Success ────────────────────────────────────────────── */}
          {step === 4 && selected && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="flex items-center justify-center h-16 w-16 rounded-full bg-for-500/20 border border-for-500/40 mx-auto mb-4"
                >
                  <CheckCircle2 className="h-8 w-8 text-for-400" />
                </motion.div>

                <h2 className="text-xl font-bold text-white mb-2">Delegation Active</h2>
                <p className="text-sm text-surface-400 mb-4">
                  You&apos;re now delegating to{' '}
                  <Link href={`/profile/${selected.username}`} className="text-for-300 hover:underline font-semibold">
                    {selected.display_name || selected.username}
                  </Link>
                  {scope.type === 'global'
                    ? ' on all topics.'
                    : scope.categories.length > 0
                    ? ` in ${scope.categories.join(', ')}.`
                    : '.'}
                </p>

                <div className="grid grid-cols-2 gap-3 text-left mb-5">
                  <div className="rounded-2xl bg-surface-200/60 border border-surface-300 p-3">
                    <p className="text-xs text-surface-500 mb-0.5">Delegate</p>
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={selected.avatar_url}
                        fallback={selected.display_name || selected.username}
                        size="xs"
                      />
                      <span className="text-sm font-semibold text-white truncate">
                        {selected.display_name || selected.username}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-surface-200/60 border border-surface-300 p-3">
                    <p className="text-xs text-surface-500 mb-0.5">Scope</p>
                    <div className="flex items-center gap-2">
                      {scope.type === 'global'
                        ? <Globe className="h-4 w-4 text-for-400 flex-shrink-0" />
                        : <Tag className="h-4 w-4 text-purple flex-shrink-0" />}
                      <span className="text-sm font-semibold text-white truncate">
                        {scope.type === 'global' ? 'Global' : `${scope.categories.length} categories`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Link
                    href="/delegate"
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-200/60 border border-surface-300 hover:border-surface-400 transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-sm text-surface-300 group-hover:text-white transition-colors">
                      <Scale className="h-4 w-4 text-for-400" />
                      Manage all delegations
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                  </Link>
                  <Link
                    href="/delegate/history"
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-200/60 border border-surface-300 hover:border-surface-400 transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-sm text-surface-300 group-hover:text-white transition-colors">
                      <Shield className="h-4 w-4 text-emerald" />
                      View delegation history
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                  </Link>
                  <Link
                    href="/delegate/impact"
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-200/60 border border-surface-300 hover:border-surface-400 transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-sm text-surface-300 group-hover:text-white transition-colors">
                      <Zap className="h-4 w-4 text-gold" />
                      Explore delegation impact
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                  </Link>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white font-semibold text-sm transition-colors border border-surface-300"
              >
                Return to Feed
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
