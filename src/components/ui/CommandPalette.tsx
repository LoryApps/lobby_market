'use client'

/**
 * Global ⌘K / Ctrl+K command palette.
 *
 * Triggered by:
 *   - macOS : ⌘ + K
 *   - Windows/Linux : Ctrl + K
 *   - Click on the search icon in TopBar when in "palette" mode
 *
 * Features:
 *   - Static quick-nav links when no query is entered
 *   - Debounced full-text search via /api/search (topics, laws, people)
 *   - Arrow-key + Enter keyboard navigation
 *   - Framer Motion slide-in / fade-out animation
 *   - Closes on Escape, backdrop click, or after navigation
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import {
  Activity,
  BarChart2,
  Bookmark,
  Flame,
  History,
  Hourglass,
  LayoutGrid,
  Loader2,
  Mic,
  PenSquare,
  Scale,
  Search,
  Target,
  ThumbsUp,
  Trophy,
  User,
  Users,
  X,
  Building2,
  Landmark,
  FileText,
  TrendingUp,
  Bell,
  Settings,
  HelpCircle,
  Zap,
  GitFork,
  GitBranch,
  Calendar,
  Compass,
  Network,
  Coins,
  Layers,
  Megaphone,
  Clock,
  Vote,
  ArrowUpRight,
  Cloud,
  Radio,
  Globe,
  Sparkles,
  Timer,
  MessageSquare,
  BookOpen,
  Crown,
  Skull,
  Swords,
  FlaskConical,
  Gamepad2,
  Quote,
  Hash,
  GitCompare,
  Award,
  Eye,
  CheckCircle2,
  Scroll,
  Repeat2,
  Shield,
  MonitorPlay,
  Brain,
  Mail,
  HandHeart,
  TrendingDown,
  Heart,
  Fingerprint,
  GitMerge,
  ArrowDownUp,
  Ghost,
  RotateCcw,
  Dna,
  Rocket,
  Grid3X3,
  Link2,
  Handshake,
  Gauge,
  Shuffle,
  Wand2,
  Bird,
  CalendarClock,
  ListChecks,
  Lock,
  Lightbulb,
  Waves,
  Gavel,
  Ban,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickLink {
  type: 'link'
  id: string
  label: string
  sublabel?: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  iconBg?: string
}

interface TopicResult {
  type: 'topic'
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

interface LawResult {
  type: 'law'
  id: string
  statement: string
  category: string | null
}

interface PersonResult {
  type: 'person'
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

type PaletteItem = QuickLink | TopicResult | LawResult | PersonResult

// ─── Quick-nav links shown when no query is typed ─────────────────────────────

const QUICK_LINKS: QuickLink[] = [
  {
    type: 'link',
    id: 'feed',
    label: 'Feed',
    sublabel: 'Live topic feed',
    href: '/',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'floor',
    label: 'The Floor',
    sublabel: 'Watch consensus form in real-time',
    href: '/floor',
    icon: Landmark,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'city',
    label: 'City View',
    sublabel: 'Explore the user city',
    href: '/city',
    icon: Building2,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'debates',
    label: 'Debates',
    sublabel: 'Live debate arena',
    href: '/debate',
    icon: Mic,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'rivals',
    label: 'Civic Rivals',
    sublabel: 'Find citizens who voted opposite to you — your ideological opponents',
    href: '/rivals',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'moments',
    label: 'Civic Moments',
    sublabel: 'Swipeable highlights — new laws, vote surges, and debates resolved',
    href: '/moments',
    icon: Sparkles,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'gems',
    label: 'Civic Gems',
    sublabel: 'Hidden debates, rising voices, and quiet laws that deserve more attention',
    href: '/gems',
    icon: Sparkles,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'spotlight',
    label: 'Civic Spotlight',
    sublabel: 'Best argument, closest call, rising star, and newest law this week',
    href: '/spotlight',
    icon: Sparkles,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'lighthouse',
    label: 'Civic Lighthouse',
    sublabel: 'Neglected debates gone dark — topics with few votes waiting for your voice',
    href: '/lighthouse',
    icon: Lightbulb,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'rising',
    label: 'Rising Citizens',
    sublabel: 'New citizens (joined in last 30 days) making outsized civic impact — ranked by rise score',
    href: '/rising',
    icon: TrendingUp,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'frontier',
    label: 'The Civic Frontier',
    sublabel: 'Newest proposals, early-stage topics, and uncovered civic ground — where debate is just beginning',
    href: '/frontier',
    icon: Rocket,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'breaking',
    label: 'Breaking Civic News',
    sublabel: 'Recent laws established, fast-moving votes, live debates, and newly proposed topics',
    href: '/breaking',
    icon: Radio,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-900/50',
  },
  {
    type: 'link',
    id: 'leaderboard',
    label: 'Leaderboard',
    sublabel: 'Top voters and lawmakers',
    href: '/leaderboard',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'awards',
    label: 'Civic Awards Hall',
    sublabel: 'Weekly recognition for top arguments, bridge builders, and debate masters',
    href: '/awards',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'apex',
    label: 'The Civic Apex',
    sublabel: 'All-time record holders per category — highest consensus, most engaged, fastest law',
    href: '/apex',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'zenith',
    label: 'The Civic Zenith',
    sublabel: 'All-time peak moments — most voted debate, fastest law, highest consensus, category champions',
    href: '/zenith',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'season',
    label: 'Civic Season',
    sublabel: 'Monthly championship — earn Season Points for every vote, argument, and law',
    href: '/season',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'seasons',
    label: 'Hall of Fame',
    sublabel: 'All-time season champions — every winner, every era',
    href: '/seasons',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'summit',
    label: 'Civic Summit',
    sublabel: 'Quarterly awards ceremony — top contributors, landmark laws, civic moments',
    href: '/summit',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/15',
  },
  {
    type: 'link',
    id: 'records',
    label: 'Civic Records',
    sublabel: 'All-time platform records — fastest law, most voted, best argument',
    href: '/records',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/15',
  },
  {
    type: 'link',
    id: 'ladder',
    label: 'Argument Ladder',
    sublabel: 'Top civic arguers ranked by total argument upvotes — who reasons best?',
    href: '/ladder',
    icon: MessageSquare,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-debates',
    label: 'Debate Hall of Fame',
    sublabel: 'Top completed debates ranked by viewers, decisive outcomes, and activity',
    href: '/leaderboard/debates',
    icon: Mic,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'leaderboard-evidence',
    label: 'Evidence Leaderboard',
    sublabel: 'Top evidence contributors, best-documented topics, and trusted sources',
    href: '/leaderboard/evidence',
    icon: BookOpen,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'stage',
    label: 'Civic Stage',
    sublabel: 'Full-screen live debate display for town halls & classrooms',
    href: '/stage',
    icon: MonitorPlay,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'arcade',
    label: 'Civic Arcade',
    sublabel: 'All games & challenges in one hub',
    href: '/arcade',
    icon: Gamepad2,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'blitz',
    label: 'Blitz Mode',
    sublabel: '60-second speed voting challenge',
    href: '/blitz',
    icon: Timer,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'challenge',
    label: 'Daily Quorum',
    sublabel: "Today's 3 topics — vote to earn Clout",
    href: '/challenge',
    icon: Flame,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-600/15',
  },
  {
    type: 'link',
    id: 'my-challenges',
    label: 'My Challenges',
    sublabel: 'Debate duels — accept, decline, or issue challenges',
    href: '/challenges',
    icon: Swords,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-600/10',
  },
  {
    type: 'link',
    id: 'flashcards',
    label: 'Civic Flashcards',
    sublabel: 'Study established laws — self-paced spaced repetition',
    href: '/flashcards',
    icon: BookOpen,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'archetype',
    label: 'Civic Archetype',
    sublabel: 'Discover your political personality — 10 questions, 8 archetypes',
    href: '/archetype',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'archetype-intelligence',
    label: 'Archetype Intelligence',
    sublabel: 'How each civic archetype votes — divisive topics, cross-archetype consensus',
    href: '/archetype/intelligence',
    icon: Brain,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'quiz',
    label: 'Civic Quiz',
    sublabel: 'Find your civic alignment — no login required',
    href: '/quiz',
    icon: Scale,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'trivia',
    label: 'Civic Trivia',
    sublabel: 'Daily challenge — guess the community vote split',
    href: '/trivia',
    icon: Target,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'training',
    label: 'Argument Training',
    sublabel: 'Sharpen your debate skills — fallacy spotting, argument ranking, vote calibration',
    href: '/training',
    icon: Zap,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'workshop',
    label: 'Argument Workshop',
    sublabel: 'Step-by-step guided argument builder — topic, angle, draft, AI review, publish',
    href: '/workshop',
    icon: Wand2,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'senate',
    label: 'The Senate',
    sublabel: 'Topics in final vote — deadlines approaching',
    href: '/senate',
    icon: Vote,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'predictions',
    label: 'Prediction Market',
    sublabel: 'Community forecasts — stake your accuracy for Clout',
    href: '/predictions',
    icon: Target,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'forecast',
    label: 'Civic Forecast',
    sublabel: 'Data-driven pass probability for every topic in final vote',
    href: '/forecast',
    icon: FlaskConical,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'futures',
    label: 'Civic Futures',
    sublabel: 'Upcoming debates, vote deadlines, and high-momentum active topics',
    href: '/futures',
    icon: CalendarClock,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'missions',
    label: 'Daily Missions',
    sublabel: 'Three civic challenges today — earn Clout and protect your streak',
    href: '/missions',
    icon: Target,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'queue',
    label: 'Action Queue',
    sublabel: 'Personalised civic to-do list — urgent votes, arguments, RSVPs',
    href: '/queue',
    icon: ListChecks,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'dashboard',
    label: 'Dashboard',
    sublabel: 'Personal command centre — league, predictions, watchlist',
    href: '/dashboard',
    icon: LayoutGrid,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
  },
  {
    type: 'link',
    id: 'analytics',
    label: 'Analytics',
    sublabel: 'Your voting patterns and stats',
    href: '/analytics',
    icon: BarChart2,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'signals',
    label: 'Signals',
    sublabel: 'Platform-wide consensus signals — breaking, contested, momentum',
    href: '/signals',
    icon: Activity,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'briefing',
    label: 'Daily Briefing',
    sublabel: 'Personalized action-oriented daily start page',
    href: '/briefing',
    icon: Bookmark,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'daily',
    label: 'Daily Dashboard',
    sublabel: 'Platform stats, hot topics, controversy of the day, and your unvoted recommendations',
    href: '/daily',
    icon: Target,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'catchup',
    label: 'Catch Up',
    sublabel: 'What happened while you were away',
    href: '/catchup',
    icon: Zap,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'insights',
    label: 'Platform Insights',
    sublabel: 'Weekly data-driven insights — category momentum, consensus health, rising contributors',
    href: '/insights',
    icon: BarChart2,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'history',
    label: 'Recently Viewed',
    sublabel: 'Topics you\'ve visited — pick up where you left off',
    href: '/history',
    icon: History,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'activity',
    label: 'Activity',
    sublabel: 'What\'s happening in the Lobby',
    href: '/activity',
    icon: Activity,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'following',
    label: 'Following Feed',
    sublabel: 'Latest activity from citizens you follow — votes, arguments, and laws',
    href: '/following',
    icon: Bell,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'now',
    label: 'Right Now',
    sublabel: 'What the Lobby is debating at this exact moment — real-time topic heat',
    href: '/now',
    icon: Clock,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'live',
    label: 'Live Arguments',
    sublabel: 'Real-time stream of arguments being posted right now',
    href: '/live',
    icon: Radio,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-900/50',
  },
  {
    type: 'link',
    id: 'hot-takes',
    label: 'Hot Takes',
    sublabel: "Citizens' unfiltered vote reasons — what people actually think",
    href: '/hot-takes',
    icon: MessageSquare,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-900/50',
  },
  {
    type: 'link',
    id: 'pulse',
    label: 'Community Pulse',
    sublabel: 'Top FOR/AGAINST arguments from active debates',
    href: '/pulse',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'argument-of-the-day',
    label: 'Argument of the Day',
    sublabel: "Today's best argument crowned by the Lobby — ranked by upvotes and AI quality score",
    href: '/argument-of-the-day',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'arguments',
    label: 'Top Arguments',
    sublabel: 'Most-upvoted arguments ever made in the Lobby',
    href: '/arguments',
    icon: ThumbsUp,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'discussions',
    label: 'Active Discussions',
    sublabel: 'Arguments with the most reply threads right now — filter by side, category, and time',
    href: '/discussions',
    icon: MessageSquare,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'my-arguments',
    label: 'My Arguments',
    sublabel: 'Personal argument analytics — upvotes, categories, history',
    href: '/arguments/mine',
    icon: Quote,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'argument-replies',
    label: 'Replies to My Arguments',
    sublabel: 'See every reply the community posted on your arguments — your argument inbox',
    href: '/arguments/replies',
    icon: MessageSquare,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'wisdom',
    label: 'Wisdom Feed',
    sublabel: "The platform's most respected voices — top arguments from Elders, Senators, and Lawmakers",
    href: '/wisdom',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'hindsight',
    label: 'Community Hindsight',
    sublabel: 'Were we right? Platform-wide retrospective on resolved civic debates — most regretted and vindicated decisions',
    href: '/hindsight',
    icon: RotateCcw,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'split',
    label: 'The Split',
    sublabel: 'Most contested topics — vote where it matters',
    href: '/split',
    icon: GitFork,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'pipeline',
    label: 'Legislation Pipeline',
    sublabel: 'Kanban board of all topics at every civic stage',
    href: '/pipeline',
    icon: GitBranch,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'chains',
    label: 'Topic Chains',
    sublabel: 'Browse topic lineages and continuation trees',
    href: '/chains',
    icon: GitFork,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'continuations',
    label: 'Continuations Hub',
    sublabel: 'Boost, vote on, and track platform-wide "...but/and" continuation proposals',
    href: '/continuations',
    icon: GitBranch,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'all-topics',
    label: 'All Topics',
    sublabel: 'Browse, filter, and sort every civic debate on the platform',
    href: '/topics',
    icon: Layers,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'topic-index',
    label: 'Topic Index',
    sublabel: 'A–Z encyclopedic reference of every debate topic',
    href: '/civic-index',
    icon: BookOpen,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
  },
  {
    type: 'link',
    id: 'categories',
    label: 'Categories',
    sublabel: 'Browse topics by category',
    href: '/topic/categories',
    icon: LayoutGrid,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'coalitions',
    label: 'Coalitions',
    sublabel: 'Join or create an alliance',
    href: '/coalitions',
    icon: Users,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'create-topic',
    label: 'Propose a Topic',
    sublabel: 'Submit a new topic for debate',
    href: '/topic/create',
    icon: PenSquare,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'profile',
    label: 'My Profile',
    sublabel: 'View your public profile',
    href: '/profile/me',
    icon: User,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'series',
    label: 'Civic Series',
    sublabel: 'Curated thematic reading paths through civic debates',
    href: '/series',
    icon: BookOpen,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'saved',
    label: 'Bookmarks',
    sublabel: 'Your saved topics and arguments',
    href: '/bookmarks',
    icon: Bookmark,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'drafts',
    label: 'Draft Box',
    sublabel: 'Saved argument drafts — refine before posting',
    href: '/drafts',
    icon: Cloud,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/50',
  },
  {
    type: 'link',
    id: 'notifications',
    label: 'Notifications',
    sublabel: 'Recent alerts and updates',
    href: '/notifications',
    icon: Bell,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'messages',
    label: 'Messages',
    sublabel: 'Private conversations',
    href: '/messages',
    icon: MessageSquare,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'settings',
    label: 'Settings',
    sublabel: 'Preferences and account',
    href: '/settings',
    icon: Settings,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'brief',
    label: 'Daily Brief',
    sublabel: 'Personalized morning summary — hot topics, debates, laws',
    href: '/brief',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'newspaper',
    label: 'The Lobby Dispatch',
    sublabel: 'Daily civic front page — debates, laws, voices, numbers',
    href: '/newspaper',
    icon: FileText,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'editorial',
    label: 'AI Civic Editorial',
    sublabel: 'Claude analyses today\'s top debates in a daily editorial',
    href: '/editorial',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'digest',
    label: 'Weekly Digest',
    sublabel: 'Laws, debates, and top voices this week',
    href: '/digest',
    icon: Calendar,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'weekly',
    label: 'Weekly Civic Report',
    sublabel: 'Platform-wide week in review — top debates, new laws, and community milestones',
    href: '/weekly',
    icon: Calendar,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'civic-calendar',
    label: 'Civic Calendar',
    sublabel: 'Upcoming debates, voting deadlines, and new laws',
    href: '/calendar',
    icon: Calendar,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'civic-almanac',
    label: 'Civic Almanac',
    sublabel: 'On This Day — topics proposed, laws made, arguments celebrated',
    href: '/almanac',
    icon: BookOpen,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'timeline',
    label: 'Civic Timeline',
    sublabel: 'Chronological history of all platform events and laws',
    href: '/timeline',
    icon: History,
    iconColor: 'text-surface-500',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'graveyard',
    label: 'The Graveyard',
    sublabel: 'Topics that failed to become law — and the stories of why',
    href: '/graveyard',
    icon: Skull,
    iconColor: 'text-surface-500',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'public-record',
    label: 'The Civic Public Record',
    sublabel: 'Permanent archive of every law established and every proposal rejected',
    href: '/public-record',
    icon: Shield,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-600/15',
  },
  {
    type: 'link',
    id: 'mosaic',
    label: 'The Civic Mosaic',
    sublabel: 'Every debate as a colour-coded tile — consensus in colour, engagement in size',
    href: '/mosaic',
    icon: Grid3X3,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'galaxy',
    label: 'Civic Galaxy',
    sublabel: 'Every debate as a star — sized by votes, coloured by consensus, clustered by category',
    href: '/galaxy',
    icon: Globe,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'checker',
    label: 'Civic Claim Checker',
    sublabel: 'Check any claim against the Codex — see if established laws support or contradict it',
    href: '/checker',
    icon: Scale,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'steelman',
    label: 'Civic Steelman',
    sublabel: 'Generate the strongest possible FOR and AGAINST arguments for any debate',
    href: '/steelman',
    icon: Brain,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'spar',
    label: 'Sparring Arena',
    sublabel: 'Practice debating civic topics against Claude AI in 5-round bouts',
    href: '/spar',
    icon: Swords,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'compass',
    label: 'Political Compass',
    sublabel: 'See where your votes place you on the spectrum',
    href: '/compass',
    icon: Compass,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'sentiment',
    label: 'Sentiment Explorer',
    sublabel: 'The emotional tone of civic arguments — hopeful vs critical by category',
    href: '/analytics/sentiment',
    icon: Quote,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'argument-quality-index',
    label: 'Argument Quality Index',
    sublabel: 'Platform-wide AI grade distribution, category quality rankings, quality trends, and top-graded arguers',
    href: '/analytics/argument-quality',
    icon: Award,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'perspective-lens',
    label: 'Civic Perspective Lens',
    sublabel: 'How your votes diverge from community consensus by category — contrarian score, diversity, archetype, outlier votes',
    href: '/analytics/lens',
    icon: Eye,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'civic-snapshot',
    label: 'Civic Identity Snapshot',
    sublabel: 'Your full civic profile at a glance — archetype, top categories, alignment scores, shareable card',
    href: '/analytics/snapshot',
    icon: LayoutGrid,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'civic-benchmark',
    label: 'Civic Benchmark',
    sublabel: 'How you rank against citizens who joined at the same time — percentile scores across clout, votes, reputation',
    href: '/analytics/benchmark',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'civic-drift',
    label: 'Civic Drift Report',
    sublabel: 'See how far your vote positions diverge from current community consensus — contrarian and aligned topics',
    href: '/analytics/drift',
    icon: TrendingDown,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'analytics-timing',
    label: 'Civic Timing Report',
    sublabel: 'When do you vote? Hour-of-day patterns, early-adopter score, and your timing archetype (Trailblazer to Archivist)',
    href: '/analytics/timing',
    icon: Clock,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'analytics-influence',
    label: 'Civic Influence Score',
    sublabel: 'Your composite influence score — argument upvotes, follower reach, content quality, and legislative accuracy in one number',
    href: '/analytics/influence',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics-clout',
    label: 'Clout Economy Analytics',
    sublabel: 'How you earn, spend, and rank in the civic currency system — monthly trend, top sources, and transaction history',
    href: '/analytics/clout',
    icon: Coins,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics-following',
    label: 'Network Analytics',
    sublabel: 'What your civic network is voting on, arguing about, and how aligned you are with the people you follow',
    href: '/analytics/following',
    icon: Users,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'analytics-alignment',
    label: 'Civic Alignment',
    sublabel: 'How your votes align with people you follow and your coalition members — your network agreement score',
    href: '/analytics/alignment',
    icon: Scale,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'analytics-kin',
    label: 'Civic Kin',
    sublabel: 'Your political soulmates and civic rivals — who votes most like you, and who is your ideological opposite',
    href: '/analytics/kin',
    icon: Heart,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'extremes',
    label: 'Civic Extremes',
    sublabel: 'Most contested debates & strongest mandates',
    href: '/extremes',
    icon: Scale,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10',
  },
  {
    type: 'link',
    id: 'heat',
    label: 'Civic Heat Index',
    sublabel: 'Live temperature for every debate — vote velocity, argument bursts, controversy',
    href: '/heat',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'hotspot',
    label: 'Civic Hotspot',
    sublabel: 'Critical moments: final votes, deadlocks, flash laws, live debates',
    href: '/hotspot',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'surge',
    label: 'Surge',
    sublabel: 'Topics gaining critical momentum right now',
    href: '/surge',
    icon: TrendingUp,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'groundswell',
    label: 'Civic Groundswell',
    sublabel: 'Topics waking up — dormant debates suddenly surging with new voter turnout',
    href: '/groundswell',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'velocity',
    label: 'Civic Velocity',
    sublabel: 'Live vote flow by category — sparkline charts showing which issues the community is most active on right now',
    href: '/velocity',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'flux',
    label: 'Civic Flux',
    sublabel: 'Where is the community changing its mind? Tracks the largest FOR/AGAINST consensus shifts in the last 24h',
    href: '/flux',
    icon: Shuffle,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'cascade',
    label: 'The Civic Cascade',
    sublabel: 'Laws that ignited more debate — measure the downstream energy surge after each law was established',
    href: '/cascade',
    icon: GitBranch,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'recoil',
    label: 'The Civic Recoil',
    sublabel: 'Failed topics that sparked a backlash — measuring the debate energy surge after defeat',
    href: '/recoil',
    icon: RotateCcw,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'watershed',
    label: 'The Civic Watershed',
    sublabel: 'Hall of decisive mandates — strongest laws, closest calls, highest-turnout debates',
    href: '/watershed',
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'annual',
    label: 'The Civic Annual',
    sublabel: 'All-time platform record — every topic, every law, every vote, every contributor',
    href: '/annual',
    icon: Scroll,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'frontlines',
    label: 'The Civic Frontlines',
    sublabel: 'Live battle map of the closest debates — Battle Zone (±5%), Contested (±15%), Leaning. Where your vote matters most.',
    href: '/frontlines',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'triage',
    label: 'Civic Triage',
    sublabel: 'Where your vote is most needed — near the line, deadlocked, neglected, and expiring debates',
    href: '/triage',
    icon: Zap,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'canary',
    label: 'The Civic Canary',
    sublabel: 'Early-warning signals — debates rising fast, quiet storms building, and argument surges before they trend',
    href: '/canary',
    icon: Bird,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'influx',
    label: 'The Civic Influx',
    sublabel: 'Topics where viewer interest has outpaced voter participation — debates on the verge of a democratic wave',
    href: '/influx',
    icon: Waves,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'fulcrum',
    label: 'The Civic Fulcrum',
    sublabel: 'Near-perfect 50/50 splits — the most balanced debates where one decisive argument holds the scales. Your vote matters most here.',
    href: '/fulcrum',
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'rhythm',
    label: 'Civic Rhythm',
    sublabel: 'When democracy happens — 7×24 temporal heatmap of votes and arguments by day and hour',
    href: '/rhythm',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'civic-dispatch',
    label: 'The Civic Dispatch',
    sublabel: 'Tonight\'s top story per category — the single most significant active debate across all 10 policy domains',
    href: '/civic-dispatch',
    icon: Radio,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'seismic',
    label: 'Civic Seismic',
    sublabel: 'Anomaly detection for sudden vote bursts — Richter-scale magnitude ratings for unexpected civic activity spikes',
    href: '/seismic',
    icon: Activity,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'tremor',
    label: 'Civic Tremor',
    sublabel: 'Opinion seismograph — where recent voters deviate from all-time consensus, revealing surges, reversals, deepening majorities, and eroding leads',
    href: '/tremor',
    icon: Activity,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'volatility',
    label: 'Volatility Index',
    sublabel: 'Debates where the community keeps changing its mind — ranked by standard deviation of daily FOR% over 7 days',
    href: '/volatility',
    icon: Activity,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'friction',
    label: 'Civic Friction Index',
    sublabel: 'Debates that refuse to resolve — high votes, long lifespan, stuck near 50/50. The immovable controversies of the Lobby.',
    href: '/friction',
    icon: Lock,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
  },
  {
    type: 'link',
    id: 'tide',
    label: 'The Civic Tide',
    sublabel: '30-day macro view of platform sentiment — laws established, category trends, and whether civic consensus is rising or falling',
    href: '/tide',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'tipping-point',
    label: 'The Tipping Point',
    sublabel: 'Debates within striking distance of consensus — or about to be definitively rejected',
    href: '/tipping-point',
    icon: Gauge,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'synthesis',
    label: 'Synthesis Hub',
    sublabel: 'Browse all AI-generated syntheses — common ground, core tensions, and nuanced positions across every major debate',
    href: '/synthesis',
    icon: GitMerge,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'convergence',
    label: 'Civic Convergence',
    sublabel: 'Where consensus is building — and where it\'s cracking. Recent voters vs. the platform average.',
    href: '/convergence',
    icon: GitMerge,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'contested',
    label: 'The Contested',
    sublabel: 'All debates closest to 50/50 — where your vote is most decisive, updated live',
    href: '/contested',
    icon: Scale,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'flashpoint',
    label: 'Flashpoint',
    sublabel: 'The single most contested debate raging right now — peak velocity, maximum drama',
    href: '/flashpoint',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'momentum',
    label: 'Momentum',
    sublabel: 'Live vote velocity — which topics are accelerating?',
    href: '/momentum',
    icon: ArrowUpRight,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'scoreboard',
    label: 'Civic Scoreboard',
    sublabel: 'Real-time leaderboard — most active citizens and hottest topics right now',
    href: '/scoreboard',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'tally',
    label: 'Tally Board',
    sublabel: 'Live election-night results for every topic in the voting phase',
    href: '/tally',
    icon: Radio,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'vote-stream',
    label: 'Vote Stream',
    sublabel: 'Watch democracy in real-time — a live ticker of every vote landing on the platform',
    href: '/vote-stream',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'flip',
    label: 'The Big Flip',
    sublabel: 'Debates that defied the early odds — the biggest vote reversals in the Lobby',
    href: '/flip',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'pendulum',
    label: 'Opinion Arc',
    sublabel: 'How debates evolved day-by-day — full vote-trajectory arcs for every resolved topic',
    href: '/pendulum',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'undertow',
    label: 'Civic Undertow',
    sublabel: 'False summits (winning but losing momentum) and rising underdogs (losing but surging) — hidden currents beneath the consensus',
    href: '/undertow',
    icon: Activity,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-300/10',
  },
  {
    type: 'link',
    id: 'standoff',
    label: 'The Civic Standoff',
    sublabel: 'Debates locked in persistent deadlock — topics stuck near 50/50 with active recent voting on both sides',
    href: '/standoff',
    icon: Swords,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-400/10',
  },
  {
    type: 'link',
    id: 'pressure',
    label: 'The Civic Pressure Test',
    sublabel: 'Topics under heavy vote pressure — approaching the law threshold or at risk of failure',
    href: '/pressure',
    icon: Activity,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-300/10',
  },
  {
    type: 'link',
    id: 'drought',
    label: 'The Civic Drought',
    sublabel: 'Topics with very low recent activity — debates that have gone silent',
    href: '/drought',
    icon: Activity,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/10',
  },
  {
    type: 'link',
    id: 'flash',
    label: 'The Civic Flash',
    sublabel: 'Topics that just exploded in activity — sudden vote surge in the last few hours',
    href: '/flash',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'horizon',
    label: 'The Civic Horizon',
    sublabel: 'Topics approaching the law threshold — likely to become law soon',
    href: '/horizon',
    icon: TrendingUp,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'inertia',
    label: 'Civic Inertia Index',
    sublabel: 'Debates that absorbed the most argument without budging — the bedrock beliefs of the platform',
    href: '/inertia',
    icon: Activity,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'amplitude',
    label: 'Civic Amplitude Index',
    sublabel: 'How decisively has the community swung? Topics ranked by the force of their consensus verdict',
    href: '/amplitude',
    icon: Activity,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
  },
  {
    type: 'link',
    id: 'vortex',
    label: 'The Civic Vortex',
    sublabel: 'Topics pulling maximum platform attention — dominating the debate sphere right now',
    href: '/vortex',
    icon: Activity,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'magnitude',
    label: 'The Civic Magnitude',
    sublabel: 'Biggest vote swings — topics with the largest FOR% shifts over the past week',
    href: '/magnitude',
    icon: Activity,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-400/10',
  },
  {
    type: 'link',
    id: 'blindspots',
    label: 'Civic Blind Spots',
    sublabel: 'Topics with surprising vote patterns — where the data defies the narrative',
    href: '/blindspots',
    icon: Activity,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'resonance',
    label: 'Civic Resonance',
    sublabel: 'How your arguments land — upvote patterns, topic impact, and persuasion depth',
    href: '/resonance',
    icon: MessageSquare,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-300/10',
  },
  {
    type: 'link',
    id: 'conviction',
    label: 'Civic Conviction Tracker',
    sublabel: 'Track your argument consistency — are you more convinced over time?',
    href: '/conviction',
    icon: Activity,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'persuasion-page',
    label: 'Civic Persuasion',
    sublabel: 'Which of your arguments changed minds — persuasion score and cross-partisan reach',
    href: '/persuasion',
    icon: MessageSquare,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'analytics-coverage',
    label: 'Civic Coverage',
    sublabel: 'How broadly you engage across categories, topics, and debate sides',
    href: '/analytics/coverage',
    icon: BarChart2,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'trending',
    label: 'Trending',
    sublabel: 'Most active topics in the last 24 hours',
    href: '/trending',
    icon: Flame,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'codex',
    label: 'Law Codex',
    sublabel: 'All established laws and the knowledge graph',
    href: '/law',
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'law-today',
    label: 'Law of the Day',
    sublabel: 'One spotlighted established law, refreshed every 24 hours',
    href: '/law/today',
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'constitution',
    label: 'Civic Constitution',
    sublabel: 'Living constitutional document of all established laws',
    href: '/constitution',
    icon: BookOpen,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'watchdog',
    label: 'Civic Watchdog',
    sublabel: 'Laws under active community pressure — amendments, petitions, and contested margins',
    href: '/watchdog',
    icon: Shield,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'relay',
    label: 'Civic Relay',
    sublabel: 'Collaborative 5-leg argument chains — one user starts, four others build, the community votes',
    href: '/relay',
    icon: Link2,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'questions-hub',
    label: 'Community Q&A Hub',
    sublabel: 'Browse open questions from every civic debate — answer what you know, earn Clout for clarity',
    href: '/questions',
    icon: HelpCircle,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'ama-highlights',
    label: 'AMA Insights Archive',
    sublabel: 'Best Q&A pairs from completed expert AMA sessions — browse by category and upvotes',
    href: '/ama/highlights',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'ama-sessions',
    label: 'Expert AMA Sessions',
    sublabel: 'Live and upcoming Ask Me Anything sessions with civic experts — submit questions, upvote, get answers',
    href: '/ama',
    icon: Mic,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'ama-experts',
    label: 'AMA Expert Directory',
    sublabel: 'Browse verified civic experts by category — economists, legal scholars, policy analysts',
    href: '/ama/experts',
    icon: Users,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'ama-schedule',
    label: 'AMA Schedule',
    sublabel: 'Upcoming expert sessions — calendar view with RSVP and reminder options',
    href: '/ama/schedule',
    icon: Calendar,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'ama-request',
    label: 'Request an AMA',
    sublabel: 'Nominate a civic expert for an AMA session — community votes on the most-wanted voices',
    href: '/ama/request',
    icon: MessageSquare,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'ama-search',
    label: 'Search AMA Answers',
    sublabel: 'Full-text search across all expert answers — find knowledge on any civic topic',
    href: '/ama/search',
    icon: Search,
    iconColor: 'text-surface-500',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'tribunal',
    label: 'The Civic Tribunal',
    sublabel: 'Democratic argument review — challenge fallacious reasoning, serve as a juror, deliver verdicts',
    href: '/tribunal',
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'ombudsman',
    label: 'Civic Ombudsman',
    sublabel: 'Independent civic oversight — file formal complaints about process fairness, decisions, and integrity breaches',
    href: '/ombudsman',
    icon: Scale,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'civic-vetoes',
    label: 'Civic Vetoes',
    sublabel: 'Collective democratic override — challenge established laws by gathering signatures',
    href: '/civic-vetoes',
    icon: Ban,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'amendments',
    label: 'Amendment Chamber',
    sublabel: 'Community proposals to refine and extend established laws — vote to ratify',
    href: '/amendments',
    icon: FileText,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'law-graph',
    label: 'Law Graph',
    sublabel: 'Interactive knowledge graph of all established laws',
    href: '/law/graph',
    icon: Network,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'civic-tensions',
    label: 'Civic Tensions',
    sublabel: 'Laws that may pull in opposing directions — codex coherence analysis',
    href: '/tensions',
    icon: Scale,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'topic-network',
    label: 'Topic Network',
    sublabel: 'Force-directed graph of all debate topics',
    href: '/topic/graph',
    icon: Network,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'civic-nexus',
    label: 'Civic Nexus',
    sublabel: 'Knowledge graph: topics linked by wiki connections and shared tags',
    href: '/nexus',
    icon: Network,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'widget',
    label: 'Widget Builder',
    sublabel: 'Embed a live vote widget on any website',
    href: '/widget',
    icon: Layers,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'badges',
    label: 'Profile Badges',
    sublabel: 'SVG badges for GitHub README and portfolios',
    href: '/badges',
    icon: Shield,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'stats',
    label: 'Global Stats',
    sublabel: 'Platform-wide vote counts, laws, and growth',
    href: '/stats',
    icon: BarChart2,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'barometer',
    label: 'Civic Barometer',
    sublabel: 'Platform-wide sentiment gauge — where does the Lobby stand right now? FOR vs AGAINST by category',
    href: '/barometer',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'vitals',
    label: 'Civic Vitals',
    sublabel: 'Live discourse quality dashboard — argument grades, deliberation depth, consensus health',
    href: '/vitals',
    icon: Activity,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'depth',
    label: 'Civic Depth Index',
    sublabel: 'Debates ranked by argument richness — density, citations, AI quality, wiki length, predictions',
    href: '/depth',
    icon: Brain,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'zeitgeist',
    label: 'The Civic Zeitgeist',
    sublabel: 'Platform-wide mood board: consensus strength, category temperatures, and the spirit of the Lobby right now',
    href: '/zeitgeist',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'epoch',
    label: 'The Civic Epoch',
    sublabel: "The platform's history in epochs — Legislative Eras, Great Debates, Progressive Waves month by month",
    href: '/epoch',
    icon: History,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'weather',
    label: 'Civic Weather Report',
    sublabel: 'Political climate across categories — consensus, controversy, and wind speed',
    href: '/weather',
    icon: Cloud,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'heatmap',
    label: 'Lobby Heatmap',
    sublabel: 'Topic density across categories and lifecycle stages',
    href: '/heatmap',
    icon: BarChart2,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'consensus',
    label: 'Consensus Engine',
    sublabel: 'Force-directed bubble map of all active debates sized by votes',
    href: '/consensus',
    icon: Globe,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'clout',
    label: 'Clout',
    sublabel: 'Earn, spend, and send Clout to other users',
    href: '/clout',
    icon: Coins,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'ambassador',
    label: 'Civic Ambassador',
    sublabel: 'Recruit new citizens, earn Clout for every conversion — your referral code and stats',
    href: '/ambassador',
    icon: Megaphone,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'lobbies',
    label: 'Lobbies',
    sublabel: 'Join or create a special-interest lobby',
    href: '/lobby',
    icon: Megaphone,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'law-timeline',
    label: 'Law Timeline',
    sublabel: 'Chronological history of all laws established',
    href: '/law/timeline',
    icon: Clock,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'network',
    label: 'Your Network',
    sublabel: 'Topics and arguments from people you follow',
    href: '/network',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'sources',
    label: 'Evidence Index',
    sublabel: 'Top external sources cited across all Lobby Market arguments',
    href: '/sources',
    icon: BookOpen,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'evidence',
    label: 'Civic Evidence Library',
    sublabel: 'Best community-curated evidence from the Evidence Board, ranked by votes',
    href: '/evidence',
    icon: BookOpen,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'explore',
    label: 'Explore',
    sublabel: 'Browse all Lobby Market features — AI tools, games, analytics, and more',
    href: '/explore',
    icon: Layers,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
  },
  {
    type: 'link',
    id: 'discover',
    label: 'Discover',
    sublabel: 'Suggested people, hot topics, debates, and new laws',
    href: '/discover',
    icon: Globe,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
  },
  {
    type: 'link',
    id: 'civic-referendums',
    label: 'Civic Referendums',
    sublabel: 'Platform governance votes — propose changes to how Lobby Market works and let the community decide',
    href: '/civic-referendums',
    icon: Gavel,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'polls',
    label: 'Civic Polls',
    sublabel: 'Community polls on civic topics — quick-fire questions beyond the main voting system',
    href: '/polls',
    icon: Vote,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'reactions',
    label: 'Topic Reactions',
    sublabel: 'Community emotional responses to active debates — surprise, hope, anger, trust',
    href: '/reactions',
    icon: Heart,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'capsule',
    label: 'Civic Time Capsules',
    sublabel: 'Write time-locked predictions — seal them, score them, earn Clout',
    href: '/capsule',
    icon: Hourglass,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'time-machine',
    label: 'Civic Time Machine',
    sublabel: 'Revisit any date — see which topics, laws, arguments, and debates shaped that day',
    href: '/time-machine',
    icon: History,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  // ── Live / activity ──────────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'radar',
    label: 'Civic Radar',
    sublabel: 'Live urgency dashboard — dead heats, surges, and laws established today',
    href: '/radar',
    icon: Radio,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'battleground',
    label: 'Civic Battleground',
    sublabel: 'Live FOR vs AGAINST split-screen — see both sides battle in real time',
    href: '/battleground',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'today',
    label: 'Today in the Lobby',
    sublabel: 'Daily snapshot — hottest topic, top argument, latest law, and live stats',
    href: '/today',
    icon: Zap,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'my-week',
    label: 'My Week',
    sublabel: 'Your personal weekly report — votes cast, arguments posted, Clout earned',
    href: '/my-week',
    icon: Calendar,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  // ── Analytics & insight ──────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'drift',
    label: 'Opinion Drift',
    sublabel: 'How civic consensus has shifted across categories over 7d / 30d / 90d',
    href: '/drift',
    icon: Repeat2,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'lens',
    label: 'Civic Lens',
    sublabel: 'Live category-level dashboard — law rates, avg split, top topics per category',
    href: '/lens',
    icon: Target,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
  },
  {
    type: 'link',
    id: 'influence',
    label: 'Civic Influence Graph',
    sublabel: 'Personal vote network — see which topics connect through shared opinion',
    href: '/influence',
    icon: Network,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'observatory',
    label: 'Civic Observatory',
    sublabel: "Researcher's view of platform health — polarisation, debate quality, vitality",
    href: '/observatory',
    icon: Activity,
    iconColor: 'text-surface-600',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'report-card',
    label: 'My Civic Report Card',
    sublabel: 'A graded summary of your participation, predictions, influence, and breadth',
    href: '/report-card',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'dossier',
    label: 'Civic Dossier',
    sublabel: 'Your compact civic identity card — stats, category fingerprint, FOR/AGAINST lean, laws shaped',
    href: '/dossier',
    icon: FileText,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'karma',
    label: 'Civic Karma Score',
    sublabel: 'Your holistic civic credit score — discourse, predictions, breadth, engagement, trust',
    href: '/karma',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'positions',
    label: 'My Positions',
    sublabel: 'Your full vote history — every topic you took a stance on, searchable',
    href: '/positions',
    icon: CheckCircle2,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'wrapped',
    label: 'Civic Wrapped',
    sublabel: 'Your year in review — top categories, biggest wins, final stats',
    href: '/wrapped',
    icon: BarChart2,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'manifesto',
    label: 'Civic Manifesto',
    sublabel: 'AI-generated political declaration based on your full voting history',
    href: '/manifesto',
    icon: Scroll,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'oath',
    label: 'Civic Oath',
    sublabel: 'Take your one-time pledge of good-faith civic participation',
    href: '/oath',
    icon: Shield,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  // ── Competition ────────────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'elections',
    label: 'Civic Elections',
    sublabel: 'Vote for community representatives — Senators, Troll Catchers, Elders',
    href: '/elections',
    icon: Vote,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'league',
    label: 'Lobby League',
    sublabel: 'Monthly tier race — earn Clout to climb from Bystander to Champion',
    href: '/league',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'race',
    label: 'Civic Race',
    sublabel: 'Live topic velocity chart — which debates are accelerating fastest?',
    href: '/race',
    icon: TrendingUp,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  // ── Civic tools ───────────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'crossroads',
    label: 'Civic Crossroads',
    sublabel: 'Weekly values dilemma — a hard civic choice with no easy answer',
    href: '/crossroads',
    icon: GitBranch,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'pledges',
    label: 'Civic Pledge Wall',
    sublabel: 'Make public civic commitments — let the community witness your actions',
    href: '/pledges',
    icon: HandHeart,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'petitions',
    label: 'Civic Petitions',
    sublabel: 'Community-backed proposals — sign or oppose to trigger platform review',
    href: '/petitions',
    icon: Scale,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'watchlist',
    label: 'My Watchlist',
    sublabel: 'Topics you subscribed to — get notified when they hit milestones',
    href: '/watchlist',
    icon: Eye,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'agenda',
    label: 'Civic Agenda',
    sublabel: 'Your scheduled debates, upcoming votes, and calendar events',
    href: '/agenda',
    icon: Calendar,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  // ── Compare ──────────────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'compare',
    label: 'Compare Topics',
    sublabel: 'Side-by-side comparison of two debates — votes, arguments, category',
    href: '/compare',
    icon: GitCompare,
    iconColor: 'text-surface-600',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'compare-users',
    label: 'Compare Citizens',
    sublabel: 'See how you and another citizen voted on the same topics',
    href: '/compare-users',
    icon: Users,
    iconColor: 'text-surface-600',
    iconBg: 'bg-surface-300/20',
  },
  // ── Games ──────────────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'connections',
    label: 'Civic Connections',
    sublabel: 'Daily word-grouping puzzle — find the 4 hidden links between 16 civic terms',
    href: '/connections',
    icon: Hash,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'wordle',
    label: 'Civic Wordle',
    sublabel: 'Daily 5-letter word game using civic vocabulary — 6 attempts',
    href: '/wordle',
    icon: Hash,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'gauge',
    label: 'Civic Gauge',
    sublabel: 'Daily estimation game — guess the FOR% on 5 resolved debates. How well do you know the Lobby?',
    href: '/gauge',
    icon: Gauge,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'cloze',
    label: 'Civic Cloze',
    sublabel: 'Fill in the missing word from real Lobby Market laws and debate statements',
    href: '/cloze',
    icon: FileText,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'crossword',
    label: 'Civic Crossword',
    sublabel: 'Daily mini-crossword with clues drawn from platform debates and laws',
    href: '/crossword',
    icon: LayoutGrid,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'civic-decoder',
    label: 'Civic Decoder',
    sublabel: 'Three real arguments. One mystery topic. Five rounds — can you identify which debate they came from?',
    href: '/civic-decoder',
    icon: Brain,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'civic-verdict',
    label: 'Civic Verdict',
    sublabel: 'Daily jury game — read FOR and AGAINST arguments, render your verdict, see if you match the consensus',
    href: '/civic-verdict',
    icon: Scale,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'civic-mirror',
    label: 'Civic Mirror',
    sublabel: 'Vote five topics gut-first — then see how you compare to the community majority',
    href: '/civic-mirror',
    icon: RotateCcw,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'civic-recall',
    label: 'Civic Recall',
    sublabel: 'Flash-memory challenge — memorise 6 civic topics in 15 seconds, then pick them from a field of 12',
    href: '/civic-recall',
    icon: BookOpen,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'civic-imposter',
    label: 'Civic Imposter',
    sublabel: 'Spot the Fake Law — five real laws from the Codex, one plausible imposter. Daily challenge.',
    href: '/civic-imposter',
    icon: Ghost,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'civic-rank',
    label: 'Civic Rank',
    sublabel: 'Sort 4 laws by community support (highest FOR% first) — 5 rounds, 25 seconds each',
    href: '/civic-rank',
    icon: ArrowDownUp,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'civic-timeline',
    label: 'Civic Timeline',
    sublabel: 'Put laws in the order they were passed — a daily chronological sorting challenge',
    href: '/civic-timeline',
    icon: Calendar,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'bingo',
    label: 'Civic Bingo',
    sublabel: '5×5 weekly bingo card — mark squares as civic laws pass, first to five in a row wins',
    href: '/bingo',
    icon: LayoutGrid,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'gauntlet',
    label: 'The Gauntlet',
    sublabel: 'Sudden-death survival — pick the majority side on each topic within 10 seconds or your run ends',
    href: '/gauntlet',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'odd-one-out',
    label: 'Civic Odd One Out',
    sublabel: 'Four topics — three share a category, one doesn\'t. Find the odd one out. Daily categorisation game.',
    href: '/odd-one-out',
    icon: Hash,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'argument-battle',
    label: 'Argument Battle',
    sublabel: "Daily bracket — 8 best arguments from the last 48 h compete head-to-head. Vote on which makes the stronger civic case.",
    href: '/argument-battle',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    id: 'bracket',
    label: 'Civic Bracket',
    sublabel: 'March Madness for debates — 8 contested topics compete head-to-head, vote to crown the week\'s champion',
    href: '/bracket',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'sprint',
    label: 'Civic Sprint',
    sublabel: 'Predict 10 closed topics: law or failed? Race the clock for speed bonuses.',
    href: '/sprint',
    icon: Timer,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  // ── Debate & Writing Tools ─────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'advisor',
    label: 'Civic Advisor',
    sublabel: 'AI-powered personalised briefing — which topics need your voice most right now',
    href: '/advisor',
    icon: Sparkles,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'coach',
    label: 'Argument Coach',
    sublabel: 'AI workshop: draft an argument, get a Claude critique across Clarity, Evidence, Logic, and Persuasion',
    href: '/coach',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'prep',
    label: 'Debate Prep',
    sublabel: 'Full debate dossier for any topic — your strongest arguments, likely counterattacks, AI talking points',
    href: '/prep',
    icon: Layers,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'rapid',
    label: 'Rapid Vote',
    sublabel: 'Fast-paced swipe voting — clear your entire unvoted queue with FOR/AGAINST gestures',
    href: '/rapid',
    icon: Timer,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'swipe',
    label: 'Swipe & Vote',
    sublabel: 'Full-screen deliberate card-by-card voting — drag right FOR, left AGAINST, no timer',
    href: '/swipe',
    icon: Repeat2,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'ballot',
    label: 'Civic Ballot',
    sublabel: 'Your personal ballot — every active topic waiting for your vote, one at a time with context',
    href: '/ballot',
    icon: Vote,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'reel',
    label: 'Civic Reel',
    sublabel: 'TikTok-style argument feed — swipe through the best FOR and AGAINST arguments one at a time',
    href: '/reel',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'meridian',
    label: 'The Civic Meridian',
    sublabel: 'Society\'s great unresolved questions — most engaged topics locked at 50/50, ranked by Meridian Score',
    href: '/meridian',
    icon: GitFork,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'crossfire',
    label: 'Crossfire',
    sublabel: 'Battle of Ideas — most contested topics with best FOR vs AGAINST arguments head-to-head',
    href: '/crossfire',
    icon: Swords,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'uncertainty',
    label: 'Civic Uncertainty Index',
    sublabel: 'Topics where society is most genuinely unsure — near-equal votes, balanced arguments, and high engagement',
    href: '/uncertainty',
    icon: Shuffle,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'entropy',
    label: 'Civic Entropy Index',
    sublabel: 'Shannon entropy applied to vote splits — maximum democratic disorder, ranked by split closeness × voter turnout',
    href: '/entropy',
    icon: Shuffle,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
  },
  // ── Analytics & Personal ───────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'mindmap',
    label: 'Civic Mind Map',
    sublabel: 'Personal Obsidian-style knowledge graph of every debate, argument, and law you\'ve engaged with',
    href: '/mindmap',
    icon: Network,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'skill-tree',
    label: 'Civic Skill Tree',
    sublabel: 'Your RPG-style progression map — every milestone from first vote to Elder, locked and unlocked',
    href: '/skill-tree',
    icon: GitFork,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'streaks',
    label: 'Streak Leaderboard',
    sublabel: 'Who\'s on the hottest civic voting streak? Top consistency rankings across the Lobby',
    href: '/streaks',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'activity-calendar',
    label: 'Activity Calendar',
    sublabel: 'GitHub-style contribution calendar — your full year of civic engagement, day by day',
    href: '/activity-calendar',
    icon: Calendar,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'bridge',
    label: 'The Civic Bridge',
    sublabel: 'Where your votes cross partisan lines — bridge moments, unexpected agreements, and your cross-divide score',
    href: '/bridge',
    icon: GitCompare,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'accord',
    label: 'The Civic Accord',
    sublabel: 'Topics with near-unanimous agreement (≥80%) — where partisan divides dissolve and everyone agrees',
    href: '/accord',
    icon: Handshake,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'diversity',
    label: 'Civic Diversity Score',
    sublabel: 'Your echo-chamber rating — category coverage, balance, and position independence across all your votes',
    href: '/diversity',
    icon: Globe,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'fingerprint',
    label: 'Civic Fingerprint',
    sublabel: 'How unique is your civic voice? Category-by-category deviation from the platform median voter',
    href: '/fingerprint',
    icon: Fingerprint,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'cohort',
    label: 'Civic Tribe',
    sublabel: 'Find citizens who think most like you — your civic doppelgangers across votes, values, and vision',
    href: '/cohort',
    icon: Dna,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'analytics-consistency',
    label: 'Consistency Report',
    sublabel: 'How principled are your stances? Reveal your within-category consistency and surprising flip votes',
    href: '/analytics/consistency',
    icon: GitMerge,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'bias',
    label: 'Civic Bias Checker',
    sublabel: 'Four-dimension cognitive bias report — confirmation, social proof, negativity, and category tunnel vision',
    href: '/bias',
    icon: Brain,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-400/10',
  },
  {
    type: 'link',
    id: 'analytics-groups',
    label: 'Civic Groups Analytics',
    sublabel: 'How different civic roles (Citizens → Elders) vote, argue, and engage — platform-wide group breakdown',
    href: '/analytics/groups',
    icon: Users,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  // ── Discovery & Research ──────────────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'spectrum',
    label: 'Civic Spectrum',
    sublabel: 'A 2D scatter map of every debate — consensus direction vs engagement intensity',
    href: '/spectrum',
    icon: BarChart2,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'verdicts',
    label: 'Civic Verdicts',
    sublabel: 'Every resolved debate with its outcome — laws that passed, proposals the Lobby rejected',
    href: '/verdicts',
    icon: Scroll,
    iconColor: 'text-surface-500',
    iconBg: 'bg-surface-300/20',
  },
  {
    type: 'link',
    id: 'transcripts',
    label: 'Debate Archive',
    sublabel: 'Browse every resolved debate with its top FOR and AGAINST arguments side-by-side',
    href: '/transcripts',
    icon: History,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'glossary',
    label: 'Civic Glossary',
    sublabel: 'Searchable guide to Lobby Market terms, debate concepts, logical fallacies, and civic vocabulary',
    href: '/glossary',
    icon: BookOpen,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'twins',
    label: 'Civic Twins',
    sublabel: 'Find citizens who voted most like you — your civic doppelgangers and ideological nearest neighbours',
    href: '/twins',
    icon: GitCompare,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'oracle',
    label: 'The Oracle',
    sublabel: 'AI prophecy engine — Claude\'s one-sentence fate verdict on every topic currently in voting',
    href: '/oracle',
    icon: Eye,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'forecasters',
    label: 'Oracle Board',
    sublabel: 'Prediction accuracy leaderboard — top forecasters ranked by Brier score, accuracy, and category breadth',
    href: '/forecasters',
    icon: Brain,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'simulate',
    label: 'Policy Simulator',
    sublabel: 'Model the projected outcomes of any proposed law — economic, social, and environmental ripple effects',
    href: '/simulate',
    icon: FlaskConical,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'bounties',
    label: 'Civic Bounties',
    sublabel: 'Open research bounties on unresolved civic questions — earn Clout for compelling answers',
    href: '/bounties',
    icon: Coins,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'gallery',
    label: 'Argument Gallery',
    sublabel: 'Visual showcase of the most upvoted civic arguments — masonry quote cards by category',
    href: '/gallery',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'common-threads',
    label: 'Common Threads',
    sublabel: 'Recurring civic themes that run through multiple debates — see cross-cutting values at a glance',
    href: '/common-threads',
    icon: Layers,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'judge',
    label: 'Argument Acuity',
    sublabel: 'Which argument is more convincing? Rate FOR vs AGAINST to build your argument acuity score',
    href: '/judge',
    icon: Scale,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'perspective',
    label: 'Perspective Swap',
    sublabel: "Steel-man generator — Claude builds the strongest honest case for the side you disagree with",
    href: '/perspective',
    icon: Repeat2,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'letter',
    label: 'Civic Letter Generator',
    sublabel: 'AI-powered letters to representatives, op-eds, petitions, and social threads — grounded in community consensus data',
    href: '/letter',
    icon: Mail,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'journal',
    label: 'Civic Journal',
    sublabel: 'Private notes tied to debates — track your evolving views, see how topics developed since you wrote',
    href: '/journal',
    icon: BookOpen,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'myth',
    label: 'Law or Myth',
    sublabel: "Daily fact-check game — did the Lobby pass this into law or reject it? 5 rounds, 100 points max",
    href: '/myth',
    icon: Hash,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'crucible',
    label: 'The Crucible',
    sublabel: "Today's most contested topic — live argument leaderboard, FOR vs AGAINST ranked by upvotes",
    href: '/crucible',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'impact',
    label: 'My Civic Impact',
    sublabel: 'Your personal ledger of influence — laws you helped pass, arguments that swayed votes',
    href: '/impact',
    icon: TrendingUp,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'lore',
    label: 'Civic Lore',
    sublabel: 'Platform records, hall-of-fame arguments, established laws, and legendary citizens — the defining moments of Lobby Market',
    href: '/lore',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'legacy',
    label: 'Civic Legacy',
    sublabel: 'Your permanent civic record — laws authored, signature arguments, debate wins, milestones, and legacy score',
    href: '/legacy',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'match',
    label: 'Priority Match',
    sublabel: 'Head-to-head: pick which topic deserves more urgent attention — builds a community urgency ranking',
    href: '/match',
    icon: Swords,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'shifts',
    label: 'Vote Shifts',
    sublabel: 'Track how community sentiment has moved on topics over time — the biggest swings and reversals',
    href: '/shifts',
    icon: TrendingUp,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'correlations',
    label: 'Correlation Atlas',
    sublabel: 'Which civic topics are ideologically linked? See how voting on one topic predicts voting on another — the hidden opinion topology of the Lobby',
    href: '/correlations',
    icon: Zap,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'polarization',
    label: 'Polarization Index',
    sublabel: 'Platform health dashboard — how divided or united is the Lobby? Per-category and platform-wide',
    href: '/polarization',
    icon: Activity,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'overton',
    label: 'The Overton Window',
    sublabel: 'Map every active topic onto the spectrum of civic acceptability — inside the window, leaning, or extreme consensus',
    href: '/overton',
    icon: Scale,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'memories',
    label: 'Civic Memories',
    sublabel: 'On this day in civic history — your past votes and arguments, plus laws passed on this date in prior years',
    href: '/memories',
    icon: History,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'transparency',
    label: 'Transparency Report',
    sublabel: 'Real-time platform health — citizens, votes cast, laws established, category breakdowns, and growth milestones',
    href: '/transparency',
    icon: Eye,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },

  // ─── Analytics sub-pages ──────────────────────────────────────────────────
  {
    type: 'link',
    id: 'analytics-streak',
    label: 'Streak History',
    sublabel: 'Your complete voting streak record — longest runs, heatmap calendar, and day-of-week rhythm',
    href: '/analytics/streak',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'analytics-legacy',
    label: 'Civic Legacy',
    sublabel: 'Laws you authored, best arguments, debate record — your permanent civic footprint and legacy tier',
    href: '/analytics/legacy',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics-journey',
    label: 'Civic Journey',
    sublabel: 'Narrative timeline of your milestones — first vote, achievements earned, laws shaped',
    href: '/analytics/journey',
    icon: Landmark,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics-votes',
    label: 'Vote History Analytics',
    sublabel: 'Full breakdown of your votes by category, scope, status, and time period',
    href: '/analytics/votes',
    icon: Vote,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'analytics-topics',
    label: 'Topic Analytics',
    sublabel: 'Which civic topics you engage with most — category breakdown and hot-spot identification',
    href: '/analytics/topics',
    icon: LayoutGrid,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'analytics-calibration',
    label: 'Calibration Report',
    sublabel: 'How well your predictions align with actual outcomes — calibration curve and accuracy over time',
    href: '/analytics/calibration',
    icon: Target,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'analytics-coalitions',
    label: 'Coalition Analytics',
    sublabel: 'Your coalition memberships, stance alignment, and collective impact',
    href: '/analytics/coalitions',
    icon: Shield,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'analytics-consensus-shift',
    label: 'Consensus Shift',
    sublabel: 'Topics where you voted against early consensus and whether the crowd caught up',
    href: '/analytics/consensus-shift',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics-debates',
    label: 'Debate Statistics',
    sublabel: 'Your debate record — wins, losses, audiences, and speaking style breakdown',
    href: '/analytics/debates',
    icon: Swords,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'analytics-discourse',
    label: 'Discourse Quality',
    sublabel: 'The quality and tone of your civic arguments — constructiveness, evidence use, and engagement',
    href: '/analytics/discourse',
    icon: Brain,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'analytics-evolution',
    label: 'Opinion Evolution',
    sublabel: 'How your voting tendencies have shifted category by category over the past 12 weeks',
    href: '/analytics/evolution',
    icon: TrendingUp,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'analytics-faceoffs',
    label: 'Faceoff Record',
    sublabel: 'Your arena head-to-head argument matchup record — wins, losses, and total faceoffs judged',
    href: '/analytics/faceoffs',
    icon: Swords,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'analytics-growth',
    label: 'Activity Growth',
    sublabel: 'Monthly civic activity chart — votes, arguments, debates, and achievements over time',
    href: '/analytics/growth',
    icon: TrendingUp,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'analytics-laws',
    label: 'Law Analytics',
    sublabel: 'How your votes contributed to established laws and how many laws you helped pass',
    href: '/analytics/laws',
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics-predictions',
    label: 'Prediction Analytics',
    sublabel: 'Full prediction history — accuracy, Brier score, clout earned, and resolution breakdown',
    href: '/analytics/predictions',
    icon: Zap,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'analytics-reactions',
    label: 'Argument Reception',
    sublabel: 'How the community reacts to your arguments — insightful, compelling, balanced, needs evidence',
    href: '/analytics/reactions',
    icon: MessageSquare,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'analytics-reasons',
    label: 'Hot Take Voice',
    sublabel: 'Analysis of the reasons you give when voting — your civic argument vocabulary',
    href: '/analytics/reasons',
    icon: Quote,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'analytics-tags',
    label: 'Tag Voting Profile',
    sublabel: 'How you vote across topic tags — your stances, engagement depth, and tag affinity',
    href: '/analytics/tags',
    icon: Hash,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },

  // ─── Leaderboard sub-pages ────────────────────────────────────────────────
  {
    type: 'link',
    id: 'leaderboard-rising',
    label: 'Rising Stars',
    sublabel: 'Who is climbing fastest this week — momentum score based on votes, arguments, and achievements',
    href: '/leaderboard/rising',
    icon: Rocket,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'leaderboard-arguments',
    label: 'Arguments Leaderboard',
    sublabel: 'Top argument writers by upvotes, AI quality scores, and citation counts',
    href: '/leaderboard/arguments',
    icon: BookOpen,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-categories',
    label: 'Category Leaderboard',
    sublabel: 'Most active citizens in each civic category — economics, politics, science, and more',
    href: '/leaderboard/categories',
    icon: LayoutGrid,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'leaderboard-coalitions',
    label: 'Coalition Leaderboard',
    sublabel: 'Top coalitions by size, clout, and collective civic impact',
    href: '/leaderboard/coalitions',
    icon: Shield,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'leaderboard-impact',
    label: 'Civic Impact Leaderboard',
    sublabel: 'Who has truly changed the Lobby? Ranked by laws authored, reputation, clout, and reach.',
    href: '/leaderboard/impact',
    icon: Target,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-grades',
    label: 'Grades Leaderboard',
    sublabel: 'Citizens ranked by their overall civic GPA — composite score across all subjects',
    href: '/leaderboard/grades',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-lawmakers',
    label: 'Lawmakers Leaderboard',
    sublabel: 'Citizens who have helped pass the most laws — the architects of civic change',
    href: '/leaderboard/lawmakers',
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-laws',
    label: 'Laws Leaderboard',
    sublabel: 'The most voted-on laws ranked by community engagement and significance',
    href: '/leaderboard/laws',
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-founders',
    label: 'Founding Citizens',
    sublabel: 'Citizens ranked by join order — Patriarchs, Pioneers, Vanguard, and Early Citizens who built the Lobby',
    href: '/leaderboard/founders',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-legends',
    label: 'Legends Leaderboard',
    sublabel: 'The all-time top citizens — highest lifetime clout, reputation, and civic contribution',
    href: '/leaderboard/legends',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-predictions',
    label: 'Predictions Leaderboard',
    sublabel: "Top forecasters ranked by accuracy and Brier score — the Lobby's best predictors",
    href: '/leaderboard/predictions',
    icon: Zap,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'leaderboard-tags',
    label: 'Tag Leaderboard',
    sublabel: 'Top voters in each topic tag — who dominates each niche civic domain',
    href: '/leaderboard/tags',
    icon: Hash,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'leaderboard-today',
    label: "Today's Leaderboard",
    sublabel: "Who's been most civically active in the past 24 hours",
    href: '/leaderboard/today',
    icon: Activity,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-topics',
    label: 'Topics Leaderboard',
    sublabel: 'Hottest topics by total votes, argument count, and community engagement',
    href: '/leaderboard/topics',
    icon: TrendingUp,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-wiki',
    label: 'Wiki Leaderboard',
    sublabel: 'Top wiki contributors — who has written and edited the most topic articles',
    href: '/leaderboard/wiki',
    icon: BookOpen,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'leaderboard-streaks',
    label: 'Streak Masters',
    sublabel: 'Longest active daily voting streaks — Platinum, Gold, Silver, and Bronze tiers',
    href: '/leaderboard/streaks',
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-reputation',
    label: 'Reputation Leaderboard',
    sublabel: 'Citizens ranked by civic reputation — votes cast, topics authored, and laws passed',
    href: '/leaderboard/reputation',
    icon: Shield,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-dissent',
    label: 'The Dissent Index',
    sublabel: 'The Lobby\'s most principled contrarians — citizens who vote in the minority and argue their case anyway',
    href: '/leaderboard/dissent',
    icon: Shuffle,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'leaderboard-week',
    label: 'Weekly Leaderboard',
    sublabel: 'Most active civic citizens this week — votes, arguments, and upvotes',
    href: '/leaderboard/week',
    icon: Calendar,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-month',
    label: 'Monthly Leaderboard',
    sublabel: 'Top contributors for the current calendar month',
    href: '/leaderboard/month',
    icon: CalendarClock,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-year',
    label: 'Annual Leaderboard',
    sublabel: 'Full-year civic rankings — voters, arguers, influencers, and lawmakers',
    href: '/leaderboard/year',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-arena',
    label: 'Argument Arena Champions',
    sublabel: 'Top faceoff win rates — who wins the most head-to-head argument battles',
    href: '/leaderboard/arena',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-bounties',
    label: 'Bounty Board',
    sublabel: 'Who earns the most clout winning bounties — and who funds the chase',
    href: '/leaderboard/bounties',
    icon: Target,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-engagement',
    label: 'Engagement Index',
    sublabel: 'Decathlon-style ranking — who participates most broadly across all civic dimensions',
    href: '/leaderboard/engagement',
    icon: BarChart2,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'leaderboard-reviews',
    label: 'Law Reviewers',
    sublabel: 'Citizens who have written the most law reviews and community star ratings',
    href: '/leaderboard/reviews',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'leaderboard-amendments',
    label: 'Amendment Architects',
    sublabel: 'Who has proposed the most law amendments — driving civic revision and refinement',
    href: '/leaderboard/amendments',
    icon: GitBranch,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'leaderboard-ambassadors',
    label: 'Ambassador Hall',
    sublabel: 'Top civic ambassadors ranked by referrals, recruits, and platform growth contributions',
    href: '/leaderboard/ambassadors',
    icon: Handshake,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'leaderboard-proposals',
    label: 'Proposal Makers',
    sublabel: 'Citizens ranked by the success of their topic proposals — laws passed, voting phases reached, and overall traction',
    href: '/leaderboard/proposals',
    icon: Wand2,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },

  // ─── Law sub-pages ────────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'law-atlas',
    label: 'Law Atlas',
    sublabel: 'Visual geographic and thematic map of all established laws — by scope and category',
    href: '/law/atlas',
    icon: Globe,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'law-categories',
    label: 'Law Categories',
    sublabel: 'Browse all established laws organised by civic category',
    href: '/law/categories',
    icon: LayoutGrid,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'law-compare',
    label: 'Compare Laws',
    sublabel: 'Side-by-side comparison of two established laws — vote splits, arguments, and timelines',
    href: '/law/compare',
    icon: GitCompare,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'law-quality',
    label: 'Law Quality Index',
    sublabel: 'Laws ranked by argument quality, vote consensus, and community engagement depth',
    href: '/law/quality',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },

  // ─── Tags sub-pages ───────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'tags-page',
    label: 'All Tags',
    sublabel: 'Browse every topic tag — filter by category, sort by activity or topic count',
    href: '/tags',
    icon: Hash,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'tags-compare',
    label: 'Compare Tags',
    sublabel: 'Head-to-head tag comparison — vote splits, argument quality, and engagement metrics',
    href: '/tags/compare',
    icon: GitCompare,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
  },
  {
    type: 'link',
    id: 'tags-graph',
    label: 'Tag Graph',
    sublabel: 'Visual network of how civic tags connect — see which topics share overlapping tags',
    href: '/tags/graph',
    icon: Network,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'tags-my-tags',
    label: 'My Tags',
    sublabel: 'Tags you follow — your personalised civic topic subscriptions and digest',
    href: '/tags/my-tags',
    icon: Bookmark,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'tags-radar',
    label: 'Tag Radar',
    sublabel: "Radar chart of your tag engagement — which civic domains you're most active in",
    href: '/tags/radar',
    icon: Activity,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },

  // ─── Other key pages ──────────────────────────────────────────────────────
  {
    type: 'link',
    id: 'top-arguments',
    label: 'Top Arguments',
    sublabel: 'The most upvoted, highest-scored arguments across all topics and categories',
    href: '/top-arguments',
    icon: ThumbsUp,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'quotes',
    label: 'Argument Gallery',
    sublabel: 'Platform-wide gallery of the most memorable arguments — filtered by category, side, and time',
    href: '/quotes',
    icon: Quote,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'vote-map',
    label: 'Civic Scope Map',
    sublabel: 'Topics nested by geographic scope — global, national, regional, and local issues',
    href: '/vote-map',
    icon: Globe,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'word-cloud',
    label: 'Word Cloud',
    sublabel: "The most-used words across all civic arguments — a visual pulse of the Lobby's vocabulary",
    href: '/word-cloud',
    icon: MessageSquare,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'monthly',
    label: 'Monthly Digest',
    sublabel: 'End-of-month roundup — top topics, laws passed, debates held, and civic records',
    href: '/monthly',
    icon: Calendar,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'recommended',
    label: 'Recommended Topics',
    sublabel: 'Topics selected for you based on your voting history, followed tags, and civic archetype',
    href: '/recommended',
    icon: Sparkles,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'knowledge-test',
    label: 'Civic Knowledge Test',
    sublabel: 'Test your understanding of civic topics — a graded assessment of your platform knowledge',
    href: '/knowledge-test',
    icon: BookOpen,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'milestones',
    label: 'Civic Milestones',
    sublabel: "Every milestone you've hit — votes cast, arguments written, laws passed, streaks achieved",
    href: '/milestones',
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'prescient',
    label: 'The Prescient',
    sublabel: 'Citizens who predicted the majority outcome — ranked by prediction accuracy and foresight',
    href: '/prescient',
    icon: Eye,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'arguments-archetypes',
    label: 'Argument Archetypes',
    sublabel: 'The distinct styles of civic arguers — which archetype are you?',
    href: '/arguments/archetypes',
    icon: Dna,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
  },
  {
    type: 'link',
    id: 'arguments-authors',
    label: 'Top Argument Authors',
    sublabel: 'The most prolific and highly-rated argument writers across the platform',
    href: '/arguments/authors',
    icon: BookOpen,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'arguments-champions',
    label: 'Argument Champions',
    sublabel: 'Arguments with the most upvotes, highest AI scores, and widest community reach',
    href: '/arguments/champions',
    icon: Crown,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'arguments-hall-of-fame',
    label: 'Arguments Hall of Fame',
    sublabel: 'The most impactful arguments in Lobby history — law architects and noble dissenters from established laws',
    href: '/arguments/hall-of-fame',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
  },
  {
    type: 'link',
    id: 'civic-wiki',
    label: 'Civic Wiki Portal',
    sublabel: 'Browse featured articles, recent changes, top editors, and category coverage',
    href: '/wiki',
    icon: BookOpen,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
  {
    type: 'link',
    id: 'topic-wiki-recent',
    label: 'Recent Wiki Edits',
    sublabel: "Latest changes to topic wiki articles — who's been writing and revising civic knowledge",
    href: '/topic/wiki/recent',
    icon: History,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
  },
]

// Status label / color helpers for topic results
const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500',
  active: 'text-emerald',
  voting: 'text-purple',
  law: 'text-gold',
  failed: 'text-against-400',
}

// ─── Single result row ────────────────────────────────────────────────────────────────

function ResultRow({
  item,
  isActive,
  onSelect,
}: {
  item: PaletteItem
  isActive: boolean
  onSelect: (item: PaletteItem) => void
}) {
  const baseClass = cn(
    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
    isActive ? 'bg-for-500/15' : 'hover:bg-surface-200'
  )

  if (item.type === 'link') {
    const Icon = item.icon
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => onSelect(item)}
        tabIndex={-1}
      >
        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
            item.iconBg
          )}
        >
          <Icon className={cn('h-4 w-4', item.iconColor)} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-white leading-tight">
            {item.label}
          </span>
          {item.sublabel && (
            <span className="block text-xs text-surface-500 leading-tight mt-0.5">
              {item.sublabel}
            </span>
          )}
        </span>
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
          ↵
        </span>
      </button>
    )
  }

  if (item.type === 'topic') {
    const forPct = Math.round(item.blue_pct)
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => onSelect(item)}
        tabIndex={-1}
      >
        <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10">
          <FileText className="h-4 w-4 text-for-400" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-white leading-tight line-clamp-1">
            {item.statement}
          </span>
          <span className="flex items-center gap-2 mt-0.5">
            {item.category && (
              <span className="text-xs text-surface-500">{item.category}</span>
            )}
            <span
              className={cn(
                'text-[10px] font-mono uppercase',
                STATUS_COLOR[item.status] ?? 'text-surface-500'
              )}
            >
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {forPct}% For
            </span>
          </span>
        </span>
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
          ↵
        </span>
      </button>
    )
  }

  if (item.type === 'law') {
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => onSelect(item)}
        tabIndex={-1}
      >
        <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10">
          <Scale className="h-4 w-4 text-gold" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-white leading-tight line-clamp-1">
            {item.statement}
          </span>
          <span className="flex items-center gap-2 mt-0.5">
            {item.category && (
              <span className="text-xs text-surface-500">{item.category}</span>
            )}
            <span className="text-[10px] font-mono text-gold uppercase">LAW</span>
          </span>
        </span>
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
          ↵
        </span>
      </button>
    )
  }

  // person
  return (
    <button
      type="button"
      className={baseClass}
      onClick={() => onSelect(item)}
      tabIndex={-1}
    >
      <Avatar
        src={item.avatar_url}
        fallback={item.display_name || item.username}
        size="sm"
        className="flex-shrink-0"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-white leading-tight">
          {item.display_name || item.username}
        </span>
        <span className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-surface-500">@{item.username}</span>
          <span className="text-[10px] font-mono text-gold">
            <TrendingUp className="inline h-2.5 w-2.5 mr-0.5" />
            {item.clout.toLocaleString()}
          </span>
        </span>
      </span>
      <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
        ↵
      </span>
    </button>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-2 pb-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
        {label}
      </span>
    </div>
  )
}

// ─── The palette itself ───────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PaletteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived flat list of all navigable items
  const items: PaletteItem[] = useMemo(() => {
    if (query.trim().length < 2) return QUICK_LINKS
    const q2 = query.trim().toLowerCase()
    const pageMatches = QUICK_LINKS.filter((l) =>
      l.label.toLowerCase().includes(q2) ||
      (l.sublabel ?? '').toLowerCase().includes(q2) ||
      l.href.toLowerCase().includes(q2)
    ).slice(0, 5)
    return [...pageMatches, ...results]
  }, [query, results])

  // Trap keyboard focus inside the palette while it is open.
  // autoFocus=false because we manually focus the input below.
  useFocusTrap(panelRef, open, false)

  // Auto-focus input when palette opens; reset state on close
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Fire all three tabs in parallel
      const [topicsRes, lawsRes, peopleRes] = await Promise.all([
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=topics`),
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=laws`),
        fetch(`/api/search?q=${encodeURIComponent(q.trim())}&tab=people`),
      ])

      const [topicsData, lawsData, peopleData] = await Promise.all([
        topicsRes.ok ? topicsRes.json() : { results: [] },
        lawsRes.ok ? lawsRes.json() : { results: [] },
        peopleRes.ok ? peopleRes.json() : { results: [] },
      ])

      const combined: PaletteItem[] = [
        ...(topicsData.results ?? []).slice(0, 4).map(
          (r: Omit<TopicResult, 'type'>) => ({ ...r, type: 'topic' as const })
        ),
        ...(lawsData.results ?? []).slice(0, 3).map(
          (r: Omit<LawResult, 'type'>) => ({ ...r, type: 'law' as const })
        ),
        ...(peopleData.results ?? []).slice(0, 3).map(
          (r: Omit<PersonResult, 'type'>) => ({ ...r, type: 'person' as const })
        ),
      ]

      setResults(combined)
      setActiveIndex(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  // Navigate to the selected item
  const navigateTo = useCallback(
    (item: PaletteItem) => {
      onClose()
      let href = '/'

      if (item.type === 'link') href = item.href
      else if (item.type === 'topic') href = `/topic/${item.id}`
      else if (item.type === 'law') href = `/law/${item.id}`
      else if (item.type === 'person') href = `/profile/${item.username}`

      router.push(href)
    },
    [onClose, router]
  )

  // Keyboard: ↑ ↓ Enter Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[activeIndex]
        if (item) navigateTo(item)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [items, activeIndex, navigateTo, onClose]
  )

  // Scroll active item into view
  useEffect(() => {
    const list = scrollRef.current
    if (!list) return
    const el = list.querySelectorAll('[data-palette-item]')[activeIndex] as
      | HTMLElement
      | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Group labels when showing search results
  const topicsInResults = results.filter((r) => r.type === 'topic')
  const lawsInResults = results.filter((r) => r.type === 'law')
  const peopleInResults = results.filter((r) => r.type === 'person')

  // Filter QUICK_LINKS by query label/sublabel for page search
  const normalizedQ = query.trim().toLowerCase()
  const matchingPages: QuickLink[] = useMemo(() => {
    if (query.trim().length < 2) return []
    return QUICK_LINKS.filter((l) =>
      l.label.toLowerCase().includes(normalizedQ) ||
      (l.sublabel ?? '').toLowerCase().includes(normalizedQ) ||
      l.href.toLowerCase().includes(normalizedQ)
    ).slice(0, 5)
  }, [normalizedQ, query])

  // Build labelled sections for search results
  const sections: Array<{ label: string; items: PaletteItem[] }> = []
  if (matchingPages.length > 0)
    sections.push({ label: 'Pages', items: matchingPages })
  if (topicsInResults.length > 0)
    sections.push({ label: 'Topics', items: topicsInResults })
  if (lawsInResults.length > 0)
    sections.push({ label: 'Laws', items: lawsInResults })
  if (peopleInResults.length > 0)
    sections.push({ label: 'People', items: peopleInResults })

  // Flat index offset for highlighting within grouped sections
  function globalIndex(sectionIdx: number, rowIdx: number): number {
    let offset = 0
    for (let s = 0; s < sectionIdx; s++) offset += sections[s].items.length
    return offset + rowIdx
  }

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9995] flex items-start justify-center px-4 pt-[12vh] pb-8"
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-label="Command palette"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            key="command-palette-panel"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative z-10 w-full max-w-lg',
              'rounded-2xl overflow-hidden',
              'bg-surface-100 border border-surface-300',
              'shadow-2xl shadow-black/60'
            )}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-300">
              {loading ? (
                <Loader2 className="h-4 w-4 text-surface-500 animate-spin flex-shrink-0" />
              ) : (
                <Search className="h-4 w-4 text-surface-500 flex-shrink-0" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search topics, laws, people…"
                className={cn(
                  'flex-1 bg-transparent text-sm text-white placeholder:text-surface-500',
                  'focus:outline-none'
                )}
                autoComplete="off"
                spellCheck={false}
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setActiveIndex(0)
                    inputRef.current?.focus()
                  }}
                  className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                  aria-label="Clear search"
                  tabIndex={-1}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:flex flex-shrink-0 items-center justify-center px-1.5 py-0.5 rounded-md bg-surface-200 border border-surface-400 text-[10px] font-mono text-surface-500">
                esc
              </kbd>
            </div>

            {/* Results area */}
            <div
              ref={scrollRef}
              className="overflow-y-auto overscroll-contain max-h-[min(420px,60dvh)] py-1"
            >
              {/* No query: show quick links */}
              {query.trim().length < 2 && (
                <>
                  <SectionHeader label="Quick Navigation" />
                  {QUICK_LINKS.map((link, i) => (
                    <div key={link.id} data-palette-item>
                      <ResultRow
                        item={link}
                        isActive={i === activeIndex}
                        onSelect={navigateTo}
                      />
                    </div>
                  ))}
                </>
              )}

              {/* With query: show grouped results */}
              {query.trim().length >= 2 && !loading && sections.length === 0 && matchingPages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
                  <Search className="h-6 w-6 text-surface-500" />
                  <p className="text-sm text-surface-500">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      router.push(
                        `/search?q=${encodeURIComponent(query.trim())}`
                      )
                    }}
                    className="mt-1 text-xs text-for-400 hover:text-for-300 transition-colors underline-offset-2 hover:underline"
                  >
                    Open full search page
                  </button>
                </div>
              )}

              {query.trim().length >= 2 && sections.length > 0 &&
                sections.map((section, si) => (
                  <div key={section.label}>
                    <SectionHeader label={section.label} />
                    {section.items.map((item, ri) => (
                      <div key={item.id} data-palette-item>
                        <ResultRow
                          item={item}
                          isActive={globalIndex(si, ri) === activeIndex}
                          onSelect={navigateTo}
                        />
                      </div>
                    ))}
                  </div>
                ))}

              {/* Quick link to full search page */}
              {query.trim().length >= 2 && sections.length > 0 && (
                <div className="px-4 py-2 mt-1 border-t border-surface-300">
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      router.push(
                        `/search?q=${encodeURIComponent(query.trim())}`
                      )
                    }}
                    className="flex items-center gap-2 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    See all results for &ldquo;{query}&rdquo;
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-surface-300 bg-surface-50">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">↑↓</kbd>
                navigate
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">↵</kbd>
                open
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">esc</kbd>
                close
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    import('@/lib/hooks/useKeyboardShortcuts').then(({ openKeyboardShortcuts }) => {
                      openKeyboardShortcuts()
                    })
                  }}
                  className="flex items-center gap-1.5 text-surface-600 hover:text-surface-700 transition-colors"
                  aria-label="Show keyboard shortcuts"
                >
                  <HelpCircle className="h-3 w-3" />
                  <kbd className="px-1 py-0.5 rounded bg-surface-200 border border-surface-400 text-surface-500">
                    ?
                  </kbd>
                  shortcuts
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
