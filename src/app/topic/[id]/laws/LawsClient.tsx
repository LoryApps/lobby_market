'use client'

/**
 * /topic/[id]/laws — Related Established Laws
 *
 * Shows what laws already exist on the platform that relate to this topic,
 * grouped into two sections:
 *   1. Same Category — laws sharing the exact same policy category
 *   2. Keyword Related — laws with overlapping civic language/themes
 *
 * Helps voters understand the existing legal framework around a topic before
 * casting their vote. Distinct from:
 *   /topic/[id]/similar  — other active TOPICS (not laws) with similar debates
 *   /law/[id]/parallels  — laws linked to a specific law
 *   /topic/[id]/context  — general background context for the topic
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Globe,
  Hash,
  Layers,
  Search,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { TopicMeta, RelatedLaw } from './page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/25'        },
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/25'     },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',      border: 'border-purple/25'      },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/25'     },
  Ethics:      { text: 'text-against-400',  bg: 'bg-against-500/10', border: 'border-against-500/25' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',      border: 'border-purple/25'      },
  Culture:     { text: 'text-gold',         bg: 'bg-gold/10',        border: 'border-gold/25'        },
  Health:      { text: 'text-against-300',  bg: 'bg-against-400/10', border: 'border-against-400/25' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/25'     },
  Education:   { text: 'text-for-300',      bg: 'bg-for-400/10',     border: 'border-for-400/25'     },
}

function catStyle(cat: string | null) {
  if (!cat) return { text: 'text-surface-400', bg: 'bg-surface-400/10', border: 'border-surface-400/20' }
  return CATEGORY_COLORS[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-400/10', border: 'border-surface-400/20' }
}

// ─── Consensus bar ────────────────────────────────────────────────────────────

function ConsensusBar({ pct }: { pct: number }) {
  const forPct = Math.round(pct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="text-for-400">FOR {forPct}%</span>
        <span className="text-against-400">AGN {againstPct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-surface-400/20 flex">
        <div
          className="h-full bg-for-500 rounded-l-full"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="h-full bg-against-500 flex-1 rounded-r-full"
        />
      </div>
    </div>
  )
}

// ─── Law Card ─────────────────────────────────────────────────────────────────

function LawCard({ law, highlight }: { law: RelatedLaw; highlight?: boolean }) {
  const c = catStyle(law.category)
  const forPct = Math.round(law.blue_pct ?? 50)
  const winSide = forPct >= 50 ? 'FOR' : 'AGAINST'
  const winPct = forPct >= 50 ? forPct : 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Link href={`/law/${law.id}`} className="group block">
        <div className={cn(
          'p-4 rounded-xl border transition-all duration-200',
          highlight
            ? 'bg-emerald/[0.04] border-emerald/30 hover:border-emerald/50 hover:bg-emerald/[0.07]'
            : 'bg-surface-200/40 border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/70'
        )}>
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className={cn(
                'flex items-center justify-center h-7 w-7 rounded-lg',
                'bg-emerald/10 border border-emerald/25'
              )}>
                <Gavel className="h-3.5 w-3.5 text-emerald" />
              </div>
            </div>
            <p className="flex-1 text-sm font-mono text-white/90 leading-snug group-hover:text-white transition-colors line-clamp-2">
              {law.statement}
            </p>
            <div className="flex-shrink-0 text-right">
              <div className={cn(
                'text-xs font-mono font-bold',
                winSide === 'FOR' ? 'text-for-400' : 'text-against-400'
              )}>
                {winPct}%
              </div>
              <div className="text-[9px] font-mono text-surface-500 uppercase">{winSide}</div>
            </div>
          </div>

          {/* Consensus bar */}
          <div className="mb-3 px-0">
            <ConsensusBar pct={forPct} />
          </div>

          {/* Footer row */}
          <div className="flex items-center gap-2 flex-wrap">
            {law.category && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                c.bg, c.text, c.border
              )}>
                <Layers className="h-2.5 w-2.5" />
                {law.category}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-surface-500 font-mono">
              <Users className="h-2.5 w-2.5" />
              {formatVotes(law.total_votes)} votes
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-surface-500 font-mono">
              <Calendar className="h-2.5 w-2.5" />
              {formatDate(law.established_at)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({
  icon: Icon,
  title,
  subtitle,
  count,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn(
        'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
        `${color}/10 border ${color}/25`
      )}>
        <Icon className={cn('h-4 w-4', color.replace('bg-', 'text-').replace('/10', ''))} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-sm font-bold text-white">{title}</h2>
          <span className="text-[10px] font-mono text-surface-500 bg-surface-300/50 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        <p className="text-[11px] text-surface-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topic: TopicMeta
  sameCategoryLaws: RelatedLaw[]
  keywordLaws: RelatedLaw[]
}

export function LawsClient({ topicId, topic, sameCategoryLaws, keywordLaws }: Props) {
  const [query, setQuery] = useState('')

  const totalLaws = sameCategoryLaws.length + keywordLaws.length

  // Client-side search filter
  const filteredSameCat = useMemo(() => {
    if (!query.trim()) return sameCategoryLaws
    const q = query.toLowerCase()
    return sameCategoryLaws.filter(
      (l) =>
        l.statement.toLowerCase().includes(q) ||
        (l.full_statement ?? '').toLowerCase().includes(q)
    )
  }, [sameCategoryLaws, query])

  const filteredKeyword = useMemo(() => {
    if (!query.trim()) return keywordLaws
    const q = query.toLowerCase()
    return keywordLaws.filter(
      (l) =>
        l.statement.toLowerCase().includes(q) ||
        (l.full_statement ?? '').toLowerCase().includes(q)
    )
  }, [keywordLaws, query])

  const forPct = Math.round(topic.blue_pct ?? 50)

  const statusConfig: Record<string, { label: string; cls: string }> = {
    law:      { label: 'Law',      cls: 'bg-gold/10 text-gold border-gold/25' },
    failed:   { label: 'Failed',   cls: 'bg-surface-600/40 text-surface-400 border-surface-500/20' },
    voting:   { label: 'Voting',   cls: 'bg-for-500/10 text-for-400 border-for-500/20' },
    proposed: { label: 'Proposed', cls: 'bg-surface-400/15 text-surface-400 border-surface-400/20' },
    active:   { label: 'Active',   cls: 'bg-emerald/10 text-emerald border-emerald/20' },
  }
  const st = statusConfig[topic.status] ?? statusConfig.active

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">

        {/* ── Back nav ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            aria-label="Back to topic"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors'
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <BookOpen className="h-4 w-4 text-emerald flex-shrink-0" aria-hidden="true" />
              <h1 className="font-mono text-xl font-bold text-white truncate">
                Related Laws
              </h1>
              {totalLaws > 0 && (
                <span className="font-mono text-xs text-emerald bg-emerald/10 border border-emerald/25 px-2 py-0.5 rounded-full flex-shrink-0">
                  {totalLaws} found
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 font-mono truncate">
              {topic.category ? `${topic.category} · ` : ''}Established Laws · The Codex
            </p>
          </div>
        </div>

        {/* ── Topic context pill ─────────────────────────────────────────── */}
        <div className={cn(
          'mb-6 p-4 rounded-xl border bg-surface-200/60 border-surface-300/60'
        )}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-white/90 leading-snug line-clamp-2 mb-2">
                {topic.statement}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  'inline-flex items-center text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                  st.cls
                )}>
                  {st.label}
                </span>
                {topic.category && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-400 bg-surface-300/40 border border-surface-400/20 px-2 py-0.5 rounded-full">
                    <Layers className="h-2.5 w-2.5" />
                    {topic.category}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
                  <Users className="h-2.5 w-2.5" />
                  {formatVotes(topic.total_votes)} votes
                </span>
                <span className={cn(
                  'ml-auto text-[11px] font-mono font-bold',
                  forPct >= 60 ? 'text-for-400' : forPct <= 40 ? 'text-against-400' : 'text-surface-400'
                )}>
                  {forPct}% FOR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search ────────────────────────────────────────────────────── */}
        {totalLaws > 4 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter laws…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                'w-full pl-9 pr-4 py-2.5 rounded-xl font-mono text-sm',
                'bg-surface-200/60 border border-surface-300/60',
                'text-white placeholder-surface-500',
                'focus:outline-none focus:border-emerald/50 focus:bg-surface-200',
                'transition-colors'
              )}
            />
          </div>
        )}

        {/* ── No results at all ─────────────────────────────────────────── */}
        {totalLaws === 0 && (
          <EmptyState
            icon={Gavel}
            title="No related laws yet"
            description={
              topic.category
                ? `No established laws exist in the ${topic.category} category yet. This topic could be the first.`
                : 'No established laws share themes with this topic yet. Cast your vote and help build the Codex.'
            }
            action={
              <Link
                href="/law"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-emerald/10 border border-emerald/30 text-emerald text-xs font-mono font-semibold',
                  'hover:bg-emerald/20 hover:border-emerald/50 transition-colors'
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Browse the Codex
              </Link>
            }
          />
        )}

        {/* ── Same Category Laws ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {filteredSameCat.length > 0 && (
            <motion.section
              key="same-cat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              <SectionHead
                icon={Layers}
                title={`${topic.category ?? 'Same Category'} Laws`}
                subtitle="Established laws in the same policy category as this topic"
                count={filteredSameCat.length}
                color="bg-emerald"
              />
              <div className="space-y-3">
                {filteredSameCat.map((law) => (
                  <LawCard key={law.id} law={law} highlight />
                ))}
              </div>

              {filteredSameCat.length === 0 && query && (
                <div className="text-center py-8 text-surface-500 text-sm font-mono">
                  No category laws match "{query}"
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Keyword Related Laws ───────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {filteredKeyword.length > 0 && (
            <motion.section
              key="keyword"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              <SectionHead
                icon={Hash}
                title="Thematically Related"
                subtitle="Laws sharing key civic language and themes with this topic"
                count={filteredKeyword.length}
                color="bg-purple"
              />
              <div className="space-y-3">
                {filteredKeyword.map((law) => (
                  <LawCard key={law.id} law={law} />
                ))}
              </div>

              {filteredKeyword.length === 0 && query && (
                <div className="text-center py-8 text-surface-500 text-sm font-mono">
                  No thematic laws match "{query}"
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Browse all laws CTA ────────────────────────────────────────── */}
        {totalLaws > 0 && (
          <div className="border-t border-surface-300/40 pt-6 mt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div>
                <p className="text-sm font-mono text-surface-400">
                  Explore the full Law Codex
                </p>
                <p className="text-[11px] text-surface-600 font-mono mt-0.5">
                  {topic.category
                    ? `Browse all ${topic.category} laws and every established consensus.`
                    : 'Browse every law established by community consensus.'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {topic.category && (
                  <Link
                    href={`/law/categories#${encodeURIComponent(topic.category.toLowerCase())}`}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold',
                      'bg-emerald/10 border border-emerald/30 text-emerald',
                      'hover:bg-emerald/20 hover:border-emerald/50 transition-colors'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {topic.category}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
                <Link
                  href="/law"
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold',
                    'bg-surface-300/50 border border-surface-400/30 text-surface-300',
                    'hover:bg-surface-300/70 hover:text-white transition-colors'
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Full Codex
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        {totalLaws > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 text-center">
              <div className="text-lg font-mono font-bold text-white">{totalLaws}</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">Related Laws</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 text-center">
              <div className="text-lg font-mono font-bold text-emerald">{sameCategoryLaws.length}</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">Same Category</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 text-center">
              <div className="text-lg font-mono font-bold text-purple">{keywordLaws.length}</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">Thematic</div>
            </div>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
