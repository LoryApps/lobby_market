import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  HelpCircle,
  Shield,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Community Guidelines · Lobby Market',
  description:
    'The rules and norms that govern participation on Lobby Market.',
}

const PRINCIPLES = [
  {
    num: '1',
    title: 'Argue in good faith',
    description:
      'Engage with the actual argument being made. Don\'t strawman, misrepresent, or selectively quote. If you disagree, explain why.',
  },
  {
    num: '2',
    title: 'Keep it about ideas',
    description:
      'Criticise positions, not people. Ad hominem attacks — targeting a user\'s identity, character, or history rather than their argument — will result in a strike.',
  },
  {
    num: '3',
    title: 'One vote, one voice',
    description:
      'Do not attempt to manipulate vote counts through multiple accounts, vote trading, or coordinated inauthentic behaviour. Each citizen\'s vote should reflect their genuine opinion.',
  },
  {
    num: '4',
    title: 'Source your claims',
    description:
      'Extraordinary claims require extraordinary evidence. When making factual assertions in a debate, be prepared to cite sources. Fabricating statistics or studies is grounds for a ban.',
  },
  {
    num: '5',
    title: 'Write laws that last',
    description:
      'When proposing topics or revising laws, write clearly and precisely. Ambiguous or self-contradictory laws weaken the Codex. If a law is flawed, file a revision or repeal petition.',
  },
  {
    num: '6',
    title: 'Respect the process',
    description:
      'The voting system is the core of the platform. Attempting to game the consensus mechanism — through botting, sockpuppeting, or Clout manipulation — is the most serious offense.',
  },
]

const ALLOWED = [
  'Disagreeing strongly with any position',
  'Voting against the perceived consensus',
  'Proposing controversial or unpopular topics',
  'Filing repeal petitions for existing laws',
  'Criticising other arguments, even harshly',
  'Using satire and irony in debates',
  'Proposing revisions to laws you dislike',
  'Leaving discussions or abstaining from votes',
]

const NOT_ALLOWED = [
  'Personal attacks, slurs, or harassment',
  'Doxing or revealing private information',
  'Coordinated inauthentic voting (multi-accounting)',
  'Spam or repetitive low-quality content',
  'Impersonating other users or public figures',
  'Deliberate misinformation presented as fact',
  'Attempting to manipulate the Clout system',
  'Ban evasion after a legitimate moderation action',
]

const STRIKE_SYSTEM = [
  {
    strikes: '1 strike',
    consequence: 'Warning and reduced Clout',
    color: 'text-gold',
    bg: 'bg-gold/10',
  },
  {
    strikes: '2 strikes',
    consequence: '7-day suspension from creating topics',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
  },
  {
    strikes: '3 strikes',
    consequence: 'Permanent ban from debates and topic creation',
    color: 'text-against-500',
    bg: 'bg-against-500/15',
  },
]

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-10 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
              <Shield className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-3xl text-white">
                Community Guidelines
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The rules that govern participation on Lobby Market.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-surface-500 flex-wrap">
            <Link
              href="/about"
              className="flex items-center gap-1.5 hover:text-for-400 transition-colors"
            >
              About the platform
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href="/help"
              className="flex items-center gap-1.5 hover:text-for-400 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Preamble */}
        <section className="mb-10">
          <div className="rounded-2xl border border-gold/20 bg-gold/5 px-6 py-5">
            <p className="text-sm font-mono text-surface-600 leading-relaxed">
              Lobby Market is designed around structured disagreement. We expect — and
              welcome — strong opinions, heated debates, and outcomes that not everyone
              agrees with. That is the point. What we do not tolerate is bad-faith
              behaviour that corrupts the process. These guidelines define the line.
            </p>
          </div>
        </section>

        {/* Core principles */}
        <section className="mb-12">
          <h2 className="font-mono font-bold text-base uppercase tracking-widest text-gold mb-5">
            Core principles
          </h2>
          <div className="space-y-4">
            {PRINCIPLES.map((p) => (
              <div
                key={p.num}
                className="flex gap-4 rounded-xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-200 text-xs font-mono font-bold text-surface-500 flex-shrink-0 mt-0.5">
                  {p.num}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white font-mono mb-1">
                    {p.title}
                  </p>
                  <p className="text-sm text-surface-600 font-mono leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Allowed / Not Allowed */}
        <section className="mb-12">
          <h2 className="font-mono font-bold text-base uppercase tracking-widest text-surface-500 mb-5">
            What is and isn&rsquo;t allowed
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald/20 bg-emerald/5 p-5">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald mb-3">
                Allowed
              </p>
              <ul className="space-y-2">
                {ALLOWED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-mono text-surface-600">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-against-500/20 bg-against-500/5 p-5">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-against-400 mb-3">
                Not allowed
              </p>
              <ul className="space-y-2">
                {NOT_ALLOWED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <X className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-mono text-surface-600">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Strike system */}
        <section className="mb-12">
          <h2 className="font-mono font-bold text-base uppercase tracking-widest text-against-400 mb-5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Strike system
          </h2>
          <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden mb-4">
            {STRIKE_SYSTEM.map((row, idx) => (
              <div
                key={row.strikes}
                className={cn(
                  'flex items-center gap-4 px-5 py-4',
                  idx < STRIKE_SYSTEM.length - 1 && 'border-b border-surface-300'
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-24 text-xs font-mono font-bold',
                    row.color
                  )}
                >
                  {row.strikes}
                </div>
                <p className="text-sm font-mono text-surface-600">
                  {row.consequence}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Strikes are issued by Troll Catchers after reviewing flagged content. You
            can appeal a strike within 7 days by submitting a written case to a moderating
            Elder. Strikes expire after 90 days of clean behaviour.
          </p>
        </section>

        {/* Moderation */}
        <section className="mb-12">
          <h2 className="font-mono font-bold text-base uppercase tracking-widest text-surface-500 mb-5">
            How to report
          </h2>
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-4">
            <p className="text-sm font-mono text-surface-600 leading-relaxed">
              Every piece of content on Lobby Market has a report button (flag icon).
              Reports go to the community moderation queue, where Troll Catchers review
              them within 24 hours.
            </p>
            <p className="text-sm font-mono text-surface-600 leading-relaxed">
              When reporting, select the most accurate category and add a brief
              description. Vague or retaliatory reports are themselves subject to a
              review.
            </p>
            <p className="text-sm font-mono text-surface-600 leading-relaxed">
              Want to help moderate? Complete the{' '}
              <Link
                href="/moderation/training"
                className="text-gold hover:text-gold/80 underline decoration-dotted"
              >
                moderation training
              </Link>{' '}
              to earn the Troll Catcher role.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center">
          <p className="text-sm font-mono text-surface-500 mb-4">
            These guidelines were last updated April 2026. They may be revised through
            the community consensus process.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/help"
              className="px-4 py-2 rounded-lg border border-surface-300 hover:border-surface-400 text-sm font-mono text-surface-700 hover:text-white transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="/about"
              className="px-4 py-2 rounded-lg border border-surface-300 hover:border-surface-400 text-sm font-mono text-surface-700 hover:text-white transition-colors"
            >
              About
            </Link>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-white text-sm font-mono transition-colors"
            >
              Back to feed
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
