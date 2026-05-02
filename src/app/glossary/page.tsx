'use client'

/**
 * /glossary — The Civic Glossary
 *
 * A searchable reference dictionary for all civic, political, and
 * platform-specific terms used on Lobby Market. Bridges the Wikipedia
 * pillar of the platform — giving new citizens a foundation in both
 * democratic vocabulary and how the Lobby works.
 *
 * Terms are grouped by category and searchable by keyword.
 * Each entry optionally links to a related Lobby Market page.
 */

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Link2,
  Search,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlossaryTerm {
  term: string
  category: CategoryKey
  definition: string
  platform?: string        // how it maps to Lobby Market specifically
  related?: string[]       // slugs of related terms
  link?: string            // internal page link
  linkLabel?: string
}

type CategoryKey =
  | 'platform'
  | 'voting'
  | 'law'
  | 'debate'
  | 'governance'
  | 'economics'
  | 'rights'
  | 'roles'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: Record<CategoryKey, { label: string; color: string; bg: string; border: string; dot: string }> = {
  platform:   { label: 'Platform',   color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      dot: 'bg-for-500' },
  voting:     { label: 'Voting',     color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      dot: 'bg-emerald' },
  law:        { label: 'Law',        color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         dot: 'bg-gold' },
  debate:     { label: 'Debate',     color: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  dot: 'bg-against-500' },
  governance: { label: 'Governance', color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       dot: 'bg-purple' },
  economics:  { label: 'Economics',  color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         dot: 'bg-gold/70' },
  rights:     { label: 'Rights',     color: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/30',      dot: 'bg-for-400' },
  roles:      { label: 'Roles',      color: 'text-surface-300',  bg: 'bg-surface-200/60',  border: 'border-surface-300/50',  dot: 'bg-surface-400' },
}

const CATEGORY_FILTERS: { id: CategoryKey | 'all'; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'platform',   label: 'Platform' },
  { id: 'voting',     label: 'Voting' },
  { id: 'law',        label: 'Law' },
  { id: 'debate',     label: 'Debate' },
  { id: 'governance', label: 'Governance' },
  { id: 'economics',  label: 'Economics' },
  { id: 'rights',     label: 'Rights' },
  { id: 'roles',      label: 'Roles' },
]

// ─── Glossary data ────────────────────────────────────────────────────────────

const TERMS: GlossaryTerm[] = [
  // ── Platform ──────────────────────────────────────────────────────────────
  {
    term: 'Lobby Market',
    category: 'platform',
    definition: 'A civic simulation platform where citizens propose, debate, and vote on binary policy topics. Proposals that reach community consensus thresholds become permanent Laws stored in the Codex.',
    platform: 'The platform itself — combining elements of Polymarket (prediction markets), Wikipedia (collaborative knowledge), TikTok (viral content), and Obsidian (linked notes).',
    related: ['topic', 'law', 'codex', 'clout'],
    link: '/about',
    linkLabel: 'Learn more',
  },
  {
    term: 'Topic',
    category: 'platform',
    definition: 'A binary policy statement submitted for community debate and voting. Topics are the fundamental unit of discourse on the platform. They must be answerable with a clear FOR or AGAINST stance.',
    platform: 'Each topic moves through stages: Proposed → Active → Voting → Law or Failed. Topics with ≥ 67% FOR consensus during the voting phase become Laws.',
    related: ['voting-phase', 'proposal', 'law'],
    link: '/topic/create',
    linkLabel: 'Propose a topic',
  },
  {
    term: 'The Codex',
    category: 'platform',
    definition: 'The permanent, searchable archive of all Laws established by community consensus. Functions as the platform\'s constitution — a living record of every proposal that achieved democratic legitimacy.',
    platform: 'Stored immutably once a topic reaches law status. Laws can be amended (not repealed) by subsequent community consensus.',
    related: ['law', 'amendment', 'constitution'],
    link: '/law',
    linkLabel: 'Browse the Codex',
  },
  {
    term: 'Clout',
    category: 'platform',
    definition: 'The platform\'s native reputation currency, earned through civic engagement: voting on active topics, writing upvoted arguments, debating, completing daily challenges, and unlocking achievements.',
    platform: 'Clout reflects civic participation, not wealth. It cannot be purchased — only earned. High Clout users are eligible for role promotions like Debator or Elder.',
    related: ['reputation', 'role', 'achievement'],
    link: '/clout',
    linkLabel: 'Your Clout wallet',
  },
  {
    term: 'The Feed',
    category: 'platform',
    definition: 'The main scrollable view of active, proposed, and voting topics. The feed is algorithmically ranked by a combination of recent activity, vote velocity, time-sensitivity, and personal category preferences.',
    platform: 'Personalized using your onboarding quiz answers and historical engagement patterns. You can filter by category, status, and sort order.',
    related: ['topic', 'vote-streak', 'category'],
    link: '/',
    linkLabel: 'View the Feed',
  },
  {
    term: 'Floor',
    category: 'platform',
    definition: 'A special chamber within the platform designed for structured, high-stakes debate. Topics in the Floor receive more visibility and have stricter participation rules.',
    platform: 'The Floor Chamber features real-time particle effects and is accessed through the bottom navigation.',
    link: '/floor',
    linkLabel: 'Enter the Floor',
  },
  {
    term: 'Lobby',
    category: 'platform',
    definition: 'The virtual civic space where citizens gather to discuss, vote, and campaign. Each Lobby is a themed community hub with member coalitions, bulletin boards, and topic campaigns.',
    platform: 'Lobbies are sub-communities organized around shared civic interests. You can join multiple Lobbies and participate in their coalition campaigns.',
    related: ['coalition', 'civic-chamber'],
    link: '/lobby',
    linkLabel: 'Browse Lobbies',
  },

  // ── Voting ────────────────────────────────────────────────────────────────
  {
    term: 'Binary Vote',
    category: 'voting',
    definition: 'A vote with exactly two options: FOR (agree/support) or AGAINST (disagree/oppose). Binary voting forces intellectual clarity — you cannot abstain or qualify your position.',
    platform: 'The FOR side is displayed in blue; AGAINST in red. This color coding is consistent across all platform views.',
    related: ['consensus', 'super-majority'],
  },
  {
    term: 'Consensus',
    category: 'voting',
    definition: 'The threshold of agreement required for a topic to progress or become law. Standard consensus is a simple majority (51%); super-majority consensus is 67%.',
    platform: 'Topics require 67% FOR consensus during the Voting phase to become Law. The Voting phase itself is triggered once a topic achieves 51% FOR support.',
    related: ['super-majority', 'voting-phase', 'law'],
    link: '/consensus',
    linkLabel: 'Consensus tracker',
  },
  {
    term: 'Vote Streak',
    category: 'voting',
    definition: 'The number of consecutive days on which a user has cast at least one vote. Maintaining a streak requires voting every calendar day.',
    platform: 'Vote streaks appear on your profile and contribute to your Reputation Score. Streaks earn bonus Clout at milestone intervals (7, 14, 30, 100 days).',
    related: ['clout', 'reputation', 'daily-challenge'],
    link: '/streaks',
    linkLabel: 'View streaks',
  },
  {
    term: 'Daily Quorum',
    category: 'voting',
    definition: 'The platform\'s daily civic obligation — a curated set of 5 high-priority topics selected for their time-sensitivity or platform significance.',
    platform: 'Completing the Daily Quorum earns bonus Clout. The quorum resets every UTC midnight.',
    related: ['clout', 'vote-streak', 'daily-challenge'],
    link: '/challenge',
    linkLabel: 'Today\'s Quorum',
  },
  {
    term: 'Vote Phase',
    category: 'voting',
    definition: 'The final stage of a topic\'s lifecycle, triggered when a topic accumulates sufficient support. During this phase, the FOR percentage is locked in a time-limited window for final ratification.',
    platform: 'Once triggered, the voting phase has a fixed duration. If ≥ 67% vote FOR when the phase closes, the topic becomes Law.',
    related: ['consensus', 'topic', 'law'],
    link: '/senate',
    linkLabel: 'View voting topics',
  },
  {
    term: 'Prediction',
    category: 'voting',
    definition: 'A Clout-staked wager on whether a topic will pass or fail. Correct predictions earn Clout; incorrect ones lose it.',
    platform: 'Predictions are distinct from your actual vote — you can vote FOR while predicting the topic will fail, for example. Prediction accuracy is tracked separately from voting accuracy.',
    related: ['clout', 'forecast', 'accuracy'],
    link: '/predictions',
    linkLabel: 'Make predictions',
  },

  // ── Law ───────────────────────────────────────────────────────────────────
  {
    term: 'Law',
    category: 'law',
    definition: 'A topic that has achieved super-majority consensus (≥ 67% FOR) during its voting phase. Laws are permanently stored in the Codex and represent the platform\'s collective civic will.',
    platform: 'Laws cannot be deleted. They can be amended through the Amendment process or reopened for reconsideration via a community petition.',
    related: ['codex', 'amendment', 'petition'],
    link: '/law',
    linkLabel: 'Browse laws',
  },
  {
    term: 'Amendment',
    category: 'law',
    definition: 'A proposal to modify or extend an existing Law without repealing it. Amendments go through their own mini-voting process and, if passed, become part of the Law\'s permanent record.',
    platform: 'An amendment reaching 60% support with ≥ 20 votes is ratified. Amendments must refine or extend — they cannot fundamentally contradict the original law.',
    related: ['law', 'codex', 'petition'],
    link: '/amendments',
    linkLabel: 'Browse amendments',
  },
  {
    term: 'Petition',
    category: 'law',
    definition: 'A formal request by citizens to reopen a failed topic or reconsider an established law. Petitions require a minimum number of signatures within a time window.',
    platform: 'A successful petition reopens the topic for another round of voting. This mechanism prevents the permanent silencing of minority positions.',
    related: ['law', 'failed-topic', 'amendment'],
    link: '/petitions',
    linkLabel: 'View petitions',
  },
  {
    term: 'Failed Topic',
    category: 'law',
    definition: 'A topic that did not achieve the required consensus during its voting phase. Failed topics are archived in the Graveyard and can be revived via petition.',
    platform: 'Topics that never reach activation threshold (insufficient votes/activity) are also archived. The Graveyard shows the "cause of death" for each failed topic.',
    related: ['law', 'petition', 'graveyard'],
    link: '/graveyard',
    linkLabel: 'The Graveyard',
  },
  {
    term: 'The Graveyard',
    category: 'law',
    definition: 'The archive of all topics that failed to become law — either voted down, decisively rejected, or abandoned due to lack of engagement.',
    platform: 'Each entry shows the topic\'s cause of death, final vote percentage, and the arguments that defined its debate. Failed topics can be resurrected through the petition system.',
    related: ['failed-topic', 'petition'],
    link: '/graveyard',
    linkLabel: 'Browse the Graveyard',
  },

  // ── Debate ────────────────────────────────────────────────────────────────
  {
    term: 'Argument',
    category: 'debate',
    definition: 'A text-based case made by a citizen for or against a topic. Arguments are the platform\'s primary unit of reasoned discourse. They can be upvoted, replied to, cited, and bookmarked.',
    platform: 'Arguments are labeled FOR (blue) or AGAINST (red). The most-upvoted arguments appear in the topic\'s "Top Arguments" section and can influence other voters.',
    related: ['upvote', 'citation', 'argument-reply'],
    link: '/arguments/mine',
    linkLabel: 'Your arguments',
  },
  {
    term: 'Upvote',
    category: 'debate',
    definition: 'A signal of agreement or quality given to an argument. Upvotes increase an argument\'s visibility and contribute to the author\'s Reputation Score.',
    platform: 'There are no downvotes on Lobby Market — only upvotes. This prevents mob suppression of minority viewpoints. Poor arguments simply receive fewer upvotes.',
    related: ['argument', 'reputation', 'clout'],
  },
  {
    term: 'Citation',
    category: 'debate',
    definition: 'A URL attached to an argument as supporting evidence. Citations are displayed with domain icons and aggregated in the topic\'s Citations Panel.',
    platform: 'High citation count contributes to an argument\'s credibility score. The Citations Panel shows the evidence landscape — which sources the FOR and AGAINST sides are drawing from.',
    related: ['argument', 'source'],
    link: '/sources',
    linkLabel: 'Browse sources',
  },
  {
    term: 'Debate',
    category: 'debate',
    definition: 'A structured, time-limited oral or text confrontation between two opposing advocates on a specific topic. Unlike arguments (asynchronous), debates happen in real-time with a moderator.',
    platform: 'Debates are scheduled events with designated debators, audience voting, and a live transcript. They can be quick (15min), grand (45min), or tribunal format.',
    related: ['debator', 'debate-schedule', 'tribunal'],
    link: '/debate',
    linkLabel: 'View debates',
  },
  {
    term: 'Hot Take',
    category: 'debate',
    definition: 'A brief, high-conviction argument that makes a bold claim against conventional wisdom. Hot takes are rated by how provocative they are relative to their upvote traction.',
    platform: 'The /hot-takes feed surfaces arguments with the most contrarian framing — useful for identifying the strongest minority positions on any topic.',
    related: ['argument', 'upvote'],
    link: '/hot-takes',
    linkLabel: 'Browse hot takes',
  },

  // ── Governance ────────────────────────────────────────────────────────────
  {
    term: 'Super-Majority',
    category: 'governance',
    definition: 'A threshold higher than a simple majority, typically 67% or two-thirds, required for significant decisions. Super-majority requirements prevent simple majorities from imposing their will on large minorities.',
    platform: 'On Lobby Market, a 67% FOR consensus is required for a topic to become Law. This ensures Laws represent genuine broad agreement, not slim majorities.',
    related: ['consensus', 'voting-phase', 'law'],
  },
  {
    term: 'Quorum',
    category: 'governance',
    definition: 'The minimum number of participants required for a vote or decision to be valid. Without quorum, decisions can be made by an unrepresentative minority.',
    platform: 'Topics require a minimum vote threshold before they can enter the Voting phase. This prevents small groups from passing laws without community awareness.',
    related: ['voting-phase', 'consensus', 'topic'],
  },
  {
    term: 'Filibuster',
    category: 'governance',
    definition: 'A procedural tactic used to delay or block a vote by prolonging debate. Historically used in legislatures to prevent legislation from coming to a vote.',
    platform: 'The platform\'s architecture prevents effective filibustering: topics move to voting based on engagement metrics, not procedural control by individuals.',
    related: ['debate', 'voting-phase'],
  },
  {
    term: 'Veto',
    category: 'governance',
    definition: 'The power to unilaterally block or reject a decision, even if it has majority support. Traditionally held by executives, heads of state, or privileged actors.',
    platform: 'There is no individual veto power on Lobby Market. All decisions are made through collective consensus, making the platform inherently democratic.',
    related: ['consensus', 'governance'],
  },
  {
    term: 'Checks and Balances',
    category: 'governance',
    definition: 'Constitutional mechanisms that distribute power among different branches of government to prevent any single entity from accumulating too much authority.',
    platform: 'The platform replicates this through: moderation (judicial), topic creation (legislative), and voting (executive ratification).',
    related: ['moderation', 'constitution'],
    link: '/constitution',
    linkLabel: 'The Constitution',
  },
  {
    term: 'Due Process',
    category: 'governance',
    definition: 'The principle that legal matters must follow fair procedures, giving individuals notice and opportunity to be heard before decisions affecting them are made.',
    platform: 'Reflected in the platform\'s moderation system: users can appeal moderation decisions, and content removal requires documented reasoning.',
    related: ['moderation', 'rights'],
  },

  // ── Economics ─────────────────────────────────────────────────────────────
  {
    term: 'Fiscal Policy',
    category: 'economics',
    definition: 'Government decisions about taxation and public spending used to influence a nation\'s economic activity, employment levels, and growth.',
    platform: 'One of the most debated topic categories on the platform. Economic topics often see the highest vote volumes and most contentious argument threads.',
    related: ['monetary-policy', 'taxation', 'welfare'],
  },
  {
    term: 'Monetary Policy',
    category: 'economics',
    definition: 'Central bank decisions about money supply and interest rates, aimed at controlling inflation and supporting economic stability.',
    related: ['fiscal-policy', 'inflation'],
  },
  {
    term: 'Universal Basic Income',
    category: 'economics',
    definition: 'A policy proposal where every citizen receives a regular cash payment from the government, regardless of employment status or income level.',
    platform: 'One of the most frequently proposed and debated topics on the platform. Often abbreviated as UBI.',
    related: ['welfare', 'fiscal-policy'],
  },
  {
    term: 'Externality',
    category: 'economics',
    definition: 'A cost or benefit that affects a third party not directly involved in a transaction. Negative externalities (e.g., pollution) are often cited as justification for regulation.',
    related: ['regulation', 'fiscal-policy'],
  },

  // ── Rights ────────────────────────────────────────────────────────────────
  {
    term: 'Civil Liberties',
    category: 'rights',
    definition: 'Fundamental individual rights protected from government interference, such as freedom of speech, press, religion, assembly, and due process.',
    related: ['rights', 'due-process', 'constitution'],
  },
  {
    term: 'Civil Rights',
    category: 'rights',
    definition: 'The rights of citizens to political and social equality, including freedom from discrimination based on race, sex, age, disability, national origin, or religion.',
    related: ['civil-liberties', 'discrimination'],
  },
  {
    term: 'Proportionality',
    category: 'rights',
    definition: 'The principle that government actions must be proportionate to the legitimate aim being pursued. Used in rights law to assess whether restrictions on freedoms are justified.',
    related: ['civil-liberties', 'rights'],
  },
  {
    term: 'Presumption of Innocence',
    category: 'rights',
    definition: 'The legal principle that an accused person is considered innocent until proven guilty. A cornerstone of fair trial rights in democratic societies.',
    related: ['due-process', 'rights'],
  },

  // ── Roles ─────────────────────────────────────────────────────────────────
  {
    term: 'Citizen',
    category: 'roles',
    definition: 'The default role for all users on Lobby Market. Citizens can vote, propose topics, write arguments, and participate in all platform features.',
    platform: 'The starting role for every new account. Citizens gain Clout and can advance to higher roles through sustained civic engagement.',
    related: ['debator', 'elder', 'senator', 'clout'],
  },
  {
    term: 'Debator',
    category: 'roles',
    definition: 'A role earned by users who have demonstrated consistent quality argumentation. Debators receive elevated visibility for their arguments and can participate in structured debates.',
    platform: 'Promoted from Citizen through a combination of argument upvotes, clout earned, and community recognition.',
    related: ['citizen', 'elder', 'debate'],
    link: '/leaderboard',
    linkLabel: 'Leaderboard',
  },
  {
    term: 'Troll Catcher',
    category: 'roles',
    definition: 'A specialist moderation role for users who have proven adept at identifying and flagging bad-faith participation, logical fallacies, and civic bad actors.',
    platform: 'A lateral role (not in the promotion chain) that grants enhanced moderation capabilities. Troll Catchers help maintain the quality of discourse.',
    related: ['citizen', 'moderation'],
    link: '/moderation',
    linkLabel: 'Moderation panel',
  },
  {
    term: 'Elder',
    category: 'roles',
    definition: 'A senior citizen role earned through exceptional long-term civic engagement. Elders serve as community stewards and their arguments carry additional weight in discourse.',
    platform: 'The highest non-staff role achievable through normal participation. Elders appear with a distinctive gold badge throughout the platform.',
    related: ['citizen', 'debator', 'senator', 'clout'],
  },
  {
    term: 'Senator',
    category: 'roles',
    definition: 'A platform staff role for users who help curate and govern the legislative process. Senators have elevated moderation abilities and can move topics between phases.',
    platform: 'Currently an invitation-only role awarded by the platform team. Senators are identifiable by their distinctive badge.',
    related: ['elder', 'governance'],
    link: '/senate',
    linkLabel: 'The Senate',
  },
  {
    term: 'Coalition',
    category: 'roles',
    definition: 'An organized group of citizens aligned around a shared civic position or strategy. Coalitions can declare stances on topics, recruit members, and earn collective Clout.',
    platform: 'Coalitions are sub-organizations within Lobbies. They compete in the Arena and appear on the Leaderboard with their aggregate influence score.',
    related: ['lobby', 'arena', 'clout'],
    link: '/coalitions',
    linkLabel: 'Browse coalitions',
  },
  {
    term: 'Reputation Score',
    category: 'roles',
    definition: 'A composite score reflecting a user\'s overall civic quality on the platform, calculated from voting consistency, argument quality, debate performance, and community recognition.',
    platform: 'Distinct from Clout (which is currency) — Reputation is a quality signal. It affects feed ranking and role eligibility.',
    related: ['clout', 'citizen', 'debator'],
    link: '/analytics',
    linkLabel: 'Your analytics',
  },
]

// ─── Slug helper ──────────────────────────────────────────────────────────────

function slug(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

// ─── Term card ────────────────────────────────────────────────────────────────

function TermCard({ term, highlight }: { term: GlossaryTerm; highlight?: string }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORIES[term.category]

  function highlightText(text: string): React.ReactNode {
    if (!highlight || highlight.length < 2) return text
    const pattern = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(pattern)
    return parts.map((part, i) =>
      pattern.test(part)
        ? <mark key={i} className="bg-for-500/25 text-for-300 rounded-sm px-0.5">{part}</mark>
        : part
    )
  }

  const termId = slug(term.term)

  return (
    <motion.div
      id={termId}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl border transition-colors duration-150',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5"
        aria-expanded={expanded}
        aria-controls={`${termId}-body`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Term + category badge */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h3 className="font-mono text-base font-bold text-white">
                {highlightText(term.term)}
              </h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border',
                  cat.color, cat.bg, cat.border
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cat.dot)} />
                {cat.label}
              </span>
            </div>

            {/* Short definition preview */}
            <p className="text-sm text-surface-400 leading-relaxed line-clamp-2">
              {highlightText(term.definition)}
            </p>
          </div>

          {/* Expand toggle */}
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg transition-colors',
            'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
          )}>
            {expanded
              ? <ChevronUp className="h-4 w-4" aria-hidden />
              : <ChevronDown className="h-4 w-4" aria-hidden />
            }
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`${termId}-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-surface-300/60 pt-4">
              {/* Full definition */}
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-surface-600 mb-1">Definition</p>
                <p className="text-sm text-surface-300 leading-relaxed">
                  {highlightText(term.definition)}
                </p>
              </div>

              {/* Platform context */}
              {term.platform && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-for-600 mb-1">On Lobby Market</p>
                  <p className="text-sm text-surface-400 leading-relaxed">
                    {highlightText(term.platform)}
                  </p>
                </div>
              )}

              {/* Related terms */}
              {term.related && term.related.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-surface-600 mb-2">Related terms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {term.related.map((rel) => {
                      const relTerm = TERMS.find((t) => slug(t.term) === rel || t.term.toLowerCase() === rel.toLowerCase())
                      return relTerm ? (
                        <button
                          key={rel}
                          onClick={(e) => {
                            e.stopPropagation()
                            const el = document.getElementById(slug(relTerm.term))
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              el.classList.add('ring-2', 'ring-for-500/50')
                              setTimeout(() => el.classList.remove('ring-2', 'ring-for-500/50'), 2000)
                            }
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg',
                            'bg-surface-200 border border-surface-300 text-surface-400',
                            'hover:bg-surface-300 hover:text-white hover:border-surface-400 transition-colors',
                          )}
                        >
                          <Link2 className="h-2.5 w-2.5" aria-hidden />
                          {relTerm.term}
                        </button>
                      ) : (
                        <span
                          key={rel}
                          className="inline-flex items-center text-xs font-mono px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-surface-600"
                        >
                          {rel}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Platform link */}
              {term.link && term.linkLabel && (
                <div>
                  <Link
                    href={term.link}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-mono font-semibold',
                      'text-for-400 hover:text-for-300 transition-colors',
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    {term.linkLabel}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GlossaryPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryKey | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TERMS.filter((t) => {
      const matchCat = category === 'all' || t.category === category
      if (!matchCat) return false
      if (!q) return true
      return (
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        (t.platform ?? '').toLowerCase().includes(q)
      )
    }).sort((a, b) => a.term.localeCompare(b.term))
  }, [query, category])

  // Build alphabetical groups
  const groups = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>()
    for (const t of filtered) {
      const letter = t.term[0].toUpperCase()
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(t)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const totalCount = TERMS.length
  const shownCount = filtered.length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-28 md:pb-12">

        {/* ── Hero header ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <BookOpen className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Civic Glossary
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {totalCount} terms · governance, voting, debate &amp; platform
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed max-w-xl mt-3">
            A reference guide to the vocabulary of democracy and the mechanics of Lobby Market.
            Search any term, filter by category, or explore related concepts.
          </p>
        </div>

        {/* ── Search + filters ──────────────────────────────────────────── */}
        <div className="mb-6 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms…"
              aria-label="Search glossary terms"
              className={cn(
                'w-full bg-surface-200/80 border border-surface-300/80 rounded-xl',
                'pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/50 transition-colors',
              )}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Filter by category">
            {CATEGORY_FILTERS.map((f) => {
              const isActive = category === f.id
              const cat = f.id !== 'all' ? CATEGORIES[f.id as CategoryKey] : null
              return (
                <button
                  key={f.id}
                  onClick={() => setCategory(f.id as CategoryKey | 'all')}
                  aria-pressed={isActive}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold',
                    'border transition-all',
                    isActive
                      ? cat
                        ? cn(cat.color, cat.bg, cat.border)
                        : 'bg-for-600/20 border-for-600/40 text-for-400'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400/60 hover:text-surface-300',
                  )}
                >
                  {cat && isActive && (
                    <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cat.dot)} aria-hidden />
                  )}
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Results count ─────────────────────────────────────────────── */}
        {(query || category !== 'all') && (
          <p className="text-xs font-mono text-surface-600 mb-4">
            Showing {shownCount} of {totalCount} term{totalCount !== 1 ? 's' : ''}
            {query ? ` matching "${query}"` : ''}
            {category !== 'all' ? ` in ${CATEGORIES[category as CategoryKey].label}` : ''}
          </p>
        )}

        {/* ── No results ────────────────────────────────────────────────── */}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-4">
              <BookOpen className="h-7 w-7 text-surface-500" aria-hidden />
            </div>
            <h2 className="font-mono text-lg font-bold text-white mb-2">No terms found</h2>
            <p className="text-sm font-mono text-surface-500 mb-4 max-w-xs mx-auto">
              Try a different search or select a different category.
            </p>
            <button
              onClick={() => { setQuery(''); setCategory('all') }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-medium hover:bg-surface-300 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* ── Alphabetical term groups ──────────────────────────────────── */}
        <div className="space-y-8">
          {groups.map(([letter, terms]) => (
            <section key={letter} aria-labelledby={`letter-${letter}`}>
              {/* Letter heading */}
              <div className="flex items-center gap-3 mb-3">
                <h2
                  id={`letter-${letter}`}
                  className="font-mono text-sm font-bold text-surface-600 uppercase tracking-wider"
                >
                  {letter}
                </h2>
                <div className="h-px flex-1 bg-surface-300/60" aria-hidden />
              </div>

              {/* Term cards */}
              <div className="space-y-2">
                {terms.map((t) => (
                  <TermCard key={t.term} term={t} highlight={query} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="mt-12 pt-8 border-t border-surface-300">
            <div className="rounded-2xl bg-for-500/8 border border-for-500/20 p-6 text-center">
              <BookOpen className="h-8 w-8 text-for-400 mx-auto mb-3" aria-hidden />
              <h3 className="font-mono text-base font-bold text-white mb-2">
                Ready to put these terms into practice?
              </h3>
              <p className="text-sm text-surface-400 mb-4 max-w-sm mx-auto">
                Every term here comes alive when you vote, argue, and debate in the Lobby.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  Enter the Feed
                </Link>
                <Link
                  href="/law"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-semibold hover:bg-surface-300 transition-colors"
                >
                  Browse the Codex
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
