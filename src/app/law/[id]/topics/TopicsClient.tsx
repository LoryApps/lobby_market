'use client'

/**
 * /law/[id]/topics — Active Debates Related to This Law
 *
 * The reverse of /topic/[id]/laws: given an established law, shows what
 * citizens are CURRENTLY DEBATING that relates to this legislation.
 *
 * Groups:
 *   1. Same Category — active/proposed/voting topics in the same policy area
 *   2. Keyword Related — topics with overlapping civic language
 *
 * Helps citizens understand how existing law is being re-examined and what
 * future legislation is being considered in this area.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Clock,
  ChevronRight,
  FileText,
  Flame,
  Gavel,
  Hash,
  Layers,
  MessageSquare,
  Search,
  Scale,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { LawMeta, RelatedTopic } from './page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  const months = Math.floor(d / 30)
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`
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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string
  icon: typeof Zap
  color: string
  bg: string
  border: string
}> = {
  proposed: { label: 'Proposed', icon: FileText,     color: 'text-surface-500', bg: 'bg-surface-400/10',  border: 'border-surface-400/30'  },
  active:   { label: 'Active',   icon: Zap,          color: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30'      },
  voting:   { label: 'Voting',   icon: Vote,         color: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30'       },
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
        <div className="h-full bg-against-500 flex-1 rounded-r-full" />
      </div>
    </div>
  )
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, highlight }: { topic: RelatedTopic; highlight?: boolean }) {
  const c = catStyle(topic.category)
  const forPct = Math.round(topic.blue_pct ?? 50)
  const sc = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const StatusIcon = sc.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Link href={`/topic/${topic.id}`} className="group block">
        <div className={cn(
          'p-4 rounded-xl border transition-all duration-200',
          highlight
            ? 'bg-for-500/[0.04] border-for-500/30 hover:border-for-500/50 hover:bg-for-500/[0.07]'
            : 'bg-surface-200/40 border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/70'
        )}>
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className={cn(
                'flex items-center justify-center h-7 w-7 rounded-lg',
                sc.bg, `border ${sc.border}`
              )}>
                <StatusIcon className={cn('h-3.5 w-3.5', sc.color)} />
              </div>
            </div>
            <p className="flex-1 text-sm font-mono text-white/90 leading-snug group-hover:text-white transition-colors line-clamp-2">
              {topic.statement}
            </p>
            <div className="flex-shrink-0 text-right">
              <div className={cn(
                'text-xs font-mono font-bold',
                forPct >= 50 ? 'text-for-400' : 'text-against-400'
              )}>
                {forPct >= 50 ? forPct : 100 - forPct}%
              </div>
              <div className="text-[9px] font-mono text-surface-500 uppercase">
                {forPct >= 50 ? 'FOR' : 'AGN'}
              </div>
            </div>
          </div>

          {/* Consensus bar */}
          <div className="mb-3">
            <ConsensusBar pct={forPct} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {topic.category && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
                  c.bg, c.text, c.border
                )}>
                  <Hash className="h-2.5 w-2.5" />
                  {topic.category}
                </span>
              )}
              <span className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
                sc.bg, sc.color, sc.border
              )}>
                <StatusIcon className="h-2.5 w-2.5" />
                {sc.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                {formatVotes(topic.total_votes)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {relativeTime(topic.created_at)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Search filter ────────────────────────────────────────────────────────────

function useFiltered(topics: RelatedTopic[], query: string) {
  return useMemo(() => {
    if (!query.trim()) return topics
    const q = query.toLowerCase()
    return topics.filter((t) => t.statement.toLowerCase().includes(q))
  }, [topics, query])
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  topics,
  highlight,
  emptyTitle,
  emptyBody,
}: {
  title: string
  icon: typeof Layers
  topics: RelatedTopic[]
  highlight?: boolean
  emptyTitle: string
  emptyBody: string
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 w-full mb-3 group"
        aria-expanded={expanded}
      >
        <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
        <span className="text-xs font-mono font-semibold text-surface-500 group-hover:text-white transition-colors uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs font-mono text-surface-600 ml-1">({topics.length})</span>
        <ChevronRight className={cn(
          'h-3.5 w-3.5 text-surface-600 ml-auto transition-transform',
          expanded && 'rotate-90'
        )} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {topics.length === 0 ? (
              <EmptyState title={emptyTitle} body={emptyBody} className="py-6" />
            ) : (
              <div className="grid gap-3">
                {topics.map((t) => (
                  <TopicCard key={t.id} topic={t} highlight={highlight} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  law: LawMeta
  sameCategoryTopics: RelatedTopic[]
  keywordTopics: RelatedTopic[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TopicsClient({ lawId, law, sameCategoryTopics, keywordTopics }: Props) {
  const [query, setQuery] = useState('')

  const filteredSameCat = useFiltered(sameCategoryTopics, query)
  const filteredKeyword = useFiltered(keywordTopics, query)

  const totalCount = sameCategoryTopics.length + keywordTopics.length
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back + breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to law
          </Link>
          <span className="text-surface-600 text-xs">/</span>
          <span className="text-xs font-mono text-surface-500">Active Debates</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
              <MessageSquare className="h-4.5 w-4.5 text-for-400" />
            </div>
            <div>
              <h1 className="text-base font-mono font-bold text-white">Active Debates</h1>
              <p className="text-xs font-mono text-surface-500">Live topics related to this law</p>
            </div>
          </div>

          {/* Law summary chip */}
          <Link
            href={`/law/${lawId}`}
            className="group block p-3 rounded-xl bg-emerald/[0.05] border border-emerald/25 hover:border-emerald/45 transition-colors"
          >
            <div className="flex items-start gap-2">
              <Gavel className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-white/80 leading-snug group-hover:text-white transition-colors line-clamp-2">
                {law.statement}
              </p>
              <div className="flex-shrink-0 text-right ml-auto">
                <div className={cn(
                  'text-[11px] font-mono font-bold',
                  forPct >= 50 ? 'text-for-400' : 'text-against-400'
                )}>
                  {forPct}% FOR
                </div>
                <div className="text-[9px] font-mono text-emerald">ESTABLISHED LAW</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Same Category', value: sameCategoryTopics.length, icon: Layers },
            { label: 'Keyword Match', value: keywordTopics.length, icon: Hash },
            { label: 'Total Debates', value: totalCount, icon: BarChart2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-3 rounded-xl bg-surface-100 border border-surface-300 text-center">
              <Icon className="h-3.5 w-3.5 text-surface-500 mx-auto mb-1" />
              <div className="text-lg font-mono font-bold text-white">{value}</div>
              <div className="text-[10px] font-mono text-surface-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter debates…"
            className={cn(
              'w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-mono',
              'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-600',
              'focus:outline-none focus:border-for-500/50 focus:bg-surface-300/50 transition-colors'
            )}
          />
        </div>

        {/* Content */}
        {totalCount === 0 ? (
          <EmptyState
            title="No active debates found"
            body="There are currently no proposed, active, or voting topics related to this law. Check back later or browse the full topic feed."
            action={{ label: 'Browse All Topics', href: '/topics' }}
          />
        ) : (
          <div className="space-y-8">
            <Section
              title="Same Category"
              icon={Layers}
              topics={filteredSameCat}
              highlight
              emptyTitle="No category matches"
              emptyBody="No active topics share this law's exact policy category."
            />
            {keywordTopics.length > 0 && (
              <Section
                title="Keyword Related"
                icon={Hash}
                topics={filteredKeyword}
                emptyTitle="No keyword matches"
                emptyBody="No additional topics match the language used in this law."
              />
            )}
          </div>
        )}

        {/* Footer actions */}
        {totalCount > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-mono text-surface-500">
              {totalCount} active debate{totalCount !== 1 ? 's' : ''} found ·{' '}
              {law.category ? `${law.category} category` : 'cross-category'}
            </p>
            <div className="flex items-center gap-3">
              <Link
                href={`/law/${lawId}/similar`}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                  'bg-surface-200 border border-surface-300 text-surface-500',
                  'hover:bg-surface-300 hover:border-surface-400 hover:text-white transition-colors'
                )}
              >
                <Scale className="h-3 w-3" />
                Similar Laws
              </Link>
              <Link
                href={`/topic/create`}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                  'bg-for-600/20 border border-for-600/40 text-for-400',
                  'hover:bg-for-600/30 hover:border-for-500/60 hover:text-for-300 transition-colors'
                )}
              >
                <Flame className="h-3 w-3" />
                Propose a Topic
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
