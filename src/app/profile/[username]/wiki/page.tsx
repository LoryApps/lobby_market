import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  FileEdit,
  Gavel,
  Minus,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatChars(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
}

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'gold' | 'for' | 'against' | 'emerald' | 'purple' | 'neutral'
}) {
  const accentClass = {
    gold:    'text-gold',
    for:     'text-for-400',
    against: 'text-against-400',
    emerald: 'text-emerald',
    purple:  'text-purple',
    neutral: 'text-white',
  }[accent]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      <span className={cn('text-2xl font-black font-mono leading-none', accentClass)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('username', params.username)
    .single()

  const name = profile?.display_name ?? params.username

  return {
    title: `${name}'s Wiki Contributions · Lobby Market`,
    description: `See how ${name} has contributed to the Lobby Market civic wiki — edits made, topics improved, and knowledge shared.`,
    openGraph: {
      title: `${name}'s Wiki Contributions`,
      description: `${name}'s civic wiki editing history on Lobby Market — ${name} has helped grow the collective knowledge base.`,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/wiki`,
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Wiki Contributions · Lobby Market`,
      description: `How has ${name} shaped the Lobby Market wiki? Edits, topics improved, and contributions.`,
    },
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WikiEdit {
  id: string
  topic_id: string
  char_delta: number
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

interface TopicSummary {
  topicId: string
  statement: string
  category: string | null
  status: string
  editCount: number
  charsAdded: number
  lastEditedAt: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileWikiPage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  // 2. Current viewer (for "Your contributions" vs "name's contributions")
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id
  const displayName = profile.display_name ?? profile.username

  // 3. Fetch all wiki edits by this user
  const { data: rows } = await supabase
    .from('topic_wiki_history')
    .select(`
      id,
      topic_id,
      char_delta,
      created_at,
      topics!topic_wiki_history_topic_id_fkey(id, statement, category, status)
    `)
    .eq('editor_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const edits: WikiEdit[] = (rows ?? []).map((r) => {
    const raw = r as {
      id: string
      topic_id: string
      char_delta: number
      created_at: string
      topics: { id: string; statement: string; category: string | null; status: string } | null
    }
    return {
      id: raw.id,
      topic_id: raw.topic_id,
      char_delta: raw.char_delta ?? 0,
      created_at: raw.created_at,
      topic: raw.topics ?? null,
    }
  })

  // 4. Compute stats
  const totalEdits = edits.length
  const charsAdded = edits.reduce((s, e) => s + Math.max(0, e.char_delta), 0)
  const firstEditAt = edits.length > 0 ? edits[edits.length - 1].created_at : null

  // 5. Group by topic
  const topicMap = new Map<string, TopicSummary>()
  for (const edit of edits) {
    if (!edit.topic) continue
    const existing = topicMap.get(edit.topic_id)
    if (existing) {
      existing.editCount++
      existing.charsAdded += Math.max(0, edit.char_delta)
      // last edited = earliest in reversed list = first occurrence in our list
    } else {
      topicMap.set(edit.topic_id, {
        topicId: edit.topic_id,
        statement: edit.topic.statement,
        category: edit.topic.category,
        status: edit.topic.status,
        editCount: 1,
        charsAdded: Math.max(0, edit.char_delta),
        lastEditedAt: edit.created_at,
      })
    }
  }
  const topicSummaries = Array.from(topicMap.values()).sort(
    (a, b) => b.editCount - a.editCount || b.charsAdded - a.charsAdded,
  )

  const topicsImproved = topicSummaries.length

  // 6. Build category breakdown
  const catCounts: Record<string, number> = {}
  for (const t of topicSummaries) {
    const cat = t.category ?? 'Other'
    catCounts[cat] = (catCounts[cat] ?? 0) + t.editCount
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
            className="rounded-2xl ring-2 ring-surface-400/30 flex-shrink-0"
          />
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              {isOwner ? 'Your' : `${displayName}'s`} Wiki Contributions
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {totalEdits > 0 ? (
                <>
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald">
                    <Edit3 className="h-3 w-3" />
                    {totalEdits} edit{totalEdits !== 1 ? 's' : ''}
                  </span>
                  <span className="text-surface-600">·</span>
                  <span className="text-[11px] font-mono text-surface-400">
                    {topicsImproved} topic{topicsImproved !== 1 ? 's' : ''} improved
                  </span>
                  {firstEditAt && (
                    <>
                      <span className="text-surface-600">·</span>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                        <Clock className="h-3 w-3" />
                        since {new Date(firstEditAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-xs font-mono text-surface-500">No wiki contributions yet</span>
              )}
            </div>
          </div>
        </div>

        {totalEdits === 0 ? (
          <EmptyState
            icon={FileEdit}
            title={isOwner ? 'No wiki contributions yet' : `${displayName} hasn't contributed to the wiki`}
            description={
              isOwner
                ? 'Pick any topic and tap "Edit" on the wiki section to share your knowledge with the community.'
                : 'Check back later — this citizen hasn\'t edited any topic wikis yet.'
            }
            actions={isOwner ? [{ label: 'Browse topics', href: '/topics' }] : undefined}
          />
        ) : (
          <>
            {/* ── Stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard
                label="Total edits"
                value={totalEdits}
                sub="contributions made"
                accent="emerald"
              />
              <StatCard
                label="Topics improved"
                value={topicsImproved}
                sub="unique articles"
                accent="purple"
              />
              <StatCard
                label="Chars added"
                value={charsAdded > 0 ? `+${formatChars(charsAdded)}` : '—'}
                sub="net knowledge added"
                accent={charsAdded > 0 ? 'for' : 'neutral'}
              />
            </div>

            {/* ── Category breakdown ────────────────────────────────── */}
            {topCategories.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Top categories
                  </h2>
                </div>
                <div className="space-y-2">
                  {topCategories.map(([cat, count]) => {
                    const colors = getCategoryColor(cat)
                    const pct = Math.round((count / totalEdits) * 100)
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className={cn(
                          'text-[10px] font-mono w-24 flex-shrink-0 uppercase tracking-wide',
                          colors.text,
                        )}>
                          {cat}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', colors.bg.replace('/10', '/60'))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-surface-500 w-8 text-right">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Nav breadcrumb ────────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {[
                { href: `/profile/${profile.username}`,           label: 'Profile' },
                { href: `/profile/${profile.username}/votes`,     label: 'Votes' },
                { href: `/profile/${profile.username}/arguments`, label: 'Arguments' },
                { href: `/profile/${profile.username}/wiki`,      label: 'Wiki', active: true },
                { href: `/profile/${profile.username}/reviews`,   label: 'Reviews' },
              ].map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                    active
                      ? 'bg-emerald/10 border-emerald/30 text-emerald'
                      : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* ── Topics list ───────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  {topicsImproved} article{topicsImproved !== 1 ? 's' : ''} contributed to
                </h2>
                <Link
                  href="/wiki"
                  className="text-xs font-mono text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors"
                >
                  Wiki portal
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {topicSummaries.map((t) => {
                const colors = getCategoryColor(t.category)
                const isLaw = t.status === 'law'
                return (
                  <div
                    key={t.topicId}
                    className={cn(
                      'rounded-xl border p-4 transition-colors',
                      isLaw
                        ? 'bg-gold/5 border-gold/20 hover:border-gold/30'
                        : 'bg-surface-100 border-surface-300 hover:border-surface-400',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Edit count badge */}
                      <div className={cn(
                        'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl text-sm font-black font-mono',
                        isLaw
                          ? 'bg-gold/20 text-gold border border-gold/30'
                          : 'bg-emerald/10 text-emerald border border-emerald/30',
                      )}>
                        {t.editCount}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Topic statement */}
                        <Link
                          href={`/topic/${t.topicId}`}
                          className="group flex items-start gap-1.5 mb-2"
                        >
                          {isLaw && (
                            <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-sm font-mono font-semibold text-surface-100 group-hover:text-white transition-colors line-clamp-2 leading-snug">
                            {t.statement}
                          </span>
                        </Link>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.category && (
                            <span className={cn(
                              'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
                              colors.text, colors.bg, colors.border,
                            )}>
                              {t.category}
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
                            <Edit3 className="h-3 w-3" />
                            {t.editCount} edit{t.editCount !== 1 ? 's' : ''}
                          </span>

                          {t.charsAdded > 0 && (
                            <span className="text-[10px] font-mono text-for-400 flex items-center gap-0.5">
                              <Plus className="h-3 w-3" />
                              {formatChars(t.charsAdded)} chars
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relativeTime(t.lastEditedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Link
                          href={`/topic/${t.topicId}`}
                          className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                          title="View topic"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/topic/${t.topicId}#wiki`}
                          className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald/10 text-emerald hover:bg-emerald/20 transition-colors"
                          title="View wiki"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Recent edits feed ────────────────────────────────── */}
            <div className="mt-8 space-y-3">
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Recent edit history
              </h2>

              {edits.slice(0, 20).map((edit) => {
                const colors = getCategoryColor(edit.topic?.category ?? null)
                return (
                  <div
                    key={edit.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-surface-300/60 bg-surface-100/60 hover:border-surface-400/60 transition-colors"
                  >
                    {/* Delta indicator */}
                    <div className={cn(
                      'flex items-center gap-0.5 flex-shrink-0 w-14 font-mono text-xs font-semibold',
                      edit.char_delta > 0
                        ? 'text-for-400'
                        : edit.char_delta < 0
                        ? 'text-against-400'
                        : 'text-surface-500',
                    )}>
                      {edit.char_delta > 0 ? (
                        <Plus className="h-3 w-3" />
                      ) : edit.char_delta < 0 ? (
                        <Minus className="h-3 w-3" />
                      ) : null}
                      {Math.abs(edit.char_delta)}
                    </div>

                    {/* Topic */}
                    <div className="flex-1 min-w-0">
                      {edit.topic ? (
                        <Link
                          href={`/topic/${edit.topic.id}#wiki`}
                          className="text-xs font-mono text-surface-300 hover:text-white transition-colors line-clamp-1"
                        >
                          {edit.topic.statement}
                        </Link>
                      ) : (
                        <span className="text-xs font-mono text-surface-600 italic">Topic deleted</span>
                      )}
                    </div>

                    {/* Category + time */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {edit.topic?.category && (
                        <span className={cn(
                          'text-[9px] font-mono uppercase tracking-wide hidden sm:block',
                          colors.text,
                        )}>
                          {edit.topic.category}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-surface-600">
                        {relativeTime(edit.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}

              {edits.length > 20 && (
                <p className="text-center text-xs font-mono text-surface-600 pt-2">
                  Showing 20 of {edits.length} edits
                </p>
              )}
            </div>

            {/* ── Footer CTA (owner only) ─────────────────────────── */}
            {isOwner && (
              <div className="mt-8 rounded-2xl border border-emerald/20 bg-emerald/5 p-5 text-center">
                <BookOpen className="h-5 w-5 text-emerald mx-auto mb-2" />
                <h3 className="font-mono text-sm font-bold text-white mb-1">
                  Keep contributing
                </h3>
                <p className="text-xs font-mono text-surface-500 mb-4">
                  Every wiki edit helps the community understand the debates better.
                  The more you contribute, the stronger the collective knowledge base becomes.
                </p>
                <Link
                  href="/wiki"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald/20 border border-emerald/30 text-emerald text-sm font-mono font-semibold hover:bg-emerald/30 transition-colors"
                >
                  <FileEdit className="h-4 w-4" />
                  Open the wiki portal
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
