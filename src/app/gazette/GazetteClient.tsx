'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  Newspaper,
  Share2,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { GazetteData } from '@/app/api/gazette/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VoteBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[11px] font-mono text-for-400 w-8 text-right shrink-0">{Math.round(pct)}%</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div className="h-full bg-for-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-against-400 w-8 shrink-0">{100 - Math.round(pct)}%</span>
    </div>
  )
}

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-surface-500" />
      <span className="text-[11px] font-semibold tracking-widest uppercase text-surface-500">{label}</span>
      <div className="flex-1 h-px bg-surface-300" />
    </div>
  )
}

function StatPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-surface-100 border border-surface-300">
      <span className={cn('text-lg font-bold tabular-nums', color)}>{value.toLocaleString()}</span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wide">{label}</span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyEdition({ date }: { date: string }) {
  return (
    <div className="text-center py-16 px-6">
      <Newspaper className="w-10 h-10 text-surface-500 mx-auto mb-3" />
      <p className="text-surface-400 text-sm">No civic activity recorded for {formatShortDate(date)}.</p>
      <p className="text-surface-600 text-xs mt-1">The Lobby was quiet on this date.</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GazetteClient({ data }: { data: GazetteData | null }) {
  const today = new Date().toISOString().slice(0, 10)
  const isToday = !data || data.date === today

  function handleShare() {
    const url = window.location.href
    const text = data
      ? `The Civic Gazette — Edition #${data.edition_number} · ${formatShortDate(data.date)} on Lobby Market`
      : 'The Civic Gazette on Lobby Market'
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  const hasMeaningfulContent =
    data && (data.top_law || data.featured_debate || data.top_argument || data.stats.votes_today > 0)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28 space-y-6">

        {/* ── Masthead ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Decorative rule */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-surface-300" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-surface-500 shrink-0">
              Civic Record
            </span>
            <div className="flex-1 h-px bg-surface-300" />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight text-white">
              The Civic Gazette
            </h1>
            <div className="flex items-center justify-center gap-3 mt-1">
              {data && (
                <span className="text-[11px] text-surface-500 font-mono">
                  Edition #{data.edition_number}
                </span>
              )}
              <span className="text-surface-700 text-[11px]">·</span>
              <span className="text-[11px] text-surface-400">
                {data ? formatLongDate(data.date) : '—'}
              </span>
            </div>
          </div>

          {/* Double rule */}
          <div className="flex flex-col gap-0.5 mt-3">
            <div className="h-px bg-surface-300" />
            <div className="h-px bg-surface-300" />
          </div>
        </motion.div>

        {/* ── Date navigation ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between"
        >
          {data?.previous_date ? (
            <Link
              href={`/gazette/${data.previous_date}`}
              className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors group"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              {formatShortDate(data.previous_date)}
            </Link>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {!isToday && (
              <Link
                href="/gazette"
                className="text-[11px] text-for-400 hover:text-for-300 transition-colors font-medium"
              >
                Today&apos;s edition
              </Link>
            )}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors text-xs text-surface-300 hover:text-white"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>

          {data?.next_date ? (
            <Link
              href={`/gazette/${data.next_date}`}
              className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors group"
            >
              {formatShortDate(data.next_date)}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <span />
          )}
        </motion.div>

        {/* ── No content ─────────────────────────────────────────────────── */}
        {!hasMeaningfulContent && data && <EmptyEdition date={data.date} />}

        {hasMeaningfulContent && (
          <>
            {/* ── Daily Stats ────────────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <SectionHeading icon={BarChart2} label="Today's Record" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatPill value={data!.stats.votes_today} label="Votes Cast" color="text-for-400" />
                <StatPill value={data!.stats.arguments_written} label="Arguments" color="text-purple" />
                <StatPill value={data!.stats.topics_created} label="Proposed" color="text-surface-300" />
                <StatPill value={data!.stats.laws_established} label="Laws Made" color="text-gold" />
              </div>
            </motion.section>

            {/* ── Top Law ─────────────────────────────────────────────────── */}
            {data!.top_law && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <SectionHeading icon={Gavel} label="Law Established" />
                <Link href={`/topic/${data!.top_law.id}`}>
                  <div className="group rounded-2xl bg-surface-100 border border-gold/30 hover:border-gold/60 transition-all p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold text-[10px] font-semibold uppercase tracking-wide">
                            <CheckCircle2 className="w-3 h-3" />
                            Established Law
                          </span>
                          {data!.top_law.category && (
                            <span className={cn('text-[10px] font-medium', CAT_COLOR[data!.top_law.category] ?? 'text-surface-400')}>
                              {data!.top_law.category}
                            </span>
                          )}
                        </div>
                        <p className="text-white font-semibold leading-snug text-base group-hover:text-for-100 transition-colors">
                          {data!.top_law.statement}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-surface-500 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <VoteBar pct={data!.top_law.blue_pct} />
                    <p className="text-[11px] text-surface-500 font-mono">
                      {data!.top_law.total_votes.toLocaleString()} votes
                    </p>
                  </div>
                </Link>
              </motion.section>
            )}

            {/* ── Featured Debate ──────────────────────────────────────────── */}
            {data!.featured_debate && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <SectionHeading icon={Flame} label="Top Debate" />
                <Link href={`/topic/${data!.featured_debate.id}`}>
                  <div className="group rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-200 transition-all p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
                            data!.featured_debate.status === 'voting'
                              ? 'bg-gold/15 text-gold'
                              : 'bg-for-900/40 text-for-400',
                          )}>
                            {data!.featured_debate.status === 'voting' ? 'Voting' : 'Active'}
                          </span>
                          {data!.featured_debate.category && (
                            <span className={cn('text-[10px] font-medium', CAT_COLOR[data!.featured_debate.category] ?? 'text-surface-400')}>
                              {data!.featured_debate.category}
                            </span>
                          )}
                        </div>
                        <p className="text-white font-semibold leading-snug group-hover:text-for-100 transition-colors">
                          {data!.featured_debate.statement}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-surface-500 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <VoteBar pct={data!.featured_debate.blue_pct} />
                    <div className="flex items-center gap-4 text-[11px] text-surface-500">
                      <span className="font-mono">{data!.featured_debate.total_votes.toLocaleString()} votes</span>
                      {data!.featured_debate.view_count > 0 && (
                        <span>{data!.featured_debate.view_count.toLocaleString()} views</span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.section>
            )}

            {/* ── Top Argument ─────────────────────────────────────────────── */}
            {data!.top_argument && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <SectionHeading icon={MessageSquare} label="Argument of the Day" />
                <Link href={`/topic/${data!.top_argument.topic_id}`}>
                  <div className="group rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-200 transition-all p-5 space-y-3">
                    {/* Author */}
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={data!.top_argument.author_avatar_url}
                        fallback={data!.top_argument.author_display_name ?? data!.top_argument.author_username}
                        size="xs"
                      />
                      <span className="text-xs text-surface-300 font-medium">
                        {data!.top_argument.author_display_name ?? data!.top_argument.author_username}
                      </span>
                      <span
                        className={cn(
                          'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          data!.top_argument.side === 'for'
                            ? 'bg-for-900/40 text-for-400'
                            : 'bg-against-900/40 text-against-400',
                        )}
                      >
                        {data!.top_argument.side === 'for' ? 'For' : 'Against'}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-surface-200 text-sm leading-relaxed line-clamp-4 group-hover:text-white transition-colors">
                      {data!.top_argument.content}
                    </p>

                    {/* Topic ref */}
                    <p className="text-[11px] text-surface-500 line-clamp-1">
                      On: <span className="text-surface-400">{data!.top_argument.topic_statement}</span>
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="flex items-center gap-1 text-emerald">
                        <ThumbsUp className="w-3 h-3" />
                        {data!.top_argument.upvotes.toLocaleString()} upvotes
                      </span>
                      {data!.top_argument.ai_score != null && (
                        <span className="text-purple font-mono">
                          AI Score: {Math.round(data!.top_argument.ai_score * 100)}
                        </span>
                      )}
                      <span className="text-surface-600 ml-auto">
                        {relTime(data!.top_argument.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.section>
            )}

            {/* ── Rising Topics ────────────────────────────────────────────── */}
            {data!.rising_topics.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <SectionHeading icon={TrendingUp} label="New Today" />
                <div className="space-y-2">
                  {data!.rising_topics.map((t, i) => (
                    <Link key={t.id} href={`/topic/${t.id}`}>
                      <div className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-200 transition-all">
                        <span className="text-xl font-black text-surface-700 w-6 text-center shrink-0 tabular-nums">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-200 line-clamp-2 group-hover:text-white transition-colors leading-snug">
                            {t.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {t.category && (
                              <span className={cn('text-[10px]', CAT_COLOR[t.category] ?? 'text-surface-500')}>
                                {t.category}
                              </span>
                            )}
                            <span className="text-[10px] text-surface-600 font-mono">
                              {t.total_votes} votes
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-surface-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── Top Voice ────────────────────────────────────────────────── */}
            {data!.top_voice && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <SectionHeading icon={Award} label="Citizen of the Day" />
                <Link href={`/profile/${data!.top_voice.username}`}>
                  <div className="group rounded-2xl bg-surface-100 border border-gold/20 hover:border-gold/40 transition-all p-5">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar
                          src={data!.top_voice.avatar_url}
                          fallback={data!.top_voice.display_name ?? data!.top_voice.username}
                          size="lg"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                          <Award className="w-3 h-3 text-surface-50" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold group-hover:text-gold transition-colors">
                          {data!.top_voice.display_name ?? data!.top_voice.username}
                        </p>
                        <p className="text-[11px] text-surface-500">@{data!.top_voice.username}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-400">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="w-3 h-3" />
                            {data!.top_voice.votes_today} votes today
                          </span>
                          {data!.top_voice.arguments_today > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {data!.top_voice.arguments_today} arguments
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-gold ml-auto">
                            <Zap className="w-3 h-3" />
                            {data!.top_voice.clout.toLocaleString()} clout
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-surface-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.section>
            )}
          </>
        )}

        {/* ── Footer nav ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-4 border-t border-surface-300"
        >
          <div className="flex items-center justify-between text-xs text-surface-600">
            <Link href="/gazette/archive" className="hover:text-surface-300 transition-colors">
              Archive
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/trending" className="hover:text-surface-300 transition-colors">Trending</Link>
              <Link href="/law" className="hover:text-surface-300 transition-colors">Laws</Link>
              <Link href="/debate" className="hover:text-surface-300 transition-colors">Debates</Link>
            </div>
          </div>
        </motion.div>

      </main>

      <BottomNav />
    </div>
  )
}
