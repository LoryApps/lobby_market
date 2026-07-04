'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, BarChart2, BookOpen, Brain, ChevronRight, ExternalLink, Flame, GaugeIcon, MessageSquare, RefreshCw, Scale, Sparkles, TrendingUp } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DiscourseResponse, CategoryDiscourse, HealthyTopic, MonthlyTrend } from '@/app/api/analytics/discourse/route'

function healthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald' }
  if (score >= 65) return { label: 'Healthy', color: 'text-for-400' }
  if (score >= 50) return { label: 'Moderate', color: 'text-gold' }
  if (score >= 35) return { label: 'Weak', color: 'text-against-400' }
  return { label: 'Poor', color: 'text-against-500' }
}
function healthBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald'
  if (score >= 65) return 'bg-for-500'
  if (score >= 50) return 'bg-gold'
  if (score >= 35) return 'bg-against-400'
  return 'bg-against-600'
}
const CAT_COLOR: Record<string, string> = { Economics: 'text-gold', Politics: 'text-for-400', Technology: 'text-purple', Science: 'text-emerald', Ethics: 'text-against-300', Philosophy: 'text-for-300', Culture: 'text-gold', Health: 'text-emerald', Environment: 'text-emerald', Education: 'text-for-400' }
function catColor(c: string) { return CAT_COLOR[c] ?? 'text-surface-400' }
const STATUS_BADGE: Record<string, 'proposed'|'active'|'law'|'failed'> = { proposed:'proposed', active:'active', voting:'active', law:'law', failed:'failed' }
const GRADE_FILL: Record<string, string> = { A:'bg-emerald', B:'bg-for-500', C:'bg-gold', D:'bg-against-500', F:'bg-surface-500' }
const GRADE_TEXT: Record<string, string> = { A:'text-emerald', B:'text-for-400', C:'text-gold', D:'text-against-400', F:'text-surface-500' }

function StatCard({ label, value, sub, icon: Icon, iconColor, iconBg, animateValue }: { label:string; value:string|number; sub?:string; icon:React.ComponentType<{className?:string}>; iconColor:string; iconBg:string; animateValue?:number }) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}><Icon className={cn('h-4 w-4', iconColor)} /></div>
      <div><p className="font-mono text-xl font-bold text-white tabular-nums">{animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}</p>{sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}</div>
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function HealthGauge({ score }: { score: number }) {
  const { label, color } = healthLabel(score)
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-emerald/10 border border-emerald/20 flex items-center justify-center"><GaugeIcon className="h-5 w-5 text-emerald" /></div>
          <div><p className="font-mono text-sm font-semibold text-white">Discourse Health</p><p className="text-[11px] font-mono text-surface-500">Platform-wide quality composite</p></div>
        </div>
        <span className={cn('font-mono text-2xl font-bold tabular-nums', color)}>{score}</span>
      </div>
      <div className="h-3 rounded-full bg-surface-300/30 overflow-hidden">
        <motion.div className={cn('h-full rounded-full', healthBarColor(score))} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-mono text-surface-600">Poor</span>
        <span className={cn('text-[11px] font-mono font-semibold', color)}>{label}</span>
        <span className="text-[10px] font-mono text-surface-600">Excellent</span>
      </div>
    </div>
  )
}

function GradeDistributionBar({ dist }: { dist: DiscourseResponse['grade_distribution'] }) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center"><Brain className="h-5 w-5 text-gold" /></div>
        <div><p className="font-mono text-sm font-semibold text-white">Grade Distribution</p><p className="text-[11px] font-mono text-surface-500">AI quality grades across all scored arguments</p></div>
      </div>
      <div className="space-y-2.5">
        {dist.map((d) => (
          <div key={d.grade} className="flex items-center gap-3">
            <span className={cn('w-5 text-xs font-bold font-mono text-right', GRADE_TEXT[d.grade] ?? 'text-surface-500')}>{d.grade}</span>
            <div className="flex-1 h-3 rounded-full bg-surface-300/30 overflow-hidden">
              <motion.div className={cn('h-full rounded-full opacity-80', GRADE_FILL[d.grade] ?? 'bg-surface-500')} initial={{ width: 0 }} animate={{ width: `${d.pct}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }} />
            </div>
            <span className="w-12 text-right text-[11px] font-mono text-surface-400 tabular-nums">{d.pct}% ({d.count.toLocaleString()})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SW = 280, SH = 80, P = 8
function MonthlyTrendChart({ trend }: { trend: MonthlyTrend[] }) {
  const months = trend.filter((m) => m.total_arguments > 0)
  if (months.length < 2) return null
  const maxVol = Math.max(...months.map((m) => m.total_arguments))
  const scores = months.map((m) => m.avg_score ?? 0)
  const maxS = Math.max(...scores), minS = Math.min(...scores.filter((s) => s > 0))
  const xFor = (i: number) => P + (i / (months.length - 1)) * (SW - P * 2)
  const yFor = (s: number) => SH - P - ((s - minS) / (maxS - minS || 1)) * (SH - P * 2)
  const path = months.filter((m) => m.avg_score !== null).map((m, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(m.avg_score!)}`).join(' ')
  const ml = (k: string) => new Date(Number(k.slice(0,4)), Number(k.slice(5,7))-1, 1).toLocaleDateString('en-US', { month: 'short' })
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-purple" /></div>
        <div><p className="font-mono text-sm font-semibold text-white">6-Month Trend</p><p className="text-[11px] font-mono text-surface-500">Argument volume and quality over time</p></div>
      </div>
      <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} className="w-full" role="img" aria-label="Monthly discourse trend">
        {months.map((m, i) => { const x=xFor(i), h=(m.total_arguments/maxVol)*(SH-P*2); return <rect key={m.month+'-b'} x={x-8} y={SH-P-h} width={16} height={h} rx={3} fill="rgba(59,130,246,0.12)" /> })}
        {path && <path d={path} fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <div className="flex justify-between mt-1">{months.map((m) => <span key={m.month} className="text-[10px] font-mono text-surface-600">{ml(m.month)}</span>)}</div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-for-500/30" /><span className="text-[11px] font-mono text-surface-500">Volume</span></div>
        <div className="flex items-center gap-1.5"><div className="h-2 w-4 bg-purple rounded-full" /><span className="text-[11px] font-mono text-surface-500">Avg AI score</span></div>
      </div>
    </div>
  )
}

function CategoryRow({ cat }: { cat: CategoryDiscourse }) {
  const { label, color } = healthLabel(cat.health_score)
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0"><span className={cn('font-mono text-sm font-semibold truncate', catColor(cat.category))}>{cat.category}</span><span className="text-[11px] font-mono text-surface-600 flex-shrink-0">{cat.total_arguments.toLocaleString()} args</span></div>
        <div className="flex items-center gap-2 flex-shrink-0"><span className={cn('font-mono text-xs font-semibold', color)}>{label}</span><span className="font-mono text-sm font-bold text-white tabular-nums">{cat.health_score}</span></div>
      </div>
      <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
        <motion.div className={cn('h-full rounded-full opacity-75', healthBarColor(cat.health_score))} initial={{ width: 0 }} animate={{ width: `${cat.health_score}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center"><p className="font-mono text-sm font-bold text-white tabular-nums">{cat.avg_score?.toFixed(1) ?? '—'}</p><p className="text-[10px] font-mono text-surface-600">Avg Score</p></div>
        <div className="text-center"><p className="font-mono text-sm font-bold text-white tabular-nums">{cat.grade_a_pct}%</p><p className="text-[10px] font-mono text-surface-600">Grade A</p></div>
        <div className="text-center"><p className="font-mono text-sm font-bold text-white tabular-nums">{Math.round(cat.reply_rate * 100)}%</p><p className="text-[10px] font-mono text-surface-600">Reply Rate</p></div>
      </div>
    </div>
  )
}

function TopicCard({ topic }: { topic: HealthyTopic }) {
  const { label, color } = healthLabel(topic.health_score)
  const forPct = Math.round(topic.blue_pct ?? 50)
  return (
    <Link href={`/topic/${topic.id}`} className="block rounded-xl bg-surface-100 border border-surface-300/40 p-4 hover:border-surface-400/60 transition-colors group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-mono text-white group-hover:text-for-300 transition-colors leading-snug line-clamp-2 flex-1">{topic.statement}</p>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5 group-hover:text-surface-400 transition-colors" />
      </div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {topic.category && <span className={cn('text-[11px] font-mono font-semibold', catColor(topic.category))}>{topic.category}</span>}
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">{topic.status === 'law' ? 'LAW' : topic.status.toUpperCase()}</Badge>
        <span className={cn('text-[11px] font-mono font-semibold ml-auto', color)}>{label} · {topic.health_score}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center"><p className="font-mono text-xs font-bold text-white tabular-nums">{topic.total_arguments}</p><p className="text-[10px] font-mono text-surface-600">Arguments</p></div>
        <div className="text-center"><p className="font-mono text-xs font-bold text-white tabular-nums">{topic.avg_score?.toFixed(1) ?? '—'}</p><p className="text-[10px] font-mono text-surface-600">Avg Score</p></div>
        <div className="text-center"><p className="font-mono text-xs font-bold text-white tabular-nums">{Math.round(topic.reply_rate * 100)}%</p><p className="text-[10px] font-mono text-surface-600">Reply Rate</p></div>
      </div>
      <div className="mt-3 h-1.5 rounded-full overflow-hidden flex">
        <div className="bg-for-500/60" style={{ width: `${forPct}%` }} />
        <div className="bg-against-500/60 flex-1" />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
        <span className="text-[10px] font-mono text-against-400">{100-forPct}% AGAINST</span>
      </div>
    </Link>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50 pb-24"><TopBar />
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-lg bg-surface-300/50 animate-pulse" /><div className="h-10 w-10 rounded-xl bg-surface-300/50 animate-pulse" />
          <div className="space-y-2"><div className="h-4 w-48 rounded bg-surface-300/50 animate-pulse" /><div className="h-3 w-64 rounded bg-surface-300/50 animate-pulse" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">{[...Array(4)].map((_,i)=><div key={i} className="h-20 rounded-xl bg-surface-300/50 animate-pulse" />)}</div>
        <div className="h-28 rounded-2xl bg-surface-300/50 animate-pulse mb-4" /><div className="h-48 rounded-2xl bg-surface-300/50 animate-pulse mb-4" /><div className="h-40 rounded-2xl bg-surface-300/50 animate-pulse mb-4" />
        <div className="space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="h-28 rounded-xl bg-surface-300/50 animate-pulse" />)}</div>
      </div><BottomNav /></div>
  )
}

export default function DiscoursePage() {
  const router = useRouter()
  const [data, setData] = useState<DiscourseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/analytics/discourse', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as DiscourseResponse)
    } catch (err) { setError((err as Error).message || 'Failed to load discourse data') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  if (loading) return <LoadingSkeleton />
  if (error) return (
    <div className="min-h-screen bg-surface-50"><TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-14 w-14 rounded-full bg-against-500/10 border border-against-500/20 flex items-center justify-center mb-4"><Brain className="h-6 w-6 text-against-400" /></div>
        <h2 className="font-mono text-lg font-semibold text-white mb-2">Discourse data unavailable</h2>
        <p className="text-sm font-mono text-surface-500 max-w-sm mb-6">{error}</p>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:text-white hover:border-surface-400 transition-colors"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
          <Link href="/analytics" className="px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-700 transition-colors">Back to Analytics</Link>
        </div>
      </main><BottomNav /></div>
  )
  if (!data) return null
  const visibleCategories = showAll ? data.by_category : data.by_category.slice(0, 5)
  const visibleTopics = data.healthiest_topics.slice(0, 8)
  return (
    <div className="min-h-screen bg-surface-50 pb-24"><TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-4 pb-8">
        <div className="flex items-start gap-3 mb-6">
          <button onClick={() => router.back()} aria-label="Go back" className="flex-shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-surface-200 border border-surface-300/60 flex items-center justify-center text-surface-500 hover:text-white hover:border-surface-400 transition-colors"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center flex-shrink-0"><Brain className="h-5 w-5 text-emerald" /></div>
            <div className="min-w-0"><h1 className="font-mono text-xl font-bold text-white leading-tight">Discourse Quality</h1><p className="text-[12px] font-mono text-surface-500">Platform-wide argument health · last 90 days</p></div>
          </div>
          <button onClick={load} aria-label="Refresh data" className="flex-shrink-0 h-9 w-9 rounded-lg bg-surface-200 border border-surface-300/60 flex items-center justify-center text-surface-500 hover:text-white hover:border-surface-400 transition-colors"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Arguments" value={data.total_arguments.toLocaleString()} animateValue={data.total_arguments} icon={BookOpen} iconColor="text-for-400" iconBg="bg-for-500/10" />
          <StatCard label="AI Scored" value={`${data.scored_pct}%`} icon={Brain} iconColor="text-gold" iconBg="bg-gold/10" />
          <StatCard label="Avg Quality" value={data.platform_avg_score?.toFixed(1) ?? '—'} sub="out of 10" icon={Sparkles} iconColor="text-purple" iconBg="bg-purple/10" />
          <StatCard label="Reply Rate" value={`${Math.round(data.overall_reply_rate * 100)}%`} sub={`${data.avg_replies_per_arg} avg per arg`} icon={MessageSquare} iconColor="text-emerald" iconBg="bg-emerald/10" />
        </div>
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.05}} className="mb-4"><HealthGauge score={data.platform_health_score} /></motion.div>
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.1}} className="mb-4"><GradeDistributionBar dist={data.grade_distribution} /></motion.div>
        {data.monthly_trend.some((m)=>m.total_arguments>0) && (<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.15}} className="mb-6"><MonthlyTrendChart trend={data.monthly_trend} /></motion.div>)}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">By Category</h2>
            <Link href="/categories" className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors">Browse topics<ChevronRight className="h-3 w-3" /></Link>
          </div>
          {data.by_category.length === 0 ? <EmptyState title="No category data yet" description="Argument quality data will appear once arguments are AI-scored." icon={BarChart2} /> : (
            <div className="space-y-2">
              <AnimatePresence>{visibleCategories.map((cat,i)=>(<motion.div key={cat.category} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}><CategoryRow cat={cat} /></motion.div>))}</AnimatePresence>
              {data.by_category.length > 5 && <button onClick={()=>setShowAll(v=>!v)} className="w-full py-2.5 rounded-xl border border-surface-300/60 text-[12px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors">{showAll ? 'Show less' : `Show all ${data.by_category.length} categories`}</button>}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">Healthiest Debates</h2>
            <Link href="/arguments/top-scored" className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors">Top arguments<ChevronRight className="h-3 w-3" /></Link>
          </div>
          {visibleTopics.length === 0 ? <EmptyState title="No topic data yet" description="Topics will appear here as arguments accumulate AI scores." icon={Scale} /> : (
            <div className="space-y-3">{visibleTopics.map((topic,i)=>(<motion.div key={topic.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.1+i*0.05}}><TopicCard topic={topic} /></motion.div>))}</div>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-surface-300/30 flex flex-wrap gap-3">
          <Link href="/analytics/arguments" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"><BookOpen className="h-3.5 w-3.5" />Argument Portfolio</Link>
          <Link href="/analytics/sentiment" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"><Flame className="h-3.5 w-3.5" />Sentiment</Link>
          <Link href="/arguments/top-scored" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"><Sparkles className="h-3.5 w-3.5" />Top Scored</Link>
          <Link href="/analytics" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors"><BarChart2 className="h-3.5 w-3.5" />All Analytics</Link>
        </div>
      </main><BottomNav /></div>
  )
}
