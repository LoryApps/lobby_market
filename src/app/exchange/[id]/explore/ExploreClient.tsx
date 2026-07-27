'use client'

/**
 * /exchange/[id]/explore — Market Analysis Hub
 *
 * A discovery page that surfaces ALL analysis tools available for a prediction
 * market, organised into six thematic sections. Every card links to a sub-page.
 *
 * Sections:
 *   1. Trading & Price      — chart, orderbook, depth, flow, conviction, momentum
 *   2. Research & Analysis  — brief, fundamentals, research, model, scenarios, simulation
 *   3. Debate & Community   — arguments, commentary, debates, coalitions, crowd, ideas
 *   4. Risk & Intelligence  — risk, exposure, signal, quality, scorecard, smart-money
 *   5. Market Context       — narrative, catalysts, news, sentiment, consensus, similar
 *   6. Activity & Records   — activity, timeline, milestones, verdict, resolution, digest
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  Crosshair,
  Dna,
  Eye,
  FileText,
  Flame,
  Gauge,
  GitBranch,
  Globe,
  Handshake,

  Layers,
  Lightbulb,
  MessageSquare,
  Network,
  Newspaper,
  NotebookPen,
  Radio,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  Trophy,
  Users,

  Waves,
  Zap,
  Radar,
  Droplets,
  Wind,

  GitMerge,
  Heart,
  ScrollText,

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
  marketId: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Resolved YES',
  failed: 'Resolved NO',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Tool Card ────────────────────────────────────────────────────────────────

function ToolCardItem({ tool, marketId }: { tool: ToolCard; marketId: string }) {
  const Icon = tool.icon
  const href = `/exchange/${marketId}${tool.href}`

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
  marketId,
}: {
  section: Section
  marketId: string
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
            <ToolCardItem key={tool.href} tool={tool} marketId={marketId} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExchangeExploreClient({
  marketId,
  statement,
  category,
  status,
  price,
  volume,
}: Props) {
  const priceClass = priceColor(price, status)

  const SECTIONS: Section[] = [
    {
      id: 'trading',
      title: 'Trading & Price',
      description: 'Price charts, order flow, depth, and conviction data.',
      color: 'text-gold',
      borderColor: 'border-gold/20',
      tools: [
        {
          href: '/chart',
          label: 'Price Chart',
          description: 'Interactive candlestick and line chart with volume overlays',
          icon: BarChart2,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/orderbook',
          label: 'Order Book',
          description: 'Live bid/ask depth showing where volume sits',
          icon: Layers,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/depth',
          label: 'Market Depth',
          description: 'Cumulative depth curve by price level',
          icon: Droplets,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/flow',
          label: 'Trade Flow',
          description: 'Buy vs sell flow analysis and order imbalance',
          icon: Activity,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/conviction',
          label: 'Conviction',
          description: 'How strongly the market believes in the current price',
          icon: Target,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/momentum',
          label: 'Momentum',
          description: 'Price velocity, acceleration, and trend strength',
          icon: Zap,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/volatility',
          label: 'Volatility',
          description: 'Historical volatility bands and variance analysis',
          icon: Waves,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/swing',
          label: 'Swing Analysis',
          description: 'Largest price swings and what triggered them',
          icon: Wind,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
      ],
    },
    {
      id: 'research',
      title: 'Research & Analysis',
      description: 'Deep fundamental analysis, models, and scenario planning.',
      color: 'text-emerald',
      borderColor: 'border-emerald/20',
      tools: [
        {
          href: '/brief',
          label: 'Market Brief',
          description: 'AI-generated summary of the market thesis and key drivers',
          icon: BookOpen,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
          badge: 'AI',
        },
        {
          href: '/fundamentals',
          label: 'Fundamentals',
          description: 'Underlying civic factors driving this market\'s price',
          icon: Dna,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/research',
          label: 'Research',
          description: 'In-depth background research and referenced studies',
          icon: FileText,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/model',
          label: 'Market Model',
          description: 'Probability model decomposition and factor weights',
          icon: Network,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
          badge: 'AI',
        },
        {
          href: '/scenarios',
          label: 'Scenarios',
          description: 'Bull, base, and bear case scenarios with price targets',
          icon: GitBranch,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/simulation',
          label: 'Simulation',
          description: 'Monte Carlo price simulation based on current variables',
          icon: Radar,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/playbook',
          label: 'Playbook',
          description: 'Strategic trading playbook for this market',
          icon: NotebookPen,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/prep',
          label: 'Debate Prep',
          description: 'Key arguments and counterarguments to know before trading',
          icon: Shield,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
      ],
    },
    {
      id: 'debate',
      title: 'Debate & Community',
      description: 'Arguments, commentary, coalitions, and collective intelligence.',
      color: 'text-purple',
      borderColor: 'border-purple/20',
      tools: [
        {
          href: '/arguments',
          label: 'Arguments',
          description: 'Top FOR and AGAINST arguments from market participants',
          icon: Swords,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/commentary',
          label: 'Commentary',
          description: 'Expert and community commentary on market moves',
          icon: MessageSquare,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/debates',
          label: 'Debates',
          description: 'Scheduled live debates about this market\'s outcome',
          icon: MessageSquare,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/coalitions',
          label: 'Coalitions',
          description: 'Organised trading groups and their market positions',
          icon: Handshake,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/crowd',
          label: 'Crowd Wisdom',
          description: 'Aggregated community forecasts and prediction intervals',
          icon: Users,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/ideas',
          label: 'Market Ideas',
          description: 'Trader-submitted thesis and trading ideas',
          icon: Lightbulb,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/persuasion',
          label: 'Persuasion',
          description: 'Most persuasive arguments ranked by mind-changing impact',
          icon: Sparkles,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/traders',
          label: 'Traders',
          description: 'Active participants ranked by accuracy and volume',
          icon: Trophy,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
      ],
    },
    {
      id: 'risk',
      title: 'Risk & Intelligence',
      description: 'Smart money signals, quality scores, and risk assessment.',
      color: 'text-against-400',
      borderColor: 'border-against-600/20',
      tools: [
        {
          href: '/risk',
          label: 'Risk Analysis',
          description: 'Tail risks, black swans, and downside scenarios',
          icon: TrendingDown,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/exposure',
          label: 'Exposure',
          description: 'Who\'s exposed and to what degree — concentration risk',
          icon: Eye,
          accent: 'text-against-300',
          iconBg: 'bg-against-700/15',
        },
        {
          href: '/smart-money',
          label: 'Smart Money',
          description: 'Track top forecaster positions and contrarian signals',
          icon: Brain,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
          badge: 'ALPHA',
        },
        {
          href: '/signal',
          label: 'Market Signal',
          description: 'Composite signal: trend, volume, sentiment, and quality',
          icon: Radio,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/quality',
          label: 'Quality Score',
          description: 'Market quality metrics: liquidity, participation, depth',
          icon: Award,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/scorecard',
          label: 'Scorecard',
          description: 'Graded assessment across five market health dimensions',
          icon: Gauge,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/leaderboard',
          label: 'Leaderboard',
          description: 'Top performers on this market by accuracy and clout earned',
          icon: Trophy,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/notes',
          label: 'My Notes',
          description: 'Private research journal and trade thesis notes',
          icon: NotebookPen,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
      ],
    },
    {
      id: 'context',
      title: 'Market Context',
      description: 'Narrative, sentiment, news, and comparable markets.',
      color: 'text-for-300',
      borderColor: 'border-for-600/20',
      tools: [
        {
          href: '/narrative',
          label: 'Narrative',
          description: 'The dominant story driving price — and how it\'s shifting',
          icon: ScrollText,
          accent: 'text-for-300',
          iconBg: 'bg-for-700/15',
        },
        {
          href: '/catalysts',
          label: 'Catalysts',
          description: 'Key events that could move the price in either direction',
          icon: Flame,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/news',
          label: 'News',
          description: 'Curated news coverage relevant to this market',
          icon: Newspaper,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/sentiment',
          label: 'Sentiment',
          description: 'Market sentiment breakdown: bullish, bearish, neutral',
          icon: Heart,
          accent: 'text-against-300',
          iconBg: 'bg-against-700/15',
        },
        {
          href: '/consensus',
          label: 'Consensus',
          description: 'Where community forecasts cluster and where they diverge',
          icon: Scale,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/similar',
          label: 'Similar Markets',
          description: 'Comparable markets by topic, category, and price action',
          icon: GitMerge,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
        {
          href: '/ripple',
          label: 'Ripple Effects',
          description: 'Downstream impacts if this market resolves YES or NO',
          icon: Waves,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/impact',
          label: 'Civic Impact',
          description: 'Real-world policy implications of each resolution outcome',
          icon: Globe,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
      ],
    },
    {
      id: 'history',
      title: 'Activity & Records',
      description: 'Trade history, milestones, resolution records, and digests.',
      color: 'text-surface-400',
      borderColor: 'border-surface-400/20',
      tools: [
        {
          href: '/activity',
          label: 'Activity',
          description: 'Full trade and event log for this market',
          icon: Activity,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/timeline',
          label: 'Timeline',
          description: 'Chronological history of price and key events',
          icon: Clock,
          accent: 'text-for-400',
          iconBg: 'bg-for-600/15',
        },
        {
          href: '/milestones',
          label: 'Milestones',
          description: 'Notable price levels and participation milestones hit',
          icon: Award,
          accent: 'text-gold',
          iconBg: 'bg-gold/10',
        },
        {
          href: '/verdict',
          label: 'Verdict',
          description: 'Post-resolution verdict and outcome analysis',
          icon: Scale,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/resolution',
          label: 'Resolution',
          description: 'Resolution criteria, process, and final settlement details',
          icon: Crosshair,
          accent: 'text-against-400',
          iconBg: 'bg-against-600/15',
        },
        {
          href: '/anatomy',
          label: 'Market Anatomy',
          description: 'Structural breakdown of how this market was composed',
          icon: Dna,
          accent: 'text-purple',
          iconBg: 'bg-purple/15',
        },
        {
          href: '/digest',
          label: 'Weekly Digest',
          description: '7-day snapshot of price moves, arguments, and activity',
          icon: FileText,
          accent: 'text-surface-400',
          iconBg: 'bg-surface-300/20',
        },
        {
          href: '/analysis',
          label: 'Analysis',
          description: 'Structured quantitative analysis of market data',
          icon: BarChart2,
          accent: 'text-emerald',
          iconBg: 'bg-emerald/10',
        },
      ],
    },
  ]

  const totalTools = SECTIONS.reduce((acc, s) => acc + s.tools.length, 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + Header */}
        <div className="mb-6">
          <Link
            href={`/exchange/${marketId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to market
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
                Analysis Hub — {totalTools} tools across {SECTIONS.length} categories
              </p>
            </div>

            {/* Price + Volume pill */}
            <div className="flex-shrink-0 flex items-center gap-2 bg-surface-100 border border-surface-300/50 rounded-xl px-4 py-2.5">
              <div className="text-right">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Price</p>
                <p className={cn('text-xl font-mono font-bold', priceClass)}>{price}¢</p>
              </div>
              <div className="h-8 w-px bg-surface-300/50" />
              <div className="text-right">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Volume</p>
                <p className="text-xl font-mono font-bold text-surface-300">{formatVolume(volume)}</p>
              </div>
            </div>
          </div>

          {/* Price bar */}
          <div className="mt-3 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-500 to-gold transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, price))}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-against-500">0¢ NO</span>
            <span className="text-[10px] font-mono text-gold">100¢ YES</span>
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
              <SectionBlock section={section} marketId={marketId} />
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 pt-8 border-t border-surface-300/30 text-center">
          <p className="text-sm text-surface-500 mb-4">
            Want to trade this market? Go to the full market page.
          </p>
          <Link
            href={`/exchange/${marketId}`}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
              'bg-gold/10 border border-gold/30 text-gold',
              'hover:bg-gold/20 hover:border-gold/50 transition-all',
              'text-sm font-mono font-semibold',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to market
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
