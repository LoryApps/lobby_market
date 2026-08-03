'use client'

/**
 * /topic/[id]/explore — Topic Analysis Hub
 *
 * A discovery page that surfaces ALL analysis tools available for a topic,
 * organised into six thematic sections. Every card links to a sub-page.
 *
 * Sections:
 *   1. Voting & Consensus  — breakdown, voters, reasons, timeline, stats, vote-trend, similar, snapshot, mandate
 *   2. Arguments & Debate  — argument graph, faceoffs, evidence, themes, hot-takes, threads, frames, crossfire, fact-check, dissent
 *   3. AI Insights         — brief, intelligence, signal, bias-check, scorecard, counsel, quality, primer
 *   4. Market & Forecast   — forecast, momentum, conviction, parallels, correlations, predictions, simulation, what-if
 *   5. Community           — coalitions, contributors, connections, chat, playbook, debate-prep, relays, leaderboard
 *   6. History & Context   — context, legacy, recap, hindsight, transcript, wiki, narrative, laws, origins, global, wordcloud, weekly, report, resolution, replay
 *   7. Advanced Analysis   — archetypes, echo-chamber, fault-lines, influence, persuasion, stakeholders, ripple, inflection, cross-examine, audit, dna, journey
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  CalendarDays,
  Camera,
  ChevronRight,
  Coins,
  Cpu,
  Dna,
  FileText,
  Fingerprint,
  Flame,
  GitBranch,
  GitCompare,
  Globe,
  Handshake,
  Hash,
  Heart,
  HelpCircle,
  History,
  Link2,
  MessageSquare,
  Mic,
  Network,
  Quote,
  Radio,
  Radar,
  Scale,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Star,
  Swords,
  Tag,
  Target,
  TrendingUp,
  Users,
  Zap,
  Layers,
  List,
  Clock,
  GitMerge,
  Waves,
  Map,
  Telescope,
  Crosshair,
  Glasses,
  Archive,
  Gavel,
  Scroll,
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
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

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

// ─── Tool Card ────────────────────────────────────────────────────────────────

function ToolCardItem({ tool, topicId }: { tool: ToolCard; topicId: string }) {
  const Icon = tool.icon
  const href = tool.href.startsWith('http') ? tool.href : `/topic/${topicId}${tool.href}`

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
        <div
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg',
            tool.iconBg,
          )}
        >
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
  topicId,
}: {
  section: Section
  topicId: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div>
          <h2 className={cn('text-sm font-mono font-bold uppercase tracking-wider', section.color)}>
            {section.title}
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">{section.description}</p>
        </div>
      </div>
      <div
        className={cn(
          'rounded-2xl border p-4',
          section.borderColor,
          'bg-surface-100/20',
        )}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {section.tools.map((tool) => (
            <ToolCardItem key={tool.href} tool={tool} topicId={topicId} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExploreClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: Props) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  const SECTIONS: Section[] = [
    {
      id: 'voting',
      title: 'Voting & Consensus',
      description: 'Understand how the community voted — who, why, and when.',
      color: 'text-for-400',
      borderColor: 'border-for-600/20',
      tools: [
        {
          href: '/breakdown',
          label: 'Breakdown',
          description: 'Vote split by role, category, and demographic',
          icon: BarChart2,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/blocs',
          label: 'Voting Blocs',
          description: 'How civic roles and demographics aligned on this topic',
          icon: Users,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/voters',
          label: 'Voters',
          description: 'See the community members who cast votes',
          icon: Users,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/reasons',
          label: 'Why They Voted',
          description: 'Short-form reasons voters gave with their vote',
          icon: MessageSquare,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/timeline',
          label: 'Vote Timeline',
          description: 'How consensus evolved from first vote to now',
          icon: Clock,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/stats',
          label: 'Raw Stats',
          description: 'Detailed vote count charts and velocity data',
          icon: Activity,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/pulse',
          label: 'Pulse',
          description: 'Real-time voting activity and momentum feed',
          icon: Radio,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/swing',
          label: 'Swing Analysis',
          description: 'Largest consensus swings and what triggered them',
          icon: Waves,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/pressure',
          label: 'Vote Pressure',
          description: 'Tipping-point analysis and vote cluster dynamics',
          icon: Target,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/vote-trend',
          label: 'Vote Trend',
          description: 'Long-range consensus trajectory and pattern analysis',
          icon: TrendingUp,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/similar',
          label: 'Similar Topics',
          description: 'Topics with comparable vote patterns and demographics',
          icon: Link2,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/snapshot',
          label: 'Snapshot',
          description: 'Point-in-time consensus capture and historical record',
          icon: Camera,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/mandate',
          label: 'Civic Mandate',
          description: 'Democratic legitimacy score — how strong is the mandate?',
          icon: Gavel,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
      ],
    },
    {
      id: 'arguments',
      title: 'Arguments & Debate',
      description: 'Explore the debate from every angle — evidence, logic, rhetoric.',
      color: 'text-purple',
      borderColor: 'border-purple/20',
      tools: [
        {
          href: '/arguments',
          label: 'All Arguments',
          description: 'Browse every FOR and AGAINST argument',
          icon: List,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/argument-graph',
          label: 'Argument Graph',
          description: 'Network visualization of argument relationships',
          icon: GitBranch,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/faceoff',
          label: 'Faceoffs',
          description: 'Head-to-head argument battles — vote for the winner',
          icon: Swords,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
          badge: 'NEW',
        },
        {
          href: '/evidence',
          label: 'Evidence',
          description: 'Research citations and factual evidence submitted',
          icon: Search,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/themes',
          label: 'Debate Themes',
          description: 'Major conceptual threads running through the debate',
          icon: Layers,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/quotes',
          label: 'Best Quotes',
          description: 'Most-upvoted argument excerpts and key lines',
          icon: Quote,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/highlights',
          label: 'Highlights',
          description: 'Curated best moments and standout debate contributions',
          icon: Sparkles,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/mindmap',
          label: 'Mind Map',
          description: 'Concept-level map of the debate\'s key ideas',
          icon: Network,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/sources',
          label: 'Sources',
          description: 'External links and references cited by debaters',
          icon: Globe,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/hot-takes',
          label: 'Hot Takes',
          description: 'Most controversial and provocative arguments on each side',
          icon: Flame,
          accent: 'text-against-300',
          iconBg: 'bg-against-700/15',
        },
        {
          href: '/threads',
          label: 'Argument Threads',
          description: 'Deep reply chains and nested debate conversations',
          icon: MessageSquare,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/frames',
          label: 'Debate Frames',
          description: 'How narratives and rhetoric frame each position',
          icon: Layers,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/crossfire',
          label: 'Crossfire',
          description: 'Live moderated back-and-forth debate format',
          icon: Swords,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/fact-check',
          label: 'Fact Check',
          description: 'Factual accuracy verification of key claims in the debate',
          icon: Search,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/dissent',
          label: 'Dissent',
          description: 'Loyal opposition — minority positions and outlier arguments',
          icon: Scale,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
      ],
    },
    {
      id: 'ai',
      title: 'AI Insights',
      description: 'Machine-generated analysis, summaries, and quality signals.',
      color: 'text-emerald',
      borderColor: 'border-emerald/20',
      tools: [
        {
          href: '/brief',
          label: 'AI Brief',
          description: 'Structured summary: context, key arguments, current consensus',
          icon: BookOpen,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
          badge: 'AI',
        },
        {
          href: '/intelligence',
          label: 'Intelligence',
          description: 'Deep-dive AI analysis of the debate\'s health and dynamics',
          icon: Brain,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
          badge: 'AI',
        },
        {
          href: '/signal',
          label: 'Debate Signal',
          description: 'Composite signal score — is this debate healthy?',
          icon: Activity,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/bias-check',
          label: 'Bias Check',
          description: 'Detect framing, ideological lean, and argument gaps',
          icon: Scale,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
          badge: 'AI',
        },
        {
          href: '/scorecard',
          label: 'Report Card',
          description: 'Letter-graded assessment across five debate dimensions',
          icon: Award,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/radar',
          label: 'Debate Radar',
          description: 'Six-axis radar chart of participation, quality, and engagement',
          icon: Radar,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/synthesis',
          label: 'Synthesis',
          description: 'AI-drafted consensus summary based on top arguments',
          icon: GitMerge,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
          badge: 'AI',
        },
        {
          href: '/steelman',
          label: 'Steelman',
          description: 'Best possible case for each side, constructed by AI',
          icon: Shield,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
          badge: 'AI',
        },
        {
          href: '/counsel',
          label: 'AI Counsel',
          description: 'AI-powered debate coaching — argument suggestions and coaching',
          icon: Brain,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
          badge: 'AI',
        },
        {
          href: '/quality',
          label: 'Argument Quality',
          description: 'AI quality grades for every argument in this debate',
          icon: Star,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
          badge: 'AI',
        },
        {
          href: '/primer',
          label: 'Topic Primer',
          description: 'Quick background guide — context and key facts in one page',
          icon: BookOpen,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
      ],
    },
    {
      id: 'market',
      title: 'Market & Forecast',
      description: 'Prediction market view — price history, conviction, and forecasts.',
      color: 'text-gold',
      borderColor: 'border-gold/20',
      tools: [
        {
          href: '/forecast',
          label: 'Forecasts',
          description: 'Community forecaster predictions and confidence intervals',
          icon: TrendingUp,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/momentum',
          label: 'Momentum',
          description: 'Vote velocity and consensus trend direction',
          icon: Zap,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/conviction',
          label: 'Conviction',
          description: 'How strongly the community believes in the current outcome',
          icon: Fingerprint,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/parallels',
          label: 'Parallels',
          description: 'Similar topics and how their debates resolved',
          icon: Glasses,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/correlations',
          label: 'Correlations',
          description: 'Topics that move in sync with this one',
          icon: GitBranch,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/compare',
          label: 'Compare',
          description: 'Side-by-side comparison with any other topic on the platform',
          icon: GitCompare,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
          badge: 'NEW',
        },
        {
          href: '/depth',
          label: 'Vote Depth',
          description: 'Depth curve showing conviction at each price level',
          icon: Layers,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/velocity',
          label: 'Velocity',
          description: 'Rate-of-change analysis and acceleration metrics',
          icon: Flame,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/sentiment',
          label: 'Sentiment',
          description: 'Tone and emotional temperature of the debate',
          icon: Heart,
          accent: 'text-against-300',
          iconBg: 'bg-against-700/15',
        },
        {
          href: '/predictions',
          label: 'Predictions',
          description: 'Community prediction market — stake clout on the outcome',
          icon: Coins,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/simulation',
          label: 'Simulation',
          description: 'Monte Carlo outcome modeling and probability distributions',
          icon: Cpu,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/what-if',
          label: 'What-If',
          description: 'Counterfactual scenarios — what if the vote were different?',
          icon: HelpCircle,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
      ],
    },
    {
      id: 'community',
      title: 'Community',
      description: 'The people behind the debate — voices, coalitions, contributors.',
      color: 'text-for-300',
      borderColor: 'border-for-600/20',
      tools: [
        {
          href: '/coalitions',
          label: 'Coalitions',
          description: 'Organised groups and their stances on this topic',
          icon: Handshake,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/contributors',
          label: 'Contributors',
          description: 'Most active participants ranked by argument impact',
          icon: Users,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/connections',
          label: 'Connections',
          description: 'Social graph showing how contributors relate',
          icon: Network,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/changemaker',
          label: 'Changemakers',
          description: 'Arguments that shifted the consensus most significantly',
          icon: Sparkles,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/chat',
          label: 'Live Chat',
          description: 'Real-time discussion thread among topic followers',
          icon: MessageSquare,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/ask',
          label: 'Q&A',
          description: 'Community questions and expert answers about this topic',
          icon: Mic,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/debate-map',
          label: 'Debate Map',
          description: 'Visual 2D map of arguments by quality and position',
          icon: Map,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/impact',
          label: 'Argument Impact',
          description: 'Which arguments moved the most minds',
          icon: Target,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/playbook',
          label: 'Debate Playbook',
          description: 'Tactical guide — how to argue each side effectively',
          icon: ScrollText,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/debate-prep',
          label: 'Debate Prep',
          description: 'Pre-debate dossier: your strongest arguments and their counters',
          icon: Mic,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/relays',
          label: 'Argument Relays',
          description: 'Community relay chains linking arguments into sequences',
          icon: GitMerge,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/leaderboard',
          label: 'Topic Leaderboard',
          description: 'Top contributors to this specific debate ranked by impact',
          icon: Award,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
      ],
    },
    {
      id: 'history',
      title: 'History & Context',
      description: 'Where this topic came from and what it means going forward.',
      color: 'text-surface-400',
      borderColor: 'border-surface-400/20',
      tools: [
        {
          href: '/context',
          label: 'Context',
          description: 'Background information and why this topic matters',
          icon: BookOpen,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/wiki',
          label: 'Wiki',
          description: 'Community-edited wiki article for this topic',
          icon: FileText,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/transcript',
          label: 'Transcript',
          description: 'Full read-only log of the debate as it unfolded',
          icon: ScrollText,
          accent: 'text-surface-500',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/legacy',
          label: 'Legacy',
          description: 'Long-term impact and how this topic influenced others',
          icon: History,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/hindsight',
          label: 'Hindsight',
          description: 'Looking back — what the data shows in retrospect',
          icon: Telescope,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/recap',
          label: 'Weekly Recap',
          description: 'Summary of the most recent 7 days of activity',
          icon: Tag,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/anatomy',
          label: 'Anatomy',
          description: 'Structural breakdown of how this debate is composed',
          icon: Dna,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/autopsy',
          label: 'Autopsy',
          description: 'Post-resolution analysis of what decided the outcome',
          icon: Crosshair,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/dossier',
          label: 'Dossier',
          description: 'Full civic intelligence briefing — votes, arguments, and key stats in one view',
          icon: Archive,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/narrative',
          label: 'Narrative Arc',
          description: 'AI-generated journalistic story of how this debate unfolded',
          icon: Scroll,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/laws',
          label: 'Related Laws',
          description: 'Established Codex laws that originated from this debate',
          icon: Gavel,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/origins',
          label: 'Origins',
          description: 'How and why this topic was proposed — the founding moment',
          icon: History,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/global',
          label: 'Global Context',
          description: 'International perspectives and how other nations approach this',
          icon: Globe,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/wiki-history',
          label: 'Wiki History',
          description: 'Chronological timeline of community edits to the wiki',
          icon: Clock,
          accent: 'text-surface-500',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/wordcloud',
          label: 'Word Cloud',
          description: 'Visual frequency map of key terms across all arguments',
          icon: Hash,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/weekly',
          label: 'Weekly Digest',
          description: '7-day rollup of debate activity, votes, and milestones',
          icon: CalendarDays,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/report',
          label: 'Full Report',
          description: 'Comprehensive briefing document — all data in one view',
          icon: FileText,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/resolution',
          label: 'Resolution',
          description: 'How and when this topic reached its final outcome',
          icon: Gavel,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/replay',
          label: 'Debate Replay',
          description: 'Step-by-step replay of how the debate unfolded over time',
          icon: Archive,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced Analysis',
      description: 'Deep-dive tools for civic researchers and power users.',
      color: 'text-against-300',
      borderColor: 'border-against-600/20',
      tools: [
        {
          href: '/archetypes',
          label: 'Voter Archetypes',
          description: 'Personality clusters behind the vote — who believes what and why',
          icon: Fingerprint,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/echo-chamber',
          label: 'Echo Chamber',
          description: 'Filter bubble detection and cross-pollination analysis',
          icon: Radio,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/fault-lines',
          label: 'Fault Lines',
          description: 'Key divisions, flashpoints, and pressure points in the debate',
          icon: AlertTriangle,
          accent: 'text-against-300',
          iconBg: 'bg-against-700/15',
        },
        {
          href: '/influence',
          label: 'Influence Map',
          description: 'Who is shaping opinion and how their reach propagates',
          icon: Network,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/persuasion',
          label: 'Persuasion',
          description: 'Which rhetorical techniques and argument styles are working',
          icon: Sparkles,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/stakeholders',
          label: 'Stakeholders',
          description: 'Who has real-world stakes in this outcome — by sector and interest',
          icon: Users,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/ripple',
          label: 'Ripple Effects',
          description: 'Downstream debates and policy areas influenced by this topic',
          icon: Waves,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/inflection',
          label: 'Inflection Points',
          description: 'Moments where the debate trajectory changed significantly',
          icon: Zap,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/cross-examine',
          label: 'Cross-Examine',
          description: 'Put the strongest arguments from each side to adversarial testing',
          icon: Swords,
          accent: 'text-against-300',
          iconBg: 'bg-against-700/15',
        },
        {
          href: '/audit',
          label: 'Democratic Audit',
          description: 'Legitimacy audit — participation, representation, and procedural health',
          icon: Shield,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/dna',
          label: 'Topic DNA',
          description: 'The genetic fingerprint of this debate — values, categories, and themes',
          icon: Dna,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/journey',
          label: 'Civic Journey',
          description: 'Your personal history with this topic — votes, arguments, and moments',
          icon: Map,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + Header */}
        <div className="mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={STATUS_BADGE[status] ?? 'proposed'} size="sm">
                  {STATUS_LABEL[status] ?? status}
                </Badge>
                {category && (
                  <span className="text-xs font-mono text-surface-500">{category}</span>
                )}
              </div>
              <h1 className="text-xl font-mono font-bold text-white leading-snug">
                {statement}
              </h1>
              <p className="text-sm text-surface-500 mt-1.5">
                Analysis Hub — {SECTIONS.reduce((acc, s) => acc + s.tools.length, 0)} tools
                across {SECTIONS.length} sections
              </p>
            </div>

            {/* Consensus pill */}
            <div className="flex-shrink-0 flex items-center gap-2 bg-surface-100 border border-surface-300/50 rounded-xl px-4 py-2.5">
              <div className="text-right">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Consensus</p>
                <p className="text-xl font-mono font-bold text-for-400">{forPct}¢</p>
              </div>
              <div className="h-8 w-px bg-surface-300/50" />
              <div className="text-right">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Against</p>
                <p className="text-xl font-mono font-bold text-against-400">{againstPct}¢</p>
              </div>
            </div>
          </div>

          {/* Vote bar mini */}
          <div className="mt-3 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-700"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-for-500">
              FOR {totalVotes > 0 ? `· ${totalVotes.toLocaleString()} votes` : ''}
            </span>
            <span className="text-[10px] font-mono text-against-500">AGAINST</span>
          </div>
        </div>

        {/* Quick jump nav */}
        <div className="flex gap-1.5 flex-wrap mb-8">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={cn(
                'text-[11px] font-mono px-2.5 py-1 rounded-lg',
                'bg-surface-200/60 border border-surface-300/50',
                'hover:bg-surface-200 hover:border-surface-400/60 transition-colors',
                s.color,
              )}
            >
              {s.title}
            </a>
          ))}
        </div>

        {/* Section grid */}
        <div className="space-y-10">
          {SECTIONS.map((section, i) => (
            <motion.div
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <SectionBlock section={section} topicId={topicId} />
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 pt-8 border-t border-surface-300/30 text-center">
          <p className="text-sm text-surface-500 mb-4">
            Want to go deeper? View the full topic page.
          </p>
          <Link
            href={`/topic/${topicId}`}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
              'bg-for-600/20 border border-for-600/40 text-for-300',
              'hover:bg-for-600/30 hover:border-for-500/60 transition-all',
              'text-sm font-mono font-semibold',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to full topic
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
