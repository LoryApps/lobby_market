'use client'

/**
 * /topic/[id]/blueprint — Policy Implementation Blueprint
 *
 * Presents this debate as a structured policy document: what would it
 * actually look like if this became law? Phases, mechanisms, stakeholders,
 * community consensus, and precedent laws all in one document view.
 *
 * Distinct from:
 *   /topic/[id]/mandate    — consensus strength and law threshold tracking
 *   /topic/[id]/forecast   — prediction-market probability of becoming law
 *   /topic/[id]/resolution — final outcome report (post-law)
 *   /topic/[id]/what-if    — scenario modelling of alternative outcomes
 *   /laws/[id]/blueprint   — blueprint for an ESTABLISHED law (post-passage)
 *
 * Blueprint answers: "If this debate succeeded, what would the policy
 * actually look like in practice?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Gavel,
  Globe,
  Layers,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wrench,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BlueprintResponse, BlueprintArgument, BlueprintPhase } from '@/app/api/topics/[id]/blueprint/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return '1 day ago'
  if (d < 30) return `${d} days ago`
  if (d < 365) return `${Math.floor(d / 30)} months ago`
  return `${Math.floor(d / 365)} years ago`
}

// ─── Phase card ───────────────────────────────────────────────────────────────

const PHASE_COLORS = [
  { bg: 'bg-for-500/10', border: 'border-for-500/25', num: 'bg-for-500/20 text-for-400', text: 'text-for-400' },
  { bg: 'bg-purple/10', border: 'border-purple/25', num: 'bg-purple/20 text-purple', text: 'text-purple' },
  { bg: 'bg-gold/10', border: 'border-gold/25', num: 'bg-gold/20 text-gold', text: 'text-gold' },
  { bg: 'bg-emerald/10', border: 'border-emerald/25', num: 'bg-emerald/20 text-emerald', text: 'text-emerald' },
]

function PhaseCard({ phase, index }: { phase: BlueprintPhase; index: number }) {
  const colors = PHASE_COLORS[index % PHASE_COLORS.length]

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn('rounded-xl border p-4', colors.bg, colors.border)}
    >
      <div className="flex items-start gap-3">
        {/* Phase number */}
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-bold',
          colors.num
        )}>
          {phase.phase}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4 className={cn('font-mono text-sm font-bold', colors.text)}>
              {phase.title}
            </h4>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3 w-3 text-surface-500" />
              <span className="text-[10px] font-mono text-surface-500">{phase.duration}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-surface-400 leading-relaxed mb-3">
            {phase.description}
          </p>

          {/* Key actions */}
          <div className="space-y-1.5">
            {phase.key_actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className={cn('h-3 w-3 mt-0.5 flex-shrink-0', colors.text)} />
                <span className="text-[11px] font-mono text-surface-400">{action}</span>
              </div>
            ))}
          </div>

          {/* Dependencies */}
          {phase.dependencies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-300/20">
              <p className="text-[10px] font-mono text-surface-600">
                Requires: {phase.dependencies.join(' · ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, index }: { arg: BlueprintArgument; index: number }) {
  const isFor = arg.side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-lg border p-3',
        isFor
          ? 'bg-for-500/5 border-for-500/15'
          : 'bg-against-500/5 border-against-500/15'
      )}
    >
      <div className="flex items-start gap-2">
        {arg.author_avatar_url ? (
          <Avatar
            src={arg.author_avatar_url}
            username={arg.author_username ?? '?'}
            size="sm"
            className="flex-shrink-0 mt-0.5"
          />
        ) : (
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold',
            isFor ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400'
          )}>
            {isFor ? 'F' : 'A'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-400 leading-relaxed line-clamp-3">{arg.content}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {arg.author_username && (
              <span className="text-[10px] font-mono text-surface-600">@{arg.author_username}</span>
            )}
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-2.5 w-2.5 text-surface-600" />
              <span className="text-[10px] font-mono text-surface-600">{arg.upvotes}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BlueprintSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BlueprintClient({
  topicId,
  topicStatement,
}: {
  topicId: string
  topicStatement: string
}) {
  const router = useRouter()
  const [data, setData] = useState<BlueprintResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topicId}/blueprint`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const forPct = data?.topic.blue_pct ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-surface-600">/</span>
          <Link
            href={`/topic/${topicId}`}
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors line-clamp-1"
          >
            {topicStatement.length > 50 ? topicStatement.slice(0, 50) + '…' : topicStatement}
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <FileText className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Policy Blueprint</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Implementation plan — if this debate became law
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading && <BlueprintSkeleton />}
        {error && (
          <EmptyState
            icon={FileText}
            title="Blueprint unavailable"
            description="Couldn't generate the policy blueprint for this topic."
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-6">

            {/* ── Policy header card ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
            >
              {/* Status bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-surface-200/30 border-b border-surface-300/50">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={data.topic.status === 'law' ? 'law' : data.topic.status === 'active' ? 'for' : 'neutral'}
                  >
                    {data.topic.status.charAt(0).toUpperCase() + data.topic.status.slice(1)}
                  </Badge>
                  {data.topic.category && (
                    <span className="text-[10px] font-mono text-surface-500">{data.topic.category}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-8 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-for-500"
                        style={{ width: `${forPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-for-400">{Math.round(forPct)}% FOR</span>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500">
                    {data.topic.total_votes.toLocaleString()} votes
                  </span>
                </div>
              </div>

              {/* Policy title */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gavel className="h-4 w-4 text-purple flex-shrink-0" />
                  <span className="text-[10px] font-mono text-purple uppercase tracking-widest">
                    Proposed Policy
                  </span>
                </div>
                <h2 className="font-mono text-base font-bold text-white leading-snug mb-4">
                  &ldquo;{data.policy.headline}&rdquo;
                </h2>

                <div className="space-y-3">
                  {/* Objective */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Core Objective</p>
                    <p className="text-sm text-surface-300 leading-relaxed">{data.policy.core_objective}</p>
                  </div>

                  {/* Scope & Mechanism row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex items-start gap-2">
                      <Globe className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-mono text-surface-500 mb-0.5">Scope</p>
                        <p className="text-xs text-surface-400">{data.policy.scope}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Wrench className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-mono text-surface-500 mb-0.5">Mechanism</p>
                        <p className="text-xs text-surface-400">{data.policy.mechanism}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Community verdict ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-surface-500" />
                <h3 className="font-mono text-sm font-semibold text-white">Community Verdict</h3>
                <Badge
                  variant={forPct >= 75 ? 'for' : forPct < 25 ? 'against' : 'neutral'}
                  className="ml-auto"
                >
                  {data.consensus.support_level}
                </Badge>
              </div>

              <p className="text-sm text-surface-400 leading-relaxed mb-4">
                {data.consensus.verdict}
              </p>

              {/* FOR / AGAINST bar */}
              <div className="flex gap-1 rounded-lg overflow-hidden h-2.5 mb-2">
                <div
                  className="bg-for-500 transition-all duration-700"
                  style={{ width: `${data.consensus.for_pct}%` }}
                />
                <div
                  className="bg-against-500 transition-all duration-700"
                  style={{ width: `${100 - data.consensus.for_pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-for-400">
                  {data.consensus.for_votes.toLocaleString()} FOR ({Math.round(data.consensus.for_pct)}%)
                </span>
                <span className="text-against-400">
                  {data.consensus.against_votes.toLocaleString()} AGAINST ({Math.round(100 - data.consensus.for_pct)}%)
                </span>
              </div>
            </motion.div>

            {/* ── Implementation phases ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-surface-500" />
                <h3 className="font-mono text-sm font-semibold text-white">Implementation Phases</h3>
              </div>
              <p className="text-[11px] font-mono text-surface-500 mb-4">
                A phased approach to translating this debate into actionable policy
              </p>

              <div className="space-y-3">
                {data.phases.map((phase, i) => (
                  <PhaseCard key={phase.phase} phase={phase} index={i} />
                ))}
              </div>
            </motion.div>

            {/* ── Key arguments section ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Scale className="h-4 w-4 text-surface-500" />
                <h3 className="font-mono text-sm font-semibold text-white">Community Evidence Base</h3>
              </div>

              {/* FOR arguments */}
              {data.for_arguments.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                    <p className="text-[11px] font-mono text-for-400 uppercase tracking-wide font-semibold">
                      Policy Rationale (Top FOR Arguments)
                    </p>
                  </div>
                  <div className="space-y-2">
                    {data.for_arguments.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* AGAINST arguments */}
              {data.against_arguments.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                    <p className="text-[11px] font-mono text-against-400 uppercase tracking-wide font-semibold">
                      Key Concerns (Top AGAINST Arguments)
                    </p>
                  </div>
                  <div className="space-y-2">
                    {data.against_arguments.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {data.for_arguments.length === 0 && data.against_arguments.length === 0 && (
                <p className="text-sm font-mono text-surface-600 text-center py-4">
                  No community arguments yet. Be the first to argue.
                </p>
              )}

              <Link
                href={`/topic/${topicId}/arguments`}
                className="flex items-center justify-center gap-2 mt-4 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View all arguments
                <ChevronRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* ── Precedent laws ── */}
            {data.precedent_laws.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-4 w-4 text-emerald" />
                  <h3 className="font-mono text-sm font-semibold text-white">
                    {data.topic.category ?? 'Related'} Precedents
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-surface-500 mb-3">
                  Established laws in this category that set precedent
                </p>

                <div className="space-y-2">
                  {data.precedent_laws.map((law) => (
                    <Link
                      key={law.id}
                      href={`/topic/${law.id}`}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-200/30 transition-colors group"
                    >
                      <Gavel className="h-3.5 w-3.5 text-emerald mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-surface-400 group-hover:text-white transition-colors line-clamp-2">
                          {law.statement}
                        </p>
                        {law.established_at && (
                          <p className="text-[10px] font-mono text-surface-600 mt-1">
                            Established {relativeTime(law.established_at)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Disclaimer footer ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="rounded-xl bg-surface-200/20 border border-surface-300/30 p-4"
            >
              <div className="flex items-start gap-2">
                <Shield className="h-3.5 w-3.5 text-surface-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
                  This blueprint is a community-derived implementation framework based on civic debate data and
                  category-specific policy patterns. It is not official legal or policy advice.
                  Implementation phases and mechanisms are illustrative and would require formal legislative process.
                  Proposed <span className="text-surface-500">{relativeTime(data.topic.created_at)}</span>.
                </p>
              </div>
            </motion.div>

            {/* ── Related analysis ── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Mandate Meter', href: `/topic/${topicId}/mandate`, desc: 'Consensus strength' },
                { label: 'What If', href: `/topic/${topicId}/what-if`, desc: 'Scenario modelling' },
                { label: 'Resolution', href: `/topic/${topicId}/resolution`, desc: 'Outcome framework' },
                { label: 'All Arguments', href: `/topic/${topicId}/arguments`, desc: 'Full debate thread' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/30 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-mono font-semibold text-white group-hover:text-purple transition-colors">
                      {link.label}
                    </p>
                    <p className="text-[11px] font-mono text-surface-500">{link.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-purple transition-colors" />
                </Link>
              ))}
            </div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
