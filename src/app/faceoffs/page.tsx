'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FaceoffLeaderboardResponse, FaceoffArgument } from '@/app/api/faceoffs/route'
import type { MatchupResponse, MatchupArgument } from '@/app/api/faceoffs/matchup/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────

const SIDE_CONFIG = {
  blue: {
    label: 'FOR',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    hoverBg: 'hover:bg-for-500/20',
    hoverBorder: 'hover:border-for-500/60',
    activeBg: 'bg-for-500/20',
    activeBorder: 'border-for-500',
    icon: ThumbsUp,
    chosenBg: 'bg-for-600',
    badge: 'for' as const,
  },
  red: {
    label: 'AGAINST',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    hoverBg: 'hover:bg-against-500/20',
    hoverBorder: 'hover:border-against-500/60',
    activeBg: 'bg-against-500/20',
    activeBorder: 'border-against-500',
    icon: ThumbsDown,
    chosenBg: 'bg-against-600',
    badge: 'against' as const,
  },
}

// ─── Topic Picker ──────────────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number
}

function TopicPicker({ onSelect }: { onSelect: (t: TopicResult) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const url = q.trim()
        ? `/api/search?q=${encodeURIComponent(q)}&tab=topics&limit=8`
        : `/api/topics?status=active&limit=8&sort=votes`
      const res = await fetch(url)
      if (!res.ok) return
      const json = await res.json()
      // Search returns { topics: [...] }, topics endpoint returns { topics: [...] } or an array
      const raw = json.topics ?? json.results ?? json ?? []
      setResults(Array.isArray(raw) ? raw.slice(0, 8) : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, search])

  useEffect(() => { search('') }, [search])

  const statusVariant: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed',
    active: 'active',
    voting: 'active',
    law: 'law',
    failed: 'failed',
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-purple/10 border border-purple/30 mx-auto">
          <Swords className="h-8 w-8 text-purple" />
        </div>
        <h1 className="font-mono text-2xl font-bold text-white">Argument Faceoffs</h1>
        <p className="text-sm font-mono text-surface-500 max-w-xs mx-auto">
          Head-to-head matchups. Pick the most compelling argument.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics…"
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-100 border border-surface-300 text-sm font-mono text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-8 text-surface-500 font-mono text-sm">
          {query ? 'No topics found' : 'Loading topics…'}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:bg-surface-200 hover:border-surface-400 transition-colors text-left group"
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex items-center justify-center">
                  <Swords className="h-3.5 w-3.5 text-purple" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white line-clamp-2 group-hover:text-for-300 transition-colors">
                  {t.statement}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={statusVariant[t.status] ?? 'proposed'} className="text-[10px]">
                    {t.status}
                  </Badge>
                  {t.category && (
                    <span className="text-[10px] font-mono text-surface-500">{t.category}</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1 group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard teaser */}
      <div className="pt-2">
        <LeaderboardPanel />
      </div>
    </div>
  )
}

// ─── Leaderboard Panel ──────────────────────────────────────────────────────────────

function LeaderboardPanel() {
  const [data, setData] = useState<FaceoffLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/faceoffs?limit=10')
      .then((r) => r.json())
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    )
  }

  const entries = data?.entries ?? []
  if (entries.length === 0) return null

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-300">
        <Trophy className="h-4 w-4 text-gold" />
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-surface-400">
          Arena Leaderboard
        </span>
        <span className="text-[10px] font-mono text-surface-600 ml-auto">By wins</span>
      </div>
      <div className="divide-y divide-surface-300">
        {entries.slice(0, 5).map((entry, i) => (
          <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} />
        ))}
      </div>
    </div>
  )
}

function LeaderboardRow({ entry, rank }: { entry: FaceoffArgument; rank: number }) {
  const cfg = SIDE_CONFIG[entry.side]
  const rankConfig = rank === 1
    ? { color: 'text-gold', bg: 'bg-gold/10' }
    : rank === 2
    ? { color: 'text-surface-400', bg: 'bg-surface-300/30' }
    : rank === 3
    ? { color: 'text-amber-600', bg: 'bg-amber-600/10' }
    : { color: 'text-surface-600', bg: 'bg-surface-300/10' }

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className={cn(
        'flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-[11px] font-mono font-bold mt-0.5',
        rankConfig.bg, rankConfig.color
      )}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-surface-300 line-clamp-2">{entry.content}</p>
        {entry.topic && (
          <Link
            href={`/topic/${entry.topic.id}`}
            className="text-[10px] font-mono text-surface-600 hover:text-for-400 transition-colors line-clamp-1 mt-0.5"
          >
            {entry.topic.statement}
          </Link>
        )}
      </div>
      <div className="flex-shrink-0 text-right space-y-0.5">
        <div className={cn('text-xs font-mono font-bold', cfg.color)}>
          {entry.wins}W
        </div>
        {entry.win_pct !== null && (
          <div className="text-[10px] font-mono text-surface-600">{entry.win_pct}%</div>
        )}
      </div>
    </div>
  )
}

// ─── Matchup Card ─────────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  chosen,
  otherChosen,
  onChoose,
  disabled,
}: {
  arg: MatchupArgument
  chosen: boolean
  otherChosen: boolean
  onChoose: () => void
  disabled: boolean
}) {
  const cfg = SIDE_CONFIG[arg.side]
  const Icon = cfg.icon

  return (
    <motion.button
      layout
      onClick={onChoose}
      disabled={disabled || chosen || otherChosen}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
        chosen
          ? cn(cfg.activeBg, cfg.activeBorder, 'ring-1 ring-offset-1 ring-offset-surface-50', `ring-${arg.side === 'blue' ? 'for' : 'against'}-500/50`)
          : otherChosen
          ? 'bg-surface-100/40 border-surface-300/40 opacity-50'
          : cn('bg-surface-100 border-surface-300', cfg.hoverBg, cfg.hoverBorder, 'cursor-pointer'),
        disabled && !chosen && !otherChosen && 'cursor-not-allowed'
      )}
      whileHover={!disabled && !chosen && !otherChosen ? { scale: 1.01 } : {}}
      whileTap={!disabled && !chosen && !otherChosen ? { scale: 0.99 } : {}}
    >
      {/* Side badge */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn('flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider', cfg.color)}>
          <Icon className="h-3.5 w-3.5" />
          {cfg.label}
        </div>
        {chosen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn('flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full', arg.side === 'blue' ? 'bg-for-500 text-white' : 'bg-against-500 text-white')}
          >
            <Zap className="h-3 w-3" />
            CHOSEN
          </motion.div>
        )}
      </div>

      {/* Content */}
      <p className={cn(
        'text-sm font-mono leading-relaxed mb-3',
        chosen ? 'text-white' : otherChosen ? 'text-surface-500' : 'text-surface-200'
      )}>
        {arg.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {arg.author ? (
            <>
              <Avatar
                username={arg.author.username}
                avatarUrl={arg.author.avatar_url}
                size={16}
                className="h-4 w-4"
              />
              <Link
                href={`/profile/${arg.author.username}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'text-[10px] font-mono hover:text-for-400 transition-colors',
                  otherChosen ? 'text-surface-600' : 'text-surface-500'
                )}
              >
                @{arg.author.username}
              </Link>
            </>
          ) : (
            <span className="text-[10px] font-mono text-surface-600">anonymous</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {arg.ai_grade && (
            <span className={cn(
              'text-[10px] font-mono font-bold',
              arg.ai_grade === 'A' ? 'text-emerald' :
              arg.ai_grade === 'B' ? 'text-for-400' :
              arg.ai_grade === 'C' ? 'text-gold' : 'text-surface-500'
            )}>
              {arg.ai_grade}
            </span>
          )}
          {arg.source_url && (
            <a
              href={arg.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-surface-600 hover:text-for-400 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div className={cn('flex items-center gap-0.5 text-[10px] font-mono', otherChosen ? 'text-surface-600' : 'text-surface-500')}>
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes}
          </div>
        </div>
      </div>
    </motion.button>
  )
}

// ─── Arena View ───────────────────────────────────────────────────────────────────

interface TopicState {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
}

type VoteState = 'idle' | 'voting' | 'done' | 'error'

function ArenaView({ topic, onBack }: { topic: TopicState; onBack: () => void }) {
  const [matchup, setMatchup] = useState<MatchupResponse | null>(null)
  const [loadingMatchup, setLoadingMatchup] = useState(true)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [voteState, setVoteState] = useState<VoteState>('idle')
  const [score, setScore] = useState({ wins: 0, total: 0 })
  const [noMore, setNoMore] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchMatchup = useCallback(async () => {
    setLoadingMatchup(true)
    setChosenId(null)
    setVoteState('idle')
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/faceoffs/matchup?topicId=${topic.id}`)
      if (res.status === 404) {
        setNoMore(true)
        setMatchup(null)
        return
      }
      if (!res.ok) throw new Error('Failed to load matchup')
      const data: MatchupResponse = await res.json()
      setMatchup(data)
    } catch {
      setErrorMsg('Failed to load matchup')
    } finally {
      setLoadingMatchup(false)
    }
  }, [topic.id])

  useEffect(() => { fetchMatchup() }, [fetchMatchup])

  const handleChoose = useCallback(async (winnerId: string) => {
    if (!matchup || voteState !== 'idle') return
    setChosenId(winnerId)
    setVoteState('voting')

    try {
      const res = await fetch('/api/faceoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argumentAId: matchup.argA.id,
          argumentBId: matchup.argB.id,
          winnerId,
        }),
      })
      if (res.status === 409) {
        // Already voted — skip to next
        setVoteState('done')
        return
      }
      if (!res.ok) throw new Error('Vote failed')
      setVoteState('done')
      setScore((s) => ({ wins: s.wins + 1, total: s.total + 1 }))
    } catch {
      setVoteState('error')
      setChosenId(null)
    }
  }, [matchup, voteState])

  const handleNext = useCallback(() => {
    if (matchup && matchup.remaining === 0) {
      setNoMore(true)
    } else {
      fetchMatchup()
    }
  }, [fetchMatchup, matchup])

  const statusVariant: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="flex-shrink-0 h-9 w-9 rounded-lg bg-surface-100 border border-surface-300 flex items-center justify-center hover:bg-surface-200 transition-colors mt-0.5"
        >
          <ArrowLeft className="h-4 w-4 text-surface-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={statusVariant[topic.status] ?? 'proposed'} className="text-[10px]">
              {topic.status}
            </Badge>
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
            )}
          </div>
          <p className="text-sm font-mono text-white line-clamp-2">{topic.statement}</p>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
          <Swords className="h-3.5 w-3.5 text-purple" />
          <span className="text-purple font-bold">{score.total}</span>
          <span>matchups judged</span>
        </div>
        {matchup && (
          <div className="text-[10px] font-mono text-surface-600">
            ~{matchup.remaining} remaining
          </div>
        )}
      </div>

      {/* Arena */}
      <AnimatePresence mode="wait">
        {loadingMatchup ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-center gap-3 text-xs font-mono text-surface-500 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple" />
              Loading matchup…
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : noMore ? (
          <motion.div
            key="no-more"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-12 space-y-4"
          >
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gold/10 border border-gold/30 mx-auto">
              <Trophy className="h-8 w-8 text-gold" />
            </div>
            <div>
              <p className="text-white font-mono font-bold text-lg">All matchups judged!</p>
              <p className="text-sm font-mono text-surface-500 mt-1">
                You judged {score.total} argument{score.total !== 1 ? 's' : ''} on this topic.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Pick another topic
            </Button>
          </motion.div>
        ) : errorMsg ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 space-y-3"
          >
            <p className="text-sm font-mono text-against-400">{errorMsg}</p>
            <Button variant="ghost" size="sm" onClick={fetchMatchup} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </motion.div>
        ) : matchup ? (
          <motion.div
            key={`${matchup.argA.id}-${matchup.argB.id}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* VS divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-surface-300" />
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple/10 border border-purple/30">
                <Swords className="h-3 w-3 text-purple" />
                <span className="text-[10px] font-mono font-bold text-purple uppercase tracking-widest">VS</span>
              </div>
              <div className="flex-1 h-px bg-surface-300" />
            </div>

            {/* Argument A */}
            <ArgumentCard
              arg={matchup.argA}
              chosen={chosenId === matchup.argA.id}
              otherChosen={chosenId === matchup.argB.id}
              onChoose={() => handleChoose(matchup.argA.id)}
              disabled={voteState === 'voting'}
            />

            {/* VS mini label */}
            <div className="text-center">
              <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">or</span>
            </div>

            {/* Argument B */}
            <ArgumentCard
              arg={matchup.argB}
              chosen={chosenId === matchup.argB.id}
              otherChosen={chosenId === matchup.argA.id}
              onChoose={() => handleChoose(matchup.argB.id)}
              disabled={voteState === 'voting'}
            />

            {/* Action row */}
            <AnimatePresence>
              {voteState === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-3 pt-1"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald">
                    <Zap className="h-3.5 w-3.5" />
                    Vote recorded
                  </div>
                  <Button
                    variant="for"
                    size="sm"
                    onClick={handleNext}
                    className="gap-2"
                  >
                    Next matchup
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
              {voteState === 'error' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 text-xs font-mono text-against-400"
                >
                  <X className="h-3.5 w-3.5" />
                  Failed to record vote. Try again.
                </motion.div>
              )}
              {voteState === 'voting' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 text-xs font-mono text-surface-500"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recording…
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hint */}
            {voteState === 'idle' && (
              <p className="text-center text-[10px] font-mono text-surface-600 pt-1">
                Tap the argument you find more compelling
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ─── Page Root ────────────────────────────────────────────────────────────────────

export default function FaceoffsPage() {
  const [selectedTopic, setSelectedTopic] = useState<TopicState | null>(null)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <AnimatePresence mode="wait">
          {selectedTopic ? (
            <motion.div
              key={selectedTopic.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
            >
              <ArenaView
                topic={selectedTopic}
                onBack={() => setSelectedTopic(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="picker"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
            >
              <TopicPicker onSelect={setSelectedTopic} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
