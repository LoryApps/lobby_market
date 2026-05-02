import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  Award,
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  Coins,
  Flame,
  Gamepad2,
  Gavel,
  GitBranch,
  Globe,
  Layers,
  MessageSquare,
  Mic,
  Network,
  Rocket,
  Scale,
  Search,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Changelog · Lobby Market',
  description:
    'The full feature history of Lobby Market — every debate system, civic tool, and community feature built into the platform.',
  openGraph: {
    title: 'Changelog · Lobby Market',
    description:
      "From the first vote to the full civic engine — every feature we've shipped.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Changelog · Lobby Market',
    description: "The complete history of Lobby Market's features.",
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangeItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  color: string
}

interface Chapter {
  number: string
  title: string
  subtitle: string
  accent: string
  borderColor: string
  bgColor: string
  textColor: string
  items: ChangeItem[]
}

// ─── Chapters ─────────────────────────────────────────────────────────────────

const CHAPTERS: Chapter[] = [
  {
    number: 'Ch. 1',
    title: 'The Foundation',
    subtitle: 'Auth, topic feed, and binary voting',
    accent: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    textColor: 'text-for-300',
    items: [
      { icon: Vote, label: 'Binary voting — For / Against', href: '/', color: 'text-for-400' },
      { icon: Flame, label: 'Topic feed with real-time scores', href: '/', color: 'text-for-400' },
      { icon: Users, label: 'Auth, sign-up, and user profiles', href: '/signup', color: 'text-purple' },
      { icon: Gavel, label: 'Topic lifecycle: proposed → active → voting → law', href: '/pipeline', color: 'text-gold' },
      { icon: Scale, label: 'Vote threshold system', href: '/', color: 'text-for-400' },
      { icon: CheckCircle2, label: 'Onboarding quiz for feed personalisation', href: '/onboarding', color: 'text-emerald' },
    ],
  },
  {
    number: 'Ch. 2',
    title: 'The Debate Layer',
    subtitle: 'Arguments, live debates, and vote chains',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: MessageSquare, label: 'Arguments with FOR / AGAINST sides', href: '/arguments', color: 'text-for-400' },
      { icon: Mic, label: 'Live structured debates (Oxford, Panel, Town Hall)', href: '/debate', color: 'text-gold' },
      { icon: GitBranch, label: 'Topic chains — debates that spawn from debates', href: '/chains', color: 'text-purple' },
      { icon: Swords, label: 'Duel mode — head-to-head argument battles', href: '/duel', color: 'text-against-400' },
      { icon: Activity, label: 'Debate scheduling and RSVP', href: '/calendar', color: 'text-for-400' },
      { icon: Scale, label: 'The Floor — parliamentary chamber view', href: '/floor', color: 'text-for-300' },
    ],
  },
  {
    number: 'Ch. 3',
    title: 'The Law Codex',
    subtitle: 'Turning consensus into a living legal document',
    accent: 'text-gold',
    borderColor: 'border-gold/30',
    bgColor: 'bg-gold/5',
    textColor: 'text-gold',
    items: [
      { icon: Gavel, label: 'Law codex — browse all established laws', href: '/law', color: 'text-gold' },
      { icon: Network, label: 'Law graph — interactive knowledge network', href: '/law/graph', color: 'text-purple' },
      { icon: BarChart2, label: 'Law atlas — scope × category heatmap', href: '/law/atlas', color: 'text-for-400' },
      { icon: Activity, label: 'Law timeline — history of legislation', href: '/law/timeline', color: 'text-emerald' },
      { icon: BookOpen, label: 'Wiki editor — collaborative law documentation', href: '/topic', color: 'text-for-300' },
      { icon: Scale, label: 'Amendment chamber — refine established laws', href: '/amendments', color: 'text-gold' },
    ],
  },
  {
    number: 'Ch. 4',
    title: 'Social Architecture',
    subtitle: 'Profiles, reputation, clout, and leaderboards',
    accent: 'text-emerald',
    borderColor: 'border-emerald/30',
    bgColor: 'bg-emerald/5',
    textColor: 'text-emerald',
    items: [
      { icon: Users, label: 'Rich profiles with vote history and stats', href: '/profile/me', color: 'text-for-400' },
      { icon: TrendingUp, label: 'Leaderboard — reputation, laws, arguments', href: '/leaderboard', color: 'text-gold' },
      { icon: Coins, label: 'Clout economy — earn and spend civic currency', href: '/clout', color: 'text-gold' },
      { icon: Award, label: 'Achievement system with 40+ unlock conditions', href: '/achievements', color: 'text-gold' },
      { icon: Flame, label: 'Voting streaks and daily quorum', href: '/streaks', color: 'text-against-400' },
      { icon: Users, label: 'Follow system and personalised feed', href: '/following', color: 'text-purple' },
    ],
  },
  {
    number: 'Ch. 5',
    title: 'Coalitions & Moderation',
    subtitle: 'Persistent alliances and community governance',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Building2, label: 'Lobby coalitions — create or join political alliances', href: '/coalitions', color: 'text-purple' },
      { icon: Shield, label: 'Moderation system — flag, review, and enforce', href: '/moderation', color: 'text-against-400' },
      { icon: Globe, label: 'Coalition stances — official positions on debates', href: '/coalitions', color: 'text-for-400' },
      { icon: TrendingUp, label: 'Coalition standings and influence rankings', href: '/coalitions/standings', color: 'text-gold' },
      { icon: Users, label: 'Coalition bulletin board and recruiting', href: '/coalitions', color: 'text-purple' },
      { icon: Bell, label: 'Notification system with 18 event types', href: '/notifications', color: 'text-for-300' },
    ],
  },
  {
    number: 'Ch. 6',
    title: 'Discovery & Search',
    subtitle: 'Find what matters with full-text search and smart filters',
    accent: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    textColor: 'text-for-300',
    items: [
      { icon: Search, label: 'Full-text search — topics, laws, people, arguments', href: '/search', color: 'text-for-400' },
      { icon: Layers, label: 'Category browser — filter by subject area', href: '/categories', color: 'text-purple' },
      { icon: TrendingUp, label: 'Trending page — real-time platform momentum', href: '/trending', color: 'text-for-400' },
      { icon: Sparkles, label: 'Discover page — curated topics by category', href: '/discover', color: 'text-gold' },
      { icon: Activity, label: 'Topic subscriptions — watchlist and alerts', href: '/watchlist', color: 'text-emerald' },
      { icon: Users, label: 'Citizens directory — browse all platform users', href: '/citizens', color: 'text-for-300' },
    ],
  },
  {
    number: 'Ch. 7',
    title: 'Intelligence Layer',
    subtitle: 'AI-powered civic tools built on Claude',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Bot, label: 'Argument Coach — AI critique across 4 dimensions', href: '/coach', color: 'text-purple' },
      { icon: Scale, label: 'Claim Checker — verify claims against the Codex', href: '/checker', color: 'text-for-400' },
      { icon: Activity, label: 'Policy Simulator — model outcomes with Claude', href: '/simulate', color: 'text-emerald' },
      { icon: Sparkles, label: 'Oracle — AI debate outcome prediction', href: '/oracle', color: 'text-gold' },
      { icon: BookOpen, label: 'Topic AI Briefs — auto-generated summaries', href: '/brief', color: 'text-for-300' },
      { icon: Zap, label: 'Manifesto Generator — AI writes your civic platform', href: '/manifesto', color: 'text-purple' },
    ],
  },
  {
    number: 'Ch. 8',
    title: 'Civic Games Arcade',
    subtitle: 'Daily challenges and competitive civic puzzles',
    accent: 'text-gold',
    borderColor: 'border-gold/30',
    bgColor: 'bg-gold/5',
    textColor: 'text-gold',
    items: [
      { icon: Gamepad2, label: 'Civic Wordle — daily 5-letter civic word puzzle', href: '/wordle', color: 'text-for-400' },
      { icon: Gamepad2, label: 'Connections — group civic terms into categories', href: '/connections', color: 'text-purple' },
      { icon: Gamepad2, label: 'Civic Crossword — daily clue grid', href: '/crossword', color: 'text-gold' },
      { icon: Gamepad2, label: 'Cloze — fill-in-the-blank from real laws', href: '/cloze', color: 'text-emerald' },
      { icon: Swords, label: 'The Arena — argument quality judging battles', href: '/arena', color: 'text-against-400' },
      { icon: Scale, label: 'Civic Match — swipe to rank policy topics', href: '/match', color: 'text-for-400' },
      { icon: TrendingUp, label: 'Civic Bracket — tournament of most urgent debates', href: '/bracket', color: 'text-gold' },
      { icon: Zap, label: 'Rapid Fire — fast-paced civic Q&A', href: '/rapid', color: 'text-gold' },
    ],
  },
  {
    number: 'Ch. 9',
    title: 'Analytics & Visualisations',
    subtitle: 'See the data behind democracy',
    accent: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    textColor: 'text-for-300',
    items: [
      { icon: BarChart2, label: 'Personal analytics dashboard', href: '/analytics', color: 'text-for-400' },
      { icon: Network, label: 'Topic network graph — how debates cluster', href: '/topic/graph', color: 'text-purple' },
      { icon: Activity, label: 'Polarisation index — platform consensus health', href: '/polarization', color: 'text-against-400' },
      { icon: TrendingUp, label: 'Drift tracker — how positions shift over time', href: '/drift', color: 'text-for-400' },
      { icon: BarChart2, label: 'Vote heatmap — category × scope matrix', href: '/heatmap', color: 'text-emerald' },
      { icon: Globe, label: 'Civic Compass — your political co-ordinates', href: '/compass', color: 'text-gold' },
      { icon: Network, label: 'Personal mind map — Obsidian-style knowledge graph', href: '/mindmap', color: 'text-purple' },
    ],
  },
  {
    number: 'Ch. 10',
    title: 'Community & Communication',
    subtitle: 'Private messages, journals, and civic memory',
    accent: 'text-emerald',
    borderColor: 'border-emerald/30',
    bgColor: 'bg-emerald/5',
    textColor: 'text-emerald',
    items: [
      { icon: MessageSquare, label: 'Direct messages — private 1-to-1 conversations', href: '/messages', color: 'text-for-300' },
      { icon: BookOpen, label: 'Civic Journal — personal diary tied to debates', href: '/journal', color: 'text-gold' },
      { icon: Gavel, label: 'Time Capsules — seal predictions, reveal on resolution', href: '/capsule', color: 'text-purple' },
      { icon: MessageSquare, label: 'Argument reply threads with @-mentions', href: '/arguments', color: 'text-for-400' },
      { icon: Activity, label: 'Topic chat — live commentary alongside debates', href: '/topic', color: 'text-emerald' },
      { icon: BookOpen, label: 'Civic Flashcards — study established laws', href: '/flashcards', color: 'text-for-300' },
    ],
  },
  {
    number: 'Ch. 11',
    title: 'Sharing & Distribution',
    subtitle: 'Bring the civic conversation everywhere',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Rocket, label: 'Dynamic Open Graph images for every topic', href: '/topic', color: 'text-for-400' },
      { icon: Globe, label: 'Embeddable vote widget for external sites', href: '/widget', color: 'text-purple' },
      { icon: Activity, label: 'RSS feed — laws and active topics', href: '/api/rss', color: 'text-gold' },
      { icon: BookOpen, label: 'Shareable profile and weekly recap cards', href: '/share', color: 'text-for-300' },
      { icon: Scale, label: 'Topic Recap page — narrative summary for resolved debates', href: '/topic', color: 'text-emerald' },
      { icon: Sparkles, label: 'Argument word cloud — vocabulary heatmap', href: '/topic', color: 'text-purple' },
      { icon: BookOpen, label: 'Developer API documentation', href: '/developers', color: 'text-for-300' },
    ],
  },
  {
    number: 'Ch. 12',
    title: 'Deeper Analytics',
    subtitle: 'More ways to understand your civic voice',
    accent: 'text-against-400',
    borderColor: 'border-against-500/30',
    bgColor: 'bg-against-500/5',
    textColor: 'text-against-400',
    items: [
      { icon: TrendingUp, label: 'Opinion Evolution Tracker — 12-week category drift by week', href: '/analytics/evolution', color: 'text-for-400' },
      { icon: BarChart2, label: 'Sentiment Explorer — emotional tone of civic arguments', href: '/analytics/sentiment', color: 'text-against-400' },
    ],
  },
]

// ─── Stat pills ───────────────────────────────────────────────────────────────

const STATS = [
  { value: '12', label: 'chapters shipped' },
  { value: '82+', label: 'features built' },
  { value: '51', label: 'DB migrations' },
  { value: '88', label: 'API routes' },
]

// ─── Recent builds ────────────────────────────────────────────────────────────

interface RecentBuild {
  title: string
  description: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  tag: string
}

const RECENT_BUILDS: RecentBuild[] = [
  {
    title: 'Sentiment Explorer',
    description: 'Lexicon-based analysis of the emotional tone of civic arguments — see which categories debate with hope vs concern, and how your own voice compares.',
    href: '/analytics/sentiment',
    icon: BarChart2,
    color: 'text-against-400',
    tag: 'Analytics',
  },
  {
    title: 'Argument Word Cloud',
    description: 'Visual vocabulary heatmap showing the most-used words in FOR and AGAINST arguments for any debate.',
    href: '/topic',
    icon: Sparkles,
    color: 'text-purple',
    tag: 'Visualisation',
  },
  {
    title: 'Direct Messages',
    description: 'Private 1-to-1 messaging between platform citizens. Coordinate coalitions, challenge debaters, and follow up on arguments.',
    href: '/messages',
    icon: MessageSquare,
    color: 'text-for-400',
    tag: 'Social',
  },
  {
    title: 'Topic Recap Page',
    description: 'A shareable narrative summary for any resolved debate — the final vote, top arguments, and what happened.',
    href: '/topic',
    icon: BookOpen,
    color: 'text-gold',
    tag: 'Content',
  },
  {
    title: 'Argument Reply Threads',
    description: 'Nested reply threads with @-mentions, citation linking, and source URLs on all debate arguments.',
    href: '/arguments',
    icon: MessageSquare,
    color: 'text-emerald',
    tag: 'Debate',
  },
  {
    title: 'Civic Flashcards',
    description: 'Self-paced study mode for established laws — flip, reveal, and test yourself on the Lobby Codex.',
    href: '/flashcards',
    icon: BookOpen,
    color: 'text-for-300',
    tag: 'Learning',
  },
  {
    title: 'Platform Changelog',
    description: 'This page — a complete history of every feature shipped to Lobby Market, organised by chapter.',
    icon: Rocket,
    color: 'text-gold',
    tag: 'Meta',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-10 pb-28">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-for-500/10 border border-for-500/20 text-for-400 text-xs font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-for-400 animate-pulse" />
              Active development
            </span>
          </div>
          <h1 className="font-mono text-4xl font-bold text-white mb-3 leading-tight">
            Platform Changelog
          </h1>
          <p className="text-surface-500 font-mono text-base leading-relaxed max-w-xl">
            Every feature ever shipped to Lobby Market — the civic consensus
            engine built chapter by chapter.
          </p>

          {/* Stats row */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
              >
                <div className="font-mono text-2xl font-bold text-white">{s.value}</div>
                <div className="text-[11px] font-mono text-surface-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recently shipped */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" aria-hidden="true" />
            <h2 className="font-mono text-sm font-semibold text-emerald uppercase tracking-widest">
              Recently shipped
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RECENT_BUILDS.map((build) => {
              const Icon = build.icon
              const inner = (
                <div
                  key={build.title}
                  className="rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 hover:bg-surface-200/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', build.color)} aria-hidden="true" />
                    <span className="text-[10px] font-mono text-surface-500 px-1.5 py-0.5 rounded-md bg-surface-200 border border-surface-300">
                      {build.tag}
                    </span>
                  </div>
                  <p className="text-sm font-mono font-semibold text-white mb-1">{build.title}</p>
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">{build.description}</p>
                </div>
              )
              return build.href ? (
                <Link key={build.title} href={build.href} className="contents">
                  {inner}
                </Link>
              ) : inner
            })}
          </div>
        </section>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-surface-300" aria-hidden="true" />

          <div className="space-y-10">
            {CHAPTERS.map((chapter) => (
              <ChapterBlock key={chapter.number} chapter={chapter} />
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 rounded-2xl border border-for-500/20 bg-for-500/5 px-6 py-8 text-center">
          <div className="font-mono text-xs text-for-400 uppercase tracking-widest mb-2">
            The build continues
          </div>
          <h2 className="font-mono text-xl font-bold text-white mb-3">
            Join the debate
          </h2>
          <p className="text-sm text-surface-500 font-mono mb-6 max-w-sm mx-auto">
            Every vote, argument, and law matters. Help shape consensus on the
            topics that define our time.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-semibold transition-colors"
            >
              Browse the feed
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 text-surface-600 hover:text-white text-sm font-mono transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}

// ─── Chapter block ────────────────────────────────────────────────────────────

function ChapterBlock({ chapter }: { chapter: Chapter }) {
  return (
    <div className="relative pl-12">
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-0 top-1 h-9 w-9 rounded-full border-2 flex items-center justify-center',
          'bg-surface-100',
          chapter.borderColor,
        )}
        aria-hidden="true"
      >
        <span className={cn('text-[10px] font-mono font-bold leading-none', chapter.accent)}>
          {chapter.number.replace('Ch. ', '')}
        </span>
      </div>

      {/* Card */}
      <div className={cn('rounded-2xl border p-5', chapter.borderColor, chapter.bgColor)}>
        {/* Header */}
        <div className="mb-4">
          <div className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest mb-1', chapter.textColor)}>
            {chapter.number}
          </div>
          <h2 className="font-mono text-lg font-bold text-white leading-tight">
            {chapter.title}
          </h2>
          <p className="text-sm text-surface-500 font-mono mt-0.5">
            {chapter.subtitle}
          </p>
        </div>

        {/* Feature list */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {chapter.items.map((item) => {
            const Icon = item.icon
            const inner = (
              <li
                key={item.label}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs font-mono',
                  'border border-surface-300/40 bg-surface-100/60',
                  item.href && 'hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors cursor-pointer'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', item.color)} aria-hidden="true" />
                <span className="text-surface-600 leading-relaxed">{item.label}</span>
              </li>
            )
            return item.href ? (
              <Link key={item.label} href={item.href} className="contents">
                {inner}
              </Link>
            ) : inner
          })}
        </ul>
      </div>
    </div>
  )
}
