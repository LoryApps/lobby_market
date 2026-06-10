/**
 * /debate/[id]/analysis — AI Debate Analysis
 *
 * Post-debate AI breakdown: rhetorical quality, turning points,
 * speaker analysis, fallacy detection, and audience takeaway.
 *
 * Server-rendered. Fetches from /api/debates/[id]/analysis which caches
 * the AI result in debate_analyses after first generation.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Brain,
  ChevronRight,
  Crown,
  ExternalLink,
  Flame,
  MessageSquare,
  Mic,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { DebateAnalysisResponse, SpeakerAnalysis } from '@/app/api/debates/[id]/analysis/route'

interface PageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lobbymarket.app'
  try {
    const res = await fetch(`${base}/api/debates/${params.id}/analysis`, {
      cache: 'no-store',
    })
    if (!res.ok) return { title: 'Debate Analysis · Lobby Market' }
    const data: DebateAnalysisResponse = await res.json()
    return {
      title: `Analysis: ${data.debate.title} · Lobby Market`,
      description: data.analysis.verdict_analysis.slice(0, 155),
      openGraph: {
        title: `Debate Analysis: ${data.debate.title}`,
        description: data.analysis.verdict_analysis.slice(0, 155),
        type: 'article',
        siteName: 'Lobby Market',
      },
    }
  } catch {
    return { title: 'Debate Analysis · Lobby Market' }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function QualityRing({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color =
    score >= 8
      ? 'stroke-emerald'
      : score >= 6
      ? 'stroke-for-400'
      : score >= 4
      ? 'stroke-amber-400'
      : 'stroke-against-400'

  return (
    <div className="relative flex items-center justify-center h-24 w-24">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} strokeWidth="6" className="stroke-surface-300" fill="none" />
        <circle
          cx="48"
          cy="48"
          r={r}
          strokeWidth="6"
          className={color}
          fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <div className="font-mono text-2xl font-bold text-white leading-none">{score}</div>
        <div className="font-mono text-[10px] text-surface-500 mt-0.5">/ 10</div>
      </div>
    </div>
  )
}

function PersuasionBar({ score, side }: { score: number; side: 'for' | 'against' }) {
  const pct = score * 10
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-surface-500 w-20 shrink-0">Persuasion</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            side === 'for' ? 'bg-for-500' : 'bg-against-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-white w-6 text-right">{score}</span>
    </div>
  )
}

function SpeakerCard({
  speaker,
  participant,
}: {
  speaker: SpeakerAnalysis
  participant: { username: string; display_name: string | null; avatar_url: string | null } | null
}) {
  const isFOR = speaker.side === 'for'
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-4',
        isFOR
          ? 'border-for-500/30 bg-for-500/5'
          : 'border-against-500/30 bg-against-500/5',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar
          src={participant?.avatar_url ?? null}
          username={speaker.username}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-white truncate">
              {participant?.display_name ?? speaker.username}
            </span>
            <Badge
              variant={isFOR ? 'for' : 'against'}
              size="sm"
            >
              {isFOR ? 'FOR' : 'AGAINST'}
            </Badge>
          </div>
          <p className="font-mono text-xs text-surface-500 mt-0.5 italic">
            {speaker.rhetorical_style}
          </p>
        </div>
        <div
          className={cn(
            'font-mono text-xl font-bold',
            isFOR ? 'text-for-400' : 'text-against-400',
          )}
        >
          {speaker.persuasion_score}
          <span className="text-xs text-surface-500">/10</span>
        </div>
      </div>

      <PersuasionBar score={speaker.persuasion_score} side={speaker.side} />

      {/* Strongest argument */}
      <div className="rounded-lg bg-surface-200 border border-surface-300 px-3 py-2.5">
        <div
          className={cn(
            'font-mono text-[10px] uppercase tracking-widest mb-1',
            isFOR ? 'text-for-400' : 'text-against-400',
          )}
        >
          Best Argument
        </div>
        <p className="text-sm text-white leading-relaxed font-mono">
          &ldquo;{speaker.strongest_argument}&rdquo;
        </p>
      </div>

      {/* Weakness */}
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            'h-3.5 w-3.5 mt-0.5 shrink-0',
            isFOR ? 'text-for-500/60' : 'text-against-500/60',
          )}
        />
        <p className="font-mono text-xs text-surface-500 leading-relaxed">
          {speaker.main_weakness}
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

async function fetchAnalysis(id: string): Promise<DebateAnalysisResponse | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${base}/api/debates/${id}/analysis`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function DebateAnalysisPage({ params }: PageProps) {
  const data = await fetchAnalysis(params.id)
  if (!data) notFound()

  const { debate, analysis, winner_poll } = data
  const isEnded = debate.status === 'ended'

  const winnerLabel =
    winner_poll && winner_poll.total > 0
      ? winner_poll.blue > winner_poll.red && winner_poll.blue > winner_poll.tie
        ? 'Audience: FOR won'
        : winner_poll.red > winner_poll.blue && winner_poll.red > winner_poll.tie
        ? 'Audience: AGAINST won'
        : 'Audience: Tie'
      : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href={`/debate/${debate.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
          <span className="text-sm font-mono text-surface-400">Analysis</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-purple" />
            <span className="font-mono text-xs text-purple uppercase tracking-widest">
              AI Analysis
            </span>
            {data.cached && (
              <span className="font-mono text-[10px] text-surface-600 ml-auto">cached</span>
            )}
          </div>
          <h1 className="font-mono text-xl font-bold text-white leading-tight mb-1">
            {debate.title}
          </h1>
          {debate.topic && (
            <Link
              href={`/topic/${debate.topic.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              {debate.topic.statement.slice(0, 80)}
              {debate.topic.statement.length > 80 ? '…' : ''}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Not available for live debates */}
        {!isEnded && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-6 text-center mb-8">
            <Zap className="h-6 w-6 text-amber-400 mx-auto mb-2" />
            <p className="font-mono text-sm text-amber-300 font-semibold mb-1">Debate in progress</p>
            <p className="font-mono text-xs text-surface-500">
              AI analysis will be generated once the debate concludes.
            </p>
          </div>
        )}

        {/* Overall quality */}
        {isEnded && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5 flex items-center gap-5">
            <QualityRing score={analysis.overall_quality} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-0.5">
                Debate Quality
              </div>
              <div className="font-mono text-lg font-bold text-white mb-1">
                {analysis.quality_label}
              </div>
              {winnerLabel && (
                <div className="flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-gold" />
                  <span className="font-mono text-xs text-gold">{winnerLabel}</span>
                  {winner_poll && winner_poll.total > 0 && (
                    <span className="font-mono text-xs text-surface-600">
                      ({winner_poll.total} votes)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verdict analysis */}
        {isEnded && analysis.verdict_analysis && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="font-mono text-xs text-gold uppercase tracking-widest">Verdict</span>
            </div>
            <p className="font-mono text-sm text-white leading-relaxed">
              {analysis.verdict_analysis}
            </p>
          </div>
        )}

        {/* Key turning point */}
        {isEnded && analysis.key_turning_point && (
          <div className="rounded-2xl border border-purple/30 bg-purple/5 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-purple" />
              <span className="font-mono text-xs text-purple uppercase tracking-widest">
                Turning Point
              </span>
            </div>
            <p className="font-mono text-sm text-white leading-relaxed">
              {analysis.key_turning_point}
            </p>
          </div>
        )}

        {/* Speaker analysis */}
        {isEnded && (analysis.for_speaker || analysis.against_speaker) && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Mic className="h-4 w-4 text-surface-500" />
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
                Speaker Analysis
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis.for_speaker && (
                <SpeakerCard
                  speaker={analysis.for_speaker}
                  participant={debate.blue_speaker}
                />
              )}
              {analysis.against_speaker && (
                <SpeakerCard
                  speaker={analysis.against_speaker}
                  participant={debate.red_speaker}
                />
              )}
            </div>
          </div>
        )}

        {/* Sway comparison */}
        {isEnded && (debate.blue_sway !== 0 || debate.red_sway !== 0) && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-4 w-4 text-surface-500" />
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
                Opinion Sway
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                  <span className="font-mono text-xs text-for-400 uppercase">FOR</span>
                </div>
                <div
                  className={cn(
                    'font-mono text-2xl font-bold',
                    debate.blue_sway > 0 ? 'text-for-400' : 'text-surface-500',
                  )}
                >
                  {debate.blue_sway > 0 ? `+${debate.blue_sway}` : debate.blue_sway}
                  <span className="text-sm">pp</span>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                  <span className="font-mono text-xs text-against-400 uppercase">AGAINST</span>
                </div>
                <div
                  className={cn(
                    'font-mono text-2xl font-bold',
                    debate.red_sway > 0 ? 'text-against-400' : 'text-surface-500',
                  )}
                >
                  {debate.red_sway > 0 ? `+${debate.red_sway}` : debate.red_sway}
                  <span className="text-sm">pp</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key exchanges */}
        {isEnded && analysis.key_exchanges.length > 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-surface-500" />
              <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
                Key Exchanges
              </span>
            </div>
            <ul className="space-y-2">
              {analysis.key_exchanges.map((ex, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-surface-600 mt-0.5 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="font-mono text-sm text-surface-400 leading-relaxed">
                    {ex.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fallacies */}
        {isEnded && analysis.fallacies.length > 0 && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="font-mono text-xs text-amber-400 uppercase tracking-widest">
                Fallacies Detected
              </span>
            </div>
            <ul className="space-y-2">
              {analysis.fallacies.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 shrink-0">
                    {f.type}
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-surface-400">by </span>
                    <span className="font-mono text-xs text-white">{f.by}</span>
                    <span className="font-mono text-xs text-surface-500"> — {f.example}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Audience takeaway + Intellectual honesty */}
        {isEnded && (analysis.audience_takeaway || analysis.intellectual_honesty) && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-5 space-y-3">
            {analysis.audience_takeaway && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1">
                  Audience Takeaway
                </div>
                <p className="font-mono text-sm text-white leading-relaxed">
                  {analysis.audience_takeaway}
                </p>
              </div>
            )}
            {analysis.intellectual_honesty && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1">
                  Epistemic Quality
                </div>
                <p className="font-mono text-sm text-surface-400 leading-relaxed">
                  {analysis.intellectual_honesty}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Unavailable notice */}
        {analysis.unavailable && isEnded && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 px-5 py-4 mb-5">
            <p className="font-mono text-xs text-surface-500 text-center">
              Full AI analysis is temporarily unavailable. Check back shortly.
            </p>
          </div>
        )}

        {/* Navigation to other debate pages */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-surface-500" />
            <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
              More from this debate
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Highlights', href: `/debate/${debate.id}/highlights`, icon: Flame },
              { label: 'Performance', href: `/debate/${debate.id}/performance`, icon: BarChart2 },
              { label: 'Transcript', href: `/debate/${debate.id}/transcript`, icon: MessageSquare },
              { label: 'Verdict', href: `/debate/${debate.id}/verdict`, icon: Crown },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" />
                  <span className="font-mono text-xs text-surface-400 group-hover:text-white transition-colors">
                    {label}
                  </span>
                </div>
                <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
