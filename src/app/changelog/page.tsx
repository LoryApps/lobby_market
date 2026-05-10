import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  Award,
  BarChart2,
  Bell,
  BookOpen,
  Brain,
  CalendarClock,
  Bot,
  Building2,
  CheckCircle2,
  Coins,
  Compass,
  Crown,
  Eye,
  Flag,
  FlaskConical,
  Flame,
  Gamepad2,
  Gavel,
  GitBranch,
  Globe,
  Hash,
  Heart,
  History,
  Layers,
  Mail,
  MessageSquare,
  Mic,
  Network,
  Radio,
  Rocket,
  Scale,
  Search,
  Gauge,
  Shield,
  Skull,
  Sliders,
  Sparkles,
  Star,
  Swords,
  Tag,
  Target,
  Timer,
  Trophy,
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

// ─── Types ────────────────────────────────────────────────────────────────────────────────────────────────────────

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

// ─── Chapters ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
      { icon: Mail, label: 'Civic Letter Generator — AI letters to reps, op-eds, petitions, social threads', href: '/letter', color: 'text-for-400' },
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
      { icon: Activity, label: 'Vote Stream — live ticker of every vote landing on the platform', href: '/vote-stream', color: 'text-for-400' },
    ],
  },
  {
    number: 'Ch. 13',
    title: 'Civic Governance',
    subtitle: 'Elections, values dilemmas, and the archive of civic choices',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Vote, label: 'Civic Elections — monthly democratic elections for Senate, Troll Catcher, and Elder roles', href: '/elections', color: 'text-purple' },
      { icon: Scale, label: 'Civic Crossroads — weekly values dilemmas: two fundamental civic values in direct tension', href: '/crossroads', color: 'text-for-400' },
      { icon: History, label: 'Values Vault — browse all 8 dilemmas with community results and your personal values profile', href: '/crossroads/archive', color: 'text-purple' },
    ],
  },
  {
    number: 'Ch. 14',
    title: 'Seasons & Civic Progression',
    subtitle: 'XP, leagues, skill trees, milestones, and seasonal competition',
    accent: 'text-gold',
    borderColor: 'border-gold/30',
    bgColor: 'bg-gold/5',
    textColor: 'text-gold',
    items: [
      { icon: Crown, label: 'Civic Seasons — ranked seasonal competition with XP and league tiers', href: '/season', color: 'text-gold' },
      { icon: Trophy, label: 'Season leaderboard — top citizens ranked by seasonal XP', href: '/seasons', color: 'text-gold' },
      { icon: Sparkles, label: 'Civic Wrapped — shareable year-in-review civic scorecard', href: '/wrapped', color: 'text-purple' },
      { icon: Star, label: 'Civic Skill Tree — 5-branch RPG progression: Voter, Orator, Scholar, Strategist, Sage', href: '/skill-tree', color: 'text-gold' },
      { icon: Award, label: 'Personal Milestones — every civic first and breakthrough moment', href: '/milestones', color: 'text-emerald' },
      { icon: Target, label: 'Daily Missions — three rotating civic challenges with Clout rewards', href: '/missions', color: 'text-for-400' },
      { icon: Flame, label: 'Enhanced streaks and weekly civic goals', href: '/streaks', color: 'text-against-400' },
    ],
  },
  {
    number: 'Ch. 15',
    title: 'Evidence & Research Layer',
    subtitle: 'Factual evidence boards, tags, topic synthesis, and AI analysis',
    accent: 'text-emerald',
    borderColor: 'border-emerald/30',
    bgColor: 'bg-emerald/5',
    textColor: 'text-emerald',
    items: [
      { icon: FlaskConical, label: 'Topic Evidence Board — submit and upvote factual evidence for any debate', href: '/evidence', color: 'text-emerald' },
      { icon: Bot, label: 'AI Evidence Analysis — Claude credibility ratings for submitted sources', color: 'text-purple' },
      { icon: Sparkles, label: 'Topic Synthesis — AI-summarised FOR and AGAINST stances with key arguments', color: 'text-gold' },
      { icon: Hash, label: 'Topic Tags — keyword tagging with follow-to-feed integration', href: '/tags', color: 'text-for-400' },
      { icon: Tag, label: 'Tag AI Briefs — per-tag summaries of all debates in that category', href: '/tags', color: 'text-emerald' },
      { icon: Network, label: 'Tag network graph — visualise how topics cluster by shared tags', href: '/tags/graph', color: 'text-purple' },
      { icon: GitBranch, label: 'Common Threads — recurring value clusters across all debates', href: '/common-threads', color: 'text-gold' },
    ],
  },
  {
    number: 'Ch. 16',
    title: 'Prediction Markets',
    subtitle: 'Stake your conviction, forecast outcomes, and earn prescient status',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Target, label: 'Civic Predictions — stake 100 points on debate outcomes before votes are cast', href: '/predictions', color: 'text-purple' },
      { icon: Sparkles, label: 'Oracle — AI-powered outcome probability with confidence intervals', href: '/oracle', color: 'text-gold' },
      { icon: Trophy, label: 'Forecasters leaderboard — ranked by prediction accuracy', href: '/forecasters', color: 'text-gold' },
      { icon: BarChart2, label: 'Civic Forecast Engine — base-rate probability model for voting topics', href: '/forecast', color: 'text-for-400' },
      { icon: Award, label: 'Prescient badge — earned by citizens with high forecast accuracy', color: 'text-emerald' },
    ],
  },
  {
    number: 'Ch. 17',
    title: 'Live Intelligence Board',
    subtitle: 'Real-time platform pulse, contested topics, and velocity rankings',
    accent: 'text-against-400',
    borderColor: 'border-against-500/30',
    bgColor: 'bg-against-500/5',
    textColor: 'text-against-400',
    items: [
      { icon: TrendingUp, label: 'Momentum — topics ranked by live vote velocity and acceleration', href: '/momentum', color: 'text-against-400' },
      { icon: Zap, label: 'Battleground — most contested 50/50 topics at this moment', href: '/battleground', color: 'text-against-400' },
      { icon: Timer, label: 'Topic Race — debates approaching the voting threshold in real-time', href: '/race', color: 'text-gold' },
      { icon: Flame, label: 'Hotspot — cross-platform surge detection for breakout topics', href: '/hotspot', color: 'text-against-400' },
      { icon: Radio, label: 'Civic Now — live civic status board: heartbeat, contested topics, final-phase voting', href: '/now', color: 'text-for-400' },
      { icon: Activity, label: 'Observatory — platform discourse health: polarisation, debate quality, vitality', href: '/observatory', color: 'text-emerald' },
      { icon: BarChart2, label: 'Civic Radar — fast-moving topics with dramatic stance shifts', href: '/radar', color: 'text-for-400' },
    ],
  },
  {
    number: 'Ch. 18',
    title: 'Civic Identity & Advanced Engagement',
    subtitle: 'Archetypes, pledges, petitions, karma, and your civic legacy',
    accent: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    textColor: 'text-for-300',
    items: [
      { icon: Compass, label: 'Civic Archetype — 10-question personality quiz revealing 8 civic identities', href: '/archetype', color: 'text-purple' },
      { icon: Heart, label: 'Civic Pledge Wall — public commitments witnessed by the community', href: '/pledges', color: 'text-against-400' },
      { icon: Flag, label: 'Civic Petitions — formal proposals with signature thresholds', href: '/petitions', color: 'text-for-400' },
      { icon: Eye, label: 'Civic Watchdog — track government commitments and hold representatives accountable', href: '/watchdog', color: 'text-emerald' },
      { icon: Star, label: 'Civic Karma — reputation score combining consistency, influence, and civic virtue', href: '/karma', color: 'text-gold' },
      { icon: Scale, label: 'Perspective Swap — confront the strongest steel-man argument for the opposing view', href: '/perspective', color: 'text-for-400' },
      { icon: Users, label: 'Civic Cohort — find the users who vote most like you across all debates', href: '/cohort', color: 'text-purple' },
      { icon: Swords, label: 'Civic Rivals & Twins — discover your biggest civic opponents and closest allies', href: '/rivals', color: 'text-against-400' },
    ],
  },
  {
    number: 'Ch. 19',
    title: 'Civic Lawmakers',
    subtitle: 'Who helped shape the law? Ranked by co-authored laws via winning FOR votes',
    accent: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    textColor: 'text-for-300',
    items: [
      { icon: Gavel, label: 'Civic Lawmakers Leaderboard — top citizens ranked by laws they helped pass', href: '/leaderboard/lawmakers', color: 'text-for-400' },
      { icon: Trophy, label: 'Podium view for top 3 co-authors with law count and contribution rate', href: '/leaderboard/lawmakers', color: 'text-gold' },
      { icon: TrendingUp, label: 'Contribution rate — % of FOR votes that became law per user', href: '/leaderboard/lawmakers', color: 'text-emerald' },
      { icon: Scale, label: "Signature laws — each legislator's most impactful co-authored laws", href: '/leaderboard/lawmakers', color: 'text-gold' },
      { icon: Activity, label: 'Period filters — All Time, Last 90 Days, Last 30 Days', href: '/leaderboard/lawmakers', color: 'text-for-300' },
    ],
  },
  {
    number: 'Ch. 20',
    title: 'Debate Scheduling Hub',
    subtitle: 'Upcoming debate RSVP on the dashboard and a flexible scheduling API',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Bell, label: "Upcoming Debates card on /dashboard — RSVP'd debates for the next 7 days", href: '/dashboard', color: 'text-purple' },
      { icon: Timer, label: 'Flexible window_hours param on /api/me/upcoming-rsvps (default 2h, max 7d)', href: '/dashboard', color: 'text-for-400' },
      { icon: Mic, label: 'Debate countdown banners with live RSVP state on the main feed', href: '/', color: 'text-against-400' },
    ],
  },
  {
    number: 'Ch. 21',
    title: 'Debate Winner Poll',
    subtitle: 'Community vote on who argued better — independent of the underlying topic stance',
    accent: 'text-gold',
    borderColor: 'border-gold/30',
    bgColor: 'bg-gold/5',
    textColor: 'text-gold',
    items: [
      { icon: Vote, label: '"Who argued better?" poll on every debate recap — FOR side, AGAINST side, or Tie', href: '/debate', color: 'text-gold' },
      { icon: Trophy, label: 'Animated result bars reveal after voting with per-option win percentages', href: '/debate', color: 'text-gold' },
      { icon: Users, label: 'Live voter count with sign-in prompt for guests', href: '/debate', color: 'text-for-400' },
      { icon: Activity, label: 'API endpoint /api/debates/[id]/winner-poll with one-vote-per-user enforcement', href: '/debate', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 22',
    title: 'Debate Sway Arc',
    subtitle: 'Checkpoint-by-checkpoint audience opinion arc on every debate recap',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: TrendingUp, label: 'Animated SVG line chart showing FOR vs AGAINST sentiment at each of the 3 live checkpoints', href: '/debate', color: 'text-purple' },
      { icon: Activity, label: 'Smooth cubic-bezier curve with framer-motion pathLength animation — draws itself on load', href: '/debate', color: 'text-for-400' },
      { icon: BarChart2, label: 'Per-checkpoint vote tallies (blue and red count at each round) with percentage labels', href: '/debate', color: 'text-emerald' },
      { icon: Timer, label: 'GET /api/debates/[id]/sway endpoint returning arc data with has_data guard for sparse debates', href: '/debate', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 23',
    title: 'Civic Bingo',
    subtitle: 'Weekly 5×5 bingo card — mark topics as they pass into law and win five in a row',
    accent: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    textColor: 'text-for-400',
    items: [
      { icon: Star, label: '5×5 weekly bingo card seeded with 24 live topics — same card for all users via ISO week key', href: '/bingo', color: 'text-for-400' },
      { icon: Gavel, label: 'Topics that reach LAW status auto-mark their square; users can manually mark any voted square', href: '/bingo', color: 'text-gold' },
      { icon: Trophy, label: 'Win detection for all 12 possible lines (5 rows + 5 columns + 2 diagonals) with confetti burst', href: '/bingo', color: 'text-gold' },
      { icon: Activity, label: 'Seeded deterministic shuffle (no DB writes needed) + localStorage persistence across sessions', href: '/bingo', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 24',
    title: 'Civic Gauntlet',
    subtitle: 'Sudden-death survival — pick the majority side each round or be eliminated',
    accent: 'text-against-400',
    borderColor: 'border-against-500/30',
    bgColor: 'bg-against-500/5',
    textColor: 'text-against-400',
    items: [
      { icon: Swords, label: 'Sudden-death survival game: topics ordered easy → hard (strong majorities first, deadlocks last)', href: '/gauntlet', color: 'text-against-400' },
      { icon: Timer, label: '10-second countdown per round with colour-shifting timer bar (green → gold → red under pressure)', href: '/gauntlet', color: 'text-gold' },
      { icon: Trophy, label: 'Best-streak saved to localStorage; displayed on the Arcade hub alongside Blitz high score', href: '/arcade', color: 'text-gold' },
      { icon: Activity, label: '3-second countdown before first round, full round log on death screen, share-result button', href: '/gauntlet', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 25',
    title: 'Civic Rank + Civic Sprint',
    subtitle: 'Daily law-sorting game + 10-round closed-topic prediction challenge',
    accent: 'text-gold',
    borderColor: 'border-gold/30',
    bgColor: 'bg-gold/5',
    textColor: 'text-gold',
    items: [
      { icon: ArrowDownUp, label: 'Civic Rank: daily sorting game — 5 rounds of 4 laws each, arrange from highest % FOR to lowest', href: '/civic-rank', color: 'text-gold' },
      { icon: Timer, label: 'Civic Sprint: 10-round prediction game — guess law or failed on closed topics, 15 seconds per round', href: '/sprint', color: 'text-gold' },
      { icon: Zap, label: 'Sprint speed bonus: up to +5 pts for fast correct calls; correct = +10, wrong = 0. Max 150 pts.', href: '/sprint', color: 'text-gold' },
      { icon: Star, label: 'Civic Bingo added to Arcade hub with weekly win-line tracking and completion status', href: '/arcade', color: 'text-for-400' },
      { icon: Gamepad2, label: 'Arcade hub now tracks 8 daily + 2 weekly games; progress strip shows Sprint best and Rank best', href: '/arcade', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 26',
    title: 'Civic Timeline',
    subtitle: 'Daily chronology challenge — arrange 5 laws from oldest to newest across 3 rounds',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: CalendarClock, label: 'Daily sorting game: 3 rounds of 5 laws each — arrange from oldest established to newest', href: '/civic-timeline', color: 'text-purple' },
      { icon: Timer, label: '60-second countdown per round with colour-shifting timer bar (purple → gold → red)', href: '/civic-timeline', color: 'text-against-400' },
      { icon: Trophy, label: 'Score 4 pts per correctly placed law — 60 pts max; same laws for every player each day', href: '/civic-timeline', color: 'text-gold' },
      { icon: BarChart2, label: 'Reveal phase shows correct chronological order with establishment dates for each law', href: '/civic-timeline', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 27',
    title: 'Civic Imposter',
    subtitle: 'Daily fake-law detection — spot the one plausible imposter hiding among five real Codex laws',
    accent: 'text-against-400',
    borderColor: 'border-against-600/30',
    bgColor: 'bg-against-600/5',
    textColor: 'text-against-400',
    items: [
      { icon: Skull, label: 'Daily game: six law statements appear — five are real Lobby Codex laws, one is a plausible-sounding fake. One guess per day.', href: '/civic-imposter', color: 'text-against-400' },
      { icon: Search, label: 'Streak mechanic: correct daily answers build a consecutive-day detection streak displayed on completion', href: '/civic-imposter', color: 'text-surface-400' },
      { icon: Trophy, label: 'Share result: copy a spoiler-free result snippet (correct/fooled + streak) for social sharing', href: '/civic-imposter', color: 'text-gold' },
      { icon: Gamepad2, label: 'Arcade hub now tracks 11 daily games; Civic Imposter completion status and streak shown on hub', href: '/arcade', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 28',
    title: 'Civic Mirror',
    subtitle: 'Daily gut-check — vote FOR or AGAINST on 5 topics, then see if you\'re with the majority or a contrarian outlier',
    accent: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    textColor: 'text-for-400',
    items: [
      { icon: Gauge, label: 'Daily game: 5 civic topics with vote splits hidden — tap FOR or AGAINST on gut instinct, then see the community majority revealed', href: '/civic-mirror', color: 'text-for-400' },
      { icon: Users, label: 'Instant reveal: animated vote bar shows the real FOR/AGAINST split after each answer, with majority/minority verdict', href: '/civic-mirror', color: 'text-for-300' },
      { icon: Trophy, label: 'Score 1 pt per vote cast with the majority — max 5. Receive a persona label: Consensus Voice, Centrist, Independent, or Contrarian Outsider', href: '/civic-mirror', color: 'text-gold' },
      { icon: Gamepad2, label: 'Arcade hub: Civic Mirror shown in daily challenges with score display (x/5 majority)', href: '/arcade', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 29',
    title: 'Civic Odd One Out',
    subtitle: 'Daily category-spotting challenge — four topics, three in the same category, one intruder',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Layers, label: 'Daily game: 4 civic topics per round — three share a policy category, one is the odd one out. Tap the intruder.', href: '/odd-one-out', color: 'text-purple' },
      { icon: Target, label: 'Three lives system: wrong picks cost a life; lose all three and the game ends early', href: '/odd-one-out', color: 'text-against-400' },
      { icon: Trophy, label: 'Score up to 100 pts across 5 rounds; same topics for all players each day via deterministic daily seed', href: '/odd-one-out', color: 'text-gold' },
      { icon: Gamepad2, label: 'Arcade hub updated: Odd One Out shown in daily challenges with score display and completion ring', href: '/arcade', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 30',
    title: 'Civic Decoder',
    subtitle: 'Daily argument-recognition challenge — read three real snippets and identify which civic topic they came from',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Search, label: 'Daily game: 5 rounds — each shows 3 real argument snippets (FOR or AGAINST) from a mystery topic. Pick the correct topic from 4 options.', href: '/civic-decoder', color: 'text-purple' },
      { icon: Timer, label: '30-second countdown per round with colour-shifting timer bar (green → gold → red); auto-submits on timeout', href: '/civic-decoder', color: 'text-gold' },
      { icon: Trophy, label: '10 pts per correct answer, 50 pts max. Decoys prefer the same policy category to keep it challenging', href: '/civic-decoder', color: 'text-gold' },
      { icon: Gamepad2, label: 'Share result: 🟩🟥 emoji grid + score. Arcade hub tracks daily completion and score. Same puzzle for all players each day.', href: '/arcade', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 31',
    title: 'Civic Recall',
    subtitle: 'Daily flash-memory challenge — study 6 civic topics for 15 seconds then find them in a grid of 12',
    accent: 'text-emerald',
    borderColor: 'border-emerald/30',
    bgColor: 'bg-emerald/5',
    textColor: 'text-emerald',
    items: [
      { icon: Brain, label: 'Study phase: 6 target topics flash on screen for 15 seconds — category, status, vote split all visible. Memorise them.', href: '/civic-recall', color: 'text-emerald' },
      { icon: Search, label: 'Recall phase: 12 topics appear in random order (6 targets + 6 decoys). Select exactly the 6 you studied.', href: '/civic-recall', color: 'text-for-400' },
      { icon: Trophy, label: '10 pts per correct pick, −5 pts per wrong pick, min 0. Max 60 pts. Deterministic daily seed for shared puzzles.', href: '/civic-recall', color: 'text-gold' },
      { icon: Gamepad2, label: 'Arcade hub tracks daily completion and score. Share result as emoji grid + score.', href: '/arcade', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 32',
    title: 'Civic Verdict',
    subtitle: 'Daily jury game — read FOR and AGAINST arguments and render your verdict on 5 mystery debates',
    accent: 'text-against-400',
    borderColor: 'border-against-500/30',
    bgColor: 'bg-against-500/5',
    textColor: 'text-against-400',
    items: [
      { icon: Gavel, label: 'Daily game: 5 mystery debates. Each round shows one real FOR argument and one real AGAINST argument — topic statement hidden.', href: '/civic-verdict', color: 'text-against-400' },
      { icon: Scale, label: 'Vote FOR or AGAINST based purely on argument quality. After your pick, the topic is revealed along with the platform\'s actual vote split.', href: '/civic-verdict', color: 'text-for-400' },
      { icon: Trophy, label: '10 pts when your verdict matches the majority. Max 50 pts. Letter grade S–D on completion. Daily lock with share snippet.', href: '/civic-verdict', color: 'text-gold' },
      { icon: Gamepad2, label: 'Arcade hub tracks daily completion and score (0–50). Results link directly to each debate for deeper engagement.', href: '/arcade', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 33',
    title: 'Civic Gauge',
    subtitle: 'Daily estimation game — outcome known, percentage hidden',
    accent: 'text-gold',
    borderColor: 'border-gold/30',
    bgColor: 'bg-gold/5',
    textColor: 'text-gold',
    items: [
      { icon: Sliders, label: 'Daily game: 5 resolved debates — Law or Failed status shown, exact FOR% hidden. Drag a slider to guess the percentage.', href: '/gauge', color: 'text-gold' },
      { icon: Target, label: 'Precision scoring: ≤5% off = 20 pts, ≤10% = 15 pts, ≤20% = 10 pts, ≤30% = 5 pts, else 0. Max 100 pts per session.', href: '/gauge', color: 'text-gold' },
      { icon: Sparkles, label: 'Seeded daily shuffle — all players get the same 5 questions each day from the law + failed pool (≥10 votes).', href: '/gauge', color: 'text-gold' },
      { icon: Trophy, label: 'Grade S–F on completion (S = 90+). Animated reveal bars, shareable emoji result snippet, daily localStorage lock.', href: '/gauge', color: 'text-gold' },
    ],
  },
  {
    number: 'Ch. 34',
    title: 'Argument Hall of Fame',
    subtitle: 'Persistent AI grades on arguments — A through F, visible to all',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Award, label: 'AI critique grades (A/B/C/D/F) and numeric scores (1–10) now persist to the argument permanently after the author runs a critique.', href: '/top-arguments', color: 'text-purple' },
      { icon: MessageSquare, label: 'Grade badge appears on argument cards — colour-coded (emerald A → red F) — giving instant quality signals to readers.', href: '/top-arguments', color: 'text-purple' },
      { icon: TrendingUp, label: 'Draft-to-grade flow: run critique before submitting, then submit — grade is auto-attached to the new argument record.', href: '/top-arguments', color: 'text-purple' },
      { icon: Trophy, label: 'New /top-arguments leaderboard: filter by grade, side (FOR/AGAINST), and time period. Ranked by AI score then upvotes.', href: '/top-arguments', color: 'text-gold' },
    ],
  },
  {
    number: 'Ch. 35',
    title: 'AI Debate Assist',
    subtitle: 'Inline AI response suggestions — 3 strategic angles for countering any argument',
    accent: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    textColor: 'text-purple',
    items: [
      { icon: Bot, label: '"How to respond" button appears on every opposing argument card. One click generates 3 AI response strategies for the other side.', href: '/', color: 'text-purple' },
      { icon: MessageSquare, label: 'Three distinct angles: Challenge the premise (counter), Introduce new evidence (extend), Reframe the stakes (reinforce) — each with a copyable opening sentence.', href: '/', color: 'text-for-400' },
      { icon: Sparkles, label: 'Powered by Claude Haiku — fast, focused, and grounded in the specific topic and argument context. Gracefully degrades when AI is unavailable.', href: '/', color: 'text-against-400' },
      { icon: Target, label: 'Lazy-loaded: suggestions only fetch when requested. Cached per session so re-opening the panel is instant. Logged-in users only.', href: '/', color: 'text-surface-400' },
    ],
  },
  {
    number: 'Ch. 36',
    title: 'Debate Quality Panel',
    subtitle: 'Per-topic argument quality heatmap — AI grade distribution for FOR vs AGAINST',
    accent: 'text-emerald',
    borderColor: 'border-emerald/30',
    bgColor: 'bg-emerald/5',
    textColor: 'text-emerald',
    items: [
      { icon: BarChart2, label: 'New "Debate Quality" collapsible panel in the Arguments tab — shows grade distribution (A–F) for each side.', href: '/', color: 'text-emerald' },
      { icon: Award, label: 'Three-column score summary: FOR avg · Overall avg · AGAINST avg — instantly shows which side has stronger arguments.', href: '/', color: 'text-for-400' },
      { icon: Sparkles, label: 'Stacked grade bars visualise the distribution at a glance — emerald for A, blue for B, gold for C, red for D/F.', href: '/', color: 'text-gold' },
      { icon: Target, label: 'Quality-edge callout when one side holds a ≥1pt advantage. Links to /top-arguments. Gracefully hidden until grades exist.', href: '/top-arguments', color: 'text-surface-400' },
    ],
  },
]

// ─── Stat pills ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '36', label: 'chapters shipped' },
  { value: '250+', label: 'features built' },
  { value: '68', label: 'DB migrations' },
  { value: '355+', label: 'API routes' },
]

// ─── Recent builds ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
    title: 'Debate Quality Panel',
    description: "Every topic's Arguments tab now shows a Debate Quality panel: AI grade distribution (A–F) for FOR and AGAINST arguments side-by-side, a three-column score summary, stacked bar charts, and a quality-edge callout when one side holds a measurable argumentation advantage.",
    icon: BarChart2,
    color: 'text-emerald',
    tag: 'Ch. 36',
  },
  {
    title: 'AI Debate Assist',
    description: 'Inline response suggestion panel on every opposing argument card. Click "How to respond" to get 3 AI-generated strategic angles — Challenge the premise, Introduce new evidence, Reframe the stakes — each with a copyable opening sentence to spark your own argument.',
    icon: Bot,
    color: 'text-purple',
    tag: 'Ch. 35',
  },
  {
    title: 'Argument Hall of Fame',
    description: 'AI critique grades (A–F, 1–10) now persist to argument records. Grade badges appear on all argument cards. Draft-to-grade flow: critique before submitting — grade auto-attached on post. New /top-arguments leaderboard ranked by AI score then upvotes.',
    href: '/top-arguments',
    icon: Award,
    color: 'text-purple',
    tag: 'Ch. 34',
  },
  {
    title: 'Civic Gauge',
    description: 'Daily estimation game — outcome known, percentage hidden. Guess the exact FOR% on 5 resolved debates with a drag slider. Precision scoring, seeded daily questions, S–F grade.',
    href: '/gauge',
    icon: Sliders,
    color: 'text-gold',
    tag: 'Ch. 33',
  },
  {
    title: 'Civic Verdict',
    description: 'A daily jury game. Five mystery debates — each round reveals one real FOR argument and one real AGAINST argument, topic hidden. Render your verdict based on argument quality alone. Score 10 pts when you match the platform\'s majority. 50 pts max, letter grade S–D, shareable result snippet.',
    href: '/civic-verdict',
    icon: Gavel,
    color: 'text-against-400',
    tag: 'Ch. 32',
  },
  {
    title: 'Civic Recall',
    description: 'A daily flash-memory challenge. Six civic topics appear for 15 seconds — study them carefully. Then identify those exact six from a grid of twelve (including six look-alike decoys). 10 pts per correct pick, −5 per wrong. Max 60 pts. Deterministic daily seed for shared puzzles across all players.',
    href: '/civic-recall',
    icon: Brain,
    color: 'text-emerald',
    tag: 'Ch. 31',
  },
  {
    title: 'Civic Decoder',
    description: 'A daily argument-recognition puzzle. Each round shows three real argument snippets (FOR or AGAINST) from a mystery civic debate — read them and identify which topic they came from out of four options. Five rounds, 30-second timer, 50 pts max. Same puzzle for all players each day.',
    href: '/civic-decoder',
    icon: Search,
    color: 'text-purple',
    tag: 'Ch. 30',
  },
  {
    title: 'Civic Odd One Out',
    description: 'A daily category-spotting challenge. Four civic topics appear each round — three share the same policy category, one is the intruder. Tap the odd one out before your three lives run out. Five rounds, 100 pts max. Deterministic daily seed means everyone plays the same puzzle.',
    href: '/odd-one-out',
    icon: Layers,
    color: 'text-purple',
    tag: 'Ch. 29',
  },
  {
    title: 'Civic Mirror',
    description: 'A daily self-awareness game. Five civic topics shown with vote splits hidden — tap FOR or AGAINST on gut instinct. After each vote, the community majority is instantly revealed. Score how often you\'re with the majority and receive your civic persona label.',
    href: '/civic-mirror',
    icon: Gauge,
    color: 'text-for-400',
    tag: 'Ch. 28',
  },
  {
    title: 'Civic Imposter',
    description: 'A daily fake-law detection challenge. Six law statements appear — five are real established laws from the Lobby Codex, one is a plausible-sounding fake. One guess per day. Build a consecutive-day detection streak and share your result without spoilers.',
    href: '/civic-imposter',
    icon: Skull,
    color: 'text-against-400',
    tag: 'Ch. 27',
  },
  {
    title: 'Civic Timeline',
    description: 'A daily chronology challenge. Three rounds, five established laws each. Arrange them from oldest to newest — by when the community passed them into law. Tests historical civic knowledge with a 60-second countdown and reveal showing actual establishment dates.',
    href: '/civic-timeline',
    icon: CalendarClock,
    color: 'text-purple',
    tag: 'Ch. 26',
  },
  {
    title: 'Civic Sprint',
    description: 'A daily 10-round prediction game. Closed topics are shown without their outcome — guess whether each became law or failed. Race the 15-second timer for speed bonuses. Best score persists; new set of topics each day.',
    href: '/sprint',
    icon: Timer,
    color: 'text-gold',
    tag: 'Ch. 25',
  },
  {
    title: 'Civic Rank',
    description: 'A daily law-sorting challenge. Five rounds, four established laws each. Arrange them from highest community support (% voted FOR) to lowest. Same laws for every player each day — see how well you know which laws passed with a strong mandate.',
    href: '/civic-rank',
    icon: ArrowDownUp,
    color: 'text-gold',
    tag: 'Ch. 25',
  },
  {
    title: 'Civic Gauntlet',
    description: 'A sudden-death survival game. Topics arrive sorted from easy majorities to near-deadlocks. Pick the community\'s winning side each round — one wrong answer ends your run. Beat your best streak.',
    href: '/gauntlet',
    icon: Swords,
    color: 'text-against-400',
    tag: 'Ch. 24',
  },
  {
    title: 'Civic Bingo',
    description: 'A weekly 5×5 bingo card of civic topics. Laws that pass auto-mark your squares. Get five in a row — horizontally, vertically, or diagonally — for the BINGO. Deterministic per ISO week so every user plays the same card.',
    href: '/bingo',
    icon: Star,
    color: 'text-for-400',
    tag: 'Ch. 23',
  },
  {
    title: 'Debate Sway Arc',
    description: 'An animated SVG line chart on every debate recap showing how audience opinion shifted at each of the 3 live checkpoints — from start through to the final sway result.',
    href: '/debate',
    icon: TrendingUp,
    color: 'text-purple',
    tag: 'Ch. 22',
  },
  {
    title: 'Debate Winner Poll',
    description: 'After any debate ends, the community can vote on who argued better — FOR side, AGAINST side, or Tie. Results animate in with per-option win percentages.',
    href: '/debate',
    icon: Vote,
    color: 'text-gold',
    tag: 'Ch. 21',
  },
  {
    title: 'Debate Scheduling Hub',
    description: 'RSVPd debates surface on the personal dashboard for the next 7 days. The flexible /api/me/upcoming-rsvps endpoint supports custom window sizes up to 7 days ahead.',
    href: '/dashboard',
    icon: Bell,
    color: 'text-purple',
    tag: 'Ch. 20',
  },
  {
    title: 'Civic Lawmakers Leaderboard',
    description: 'Every winning FOR vote earns civic co-authorship credit. See who helped the most topics become law — with podium, contribution rate bars, and signature laws.',
    href: '/leaderboard/lawmakers',
    icon: Gavel,
    color: 'text-for-400',
    tag: 'Ch. 19',
  },
  {
    title: 'Civic Rivals & Twins',
    description: 'Discover who votes most differently from you (rivals) and most similarly (twins) — your civic mirror and your ideological opposite.',
    href: '/rivals',
    icon: Swords,
    color: 'text-against-400',
    tag: 'Ch. 18',
  },
  {
    title: 'Civic Cohort',
    description: 'Find your civic tribe — the users who share your votes, values, and civic vision across every debate on the platform.',
    href: '/cohort',
    icon: Users,
    color: 'text-purple',
    tag: 'Ch. 18',
  },
  {
    title: 'Perspective Swap',
    description: "Confront the strongest honest case for the opposing side. A civic anti-echo-chamber tool — not to change your mind, but to understand it.",
    href: '/perspective',
    icon: Scale,
    color: 'text-for-400',
    tag: 'Ch. 18',
  },
  {
    title: 'Civic Archetype Quiz',
    description: 'Ten questions reveal your civic personality: Pragmatist, Idealist, Guardian, Reformer, and 4 more. A deep look at how you engage with democracy.',
    href: '/archetype',
    icon: Compass,
    color: 'text-purple',
    tag: 'Ch. 18',
  },
  {
    title: 'Live Intelligence Board',
    description: 'Momentum, Battleground, Race, Hotspot, Radar, and the Civic Now dashboard — every real-time lens on what the Lobby is deciding right now.',
    href: '/now',
    icon: Radio,
    color: 'text-against-400',
    tag: 'Ch. 17',
  },
  {
    title: 'Civic Prediction Markets',
    description: 'Stake conviction points on debate outcomes. Earn Prescient status if your forecasts are accurate. Compete on the Forecasters leaderboard.',
    href: '/predictions',
    icon: Target,
    color: 'text-purple',
    tag: 'Ch. 16',
  },
  {
    title: 'Topic Evidence Board',
    description: 'Submit factual claims with source links for any debate. The community upvotes the most compelling evidence; Claude rates credibility.',
    href: '/evidence',
    icon: FlaskConical,
    color: 'text-emerald',
    tag: 'Ch. 15',
  },
  {
    title: 'Topic Tags & Tag Briefs',
    description: 'Topics now carry keyword tags. Follow tags to curate your feed. Each tag has its own AI brief summarising all debates that carry it.',
    href: '/tags',
    icon: Hash,
    color: 'text-for-400',
    tag: 'Ch. 15',
  },
  {
    title: 'Civic Seasons',
    description: 'Earn XP, climb league tiers, and compete in ranked seasonal standings. Seasons reset every quarter; Wrapped cards immortalise your best.',
    href: '/season',
    icon: Crown,
    color: 'text-gold',
    tag: 'Ch. 14',
  },
  {
    title: 'Civic Skill Tree',
    description: 'A 5-branch RPG-style progression map: Voter, Orator, Scholar, Strategist, and Sage. Unlock nodes by hitting civic milestones.',
    href: '/skill-tree',
    icon: Star,
    color: 'text-gold',
    tag: 'Ch. 14',
  },
]

// ─── Page ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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

// ─── Chapter block ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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
