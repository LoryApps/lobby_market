'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  Calendar,
  ChevronRight,
  FileText,
  Globe,
  Scale,
  Shield,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Arg {
  id: string
  content: string
  upvotes: number
  createdAt: string
}

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
  scope: string | null
  description: string | null
  createdAt: string | null
  updatedAt: string | null
  forArgs: Arg[]
  againstArgs: Arg[]
  totalArgs: number
  recentArgs: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncate(text: string, chars: number) {
  if (text.length <= chars) return text
  return text.slice(0, chars).trimEnd() + '…'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({
  num,
  title,
  color = 'text-surface-500',
}: {
  num: string
  title: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-mono font-bold text-surface-600 flex-shrink-0">{num}</span>
      <div className="h-px flex-1 bg-surface-300/50" />
      <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', color)}>
        {title}
      </span>
    </div>
  )
}

function VoteBar({ forPct, totalVotes }: { forPct: number; totalVotes: number }) {
  const againstPct = 100 - forPct
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-for-400 font-bold">{forPct}% FOR</span>
        <span className="text-surface-600">{totalVotes.toLocaleString()} votes</span>
        <span className="text-against-400 font-bold">{againstPct}% AGAINST</span>
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden bg-surface-300 flex">
        <motion.div
          className="h-full bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
        <motion.div
          className="h-full bg-against-500"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

function ArgRow({ arg, side, rank }: { arg: Arg; side: 'for' | 'against'; rank: number }) {
  const isFor = side === 'for'
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-surface-300/40 last:border-0">
      <span
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-mono font-bold mt-0.5',
          isFor
            ? 'bg-for-600/20 text-for-400 border border-for-600/30'
            : 'bg-against-600/20 text-against-400 border border-against-600/30',
        )}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-surface-400 leading-relaxed line-clamp-2">{arg.content}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <ThumbsUp className="h-2.5 w-2.5 text-surface-600" />
          <span className="text-[10px] font-mono text-surface-600">{arg.upvotes}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DossierClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
  scope,
  description,
  createdAt,
  updatedAt,
  forArgs,
  againstArgs,
  totalArgs,
  recentArgs,
}: Props) {
  const forPct = Math.round(bluePct)
  const topicUrl = `https://lobby.market/topic/${topicId}/dossier`
  const fileRef = topicId.slice(0, 8).toUpperCase()

  const ANALYSIS_LINKS = [
    { href: `/topic/${topicId}/brief`, label: 'AI Brief', icon: Brain, color: 'text-purple' },
    { href: `/topic/${topicId}/intelligence`, label: 'Intelligence', icon: Zap, color: 'text-gold' },
    { href: `/topic/${topicId}/scorecard`, label: 'Report Card', icon: BarChart2, color: 'text-for-400' },
    { href: `/topic/${topicId}/voters`, label: 'Voters', icon: Users, color: 'text-emerald' },
    { href: `/topic/${topicId}/arguments`, label: 'Arguments', icon: Scale, color: 'text-surface-400' },
    { href: `/topic/${topicId}/explore`, label: 'All Tools', icon: ChevronRight, color: 'text-surface-500' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        {/* ── Nav ── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
          <SharePanel
            url={topicUrl}
            text={`Civic Dossier: ${statement.slice(0, 80)}`}
            topicId={topicId}
          />
        </div>

        {/* ── Dossier header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 md:p-6 mb-4"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300">
                <FileText className="h-4 w-4 text-surface-500" />
              </div>
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-surface-600">
                  Civic Dossier
                </p>
                <p className="text-[8px] font-mono text-surface-700 mt-0.5">FILE #{fileRef}</p>
              </div>
            </div>
            <Badge variant={STATUS_BADGE[status] ?? 'proposed'} size="sm">
              {STATUS_LABEL[status] ?? status}
            </Badge>
          </div>

          <h1 className="text-xl md:text-2xl font-mono font-bold text-white leading-snug mb-4">
            {statement}
          </h1>

          <div className="flex flex-wrap gap-1.5">
            {category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-200 border border-surface-300 text-surface-500">
                <FileText className="h-2.5 w-2.5" />
                {category}
              </span>
            )}
            {scope && scope !== 'Global' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-200 border border-surface-300 text-surface-500">
                <Globe className="h-2.5 w-2.5" />
                {scope}
              </span>
            )}
            {createdAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-200 border border-surface-300 text-surface-500">
                <Calendar className="h-2.5 w-2.5" />
                {fmtDate(createdAt)}
              </span>
            )}
            {updatedAt && updatedAt !== createdAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-200 border border-surface-300 text-surface-500">
                <TrendingUp className="h-2.5 w-2.5" />
                Updated {fmtDate(updatedAt)}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Voting record ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4"
        >
          <SectionLabel num="§ 01" title="Voting Record" />
          <VoteBar forPct={forPct} totalVotes={totalVotes} />
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center p-2.5 rounded-lg bg-for-600/10 border border-for-600/20">
              <p className="text-lg font-mono font-bold text-for-400">{forPct}%</p>
              <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest mt-0.5">
                For
              </p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-surface-200 border border-surface-300">
              <p className="text-lg font-mono font-bold text-white">{totalVotes.toLocaleString()}</p>
              <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest mt-0.5">
                Total
              </p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-against-600/10 border border-against-600/20">
              <p className="text-lg font-mono font-bold text-against-400">{100 - forPct}%</p>
              <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest mt-0.5">
                Against
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Arguments ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"
        >
          <div className="rounded-2xl bg-surface-100 border border-for-600/20 p-4">
            <SectionLabel num="§ 02" title="Case For" color="text-for-400" />
            {forArgs.length > 0 ? (
              <div>
                {forArgs.map((arg, i) => (
                  <ArgRow key={arg.id} arg={arg} side="for" rank={i + 1} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] font-mono text-surface-600 py-3">
                No FOR arguments on record.
              </p>
            )}
            <Link
              href={`/topic/${topicId}/arguments?side=for`}
              className="inline-flex items-center gap-1 mt-2 text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-2xl bg-surface-100 border border-against-600/20 p-4">
            <SectionLabel num="§ 03" title="Case Against" color="text-against-400" />
            {againstArgs.length > 0 ? (
              <div>
                {againstArgs.map((arg, i) => (
                  <ArgRow key={arg.id} arg={arg} side="against" rank={i + 1} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] font-mono text-surface-600 py-3">
                No AGAINST arguments on record.
              </p>
            )}
            <Link
              href={`/topic/${topicId}/arguments?side=against`}
              className="inline-flex items-center gap-1 mt-2 text-[10px] font-mono text-against-400 hover:text-against-300 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>

        {/* ── Engagement stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4"
        >
          <SectionLabel num="§ 04" title="Engagement Record" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface-200/60">
              <Users className="h-4 w-4 text-emerald" />
              <p className="text-base font-mono font-bold text-white mt-1">
                {totalVotes.toLocaleString()}
              </p>
              <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest">Voters</p>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface-200/60">
              <Shield className="h-4 w-4 text-for-400" />
              <p className="text-base font-mono font-bold text-white mt-1">{totalArgs}</p>
              <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest">
                Arguments
              </p>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface-200/60">
              <ThumbsUp className="h-4 w-4 text-for-400" />
              <p className="text-base font-mono font-bold text-white mt-1">
                {forArgs.length > 0 ? forArgs[0].upvotes : 0}
              </p>
              <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest">
                Top upvotes
              </p>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface-200/60">
              <TrendingUp className="h-4 w-4 text-gold" />
              <p className="text-base font-mono font-bold text-white mt-1">{recentArgs}</p>
              <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest">
                Last 7d args
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Background excerpt ── */}
        {description && description.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
            className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4"
          >
            <SectionLabel num="§ 05" title="Background" />
            <p className="text-sm text-surface-500 leading-relaxed">{truncate(description, 300)}</p>
            {description.length > 300 && (
              <Link
                href={`/topic/${topicId}`}
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Read more <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </motion.div>
        )}

        {/* ── Further intelligence ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
        >
          <SectionLabel num={description ? '§ 06' : '§ 05'} title="Further Intelligence" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ANALYSIS_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/40 hover:bg-surface-200 hover:border-surface-300 transition-all group"
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', link.color)} />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-surface-300 transition-colors truncate">
                    {link.label}
                  </span>
                  <ChevronRight className="h-3 w-3 text-surface-700 group-hover:text-surface-500 ml-auto flex-shrink-0 transition-colors" />
                </Link>
              )
            })}
          </div>
        </motion.div>

        {/* ── Footer ── */}
        <p className="mt-8 text-center text-[10px] font-mono text-surface-700">
          Lobby Market · Civic Intelligence Dossier · {fileRef}
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
