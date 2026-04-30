'use client'

/**
 * /skill-tree — The Civic Skill Tree
 *
 * A visual RPG-style progression map showing every civic milestone on
 * Lobby Market. Locked nodes appear dim; unlocked nodes glow with their
 * branch colour. Progress bars show how close the user is to the next
 * unlock on in-progress nodes.
 *
 * Five branches:
 *   Voter      — voting milestones
 *   Orator     — argument milestones
 *   Scholar    — knowledge/bookmarks
 *   Strategist — coalitions, predictions, debates
 *   Sage       — reputation, streaks, tenure
 *
 * Plus the central Role Spine: Citizen → Debator → Troll Catcher → Elder
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Clock,
  Coins,
  Flame,
  Gavel,
  GitBranch,
  Heart,
  Lock,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Vote,
  type LucideIcon,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SkillTreeStats } from '@/app/api/skill-tree/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillNode {
  id: string
  label: string
  description: string
  icon: LucideIcon
  branch: 'voter' | 'orator' | 'scholar' | 'strategist' | 'sage' | 'role'
  tier: number          // 1-4, higher = further along branch
  requirement: number   // numeric target
  current: (s: SkillTreeStats) => number
  max: (s: SkillTreeStats) => number
  unlocked: (s: SkillTreeStats) => boolean
  reward?: string
}

// ─── Branch config ────────────────────────────────────────────────────────────

const BRANCH_CONFIG = {
  voter:      { label: 'Voter',      color: 'text-for-400',     bg: 'bg-for-500/20',     border: 'border-for-500/40',     glow: 'shadow-for-500/40',     fill: 'bg-for-500' },
  orator:     { label: 'Orator',     color: 'text-against-300', bg: 'bg-against-500/20', border: 'border-against-500/40', glow: 'shadow-against-500/40', fill: 'bg-against-500' },
  scholar:    { label: 'Scholar',    color: 'text-purple',      bg: 'bg-purple/20',      border: 'border-purple/40',      glow: 'shadow-purple/40',      fill: 'bg-purple' },
  strategist: { label: 'Strategist', color: 'text-emerald',     bg: 'bg-emerald/20',     border: 'border-emerald/40',     glow: 'shadow-emerald/40',     fill: 'bg-emerald' },
  sage:       { label: 'Sage',       color: 'text-gold',        bg: 'bg-gold/20',        border: 'border-gold/40',        glow: 'shadow-gold/40',        fill: 'bg-gold' },
  role:       { label: 'Role',       color: 'text-white',       bg: 'bg-surface-200',    border: 'border-surface-400',    glow: 'shadow-white/20',       fill: 'bg-white' },
} as const

// ─── Skill node definitions ───────────────────────────────────────────────────

function buildNodes(): SkillNode[] {
  return [
    // ── VOTER BRANCH ─────────────────────────────────────────────────────────
    {
      id: 'first_vote',
      label: 'Ballot Cast',
      description: 'Cast your first vote on any topic.',
      icon: Vote,
      branch: 'voter',
      tier: 1,
      requirement: 1,
      current: s => Math.min(s.profile?.total_votes ?? 0, 1),
      max: () => 1,
      unlocked: s => (s.profile?.total_votes ?? 0) >= 1,
      reward: '+5 clout',
    },
    {
      id: 'regular_voter',
      label: 'Regular',
      description: 'Vote on 10 topics.',
      icon: Vote,
      branch: 'voter',
      tier: 2,
      requirement: 10,
      current: s => Math.min(s.profile?.total_votes ?? 0, 10),
      max: () => 10,
      unlocked: s => (s.profile?.total_votes ?? 0) >= 10,
      reward: '+15 clout',
    },
    {
      id: 'committed_voter',
      label: 'Committed',
      description: 'Vote on 50 topics.',
      icon: Vote,
      branch: 'voter',
      tier: 3,
      requirement: 50,
      current: s => Math.min(s.profile?.total_votes ?? 0, 50),
      max: () => 50,
      unlocked: s => (s.profile?.total_votes ?? 0) >= 50,
      reward: '+25 clout',
    },
    {
      id: 'veteran_voter',
      label: 'Veteran',
      description: 'Vote on 200 topics.',
      icon: Trophy,
      branch: 'voter',
      tier: 4,
      requirement: 200,
      current: s => Math.min(s.profile?.total_votes ?? 0, 200),
      max: () => 200,
      unlocked: s => (s.profile?.total_votes ?? 0) >= 200,
      reward: '+50 clout',
    },

    // ── ORATOR BRANCH ─────────────────────────────────────────────────────────
    {
      id: 'first_argument',
      label: 'First Word',
      description: 'Post your first argument.',
      icon: MessageSquare,
      branch: 'orator',
      tier: 1,
      requirement: 1,
      current: s => Math.min(s.profile?.total_arguments ?? 0, 1),
      max: () => 1,
      unlocked: s => (s.profile?.total_arguments ?? 0) >= 1,
      reward: '+5 clout',
    },
    {
      id: 'contributor',
      label: 'Contributor',
      description: 'Post 5 arguments.',
      icon: MessageSquare,
      branch: 'orator',
      tier: 2,
      requirement: 5,
      current: s => Math.min(s.profile?.total_arguments ?? 0, 5),
      max: () => 5,
      unlocked: s => (s.profile?.total_arguments ?? 0) >= 5,
      reward: '+15 clout',
    },
    {
      id: 'debater_node',
      label: 'Debater',
      description: 'Post 15 arguments.',
      icon: Mic,
      branch: 'orator',
      tier: 3,
      requirement: 15,
      current: s => Math.min(s.profile?.total_arguments ?? 0, 15),
      max: () => 15,
      unlocked: s => (s.profile?.total_arguments ?? 0) >= 15,
      reward: '+30 clout',
    },
    {
      id: 'orator_node',
      label: 'The Orator',
      description: 'Post 40 arguments.',
      icon: Sparkles,
      branch: 'orator',
      tier: 4,
      requirement: 40,
      current: s => Math.min(s.profile?.total_arguments ?? 0, 40),
      max: () => 40,
      unlocked: s => (s.profile?.total_arguments ?? 0) >= 40,
      reward: '+75 clout',
    },

    // ── SCHOLAR BRANCH ────────────────────────────────────────────────────────
    {
      id: 'first_bookmark',
      label: 'First Save',
      description: 'Bookmark your first topic.',
      icon: BookMarked,
      branch: 'scholar',
      tier: 1,
      requirement: 1,
      current: s => Math.min(s.bookmarked_topics, 1),
      max: () => 1,
      unlocked: s => s.bookmarked_topics >= 1,
      reward: '+5 clout',
    },
    {
      id: 'collector',
      label: 'Collector',
      description: 'Bookmark 10 topics.',
      icon: BookOpen,
      branch: 'scholar',
      tier: 2,
      requirement: 10,
      current: s => Math.min(s.bookmarked_topics, 10),
      max: () => 10,
      unlocked: s => s.bookmarked_topics >= 10,
      reward: '+15 clout',
    },
    {
      id: 'archivist',
      label: 'Archivist',
      description: 'Bookmark 10 arguments.',
      icon: BookMarked,
      branch: 'scholar',
      tier: 3,
      requirement: 10,
      current: s => Math.min(s.bookmarked_arguments, 10),
      max: () => 10,
      unlocked: s => s.bookmarked_arguments >= 10,
      reward: '+20 clout',
    },
    {
      id: 'scholar_node',
      label: 'Scholar',
      description: 'Bookmark 25 topics and 25 arguments.',
      icon: Star,
      branch: 'scholar',
      tier: 4,
      requirement: 25,
      current: s => Math.min(Math.min(s.bookmarked_topics, 25) + Math.min(s.bookmarked_arguments, 25), 50),
      max: () => 50,
      unlocked: s => s.bookmarked_topics >= 25 && s.bookmarked_arguments >= 25,
      reward: '+40 clout',
    },

    // ── STRATEGIST BRANCH ─────────────────────────────────────────────────────
    {
      id: 'first_coalition',
      label: 'Aligned',
      description: 'Join your first coalition.',
      icon: Users,
      branch: 'strategist',
      tier: 1,
      requirement: 1,
      current: s => Math.min(s.coalitions_joined, 1),
      max: () => 1,
      unlocked: s => s.coalitions_joined >= 1,
      reward: '+10 clout',
    },
    {
      id: 'first_prediction',
      label: 'Forecaster',
      description: 'Make your first prediction.',
      icon: Target,
      branch: 'strategist',
      tier: 2,
      requirement: 1,
      current: s => Math.min(s.predictions_made, 1),
      max: () => 1,
      unlocked: s => s.predictions_made >= 1,
      reward: '+10 clout',
    },
    {
      id: 'debate_participant',
      label: 'On the Floor',
      description: 'Participate in a live debate.',
      icon: Mic,
      branch: 'strategist',
      tier: 3,
      requirement: 1,
      current: s => Math.min(s.debate_participations, 1),
      max: () => 1,
      unlocked: s => s.debate_participations >= 1,
      reward: '+25 clout',
    },
    {
      id: 'strategist_node',
      label: 'Strategist',
      description: 'Join 3 coalitions and make 10 predictions.',
      icon: GitBranch,
      branch: 'strategist',
      tier: 4,
      requirement: 13,
      current: s => Math.min(s.coalitions_joined, 3) + Math.min(s.predictions_made, 10),
      max: () => 13,
      unlocked: s => s.coalitions_joined >= 3 && s.predictions_made >= 10,
      reward: '+60 clout',
    },

    // ── SAGE BRANCH ───────────────────────────────────────────────────────────
    {
      id: 'streak_3',
      label: 'On a Roll',
      description: 'Maintain a 3-day voting streak.',
      icon: Flame,
      branch: 'sage',
      tier: 1,
      requirement: 3,
      current: s => Math.min(s.profile?.vote_streak ?? 0, 3),
      max: () => 3,
      unlocked: s => (s.profile?.vote_streak ?? 0) >= 3,
      reward: '+10 clout',
    },
    {
      id: 'streak_7',
      label: 'Consistent',
      description: 'Maintain a 7-day voting streak.',
      icon: Flame,
      branch: 'sage',
      tier: 2,
      requirement: 7,
      current: s => Math.min(s.profile?.vote_streak ?? 0, 7),
      max: () => 7,
      unlocked: s => (s.profile?.vote_streak ?? 0) >= 7,
      reward: '+20 clout',
    },
    {
      id: 'early_member',
      label: 'Founding Voice',
      description: 'Be active for 30 days.',
      icon: Clock,
      branch: 'sage',
      tier: 3,
      requirement: 30,
      current: s => Math.min(s.profile?.member_days ?? 0, 30),
      max: () => 30,
      unlocked: s => (s.profile?.member_days ?? 0) >= 30,
      reward: '+30 clout',
    },
    {
      id: 'sage_node',
      label: 'Sage',
      description: 'Earn 1000 clout.',
      icon: Coins,
      branch: 'sage',
      tier: 4,
      requirement: 1000,
      current: s => Math.min(s.profile?.clout ?? 0, 1000),
      max: () => 1000,
      unlocked: s => (s.profile?.clout ?? 0) >= 1000,
      reward: 'Elder eligibility',
    },

    // ── ROLE SPINE ────────────────────────────────────────────────────────────
    {
      id: 'role_citizen',
      label: 'Citizen',
      description: 'Your civic journey begins. Every voice matters.',
      icon: Scale,
      branch: 'role',
      tier: 1,
      requirement: 0,
      current: () => 1,
      max: () => 1,
      unlocked: () => true,
      reward: 'Starting role',
    },
    {
      id: 'role_debator',
      label: 'Debator',
      description: 'Vote on 25 topics and post 3 arguments.',
      icon: Gavel,
      branch: 'role',
      tier: 2,
      requirement: 28,
      current: s => Math.min(s.profile?.total_votes ?? 0, 25) + Math.min(s.profile?.total_arguments ?? 0, 3),
      max: () => 28,
      unlocked: s => (s.profile?.role === 'debator' || s.profile?.role === 'troll_catcher' || s.profile?.role === 'elder'),
      reward: 'Debator badge',
    },
    {
      id: 'role_troll_catcher',
      label: 'Troll Catcher',
      description: 'Pass the moderation training with ≥75% accuracy.',
      icon: Shield,
      branch: 'role',
      tier: 3,
      requirement: 75,
      current: s => Math.round(s.training?.accuracy_pct ?? 0),
      max: () => 75,
      unlocked: s => (s.profile?.role === 'troll_catcher' || s.profile?.role === 'elder'),
      reward: 'Moderation access',
    },
    {
      id: 'role_elder',
      label: 'Elder',
      description: 'Reach 1000 clout and 100 total votes.',
      icon: Award,
      branch: 'role',
      tier: 4,
      requirement: 1100,
      current: s => Math.min(s.profile?.clout ?? 0, 1000) + Math.min(s.profile?.total_votes ?? 0, 100),
      max: () => 1100,
      unlocked: s => s.profile?.role === 'elder',
      reward: 'Elder council access',
    },
  ]
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max, fill }: { value: number; max: number; fill: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-surface-400 overflow-hidden mt-2">
      <motion.div
        className={cn('h-full rounded-full', fill)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      />
    </div>
  )
}

// ─── Skill node card ──────────────────────────────────────────────────────────

function SkillNodeCard({
  node,
  stats,
  onClick,
}: {
  node: SkillNode
  stats: SkillTreeStats
  onClick: (node: SkillNode) => void
}) {
  const branch = BRANCH_CONFIG[node.branch]
  const unlocked = node.unlocked(stats)
  const current = node.current(stats)
  const max = node.max(stats)
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const inProgress = !unlocked && current > 0
  const NodeIcon = node.icon

  return (
    <motion.button
      onClick={() => onClick(node)}
      className={cn(
        'relative w-full text-left rounded-xl border p-3 transition-all',
        unlocked
          ? cn(branch.bg, branch.border, 'shadow-lg', branch.glow)
          : 'bg-surface-200 border-surface-400',
        'hover:scale-[1.02] active:scale-[0.98]'
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={unlocked ? { scale: 1.02 } : {}}
    >
      {/* Unlock glow overlay */}
      {unlocked && (
        <motion.div
          className={cn('absolute inset-0 rounded-xl opacity-0', branch.bg)}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative flex items-start gap-2">
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
            unlocked ? branch.bg : 'bg-surface-300'
          )}
        >
          {unlocked ? (
            <NodeIcon className={cn('h-4 w-4', branch.color)} />
          ) : (
            <Lock className="h-3.5 w-3.5 text-surface-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-sm font-semibold', unlocked ? 'text-white' : 'text-surface-500')}>
              {node.label}
            </span>
            {unlocked && (
              <CheckCircle2 className={cn('h-3.5 w-3.5 flex-shrink-0', branch.color)} />
            )}
          </div>

          {!unlocked && (
            <>
              <div className="text-xs text-surface-500 mt-0.5 line-clamp-1">{node.description}</div>
              <ProgressBar value={current} max={max} fill={branch.fill} />
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-surface-500">{current.toLocaleString()} / {max.toLocaleString()}</span>
                <span className={cn('text-[10px] font-medium', inProgress ? branch.color : 'text-surface-600')}>
                  {Math.round(pct)}%
                </span>
              </div>
            </>
          )}

          {unlocked && node.reward && (
            <span className={cn('text-[10px]', branch.color)}>{node.reward}</span>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

const ROLE_LINK: Record<string, string> = {
  role_debator: '/profile/me',
  role_troll_catcher: '/moderation/training',
  role_elder: '/clout',
}

function DrawerContent({
  node,
  stats,
  onClose,
}: {
  node: SkillNode
  stats: SkillTreeStats
  onClose: () => void
}) {
  const branch = BRANCH_CONFIG[node.branch]
  const NodeIcon = node.icon
  const unlocked = node.unlocked(stats)
  const current = node.current(stats)
  const max = node.max(stats)
  const link = ROLE_LINK[node.id]

  return (
    <>
      <motion.div
        key="overlay"
        className="fixed inset-0 bg-black/60 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="drawer"
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface-100 border-t border-surface-300 rounded-t-2xl p-6 pb-10"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', branch.bg)}>
            <NodeIcon className={cn('h-6 w-6', branch.color)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{node.label}</h3>
              {unlocked && <CheckCircle2 className={cn('h-5 w-5', branch.color)} />}
            </div>
            <span className={cn('text-sm font-medium capitalize', branch.color)}>
              {BRANCH_CONFIG[node.branch].label} Branch · Tier {node.tier}
            </span>
          </div>
        </div>

        <p className="text-surface-300 text-sm mb-4">{node.description}</p>

        {!unlocked && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-surface-400">Progress</span>
              <span className="text-white font-medium">{current.toLocaleString()} / {max.toLocaleString()}</span>
            </div>
            <ProgressBar value={current} max={max} fill={branch.fill} />
          </div>
        )}

        {node.reward && (
          <div className={cn('rounded-lg p-3 mb-4', branch.bg, 'border', branch.border)}>
            <div className="text-xs text-surface-400 mb-0.5">Reward</div>
            <div className={cn('text-sm font-semibold', branch.color)}>{node.reward}</div>
          </div>
        )}

        {unlocked ? (
          <div className="flex items-center gap-2 text-emerald text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Milestone unlocked!
          </div>
        ) : link ? (
          <Link
            href={link}
            onClick={onClose}
            className={cn(
              'block w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors',
              branch.bg, 'hover:opacity-80', branch.color
            )}
          >
            Work toward this milestone →
          </Link>
        ) : null}
      </motion.div>
    </>
  )
}

function NodeDetailDrawer({
  node,
  stats,
  onClose,
}: {
  node: SkillNode | null
  stats: SkillTreeStats
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {node && (
        <DrawerContent key={node.id} node={node} stats={stats} onClose={onClose} />
      )}
    </AnimatePresence>
  )
}

// ─── Branch column ────────────────────────────────────────────────────────────

function BranchColumn({
  branch,
  nodes,
  stats,
  onNodeClick,
}: {
  branch: keyof typeof BRANCH_CONFIG
  nodes: SkillNode[]
  stats: SkillTreeStats
  onNodeClick: (node: SkillNode) => void
}) {
  const config = BRANCH_CONFIG[branch]
  const unlockedCount = nodes.filter(n => n.unlocked(stats)).length

  return (
    <div className="flex flex-col gap-2">
      {/* Branch header */}
      <div className={cn('rounded-lg px-3 py-2 border text-center', config.bg, config.border)}>
        <div className={cn('text-sm font-bold', config.color)}>{config.label}</div>
        <div className="text-xs text-surface-400">{unlockedCount}/{nodes.length}</div>
      </div>

      {/* Connector line down */}
      <div className="flex justify-center">
        <div className={cn('w-0.5 h-3', unlockedCount > 0 ? config.fill : 'bg-surface-400')} />
      </div>

      {/* Nodes */}
      {nodes.map((node, i) => (
        <div key={node.id} className="flex flex-col items-center">
          <SkillNodeCard node={node} stats={stats} onClick={onNodeClick} />
          {i < nodes.length - 1 && (
            <div className="flex justify-center mt-1 mb-1">
              <div className={cn(
                'w-0.5 h-3',
                node.unlocked(stats) ? config.fill : 'bg-surface-400'
              )} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillTreePage() {
  const [stats, setStats] = useState<SkillTreeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null)

  const nodes = buildNodes()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/skill-tree')
      if (res.ok) setStats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const nodesByBranch = (branch: SkillNode['branch']) =>
    nodes.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier)

  const totalUnlocked = stats ? nodes.filter(n => n.unlocked(stats)).length : 0
  const totalNodes = nodes.length

  // Guest fallback stats so nodes can still render locked
  const displayStats: SkillTreeStats = stats ?? {
    authenticated: false,
    profile: null,
    training: null,
    laws_voted_for: 0,
    bookmarked_topics: 0,
    bookmarked_arguments: 0,
    coalitions_joined: 0,
    predictions_made: 0,
    debate_participations: 0,
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <TopBar />

      {/* Header */}
      <div className="sticky top-14 z-30 bg-surface-100 border-b border-surface-300">
        <div className="max-w-4xl mx-auto flex items-center gap-3 h-12 px-4">
          <Link
            href="/profile/me"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Trophy className="h-4 w-4 text-gold" />
            <span className="text-sm font-semibold text-white">Civic Skill Tree</span>
          </div>
          <button
            onClick={load}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Hero section */}
        {loading ? (
          <div className="flex items-center gap-4 mb-8 p-4 rounded-2xl border border-surface-300 bg-surface-100">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ) : (
          <motion.div
            className="flex items-center gap-4 mb-8 p-4 rounded-2xl border border-surface-300 bg-surface-100"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {stats?.profile ? (
              <>
                <Avatar
                  src={stats.profile.avatar_url}
                  username={stats.profile.username}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-white">
                    {stats.profile.display_name ?? stats.profile.username}
                  </div>
                  <div className="text-sm text-surface-400 capitalize">{stats.profile.role}</div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-300 flex items-center justify-center">
                  <Scale className="h-6 w-6 text-surface-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Guest Explorer</div>
                  <Link href="/login" className="text-xs text-for-400 hover:underline">Sign in to track progress →</Link>
                </div>
              </div>
            )}

            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold text-gold">{totalUnlocked}</div>
              <div className="text-xs text-surface-400">of {totalNodes} unlocked</div>
            </div>
          </motion.div>
        )}

        {/* Overall progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-surface-400 font-medium">Overall Progress</span>
            <span className="text-white font-semibold">{Math.round((totalUnlocked / totalNodes) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-for-500 via-gold to-emerald"
              initial={{ width: 0 }}
              animate={{ width: `${(totalUnlocked / totalNodes) * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Role spine + branches */}
        <div className="space-y-10">

          {/* Role progression spine */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-white" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">Role Progression</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {nodesByBranch('role').map((node) => (
                <SkillNodeCard key={node.id} node={node} stats={displayStats} onClick={setSelectedNode} />
              ))}
            </div>
          </section>

          {/* All branches in 2-col on mobile, 4-col on desktop */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">Civic Branches</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {(['voter', 'orator', 'scholar', 'strategist', 'sage'] as const).map(branch => (
                <BranchColumn
                  key={branch}
                  branch={branch}
                  nodes={nodesByBranch(branch)}
                  stats={displayStats}
                  onNodeClick={setSelectedNode}
                />
              ))}
            </div>
          </section>

          {/* Summary stats grid */}
          {stats?.profile && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-4 w-4 text-surface-400" />
                <h2 className="text-sm font-bold text-surface-400 uppercase tracking-wide">Your Stats</h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[
                  { label: 'Votes', value: stats.profile.total_votes, icon: Vote, color: 'text-for-400' },
                  { label: 'Arguments', value: stats.profile.total_arguments, icon: MessageSquare, color: 'text-against-300' },
                  { label: 'Clout', value: stats.profile.clout, icon: Coins, color: 'text-gold' },
                  { label: 'Streak', value: stats.profile.vote_streak, icon: Flame, color: 'text-against-400', suffix: 'd' },
                  { label: 'Followers', value: stats.profile.followers_count, icon: Heart, color: 'text-emerald' },
                  { label: 'Days Active', value: stats.profile.member_days, icon: Clock, color: 'text-purple' },
                ].map(({ label, value, icon: Icon, color, suffix }) => (
                  <div key={label} className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center">
                    <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                    <div className="text-lg font-bold text-white">{value.toLocaleString()}{suffix ?? ''}</div>
                    <div className="text-[10px] text-surface-400">{label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        stats={displayStats}
        onClose={() => setSelectedNode(null)}
      />

      <BottomNav />
    </div>
  )
}

