'use client'

/**
 * /analytics/narrative — Your Civic Story
 *
 * A personalised, prose-form summary of the user's civic journey on Lobby Market.
 * Five chapters, generated from existing analytics data, tell the story of how
 * the user has shown up, what they believe, and who they've become in the Lobby.
 *
 * Distinct from:
 *   /analytics/journey   — chronological event timeline
 *   /analytics/snapshot  — single-screen identity card
 *   /analytics/portrait  — shareable visual identity
 *   /wrapped             — year-in-review highlight reel
 *
 * This is the only page that translates raw stats into readable prose.
 * No AI generation — all text is composed from deterministic templates.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Coins,
  ExternalLink,
  Gavel,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SnapshotData } from '@/app/api/analytics/snapshot/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoreStats {
  accuracy: number | null
  resolved_votes: number
  topCategories: Array<{ category: string; count: number; blue: number; red: number }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function durationSince(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const months =
    (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
  if (months < 1) return 'just this month'
  if (months === 1) return 'just one month'
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (rem === 0) return years === 1 ? 'one year' : `${years} years`
  return `${years} year${years > 1 ? 's' : ''} and ${rem} month${rem > 1 ? 's' : ''}`
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Narrative generators ─────────────────────────────────────────────────────

function chapter1(snap: SnapshotData): string {
  const name = snap.displayName || `@${snap.username}`
  const joined = longDate(snap.memberSince)
  const duration = durationSince(snap.memberSince)

  if (snap.totalVotes < 5) {
    return `${name} stepped into the Lobby on ${joined}. The story is still being written — a few early votes, a blank slate. Every veteran on this platform started exactly here. The Lobby has a way of pulling people in, one debate at a time.`
  }

  const archetypeOpeners: Record<string, string> = {
    newcomer: 'still finding their footing',
    specialist: 'going deep rather than broad — a focused civic voice',
    contrarian: 'a dissenter by disposition — never afraid to stand against the crowd',
    maverick: 'a free thinker — broadly engaged, impossible to pin down',
    oracle: 'in tune with the civic temperature across every domain',
    balanced: 'measured, even-handed, reliable',
  }

  const opener = archetypeOpeners[snap.archetype] ?? 'an emerging civic voice'
  const topCat = snap.topCategories[0]?.category

  return (
    `${name} joined the Lobby on ${joined} — that's ${duration} of civic engagement. ` +
    `${snap.totalVotes.toLocaleString()} votes later, the picture is clear: ${opener}. ` +
    `${topCat ? `${topCat} debates have drawn the most sustained attention` : 'Debates across many categories have shaped this record'}` +
    `, with ${snap.lawsHelped > 0 ? `${snap.lawsHelped} law${snap.lawsHelped > 1 ? 's' : ''} helped into existence` : 'a growing record of civic participation'}` +
    `.`
  )
}

function chapter2(snap: SnapshotData, core: CoreStats): string {
  const forPct = Math.round(snap.forPct)
  const againstPct = 100 - forPct

  let tendency = ''
  if (forPct > 65) {
    tendency = `A constructive thinker: ${forPct}% of votes have been FOR. The default orientation is to see proposals as opportunities rather than threats.`
  } else if (forPct < 35) {
    tendency = `A critical voice: ${againstPct}% of votes AGAINST. Proposals are held to a high standard before endorsement.`
  } else if (forPct > 55) {
    tendency = `Leaning constructive — ${forPct}% FOR — open to change while remaining selective.`
  } else if (forPct < 45) {
    tendency = `Leaning sceptical — ${againstPct}% AGAINST — inclined to scrutinise before endorsing.`
  } else {
    tendency = `Remarkably balanced: ${forPct}% FOR, ${againstPct}% AGAINST. Each proposal is evaluated on its own merits.`
  }

  const cats = core.topCategories.slice(0, 3).map((c) => c.category)
  const catText =
    cats.length > 1
      ? ` The deepest engagement: ${cats.slice(0, -1).join(', ')} and ${cats[cats.length - 1]}.`
      : cats.length === 1
      ? ` Primary focus: ${cats[0]}.`
      : ''

  let accuracy = ''
  if (core.accuracy !== null && core.resolved_votes >= 5) {
    if (core.accuracy >= 75) {
      accuracy = ` The track record speaks clearly: ${core.accuracy}% accuracy on resolved debates — consistently on the right side of history.`
    } else if (core.accuracy >= 55) {
      accuracy = ` On resolved debates, the accuracy rate is ${core.accuracy}% — a solid read of the civic temperature.`
    } else {
      accuracy = ` Resolved debates show ${core.accuracy}% accuracy so far — patterns still forming.`
    }
  }

  return tendency + catText + accuracy
}

function chapter3(snap: SnapshotData): string {
  const args = snap.totalArguments

  if (args === 0) {
    return `No written arguments on record yet. Sometimes the vote alone is the statement. But the Lobby rewards those who make their case in writing — every quality argument builds reputation, earns Clout, and contributes to how the community reasons about an issue. The argument record is the most durable part of a civic legacy.`
  }

  let volume = ''
  if (args === 1) volume = 'One argument in the record — a start.'
  else if (args < 5) volume = `${args} arguments written — early stages.`
  else if (args < 20) volume = `${args} arguments submitted to the civic record.`
  else if (args < 50) volume = `${args} arguments — a substantial body of civic writing.`
  else volume = `${args} arguments — a prolific contributor to civic discourse.`

  const cats = snap.topCategories
    .slice(0, 2)
    .map((c) => c.category)
    .join(' and ')

  const debateText =
    snap.totalDebates > 0
      ? ` Beyond the written record: ${snap.totalDebates} live debate${snap.totalDebates > 1 ? 's' : ''} joined, where the argument had to hold up in real time.`
      : ''

  return (
    `${volume} The categories that inspired the most writing: ${cats || 'varied'}. ` +
    `Every argument entered becomes permanent — the civic record doesn't forget.` +
    debateText
  )
}

function chapter4(snap: SnapshotData): string {
  let cloutText = ''
  if (snap.clout > 1000) {
    cloutText = `${snap.clout.toLocaleString()} Clout — serious civic capital, earned through consistent participation and quality writing.`
  } else if (snap.clout > 250) {
    cloutText = `${snap.clout.toLocaleString()} Clout accumulated.`
  } else {
    cloutText = `${snap.clout.toLocaleString()} Clout — early-stage civic capital, still building.`
  }

  let streakText = ''
  if (snap.voteStreak >= 30) {
    streakText = ` A ${snap.voteStreak}-day voting streak is a genuine commitment — the kind of consistency that separates civic contributors from casual participants.`
  } else if (snap.voteStreak >= 7) {
    streakText = ` Current streak: ${snap.voteStreak} days.`
  } else if (snap.voteStreak > 0) {
    streakText = ` ${snap.voteStreak}-day streak active.`
  }

  let socialText = ''
  if (snap.followersCount > 100) {
    socialText = ` ${snap.followersCount.toLocaleString()} citizens follow this voice in the Lobby — a genuine community presence.`
  } else if (snap.followersCount > 20) {
    socialText = ` ${snap.followersCount} followers and growing.`
  }

  const catsCovered = snap.categoriesEngaged
  const catText =
    catsCovered >= 8
      ? ` ${catsCovered} of 10 civic categories engaged — near-complete breadth of interest.`
      : catsCovered >= 5
      ? ` ${catsCovered} categories engaged.`
      : ''

  return `${cloutText}${streakText}${socialText}${catText} Reputation score: ${snap.reputationScore.toLocaleString()} — a composite measure of civic quality, consistency, and community trust.`
}

function chapter5(snap: SnapshotData): string {
  const narratives: Record<string, string> = {
    newcomer:
      `The story is still being written. Every vote, every argument, every debate joined adds another chapter. The Lobby rewards persistence — the citizens who shape the platform's laws are the ones who showed up, consistently, over time. The foundation is here.`,

    specialist:
      `The specialist's path is distinct from the generalist's. While others scatter votes across every category, the engagement here runs deep — building genuine expertise in a few domains rather than surface-level opinions on everything. The community needs people who actually know their subject. This is that voice.`,

    contrarian:
      `The contrarian plays a role no algorithm can manufacture. Without voices that push back, consensus becomes complacency. History tends to vindicate those who question the crowd — not always, not even usually, but often enough to matter. The Lobby is better for its dissenters.`,

    maverick:
      `The maverick resists easy classification. Broadly engaged but never predictable — not reliably FOR or AGAINST, not captured by any single category, always showing up with an independent read. That independence is the hardest quality to manufacture, and the most valuable in a healthy debate.`,

    oracle:
      `The oracle has something rarer than a strong opinion: accurate pattern recognition. Broad engagement that consistently aligns with where the community ultimately lands — not through followership, but through genuine civic attunement. This is the kind of judgment a consensus engine is built to surface.`,

    balanced:
      `The balanced voice is harder to achieve than it looks. In a platform built on disagreement, finding the moderate position on every question requires real intellectual work. This civic identity is defined by restraint — not indifference, but the discipline to see multiple sides before choosing one. That restraint is a civic virtue.`,
  }

  return narratives[snap.archetype] ?? `A unique civic voice — still being defined by every vote and argument contributed to the record.`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NarrativeSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface-100 border border-surface-300">
        <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-24 rounded-full mt-1" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-6 rounded-2xl bg-surface-100 border border-surface-300 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-14 rounded" />
              <Skeleton className="h-3.5 w-32 rounded" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Chapter card ─────────────────────────────────────────────────────────────

const CHAPTER_ACCENT: Record<number, { dot: string; label: string }> = {
  1: { dot: 'bg-for-500', label: 'text-for-400' },
  2: { dot: 'bg-purple', label: 'text-purple' },
  3: { dot: 'bg-emerald', label: 'text-emerald' },
  4: { dot: 'bg-gold', label: 'text-gold' },
  5: { dot: 'bg-against-400', label: 'text-against-300' },
}

function Chapter({
  number,
  title,
  text,
  icon: Icon,
  delay = 0,
  linkHref,
  linkLabel,
}: {
  number: number
  title: string
  text: string
  icon: React.ComponentType<{ className?: string }>
  delay?: number
  linkHref?: string
  linkLabel?: string
}) {
  const accent = CHAPTER_ACCENT[number] ?? { dot: 'bg-surface-500', label: 'text-surface-500' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="p-6 rounded-2xl bg-surface-100 border border-surface-300 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-xl border',
            'bg-surface-200 border-surface-400',
          )}
        >
          <Icon className="h-4 w-4 text-surface-600" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 flex items-center gap-1.5">
            <span className={cn('inline-block w-1.5 h-1.5 rounded-full', accent.dot)} />
            Chapter {number}
          </p>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-surface-700">{text}</p>

      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-mono transition-colors',
            accent.label,
          )}
        >
          {linkLabel}
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NarrativePage() {
  const router = useRouter()
  const [snap, setSnap] = useState<SnapshotData | null>(null)
  const [core, setCore] = useState<CoreStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [snapRes, coreRes] = await Promise.all([
        fetch('/api/analytics/snapshot', { cache: 'no-store' }),
        fetch('/api/analytics', { cache: 'no-store' }),
      ])

      if (!snapRes.ok) {
        if (snapRes.status === 401) {
          router.push('/sign-in')
          return
        }
        throw new Error('Unable to load story')
      }

      const snapData: SnapshotData = await snapRes.json()
      setSnap(snapData)

      if (coreRes.ok) {
        const coreData = await coreRes.json()
        setCore({
          accuracy: coreData.accuracy ?? null,
          resolved_votes: coreData.resolved_votes ?? 0,
          topCategories: coreData.topCategories ?? [],
        })
      }
    } catch {
      setError('Unable to load your civic story. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24 pt-2">
        <div className="max-w-2xl mx-auto px-4 space-y-5">
          {/* ── Header ── */}
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/analytics"
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                'bg-surface-200 hover:bg-surface-300 border border-surface-400',
              )}
              aria-label="Back to Analytics"
            >
              <ArrowLeft className="h-4 w-4 text-surface-600" aria-hidden="true" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white">Your Civic Story</h1>
              <p className="text-xs text-surface-500 truncate">
                Five chapters. Your voice in the Lobby.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh story"
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                'bg-surface-200 hover:bg-surface-300 border border-surface-400',
                loading && 'opacity-50 cursor-not-allowed',
              )}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 text-surface-500', loading && 'animate-spin')}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* ── Loading ── */}
          {loading && <NarrativeSkeleton />}

          {/* ── Error ── */}
          {!loading && error && (
            <EmptyState
              icon={BookOpen}
              title="Story unavailable"
              description={error}
              action={{ label: 'Try again', onClick: load }}
            />
          )}

          {/* ── Content ── */}
          {!loading && !error && snap && (
            <>
              {/* Profile hero */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-4 p-5 rounded-2xl bg-surface-100 border border-surface-300"
              >
                <Avatar
                  src={snap.avatarUrl}
                  username={snap.username}
                  size="lg"
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white truncate">
                    {snap.displayName || `@${snap.username}`}
                  </p>
                  <p className="text-xs text-surface-500 truncate">@{snap.username}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono capitalize border-surface-400 text-surface-600"
                    >
                      {snap.role}
                    </Badge>
                    <span className="text-xs text-gold font-mono font-semibold">
                      {snap.clout.toLocaleString()} Clout
                    </span>
                    {snap.archetypeEmoji && (
                      <span className="text-xs" title={snap.archetypeLabel}>
                        {snap.archetypeEmoji} {snap.archetypeLabel}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/profile/${snap.username}`}
                  className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 font-mono transition-colors flex-shrink-0"
                >
                  Profile
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </motion.div>

              {/* Quick stats strip */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="grid grid-cols-4 gap-2"
              >
                {[
                  { label: 'Votes', value: snap.totalVotes.toLocaleString(), Icon: Vote },
                  { label: 'Arguments', value: snap.totalArguments.toLocaleString(), Icon: MessageSquare },
                  { label: 'Laws helped', value: snap.lawsHelped.toLocaleString(), Icon: Gavel },
                  { label: 'Followers', value: snap.followersCount.toLocaleString(), Icon: Users },
                ].map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300"
                  >
                    <Icon className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                    <p className="text-sm font-mono font-bold text-white">{value}</p>
                    <p className="text-[10px] text-surface-500 text-center leading-tight">{label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Chapters */}
              <Chapter
                number={1}
                title="The Beginning"
                text={chapter1(snap)}
                icon={BookOpen}
                delay={0.1}
                linkHref="/analytics/journey"
                linkLabel="View your full timeline"
              />
              <Chapter
                number={2}
                title="Your Political DNA"
                text={chapter2(snap, core ?? { accuracy: null, resolved_votes: 0, topCategories: snap.topCategories.map(c => ({ category: c.category, count: c.voteCount, blue: 0, red: 0 })) })}
                icon={Vote}
                delay={0.2}
                linkHref="/analytics/votes"
                linkLabel="Explore voting patterns"
              />
              <Chapter
                number={3}
                title="The Arguments You Made"
                text={chapter3(snap)}
                icon={MessageSquare}
                delay={0.3}
                linkHref="/analytics/arguments"
                linkLabel="View argument record"
              />
              <Chapter
                number={4}
                title="The Record"
                text={chapter4(snap)}
                icon={Trophy}
                delay={0.4}
                linkHref="/analytics/snapshot"
                linkLabel="Full identity snapshot"
              />
              <Chapter
                number={5}
                title="Your Civic Identity"
                text={chapter5(snap)}
                icon={Sparkles}
                delay={0.5}
                linkHref="/archetype"
                linkLabel="Explore civic archetypes"
              />

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.65 }}
                className="py-5 text-center space-y-2"
              >
                <p className="text-xs text-surface-500 leading-relaxed">
                  This story updates as you vote, argue, and debate.
                  <br />
                  Come back after your next milestone.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href="/analytics"
                    className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    All analytics →
                  </Link>
                  <span className="text-surface-600" aria-hidden="true">
                    ·
                  </span>
                  <Link
                    href="/wrapped"
                    className="text-xs font-mono text-gold hover:text-gold/80 transition-colors"
                  >
                    Year in Review →
                  </Link>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
