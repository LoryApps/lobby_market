'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  Bell,
  Bookmark,
  BookOpen,
  Brain,
  Calendar,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Dna,
  FileText,
  Fingerprint,
  Flame,
  FlaskConical,
  Gamepad2,
  Gavel,
  GitBranch,
  GitMerge,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  History,
  Landmark,
  Layers,
  LayoutGrid,
  Map,
  MessageSquare,
  Mic,
  Network,
  Quote,
  Radio,
  Scale,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Swords,
  Tag,
  Target,
  ThumbsUp,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Wand2,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureItem {
  href: string
  label: string
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

interface FeatureSection {
  id: string
  title: string
  description: string
  color: string
  bg: string
  border: string
  icon: React.ComponentType<{ className?: string }>
  features: FeatureItem[]
}

// ─── Feature data ─────────────────────────────────────────────────────────────

const SECTIONS: FeatureSection[] = [
  {
    id: 'vote',
    title: 'Vote & Decide',
    description: 'The heart of Lobby Market — your voice on civic topics.',
    color: 'text-for-400',
    bg: 'bg-for-500/8',
    border: 'border-for-500/20',
    icon: Vote,
    features: [
      { href: '/', label: 'Home Feed', sublabel: 'Swipe and vote on live topics', icon: Flame },
      { href: '/swipe', label: 'Swipe Mode', sublabel: 'One-by-one focused voting', icon: ThumbsUp },
      { href: '/topics', label: 'All Topics', sublabel: 'Browse and filter every debate', icon: Layers },
      { href: '/session', label: 'Daily Session', sublabel: '5 curated topics every day', icon: Calendar },
      { href: '/blitz', label: 'Blitz Mode', sublabel: 'Vote 20 topics in 60 seconds', icon: Timer, badge: 'Fast' },
      { href: '/rapid', label: 'Rapid Fire', sublabel: 'Endless quick-fire voting', icon: Zap },
      { href: '/challenge', label: 'Daily Quorum', sublabel: 'Your daily civic duty', icon: Target },
      { href: '/floor', label: 'The Floor', sublabel: 'High-stakes binding votes', icon: Gavel, badge: 'Live' },
      { href: '/ballot', label: 'Ballot Box', sublabel: 'Official vote tally', icon: ScrollText },
      { href: '/delegate', label: 'Vote Delegation', sublabel: 'Let a trusted user vote for you', icon: Users },
    ],
  },
  {
    id: 'debate',
    title: 'Debate & Argue',
    description: 'Put your reasoning to the test.',
    color: 'text-against-400',
    bg: 'bg-against-500/8',
    border: 'border-against-500/20',
    icon: Mic,
    features: [
      { href: '/debate', label: 'Live Debates', sublabel: 'Scheduled real-time debates', icon: Mic, badge: 'Live' },
      { href: '/arguments', label: 'Arguments', sublabel: 'Write and rate civic arguments', icon: Quote },
      { href: '/duel', label: 'Argument Duel', sublabel: 'Head-to-head argument battle', icon: Swords },
      { href: '/crossfire', label: 'The Crossfire', sublabel: 'Rapid counter-argument exchange', icon: Swords },
      { href: '/argument-battle', label: 'Argument Battle', sublabel: 'Best argument bracket', icon: Trophy },
      { href: '/tribunal', label: 'The Tribunal', sublabel: 'Peer review of arguments', icon: Scale },
      { href: '/ama', label: 'Expert AMAs', sublabel: 'Ask-me-anything with experts', icon: GraduationCap },
      { href: '/spar', label: 'AI Sparring', sublabel: 'Practice against AI opponent', icon: Brain },
      { href: '/steelman', label: 'Steelman Engine', sublabel: 'Best case for any side', icon: Shield },
      { href: '/workshop', label: 'Argument Workshop', sublabel: 'Refine your arguments', icon: Wand2 },
    ],
  },
  {
    id: 'discover',
    title: 'Discover & Explore',
    description: 'Find what matters to you.',
    color: 'text-emerald',
    bg: 'bg-emerald/8',
    border: 'border-emerald/20',
    icon: Search,
    features: [
      { href: '/search', label: 'Global Search', sublabel: 'Topics, users, laws, arguments', icon: Search },
      { href: '/trending', label: 'Trending', sublabel: 'What\'s hot right now', icon: TrendingUp },
      { href: '/categories', label: 'Categories', sublabel: 'Browse by topic category', icon: LayoutGrid },
      { href: '/tags', label: 'Civic Tags', sublabel: 'Filter by tag across the platform', icon: Tag },
      { href: '/for-you', label: 'For You', sublabel: 'Personalised recommendations', icon: Sparkles, badge: 'AI' },
      { href: '/explore', label: 'Explore', sublabel: 'Discover new topics & people', icon: Compass },
      { href: '/following', label: 'Following Feed', sublabel: 'What your network is debating', icon: Users },
      { href: '/today', label: 'Today', sublabel: 'Daily snapshot of the Lobby', icon: Calendar },
      { href: '/canary', label: 'The Canary', sublabel: 'Early signals before they trend', icon: Bell },
      { href: '/nexus', label: 'Topic Nexus', sublabel: 'Knowledge graph of all debates', icon: Network },
    ],
  },
  {
    id: 'community',
    title: 'Community & Social',
    description: 'Connect, collaborate, and build coalitions.',
    color: 'text-purple',
    bg: 'bg-purple/8',
    border: 'border-purple/20',
    icon: Users,
    features: [
      { href: '/charter', label: 'Civic Charter', sublabel: 'Platform principles & signatories', icon: BookOpen },
      { href: '/profile/me', label: 'My Profile', sublabel: 'Your civic identity', icon: Users },
      { href: '/coalitions', label: 'Coalitions', sublabel: 'Join forces with like-minded voters', icon: GitMerge },
      { href: '/leaderboard', label: 'Leaderboard', sublabel: 'Top voices in the Lobby', icon: Trophy },
      { href: '/ambassador', label: 'Ambassador', sublabel: 'Grow the Lobby community', icon: Globe },
      { href: '/messages', label: 'Direct Messages', sublabel: 'Private civic conversations', icon: MessageSquare },
      { href: '/notifications', label: 'Notifications', sublabel: 'Your activity alerts', icon: Bell },
      { href: '/following', label: 'People', sublabel: 'Follow influential voices', icon: Heart },
      { href: '/bookmarks', label: 'Bookmarks', sublabel: 'Saved topics & arguments', icon: Bookmark },
      { href: '/watchlist', label: 'Watchlist', sublabel: 'Track debates you care about', icon: Bell },
      { href: '/relay', label: 'Civic Relay', sublabel: 'Collaborative argument chains', icon: GitBranch },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Insights',
    description: 'Understand your civic impact and the platform\'s pulse.',
    color: 'text-gold',
    bg: 'bg-gold/8',
    border: 'border-gold/20',
    icon: BarChart2,
    features: [
      { href: '/analytics', label: 'My Analytics', sublabel: 'Full personal stats dashboard', icon: BarChart2 },
      { href: '/fingerprint', label: 'Civic Fingerprint', sublabel: 'How unique is your voice?', icon: Fingerprint },
      { href: '/archetype', label: 'Civic Archetype', sublabel: 'Your political persona', icon: Crown },
      { href: '/analytics/dna', label: 'Argument DNA', sublabel: 'Your rhetorical style', icon: Dna },
      { href: '/analytics/calibration', label: 'Calibration', sublabel: 'Prediction accuracy analysis', icon: Target },
      { href: '/compass', label: 'Civic Compass', sublabel: 'Your position vs. the platform', icon: Compass },
      { href: '/analytics/consistency', label: 'Consistency', sublabel: 'How consistent are your views?', icon: Scale },
      { href: '/analytics/contrarian', label: 'Contrarian Score', sublabel: 'How often you go against the grain', icon: Swords },
      { href: '/correlations', label: 'Correlations Atlas', sublabel: 'Hidden ideological links', icon: Network },
      { href: '/vitals', label: 'Platform Vitals', sublabel: 'Health of the Lobby', icon: Activity },
    ],
  },
  {
    id: 'civic',
    title: 'Civic Institutions',
    description: 'Westminster-style governance simulation.',
    color: 'text-for-300',
    bg: 'bg-for-500/6',
    border: 'border-for-500/15',
    icon: Landmark,
    features: [
      { href: '/parliament', label: 'Parliament Hub', sublabel: 'The civic Westminster chamber', icon: Landmark },
      { href: '/government', label: 'HM Government', sublabel: 'The ruling coalition dashboard', icon: Landmark },
      { href: '/opposition', label: 'HM Opposition', sublabel: 'Formal opposition dashboard', icon: Scale },
      { href: '/speaker', label: 'The Speaker', sublabel: 'Westminster-style chamber chair', icon: Mic },
      { href: '/pmqs', label: 'PMQs', sublabel: 'Prime Minister\'s Questions', icon: MessageSquare },
      { href: '/assembly', label: 'Citizens\' Assembly', sublabel: 'Deliberative civic assembly', icon: Users },
      { href: '/committee-reports', label: 'Committee Reports', sublabel: 'Civic committee findings', icon: FileText },
      { href: '/edm', label: 'Early Day Motions', sublabel: 'Parliamentary notice board', icon: ScrollText },
      { href: '/ministerial-statements', label: 'Ministerial Statements', sublabel: 'Oral & written statements', icon: FileText },
      { href: '/petitions', label: 'Civic Petitions', sublabel: 'Community-backed demands', icon: FileText },
      { href: '/grand-council', label: 'Grand Council', sublabel: 'Top-level governing body', icon: Crown },
      { href: '/lords', label: 'House of Lords', sublabel: 'Second chamber reviewing laws', icon: Crown },
      { href: '/consultations', label: 'Consultations', sublabel: 'Green & White Papers, calls for evidence', icon: FileText },
    ],
  },
  {
    id: 'law',
    title: 'Laws & Legislation',
    description: 'Track what the Lobby has turned into law.',
    color: 'text-gold',
    bg: 'bg-gold/6',
    border: 'border-gold/15',
    icon: Gavel,
    features: [
      { href: '/law', label: 'Law Codex', sublabel: 'All laws passed by the Lobby', icon: BookOpen },
      { href: '/law/graph', label: 'Law Graph', sublabel: 'Visual network of all laws', icon: Network },
      { href: '/law/today', label: 'Laws Today', sublabel: 'Laws established today', icon: Calendar },
      { href: '/amendments', label: 'Amendments', sublabel: 'Challenges to existing laws', icon: ScrollText },
      { href: '/chains', label: 'Topic Chains', sublabel: 'Chain debates from laws', icon: GitBranch },
      { href: '/civic-referendums', label: 'Referendums', sublabel: 'Motions to overturn laws', icon: Scale },
      { href: '/law/atlas', label: 'Law Atlas', sublabel: 'Laws by scope and category', icon: Map },
      { href: '/law/reviews', label: 'Law Reviews', sublabel: 'Community law assessment', icon: BarChart2 },
      { href: '/changemakers', label: 'Changemakers', sublabel: 'Users who made the most laws', icon: Trophy },
      { href: '/civic-verdict', label: 'Civic Verdict', sublabel: 'Final outcomes by category', icon: Gavel },
    ],
  },
  {
    id: 'predictions',
    title: 'Predictions & Markets',
    description: 'Bet clout on civic outcomes.',
    color: 'text-purple',
    bg: 'bg-purple/8',
    border: 'border-purple/20',
    icon: FlaskConical,
    features: [
      { href: '/predictions', label: 'Predictions', sublabel: 'Make and track predictions', icon: Target, badge: 'New' },
      { href: '/forecast', label: 'Civic Forecast', sublabel: 'Platform-wide outcome forecasts', icon: FlaskConical },
      { href: '/resolutions', label: 'Resolutions', sublabel: 'Track prediction outcomes', icon: BarChart2 },
      { href: '/ranked-choice', label: 'Ranked Choice Polls', sublabel: 'Multi-option IRV polling', icon: Layers, badge: 'New' },
      { href: '/civic-polls', label: 'Civic Polls', sublabel: 'Community quick polls', icon: Vote },
      { href: '/tally', label: 'Tally Board', sublabel: 'Live vote counts', icon: Radio },
      { href: '/barometer', label: 'Barometer', sublabel: 'Opinion pressure gauge', icon: Activity },
      { href: '/vote-map', label: 'Vote Map', sublabel: 'Geographic vote distribution', icon: Map },
      { href: '/uncertainty', label: 'Uncertainty', sublabel: 'Topics with unpredictable outcomes', icon: FlaskConical },
      { href: '/calibration', label: 'Calibration', sublabel: 'Calibrate your prediction skill', icon: Target },
    ],
  },
  {
    id: 'games',
    title: 'Games & Training',
    description: 'Sharpen your civic mind.',
    color: 'text-against-300',
    bg: 'bg-against-500/6',
    border: 'border-against-500/15',
    icon: Gamepad2,
    features: [
      { href: '/arcade', label: 'Civic Arcade', sublabel: 'All games in one place', icon: Gamepad2 },
      { href: '/trivia', label: 'Civic Trivia', sublabel: 'Daily political knowledge test', icon: GraduationCap },
      { href: '/quiz', label: 'Civic Quiz', sublabel: 'Your political ideology profile', icon: Compass },
      { href: '/connections', label: 'Civic Connections', sublabel: 'Word-grouping puzzle', icon: Hash },
      { href: '/bingo', label: 'Debate Bingo', sublabel: 'Spot the fallacies', icon: LayoutGrid },
      { href: '/wordle', label: 'Civic Wordle', sublabel: 'Guess the civic term', icon: Hash },
      { href: '/crossword', label: 'Civic Crossword', sublabel: 'Daily civic crossword', icon: LayoutGrid },
      { href: '/training', label: 'Argument Training', sublabel: 'Practice argument writing', icon: Wand2 },
      { href: '/workshop', label: 'Workshop', sublabel: 'Refine your rhetoric', icon: Brain },
      { href: '/knowledge-test', label: 'Knowledge Test', sublabel: 'Comprehensive civic exam', icon: GraduationCap },
    ],
  },
  {
    id: 'research',
    title: 'Research & Deep Analysis',
    description: 'Go beyond the surface — understand the data.',
    color: 'text-emerald',
    bg: 'bg-emerald/6',
    border: 'border-emerald/15',
    icon: Brain,
    features: [
      { href: '/intelligence', label: 'Intelligence Center', sublabel: 'AI-curated civic briefings', icon: Brain, badge: 'AI' },
      { href: '/observatory', label: 'Observatory', sublabel: 'Platform discourse health', icon: FlaskConical },
      { href: '/pulse', label: 'Civic Pulse', sublabel: 'Live argument stream', icon: Radio },
      { href: '/terminal', label: 'Consensus Terminal', sublabel: 'Power-user live dashboard', icon: Activity },
      { href: '/vote-stream', label: 'Vote Stream', sublabel: 'Live vote feed', icon: Radio },
      { href: '/signals', label: 'Signals', sublabel: 'Power-user intel board', icon: Activity },
      { href: '/genome', label: 'Platform Genome', sublabel: 'DNA of the Lobby\'s beliefs', icon: Dna },
      { href: '/tensions', label: 'Civic Tensions', sublabel: 'Where the Lobby is most divided', icon: Swords },
      { href: '/vote-map', label: 'Vote Atlas', sublabel: 'Geographic voting distribution', icon: Map },
      { href: '/epoch', label: 'Civic Epoch', sublabel: 'Platform history timeline', icon: History },
    ],
  },
  {
    id: 'profile',
    title: 'Your Civic Journey',
    description: 'Track your growth, reputation, and legacy.',
    color: 'text-gold',
    bg: 'bg-gold/6',
    border: 'border-gold/15',
    icon: Crown,
    features: [
      { href: '/profile/me', label: 'My Profile', sublabel: 'Full civic identity page', icon: Users },
      { href: '/achievements', label: 'Achievements', sublabel: 'Your earned badges', icon: Trophy },
      { href: '/quests', label: 'Civic Quests', sublabel: 'Gamified progression tracks', icon: Target, badge: 'New' },
      { href: '/missions', label: 'Daily Missions', sublabel: 'Three fresh challenges each day', icon: Zap },
      { href: '/skill-tree', label: 'Skill Tree', sublabel: 'RPG-style civic progression map', icon: GitBranch },
      { href: '/streaks', label: 'Vote Streak', sublabel: 'Keep your daily streak alive', icon: Flame },
      { href: '/clout', label: 'Clout', sublabel: 'Your civic reputation score', icon: Coins },
      { href: '/analytics/legacy', label: 'My Legacy', sublabel: 'Long-term impact view', icon: History },
      { href: '/analytics/wrapped', label: 'Civic Wrapped', sublabel: 'Your year-in-review summary', icon: Trophy },
      { href: '/analytics/journey', label: 'Civic Journey', sublabel: 'Your participation story', icon: GitBranch },
      { href: '/certificate', label: 'Certificate', sublabel: 'Shareable civic certificate', icon: GraduationCap },
      { href: '/season', label: 'Civic Season', sublabel: 'Seasonal achievements', icon: Trophy },
      { href: '/settings', label: 'Settings', sublabel: 'Preferences and notifications', icon: LayoutGrid },
    ],
  },
]

// ─── Section nav pill ─────────────────────────────────────────────────────────

function SectionPill({
  section,
  active,
  onClick,
}: {
  section: FeatureSection
  active: boolean
  onClick: () => void
}) {
  const Icon = section.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold whitespace-nowrap transition-all',
        active
          ? cn(section.bg, section.color, 'border', section.border)
          : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200',
      )}
    >
      <Icon className="h-3 w-3" />
      {section.title}
    </button>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({ item, accentColor }: { item: FeatureItem; accentColor: string }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="group flex items-start gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200/70 transition-all"
    >
      <div className={cn('mt-0.5 flex-shrink-0 p-1.5 rounded-lg bg-surface-300/60 group-hover:bg-surface-300/90 transition-colors')}>
        <Icon className={cn('h-3.5 w-3.5', accentColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white truncate group-hover:text-white/90">
            {item.label}
          </span>
          {item.badge && (
            <span className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/25">
              {item.badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-surface-500 leading-tight mt-0.5 truncate">
          {item.sublabel}
        </p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({ section }: { section: FeatureSection }) {
  const Icon = section.icon
  return (
    <div id={section.id} className="scroll-mt-20">
      <div className={cn('flex items-center gap-2.5 mb-3 px-3 py-2 rounded-xl border', section.bg, section.border)}>
        <Icon className={cn('h-4 w-4 flex-shrink-0', section.color)} />
        <div>
          <h2 className={cn('text-sm font-bold', section.color)}>{section.title}</h2>
          <p className="text-xs text-surface-500">{section.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {section.features.map((item) => (
          <FeatureCard key={item.href} item={item} accentColor={section.color} />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HubClient() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filteredSections = query.trim()
    ? SECTIONS.map((s) => ({
        ...s,
        features: s.features.filter(
          (f) =>
            f.label.toLowerCase().includes(query.toLowerCase()) ||
            f.sublabel.toLowerCase().includes(query.toLowerCase()),
        ),
      })).filter((s) => s.features.length > 0)
    : activeSection
      ? SECTIONS.filter((s) => s.id === activeSection)
      : SECTIONS

  const totalFeatures = SECTIONS.reduce((sum, s) => sum + s.features.length, 0)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <div className="sticky top-14 z-40 bg-surface-50/95 backdrop-blur-md border-b border-surface-300/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <LayoutGrid className="h-4 w-4 text-gold flex-shrink-0" />
            <span className="text-sm font-bold text-white">Civic Hub</span>
            <span className="text-xs text-surface-500 font-mono">{totalFeatures} features</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
            <input
              type="search"
              placeholder="Find a feature…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveSection(null)
              }}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface-200 border border-surface-300 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-for-500/50 focus:bg-surface-300/50"
            />
          </div>
        </div>
        {!query && (
          <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveSection(null)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all',
                activeSection === null
                  ? 'bg-surface-300 text-white border border-surface-400'
                  : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200',
              )}
            >
              All
            </button>
            {SECTIONS.map((s) => (
              <SectionPill
                key={s.id}
                section={s}
                active={activeSection === s.id}
                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
              />
            ))}
          </div>
        )}
      </div>

      <main className="flex-1 px-4 py-4 pb-24 max-w-2xl mx-auto w-full space-y-6">
        {query && filteredSections.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-sm text-surface-500">No features match &ldquo;{query}&rdquo;</p>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {filteredSections.map((section) => (
            <motion.div
              key={section.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SectionBlock section={section} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Footer note */}
        {!query && !activeSection && (
          <div className="pt-4 pb-2 text-center">
            <p className="text-xs text-surface-500">
              Lobby Market · The People&apos;s Consensus Engine
            </p>
            <p className="text-[11px] text-surface-500/60 mt-1">
              {totalFeatures} civic tools across {SECTIONS.length} categories
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
