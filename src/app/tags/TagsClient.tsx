'use client'

/**
 * /tags — Topic Tag Browser
 *
 * Displays a visual cloud of all auto-generated topic tags, sized by the
 * number of debates that carry that tag.  Clicking a tag navigates to
 * /tags/[tag] for the full topic listing.
 *
 * Distinct from /categories (predefined category grid) — Tags are finer-
 * grained, auto-extracted keywords that cut across categories.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  Gavel,
  GitCompare,
  Hash,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagFollowButton } from '@/components/ui/TagFollowButton'
import { cn } from '@/lib/utils/cn'
import type { TrendingTag, TrendingTagsResponse } from '@/app/api/tags/trending/route'
import type { FollowedTagsResponse } from '@/app/api/tags/following/route'
import type { RecommendedTag, RecommendedTagsResponse } from '@/app/api/tags/recommended/route'

// ── Tag colour palette ────────────────────────────────────────────────────────
// Deterministically assign a colour bucket to each tag based on its first char.

const TAG_PALETTES = [
  { text: 'text-for-300',    bg: 'bg-for-500/10',    border: 'border-for-500/30',    hover: 'hover:bg-for-500/20'    },
  { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30', hover: 'hover:bg-against-500/20' },
  { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        hover: 'hover:bg-gold/20'        },
  { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     hover: 'hover:bg-emerald/20'     },
  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      hover: 'hover:bg-purple/20'      },
  { text: 'text-for-400',     bg: 'bg-for-500/15',     border: 'border-for-500/40',     hover: 'hover:bg-for-500/25'     },
]

function tagPalette(tag: string) {
  const code = tag.charCodeAt(0) + tag.charCodeAt(Math.min(2, tag.length - 1))
  return TAG_PALETTES[code % TAG_PALETTES.length]
}

// ── Font size by rank ─────────────────────────────────────────────────────────

function tagSize(count: number, max: number): string {
  const ratio = count / max
  if (ratio >= 0.8) return 'text-xl font-bold'
  if (ratio >= 0.6) return 'text-lg font-semibold'
  if (ratio >= 0.4) return 'text-base font-medium'
  if (ratio >= 0.2) return 'text-sm font-medium'
  return 'text-xs font-normal'
}

// ── Tag pill ──────────────────────────────────────────────────────────────────

function TagPill({
  tag,
  max,
  index,
}: {
  tag: TrendingTag
  max: number
  index: number
}) {
  const palette = tagPalette(tag.tag)
  const sizeClass = tagSize(tag.topic_count, max)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.012, type: 'spring', stiffness: 200, damping: 18 }}
    >
      <Link
        href={`/tags/${encodeURIComponent(tag.tag)}`}
        className={cn(
          'group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-150',
          palette.bg,
          palette.border,
          palette.hover,
          sizeClass,
          palette.text,
        )}
      >
        <Tag className="h-3 w-3 opacity-70 flex-shrink-0" aria-hidden />
        <span>{tag.tag}</span>
        {tag.law_count > 0 && (
          <span className="text-gold text-[10px] font-mono opacity-80">
            {tag.law_count} LAW
          </span>
        )}
        {tag.active_count > 0 && tag.law_count === 0 && (
          <span className="text-[10px] font-mono opacity-60">
            {tag.active_count} live
          </span>
        )}
      </Link>
    </motion.div>
  )
}

// ── Top tag card ──────────────────────────────────────────────────────────────

function TopTagCard({ tag, rank }: { tag: TrendingTag; rank: number }) {
  const palette = tagPalette(tag.tag)
  return (
    <Link
      href={`/tags/${encodeURIComponent(tag.tag)}`}
      className={cn(
        'group flex flex-col gap-2 p-4 rounded-xl border transition-all duration-150',
        'bg-surface-100/50 hover:bg-surface-100 border-surface-200 hover:border-surface-300',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-mono text-xs font-bold opacity-50', palette.text)}>
          #{rank}
        </span>
        <span className={cn('text-[10px] font-mono', palette.text, palette.bg, 'px-1.5 py-0.5 rounded-full border', palette.border)}>
          {tag.tag}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-white font-mono font-bold text-xl leading-none">{tag.topic_count}</p>
          <p className="text-surface-500 font-mono text-xs mt-0.5">debates</p>
        </div>
        <div className="text-right">
          {tag.law_count > 0 && (
            <div className="flex items-center gap-1 text-gold">
              <Gavel className="h-3 w-3" />
              <span className="font-mono text-xs font-bold">{tag.law_count}</span>
            </div>
          )}
          {tag.active_count > 0 && (
            <div className="flex items-center gap-1 text-emerald">
              <Zap className="h-3 w-3" />
              <span className="font-mono text-xs">{tag.active_count}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 text-surface-500 group-hover:text-surface-300 transition-colors text-xs font-mono mt-1">
        <span>Browse</span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const REASON_LABEL: Record<RecommendedTag['reason'], string> = {
  voted_topic: 'Based on your votes',
  cooccurrence: 'Related to your tags',
  trending: 'Trending',
}

export function TagsClient() {
  const router = useRouter()
  const [tags, setTags] = useState<TrendingTag[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'cloud' | 'grid'>('cloud')
  const [followedTags, setFollowedTags] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<RecommendedTag[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [trendingRes, followedRes, recommendedRes] = await Promise.all([
        fetch('/api/tags/trending', { cache: 'no-store' }),
        fetch('/api/tags/following', { cache: 'no-store' }),
        fetch('/api/tags/recommended', { cache: 'no-store' }),
      ])
      if (trendingRes.ok) {
        const json = (await trendingRes.json()) as TrendingTagsResponse
        setTags(json.tags)
      }
      if (followedRes.ok) {
        const json = (await followedRes.json()) as FollowedTagsResponse
        setFollowedTags(json.tags)
      }
      if (recommendedRes.ok) {
        const json = (await recommendedRes.json()) as RecommendedTagsResponse
        setRecommendations(json.recommendations ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxCount = tags[0]?.topic_count ?? 1
  const top5 = tags.slice(0, 5)
  const rest = tags.slice(5)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Tag className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Topic Tags</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading ? 'Loading…' : `${tags.length} tags across all debates`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-1">
              <button
                onClick={() => setView('cloud')}
                className={cn(
                  'px-3 py-1 rounded font-mono text-xs transition-all',
                  view === 'cloud'
                    ? 'bg-surface-100 text-white shadow'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                Cloud
              </button>
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'px-3 py-1 rounded font-mono text-xs transition-all',
                  view === 'grid'
                    ? 'bg-surface-100 text-white shadow'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                Grid
              </button>
            </div>

            <Link
              href="/tags/compare"
              aria-label="Compare two tags"
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors text-xs font-mono"
            >
              <GitCompare className="h-3.5 w-3.5" />
              Compare
            </Link>

            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh tags"
              className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Followed tags strip ───────────────────────────────────────── */}
        {followedTags.length > 0 && (
          <div className="mb-6 rounded-xl bg-for-500/5 border border-for-500/20 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-for-400" aria-hidden />
                <span className="font-mono text-sm font-bold text-for-300">
                  Following {followedTags.length} tag{followedTags.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => router.push('/?mode=mytags')}
                className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
              >
                <Hash className="h-3 w-3" />
                View My Tags feed
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {followedTags.map((t) => (
                <Link
                  key={t}
                  href={`/tags/${encodeURIComponent(t)}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium border bg-for-500/10 text-for-300 border-for-500/30 hover:bg-for-500/20 transition-colors"
                >
                  <Bell className="h-2.5 w-2.5 opacity-70" />
                  #{t}
                </Link>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-for-400" />
          </div>
        ) : tags.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No tags yet"
            description="Tags will appear once topics are published to the platform."
          />
        ) : (
          <>
            {/* ── Suggested for You ─────────────────────────────────────── */}
            {recommendations.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple" aria-hidden />
                  <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider">
                    Suggested for You
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recommendations.map((rec, i) => {
                    const palette = tagPalette(rec.tag)
                    return (
                      <motion.div
                        key={rec.tag}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-100/50 border border-surface-200 hover:border-surface-300 transition-all"
                      >
                        <Link
                          href={`/tags/${encodeURIComponent(rec.tag)}`}
                          className="flex-1 flex items-center gap-2.5 min-w-0"
                        >
                          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', palette.bg, 'border', palette.border)}>
                            <Tag className={cn('h-3.5 w-3.5', palette.text)} aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className={cn('text-sm font-mono font-semibold truncate', palette.text)}>
                              #{rec.tag}
                            </p>
                            <p className="text-[10px] font-mono text-surface-500 truncate">
                              {rec.active_count > 0 ? `${rec.active_count} active · ` : ''}{rec.topic_count} debate{rec.topic_count !== 1 ? 's' : ''} · {REASON_LABEL[rec.reason]}
                            </p>
                          </div>
                        </Link>
                        <TagFollowButton
                          tag={rec.tag}
                          initialFollowing={followedTags.includes(rec.tag)}
                          size="sm"
                          className="flex-shrink-0"
                        />
                      </motion.div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Top 5 cards ───────────────────────────────────────────── */}
            {top5.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-for-400" aria-hidden />
                  <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider">
                    Most Active
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {top5.map((t, i) => (
                    <TopTagCard key={t.tag} tag={t} rank={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Tag cloud / grid ──────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-surface-400" aria-hidden />
                <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider">
                  All Tags
                </h2>
              </div>

              <AnimatePresence mode="wait">
                {view === 'cloud' ? (
                  <motion.div
                    key="cloud"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-wrap gap-2"
                  >
                    {rest.map((t, i) => (
                      <TagPill key={t.tag} tag={t} max={maxCount} index={i} />
                    ))}
                    {/* include top5 too if cloud view */}
                    {top5.map((t, i) => (
                      <TagPill key={t.tag} tag={t} max={maxCount} index={rest.length + i} />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                  >
                    {tags.map((t, i) => {
                      const palette = tagPalette(t.tag)
                      return (
                        <motion.div
                          key={t.tag}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.01 }}
                        >
                          <Link
                            href={`/tags/${encodeURIComponent(t.tag)}`}
                            className={cn(
                              'flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-all',
                              palette.bg,
                              palette.border,
                              palette.hover,
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Tag className={cn('h-3.5 w-3.5 flex-shrink-0', palette.text)} aria-hidden />
                              <span className={cn('font-mono text-sm font-medium truncate', palette.text)}>
                                {t.tag}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {t.law_count > 0 && (
                                <span className="text-gold font-mono text-[10px]">
                                  {t.law_count}LAW
                                </span>
                              )}
                              <span className="font-mono text-xs text-surface-400">
                                {t.topic_count}
                              </span>
                            </div>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
