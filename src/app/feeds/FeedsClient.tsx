'use client'

/**
 * /feeds — The Lobby Market Feeds Hub
 *
 * Lists every available RSS feed so users can subscribe in their
 * preferred reader. Covers: the combined feed, laws-only, debates,
 * per-category feeds for all 10 civic categories, and per-tag feeds.
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bot,
  Check,
  Copy,
  Cpu,
  DollarSign,
  FlaskConical,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  Landmark,
  Leaf,
  LayoutGrid,
  Lightbulb,
  MessageSquare,
  Mic,
  Music2,
  Repeat2,
  Rss,
  Scale,
  Shield,
  Thermometer,
  TreePine,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedEntry {
  title: string
  description: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  iconBorder: string
  tag?: string
  tagColor?: string
}

// ─── Feed definitions ─────────────────────────────────────────────────────────

const BASE = 'https://lobby.market'

const MAIN_FEEDS: FeedEntry[] = [
  {
    title: 'All Topics & Laws',
    description: 'The combined feed: every new law passed and every active topic currently open for debate.',
    url: `${BASE}/api/rss`,
    icon: LayoutGrid,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    tag: 'Main',
    tagColor: 'bg-for-500/20 text-for-300 border-for-500/40',
  },
  {
    title: 'Established Laws',
    description: 'Only laws — every statement that reached community consensus and became permanent civic law.',
    url: `${BASE}/api/rss/laws`,
    icon: Scale,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    tag: 'Laws',
    tagColor: 'bg-gold/20 text-gold border-gold/40',
  },
  {
    title: 'Live & Upcoming Debates',
    description: 'Scheduled and live debates — be notified before the next big civic face-off.',
    url: `${BASE}/api/rss/debates`,
    icon: Mic,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    tag: 'Debates',
    tagColor: 'bg-purple/20 text-purple border-purple/40',
  },
  {
    title: 'Top Arguments',
    description: 'The most upvoted FOR and AGAINST arguments from the past 7 days — the sharpest civic reasoning on the platform.',
    url: `${BASE}/api/rss/arguments`,
    icon: MessageSquare,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
    tag: 'Arguments',
    tagColor: 'bg-emerald/20 text-emerald border-emerald/40',
  },
  {
    title: 'Civic Relays',
    description: 'Completed multi-author relay chains — civic arguments built leg by leg, then rated compelling or not by the community.',
    url: `${BASE}/api/rss/relays`,
    icon: Repeat2,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    tag: 'Relays',
    tagColor: 'bg-purple/20 text-purple border-purple/40',
  },
]

// ─── Tag feeds — most popular civic keyword tags ──────────────────────────────

const TAG_FEEDS: FeedEntry[] = [
  {
    title: '#climate',
    description: 'Climate change, carbon, emissions, renewable energy, and environmental policy.',
    url: `${BASE}/api/rss/tag/climate`,
    icon: Thermometer,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
    tag: 'Climate',
    tagColor: 'bg-emerald/20 text-emerald border-emerald/40',
  },
  {
    title: '#ai',
    description: 'Artificial intelligence, machine learning, automation, and algorithm governance.',
    url: `${BASE}/api/rss/tag/ai`,
    icon: Bot,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    tag: 'AI',
    tagColor: 'bg-purple/20 text-purple border-purple/40',
  },
  {
    title: '#democracy',
    description: 'Elections, voting rights, democratic processes, and civic participation.',
    url: `${BASE}/api/rss/tag/democracy`,
    icon: Landmark,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    tag: 'Democracy',
    tagColor: 'bg-for-500/20 text-for-300 border-for-500/40',
  },
  {
    title: '#tax',
    description: 'Taxation, fiscal policy, revenue, and public finance debates.',
    url: `${BASE}/api/rss/tag/tax`,
    icon: DollarSign,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    tag: 'Tax',
    tagColor: 'bg-gold/20 text-gold border-gold/40',
  },
  {
    title: '#immigration',
    description: 'Immigration policy, border security, asylum, and citizenship debates.',
    url: `${BASE}/api/rss/tag/immigration`,
    icon: Globe,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
    iconBorder: 'border-for-400/30',
    tag: 'Immigration',
    tagColor: 'bg-for-400/20 text-for-300 border-for-400/40',
  },
  {
    title: '#healthcare',
    description: 'Healthcare systems, insurance, pharmaceuticals, and public health.',
    url: `${BASE}/api/rss/tag/healthcare`,
    icon: Heart,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-400/10',
    iconBorder: 'border-against-400/30',
    tag: 'Health',
    tagColor: 'bg-against-400/20 text-against-300 border-against-400/40',
  },
  {
    title: '#housing',
    description: 'Housing costs, rent control, homelessness, and affordable housing policy.',
    url: `${BASE}/api/rss/tag/housing`,
    icon: TreePine,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
    tag: 'Housing',
    tagColor: 'bg-emerald/20 text-emerald border-emerald/40',
  },
  {
    title: '#energy',
    description: 'Energy policy, renewables, nuclear, oil, and the green transition.',
    url: `${BASE}/api/rss/tag/energy`,
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    tag: 'Energy',
    tagColor: 'bg-gold/20 text-gold border-gold/40',
  },
  {
    title: '#privacy',
    description: 'Data privacy, surveillance, digital rights, and platform accountability.',
    url: `${BASE}/api/rss/tag/privacy`,
    icon: Shield,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    tag: 'Privacy',
    tagColor: 'bg-purple/20 text-purple border-purple/40',
  },
  {
    title: '#guns',
    description: 'Gun policy, Second Amendment rights, firearm regulations, and public safety.',
    url: `${BASE}/api/rss/tag/guns`,
    icon: Scale,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
    iconBorder: 'border-against-500/30',
    tag: 'Guns',
    tagColor: 'bg-against-500/20 text-against-300 border-against-500/40',
  },
  {
    title: '#labor',
    description: 'Workers\' rights, unions, minimum wage, employment, and collective bargaining.',
    url: `${BASE}/api/rss/tag/labor`,
    icon: Cpu,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    tag: 'Labor',
    tagColor: 'bg-for-500/20 text-for-300 border-for-500/40',
  },
  {
    title: '#free-speech',
    description: 'Free expression, censorship, content moderation, and platform governance.',
    url: `${BASE}/api/rss/tag/free-speech`,
    icon: Mic,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    tag: 'Speech',
    tagColor: 'bg-gold/20 text-gold border-gold/40',
  },
]

const CATEGORY_FEEDS: FeedEntry[] = [
  {
    title: 'Economics',
    description: 'Fiscal policy, markets, trade, taxation, and wealth distribution.',
    url: `${BASE}/api/rss/category/economics`,
    icon: DollarSign,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
  },
  {
    title: 'Politics',
    description: 'Governance, democracy, voting rights, international relations.',
    url: `${BASE}/api/rss/category/politics`,
    icon: Landmark,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
  },
  {
    title: 'Technology',
    description: 'AI, digital rights, privacy, platform regulation, and innovation.',
    url: `${BASE}/api/rss/category/technology`,
    icon: Cpu,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
  },
  {
    title: 'Science',
    description: 'Evidence-based policy, research funding, climate, and public health.',
    url: `${BASE}/api/rss/category/science`,
    icon: FlaskConical,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
  },
  {
    title: 'Ethics',
    description: 'Moral philosophy applied to law, justice, rights, and fairness.',
    url: `${BASE}/api/rss/category/ethics`,
    icon: Scale,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
    iconBorder: 'border-against-500/30',
  },
  {
    title: 'Philosophy',
    description: 'Foundational questions: truth, value, meaning, and political theory.',
    url: `${BASE}/api/rss/category/philosophy`,
    icon: Lightbulb,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
    iconBorder: 'border-for-400/30',
  },
  {
    title: 'Culture',
    description: 'Media, identity, tradition, free expression, and social norms.',
    url: `${BASE}/api/rss/category/culture`,
    icon: Music2,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
  },
  {
    title: 'Health',
    description: 'Healthcare policy, mental health, public health systems.',
    url: `${BASE}/api/rss/category/health`,
    icon: Heart,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-400/10',
    iconBorder: 'border-against-400/30',
  },
  {
    title: 'Environment',
    description: 'Climate action, conservation, energy transition, and environmental justice.',
    url: `${BASE}/api/rss/category/environment`,
    icon: Leaf,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
  },
  {
    title: 'Education',
    description: 'Schools, universities, curriculum, access, and lifelong learning.',
    url: `${BASE}/api/rss/category/education`,
    icon: GraduationCap,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
  },
]

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy feed URL'}
      className={cn(
        'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
        'border transition-all duration-200',
        copied
          ? 'bg-emerald/20 border-emerald/50 text-emerald'
          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 hover:bg-surface-300'
      )}
    >
      {copied ? (
        <><Check className="h-3 w-3" /> Copied</>
      ) : (
        <><Copy className="h-3 w-3" /> Copy</>
      )}
    </button>
  )
}

// ─── FeedCard ─────────────────────────────────────────────────────────────────

function FeedCard({ feed }: { feed: FeedEntry }) {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 flex flex-col gap-3 hover:border-surface-400 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border',
            feed.iconBg,
            feed.iconBorder
          )}
        >
          <feed.icon className={cn('h-4 w-4', feed.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-sm text-white">{feed.title}</span>
            {feed.tag && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                  feed.tagColor
                )}
              >
                {feed.tag}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">
            {feed.description}
          </p>
        </div>
      </div>

      {/* URL row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 bg-surface-0 border border-surface-300 rounded-lg px-3 py-1.5 overflow-hidden">
          <a
            href={feed.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors truncate block"
          >
            {feed.url}
          </a>
        </div>
        <CopyButton url={feed.url} />
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-mono text-base font-bold text-white">{title}</h2>
      <p className="text-xs font-mono text-surface-500 mt-0.5">{description}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FeedsClient() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Rss className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Feeds</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">RSS subscriptions for every corner of the Lobby</p>
            </div>
          </div>
          <p className="text-sm font-mono text-surface-400 leading-relaxed max-w-2xl">
            Subscribe to Lobby Market in your favourite RSS reader — Feedly, Reeder, NetNewsWire, or any app that supports RSS 2.0.
            Feeds update every few minutes and cover laws, active debates, top arguments, and every civic category.
          </p>
        </motion.div>

        {/* Main feeds */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
          className="mb-8"
        >
          <SectionHeader
            title="Platform Feeds"
            description="Subscribe to the whole platform or a specific content type."
          />
          <div className="space-y-3">
            {MAIN_FEEDS.map((feed) => (
              <FeedCard key={feed.url} feed={feed} />
            ))}
          </div>
        </motion.section>

        {/* Category feeds */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
          className="mb-8"
        >
          <SectionHeader
            title="Category Feeds"
            description="Only want debates on a specific subject? Subscribe to any of the 10 civic categories."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORY_FEEDS.map((feed) => (
              <FeedCard key={feed.url} feed={feed} />
            ))}
          </div>
        </motion.section>

        {/* Tag feeds */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
          className="mb-10"
        >
          <SectionHeader
            title="Tag Feeds"
            description="Subscribe by civic keyword tag — get only the debates that match your specific interest."
          />
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Hash className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
            <p className="text-xs font-mono text-surface-500">
              Any tag works — use{' '}
              <code className="bg-surface-200 text-for-300 px-1 rounded text-[10px]">
                /api/rss/tag/[your-tag]
              </code>{' '}
              for custom tags like{' '}
              <code className="bg-surface-200 text-for-300 px-1 rounded text-[10px]">/api/rss/tag/policing</code>
              {' '}or{' '}
              <code className="bg-surface-200 text-for-300 px-1 rounded text-[10px]">/api/rss/tag/abortion</code>.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TAG_FEEDS.map((feed) => (
              <FeedCard key={feed.url} feed={feed} />
            ))}
          </div>
        </motion.section>

        {/* How-to callout */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.2 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
        >
          <h3 className="font-mono text-sm font-bold text-white mb-2">
            How to subscribe
          </h3>
          <ol className="space-y-2">
            {[
              'Copy any feed URL from the list above.',
              'Open your RSS reader (Feedly, Reeder, NetNewsWire, Inoreader, etc.).',
              'Find “Add feed” or “Subscribe” and paste the URL.',
              'New laws, active topics, and top arguments will appear automatically.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs font-mono text-surface-400">
                <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-for-500/20 text-for-400 font-bold text-[10px] mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4 pt-4 border-t border-surface-300 flex items-center gap-3">
            <Link
              href="/developers"
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              View developer docs →
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/api/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              Preview main feed
            </Link>
          </div>
        </motion.div>

      </main>
      <BottomNav />
    </div>
  )
}
