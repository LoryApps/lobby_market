'use client'

/**
 * /debate/[id]/explore — Debate Analysis Hub
 *
 * A discovery page surfacing ALL analysis tools available for a debate,
 * organised into four thematic sections. Every card links to a sub-page.
 *
 * Sections:
 *   1. During & After     — transcript, replay, highlights, recap
 *   2. Intelligence       — analysis, verdict, audience, performance
 *   3. Preparation        — coach, predictions, clash
 *   4. On This Topic      — back to topic, topic explore, related debates
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart2,
  Brain,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Gavel,
  History,
  Lightbulb,
  Mic,
  Radio,
  Scale,
  ScrollText,
  Shield,
  Swords,
  Target,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolCard {
  href: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
  iconBg: string
  badge?: string
  disabled?: boolean
}

interface Section {
  id: string
  title: string
  description: string
  color: string
  borderColor: string
  tools: ToolCard[]
}

interface Props {
  debateId: string
  title: string
  type: string
  status: string
  topicId: string | null
  topicStatement: string | null
  category: string | null
  scheduledAt: string | null
  viewerCount: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  live: 'Live Now',
  ended: 'Ended',
  cancelled: 'Cancelled',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  scheduled: 'proposed',
  live: 'active',
  ended: 'failed',
  cancelled: 'failed',
}

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford Debate',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

// ─── Tool Card ────────────────────────────────────────────────────────────────

function ToolCardItem({ tool, debateId }: { tool: ToolCard; debateId: string }) {
  const Icon = tool.icon
  const href = tool.href.startsWith('/')
    ? tool.href
    : `/debate/${debateId}/${tool.href}`

  if (tool.disabled) {
    return (
      <div
        className={cn(
          'relative flex flex-col gap-2 p-3.5 rounded-xl',
          'bg-surface-100/40 border border-surface-300/30',
          'opacity-40 cursor-not-allowed h-full',
        )}
      >
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', tool.iconBg)}>
          <Icon className={cn('h-4 w-4', tool.accent)} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{tool.label}</p>
          <p className="text-[11px] text-surface-500 mt-0.5 leading-snug line-clamp-2">
            {tool.description}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Link href={href} className="group block">
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'relative flex flex-col gap-2 p-3.5 rounded-xl',
          'bg-surface-100/80 border border-surface-300/50',
          'hover:border-surface-400/70 hover:bg-surface-100',
          'transition-all duration-200 cursor-pointer h-full',
        )}
      >
        {tool.badge && (
          <span className="absolute top-2 right-2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-gold/20 text-gold border border-gold/30">
            {tool.badge}
          </span>
        )}
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', tool.iconBg)}>
          <Icon className={cn('h-4 w-4', tool.accent)} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{tool.label}</p>
          <p className="text-[11px] text-surface-500 mt-0.5 leading-snug line-clamp-2">
            {tool.description}
          </p>
        </div>
        <ChevronRight
          className={cn(
            'absolute bottom-3 right-3 h-3 w-3 text-surface-600',
            'group-hover:text-surface-400 transition-colors',
          )}
        />
      </motion.div>
    </Link>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  debateId,
}: {
  section: Section
  debateId: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-4 md:p-5',
        'bg-surface-100/40',
        section.borderColor,
      )}
    >
      <div className="mb-4">
        <h2 className={cn('text-sm font-mono font-bold uppercase tracking-widest', section.color)}>
          {section.title}
        </h2>
        <p className="text-xs text-surface-500 mt-0.5">{section.description}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {section.tools.map((tool) => (
          <ToolCardItem key={tool.href} tool={tool} debateId={debateId} />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DebateExploreClient({
  debateId,
  title,
  type,
  status,
  topicId,
  topicStatement,
  category,
  scheduledAt,
  viewerCount,
}: Props) {
  const isEnded = status === 'ended'
  const isLive = status === 'live'
  const isScheduled = status === 'scheduled'

  const SECTIONS: Section[] = [
    {
      id: 'record',
      title: 'Record & Replay',
      description: 'Everything said in this debate — verbatim, curated, and summarised.',
      color: 'text-for-400',
      borderColor: 'border-for-500/20',
      tools: [
        {
          href: 'transcript',
          label: 'Transcript',
          description: 'Full verbatim record of every argument in chronological order.',
          icon: ScrollText,
          accent: 'text-for-400',
          iconBg: 'bg-for-500/10',
          disabled: isScheduled,
        },
        {
          href: 'replay',
          label: 'Replay',
          description: 'Relive the debate argument by argument in interactive playback.',
          icon: History,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
          disabled: isScheduled,
        },
        {
          href: 'highlights',
          label: 'Highlights',
          description: 'Best moments — the strongest arguments and turning points curated.',
          icon: Flame,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
          badge: 'HOT',
          disabled: isScheduled,
        },
        {
          href: 'recap',
          label: 'Recap',
          description: 'Short summary of what was argued, what moved the needle, and the outcome.',
          icon: FileText,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
          disabled: isScheduled,
        },
      ],
    },
    {
      id: 'intelligence',
      title: 'Intelligence',
      description: 'Deep analysis of what happened and what it meant.',
      color: 'text-purple',
      borderColor: 'border-purple/20',
      tools: [
        {
          href: 'analysis',
          label: 'AI Analysis',
          description: 'AI breakdown: rhetorical quality, fallacies, turning points, speaker scores.',
          icon: Brain,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
          badge: 'AI',
          disabled: isScheduled,
        },
        {
          href: 'verdict',
          label: 'Verdict',
          description: 'Who won the argument? Audience verdict, judge score, and key reasons.',
          icon: Gavel,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
          disabled: isScheduled,
        },
        {
          href: 'audience',
          label: 'Audience',
          description: 'Crowd reaction, live sway, demographic breakdown, and takeaway sentiment.',
          icon: Users,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
          disabled: isScheduled,
        },
        {
          href: 'performance',
          label: 'Performance',
          description: 'Per-speaker stats: persuasiveness, consistency, evidence use, and style.',
          icon: BarChart2,
          accent: 'text-for-400',
          iconBg: 'bg-for-500/10',
          disabled: isScheduled,
        },
        {
          href: 'scorecard',
          label: 'Scorecard',
          description: 'Official point-by-point judging scorecard across 5 weighted criteria.',
          icon: Award,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
          disabled: isScheduled,
        },
      ],
    },
    {
      id: 'preparation',
      title: 'Preparation & Predictions',
      description: 'Tools for participants and forecasters before and during the debate.',
      color: 'text-against-400',
      borderColor: 'border-against-500/20',
      tools: [
        {
          href: 'coach',
          label: 'Coach Brief',
          description: 'AI coaching dossier for registered participants: opponent profile and strategy.',
          icon: Shield,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
          badge: 'PRIVATE',
          disabled: isEnded,
        },
        {
          href: 'predictions',
          label: 'Predictions',
          description: 'Community forecasts on who will win and by how much.',
          icon: Target,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'clash',
          label: 'Clash',
          description: 'Head-to-head argument comparison: strongest FOR vs strongest AGAINST.',
          icon: Swords,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
          disabled: isScheduled,
        },
        {
          href: `/debate/${debateId}`,
          label: 'Live Arena',
          description: isLive ? 'Join the live debate — happening now.' : 'View the debate arena.',
          icon: isLive ? Radio : Mic,
          accent: isLive ? 'text-against-400' : 'text-surface-400',
          iconBg: isLive ? 'bg-against-500/10' : 'bg-surface-300/50',
          badge: isLive ? 'LIVE' : undefined,
        },
      ],
    },
    ...(topicId
      ? [
          {
            id: 'topic',
            title: 'On This Topic',
            description: 'Explore the broader debate and the topic this discussion is part of.',
            color: 'text-emerald',
            borderColor: 'border-emerald/20',
            tools: [
              {
                href: `/topic/${topicId}`,
                label: 'Topic',
                description: topicStatement
                  ? topicStatement.length > 55
                    ? topicStatement.slice(0, 55) + '…'
                    : topicStatement
                  : 'View the civic topic this debate explores.',
                icon: Scale,
                accent: 'text-for-400',
                iconBg: 'bg-for-500/10',
              },
              {
                href: `/topic/${topicId}/explore`,
                label: 'Topic Hub',
                description: 'All 80+ analysis tools for this topic — voting, arguments, AI, market.',
                icon: Zap,
                accent: 'text-gold',
                iconBg: 'bg-gold/10',
              },
              {
                href: `/topic/${topicId}/arguments`,
                label: 'Arguments',
                description: 'The best FOR and AGAINST arguments from the wider community.',
                icon: Activity,
                accent: 'text-emerald',
                iconBg: 'bg-emerald/10',
              },
              {
                href: `/topic/${topicId}/forecast`,
                label: 'Forecast',
                description: 'Prediction market consensus on how this topic will resolve.',
                icon: Target,
                accent: 'text-purple',
                iconBg: 'bg-purple/10',
              },
            ],
          } as Section,
        ]
      : []),
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">
        {/* ── Back link ── */}
        <Link
          href={`/debate/${debateId}`}
          className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {/* ── Header ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant={STATUS_BADGE[status] ?? 'proposed'} size="sm">
              {STATUS_LABEL[status] ?? status}
            </Badge>
            {type && (
              <span className="text-xs font-mono text-surface-500 px-2 py-0.5 rounded-md bg-surface-200 border border-surface-300">
                {TYPE_LABEL[type] ?? type}
              </span>
            )}
            {category && (
              <span className="text-xs font-mono text-surface-500">{category}</span>
            )}
            {isLive && viewerCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-mono text-against-400">
                <Radio className="h-3 w-3" />
                {viewerCount.toLocaleString()} watching
              </span>
            )}
          </div>

          <h1 className="text-xl md:text-2xl font-mono font-bold text-white leading-snug mb-2">
            {title}
          </h1>

          {scheduledAt && (
            <p className="text-xs font-mono text-surface-500 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {new Date(scheduledAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}

          {topicStatement && (
            <div className="mt-3 pt-3 border-t border-surface-300/50">
              <p className="text-[11px] font-mono text-surface-600 uppercase tracking-widest mb-1">
                Topic
              </p>
              <p className="text-sm text-surface-300 leading-snug">
                {topicStatement}
              </p>
            </div>
          )}
        </div>

        {/* ── Section note ── */}
        <div className="flex items-start gap-2 px-1">
          <Lightbulb className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-surface-500">
            {isScheduled
              ? 'This debate hasn\'t started yet. Predictions and coaching briefs are available — analysis tools unlock once the debate ends.'
              : isLive
              ? 'Debate is live. Transcript, replay, and analysis tools unlock when it ends.'
              : 'All analysis tools are available. Explore the full record of this debate.'}
          </p>
        </div>

        {/* ── Tool sections ── */}
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <SectionBlock key={section.id} section={section} debateId={debateId} />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2">
          <Link
            href="/debate"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-600 hover:text-surface-400 transition-colors"
          >
            <Mic className="h-3 w-3" />
            All debates
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
