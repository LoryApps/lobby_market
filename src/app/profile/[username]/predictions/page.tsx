import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  Gavel,
  Mic,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function brierLabel(score: number): { label: string; color: string } {
  if (score <= 0.05) return { label: 'Elite', color: 'text-gold' }
  if (score <= 0.12) return { label: 'Sharp', color: 'text-emerald' }
  if (score <= 0.20) return { label: 'Solid', color: 'text-for-400' }
  if (score <= 0.30) return { label: 'Average', color: 'text-surface-400' }
  return { label: 'Rough', color: 'text-against-400' }
}

function confidencePill(confidence: number, isLaw: boolean) {
  const base = isLaw
    ? 'bg-gold/10 border-gold/30 text-gold'
    : 'bg-against-500/10 border-against-500/30 text-against-400'
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border', base)}>
      {isLaw ? <Gavel className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
      {isLaw ? 'Law' : 'Fail'} · {confidence}%
    </span>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Predictions · Lobby Market' }

  const name = profile.display_name ?? `@${profile.username}`
  const title = `${name}'s Prediction Record · Lobby Market`
  const description = `See every market prediction ${name} has made — accuracy rate, Brier scores, and which topics they called right.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `${BASE_URL}/profile/${profile.username}/predictions`,
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicPrediction {
  id: string
  topic_id: string
  predicted_law: boolean
  confidence: number
  resolved_at: string | null
  correct: boolean | null
  brier_score: number | null
  clout_earned: number
  created_at: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
}

interface DebatePrediction {
  id: string
  debate_id: string
  predicted_winner: string
  predicted_sway: number
  confidence: number
  resolved_at: string | null
  correct_winner: boolean | null
  sway_error: number | null
  clout_earned: number
  created_at: string
  debate_title: string | null
  topic_statement: string | null
}

interface CategoryStat {
  category: string
  total: number
  correct: number
  accuracy: number
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'gold' | 'emerald' | 'for' | 'against' | 'purple'
  icon?: React.ComponentType<{ className?: string }>
}) {
  const colorMap = {
    gold:    'text-gold',
    emerald: 'text-emerald',
    for:     'text-for-400',
    against: 'text-against-400',
    purple:  'text-purple',
  } as const

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={cn('h-3.5 w-3.5', accent ? colorMap[accent] : 'text-surface-500')} />}
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn('text-2xl font-mono font-bold', accent ? colorMap[accent] : 'text-white')}>
        {value}
      </p>
      {sub && <p className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Topic prediction row ──────────────────────────────────────────────────────

function TopicPredictionRow({ p }: { p: TopicPrediction }) {
  const isResolved = p.resolved_at !== null
  const isCorrect = p.correct === true
  const isWrong = p.correct === false

  return (
    <Link
      href={`/topic/${p.topic_id}`}
      className={cn(
        'block rounded-xl border p-4 transition-colors hover:bg-surface-200/50',
        isResolved
          ? isCorrect
            ? 'border-emerald/20 bg-emerald/5'
            : isWrong
            ? 'border-against-500/20 bg-against-500/5'
            : 'border-surface-300 bg-surface-100'
          : 'border-surface-300 bg-surface-100'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Outcome icon */}
        <div className="flex-shrink-0 mt-0.5">
          {!isResolved && <Circle className="h-4 w-4 text-surface-500" />}
          {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald" />}
          {isWrong && <XCircle className="h-4 w-4 text-against-400" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white leading-snug line-clamp-2 mb-2">
            {p.topic_statement}
          </p>

          <div className="flex items-center flex-wrap gap-2">
            {confidencePill(p.confidence, p.predicted_law)}

            {p.topic_category && (
              <span className="text-[10px] font-mono text-surface-600 px-1.5 py-0.5 rounded-md bg-surface-300/40 border border-surface-300/50">
                {p.topic_category}
              </span>
            )}

            {isResolved && p.brier_score !== null && (
              <span className={cn('text-[10px] font-mono', brierLabel(p.brier_score).color)}>
                Brier {p.brier_score.toFixed(3)}
              </span>
            )}

            {isResolved && p.clout_earned > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-gold">
                <Coins className="h-2.5 w-2.5" />
                +{p.clout_earned} clout
              </span>
            )}

            {!isResolved && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Clock className="h-2.5 w-2.5" />
                Pending · {relativeTime(p.created_at)}
              </span>
            )}

            {isResolved && (
              <span className="text-[10px] font-mono text-surface-600">
                {relativeTime(p.resolved_at!)}
              </span>
            )}
          </div>
        </div>

        {/* Actual outcome badge */}
        {isResolved && (
          <div className="flex-shrink-0">
            {p.topic_status === 'law' ? (
              <Badge variant="law"><Gavel className="h-2.5 w-2.5 mr-0.5" />Law</Badge>
            ) : p.topic_status === 'failed' ? (
              <Badge variant="failed">Failed</Badge>
            ) : null}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Debate prediction row ────────────────────────────────────────────────────

function DebatePredictionRow({ p }: { p: DebatePrediction }) {
  const isResolved = p.resolved_at !== null
  const isCorrect = p.correct_winner === true
  const isWrong = p.correct_winner === false

  const winnerLabel = {
    for: 'FOR side',
    against: 'AGAINST side',
    tie: 'Tie',
  }[p.predicted_winner] ?? p.predicted_winner

  const winnerColor = {
    for: 'text-for-400',
    against: 'text-against-400',
    tie: 'text-surface-400',
  }[p.predicted_winner] ?? 'text-surface-400'

  return (
    <Link
      href={`/debate/${p.debate_id}`}
      className={cn(
        'block rounded-xl border p-4 transition-colors hover:bg-surface-200/50',
        isResolved
          ? isCorrect
            ? 'border-emerald/20 bg-emerald/5'
            : isWrong
            ? 'border-against-500/20 bg-against-500/5'
            : 'border-surface-300 bg-surface-100'
          : 'border-surface-300 bg-surface-100'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {!isResolved && <Circle className="h-4 w-4 text-surface-500" />}
          {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald" />}
          {isWrong && <XCircle className="h-4 w-4 text-against-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white leading-snug line-clamp-2 mb-2">
            {p.debate_title ?? p.topic_statement ?? 'Untitled debate'}
          </p>

          <div className="flex items-center flex-wrap gap-2">
            <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full border', winnerColor,
              p.predicted_winner === 'for'
                ? 'bg-for-500/10 border-for-500/30'
                : p.predicted_winner === 'against'
                ? 'bg-against-500/10 border-against-500/30'
                : 'bg-surface-300/20 border-surface-400/20'
            )}>
              <Mic className="h-2.5 w-2.5 inline mr-1" />
              {winnerLabel} · {p.confidence}%
            </span>

            {p.predicted_sway !== 0 && (
              <span className={cn(
                'flex items-center gap-0.5 text-[10px] font-mono',
                p.predicted_sway > 0 ? 'text-for-400' : 'text-against-400'
              )}>
                {p.predicted_sway > 0
                  ? <TrendingUp className="h-2.5 w-2.5" />
                  : <TrendingDown className="h-2.5 w-2.5" />}
                {p.predicted_sway > 0 ? '+' : ''}{p.predicted_sway}pp sway
              </span>
            )}

            {isResolved && p.sway_error !== null && (
              <span className="text-[10px] font-mono text-surface-500">
                Error: {p.sway_error}pp
              </span>
            )}

            {isResolved && p.clout_earned > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-gold">
                <Coins className="h-2.5 w-2.5" />
                +{p.clout_earned} clout
              </span>
            )}

            {!isResolved && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Clock className="h-2.5 w-2.5" />
                Pending · {relativeTime(p.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfilePredictionsPage({ params }: PageProps) {
  const supabase = await createClient()

  // ── Auth check ─────────────────────────────────────────────────────────────
  const { data: { user: viewer } } = await supabase.auth.getUser()

  // ── Profile ────────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  const isOwner = viewer?.id === profile.id
  const displayName = profile.display_name ?? `@${profile.username}`

  // ── Topic predictions ──────────────────────────────────────────────────────
  const { data: rawTopicPreds } = await supabase
    .from('topic_predictions')
    .select(`
      id,
      topic_id,
      predicted_law,
      confidence,
      resolved_at,
      correct,
      brier_score,
      clout_earned,
      created_at,
      topics!inner (
        statement,
        category,
        status
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  type RawTP = {
    id: string
    topic_id: string
    predicted_law: boolean
    confidence: number
    resolved_at: string | null
    correct: boolean | null
    brier_score: number | null
    clout_earned: number
    created_at: string
    topics: { statement: string; category: string | null; status: string } | null
  }

  const topicPreds: TopicPrediction[] = ((rawTopicPreds ?? []) as RawTP[])
    .filter((r) => r.topics)
    .map((r) => ({
      id: r.id,
      topic_id: r.topic_id,
      predicted_law: r.predicted_law,
      confidence: r.confidence,
      resolved_at: r.resolved_at,
      correct: r.correct,
      brier_score: r.brier_score !== null ? Number(r.brier_score) : null,
      clout_earned: r.clout_earned,
      created_at: r.created_at,
      topic_statement: r.topics!.statement,
      topic_category: r.topics!.category,
      topic_status: r.topics!.status,
    }))

  // ── Debate predictions ─────────────────────────────────────────────────────
  const { data: rawDebatePreds } = await supabase
    .from('debate_predictions')
    .select(`
      id,
      debate_id,
      predicted_winner,
      predicted_sway,
      confidence,
      resolved_at,
      correct_winner,
      sway_error,
      clout_earned,
      created_at,
      debates!inner (
        title,
        topic_id,
        topics (
          statement
        )
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  type RawDP = {
    id: string
    debate_id: string
    predicted_winner: string
    predicted_sway: number
    confidence: number
    resolved_at: string | null
    correct_winner: boolean | null
    sway_error: number | null
    clout_earned: number
    created_at: string
    debates: {
      title: string | null
      topic_id: string | null
      topics: { statement: string } | null
    } | null
  }

  const debatePreds: DebatePrediction[] = ((rawDebatePreds ?? []) as RawDP[])
    .filter((r) => r.debates)
    .map((r) => ({
      id: r.id,
      debate_id: r.debate_id,
      predicted_winner: r.predicted_winner,
      predicted_sway: r.predicted_sway,
      confidence: r.confidence,
      resolved_at: r.resolved_at,
      correct_winner: r.correct_winner,
      sway_error: r.sway_error,
      clout_earned: r.clout_earned,
      created_at: r.created_at,
      debate_title: r.debates!.title,
      topic_statement: r.debates!.topics?.statement ?? null,
    }))

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const resolvedTopicPreds = topicPreds.filter((p) => p.resolved_at !== null)
  const correctTopicPreds = resolvedTopicPreds.filter((p) => p.correct === true)
  const topicAccuracy = resolvedTopicPreds.length > 0
    ? Math.round((correctTopicPreds.length / resolvedTopicPreds.length) * 100)
    : null
  const avgBrier = resolvedTopicPreds.length > 0
    ? resolvedTopicPreds.reduce((s, p) => s + (p.brier_score ?? 0), 0) / resolvedTopicPreds.length
    : null
  const totalTopicClout = topicPreds.reduce((s, p) => s + p.clout_earned, 0)

  const resolvedDebatePreds = debatePreds.filter((p) => p.resolved_at !== null)
  const correctDebatePreds = resolvedDebatePreds.filter((p) => p.correct_winner === true)
  const debateAccuracy = resolvedDebatePreds.length > 0
    ? Math.round((correctDebatePreds.length / resolvedDebatePreds.length) * 100)
    : null
  const totalDebateClout = debatePreds.reduce((s, p) => s + p.clout_earned, 0)

  const totalPredictions = topicPreds.length + debatePreds.length
  const totalClout = totalTopicClout + totalDebateClout
  const totalResolved = resolvedTopicPreds.length + resolvedDebatePreds.length
  const totalCorrect = correctTopicPreds.length + correctDebatePreds.length
  const overallAccuracy = totalResolved > 0
    ? Math.round((totalCorrect / totalResolved) * 100)
    : null

  // ── Category breakdown ─────────────────────────────────────────────────────
  const catMap: Record<string, { total: number; correct: number }> = {}
  resolvedTopicPreds.forEach((p) => {
    const cat = p.topic_category ?? 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { total: 0, correct: 0 }
    catMap[cat].total++
    if (p.correct) catMap[cat].correct++
  })
  const categoryStats: CategoryStat[] = Object.entries(catMap)
    .map(([category, s]) => ({
      category,
      total: s.total,
      correct: s.correct,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  // ── Split open vs resolved ─────────────────────────────────────────────────
  const openTopicPreds = topicPreds.filter((p) => !p.resolved_at)
  const resolvedTopicList = topicPreds.filter((p) => p.resolved_at)
  const openDebatePreds = debatePreds.filter((p) => !p.resolved_at)
  const resolvedDebateList = debatePreds.filter((p) => p.resolved_at)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Breadcrumbs ────────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600 mb-5">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href={`/profile/${profile.username}`} className="hover:text-white transition-colors">
            {displayName}
          </Link>
          <span>/</span>
          <span className="text-surface-400">Predictions</span>
        </nav>

        {/* ── Back link ──────────────────────────────────────────────────────── */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-8">
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white mb-0.5">
              {displayName}&apos;s Prediction Record
            </h1>
            <p className="text-sm text-surface-500 font-mono">
              Market calls across topics and debates
            </p>
          </div>

          {/* Overall accuracy badge */}
          {overallAccuracy !== null && (
            <div className={cn(
              'flex-shrink-0 flex flex-col items-center justify-center',
              'w-16 h-16 rounded-2xl border',
              overallAccuracy >= 70
                ? 'bg-emerald/10 border-emerald/30'
                : overallAccuracy >= 50
                ? 'bg-for-500/10 border-for-500/30'
                : 'bg-against-500/10 border-against-500/30'
            )}>
              <span className={cn(
                'font-mono text-xl font-bold',
                overallAccuracy >= 70 ? 'text-emerald' : overallAccuracy >= 50 ? 'text-for-400' : 'text-against-400'
              )}>
                {overallAccuracy}%
              </span>
              <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                Accuracy
              </span>
            </div>
          )}
        </div>

        {/* ── Summary stats ──────────────────────────────────────────────────── */}
        {totalPredictions > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard
                label="Total Predictions"
                value={totalPredictions}
                sub={`${totalResolved} resolved`}
                accent="for"
                icon={Target}
              />
              <StatCard
                label="Correct Calls"
                value={totalResolved > 0 ? totalCorrect : '—'}
                sub={overallAccuracy !== null ? `${overallAccuracy}% accuracy` : 'No resolved yet'}
                accent={overallAccuracy !== null && overallAccuracy >= 60 ? 'emerald' : 'against'}
                icon={CheckCircle2}
              />
              {avgBrier !== null ? (
                <StatCard
                  label="Avg Brier Score"
                  value={avgBrier.toFixed(3)}
                  sub={brierLabel(avgBrier).label}
                  accent={avgBrier <= 0.12 ? 'emerald' : avgBrier <= 0.20 ? 'for' : 'against'}
                  icon={BarChart2}
                />
              ) : (
                <StatCard
                  label="Avg Brier Score"
                  value="—"
                  sub="No resolved predictions"
                  icon={BarChart2}
                />
              )}
              <StatCard
                label="Clout Earned"
                value={totalClout > 0 ? `+${totalClout}` : '0'}
                sub="from accurate calls"
                accent={totalClout > 0 ? 'gold' : undefined}
                icon={Coins}
              />
            </div>

            {/* ── Category breakdown ─────────────────────────────────────────── */}
            {categoryStats.length > 0 && (
              <section className="mb-8">
                <h2 className="font-mono text-xs text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Accuracy by Category
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categoryStats.map((cat) => (
                    <div
                      key={cat.category}
                      className="rounded-xl border border-surface-300 bg-surface-100 p-3"
                    >
                      <p className="text-[10px] font-mono text-surface-500 mb-1 truncate">{cat.category}</p>
                      <div className="flex items-end justify-between">
                        <span className={cn(
                          'font-mono text-lg font-bold',
                          cat.accuracy >= 70 ? 'text-emerald' : cat.accuracy >= 50 ? 'text-for-400' : 'text-against-400'
                        )}>
                          {cat.accuracy}%
                        </span>
                        <span className="text-[10px] font-mono text-surface-600">
                          {cat.correct}/{cat.total}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-surface-300 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            cat.accuracy >= 70 ? 'bg-emerald' : cat.accuracy >= 50 ? 'bg-for-500' : 'bg-against-500'
                          )}
                          style={{ width: `${cat.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Topic predictions ─────────────────────────────────────────── */}
            {topicPreds.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-xs text-surface-500 uppercase tracking-wider flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5" />
                    Topic Predictions
                    <span className="text-surface-600 normal-case tracking-normal">({topicPreds.length})</span>
                  </h2>
                  {topicAccuracy !== null && (
                    <span className={cn(
                      'text-[10px] font-mono',
                      topicAccuracy >= 70 ? 'text-emerald' : topicAccuracy >= 50 ? 'text-for-400' : 'text-against-400'
                    )}>
                      {topicAccuracy}% accurate
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Open predictions first */}
                  {openTopicPreds.length > 0 && (
                    <>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider px-1 mb-1.5">
                        Open ({openTopicPreds.length})
                      </p>
                      {openTopicPreds.map((p) => (
                        <TopicPredictionRow key={p.id} p={p} />
                      ))}
                      {resolvedTopicList.length > 0 && (
                        <div className="border-t border-surface-300 my-3" />
                      )}
                    </>
                  )}

                  {/* Resolved predictions */}
                  {resolvedTopicList.length > 0 && (
                    <>
                      {openTopicPreds.length > 0 && (
                        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider px-1 mb-1.5">
                          Resolved ({resolvedTopicList.length})
                        </p>
                      )}
                      {resolvedTopicList.map((p) => (
                        <TopicPredictionRow key={p.id} p={p} />
                      ))}
                    </>
                  )}
                </div>
              </section>
            )}

            {/* ── Debate predictions ────────────────────────────────────────── */}
            {debatePreds.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-mono text-xs text-surface-500 uppercase tracking-wider flex items-center gap-2">
                    <Mic className="h-3.5 w-3.5" />
                    Debate Predictions
                    <span className="text-surface-600 normal-case tracking-normal">({debatePreds.length})</span>
                  </h2>
                  {debateAccuracy !== null && (
                    <span className={cn(
                      'text-[10px] font-mono',
                      debateAccuracy >= 70 ? 'text-emerald' : debateAccuracy >= 50 ? 'text-for-400' : 'text-against-400'
                    )}>
                      {debateAccuracy}% accurate
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {openDebatePreds.length > 0 && (
                    <>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider px-1 mb-1.5">
                        Open ({openDebatePreds.length})
                      </p>
                      {openDebatePreds.map((p) => (
                        <DebatePredictionRow key={p.id} p={p} />
                      ))}
                      {resolvedDebateList.length > 0 && (
                        <div className="border-t border-surface-300 my-3" />
                      )}
                    </>
                  )}

                  {resolvedDebateList.length > 0 && (
                    <>
                      {openDebatePreds.length > 0 && (
                        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider px-1 mb-1.5">
                          Resolved ({resolvedDebateList.length})
                        </p>
                      )}
                      {resolvedDebateList.map((p) => (
                        <DebatePredictionRow key={p.id} p={p} />
                      ))}
                    </>
                  )}
                </div>
              </section>
            )}

            {/* CTA to predictions market */}
            <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-white font-semibold mb-0.5">Browse the prediction market</p>
                <p className="text-xs font-mono text-surface-500">Stake more calls, track community forecasts</p>
              </div>
              <Link
                href="/predictions"
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold text-xs font-mono font-semibold transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                Open market
              </Link>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="space-y-6">
            <EmptyState
              icon={Target}
              title={isOwner ? 'No predictions yet' : `${displayName} hasn't made any predictions`}
              description={
                isOwner
                  ? 'Stake your first call on whether a topic will become law or a debate will swing opinions.'
                  : "Check back later — this citizen hasn't entered the prediction market yet."
              }
              actions={
                isOwner
                  ? [{ label: 'Browse prediction market', href: '/predictions' }]
                  : undefined
              }
            />

            {/* Callout to predictions */}
            {isOwner && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">Earn clout for accuracy</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">
                      Correct predictions earn clout. Build your forecasting reputation.
                    </p>
                  </div>
                </div>
                <Link
                  href="/predictions"
                  className="block w-full text-center py-2.5 rounded-xl bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold text-sm font-mono font-semibold transition-colors"
                >
                  Enter the market
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
