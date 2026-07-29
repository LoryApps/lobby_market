'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  Calendar,
  ChevronRight,
  Gavel,
  GitMerge,
  Scale,
  Sparkles,
  Users,
} from 'lucide-react'
import { TopicSynthesisPanel } from '@/components/topic/TopicSynthesisPanel'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  topicId: string
  statement: string
  category: string | null
  bluePct: number
  totalVotes: number
  establishedAt: string
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
    <div className="space-y-2">
      <div className="relative h-2.5 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute inset-y-0 right-0 bg-against-600 rounded-r-full"
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-for-400 font-semibold">{forPct}% For</span>
        <span className="text-surface-500">{totalVotes.toLocaleString()} votes</span>
        <span className="text-against-400 font-semibold">{againstPct}% Against</span>
      </div>
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function LawSynthesisClient({ lawId, topicId, statement, category, bluePct, totalVotes, establishedAt }: Props) {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/law/${lawId}`}
          className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          aria-label="Back to law"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2 text-sm font-mono text-surface-500 min-w-0">
          <Link href="/law" className="hover:text-white transition-colors">Codex</Link>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <Link href={`/law/${lawId}`} className="hover:text-white transition-colors truncate">
            {statement.slice(0, 45)}{statement.length > 45 ? '…' : ''}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-white font-semibold">Synthesis</span>
        </div>
      </div>

      {/* Page header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0 mt-0.5">
          <GitMerge className="h-6 w-6 text-emerald" />
        </div>
        <div>
          <h1 className="font-mono text-2xl font-bold text-white leading-tight">Argument Synthesis</h1>
          <p className="text-sm font-mono text-surface-500 mt-1">
            AI-identified common ground and core tensions from the founding debate
          </p>
        </div>
      </div>

      {/* Law context card */}
      <div className="mb-6 rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0 mt-0.5">
            <Gavel className="h-4 w-4 text-gold" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-gold text-[10px] font-mono font-bold uppercase tracking-wider">
                <Gavel className="h-2.5 w-2.5" />
                Established Law
              </span>
              {category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300 text-surface-400 text-[10px] font-mono uppercase tracking-wider">
                  {category}
                </span>
              )}
            </div>
            <p className="font-mono text-sm font-semibold text-white leading-relaxed">{statement}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Established {formatDate(establishedAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {totalVotes.toLocaleString()} votes
          </span>
        </div>

        <VoteBar bluePct={bluePct} totalVotes={totalVotes} />
      </div>

      {/* Synthesis panel — uses the topic's argument data */}
      <TopicSynthesisPanel topicId={topicId} />

      {/* Related law pages */}
      <div className="mt-8 pt-6 border-t border-surface-300">
        <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-3">Explore this law</p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: `/law/${lawId}/steelman`, icon: Brain, label: 'Steelman', color: 'text-purple border-purple/30 bg-purple/10 hover:bg-purple/20' },
            { href: `/law/${lawId}/debate`, icon: Scale, label: 'Founding Debate', color: 'text-for-300 border-for-500/20 bg-for-500/10 hover:bg-for-500/20' },
            { href: `/law/${lawId}/counsel`, icon: Sparkles, label: 'Ask Counsel', color: 'text-gold border-gold/30 bg-gold/10 hover:bg-gold/20' },
            { href: `/law/${lawId}/frames`, icon: GitMerge, label: 'Frames', color: 'text-purple border-purple/30 bg-purple/10 hover:bg-purple/20' },
            { href: `/law/${lawId}/reviews`, icon: Scale, label: 'Reviews', color: 'text-gold border-gold/30 bg-gold/10 hover:bg-gold/20' },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link
              key={href}
              href={href}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors', color)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
