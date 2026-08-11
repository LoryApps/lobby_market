'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  Coins,
  BookOpen,
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  Compass,
  Crown,
  Eye,
  FileEdit,
  FileText,
  Fingerprint,
  Flame,
  Gavel,
  GitBranch,
  GitCompare,
  GitMerge,
  Globe,
  GraduationCap,
  Grip,
  History,
  Landmark,
  LayoutGrid,
  ListChecks,
  Map,
  Medal,
  MessageSquare,
  Mic,
  Network,
  Newspaper,
  Quote,
  Radio,
  Scale,
  Search,
  Settings,
  Share2,
  Link2,
  Shuffle,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Wand2,
  Zap,
  BookMarked,
  PieChart,
  Crosshair,
  Gamepad2,
  Route,
  Telescope,
  Scroll,
  Lock,
  BarChart,
  Cpu,
  Award,
  ChevronDown,
  CheckCircle2,
  HelpCircle,
  Shield,
  ShieldAlert,
  ScrollText,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  href: string
  label: string
  description: string
  icon: typeof Flame
  badge?: string
  isNew?: boolean
  isAI?: boolean
}

interface FeatureSection {
  id: string
  label: string
  icon: typeof Flame
  color: string
  bgColor: string
  borderColor: string
  description: string
  features: Feature[]
}

// ─── Feature data ─────────────────────────────────────────────────────────────

const SECTIONS: FeatureSection[] = [
  {
    id: 'core',
    label: 'The Basics',
    icon: Flame,
    color: 'text-for-400',
    bgColor: 'bg-for-500/10',
    borderColor: 'border-for-500/30',
    description: 'Start here — the core features every citizen uses daily.',
    features: [
      { href: '/', label: 'Live Feed', description: 'Stream of active civic debates, filterable by category, status, and scope.', icon: Flame },
      { href: '/topic/categories', label: 'Browse by Category', description: 'Explore all 10 civic categories — Politics, Economics, Technology, and more.', icon: LayoutGrid },
      { href: '/discover', label: 'Discover', description: 'Curated civic debates matched to your interests and categories.', icon: Compass },
      { href: '/trending', label: 'Trending', description: 'Topics gaining the most momentum right now.', icon: TrendingUp },
      { href: '/today', label: 'Today in the Lobby', description: 'Daily snapshot of live stats, hottest topics, and new laws.', icon: Clock },
      { href: '/calendar', label: 'Civic Calendar', description: 'Upcoming debates, voting windows, and recently established laws.', icon: Calendar },
      { href: '/law', label: 'The Codex', description: 'Every law established by community consensus — searchable and filterable.', icon: Gavel },
      { href: '/search', label: 'Global Search', description: 'Search topics, laws, users, and arguments across the entire platform.', icon: Search },
    ],
  },
  {
    id: 'ai',
    label: 'AI Tools',
    icon: Brain,
    color: 'text-purple',
    bgColor: 'bg-purple/10',
    borderColor: 'border-purple/30',
    description: 'AI-powered tools to sharpen your civic arguments and thinking.',
    features: [
      { href: '/steelman', label: 'Steelman Engine', description: 'Generate the strongest possible version of both sides of any civic debate.', icon: Brain, isAI: true },
      { href: '/coach', label: 'Argument Coach', description: 'Get AI critique and feedback on your draft argument before publishing.', icon: GraduationCap, isAI: true },
      { href: '/spar', label: 'AI Sparring Partner', description: 'Practice debating against an AI opponent on any civic topic.', icon: Swords, isAI: true },
      { href: '/simulate', label: 'Policy Simulator', description: 'Model real-world policy outcomes and second-order effects.', icon: Cpu, isAI: true },
      { href: '/workshop', label: 'Argument Workshop', description: 'Step-by-step guided argument builder with AI assistance.', icon: Wand2, isAI: true },
      { href: '/advisor', label: 'Civic Advisor', description: 'Personalized AI recommendations for your civic journey.', icon: Sparkles, isAI: true },
      { href: '/checker', label: 'Fact Checker', description: 'AI-assisted fact checking and claim verification tool.', icon: CheckCircle2, isAI: true },
      { href: '/brief', label: 'Topic Brief', description: 'AI-generated background briefing on any civic debate.', icon: FileText, isAI: true },
    ],
  },
  {
    id: 'debates',
    label: 'Debates',
    icon: Mic,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    description: 'Live structured debates — watch, participate, and analyze.',
    features: [
      { href: '/debate', label: 'Debate Stage', description: 'All scheduled and live debates — join as speaker or audience.', icon: Mic },
      { href: '/debate/create', label: 'Schedule a Debate', description: 'Set up a structured debate on any active topic.', icon: Calendar },
      { href: '/debate/series', label: 'Debate Series', description: 'Multi-round best-of-3 and best-of-5 debate competitions.', icon: GitBranch },
      { href: '/debate/calendar', label: 'Debate Calendar', description: 'Upcoming debates you can RSVP to and set reminders for.', icon: Calendar },
      { href: '/debate/my-record', label: 'My Debate Record', description: 'Your personal win/loss record and debate performance stats.', icon: Trophy },
      { href: '/floor', label: 'The Floor', description: 'The live parliamentary chamber — watch consensus forming in real-time.', icon: Landmark },
      { href: '/argument-battle', label: 'Argument Battle', description: 'Watch two arguments clash head-to-head in real time.', icon: Swords },
      { href: '/crossfire', label: 'Crossfire', description: 'The most contested topics with best FOR vs. AGAINST arguments side by side.', icon: Flame },
      { href: '/questions', label: 'Community Q&A Hub', description: 'Browse open clarifying questions from every debate — answer what you know, earn Clout.', icon: HelpCircle, isNew: true },
      { href: '/questions/best', label: 'Best Answers', description: 'The highest-voted Q&A pairs — community questions with accepted answers, curated across every civic debate.', icon: Award, isNew: true },
      { href: '/ama', label: 'Expert AMA Sessions', description: 'Ask Me Anything sessions hosted by civic experts — economists, legal scholars, policy wonks. Live Q&A with verified voices.', icon: Mic, isNew: true },
      { href: '/ama/experts', label: 'AMA Expert Directory', description: 'Browse all civic experts who host AMA sessions — filter by category and track record.', icon: Users, isNew: true },
      { href: '/ama/schedule', label: 'AMA Calendar', description: 'Upcoming expert AMA sessions by date — RSVP and get notified when your category goes live.', icon: Calendar, isNew: true },
      { href: '/ama/request', label: 'Request an AMA', description: 'Nominate a civic expert for an AMA session. Community votes on the most-wanted voices.', icon: Sparkles, isNew: true },
      { href: '/ama/highlights', label: 'AMA Insights Archive', description: 'Best Q&A pairs from completed expert AMAs — the most upvoted answers, curated by category.', icon: BookOpen, isNew: true },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics & Insights',
    icon: BarChart2,
    color: 'text-emerald',
    bgColor: 'bg-emerald/10',
    borderColor: 'border-emerald/30',
    description: 'Deep data on your civic engagement and the platform.',
    features: [
      { href: '/analytics', label: 'Personal Analytics', description: 'Your full civic stats: votes, arguments, accuracy, and growth.', icon: BarChart2 },
      { href: '/compass', label: 'Civic Compass', description: 'Radar chart of your stance across all 10 civic categories.', icon: Compass },
      { href: '/fingerprint', label: 'Civic Fingerprint', description: 'How unique your civic voice is compared to the platform majority.', icon: Fingerprint },
      { href: '/blindspots', label: 'Blind Spots', description: 'Civic categories you\'ve never engaged with — challenge yourself to expand.', icon: Eye },
      { href: '/calibration', label: 'Calibration', description: 'How often you vote on the winning side — your oracle accuracy score.', icon: Crosshair },
      { href: '/persuasion', label: 'Persuasion Profile', description: 'Which debates you argue hardest, your side preferences, and archetype.', icon: Quote },
      { href: '/correlations', label: 'Correlation Atlas', description: 'Hidden ideological connections between topics based on voting patterns.', icon: GitCompare },
      { href: '/platform-stats', label: 'Platform Stats', description: 'Live civic impact metrics — total laws, votes cast, citizens, and more.', icon: Globe },
    ],
  },
  {
    id: 'leaderboards',
    label: 'Leaderboards',
    icon: Trophy,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    description: 'See who\'s leading across dozens of civic metrics.',
    features: [
      { href: '/leaderboard', label: 'Main Leaderboard', description: 'Top citizens by clout, votes, arguments, streaks, and predictions.', icon: Crown },
      { href: '/leaderboard/calibration', label: 'Oracle Rankings', description: 'Who votes most accurately — ranked by winning-side accuracy.', icon: Target },
      { href: '/leaderboard/predictions', label: 'Prediction Masters', description: 'Top civic forecasters ranked by Brier score and accuracy.', icon: Telescope },
      { href: '/leaderboard/grades', label: 'Argument Quality', description: 'Debaters ranked by their average AI argument grade (A–F).', icon: Award },
      { href: '/leaderboard/rising', label: 'Rising Citizens', description: 'Fastest growing members in the last 7 days.', icon: TrendingUp },
      { href: '/leaderboard/debates', label: 'Top Debaters', description: 'Most wins and best performance in live structured debates.', icon: Mic },
      { href: '/leaderboard/arena', label: 'Arena Champions', description: 'Who wins the most head-to-head argument faceoffs? Ranked by win rate.', icon: Swords },
      { href: '/leaderboard/bounties', label: 'Bounty Board', description: 'Who earns the most clout winning bounties — and who funds the chase?', icon: Coins },
      { href: '/leaderboard/engagement', label: 'Engagement Index', description: 'Decathlon-style ranking of most well-rounded citizens across all five civic dimensions.', icon: Activity, isNew: true },
      { href: '/leaderboard/wiki', label: 'Wiki Authors', description: 'Citizens who have contributed most to topic wiki content.', icon: FileEdit },
      { href: '/leaderboard/relay', label: 'Relay Runners', description: 'Citizens who build the best collaborative argument chains — ranked by legs written, completions, and compelling rate.', icon: Link2, isNew: true },
      { href: '/leaderboard/dissent', label: 'The Dissent Index', description: 'The Lobby\'s most principled contrarians — citizens who vote in the minority and argue their case.', icon: Shuffle, isNew: true },
      { href: '/leaderboard/ama', label: 'AMA Expert Rankings', description: 'Top AMA hosts ranked by sessions, questions answered, and community upvotes — the most trusted civic voices.', icon: Mic, isNew: true },
      { href: '/shadow-cabinet', label: 'Shadow Cabinet', description: 'The top civic voice in each policy domain — Economics, Technology, Ethics, and more. Challenge for a seat.', icon: Crown, isNew: true },
      { href: '/podium', label: 'Weekly Podium', description: 'Top 3 contributors per category — resets every Monday.', icon: Medal },
    ],
  },
  {
    id: 'games',
    label: 'Civic Games',
    icon: Gamepad2,
    color: 'text-purple',
    bgColor: 'bg-purple/10',
    borderColor: 'border-purple/30',
    description: 'Daily games and challenges to test your civic knowledge.',
    features: [
      { href: '/trivia', label: 'Civic Trivia', description: 'Guess the community vote split on 5 real platform topics — daily.', icon: BarChart },
      { href: '/connections', label: 'Civic Connections', description: 'Group 16 civic terms into 4 hidden categories — NYT-style daily.', icon: Grip },
      { href: '/civic-recall', label: 'Civic Recall', description: 'Memory test: recognize civic topics from a list of keywords.', icon: Brain },
      { href: '/civic-decoder', label: 'Civic Decoder', description: 'Three arguments, one mystery topic — can you decode it in 5 rounds?', icon: Lock },
      { href: '/civic-mirror', label: 'Civic Mirror', description: 'Vote your gut on 5 topics, then see if you match the community.', icon: Eye },
      { href: '/civic-crossroads', label: 'Civic Crossroads', description: 'Two fundamental values in direct tension — one weekly vote reveals where the Lobby stands.', icon: GitMerge },
      { href: '/wordle', label: 'Civic Wordle', description: '6 guesses to name a civic topic from progressive letter hints.', icon: FileText },
      { href: '/bingo', label: 'Civic Bingo', description: '5×5 weekly bingo card — mark off topics as they become law.', icon: Grip },
      { href: '/bracket', label: 'Civic Bracket', description: 'Vote topics through a tournament — crown the most urgent debate.', icon: GitMerge },
    ],
  },
  {
    id: 'relays',
    label: 'Civic Relays',
    icon: Link2,
    color: 'text-for-300',
    bgColor: 'bg-for-500/10',
    borderColor: 'border-for-400/30',
    description: 'Collaborative argument chains — contribute a leg, build consensus together.',
    features: [
      { href: '/relays', label: 'Relay Browser', description: 'Browse all open relay chains — find ones where your voice can add the next leg.', icon: Link2, isNew: true },
      { href: '/relays/pulse', label: 'Relay Pulse', description: 'Live feed of every relay leg contribution as it lands — watch collaborative arguments build in real time.', icon: Activity, isNew: true },
      { href: '/relays/create', label: 'Start a Relay', description: 'Kick off a new collaborative argument chain on any active civic topic.', icon: GitBranch, isNew: true },
      { href: '/relays/weekly', label: 'Relay of the Week', description: "This week's champion relay chain — the community's most compelling collaborative argument, updated every week.", icon: Crown, isNew: true },
      { href: '/relays/league', label: 'Relay League', description: 'Competitive relay standings — teams of debaters building the strongest argument chains.', icon: Trophy, isNew: true },
      { href: '/relays/showdown', label: 'Relay Showdown', description: 'Head-to-head relay battles where FOR and AGAINST chains go head-to-head for community votes.', icon: Swords, isNew: true },
      { href: '/relays/stats', label: 'Relay Stats', description: 'Platform-wide relay analytics — completions, leg counts, and top contributors.', icon: BarChart2, isNew: true },
      { href: '/relays/mine', label: 'My Relays', description: 'Every relay you\'ve started or contributed a leg to — your full relay history.', icon: Route, isNew: true },
      { href: '/relays/champions', label: 'Relay Champions', description: 'The most complete and highest-voted relay chains — the best collaborative arguments on the platform.', icon: Crown },
      { href: '/leaderboard/relay', label: 'Relay Runners', description: 'Citizens ranked by relay contributions — legs written, chains completed, compelling rate.', icon: Medal },
    ],
  },
  {
    id: 'community',
    label: 'Community',
    icon: Users,
    color: 'text-for-400',
    bgColor: 'bg-for-500/10',
    borderColor: 'border-for-500/30',
    description: 'Connect, collaborate, and build civic coalitions.',
    features: [
      { href: '/coalitions', label: 'Coalitions', description: 'Organized groups of citizens sharing a civic stance.', icon: Users },
      { href: '/mentor', label: 'Mentor Exchange', description: 'Find experienced citizens who can guide your civic journey.', icon: GraduationCap, isNew: true },
      { href: '/ambassador', label: 'Ambassador Program', description: 'Refer new citizens and earn clout for growing the Lobby.', icon: Share2 },
      { href: '/citizens', label: 'Citizens Directory', description: 'Browse all Lobby citizens, filterable by role and category.', icon: Globe },
      { href: '/network', label: 'Your Network', description: 'See followers, who you follow, and mutual connections.', icon: Network },
      { href: '/messages', label: 'Messages', description: 'Direct messages with fellow citizens and coalition coordination.', icon: MessageSquare },
      { href: '/challenges', label: 'Debate Challenges', description: 'Challenge any citizen to a structured formal debate.', icon: Swords },
      { href: '/compare-users', label: 'Compare Profiles', description: 'Side-by-side comparison of any two citizens\' civic records.', icon: GitCompare },
      { href: '/oath', label: 'Civic Oath', description: 'Take the Lobby\'s founding oath — a public pledge to civic good faith, honest debate, and pursuit of truth.', icon: Scroll, isNew: true },
    ],
  },
  {
    id: 'laws',
    label: 'Laws & Governance',
    icon: Gavel,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    description: 'The full lifecycle of civic laws from proposal to implementation.',
    features: [
      { href: '/law', label: 'Law Codex', description: 'Browse every established law, searchable by category and date.', icon: BookOpen },
      { href: '/law/atlas', label: 'Law Atlas', description: 'Geographic heat map of laws by category and impact.', icon: Map },
      { href: '/law/categories', label: 'Laws by Category', description: 'Filter established laws by civic category.', icon: LayoutGrid },
      { href: '/law/graph', label: 'Law Network', description: 'Visual graph of how laws connect to parent topics and chains.', icon: Network },
      { href: '/amendments', label: 'Amendment Chamber', description: 'Propose and vote on amendments to existing laws.', icon: FileEdit },
      { href: '/oversight', label: 'Civic Oversight', description: 'Health dashboard for all established laws — shows which laws are under scrutiny via amendments, petitions, and community reviews.', icon: ShieldAlert, isNew: true },
      { href: '/pledges', label: 'Civic Pledge Wall', description: 'Public commitments to civic action, witnessed by the community.', icon: Scroll },
      { href: '/elections', label: 'Civic Elections', description: 'Vote on proposed constitutional changes and major resolutions.', icon: Vote },
      { href: '/referendums', label: 'Civic Referendums', description: 'Community-wide votes on fundamental civic questions.', icon: Scale },
      { href: '/civic-commons', label: 'The Civic Commons', description: 'All active governance in one place: council, assemblies, referendums, tribunal, elections.', icon: LayoutGrid },
      { href: '/council', label: 'The Grand Council', description: 'Top-20 citizens propose and vote on civic motions and resolutions.', icon: Crown },
      { href: '/proclamations', label: 'Proclamations Board', description: 'Permanent record of all Grand Council motions and official decrees.', icon: Scroll },
      { href: '/assembly', label: 'Citizens\' Assembly', description: 'Sortition-based deliberative bodies tackling contested civic topics.', icon: Users },
      { href: '/tribunal', label: 'The Civic Tribunal', description: 'Community peer-review of arguments: challenge, deliberate, verdict.', icon: Gavel },
      { href: '/civic-nominations', label: 'Civic Nominations', description: 'Nominate and endorse citizens for formal civic roles — Council, Tribunal, Fact Checker, and more.', icon: Award, isNew: true },
      { href: '/civic-petitions', label: 'Civic Petitions', description: 'File and sign citizen petitions that force formal hearings, referendums, or assembly sessions.', icon: Scroll },
      { href: '/hearings', label: 'Civic Hearings', description: 'Committee testimonies before major votes — experts and citizens present evidence before the community decides.', icon: Mic, isNew: true },
      { href: '/ombudsman', label: 'Civic Ombudsman', description: 'Independent oversight body for civic complaints — file a case about process fairness, bias, or norm breaches.', icon: Shield, isNew: true },
      { href: '/appeals', label: 'Civic Appeals Panel', description: 'The final civic recourse tier — formally contest Ombudsman findings, Council outcomes, and disputed results.', icon: Scale, isNew: true },
      { href: '/vetoes', label: 'Civic Vetoes', description: 'Citizen-led veto mechanism — gather signatures to block or delay a newly established law.', icon: Vote, isNew: true },
      { href: '/fact-bank', label: 'Civic Fact Bank', description: 'Community-verified factual claims supporting active debates — crowd-sourced evidence and source verification.', icon: FileText, isNew: true },
      { href: '/order-paper', label: 'Order Paper', description: 'The official parliamentary Order Paper — all bills, recent laws, debates, committee reports, and council motions in one formal document.', icon: ScrollText, isNew: true },
    ],
  },
  {
    id: 'personal',
    label: 'Your Civic Journey',
    icon: Route,
    color: 'text-emerald',
    bgColor: 'bg-emerald/10',
    borderColor: 'border-emerald/30',
    description: 'Track your growth, missions, and civic history.',
    features: [
      { href: '/dashboard', label: 'Command Centre', description: 'Your personal civic dashboard with league standing, watchlist, and quick actions.', icon: LayoutGrid },
      { href: '/missions', label: 'Daily Missions', description: 'Three daily civic challenges to earn clout and protect your streak.', icon: ListChecks },
      { href: '/achievements', label: 'Achievements', description: 'Unlock civic achievements across votes, arguments, debates, and more.', icon: Award },
      { href: '/queue', label: 'Action Queue', description: 'Personalised list of what to do right now on the Lobby.', icon: ListChecks },
      { href: '/my-week', label: 'My Week', description: 'Your personal 7-day civic summary — votes, arguments, and XP gained.', icon: Calendar },
      { href: '/bookmarks', label: 'Bookmarks', description: 'Topics and arguments you\'ve saved to read later.', icon: BookMarked },
      { href: '/predictions', label: 'Your Predictions', description: 'Track your forecast accuracy on active and resolved topics.', icon: Target },
      { href: '/settings', label: 'Settings', description: 'Notification preferences, push settings, and account options.', icon: Settings },
      { href: '/badge', label: 'Civic Badge', description: 'Generate a shareable stats badge for GitHub READMEs, forums, and social bios.', icon: Share2, isNew: true },
    ],
  },
  {
    id: 'data',
    label: 'Live Data Views',
    icon: Activity,
    color: 'text-against-400',
    bgColor: 'bg-against-500/10',
    borderColor: 'border-against-500/30',
    description: 'Real-time dashboards and data visualizations of the Lobby.',
    features: [
      { href: '/clips', label: 'Civic Clips', description: 'Swipe through the sharpest arguments on the platform — top-voted, AI-scored takes one card at a time.', icon: Sparkles, isNew: true },
      { href: '/broadcast', label: 'Civic Broadcast', description: "Live split-screen view of the Lobby's hottest topic — FOR vs AGAINST arguments, a live vote bar, and real-time platform stats.", icon: Radio, isNew: true },
      { href: '/terminal', label: 'Consensus Terminal', description: 'Bloomberg-style live view of all active debates as market data.', icon: Activity },
      { href: '/live', label: 'Live Stream', description: 'Real-time stream of arguments being posted across the Lobby.', icon: Radio },
      { href: '/vote-stream', label: 'Vote Stream', description: 'Watch every vote land in real-time, second by second.', icon: Zap },
      { href: '/map', label: 'Civic Policy Map', description: 'Scatter plot of every debate by consensus strength vs. engagement.', icon: Map },
      { href: '/topic/graph', label: 'Topic Network', description: 'Interactive graph of all debate topics and how they connect.', icon: Network },
      { href: '/heatmap', label: 'Category Heatmap', description: 'Vote intensity and consensus across all 10 civic categories.', icon: PieChart },
      { href: '/momentum', label: 'Momentum Tracker', description: 'Topics with the fastest vote velocity right now.', icon: TrendingUp },
      { href: '/temperature', label: 'Civic Temperature', description: 'Heat score combining controversy, vote velocity, and engagement depth.', icon: Flame, isNew: true },
      { href: '/tipping-point', label: 'Tipping Points', description: 'Topics at critical transition moments — approaching law or failure.', icon: Flame },
      { href: '/exchange', label: 'Civic Exchange', description: 'Prediction market view of every debate — price, volume, momentum, and settlement.', icon: BarChart, isNew: true },
      { href: '/exchange/heatmap', label: 'Market Heat Map', description: 'Finviz-style treemap of all civic markets — sized by volume, colored by consensus direction.', icon: Map, isNew: true },
    ],
  },
  {
    id: 'history',
    label: 'Archives & History',
    icon: History,
    color: 'text-surface-600',
    bgColor: 'bg-surface-300/30',
    borderColor: 'border-surface-400/40',
    description: 'The civic record — past decisions, milestones, and retrospectives.',
    features: [
      { href: '/gazette', label: 'Civic Gazette', description: 'Daily editorial covering the most significant civic events.', icon: Newspaper },
      { href: '/weekly', label: 'Weekly Digest', description: 'Platform-wide 7-day community recap — laws, debates, top arguments.', icon: Calendar },
      { href: '/catchup', label: 'Catch Up', description: '"What happened while you were away" — personalized missed-activity recap.', icon: Clock },
      { href: '/moments', label: 'Civic Moments', description: 'TikTok-style feed of significant civic milestones and records.', icon: Sparkles },
      { href: '/wrapped', label: 'Civic Wrapped', description: 'Your annual civic year-in-review — Spotify-style engagement breakdown.', icon: Trophy },
      { href: '/legacy', label: 'Civic Legacy', description: 'The long-term historical record of laws and their impact over time.', icon: Scroll },
      { href: '/transcripts', label: 'Debate Archive', description: 'Every resolved debate with its top FOR and AGAINST arguments — the full civic record.', icon: BookOpen },
      { href: '/records', label: 'Platform Records', description: 'All-time records: most votes, longest streaks, most accurate.', icon: Crown },
      { href: '/changelog', label: 'Platform Changelog', description: 'Every feature and update added to Lobby Market.', icon: GitBranch },
    ],
  },
  {
    id: 'parliament',
    label: 'Parliament',
    icon: Landmark,
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    description: 'The full Westminster parliamentary system — bills, debates, questions, and division votes.',
    features: [
      { href: '/parliament', label: 'Parliament Overview', description: 'The central Westminster hub — bills in progress, recent divisions, question sessions, and live chamber activity.', icon: Landmark },
      { href: '/bills', label: 'Civic Bills', description: 'Draft and debate civic legislation through committee, amendment, and reading stages before a final vote.', icon: ScrollText, isNew: true },
      { href: '/divisions', label: 'Division Bell', description: 'Live parliamentary division votes — ring the bell, record your Aye or No, and watch the lobbies fill.', icon: Vote, isNew: true },
      { href: '/whips', label: "Whip's Office", description: 'Party discipline, guidance notes, and whipped votes — see how civic parties coordinate bloc voting.', icon: Users, isNew: true },
      { href: '/committees', label: 'Select Committees', description: 'Parliamentary committees scrutinising bills, calling witnesses, and publishing reports on key civic issues.', icon: Crown, isNew: true },
      { href: '/westminster-hall', label: 'Westminster Hall', description: 'Backbench debates in the parallel chamber — any citizen can raise a topic for 30 minutes of floor time.', icon: Mic, isNew: true },
      { href: '/pmqs', label: "Prime Minister's Questions", description: 'Weekly PMQs session — opposition leaders question the PM on policy, and citizens vote on the best lines.', icon: MessageSquare, isNew: true },
      { href: '/oral-questions', label: 'Oral Questions', description: 'Departmental oral questions — ministers face citizens in the chamber on their portfolio.', icon: Mic, isNew: true },
      { href: '/written-questions', label: 'Written Questions', description: 'Formal written questions submitted to ministers — tracked for response and rated for substance.', icon: FileText, isNew: true },
      { href: '/urgent-questions', label: 'Urgent Questions', description: 'Emergency procedural questions granted by the Speaker on breaking civic events.', icon: Zap, isNew: true },
      { href: '/emergency-debates', label: 'Emergency Debates', description: 'Standing Order 24 emergency debates on urgent matters — granted by the Speaker, time-limited.', icon: Shield, isNew: true },
      { href: '/adjournment', label: 'Adjournment Debates', description: 'End-of-day debates where individual citizens raise issues and receive a ministerial reply.', icon: Clock, isNew: true },
      { href: '/ten-minute-rule', label: 'Ten Minute Rule', description: "Citizens introduce new bills with a ten-minute speech — the first step on the private member's bill ladder.", icon: Clock, isNew: true },
      { href: '/ministerial-statements', label: 'Ministerial Statements', description: 'Formal government statements to the chamber — ministers announce policy, then face community scrutiny.', icon: Mic, isNew: true },
      { href: '/statutory-instruments', label: 'Statutory Instruments', description: 'Secondary legislation — ministers pass civic rules under delegated powers, subject to community challenge.', icon: Scroll, isNew: true },
      { href: '/edm', label: 'Early Day Motions', description: 'Informal motions tabled by civic members — a barometer of community concern on any topic.', icon: FileText, isNew: true },
      { href: '/lords', label: 'House of Lords', description: 'The upper chamber — appointed civic peers scrutinise and revise legislation, with the power to delay.', icon: Crown, isNew: true },
      { href: '/kings-speech', label: "King's Speech", description: "The government's formal legislative programme — all bills for the civic year announced from the throne.", icon: Scroll, isNew: true },
      { href: '/supply-day', label: 'Supply Day', description: 'Opposition supply days — the civic opposition picks the debate topic and challenges government spending.', icon: Scale, isNew: true },
      { href: '/hansard', label: 'Hansard', description: 'The official verbatim record of all parliamentary proceedings — every word spoken in the Lobby chamber.', icon: BookOpen, isNew: true },
      { href: '/confidence-vote', label: 'Confidence Votes', description: 'Table a formal vote of no confidence in any civic body — 10 seconds opens a 48-hour division that can bring down a coalition.', icon: Scale, isNew: true },
    ],
  },
]

// ─── Search ───────────────────────────────────────────────────────────────────

function useFeatureSearch(query: string) {
  return useMemo(() => {
    if (!query.trim()) return null
    const q = query.toLowerCase()
    const results: (Feature & { sectionLabel: string; sectionColor: string })[] = []
    for (const section of SECTIONS) {
      for (const feature of section.features) {
        if (
          feature.label.toLowerCase().includes(q) ||
          feature.description.toLowerCase().includes(q) ||
          section.label.toLowerCase().includes(q)
        ) {
          results.push({ ...feature, sectionLabel: section.label, sectionColor: section.color })
        }
      }
    }
    return results
  }, [query])
}

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  feature,
  sectionColor,
  index,
}: {
  feature: Feature
  sectionColor: string
  index: number
}) {
  const Icon = feature.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
    >
      <Link
        href={feature.href}
        className={cn(
          'group flex items-start gap-3 p-3.5 rounded-xl transition-all duration-150',
          'bg-surface-200/40 hover:bg-surface-200/80',
          'border border-surface-300/50 hover:border-surface-400/70',
        )}
      >
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
          'bg-surface-300/60 group-hover:bg-surface-300 transition-colors',
        )}>
          <Icon className={cn('h-4 w-4', sectionColor)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors leading-tight">
              {feature.label}
            </span>
            {feature.isNew && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald/20 text-emerald border border-emerald/30 leading-none">
                NEW
              </span>
            )}
            {feature.isAI && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple/20 text-purple border border-purple/30 leading-none">
                AI
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-surface-500 leading-snug line-clamp-2">
            {feature.description}
          </p>
        </div>
        <ChevronRight className="flex-shrink-0 h-3.5 w-3.5 text-surface-600 group-hover:text-surface-500 mt-0.5 transition-colors" aria-hidden />
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function ExploreSection({ section }: { section: FeatureSection }) {
  const [expanded, setExpanded] = useState(true)
  const Icon = section.icon

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 mb-3 group"
        aria-expanded={expanded}
      >
        <div className={cn(
          'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
          section.bgColor,
          'border',
          section.borderColor,
        )}>
          <Icon className={cn('h-4.5 w-4.5', section.color)} aria-hidden />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">{section.label}</h2>
            <span className="text-xs text-surface-500 font-mono">
              {section.features.length} features
            </span>
          </div>
          <p className="text-xs text-surface-500 leading-snug line-clamp-1">{section.description}</p>
        </div>
        <ChevronDown
          className={cn(
            'flex-shrink-0 h-4 w-4 text-surface-500 transition-transform duration-200',
            !expanded && '-rotate-90',
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {section.features.map((feature, i) => (
                <FeatureCard
                  key={feature.href}
                  feature={feature}
                  sectionColor={section.color}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ExploreClient() {
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const searchResults = useFeatureSearch(query)

  const totalFeatures = SECTIONS.reduce((sum, s) => sum + s.features.length, 0)
  const visibleSections = activeSection
    ? SECTIONS.filter((s) => s.id === activeSection)
    : SECTIONS

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30">
              <Telescope className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Explore the Lobby</h1>
              <p className="text-xs text-surface-500 font-mono">{totalFeatures} features across {SECTIONS.length} categories</p>
            </div>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            Everything Lobby Market offers — from AI debate tools and civic games to live analytics and community features. Discover what you&apos;ve been missing.
          </p>
        </div>

        {/* ── Search bar ── */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" aria-hidden />
          <input
            type="search"
            placeholder="Search features…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              'w-full pl-9 pr-9 py-2.5 rounded-xl text-sm font-mono text-white',
              'bg-surface-200 border border-surface-300/60',
              'placeholder-surface-500',
              'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50',
              'transition-colors',
            )}
            aria-label="Search features"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Section filter chips (hidden during search) ── */}
        {!query && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all',
                'border',
                activeSection === null
                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                  : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:text-surface-700',
              )}
            >
              All
            </button>
            {SECTIONS.map((s) => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all',
                    'border',
                    activeSection === s.id
                      ? cn(s.bgColor, s.borderColor, s.color)
                      : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:text-surface-700',
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {s.label}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Search results ── */}
        {searchResults !== null ? (
          <div>
            <p className="text-xs text-surface-500 font-mono mb-3">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
            </p>
            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-8 w-8 text-surface-500 mx-auto mb-3" aria-hidden />
                <p className="text-sm text-surface-500">No features match &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-surface-600 mt-1">Try a different keyword</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchResults.map((feature, i) => (
                  <div key={feature.href} className="relative">
                    <FeatureCard
                      feature={feature}
                      sectionColor={feature.sectionColor}
                      index={i}
                    />
                    <span className="absolute top-2 right-8 text-[9px] text-surface-600 font-mono">
                      {feature.sectionLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Sections ── */
          <div className="space-y-2">
            {visibleSections.map((section) => (
              <ExploreSection key={section.id} section={section} />
            ))}
          </div>
        )}

        {/* ── Footer hint ── */}
        {!query && !activeSection && (
          <div className="mt-8 p-4 rounded-xl bg-surface-200/40 border border-surface-300/40 text-center">
            <Sparkles className="h-5 w-5 text-gold mx-auto mb-2" aria-hidden />
            <p className="text-xs text-surface-500 leading-relaxed">
              Press <kbd className="px-1.5 py-0.5 rounded bg-surface-300 text-surface-600 font-mono text-[10px]">⌘K</kbd> anywhere to open the Command Palette for instant navigation to any feature.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
