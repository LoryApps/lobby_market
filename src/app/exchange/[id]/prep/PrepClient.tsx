'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  MessageSquare,
  Network,
  PenLine,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MarketDetail } from '@/app/api/exchange/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}

function priceColor(price: number): string {
  if (price >= 70) return 'text-emerald'
  if (price >= 55) return 'text-for-300'
  if (price <= 30) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function confidenceLabel(price: number): { label: string; color: string; bg: string; border: string } {
  if (price >= 80) return { label: 'Strong Consensus FOR',   color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30'    }
  if (price >= 65) return { label: 'Moderate Lean FOR',      color: 'text-for-300',    bg: 'bg-for-500/10',    border: 'border-for-500/30'    }
  if (price >= 55) return { label: 'Slight Lean FOR',        color: 'text-for-400',    bg: 'bg-for-500/8',     border: 'border-for-500/25'    }
  if (price >= 45) return { label: 'Contested / Toss-Up',    color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30'       }
  if (price >= 35) return { label: 'Slight Lean AGAINST',    color: 'text-against-300',bg: 'bg-against-500/8', border: 'border-against-500/25' }
  if (price >= 20) return { label: 'Moderate Lean AGAINST',  color: 'text-against-300',bg: 'bg-against-500/10',border: 'border-against-500/30' }
  return                 { label: 'Strong Consensus AGAINST',color: 'text-against-400',bg: 'bg-against-600/10',border: 'border-against-600/30' }
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500 bg-surface-300/40 border-surface-500/30',
  active:   'text-for-300 bg-for-500/10 border-for-500/30',
  voting:   'text-gold bg-gold/10 border-gold/30',
  law:      'text-gold bg-gold/15 border-gold/40',
  failed:   'text-against-400 bg-against-500/10 border-against-500/30',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed', active: 'Active', voting: 'Voting',
  law: 'Established Law', failed: 'Failed',
}

// ─── Checklist items ──────────────────────────────────────────────────────────

interface CheckItem {
  id: string
  label: string
  description: string
  link?: { label: string; href: string }
  category: 'fundamental' | 'technical' | 'sentiment' | 'risk'
}

function buildChecklist(id: string): CheckItem[] {
  return [
    // Fundamental
    { id: 'c1', label: 'Read the topic statement carefully', description: 'Understand exactly what a FOR vs AGAINST outcome means. Ambiguity is a risk factor.', category: 'fundamental' },
    { id: 'c2', label: 'Review the top FOR arguments', description: 'What is the strongest case for this passing? Is it well-reasoned and evidenced?', link: { label: 'View arguments →', href: `/exchange/${id}/arguments` }, category: 'fundamental' },
    { id: 'c3', label: 'Review the top AGAINST arguments', description: "What is the strongest case against? Does the opposition have compelling counter-evidence?", link: { label: 'View arguments →', href: `/exchange/${id}/arguments` }, category: 'fundamental' },
    { id: 'c4', label: 'Check the topic wiki for context', description: 'Background on the issue — policy precedents, real-world examples, key facts.', link: { label: 'Open wiki →', href: `/topic/${id}/wiki` }, category: 'fundamental' },
    { id: 'c5', label: 'Read the AI context brief', description: 'What are the real-world implications if FOR wins vs AGAINST wins?', link: { label: 'Context brief →', href: `/topic/${id}/context` }, category: 'fundamental' },
    // Technical
    { id: 't1', label: 'Study the price history chart', description: 'Is this trending up, down, or range-bound? Where are support and resistance levels?', link: { label: 'View chart →', href: `/exchange/${id}/chart` }, category: 'technical' },
    { id: 't2', label: 'Check the 24h and 7-day price change', description: 'Has momentum shifted recently? Sharp moves can signal new information entering the market.', link: { label: 'View momentum →', href: `/exchange/${id}/momentum` }, category: 'technical' },
    { id: 't3', label: 'Review the order book depth', description: 'Where is liquidity concentrated? Thin books around key price levels can cause slippage.', link: { label: 'Order book →', href: `/exchange/${id}/orderbook` }, category: 'technical' },
    { id: 't4', label: 'Examine volume trend', description: 'Rising volume on price moves confirms conviction. Low volume breakouts are less reliable.', link: { label: 'Flow analysis →', href: `/exchange/${id}/flow` }, category: 'technical' },
    // Sentiment
    { id: 's1', label: 'Check the crowd intelligence', description: 'How are heavy-hitters positioned vs the general crowd? Divergence is often informative.', link: { label: 'Crowd intel →', href: `/exchange/${id}/crowd` }, category: 'sentiment' },
    { id: 's2', label: 'Review coalition stances', description: 'Which organised groups have taken formal positions? Follow large, well-informed coalitions.', link: { label: 'Coalitions →', href: `/exchange/${id}/coalitions` }, category: 'sentiment' },
    { id: 's3', label: 'Read the sentiment analysis', description: 'Is argument-based sentiment aligned with or diverging from the price? Divergence = alpha.', link: { label: 'Sentiment →', href: `/exchange/${id}/sentiment` }, category: 'sentiment' },
    { id: 's4', label: 'Check the market debate history', description: 'Have live debates been held? What was the outcome? Debate winners often move price.', link: { label: 'Debates →', href: `/exchange/${id}/debates` }, category: 'sentiment' },
    // Risk
    { id: 'r1', label: 'Run the risk assessment', description: 'Understand the six risk dimensions before sizing your position.', link: { label: 'Risk report →', href: `/exchange/${id}/risk` }, category: 'risk' },
    { id: 'r2', label: 'Check time to resolution', description: 'Longer-dated markets have more uncertainty. Earlier-stage topics have higher variance.', category: 'risk' },
    { id: 'r3', label: 'Assess deadlock / toss-up risk', description: 'Markets near 50¢ have binary resolution risk — ensure you can absorb a full reversal.', category: 'risk' },
    { id: 'r4', label: 'Identify correlated markets', description: 'Are other topics moving in the same direction? Correlated exposure multiplies risk.', link: { label: 'Similar markets →', href: `/exchange/${id}/similar` }, category: 'risk' },
  ]
}

const CATEGORY_CONFIG = {
  fundamental: { label: 'Fundamental Research',  color: 'text-for-300',    bg: 'bg-for-500/10',    border: 'border-for-500/25',    icon: BookOpen   },
  technical:   { label: 'Technical Analysis',     color: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/25',     icon: BarChart2  },
  sentiment:   { label: 'Sentiment & Crowd',      color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/25',       icon: Users      },
  risk:        { label: 'Risk Management',         color: 'text-against-300',bg: 'bg-against-500/10',border: 'border-against-500/25',icon: Shield     },
}

// ─── Research links ───────────────────────────────────────────────────────────

function researchLinks(id: string) {
  return [
    { label: 'Price Chart',    href: `/exchange/${id}/chart`,     icon: BarChart2,    color: 'text-purple'     },
    { label: 'Risk Report',    href: `/exchange/${id}/risk`,      icon: Shield,       color: 'text-against-300' },
    { label: 'Crowd Intel',    href: `/exchange/${id}/crowd`,     icon: Users,        color: 'text-gold'       },
    { label: 'Arguments',      href: `/exchange/${id}/arguments`, icon: MessageSquare,color: 'text-for-300'    },
    { label: 'Sentiment',      href: `/exchange/${id}/sentiment`, icon: Sparkles,     color: 'text-purple'     },
    { label: 'Coalitions',     href: `/exchange/${id}/coalitions`,icon: Network,      color: 'text-emerald'    },
    { label: 'Order Book',     href: `/exchange/${id}/orderbook`, icon: Coins,        color: 'text-gold'       },
    { label: 'Topic Context',  href: `/topic/${id}/context`,      icon: Globe,        color: 'text-for-400'    },
    { label: 'Topic Wiki',     href: `/topic/${id}/wiki`,         icon: BookOpen,     color: 'text-surface-400'},
    { label: 'Debates',        href: `/exchange/${id}/debates`,   icon: Zap,          color: 'text-against-300'},
    { label: 'Momentum',       href: `/exchange/${id}/momentum`,  icon: TrendingUp,   color: 'text-emerald'    },
    { label: 'Market Model',   href: `/exchange/${id}/model`,     icon: Brain,        color: 'text-purple'     },
  ]
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PrepSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}

// ─── Notes storage ────────────────────────────────────────────────────────────

const NOTES_KEY = (id: string) => `lm_prep_notes_${id}`
const CHECKS_KEY = (id: string) => `lm_prep_checks_${id}`

function loadNotes(id: string): string {
  try { return localStorage.getItem(NOTES_KEY(id)) ?? '' } catch { return '' }
}
function saveNotes(id: string, v: string): void {
  try { localStorage.setItem(NOTES_KEY(id), v) } catch {}
}
function loadChecks(id: string): Set<string> {
  try {
    const raw = localStorage.getItem(CHECKS_KEY(id))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}
function saveChecks(id: string, s: Set<string>): void {
  try { localStorage.setItem(CHECKS_KEY(id), JSON.stringify([...s])) } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PrepClientProps { id: string }

export function PrepClient({ id }: PrepClientProps) {
  const [market, setMarket] = useState<MarketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notes, setNotes] = useState('')
  const [checks, setChecks] = useState<Set<string>>(new Set())
  const [notesLoaded, setNotesLoaded] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/exchange/${id}`, { cache: 'no-store' })
      if (res.ok) setMarket(await res.json())
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // Load persisted state from localStorage after first paint
  useEffect(() => {
    setNotes(loadNotes(id))
    setChecks(loadChecks(id))
    setNotesLoaded(true)
  }, [id])

  function toggleCheck(itemId: string) {
    setChecks((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      saveChecks(id, next)
      return next
    })
  }

  function handleNotesChange(val: string) {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => saveNotes(id, val), 600)
  }

  const checklist = buildChecklist(id)
  const links = researchLinks(id)
  const totalItems = checklist.length
  const doneItems = checklist.filter((c) => checks.has(c.id)).length
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <PrepSkeleton />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center">
        <TopBar />
        <p className="text-surface-500 font-mono text-sm mt-20">Market not found.</p>
        <BottomNav />
      </div>
    )
  }

  const price = market.price
  const cl = confidenceLabel(price)
  const days = daysUntil(market.voting_ends_at)
  const changeDir = (market.price_change_24h ?? 0) > 0 ? 'up' : (market.price_change_24h ?? 0) < 0 ? 'down' : 'flat'
  const topFor     = market.top_for[0]     ?? null
  const topAgainst = market.top_against[0] ?? null

  // Readiness tier
  let readinessTier: { label: string; color: string; bg: string; border: string }
  if (pct >= 80)      readinessTier = { label: 'Ready to trade',     color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30'    }
  else if (pct >= 50) readinessTier = { label: 'Almost there',       color: 'text-for-300',    bg: 'bg-for-500/10',    border: 'border-for-500/30'    }
  else if (pct >= 25) readinessTier = { label: 'Research in progress',color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30'       }
  else                readinessTier = { label: 'Not yet prepared',    color: 'text-against-300',bg: 'bg-against-500/10',border: 'border-against-500/30' }

  const categories = ['fundamental', 'technical', 'sentiment', 'risk'] as const

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-4">

        {/* ── Back nav ── */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Market
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Header ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
                <Target className="h-4 w-4 text-for-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider">Pre-Trade Prep</p>
                <p className="text-xs font-mono text-surface-400">Research pack · {market.statement.slice(0, 42)}{market.statement.length > 42 ? '…' : ''}</p>
              </div>
            </div>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border flex-shrink-0', STATUS_COLOR[market.status] ?? STATUS_COLOR.proposed)}>
              {STATUS_LABEL[market.status] ?? market.status}
            </span>
          </div>

          <p className="text-white font-mono text-sm font-semibold leading-snug mb-3">{market.statement}</p>

          {/* Price snapshot */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn('text-3xl font-mono font-bold tabular-nums', priceColor(price))}>
              {price}¢
            </div>
            <div className={cn('px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border', cl.bg, cl.border, cl.color)}>
              {cl.label}
            </div>
            {market.price_change_24h !== null && (
              <div className={cn('flex items-center gap-0.5 text-xs font-mono', changeDir === 'up' ? 'text-emerald' : changeDir === 'down' ? 'text-against-400' : 'text-surface-500')}>
                {changeDir === 'up' ? <TrendingUp className="h-3 w-3" /> : changeDir === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                {market.price_change_24h > 0 ? '+' : ''}{market.price_change_24h.toFixed(1)}¢ 24h
              </div>
            )}
          </div>
        </div>

        {/* ── Key stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Volume',     value: fmt(market.volume),   icon: BarChart2, color: 'text-for-300'     },
            { label: 'Views',      value: fmt(market.view_count),icon: Globe,    color: 'text-surface-400' },
            { label: 'High / Low', value: `${market.price_high}¢ / ${market.price_low}¢`, icon: TrendingUp, color: 'text-gold' },
            { label: days !== null ? `${days}d left` : 'No deadline', value: days !== null ? (days === 0 ? 'Closing now' : `${days} days`) : 'Open-ended', icon: Clock, color: days !== null && days <= 7 ? 'text-against-300' : 'text-surface-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={cn('h-3 w-3', color)} />
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-sm font-mono font-bold text-white tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Market signals ── */}
        {(market.is_hot || market.is_closing_soon || market.is_near_law || market.is_deadlocked) && (
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3.5">
            <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2.5">Market Signals</p>
            <div className="flex flex-wrap gap-2">
              {market.is_hot && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-against-500/10 border border-against-500/30 text-against-300 text-xs font-mono font-semibold">
                  <Flame className="h-3 w-3" /> Hot Market
                </div>
              )}
              {market.is_closing_soon && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-semibold">
                  <Clock className="h-3 w-3" /> Closing Soon
                </div>
              )}
              {market.is_near_law && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/15 border border-gold/40 text-gold text-xs font-mono font-semibold">
                  <Gavel className="h-3 w-3" /> Near Law
                </div>
              )}
              {market.is_deadlocked && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-300/40 border border-surface-400/30 text-surface-400 text-xs font-mono font-semibold">
                  <Scale className="h-3 w-3" /> Deadlocked
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bull vs Bear quick summary ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">Top Argument Quick-Scan</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* FOR */}
            <div className="rounded-xl bg-for-500/8 border border-for-500/25 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                <span className="text-[10px] font-mono font-semibold text-for-400 uppercase tracking-wider">Bull Case (FOR)</span>
              </div>
              {topFor ? (
                <p className="text-xs font-mono text-surface-300 leading-relaxed line-clamp-4">{topFor.body}</p>
              ) : (
                <p className="text-xs font-mono text-surface-500 italic">No top FOR argument yet.</p>
              )}
              {topFor && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-for-400/70">↑ {topFor.upvote_count}</span>
                  <span className="text-[10px] font-mono text-surface-600">·</span>
                  <span className="text-[10px] font-mono text-surface-500">@{topFor.author_username}</span>
                </div>
              )}
            </div>
            {/* AGAINST */}
            <div className="rounded-xl bg-against-500/8 border border-against-500/25 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                <span className="text-[10px] font-mono font-semibold text-against-400 uppercase tracking-wider">Bear Case (AGAINST)</span>
              </div>
              {topAgainst ? (
                <p className="text-xs font-mono text-surface-300 leading-relaxed line-clamp-4">{topAgainst.body}</p>
              ) : (
                <p className="text-xs font-mono text-surface-500 italic">No top AGAINST argument yet.</p>
              )}
              {topAgainst && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-against-400/70">↑ {topAgainst.upvote_count}</span>
                  <span className="text-[10px] font-mono text-surface-600">·</span>
                  <span className="text-[10px] font-mono text-surface-500">@{topAgainst.author_username}</span>
                </div>
              )}
            </div>
          </div>
          <Link
            href={`/exchange/${id}/arguments`}
            className="mt-3 flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            View all arguments <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── Due diligence checklist ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          {/* Header with progress */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-mono font-bold text-white">Due Diligence Checklist</p>
              <p className="text-xs font-mono text-surface-500 mt-0.5">{doneItems}/{totalItems} complete</p>
            </div>
            <div className={cn('px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border', readinessTier.color, readinessTier.bg, readinessTier.border)}>
              {readinessTier.label}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-surface-300 rounded-full mb-4 overflow-hidden">
            <motion.div
              className="h-full bg-for-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Checklist by category */}
          <div className="space-y-4">
            {categories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat]
              const Icon = cfg.icon
              const items = checklist.filter((c) => c.category === cat)
              const catDone = items.filter((c) => checks.has(c.id)).length

              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('flex items-center justify-center h-6 w-6 rounded-md border', cfg.bg, cfg.border)}>
                      <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                    </div>
                    <span className={cn('text-xs font-mono font-semibold', cfg.color)}>{cfg.label}</span>
                    <span className="ml-auto text-[10px] font-mono text-surface-500">{catDone}/{items.length}</span>
                  </div>

                  <div className="space-y-1.5 ml-8">
                    {items.map((item) => {
                      const done = checks.has(item.id)
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          className={cn(
                            'flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all',
                            done
                              ? 'bg-surface-200/60 border-surface-300/60 opacity-70'
                              : 'bg-surface-200/30 border-surface-300/40 hover:border-surface-400/60'
                          )}
                          onClick={() => toggleCheck(item.id)}
                          role="checkbox"
                          aria-checked={done}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleCheck(item.id) } }}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald" />
                              : <Circle className="h-4 w-4 text-surface-500" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-xs font-mono font-semibold', done ? 'text-surface-500 line-through' : 'text-white')}>
                              {item.label}
                            </p>
                            <p className="text-[11px] font-mono text-surface-500 mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                            {item.link && (
                              <Link
                                href={item.link.href}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 mt-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                              >
                                {item.link.label} <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Research links grid ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">Deep Research Links</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {links.map(({ label, href, icon: Icon, color }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/70 hover:bg-surface-200 transition-all group"
              >
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors truncate">{label}</span>
                <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors ml-auto flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Pre-trade notes ── */}
        {notesLoaded && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="h-4 w-4 text-surface-400" />
              <p className="text-sm font-mono font-semibold text-white">My Pre-Trade Notes</p>
              <span className="ml-auto text-[10px] font-mono text-surface-600">Saved locally</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Record your thesis, key uncertainties, price targets, or anything you want to remember before committing a position…"
              rows={6}
              className={cn(
                'w-full resize-y rounded-xl bg-surface-200/60 border border-surface-300/60',
                'text-xs font-mono text-white placeholder-surface-500',
                'p-3 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30',
                'transition-all'
              )}
            />
            <p className="mt-1.5 text-[10px] font-mono text-surface-600">
              Notes are saved in your browser — they persist across sessions for this market.
            </p>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/exchange/${id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
          >
            <Coins className="h-4 w-4" />
            View Market & Trade
          </Link>
          <Link
            href={`/exchange/${id}/risk`}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-400 hover:text-white text-sm font-mono font-semibold transition-all"
          >
            <Shield className="h-4 w-4" />
            Risk Report
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
