'use client'

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
  Gavel,
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
import type { LawDNAResponse, LawDNAStrand, LawCoreTension, LawGeneticRelative } from '@/app/api/laws/[id]/dna/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intensityColor(intensity: LawCoreTension['intensity']): string {
  return intensity === 'extreme' ? 'text-against-300'
    : intensity === 'high' ? 'text-gold'
    : intensity === 'moderate' ? 'text-purple'
    : 'text-surface-400'
}

function intensityBg(intensity: LawCoreTension['intensity']): string {
  return intensity === 'extreme' ? 'bg-against-500/10 border-against-500/30'
    : intensity === 'high' ? 'bg-gold/10 border-gold/30'
    : intensity === 'moderate' ? 'bg-purple/10 border-purple/30'
    : 'bg-surface-200/40 border-surface-400/30'
}

function estDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Strand bar ───────────────────────────────────────────────────────────────

function StrandBar({
  strand,
  isDominantFor,
  isDominantAgainst,
  expanded,
  onToggle,
}: {
  strand: LawDNAStrand
  isDominantFor: boolean
  isDominantAgainst: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const isDominant = isDominantFor || isDominantAgainst

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border transition-colors cursor-pointer select-none',
        isDominant
          ? 'border-surface-300 bg-surface-200/80'
          : 'border-surface-300/50 bg-surface-100/50 hover:bg-surface-200/50',
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: strand.color }}
        />
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
                {isDominantFor && isDominantAgainst ? 'SHARED' : isDominantFor ? 'FOR DOM.' : 'AGAINST DOM.'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5">{strand.description}</p>
        </div>
        {/* Mini bars */}
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-mono text-for-400">FOR</span>
            <div className="w-16 h-1.5 rounded-full bg-surface-300">
              <div
                className="h-full rounded-full bg-for-500"
                style={{ width: `${strand.forPct}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-surface-500">{strand.forPct}%</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-mono text-against-400">AGAINST</span>
            <div className="w-16 h-1.5 rounded-full bg-surface-300">
              <div
                className="h-full rounded-full bg-against-500"
                style={{ width: `${strand.againstPct}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-surface-500">{strand.againstPct}%</span>
          </div>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-surface-500 flex-shrink-0 transition-transform',
            expanded && 'rotate-90',
          )}
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-surface-300/50 pt-3">
              {/* Mobile bars */}
              <div className="flex sm:hidden items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-for-400">FOR ({strand.forCount} args)</span>
                    <span className="text-[10px] font-mono text-surface-500">{strand.forPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-300">
                    <div className="h-full rounded-full bg-for-500" style={{ width: `${strand.forPct}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-against-400">AGAINST ({strand.againstCount} args)</span>
                    <span className="text-[10px] font-mono text-surface-500">{strand.againstPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-300">
                    <div className="h-full rounded-full bg-against-500" style={{ width: `${strand.againstPct}%` }} />
                  </div>
                </div>
              </div>

              {/* Top founding arguments */}
              {strand.topForArg && (
                <div className="rounded-lg bg-for-500/5 border border-for-500/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ThumbsUp className="h-3 w-3 text-for-400" />
                    <span className="text-[10px] font-mono text-for-400 font-semibold uppercase tracking-wide">Top FOR argument</span>
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed">{strand.topForArg}</p>
                </div>
              )}
              {strand.topAgainstArg && (
                <div className="rounded-lg bg-against-500/5 border border-against-500/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ThumbsDown className="h-3 w-3 text-against-400" />
                    <span className="text-[10px] font-mono text-against-400 font-semibold uppercase tracking-wide">Top AGAINST argument</span>
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed">{strand.topAgainstArg}</p>
                </div>
              )}
              {!strand.topForArg && !strand.topAgainstArg && (
                <p className="text-xs text-surface-500 italic">No founding arguments matched this strand.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Genetic relative card ────────────────────────────────────────────────────

function RelativeCard({ rel }: { rel: LawGeneticRelative }) {
  const forPct = Math.round(rel.blue_pct)
  return (
    <Link href={`/law/${rel.id}`} className="block group">
      <div className="rounded-xl border border-surface-300/60 bg-surface-100/60 hover:bg-surface-200/60 hover:border-surface-400/60 transition-colors p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Gavel className="h-4 w-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {rel.statement}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-mono text-gold px-1.5 py-0.5 rounded border border-gold/30 bg-gold/10">LAW</span>
              <span className="text-[10px] font-mono text-surface-500">
                {forPct}% FOR · {(rel.total_votes ?? 0).toLocaleString()} votes
              </span>
              <span className="text-[10px] font-mono text-surface-600">
                {estDate(rel.established_at)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Dna className="h-3 w-3 text-surface-500" />
              <span className="text-[10px] text-surface-500">
                {rel.similarity}% DNA match · shared <span className="text-surface-300">{rel.sharedStrand}</span> strand
              </span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-0.5 transition-colors" />
        </div>
      </div>
    </Link>
  )
}

// ─── DNA loading skeleton ─────────────────────────────────────────────────────

function DNASkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
      <Skeleton className="h-36 w-full" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function LawDNAClient({ lawId }: { lawId: string }) {
  const params = useParams<{ id: string }>()
  const id = lawId || params.id

  const [data, setData] = useState<LawDNAResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStrand, setExpandedStrand] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/dna`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load DNA profile.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-48" />
          </div>
          <DNASkeleton />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 flex flex-col items-center justify-center gap-4 min-h-[50vh]">
          <Dna className="h-10 w-10 text-surface-500" />
          <p className="text-surface-400 text-sm">{error ?? 'Something went wrong.'}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-sm text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { law, strands, dominantForStrand, dominantAgainstStrand, coreTension, uniquenessScore, relatives, totalArgs, forArgs: forArgCount, againstArgs: againstArgCount, insight } = data

  const sortedStrands = [...strands].sort((a, b) => b.combined - a.combined)
  const topStrand = sortedStrands[0]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href={`/law/${id}`}
            className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-sm font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Law
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Dna className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white">Law DNA</h1>
              <p className="text-xs text-surface-500 font-mono">Founding argument fingerprint</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
            <div className="flex items-start gap-2 mb-2">
              <Gavel className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-white leading-snug">{law.statement}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {law.category && (
                <Badge variant="proposed" className="text-[10px]">{law.category}</Badge>
              )}
              <span className="text-[10px] font-mono text-gold px-1.5 py-0.5 rounded border border-gold/30 bg-gold/10">ESTABLISHED LAW</span>
              <span className="text-[10px] font-mono text-surface-500">
                {(law.total_votes ?? 0).toLocaleString()} votes · {Math.round(law.blue_pct)}% FOR
              </span>
            </div>
          </div>
        </div>

        {/* Argument stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Args', value: totalArgs, color: 'text-white' },
            { label: 'FOR',        value: forArgCount,     color: 'text-for-400' },
            { label: 'AGAINST',    value: againstArgCount, color: 'text-against-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-surface-300/60 bg-surface-100/60 p-3 text-center">
              <p className={cn('text-2xl font-mono font-bold', color)}>{value}</p>
              <p className="text-[11px] text-surface-500 font-mono mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* AI Insight */}
        <div className="rounded-xl border border-purple/20 bg-purple/5 p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-purple" />
            <span className="text-xs font-mono text-purple font-semibold uppercase tracking-wider">DNA Insight</span>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">{insight}</p>
        </div>

        {/* Core tension */}
        {coreTension && (
          <div className={cn('rounded-xl border p-4 mb-6', intensityBg(coreTension.intensity))}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className={cn('h-4 w-4', intensityColor(coreTension.intensity))} />
              <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', intensityColor(coreTension.intensity))}>
                Core Tension · {coreTension.intensity.toUpperCase()}
              </span>
            </div>
            <h3 className="text-lg font-mono font-bold text-white mb-1">{coreTension.label}</h3>
            <p className="text-sm text-surface-300 mb-3">{coreTension.description}</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-3 w-3 text-for-400" />
                <span className="text-xs font-mono text-for-400">{coreTension.forStrand}</span>
              </div>
              <span className="text-surface-500 text-xs">vs</span>
              <div className="flex items-center gap-1.5">
                <ThumbsDown className="h-3 w-3 text-against-400" />
                <span className="text-xs font-mono text-against-400">{coreTension.againstStrand}</span>
              </div>
            </div>
          </div>
        )}

        {/* Dominant strands summary */}
        {topStrand && (
          <div className="rounded-xl border border-surface-300/60 bg-surface-100/60 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-emerald" />
              <span className="text-xs font-mono text-emerald font-semibold uppercase tracking-wider">Dominant DNA</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono"
                style={{ color: topStrand.color, borderColor: topStrand.color + '40', backgroundColor: topStrand.color + '15' }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: topStrand.color }} />
                {topStrand.label}
              </div>
              <span className="text-xs text-surface-500">most prevalent across founding arguments</span>
            </div>
          </div>
        )}

        {/* Strand breakdown */}
        <div className="mb-8">
          <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3">
            Argument Strands
          </h2>
          <div className="space-y-2">
            {sortedStrands.map((strand) => (
              <StrandBar
                key={strand.id}
                strand={strand}
                isDominantFor={strand.id === dominantForStrand}
                isDominantAgainst={strand.id === dominantAgainstStrand}
                expanded={expandedStrand === strand.id}
                onToggle={() => setExpandedStrand(expandedStrand === strand.id ? null : strand.id)}
              />
            ))}
          </div>
        </div>

        {/* Uniqueness score */}
        <div className="rounded-xl border border-surface-300/60 bg-surface-100/60 p-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-gold" />
              <span className="text-xs font-mono text-surface-400 uppercase tracking-wider font-semibold">Ideological Uniqueness</span>
            </div>
            <span className="text-2xl font-mono font-bold text-gold">{uniquenessScore}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-300">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${uniquenessScore}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
            />
          </div>
          <p className="text-[11px] text-surface-500 mt-2">
            {uniquenessScore >= 70
              ? 'This law has a rare DNA profile — its argument structure is distinct from similar laws in the same category.'
              : uniquenessScore >= 40
                ? 'This law shares DNA similarities with others in its category, but has distinct reasoning patterns.'
                : 'This law has a typical DNA profile for its category — familiar argument structures from both sides.'}
          </p>
        </div>

        {/* Genetic relatives */}
        {relatives.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3">
              Genetic Relatives
            </h2>
            <p className="text-xs text-surface-500 mb-3">
              Laws in <span className="text-surface-300">{law.category}</span> with similar founding argument patterns.
            </p>
            <div className="space-y-3">
              {relatives.map((rel) => (
                <RelativeCard key={rel.id} rel={rel} />
              ))}
            </div>
          </div>
        )}

        {/* Explore more */}
        <div className="border-t border-surface-300/30 pt-6">
          <p className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-3">Explore More</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: `/law/${id}/arguments`, label: 'Founding Arguments' },
              { href: `/law/${id}/archetypes`, label: 'Voter Archetypes' },
              { href: `/law/${id}/sentiment`, label: 'Sentiment Analysis' },
              { href: `/law/${id}/themes`, label: 'Themes' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/60 hover:bg-surface-300/60 border border-surface-300/60 text-xs font-mono text-surface-300 hover:text-white transition-colors"
              >
                {label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
