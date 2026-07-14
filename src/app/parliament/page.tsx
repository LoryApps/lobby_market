import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  Crown,
  FileText,
  Flag,
  Landmark,
  Mic,
  Scale,
  ScrollText,
  Shield,
  Swords,
  Users,
  Vote,
  Zap,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertCircle,
  MessageSquare,
  ClipboardList,
  BarChart3,
  HelpCircle,
  BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'The Civic Parliament · Lobby Market',
  description:
    "The Lobby's full Westminster-style parliament — Speaker's Chair, Order Paper, Committee Reports, Shadow Cabinet, Grand Council, and all democratic bodies in one place.",
  openGraph: {
    title: 'The Civic Parliament · Lobby Market',
    description:
      'Every democratic body in the Lobby — from the Speaker to the Grand Council — in one unified parliament hub.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Parliament · Lobby Market',
    description:
      'The unified hub for all parliamentary proceedings in the Lobby Market.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
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
  if (days < 7) return `${days}d ago`
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
}

function categoryColor(cat: string | null): string {
  return CATEGORY_COLORS[cat ?? ''] ?? 'text-surface-500'
}

const WHIP_STRENGTH_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Three-Line Whip', color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' },
  strong:   { label: 'Two-Line Whip',   color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' },
  advisory: { label: 'One-Line Whip',   color: 'text-for-400',     bg: 'bg-for-500/10 border-for-500/30' },
}

const RECOMMENDATION_CONFIG = {
  for:     { icon: CheckCircle2, label: 'Recommend FOR',     color: 'text-for-400',     bg: 'bg-for-500/10' },
  against: { icon: XCircle,      label: 'Recommend AGAINST', color: 'text-against-400', bg: 'bg-against-500/10' },
  neutral: { icon: MinusCircle,  label: 'No Recommendation', color: 'text-surface-500', bg: 'bg-surface-200' },
  hold:    { icon: AlertCircle,  label: 'Hold / Refer Back', color: 'text-gold',        bg: 'bg-gold/10' },
} as const

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  href,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  href: string
  badge?: string
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-surface-200 border border-surface-300">
          <Icon className="h-4 w-4 text-for-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-wider uppercase">{title}</h2>
          {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="px-2 py-0.5 rounded-full bg-against-500/20 border border-against-500/30 text-against-400 text-[10px] font-mono font-bold">
            {badge}
          </span>
        )}
      </div>
      <Link
        href={href}
        className="flex items-center gap-1 text-xs text-surface-500 hover:text-for-400 transition-colors"
      >
        View all
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

// ─── Parliamentary body card ──────────────────────────────────────────────────

interface ParliamentaryBody {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  status?: string
  statusColor?: string
  count?: number
  countLabel?: string
}

function BodyCard({ body }: { body: ParliamentaryBody }) {
  const Icon = body.icon
  return (
    <Link
      href={body.href}
      className={cn(
        'group relative flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-200',
        'hover:scale-[1.01] hover:shadow-lg',
        body.bg, body.border,
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-xl border', body.bg, body.border)}>
          <Icon className={cn('h-5 w-5', body.color)} />
        </div>
        {body.status && (
          <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', body.statusColor)}>
            {body.status}
          </span>
        )}
        {!body.status && (
          <ArrowUpRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
        )}
      </div>
      <div>
        <h3 className="text-sm font-bold text-white">{body.title}</h3>
        <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{body.description}</p>
      </div>
      {body.count !== undefined && (
        <div className="flex items-center gap-1.5 mt-auto">
          <span className={cn('text-lg font-mono font-bold', body.color)}>{body.count}</span>
          <span className="text-xs text-surface-500">{body.countLabel}</span>
        </div>
      )}
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ParliamentPage() {
  const supabase = await createClient()

  // Fetch all parliamentary data in parallel
  const [
    speakerRes,
    orderPaperRes,
    reportsRes,
    motionsRes,
    hearingsRes,
    whipRes,
  ] = await Promise.allSettled([
    // Speaker: top moderator by reputation
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .eq('role', 'troll_catcher')
      .order('reputation_score', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Order Paper: topics currently in voting phase
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('status', 'voting')
      .order('total_votes', { ascending: false })
      .limit(5),

    // Committee Reports: latest published
    supabase
      .from('civic_committee_reports')
      .select('id, title, summary, category, recommendation, endorsement_count, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(4),

    // Grand Council: active motions
    supabase
      .from('council_motions')
      .select('id, title, effect, status, votes_for, votes_against, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(4),

    // Hearings: open
    supabase
      .from('civic_hearings')
      .select('id, title, committee, status, testimony_count, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(3),

    // Whip guidance: active coalition whips
    supabase
      .from('coalition_whip_guidance')
      .select('id, direction, strength, message, created_at, topic:topics!coalition_whip_guidance_topic_id_fkey(statement, category), coalition:coalitions!coalition_whip_guidance_coalition_id_fkey(name, slug)')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(4),
  ])

  const speaker = speakerRes.status === 'fulfilled' ? speakerRes.value.data : null
  const orderPaper = orderPaperRes.status === 'fulfilled' ? (orderPaperRes.value.data ?? []) : []
  const reports = reportsRes.status === 'fulfilled' ? (reportsRes.value.data ?? []) : []
  const motions = motionsRes.status === 'fulfilled' ? (motionsRes.value.data ?? []) : []
  const hearings = hearingsRes.status === 'fulfilled' ? (hearingsRes.value.data ?? []) : []
  const whipGuidance = whipRes.status === 'fulfilled' ? (whipRes.value.data ?? []) : []

  // Count whip guidance by strength for the stat
  const criticalWhips = whipGuidance.filter((w: Record<string, unknown>) => w.strength === 'critical').length

  // Parliamentary bodies config
  const bodies: ParliamentaryBody[] = [
    {
      title: "The Speaker's Chair",
      description: 'Presiding officer who maintains order and rules on procedural matters.',
      href: '/speaker',
      icon: Crown,
      color: 'text-gold',
      bg: 'bg-gold/5',
      border: 'border-gold/20',
      status: speaker ? 'In Session' : 'Vacant',
      statusColor: speaker ? 'bg-emerald/10 border-emerald/30 text-emerald' : 'bg-surface-300 border-surface-400 text-surface-600',
    },
    {
      title: 'Order Paper',
      description: "Today's parliamentary business — voting items, debates, and pending legislation.",
      href: '/order-paper',
      icon: ClipboardList,
      color: 'text-for-400',
      bg: 'bg-for-500/5',
      border: 'border-for-500/20',
      count: orderPaper.length,
      countLabel: 'active items',
    },
    {
      title: 'Select Committees',
      description: 'Ten standing committees scrutinising policy across all civic domains. Follow inquiries, submit evidence.',
      href: '/committees',
      icon: Scale,
      color: 'text-for-400',
      bg: 'bg-for-500/5',
      border: 'border-for-500/20',
      count: 10,
      countLabel: 'standing committees',
    },
    {
      title: 'Committee Reports',
      description: 'Formal findings and policy recommendations from civic inquiry committees.',
      href: '/committee-reports',
      icon: FileText,
      color: 'text-purple',
      bg: 'bg-purple/5',
      border: 'border-purple/20',
      count: reports.length,
      countLabel: 'recent reports',
    },
    {
      title: 'Grand Council',
      description: 'Binding legislative motions — elevate topics, issue statements, call assemblies.',
      href: '/grand-council',
      icon: Landmark,
      color: 'text-gold',
      bg: 'bg-gold/5',
      border: 'border-gold/20',
      count: motions.length,
      countLabel: 'active motions',
    },
    {
      title: 'House of Lords',
      description: 'The revising chamber — Lords review newly established laws and vote to ratify or send them back.',
      href: '/lords',
      icon: Shield,
      color: 'text-gold',
      bg: 'bg-gold/5',
      border: 'border-gold/20',
      status: 'In Session',
      statusColor: 'bg-gold/10 border-gold/30 text-gold',
    },
    {
      title: 'HM Government',
      description: 'The ruling coalition, Prime Minister, and legislative programme in power.',
      href: '/government',
      icon: Crown,
      color: 'text-gold',
      bg: 'bg-gold/5',
      border: 'border-gold/20',
      status: 'In Power',
      statusColor: 'bg-gold/10 border-gold/30 text-gold',
    },
    {
      title: 'HM Opposition',
      description: "The Official Opposition — counter-programme, Leader, and bench holding the government to account.",
      href: '/opposition',
      icon: Flag,
      color: 'text-against-400',
      bg: 'bg-against-500/5',
      border: 'border-against-500/20',
      status: 'Opposition',
      statusColor: 'bg-against-500/10 border-against-500/30 text-against-400',
    },
    {
      title: 'Shadow Cabinet',
      description: "The opposition's top voices challenging the platform's leading positions.",
      href: '/shadow-cabinet',
      icon: Swords,
      color: 'text-against-400',
      bg: 'bg-against-500/5',
      border: 'border-against-500/20',
      status: 'Active',
      statusColor: 'bg-against-500/10 border-against-500/30 text-against-400',
    },
    {
      title: 'Civic Hearings',
      description: 'Formal evidence sessions where citizens and experts provide testimony.',
      href: '/hearings',
      icon: Mic,
      color: 'text-emerald',
      bg: 'bg-emerald/5',
      border: 'border-emerald/20',
      count: hearings.length,
      countLabel: 'open hearings',
    },
    {
      title: 'Civic Questions',
      description: 'Westminster-style Q&A — put formal questions to the Lobby leadership.',
      href: '/civic-questions',
      icon: MessageSquare,
      color: 'text-for-300',
      bg: 'bg-for-400/5',
      border: 'border-for-400/20',
      status: 'Open',
      statusColor: 'bg-for-500/10 border-for-500/30 text-for-400',
    },
    {
      title: 'Citizens Assembly',
      description: 'Representative panels deliberating on complex civic questions.',
      href: '/assembly',
      icon: Users,
      color: 'text-emerald',
      bg: 'bg-emerald/5',
      border: 'border-emerald/20',
    },
    {
      title: 'Oversight Committee',
      description: 'Scrutinising established laws for compliance, review and amendment.',
      href: '/oversight',
      icon: Shield,
      color: 'text-against-300',
      bg: 'bg-against-400/5',
      border: 'border-against-400/20',
    },
    {
      title: 'The Civic Ombudsman',
      description: 'Independent investigation of grievances and democratic complaints.',
      href: '/ombudsman',
      icon: Scale,
      color: 'text-gold',
      bg: 'bg-gold/5',
      border: 'border-gold/20',
    },
    {
      title: 'Civic Referendums',
      description: 'Direct democracy — platform-wide votes on constitutional questions.',
      href: '/civic-referendums',
      icon: Vote,
      color: 'text-purple',
      bg: 'bg-purple/5',
      border: 'border-purple/20',
    },
    {
      title: 'Address to the Nation',
      description: "The State of the Lobby — platform overview and forward agenda.",
      href: '/address',
      icon: ScrollText,
      color: 'text-for-300',
      bg: 'bg-for-400/5',
      border: 'border-for-400/20',
    },
  ]

  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pb-24 pt-6">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          {/* Title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-for-500/10 border border-for-500/20">
              <Landmark className="h-7 w-7 text-for-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                The Civic Parliament
              </h1>
              <p className="text-sm text-surface-500 mt-1 max-w-xl">
                The Lobby&apos;s Westminster-style democratic chamber — every body, every proceeding,
                every voice in one unified parliament.
              </p>
            </div>
          </div>

          {/* Speaker spotlight */}
          {speaker && (
            <div className="p-4 rounded-2xl bg-gold/5 border border-gold/20 flex items-center gap-4 mb-4">
              <div className="p-2 rounded-xl bg-gold/10 border border-gold/20">
                <Crown className="h-4 w-4 text-gold" />
              </div>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar
                  src={speaker.avatar_url}
                  fallback={speaker.display_name || speaker.username}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-xs text-gold/70 font-mono uppercase tracking-wider">
                    Speaker of the Lobby
                  </p>
                  <p className="text-sm font-bold text-white truncate">
                    {speaker.display_name || speaker.username}
                  </p>
                </div>
                <div className="ml-auto text-right flex-shrink-0">
                  <p className="text-xs text-surface-500">Clout</p>
                  <p className="text-sm font-mono font-bold text-gold">{speaker.clout.toLocaleString()}</p>
                </div>
              </div>
              <Link
                href="/speaker"
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/20 transition-colors"
              >
                Speaker&apos;s Chair
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* Quick stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-surface-200 border border-surface-300 text-center">
              <p className="text-lg font-mono font-bold text-for-400">{orderPaper.length}</p>
              <p className="text-[11px] text-surface-500 mt-0.5">Items to vote</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-200 border border-surface-300 text-center">
              <p className="text-lg font-mono font-bold text-against-400">{criticalWhips}</p>
              <p className="text-[11px] text-surface-500 mt-0.5">Three-line whips</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-200 border border-surface-300 text-center">
              <p className="text-lg font-mono font-bold text-purple">{motions.length}</p>
              <p className="text-[11px] text-surface-500 mt-0.5">Active motions</p>
            </div>
          </div>
        </div>

        {/* ── Parliamentary Bodies Grid ──────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-surface-500 uppercase tracking-widest">
              Parliamentary Bodies
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bodies.map((body) => (
              <BodyCard key={body.href} body={body} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="space-y-8">

            {/* Order Paper */}
            <section>
              <SectionHeader
                icon={ClipboardList}
                title="Order Paper"
                subtitle="Topics currently before the house for a vote"
                href="/order-paper"
                badge={orderPaper.length > 0 ? `${orderPaper.length} items` : undefined}
              />
              {orderPaper.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-200/60 border border-surface-300/60 text-center">
                  <p className="text-xs text-surface-500">No topics currently in the voting phase.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderPaper.map((topic: Record<string, unknown>, i: number) => {
                    const forPct = Math.round((topic.blue_pct as number) ?? 50)
                    const isLeading = forPct >= 50
                    return (
                      <Link
                        key={topic.id as string}
                        href={`/topic/${topic.id as string}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200 transition-all"
                      >
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-surface-300 text-[10px] font-mono font-bold text-surface-500">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{topic.statement as string}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn('text-[10px]', categoryColor(topic.category as string | null))}>
                              {topic.category as string}
                            </span>
                            <span className="text-[10px] text-surface-600">·</span>
                            <span className="text-[10px] text-surface-500">
                              {(topic.total_votes as number).toLocaleString()} votes
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className={cn('text-xs font-mono font-bold', isLeading ? 'text-for-400' : 'text-against-400')}>
                            {isLeading ? `${forPct}% For` : `${100 - forPct}% Ag.`}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Coalition Whip Guidance */}
            <section>
              <SectionHeader
                icon={Bell}
                title="Whip Guidance"
                subtitle="Active coalition voting instructions"
                href="/whips"
                badge={criticalWhips > 0 ? `${criticalWhips} critical` : undefined}
              />
              {whipGuidance.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-200/60 border border-surface-300/60 text-center">
                  <p className="text-xs text-surface-500">No active whip guidance issued.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(whipGuidance as Record<string, unknown>[]).map((whip) => {
                    const strengthConfig = WHIP_STRENGTH_LABEL[whip.strength as string] ?? WHIP_STRENGTH_LABEL.advisory
                    const topic = whip.topic as Record<string, unknown> | null
                    const coalition = whip.coalition as Record<string, unknown> | null
                    return (
                      <div
                        key={whip.id as string}
                        className={cn('p-3 rounded-xl border', strengthConfig.bg)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', strengthConfig.color)}>
                            {strengthConfig.label}
                          </span>
                          <span className="text-[10px] text-surface-600 flex-shrink-0">
                            {relativeTime(whip.created_at as string)}
                          </span>
                        </div>
                        {topic && (
                          <p className="text-xs font-semibold text-white truncate mb-1">
                            {topic.statement as string}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          {coalition && (
                            <span className="text-[10px] text-surface-500">{coalition.name as string}</span>
                          )}
                          <span className="text-[10px] text-surface-600">·</span>
                          <span className={cn(
                            'text-[10px] font-bold uppercase',
                            whip.direction === 'for' ? 'text-for-400' : whip.direction === 'against' ? 'text-against-400' : 'text-surface-500'
                          )}>
                            Vote {whip.direction as string}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Civic Hearings */}
            <section>
              <SectionHeader
                icon={Mic}
                title="Active Hearings"
                subtitle="Open evidence sessions accepting testimony"
                href="/hearings"
              />
              {hearings.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-200/60 border border-surface-300/60 text-center">
                  <p className="text-xs text-surface-500">No hearings currently open.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(hearings as Record<string, unknown>[]).map((hearing) => (
                    <Link
                      key={hearing.id as string}
                      href={`/hearings/${hearing.id as string}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-emerald/20 hover:border-emerald/40 hover:bg-surface-200 transition-all"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald/10">
                        <Mic className="h-3.5 w-3.5 text-emerald" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{hearing.title as string}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn('text-[10px]', categoryColor(hearing.committee as string | null))}>
                            {hearing.committee as string}
                          </span>
                          {hearing.testimony_count != null && (
                            <>
                              <span className="text-[10px] text-surface-600">·</span>
                              <span className="text-[10px] text-surface-500">
                                {hearing.testimony_count as number} submissions
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/30 text-emerald">
                        OPEN
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div className="space-y-8">

            {/* Committee Reports */}
            <section>
              <SectionHeader
                icon={FileText}
                title="Committee Reports"
                subtitle="Latest findings and policy recommendations"
                href="/committee-reports"
              />
              {reports.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-200/60 border border-surface-300/60 text-center">
                  <p className="text-xs text-surface-500">No committee reports published yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(reports as Record<string, unknown>[]).map((report) => {
                    const rec = report.recommendation as keyof typeof RECOMMENDATION_CONFIG
                    const recConfig = RECOMMENDATION_CONFIG[rec] ?? RECOMMENDATION_CONFIG.neutral
                    const RecIcon = recConfig.icon
                    return (
                      <Link
                        key={report.id as string}
                        href={`/committee-reports/${report.id as string}`}
                        className="block p-3 rounded-xl bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200 transition-all"
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <RecIcon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', recConfig.color)} />
                          <p className="text-xs font-semibold text-white leading-tight line-clamp-2">
                            {report.title as string}
                          </p>
                        </div>
                        <p className="text-[11px] text-surface-500 line-clamp-2 mb-2 pl-5">
                          {report.summary as string}
                        </p>
                        <div className="flex items-center gap-2 pl-5">
                          <span className={cn('text-[10px] font-bold', recConfig.color)}>
                            {recConfig.label}
                          </span>
                          <span className="ml-auto text-[10px] text-surface-600">
                            {(report.endorsement_count as number)} endorsed
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Grand Council Motions */}
            <section>
              <SectionHeader
                icon={Landmark}
                title="Grand Council"
                subtitle="Active binding motions before the full council"
                href="/grand-council"
                badge={motions.length > 0 ? `${motions.length} active` : undefined}
              />
              {motions.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-200/60 border border-surface-300/60 text-center">
                  <p className="text-xs text-surface-500">No motions currently before the Council.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(motions as Record<string, unknown>[]).map((motion) => {
                    const total = ((motion.votes_for as number) || 0) + ((motion.votes_against as number) || 0)
                    const forPct = total > 0 ? Math.round(((motion.votes_for as number) / total) * 100) : 50
                    const EFFECT_LABEL: Record<string, string> = {
                      elevate_topic: 'Elevate Topic',
                      issue_statement: 'Issue Statement',
                      call_assembly: 'Call Assembly',
                    }
                    return (
                      <Link
                        key={motion.id as string}
                        href="/grand-council"
                        className="block p-3 rounded-xl bg-surface-200/60 border border-gold/20 hover:border-gold/40 hover:bg-surface-200 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-xs font-semibold text-white leading-tight line-clamp-2 flex-1">
                            {motion.title as string}
                          </p>
                          <span className="flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold">
                            {EFFECT_LABEL[motion.effect as string] ?? (motion.effect as string)}
                          </span>
                        </div>
                        {total > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                              <div
                                className="h-full bg-for-500 rounded-full"
                                style={{ width: `${forPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-surface-500 flex-shrink-0">
                              {motion.votes_for as number}–{motion.votes_against as number}
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] text-surface-600 mt-1">
                          {relativeTime(motion.created_at as string)}
                        </p>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Quick actions */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-3.5 w-3.5 text-surface-500" />
                <h2 className="text-xs font-bold text-surface-500 uppercase tracking-widest">
                  Parliamentary Actions
                </h2>
              </div>
              <div className="space-y-2">
                {[
                  { href: '/topic/create', label: 'Propose a Topic', sublabel: 'Start new civic legislation', icon: FileText, color: 'text-for-400' },
                  { href: '/committees', label: 'Select Committees', sublabel: 'Follow inquiries and submit evidence', icon: Scale, color: 'text-for-400' },
                  { href: '/committee-reports/new', label: 'Submit Committee Report', sublabel: 'Publish findings and recommendations', icon: ScrollText, color: 'text-purple' },
                  { href: '/grand-council', label: 'Table a Motion', sublabel: 'Move a binding resolution', icon: Landmark, color: 'text-gold' },
                  { href: '/civic-questions/ask', label: 'Ask a Question', sublabel: 'Submit to Civic Questions Time', icon: MessageSquare, color: 'text-for-300' },
                  { href: '/hearings/new', label: 'Open a Hearing', sublabel: 'Call for formal testimony', icon: Mic, color: 'text-emerald' },
                  { href: '/pmqs', label: 'Prime Minister\'s Questions', sublabel: 'Submit and upvote questions for the PM', icon: HelpCircle, color: 'text-gold' },
                  { href: '/adjournment', label: 'Adjournment Debates', sublabel: 'Apply to raise any civic issue at end of sitting', icon: Mic, color: 'text-purple' },
                  { href: '/urgent-questions', label: 'Urgent Questions', sublabel: 'Table a question demanding an immediate ministerial response', icon: Bell, color: 'text-gold' },
                  { href: '/hansard', label: 'The Civic Hansard', sublabel: 'Official daily record of all proceedings', icon: BookOpen, color: 'text-gold' },
                  { href: '/budget', label: 'The Civic Budget', sublabel: 'Annual allocation — approve or reject', icon: BarChart3, color: 'text-gold' },
                  { href: '/confidence', label: 'Motion of No Confidence', sublabel: 'Formally challenge the governing coalition', icon: Scale, color: 'text-against-400' },
                  { href: '/oversight', label: 'Review a Law', sublabel: 'Submit established law for scrutiny', icon: Shield, color: 'text-against-300' },
                  { href: '/consultations', label: 'Consultations', sublabel: 'Read Green & White Papers, submit your response', icon: FileText, color: 'text-emerald' },
                  { href: '/royal-assent', label: 'Royal Assent', sublabel: 'Elders formally seal established laws', icon: Crown, color: 'text-gold' },
                ].map((action) => {
                  const ActionIcon = action.icon
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200 transition-all group"
                    >
                      <ActionIcon className={cn('h-4 w-4 flex-shrink-0', action.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{action.label}</p>
                        <p className="text-[11px] text-surface-500">{action.sublabel}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </section>

          </div>
        </div>

        {/* ── Parliamentary Procedures footer ───────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-surface-300/60">
          <p className="text-[11px] text-surface-600 text-center max-w-lg mx-auto leading-relaxed">
            The Lobby Parliament operates on Westminster convention.{' '}
            <Link href="/civic-questions" className="text-for-400 hover:text-for-300 transition-colors">
              Ask a question
            </Link>
            {' '}to the leadership,{' '}
            <Link href="/speaker" className="text-gold hover:text-gold/80 transition-colors">
              raise a point of order
            </Link>
            {' '}with the Speaker, or{' '}
            <Link href="/grand-council" className="text-purple hover:text-purple/80 transition-colors">
              table a motion
            </Link>
            {' '}in the Grand Council.
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
