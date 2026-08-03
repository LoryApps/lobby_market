'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart2,
  BookMarked,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  FileText,
  Fingerprint,
  Flame,
  Gavel,
  GitBranch,
  GitCompare,
  GitMerge,
  Globe,
  History,
  Layers,
  Lightbulb,
  List,
  MessageSquare,
  Network,
  Radio,
  Quote,
  Scale,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Tag,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Users2,
  Wind,
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
  lawId: string
  statement: string
  category: string | null
  totalVotes: number | null
  establishedAt: string | null
  topicId: string | null
  topicStatement: string | null
  bluePct: number | null
}

// ─── Tool Card ────────────────────────────────────────────────────────────────

function ToolCardItem({ tool, lawId }: { tool: ToolCard; lawId: string }) {
  const Icon = tool.icon
  const href = tool.href.startsWith('/') ? tool.href : `/law/${lawId}/${tool.href}`

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

function SectionBlock({ section, lawId }: { section: Section; lawId: string }) {
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
          <ToolCardItem key={tool.href} tool={tool} lawId={lawId} />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LawExploreClient({
  lawId,
  statement,
  category,
  totalVotes,
  establishedAt,
  topicId,
  topicStatement,
  bluePct,
}: Props) {
  const forPct = bluePct != null ? Math.round(bluePct) : null

  const SECTIONS: Section[] = [
    {
      id: 'law',
      title: 'The Law',
      description: 'The established consensus, its structure, history, and proposed changes.',
      color: 'text-for-400',
      borderColor: 'border-for-500/20',
      tools: [
        {
          href: `/law/${lawId}`,
          label: 'Law Overview',
          description: 'Full law entry — statement, vote breakdown, revisions, and linked laws.',
          icon: ScrollText,
          accent: 'text-for-400',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'blueprint',
          label: 'Blueprint',
          description: 'Structural breakdown of the law — clauses, provisions, and intent.',
          icon: Layers,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'revisions',
          label: 'Revisions',
          description: 'Full edit history — every change made since the law was established.',
          icon: History,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
        },
        {
          href: 'timeline',
          label: 'Timeline',
          description: 'Chronological journey from initial proposal through debate, voting, and establishment.',
          icon: Clock,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'amendments',
          label: 'Amendments',
          description: 'Proposed amendments from the community to refine or challenge this law.',
          icon: GitBranch,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
          badge: 'OPEN',
        },
        {
          href: 'primer',
          label: 'Law Primer',
          description: 'Plain-language breakdown — what it means, why it passed, and the key arguments.',
          icon: BookMarked,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'wiki-history',
          label: 'Wiki History',
          description: 'Full edit log for the community wiki article — every revision and contributor.',
          icon: History,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
        },
      ],
    },
    {
      id: 'community',
      title: 'Community',
      description: 'What citizens think, how they engage, and what the community has to say.',
      color: 'text-emerald',
      borderColor: 'border-emerald/20',
      tools: [
        {
          href: 'breakdown',
          label: 'Voter Breakdown',
          description: 'How different cohorts voted — by role tier, Clout level, engagement type, and timing.',
          icon: BarChart2,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'reviews',
          label: 'Reviews',
          description: 'Community evaluations of the law — is it fair, effective, and well-drafted?',
          icon: FileText,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'community',
          label: 'Community',
          description: "Citizen engagement — who supports this law and who's campaigning against it.",
          icon: Users,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'debate',
          label: 'Debate',
          description: 'Structured debate on this law — the best arguments for and against.',
          icon: Gavel,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
        },
        {
          href: 'counsel',
          label: 'AI Counsel',
          description: 'AI legal analysis — plain English interpretation, implications, and critique.',
          icon: Brain,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
          badge: 'AI',
        },
        {
          href: 'contributors',
          label: 'Founding Voices',
          description: 'The citizens whose arguments shaped this law — ranked by upvotes earned.',
          icon: Award,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'quotes',
          label: 'Debate Quotes',
          description: 'The most upvoted FOR and AGAINST arguments from the founding debate.',
          icon: Quote,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'reasons',
          label: 'Vote Reasons',
          description: "Anonymous hot takes from citizens who explained why they voted for or against this law.",
          icon: MessageSquare,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'highlights',
          label: 'Highlights',
          description: 'Curated standout quotes and arguments from the founding debate.',
          icon: Sparkles,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'report',
          label: 'Law Report',
          description: 'Printable civic report — vote split, founding arguments, community wiki, and reviews in one document.',
          icon: FileText,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: 'hot-takes',
          label: 'Hot Takes',
          description: 'The most provocative and polarising opinions submitted during debate.',
          icon: Flame,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
        },
        {
          href: 'arguments',
          label: 'Arguments',
          description: 'Browse every FOR and AGAINST argument submitted during the founding debate.',
          icon: List,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'narrative',
          label: 'Narrative Arc',
          description: 'AI-authored journalistic story of how this debate evolved into law.',
          icon: Quote,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
          badge: 'AI',
        },
        {
          href: 'themes',
          label: 'Debate Themes',
          description: 'Recurring ideas and conceptual clusters that shaped the founding debate.',
          icon: Tag,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'voters',
          label: 'Voters',
          description: 'Who voted on this law and how they broke down by role, Clout, and timing.',
          icon: Users,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'common-ground',
          label: 'Common Ground',
          description: 'Principles and evidence that both FOR and AGAINST voters agreed on.',
          icon: Sparkles,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'wordcloud',
          label: 'Word Cloud',
          description: 'Visual map of the most significant language in this law\'s debate.',
          icon: Wind,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
      ],
    },
    {
      id: 'civic-record',
      title: 'Civic Record',
      description: 'The law\'s ongoing standing — verdicts, challenges, opposition, and momentum.',
      color: 'text-against-400',
      borderColor: 'border-against-500/20',
      tools: [
        {
          href: 'verdict',
          label: 'Community Verdict',
          description: 'Citizens vote on whether this law has achieved its stated goals.',
          icon: Star,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'challenge',
          label: 'Formal Challenges',
          description: 'Constitutional, procedural, factual, ethical, and practical challenges filed by citizens.',
          icon: AlertTriangle,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
        },
        {
          href: 'dissent',
          label: 'Loyal Opposition',
          description: 'The minority view — structured dissent from those who still oppose this law.',
          icon: ThumbsDown,
          accent: 'text-against-300',
          iconBg: 'bg-against-500/10',
        },
        {
          href: 'pulse',
          label: 'Live Pulse',
          description: 'Real-time activity — reviews, edits, discussions, challenges, and amendments.',
          icon: Activity,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
          badge: 'LIVE',
        },
        {
          href: 'momentum',
          label: 'Momentum',
          description: 'Community energy behind this law — trending up or losing traction?',
          icon: TrendingUp,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'health',
          label: 'Health Report',
          description: 'Civic health grade: verdict coverage, wiki quality, formal challenges, and discussion activity.',
          icon: Activity,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'scorecard',
          label: 'Scorecard',
          description: 'Graded performance across legitimacy, verdict, resilience, stability, and engagement.',
          icon: Radio,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'legacy',
          label: 'Legacy',
          description: 'Long-term standing — verdicts, challenges, continuation debates, and track record.',
          icon: Gavel,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'blocs',
          label: 'Voting Blocs',
          description: 'How different civic roles and clout tiers voted on this law.',
          icon: Users2,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'discuss',
          label: 'Discussion',
          description: 'Open community discussion on this law — share thoughts and reactions.',
          icon: MessageSquare,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'velocity',
          label: 'Vote Velocity',
          description: 'How fast support accumulated — vote rate and momentum from proposal to establishment.',
          icon: Zap,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'conviction',
          label: 'Conviction',
          description: 'Which voters were most certain — confidence distribution across the electorate.',
          icon: Target,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'sentiment',
          label: 'Sentiment',
          description: 'Emotional tone analysis across all arguments, reviews, and discussion.',
          icon: BarChart2,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'echo-chamber',
          label: 'Echo Chamber',
          description: 'Whether debate became a filter bubble — ideological clustering and diversity score.',
          icon: Radio,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
        },
        {
          href: 'adoption',
          label: 'Adoption',
          description: 'Uptake signals post-establishment — civic compliance and community acknowledgement.',
          icon: TrendingUp,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'benchmark',
          label: 'Category Benchmark',
          description: 'Percentile ranking and mandate strength vs. all laws in the same category.',
          icon: BarChart2,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'fault-lines',
          label: 'Fault Lines',
          description: 'Where support for this law fractured — ideological divides and tension points.',
          icon: TrendingDown,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
        },
        {
          href: 'pressure',
          label: 'Pressure Analysis',
          description: 'Repeal signals, amendment pressure, and dissent magnitude over time.',
          icon: AlertTriangle,
          accent: 'text-against-300',
          iconBg: 'bg-against-500/10',
        },
        {
          href: 'swing',
          label: 'Swing Analysis',
          description: 'Late-stage momentum — which voters changed the outcome and when.',
          icon: Activity,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'snapshot',
          label: 'Law Snapshot',
          description: 'State-of-the-law snapshot at a glance — key metrics, standing, and signals.',
          icon: Target,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
        },
        {
          href: 'topics',
          label: 'Active Debates',
          description: 'Current topics and debates linked to or inspired by this law.',
          icon: Flame,
          accent: 'text-against-400',
          iconBg: 'bg-against-500/10',
        },
        {
          href: '/law/verdicts',
          label: 'Verdict Board',
          description: 'Community retrospective assessments across all laws in the Codex.',
          icon: ThumbsUp,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
      ],
    },
    {
      id: 'analysis',
      title: 'Analysis & Context',
      description: 'Impact modelling, knowledge graph position, and civic significance.',
      color: 'text-purple',
      borderColor: 'border-purple/20',
      tools: [
        {
          href: 'impact',
          label: 'Impact',
          description: 'Projected societal and policy impact — who this law affects and how.',
          icon: BarChart2,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: '/law/graph',
          label: 'Knowledge Graph',
          description: 'See where this law sits in the full network of established consensus.',
          icon: Network,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: '/law',
          label: 'Law Codex',
          description: 'Browse all established laws — sorted by category, votes, and date.',
          icon: BookOpen,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
        },
        {
          href: '/law/atlas',
          label: 'Law Atlas',
          description: 'Geographic distribution — how support for this law varies by region.',
          icon: Globe,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'parallels',
          label: 'Global Precedents',
          description: 'How similar laws from other jurisdictions have fared — outcomes, amendments, and lessons.',
          icon: Scale,
          accent: 'text-for-400',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'connections',
          label: 'Connections',
          description: 'Direct links to related laws — how this law sits inside the broader Codex.',
          icon: GitMerge,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'similar',
          label: 'Similar Laws',
          description: 'Laws with overlapping intent, scope, or category in the Codex.',
          icon: Network,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'forecast',
          label: 'Stability Forecast',
          description: 'Repeal risk, amendment pressure, and predictive signals for this law\'s future.',
          icon: Radio,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'synthesis',
          label: 'Synthesis',
          description: 'AI-identified common ground, core tensions, and a balanced synthesis of this law.',
          icon: Zap,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
          badge: 'AI',
        },
        {
          href: 'steelman',
          label: 'Steelman',
          description: 'The strongest possible case FOR this law — even if you oppose it.',
          icon: Shield,
          accent: 'text-against-300',
          iconBg: 'bg-against-500/10',
          badge: 'AI',
        },
        {
          href: 'origins',
          label: 'Origins',
          description: 'The origin story — how this law proposal first emerged and gained traction.',
          icon: History,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'mandate',
          label: 'Mandate',
          description: 'The strength and legitimacy of the public mandate behind this law.',
          icon: Shield,
          accent: 'text-for-400',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'influence',
          label: 'Influence Map',
          description: 'Who and what most influenced the final vote — key contributors and turning points.',
          icon: Network,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'audit',
          label: 'Audit Trail',
          description: 'Full transparency audit — every edit, review action, and administrative change.',
          icon: ScrollText,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
        },
        {
          href: 'wiki',
          label: 'Wiki',
          description: 'Community-written context article — history, background, and civic significance.',
          icon: BookOpen,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'what-if',
          label: 'What If',
          description: 'Counterfactual analysis — what would have changed if the vote went the other way.',
          icon: Lightbulb,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
          badge: 'AI',
        },
        {
          href: 'global',
          label: 'Global View',
          description: 'How this law compares to real-world equivalents from other jurisdictions.',
          icon: Globe,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
        },
        {
          href: 'dna',
          label: 'Law DNA',
          description: 'Core identity markers — the defining attributes and civic fingerprint of this law.',
          icon: Fingerprint,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
        {
          href: 'dossier',
          label: 'Law Dossier',
          description: 'Complete intelligence file — every signal, stat, and metric in one view.',
          icon: FileText,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/50',
        },
        {
          href: 'compare',
          label: 'Compare',
          description: 'Side-by-side comparison with another established law in the Codex.',
          icon: GitCompare,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: 'frames',
          label: 'Debate Frames',
          description: 'How each side framed the argument — economic, moral, practical, rights-based.',
          icon: Layers,
          accent: 'text-for-300',
          iconBg: 'bg-for-500/10',
        },
        {
          href: 'quiz',
          label: 'Law Quiz',
          description: 'Test your knowledge of this law — vote splits, timing, arguments, and more.',
          icon: Brain,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: 'archetypes',
          label: 'Voter Archetypes',
          description: 'The distinct civic personas that voted on this law — their patterns and motivations.',
          icon: Users2,
          accent: 'text-purple',
          iconBg: 'bg-purple/10',
        },
      ],
    },
    ...(topicId
      ? [
          {
            id: 'topic',
            title: 'Source Topic',
            description: 'The civic topic this law was distilled from — explore the full debate.',
            color: 'text-gold',
            borderColor: 'border-gold/20',
            tools: [
              {
                href: `/topic/${topicId}`,
                label: 'Topic',
                description: topicStatement
                  ? topicStatement.length > 55
                    ? topicStatement.slice(0, 55) + '…'
                    : topicStatement
                  : 'View the civic topic that became this law.',
                icon: Scale,
                accent: 'text-for-400',
                iconBg: 'bg-for-500/10',
              },
              {
                href: `/topic/${topicId}/explore`,
                label: 'Topic Hub',
                description: 'All 80+ analysis tools for the source topic — votes, arguments, AI.',
                icon: Zap,
                accent: 'text-gold',
                iconBg: 'bg-gold/10',
              },
              {
                href: `/topic/${topicId}/arguments`,
                label: 'Arguments',
                description: 'The strongest FOR and AGAINST arguments from the debate.',
                icon: Shield,
                accent: 'text-against-400',
                iconBg: 'bg-against-500/10',
              },
              {
                href: `/topic/${topicId}/voters`,
                label: 'Original Voters',
                description: 'Who voted on the source topic — the citizens that established this law.',
                icon: Users,
                accent: 'text-emerald',
                iconBg: 'bg-emerald/10',
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
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to law
        </Link>

        {/* ── Header ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="law" size="sm">
              Established Law
            </Badge>
            {category && (
              <span className="text-xs font-mono text-surface-500 px-2 py-0.5 rounded-md bg-surface-200 border border-surface-300">
                {category}
              </span>
            )}
            {totalVotes != null && totalVotes > 0 && (
              <span className="text-xs font-mono text-surface-500">
                {totalVotes.toLocaleString()} votes
              </span>
            )}
            {forPct != null && (
              <span className="text-xs font-mono text-for-400">
                {forPct}% for
              </span>
            )}
          </div>

          <h1 className="text-xl md:text-2xl font-mono font-bold text-white leading-snug mb-2">
            {statement}
          </h1>

          {establishedAt && (
            <p className="text-xs font-mono text-surface-500">
              Established{' '}
              {new Date(establishedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}

          {topicStatement && (
            <div className="mt-3 pt-3 border-t border-surface-300/50">
              <p className="text-[11px] font-mono text-surface-600 uppercase tracking-widest mb-1">
                Source Topic
              </p>
              <p className="text-sm text-surface-300 leading-snug">{topicStatement}</p>
            </div>
          )}
        </div>

        {/* ── Section note ── */}
        <div className="flex items-start gap-2 px-1">
          <Lightbulb className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-surface-500">
            This law was established by community consensus. Explore its full record below — from the
            original debate to impact analysis and proposed amendments.
          </p>
        </div>

        {/* ── Tool sections ── */}
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <SectionBlock key={section.id} section={section} lawId={lawId} />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2">
          <Link
            href="/law"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-600 hover:text-surface-400 transition-colors"
          >
            <BookOpen className="h-3 w-3" />
            Law Codex
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
