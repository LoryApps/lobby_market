'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  Mic,
  RefreshCw,
  Scale,
  Share2,
  Swords,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SeriesDetailResponse, SeriesDebate } from '@/app/api/debate-series/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}


function formatLabel(format: string): string {
  const map: Record<string, string> = {
    best_of_3: 'Best of 3',
    best_of_5: 'Best of 5',
    best_of_7: 'Best of 7',
    fixed: 'Fixed',
  }
  return map[format] ?? format
}

// ─── Score pips ───────────────────────────────────────────────────────────────

function ScorePips({ blueWins, redWins, format }: {
  blueWins: number
  redWins: number
  format: string
}) {
  const total = format === 'best_of_3' ? 3 : format === 'best_of_5' ? 5 : format === 'best_of_7' ? 7 : blueWins + redWins
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const isBlue = i < blueWins
        const isRed = i >= total - redWins && redWins > 0
        return (
          <motion.span
            key={i}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'w-4 h-4 rounded-full border-2 transition-all',
              isBlue && 'bg-for-500 border-for-400 shadow-sm shadow-for-500/30',
              isRed && 'bg-against-500 border-against-400 shadow-sm shadow-against-500/30',
              !isBlue && !isRed && 'bg-transparent border-surface-500/40',
            )}
          />
        )
      })}
    </div>
  )
}

// ─── Round card ───────────────────────────────────────────────────────────────

function RoundCard({ debate, roundNum }: { debate: SeriesDebate; roundNum: number }) {
  const isLive = debate.status === 'live'
  const isEnded = debate.status === 'ended'
  const isScheduled = debate.status === 'scheduled'

  const blueSpeaker = debate.speakers?.blue
  const redSpeaker = debate.speakers?.red

  const winner = debate.winner_side

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: roundNum * 0.07 }}
    >
      <Link href={`/debate/${debate.id}`} className="group block">
        <div className={cn(
          'rounded-xl border transition-all p-4',
          isLive && 'border-gold/40 bg-gold/5 hover:border-gold/60',
          isEnded && 'border-surface-300/60 bg-surface-100 hover:border-surface-400',
          isScheduled && 'border-surface-300 bg-surface-100/50 hover:border-surface-400',
        )}>
          {/* Round label + status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-surface-500 uppercase tracking-wider">
                Round {roundNum}
              </span>
              {isLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/15 text-gold border border-gold/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                  LIVE
                </span>
              )}
              {isEnded && winner && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                  winner === 'blue'
                    ? 'bg-for-500/15 text-for-400 border-for-500/30'
                    : 'bg-against-500/15 text-against-400 border-against-500/30',
                )}>
                  <Crown className="h-3 w-3" />
                  {winner === 'blue' ? 'FOR wins' : 'AGAINST wins'}
                </span>
              )}
              {isScheduled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-surface-500 border border-surface-500/30 bg-surface-200/50">
                  <Clock className="h-3 w-3" />
                  {debate.scheduled_at ? formatDate(debate.scheduled_at) : 'Scheduled'}
                </span>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-300 transition-colors" />
          </div>

          {/* Title */}
          <p className="text-sm font-medium text-surface-800 group-hover:text-surface-900 transition-colors mb-3 leading-snug">
            {debate.title}
          </p>

          {/* Speakers vs */}
          <div className="flex items-center gap-3">
            {/* FOR speaker */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {blueSpeaker?.profile ? (
                <>
                  <Avatar
                    src={(blueSpeaker.profile as { avatar_url?: string | null }).avatar_url ?? null}
                    username={(blueSpeaker.profile as { username: string }).username}
                    size="xs"
                  />
                  <span className="text-xs text-for-400 font-mono truncate">
                    {(blueSpeaker.profile as { display_name: string | null; username: string }).display_name ?? (blueSpeaker.profile as { username: string }).username}
                  </span>
                </>
              ) : (
                <span className="text-xs text-surface-600 font-mono">TBD</span>
              )}
            </div>

            {/* vs divider + sway */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              {isEnded ? (
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-for-400 font-bold">{debate.blue_sway ?? 50}%</span>
                  <span className="text-surface-600">vs</span>
                  <span className="text-against-400 font-bold">{debate.red_sway ?? 50}%</span>
                </div>
              ) : (
                <Scale className="h-3.5 w-3.5 text-surface-600" />
              )}
            </div>

            {/* AGAINST speaker */}
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              {redSpeaker?.profile ? (
                <>
                  <span className="text-xs text-against-400 font-mono truncate text-right">
                    {(redSpeaker.profile as { display_name: string | null; username: string }).display_name ?? (redSpeaker.profile as { username: string }).username}
                  </span>
                  <Avatar
                    src={(redSpeaker.profile as { avatar_url?: string | null }).avatar_url ?? null}
                    username={(redSpeaker.profile as { username: string }).username}
                    size="xs"
                  />
                </>
              ) : (
                <span className="text-xs text-surface-600 font-mono">TBD</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="rounded-2xl border border-surface-300 p-5 space-y-4">
        <div className="flex justify-between">
          <div className="text-center space-y-1">
            <Skeleton className="h-12 w-10 mx-auto" />
            <Skeleton className="h-3 w-8 mx-auto" />
          </div>
          <Skeleton className="h-5 w-24 self-center" />
          <div className="text-center space-y-1">
            <Skeleton className="h-12 w-10 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        </div>
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Share button ─────────────────────────────────────────────────────────────

function SeriesShareButton({ title, score }: { title: string; score: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = `${title} — ${score} · Lobby Market`

    if (typeof window !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: text, url })
        return
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // best-effort
    }
  }, [title, score])

  return (
    <button
      onClick={handleShare}
      aria-label="Share this series"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-surface-500 hover:text-surface-300 border border-surface-500/20 bg-surface-200/30 hover:bg-surface-200/60 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald" /> : <Share2 className="h-3 w-3" />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DebateSeriesDetailClient({ seriesId }: { seriesId: string }) {
  const [data, setData] = useState<SeriesDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/debate-series/${seriesId}`)
      if (!res.ok) return
      const json = (await res.json()) as SeriesDetailResponse
      setData(json)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [seriesId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24">
          <Link href="/debate/series" className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 mb-5 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> All Series
          </Link>
          <DetailSkeleton />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <p className="text-surface-500">Series not found.</p>
      </div>
    )
  }

  const { series, debates, next_debate, rounds_needed_to_win } = data
  const isComplete = series.status === 'completed'
  const isLead = series.blue_wins > series.red_wins ? 'blue' : series.red_wins > series.blue_wins ? 'red' : null
  const blueNeeds = Math.max(0, rounds_needed_to_win - series.blue_wins)
  const redNeeds = Math.max(0, rounds_needed_to_win - series.red_wins)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-surface-500 mb-5">
          <Link href="/debate" className="hover:text-surface-300 transition-colors">Debates</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/debate/series" className="hover:text-surface-300 transition-colors">Series</Link>
        </div>

        {/* Series header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              isComplete
                ? 'text-emerald border-emerald/30 bg-emerald/10'
                : 'text-gold border-gold/30 bg-gold/10',
            )}>
              {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
              {isComplete ? 'Series Complete' : 'Ongoing'}
            </span>
            <span className="text-[10px] font-mono text-surface-500 border border-surface-500/30 bg-surface-200/50 px-2 py-0.5 rounded-full">
              {formatLabel(series.format)}
            </span>
            <SeriesShareButton title={series.title} score={`${series.blue_wins}–${series.red_wins}`} />
          </div>
          <h1 className="text-2xl font-black text-surface-900 mb-1">{series.title}</h1>
          {series.description && (
            <p className="text-sm text-surface-500">{series.description}</p>
          )}
          {series.topic && (
            <Link
              href={`/topic/${series.topic.id}`}
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-surface-500 hover:text-for-400 transition-colors"
            >
              <Scale className="h-3 w-3" />
              {series.topic.statement}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Score board */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            {/* Blue side */}
            <div className="text-center flex-1">
              <div className={cn(
                'text-5xl font-black leading-none mb-1 transition-colors',
                isComplete && series.winner_side === 'blue' ? 'text-for-300' : 'text-for-400',
              )}>
                {series.blue_wins}
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">FOR</div>
              {!isComplete && (
                <div className="text-[9px] font-mono text-surface-600 mt-0.5">
                  needs {blueNeeds} more
                </div>
              )}
            </div>

            {/* Center */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0 px-4">
              <Swords className={cn(
                'h-6 w-6',
                isComplete ? 'text-surface-600' : 'text-surface-500',
              )} />
              <ScorePips
                blueWins={series.blue_wins}
                redWins={series.red_wins}
                format={series.format}
              />
              {isComplete && series.winner_side && (
                <div className={cn(
                  'flex items-center gap-1 text-[10px] font-mono font-bold',
                  series.winner_side === 'blue' ? 'text-for-300' : 'text-against-300',
                )}>
                  <Crown className="h-3 w-3" />
                  {series.winner_side === 'blue' ? 'FOR wins the series' : 'AGAINST wins the series'}
                </div>
              )}
              {!isComplete && isLead && (
                <div className={cn(
                  'text-[9px] font-mono',
                  isLead === 'blue' ? 'text-for-500' : 'text-against-500',
                )}>
                  {isLead === 'blue' ? 'FOR leads' : 'AGAINST leads'}
                </div>
              )}
            </div>

            {/* Red side */}
            <div className="text-center flex-1">
              <div className={cn(
                'text-5xl font-black leading-none mb-1 transition-colors',
                isComplete && series.winner_side === 'red' ? 'text-against-300' : 'text-against-400',
              )}>
                {series.red_wins}
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">AGAINST</div>
              {!isComplete && (
                <div className="text-[9px] font-mono text-surface-600 mt-0.5">
                  needs {redNeeds} more
                </div>
              )}
            </div>
          </div>

          {/* Next debate CTA */}
          {next_debate && (
            <Link href={`/debate/${next_debate.id}`}>
              <div className={cn(
                'mt-2 rounded-xl border p-3 flex items-center justify-between transition-all hover:opacity-90',
                next_debate.status === 'live'
                  ? 'bg-gold/10 border-gold/30'
                  : 'bg-surface-200/50 border-surface-400/50',
              )}>
                <div className="flex items-center gap-2">
                  {next_debate.status === 'live' ? (
                    <Mic className="h-4 w-4 text-gold animate-pulse" />
                  ) : (
                    <CalendarDays className="h-4 w-4 text-surface-500" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-surface-800">
                      {next_debate.status === 'live' ? 'Live now' : 'Next debate'}
                    </div>
                    <div className="text-[11px] text-surface-500 truncate max-w-[200px]">
                      {next_debate.title}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500" />
              </div>
            </Link>
          )}
        </motion.div>

        {/* Rounds */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">
            Rounds ({debates.length})
          </h2>
          <button
            onClick={load}
            className="text-xs text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        {debates.length === 0 ? (
          <div className="rounded-xl border border-surface-300 bg-surface-100/50 p-6 text-center">
            <Mic className="h-8 w-8 text-surface-600 mx-auto mb-2" />
            <p className="text-sm text-surface-500">No debates scheduled yet.</p>
            <p className="text-xs text-surface-600 mt-1">
              Debates linked to this series will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {debates.map((d, i) => (
              <RoundCard key={d.id} debate={d} roundNum={d.series_round ?? i + 1} />
            ))}
          </div>
        )}

        {/* Creator info */}
        {series.creator && (
          <div className="mt-6 pt-4 border-t border-surface-300 flex items-center gap-2 text-xs text-surface-500">
            <Avatar
              src={series.creator.avatar_url}
              username={series.creator.username}
              size="xs"
            />
            <span>Series created by</span>
            <Link href={`/profile/${series.creator.username}`} className="text-surface-400 hover:text-surface-300 transition-colors font-medium">
              {series.creator.display_name ?? series.creator.username}
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
