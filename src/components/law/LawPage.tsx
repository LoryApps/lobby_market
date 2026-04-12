'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calendar,
  Gavel,
  List,
  Menu,
  Network,
  PanelRight,
  Tag,
  Users,
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
              </div>
            </div>

            {/* Propose revision */}
            <div className="mt-6">
              <ProposeRevisionForm
                lawId={law.id}
                currentRevisionNum={revisions[0]?.revision_num ?? 0}
              />
            </div>

            {/* Reopen petition */}
            <div className="mt-6">
              <ReopenPetition
                law={law}
                reopenRequest={reopenRequest}
                totalOriginalVoters={totalOriginalVoters}
              />
            </div>

            {/* Source topic link */}
            {topic && (
              <div className="mt-6">
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
