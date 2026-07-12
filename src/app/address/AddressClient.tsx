'use client'

/**
 * /address — State of the Lobby Address
 *
 * A formal, auto-generated periodic address covering:
 *   I.   Opening Declaration
 *   II.  The Legislative Record (laws passed, session stats)
 *   III. The State of Discourse (debate quality, argument activity)
 *   IV.  Civic Champions (top contributors)
 *   V.   Category Health (how each domain is faring)
 *   VI.  The Legislative Agenda (active & contested topics)
 *   VII. Closing Commitment
 *
 * Inspired by the UK King's Speech and the US State of the Union.
 * Content is drawn entirely from live platform data — no editorial input.
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Flame,
  Gavel,
  Globe,
  MessageSquare,
  Mic,
  Scale,
  Scroll,
  ScrollText,
  Sparkles,
  Trophy,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { AddressData, AddressLaw, AddressChampion, AddressCategoryHealth } from '@/app/api/address/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function formatLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function consensusLabel(pct: number): string {
  if (pct >= 80) return 'overwhelming consensus'
  if (pct >= 65) return 'strong consensus'
  if (pct >= 55) return 'majority consensus'
  return 'contested consensus'
}

function discourseHealth(passRate: number, avgConsensus: number): { label: string; color: string } {
  const score = (passRate / 100) * 0.4 + ((avgConsensus - 50) / 50) * 0.6
  if (score >= 0.7) return { label: 'Excellent', color: 'text-emerald' }
  if (score >= 0.5) return { label: 'Healthy', color: 'text-for-400' }
  if (score >= 0.3) return { label: 'Moderate', color: 'text-gold' }
  return { label: 'Developing', color: 'text-against-400' }
}

const CATEGORY_ICONS: Record<string, string> = {
  Economics: '📊',
  Politics: '🏛️',
  Technology: '💻',
  Science: '🔬',
  Ethics: '⚖️',
  Philosophy: '🧠',
  Culture: '🎨',
  Health: '🏥',
  Environment: '🌿',
  Education: '📚',
}

const ROLE_TITLE: Record<string, string> = {
  elder: 'Elder',
  senator: 'Senator',
  lawmaker: 'Lawmaker',
  troll_catcher: 'Troll Catcher',
  debator: 'Debater',
  person: 'Citizen',
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  senator: 'text-purple',
  lawmaker: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  number,
  title,
  subtitle,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  number: string
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300/60 bg-surface-100 overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-surface-200/40 transition-colors"
      >
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
          <Icon className="h-5 w-5 text-for-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-0.5">
            {number}
          </p>
          <h2 className="font-mono text-base font-bold text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs font-mono text-surface-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 border-t border-surface-300/40">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  value,
  label,
  sub,
  color = 'text-white',
}: {
  value: number | string
  label: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4 flex flex-col gap-1">
      <span className={cn('text-2xl font-mono font-bold', color)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </span>
      <span className="text-xs font-mono text-surface-600">{label}</span>
      {sub && <span className="text-[11px] font-mono text-surface-500">{sub}</span>}
    </div>
  )
}

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({ law }: { law: AddressLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const label = consensusLabel(forPct)

  return (
    <Link
      href={`/law/${law.id}`}
      className="flex items-start gap-3 py-3 hover:bg-surface-200/40 rounded-xl px-2 -mx-2 transition-colors group"
    >
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0 mt-0.5">
        <Gavel className="h-3.5 w-3.5 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {law.category && (
            <span className="text-[11px] font-mono text-surface-500">{law.category}</span>
          )}
          <span className="text-[11px] font-mono text-gold">
            {forPct}% FOR · {label}
          </span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white flex-shrink-0 mt-1 transition-colors" />
    </Link>
  )
}

// ─── Champion row ─────────────────────────────────────────────────────────────

function ChampionRow({ champion, rank }: { champion: AddressChampion; rank: number }) {
  const roleTitle = ROLE_TITLE[champion.role] ?? 'Citizen'
  const roleColor = ROLE_COLOR[champion.role] ?? 'text-surface-500'

  return (
    <Link
      href={`/profile/${champion.username}`}
      className="flex items-center gap-3 py-3 px-2 -mx-2 hover:bg-surface-200/40 rounded-xl transition-colors group"
    >
      <span className="w-6 text-center text-sm font-mono font-bold text-surface-500 flex-shrink-0">
        {rank}
      </span>
      <Avatar
        src={champion.avatar_url}
        fallback={champion.display_name || champion.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-semibold text-white truncate group-hover:text-for-300 transition-colors">
          {champion.display_name || champion.username}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[11px] font-mono font-medium', roleColor)}>{roleTitle}</span>
          <span className="text-[11px] font-mono text-surface-500">
            {champion.clout.toLocaleString()} clout
          </span>
          {champion.vote_streak > 0 && (
            <span className="text-[11px] font-mono text-gold">
              {champion.vote_streak}d streak
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: AddressCategoryHealth }) {
  const lawRate = cat.total_topics > 0 ? Math.round((cat.laws_passed / cat.total_topics) * 100) : 0
  const icon = CATEGORY_ICONS[cat.category] ?? '📋'

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-base w-6 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-mono text-white font-medium">{cat.category}</span>
          <span className="text-xs font-mono text-surface-500 flex-shrink-0">
            {cat.laws_passed} law{cat.laws_passed !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-700"
            style={{ width: `${Math.min(100, lawRate * 2)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] font-mono text-surface-500">
            {formatLarge(cat.total_votes)} votes
          </span>
          {cat.laws_passed > 0 && (
            <span className="text-[11px] font-mono text-gold">
              {cat.avg_consensus}% avg consensus
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  data: AddressData | null
}

export function AddressClient({ data }: Props) {
  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <ScrollText className="h-10 w-10 text-surface-500 mx-auto mb-4" />
          <p className="font-mono text-surface-500">Unable to load the address. Please try again.</p>
        </main>
        <BottomNav />
      </div>
    )
  }

  const health = discourseHealth(data.law_passage_rate, data.avg_consensus_on_laws)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-6">

        {/* ── Official header ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gold/30 bg-gradient-to-br from-surface-100 via-surface-100 to-gold/5 p-7"
        >
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Scroll className="h-7 w-7 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono text-gold uppercase tracking-widest">
                  Official Address
                </span>
                <span className="text-[11px] font-mono text-surface-500">·</span>
                <span className="text-[11px] font-mono text-surface-500">
                  Session {ordinal(data.session_number)}
                </span>
              </div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                State of the Lobby
              </h1>
              <p className="font-mono text-sm text-surface-500 mt-1">
                {data.period_label} · Lobby Market Civic Assembly
              </p>
            </div>
          </div>

          {/* Opening paragraph */}
          <div className="mt-6 pt-5 border-t border-surface-300/40">
            <p className="font-mono text-sm text-surface-600 leading-relaxed">
              Citizens of the Lobby — this address presents the formal record of our{' '}
              <span className="text-gold">{ordinal(data.session_number)} legislative session</span>,
              covering the state of our laws, the health of our discourse, and the work that lies
              ahead. The platform now counts{' '}
              <span className="text-white">{formatLarge(data.total_citizens)} citizens</span>,{' '}
              <span className="text-gold">{data.total_laws} established laws</span>, and{' '}
              <span className="text-for-300">
                {formatLarge(data.total_votes)} votes
              </span>{' '}
              cast in the pursuit of consensus. Democracy is not a destination — it is a daily act.
            </p>
          </div>
        </motion.div>

        {/* ── I. The Numbers ─────────────────────────────────────────────── */}
        <Section number="I" title="The Legislative Record" icon={Gavel}
          subtitle={`${data.total_laws} laws established · ${data.new_laws_this_week} this week`}
        >
          <div className="pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile value={data.total_laws} label="Laws Established" color="text-gold" />
            <StatTile value={data.total_topics} label="Topics Debated" color="text-for-400" />
            <StatTile
              value={`${data.law_passage_rate}%`}
              label="Passage Rate"
              sub="of resolved topics"
              color="text-emerald"
            />
            <StatTile
              value={`${data.avg_consensus_on_laws}%`}
              label="Avg Consensus"
              sub="on passed laws"
              color="text-purple"
            />
          </div>

          {data.new_laws_this_week > 0 && (
            <div className="mt-5 rounded-xl bg-gold/5 border border-gold/20 p-4">
              <p className="text-xs font-mono text-gold font-semibold mb-1 uppercase tracking-wider">
                This Week
              </p>
              <p className="text-sm font-mono text-surface-600">
                The Lobby established{' '}
                <span className="text-gold font-semibold">{data.new_laws_this_week} new law{data.new_laws_this_week !== 1 ? 's' : ''}</span>,
                debated{' '}
                <span className="text-white">{data.new_topics_this_week} topics</span>,
                and welcomed{' '}
                <span className="text-for-300">{data.new_citizens_this_week} new citizens</span>{' '}
                to the civic assembly.
              </p>
            </div>
          )}

          {data.recent_laws.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                Most Recent Laws
              </p>
              <div className="divide-y divide-surface-300/40">
                {data.recent_laws.map((law) => (
                  <LawRow key={law.id} law={law} />
                ))}
              </div>
              <Link
                href="/law"
                className="mt-3 flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-white transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Browse the full Codex
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </Section>

        {/* ── II. State of Discourse ─────────────────────────────────────── */}
        <Section
          number="II"
          title="The State of Discourse"
          icon={MessageSquare}
          subtitle={`${formatLarge(data.total_arguments)} arguments · ${data.active_debate_count} debates live`}
        >
          <div className="pt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatTile
              value={formatLarge(data.total_arguments)}
              label="Arguments Made"
              color="text-for-300"
            />
            <StatTile
              value={data.total_debates}
              label="Debates Held"
              color="text-purple"
            />
            <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4 flex flex-col gap-1">
              <span className={cn('text-2xl font-mono font-bold', health.color)}>
                {health.label}
              </span>
              <span className="text-xs font-mono text-surface-600">Discourse Health</span>
              <span className="text-[11px] font-mono text-surface-500">
                {data.law_passage_rate}% pass rate · {data.avg_consensus_on_laws}% avg consensus
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-surface-200/40 border border-surface-300/40 p-4">
            <p className="text-sm font-mono text-surface-600 leading-relaxed">
              The quality of our civic discourse remains{' '}
              <span className={health.color}>{health.label.toLowerCase()}</span>. Of all topics that
              have reached resolution, <span className="text-white">{data.law_passage_rate}%</span>{' '}
              achieved the consensus required to become law, with an average of{' '}
              <span className="text-gold">{data.avg_consensus_on_laws}% support</span> at passage.
              {data.active_debate_count > 0 && (
                <>
                  {' '}
                  There are currently{' '}
                  <span className="text-purple">
                    {data.active_debate_count} live debate{data.active_debate_count !== 1 ? 's' : ''}
                  </span>{' '}
                  in progress.
                </>
              )}
            </p>
          </div>

          {data.active_debate_count > 0 && (
            <Link
              href="/debate"
              className="mt-3 flex items-center gap-1.5 text-xs font-mono text-purple hover:text-white transition-colors"
            >
              <Mic className="h-3.5 w-3.5" />
              View live debates
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </Section>

        {/* ── III. Civic Champions ───────────────────────────────────────── */}
        {data.champions.length > 0 && (
          <Section
            number="III"
            title="Civic Champions"
            icon={Trophy}
            subtitle="Distinguished citizens of the Lobby"
          >
            <div className="pt-5 divide-y divide-surface-300/40">
              {data.champions.map((champion, i) => (
                <ChampionRow key={champion.id} champion={champion} rank={i + 1} />
              ))}
            </div>
            <Link
              href="/leaderboard"
              className="mt-4 flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-white transition-colors"
            >
              <Award className="h-3.5 w-3.5" />
              Full leaderboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Section>
        )}

        {/* ── IV. Category Health ────────────────────────────────────────── */}
        {data.category_health.length > 0 && (
          <Section
            number="IV"
            title="Domain Health Report"
            icon={BarChart2}
            subtitle="Legislative activity across 10 civic domains"
          >
            <div className="pt-5 divide-y divide-surface-300/40">
              {data.category_health.map((cat) => (
                <CategoryRow key={cat.category} cat={cat} />
              ))}
            </div>
            <Link
              href="/categories"
              className="mt-4 flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-white transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              Browse by category
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Section>
        )}

        {/* ── V. Legislative Agenda ─────────────────────────────────────── */}
        {data.legislative_priorities.length > 0 && (
          <Section
            number="V"
            title="The Legislative Agenda"
            icon={Scale}
            subtitle="Topics currently before the assembly"
            defaultOpen={false}
          >
            <div className="pt-5 space-y-2.5">
              {data.legislative_priorities.map((topic) => {
                const forPct = Math.round(topic.blue_pct ?? 50)
                const isVoting = topic.status === 'voting'
                return (
                  <Link
                    key={topic.id}
                    href={`/topic/${topic.id}`}
                    className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                        {topic.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {topic.category && (
                          <span className="text-[11px] font-mono text-surface-500">
                            {topic.category}
                          </span>
                        )}
                        {isVoting ? (
                          <span className="text-[11px] font-mono font-semibold text-purple">
                            VOTING NOW
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-for-400">Active</span>
                        )}
                        <span className="text-[11px] font-mono text-surface-500">
                          {forPct}% FOR
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[11px] font-mono text-surface-500">
                        {(topic.total_votes ?? 0).toLocaleString()} votes
                      </span>
                      <div className="h-1 w-16 rounded-full bg-surface-300/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-for-500 transition-all"
                          style={{ width: `${forPct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            <Link
              href="/topics"
              className="mt-4 flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-white transition-colors"
            >
              <Vote className="h-3.5 w-3.5" />
              All active topics
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Section>
        )}

        {/* ── VI. Contested Matters ─────────────────────────────────────── */}
        {data.contested.length > 0 && (
          <Section
            number="VI"
            title="Contested Matters"
            icon={Flame}
            subtitle="The most divided topics in the assembly"
            defaultOpen={false}
          >
            <div className="pt-5 space-y-2.5">
              {data.contested.map((topic) => {
                const forPct = Math.round(topic.blue_pct ?? 50)
                const againstPct = 100 - forPct
                return (
                  <Link
                    key={topic.id}
                    href={`/topic/${topic.id}`}
                    className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-against-500/40 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-against-300 transition-colors">
                        {topic.statement}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400"
                            style={{ width: `${forPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-for-400 flex-shrink-0">
                          {forPct}%
                        </span>
                        <span className="text-[11px] font-mono text-surface-500 flex-shrink-0">vs</span>
                        <span className="text-[11px] font-mono text-against-400 flex-shrink-0">
                          {againstPct}%
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── VII. Closing ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-for-500/20 bg-gradient-to-br from-surface-100 to-for-950/30 p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-5 w-5 text-for-400" />
            <span className="text-xs font-mono text-for-400 uppercase tracking-widest">
              VII · Closing Declaration
            </span>
          </div>
          <p className="font-mono text-sm text-surface-600 leading-relaxed">
            The work of democracy is never finished. Each vote cast, each argument made, and each
            debate joined is a brick in the edifice of civic life. The Lobby stands at{' '}
            <span className="text-gold">{data.total_laws} laws</span> — each one a testament to
            what we can achieve when we reason together.{' '}
            <span className="text-white">The assembly continues.</span>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <Vote className="h-4 w-4" />
              Cast Your Vote
            </Link>
            <Link
              href="/order-paper"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-700 hover:text-white text-sm font-mono font-semibold transition-colors border border-surface-300"
            >
              <ScrollText className="h-4 w-4" />
              Order Paper
            </Link>
            <Link
              href="/law"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-700 hover:text-white text-sm font-mono font-semibold transition-colors border border-surface-300"
            >
              <Gavel className="h-4 w-4" />
              The Codex
            </Link>
          </div>
        </motion.div>

        {/* Metadata footer */}
        <p className="text-center text-[11px] font-mono text-surface-500">
          Address auto-generated from live platform data ·{' '}
          {new Date(data.generated_at).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
