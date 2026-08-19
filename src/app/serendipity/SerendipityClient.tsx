'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Compass,
  Gavel,
  Loader2,
  MessageSquare,
  Scale,
  Shuffle,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SerendipityData } from '@/app/api/serendipity/route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}yr ago`
}

function truncate(text: string, len: number) {
  if (text.length <= len) return text
  return text.slice(0, len).trimEnd() + '…'
}

// ── Card wrapper ───────────────────────────────────────────────────────────────

interface CardProps {
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  borderColor: string
  children: React.ReactNode
}

function SerendipityCard({ label, icon: Icon, iconColor, borderColor, children }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'relative rounded-2xl border bg-surface-100 overflow-hidden',
        borderColor,
      )}
    >
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b', borderColor, 'bg-surface-200/50')}>
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
        <span className={cn('text-xs font-semibold uppercase tracking-widest', iconColor)}>{label}</span>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300 bg-surface-200/50">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-28 rounded" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SerendipityClient() {
  const router = useRouter()
  const [data, setData] = useState<SerendipityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [shuffling, setShuffling] = useState(false)
  const [key, setKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/serendipity', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      /* silent */
    } finally {
      setLoading(false)
      setShuffling(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const shuffle = useCallback(async () => {
    setShuffling(true)
    setKey(k => k + 1)
    setData(null)
    await load()
  }, [load])

  const { uncharted_topic, contrarian_argument, hidden_law, unexpected_citizen, user_categories } = data ?? {}
  const isLoading = loading || shuffling

  return (
    <div className="flex flex-col min-h-screen bg-surface-950">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 text-surface-400 hover:text-white mb-3 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Back</span>
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Compass className="h-6 w-6 text-purple-400" />
                Civic Serendipity
              </h1>
              <p className="text-sm text-surface-400 mt-1">
                Discover what you&apos;re missing beyond your usual categories
              </p>
            </div>
            <button
              onClick={shuffle}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all shrink-0 mt-8',
                'border-purple-700 text-purple-300 hover:bg-purple-900/30',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {shuffling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shuffle className="h-4 w-4" />
              )}
              {shuffling ? 'Shuffling…' : 'Shuffle'}
            </button>
          </div>

          {/* Echo-chamber meter */}
          {!isLoading && user_categories && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-surface-300 bg-surface-100 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Your Top Categories
                </span>
                <span className={cn(
                  'text-xs font-medium',
                  user_categories.length >= 5 ? 'text-emerald-400' : user_categories.length >= 3 ? 'text-yellow-400' : 'text-against-400'
                )}>
                  {user_categories.length >= 5 ? 'Diverse' : user_categories.length >= 3 ? 'Focused' : 'Narrow'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {user_categories.slice(0, 6).map(cat => (
                  <span
                    key={cat}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-surface-200 text-surface-300 border border-surface-300"
                  >
                    {cat}
                  </span>
                ))}
                {user_categories.length === 0 && (
                  <span className="text-xs text-surface-500">No votes yet — explore to get started</span>
                )}
              </div>
            </motion.div>
          )}

          {/* Cards */}
          <AnimatePresence mode="wait">
            <motion.div key={key} className="space-y-4">

              {/* 1. Uncharted Topic */}
              {isLoading ? (
                <CardSkeleton />
              ) : uncharted_topic ? (
                <SerendipityCard
                  label="Uncharted Territory"
                  icon={Compass}
                  iconColor="text-purple-400"
                  borderColor="border-purple-800/50"
                >
                  <div className="space-y-3">
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-800/50 font-medium">
                      {uncharted_topic.category}
                    </span>
                    <p className="text-white font-medium leading-snug">
                      {truncate(uncharted_topic.statement, 120)}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-surface-400">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                          {Math.round(uncharted_topic.blue_pct ?? 50)}% for
                        </span>
                        <span>{(uncharted_topic.total_votes ?? 0).toLocaleString()} votes</span>
                      </div>
                      <Link
                        href={`/topic/${uncharted_topic.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-purple-300 hover:text-purple-200 transition-colors"
                      >
                        Explore <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </SerendipityCard>
              ) : (
                <SerendipityCard
                  label="Uncharted Territory"
                  icon={Compass}
                  iconColor="text-purple-400"
                  borderColor="border-purple-800/50"
                >
                  <p className="text-sm text-surface-400">
                    You&apos;ve explored widely — no uncharted categories remain. Keep it up!
                  </p>
                </SerendipityCard>
              )}

              {/* 2. Contrarian Argument */}
              {isLoading ? (
                <CardSkeleton />
              ) : contrarian_argument ? (
                <SerendipityCard
                  label="Contrarian Gem"
                  icon={contrarian_argument.side === 'red' ? ThumbsDown : ThumbsUp}
                  iconColor={contrarian_argument.side === 'red' ? 'text-against-400' : 'text-for-400'}
                  borderColor={contrarian_argument.side === 'red' ? 'border-against-800/50' : 'border-for-800/50'}
                >
                  <div className="space-y-3">
                    <p className="text-xs text-surface-500 italic">
                      On: {truncate(contrarian_argument.topic_statement, 80)}
                    </p>
                    <blockquote className="text-sm text-surface-200 leading-relaxed border-l-2 border-surface-500 pl-3">
                      {truncate(contrarian_argument.content, 200)}
                    </blockquote>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={contrarian_argument.author.avatar_url}
                          username={contrarian_argument.author.username}
                          size="xs"
                        />
                        <Link
                          href={`/profile/${contrarian_argument.author.username}`}
                          className="text-xs text-surface-400 hover:text-white transition-colors"
                        >
                          {contrarian_argument.author.display_name ?? contrarian_argument.author.username}
                        </Link>
                        <span className="flex items-center gap-0.5 text-xs text-surface-500">
                          <Zap className="h-3 w-3" />
                          {contrarian_argument.upvotes}
                        </span>
                      </div>
                      <Link
                        href={`/topic/${contrarian_argument.topic_id}/arguments`}
                        className="flex items-center gap-1 text-xs font-medium text-surface-300 hover:text-white transition-colors"
                      >
                        Read more <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </SerendipityCard>
              ) : null}

              {/* 3. Hidden Law */}
              {isLoading ? (
                <CardSkeleton />
              ) : hidden_law ? (
                <SerendipityCard
                  label="Hidden Law"
                  icon={Gavel}
                  iconColor="text-gold"
                  borderColor="border-gold/20"
                >
                  <div className="space-y-3">
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 font-medium">
                      {hidden_law.category}
                    </span>
                    <p className="text-white font-medium leading-snug">
                      {truncate(hidden_law.statement, 120)}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-surface-400">
                        <span className="flex items-center gap-1">
                          <Scale className="h-3.5 w-3.5" />
                          {(hidden_law.total_votes ?? 0).toLocaleString()} votes
                        </span>
                        <span>Established {relTime(hidden_law.established_at)}</span>
                      </div>
                      <Link
                        href={`/law/${hidden_law.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-gold hover:text-yellow-300 transition-colors"
                      >
                        Read law <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </SerendipityCard>
              ) : null}

              {/* 4. Unexpected Citizen */}
              {isLoading ? (
                <CardSkeleton />
              ) : unexpected_citizen ? (
                <SerendipityCard
                  label="Unexpected Voice"
                  icon={Users}
                  iconColor="text-emerald-400"
                  borderColor="border-emerald-800/40"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={unexpected_citizen.avatar_url}
                        username={unexpected_citizen.username}
                        size="md"
                      />
                      <div>
                        <Link
                          href={`/profile/${unexpected_citizen.username}`}
                          className="font-semibold text-white hover:text-emerald-300 transition-colors"
                        >
                          {unexpected_citizen.display_name ?? unexpected_citizen.username}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          {unexpected_citizen.civic_archetype && (
                            <span className="text-xs text-surface-400">
                              {unexpected_citizen.civic_archetype}
                            </span>
                          )}
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full border font-medium',
                            unexpected_citizen.blue_lean
                              ? 'bg-for-900/30 text-for-400 border-for-800/40'
                              : 'bg-against-900/30 text-against-400 border-against-800/40'
                          )}>
                            {unexpected_citizen.blue_lean ? 'Typically FOR' : 'Typically AGAINST'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white">
                        {unexpected_citizen.clout.toLocaleString()}
                      </div>
                      <div className="text-xs text-surface-500">clout</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-300">
                    <Link
                      href={`/profile/${unexpected_citizen.username}`}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-emerald-900/20 border border-emerald-800/40 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 transition-colors"
                    >
                      <Users className="h-3.5 w-3.5" />
                      View their civic record
                    </Link>
                  </div>
                </SerendipityCard>
              ) : null}

            </motion.div>
          </AnimatePresence>

          {/* Footer tip */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl border border-surface-300 bg-surface-100/50 p-4"
            >
              <div className="flex items-start gap-3">
                <BookOpen className="h-4 w-4 text-surface-500 mt-0.5 shrink-0" />
                <p className="text-xs text-surface-400 leading-relaxed">
                  <span className="text-white font-medium">Break your filter bubble.</span>{' '}
                  The platform has {(data?.total_topics ?? 0).toLocaleString()} topics across 15+
                  categories. The most insightful citizens vote across at least 5 categories.{' '}
                  <span className="text-purple-300">Hit Shuffle</span> to discover more.
                </p>
              </div>
            </motion.div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/discover"
              className="flex items-center gap-2 p-3 rounded-xl border border-surface-300 bg-surface-100 text-sm text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Compass className="h-4 w-4 text-purple-400" />
              <span>Discover</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Link>
            <Link
              href="/categories"
              className="flex items-center gap-2 p-3 rounded-xl border border-surface-300 bg-surface-100 text-sm text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
            >
              <MessageSquare className="h-4 w-4 text-for-400" />
              <span>Categories</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Link>
          </div>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
