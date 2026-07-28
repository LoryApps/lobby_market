'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  ChevronRight,
  FileText,
  Gavel,
  GitBranch,
  Globe,
  Network,
  Scale,
  Shield,
  Star,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  statement: string
  category: string | null
  isActive: boolean
  establishedAt: string | null
  topicId: string | null
  topicStatement: string | null
  bluePct: number | null
  totalVotes: number | null
  bodyExcerpt: string | null
  amendmentCount: number
  revisionCount: number
  reviewCount: number
  avgStars: number | null
  ratifiedAmendments: number
  relatedLawCount: number
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

function stripMarkdown(md: string) {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .trim()
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

function StatCell({
  icon: Icon,
  label,
  value,
  color = 'text-surface-400',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface-200/60">
      <Icon className={cn('h-4 w-4', color)} />
      <p className="text-base font-mono font-bold text-white mt-1">{value}</p>
      <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest">{label}</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LawDossierClient({
  lawId,
  statement,
  category,
  isActive,
  establishedAt,
  topicId,
  topicStatement,
  bluePct,
  totalVotes,
  bodyExcerpt,
  amendmentCount,
  revisionCount,
  reviewCount,
  avgStars,
  ratifiedAmendments,
  relatedLawCount,
}: Props) {
  const fileRef = lawId.slice(0, 8).toUpperCase()
  const lawUrl = `https://lobby.market/law/${lawId}/dossier`
  const forPct = bluePct != null ? Math.round(bluePct) : null
  const votes = totalVotes ?? 0

  const ANALYSIS_LINKS = [
    { href: `/law/${lawId}/blueprint`, label: 'Blueprint', icon: BookOpen, color: 'text-purple' },
    { href: `/law/${lawId}/amendments`, label: 'Amendments', icon: GitBranch, color: 'text-gold' },
    { href: `/law/${lawId}/revisions`, label: 'Revisions', icon: TrendingUp, color: 'text-for-400' },
    { href: `/law/${lawId}/reviews`, label: 'Reviews', icon: Star, color: 'text-emerald' },
    { href: `/law/${lawId}/impact`, label: 'Impact', icon: BarChart2, color: 'text-against-400' },
    { href: `/law/${lawId}/graph`, label: 'Knowledge Graph', icon: Network, color: 'text-surface-400' },
    { href: `/law/${lawId}/debate`, label: 'Debate Record', icon: Scale, color: 'text-surface-400' },
    { href: `/law/${lawId}/explore`, label: 'All Tools', icon: ChevronRight, color: 'text-surface-500' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        {/* ── Nav ── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to law
          </Link>
          <SharePanel
            url={lawUrl}
            text={`Law Dossier: ${statement.slice(0, 80)}`}
            lawId={lawId}
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
                <Gavel className="h-4 w-4 text-surface-500" />
              </div>
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-surface-600">
                  Law Dossier
                </p>
                <p className="text-[8px] font-mono text-surface-700 mt-0.5">FILE #{fileRef}</p>
              </div>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border',
                isActive
                  ? 'bg-emerald/10 border-emerald/30 text-emerald'
                  : 'bg-surface-200 border-surface-300 text-surface-500',
              )}
            >
              <Shield className="h-2.5 w-2.5" />
              {isActive ? 'Active Law' : 'Inactive'}
            </span>
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
            {establishedAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-200 border border-surface-300 text-surface-500">
                <Calendar className="h-2.5 w-2.5" />
                Est. {fmtDate(establishedAt)}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Voting record ── */}
        {forPct != null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4"
          >
            <SectionLabel num="§ 01" title="Founding Vote" />
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-for-400 font-bold">{forPct}% FOR</span>
                <span className="text-surface-600">{votes.toLocaleString()} votes cast</span>
                <span className="text-against-400 font-bold">{100 - forPct}% AGAINST</span>
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
                  animate={{ width: `${100 - forPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2.5 rounded-lg bg-for-600/10 border border-for-600/20">
                <p className="text-lg font-mono font-bold text-for-400">{forPct}%</p>
                <p className="text-[9px] font-mono text-surface-600 uppercase tracking-widest mt-0.5">
                  For
                </p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-surface-200 border border-surface-300">
                <p className="text-lg font-mono font-bold text-white">{votes.toLocaleString()}</p>
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
        )}

        {/* ── Legislative record ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4"
        >
          <SectionLabel num="§ 02" title="Legislative Record" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCell icon={GitBranch} label="Amendments" value={amendmentCount} color="text-gold" />
            <StatCell icon={ThumbsUp} label="Ratified" value={ratifiedAmendments} color="text-emerald" />
            <StatCell icon={TrendingUp} label="Revisions" value={revisionCount} color="text-for-400" />
            <StatCell icon={Star} label="Reviews" value={reviewCount} color="text-purple" />
            {avgStars != null && (
              <StatCell
                icon={Star}
                label="Avg Rating"
                value={`${avgStars.toFixed(1)} ★`}
                color="text-gold"
              />
            )}
            <StatCell icon={Globe} label="Related Laws" value={relatedLawCount} color="text-surface-400" />
          </div>
        </motion.div>

        {/* ── Body excerpt ── */}
        {bodyExcerpt && bodyExcerpt.trim().length > 20 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 mb-4"
          >
            <SectionLabel num="§ 03" title="Legislative Text" />
            <p className="text-sm text-surface-500 leading-relaxed">
              {truncate(stripMarkdown(bodyExcerpt), 400)}
            </p>
            {bodyExcerpt.length > 400 && (
              <Link
                href={`/law/${lawId}`}
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Read full text <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </motion.div>
        )}

        {/* ── Source topic ── */}
        {topicId && topicStatement && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
            className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 mb-4"
          >
            <SectionLabel num={bodyExcerpt ? '§ 04' : '§ 03'} title="Origin Debate" />
            <Link
              href={`/topic/${topicId}`}
              className="flex items-start gap-3 group"
            >
              <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 mt-0.5">
                <Scale className="h-4 w-4 text-surface-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-mono text-surface-500 group-hover:text-surface-300 transition-colors leading-relaxed line-clamp-2">
                  {topicStatement}
                </p>
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono text-for-400 group-hover:text-for-300 transition-colors">
                  View source debate <ChevronRight className="h-2.5 w-2.5" />
                </span>
              </div>
            </Link>
          </motion.div>
        )}

        {/* ── Further intelligence ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
        >
          <SectionLabel
            num={
              bodyExcerpt && topicId
                ? '§ 05'
                : bodyExcerpt || topicId
                  ? '§ 04'
                  : '§ 03'
            }
            title="Further Intelligence"
          />
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
          Lobby Market · Law Intelligence Dossier · {fileRef}
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
