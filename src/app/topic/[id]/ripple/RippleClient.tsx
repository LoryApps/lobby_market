'use client'

/**
 * /topic/[id]/ripple — Ripple Effect Analyzer
 *
 * Shows how this topic's outcome cascades through the civic ecosystem:
 *   IF PASSES → which laws it reinforces / contradicts, which active
 *               topics it enables or undermines
 *   IF FAILS  → which active topics get blocked, which laws get preserved
 *
 * Distinct from:
 *   /topic/[id]/connections — surfaces wikilinks & coalition stances
 *   /topic/[id]/correlations — statistical voting co-occurrence
 *   /topic/[id]/impact       — direct argument-level impact scores
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Waves,
  XCircle,
  Zap,
  GitMerge,
  Flame,
  BarChart2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { RippleResponse, RippleLaw, RippleTopic, RippleRelation } from '@/app/api/topics/[id]/ripple/route'

// ─── Config ────────────────────────────────────────────────────────────────────

const RELATION_CONFIG: Record<RippleRelation, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  reinforces:  { label: 'Reinforces',  color: 'text-emerald',     bg: 'bg-emerald/10',       icon: CheckCircle2 },
  contradicts: { label: 'Contradicts', color: 'text-against-400', bg: 'bg-against-500/10',   icon: XCircle },
  extends:     { label: 'Extends',     color: 'text-for-400',     bg: 'bg-for-500/10',       icon: GitMerge },
  requires:    { label: 'Requires',    color: 'text-gold',         bg: 'bg-gold/10',          icon: Zap },
  competes:    { label: 'Competes',    color: 'text-purple',      bg: 'bg-purple/10',        icon: Flame },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-400' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-gold' },
  law:      { label: 'Law',      color: 'text-emerald' },
  failed:   { label: 'Failed',   color: 'text-against-400' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function VoteBar({ pct, size = 'sm' }: { pct: number; size?: 'sm' | 'xs' }) {
  const forPct = Math.max(0, Math.min(100, pct))
  const h = size === 'xs' ? 'h-1' : 'h-1.5'
  return (
    <div className={cn('w-full rounded-full bg-surface-300 overflow-hidden', h)}>
      <div
        className="h-full bg-for-500 rounded-full transition-all duration-500"
        style={{ width: `${forPct}%` }}
      />
    </div>
  )
}

function RelationBadge({ relation }: { relation: RippleRelation }) {
  const cfg = RELATION_CONFIG[relation] ?? RELATION_CONFIG.competes
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wide', cfg.bg, cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Law Card ─────────────────────────────────────────────────────────────────

function LawCard({ law, idx }: { law: RippleLaw; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <Link
          href={`/topic/${law.id}`}
          className="text-sm text-white hover:text-for-300 transition-colors leading-snug line-clamp-2 flex-1"
        >
          {law.statement}
        </Link>
        <Link
          href={`/topic/${law.id}`}
          className="shrink-0 mt-0.5 text-surface-500 hover:text-for-400 transition-colors"
          aria-label="Open topic"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <RelationBadge relation={law.relation} />
        {law.category && (
          <span className="text-[10px] font-mono text-surface-500">{law.category}</span>
        )}
        <span className="ml-auto text-[10px] font-mono text-emerald flex items-center gap-1">
          <Gavel className="h-3 w-3" />
          Law
        </span>
      </div>

      <VoteBar pct={forPct} size="xs" />
      <div className="flex justify-between mt-1 text-[10px] font-mono text-surface-500 tabular-nums">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-against-400">{100 - forPct}% AGAINST</span>
      </div>

      {/* Reason toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Hide reason' : 'Why linked?'}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-1.5 text-[11px] text-surface-400 leading-relaxed overflow-hidden"
          >
            {law.relation_reason}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, idx }: { topic: RippleTopic; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const forPct = Math.round(topic.blue_pct ?? 50)
  const statusCfg = STATUS_LABEL[topic.status] ?? STATUS_LABEL.proposed

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <Link
          href={`/topic/${topic.id}`}
          className="text-sm text-white hover:text-for-300 transition-colors leading-snug line-clamp-2 flex-1"
        >
          {topic.statement}
        </Link>
        <Link
          href={`/topic/${topic.id}`}
          className="shrink-0 mt-0.5 text-surface-500 hover:text-for-400 transition-colors"
          aria-label="Open topic"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <RelationBadge relation={topic.relation} />
        {topic.category && (
          <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
        )}
        <span className={cn('ml-auto text-[10px] font-mono', statusCfg.color)}>
          {statusCfg.label}
        </span>
      </div>

      <VoteBar pct={forPct} size="xs" />
      <div className="flex justify-between mt-1 text-[10px] font-mono text-surface-500 tabular-nums">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Hide reason' : 'Why linked?'}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-1.5 text-[11px] text-surface-400 leading-relaxed overflow-hidden"
          >
            {topic.relation_reason}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  count,
  accentColor,
  icon: Icon,
  children,
  empty,
}: {
  title: string
  subtitle: string
  count: number
  accentColor: string
  icon: typeof CheckCircle2
  children: React.ReactNode
  empty: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4', accentColor)} />
        <div>
          <h3 className={cn('text-sm font-semibold', accentColor)}>{title}</h3>
          <p className="text-[11px] font-mono text-surface-500">{subtitle}</p>
        </div>
        <span className={cn('ml-auto px-2 py-0.5 rounded-full text-xs font-mono font-semibold', accentColor, 'bg-current/10')}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-surface-500 font-mono py-4 text-center border border-surface-300 rounded-xl bg-surface-100">
          {empty}
        </p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RippleSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-6 w-full mb-2" />
        <Skeleton className="h-6 w-3/4 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-200 p-3">
              <Skeleton className="h-3 w-12 mb-2" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-3/4 mb-3" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Impact score bar ─────────────────────────────────────────────────────────

function ImpactGauge({ score }: { score: number }) {
  const level = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'
  const color = score >= 70 ? 'bg-against-500' : score >= 40 ? 'bg-gold' : 'bg-emerald'
  const textColor = score >= 70 ? 'text-against-400' : score >= 40 ? 'text-gold' : 'text-emerald'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-surface-500">Ecosystem Impact</span>
        <span className={cn('font-semibold', textColor)}>{level} — {score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function RippleClient({
  topicId,
  topicStatement,
  topicStatus,
}: {
  topicId: string
  topicStatement: string
  topicStatus: string
}) {
  const [data, setData] = useState<RippleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<'passes' | 'fails'>('passes')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/ripple`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: RippleResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const statusCfg = STATUS_LABEL[topicStatus] ?? STATUS_LABEL.proposed

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to topic
          </Link>
          <span className="text-surface-600" aria-hidden="true">/</span>
          <span className="text-sm font-mono text-surface-500">Ripple Effect</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Waves className="h-5 w-5 text-emerald" aria-hidden="true" />
            <p className="text-xs font-mono text-emerald uppercase tracking-wider">Ripple Effect Analyzer</p>
          </div>
          <h1 className="font-mono text-xl sm:text-2xl font-bold text-white leading-snug mb-3">
            {topicStatement}
          </h1>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded-full', statusCfg.color, 'bg-current/10')}>
              {statusCfg.label}
            </span>
            <span className="text-xs font-mono text-surface-500">
              {data ? `${data.topic.total_votes.toLocaleString()} votes · ${Math.round(data.topic.blue_pct)}% FOR` : '…'}
            </span>
          </div>
        </div>

        {loading && <RippleSkeleton />}

        {error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-8 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-400 mb-4">{error}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-8">
            {/* Impact overview card */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wide mb-4">
                Ecosystem Overview
              </p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="text-center rounded-xl bg-surface-200 p-3">
                  <p className="text-2xl font-mono font-bold text-emerald tabular-nums">
                    {data.if_passes.laws_reinforced.length + data.if_passes.topics_enabled.length}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-1">
                    <span className="text-emerald">↑</span> Enabled
                  </p>
                </div>
                <div className="text-center rounded-xl bg-surface-200 p-3">
                  <p className="text-2xl font-mono font-bold text-against-400 tabular-nums">
                    {data.if_passes.laws_contradicted.length + data.if_passes.topics_undermined.length}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-1">
                    <span className="text-against-400">↓</span> Challenged
                  </p>
                </div>
                <div className="text-center rounded-xl bg-surface-200 p-3">
                  <p className="text-2xl font-mono font-bold text-gold tabular-nums">
                    {data.cascade_depth}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-1">
                    Cascade depth
                  </p>
                </div>
              </div>
              <ImpactGauge score={data.ecosystem_impact_score} />
            </div>

            {/* Scenario toggle */}
            <div className="flex rounded-xl bg-surface-200 p-1 gap-1">
              <button
                type="button"
                onClick={() => setScenario('passes')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all duration-200',
                  scenario === 'passes'
                    ? 'bg-for-600 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                If it PASSES
              </button>
              <button
                type="button"
                onClick={() => setScenario('fails')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all duration-200',
                  scenario === 'fails'
                    ? 'bg-against-600 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                If it FAILS
              </button>
            </div>

            <AnimatePresence mode="wait">
              {scenario === 'passes' && (
                <motion.div
                  key="passes"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8"
                >
                  {/* Laws reinforced */}
                  <Section
                    title="Laws Reinforced"
                    subtitle="Established laws this would strengthen or build upon"
                    count={data.if_passes.laws_reinforced.length}
                    accentColor="text-emerald"
                    icon={CheckCircle2}
                    empty="No reinforced laws identified in the Codex."
                  >
                    {data.if_passes.laws_reinforced.map((law, i) => (
                      <LawCard key={law.id} law={law} idx={i} />
                    ))}
                  </Section>

                  {/* Active topics enabled */}
                  <Section
                    title="Active Debates Enabled"
                    subtitle="Proposals that gain momentum if this passes"
                    count={data.if_passes.topics_enabled.length}
                    accentColor="text-for-400"
                    icon={ArrowRight}
                    empty="No active debates would be directly enabled."
                  >
                    {data.if_passes.topics_enabled.map((t, i) => (
                      <TopicCard key={t.id} topic={t} idx={i} />
                    ))}
                  </Section>

                  {/* Laws contradicted */}
                  {data.if_passes.laws_contradicted.length > 0 && (
                    <Section
                      title="Laws Potentially Contradicted"
                      subtitle="Existing laws this would conflict with or supersede"
                      count={data.if_passes.laws_contradicted.length}
                      accentColor="text-against-400"
                      icon={XCircle}
                      empty=""
                    >
                      {data.if_passes.laws_contradicted.map((law, i) => (
                        <LawCard key={law.id} law={law} idx={i} />
                      ))}
                    </Section>
                  )}

                  {/* Active topics undermined */}
                  {data.if_passes.topics_undermined.length > 0 && (
                    <Section
                      title="Active Debates Undermined"
                      subtitle="Proposals that lose relevance or support if this passes"
                      count={data.if_passes.topics_undermined.length}
                      accentColor="text-purple"
                      icon={Flame}
                      empty=""
                    >
                      {data.if_passes.topics_undermined.map((t, i) => (
                        <TopicCard key={t.id} topic={t} idx={i} />
                      ))}
                    </Section>
                  )}
                </motion.div>
              )}

              {scenario === 'fails' && (
                <motion.div
                  key="fails"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8"
                >
                  {/* Laws preserved */}
                  <Section
                    title="Laws Preserved"
                    subtitle="Established laws protected if this motion fails"
                    count={data.if_fails.laws_preserved.length}
                    accentColor="text-emerald"
                    icon={CheckCircle2}
                    empty="No existing laws are specifically protected by this failing."
                  >
                    {data.if_fails.laws_preserved.map((law, i) => (
                      <LawCard key={law.id} law={law} idx={i} />
                    ))}
                  </Section>

                  {/* Active topics blocked */}
                  <Section
                    title="Active Debates Blocked"
                    subtitle="Proposals that lose momentum or feasibility if this fails"
                    count={data.if_fails.topics_blocked.length}
                    accentColor="text-against-400"
                    icon={XCircle}
                    empty="No active debates would be directly blocked."
                  >
                    {data.if_fails.topics_blocked.map((t, i) => (
                      <TopicCard key={t.id} topic={t} idx={i} />
                    ))}
                  </Section>

                  {data.if_fails.laws_preserved.length === 0 && data.if_fails.topics_blocked.length === 0 && (
                    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
                      <BarChart2 className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                      <p className="text-sm font-mono text-surface-500">
                        If this debate fails, the civic ecosystem shows minimal immediate cascade. The platform continues without major disruption.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer navigation */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-wide">Related Analysis</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/topic/${topicId}/connections`, label: 'Connections Hub', color: 'text-emerald' },
                  { href: `/topic/${topicId}/correlations`, label: 'Correlations', color: 'text-purple' },
                  { href: `/topic/${topicId}/impact`, label: 'Impact Score', color: 'text-gold' },
                  { href: `/topic/${topicId}/forecast`, label: 'Law Forecast', color: 'text-for-400' },
                ].map(({ href, label, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn('flex items-center gap-1.5 text-xs font-mono transition-colors hover:opacity-80', color)}
                  >
                    <ArrowRight className="h-3 w-3" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Refresh */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh analysis
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
