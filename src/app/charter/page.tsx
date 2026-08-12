import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BookOpen,
  Flame,
  Gavel,
  Globe,
  Heart,
  Scale,
  Shield,
  Star,
  Users,
  Zap,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Award,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'The Civic Charter · Lobby Market',
  description:
    'The founding principles of Lobby Market — a platform where truth is debated, consensus is earned, and the best arguments become law. Read the Charter. Sign it. Join the Lobby.',
  openGraph: {
    title: 'The Civic Charter · Lobby Market',
    description:
      'A living document of the principles that govern Lobby Market: how we debate, how we vote, how we build consensus together.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Charter · Lobby Market',
    description:
      'Truth. Justice. Liberty. Community. Progress. The five pillars of the Lobby — and the foundation of every debate within it.',
  },
}

// ─── Charter articles ─────────────────────────────────────────────────────────

const CHARTER_ARTICLES = [
  {
    number: 'I',
    title: 'The Right to Argue',
    icon: MessageSquare,
    color: 'text-for-400',
    borderColor: 'border-for-500/30',
    bgColor: 'bg-for-500/5',
    body: `Every citizen of the Lobby holds the inalienable right to argue their position on any topic. Arguments shall be judged on the merit of their reasoning, the quality of their evidence, and the clarity of their logic — not on the identity of their author. A single compelling argument may move an entire consensus.`,
  },
  {
    number: 'II',
    title: 'The Sovereignty of the Vote',
    icon: Scale,
    color: 'text-gold',
    borderColor: 'border-gold/30',
    bgColor: 'bg-gold/5',
    body: `Every vote carries equal weight. No citizen's voice shall be amplified by wealth, status, or connections alone. The vote is the atomic unit of civic power — cast it on evidence, not on impulse. Consensus reached through honest deliberation is binding; consensus reached through manipulation is void.`,
  },
  {
    number: 'III',
    title: 'The Law of Consensus',
    icon: Gavel,
    color: 'text-emerald',
    borderColor: 'border-emerald/30',
    bgColor: 'bg-emerald/5',
    body: `When a topic reaches sufficient consensus — when the community has spoken clearly and consistently — it becomes Law. Laws represent the collective wisdom of the Lobby at a given moment. They may be challenged, refined, or overturned by future consensus. No law is permanent; all laws are earned.`,
  },
  {
    number: 'IV',
    title: 'The Duty of Good Faith',
    icon: Shield,
    color: 'text-against-400',
    borderColor: 'border-against-500/30',
    bgColor: 'bg-against-500/5',
    body: `Citizens engage in good faith. Arguments are made to persuade, not to mislead. Votes reflect genuine belief, not strategic gaming. Those who manipulate the system through coordinated bad-faith action betray not just the platform but the ideal of democratic deliberation itself. Good faith is both a duty and a gift to the community.`,
  },
  {
    number: 'V',
    title: 'The Principle of Steelmanning',
    icon: Star,
    color: 'text-purple',
    borderColor: 'border-purple/30',
    bgColor: 'bg-purple/5',
    body: `Before dismissing an opposing view, understand it fully. The strongest civic debater is one who can articulate the best version of the other side — and still disagree. Steelmanning raises the quality of all discourse. It is the difference between winning an argument and advancing the truth.`,
  },
  {
    number: 'VI',
    title: 'The Commons of Knowledge',
    icon: Globe,
    color: 'text-for-300',
    borderColor: 'border-for-400/30',
    bgColor: 'bg-for-500/5',
    body: `The knowledge built in the Lobby — every wiki page, every cited argument, every prediction calibrated against reality — belongs to the commons. Citizens contribute to a shared understanding that grows richer with every debate. The Lobby's accumulated wisdom is greater than the sum of its parts.`,
  },
]

// ─── Value pillars ────────────────────────────────────────────────────────────

const PILLARS = [
  { value: 'truth', label: 'Truth', icon: BookOpen, color: 'text-for-300' },
  { value: 'justice', label: 'Justice', icon: Scale, color: 'text-gold' },
  { value: 'liberty', label: 'Liberty', icon: Flame, color: 'text-against-400' },
  { value: 'community', label: 'Community', icon: Heart, color: 'text-emerald' },
  { value: 'progress', label: 'Progress', icon: TrendingUp, color: 'text-purple' },
]

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-200 border border-surface-300">
      <Icon className={cn('h-5 w-5', color)} aria-hidden="true" />
      <span className="text-xl font-bold font-mono text-white tabular-nums">{value}</span>
      <span className="text-xs text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Signatory {
  username: string
  display_name: string | null
  avatar_url: string | null
  civic_oath_value: string | null
  civic_oath_at: string
}

interface CharterStats {
  citizens: number
  laws: number
  arguments: number
  votes: number
  signatories: Signatory[]
  pillarCounts: Record<string, number>
}

async function getCharterData(): Promise<CharterStats> {
  try {
    const supabase = await createClient()

    const [citizensRes, lawsRes, argumentsRes, votesRes, signatoriesRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('laws').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('topic_arguments').select('id', { count: 'exact', head: true }),
      supabase.from('votes').select('id', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('username, display_name, avatar_url, civic_oath_value, civic_oath_at')
        .not('civic_oath_at', 'is', null)
        .order('civic_oath_at', { ascending: false })
        .limit(24),
    ])

    const signatories = (signatoriesRes.data ?? []) as Signatory[]

    const pillarCounts: Record<string, number> = {
      truth: 0,
      justice: 0,
      liberty: 0,
      community: 0,
      progress: 0,
    }
    for (const s of signatories) {
      if (s.civic_oath_value && s.civic_oath_value in pillarCounts) {
        pillarCounts[s.civic_oath_value]++
      }
    }

    return {
      citizens: citizensRes.count ?? 0,
      laws: lawsRes.count ?? 0,
      arguments: argumentsRes.count ?? 0,
      votes: votesRes.count ?? 0,
      signatories,
      pillarCounts,
    }
  } catch {
    return {
      citizens: 0,
      laws: 0,
      arguments: 0,
      votes: 0,
      signatories: [],
      pillarCounts: { truth: 0, justice: 0, liberty: 0, community: 0, progress: 0 },
    }
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default async function CharterPage() {
  const stats = await getCharterData()

  const topPillar = PILLARS.reduce((best, p) =>
    (stats.pillarCounts[p.value] ?? 0) > (stats.pillarCounts[best.value] ?? 0) ? p : best
  )

  return (
    <>
      <TopBar />

      <main className="min-h-screen bg-surface-50 pb-24">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-surface-300">
          {/* Background gradient */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-for-500/5 via-surface-50 to-surface-50" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-for-500/5 blur-3xl" />
          </div>

          <div className="relative max-w-3xl mx-auto px-4 pt-12 pb-10 text-center">
            {/* Seal */}
            <div className="flex items-center justify-center gap-0 mb-6">
              <div className="h-px flex-1 bg-gradient-to-l from-surface-400/60 to-transparent" />
              <div className="mx-4 flex items-center justify-center w-14 h-14 rounded-full bg-surface-200 border-2 border-surface-300 shadow-lg shadow-black/30">
                <BookOpen className="h-7 w-7 text-for-400" aria-hidden="true" />
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-surface-400/60 to-transparent" />
            </div>

            <p className="text-[11px] font-mono font-semibold tracking-[0.25em] text-surface-500 uppercase mb-3">
              Lobby Market · Est. 2024
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
              The Civic Charter
            </h1>
            <p className="text-base text-surface-600 leading-relaxed max-w-xl mx-auto mb-8">
              A founding document for a new kind of civic space — where every argument counts,
              every vote matters, and the best ideas earn the force of law through honest debate.
            </p>

            {/* Preamble quote */}
            <blockquote className="relative mx-auto max-w-2xl px-6 py-4 bg-surface-200 border border-surface-300 rounded-xl text-sm italic text-surface-600 leading-relaxed">
              <span className="absolute -top-3 left-6 text-3xl text-surface-400 font-serif leading-none select-none">"</span>
              We, the citizens of the Lobby, commit ourselves to rigorous argument, honest votes,
              and the shared pursuit of truth. We believe that consensus reached through debate
              is more legitimate than consensus imposed by authority. We hold these debates
              so that the best ideas may prevail.
              <span className="absolute -bottom-4 right-6 text-3xl text-surface-400 font-serif leading-none select-none">"</span>
            </blockquote>
          </div>
        </section>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

          {/* ── Community Stats ───────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-mono font-semibold tracking-widest text-surface-500 uppercase mb-4">
              The Lobby in Numbers
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile icon={Users}        label="Citizens"   value={fmt(stats.citizens)}  color="text-for-400" />
              <StatTile icon={Gavel}        label="Laws"       value={fmt(stats.laws)}       color="text-emerald" />
              <StatTile icon={MessageSquare} label="Arguments" value={fmt(stats.arguments)} color="text-purple" />
              <StatTile icon={Scale}        label="Votes Cast" value={fmt(stats.votes)}      color="text-gold" />
            </div>
          </section>

          {/* ── Five Pillars ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-mono font-semibold tracking-widest text-surface-500 uppercase mb-4">
              The Five Pillars
            </h2>
            <p className="text-sm text-surface-600 mb-5 leading-relaxed">
              Every citizen who takes the Civic Oath pledges allegiance to one of five core values.
              These pillars guide how we debate, how we vote, and how we build this community together.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {PILLARS.map((pillar) => {
                const Icon = pillar.icon
                const count = stats.pillarCounts[pillar.value] ?? 0
                const isTop = pillar.value === topPillar.value && count > 0
                return (
                  <div
                    key={pillar.value}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
                      isTop
                        ? 'bg-surface-200 border-surface-400'
                        : 'bg-surface-100 border-surface-200',
                    )}
                  >
                    <Icon className={cn('h-5 w-5', pillar.color)} aria-hidden="true" />
                    <span className="text-xs font-semibold text-white text-center leading-tight">
                      {pillar.label}
                    </span>
                    {isTop && (
                      <Badge variant="gold" className="text-[9px] px-1 py-0">
                        Leading
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Charter Articles ──────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-mono font-semibold tracking-widest text-surface-500 uppercase mb-6">
              The Articles
            </h2>
            <div className="space-y-4">
              {CHARTER_ARTICLES.map((article) => {
                const Icon = article.icon
                return (
                  <article
                    key={article.number}
                    className={cn(
                      'rounded-xl border p-5',
                      article.bgColor,
                      article.borderColor,
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <div className={cn(
                          'flex items-center justify-center w-9 h-9 rounded-lg bg-surface-200 border border-surface-300'
                        )}>
                          <Icon className={cn('h-4 w-4', article.color)} aria-hidden="true" />
                        </div>
                        <span className={cn('text-[10px] font-mono font-bold', article.color)}>
                          ART. {article.number}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-2 leading-snug">
                          {article.title}
                        </h3>
                        <p className="text-sm text-surface-600 leading-relaxed">
                          {article.body}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          {/* ── Signatories ───────────────────────────────────────────────────── */}
          {stats.signatories.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono font-semibold tracking-widest text-surface-500 uppercase">
                  Recent Signatories
                </h2>
                <span className="text-xs text-surface-500 font-mono">
                  {fmt(stats.signatories.length)} shown
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stats.signatories.map((sig) => {
                  const pillar = PILLARS.find((p) => p.value === sig.civic_oath_value)
                  return (
                    <Link
                      key={sig.username}
                      href={`/profile/${sig.username}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 hover:bg-surface-300 transition-all group"
                    >
                      <Avatar
                        src={sig.avatar_url}
                        fallback={sig.display_name ?? sig.username}
                        size="sm"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate leading-tight group-hover:text-for-300 transition-colors">
                          {sig.display_name ?? sig.username}
                        </p>
                        {pillar && (
                          <p className={cn('text-[11px] font-mono truncate leading-tight', pillar.color)}>
                            {pillar.label}
                          </p>
                        )}
                      </div>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" aria-hidden="true" />
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── CTA ───────────────────────────────────────────────────────────── */}
          <section className="rounded-2xl bg-surface-200 border border-surface-300 overflow-hidden">
            <div className="p-6 sm:p-8 text-center">
              <Award className="h-10 w-10 text-gold mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-lg font-bold text-white mb-2">
                Sign the Charter
              </h2>
              <p className="text-sm text-surface-600 mb-6 max-w-sm mx-auto leading-relaxed">
                Take the Civic Oath to formally join the Lobby. Choose your guiding principle
                and add your name to the roll of signatories.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/oath"
                  className={cn(
                    'inline-flex items-center gap-2 h-10 px-6 rounded-lg',
                    'bg-for-600 text-white text-sm font-semibold',
                    'hover:bg-for-700 transition-colors',
                  )}
                >
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  Take the Civic Oath
                </Link>
                <Link
                  href="/constitution"
                  className={cn(
                    'inline-flex items-center gap-2 h-10 px-6 rounded-lg',
                    'bg-surface-300 text-surface-700 text-sm font-semibold',
                    'hover:bg-surface-400 hover:text-white transition-colors',
                  )}
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Read the Laws
                </Link>
              </div>
            </div>

            {/* Decorative footer bar */}
            <div className="h-1 flex">
              {PILLARS.map((p, i) => (
                <div
                  key={p.value}
                  className={cn(
                    'flex-1',
                    i === 0 && 'bg-for-400',
                    i === 1 && 'bg-gold',
                    i === 2 && 'bg-against-400',
                    i === 3 && 'bg-emerald',
                    i === 4 && 'bg-purple',
                  )}
                />
              ))}
            </div>
          </section>

          {/* ── Navigation links ─────────────────────────────────────────────── */}
          <nav aria-label="Related pages" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/oath', label: 'Take the Oath', icon: Award, color: 'text-gold' },
              { href: '/constitution', label: 'The Constitution', icon: Gavel, color: 'text-emerald' },
              { href: '/about', label: 'About Lobby Market', icon: Globe, color: 'text-for-400' },
              { href: '/leaderboard', label: 'Civic Leaders', icon: TrendingUp, color: 'text-purple' },
              { href: '/laws', label: 'Browse Laws', icon: BookOpen, color: 'text-for-300' },
              { href: '/coalitions', label: 'Join a Coalition', icon: Users, color: 'text-against-400' },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-400 hover:bg-surface-200 transition-all text-sm text-surface-600 hover:text-white"
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', color)} aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </main>

      <BottomNav />
    </>
  )
}
