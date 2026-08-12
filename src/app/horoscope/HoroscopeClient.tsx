'use client'

/**
 * /horoscope — The Civic Horoscope
 *
 * A daily personalized civic reading based on the user's archetype, voting
 * history, and category preferences. Refreshes once per day (date-seeded).
 *
 * Sections:
 *   Civic Sign     — archetype-mapped celestial identity
 *   Daily Prophecy — archetype-keyed, date-seeded civic prediction
 *   Today's Stars  — most aligned active topics to engage with now
 *   Category Energy — which civic domains carry the most cosmic weight today
 *   Compatibility  — archetype synergies and tensions
 *   Tension Alert  — where this archetype may face headwinds today
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  GitMerge,
  Heart,
  Loader2,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Moon,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { HoroscopeReading, AlignedTopic, CategoryEnergy } from '@/app/api/horoscope/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const ARCHETYPE_NAMES: Record<string, string> = {
  pragmatist:    'The Pragmatist',
  idealist:      'The Idealist',
  guardian:      'The Guardian',
  reformer:      'The Reformer',
  libertarian:   'The Libertarian',
  communitarian: 'The Communitarian',
  technocrat:    'The Technocrat',
  democrat:      'The Democrat',
}

const ENERGY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  high:   { label: 'High Energy',   color: 'text-for-400',     dot: 'bg-for-500'     },
  medium: { label: 'Steady Energy', color: 'text-gold',        dot: 'bg-gold'        },
  low:    { label: 'Low Energy',    color: 'text-surface-500', dot: 'bg-surface-500' },
}

function VoteBar({ bluePct }: { bluePct: number }) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full">
      <div
        className="bg-for-500 transition-all"
        style={{ width: `${bluePct}%` }}
      />
      <div
        className="bg-against-500 flex-1"
      />
    </div>
  )
}

// ─── Stars overlay (decorative) ───────────────────────────────────────────────

function StarField() {
  const stars = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: (i * 37 + 11) % 100,
    y: (i * 53 + 7) % 100,
    size: i % 3 === 0 ? 2 : 1,
    opacity: 0.15 + (i % 4) * 0.08,
  }))
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
          }}
          animate={{ opacity: [s.opacity, s.opacity * 0.3, s.opacity] }}
          transition={{ duration: 2 + (s.id % 3), repeat: Infinity, repeatType: 'reverse' }}
        />
      ))}
    </div>
  )
}

// ─── Section shells ────────────────────────────────────────────────────────────

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-surface-300/60 bg-surface-200/80 overflow-hidden', className)}>
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
}) {
  return (
    <div className="px-4 py-3 border-b border-surface-300/60 flex items-center gap-2">
      <Icon className="h-4 w-4 text-surface-500" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold text-white">{title}</p>
        {subtitle && <p className="text-[10px] text-surface-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Aligned topic card ────────────────────────────────────────────────────────

function TopicRow({ topic }: { topic: AlignedTopic }) {
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex flex-col gap-2 p-3 hover:bg-surface-300/40 transition-colors border-b border-surface-300/40 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-white font-medium leading-snug flex-1">{topic.statement}</p>
        <div className="flex-shrink-0 flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-surface-500" />
        </div>
      </div>
      <VoteBar bluePct={topic.blue_pct} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {topic.category && (
            <Badge variant="neutral" size="xs">{topic.category}</Badge>
          )}
          <span className="text-[10px] text-surface-500 font-mono">
            {topic.total_votes.toLocaleString()} votes
          </span>
        </div>
        <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
          <Star className="h-2.5 w-2.5 text-gold" />
          <span className="text-gold">{topic.alignment_reason.split(' ').slice(0, 4).join(' ')}…</span>
        </span>
      </div>
    </Link>
  )
}

// ─── Category energy row ──────────────────────────────────────────────────────

function CategoryEnergyRow({ item }: { item: CategoryEnergy }) {
  const cfg = ENERGY_CONFIG[item.energy] ?? ENERGY_CONFIG.medium
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-surface-300/40 last:border-b-0">
      <div className="mt-1 flex-shrink-0">
        <span className={cn('inline-block h-2 w-2 rounded-full', cfg.dot)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{item.category}</span>
          <span className={cn('text-[10px] font-mono', cfg.color)}>{cfg.label}</span>
        </div>
        <p className="text-[11px] text-surface-500 mt-0.5 leading-snug">{item.label}</p>
      </div>
    </div>
  )
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function HoroscopeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HoroscopeClient() {
  const router = useRouter()
  const [data, setData] = useState<HoroscopeReading | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/horoscope')
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load reading')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  async function handleShare() {
    if (!data) return
    const text = `My Civic Horoscope on Lobby Market:\n\n"${data.daily_prophecy}"\n\n— ${data.civic_sign.name} (${ARCHETYPE_NAMES[data.civic_archetype ?? ''] ?? 'Unknown Archetype'})\n\nhttps://lobbymarket.com/horoscope`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Civic Horoscope', text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* ignore */ }
  }

  const today = formatDate(new Date())

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 pt-4 pb-24 md:pb-12 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-white">Civic Horoscope</h1>
            <p className="text-[11px] text-surface-500">{today}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            aria-label="Share reading"
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            {copied ? 'Copied' : 'Share'}
          </Button>
        </div>

        {loading && <HoroscopeSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={AlertTriangle}
            title="Reading unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Civic Sign hero */}
            <div className="relative rounded-2xl overflow-hidden border border-surface-300/60 bg-gradient-to-br from-surface-200/90 via-surface-200/80 to-surface-100/40 p-5">
              <StarField />
              <div className="relative flex flex-col items-center text-center gap-3">
                <div className="text-5xl" aria-hidden="true">{data.civic_sign.symbol}</div>
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-0.5">Your Civic Sign</p>
                  <h2 className="text-lg font-bold text-white leading-tight">{data.civic_sign.name}</h2>
                  <p className="text-xs text-surface-400 mt-0.5 font-mono">Element: {data.civic_sign.element}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Avatar
                    src={data.avatar_url}
                    fallback={data.display_name || data.username}
                    size="sm"
                  />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white">{data.display_name || data.username}</p>
                    {data.civic_archetype && (
                      <p className="text-[10px] text-surface-500">{ARCHETYPE_NAMES[data.civic_archetype]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <span className="flex items-center gap-1 text-[10px] text-gold font-mono">
                      <Zap className="h-3 w-3" />{data.clout.toLocaleString()} clout
                    </span>
                    {data.vote_streak > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-against-400 font-mono">
                        <Flame className="h-3 w-3" />{data.vote_streak}d streak
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-surface-400 italic max-w-xs">&ldquo;{data.civic_sign.trait}&rdquo;</p>
              </div>
            </div>

            {/* Celestial energy today */}
            <Section>
              <SectionHeader icon={Moon} title="Celestial Energy" subtitle="Today's cosmic alignment" />
              <div className="p-4">
                <p className="text-sm text-surface-300 leading-relaxed">{data.civic_sign.today_energy}</p>
              </div>
            </Section>

            {/* Daily prophecy */}
            <Section>
              <SectionHeader icon={Sparkles} title="Today's Prophecy" subtitle={`${ARCHETYPE_NAMES[data.civic_archetype ?? ''] ?? 'Civic'} reading for ${new Date().toLocaleDateString('en-GB', { weekday: 'long' })}`} />
              <div className="p-4">
                <blockquote className="border-l-2 border-gold pl-3">
                  <p className="text-sm text-white leading-relaxed italic">&ldquo;{data.daily_prophecy}&rdquo;</p>
                </blockquote>
                {!data.civic_archetype && (
                  <Link
                    href="/archetype"
                    className="mt-3 flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    Take the Archetype Quiz for a personalised reading
                  </Link>
                )}
              </div>
            </Section>

            {/* Aligned topics */}
            {data.aligned_topics.length > 0 && (
              <Section>
                <SectionHeader
                  icon={Star}
                  title="Today's Starred Topics"
                  subtitle="Topics cosmically aligned with your civic pattern"
                />
                {data.aligned_topics.map((t) => (
                  <TopicRow key={t.id} topic={t} />
                ))}
                <div className="px-4 py-3">
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    See all active topics
                  </Link>
                </div>
              </Section>
            )}

            {/* Category energy */}
            {data.category_energy.length > 0 && (
              <Section>
                <SectionHeader
                  icon={BarChart2}
                  title="Category Energy"
                  subtitle="Which civic domains carry the most weight today"
                />
                {data.category_energy.map((item) => (
                  <CategoryEnergyRow key={item.category} item={item} />
                ))}
              </Section>
            )}

            {/* Tension warning */}
            {data.tension_warning && (
              <div className="rounded-2xl border border-against-500/30 bg-against-500/5 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-against-300 mb-0.5">Celestial Tension</p>
                  <p className="text-xs text-surface-400 leading-snug">{data.tension_warning}</p>
                </div>
              </div>
            )}

            {/* Compatibility */}
            <Section>
              <SectionHeader icon={Users} title="Archetype Compatibility" subtitle="Your celestial civic alliances" />
              <div className="divide-y divide-surface-300/40">
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-for-400 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-surface-500 mb-0.5">Most compatible with</p>
                    <Link
                      href="/archetype"
                      className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
                    >
                      {ARCHETYPE_NAMES[data.compatible_archetype] ?? data.compatible_archetype}
                    </Link>
                  </div>
                  <Badge variant="active" size="xs">Aligned</Badge>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Circle className="h-4 w-4 text-against-400 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-surface-500 mb-0.5">Greatest tension with</p>
                    <Link
                      href="/archetype"
                      className="text-xs font-semibold text-white hover:text-against-300 transition-colors"
                    >
                      {ARCHETYPE_NAMES[data.tense_archetype] ?? data.tense_archetype}
                    </Link>
                  </div>
                  <Badge variant="against" size="xs">Tension</Badge>
                </div>
              </div>
            </Section>

            {/* CTA strip */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href="/archetype"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-surface-300/60 bg-surface-200/60 px-4 py-3 text-xs font-semibold text-white hover:bg-surface-300/60 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                {data.civic_archetype ? 'View full archetype' : 'Take the quiz'}
              </Link>
              <Link
                href="/compass"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-surface-300/60 bg-surface-200/60 px-4 py-3 text-xs font-semibold text-white hover:bg-surface-300/60 transition-colors"
              >
                <Scale className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                Civic Compass
              </Link>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-surface-300/60 bg-surface-200/60 px-4 py-3 text-xs font-semibold text-white hover:bg-surface-300/60 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
                {copied ? 'Copied!' : 'Share reading'}
              </button>
            </div>

            <p className="text-center text-[10px] text-surface-600 font-mono">
              ✦ This reading refreshes at midnight UTC ✦
            </p>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
