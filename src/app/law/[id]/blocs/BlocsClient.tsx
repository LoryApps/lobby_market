'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Crown,
  ExternalLink,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Users2,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  BlocsResponse,
  RoleBloc,
  CloutBloc,
  CoalitionStance,
} from '@/app/api/laws/[id]/blocs/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function forBar(forPct: number, total: number) {
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] font-mono text-for-400 w-8 text-right">{forPct}%</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-300/50">
        <div className="flex h-full">
          <div className="bg-for-500 h-full transition-all" style={{ width: `${forPct}%` }} />
          <div className="bg-against-500 h-full transition-all" style={{ width: `${againstPct}%` }} />
        </div>
      </div>
      <span className="text-[10px] font-mono text-against-400 w-8">{againstPct}%</span>
      <span className="text-[10px] font-mono text-surface-500 w-16 text-right">
        {total.toLocaleString()} votes
      </span>
    </div>
  )
}

function sideLabel(forPct: number) {
  if (forPct >= 60) return { text: 'Leaned FOR', color: 'text-for-400' }
  if (forPct <= 40) return { text: 'Leaned AGAINST', color: 'text-against-400' }
  return { text: 'Split', color: 'text-surface-400' }
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { icon: typeof Award; color: string; bg: string; border: string }> = {
  lawmaker:      { icon: Crown,   color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  elder:         { icon: Shield,  color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  troll_catcher: { icon: Zap,     color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  debator:       { icon: Scale,   color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  person:        { icon: Users,   color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300' },
}

// ─── Clout config ─────────────────────────────────────────────────────────────

const CLOUT_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  elite:     { color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  prominent: { color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  veteran:   { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  engaged:   { color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  newcomer:  { color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300' },
}

// ─── Stance config ────────────────────────────────────────────────────────────

const STANCE_CONFIG = {
  for:     { label: 'FOR',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: ThumbsUp },
  against: { label: 'AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: ThumbsDown },
  neutral: { label: 'NEUTRAL', color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300',    icon: Scale },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBlocCard({ bloc }: { bloc: RoleBloc }) {
  const cfg = ROLE_CONFIG[bloc.role] ?? ROLE_CONFIG.person
  const Icon = cfg.icon
  const { text, color } = sideLabel(bloc.for_pct)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4',
        'bg-surface-100',
        cfg.border,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-1.5 rounded-lg', cfg.bg)}>
            <Icon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{bloc.label}</p>
            <p className={cn('text-[10px] font-mono', color)}>{text}</p>
          </div>
        </div>
        <span className="text-xs font-mono text-surface-500">
          {bloc.total.toLocaleString()} voters
        </span>
      </div>
      {forBar(bloc.for_pct, bloc.total)}
    </motion.div>
  )
}

function CloutBlocCard({ bloc }: { bloc: CloutBloc }) {
  const cfg = CLOUT_CONFIG[bloc.tier] ?? CLOUT_CONFIG.newcomer
  const { text, color } = sideLabel(bloc.for_pct)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border p-4 bg-surface-100', cfg.border)}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{bloc.label}</p>
          <p className={cn('text-[10px] font-mono', color)}>{text}</p>
        </div>
        <span className="text-xs font-mono text-surface-500">
          {bloc.total.toLocaleString()} voters
        </span>
      </div>
      {forBar(bloc.for_pct, bloc.total)}
    </motion.div>
  )
}

function CoalitionCard({ c }: { c: CoalitionStance }) {
  const cfg = STANCE_CONFIG[c.stance]
  const Icon = cfg.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 bg-surface-100',
        cfg.border,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/coalitions/${c.coalition_id}`}
            className="text-sm font-semibold text-white hover:text-for-300 transition-colors flex items-center gap-1.5 group"
          >
            {c.name}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          {c.tag && (
            <p className="text-[10px] font-mono text-surface-500">
              #{c.tag} · {c.member_count.toLocaleString()} members
            </p>
          )}
        </div>
        <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold', cfg.bg, cfg.border, cfg.color)}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </div>
      </div>
      {c.statement && (
        <p className="text-xs text-surface-400 italic border-l-2 border-surface-300 pl-3 mt-2">
          &ldquo;{c.statement}&rdquo;
        </p>
      )}
    </motion.div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function BlocsSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((s) => (
        <div key={s}>
          <Skeleton className="h-5 w-36 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BlocsClientProps {
  lawId: string
  statement: string
  category: string | null
}

export function BlocsClient({ lawId, statement, category: _category }: BlocsClientProps) {
  const [data, setData] = useState<BlocsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/blocs`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load voting blocs data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const forPct = data ? Math.round(data.blue_pct) : 50
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-950">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">

        {/* Back + header */}
        <div className="mb-6">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Law
          </Link>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-for-500/10 border border-for-500/30 mt-0.5">
              <Users2 className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Voting Blocs</h1>
              <p className="text-sm text-surface-400 mt-0.5 line-clamp-2">{statement}</p>
            </div>
          </div>
        </div>

        {/* Overall result banner */}
        {data && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 rounded-2xl border border-surface-300 bg-surface-100 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                  Final Mandate
                </p>
                <p className="text-2xl font-bold text-white mt-0.5">
                  <span className="text-for-400">{forPct}%</span>
                  {' '}FOR ·{' '}
                  <span className="text-against-400">{againstPct}%</span>
                  {' '}AGAINST
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-surface-500">Total Votes</p>
                <p className="text-lg font-bold text-white font-mono">
                  {(data.total_votes ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-surface-300/50">
              <div className="flex h-full">
                <div className="bg-for-500 h-full" style={{ width: `${forPct}%` }} />
                <div className="bg-against-500 h-full" style={{ width: `${againstPct}%` }} />
              </div>
            </div>
          </motion.div>
        )}

        {loading && <BlocsSkeleton />}

        {!loading && error && (
          <EmptyState
            title="Could not load blocs"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && data && (
          <div className="space-y-8">

            {/* By Role */}
            {data.by_role.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Award className="h-4 w-4 text-gold" />
                    By Civic Role
                  </h2>
                  <span className="text-xs text-surface-500 font-mono">
                    {data.by_role.length} roles
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.by_role.map((b) => (
                    <RoleBlocCard key={b.role} bloc={b} />
                  ))}
                </div>
                <p className="text-[11px] text-surface-500 mt-2 font-mono">
                  Roles reflect earned standing at time of analysis — not time of vote.
                </p>
              </section>
            )}

            {/* By Clout */}
            {data.by_clout.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Zap className="h-4 w-4 text-gold" />
                    By Clout Tier
                  </h2>
                  <span className="text-xs text-surface-500 font-mono">
                    {data.by_clout.length} tiers
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.by_clout.map((b) => (
                    <CloutBlocCard key={b.tier} bloc={b} />
                  ))}
                </div>
              </section>
            )}

            {/* Coalition alignment */}
            {data.coalitions.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-for-400" />
                    Coalition Alignment
                  </h2>
                  <span className="text-xs text-surface-500 font-mono">
                    {data.coalitions.length} coalitions
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {data.coalitions.map((c) => (
                    <CoalitionCard key={c.coalition_id} c={c} />
                  ))}
                </div>
              </section>
            )}

            {/* Arguer vs non-arguer split */}
            {data.arguer_split && data.arguer_split.arguers_total > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Scale className="h-4 w-4 text-purple" />
                    Debaters vs Silent Voters
                  </h2>
                </div>
                <div className="rounded-2xl border border-purple/30 bg-surface-100 p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-mono text-purple">Debaters ({data.arguer_split.arguers_total.toLocaleString()})</p>
                      <p className="text-xs font-mono text-surface-500">wrote arguments + voted</p>
                    </div>
                    {forBar(data.arguer_split.arguers_for_pct, data.arguer_split.arguers_total)}
                  </div>
                  <div className="border-t border-surface-300" />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-mono text-surface-400">Silent Voters</p>
                      <p className="text-xs font-mono text-surface-500">voted only</p>
                    </div>
                    {forBar(
                      data.arguer_split.non_arguers_for_pct,
                      (data.total_votes ?? 0) - data.arguer_split.arguers_total
                    )}
                  </div>
                  {Math.abs(data.arguer_split.arguers_for_pct - data.arguer_split.non_arguers_for_pct) >= 5 && (
                    <p className="text-xs text-surface-400 bg-surface-200 rounded-lg px-3 py-2 font-mono">
                      Debaters leaned{' '}
                      {data.arguer_split.arguers_for_pct > data.arguer_split.non_arguers_for_pct
                        ? 'more FOR'
                        : 'more AGAINST'}{' '}
                      than silent voters by{' '}
                      {Math.abs(data.arguer_split.arguers_for_pct - data.arguer_split.non_arguers_for_pct)}pts.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Empty state */}
            {data.by_role.length === 0 && data.by_clout.length === 0 && data.coalitions.length === 0 && (
              <EmptyState
                title="No bloc data available"
                description="Voting bloc analysis requires vote data linked to user profiles. This may be a recently established law."
              />
            )}

            {/* Links to related pages */}
            <div className="border-t border-surface-300 pt-6">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                Related Analysis
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: `/law/${lawId}/voters`, label: 'Founding Voters' },
                  { href: `/law/${lawId}/scorecard`, label: 'Scorecard' },
                  { href: `/law/${lawId}/connections`, label: 'Connections' },
                  { href: `/law/${lawId}/reasons`, label: 'Vote Reasons' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg',
                      'bg-surface-200 border border-surface-300',
                      'text-xs font-mono text-surface-400',
                      'hover:bg-surface-300 hover:text-white transition-colors'
                    )}
                  >
                    {label}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Refresh */}
        {!loading && data && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
