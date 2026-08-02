'use client'

/**
 * /law/[id]/what-if — Repeal Scenario Analysis
 *
 * Shows what would happen to the civic landscape if this established law were
 * challenged and overturned. Analyses:
 *   - The dissent constituency who opposed this law
 *   - Related laws that would need re-evaluation (cascade risk)
 *   - Topics that would resurface as active debates
 *   - Dissenting arguments that would regain prominence
 *   - Policy domains affected by repeal
 *
 * All data is derived from real Supabase records — no AI required.
 *
 * Distinct from:
 *   /law/[id]/dissent    — who voted against and their arguments
 *   /law/[id]/challenge  — active formal challenges to this law
 *   /law/[id]/verdict    — community verdict on law quality
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Gavel,
  GitMerge,
  Layers,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type {
  WhatIfResponse,
  WhatIfCascadeLaw,
  WhatIfTopicReSurface,
  WhatIfDissentArgument,
  WhatIfImpactDomain,
} from '@/app/api/laws/[id]/what-if/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (y >= 1) return `${y}y ago`
  if (m >= 1) return `${m}mo ago`
  if (d >= 1) return `${d}d ago`
  return 'today'
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

const RISK_CONFIG = {
  high: { label: 'HIGH RISK', color: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/30' },
  medium: { label: 'MEDIUM', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  low: { label: 'LOW', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  proposed: { label: 'Proposed', color: 'text-surface-400', icon: FileText },
  active:   { label: 'Active',   color: 'text-for-400',     icon: Zap },
  voting:   { label: 'Voting',   color: 'text-purple',      icon: Scale },
  failed:   { label: 'Failed',   color: 'text-against-400', icon: ThumbsDown },
}

function cascadeConfidenceLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'High cascade risk', color: 'text-against-400' }
  if (score >= 45) return { label: 'Moderate cascade risk', color: 'text-gold' }
  return { label: 'Low cascade risk', color: 'text-emerald' }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ImpactDomainCard({ domain, index }: { domain: WhatIfImpactDomain; index: number }) {
  const cfg = RISK_CONFIG[domain.risk]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn('rounded-xl border p-4', cfg.border, cfg.bg)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white">{domain.domain}</h4>
          <p className="text-xs text-surface-500 mt-1 leading-relaxed">{domain.description}</p>
        </div>
        <span className={cn('flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded border', cfg.color, cfg.border, cfg.bg)}>
          {cfg.label}
        </span>
      </div>
    </motion.div>
  )
}

function CascadeLawCard({ law, index }: { law: WhatIfCascadeLaw; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      <Link
        href={`/law/${law.id}`}
        className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-gold/40 hover:bg-gold/5 transition-all group"
      >
        <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
          <Gavel className="h-3 w-3 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {law.category && (
              <Badge variant="outline" className="text-[10px] py-0">{law.category}</Badge>
            )}
            <span className="text-[10px] font-mono text-for-400">{Math.round(law.blue_pct)}% FOR</span>
            <span className="text-[10px] text-surface-600">{fmtNum(law.total_votes)} votes</span>
          </div>
          {law.shared_keywords.length > 0 && (
            <p className="text-[10px] text-surface-600 mt-1">
              Shared: {law.shared_keywords.slice(0, 3).join(', ')}
            </p>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </Link>
    </motion.div>
  )
}

function ResurfaceTopicCard({ topic, index }: { topic: WhatIfTopicReSurface; index: number }) {
  const cfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-400', icon: FileText }
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-against-500/40 hover:bg-against-500/5 transition-all group"
      >
        <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-lg bg-against-500/10 border border-against-500/20 flex items-center justify-center">
          <Icon className={cn('h-3 w-3', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-against-300 transition-colors">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn('text-[10px] font-semibold', cfg.color)}>{cfg.label}</span>
            {topic.status === 'failed' && (
              <span className="text-[10px] text-against-400 font-mono">{topic.against_pct}% AGAINST</span>
            )}
            <span className="text-[10px] text-surface-600">{fmtNum(topic.total_votes)} votes</span>
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </Link>
    </motion.div>
  )
}

function DissentArgumentCard({ arg, index }: { arg: WhatIfDissentArgument; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl border border-against-500/20 bg-against-500/5 p-3"
    >
      <div className="flex items-start gap-2.5">
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name ?? arg.author_username ?? '?'}
          size="xs"
          className="flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-400 leading-relaxed line-clamp-3">{arg.content}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] font-mono text-against-400 bg-against-500/10 px-1.5 py-0.5 rounded">
              AGAINST
            </span>
            {arg.ai_grade && (
              <span className="text-[10px] font-mono text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                Grade {arg.ai_grade}
              </span>
            )}
            {arg.upvotes > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-surface-500">
                <ThumbsUp className="h-2.5 w-2.5" />
                {arg.upvotes}
              </span>
            )}
            {(arg.author_display_name ?? arg.author_username) && (
              <Link
                href={`/profile/${arg.author_username}`}
                className="text-[10px] text-surface-500 hover:text-surface-300 transition-colors ml-auto"
              >
                @{arg.author_username}
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  children,
  count,
  collapsible = false,
}: {
  title: string
  subtitle: string
  icon: typeof Gavel
  iconColor: string
  iconBg: string
  children: React.ReactNode
  count?: number
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 overflow-hidden mb-4">
      <button
        onClick={() => collapsible && setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-3 p-4',
          collapsible ? 'hover:bg-white/5 cursor-pointer transition-colors' : 'cursor-default'
        )}
      >
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {count !== undefined && (
              <span className="text-[10px] font-mono text-surface-500 bg-surface-200/60 border border-surface-300/40 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500">{subtitle}</p>
        </div>
        {collapsible && (
          open ? <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
               : <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-surface-300/40 space-y-2 pt-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center">
            <Skeleton className="h-7 w-16 mb-1 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function WhatIfClient({ lawId }: { lawId: string }) {
  const params = useParams<{ id: string }>()
  const id = lawId ?? params.id

  const [data, setData] = useState<WhatIfResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/what-if`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load scenario data')
      const json: WhatIfResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const cascadeConf = data ? cascadeConfidenceLabel(data.cascade_confidence) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back link ──────────────────────────────────────────────── */}
        <Link
          href={`/law/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Law
        </Link>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <RotateCcw className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">What If Repealed?</h1>
              <p className="text-xs text-surface-500">Scenario analysis if this consensus were overturned</p>
            </div>
          </div>

          {data && (
            <div className="mt-4 p-4 rounded-xl bg-surface-100 border border-surface-300/60">
              <div className="flex items-start gap-3">
                <Gavel className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium leading-snug line-clamp-2">
                    {data.law_statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {data.law_category && (
                      <Badge variant="outline" className="text-[10px]">{data.law_category}</Badge>
                    )}
                    <span className="text-[10px] font-mono text-for-400">{Math.round(data.law_blue_pct)}% FOR</span>
                    <span className="text-[10px] font-mono text-against-400">{data.dissent_pct}% AGAINST</span>
                    <span className="text-[10px] text-surface-500 font-mono">
                      {fmtNum(data.law_total_votes)} votes
                    </span>
                    <span className="text-[10px] text-surface-500">
                      established {relTime(data.law_established_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-surface-500" />
            <span className="text-sm text-surface-500">
              {loading ? 'Simulating...' : 'Repeal scenario analysis'}
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={AlertTriangle}
            iconColor="text-against-400"
            title="Could not load scenario"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-0">

            {/* ── Stats strip ───────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                {
                  label: 'Would Gain',
                  value: fmtNum(data.dissent_count),
                  sub: `${data.dissent_pct}% of voters`,
                  color: 'text-against-400',
                },
                {
                  label: 'Cascade Risk',
                  value: `${data.cascade_confidence}%`,
                  sub: cascadeConf?.label ?? '',
                  color: cascadeConf?.color ?? 'text-surface-400',
                },
                {
                  label: 'Laws at Risk',
                  value: data.cascade_laws.length > 0 ? data.cascade_laws.length : '0',
                  sub: 'linked to this one',
                  color: data.cascade_laws.length > 0 ? 'text-gold' : 'text-emerald',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center"
                >
                  <p className={cn('font-bold text-lg', stat.color)}>{stat.value}</p>
                  <p className="text-[11px] font-medium text-white mt-0.5">{stat.label}</p>
                  <p className={cn('text-[10px] mt-0.5', stat.color === 'text-white' ? 'text-surface-500' : stat.color)}>
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Impact Domains ─────────────────────────────────────── */}
            <Section
              title="Policy Domains Affected"
              subtitle="Areas of civic life that would revert to uncertainty"
              icon={Layers}
              iconColor="text-against-400"
              iconBg="bg-against-500/10 border border-against-500/20"
              count={data.impact_domains.length}
            >
              {data.impact_domains.map((domain, i) => (
                <ImpactDomainCard key={domain.domain} domain={domain} index={i} />
              ))}
            </Section>

            {/* ── Cascade Laws ───────────────────────────────────────── */}
            <Section
              title="Laws That Would Need Re-Evaluation"
              subtitle="Established laws in the same category sharing key themes"
              icon={GitMerge}
              iconColor="text-gold"
              iconBg="bg-gold/10 border border-gold/20"
              count={data.cascade_laws.length}
              collapsible
            >
              {data.cascade_laws.length === 0 ? (
                <p className="text-xs text-surface-500 italic py-2">
                  No directly linked laws identified in the Codex.
                </p>
              ) : (
                data.cascade_laws.map((law, i) => (
                  <CascadeLawCard key={law.id} law={law} index={i} />
                ))
              )}
            </Section>

            {/* ── Resurface Topics ──────────────────────────────────── */}
            <Section
              title="Debates That Would Resurface"
              subtitle="Active topics and failed debates that would re-emerge"
              icon={TrendingUp}
              iconColor="text-purple"
              iconBg="bg-purple/10 border border-purple/20"
              count={data.resurface_topics.length}
              collapsible
            >
              {data.resurface_topics.length === 0 ? (
                <p className="text-xs text-surface-500 italic py-2">
                  No similar active or failed debates found.
                </p>
              ) : (
                data.resurface_topics.map((topic, i) => (
                  <ResurfaceTopicCard key={topic.id} topic={topic} index={i} />
                ))
              )}
            </Section>

            {/* ── Dissenting Arguments ──────────────────────────────── */}
            <Section
              title="Arguments That Would Regain Prominence"
              subtitle="The strongest against-side arguments from the original debate"
              icon={MessageSquare}
              iconColor="text-against-300"
              iconBg="bg-against-500/10 border border-against-500/20"
              count={data.dissent_arguments.length}
              collapsible
            >
              {data.dissent_arguments.length === 0 ? (
                <p className="text-xs text-surface-500 italic py-2">
                  No dissenting arguments recorded for this debate.
                </p>
              ) : (
                data.dissent_arguments.map((arg, i) => (
                  <DissentArgumentCard key={arg.id} arg={arg} index={i} />
                ))
              )}
            </Section>

            {/* ── Dissent note ──────────────────────────────────────── */}
            <div className="mt-2 p-4 rounded-xl bg-against-500/5 border border-against-500/20">
              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    <span className="text-against-400 font-semibold">
                      {fmtNum(data.dissent_count)} citizens ({data.dissent_pct}%)
                    </span>{' '}
                    voted against this law when it was decided. These citizens would see their position
                    validated if the law were successfully challenged. Visit{' '}
                    <Link href={`/law/${id}/dissent`} className="text-against-300 underline underline-offset-2 hover:text-against-200 transition-colors">
                      Loyal Opposition
                    </Link>{' '}
                    to explore their full arguments and civic veto attempts.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Related links ─────────────────────────────────────── */}
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {[
                { label: 'Loyal Opposition', href: `/law/${id}/dissent`, desc: 'Full dissent analysis' },
                { label: 'Formal Challenges', href: `/law/${id}/challenge`, desc: 'Active civic veto attempts' },
                { label: 'Similar Laws', href: `/law/${id}/similar`, desc: 'Comparable Codex entries' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-medium text-white group-hover:text-against-300 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-[10px] text-surface-500">{link.desc}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-against-400 transition-colors flex-shrink-0" />
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
