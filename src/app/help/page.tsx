import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ChevronRight, HelpCircle, MessageSquare, Search } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Help & FAQ · Lobby Market',
  description: 'Answers to common questions about Lobby Market — voting, debates, laws, Clout, and more.',
  openGraph: {
    title: 'Help & FAQ · Lobby Market',
    description: 'Voting, debates, laws, Clout — everything you need to know about the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Help & FAQ · Lobby Market',
    description: 'Voting, debates, laws, Clout — everything you need to know about the Lobby.',
  },
}

type FaqItem = { q: string; a: string }

const FAQ_SECTIONS: { title: string; color: string; items: FaqItem[] }[] = [
  {
    title: 'Getting started',
    color: 'text-for-400',
    items: [
      {
        q: 'What is Lobby Market?',
        a: 'Lobby Market is a civic simulation platform where you propose binary topics, vote on them, and the community\'s collective decisions become permanent laws stored in the Codex. Think of it as Polymarket meets Wikipedia meets a real legislative chamber.',
      },
      {
        q: 'How do I create an account?',
        a: 'Click "Sign up" on the login page and enter your email and a password. After verifying your email, you\'ll be guided through a short calibration quiz that personalises your feed.',
      },
      {
        q: 'What does the onboarding quiz do?',
        a: 'The 5-question quiz identifies your policy preferences across economy, technology, values, power distribution, and future vision. Your answers calibrate the algorithm to surface topics you\'re likely to have strong opinions on.',
      },
      {
        q: 'Is Lobby Market anonymous?',
        a: 'Your username is public and attached to your votes. You can choose any username that doesn\'t identify you personally. Vote totals and percentages are visible to everyone, but your individual vote choice is not disclosed to other users.',
      },
    ],
  },
  {
    title: 'Voting & topics',
    color: 'text-purple',
    items: [
      {
        q: 'How does voting work?',
        a: 'Each topic is a binary statement. You vote For (blue) or Against (red). You get one vote per topic, and it cannot be changed after submission. Voting windows close after a configurable period.',
      },
      {
        q: 'What happens when a topic reaches consensus?',
        a: 'Topics that exceed the consensus threshold (typically 66%) advance to "Law" status and are permanently added to the Codex. Topics that fail are archived. Topics with close votes may enter a continuation window for further debate.',
      },
      {
        q: 'What is a continuation?',
        a: 'When a topic\'s vote is close, Debators can propose continuations — short phrase additions prefixed with "…but" or "…and" — that refine the original statement. The continuation with the most votes becomes the new canonical version.',
      },
      {
        q: 'Can I propose topics?',
        a: 'Yes. Any logged-in citizen can propose a topic from the "Create Topic" button. Topics must be phrased as binary statements (things that can be voted for or against). Off-topic, duplicate, or bad-faith topics can be reported.',
      },
    ],
  },
  {
    title: 'Laws & the Codex',
    color: 'text-emerald',
    items: [
      {
        q: 'What is the Codex?',
        a: 'The Codex is the platform\'s permanent law book — a Wikipedia-like collection of all topics that reached consensus and became laws. Each law has a full body text, a revision history, and a network graph showing how it connects to other laws.',
      },
      {
        q: 'Can laws be edited or amended?',
        a: 'Yes. Any citizen can propose a revision to a law\'s body text using the markdown editor on the law\'s page. Revisions are permanent and attributed to the editor. The revision history is always visible.',
      },
      {
        q: 'What are [[wikilinks]]?',
        a: 'Inside law body text, you can link to other laws by wrapping their name in double brackets: [[Law Name]]. These create clickable links in the rendered document and build the network graph that shows how laws relate to each other.',
      },
      {
        q: 'Can a law be repealed?',
        a: 'Yes. Original voters can file a Repeal Petition with a written case. If enough original voters co-sign the petition, the law is re-opened for a new vote. If the re-vote produces a different outcome, the law is revoked.',
      },
    ],
  },
  {
    title: 'Debates',
    color: 'text-for-300',
    items: [
      {
        q: 'What are debates?',
        a: 'Debates are live structured discussions where two sides argue For and Against a topic. Audience members can watch, react, and vote to "sway" the result. Debates have a timer and a live chat feed.',
      },
      {
        q: 'How do I join a debate?',
        a: 'Visit the Debates page, pick a live debate, and click "Join For" or "Join Against". Once you join a side, you can post arguments in the debate chat. The side with the most audience support at the end wins the sway meter.',
      },
      {
        q: 'What is the sway meter?',
        a: 'The sway meter shows real-time audience sentiment during a debate. As audience members react and vote, the meter moves toward For (blue) or Against (red). A decisive sway at debate end earns the winning side bonus Clout.',
      },
    ],
  },
  {
    title: 'Clout & reputation',
    color: 'text-gold',
    items: [
      {
        q: 'What is Clout?',
        a: 'Clout is the platform\'s influence currency. You earn it by debating well, having laws passed, contributing revisions, moderating effectively, and maintaining voting streaks. You can spend Clout to boost topics in the Feed.',
      },
      {
        q: 'What is reputation score?',
        a: 'Reputation is a long-term trust score based on your activity quality — not just volume. Voting consistently with eventual consensus, arguing effectively in debates, and avoiding moderation strikes all increase your reputation.',
      },
      {
        q: 'What is the vote accuracy metric?',
        a: 'Vote accuracy measures how often you voted in alignment with the final community consensus. A high accuracy ("Oracle") means your early votes frequently predicted the outcome. It\'s displayed in your analytics dashboard.',
      },
    ],
  },
  {
    title: 'Lobbies & coalitions',
    color: 'text-against-400',
    items: [
      {
        q: 'What is the difference between a Lobby and a Coalition?',
        a: 'Lobbies are informal cause-based groups with a shared mission and topic campaigns. Coalitions are formalized organizations with a charter, membership tiers, and an influence market for buying topic boosts.',
      },
      {
        q: 'Can I be in multiple lobbies?',
        a: 'Yes, you can join as many lobbies as you want. Coalition membership may have limits set by the coalition\'s rules.',
      },
    ],
  },
  {
    title: 'Moderation',
    color: 'text-surface-500',
    items: [
      {
        q: 'How is moderation handled?',
        a: 'Moderation is community-driven. Citizens can report topics, arguments, or users. Reports are reviewed by Troll Catchers — trusted users who have passed the moderation training quiz. Repeated violations result in strikes that reduce reputation.',
      },
      {
        q: 'How do I become a Troll Catcher?',
        a: 'Complete the moderation training module (/moderation/training), which tests your understanding of the community guidelines. Pass it and you\'ll be promoted to the Troll Catcher role, granting access to the moderation queue.',
      },
      {
        q: 'What can I report?',
        a: 'You can report topics (misleading, off-topic, duplicate), arguments in debates (ad hominem, spam), and user profiles (impersonation, ban evasion). Use the report button (flag icon) on any piece of content.',
      },
    ],
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-10 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-for-500/10 border border-for-500/20">
              <HelpCircle className="h-6 w-6 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-3xl text-white">
                Help & FAQ
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Answers to the most common questions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-surface-500 flex-wrap">
            <Link
              href="/about"
              className="flex items-center gap-1.5 hover:text-for-400 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              About the platform
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href="/guidelines"
              className="flex items-center gap-1.5 hover:text-gold transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Community guidelines
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href="/search"
              className="flex items-center gap-1.5 hover:text-purple transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              Search
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* FAQ sections */}
        <div className="space-y-10">
          {FAQ_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2
                className={cn(
                  'font-mono font-bold text-sm uppercase tracking-widest mb-4',
                  section.color
                )}
              >
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden"
                  >
                    <div className="px-5 py-3 border-b border-surface-300 bg-surface-200/40">
                      <p className="text-sm font-mono font-semibold text-white">
                        {item.q}
                      </p>
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-sm font-mono text-surface-600 leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center">
          <p className="text-sm font-mono text-surface-600 mb-3">
            Still have questions? Explore the Civic Glossary, read the community guidelines, or browse the feed.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/glossary"
              className="px-4 py-2 rounded-lg border border-for-500/40 bg-for-500/10 hover:bg-for-500/20 text-for-400 text-sm font-mono transition-colors"
            >
              Civic Glossary
            </Link>
            <Link
              href="/guidelines"
              className="px-4 py-2 rounded-lg border border-surface-300 hover:border-surface-400 text-sm font-mono text-surface-700 hover:text-white transition-colors"
            >
              Community guidelines
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
