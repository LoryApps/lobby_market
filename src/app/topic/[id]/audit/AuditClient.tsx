'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Info,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  AuditResponse,
  AccountAgeband,
  DailyVote,
  IntegrityFlag,
} from '@/app/api/topics/[id]/audit/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'Law',
  failed:   'Failed',
}

function statusVariant(s: string): 'proposed' | 'active' | 'law' | 'failed' {
  if (s === 'law') return 'law'
  if (s === 'failed') return 'failed'
  if (s === 'active' || s === 'voting') return 'active'
  return 'proposed'
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald'
  if (score >= 70) return 'text-gold'
  if (score >= 50) return 'text-for-400'
  return 'text-against-400'
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald/10 border-emerald/30'
  if (score >= 70) return 'bg-gold/10 border-gold/30'
  if (score >= 50) return 'bg-for-500/10 border-for-500/30'
  return 'bg-against-500/10 border-against-500/30'
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Strong'
  if (score >= 70) return 'Good'
  if (score >= 55) return 'Moderate'
  if (score >= 40) return 'Concerning'
  return 'Poor'
}

function flagIcon(severity: IntegrityFlag['severity']) {
  if (severity === 'concern') return <ShieldAlert className="h-4 w-4 text-against-400 flex-shrink-0" />
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-gold flex-shrink-0" />
  return <Info className="h-4 w-4 text-for-400 flex-shrink-0" />
}

function flagBg(severity: IntegrityFlag['severity']): string {
  if (severity === 'concern') return 'bg-against-500/10 border-against-500/30'
  if (severity === 'warning') return 'bg-gold/10 border-gold/30'
  return 'bg-for-500/10 border-for-500/30'
}

// ─── Stacked bar for vote breakdown ──────────────────────────────────────────

function VoteSplitBar({ forPct, className }: { forPct: number; className?: string }) {
  const againstPct = 100 - forPct
  return (
    <div className={cn('flex h-2 w-full rounded-full overflow-hidden gap-px', className)}>
      <div
        style={{ width: `${forPct}%` }}
        className="bg-for-500 rounded-l-full"
      />
      <div
        style={{ width: `${againstPct}%` }}
        className="bg-against-500 rounded-r-full"
      />
    </div>
  )
}

// ─── Account age bar row ──────────────────────────────────────────────────────

function AgeBandRow({ band, max }: { band: AccountAgeband; max: number }) {
  const w = max > 0 ? (band.count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs font-mono text-surface-500 flex-shrink-0">{band.label}</span>
      <div className="flex-1 h-5 bg-surface-300/30 rounded overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${w}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full bg-surface-400/60 rounded"
        />
        {band.count > 0 && (
          <div
            className="absolute inset-y-0 rounded overflow-hidden"
            style={{ width: `${w}%` }}
          >
            <div
              className="h-full bg-for-500/40"
              style={{ width: `${band.for_pct}%` }}
            />
          </div>
        )}
      </div>
      <div className="w-20 flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs font-mono text-white">{band.count}</span>
        {band.count > 0 && (
          <span className="text-[10px] font-mono text-surface-500">
            ({band.for_pct}% FOR)
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Daily vote sparkline ─────────────────────────────────────────────────────

function DailySparkline({ days }: { days: DailyVote[] }) {
  if (days.length === 0) return null
  const maxCount = Math.max(...days.map((d) => d.total), 1)

  return (
    <div className="flex items-end gap-0.5 h-16">
      {days.map((day, i) => {
        const h = (day.total / maxCount) * 100
        const forH = day.total > 0 ? (day.for_count / day.total) * h : 0
        const againstH = h - forH
        return (
          <div
            key={i}
            className="flex-1 flex flex-col-reverse min-w-0 cursor-default group relative"
            style={{ height: '100%' }}
          >
            <div
              className="w-full bg-against-500/60 rounded-sm transition-opacity group-hover:opacity-80"
              style={{ height: `${againstH}%` }}
            />
            <div
              className="w-full bg-for-500/60 rounded-sm transition-opacity group-hover:opacity-80"
              style={{ height: `${forH}%` }}
            />
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-surface-100 border border-surface-300 rounded px-1.5 py-0.5 text-[10px] font-mono text-white whitespace-nowrap">
                {day.date.slice(5)}: {day.total}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-surface-500 text-[11px] font-mono uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className={cn('text-2xl font-mono font-bold', color ?? 'text-white')}>{value}</p>
      {sub && <p className="text-[11px] font-mono text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuditClientProps {
  topicId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuditClient({ topicId }: AuditClientProps) {
  const params = useParams()
  const id = topicId ?? (params?.id as string)

  const [data, setData] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/audit`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load audit data')
      const json = await res.json()
      setData(json as AuditResponse)
    } catch {
      setError('Could not load audit data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
            <Shield className="h-5 w-5 text-surface-400" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-xl text-white">Integrity Audit</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Voter transparency · account age analysis · argument quality
            </p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-5 text-center space-y-3">
            <ShieldAlert className="h-8 w-8 text-against-400 mx-auto" />
            <p className="text-sm font-mono text-against-300">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Data */}
        {!loading && data && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Topic pill + statement */}
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={statusVariant(data.status)} size="sm">
                    {STATUS_LABEL[data.status] ?? data.status}
                  </Badge>
                  {data.category && (
                    <span className="text-[11px] font-mono text-surface-500">{data.category}</span>
                  )}
                  <span className="text-[11px] font-mono text-surface-500">
                    {data.total_votes.toLocaleString()} votes
                  </span>
                </div>
                <p className="text-sm font-mono text-white leading-snug line-clamp-3">
                  {data.statement}
                </p>
                <VoteSplitBar forPct={data.blue_pct} />
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-for-400">{data.blue_pct}% FOR</span>
                  <span className="text-against-400">{100 - data.blue_pct}% AGAINST</span>
                </div>
              </div>

              {/* Integrity score */}
              <div className={cn('rounded-xl border p-5 flex items-center gap-4', scoreBg(data.integrity_score))}>
                <div className="flex flex-col items-center justify-center h-16 w-16 rounded-full border-2 flex-shrink-0"
                  style={{ borderColor: 'currentColor' }}
                >
                  <span className={cn('text-2xl font-mono font-bold leading-none', scoreColor(data.integrity_score))}>
                    {data.integrity_score}
                  </span>
                  <span className={cn('text-[10px] font-mono', scoreColor(data.integrity_score))}>/ 100</span>
                </div>
                <div>
                  <p className={cn('text-lg font-mono font-bold', scoreColor(data.integrity_score))}>
                    {scoreLabel(data.integrity_score)} Integrity
                  </p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Composite score based on voter demographics, temporal patterns, and argument quality.
                  </p>
                </div>
              </div>

              {/* Stat row */}
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Arguments"
                  value={data.argument_count}
                  sub={`${data.argument_with_source_count} cited`}
                />
                <StatTile
                  icon={<Scale className="h-3.5 w-3.5" />}
                  label="Citation rate"
                  value={`${data.citation_rate}%`}
                  sub="with sources"
                  color={data.citation_rate >= 50 ? 'text-emerald' : data.citation_rate >= 25 ? 'text-gold' : 'text-against-400'}
                />
                <StatTile
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Unique voters"
                  value={data.total_votes}
                  sub="distinct votes"
                />
              </div>

              {/* Integrity flags */}
              <section>
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                  Automated Flags
                </h2>
                <div className="space-y-2">
                  {data.flags.map((flag, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3',
                        flagBg(flag.severity),
                      )}
                    >
                      {flagIcon(flag.severity)}
                      <div>
                        <p className="text-xs font-mono text-white leading-snug">{flag.message}</p>
                        <p className="text-[10px] font-mono text-surface-500 mt-0.5 uppercase tracking-wide">{flag.code}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Account age breakdown */}
              <section>
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                  Voter Account Age
                </h2>
                <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                  <p className="text-[11px] font-mono text-surface-600 mb-4">
                    How old were voters&apos; accounts when they cast their vote? Blue = FOR, grey = AGAINST.
                  </p>
                  {(() => {
                    const maxCount = Math.max(...data.account_age_bands.map((b) => b.count), 1)
                    return data.account_age_bands.map((band, i) => (
                      <AgeBandRow key={i} band={band} max={maxCount} />
                    ))
                  })()}
                </div>
              </section>

              {/* Role breakdown */}
              {data.role_bands.length > 0 && (
                <section>
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                    Voter Role Breakdown
                  </h2>
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                    {data.role_bands.map((band, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-28 text-xs font-mono text-surface-400 flex-shrink-0">{band.label}</span>
                        <div className="flex-1 h-4 bg-surface-300/30 rounded overflow-hidden relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${band.pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                            className="h-full rounded"
                            style={{
                              background:
                                i === 0 ? 'rgba(96,165,250,0.4)' :
                                i === 1 ? 'rgba(167,139,250,0.4)' :
                                i === 2 ? 'rgba(52,211,153,0.4)' :
                                i === 3 ? 'rgba(251,191,36,0.4)' :
                                'rgba(113,113,122,0.4)',
                            }}
                          />
                        </div>
                        <div className="w-28 flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs font-mono text-white">{band.count}</span>
                          <span className="text-[10px] font-mono text-surface-500">
                            ({band.pct}% · {band.for_pct}% FOR)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Daily vote pattern */}
              {data.daily_votes.length > 1 && (
                <section>
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                    Vote Activity (last {data.daily_votes.length} days)
                  </h2>
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
                    <p className="text-[11px] font-mono text-surface-600 mb-4">
                      Blue bars = FOR votes, red bars = AGAINST. Hover for exact counts.
                    </p>
                    <DailySparkline days={data.daily_votes} />
                    <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-surface-600">
                      <span>{data.daily_votes[0]?.date}</span>
                      <span>{data.daily_votes[data.daily_votes.length - 1]?.date}</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Footer */}
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-surface-500">
                      This audit uses statistical signals to surface potential patterns. Flags are automated
                      and should be interpreted alongside the full debate context. Lobby Market moderators
                      review flagged topics separately.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/topic/${id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View topic
                      </Link>
                      <span className="text-surface-700">·</span>
                      <Link
                        href={`/topic/${id}/fact-check`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald hover:text-emerald/80 transition-colors"
                      >
                        <Shield className="h-3 w-3" />
                        Fact-check arguments
                      </Link>
                    </div>
                    <p className="text-[10px] font-mono text-surface-700 pt-1">
                      Generated at {new Date(data.generated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
