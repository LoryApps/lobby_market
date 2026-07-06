'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gavel,
  HelpCircle,
  Loader2,
  Scale,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { CheckerResult, Verdict, RelevantLaw } from '@/app/api/checker/route'
import type { FactCheckArgument } from './page'

// ─── Config ───────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<
  Verdict,
  { icon: typeof CheckCircle2; label: string; color: string; bg: string; border: string }
> = {
  SUPPORTED: {
    icon: CheckCircle2,
    label: 'Supported',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
  },
  CONTRADICTED: {
    icon: XCircle,
    label: 'Contradicted',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
  },
  MIXED: {
    icon: AlertTriangle,
    label: 'Mixed',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
  },
  NOT_COVERED: {
    icon: HelpCircle,
    label: 'Not Covered',
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-400',
  },
}

const RELATION_COLOR: Record<RelevantLaw['relation'], string> = {
  supports: 'text-emerald',
  contradicts: 'text-against-400',
  neutral: 'text-surface-400',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: CheckerResult }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }

interface Props {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  topicForPct: number
  topicTotalVotes: number
  arguments: FactCheckArgument[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color =
    confidence >= 70 ? 'bg-emerald' : confidence >= 40 ? 'bg-gold' : 'bg-against-500'
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
          Confidence
        </span>
        <span className="text-[10px] font-mono text-surface-300">{confidence}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${confidence}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function RelevantLawList({ laws }: { laws: RelevantLaw[] }) {
  if (laws.length === 0) return null
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
        Relevant Laws
      </p>
      {laws.map((law) => (
        <div
          key={law.id}
          className="rounded-lg border border-surface-300 bg-surface-200/50 px-3 py-2"
        >
          <div className="flex items-start gap-2">
            <Gavel
              className={cn('h-3 w-3 mt-0.5 flex-shrink-0', RELATION_COLOR[law.relation])}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/topic/${law.id}`}
                className="text-[11px] font-mono text-surface-200 hover:text-white transition-colors line-clamp-2 leading-snug"
              >
                {law.statement}
              </Link>
              {law.explanation && (
                <p className="text-[10px] font-mono text-surface-500 mt-1 leading-relaxed">
                  {law.explanation}
                </p>
              )}
            </div>
            <span
              className={cn(
                'flex-shrink-0 text-[9px] font-mono font-bold uppercase',
                RELATION_COLOR[law.relation],
              )}
            >
              {law.relation}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function VerdictDisplay({ result }: { result: CheckerResult }) {
  const cfg = VERDICT_CONFIG[result.verdict]
  const Icon = cfg.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border p-3 mt-3', cfg.bg, cfg.border)}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', cfg.color)} aria-hidden />
        <span className={cn('text-xs font-mono font-bold', cfg.color)}>{cfg.label}</span>
        {result.laws_checked > 0 && (
          <span className="text-[10px] font-mono text-surface-500 ml-auto">
            {result.laws_checked} laws checked
          </span>
        )}
      </div>
      <p className="text-[11px] font-mono text-surface-300 leading-relaxed">{result.summary}</p>
      <ConfidenceBar confidence={result.confidence} />
      <RelevantLawList laws={result.relevant_laws} />
    </motion.div>
  )
}

function ArgumentCard({
  arg,
  state,
  onCheck,
  checking,
}: {
  arg: FactCheckArgument
  state: CheckState
  onCheck: (arg: FactCheckArgument) => void
  checking: boolean
}) {
  const isFOR = arg.side === 'blue'

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
      {/* Side pill + upvotes */}
      <div className="flex items-center justify-between mb-2.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
            isFOR
              ? 'bg-for-500/15 text-for-400 border-for-500/30'
              : 'bg-against-500/15 text-against-400 border-against-500/30',
          )}
        >
          {isFOR ? (
            <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
          ) : (
            <ThumbsDown className="h-2.5 w-2.5" aria-hidden />
          )}
          {isFOR ? 'FOR' : 'AGAINST'}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <Zap className="h-3 w-3" aria-hidden />
          {arg.upvotes} upvotes
        </span>
      </div>

      {/* Argument text */}
      <p className="text-sm font-mono text-surface-200 leading-relaxed line-clamp-3 mb-3">
        {arg.content}
      </p>

      {/* Author */}
      {arg.author_username && (
        <div className="flex items-center gap-1.5 mb-3">
          <Avatar src={arg.author_avatar_url} username={arg.author_username} size="xs" />
          <Link
            href={`/profile/${arg.author_username}`}
            className="text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            @{arg.author_username}
          </Link>
        </div>
      )}

      {/* Check button / result */}
      {state.status === 'idle' && (
        <button
          onClick={() => onCheck(arg)}
          disabled={checking}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono border transition-all',
            'bg-surface-200/50 text-surface-400 border-surface-300',
            'hover:bg-surface-200 hover:text-white hover:border-surface-400',
            checking && 'opacity-40 cursor-not-allowed',
          )}
        >
          <Scale className="h-3.5 w-3.5" aria-hidden />
          Check against Codex
        </button>
      )}

      {state.status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-surface-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Checking…
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-against-500/30 bg-against-500/10 px-3 py-2 text-[11px] font-mono text-against-400">
          <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          {state.message}
        </div>
      )}

      {state.status === 'unavailable' && (
        <div className="mt-2 rounded-lg border border-surface-400 bg-surface-200 px-3 py-2 text-[11px] font-mono text-surface-500">
          AI checker unavailable — no API key configured.
        </div>
      )}

      {state.status === 'done' && <VerdictDisplay result={state.result} />}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FactCheckClient({
  topicId,
  topicStatement,
  topicCategory,
  topicStatus,
  topicForPct,
  topicTotalVotes,
  arguments: args,
}: Props) {
  const [states, setStates] = useState<Record<string, CheckState>>(() =>
    Object.fromEntries(args.map((a) => [a.id, { status: 'idle' }])),
  )
  const [checkingAll, setCheckingAll] = useState(false)

  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  const checkArgument = useCallback(async (arg: FactCheckArgument) => {
    setStates((prev) => ({ ...prev, [arg.id]: { status: 'loading' } }))
    try {
      const res = await fetch('/api/checker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: arg.content.slice(0, 500),
          category: topicCategory ?? undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setStates((prev) => ({
          ...prev,
          [arg.id]: {
            status: 'error',
            message: (err as { error?: string }).error ?? `HTTP ${res.status}`,
          },
        }))
        return
      }
      const result = (await res.json()) as CheckerResult
      if (result.unavailable) {
        setStates((prev) => ({ ...prev, [arg.id]: { status: 'unavailable' } }))
        return
      }
      setStates((prev) => ({ ...prev, [arg.id]: { status: 'done', result } }))
    } catch (e) {
      setStates((prev) => ({
        ...prev,
        [arg.id]: {
          status: 'error',
          message: e instanceof Error ? e.message : 'Request failed',
        },
      }))
    }
  }, [topicCategory])

  const checkAll = useCallback(async () => {
    setCheckingAll(true)
    const pending = args.filter((a) => states[a.id]?.status === 'idle')
    for (const arg of pending) {
      await checkArgument(arg)
      await sleep(300)
    }
    setCheckingAll(false)
  }, [args, states, checkArgument])

  const isAnyLoading = Object.values(states).some((s) => s.status === 'loading')
  const doneCount = Object.values(states).filter((s) => s.status === 'done').length
  const idleCount = Object.values(states).filter((s) => s.status === 'idle').length
  const checking = isAnyLoading || checkingAll

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-gold/10 border border-gold/30">
                <Scale className="h-3.5 w-3.5 text-gold" aria-hidden />
              </div>
              <h1 className="font-mono text-sm font-bold text-white">Argument Fact-Check</h1>
              <Badge
                variant={
                  topicStatus === 'law'
                    ? 'law'
                    : topicStatus === 'active' || topicStatus === 'voting'
                      ? 'active'
                      : topicStatus === 'failed'
                        ? 'failed'
                        : 'proposed'
                }
              >
                {topicStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm font-mono text-surface-300 line-clamp-2 leading-relaxed">
              {topicStatement}
            </p>
            <p className="text-[10px] font-mono text-surface-500 mt-1">
              {topicForPct}% FOR · {topicTotalVotes.toLocaleString()} votes
              {topicCategory && ` · ${topicCategory}`}
            </p>
          </div>
        </div>

        {/* ── Action strip ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <p className="text-xs font-mono text-surface-500">
            {args.length === 0
              ? 'No arguments yet — be the first to argue!'
              : `${args.length} argument${args.length !== 1 ? 's' : ''} · checked against the Codex`}
          </p>
          <div className="flex items-center gap-2">
            {doneCount > 0 && (
              <span className="text-[11px] font-mono text-surface-500">
                {doneCount}/{args.length} checked
              </span>
            )}
            {idleCount > 0 && (
              <button
                onClick={checkAll}
                disabled={checking}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                  'bg-gold/10 text-gold border-gold/30 hover:bg-gold/20 hover:border-gold/50',
                  checking && 'opacity-40 cursor-not-allowed',
                )}
              >
                {checking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Checking…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Check All ({idleCount})
                  </>
                )}
              </button>
            )}
            <Link
              href="/checker"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border bg-surface-200 text-surface-400 border-surface-300 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              Open Checker
            </Link>
          </div>
        </div>

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {args.length === 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
            <Scale className="h-10 w-10 text-surface-500 mx-auto mb-3" aria-hidden />
            <p className="font-mono text-sm text-surface-300 mb-1">No arguments to check</p>
            <p className="text-xs font-mono text-surface-500 mb-4">
              Add arguments to this debate and come back to fact-check them.
            </p>
            <Link
              href={`/topic/${topicId}/argue`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600/20 text-for-300 border border-for-500/30 text-xs font-mono hover:bg-for-600/30 transition-colors"
            >
              Add an Argument
            </Link>
          </div>
        )}

        {/* ── Two-column argument grid ───────────────────────────────────── */}
        {args.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* FOR column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp className="h-4 w-4 text-for-400" aria-hidden />
                <span className="text-xs font-mono font-semibold text-for-400">
                  FOR Arguments ({forArgs.length})
                </span>
              </div>
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {forArgs.map((arg) => (
                    <motion.div
                      key={arg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <ArgumentCard
                        arg={arg}
                        state={states[arg.id] ?? { status: 'idle' }}
                        onCheck={checkArgument}
                        checking={checking}
                      />
                    </motion.div>
                  ))}
                  {forArgs.length === 0 && (
                    <p className="text-xs font-mono text-surface-600 text-center py-6">
                      No FOR arguments yet
                    </p>
                  )}
                </div>
              </AnimatePresence>
            </div>

            {/* AGAINST column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsDown className="h-4 w-4 text-against-400" aria-hidden />
                <span className="text-xs font-mono font-semibold text-against-400">
                  AGAINST Arguments ({againstArgs.length})
                </span>
              </div>
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {againstArgs.map((arg) => (
                    <motion.div
                      key={arg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <ArgumentCard
                        arg={arg}
                        state={states[arg.id] ?? { status: 'idle' }}
                        onCheck={checkArgument}
                        checking={checking}
                      />
                    </motion.div>
                  ))}
                  {againstArgs.length === 0 && (
                    <p className="text-xs font-mono text-surface-600 text-center py-6">
                      No AGAINST arguments yet
                    </p>
                  )}
                </div>
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Footer nav ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-surface-300">
          <Link
            href={`/topic/${topicId}/arguments`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border bg-surface-200 text-surface-400 border-surface-300 hover:bg-surface-300 hover:text-white transition-colors"
          >
            All Arguments
          </Link>
          <Link
            href={`/topic/${topicId}/evidence`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border bg-surface-200 text-surface-400 border-surface-300 hover:bg-surface-300 hover:text-white transition-colors"
          >
            Evidence
          </Link>
          <Link
            href={`/topic/${topicId}/sources`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border bg-surface-200 text-surface-400 border-surface-300 hover:bg-surface-300 hover:text-white transition-colors"
          >
            Sources
          </Link>
          <Link
            href="/law"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border bg-gold/10 text-gold border-gold/30 hover:bg-gold/20 transition-colors"
          >
            <Gavel className="h-3 w-3" aria-hidden />
            The Codex
          </Link>
          <Link
            href="/checker"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border bg-surface-200 text-surface-400 border-surface-300 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <Scale className="h-3 w-3" aria-hidden />
            Fact Checker
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
