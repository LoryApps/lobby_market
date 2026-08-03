'use client'

/**
 * /law/[id]/influence — Civic Citation Network
 *
 * Shows how much a law has shaped subsequent discourse:
 *   INCOMING — other laws that wiki-link TO this law (direct citations)
 *   OUTGOING — laws this law cites in its wiki
 *   DOWNSTREAM — topics in the same category proposed AFTER this law passed
 *   SUCCESSORS — sister laws established after this one
 *
 * Distinct from:
 *   /law/[id]/connections — coalition + sister debate ecosystem
 *   /law/[id]/legacy      — historical retrospective + verdict
 *   /law/[id]/impact      — vote timeline from the original debate
 *   /law/[id]/graph       — visual knowledge graph
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronRight,
  Flame,
  Gavel,
  GitMerge,
  Globe,
  Link2,
  Network,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawInfluenceData, InfluenceLaw, InfluenceTopic } from '@/app/api/laws/[id]/influence/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function VoteBar({ bluePct }: { bluePct: number }) {
  const pct = Math.round(bluePct)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-for-400 w-6 text-right tabular-nums">{pct}%</span>
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-6 tabular-nums">{100 - pct}%</span>
    </div>
  )
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<LawInfluenceData['tier'], {
  color: string; bg: string; border: string; icon: typeof Zap
}> = {
  Foundational: { color: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         icon: Sparkles },
  'High Impact': { color: 'text-purple',     bg: 'bg-purple/10',       border: 'border-purple/30',       icon: Zap },
  Notable:       { color: 'text-for-400',    bg: 'bg-for-500/10',      border: 'border-for-500/30',      icon: TrendingUp },
  Emerging:      { color: 'text-emerald',    bg: 'bg-emerald/10',      border: 'border-emerald/25',      icon: Flame },
  Local:         { color: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30',  icon: Globe },
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law, label }: { law: InfluenceLaw; label?: string }) {
  return (
    <Link
      href={`/law/${law.id}`}
      className="flex items-start gap-3 py-3 border-t border-surface-300 first:border-0 hover:bg-surface-200/40 -mx-2 px-2 rounded-lg transition-colors group"
    >
      <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Gavel className="h-3.5 w-3.5 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {law.category && (
            <span className="text-[10px] font-mono text-surface-400">{law.category}</span>
          )}
          <span className="text-[10px] font-mono text-surface-500">·</span>
          <span className="text-[10px] font-mono text-surface-400">{formatNumber(law.total_votes)} votes</span>
          <span className="text-[10px] font-mono text-surface-500">·</span>
          <span className="text-[10px] font-mono text-surface-400">{formatDate(law.established_at)}</span>
        </div>
        <div className="mt-1.5">
          <VoteBar bluePct={law.blue_pct ?? 50} />
        </div>
      </div>
      {label && (
        <Badge variant="outline" className="text-[10px] flex-shrink-0">{label}</Badge>
      )}
      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-400', bg: 'bg-surface-300/30' },
  active:   { label: 'Active',   color: 'text-for-400',     bg: 'bg-for-500/10' },
  voting:   { label: 'Voting',   color: 'text-purple',      bg: 'bg-purple/10' },
  law:      { label: 'Law',      color: 'text-gold',        bg: 'bg-gold/10' },
  failed:   { label: 'Failed',   color: 'text-against-400', bg: 'bg-against-500/10' },
}

function TopicCard({ topic }: { topic: InfluenceTopic }) {
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 py-3 border-t border-surface-300 first:border-0 hover:bg-surface-200/40 -mx-2 px-2 rounded-lg transition-colors group"
    >
      <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Scale className="h-3.5 w-3.5 text-for-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full', cfg.color, cfg.bg)}>
            {cfg.label}
          </span>
          <span className="text-[10px] font-mono text-surface-400">{formatNumber(topic.total_votes)} votes</span>
          <span className="text-[10px] font-mono text-surface-500">·</span>
          <span className="text-[10px] font-mono text-surface-400">{formatDate(topic.created_at)}</span>
        </div>
        {topic.status !== 'proposed' && (
          <div className="mt-1.5">
            <VoteBar bluePct={topic.blue_pct ?? 50} />
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InfluenceClient({ lawId }: { lawId: string }) {
  const [data, setData] = useState<LawInfluenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/influence`)
      if (!res.ok) throw new Error('Failed to load influence data')
      const json: LawInfluenceData = await res.json()
      setData(json)
    } catch {
      setError('Could not load influence data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex gap-3 items-center pt-3 border-t border-surface-300 first:border-0">
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <Link href={`/law/${lawId}`} className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-mono">Back to law</span>
          </Link>
          <EmptyState
            icon={Network}
            title="Influence data unavailable"
            description={error ?? 'No influence data found for this law.'}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { law, incoming, outgoing, downstream, successorLaws, influenceScore, tier, stats } = data
  const tierCfg = TIER_CONFIG[tier]
  const TierIcon = tierCfg.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* ── Back ── */}
        <div className="flex items-center justify-between">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-mono">Back to law</span>
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-400 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Law header ── */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-widest font-mono text-gold flex items-center gap-1">
              <Gavel className="h-3 w-3" />
              Established Law
            </span>
            {law.category && (
              <Badge variant="outline" className="text-[10px]">{law.category}</Badge>
            )}
          </div>
          <h1 className="text-lg font-mono text-white leading-snug mb-3">
            {law.statement}
          </h1>
          <div className="flex items-center gap-3 text-[11px] font-mono text-surface-400">
            <span>{formatNumber(law.total_votes)} votes</span>
            <span>·</span>
            <span>{Math.round(law.blue_pct ?? 50)}% FOR</span>
            <span>·</span>
            <span>Passed {formatDate(law.established_at)}</span>
          </div>
        </div>

        {/* ── Influence score ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-3xl border p-6',
            tierCfg.bg,
            tierCfg.border,
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <TierIcon className={cn('h-4 w-4', tierCfg.color)} />
            <h2 className={cn('text-xs uppercase tracking-widest font-mono', tierCfg.color)}>
              Civic Influence Score
            </h2>
          </div>

          <div className="flex items-end gap-5">
            {/* Score number */}
            <div className={cn(
              'rounded-2xl border px-5 py-4 flex-shrink-0 text-center min-w-[90px]',
              tierCfg.bg,
              tierCfg.border,
            )}>
              <p className={cn('text-4xl font-mono font-bold tabular-nums', tierCfg.color)}>
                {influenceScore}
              </p>
              <p className="text-[10px] font-mono text-surface-400 mt-0.5">/ 100</p>
            </div>

            {/* Score bar + tier */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-sm font-mono font-semibold', tierCfg.color)}>
                  {tier}
                </span>
                <span className="text-[10px] font-mono text-surface-400">
                  {stats.daysSincePassage}d since passage
                </span>
              </div>
              <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${influenceScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn(
                    'h-full rounded-full',
                    influenceScore >= 75 ? 'bg-gold' :
                    influenceScore >= 50 ? 'bg-purple' :
                    influenceScore >= 30 ? 'bg-for-500' :
                    influenceScore >= 10 ? 'bg-emerald' :
                    'bg-surface-400',
                  )}
                />
              </div>
              <p className="text-[10px] font-mono text-surface-400 mt-2 leading-relaxed">
                Scored on citations from other laws, downstream debates inspired, and vote scale.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Citing laws', value: stats.incomingCount, icon: Link2, color: 'text-gold' },
            { label: 'Cited laws', value: stats.outgoingCount, icon: BookOpen, color: 'text-emerald' },
            { label: 'Downstream debates', value: stats.downstreamTopics, icon: GitMerge, color: 'text-for-400' },
            { label: 'Successor laws', value: stats.successorLaws, icon: Gavel, color: 'text-purple' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center"
            >
              <div className={cn('flex items-center justify-center mb-1', color)}>
                <Icon className="h-4 w-4" />
              </div>
              <p className={cn('text-2xl font-mono font-bold tabular-nums', color)}>{value}</p>
              <p className="text-[10px] font-mono text-surface-400 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Incoming citations ── */}
        <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="h-4 w-4 text-gold" />
            <h2 className="text-xs uppercase tracking-widest font-mono text-surface-400">
              Laws Citing This Law
            </h2>
            <span className="ml-auto text-[10px] font-mono text-surface-500">
              {incoming.length} {incoming.length === 1 ? 'citation' : 'citations'}
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-500 mb-4">
            Other established laws that directly reference this law in their wiki.
          </p>

          {incoming.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No citations yet"
              description="No other laws have linked to this one yet. Citations appear when other laws reference it in their wiki text."
              size="sm"
            />
          ) : (
            <div>
              {incoming.map((law) => (
                <LawCard key={law.id} law={law} />
              ))}
            </div>
          )}
        </section>

        {/* ── Outgoing citations ── */}
        {outgoing.length > 0 && (
          <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-emerald" />
              <h2 className="text-xs uppercase tracking-widest font-mono text-surface-400">
                Laws This Law Cites
              </h2>
              <span className="ml-auto text-[10px] font-mono text-surface-500">
                {outgoing.length}
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 mb-4">
              Established laws referenced in this law&apos;s wiki — its intellectual foundations.
            </p>
            <div>
              {outgoing.map((law) => (
                <LawCard key={law.id} law={law} />
              ))}
            </div>
          </section>
        )}

        {/* ── Downstream topics ── */}
        <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-center gap-2 mb-1">
            <GitMerge className="h-4 w-4 text-for-400" />
            <h2 className="text-xs uppercase tracking-widest font-mono text-surface-400">
              Downstream Debates
            </h2>
            <span className="ml-auto text-[10px] font-mono text-surface-500">
              {downstream.length} topics
            </span>
          </div>
          <p className="text-[11px] font-mono text-surface-500 mb-4">
            Topics in {law.category ?? 'the same category'} proposed after this law passed — possible follow-on debates it inspired.
          </p>

          {downstream.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No downstream debates yet"
              description="No follow-on debates have appeared in this category since the law was established."
              size="sm"
            />
          ) : (
            <div>
              {downstream.slice(0, 10).map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
              {downstream.length > 10 && (
                <p className="text-[11px] font-mono text-surface-500 text-center pt-4">
                  +{downstream.length - 10} more downstream topics in this category
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Successor laws ── */}
        {successorLaws.length > 0 && (
          <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="h-4 w-4 text-purple" />
              <h2 className="text-xs uppercase tracking-widest font-mono text-surface-400">
                Successor Laws
              </h2>
              <span className="ml-auto text-[10px] font-mono text-surface-500">
                {successorLaws.length}
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 mb-4">
              Laws established in {law.category ?? 'this category'} after this one — the legal generation that followed.
            </p>
            <div>
              {successorLaws.map((l, i) => (
                <LawCard key={l.id} law={l} label={i === 0 ? 'First successor' : undefined} />
              ))}
            </div>
          </section>
        )}

        {/* ── Explore more ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/law/${lawId}/connections`}
            className="rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-for-500/5 transition-colors p-4 flex items-center gap-3 group"
          >
            <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/25 flex items-center justify-center flex-shrink-0">
              <Network className="h-4 w-4 text-for-400" />
            </div>
            <div>
              <p className="text-xs font-mono text-white group-hover:text-for-300 transition-colors">Connections</p>
              <p className="text-[10px] font-mono text-surface-400">Ecosystem view</p>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-500 ml-auto" />
          </Link>
          <Link
            href={`/law/${lawId}/graph`}
            className="rounded-xl bg-surface-100 border border-surface-300 hover:border-emerald/40 hover:bg-emerald/5 transition-colors p-4 flex items-center gap-3 group"
          >
            <div className="h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/25 flex items-center justify-center flex-shrink-0">
              <BarChart2 className="h-4 w-4 text-emerald" />
            </div>
            <div>
              <p className="text-xs font-mono text-white group-hover:text-emerald transition-colors">Knowledge Graph</p>
              <p className="text-[10px] font-mono text-surface-400">Visual network</p>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-500 ml-auto" />
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
