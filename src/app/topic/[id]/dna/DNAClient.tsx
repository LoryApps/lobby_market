'use client'

/**
 * /topic/[id]/dna — Debate DNA
 *
 * A "genetic fingerprint" of the debate — what reasoning types dominate,
 * the core ideological tension at its heart, and which debates share the
 * same civic genetic fingerprint.
 *
 * Distinct from:
 *   /topic/[id]/anatomy   — structural analysis (length, grade distribution)
 *   /topic/[id]/sentiment — emotional tone and civility
 *   /topic/[id]/themes    — topic tags and keyword cloud
 *   /topic/[id]/synthesis — AI common-ground and tensions
 *   /analytics/dna        — YOUR personal argument style DNA
 *
 * This page answers: "What is this debate fundamentally made of?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  ChevronRight,
  Dna,
  Flame,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DNAResponse, DNAStrand, CoreTension, GeneticRelative } from '@/app/api/topics/[id]/dna/route'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active',
  law: 'law', failed: 'failed', continued: 'proposed', archived: 'proposed',
}

// ─── DNA strand bar ───────────────────────────────────────────────────────────

function StrandBar({
  strand,
  isForDominant,
  isAgainstDominant,
  expanded,
  onToggle,
}: {
  strand: DNAStrand
  isForDominant: boolean
  isAgainstDominant: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const maxPct = Math.max(strand.forPct, strand.againstPct, 1)
  const isDominant = isForDominant || isAgainstDominant

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border transition-colors cursor-pointer',
        isDominant
          ? 'border-surface-300 bg-surface-200/80'
          : 'border-surface-300/50 bg-surface-100/50 hover:bg-surface-200/50',
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-surface-100"
          style={{ backgroundColor: strand.color, ringColor: strand.color + '40' }}
        />

        {/* Label & description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{strand.label}</span>
            {isDominant && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                style={{
                  color: strand.color,
                  borderColor: strand.color + '60',
                  backgroundColor: strand.color + '15',
                }}
              >
                {isForDominant && isAgainstDominant ? 'SHARED' : isForDominant ? 'FOR DOM.' : 'AGAINST DOM.'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 font-mono mt-0.5 truncate">{strand.description}</p>
        </div>

        {/* FOR bar */}
        <div className="flex flex-col items-end gap-0.5 w-20 flex-shrink-0">
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#3b82f6' }}
                initial={{ width: 0 }}
                animate={{ width: `${(strand.forPct / maxPct) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-mono text-for-400 w-8 text-right">{strand.forPct}%</span>
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#ef4444' }}
                initial={{ width: 0 }}
                animate={{ width: `${(strand.againstPct / maxPct) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
              />
            </div>
            <span className="text-[10px] font-mono text-against-400 w-8 text-right">{strand.againstPct}%</span>
          </div>
        </div>

        <ChevronRight
          className={cn('h-4 w-4 text-surface-500 transition-transform flex-shrink-0', expanded && 'rotate-90')}
        />
      </div>

      {/* Expanded: example arguments */}
      <AnimatePresence>
        {expanded && (strand.topForArg || strand.topAgainstArg) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 grid gap-2 sm:grid-cols-2 border-t border-surface-300/50 mt-0">
              {strand.topForArg && (
                <div className="rounded-lg bg-for-600/10 border border-for-500/20 p-3">
                  <div className="flex items-center gap-1 mb-1.5">
                    <ThumbsUp className="h-3 w-3 text-for-400" />
                    <span className="text-[10px] font-mono text-for-400 uppercase tracking-wider">Top FOR</span>
                  </div>
                  <p className="text-xs text-surface-600 leading-relaxed">{strand.topForArg}</p>
                </div>
              )}
              {strand.topAgainstArg && (
                <div className="rounded-lg bg-against-600/10 border border-against-500/20 p-3">
                  <div className="flex items-center gap-1 mb-1.5">
                    <ThumbsDown className="h-3 w-3 text-against-400" />
                    <span className="text-[10px] font-mono text-against-400 uppercase tracking-wider">Top AGAINST</span>
                  </div>
                  <p className="text-xs text-surface-600 leading-relaxed">{strand.topAgainstArg}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Core tension display ─────────────────────────────────────────────────────

function TensionCard({ tension }: { tension: CoreTension }) {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300 bg-surface-200/50">
        <Brain className="h-3.5 w-3.5 text-purple flex-shrink-0" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Core Tension</span>
        <span
          className={cn(
            'ml-auto text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
            tension.intensity === 'extreme' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
            tension.intensity === 'high'    ? 'text-against-400 border-against-500/30 bg-against-500/10' :
            tension.intensity === 'moderate' ? 'text-gold border-gold/30 bg-gold/10' :
            'text-surface-500 border-surface-400/30 bg-surface-300/10',
          )}
        >
          {tension.intensity}
        </span>
      </div>
      <div className="px-4 py-4">
        <h3 className="text-lg font-bold text-white mb-1">{tension.label}</h3>
        <p className="text-sm text-surface-600 mb-4">{tension.description}</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg bg-for-600/10 border border-for-500/20 px-3 py-2 text-center">
            <p className="text-[10px] font-mono text-for-400 uppercase tracking-wider mb-1">FOR leads with</p>
            <p className="text-sm font-semibold text-white">{tension.forStrand}</p>
          </div>
          <div className="text-surface-500 font-mono text-xs">vs</div>
          <div className="flex-1 rounded-lg bg-against-600/10 border border-against-500/20 px-3 py-2 text-center">
            <p className="text-[10px] font-mono text-against-400 uppercase tracking-wider mb-1">AGAINST leads with</p>
            <p className="text-sm font-semibold text-white">{tension.againstStrand}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Genetic relatives ────────────────────────────────────────────────────────

function RelativeCard({ relative, index }: { relative: GeneticRelative; index: number }) {
  const forPct = Math.round(relative.blue_pct)
  const isLaw = relative.status === 'law'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Link
        href={`/topic/${relative.id}`}
        className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200 transition-all group"
      >
        <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-surface-300 flex items-center justify-center text-xs font-mono font-bold text-surface-500">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {relative.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant={STATUS_BADGE[relative.status] ?? 'proposed'} size="sm">
              {isLaw ? 'LAW' : relative.status}
            </Badge>
            <span className="text-[11px] font-mono text-surface-500">
              <span className="text-for-400">{forPct}%</span> FOR
            </span>
            <span className="text-[11px] font-mono text-surface-500">
              {relative.similarity}% match · {relative.sharedStrand}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

// ─── Uniqueness gauge ─────────────────────────────────────────────────────────

function UniquenessGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#8b5cf6' : score >= 40 ? '#f59e0b' : '#10b981'
  const label = score >= 70 ? 'Outlier Debate' : score >= 40 ? 'Distinctive' : 'Category Classic'

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 flex items-center gap-4">
      <div className="relative flex-shrink-0 w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#2d3748" strokeWidth="5" />
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - score / 100)}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
          {score}
        </span>
      </div>
      <div>
        <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">DNA Uniqueness</p>
        <p className="text-base font-semibold text-white mt-0.5">{label}</p>
        <p className="text-[11px] text-surface-500 mt-0.5">
          {score >= 70
            ? 'Rare argument pattern — unlike most debates in this category'
            : score >= 40
              ? 'Some distinctive traits vs. typical category debates'
              : 'Classic pattern for this category — familiar argumentative territory'}
        </p>
      </div>
    </div>
  )
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function DNASkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-6 w-36 rounded-lg" />
      {[1, 2, 3, 4, 5, 6].map((k) => (
        <Skeleton key={k} className="h-16 w-full rounded-xl" />
      ))}
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DNAClient({ topicId }: { topicId: string }) {
  const params = useParams()
  const id = topicId || (params?.id as string)

  const [data, setData] = useState<DNAResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStrand, setExpandedStrand] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/dna`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch {
      setError('Could not load DNA analysis.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Back */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>

        {loading ? (
          <DNASkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <Dna className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-400 text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : data ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Dna className="h-5 w-5 text-purple" />
                <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Debate DNA</span>
                <button
                  onClick={load}
                  title="Refresh"
                  className="ml-auto p-1 rounded text-surface-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <h1 className="text-xl font-bold text-white leading-snug mb-1 line-clamp-3">
                {data.topic.statement}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                {data.topic.category && (
                  <Badge variant="proposed" size="sm">{data.topic.category}</Badge>
                )}
                <span className="text-xs font-mono text-surface-500">
                  {data.totalArgs} args · {data.forArgs} FOR · {data.againstArgs} AGAINST
                </span>
              </div>
            </div>

            {/* Insight */}
            {data.insight && (
              <div className="rounded-xl border border-purple/30 bg-purple/5 px-4 py-3 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
                <p className="text-sm text-surface-600 leading-relaxed">{data.insight}</p>
              </div>
            )}

            {/* Uniqueness gauge */}
            <UniquenessGauge score={data.uniquenessScore} />

            {/* DNA strands */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-mono text-surface-400 uppercase tracking-wider">Argument Strands</h2>
                <div className="flex-1 h-px bg-surface-300" />
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-for-500 inline-block" /> FOR</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-against-500 inline-block" /> AGAINST</span>
                </div>
              </div>
              <p className="text-xs text-surface-500 mb-3">% of arguments in each category that use this reasoning type. Click a strand to see example arguments.</p>
              <div className="space-y-2">
                {data.strands
                  .sort((a, b) => (b.forPct + b.againstPct) - (a.forPct + a.againstPct))
                  .map((strand) => (
                    <StrandBar
                      key={strand.id}
                      strand={strand}
                      isForDominant={strand.id === data.dominantForStrand}
                      isAgainstDominant={strand.id === data.dominantAgainstStrand}
                      expanded={expandedStrand === strand.id}
                      onToggle={() => setExpandedStrand(expandedStrand === strand.id ? null : strand.id)}
                    />
                  ))}
              </div>
            </div>

            {/* Core tension */}
            {data.coreTension ? (
              <TensionCard tension={data.coreTension} />
            ) : (
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                <Brain className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                <p className="text-sm text-surface-500">
                  {data.totalArgs < 4
                    ? 'Add more arguments to unlock the core tension analysis.'
                    : 'Both sides use similar reasoning types — this debate is more about facts than fundamental values.'}
                </p>
              </div>
            )}

            {/* Genetic relatives */}
            {data.relatives.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-mono text-surface-400 uppercase tracking-wider">Genetic Relatives</h2>
                  <div className="flex-1 h-px bg-surface-300" />
                </div>
                <p className="text-xs text-surface-500 mb-3">
                  Other {data.topic.category ?? 'civic'} debates with the most similar argument DNA.
                </p>
                <div className="space-y-2">
                  {data.relatives.map((rel, i) => (
                    <RelativeCard key={rel.id} relative={rel} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Navigation links */}
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">Related analysis</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `../anatomy`, label: 'Argument Anatomy', icon: Brain },
                  { href: `../sentiment`, label: 'Discourse Sentiment', icon: Flame },
                  { href: `../themes`, label: 'Topic Themes', icon: Sparkles },
                  { href: `../synthesis`, label: 'AI Synthesis', icon: Zap },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/50 hover:bg-surface-200 border border-surface-300/50 hover:border-surface-400/50 transition-all group text-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                    <span className="text-surface-600 group-hover:text-white transition-colors text-xs">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
