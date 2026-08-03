'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Gavel,
  Globe,
  Quote,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Argument {
  id: string
  content: string
  upvotes: number
}

interface Source {
  id: string
  url: string
  title: string
  description: string | null
  domain: string | null
}

interface OriginalTopic {
  id: string
  statement: string
  status: string
}

interface LawPrimerClientProps {
  lawId: string
  statement: string
  fullStatement: string | null
  bodyMarkdown: string | null
  category: string | null
  establishedAt: string
  bluePct: number
  totalVotes: number
  topForArg: Argument | null
  topAgainstArg: Argument | null
  sources: Source[]
  originalTopic: OriginalTopic | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct, totalVotes }: { bluePct: number; totalVotes: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2.5">
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-y-0 right-0 bg-against-600 rounded-r-full"
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs">
        <div className="text-center">
          <p className="text-for-400 font-bold text-sm">{forPct}%</p>
          <p className="text-for-500 text-[10px] uppercase tracking-wider">FOR</p>
        </div>
        <p className="text-surface-500 text-[10px]">{totalVotes.toLocaleString()} votes cast</p>
        <div className="text-center">
          <p className="text-against-400 font-bold text-sm">{againstPct}%</p>
          <p className="text-against-500 text-[10px] uppercase tracking-wider">AGAINST</p>
        </div>
      </div>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
}: {
  arg: Argument
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      <div className="flex items-center gap-2">
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-widest',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'Top FOR Argument' : 'Top AGAINST Argument'}
        </span>
        <div className="ml-auto flex items-center gap-1 text-surface-500 text-[10px] font-mono">
          <TrendingUp className="h-3 w-3" />
          {arg.upvotes.toLocaleString()}
        </div>
      </div>
      <Quote className={cn('h-4 w-4', isFor ? 'text-for-500/40' : 'text-against-500/40')} />
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-4">{arg.content}</p>
    </motion.div>
  )
}

// ─── Source Item ──────────────────────────────────────────────────────────────

function SourceItem({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
    >
      <Globe className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate group-hover:text-for-300 transition-colors">
          {source.title}
        </p>
        {source.domain && (
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">{source.domain}</p>
        )}
        {source.description && (
          <p className="text-[10px] text-surface-600 mt-1 line-clamp-2">{source.description}</p>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-for-400 transition-colors" />
    </a>
  )
}

// ─── What Does This Law Mean? ─────────────────────────────────────────────────

function LawSummarySection({
  statement,
  fullStatement,
  bodyMarkdown,
}: {
  statement: string
  fullStatement: string | null
  bodyMarkdown: string | null
}) {
  const preview = bodyMarkdown
    ? bodyMarkdown
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
        .slice(0, 400)
    : null

  return (
    <div className="rounded-2xl bg-surface-100 border border-gold/20 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-gold" />
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-gold">
          What This Law Says
        </h2>
      </div>

      <div>
        <p className="text-base font-semibold text-white leading-snug">{statement}</p>
        {fullStatement && fullStatement !== statement && (
          <p className="text-sm text-surface-600 mt-2 leading-relaxed">{fullStatement}</p>
        )}
      </div>

      {preview && (
        <div className="border-t border-surface-300 pt-4">
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
            From the law text
          </p>
          <p className="text-sm text-surface-600 leading-relaxed">
            {preview}
            {bodyMarkdown && bodyMarkdown.length > 400 ? '…' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Key Facts ────────────────────────────────────────────────────────────────

function KeyFactsSection({
  category,
  establishedAt,
  bluePct,
  totalVotes,
}: {
  category: string | null
  establishedAt: string
  bluePct: number
  totalVotes: number
}) {
  const forPct = Math.round(bluePct)
  const margin = Math.abs(forPct - 50)

  const facts = [
    {
      icon: Calendar,
      label: 'Established',
      value: formatDate(establishedAt),
    },
    {
      icon: Users,
      label: 'Total Votes',
      value: totalVotes.toLocaleString(),
    },
    {
      icon: CheckCircle2,
      label: 'Passed By',
      value: `${forPct}% FOR (${margin.toFixed(0)}pt margin)`,
    },
    ...(category ? [{ icon: BookOpen, label: 'Category', value: category }] : []),
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-surface-500">
        Key Facts
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3 w-3 text-surface-500" />
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                {label}
              </p>
            </div>
            <p className="text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LawPrimerClient({
  lawId,
  statement,
  fullStatement,
  bodyMarkdown,
  category,
  establishedAt,
  bluePct,
  totalVotes,
  topForArg,
  topAgainstArg,
  sources,
  originalTopic,
}: LawPrimerClientProps) {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-surface-100 border border-gold/30 p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Gavel className="h-4 w-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <Badge variant="law" size="sm">Established Law</Badge>
            <h1 className="mt-2 text-base font-semibold text-white leading-snug line-clamp-3">
              {statement}
            </h1>
          </div>
        </div>

        <VoteBar bluePct={bluePct} totalVotes={totalVotes} />
      </motion.div>

      {/* What this law says */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <LawSummarySection
          statement={statement}
          fullStatement={fullStatement}
          bodyMarkdown={bodyMarkdown}
        />
      </motion.div>

      {/* Key facts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <KeyFactsSection
          category={category}
          establishedAt={establishedAt}
          bluePct={bluePct}
          totalVotes={totalVotes}
        />
      </motion.div>

      {/* Arguments */}
      {(topForArg || topAgainstArg) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-surface-500">
            Strongest Arguments
          </h2>
          <p className="text-[11px] text-surface-500">
            The highest-upvoted FOR and AGAINST arguments from the original debate.
          </p>
          {topForArg && <ArgumentCard arg={topForArg} side="for" />}
          {topAgainstArg && <ArgumentCard arg={topAgainstArg} side="against" />}
        </motion.div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-surface-500">
            Reference Sources
          </h2>
          {sources.map((s) => (
            <SourceItem key={s.id} source={s} />
          ))}
        </motion.div>
      )}

      {/* Explore deeper */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
      >
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-surface-500">
          Go Deeper
        </h2>
        <div className="space-y-2">
          {[
            { href: `/law/${lawId}/arguments`, label: 'All founding arguments', desc: 'Every FOR and AGAINST argument' },
            { href: `/law/${lawId}/fault-lines`, label: 'Debate fault lines', desc: 'Flashpoints, contested ground & first movers' },
            { href: `/law/${lawId}/wiki`, label: 'Community wiki', desc: 'Context, history and impact' },
            { href: `/law/${lawId}/breakdown`, label: 'Voter breakdown', desc: 'Who voted for this and why' },
            { href: `/law/${lawId}/impact`, label: 'Law impact', desc: 'What changed after it passed' },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-surface-500 mt-0.5">{desc}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-for-400 transition-colors" />
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Original topic link */}
      {originalTopic && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href={`/topic/${originalTopic.id}`}
            className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                Original Topic Debate
              </p>
              <p className="text-sm font-mono text-white group-hover:text-for-400 transition-colors truncate">
                {originalTopic.statement}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-500 flex-shrink-0 group-hover:text-for-400 transition-colors" />
          </Link>
        </motion.div>
      )}
    </div>
  )
}
