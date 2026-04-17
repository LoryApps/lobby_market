import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BarChart2,
  BookOpen,
  Coins,
  FileEdit,
  Flame,
  Gavel,
  Landmark,
  MessageSquare,
  Mic,
  Scale,
  Shield,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'About · Lobby Market',
  description:
    'Lobby Market is a consensus-building platform where ideas compete, votes decide, and the best arguments become law.',
  openGraph: {
    title: 'About · Lobby Market',
    description:
      'A platform where ideas compete, votes decide, and the best arguments become law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'About · Lobby Market',
    description:
      'A platform where ideas compete, votes decide, and the best arguments become law.',
  },
}

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Flame,
    title: 'Topics are proposed',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    description:
      'Anyone can propose a binary topic — a statement that the community votes for or against. Topics must be clear, falsifiable, and consequential.',
  },
  {
    step: '02',
    icon: Vote,
    title: 'The community votes',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
    description:
      'Every registered citizen gets one weighted vote per topic. Votes are time-locked and cannot be changed once cast. Blue = For, Red = Against.',
  },
  {
    step: '03',
    icon: TrendingUp,
    title: 'Topics gain momentum',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    description:
      'Popular topics surface in the Feed. As voting closes, topics with sufficient consensus advance to chains — branching statement trees that refine the original idea.',
  },
  {
    step: '04',
    icon: Gavel,
    title: 'Consensus becomes Law',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
    description:
      'Topics that pass voting thresholds become Laws — permanent entries in the Codex, the platform\'s living legal document. Laws can be amended by wiki-style revisions.',
  },
]

const FEATURES = [
  {
    icon: Scale,
    title: 'The Codex',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    description:
      'A Wikipedia-style collection of all passed laws, organized by category. Each law has a full body text, revision history, and a network graph showing connections to other laws.',
    href: '/law',
  },
  {
    icon: Mic,
    title: 'Debates',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    description:
      'Live structured debates between For and Against positions. Audience members vote in real time to sway opinion, and top debaters earn Clout.',
    href: '/debate',
  },
  {
    icon: Landmark,
    title: 'The Floor',
    color: 'text-purple',
    bg: 'bg-purple/10',
    description:
      'A living chamber where trending topics compete for the spotlight. The most active topics ascend to the Rostrum, visible to all citizens.',
    href: '/floor',
  },
  {
    icon: Users,
    title: 'Lobbies & Coalitions',
    color: 'text-gold',
    bg: 'bg-gold/10',
    description:
      'Organize with other citizens around shared causes. Lobbies are informal groups; Coalitions are formalized with a charter, membership rules, and campaign goals.',
    href: '/lobby',
  },
  {
    icon: Coins,
    title: 'Clout',
    color: 'text-gold',
    bg: 'bg-gold/10',
    description:
      'The platform\'s influence currency. Earn Clout by debating well, having your laws passed, moderating effectively, and contributing revisions. Spend it to boost topics.',
    href: '/clout',
  },
  {
    icon: Shield,
    title: 'Moderation',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    description:
      'Community-driven moderation via the Troll Catcher role. Flag bad-faith actors, complete moderation training, and help maintain the quality of debate.',
    href: '/moderation',
  },
  {
    icon: BarChart2,
    title: 'Analytics',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    description:
      'A personal stats dashboard showing your vote history, accuracy score, category preferences, and reputation trajectory over time.',
    href: '/analytics',
  },
  {
    icon: FileEdit,
    title: 'Wiki Revisions',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    description:
      'Every citizen can propose revisions to any Law\'s body text using a markdown editor with live preview. Revision history is preserved forever.',
    href: '/law',
  },
]

const ROLES = [
  { name: 'Citizen', color: 'text-surface-700', description: 'Default role. Can vote, propose topics, join debates.' },
  { name: 'Debator', color: 'text-for-400', description: 'Earned by participating in debates. Can submit continuations and propose revisions.' },
  { name: 'Troll Catcher', color: 'text-gold', description: 'Awarded for effective moderation. Reviews flagged content and issues strikes.' },
  { name: 'Elder', color: 'text-purple', description: 'Highest trust tier. Full moderation access and Codex edit rights.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-10 pb-28 md:pb-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-1.5 w-8 rounded-full bg-for-500" />
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-surface-500">
              About the platform
            </span>
            <div className="flex h-1.5 w-8 rounded-full bg-against-500" />
          </div>
          <h1 className="font-mono font-bold text-4xl md:text-5xl text-white mb-4 tracking-tight">
            Write the law.
            <br />
            <span className="text-surface-500">Build the consensus.</span>
          </h1>
          <p className="text-surface-600 font-mono text-base max-w-2xl mx-auto leading-relaxed">
            Lobby Market is a civic simulation platform where ideas compete in the open market of
            debate. The best arguments, validated by community vote, become permanent law in a
            living Codex.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/onboarding"
              className="px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-medium font-mono transition-colors"
            >
              Get started
            </Link>
            <Link
              href="/law"
              className="px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-medium font-mono transition-colors"
            >
              Browse the Codex
            </Link>
          </div>
        </div>

        {/* How it works */}
        <section className="mb-14">
          <h2 className="font-mono font-semibold text-xl text-white mb-6 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-for-400" />
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {HOW_IT_WORKS.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.step}
                  className={cn(
                    'rounded-2xl border p-5 bg-surface-100',
                    step.border
                  )}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0',
                        step.bg
                      )}
                    >
                      <Icon className={cn('h-4.5 w-4.5', step.color)} />
                    </div>
                    <div>
                      <span
                        className={cn(
                          'text-[10px] font-mono font-bold uppercase tracking-widest',
                          step.color
                        )}
                      >
                        Step {step.step}
                      </span>
                      <p className="text-sm font-semibold text-white font-mono mt-0.5">
                        {step.title}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-surface-600 font-mono leading-relaxed">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Features */}
        <section className="mb-14">
          <h2 className="font-mono font-semibold text-xl text-white mb-6 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple" />
            Platform features
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feat) => {
              const Icon = feat.icon
              return (
                <Link
                  key={feat.title}
                  href={feat.href}
                  className={cn(
                    'group flex items-start gap-3 rounded-xl border border-surface-300',
                    'bg-surface-100 p-4 hover:border-surface-400 hover:bg-surface-200 transition-colors'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 mt-0.5',
                      feat.bg
                    )}
                  >
                    <Icon className={cn('h-4 w-4', feat.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white font-mono group-hover:text-for-400 transition-colors">
                      {feat.title}
                    </p>
                    <p className="text-xs text-surface-600 font-mono leading-relaxed mt-0.5">
                      {feat.description}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Roles */}
        <section className="mb-14">
          <h2 className="font-mono font-semibold text-xl text-white mb-6 flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            Citizen roles
          </h2>
          <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
            {ROLES.map((role, idx) => (
              <div
                key={role.name}
                className={cn(
                  'flex items-start gap-3 px-5 py-4',
                  idx < ROLES.length - 1 && 'border-b border-surface-300'
                )}
              >
                <div className="w-28 flex-shrink-0">
                  <span className={cn('text-sm font-mono font-bold', role.color)}>
                    {role.name}
                  </span>
                </div>
                <p className="text-sm text-surface-600 font-mono leading-relaxed">
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-for-500/20 bg-for-500/5 p-8 text-center">
          <h2 className="font-mono font-bold text-2xl text-white mb-2">
            Ready to participate?
          </h2>
          <p className="text-surface-600 font-mono text-sm mb-6">
            Join thousands of citizens debating the issues that matter.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="px-6 py-2.5 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-medium font-mono transition-colors"
            >
              Create account
            </Link>
            <Link
              href="/help"
              className="px-6 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 text-surface-700 hover:text-white text-sm font-medium font-mono transition-colors"
            >
              Read the FAQ
            </Link>
            <Link
              href="/developers"
              className="px-6 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 text-surface-700 hover:text-white text-sm font-medium font-mono transition-colors"
            >
              Developer API
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
