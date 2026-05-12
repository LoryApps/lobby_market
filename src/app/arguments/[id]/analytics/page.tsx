'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ArgumentAnalyticsData, ArgumentAnalyticsResponse } from '@/app/api/arguments/[id]/analytics/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ordinal(n: number): string {
  if (n === 11 || n === 12 || n === 13) return `${n}th`
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

// ─── Engagement tier ──────────────────────────────────────────────────────────

interface EngagementTier {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Flame
}

function getEngagementTier(score: number): EngagementTier {
  if (score >= 100) return { label: 'Viral',   color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: Flame }
  if (score >= 50)  return { label: 'High',    color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        icon: Sparkles }
  if (score >= 20)  return { label: 'Engaged', color: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: Zap }
  if (score >= 5)   return { label: 'Active',  color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     icon: CheckCircle2 }
  return               { label: 'Early',   color: 'text-surface-500', bg: 'bg-surface-200/50', border: 'border-surface-300',    icon: Clock }
}

// ─── Grade config ──────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string; label: string }> = {
  A: { text: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/30',     label: 'Exceptional' },
  B: { text: 'text-for-300',      bg: 'bg-for-500/10',     border: 'border-for-500/30',     label: 'Strong' },
  C: { text: 'text-gold',         bg: 'bg-gold/10',        border: 'border-gold/30',        label: 'Adequate' },
  D: { text: 'text-against-300',  bg: 'bg-against-500/10', border: 'border-against-500/30', label: 'Weak' },
  F: { text: 'text-against-400',  bg: 'bg-against-600/10', border: 'border-against-600/30', label: 'Poor' },
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
}
const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'LAW', failed: 'Failed',
}

// ─── Reaction bar ─────────────────────────────────────────────────────────────

interface ReactionBarProps {
  label: string
  icon: string
  count: number
  total: number
  color: string
  bg: string
  delay: number
}

function ReactionBar({ label, icon, count, total, color, bg, delay }: ReactionBarProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-surface-400">
          <span className="text-base leading-none">{icon}</span>
          <span>{label}</span>
        </span>
        <span className={cn('font-mono font-semibold text-xs', color)}>
          {count} <span className="text-surface-500 font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', bg)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Rank card ────────────────────────────────────────────────────────────────

interface RankCardProps {
  label: string
  rank: number
  total: number
  color: string
  bg: string
  border: string
  icon: typeof Trophy
  delay: number
}

function RankCard({ label, rank, total, color, bg, border, icon: Icon, delay }: RankCardProps) {
  const pct = total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0
  const topPct = total > 0 ? Math.round((rank / total) * 100) : 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn('rounded-xl border p-4 flex flex-col gap-3', bg, border)}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-xs font-mono text-surface-500">{label}</span>
      </div>
      <div>
        <span className={cn('text-3xl font-mono font-bold', color)}>
          {ordinal(rank)}
        </span>
        <span className="text-sm text-surface-500 font-mono ml-1.5">/ {total}</span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 bg-surface-300/50 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', bg.replace('bg-', 'bg-').replace('/10', ''))}
            style={{ backgroundColor: 'currentColor' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
          />
        </div>
        <p className="text-[11px] font-mono text-surface-500">
          Top {topPct}% on this topic
        </p>
      </div>
    </motion.div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: typeof ThumbsUp
  iconColor: string
  iconBg: string
  iconBorder: string
  label: string
  value: number
  suffix?: string
  delay: number
}

function StatCard({ icon: Icon, iconColor, iconBg, iconBorder, label, value, suffix, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-surface-100 border border-surface-300 rounded-xl p-4 flex flex-col gap-2"
    >
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg border', iconBg, iconBorder)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <AnimatedNumber value={value} className="text-2xl font-mono font-bold text-white" />
          {suffix && <span className="text-xs font-mono text-surface-500">{suffix}</span>}
        </div>
        <p className="text-xs font-mono text-surface-500 mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArgumentAnalyticsPage() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<ArgumentAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/arguments/${id}/analytics`)
      .then((r) => r.json())
      .then((json: ArgumentAnalyticsResponse) => {
        if (json.data) {
          setData(json.data)
        } else {
          setError(json.error ?? 'Failed to load analytics')
        }
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return null // loading.tsx handles this

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <EmptyState
            icon={BarChart2}
            title="Analytics unavailable"
            description={error ?? 'Could not load engagement data for this argument.'}
            actions={[{ label: 'Back to argument', href: `/arguments/${id}`, variant: 'primary', icon: ArrowLeft }]}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const tier = getEngagementTier(data.engagement_score)
  const TierIcon = tier.icon
  const gradeConfig = data.ai_grade ? GRADE_CONFIG[data.ai_grade] : null
  const isSideFor = data.side === 'blue'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">

        {/* Back nav */}
        <Link
          href={`/arguments/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to argument
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={cn(
            'rounded-2xl border p-5 space-y-4',
            isSideFor
              ? 'bg-for-600/5 border-for-500/20'
              : 'bg-against-600/5 border-against-500/20'
          )}
        >
          {/* Side + topic */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border',
                isSideFor
                  ? 'bg-for-500/10 border-for-500/30 text-for-300'
                  : 'bg-against-500/10 border-against-500/30 text-against-300'
              )}>
                {isSideFor
                  ? <><ThumbsUp className="h-3 w-3" /> FOR</>
                  : <><ThumbsDown className="h-3 w-3" /> AGAINST</>
                }
              </span>
              <Badge variant={STATUS_BADGE[data.topic.status] ?? 'proposed'} size="sm">
                {STATUS_LABEL[data.topic.status] ?? data.topic.status}
              </Badge>
              {data.topic.category && (
                <span className="text-xs font-mono text-surface-500">{data.topic.category}</span>
              )}
            </div>
            <span className="text-xs font-mono text-surface-500">{relativeTime(data.created_at)}</span>
          </div>

          {/* Argument content */}
          <p className="text-sm text-surface-600 leading-relaxed line-clamp-3">
            {data.content}
          </p>

          {/* Author + topic links */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            {data.author ? (
              <Link
                href={`/profile/${data.author.username}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Avatar
                  src={data.author.avatar_url ?? undefined}
                  username={data.author.username}
                  size="xs"
                />
                <span className="text-xs font-mono text-surface-500">
                  {data.author.display_name ?? data.author.username}
                </span>
              </Link>
            ) : (
              <span className="text-xs font-mono text-surface-500">Anonymous</span>
            )}
            <Link
              href={`/topic/${data.topic.id}`}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <span className="truncate max-w-[180px]">{truncate(data.topic.statement, 40)}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </Link>
          </div>
        </motion.div>

        {/* Engagement tier banner */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className={cn(
            'rounded-xl border p-4 flex items-center justify-between gap-4',
            tier.bg, tier.border
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl', tier.bg, tier.border)}>
              <TierIcon className={cn('h-5 w-5', tier.color)} />
            </div>
            <div>
              <p className="text-xs font-mono text-surface-500">Engagement Tier</p>
              <p className={cn('text-lg font-mono font-bold', tier.color)}>{tier.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-surface-500">Composite Score</p>
            <p className="text-2xl font-mono font-bold text-white">
              <AnimatedNumber value={data.engagement_score} />
            </p>
            <p className="text-[10px] font-mono text-surface-500">upvotes×3 + reactions×2 + replies</p>
          </div>
        </motion.div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={ThumbsUp}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/30"
            label="Upvotes"
            value={data.upvotes}
            delay={0.15}
          />
          <StatCard
            icon={Sparkles}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            label="Reactions"
            value={data.reactions.total}
            delay={0.2}
          />
          <StatCard
            icon={MessageSquare}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            label="Replies"
            value={data.reply_count}
            delay={0.25}
          />
          <StatCard
            icon={Zap}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            label="Upvotes / day"
            value={data.upvote_velocity}
            suffix="/day"
            delay={0.3}
          />
        </div>

        {/* Reaction breakdown */}
        {data.reactions.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="bg-surface-100 border border-surface-300 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-purple" />
              <h2 className="text-sm font-mono font-semibold text-white">Reaction Breakdown</h2>
              <span className="text-xs font-mono text-surface-500 ml-auto">{data.reactions.total} total</span>
            </div>
            <div className="space-y-3">
              <ReactionBar
                label="Insightful"
                icon="💡"
                count={data.reactions.insightful}
                total={data.reactions.total}
                color="text-for-300"
                bg="bg-for-500"
                delay={0.4}
              />
              <ReactionBar
                label="Compelling"
                icon="🔥"
                count={data.reactions.compelling}
                total={data.reactions.total}
                color="text-against-300"
                bg="bg-against-500"
                delay={0.45}
              />
              <ReactionBar
                label="Balanced"
                icon="⚖️"
                count={data.reactions.balanced}
                total={data.reactions.total}
                color="text-gold"
                bg="bg-gold"
                delay={0.5}
              />
              <ReactionBar
                label="Needs Evidence"
                icon="🔍"
                count={data.reactions.needs_evidence}
                total={data.reactions.total}
                color="text-surface-400"
                bg="bg-surface-500"
                delay={0.55}
              />
            </div>
          </motion.div>
        )}

        {/* Topic ranking */}
        <div className="grid grid-cols-2 gap-3">
          <RankCard
            label="Overall rank on topic"
            rank={data.topic_rank}
            total={data.topic_total}
            color="text-gold"
            bg="bg-gold/10"
            border="border-gold/30"
            icon={Trophy}
            delay={0.4}
          />
          <RankCard
            label={isSideFor ? 'FOR side rank' : 'AGAINST side rank'}
            rank={data.side_rank}
            total={data.side_total}
            color={isSideFor ? 'text-for-300' : 'text-against-300'}
            bg={isSideFor ? 'bg-for-500/10' : 'bg-against-500/10'}
            border={isSideFor ? 'border-for-500/30' : 'border-against-500/30'}
            icon={Users}
            delay={0.45}
          />
        </div>

        {/* AI Grade */}
        {gradeConfig && data.ai_grade && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className={cn('rounded-xl border p-5 flex items-center gap-5', gradeConfig.bg, gradeConfig.border)}
          >
            <div className={cn(
              'flex items-center justify-center h-16 w-16 rounded-2xl border text-3xl font-mono font-black flex-shrink-0',
              gradeConfig.bg, gradeConfig.border, gradeConfig.text
            )}>
              {data.ai_grade}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Brain className={cn('h-4 w-4', gradeConfig.text)} />
                <span className="text-xs font-mono text-surface-500">AI Quality Grade</span>
              </div>
              <p className={cn('text-xl font-mono font-bold', gradeConfig.text)}>{gradeConfig.label}</p>
              {data.ai_score !== null && (
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Score: {data.ai_score}<span className="text-surface-600">/10</span>
                </p>
              )}
            </div>
            <Link
              href={`/arguments/${id}/critique`}
              className={cn(
                'flex items-center gap-1 text-xs font-mono px-3 py-2 rounded-lg border',
                gradeConfig.bg, gradeConfig.border, gradeConfig.text,
                'hover:opacity-80 transition-opacity'
              )}
            >
              View critique <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}

        {/* Age & velocity info */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="bg-surface-100 border border-surface-300 rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-mono font-semibold text-white">Lifetime</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-mono font-bold text-white">{data.days_alive}</p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">days active</p>
            </div>
            <div>
              <p className="text-2xl font-mono font-bold text-white">{data.upvote_velocity}</p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">upvotes / day</p>
            </div>
            <div>
              <p className="text-2xl font-mono font-bold text-white">
                {data.upvotes > 0 && data.days_alive > 0
                  ? Math.round((data.upvotes / data.days_alive) * 30)
                  : 0}
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">projected / 30d</p>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="grid grid-cols-2 gap-3"
        >
          <Link
            href={`/arguments/${id}`}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Full argument
          </Link>
          <Link
            href={`/topic/${data.topic.id}`}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-600/10 border border-for-500/30 text-sm font-mono text-for-300 hover:bg-for-600/20 transition-colors"
          >
            {data.topic.status === 'law'
              ? <Gavel className="h-4 w-4" />
              : <Scale className="h-4 w-4" />
            }
            View topic
          </Link>
        </motion.div>

      </main>
      <BottomNav />
    </div>
  )
}
