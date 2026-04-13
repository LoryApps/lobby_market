'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Trophy,
  MessageSquare,
  Users,
  Clock,
  Flame,
  Share2,
  Minus,
} from 'lucide-react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfettiBurst } from '@/components/simulation/ConfettiBurst'
import type {
  DebateWithTopic,
  DebateParticipantWithProfile,
} from '@/lib/supabase/types'

interface TopMessage {
  id: string
  content: string
  side: 'blue' | 'red' | null
  upvotes: number
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

interface MessageStats {
  blue: number
  red: number
  neutral: number
  total: number
}

interface DebateRecapProps {
  debate: DebateWithTopic
  blueSpeaker: DebateParticipantWithProfile | null
  redSpeaker: DebateParticipantWithProfile | null
  topMessages: TopMessage[]
  reactionCounts: Record<string, number>
  messageStats: MessageStats
  totalParticipants: number
}

const TYPE_LABEL: Record<string, string> = {
  quick: '15m Quick',
  grand: '45m Grand',
  tribunal: '60m Tribunal',
}

function formatDuration(startedAt: string, endedAt: string): string {
  const secs = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  )
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function handleShare(debate: DebateWithTopic) {
  const url = `${window.location.origin}/debate/${debate.id}/recap`
  if (navigator.share) {
    navigator.share({ title: debate.title, url }).catch(() => null)
  } else {
    navigator.clipboard.writeText(url).catch(() => null)
  }
}

export function DebateRecap({
  debate,
  blueSpeaker,
  redSpeaker,
  topMessages,
  reactionCounts,
  messageStats,
  totalParticipants,
}: DebateRecapProps) {
  const [confettiTrigger, setConfettiTrigger] = useState(0)

  const winner: 'blue' | 'red' | 'draw' =
    debate.blue_sway > debate.red_sway
      ? 'blue'
      : debate.red_sway > debate.blue_sway
        ? 'red'
        : 'draw'

  const winnerLabel =
    winner === 'blue'
      ? 'FOR Wins'
      : winner === 'red'
        ? 'AGAINST Wins'
        : 'Draw'

  const winnerColor =
    winner === 'blue'
      ? 'text-for-400'
      : winner === 'red'
        ? 'text-against-400'
        : 'text-gold'

  const winnerBorder =
    winner === 'blue'
      ? 'border-for-600/40'
      : winner === 'red'
        ? 'border-against-600/40'
        : 'border-gold/40'

  const topReactions = Object.entries(reactionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)

  const duration =
    debate.started_at && debate.ended_at
      ? formatDuration(debate.started_at, debate.ended_at)
      : TYPE_LABEL[debate.type] ?? debate.type

  useEffect(() => {
    if (winner !== 'draw') {
      const t = setTimeout(() => setConfettiTrigger(1), 600)
      return () => clearTimeout(t)
    }
  }, [winner])

  const fadeUp = (delayIndex: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: delayIndex * 0.1 + 0.3, duration: 0.4 },
  })

  return (
    <div className="min-h-screen bg-surface-0 text-white pb-16">
      {winner !== 'draw' && (
        <ConfettiBurst trigger={confettiTrigger} side={winner} />
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface-0/90 backdrop-blur-md border-b border-surface-200/20 px-4 py-3 flex items-center gap-3">
        <Link href={`/debate/${debate.id}`}>
          <button
            className="h-9 w-9 rounded-full bg-surface-100 border border-surface-300 flex items-center justify-center hover:bg-surface-200 transition-colors"
            aria-label="Back to debate"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            Debate Recap · {TYPE_LABEL[debate.type] ?? debate.type}
          </p>
          <h1 className="text-sm font-semibold text-white truncate leading-tight">
            {debate.title}
          </h1>
        </div>
        <button
          onClick={() => handleShare(debate)}
          className="h-9 w-9 rounded-full bg-surface-100 border border-surface-300 flex items-center justify-center hover:bg-surface-200 transition-colors"
          aria-label="Share recap"
        >
          <Share2 className="h-4 w-4 text-surface-400" />
        </button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
        {/* ── Winner Banner ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`relative overflow-hidden text-center py-10 rounded-2xl bg-surface-100 border ${winnerBorder}`}
        >
          {/* subtle glow backdrop */}
          <div
            className={`absolute inset-0 opacity-10 ${
              winner === 'blue'
                ? 'bg-gradient-radial from-for-500'
                : winner === 'red'
                  ? 'bg-gradient-radial from-against-500'
                  : 'bg-gradient-radial from-gold'
            }`}
          />
          <div className="relative">
            {winner === 'draw' ? (
              <Minus className="w-10 h-10 mx-auto mb-3 text-gold" />
            ) : (
              <Trophy className={`w-10 h-10 mx-auto mb-3 ${winnerColor}`} />
            )}
            <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-1">
              Audience verdict
            </p>
            <h2
              className={`text-4xl font-black tracking-tight leading-none ${winnerColor}`}
            >
              {winnerLabel.toUpperCase()}
            </h2>
            {debate.topic?.statement && (
              <p className="mt-3 text-xs text-surface-500 max-w-xs mx-auto leading-relaxed px-4 line-clamp-2">
                {debate.topic.statement}
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Final Sway ── */}
        <motion.div
          {...fadeUp(1)}
          className="bg-surface-100 rounded-xl p-5 border border-surface-200/20"
        >
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4">
            Final audience sway
          </p>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 text-center">
              <span className="text-3xl font-black text-for-400">
                {debate.blue_sway}%
              </span>
              <p className="text-[11px] font-mono text-for-600 mt-0.5">FOR</p>
            </div>
            <div className="w-px bg-surface-200/30 self-stretch" />
            <div className="flex-1 text-center">
              <span className="text-3xl font-black text-against-400">
                {debate.red_sway}%
              </span>
              <p className="text-[11px] font-mono text-against-600 mt-0.5">
                AGAINST
              </p>
            </div>
          </div>
          {/* Animated sway bar */}
          <div className="h-3 rounded-full bg-surface-200/40 overflow-hidden flex">
            <motion.div
              className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
              initial={{ width: '50%' }}
              animate={{ width: `${debate.blue_sway}%` }}
              transition={{ delay: 0.7, duration: 1.2, ease: 'easeOut' }}
            />
            <motion.div
              className="h-full bg-gradient-to-l from-against-700 to-against-500 rounded-r-full"
              initial={{ width: '50%' }}
              animate={{ width: `${debate.red_sway}%` }}
              transition={{ delay: 0.7, duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </motion.div>

        {/* ── Speakers ── */}
        <motion.div
          {...fadeUp(2)}
          className="grid grid-cols-2 gap-3"
        >
          {(
            [
              {
                speaker: blueSpeaker,
                label: 'FOR',
                side: 'blue' as const,
                borderColor: 'border-for-600/40',
                bgColor: 'bg-for-950/20',
                textColor: 'text-for-400',
                msgCount: messageStats.blue,
                isWinner: winner === 'blue',
              },
              {
                speaker: redSpeaker,
                label: 'AGAINST',
                side: 'red' as const,
                borderColor: 'border-against-600/40',
                bgColor: 'bg-against-950/20',
                textColor: 'text-against-400',
                msgCount: messageStats.red,
                isWinner: winner === 'red',
              },
            ] as const
          ).map(({ speaker, label, borderColor, bgColor, textColor, msgCount, isWinner }) => (
            <div
              key={label}
              className={`rounded-xl p-4 border ${borderColor} ${bgColor} relative`}
            >
              {isWinner && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gold text-black">
                    WINNER
                  </span>
                </div>
              )}
              <p className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-3 ${textColor}`}>
                {label}
              </p>
              {speaker?.profile ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar
                      src={speaker.profile.avatar_url}
                      fallback={
                        speaker.profile.display_name ?? speaker.profile.username
                      }
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">
                        {speaker.profile.display_name ?? speaker.profile.username}
                      </p>
                      <p className="text-[11px] text-surface-500 truncate">
                        @{speaker.profile.username}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-surface-500 font-mono">
                    <MessageSquare className="w-3 h-3" />
                    <span>{msgCount} msgs</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-surface-600 italic">No speaker</p>
              )}
            </div>
          ))}
        </motion.div>

        {/* ── Stats Row ── */}
        <motion.div
          {...fadeUp(3)}
          className="grid grid-cols-3 gap-3"
        >
          {[
            {
              icon: MessageSquare,
              label: 'Messages',
              value: messageStats.total,
            },
            { icon: Users, label: 'Participants', value: totalParticipants },
            { icon: Clock, label: 'Duration', value: duration },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="bg-surface-100 rounded-xl p-4 border border-surface-200/20 text-center"
            >
              <Icon className="w-4 h-4 text-surface-500 mx-auto mb-1.5" />
              <p className="text-base font-bold tabular-nums leading-tight">
                {value}
              </p>
              <p className="text-[11px] text-surface-500 font-mono mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* ── Top Arguments ── */}
        {topMessages.length > 0 && (
          <motion.div
            {...fadeUp(4)}
            className="bg-surface-100 rounded-xl p-5 border border-surface-200/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-gold" />
              <p className="text-sm font-semibold">Top Arguments</p>
            </div>
            <ol className="space-y-4">
              {topMessages.map((msg, i) => (
                <li key={msg.id} className="flex gap-3 items-start">
                  <span className="font-mono text-[11px] text-surface-600 w-4 shrink-0 pt-0.5 text-right">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 leading-relaxed">
                      {msg.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {msg.author && (
                        <span className="text-[11px] text-surface-500 font-mono">
                          @{msg.author.username}
                        </span>
                      )}
                      {msg.upvotes > 0 && (
                        <span className="text-[11px] text-gold font-mono">
                          +{msg.upvotes} upvotes
                        </span>
                      )}
                      {msg.side && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            msg.side === 'blue'
                              ? 'bg-for-900/60 text-for-400'
                              : 'bg-against-900/60 text-against-400'
                          }`}
                        >
                          {msg.side === 'blue' ? 'FOR' : 'AGAINST'}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </motion.div>
        )}

        {/* ── Crowd Reactions ── */}
        {topReactions.length > 0 && (
          <motion.div
            {...fadeUp(5)}
            className="bg-surface-100 rounded-xl p-5 border border-surface-200/20"
          >
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4">
              Crowd reactions
            </p>
            <div className="flex flex-wrap gap-2">
              {topReactions.map(([emoji, count]) => (
                <div
                  key={emoji}
                  className="flex items-center gap-1.5 bg-surface-200/30 rounded-full px-3 py-1.5"
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  <span className="text-sm font-bold tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── CTA ── */}
        <motion.div
          {...fadeUp(6)}
          className="flex gap-3 pt-2"
        >
          {debate.topic_id && (
            <Link href={`/topic/${debate.topic_id}`} className="flex-1">
              <Button variant="for" size="lg" className="w-full">
                View Topic
              </Button>
            </Link>
          )}
          <Link href="/debate" className="flex-1">
            <Button variant="ghost" size="lg" className="w-full">
              All Debates
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
