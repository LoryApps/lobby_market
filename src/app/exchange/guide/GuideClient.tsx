'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  GitMerge,
  Globe,
  Layers,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string
  title: string
  icon: typeof BarChart2
  color: string
}

interface FAQItem {
  q: string
  a: string
}

// ─── Navigation sections ──────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  { id: 'what',      title: 'What is the Exchange?', icon: Sparkles,   color: 'text-purple'      },
  { id: 'price',     title: 'Understanding Price',   icon: Coins,      color: 'text-gold'        },
  { id: 'signals',   title: 'Reading Signals',       icon: BarChart2,  color: 'text-for-400'     },
  { id: 'lifecycle', title: 'Market Lifecycle',      icon: GitMerge,   color: 'text-emerald'     },
  { id: 'strategy',  title: 'Strategy & Calls',      icon: TrendingUp, color: 'text-purple'      },
  { id: 'faq',       title: 'FAQ',                   icon: BookOpen,   color: 'text-surface-600' },
]

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS: FAQItem[] = [
  {
    q: 'Does voting cost anything?',
    a: 'No. Voting is free. Every logged-in user gets a daily vote allocation. The Exchange tracks consensus — not a real-money prediction market.',
  },
  {
    q: 'Can I change my vote?',
    a: 'Yes, until a topic enters the voting phase. Once voting is locked, your recorded position stands.',
  },
  {
    q: 'What happens when a market settles?',
    a: 'A market settles when community consensus crosses 66 % FOR (becomes Law) or drops below 34 % (Failed). Settled markets are archived and your prediction accuracy score is updated.',
  },
  {
    q: 'What is Clout?',
    a: 'Clout is your on-platform reputation currency. You earn it by voting correctly on markets that later settle, posting high-quality arguments, and completing civic missions.',
  },
  {
    q: 'What makes a market "Contested"?',
    a: 'Contested markets sit between 45 % and 55 % FOR. Neither side has a clear advantage — these are the most debated topics on the platform.',
  },
  {
    q: 'How is Volume calculated?',
    a: 'Volume is the total number of votes cast on a market — FOR and AGAINST combined. High-volume markets have broad community engagement.',
  },
  {
    q: 'What is a market\'s Momentum?',
    a: 'Momentum measures the direction and speed of recent consensus change. A market with +12 % momentum gained 12 percentage points FOR over the last 7 days.',
  },
  {
    q: 'How do I find markets to participate in?',
    a: 'Use the Exchange home for top markets by volume, the Screener for custom filters, or visit Near Law to see which debates are close to settling.',
  },
]

// ─── Price demo component ─────────────────────────────────────────────────────

function PriceDemo({ pct }: { pct: number }) {
  const forPct = Math.round(pct)
  const againstPct = 100 - forPct
  const isLaw = forPct >= 66
  const isFailed = forPct < 34
  const isContested = forPct >= 45 && forPct <= 55

  const color = isLaw
    ? 'text-gold'
    : isFailed
    ? 'text-against-400'
    : isContested
    ? 'text-purple'
    : forPct >= 50
    ? 'text-for-400'
    : 'text-against-300'

  return (
    <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4 space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={cn('text-4xl font-mono font-bold', color)}>{forPct}¢</p>
          <p className="text-xs text-surface-500 mt-0.5">current consensus price</p>
        </div>
        <div className="text-right">
          {isLaw && (
            <span className="text-xs font-mono font-semibold text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded">
              NEAR LAW
            </span>
          )}
          {isFailed && (
            <span className="text-xs font-mono font-semibold text-against-400 bg-against-500/10 border border-against-500/30 px-2 py-0.5 rounded">
              LIKELY FAIL
            </span>
          )}
          {isContested && (
            <span className="text-xs font-mono font-semibold text-purple bg-purple/10 border border-purple/30 px-2 py-0.5 rounded">
              CONTESTED
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-for-400">{forPct}% FOR</span>
          <span className="text-against-400">{againstPct}% AGAINST</span>
        </div>
        <div className="h-2 rounded-full bg-against-900/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-700 to-for-400 transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Signal pill ──────────────────────────────────────────────────────────────

function SignalPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border', color)}>
      <Zap className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl bg-surface-200/60 border border-surface-300/60 overflow-hidden"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-surface-300/30 transition-colors"
          >
            <span className="text-sm font-medium text-white">{item.q}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-surface-500 flex-shrink-0 transition-transform duration-200',
                open === i && 'rotate-180',
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-4 text-sm text-surface-600 leading-relaxed">{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  color,
  title,
  id,
}: {
  icon: typeof BarChart2
  color: string
  title: string
  id: string
}) {
  return (
    <div id={id} className="flex items-center gap-2.5 pt-2">
      <div className={cn('p-2 rounded-xl bg-surface-200/60', color.replace('text-', 'bg-').replace('400', '500/10').replace('600', '500/10'))}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GuideClient() {
  const [activeSection, setActiveSection] = useState('what')

  function scrollTo(id: string) {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <div className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-8"
        >
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exchange
          </Link>

          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-purple/10 border border-purple/20">
              <BookOpen className="h-6 w-6 text-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Exchange Guide</h1>
              <p className="text-sm text-surface-500 mt-1">
                Everything you need to read markets, understand signals, and make your call.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-8">
          {/* Sticky sidebar nav — desktop only */}
          <nav className="hidden lg:block w-52 flex-shrink-0">
            <div className="sticky top-20 space-y-1">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 px-2">
                Contents
              </p>
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left',
                    activeSection === s.id
                      ? 'bg-surface-200/80 text-white'
                      : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200/40',
                  )}
                >
                  <s.icon className={cn('h-3.5 w-3.5 flex-shrink-0', s.color)} />
                  {s.title}
                </button>
              ))}

              <div className="pt-4 border-t border-surface-300 mt-4 space-y-1.5">
                <Link
                  href="/exchange"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-surface-500 hover:text-white transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Browse Markets
                </Link>
                <Link
                  href="/exchange/screener"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-surface-500 hover:text-white transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Screener
                </Link>
                <Link
                  href="/exchange/near-law"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-surface-500 hover:text-white transition-colors"
                >
                  <Gavel className="h-3.5 w-3.5" />
                  Near Law
                </Link>
              </div>
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 space-y-10 min-w-0">

            {/* ── What is the Exchange ── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <SectionHeader id="what" icon={Sparkles} color="text-purple" title="What is the Exchange?" />

              <div className="mt-4 space-y-4 text-sm text-surface-600 leading-relaxed">
                <p>
                  The Civic Exchange is a <strong className="text-white">prediction market for civic consensus</strong>.
                  Every debate topic on Lobby Market is listed as a market. The price of a market reflects
                  what percentage of the community currently agrees with the proposition.
                </p>
                <p>
                  Unlike financial prediction markets, no real money changes hands. Instead, your{' '}
                  <strong className="text-white">vote is your position</strong>. Cast it FOR and you&apos;re long.
                  Cast it AGAINST and you&apos;re short. If the debate eventually settles in your direction,
                  your prediction accuracy score improves and you earn Clout.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 not-prose mt-5">
                  {[
                    { icon: Vote,    color: 'text-for-400',  bg: 'bg-for-500/10',  label: 'Vote = Position',    desc: 'Your FOR/AGAINST vote is your market call.' },
                    { icon: Coins,   color: 'text-gold',     bg: 'bg-gold/10',     label: '¢ = Consensus %',    desc: '72¢ means 72 % of voters are FOR.' },
                    { icon: Gavel,   color: 'text-emerald',  bg: 'bg-emerald/10',  label: 'Settlement = Law',   desc: 'A market closes when consensus crosses 66 %.' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2"
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', item.bg)}>
                        <item.icon className={cn('h-4 w-4', item.color)} />
                      </div>
                      <p className="text-xs font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-surface-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* ── Understanding Price ── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <SectionHeader id="price" icon={Coins} color="text-gold" title="Understanding Price" />

              <div className="mt-4 space-y-4 text-sm text-surface-600 leading-relaxed">
                <p>
                  Price is displayed in <strong className="text-white">cents (¢)</strong> and directly equals
                  the current FOR percentage. A price of <span className="text-for-400 font-mono font-semibold">68¢</span> means{' '}
                  68 % of current votes are FOR. Simple.
                </p>

                {/* Interactive demo */}
                <div className="not-prose space-y-3 mt-5">
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-widest">Price examples</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-mono text-gold uppercase tracking-wide">Near Law (≥66¢)</p>
                      <PriceDemo pct={72} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-mono text-purple uppercase tracking-wide">Contested (45–55¢)</p>
                      <PriceDemo pct={51} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-mono text-against-400 uppercase tracking-wide">Trending Down (&lt;34¢)</p>
                      <PriceDemo pct={28} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-200/50 border border-surface-300 p-4 flex gap-3 mt-2">
                  <Scale className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">Why ¢ instead of %?</p>
                    <p className="text-xs text-surface-500">
                      Thinking in cents frames each vote as a &quot;buy&quot; or &quot;sell&quot; decision.
                      If you believe a topic will eventually reach 80 % FOR and it currently trades at 50¢,
                      you have an edge. It makes the cost of being wrong — and the reward of being right — intuitive.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* ── Reading Signals ── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <SectionHeader id="signals" icon={BarChart2} color="text-for-400" title="Reading Signals" />

              <div className="mt-4 space-y-4 text-sm text-surface-600 leading-relaxed">
                <p>
                  Each market card shows signal pills that summarise its current state at a glance.
                  Here&apos;s what each one means:
                </p>

                <div className="not-prose space-y-3 mt-4">
                  {[
                    {
                      pill: { label: 'TRENDING', color: 'text-for-300 bg-for-700/30 border-for-500/30' },
                      desc: 'Gaining significant FOR votes over the last 7 days. Consensus is actively building.',
                    },
                    {
                      pill: { label: 'NEAR LAW', color: 'text-gold bg-gold/10 border-gold/30' },
                      desc: 'Above 66 % FOR. One more push and this debate becomes established Law.',
                    },
                    {
                      pill: { label: 'CONTESTED', color: 'text-purple bg-purple/10 border-purple/30' },
                      desc: 'Between 45 % and 55 % FOR. No clear majority — the debate is genuinely split.',
                    },
                    {
                      pill: { label: 'DEADLOCK', color: 'text-against-300 bg-against-700/20 border-against-500/30' },
                      desc: 'Has been Contested for 14+ days with no meaningful consensus shift. Both sides are dug in.',
                    },
                    {
                      pill: { label: 'ENDING SOON', color: 'text-amber-400 bg-amber-900/20 border-amber-500/30' },
                      desc: 'Voting deadline is within 48 hours. Make your call now or miss the settlement.',
                    },
                    {
                      pill: { label: 'GAINING', color: 'text-emerald bg-emerald/10 border-emerald/30' },
                      desc: 'Moderate upward momentum — more FOR votes coming in than AGAINST over recent days.',
                    },
                  ].map((item) => (
                    <div
                      key={item.pill.label}
                      className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 p-3.5"
                    >
                      <div className="pt-0.5">
                        <SignalPill label={item.pill.label} color={item.pill.color} />
                      </div>
                      <p className="text-xs text-surface-500 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-for-900/30 border border-for-700/30 p-4 mt-3">
                  <p className="text-xs font-semibold text-for-300 mb-1">Tip: Layer your signals</p>
                  <p className="text-xs text-surface-500">
                    A market showing <span className="text-gold">NEAR LAW</span> + <span className="text-for-300">TRENDING</span>{' '}
                    has both the price AND the momentum to settle. That&apos;s a high-conviction setup.
                    A <span className="text-purple">CONTESTED</span> + <span className="text-against-300">DEADLOCK</span>{' '}
                    market may stay range-bound for weeks.
                  </p>
                </div>
              </div>
            </motion.section>

            {/* ── Market Lifecycle ── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <SectionHeader id="lifecycle" icon={GitMerge} color="text-emerald" title="Market Lifecycle" />

              <div className="mt-4 space-y-4 text-sm text-surface-600 leading-relaxed">
                <p>
                  Every market moves through five stages. Understanding where a market is in its lifecycle
                  tells you how much time you have to make a call — and how stable the consensus is.
                </p>

                <div className="not-prose space-y-2 mt-4">
                  {[
                    {
                      stage: 'PROPOSED',
                      color: 'text-surface-500 bg-surface-300/30 border-surface-400/30',
                      desc: 'Topic submitted. Not yet gathering votes. Community can signal support before activation.',
                      detail: 'Need enough support votes to become Active.',
                    },
                    {
                      stage: 'ACTIVE',
                      color: 'text-for-400 bg-for-500/10 border-for-500/30',
                      desc: 'The live debate phase. FOR and AGAINST votes are being cast. Price moves freely.',
                      detail: 'This is the primary market phase — where most voting happens.',
                    },
                    {
                      stage: 'VOTING',
                      color: 'text-purple bg-purple/10 border-purple/30',
                      desc: 'Final settlement phase. A deadline has been set. Price is locked for the final count.',
                      detail: 'Outcomes become final at the deadline.',
                    },
                    {
                      stage: 'LAW',
                      color: 'text-gold bg-gold/10 border-gold/30',
                      desc: 'Consensus reached ≥66 % FOR. The proposition is an established Lobby Law.',
                      detail: 'Settled market. Appears in the Law Codex.',
                    },
                    {
                      stage: 'FAILED',
                      color: 'text-against-400 bg-against-500/10 border-against-500/30',
                      desc: 'Consensus fell below 34 % FOR or voting period expired without majority. The proposal is rejected.',
                      detail: 'Settled market. Archived in the Exchange.',
                    },
                  ].map((item) => (
                    <div key={item.stage} className="flex gap-3 rounded-xl bg-surface-100 border border-surface-300 p-3.5">
                      <div className="pt-0.5">
                        <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border', item.color)}>
                          {item.stage}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-surface-600">{item.desc}</p>
                        <p className="text-[11px] text-surface-500 italic">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* ── Strategy & Calls ── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <SectionHeader id="strategy" icon={TrendingUp} color="text-purple" title="Strategy & Calls" />

              <div className="mt-4 space-y-4 text-sm text-surface-600 leading-relaxed">
                <p>
                  Beyond casting a FOR or AGAINST vote, the Exchange gives you tools to build a{' '}
                  <strong className="text-white">structured position</strong>. A Market Idea lets you
                  document your thesis, set a target price, and track your call over time.
                </p>

                <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {[
                    {
                      icon: TrendingUp,
                      color: 'text-for-400',
                      bg: 'bg-for-500/10',
                      title: 'Contrarian Play',
                      desc: 'Market at 30¢ but you believe consensus will build. Get in early, ride the momentum to 60¢+.',
                    },
                    {
                      icon: Scale,
                      color: 'text-purple',
                      bg: 'bg-purple/10',
                      title: 'Contested Fade',
                      desc: 'A Deadlocked market at 50¢ is stuck. Wait for a catalyst — an argument breakthrough or debate outcome.',
                    },
                    {
                      icon: Flame,
                      color: 'text-gold',
                      bg: 'bg-gold/10',
                      title: 'Near-Law Momentum',
                      desc: 'A market at 63¢ trending up. Three percentage points from Law. High probability settlement play.',
                    },
                    {
                      icon: TrendingDown,
                      color: 'text-against-400',
                      bg: 'bg-against-500/10',
                      title: 'AGAINST the Trend',
                      desc: 'Sometimes the crowd is wrong. If you have a strong case AGAINST a trending topic, make it and defend it.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', item.bg)}>
                          <item.icon className={cn('h-3.5 w-3.5', item.color)} />
                        </div>
                        <p className="text-xs font-semibold text-white">{item.title}</p>
                      </div>
                      <p className="text-xs text-surface-500">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-surface-200/50 border border-surface-300 p-4 mt-3 flex gap-3">
                  <Users className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">Make your argument count</p>
                    <p className="text-xs text-surface-500">
                      Posting a high-quality argument FOR or AGAINST a topic directly moves the debate.
                      Arguments that get upvoted shift the conversation — and can swing undecided voters.
                      The best traders on the Exchange are also the best arguers.
                    </p>
                  </div>
                </div>

                {/* Quick links to strategy tools */}
                <div className="not-prose flex flex-wrap gap-2 mt-4">
                  {[
                    { label: 'Screener', href: '/exchange/screener', icon: Layers },
                    { label: 'Near Law', href: '/exchange/near-law', icon: Gavel },
                    { label: 'Momentum', href: '/exchange/momentum', icon: TrendingUp },
                    { label: 'Contested', href: '/exchange/conflicts', icon: Scale },
                    { label: 'Smart Money', href: '/exchange/smart-money', icon: Sparkles },
                    { label: 'Opportunity', href: '/exchange/opportunity', icon: Globe },
                  ].map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 text-xs text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                    >
                      <link.icon className="h-3 w-3" />
                      {link.label}
                      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* ── FAQ ── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <SectionHeader id="faq" icon={BookOpen} color="text-surface-600" title="FAQ" />
              <div className="mt-4">
                <FAQAccordion items={FAQS} />
              </div>
            </motion.section>

            {/* ── CTA ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="rounded-2xl bg-gradient-to-br from-for-900/60 to-purple/10 border border-for-700/30 p-6 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-for-500/20 border border-for-500/30 flex items-center justify-center mx-auto">
                <Zap className="h-6 w-6 text-for-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-white text-lg">Ready to make your first call?</h3>
                <p className="text-sm text-surface-500">
                  Browse the Exchange, find a market you have a view on, and cast your vote.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/exchange"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-for-500 hover:bg-for-600 text-white text-sm font-semibold transition-colors"
                >
                  Browse Markets
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/exchange/movers"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-400 text-white text-sm font-medium transition-colors"
                >
                  Today&apos;s Movers
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            {/* Progress checklist */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                Exchange Basics Checklist
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Understand what ¢ means',             href: null },
                  { label: 'Read at least one market signal',      href: null },
                  { label: 'Cast your first FOR or AGAINST vote',  href: '/exchange' },
                  { label: 'Post an argument on a market',         href: '/exchange' },
                  { label: 'Add a market to your watchlist',       href: '/exchange/watchlist' },
                  { label: 'Log a market idea with a target price', href: '/exchange/ideas' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-surface-500">
                    <div className="h-4 w-4 rounded border border-surface-400 flex-shrink-0" />
                    {item.href ? (
                      <Link href={item.href} className="hover:text-white transition-colors">
                        {item.label}
                        <ExternalLink className="inline h-2.5 w-2.5 ml-1 opacity-50" />
                      </Link>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
