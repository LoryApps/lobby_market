'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  Award,
  Ban,
  BarChart2,
  BookOpen,
  Brain,
  Calendar,
  Clock,
  Compass,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  GitCompare,
  GitMerge,
  HelpCircle,
  History,
  Image as ImageIcon,
  Landmark,
  Layers,
  List,
  Menu,
  Network,
  PanelRight,
  Quote,
  Scale,
  Sparkles,
  MessageSquare,
  Star,
  Tag,
  ThumbsDown,
  TrendingUp,
  Users,
  Users2,
  X,
} from 'lucide-react'
import { SharePanel } from '@/components/ui/SharePanel'
import type {
  Law,
  LawReopenRequest,
  LawRevision,
  Profile,
  Topic,
} from '@/lib/supabase/types'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { LawDocument, parseBlocks } from './LawDocument'
import { LawBacklinks } from './LawBacklinks'
import { ReopenPetition } from './ReopenPetition'
import { ProposeRevisionForm } from './ProposeRevisionForm'
import { LawAmendmentsPanel } from './LawAmendmentsPanel'

interface LawPageProps {
  law: Law
  topic: Topic | null
  author: Profile | null
  revisions: LawRevision[]
  outgoingLinks: Law[]
  incomingLinks: Law[]
  relatedLaws: Law[]
  reopenRequest: LawReopenRequest | null
  totalOriginalVoters: number
}

interface TocItem {
  id: string
  text: string
  level: 1 | 2 | 3
}

function extractToc(markdown: string): TocItem[] {
  const blocks = parseBlocks(markdown)
  return blocks
    .filter((b): b is Extract<typeof b, { type: 'heading' }> => b.type === 'heading')
    .map((b) => ({ id: b.id, text: b.text, level: b.level }))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function LawPage({
  law,
  topic,
  author,
  revisions,
  outgoingLinks,
  incomingLinks,
  relatedLaws,
  reopenRequest,
  totalOriginalVoters,
}: LawPageProps) {
  const [tocOpen, setTocOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const currentBody = revisions[0]?.body_markdown ?? law.body_markdown ?? ''
  const toc = useMemo(() => extractToc(currentBody), [currentBody])

  const bluePct = Math.round(law.blue_pct ?? 0)
  const sideColor = bluePct >= 50 ? 'text-for-500' : 'text-against-500'
  const sideBg = bluePct >= 50 ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideLabel = bluePct >= 50 ? 'FOR' : 'AGAINST'
  const winPct = bluePct >= 50 ? bluePct : 100 - bluePct

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Top nav strip */}
      <div className="sticky top-0 z-40 bg-surface-100/95 backdrop-blur border-b border-surface-300">
        <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/law"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors'
            )}
            aria-label="Back to Codex"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-emerald" />
            <span className="text-sm font-mono text-surface-700">
              Codex /{' '}
              <span className="text-white font-semibold">
                {law.category ?? 'General'}
              </span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Share */}
            <SharePanel
              url={typeof window !== 'undefined' ? window.location.href : `/law/${law.id}`}
              text={`${law.statement} — Established Consensus Law on Lobby Market`}
              lawId={law.id}
            />
            {/* Mobile: ToC toggle */}
            <button
              onClick={() => setTocOpen((v) => !v)}
              className="lg:hidden flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Toggle table of contents"
            >
              {tocOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {/* Mobile: Backlinks panel toggle */}
            <button
              onClick={() => setPanelOpen((v) => !v)}
              className="lg:hidden flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Toggle backlinks panel"
            >
              <PanelRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Established banner */}
      <div className="bg-gradient-to-b from-emerald/10 to-transparent border-b border-emerald/20">
        <div className="max-w-[1400px] mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
              <span className="font-mono text-xs tracking-[0.2em] uppercase text-emerald font-semibold">
                Established Law
              </span>
              <span className="text-surface-500 text-xs font-mono hidden sm:inline">
                · {formatDate(law.established_at)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'px-3 py-1 rounded-full font-mono text-xs font-semibold',
                  sideBg,
                  sideColor
                )}
              >
                {sideLabel} · {winPct}%
              </div>
              <span className="text-xs font-mono text-surface-500">
                {(law.total_votes ?? 0).toLocaleString()} votes
              </span>
              <Link
                href={`/share/law/${law.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold text-[11px] font-mono hover:bg-gold/20 transition-colors"
                aria-label="Share law proclamation card"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Proclamation
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-[240px_1fr_280px] lg:gap-6">
          {/* LEFT: Table of contents */}
          <nav
            className={cn(
              'lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto',
              tocOpen ? 'block mb-6' : 'hidden'
            )}
          >
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
              <header className="flex items-center gap-2 mb-3 px-1">
                <List className="h-3.5 w-3.5 text-surface-500" />
                <h3 className="text-[11px] uppercase tracking-widest text-surface-500 font-mono font-semibold">
                  Contents
                </h3>
              </header>
              {toc.length > 0 ? (
                <ul className="space-y-1.5">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        onClick={() => setTocOpen(false)}
                        className={cn(
                          'block py-1 px-2 rounded text-[12px] font-mono text-surface-600',
                          'hover:text-emerald hover:bg-emerald/5 transition-colors',
                          'border-l',
                          item.level === 1 && 'border-emerald/40 pl-2',
                          item.level === 2 && 'border-surface-300 pl-4',
                          item.level === 3 && 'border-surface-300 pl-6 text-surface-500'
                        )}
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-surface-500 italic font-mono px-1">
                  No headings in this Law.
                </p>
              )}

              {/* Revision list */}
              {revisions.length > 0 && (
                <>
                  <hr className="my-4 border-surface-300" />
                  <header className="flex items-center gap-2 mb-2 px-1">
                    <h3 className="text-[11px] uppercase tracking-widest text-surface-500 font-mono font-semibold">
                      Revisions
                    </h3>
                    <span className="ml-auto text-[10px] font-mono text-surface-500">
                      {revisions.length}
                    </span>
                  </header>
                  <ul className="space-y-1">
                    {revisions.slice(0, 5).map((rev) => (
                      <li
                        key={rev.id}
                        className="text-[11px] font-mono text-surface-500 flex items-center justify-between px-1"
                      >
                        <span>rev #{rev.revision_num}</span>
                        <span>
                          {new Date(rev.created_at).toLocaleDateString(
                            'en-US',
                            { month: 'short', day: 'numeric' }
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </nav>

          {/* CENTER: Document */}
          <main className="min-w-0">
            <LawDocument law={law} revisions={revisions} />

            {/* Metadata bar */}
            <div
              className={cn(
                'mt-6 bg-surface-100 border border-surface-300 rounded-xl p-5',
                'flex items-center justify-between gap-4 flex-wrap'
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={author?.avatar_url}
                  fallback={
                    author?.display_name || author?.username || 'Anonymous'
                  }
                  size="md"
                />
                <div>
                  <p className="text-sm text-white font-medium">
                    {author?.display_name || author?.username || 'Anonymous'}
                  </p>
                  <p className="text-xs text-surface-500 font-mono">
                    Original author
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {law.category && (
                  <Badge variant="law" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {law.category}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                  <Users className="h-3.5 w-3.5" />
                  <span>{(law.total_votes ?? 0).toLocaleString()} votes</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDate(law.established_at)}</span>
                </div>
                <Link
                  href={`/law/${law.id}/snapshot`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-gold/10 border border-gold/30 text-gold',
                    'hover:bg-gold/20 hover:border-gold/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Snapshot
                </Link>
                <Link
                  href={`/law/${law.id}/wiki`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                  Wiki
                </Link>
                <Link
                  href={`/law/${law.id}/graph`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-emerald/10 border border-emerald/30 text-emerald',
                    'hover:bg-emerald/20 hover:border-emerald/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <Network className="h-3.5 w-3.5" />
                  View Graph
                </Link>
                <Link
                  href={`/law/${law.id}/impact`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-gold/10 border border-gold/30 text-gold',
                    'hover:bg-gold/20 hover:border-gold/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Impact Report
                </Link>
                <Link
                  href={`/law/${law.id}/frames`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-purple/10 border border-purple/30 text-purple',
                    'hover:bg-purple/20 hover:border-purple/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Frames
                </Link>
                <Link
                  href={`/law/${law.id}/blueprint`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-purple/10 border border-purple/30 text-purple',
                    'hover:bg-purple/20 hover:border-purple/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Blueprint
                </Link>
                <Link
                  href={`/law/${law.id}/community`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-for-500/10 border border-for-500/30 text-for-400',
                    'hover:bg-for-500/20 hover:border-for-500/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <Users2 className="h-3.5 w-3.5" />
                  Community
                </Link>
                <Link
                  href={`/law/${law.id}/reviews`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-gold/10 border border-gold/30 text-gold',
                    'hover:bg-gold/20 hover:border-gold/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <Star className="h-3.5 w-3.5" />
                  Reviews
                </Link>
                <Link
                  href={`/law/${law.id}/debate`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-for-500/10 border border-for-500/20 text-for-300',
                    'hover:bg-for-500/20 hover:border-for-500/40',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <Scale className="h-3.5 w-3.5" />
                  Debate Record
                </Link>
                <Link
                  href={`/law/${law.id}/revisions`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <History className="h-3.5 w-3.5" />
                  Revisions
                  {revisions.length > 0 && (
                    <span className="ml-0.5 text-[10px] font-mono font-bold opacity-70">
                      {revisions.length}
                    </span>
                  )}
                </Link>
                <Link
                  href={`/law/${law.id}/timeline`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-purple/10 border border-purple/30 text-purple',
                    'hover:bg-purple/20 hover:border-purple/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="View the full timeline of this law's journey"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Timeline
                </Link>
                <Link
                  href={`/law/${law.id}/amendments`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-for-700/20 border border-for-600/30 text-for-400',
                    'hover:bg-for-700/30 hover:border-for-600/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Amendments
                </Link>
                <Link
                  href="/civic-veto"
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-against-600/10 border border-against-500/30 text-against-400',
                    'hover:bg-against-600/20 hover:border-against-500/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Challenge this law via Civic Veto"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Veto Chamber
                </Link>
                <Link
                  href={`/law/${law.id}/counsel`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-gold/10 border border-gold/30 text-gold',
                    'hover:bg-gold/20 hover:border-gold/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Get AI analysis of this law"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ask Counsel
                </Link>
                <Link
                  href={`/law/${law.id}/steelman`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-purple/10 border border-purple/30 text-purple',
                    'hover:bg-purple/20 hover:border-purple/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="The strongest case for and against this law"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Steelman
                </Link>
                <Link
                  href={`/law/${law.id}/synthesis`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-emerald/10 border border-emerald/30 text-emerald',
                    'hover:bg-emerald/20 hover:border-emerald/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="AI-generated common ground from the founding debate"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Synthesis
                </Link>
                <Link
                  href={`/law/${law.id}/momentum`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-for-700/20 border border-for-600/30 text-for-400',
                    'hover:bg-for-700/30 hover:border-for-600/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Track community momentum since this law was established"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Momentum
                </Link>
                <Link
                  href={`/law/${law.id}/voters`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-600',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="The citizens who built this consensus"
                >
                  <Users2 className="h-3.5 w-3.5" />
                  Founders
                </Link>
                <Link
                  href={`/law/${law.id}/discuss`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-for-700/20 border border-for-600/30 text-for-300',
                    'hover:bg-for-700/30 hover:border-for-600/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Open discussion about this law's implications"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Discuss
                </Link>
                <Link
                  href={`/law/${law.id}/parallels`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-600',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Compare to similar laws from other jurisdictions"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Global Parallels
                </Link>
                <Link
                  href={`/law/${law.id}/similar`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-600',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Discover related laws in the Codex"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Similar Laws
                </Link>
                <Link
                  href={`/law/${law.id}/dissent`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-against-500/10 border border-against-500/30 text-against-400',
                    'hover:bg-against-500/20 hover:border-against-500/50 hover:text-against-300',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="See the loyal opposition — dissenting voices, civic vetoes, and amendment proposals"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Loyal Opposition
                </Link>
                <Link
                  href={`/law/${law.id}/verdict`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-gold/10 border border-gold/30 text-gold',
                    'hover:bg-gold/20 hover:border-gold/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Cast your community verdict — did this law achieve its goals?"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Verdict
                </Link>
                <Link
                  href={`/law/${law.id}/challenge`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-against-600/10 border border-against-600/30 text-against-400',
                    'hover:bg-against-600/20 hover:border-against-500/50 hover:text-against-300',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="File a formal constitutional, procedural, factual, ethical, or practical challenge to this law"
                >
                  <Gavel className="h-3.5 w-3.5" />
                  Challenge
                </Link>
                <Link
                  href={`/law/${law.id}/pulse`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-for-500/10 border border-for-500/30 text-for-300',
                    'hover:bg-for-500/20 hover:border-for-400/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Live pulse — reviews, discussions, wiki edits, challenges, and amendments in real time"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Pulse
                </Link>
                <Link
                  href={`/law/${law.id}/forecast`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-purple/10 border border-purple/30 text-purple',
                    'hover:bg-purple/20 hover:border-purple/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Stability forecast — repeal risk, amendment pressure, and predictive signals"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Forecast
                </Link>
                <Link
                  href={`/law/${law.id}/connections`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-600',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Legal ecosystem — coalition positions, sister debates, and related laws"
                >
                  <Network className="h-3.5 w-3.5" />
                  Connections
                </Link>
                <Link
                  href={`/law/${law.id}/legacy`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-600',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Law Legacy — verdicts, challenges, continuation debates, and long-term standing"
                >
                  <Landmark className="h-3.5 w-3.5" />
                  Legacy
                </Link>
                <Link
                  href={`/law/${law.id}/scorecard`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-gold/10 border border-gold/30 text-gold',
                    'hover:bg-gold/20 hover:border-gold/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Law Scorecard — performance grades across legitimacy, verdict, resilience, stability, and engagement"
                >
                  <Award className="h-3.5 w-3.5" />
                  Scorecard
                </Link>
                <Link
                  href={`/law/${law.id}/reasons`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-against-500/10 border border-against-500/20 text-against-300',
                    'hover:bg-against-500/20 hover:border-against-500/40',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Anonymous hot takes — why citizens voted FOR and AGAINST"
                >
                  <Quote className="h-3.5 w-3.5" />
                  Vote Reasons
                </Link>
                <Link
                  href={`/law/${law.id}/quotes`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Best FOR and AGAINST arguments from the founding debate"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Founding Quotes
                </Link>
                <Link
                  href={`/law/${law.id}/blocs`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-for-700/20 border border-for-600/30 text-for-300',
                    'hover:bg-for-700/30 hover:border-for-600/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="How different civic roles and clout tiers voted"
                >
                  <Users2 className="h-3.5 w-3.5" />
                  Voting Blocs
                </Link>
                <Link
                  href={`/law/${law.id}/contributors`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Top contributors to this law's debate"
                >
                  <Users className="h-3.5 w-3.5" />
                  Contributors
                </Link>
                <Link
                  href={`/law/${law.id}/quiz`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-emerald/10 border border-emerald/30 text-emerald',
                    'hover:bg-emerald/20 hover:border-emerald/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Test your knowledge of this law"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Law Quiz
                </Link>
                <Link
                  href={`/law/${law.id}/dossier`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-purple/10 border border-purple/30 text-purple',
                    'hover:bg-purple/20 hover:border-purple/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Full intelligence dossier on this law"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Dossier
                </Link>
                <Link
                  href={`/law/${law.id}/explore`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-gold/10 border border-gold/30 text-gold',
                    'hover:bg-gold/20 hover:border-gold/50',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Explore all data and context for this law"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Explore
                </Link>
                <Link
                  href={`/law/${law.id}/wiki-history`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Full edit history of the law wiki"
                >
                  <History className="h-3.5 w-3.5" />
                  Wiki History
                </Link>
                <Link
                  href={`/law/${law.id}/compare`}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                    'text-xs font-mono font-medium transition-colors'
                  )}
                  title="Compare this law side-by-side with another"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare
                </Link>
              </div>
            </div>

            {/* Propose revision */}
            <div className="mt-6">
              <ProposeRevisionForm
                lawId={law.id}
                currentRevisionNum={revisions[0]?.revision_num ?? 0}
              />
            </div>

            {/* Amendment proposals */}
            <div className="mt-6">
              <LawAmendmentsPanel lawId={law.id} />
            </div>

            {/* Reopen petition */}
            <div className="mt-6">
              <ReopenPetition
                law={law}
                reopenRequest={reopenRequest}
                totalOriginalVoters={totalOriginalVoters}
              />
            </div>

            {/* Wiki preview */}
            {law.wiki_content && law.wiki_content.trim().length > 0 && (
              <div className="mt-6">
                <Link
                  href={`/law/${law.id}/wiki`}
                  className={cn(
                    'block bg-surface-100 border border-surface-300 rounded-xl p-4',
                    'hover:border-emerald/40 hover:bg-emerald/5 transition-colors group'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-widest text-surface-500 font-mono flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      Community Wiki
                    </p>
                    <span className="text-[10px] font-mono text-emerald opacity-0 group-hover:opacity-100 transition-opacity">
                      Read more →
                    </span>
                  </div>
                  <p className="text-sm text-surface-400 font-mono leading-relaxed line-clamp-3">
                    {law.wiki_content.trim().slice(0, 240)}
                    {law.wiki_content.trim().length > 240 ? '…' : ''}
                  </p>
                </Link>
              </div>
            )}

            {/* Source topic link */}
            {topic && (
              <div className="mt-6 space-y-2">
                <Link
                  href={`/topic/${topic.id}`}
                  className={cn(
                    'block bg-surface-100 border border-surface-300 rounded-xl p-4',
                    'hover:border-for-500/40 hover:bg-for-500/5 transition-colors group'
                  )}
                >
                  <p className="text-[10px] uppercase tracking-widest text-surface-500 font-mono mb-1">
                    Source Topic
                  </p>
                  <p className="text-sm text-white font-mono group-hover:text-for-400 transition-colors">
                    {topic.statement}
                  </p>
                </Link>
                <Link
                  href={`/topic/${topic.id}/recap`}
                  className={cn(
                    'block bg-gold/5 border border-gold/30 rounded-xl p-3',
                    'hover:border-gold/50 hover:bg-gold/10 transition-colors group'
                  )}
                >
                  <p className="text-xs font-mono text-gold group-hover:text-gold/80 transition-colors text-center">
                    View Debate Recap →
                  </p>
                </Link>
              </div>
            )}
          </main>

          {/* RIGHT: Backlinks */}
          <div
            className={cn(
              'lg:block',
              panelOpen ? 'block mt-6' : 'hidden'
            )}
          >
            <LawBacklinks
              outgoingLinks={outgoingLinks}
              incomingLinks={incomingLinks}
              relatedLaws={relatedLaws}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
