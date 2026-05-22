import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  Coins,
  FileText,
  Gavel,
  Globe,
  MessageSquare,
  Scale,
  Shield,
  Swords,
  Trash2,
  UserX,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Terms of Service · Lobby Market',
  description:
    'The rules governing use of Lobby Market — user eligibility, content standards, prohibited conduct, and platform rights.',
  openGraph: {
    title: 'Terms of Service · Lobby Market',
    description:
      'The legal agreement between you and Lobby Market governing your use of the platform.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service · Lobby Market',
    description: 'The rules and agreement governing use of Lobby Market.',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  content: React.ReactNode
}

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'acceptance',
    icon: CheckCircle2,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10 border-for-500/20',
    title: 'Acceptance of Terms',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          By creating an account on Lobby Market, you agree to be bound by these
          Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use
          Lobby Market.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you
          (&ldquo;you&rdquo;, &ldquo;your&rdquo;, &ldquo;User&rdquo;) and Lobby
          Market (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
        </p>
        <p>
          We may revise these Terms at any time. Material changes will be
          communicated via email and platform notification at least 14 days in
          advance. Continued use of the platform after the effective date
          constitutes acceptance.
        </p>
      </div>
    ),
  },
  {
    id: 'eligibility',
    icon: UserX,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10 border-purple/20',
    title: 'Eligibility',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>To use Lobby Market, you must:</p>
        <ul className="space-y-1.5 list-none">
          {[
            'Be at least 16 years of age (or the minimum age of digital consent in your country)',
            'Have the legal capacity to enter into a binding agreement',
            'Not have been previously banned from Lobby Market',
            'Not be prohibited from using online services under applicable law',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-for-500 mt-0.5 flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          By registering, you represent and warrant that you meet all eligibility
          requirements. We reserve the right to terminate accounts that do not
          meet these requirements.
        </p>
      </div>
    ),
  },
  {
    id: 'account',
    icon: Shield,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10 border-emerald/20',
    title: 'Your Account',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>You are responsible for:</p>
        <ul className="space-y-1.5 list-none">
          {[
            'Maintaining the confidentiality of your password and account credentials',
            'All activity that occurs under your account',
            'Notifying us immediately of any unauthorized use of your account',
            'Keeping your email address current so we can communicate with you',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-emerald mt-0.5 flex-shrink-0">◆</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-xl bg-against-400/5 border border-against-400/20 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-against-300 flex-shrink-0 mt-0.5" />
            <p className="text-against-300 text-xs leading-relaxed">
              Creating multiple accounts to circumvent a ban, avoid vote limits,
              or manipulate platform mechanics is strictly prohibited and will
              result in permanent removal of all accounts.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'platform-mechanics',
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10 border-gold/20',
    title: 'Platform Mechanics & Voting',
    content: (
      <div className="space-y-4 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          Lobby Market is a civic simulation platform. The following rules
          govern participation in platform mechanics:
        </p>
        <div className="space-y-3">
          {[
            {
              label: 'Votes',
              desc: 'Each user receives one vote per topic. Votes are final and cannot be changed once cast. Vote limits are enforced per UTC day. Attempting to bypass vote limits is prohibited.',
            },
            {
              label: 'Laws',
              desc: 'Topics that reach the consensus threshold become Laws in the Codex. Laws are permanent platform records. While laws can be challenged through the amendment and repeal process, they cannot be deleted.',
            },
            {
              label: 'Clout',
              desc: 'Clout is a platform-internal reward token with no monetary value. It cannot be exchanged for real currency. Attempting to sell, buy, or transfer Clout outside the platform is prohibited.',
            },
            {
              label: 'Predictions',
              desc: 'Predictions are made on platform outcomes only. Clout earned through correct predictions reflects civic accuracy, not financial gain. Manipulating topics you have active predictions on to gain Clout is prohibited.',
            },
            {
              label: 'Debates',
              desc: 'Formal debate sessions are moderated events. Spam, trolling, or deliberately disrupting a debate session may result in immediate removal and a strike on your account.',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-surface-200/40 border border-surface-300/40 p-4"
            >
              <p className="font-semibold text-surface-300 text-xs mb-1">{item.label}</p>
              <p className="text-surface-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'content',
    icon: MessageSquare,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-300/10 border-for-300/20',
    title: 'Content Standards',
    content: (
      <div className="space-y-4 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          You retain ownership of content you create on Lobby Market. By posting
          content, you grant Lobby Market a non-exclusive, worldwide, royalty-free
          licence to display, reproduce, and distribute that content as part of
          the platform.
        </p>
        <div>
          <h4 className="font-semibold text-emerald mb-2 text-xs flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Permitted Content
          </h4>
          <ul className="space-y-1 list-none">
            {[
              'Arguments and rebuttals in good faith',
              'Evidence-based factual claims with citations',
              'Satire clearly identified as such',
              'Expressions of strong disagreement about ideas',
              'Topic proposals on any subject that can be voted on',
              'Law amendments that improve clarity or accuracy',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs">
                <span className="text-emerald mt-0.5 flex-shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-against-400 mb-2 text-xs flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" /> Prohibited Content
          </h4>
          <ul className="space-y-1 list-none">
            {[
              'Hate speech targeting protected characteristics (race, gender, religion, sexuality, disability, ethnicity, nationality)',
              'Incitement to violence or harassment of any individual',
              'Sexual content involving minors',
              'Deliberate disinformation presented as fact',
              'Content that infringes third-party intellectual property rights',
              'Spam, automated posting, or bulk manipulation',
              'Doxing — posting private personal information about others without consent',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs">
                <span className="text-against-400 mt-0.5 flex-shrink-0">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-surface-500">
          We reserve the right to remove content that violates these standards
          without notice. See our{' '}
          <Link href="/guidelines" className="text-for-400 hover:underline">
            Community Guidelines
          </Link>{' '}
          for detailed norms on civic participation.
        </p>
      </div>
    ),
  },
  {
    id: 'prohibited-conduct',
    icon: Ban,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-400/10 border-against-400/20',
    title: 'Prohibited Conduct',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>The following actions are prohibited and may result in account termination:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Running automated bots to vote, post, or engage',
            'Vote trading or coordinated inauthentic voting',
            'Sockpuppeting (multiple accounts to amplify positions)',
            'Impersonating other users or public figures',
            'Attempting to access other users\' accounts',
            'Reverse-engineering or scraping platform data without permission',
            'Attempting to manipulate the consensus algorithm',
            'Using the platform for commercial advertising without approval',
            'Facilitating real-money transactions using platform Clout',
            'Exploiting bugs rather than reporting them',
          ].map((item) => (
            <div
              key={item}
              className="flex items-start gap-2 rounded-lg bg-against-400/5 border border-against-400/15 p-2.5"
            >
              <Swords className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'enforcement',
    icon: Scale,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10 border-purple/20',
    title: 'Moderation & Enforcement',
    content: (
      <div className="space-y-4 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          Lobby Market uses a tiered enforcement system. Violations are handled
          by Troll Catchers (community moderators) and Elders (senior moderators).
        </p>
        <div className="space-y-2">
          {[
            {
              level: 'Warning',
              color: 'text-gold',
              bg: 'bg-gold/10 border-gold/20',
              desc: 'First-time minor violations. A formal warning is added to your account record.',
            },
            {
              level: 'Strike',
              color: 'text-against-300',
              bg: 'bg-against-400/10 border-against-400/20',
              desc: 'Repeated minor violations or a serious single violation. Three strikes in 90 days results in a temporary suspension.',
            },
            {
              level: 'Temporary suspension',
              color: 'text-against-400',
              bg: 'bg-against-400/15 border-against-400/30',
              desc: 'Access revoked for 3–30 days. Content may be hidden. Clout may be forfeited.',
            },
            {
              level: 'Permanent ban',
              color: 'text-against-500',
              bg: 'bg-against-400/20 border-against-400/40',
              desc: 'Reserved for severe violations (hate speech, bots, illegal content). Account and all associated data may be permanently deleted.',
            },
          ].map((item) => (
            <div
              key={item.level}
              className={cn('rounded-xl border p-4', item.bg)}
            >
              <p className={cn('font-semibold text-xs mb-1', item.color)}>{item.level}</p>
              <p className="text-surface-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <p>
          You may appeal moderation decisions by contacting{' '}
          <a href="mailto:moderation@lobby.market" className="text-for-400 hover:underline">
            moderation@lobby.market
          </a>
          . Include your username, the decision you are appealing, and your
          reasoning. Appeals are reviewed within 7 business days.
        </p>
      </div>
    ),
  },
  {
    id: 'intellectual-property',
    icon: BookOpen,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10 border-for-500/20',
    title: 'Intellectual Property',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          <strong className="text-surface-400">Your content:</strong> You retain
          all ownership rights to content you create. You grant Lobby Market a
          non-exclusive, worldwide, royalty-free licence to display, reproduce,
          and distribute that content for platform purposes, including in the
          Codex, civic record, and shareable exports.
        </p>
        <p>
          <strong className="text-surface-400">Our platform:</strong> The Lobby
          Market name, logo, design system, codebase, and all original platform
          content are owned by Lobby Market and protected by intellectual property
          law. You may not reproduce, copy, or adapt them without written
          permission.
        </p>
        <p>
          <strong className="text-surface-400">The Codex:</strong> Laws
          established through community consensus are part of the public civic
          record. Law text may be freely quoted with attribution to Lobby Market
          and the community that voted it into effect.
        </p>
        <p>
          If you believe content on Lobby Market infringes your intellectual
          property rights, contact{' '}
          <a href="mailto:legal@lobby.market" className="text-for-400 hover:underline">
            legal@lobby.market
          </a>
          .
        </p>
      </div>
    ),
  },
  {
    id: 'disclaimers',
    icon: AlertTriangle,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10 border-gold/20',
    title: 'Disclaimers & Limitation of Liability',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          Lobby Market is provided &ldquo;as is&rdquo; without warranties of any
          kind. We do not guarantee continuous, uninterrupted, or error-free
          access to the platform.
        </p>
        <div className="rounded-xl bg-gold/5 border border-gold/20 p-4 space-y-2">
          <p className="text-gold text-xs font-semibold">Important</p>
          <ul className="space-y-1.5 text-xs">
            {[
              'Lobby Market is a civic simulation. Laws passed on the platform have no legal force in the real world.',
              'Clout has no monetary value and cannot be exchanged for real-world currency or goods.',
              'Predictions on Lobby Market are opinion-based and not financial advice.',
              'AI-generated content (Civic Advisor, Claim Checker, etc.) may contain errors and should not be relied upon for important decisions.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-gold flex-shrink-0 mt-0.5">!</span>
                <span className="text-surface-500">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p>
          To the maximum extent permitted by law, Lobby Market shall not be
          liable for indirect, incidental, special, consequential, or punitive
          damages arising from your use of the platform. Our total liability to
          you for any claim shall not exceed the amount you paid us in the
          preceding 12 months (if any).
        </p>
      </div>
    ),
  },
  {
    id: 'termination',
    icon: Trash2,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-400/10 border-against-400/20',
    title: 'Termination',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          <strong className="text-surface-400">By you:</strong> You may delete
          your account at any time from Settings → Account. Deletion is
          irreversible. Your votes become anonymous; your published arguments may
          be anonymised and retained as part of the civic record.
        </p>
        <p>
          <strong className="text-surface-400">By us:</strong> We may suspend or
          terminate your account for violations of these Terms, illegal activity,
          or if required by law. In serious cases, we may terminate without
          notice.
        </p>
        <p>
          Upon termination, your licence to use the platform ends immediately.
          Provisions relating to intellectual property, content licences,
          disclaimer, and limitation of liability survive termination.
        </p>
      </div>
    ),
  },
  {
    id: 'governing-law',
    icon: Globe,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10 border-emerald/20',
    title: 'Governing Law',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          These Terms are governed by and construed in accordance with applicable
          law. Disputes arising from or relating to these Terms or the platform
          shall be resolved through good-faith negotiation first, then
          binding arbitration if necessary.
        </p>
        <p>
          Nothing in these Terms prevents you from exercising any rights you have
          under applicable consumer protection or data protection law in your
          country of residence.
        </p>
      </div>
    ),
  },
  {
    id: 'clout-economy',
    icon: Coins,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10 border-gold/20',
    title: 'The Clout Economy',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>
          Clout is Lobby Market&apos;s internal reward system. It is earned through
          civic participation and has no monetary value whatsoever.
        </p>
        <ul className="space-y-1.5 list-none">
          {[
            'Clout cannot be purchased, sold, or exchanged for real currency',
            'Clout balances may be adjusted by moderation action for violations',
            'Clout may be reset or modified during platform resets or season boundaries',
            'We reserve the right to modify the Clout economy at any time',
            'Clout balances are not refundable under any circumstances',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-gold mt-0.5 flex-shrink-0">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'contact',
    icon: FileText,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/20 border-surface-400/20',
    title: 'Contact',
    content: (
      <div className="space-y-3 text-sm font-mono text-surface-600 leading-relaxed">
        <p>For questions about these Terms of Service:</p>
        <div className="rounded-xl bg-surface-200/40 border border-surface-300/40 p-5 space-y-3">
          {[
            { label: 'General', email: 'hello@lobby.market' },
            { label: 'Legal', email: 'legal@lobby.market' },
            { label: 'Moderation appeals', email: 'moderation@lobby.market' },
            { label: 'Privacy / data requests', email: 'privacy@lobby.market' },
            { label: 'Security disclosures', email: 'security@lobby.market' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-surface-500 text-xs w-36 flex-shrink-0">{item.label}</span>
              <a href={`mailto:${item.email}`} className="text-for-400 hover:underline text-xs">
                {item.email}
              </a>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

// ─── Table of contents ────────────────────────────────────────────────────────

function TableOfContents() {
  return (
    <nav className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-8">
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
        Contents
      </p>
      <ol className="space-y-1.5">
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex items-center gap-2 text-sm font-mono text-surface-400 hover:text-white transition-colors"
            >
              <span className="text-surface-600 tabular-nums w-4 flex-shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TermsPage() {
  const effectiveDate = 'May 22, 2026'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/about"
              className="text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors"
            >
              About
            </Link>
            <span className="text-surface-600">·</span>
            <span className="text-xs font-mono text-surface-400">Terms of Service</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30">
              <Scale className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white leading-tight">
                Terms of Service
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1">
                Effective date: {effectiveDate}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <p className="text-sm font-mono text-surface-500 leading-relaxed">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
              use of Lobby Market, including its website, platform features, APIs,
              and any content or services made available through the platform.
            </p>
            <p className="text-sm font-mono text-surface-500 leading-relaxed mt-3">
              Please read these Terms carefully before using Lobby Market. By
              using the platform, you agree to be bound by these Terms. If you
              disagree with any part of these Terms, do not use the platform.
            </p>
          </div>
        </div>

        <TableOfContents />

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <section key={section.id} id={section.id} className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className={cn(
                      'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
                      section.iconBg
                    )}
                  >
                    <Icon className={cn('h-5 w-5', section.iconColor)} />
                  </div>
                  <h2 className="font-mono text-lg font-bold text-white">
                    {section.title}
                  </h2>
                </div>
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                  {section.content}
                </div>
              </section>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-surface-300">
          <div className="flex flex-wrap gap-4 text-xs font-mono text-surface-500">
            <Link href="/privacy" className="hover:text-surface-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/guidelines" className="hover:text-surface-400 transition-colors">
              Community Guidelines
            </Link>
            <Link href="/about" className="hover:text-surface-400 transition-colors">
              About
            </Link>
            <Link href="/help" className="hover:text-surface-400 transition-colors">
              Help & FAQ
            </Link>
          </div>
          <p className="text-[11px] font-mono text-surface-600 mt-3">
            © 2026 Lobby Market. All rights reserved.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
