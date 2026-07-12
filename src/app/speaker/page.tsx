import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  ChevronRight,
  Crown,
  FileText,
  Gavel,
  Info,
  Mic,
  Network,
  Scale,
  ScrollText,
  Shield,
  Users,
  Vote,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: "The Speaker's Chair · Lobby Market",
  description:
    "The Civic Speaker presides over the Lobby's parliamentary proceedings — maintaining order, ruling on points of order, and upholding the dignity of civic debate.",
  openGraph: {
    title: "The Speaker's Chair · Lobby Market",
    description:
      'Meet the Speaker of the Lobby. The presiding officer who maintains order, rules on procedural matters, and upholds the integrity of civic debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: "The Speaker's Chair · Lobby Market",
    description:
      "The Civic Speaker — presiding officer of the Lobby parliament. Points of order, rulings, and the chamber record.",
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(iso)
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Health:      'text-emerald',
  Science:     'text-for-300',
  Ethics:      'text-against-300',
  Culture:     'text-against-400',
  Philosophy:  'text-purple',
  Education:   'text-for-400',
  Environment: 'text-emerald',
  Security:    'text-against-400',
  Social:      'text-surface-500',
}

function categoryColor(cat: string | null): string {
  return CATEGORY_COLORS[cat ?? ''] ?? 'text-surface-500'
}

const RULING_REASON_LABEL: Record<string, string> = {
  spam:          'Disorder — Spam',
  harassment:    'Disorder — Breach of Decorum',
  misinformation:'Disorder — Factual Dispute',
  hate_speech:   'Point of Privilege — Hate Speech',
  off_topic:     'Point of Relevance — Off Topic',
  manipulation:  'Point of Order — Manipulation',
}

const RULING_ACTION_LABEL: Record<string, { label: string; color: string }> = {
  warned:       { label: 'Member Cautioned',   color: 'text-gold' },
  content_removed: { label: 'Content Expunged', color: 'text-against-400' },
  user_muted:   { label: 'Member Silenced',    color: 'text-against-400' },
  user_banned:  { label: 'Member Expelled',    color: 'text-against-300' },
  no_action:    { label: 'No Action Taken',    color: 'text-surface-500' },
  dismissed:    { label: 'Point Dismissed',    color: 'text-surface-500' },
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  number,
  icon: Icon,
  title,
  subtitle,
}: {
  number: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-surface-300">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
        <Icon className="h-4 w-4 text-surface-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-mono text-surface-500 tracking-widest uppercase">
            {number}
          </span>
          <h2 className="text-base font-semibold text-surface-800 tracking-tight">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpeakerProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  civic_archetype: string | null
  civic_oath_value: string | null
  created_at: string
}

interface ContentiousTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  status: string
}

interface RulingRow {
  id: string
  reason: string
  action_taken: string | null
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  reported_content_type: string
}

// ─── Parliamentary Powers ─────────────────────────────────────────────────────

const SPEAKER_POWERS = [
  {
    title: 'Preside Over Debates',
    description:
      'The Speaker calls on citizens to speak, ensures debates proceed in good order, and prevents repetition or irrelevance.',
    icon: Mic,
    color: 'text-for-400',
  },
  {
    title: 'Rule on Points of Order',
    description:
      'When a citizen raises a procedural challenge, the Speaker rules on it immediately. The ruling is final and binding.',
    icon: Gavel,
    color: 'text-gold',
  },
  {
    title: 'Maintain the Dignity of the House',
    description:
      'The Speaker may call a member to order, require offensive content to be expunged, or in extreme cases, suspend a member.',
    icon: Shield,
    color: 'text-against-400',
  },
  {
    title: 'Casting Vote',
    description:
      "When a civic topic reaches an exact 50/50 tie, the Speaker's casting vote decides the outcome. By convention, the Speaker casts for further debate, not finality.",
    icon: Vote,
    color: 'text-purple',
  },
  {
    title: 'Certify the Order Paper',
    description:
      'The Speaker formally certifies the daily Order Paper, confirming the business before the House is in proper form.',
    icon: ScrollText,
    color: 'text-emerald',
  },
]

// ─── Parliamentary Links ──────────────────────────────────────────────────────

const PARLIAMENTARY_LINKS = [
  { label: 'Order Paper',        href: '/order-paper',        color: 'text-for-400',     icon: ScrollText },
  { label: 'Q&A Time',           href: '/civic-questions',    color: 'text-gold',         icon: Mic },
  { label: 'Shadow Cabinet',     href: '/shadow-cabinet',     color: 'text-against-400',  icon: Users },
  { label: 'Committee Reports',  href: '/committee-reports',  color: 'text-emerald',      icon: FileText },
  { label: 'Oversight Committee',href: '/oversight',          color: 'text-purple',       icon: Network },
  { label: 'Grand Council',      href: '/grand-council',      color: 'text-gold',         icon: Crown },
  { label: 'State of the Lobby', href: '/address',            color: 'text-for-300',      icon: Award },
  { label: 'Tribunal',           href: '/tribunal',           color: 'text-against-300',  icon: Scale },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SpeakerPage() {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    speakerRes,
    ,
    contentious50Res,
    recentRulingsRes,
    totalResolvedRes,
    activeDebatesRes,
  ] = await Promise.all([
    // Speaker = highest reputation_score elder, fallback to any top user
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, role, clout, reputation_score, total_votes, total_arguments, vote_streak, civic_archetype, civic_oath_value, created_at')
      .eq('role', 'elder')
      .order('reputation_score', { ascending: false })
      .limit(1)
      .single(),

    // Placeholder to keep Promise.all indices aligned
    Promise.resolve({ data: null, error: null }),

    // Most contentious topics (nearest to 50/50)
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .eq('status', 'active')
      .gte('total_votes', 5)
      .gte('blue_pct', 40)
      .lte('blue_pct', 60)
      .order('total_votes', { ascending: false })
      .limit(6),

    // Recent Speaker's rulings (resolved reports)
    supabase
      .from('reports')
      .select('id, reason, action_taken, resolution_note, resolved_at, created_at, reported_content_type')
      .eq('status', 'resolved')
      .not('action_taken', 'is', null)
      .gte('resolved_at', thirtyDaysAgo)
      .order('resolved_at', { ascending: false })
      .limit(8),

    // Total resolved in 30 days
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved')
      .gte('resolved_at', thirtyDaysAgo),

    // Active / live debates
    supabase
      .from('debates')
      .select('id, title, status, viewer_count')
      .in('status', ['live', 'scheduled'])
      .order('viewer_count', { ascending: false })
      .limit(4),
  ])

  // If no elder, fall back to top user by reputation
  let speaker: SpeakerProfile | null = speakerRes.data as SpeakerProfile | null
  if (!speaker) {
    const fallback = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, role, clout, reputation_score, total_votes, total_arguments, vote_streak, civic_archetype, civic_oath_value, created_at')
      .order('reputation_score', { ascending: false })
      .limit(1)
      .single()
    speaker = fallback.data as SpeakerProfile | null
  }

  const contentiousTopics = (contentious50Res.data ?? []) as ContentiousTopic[]
  const recentRulings = (recentRulingsRes.data ?? []) as RulingRow[]
  const resolvedCount = totalResolvedRes.count ?? 0
  const activeDebates = (activeDebatesRes.data ?? []) as { id: string; title: string; status: string; viewer_count: number }[]

  // Manual chamber counts from topics select (no groupBy in supabase-js v2)
  const chamberTopicsRes = await supabase
    .from('topics')
    .select('status')
    .in('status', ['active', 'voting', 'proposed'])

  const chamberTopics = chamberTopicsRes.data ?? []
  const activeBills = chamberTopics.filter(t => t.status === 'active').length
  const votingBills = chamberTopics.filter(t => t.status === 'voting').length
  const proposedBills = chamberTopics.filter(t => t.status === 'proposed').length

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-24">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">

          {/* ── Document header ─────────────────────────────────────────── */}
          <div className="mb-8 border-b-2 border-surface-300 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Gavel className="h-5 w-5 text-gold" />
                  <span className="text-xs font-mono text-surface-500 tracking-widest uppercase">
                    Office of the Speaker
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-surface-900 tracking-tight">
                  The Speaker&apos;s Chair
                </h1>
                <p className="text-sm text-surface-500 mt-1">
                  Lobby Market — Civic Parliament
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                  Session
                </p>
                <p className="text-sm text-surface-700 font-medium mt-0.5">
                  {todayLabel}
                </p>
              </div>
            </div>

            {/* Chamber at a glance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Bills in Debate',   value: activeBills,   color: 'text-for-400',    icon: FileText },
                { label: 'At the Division',   value: votingBills,   color: 'text-gold',        icon: Vote },
                { label: 'Proposed Bills',    value: proposedBills, color: 'text-surface-600', icon: ScrollText },
                { label: 'Rulings This Month',value: resolvedCount, color: 'text-against-400', icon: Gavel },
              ].map(({ label, value, color, icon: Icon }) => (
                <div
                  key={label}
                  className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center"
                >
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                  <div className={cn('text-xl font-bold tabular-nums', color)}>{value}</div>
                  <div className="text-[10px] text-surface-500 leading-tight mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Part I: The Speaker ─────────────────────────────────────── */}
          <section className="mb-10">
            <SectionHeader
              number="Part I"
              icon={Crown}
              title="The Speaker"
              subtitle="Presiding officer of the Lobby — elected by citizens, impartial in all deliberations"
            />

            {speaker ? (
              <div className="mt-5">
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
                  {/* Speaker card */}
                  <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0">
                      <Avatar
                        url={speaker.avatar_url}
                        username={speaker.username}
                        size={56}
                        className="ring-2 ring-gold ring-offset-2 ring-offset-surface-100"
                      />
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gold/20 border border-gold flex items-center justify-center">
                        <Gavel className="h-2.5 w-2.5 text-gold" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-surface-900">
                          {speaker.display_name ?? speaker.username}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-gold bg-amber-950/50 border-amber-900">
                          <Gavel className="h-2.5 w-2.5" />
                          Speaker
                        </span>
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        @{speaker.username}
                        {speaker.civic_archetype && (
                          <span className="ml-2 text-purple">{speaker.civic_archetype}</span>
                        )}
                      </p>
                      {speaker.bio && (
                        <p className="text-sm text-surface-600 mt-2 leading-relaxed line-clamp-3">
                          {speaker.bio}
                        </p>
                      )}
                      {speaker.civic_oath_value && (
                        <blockquote className="mt-3 pl-3 border-l-2 border-gold text-sm text-gold italic leading-relaxed line-clamp-2">
                          &ldquo;{speaker.civic_oath_value}&rdquo;
                        </blockquote>
                      )}
                    </div>
                  </div>

                  {/* Speaker's civic record */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-surface-300">
                    {[
                      { label: 'Reputation',      value: speaker.reputation_score.toLocaleString(), color: 'text-gold' },
                      { label: 'Clout',            value: speaker.clout.toLocaleString(),            color: 'text-purple' },
                      { label: 'Votes Cast',       value: speaker.total_votes.toLocaleString(),      color: 'text-for-400' },
                      { label: 'Arguments Made',   value: speaker.total_arguments.toLocaleString(),  color: 'text-against-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <div className={cn('text-lg font-bold tabular-nums', color)}>{value}</div>
                        <div className="text-[10px] text-surface-500 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <Link
                      href={`/profile/${speaker.username}`}
                      className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-amber-400 transition-colors font-medium"
                    >
                      View Speaker&apos;s Profile
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                    <span className="text-surface-400 text-xs">·</span>
                    <span className="text-xs text-surface-500">
                      In the chair since {formatDate(speaker.created_at)}
                    </span>
                  </div>
                </div>

                {/* Constitutional note */}
                <div className="mt-3 flex items-start gap-2 px-1">
                  <Info className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-surface-500 leading-relaxed">
                    The Speaker is determined by the highest-reputation Elder citizen of the Lobby.
                    By convention, the Speaker acts impartially and does not vote on civic topics
                    except when casting a deciding vote to break an exact tie.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 text-center py-8 text-surface-500 text-sm">
                The Speaker&apos;s Chair is currently vacant. Elder citizens may present themselves for election.
              </div>
            )}
          </section>

          {/* ── Part II: Speaker's Powers ───────────────────────────────── */}
          <section className="mb-10">
            <SectionHeader
              number="Part II"
              icon={Shield}
              title="Speaker&apos;s Constitutional Powers"
              subtitle="The formal powers vested in the Office of the Speaker by the Lobby Charter"
            />

            <div className="mt-4 space-y-3">
              {SPEAKER_POWERS.map((power, i) => (
                <div
                  key={power.title}
                  className="flex items-start gap-4 px-4 py-3.5 rounded-lg border border-surface-300/50 bg-surface-100/40"
                >
                  <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
                    <power.icon className={cn('h-3.5 w-3.5', power.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-800">{power.title}</p>
                    <p className="text-xs text-surface-500 mt-1 leading-relaxed">{power.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Part III: Points of Order — Casting Vote Topics ─────────── */}
          {contentiousTopics.length > 0 && (
            <section className="mb-10">
              <SectionHeader
                number="Part III"
                icon={Vote}
                title="Casting Vote — Contested Matters"
                subtitle="Topics within the 40–60% band where the Speaker's casting vote may be required"
              />

              <div className="mt-4 space-y-0.5">
                {contentiousTopics.map((topic, i) => {
                  const forPct = Math.round(topic.blue_pct ?? 50)
                  const againstPct = 100 - forPct
                  const deviation = Math.abs(forPct - 50)
                  const isTied = deviation <= 2

                  return (
                    <Link
                      key={topic.id}
                      href={`/topic/${topic.id}`}
                      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
                    >
                      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {isTied ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-gold bg-amber-950/50 border-amber-900 animate-pulse">
                              <Gavel className="h-2.5 w-2.5" />
                              Speaker&apos;s Vote Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-surface-500 bg-surface-200/50 border-surface-300">
                              Contested — ±{deviation}%
                            </span>
                          )}
                          {topic.category && (
                            <span className={cn('text-xs font-medium', categoryColor(topic.category))}>
                              {topic.category}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                          {topic.statement}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-for-400 font-medium">{forPct}% For</span>
                          <span className="text-against-400 font-medium">{againstPct}% Against</span>
                          {(topic.total_votes ?? 0) > 0 && (
                            <span className="text-surface-500">
                              {(topic.total_votes ?? 0).toLocaleString()} votes
                            </span>
                          )}
                        </div>
                        <div className="h-1 w-full rounded-full bg-surface-300 mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-500"
                            style={{ width: `${forPct}%` }}
                          />
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
                    </Link>
                  )
                })}
              </div>

              <div className="mt-3 px-4">
                <Link
                  href="/topics"
                  className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                >
                  View all active topics
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          )}

          {/* ── Part IV: Speaker's Rulings ──────────────────────────────── */}
          <section className="mb-10">
            <SectionHeader
              number="Part IV"
              icon={Gavel}
              title="Speaker&apos;s Rulings"
              subtitle={`Points of order adjudicated in the last 30 days — ${resolvedCount} total rulings`}
            />

            {recentRulings.length === 0 ? (
              <div className="mt-4 text-center py-8">
                <Gavel className="h-8 w-8 text-surface-400 mx-auto mb-3" />
                <p className="text-sm text-surface-500">No rulings issued in the past 30 days.</p>
                <p className="text-xs text-surface-400 mt-1">The chamber has been orderly.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {recentRulings.map((ruling, i) => {
                  const reasonLabel = RULING_REASON_LABEL[ruling.reason] ?? ruling.reason
                  const actionMeta = RULING_ACTION_LABEL[ruling.action_taken ?? ''] ??
                    { label: ruling.action_taken ?? 'Adjudicated', color: 'text-surface-500' }

                  return (
                    <div
                      key={ruling.id}
                      className="flex items-start gap-4 px-4 py-3.5 rounded-lg border border-surface-300/50 bg-surface-100/30"
                    >
                      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-surface-500 bg-surface-200/50 border-surface-300 capitalize">
                            {ruling.reported_content_type}
                          </span>
                          <span className={cn('text-xs font-medium', actionMeta.color)}>
                            {actionMeta.label}
                          </span>
                        </div>
                        <p className="text-sm text-surface-700 font-medium leading-snug">
                          {reasonLabel}
                        </p>
                        {ruling.resolution_note && (
                          <p className="text-xs text-surface-500 mt-1 leading-relaxed line-clamp-2 italic">
                            &ldquo;{ruling.resolution_note}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-surface-400 mt-1.5">
                          {ruling.resolved_at ? relativeTime(ruling.resolved_at) : relativeTime(ruling.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-3 px-4">
              <Link
                href="/moderation"
                className="inline-flex items-center gap-1.5 text-xs text-against-400 hover:text-against-300 transition-colors"
              >
                Full moderation record
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          {/* ── Part V: Chamber in Session ──────────────────────────────── */}
          {activeDebates.length > 0 && (
            <section className="mb-10">
              <SectionHeader
                number="Part V"
                icon={Mic}
                title="Chamber in Session"
                subtitle="Live and scheduled debates currently before the Lobby"
              />

              <div className="mt-4 space-y-3">
                {activeDebates.map((debate, i) => {
                  const isLive = debate.status === 'live'
                  return (
                    <Link
                      key={debate.id}
                      href={`/debate/${debate.id}`}
                      className="group flex items-start gap-4 px-4 py-3.5 hover:bg-surface-200/30 transition-colors rounded-lg -mx-2"
                    >
                      <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-against-400 bg-against-950/50 border-against-900 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-against-400 inline-block" />
                              Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase border text-surface-500 bg-surface-200/50 border-surface-300">
                              Scheduled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-surface-800 font-medium leading-snug group-hover:text-white transition-colors line-clamp-1">
                          {debate.title}
                        </p>
                        {isLive && debate.viewer_count > 0 && (
                          <p className="text-xs text-against-400 mt-1">
                            {debate.viewer_count} watching
                          </p>
                        )}
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-700 flex-shrink-0 mt-0.5 transition-colors" />
                    </Link>
                  )
                })}
              </div>

              <div className="mt-3 px-4">
                <Link
                  href="/debate"
                  className="inline-flex items-center gap-1.5 text-xs text-against-400 hover:text-against-300 transition-colors"
                >
                  View all debates
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          )}

          {/* ── Part VI: Parliamentary Links ─────────────────────────────── */}
          <section className="mb-10">
            <SectionHeader
              number="Part VI"
              icon={Network}
              title="Parliamentary Offices"
              subtitle="All formal organs of the Lobby parliament overseen by the Speaker"
            />

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PARLIAMENTARY_LINKS.map(({ label, href, color, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-300/70 bg-surface-100/40 hover:bg-surface-200/40 transition-colors"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
                    <Icon className={cn('h-3.5 w-3.5', color)} />
                  </div>
                  <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900 transition-colors flex-1">
                    {label}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-surface-400 group-hover:text-surface-600 transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="border-t border-surface-300 pt-6 mt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 text-xs text-surface-500">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  The Office of the Speaker is impartial and independent of all coalitions and factions.
                  Rulings are drawn from the Lobby&apos;s moderation record and are binding.
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link
                  href="/order-paper"
                  className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                >
                  <ScrollText className="h-3 w-3" />
                  Order Paper
                </Link>
                <Link
                  href="/civic-questions"
                  className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-amber-400 transition-colors"
                >
                  <Mic className="h-3 w-3" />
                  Q&amp;A Time
                </Link>
              </div>
            </div>
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
