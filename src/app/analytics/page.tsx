'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  TrendingUp, Vote, Zap, Target, BarChart2, ArrowLeft, Brain, Flame, Heart, Scale,
  MessageSquare, Award, ChevronRight, CheckCircle2, Circle, XCircle, Clock, ChevronDown,
  Compass, Fingerprint, Users, Swords, Star, Network, Sparkles, BookOpen, ThumbsUp,
  Shield, Gavel, Quote, Rocket, Hash, Gauge, Eye, LayoutGrid, Trophy, TrendingDown,
  GitMerge,
  GitCompare,
  Coins,
  Landmark,
  Layers,
  Globe,
  FileText,
  Shuffle,
  Activity,
  Radio,
  Map,
  Search,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { VoteCalendar } from '@/components/profile/VoteCalendar'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { PredictionRecord } from '@/app/api/analytics/predictions/route'
import type { KinProfile, KinResponse } from '@/app/api/analytics/kin/route'

interface AnalyticsData {
  profile: {
    total_votes: number; blue_vote_count: number; red_vote_count: number
    vote_streak: number; clout: number; reputation_score: number
    total_arguments: number; member_since: string
  }
  accuracy: number | null
  resolved_votes: number
  today?: { votes_used: number; daily_limit: number; reset_at: string | null }
  topCategories: Array<{ category: string; count: number; blue: number; red: number }>
  dailyActivity: Array<{ date: string; count: number }>
  monthlyActivity: Array<{ month: string; count: number }>
  predictions?: { total: number; resolved: number; correct: number; accuracy: number | null; avg_brier: number | null; clout_earned: number }
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-300/50', className)} />
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" /><Skeleton className="h-8 w-20 mb-1" /><Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-44"><Skeleton className="h-4 w-24 mb-4" /><Skeleton className="h-6 w-full mb-2" /><Skeleton className="h-6 w-3/4" /></div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-44"><Skeleton className="h-4 w-24 mb-4" /><Skeleton className="h-24 w-full" /></div>
      </div>
    </div>
  )
}

function TodayProgressCard({ votesUsed, dailyLimit, streak }: { votesUsed: number; dailyLimit: number; streak: number }) {
  const pct = Math.min((votesUsed / dailyLimit) * 100, 100)
  const goalMet = votesUsed >= dailyLimit
  const hasVotedToday = votesUsed > 0
  const streakColor = streak >= 30 ? 'text-against-300' : streak >= 7 ? 'text-gold' : streak >= 1 ? 'text-amber-400' : 'text-surface-500'
  const barColor = pct >= 100 ? 'bg-gradient-to-r from-emerald to-emerald/70' : pct >= 60 ? 'bg-gradient-to-r from-for-500 to-for-400' : 'bg-gradient-to-r from-for-700 to-for-500'
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4"><Flame className="h-3.5 w-3.5 text-gold" />Today&apos;s Progress</div>
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={cn('text-3xl font-mono font-bold', streakColor)}>{streak}</div>
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">day{streak !== 1 ? 's' : ''}</div>
          <div className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500"><Flame className={cn('h-3 w-3', streakColor)} />streak</div>
        </div>
        <div className="w-px self-stretch bg-surface-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-mono font-medium text-white">Daily votes</span>
            <span className={cn('text-sm font-mono font-bold', goalMet ? 'text-emerald' : 'text-for-400')}>{votesUsed}<span className="text-surface-500 font-normal">/{dailyLimit}</span></span>
          </div>
          <div className="relative h-2.5 rounded-full bg-surface-300 overflow-hidden mb-3">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }} className={cn('absolute inset-y-0 left-0 rounded-full', barColor)} />
          </div>
          {goalMet ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald"><CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />Daily goal complete — streak extended!</div>
          ) : hasVotedToday ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500"><Circle className="h-3.5 w-3.5 flex-shrink-0 text-for-500" />{dailyLimit - votesUsed} more vote{dailyLimit - votesUsed !== 1 ? 's' : ''} to reach your daily goal</div>
          ) : streak > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-against-400"><Flame className="h-3.5 w-3.5 flex-shrink-0" />Vote today to keep your {streak}-day streak alive!</div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500"><Circle className="h-3.5 w-3.5 flex-shrink-0 text-surface-400" />Cast your first vote today to start a streak</div>
          )}
        </div>
      </div>
      {!goalMet && (
        <div className="mt-4 pt-4 border-t border-surface-300">
          <Link href="/" className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg', 'bg-for-600/20 border border-for-600/30 text-for-400', 'text-xs font-mono font-medium', 'hover:bg-for-600/30 transition-colors')}>Go vote<ChevronRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}
    </motion.div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-white', delay = 0 }: { label: string; value: number | string; sub?: string; icon: typeof TrendingUp; color?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono uppercase tracking-wider"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={cn('text-3xl font-bold font-mono', color)}>{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</div>
      {sub && <div className="text-xs text-surface-500">{sub}</div>}
    </motion.div>
  )
}

function VoteDNACard({ blue, red: _red, total }: { blue: number; red: number; total: number }) {
  const bluePct = total > 0 ? Math.round((blue / total) * 100) : 50
  const redPct = 100 - bluePct
  const identity = bluePct >= 70 ? 'Strong Supporter' : bluePct >= 55 ? 'Leaning For' : bluePct >= 45 ? 'True Centrist' : bluePct >= 30 ? 'Leaning Against' : 'Strong Dissenter'
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4"><Scale className="h-3.5 w-3.5" />Vote DNA</div>
      <div className="mb-4"><span className="text-white font-bold text-lg">{identity}</span><p className="text-xs text-surface-500 mt-0.5">Based on {total.toLocaleString()} votes cast</p></div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300 mb-3">
        <motion.div initial={{ width: 0 }} animate={{ width: `${bluePct}%` }} transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }} className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full" />
      </div>
      <div className="flex justify-between text-xs font-mono"><span className="text-for-400">FOR {bluePct}%</span><span className="text-against-400">{redPct}% AGAINST</span></div>
    </motion.div>
  )
}

function AccuracyCard({ accuracy, resolved }: { accuracy: number | null; resolved: number }) {
  const tier = accuracy === null ? null : accuracy >= 75 ? { label: 'Oracle', color: 'text-gold', ring: 'border-gold/50' } : accuracy >= 60 ? { label: 'Sharp', color: 'text-emerald', ring: 'border-emerald/50' } : accuracy >= 50 ? { label: 'Aligned', color: 'text-for-400', ring: 'border-for-500/50' } : { label: 'Contrarian', color: 'text-against-400', ring: 'border-against-500/50' }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.2 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4"><Target className="h-3.5 w-3.5" />Vote Accuracy</div>
      {accuracy === null ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-surface-500 text-sm">Not enough resolved votes yet.</div>
          <p className="text-xs text-surface-600 mt-1">Accuracy unlocks after {Math.max(0, 5 - resolved)} more resolved topics.</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className={cn('relative flex-shrink-0 h-20 w-20 rounded-full border-4 flex flex-col items-center justify-center', tier?.ring ?? 'border-surface-400')}>
            <span className={cn('text-2xl font-bold font-mono', tier?.color)}>{accuracy}%</span>
          </div>
          <div>
            <div className={cn('text-xl font-bold', tier?.color)}>{tier?.label}</div>
            <p className="text-xs text-surface-500 mt-1">Correct on {Math.round((accuracy / 100) * resolved)} of {resolved} resolved topics</p>
            <p className="text-xs text-surface-600 mt-0.5">{accuracy >= 50 ? 'Your intuition tracks with the majority.' : 'You think differently from the crowd.'}</p>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function CategoryBreakdown({ categories }: { categories: Array<{ category: string; count: number; blue: number; red: number }> }) {
  if (categories.length === 0) return null
  const max = Math.max(...categories.map((c) => c.count))
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.25 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5"><BarChart2 className="h-3.5 w-3.5" />Top Categories</div>
      <div className="space-y-3">
        {categories.map((cat, i) => {
          const bluePct = cat.count > 0 ? (cat.blue / cat.count) * 100 : 50
          const barWidth = max > 0 ? (cat.count / max) * 100 : 0
          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1"><span className="text-sm text-white font-medium">{cat.category}</span><span className="text-xs font-mono text-surface-500">{cat.count} votes</span></div>
              <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${barWidth}%` }} transition={{ duration: 0.6, delay: 0.35 + i * 0.05, ease: 'easeOut' }} className="absolute inset-y-0 left-0 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-for-600 to-for-400" style={{ width: `${bluePct}%` }} />
                  <div className="absolute top-0 right-0 h-full bg-against-500" style={{ width: `${100 - bluePct}%` }} />
                </motion.div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs font-mono text-surface-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-for-500 inline-block" />FOR</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-against-500 inline-block" />AGAINST</span>
      </div>
    </motion.div>
  )
}

function MonthlyBars({ months }: { months: Array<{ month: string; count: number }> }) {
  const max = Math.max(...months.map((m) => m.count), 1)
  function shortMonth(ym: string) { const [year, month] = ym.split('-'); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' }) }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.35 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5"><BarChart2 className="h-3.5 w-3.5" />6-Month Trend</div>
      <div className="flex items-end gap-2 h-24">
        {months.map((m, i) => {
          const height = max > 0 ? Math.max((m.count / max) * 100, m.count > 0 ? 8 : 0) : 0
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                <motion.div initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ duration: 0.5, delay: 0.45 + i * 0.07, ease: 'easeOut' }} className="w-full rounded-t-sm bg-for-600 hover:bg-for-500 transition-colors" title={`${m.month}: ${m.count} votes`} />
              </div>
              <span className="text-[10px] font-mono text-surface-500">{shortMonth(m.month)}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

const STATUS_LABEL: Record<string, string> = { proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'LAW', failed: 'Failed', archived: 'Archived', continued: 'Continued' }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PredictionRow({ pred }: { pred: PredictionRecord }) {
  const isResolved = pred.resolved_at !== null
  const outcome = !isResolved ? { label: 'Pending', color: 'text-surface-500', bg: 'bg-surface-300/50', icon: Clock } : pred.correct ? { label: 'Correct', color: 'text-emerald', bg: 'bg-emerald/10', icon: CheckCircle2 } : { label: 'Wrong', color: 'text-against-400', bg: 'bg-against-500/10', icon: XCircle }
  const OutcomeIcon = outcome.icon
  const predLabel = pred.predicted_law ? 'Will pass' : 'Will fail'
  const predColor = pred.predicted_law ? 'text-for-400' : 'text-against-400'
  return (
    <Link href={`/topic/${pred.topic_id}`} className="flex items-start gap-3 px-4 py-4 hover:bg-surface-200/50 transition-colors">
      <div className={cn('flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center', outcome.bg)}><OutcomeIcon className={cn('h-3.5 w-3.5', outcome.color)} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 line-clamp-2 mb-1.5">{pred.topic?.statement ?? 'Unknown topic'}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-surface-500">
          <span className={cn('font-semibold', predColor)}>{predLabel} · {pred.confidence}% conf</span>
          {pred.topic && <span className={cn(pred.topic.status === 'law' ? 'text-gold' : pred.topic.status === 'failed' ? 'text-against-400' : 'text-surface-500')}>{STATUS_LABEL[pred.topic.status] ?? pred.topic.status}</span>}
          {pred.brier_score !== null && <span title="Brier score (lower = better calibration)">Brier {pred.brier_score.toFixed(3)}</span>}
          {pred.clout_earned > 0 && <span className="text-gold">+{pred.clout_earned} clout</span>}
          <span>{relativeTime(pred.created_at)}</span>
        </div>
      </div>
      <span className={cn('flex-shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full', outcome.bg, outcome.color)}>{outcome.label}</span>
    </Link>
  )
}

function KinCard({ person, type }: { person: KinProfile; type: 'kin' | 'opposite' }) {
  const isKin = type === 'kin'
  const pct = person.agreement_pct
  const barColor = isKin ? (pct >= 80 ? 'bg-emerald' : 'bg-for-400') : 'bg-against-400'
  const borderHover = isKin ? 'hover:border-emerald/40' : 'hover:border-against-400/40'
  return (
    <Link href={`/profile/${person.username}`} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-3', 'border border-surface-300 bg-surface-100 transition-colors', borderHover, 'group')}>
      <Avatar src={person.avatar_url} fallback={person.display_name ?? person.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-white truncate group-hover:text-surface-700 transition-colors">{person.display_name ?? person.username}</span>
          <span className={cn('text-xs font-mono font-bold flex-shrink-0', isKin ? (pct >= 80 ? 'text-emerald' : 'text-for-400') : 'text-against-400')}>{pct}%</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden"><div className={cn('absolute inset-y-0 left-0 rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} /></div>
        <div className="mt-1 text-[10px] font-mono text-surface-500">{person.common_topics} shared topics</div>
      </div>
    </Link>
  )
}

function PoliticalKinSection() {
  const [data, setData] = useState<KinResponse | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/analytics/kin', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setData(d as KinResponse) }).catch(() => {}).finally(() => setLoading(false))
  }, [])
  const hasKin = !loading && data && (data.kin.length > 0 || data.opposites.length > 0)
  const noData = !loading && (!data || (data.kin.length === 0 && data.opposites.length === 0))
  if (loading) return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5"><Users className="h-3.5 w-3.5 text-emerald" />Political Kin</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4].map((i)=>(<div key={i} className="flex items-center gap-3 rounded-xl p-3 border border-surface-300 animate-pulse"><Skeleton className="h-8 w-8 rounded-full flex-shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-1.5 w-full rounded-full" /></div></div>))}</div>
    </div>
  )
  if (noData) return null
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.42 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5"><Users className="h-3.5 w-3.5 text-emerald" />Political Kin</div>
      {hasKin && (
        <div className="space-y-5">
          {data!.kin.length > 0 && (<div><div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald uppercase tracking-wider mb-3"><Users className="h-3 w-3" />Allies — highest vote agreement</div><div className="flex flex-col gap-2">{data!.kin.map((p)=><KinCard key={p.id} person={p} type="kin" />)}</div></div>)}
          {data!.opposites.length > 0 && (<div><div className="flex items-center gap-1.5 text-[10px] font-mono text-against-400 uppercase tracking-wider mb-3"><Swords className="h-3 w-3" />Rivals — lowest vote agreement</div><div className="flex flex-col gap-2">{data!.opposites.map((p)=><KinCard key={p.id} person={p} type="opposite" />)}</div></div>)}
          <div className="border-t border-surface-300 pt-3 flex items-center justify-between">
            <p className="text-[10px] font-mono text-surface-600">Based on your recent votes. Agreement % = shared votes where you chose the same side. Minimum 3 topics in common required.</p>
            <Link href="/analytics/kin" className="flex items-center gap-1 text-[10px] font-mono text-emerald hover:text-emerald/80 transition-colors flex-shrink-0 ml-4"><ChevronRight className="h-3 w-3" />Full report</Link>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function PredictionHistorySection() {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    fetch('/api/analytics/predictions', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((data) => { if (data?.predictions) setPredictions(data.predictions as PredictionRecord[]) }).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4"><Target className="h-3.5 w-3.5 text-purple" />My Predictions</div>
      <div className="space-y-3">{[1,2,3].map((i)=>(<div key={i} className="flex items-start gap-3 animate-pulse"><Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-2/3" /></div></div>))}</div>
    </div>
  )
  if (predictions.length === 0) return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4"><Target className="h-3.5 w-3.5 text-purple" />My Predictions</div>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="h-10 w-10 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center mb-3"><Target className="h-5 w-5 text-purple" /></div>
        <p className="text-sm text-surface-500">No predictions yet.</p>
        <p className="text-xs text-surface-600 mt-1">Open any active topic and stake a prediction to earn clout when it resolves.</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors">Browse topics<ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
    </div>
  )
  const SHOW_INITIAL = 5
  const visible = expanded ? predictions : predictions.slice(0, SHOW_INITIAL)
  const hasMore = predictions.length > SHOW_INITIAL
  const resolved = predictions.filter((p) => p.resolved_at !== null)
  const correct = resolved.filter((p) => p.correct === true)
  const pending = predictions.filter((p) => p.resolved_at === null)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.5 }} className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider"><Target className="h-3.5 w-3.5 text-purple" />My Predictions<span className="text-surface-600">({predictions.length})</span></div>
        <div className="flex items-center gap-3 text-[11px] font-mono">{pending.length > 0 && <span className="text-surface-500">{pending.length} pending</span>}{resolved.length > 0 && <span className="text-emerald">{correct.length}/{resolved.length} correct</span>}</div>
      </div>
      <div className="divide-y divide-surface-300/60">{visible.map((pred) => <PredictionRow key={pred.id} pred={pred} />)}</div>
      {hasMore && <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors border-t border-surface-300/60">{expanded ? 'Show less' : `Show all ${predictions.length} predictions`}<ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} /></button>}
    </motion.div>
  )
}

// ─── Full Analytics Suite directory ──────────────────────────────────────────

const SUITE_SECTIONS: Array<{
  title: string
  color: string
  items: Array<{ label: string; href: string; icon: typeof BarChart2 }>
}> = [
  {
    title: 'Voting',
    color: 'text-for-400',
    items: [
      { label: 'Vote History',      href: '/analytics/votes',         icon: ThumbsUp },
      { label: 'Opinion Evolution', href: '/analytics/evolution',     icon: TrendingUp },
      { label: 'Consensus Shift',   href: '/analytics/consensus-shift', icon: Zap },
      { label: 'Diversity Score',   href: '/analytics/diversity',     icon: Globe },
      { label: 'Streak History',    href: '/analytics/streak',        icon: Flame },
      { label: 'Civic Drift',       href: '/analytics/drift',         icon: TrendingDown },
      { label: 'Contrarian',        href: '/analytics/contrarian',    icon: Shuffle },
      { label: 'Timing Report',     href: '/analytics/timing',        icon: Clock },
      { label: 'Civic Blind Spots', href: '/blindspots',              icon: Eye },
      { label: 'Echo Chamber',     href: '/echo-chamber',             icon: Users },
    ],
  },
  {
    title: 'Arguments',
    color: 'text-purple',
    items: [
      { label: 'Argument Portfolio', href: '/analytics/arguments',        icon: BookOpen },
      { label: 'Argument Quality',   href: '/analytics/argument-quality', icon: Brain },
      { label: 'Quality Trend',      href: '/analytics/quality-trend',    icon: TrendingUp },
      { label: 'Rhetoric Style',     href: '/analytics/rhetoric',         icon: Brain },
      { label: 'Argument DNA',       href: '/analytics/dna',              icon: Sparkles },
      { label: 'Argument Mentor',    href: '/analytics/mentor',           icon: Brain },
      { label: 'Argument Velocity',  href: '/analytics/velocity',         icon: Activity },
      { label: 'Citation Impact',    href: '/analytics/citations',        icon: Globe },
      { label: 'Hot Take Voice',     href: '/analytics/reasons',          icon: Quote },
      { label: 'Thread Analytics',   href: '/analytics/threads',          icon: MessageSquare },
      { label: 'Discourse Quality',  href: '/analytics/discourse',        icon: Brain },
      { label: 'Reaction Analytics', href: '/analytics/reactions',        icon: MessageSquare },
    ],
  },
  {
    title: 'Law & Impact',
    color: 'text-gold',
    items: [
      { label: 'Law Analytics',    href: '/analytics/laws',      icon: Gavel },
      { label: 'Topic Analytics',  href: '/analytics/topics',    icon: Scale },
      { label: 'Proposal Analytics', href: '/analytics/proposals', icon: FileText },
      { label: 'Civic Impact',     href: '/impact',              icon: Star },
      { label: 'Civic Legacy',     href: '/analytics/legacy',    icon: Trophy },
      { label: 'Civic Journey',    href: '/analytics/journey',   icon: Landmark },
    ],
  },
  {
    title: 'Social',
    color: 'text-emerald',
    items: [
      { label: 'Civic Kin',          href: '/analytics/kin',              icon: Users },
      { label: 'Civic Audience',     href: '/analytics/audience',         icon: Users },
      { label: 'Reach Report',       href: '/analytics/reach',            icon: Radio },
      { label: 'Network Topology',   href: '/analytics/network',          icon: Network },
      { label: 'Network Analytics',  href: '/analytics/following',        icon: Network },
      { label: 'Alignment Network',  href: '/analytics/alignment-network', icon: Network },
      { label: 'Civic Alignment',    href: '/analytics/alignment',        icon: Scale },
      { label: 'Coalition Stats',    href: '/analytics/coalitions',       icon: Shield },
      { label: 'Civic Groups',       href: '/analytics/groups',           icon: Users },
      { label: 'Faceoff Record',     href: '/analytics/faceoffs',         icon: Swords },
      { label: 'Debate Stats',       href: '/analytics/debates',          icon: Gavel },
      { label: 'Relay Chain Stats',  href: '/analytics/relays',           icon: GitMerge },
      { label: 'Persuasion Power',   href: '/analytics/persuasion',       icon: Sparkles },
      { label: 'Influence Cascade',  href: '/analytics/cascade',          icon: GitMerge },
    ],
  },
  {
    title: 'Identity',
    color: 'text-against-400',
    items: [
      { label: 'Civic Fingerprint',  href: '/fingerprint',               icon: Fingerprint },
      { label: 'Fingerprint Report', href: '/analytics/fingerprint',     icon: Fingerprint },
      { label: 'Mind Map',           href: '/mindmap',                   icon: Network },
      { label: 'Civic Compass',      href: '/compass',                   icon: Compass },
      { label: 'My Compass',        href: '/analytics/compass',          icon: Compass },
      { label: 'The Accord',         href: '/accord',                    icon: Scale },
      { label: 'Karma Score',        href: '/karma',                     icon: Sparkles },
      { label: 'Sentiment Report',   href: '/analytics/sentiment',       icon: Heart },
      { label: 'Tag Voting Profile', href: '/analytics/tags',            icon: Hash },
      { label: 'Territory Map',      href: '/analytics/territory',       icon: Compass },
      { label: 'Opposition Intel',   href: '/analytics/opposition',      icon: Swords },
      { label: 'Bias Checker',       href: '/bias',                      icon: Brain },
      { label: 'Civic Memories',     href: '/memories',                  icon: Clock },
    ],
  },
  {
    title: 'Rankings & Growth',
    color: 'text-gold',
    items: [
      { label: 'Report Card',       href: '/analytics/report-card',     icon: Award },
      { label: 'Civic Wrapped',     href: '/wrapped',                   icon: Sparkles },
      { label: 'Activity Growth',   href: '/analytics/growth',          icon: Rocket },
      { label: 'Growth Plan',       href: '/analytics/growth-plan',     icon: TrendingUp },
      { label: 'Momentum Report',   href: '/analytics/momentum',        icon: Activity },
      { label: 'Engagement Depth',  href: '/analytics/engagement',      icon: Activity },
      { label: 'Civic Depth Score', href: '/analytics/depth',           icon: Layers },
      { label: 'Civic Coverage',    href: '/analytics/coverage',        icon: Map },
      { label: 'You vs. Platform',  href: '/analytics/compare',         icon: GitCompare },
      { label: 'Civic Bridge',      href: '/bridge',                    icon: GitCompare },
      { label: 'Influence Score',   href: '/influence',                 icon: Network },
      { label: 'Civic Resonance',   href: '/analytics/resonance',       icon: GitMerge },
      { label: 'Consistency',       href: '/analytics/consistency',     icon: GitMerge },
    ],
  },
]

function AnalyticsSuite() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? SUITE_SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((i) =>
          i.label.toLowerCase().includes(query.toLowerCase())
        ),
      })).filter((s) => s.items.length > 0)
    : SUITE_SECTIONS

  return (
    <div className="mt-6 rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-200/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
            <LayoutGrid className="h-3.5 w-3.5 text-surface-500" />
          </div>
          <span className="text-sm font-mono font-semibold text-white">Full Analytics Suite</span>
          <span className="text-xs font-mono text-surface-500">
            {SUITE_SECTIONS.reduce((n, s) => n + s.items.length, 0)} reports
          </span>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-surface-500 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-surface-300">
          <div className="px-5 pt-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search analytics…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-for-500/40 font-mono"
              />
            </div>
          </div>
          <div className="px-5 pb-5 space-y-5">
            {filtered.map((section) => (
              <div key={section.title}>
                <div className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest mb-2', section.color)}>
                  {section.title}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-200/60 border border-surface-300/60 hover:bg-surface-200 hover:border-surface-400 transition-colors group"
                      >
                        <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white flex-shrink-0 transition-colors" />
                        <span className="text-xs font-mono text-surface-600 group-hover:text-white truncate transition-colors">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-surface-500 text-center py-4">No results for &ldquo;{query}&rdquo;</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analytics')
        if (res.status === 401) { router.push('/login'); return }
        if (!res.ok) throw new Error('Failed to load analytics')
        setData(await res.json())
      } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
      finally { setLoading(false) }
    }
    load()
  }, [router])
  const memberSince = data ? new Date(data.profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null
  return (
    <div className="min-h-screen bg-surface-50"><TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0" aria-label="Go back"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-xl font-bold text-white font-mono">Your Analytics</h1>
            {memberSince && <p className="text-xs text-surface-500 mt-0.5">Member since {memberSince}</p>}
          </div>
          <Link href="/profile/me" className="ml-auto flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors font-mono">Profile<ChevronRight className="h-3.5 w-3.5" /></Link>
        </div>
        {error && <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">{error}</div>}
        {loading && <AnalyticsSkeleton />}
        {!loading && data && (
          <div className="space-y-4">
            {data.today && <TodayProgressCard votesUsed={data.today.votes_used} dailyLimit={data.today.daily_limit} streak={data.profile.vote_streak} />}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Clout" value={data.profile.clout} sub="influence score" icon={TrendingUp} color="text-gold" delay={0} />
              <StatCard label="Total Votes" value={data.profile.total_votes} sub="across all topics" icon={Vote} color="text-for-400" delay={0.05} />
              <StatCard label="Streak" value={data.profile.vote_streak} sub="day voting streak" icon={Flame} color="text-against-400" delay={0.1} />
              <StatCard label="Arguments" value={data.profile.total_arguments} sub="posted in debates" icon={MessageSquare} color="text-purple" delay={0.15} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <VoteDNACard blue={data.profile.blue_vote_count} red={data.profile.red_vote_count} total={data.profile.total_votes} />
              <AccuracyCard accuracy={data.accuracy} resolved={data.resolved_votes} />
            </div>
            <VoteCalendar days={data.dailyActivity} />
            <MonthlyBars months={data.monthlyActivity} />
            {data.topCategories.length > 0 && <CategoryBreakdown categories={data.topCategories} />}
            <div className="space-y-3">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3 }}>
                <Link href="/analytics/tags" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-emerald/40 hover:bg-surface-100/80 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/20 flex-shrink-0">
                      <Hash className="h-5 w-5 text-emerald" />
                    </div>
                    <div>
                      <div className="text-sm font-mono font-semibold text-white">Tag Voting Profile</div>
                      <div className="text-xs font-mono text-surface-500 mt-0.5">Your FOR/AGAINST split across every civic tag</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                </Link>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.35 }}>
                <Link href="/analytics/calibration" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-purple/40 hover:bg-surface-100/80 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/20 flex-shrink-0">
                      <Gauge className="h-5 w-5 text-purple" />
                    </div>
                    <div>
                      <div className="text-sm font-mono font-semibold text-white">Calibration Report</div>
                      <div className="text-xs font-mono text-surface-500 mt-0.5">How well do your votes predict civic outcomes?</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                </Link>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.38 }}>
              <Link href="/analytics/lens" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-for-500/40 hover:bg-surface-100/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20 flex-shrink-0">
                    <Eye className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Perspective Lens</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How your votes diverge from community consensus by category</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.39 }}>
              <Link href="/analytics/snapshot" className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-gold/10 to-surface-100 border border-gold/30 p-5 hover:border-gold/50 hover:bg-gold/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <LayoutGrid className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Identity Snapshot</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your full civic profile at a glance — archetype, top categories, scores</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.395 }}>
              <Link href="/analytics/benchmark" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-gold/30 hover:bg-surface-100/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/20 flex-shrink-0">
                    <Trophy className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Benchmark</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How you rank against citizens who joined at the same time</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.406 }}>
              <Link href="/analytics/standing" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-gold/30 hover:bg-surface-100/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/20 flex-shrink-0">
                    <Trophy className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Standing</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your absolute platform rank across Clout, Reputation, Votes, Arguments, and Streak</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.407 }}>
              <Link href="/analytics/timing" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-for-500/30 hover:bg-surface-100/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20 flex-shrink-0">
                    <Clock className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Timing Report</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">When do you vote? Hour-of-day patterns, early-adopter score, and timing archetype</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.40 }}>
              <Link href="/analytics/influence" className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-gold/10 to-surface-100 border border-gold/30 p-5 hover:border-gold/50 hover:bg-gold/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Zap className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Influence Score</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your argument impact, follower reach, and legislative footprint in one score</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.411 }}>
              <Link href="/analytics/journey" className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-gold/8 to-gold/3 border border-gold/25 p-5 hover:border-gold/40 hover:bg-gold/8 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Landmark className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Journey</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">A narrative timeline of your milestones — first vote, achievements, laws shaped</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.41 }}>
              <Link href="/analytics/proposals" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <FileText className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Proposal Analytics</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Topics you&apos;ve proposed — law rate, votes received, category breakdown</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.413 }}>
              <Link href="/analytics/legacy" className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-gold/10 to-purple/5 border border-gold/30 p-5 hover:border-gold/50 hover:bg-gold/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Trophy className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Legacy</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Laws you authored, best arguments, debate record — your permanent civic footprint</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.416 }}>
              <Link href="/analytics/clout" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-gold/20 p-5 hover:border-gold/40 hover:bg-gold/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Coins className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Clout Economy</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How you earn, spend, and rank in the civic currency system</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.415 }}>
              <Link href="/analytics/consistency" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-emerald/40 hover:bg-surface-100/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/20 flex-shrink-0">
                    <GitMerge className="h-5 w-5 text-emerald" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Consistency Report</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How predictably you vote within and across categories</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.41 }}>
              <Link href="/analytics/drift" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-against-500/30 hover:bg-surface-100/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/20 flex-shrink-0">
                    <TrendingDown className="h-5 w-5 text-against-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Drift Report</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">See how far your vote positions diverge from current consensus</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-against-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Civic Portfolio card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4125 }}>
              <Link href="/analytics/portfolio" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-emerald/20 p-5 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                    <BarChart2 className="h-5 w-5 text-emerald" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Portfolio</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your votes as Polymarket-style positions — open, won, lost, right calls, and category allocation</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Argument Impact card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.413 }}>
              <Link href="/analytics/impact" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-gold/20 p-5 hover:border-gold/40 hover:bg-gold/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Trophy className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Argument Impact</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Upvotes earned, replies sparked, debate wins, reach, and your impact archetype</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Argument Quality Trend card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4135 }}>
              <Link href="/analytics/quality-trend" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Argument Quality Trend</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How your AI quality grades have evolved — monthly trend, grade breakdown, and your best arguments</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Civic Resonance card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.414 }}>
              <Link href="/analytics/resonance" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-emerald/20 p-5 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                    <GitMerge className="h-5 w-5 text-emerald" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Resonance</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Arguments that crossed the partisan divide — upvoted by voters who disagreed with your position</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Civic Persuasion card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4132 }}>
              <Link href="/persuasion" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-gold/20 p-5 hover:border-gold/40 hover:bg-gold/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Persuasion</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your argument territory — which categories you fight in, your side split, and persuasion archetype</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Audience card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4135 }}>
              <Link href="/analytics/audience" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-purple/20 p-5 hover:border-purple/40 hover:bg-purple/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                    <Users className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Audience</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Who supports your arguments — top upvoters, role breakdown, category affinity, and monthly engagement</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-purple transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Opposition Intel card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4145 }}>
              <Link href="/analytics/opposition" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-against-500/20 p-5 hover:border-against-500/40 hover:bg-against-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
                    <Swords className="h-5 w-5 text-against-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Opposition Intel</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">The strongest arguments written against your positions — who challenges you and where</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-against-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Argument Velocity card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4148 }}>
              <Link href="/analytics/velocity" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Activity className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Argument Velocity</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Upvotes per day — which arguments are evergreen, surging, or peaked</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Growth Plan card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4147 }}>
              <Link href="/analytics/growth-plan" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Growth Plan</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">AI-powered improvement roadmap — specific tasks to level up your weakest civic dimensions</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Category Mastery card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4148 }}>
              <Link href="/analytics/category-mastery" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-gold/20 p-5 hover:border-gold/40 hover:bg-gold/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                    <Trophy className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Category Mastery</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">RPG-style progression: level up from Novice to Master in each of the 10 civic categories</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Momentum Report card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4149 }}>
              <Link href="/analytics/momentum" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-400/20 p-5 hover:border-for-400/40 hover:bg-for-400/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-400/10 border border-for-400/30 flex-shrink-0">
                    <Activity className="h-5 w-5 text-for-300" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Momentum Report</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Is your civic engagement accelerating or fading? 8-week trend across voting, arguing, and reputation</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-300 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Contrarian Deep Dive card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.415 }}>
              <Link href="/analytics/contrarian" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-against-500/20 p-5 hover:border-against-500/40 hover:bg-against-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
                    <Shuffle className="h-5 w-5 text-against-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Contrarian Deep Dive</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your archetype, streak, and the topics where you went furthest against the grain</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-against-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Civic Depth Score card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.419 }}>
              <Link href="/analytics/depth" className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-for-600/10 to-surface-100 border border-for-500/30 p-5 hover:border-for-500/50 hover:bg-for-600/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Layers className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Depth Score</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How deeply you engage — beyond just voting — across every topic</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Argument DNA card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.421 }}>
              <Link href="/analytics/dna" className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-purple/10 to-surface-100 border border-purple/30 p-5 hover:border-purple/50 hover:bg-purple/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Argument DNA</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your rhetorical archetype, six-dimensional style scores, and top arguments decoded</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-purple transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Civic Groups card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.42 }}>
              <Link href="/analytics/groups" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-purple/40 hover:bg-surface-100/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/20 flex-shrink-0">
                    <Users className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Groups</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How Citizens, Debators, and Elders vote and engage across the platform</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-purple transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Network Analytics card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.44 }}>
              <Link href="/analytics/following" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20 flex-shrink-0">
                    <Network className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Network Analytics</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">What your civic network is voting on, arguing about, and where you align</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Thread Analytics card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.441 }}>
              <Link href="/analytics/threads" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-emerald/20 p-5 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-emerald" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Thread Analytics</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How much dialogue your arguments generate — replies, reply rates, and your most engaging contributions</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Engagement Depth card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.442 }}>
              <Link href="/analytics/engagement" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Activity className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Engagement Depth</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How broadly you participate — votes, arguments, replies, reactions, bookmarks, wiki edits, and more</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* You vs. Platform card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.443 }}>
              <Link href="/analytics/compare" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <GitCompare className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">You vs. The Platform</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Multi-dimensional comparison of your civic profile against the platform-wide median citizen</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Alignment Analytics card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.444 }}>
              <Link href="/analytics/alignment" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Scale className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Alignment</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">How your votes align with your followers and coalition members</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Civic Kin card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.445 }}>
              <Link href="/analytics/kin" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-emerald/20 p-5 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                    <Heart className="h-5 w-5 text-emerald" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Kin</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your political soulmates and civic rivals by vote agreement</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Relay Chain Analytics card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4455 }}>
              <Link href="/analytics/relays" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <GitMerge className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Relay Chain Analytics</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Legs authored, upvotes received, archetype, and your relay contribution patterns</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <PoliticalKinSection />
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4"><Award className="h-3.5 w-3.5" />Reputation Score</div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2"><span className="text-sm text-surface-600">{data.profile.reputation_score.toLocaleString()} pts</span><span className="text-xs text-surface-500">/ 10,000</span></div>
                  <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((data.profile.reputation_score / 10000) * 100, 100)}%` }} transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }} className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald to-emerald/60" />
                  </div>
                </div>
                <Zap className="h-5 w-5 text-gold flex-shrink-0" />
              </div>
              <p className="text-xs text-surface-500 mt-3">Reputation increases with accurate votes, quality arguments, and consistent participation.</p>
            </motion.div>
            {/* Civic Coverage card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.448 }}>
              <Link href="/analytics/coverage" className="flex items-center justify-between rounded-2xl bg-surface-100 border border-for-500/20 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Map className="h-5 w-5 text-for-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Coverage</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Of all the Lobby debates, what share have you actually weighed in on? Category coverage with tier and trend</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            {/* Civic Wrapped card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.449 }}>
              <Link href="/wrapped" className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-purple/10 to-gold/5 border border-purple/30 p-5 hover:border-purple/50 hover:bg-purple/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white">Civic Wrapped</div>
                    <div className="text-xs font-mono text-surface-500 mt-0.5">Your year in civic debate — votes, laws supported, accuracy, best argument, and where you rank</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-purple transition-colors flex-shrink-0" />
              </Link>
            </motion.div>
            <PredictionHistorySection />
            {data.predictions && data.predictions.total > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.45 }} className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5"><Target className="h-3.5 w-3.5 text-purple" />Prediction Market</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div><div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Predictions</div><div className="text-2xl font-mono font-bold text-white">{data.predictions.total}</div><div className="text-[10px] text-surface-500 mt-0.5">{data.predictions.resolved} resolved</div></div>
                  <div><div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Accuracy</div><div className="text-2xl font-mono font-bold text-emerald">{data.predictions.accuracy !== null ? `${data.predictions.accuracy}%` : '—'}</div><div className="text-[10px] text-surface-500 mt-0.5">{data.predictions.correct} correct</div></div>
                  <div><div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Brier Score</div><div className="text-2xl font-mono font-bold text-for-400">{data.predictions.avg_brier !== null ? data.predictions.avg_brier.toFixed(3) : '—'}</div><div className="text-[10px] text-surface-500 mt-0.5">lower = better</div></div>
                  <div><div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Clout Earned</div><div className="text-2xl font-mono font-bold text-gold">{data.predictions.clout_earned}</div><div className="text-[10px] text-surface-500 mt-0.5">from predictions</div></div>
                </div>
              </motion.div>
            )}
          </div>
        )}
        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4"><BarChart2 className="h-6 w-6 text-surface-500" /></div>
            <h2 className="text-lg font-bold text-white mb-2">No analytics yet</h2>
            <p className="text-sm text-surface-500 max-w-xs">Start voting and arguing to unlock your civic analytics dashboard.</p>
            <Link href="/" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-for-600 hover:bg-for-700 px-4 py-2 text-sm font-medium text-white transition-colors">Go to Feed</Link>
          </div>
        )}
        <AnalyticsSuite />
      </main>
      <BottomNav />
    </div>
  )
}
