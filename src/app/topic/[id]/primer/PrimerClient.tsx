'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Globe,
  HelpCircle,
  Lightbulb,
  Scale,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Argument {
  id: string
  content: string
  side: string
  upvotes: number
}

interface Source {
  id: string
  url: string
  title: string
  description: string | null
  domain: string | null
}

interface PrimerClientProps {
  topicId: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: string
  bluePct: number
  totalVotes: number
  createdAt: string
  topForArg: Argument | null
  topAgainstArg: Argument | null
  sources: Source[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
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

function ArgumentCard({ arg, side }: { arg: Argument; side: 'for' | 'against' }) {
  const isFor = side === 'for'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-3',
        isFor ? 'border-for-500/40 bg-for-500/5' : 'border-against-500/40 bg-against-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0',
            isFor ? 'bg-for-500/20' : 'bg-against-500/20',
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
          )}
        </div>
        <span
          className={cn(
            'font-mono text-xs font-bold uppercase tracking-widest',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
        >
          {isFor ? 'Strongest Case FOR' : 'Strongest Case AGAINST'}
        </span>
        {arg.upvotes > 0 && (
          <span
            className={cn(
              'ml-auto font-mono text-[10px]',
              isFor ? 'text-for-600' : 'text-against-600',
            )}
          >
            ↑ {arg.upvotes.toLocaleString()}
          </span>
        )}
      </div>
      <p className="font-mono text-sm text-surface-200 leading-relaxed">{arg.content}</p>
    </motion.div>
  )
}

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all group"
    >
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300 flex-shrink-0 mt-0.5">
        <Globe className="h-3.5 w-3.5 text-surface-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-semibold text-surface-200 group-hover:text-white transition-colors truncate">
          {source.title}
        </p>
        {source.domain && (
          <p className="font-mono text-[10px] text-surface-500 mt-0.5">{source.domain}</p>
        )}
        {source.description && (
          <p className="font-mono text-[10px] text-surface-600 mt-1 line-clamp-2 leading-relaxed">
            {source.description}
          </p>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-0.5 transition-colors" />
    </a>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PrimerClient({
  topicId,
  statement,
  description,
  category,
  scope,
  status,
  bluePct,
  totalVotes,
  topForArg,
  topAgainstArg,
  sources,
}: PrimerClientProps) {
  const statusLabel = STATUS_LABEL[status] ?? status
  const badgeVariant = STATUS_BADGE[status] ?? 'proposed'
  const forPct = Math.round(bluePct)
  const communityLeans: 'FOR' | 'AGAINST' | 'split' =
    forPct >= 60 ? 'FOR' : forPct <= 40 ? 'AGAINST' : 'split'

  return (
    <div className="space-y-5">
      {/* Topic header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
          {category && <Badge variant="category">{category}</Badge>}
          {scope && scope !== 'Global' && <Badge variant="neutral">{scope}</Badge>}
        </div>
        <h1 className="font-mono text-xl font-bold text-white leading-snug">{statement}</h1>
      </motion.div>

      {/* What is this about? */}
      {description && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-for-500/10 flex-shrink-0">
              <HelpCircle className="h-3.5 w-3.5 text-for-400" />
            </div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-for-400">
              What Is This About?
            </span>
          </div>
          <p className="font-mono text-sm text-surface-300 leading-relaxed">{description}</p>
        </motion.div>
      )}

      {/* Community stance */}
      {totalVotes > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 flex-shrink-0">
              <Scale className="h-3.5 w-3.5 text-surface-400" />
            </div>
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-surface-300">
                Where the Community Stands
              </span>
              {communityLeans !== 'split' && (
                <p className="font-mono text-[10px] text-surface-500 mt-0.5">
                  Community leans{' '}
                  <span
                    className={communityLeans === 'FOR' ? 'text-for-400' : 'text-against-400'}
                  >
                    {communityLeans}
                  </span>
                </p>
              )}
            </div>
          </div>
          <VoteBar bluePct={bluePct} totalVotes={totalVotes} />
        </motion.div>
      )}

      {/* Arguments */}
      {(topForArg || topAgainstArg) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 flex-shrink-0">
              <Lightbulb className="h-3.5 w-3.5 text-gold" />
            </div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-surface-300">
              The Key Arguments
            </span>
          </div>
          {topForArg && <ArgumentCard arg={topForArg} side="for" />}
          {topAgainstArg && <ArgumentCard arg={topAgainstArg} side="against" />}
        </motion.div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 flex-shrink-0">
              <BookOpen className="h-3.5 w-3.5 text-surface-400" />
            </div>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-surface-300">
              Learn More
            </span>
          </div>
          <div className="space-y-2">
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </motion.div>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
      >
        <p className="font-mono text-sm font-semibold text-white text-center">
          Ready to take a stance?
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-mono text-sm font-semibold bg-for-600 hover:bg-for-500 text-white transition-all flex-1"
          >
            Cast Your Vote
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/topic/${topicId}/brief`}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-mono text-sm font-semibold border border-surface-400 text-surface-300 hover:text-white hover:border-surface-300 transition-all"
          >
            Read Full Brief
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>

      {/* Explore more */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 gap-2"
      >
        {[
          { href: `/topic/${topicId}/arguments`, label: 'All Arguments', desc: 'Full debate feed' },
          { href: `/topic/${topicId}/steelman`, label: 'Steelman', desc: 'Best of both sides' },
          { href: `/topic/${topicId}/sources`, label: 'Sources', desc: 'Research & evidence' },
          { href: `/topic/${topicId}/stats`, label: 'Stats', desc: 'Voting analytics' },
        ].map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all"
          >
            <div>
              <p className="font-mono text-xs font-semibold text-surface-200">{label}</p>
              <p className="font-mono text-[10px] text-surface-500">{desc}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0" />
          </Link>
        ))}
      </motion.div>
    </div>
  )
}
