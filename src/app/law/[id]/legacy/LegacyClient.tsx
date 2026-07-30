'use client'

/**
 * /law/[id]/legacy — Law Legacy Report
 *
 * A retrospective view of an established law: how it has aged, the
 * community's hindsight verdict, formal challenges it has faced,
 * amendments proposed, related laws in the codex, and continuation
 * debates it inspired.
 *
 * Distinct from:
 *   /law/[id]/impact     — vote timeline and argument engagement from the original debate
 *   /law/[id]/verdict    — interactive verdict-casting interface
 *   /law/[id]/challenge  — filing/voting on formal legal challenges
 *   /law/[id]/momentum   — real-time activity tracker
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gavel,
  GitBranch,
  Landmark,
  Layers,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsDown,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawLegacyData, LegacyVerdict, LegacyChallenge } from '@/app/api/laws/[id]/legacy/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatYear(iso: string) {
  return new Date(iso).getFullYear()
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function ageString(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days < 30) return `${days}d old`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo old`
  const years = Math.floor(days / 365)
  const rem = Math.floor((days % 365) / 30)
  return rem > 0 ? `${years}y ${rem}mo old` : `${years}y old`
}

// ─── Verdict config ───────────────────────────────────────────────────────────

const VERDICT_CFG: Record<
  string,
  { label: string; icon: typeof Trophy; color: string; bg: string; border: string; bar: string }
> = {
  succeeded: {
    label: 'Succeeded',
    icon: Trophy,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
  },
  mostly_succeeded: {
    label: 'Mostly Succeeded',
    icon: CheckCircle2,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
  },
  mixed: {
    label: 'Mixed',
    icon: Scale,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
  },
  mostly_failed: {
    label: 'Mostly Failed',
    icon: ThumbsDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-400',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-against-500',
    bg: 'bg-against-600/15',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
  },
}

// ─── Challenge grounds config ─────────────────────────────────────────────────

const GROUNDS_CFG: Record<string, { label: string; color: string }> = {
  constitutional: { label: 'Constitutional', color: 'text-gold' },
  procedural: { label: 'Procedural', color: 'text-purple' },
  factual: { label: 'Factual', color: 'text-for-400' },
  ethical: { label: 'Ethical', color: 'text-emerald' },
  practical: { label: 'Practical', color: 'text-surface-400' },
}

const CHALLENGE_STATUS_CFG = {
  open: { label: 'Open', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  upheld: { label: 'Upheld', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  dismissed: { label: 'Dismissed', color: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-400/20' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LegacySkeleton() {
  return (
    <div className="space-y-4 px-4 py-6 animate-pulse">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="grid grid-cols-2 gap-3 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl mt-4" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Gavel
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-surface-200/50 border border-surface-300/30 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5', color)}>
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color }: { icon: typeof Gavel; title: string; color: string }) {
  return (
    <div className={cn('flex items-center gap-2 mb-3', color)}>
      <Icon className="w-4 h-4" aria-hidden="true" />
      <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
    </div>
  )
}

// ─── Verdict bar ─────────────────────────────────────────────────────────────

function VerdictBar({ verdicts, total }: { verdicts: LegacyVerdict[]; total: number }) {
  if (total === 0) return null
  return (
    <div className="flex h-2 rounded-full overflow-hidden" aria-label="Community verdict distribution">
      {verdicts.map((v) => {
        const cfg = VERDICT_CFG[v.verdict]
        const pct = Math.round((v.count / total) * 100)
        return (
          <div
            key={v.verdict}
            className={cn('h-full transition-all', cfg?.bar ?? 'bg-surface-400')}
            style={{ width: `${pct}%` }}
            title={`${cfg?.label ?? v.verdict}: ${pct}%`}
          />
        )
      })}
    </div>
  )
}

// ─── Challenge row ────────────────────────────────────────────────────────────

function ChallengeRow({ c, lawId }: { c: LegacyChallenge; lawId: string }) {
  const statusCfg = CHALLENGE_STATUS_CFG[c.status] ?? CHALLENGE_STATUS_CFG.open
  const groundsCfg = GROUNDS_CFG[c.grounds] ?? { label: c.grounds, color: 'text-surface-400' }
  const net = c.support_count - c.oppose_count

  return (
    <Link
      href={`/law/${lawId}/challenge`}
      className="block bg-surface-200/40 border border-surface-300/25 rounded-xl p-4 hover:border-surface-300/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{c.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-[11px] font-medium', groundsCfg.color)}>{groundsCfg.label}</span>
            <span className="text-surface-600">·</span>
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                statusCfg.color, statusCfg.bg, statusCfg.border
              )}
            >
              {statusCfg.label}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className={cn('text-xs font-mono font-semibold', net >= 0 ? 'text-for-400' : 'text-against-400')}>
            {net >= 0 ? '+' : ''}{net}
          </span>
          <span className="text-[10px] text-surface-500">{c.support_count}↑ {c.oppose_count}↓</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
}

export function LegacyClient({ lawId }: Props) {
  const [data, setData] = useState<LawLegacyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/legacy`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load legacy data')
      const json: LawLegacyData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const forPct = Math.round(data?.law.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* ── Back nav ── */}
        <div className="px-4 pt-4 pb-2">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-surface-500 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to Law
          </Link>
        </div>

        {loading && <LegacySkeleton />}

        {error && (
          <div className="px-4 py-8 text-center">
            <p className="text-against-400 text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="px-4 space-y-6 pb-4"
          >
            {/* ── Hero ── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-emerald shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-medium text-emerald uppercase tracking-wider">
                  Law Legacy · {formatYear(data.law.established_at)}
                </span>
              </div>
              <h1 className="text-lg font-bold text-white leading-snug">
                {data.law.statement}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
                {data.law.category && (
                  <span className="text-gold font-medium">{data.law.category}</span>
                )}
                <span>{formatDate(data.law.established_at)}</span>
                <span className="text-surface-600">·</span>
                <span>{ageString(data.law.established_at)}</span>
              </div>

              {/* Vote margin bar */}
              <div className="mt-3 space-y-1.5">
                <div className="flex h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
                  <div className="h-full bg-against-500" style={{ width: `${againstPct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-for-400">{forPct}% FOR</span>
                  <span className="text-against-400">{againstPct}% AGAINST</span>
                </div>
              </div>
            </div>

            {/* ── Key stats ── */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={Users}
                label="Voters"
                value={formatNumber(data.law.total_votes)}
                sub={`Top ${100 - data.law_rank.percentile}% of laws`}
                color="text-for-400"
              />
              <StatTile
                icon={Clock}
                label="Debate Ran"
                value={`${data.debate_days}d`}
                sub={data.topic ? `Proposed ${formatDate(data.topic.created_at).split(',')[0]}` : undefined}
                color="text-purple"
              />
              <StatTile
                icon={Scale}
                label="Challenges"
                value={String(data.challenge_counts.total)}
                sub={
                  data.challenge_counts.total === 0
                    ? 'No formal challenges'
                    : `${data.challenge_counts.open} open · ${data.challenge_counts.upheld} upheld`
                }
                color={data.challenge_counts.upheld > 0 ? 'text-against-400' : 'text-gold'}
              />
              <StatTile
                icon={Layers}
                label="Amendments"
                value={String(data.amendment_count)}
                sub={data.revision_count > 0 ? `${data.revision_count} wiki revision${data.revision_count !== 1 ? 's' : ''}` : 'No amendments yet'}
                color="text-emerald"
              />
            </div>

            {/* ── Community verdict ── */}
            <div className="bg-surface-200/50 border border-surface-300/30 rounded-2xl p-4 space-y-4">
              <SectionHeader icon={Award} title="Community Verdict" color="text-gold" />

              {data.verdict_total === 0 ? (
                <EmptyState
                  icon={Award}
                  title="No verdicts yet"
                  description="Be the first to cast a retrospective verdict on this law."
                  action={{ label: 'Cast Verdict', href: `/law/${lawId}/verdict` }}
                />
              ) : (
                <>
                  {data.dominant_verdict && VERDICT_CFG[data.dominant_verdict] && (
                    <div className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl border',
                      VERDICT_CFG[data.dominant_verdict].bg,
                      VERDICT_CFG[data.dominant_verdict].border,
                    )}>
                      {(() => {
                        const cfg = VERDICT_CFG[data.dominant_verdict]
                        const Icon = cfg.icon
                        return (
                          <>
                            <Icon className={cn('w-5 h-5 shrink-0', cfg.color)} aria-hidden="true" />
                            <div>
                              <p className={cn('text-sm font-bold', cfg.color)}>{cfg.label}</p>
                              <p className="text-xs text-surface-500">
                                Community consensus — {data.verdict_total} retrospective vote{data.verdict_total !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  )}

                  <VerdictBar verdicts={data.verdicts} total={data.verdict_total} />

                  <div className="space-y-2">
                    {data.verdicts.map((v) => {
                      const cfg = VERDICT_CFG[v.verdict]
                      const pct = Math.round((v.count / data.verdict_total) * 100)
                      return (
                        <div key={v.verdict} className="flex items-center gap-3">
                          <span className={cn('text-xs font-medium w-32 shrink-0', cfg?.color ?? 'text-surface-400')}>
                            {cfg?.label ?? v.verdict}
                          </span>
                          <div className="flex-1 h-1.5 bg-surface-300/40 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', cfg?.bar ?? 'bg-surface-400')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-surface-500 w-12 text-right tabular-nums">
                            {pct}% <span className="text-surface-600">({v.count})</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <Link
                    href={`/law/${lawId}/verdict`}
                    className="block text-center text-xs text-surface-500 hover:text-white transition-colors mt-1"
                  >
                    Cast your verdict →
                  </Link>
                </>
              )}
            </div>

            {/* ── Formal challenges ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionHeader icon={Shield} title="Formal Challenges" color="text-against-400" />
                {data.challenge_counts.total > 0 && (
                  <Link
                    href={`/law/${lawId}/challenge`}
                    className="text-xs text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                )}
              </div>

              {data.challenges.length === 0 ? (
                <div className="bg-surface-200/30 border border-surface-300/20 rounded-xl px-4 py-5 text-center">
                  <Shield className="w-7 h-7 text-surface-500 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm font-medium text-white">No challenges filed</p>
                  <p className="text-xs text-surface-500 mt-1">This law has not faced any formal challenges.</p>
                  <Link
                    href={`/law/${lawId}/challenge`}
                    className="mt-3 inline-block text-xs text-against-400 hover:text-against-300 transition-colors"
                  >
                    File a challenge →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.challenges.map((c) => (
                    <ChallengeRow key={c.id} c={c} lawId={lawId} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Continuation debates ── */}
            {data.continuations.length > 0 && (
              <div className="space-y-3">
                <SectionHeader icon={GitBranch} title="Debates It Inspired" color="text-purple" />
                <div className="space-y-2">
                  {data.continuations.map((c) => {
                    const forPct = Math.round(c.blue_pct)
                    return (
                      <Link
                        key={c.id}
                        href={`/topic/${c.id}`}
                        className="block bg-surface-200/40 border border-surface-300/25 rounded-xl p-4 hover:border-purple/30 transition-colors"
                      >
                        <p className="text-sm font-medium text-white leading-snug line-clamp-2">{c.statement}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex h-1 flex-1 rounded-full overflow-hidden bg-surface-300/40">
                            <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
                          </div>
                          <span className="text-[11px] text-surface-500 tabular-nums shrink-0">
                            {formatNumber(c.total_votes)} votes
                          </span>
                          <Badge
                            variant={c.status === 'law' ? 'law' : c.status === 'active' ? 'active' : 'proposed'}
                            className="text-[10px] px-1.5 py-0.5 shrink-0"
                          >
                            {c.status}
                          </Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Related laws ── */}
            {data.related_laws.length > 0 && (
              <div className="space-y-3">
                <SectionHeader icon={Landmark} title="Related Laws" color="text-emerald" />
                <div className="space-y-2">
                  {data.related_laws.map((l) => {
                    const lForPct = Math.round(l.blue_pct)
                    return (
                      <Link
                        key={l.id}
                        href={`/law/${l.id}`}
                        className="flex items-start gap-3 bg-surface-200/40 border border-surface-300/25 rounded-xl p-4 hover:border-emerald/25 transition-colors"
                      >
                        <Gavel className="w-4 h-4 text-emerald shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{l.statement}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex h-1 w-16 rounded-full overflow-hidden bg-surface-300/40 shrink-0">
                              <div className="h-full bg-for-500" style={{ width: `${lForPct}%` }} />
                            </div>
                            <span className="text-[11px] text-surface-500 tabular-nums">
                              {lForPct}% · {formatNumber(l.total_votes)} votes
                            </span>
                            {l.category && (
                              <span className="text-[10px] text-gold hidden sm:inline">{l.category}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-600 shrink-0 mt-0.5" aria-hidden="true" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Original topic link ── */}
            {data.topic && (
              <div className="bg-surface-200/30 border border-surface-300/20 rounded-2xl p-4 space-y-3">
                <SectionHeader icon={BookOpen} title="Original Debate" color="text-for-400" />
                <Link
                  href={`/topic/${data.topic.id}`}
                  className="flex items-start gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                      {data.topic.statement}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-surface-500">
                      {data.topic.view_count != null && (
                        <span>{formatNumber(data.topic.view_count)} views</span>
                      )}
                      {data.topic.total_arguments != null && data.topic.total_arguments > 0 && (
                        <span>{formatNumber(data.topic.total_arguments)} arguments</span>
                      )}
                      {data.debate_days > 0 && (
                        <span>Debated for {data.debate_days} day{data.debate_days !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" aria-hidden="true" />
                </Link>
              </div>
            )}

            {/* ── Law participation rank ── */}
            <div className="bg-surface-200/30 border border-surface-300/20 rounded-2xl p-4 space-y-3">
              <SectionHeader icon={BarChart2} title="Participation Standing" color="text-gold" />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-400">Rank among all laws</span>
                  <span className="font-semibold text-white tabular-nums">
                    #{data.law_rank.rank_position} of {formatNumber(data.law_rank.total_laws)}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-300/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${data.law_rank.percentile}%` }}
                  />
                </div>
                <p className="text-xs text-surface-500">
                  More votes than{' '}
                  <span className="text-gold font-semibold">{data.law_rank.percentile}%</span>{' '}
                  of all established laws.
                </p>
              </div>
            </div>

            {/* ── CTA row ── */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              <Link
                href={`/law/${lawId}/verdict`}
                className="flex items-center justify-center gap-2 bg-emerald/10 border border-emerald/30 text-emerald rounded-xl px-4 py-3 text-sm font-medium hover:bg-emerald/15 transition-colors"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Cast Verdict
              </Link>
              <Link
                href={`/law/${lawId}/challenge`}
                className="flex items-center justify-center gap-2 bg-against-500/10 border border-against-500/30 text-against-400 rounded-xl px-4 py-3 text-sm font-medium hover:bg-against-500/15 transition-colors"
              >
                <Shield className="w-4 h-4" aria-hidden="true" />
                Challenge
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
